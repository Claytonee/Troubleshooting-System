/**
 * Verification — detection rules and alerts (DECISIONS.md D5 b, D6).
 *
 * Generates real attack-shaped traffic against the local server — password
 * guessing, spraying, success after failures, cross-school probing, forged
 * webhooks, a removed second factor — then runs the rules and checks that each
 * opened exactly one incident with exactly one alert, that a second run adds
 * nothing, that the incident workflow works, that only the platform admin can
 * see it, and that NOTHING was blocked (alert-only).
 *
 * Runs against a live local server; removes what it creates. Run from backend/.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const pool = require('../src/config/database');
const fixtures = require('./lib/fixtures');
const detection = require('../src/services/detection');
const totp = require('../src/services/totp');

const BASE = process.env.VERIFY_BASE || 'http://localhost:3100';
let passed = 0, failed = 0;
function ok(name, cond, detail) {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail !== undefined ? ' — ' + JSON.stringify(detail) : ''}`); }
}
async function api(method, p, { token, body, headers } = {}) {
  const res = await fetch(BASE + '/api' + p, {
    method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(headers || {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  let json = null; try { json = await res.json(); } catch (e) {}
  return { status: res.status, body: json };
}
const login = async (u, p) => (await fixtures.signIn(u, p, BASE)).token;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function upsert(username, role, schoolId) {
  const hash = await bcrypt.hash(fixtures.PASSWORD, 10);
  const [r] = await pool.query(
    `INSERT INTO users (username, email, password_hash, full_name, role, school_id, status, approval_status, must_change_password)
     VALUES (?, ?, ?, ?, ?, ?, 'active', 'approved', 0)
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), token_version = 0, mfa_enabled = 0,
       mfa_secret_enc = NULL, mfa_pending_enc = NULL, mfa_last_step = NULL, mfa_recovery = NULL, id = LAST_INSERT_ID(id)`,
    [username, username + '@verify.local', hash, 'Verify ' + role, role, schoolId || null]);
  return r.insertId;
}

(async () => {
  const fx = await fixtures.ensure();
  // R6 needs the teacher to turn two-step sign-in on and then lose it, so this
  // teacher starts without it — on purpose, and only this one.
  await fixtures.unenrol(fx.teacher.userId);
  const [[other]] = await pool.query('SELECT id FROM schools WHERE id <> ? ORDER BY id LIMIT 1', [fx.school.id]);
  const pa = await fixtures.ensurePlatformAdmin();
  const adminId = pa.id;
  const extraId = await upsert(fixtures.PREFIX + 'spray', 'teacher', fx.school.id);
  const [[base]] = await pool.query(`SELECT NOW() AS t0,
      (SELECT COALESCE(MAX(id), 0) FROM security_incidents) AS inc,
      (SELECT COALESCE(MAX(id), 0) FROM admin_notifications) AS notif,
      (SELECT COALESCE(MAX(id), 0) FROM security_events) AS ev`);
  const admin = await login(pa.username, pa.password);
  const schoolAdmin = await login(fx.schoolAdmin.username, fx.password);

  try {
    console.log('\nTraffic  shaped like the attacks each rule is for');
    for (let i = 0; i < 11; i++) await api('POST', '/auth/login', { body: { username: fx.teacher.username, password: 'guess-' + i } });   // R1
    for (const u of [fx.schoolAdmin.username, fixtures.PREFIX + 'admin', fixtures.PREFIX + 'spray', fx.teacher.username, fixtures.PREFIX + 'sub']) {
      await api('POST', '/auth/login', { body: { username: u, password: 'spray-2026' } });                                             // R2
    }
    const tok = await login(fx.teacher.username, fx.password);                                                                      // R3
    for (let i = 0; i < 6; i++) await api('GET', `/schools/${other.id}/forms`, { token: schoolAdmin });                             // R4
    for (let i = 0; i < 4; i++) await api('POST', '/heartbeat', { body: { device: 'forged' }, headers: { 'X-Heartbeat-Key': 'forged-' + i } }); // R5
    const ts = await api('POST', '/auth/mfa/setup', { token: tok });                                                                // R6
    const code = (off) => totp.hotp(totp.base32Decode(ts.body.secret), totp.stepAt() + off);
    const te = await api('POST', '/auth/mfa/enable', { token: tok, body: { code: code(0) } });
    // D32: staff cannot turn it off, so the removal R6 watches for is a supervisor's reset.
    ok('the teacher turns two-step sign-in on', te.status === 200, te.status);
    const assisted = await api('POST', '/auth/mfa/assist-reset',
      { token: schoolAdmin, body: { user_id: fx.teacher.userId, code: await fixtures.nextCode(fx.schoolAdmin.username) } });
    ok('their school admin resets it for them', assisted.status === 200, assisted.body);
    await pool.query("INSERT INTO security_events (event_type, severity, count, detail) VALUES ('events.dropped', 'high', 42, ?)",  // R7
      [JSON.stringify({ reason: 'verify-detection fixture' })]);
    await sleep(2600);   // one flush of the event recorder

    console.log('\nRules    each opens one incident, with one alert');
    const first = await detection.runOnce();
    const [incs] = await pool.query('SELECT * FROM security_incidents WHERE last_seen >= ? - INTERVAL 1 MINUTE OR id > ?', [base.t0, base.inc]);
    const find = (rule, subject) => incs.find(i => i.rule_id === rule && String(i.subject) === String(subject));
    const ip = (incs.find(i => i.rule_id === 'R5') || {}).subject;
    const expect = [
      ['R1', fx.teacher.userId, 'guessing one account'], ['R2', ip, 'spraying from one address'], ['R3', fx.teacher.userId, 'success after failures'],
      ['R4', fx.schoolAdmin.id, 'probing another school'], ['R5', ip, 'forged webhooks'], ['R6', fx.teacher.userId, 'two-step removed'], ['R7', 'monitoring', 'monitoring dropped events']
    ];
    for (const [rule, subject, label] of expect) ok(`${rule} ${label} → an incident`, !!find(rule, subject), incs.map(i => i.rule_id + ':' + i.subject));
    const r3 = find('R3', fx.teacher.userId);
    ok('R3 is rated high — a guessed password is the worst case', r3 && r3.severity === 'high', r3 && r3.severity);
    const r4 = find('R4', fx.schoolAdmin.id);
    ok('an incident explains itself: which rule, who, how many, why', r4 && /Probing/.test(r4.summary) && r4.event_count >= 5 && /403/.test(r4.why), r4 && r4.summary);

    const ids = expect.map(([rule, subject]) => (find(rule, subject) || {}).id).filter(Boolean);
    const [notes] = await pool.query(
      `SELECT CAST(JSON_UNQUOTE(JSON_EXTRACT(meta, '$.incident_id')) AS UNSIGNED) AS inc, COUNT(*) AS n
         FROM admin_notifications WHERE type = 'security_incident' AND target_role = 'admin'
          AND CAST(JSON_UNQUOTE(JSON_EXTRACT(meta, '$.incident_id')) AS UNSIGNED) IN (?) GROUP BY inc`, [ids]);
    ok('every incident sent exactly one alert to the platform admin\'s bell',
      ids.length === 7 && notes.length === 7 && notes.every(n => Number(n.n) === 1), notes);

    console.log('\nDedup    the same attack keeps being one incident');
    for (let i = 0; i < 5; i++) await api('POST', '/auth/login', { body: { username: fx.teacher.username, password: 'again-' + i } });
    await sleep(2600);
    const second = await detection.runOnce();
    const [incs2] = await pool.query('SELECT id FROM security_incidents WHERE id IN (?)', [ids]);
    const [[{ extra }]] = await pool.query(
      "SELECT COUNT(*) AS extra FROM security_incidents WHERE id > ? AND id NOT IN (?) AND rule_id IN ('R1','R3') AND subject = ?", [base.inc, ids, String(fx.teacher.userId)]);
    ok('a second run opens no new incident for the same attack', second.opened.every(o => !ids.includes(o.id)) && Number(extra) === 0, second);
    const [[n2]] = await pool.query(
      `SELECT COUNT(*) AS n FROM admin_notifications WHERE type = 'security_incident'
          AND CAST(JSON_UNQUOTE(JSON_EXTRACT(meta, '$.incident_id')) AS UNSIGNED) IN (?)`, [ids]);
    ok('...and sends no second alert', Number(n2.n) === 7, n2.n);
    // Regression: repeats were once reported as inserts, sending alerts for incident 0.
    const [orphans] = await pool.query(
      `SELECT n.id, n.meta FROM admin_notifications n
         LEFT JOIN security_incidents i ON i.id = CAST(JSON_UNQUOTE(JSON_EXTRACT(n.meta, '$.incident_id')) AS UNSIGNED)
        WHERE n.type = 'security_incident' AND n.id > ? AND i.id IS NULL`, [base.notif]);
    ok('no alert ever points at an incident that does not exist (the duplicate-alert bug)', orphans.length === 0, orphans);
    const [[r1b]] = await pool.query('SELECT event_count FROM security_incidents WHERE id = ?', [find('R1', fx.teacher.userId).id]);
    ok('...but the incident\'s count grows with the evidence', r1b.event_count > find('R1', fx.teacher.userId).event_count, r1b.event_count);

    console.log('\nWorkflow only the platform admin sees and closes incidents');
    ok('a school admin cannot read incidents', (await api('GET', '/security/incidents', { token: schoolAdmin })).status === 403);
    const list = await api('GET', '/security/incidents', { token: admin });
    ok('the platform admin sees them, named', list.status === 200 && list.body.some(i => i.id === r4.id && i.subject_username === fx.schoolAdmin.username), list.status);
    const ev = await api('GET', `/security/incidents/${r4.id}/evidence`, { token: admin });
    ok('the evidence behind an incident is one click away', ev.status === 200 && ev.body.some(e => e.path_template === '/api/schools/:id/forms'), ev.status);
    const noOutcome = await api('PATCH', `/security/incidents/${r4.id}`, { token: admin, body: { status: 'closed' } });
    ok('closing without an outcome is refused — false alarms must be counted', noOutcome.status === 400, noOutcome.status);
    const ack = await api('PATCH', `/security/incidents/${find('R1', fx.teacher.userId).id}`, { token: admin, body: { status: 'acknowledged', notes: 'Looking into it' } });
    ok('acknowledge', ack.status === 200, ack.status);
    const close = await api('PATCH', `/security/incidents/${r4.id}`, { token: admin, body: { status: 'closed', outcome: 'false_positive', notes: 'verify-detection' } });
    ok('close as a false positive', close.status === 200, close.status);
    ok('a closed incident cannot be closed again', (await api('PATCH', `/security/incidents/${r4.id}`, { token: admin, body: { status: 'closed', outcome: 'benign' } })).status === 409);
    const [[aud]] = await pool.query("SELECT COUNT(*) AS n FROM audit_log WHERE action IN ('security.incident_acknowledged', 'security.incident_closed') AND actor_id = ?", [adminId]);
    ok('both are in the audit trail', Number(aud.n) === 2, aud.n);

    console.log('\nD5       alert-only: nothing was blocked');
    ok('the guessed account can still sign in with its real password', !!await login(fx.teacher.username, fx.password));
    ok('the "spraying" address can still reach the API', (await api('GET', '/settings')).status === 200);

    console.log('\nPage     what the Security Overview says matches the code');
    // It said "seven rules" for a day after R8 shipped. The page is read aloud to
    // stakeholders, so a stale number there is a false statement, not a typo.
    const page = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'frontend', 'js', 'pages', 'security.js'), 'utf8');
    const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
    const stated = [...page.matchAll(/\b(\w+) rules\b/gi)].map(m => m[1].toLowerCase()).filter(w => WORDS.includes(w) || /^\d+$/.test(w));
    const actual = detection.RULES.length;
    ok(`every rule count on the page says ${WORDS[actual]} (${actual} rules in services/detection.js)`,
      stated.length > 0 && stated.every(w => w === WORDS[actual] || w === String(actual)), stated);
  } finally {
    await pool.query('DELETE FROM security_events WHERE id > ?', [base.ev]);
    await pool.query("DELETE FROM security_events WHERE event_type = 'events.dropped' AND detail LIKE '%verify-detection fixture%'");
    // Ours: opened during the run, or an incident about this machine's address that the
    // server's own once-a-minute scheduler opened or touched while the run was going.
    await new Promise(r => setTimeout(r, 1500));
    const [mine] = await pool.query(
      `SELECT id FROM security_incidents WHERE id > ?
          OR (last_seen >= ? - INTERVAL 1 MINUTE AND subject IN ('::1', '127.0.0.1', '::ffff:127.0.0.1', 'monitoring'))`, [base.inc, base.t0]);
    if (mine.length) {
      await pool.query(`DELETE FROM admin_notifications WHERE type = 'security_incident'
          AND CAST(JSON_UNQUOTE(JSON_EXTRACT(meta, '$.incident_id')) AS UNSIGNED) IN (?)`, [mine.map(m => m.id)]);
      await pool.query('DELETE FROM security_incidents WHERE id IN (?)', [mine.map(m => m.id)]);
    }
    await fixtures.cleanup();
    console.log(`\n${'='.repeat(52)}\n  ${passed} passed, ${failed} failed\n  database restored to the state it was found in`);
    await pool.end();
    process.exitCode = failed ? 1 : 0;
  }
})().catch(async e => { console.error('\nSUITE ERROR:', e.message, e.stack); try { await fixtures.cleanup(); await pool.end(); } catch (x) {} process.exitCode = 1; });
