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

  } finally {
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
