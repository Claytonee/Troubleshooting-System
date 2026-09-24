/**
 * Verification — security boundaries found by the 2026-09-24 security audit.
 *
 * Each block reproduces one finding in docs/engineering/security-program/ISSUE_REGISTER.md.
 * Every assertion states the CORRECT behaviour, so against the code as it was
 * found this suite fails, and it passes only once the fix is in:
 *
 *   SEC-001  POST /errors/:id/attachments had no access check — any signed-in
 *            user could attach files to any school's fault.
 *   SEC-002  GET /schools/:id/forms had no scope; GET /schools/:id did not
 *            scope a field engineer to the schools assigned to them.
 *   SEC-003  Check-in fields and a fault's category were stored unvalidated and
 *            rendered unescaped — stored XSS into a platform admin's session.
 *   SEC-004  A field engineer could write check-ins and communications for, and
 *            delete communications of, schools that are not theirs.
 *
 * Safe by construction: the attachment probe sends NO file, so even the
 * vulnerable code never uploads anything to Cloudinary — it answers 400 "No
 * files uploaded", which is itself the proof that it got past authorisation.
 *
 * Runs against a live local server; every row it creates it removes. Run from
 * backend/:  node scripts/verify-security-boundaries.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('../src/config/database');
const fixtures = require('./lib/fixtures');

const BASE = process.env.VERIFY_BASE || 'http://localhost:3210';
const TERM = 'zzverify-term';
const PAYLOAD = '<img src=x onerror=alert(1)>';

let passed = 0, failed = 0;
function ok(name, cond, detail) {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail !== undefined ? ' — ' + JSON.stringify(detail) : ''}`); }
}
const refused = (r) => r.status === 403 || r.status === 404;

async function api(method, p, { token, body } = {}) {
  const res = await fetch(BASE + '/api' + p, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (e) { json = { raw: text.slice(0, 200) }; }
  return { status: res.status, body: json };
}

async function login(username, password) {
  const r = await api('POST', '/auth/login', { body: { username, password } });
  if (r.status !== 200) throw new Error(`login ${username} -> ${r.status} ${JSON.stringify(r.body)}`);
  return r.body.token;
}

/** A platform admin and an unassigned field engineer, under the fixture prefix so cleanup() takes them. */
async function ensureStaff(role, suffix) {
  const username = fixtures.PREFIX + suffix;
  const hash = await bcrypt.hash(fixtures.PASSWORD, 10);
  const [existing] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
  if (existing.length) {
    await pool.query("UPDATE users SET password_hash = ?, role = ?, status = 'active', approval_status = 'approved', must_change_password = 0 WHERE id = ?",
      [hash, role, existing[0].id]);
    return existing[0].id;
  }
  const [r] = await pool.query(
    `INSERT INTO users (username, email, password_hash, full_name, role, status, approval_status, must_change_password)
     VALUES (?, ?, ?, ?, ?, 'active', 'approved', 0)`,
    [username, username + '@verify.local', hash, 'Verify ' + role, role]);
  return r.insertId;
}

(async () => {
  const fx = await fixtures.ensure();
  const own = fx.school.id;
  const [[other]] = await pool.query('SELECT id FROM schools WHERE id <> ? ORDER BY id LIMIT 1', [own]);
  const [[foreignError]] = await pool.query('SELECT id FROM errors WHERE school_id = ? ORDER BY id LIMIT 1', [other.id]);
  const [[{ maxNotif }]] = await pool.query('SELECT COALESCE(MAX(id), 0) AS maxNotif FROM admin_notifications');
  // Everything this run causes to be recorded is removed at the end.
  const [[{ eventsBaseline, eventsT0 }]] = await pool.query('SELECT COALESCE(MAX(id), 0) AS eventsBaseline, NOW() AS eventsT0 FROM security_events');

  await ensureStaff('admin', 'admin');
  const subId = await ensureStaff('subadmin', 'sub');
  const [[{ n: subSchools }]] = await pool.query('SELECT COUNT(*) AS n FROM schools WHERE assigned_admin_id = ?', [subId]);
  if (subSchools) throw new Error('fixture field engineer unexpectedly has schools assigned');

  const teacher = await login(fx.teacher.username, fx.password);
  const schoolAdmin = await login(fx.schoolAdmin.username, fx.password);
  const admin = await login(fixtures.PREFIX + 'admin', fixtures.PASSWORD);
  const sub = await login(fixtures.PREFIX + 'sub', fixtures.PASSWORD);

  try {
    // ---- SEC-001: attachments on somebody else's fault ---------------------
    console.log('\nSEC-001  fault attachments are scoped like every other fault write');
    const t1 = await api('POST', `/errors/${foreignError.id}/attachments`, { token: teacher });
    ok('teacher cannot attach to another school\'s fault', refused(t1), t1);
    const s1 = await api('POST', `/errors/${foreignError.id}/attachments`, { token: schoolAdmin });
    ok('school admin cannot attach to another school\'s fault', refused(s1), s1);
    const e1 = await api('POST', `/errors/${foreignError.id}/attachments`, { token: sub });
    ok('field engineer cannot attach to a fault at a school not assigned to them', refused(e1), e1);

    const mine = await api('POST', '/errors', { token: teacher, body: {
      title: 'zzverify security probe', school_id: own, category: 'Other', priority: 'low', description: 'fixture'
    } });
    ok('teacher can still report a fault (setup)', mine.status === 201, mine);
    const mineId = mine.body && mine.body.id;
    const t2 = await api('POST', `/errors/${mineId}/attachments`, { token: teacher });
    ok('reporter reaches the upload step on their own fault (400 no files)', t2.status === 400, t2);
    const s2 = await api('POST', `/errors/${mineId}/attachments`, { token: schoolAdmin });
    ok('school admin reaches the upload step on their school\'s fault', s2.status === 400, s2);
    const nf = await api('POST', '/errors/99999999/attachments', { token: admin });
    ok('a fault that does not exist answers 404', nf.status === 404, nf);

    // ---- SEC-002: school detail and forms ----------------------------------
    console.log('\nSEC-002  school records are scoped for school admins and field engineers');
    const f1 = await api('GET', `/schools/${other.id}/forms`, { token: schoolAdmin });
    ok('school admin cannot read another school\'s forms', refused(f1), f1);
    const f2 = await api('GET', `/schools/${own}/forms`, { token: schoolAdmin });
    ok('school admin can read their own school\'s forms', f2.status === 200, f2.status);
    const g1 = await api('GET', `/schools/${other.id}`, { token: sub });
    ok('field engineer cannot open a school not assigned to them', refused(g1), g1.status);
    const g2 = await api('GET', `/schools/${other.id}/forms`, { token: sub });
    ok('field engineer cannot read forms of a school not assigned to them', refused(g2), g2.status);
    const g3 = await api('GET', `/schools/${other.id}`, { token: admin });
    ok('platform admin can open any school', g3.status === 200, g3.status);

    // ---- SEC-003: stored XSS inputs -----------------------------------------
    console.log('\nSEC-003  fields rendered into other people\'s screens are validated');
    const c1 = await api('POST', '/checkins', { token: schoolAdmin, body: {
      school_id: own, week_number: 52, term: TERM, status: 'green', connectivity: 'ok', tablets: 'ok', platform: 'ok', power: PAYLOAD
    } });
    ok('check-in refuses markup in "power"', c1.status === 400, c1);
    const c2 = await api('POST', '/checkins', { token: schoolAdmin, body: {
      school_id: own, week_number: 52, term: TERM, status: 'green', connectivity: 'issue', tablets: 'ok', platform: 'ok', power: 'ok'
    } });
    ok('check-in with ok/issue values still records', c2.status === 201, c2);
    const u1 = await api('PUT', `/errors/${mineId}`, { token: admin, body: { title: 'zzverify security probe', category: PAYLOAD } });
    ok('editing a fault refuses a category outside the list', u1.status === 400, u1);
    const u2 = await api('PUT', `/errors/${mineId}`, { token: admin, body: { title: 'zzverify security probe', category: 'Hardware', priority: 'low', status: 'open' } });
    ok('editing a fault with a listed category still works', u2.status === 200, u2);

    // The render side. A value the server already holds (older rows, a direct
    // DB edit) must still be inert, so every sink escapes regardless.
    const read = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'js', f), 'utf8');
    const RAW = /\$\{(?:d|s|c|e|h)\.(school_name|name|connectivity|tablets|platform|power|category|asset_tag|hostname|serial_number|device_model|notes|actor_name|old_value|new_value)\}/g;
    for (const f of ['pages/lrs.js', 'pages/inventory.js', 'pages/register.js', 'pages/weekly.js', 'pages/tracker.js', 'app.js']) {
      const hits = (read(f).match(RAW) || []);
      ok(`${f} renders no stored field unescaped`, hits.length === 0, hits);
    }

    // ---- SEC-004: field engineer writes outside their schools --------------
    console.log('\nSEC-004  a field engineer writes only for the schools assigned to them');
    const w1 = await api('POST', '/checkins', { token: sub, body: {
      school_id: other.id, week_number: 52, term: TERM, status: 'green'
    } });
    ok('field engineer cannot file a check-in for a school not theirs', refused(w1), w1);
    const w2 = await api('POST', '/communications', { token: sub, body: { school_id: other.id, note: 'zzverify note' } });
    ok('field engineer cannot log a communication for a school not theirs', refused(w2), w2);
    const made = await api('POST', '/communications', { token: admin, body: { school_id: other.id, note: 'zzverify note' } });
    ok('platform admin can log a communication (setup)', made.status === 201, made);
    const d1 = await api('DELETE', `/communications/${made.body && made.body.id}`, { token: sub });
    ok('field engineer cannot delete a communication of a school not theirs', refused(d1), d1);
    const [[still]] = await pool.query('SELECT COUNT(*) AS n FROM communications WHERE id = ?', [made.body && made.body.id]);
    ok('...and the row is still there', still.n === 1, still);

    // ---- Security Overview endpoint ----------------------------------------
    console.log('\nSEC-UI   the security overview is platform admin only, and leaks nothing');
    const anon = await api('GET', '/security/overview');
    ok('anonymous is refused (401)', anon.status === 401, anon.status);
    for (const [who, tok] of [['teacher', teacher], ['school admin', schoolAdmin], ['field engineer', sub]]) {
      const r = await api('GET', '/security/overview', { token: tok });
      ok(`${who} is refused (403)`, r.status === 403, r.status);
    }
    const ov = await api('GET', '/security/overview', { token: admin });
    ok('platform admin reads it (200)', ov.status === 200, ov.status);
    const raw = JSON.stringify(ov.body || {});
    const secrets = ['JWT_SECRET', 'WEBHOOK_SECRET', 'HEARTBEAT_KEY', 'WHATSAPP_APP_SECRET', 'PHONE_INTAKE_KEY', 'DB_PASSWORD']
      .map(k => process.env[k]).filter(v => v && v.length >= 6);
    ok('no configured secret value appears in the response', secrets.every(v => !raw.includes(v)), secrets.length + ' checked');
    ok('no password hash appears in the response', !/\$2[aby]\$\d\d\$/.test(raw));
    // PDPA s.31–32 (D21): the assistant's context leaves Tanzania for AWS us-east-1,
    // so it carries the role and the school's facts, never who is asking.
    const ai = fs.readFileSync(path.join(__dirname, '..', 'src', 'controllers', 'aiChatController.js'), 'utf8');
    const ctx = ai.slice(ai.indexOf('async function getUserContext'), ai.indexOf('\n}\n', ai.indexOf('async function getUserContext')));
    ok('the AI context sends no name, email, phone or username abroad', ctx.length > 0 && !/\buser\.(full_name|email|phone|username)\b/.test(ctx));
    // NIST "Identify" holds only while the endpoint inventory matches the code.
    const matrix = require('child_process').spawnSync(process.execPath, [path.join(__dirname, 'api-matrix.js'), '--check'], { encoding: 'utf8' });
    ok('the endpoint inventory matches the routers (api-matrix --check)', matrix.status === 0, (matrix.stdout || '').trim().split('\n').slice(0, 4));
    const register = fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'engineering', 'security-program', 'ISSUE_REGISTER.md'), 'utf8');
    const ids = ((ov.body && ov.body.review && ov.body.review.findings) || []).map(f => f.id);
    ok('every finding the page lists is in ISSUE_REGISTER.md', ids.length > 0 && ids.every(id => register.includes(id)),
      ids.filter(id => !register.includes(id)));

    // ---- SEC-006: refusals leave evidence, and only safe evidence ----------
    console.log('\nSEC-006  refusals are recorded — without passwords, tokens or typed usernames');
    const since = eventsBaseline;
    const waitRows = async (sql, params, pred, ms = 8000) => {
      const end = Date.now() + ms;
      for (;;) {
        const [rows] = await pool.query(sql, params);
        if (pred(rows) || Date.now() > end) return rows;
        await new Promise(r => setTimeout(r, 400));
      }
    };
    const WRONG = 'zz-Wrong-Pass-' + Date.now();
    for (let i = 0; i < 3; i++) await api('POST', '/auth/login', { body: { username: fx.teacher.username, password: WRONG } });
    const failed = await waitRows(
      "SELECT * FROM security_events WHERE (id > ? OR last_at >= ?) AND event_type = 'auth.login_failed' AND user_id = ?",
      [since, eventsT0, fx.teacher.userId], r => r.length && r[0].count >= 3);
    ok('three wrong passwords on one account are recorded', failed.length >= 1, failed.length);
    ok('...as one row with count 3, not three rows', failed.length === 1 && failed[0].count === 3, failed.map(r => r.count));
    ok('...marked wrong_password against the account', failed[0] && /wrong_password/.test(failed[0].detail || ''), failed[0] && failed[0].detail);

    const ghost = 'zzghost' + Date.now();
    await api('POST', '/auth/login', { body: { username: ghost, password: WRONG } });
    const unknown = await waitRows(
      "SELECT * FROM security_events WHERE (id > ? OR last_at >= ?) AND event_type = 'auth.login_failed' AND user_id IS NULL",
      [since, eventsT0], r => r.length > 0);
    ok('a sign-in for an account that does not exist is recorded', unknown.length > 0);

    const badTok = 'eyJhbGciOiJIUzI1NiJ9.eyJpZCI6MX0.zzForgedSignatureValue';
    await api('GET', '/dashboard', { token: badTok });
    await api('GET', '/errors/987654');
    await api('GET', '/schools/' + other.id, { token: teacher });                  // role refusal
    await api('GET', `/schools/${other.id}/forms`, { token: schoolAdmin });         // record refusal
    await api('POST', '/heartbeat', { body: { device: 'zz' } });                    // no key

    // A repeat within 60 s of an earlier suite's identical event folds into that row
    // (by design), so "this run's evidence" is a new row OR one touched since the start.
    const all = await waitRows('SELECT * FROM security_events WHERE id > ? OR last_at >= ?', [since, eventsT0],
      // Wait for each specific row, not merely for each type: rows of one type can
      // land in different 2-second flushes.
      r => r.some(x => x.event_type === 'auth.token_rejected' && /bad_token/.test(x.detail || ''))
        && r.some(x => x.event_type === 'auth.token_rejected' && x.path_template === '/api/errors/:id')
        && ['authz.role_refused', 'authz.refused', 'webhook.rejected'].every(t => r.some(x => x.event_type === t)));
    const has = (type, pred = () => true) => all.some(r => r.event_type === type && pred(r));
    ok('a forged token is recorded as bad_token', has('auth.token_rejected', r => /bad_token/.test(r.detail || '')));
    // Regression for the dedup key: a forged token must not fold into a missing-token row.
    await api('GET', '/dashboard/zzprobe');                                            // no token → no_token
    await api('GET', '/dashboard/zzprobe', { token: badTok });                         // forged → bad_token
    const both = await waitRows(
      "SELECT detail FROM security_events WHERE path_template = '/api/dashboard/zzprobe' AND (id > ? OR last_at >= ?)",
      [since, eventsT0], r => r.length >= 2);
    ok('a forged token and a missing token on the same route stay separate evidence',
      both.some(r => /no_token/.test(r.detail || '')) && both.some(r => /bad_token/.test(r.detail || '')), both.map(r => r.detail));
    ok('a teacher on a staff-only route is recorded as a role refusal', has('authz.role_refused', r => r.role === 'teacher'));
    ok('a school admin on another school is recorded as a record refusal, by route template',
      has('authz.refused', r => r.path_template === '/api/schools/:id/forms' && r.role === 'school'));
    ok('a heartbeat without its key is recorded as a rejected webhook', has('webhook.rejected'));
    ok('successful sign-ins are recorded too', has('auth.login_ok', r => r.user_id === fx.teacher.userId));

    const dump = JSON.stringify(all);
    ok('no password ever reaches the table', !dump.includes(WRONG) && !dump.includes(fixtures.PASSWORD));
    ok('no token ever reaches the table', !dump.includes(badTok) && !dump.includes('zzForgedSignatureValue') && !dump.includes(teacher.slice(-20)));
    ok('the typed name of a non-existent account is not kept', !dump.includes(ghost));
    ok('ids in unmatched URLs are masked', !dump.includes('987654') && has('auth.token_rejected', r => r.path_template === '/api/errors/:id'));
    ok('events carry the source address', all.every(r => r.event_type === 'events.dropped' || !!r.source_ip));

    // ---- SEC-005 / SEC-011: sessions end when they must, and only then -----
    console.log('\nSEC-005  sessions can be revoked — without signing anyone out on rollout');
    const jwt = require('jsonwebtoken');
    const legacy = jwt.sign({ id: fx.teacher.userId, role: 'teacher', username: fx.teacher.username }, process.env.JWT_SECRET, { expiresIn: '1h' });
    ok('a token issued before versioning (no tv) still works — nobody signed out on rollout',
      (await api('GET', '/dashboard', { token: legacy })).status === 200);

    const tA = await login(fx.teacher.username, fx.password);
    const tB = await login(fx.teacher.username, fx.password);
    const NEWPW = 'Changed-Pass-2026!';
    const cp = await api('PUT', '/auth/change-password', { token: tA, body: { current_password: fx.password, new_password: NEWPW } });
    ok('changing a password answers with a fresh token for this device', cp.status === 200 && !!(cp.body && cp.body.token), cp.status);
    ok('...the fresh token works', (await api('GET', '/dashboard', { token: cp.body && cp.body.token })).status === 200);
    const rB = await api('GET', '/dashboard', { token: tB });
    ok('...another device\'s session has ended', rB.status === 401 && rB.body && rB.body.code === 'SESSION_REVOKED', rB);
    ok('...the old token of this device has ended too', (await api('GET', '/dashboard', { token: tA })).status === 401);
    ok('...and so has the pre-versioning token', (await api('GET', '/dashboard', { token: legacy })).status === 401);

    const s1tok = await login(fx.schoolAdmin.username, fx.password);
    const s2tok = await login(fx.schoolAdmin.username, fx.password);
    const out = await api('POST', '/auth/sessions/revoke-all', { token: s1tok });
    ok('"sign out everywhere" answers 200', out.status === 200, out);
    ok('...and every session of that account has ended',
      (await api('GET', '/dashboard', { token: s1tok })).status === 401 && (await api('GET', '/dashboard', { token: s2tok })).status === 401);

    console.log('\nSEC-011  an admin-set password is temporary, and ends every session');
    const sBefore = await login(fx.schoolAdmin.username, fx.password);
    const short = await api('PATCH', `/school-admins/${fx.schoolAdmin.id}/password`, { token: admin, body: { new_password: 'short1' } });
    ok('a reset shorter than 8 characters is refused', short.status === 400, short.status);
    const TEMP = 'Temp-Pass-2026!';
    const reset = await api('PATCH', `/school-admins/${fx.schoolAdmin.id}/password`, { token: admin, body: { new_password: TEMP } });
    ok('platform admin resets a school admin\'s password', reset.status === 200, reset);
    ok('...the school admin\'s existing session has ended', (await api('GET', '/dashboard', { token: sBefore })).status === 401);
    const relog = await api('POST', '/auth/login', { body: { username: fx.schoolAdmin.username, password: TEMP } });
    ok('...they sign in with the temporary password and are told to change it',
      relog.status === 200 && relog.body.user.must_change_password === true, relog.body && relog.body.user);
    const sNew = relog.body && relog.body.token;

    console.log('\nD3       reactivation does not revive a token taken before suspension');
    const tStolen = await login(fx.teacher.username, NEWPW);
    const susp = await api('PATCH', `/register/teachers/${fx.teacher.teacherId}/status`, { token: sNew, body: { status: 'suspended' } });
    ok('school admin suspends the teacher', susp.status === 200, susp);
    ok('...the teacher\'s token is refused', (await api('GET', '/dashboard', { token: tStolen })).status === 401);
    const react = await api('PATCH', `/register/teachers/${fx.teacher.teacherId}/status`, { token: sNew, body: { status: 'active' } });
    ok('school admin reactivates the teacher', react.status === 200, react);
    ok('...the token from before the suspension is STILL refused', (await api('GET', '/dashboard', { token: tStolen })).status === 401);
    ok('...a fresh sign-in works', (await api('POST', '/auth/login', { body: { username: fx.teacher.username, password: NEWPW } })).status === 200);

    console.log('\nSEC-009  sign-in guessing is throttled — and the throttle is recorded');
    const srv = fs.readFileSync(path.join(__dirname, '..', 'src', 'server.js'), 'utf8');
    ok('production limits are 20 per account+network, 120 per network, 60 per account (the documented control)',
      /NODE_ENV === 'production'\s*\n?\s*\?\s*\{ accountNetwork: 20, network: 120, account: 60 \}/.test(srv));
    ok('the per-account limiter is mounted on /api/auth/login',
      /app\.use\('\/api\/auth\/login', authIpLimiter, authAccountLimiter, authLimiter\)/.test(srv));
    const victim = 'zzthrottle' + Date.now();
    let throttledAt = 0;
    for (let i = 1; i <= 1300 && !throttledAt; i++) {
      const r = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: victim, password: 'guess' + i }) });
      if (r.status === 429) throttledAt = i;
    }
    ok('repeated guessing on one account is throttled (429)', throttledAt > 0, throttledAt);
    const thr = await waitRows(
      "SELECT count FROM security_events WHERE event_type = 'auth.login_throttled' AND (id > ? OR last_at >= ?)",
      [since, eventsT0], r => r.length > 0);
    ok('...and the throttling is recorded as auth.login_throttled', thr.length > 0);

    const revokedRows = await waitRows(
      "SELECT detail FROM security_events WHERE event_type = 'auth.sessions_revoked' AND (id > ? OR last_at >= ?)",
      [since, eventsT0], r => r.length >= 4);
    const reasons = revokedRows.map(r => (JSON.parse(r.detail || '{}').reason));
    ok('every revocation is recorded with its reason',
      ['password_changed', 'sign_out_everywhere', 'password_reset_by_admin', 'suspended_by_school_admin'].every(x => reasons.includes(x)), reasons);
    const revTok = await waitRows(
      "SELECT detail FROM security_events WHERE event_type = 'auth.token_rejected' AND detail LIKE '%revoked_token%' AND (id > ? OR last_at >= ?)",
      [since, eventsT0], r => r.length > 0);
    ok('use of a revoked token is recorded as revoked_token', revTok.length > 0);
  } finally {
    // Longer than one flush interval, so nothing this run caused lands after the delete.
    await new Promise(r => setTimeout(r, 2600));
    await pool.query("DELETE FROM security_events WHERE id > ?", [eventsBaseline]);
    await pool.query("DELETE FROM weekly_checkins WHERE term = ?", [TERM]);
    await pool.query("DELETE FROM communications WHERE note = 'zzverify note'");
    await pool.query(
      `DELETE FROM admin_notifications WHERE id > ? AND (title LIKE '%zzverify%' OR message LIKE '%zzverify%'
         OR CAST(JSON_UNQUOTE(JSON_EXTRACT(meta, '$.school_id')) AS UNSIGNED) = ?)`, [maxNotif, own]);
    await fixtures.cleanup();
    console.log('\n' + '='.repeat(52));
    console.log(`  ${passed} passed, ${failed} failed`);
    console.log('  database restored to the state it was found in');
    await pool.end();
    process.exitCode = failed ? 1 : 0;
  }
})().catch(async (e) => {
  console.error('\nSUITE ERROR:', e.message);
  try { await fixtures.cleanup(); await pool.end(); } catch (x) {}
  process.exitCode = 1;
});
