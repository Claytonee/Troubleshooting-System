/**
 * Verification — data retention (DECISIONS.md D25, DATA_PROTECTION.md §4).
 *
 *  1. Report mode (the default) counts exactly the rows past their period and
 *     deletes NOTHING.
 *  2. Enforce mode deletes only rows past their period: an old rejected
 *     registration goes with its appeal, an old WhatsApp conversation with its
 *     messages; recent rows, and old rows the policy does not cover (a PENDING
 *     request, however old), stay.
 *  3. Every enforced removal leaves one audit entry; a second run removes
 *     nothing and writes nothing.
 *  4. The Security Overview carries the report, platform admin only.
 *
 * Safety: enforce mode here runs against the real local tables, so the suite
 * first checks that NO pre-existing row is due. If one is, it refuses to
 * enforce rather than delete somebody's data, and says so.
 *
 * Backdated fixture rows; everything it creates it removes. Run from backend/.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const pool = require('../src/config/database');
const retention = require('../src/services/retention');
const fixtures = require('./lib/fixtures');

const BASE = process.env.VERIFY_BASE || 'http://localhost:3210';
const TAG = 'zzverify-retention';
let passed = 0, failed = 0;
function ok(name, cond, detail) {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail !== undefined ? ' — ' + JSON.stringify(detail) : ''}`); }
}
const due = (rep, id) => (rep.policies.find(p => p.id === id) || {}).due;
const removed = (rep, id) => (rep.policies.find(p => p.id === id) || {}).removed;
const exists = async (table, id) => (await pool.query(`SELECT 1 FROM ${table} WHERE id = ?`, [id]))[0].length === 1;

(async () => {
  const [[school]] = await pool.query('SELECT id FROM schools ORDER BY id DESC LIMIT 1');
  const [[auditBase]] = await pool.query('SELECT COALESCE(MAX(id), 0) AS m FROM audit_log');
  const made = { audit_log: [], registration_requests: [], registration_appeals: [], whatsapp_conversations: [],
    whatsapp_messages: [], ussd_sessions: [], csp_reports: [], password_recovery_tokens: [], users: [] };
  const ins = async (table, sql, params) => { const [r] = await pool.query(sql, params); made[table].push(r.insertId); return r.insertId; };

  try {
    console.log('\nBaseline nothing real is due, so enforcing cannot touch real data');
    const before = await retention.run({ enforce: false });
    const realDue = before.policies.filter(p => (!p.report_only && p.due > 0) || p.error);
    ok('no pre-existing row is past its period (and every table is readable)', realDue.length === 0, realDue);
    if (realDue.length) throw new Error('refusing to run enforce mode: real rows are due — see above');

    console.log('\nFixtures one old and one recent row per policy');
    const oldAudit = await ins('audit_log', `INSERT INTO audit_log (action, summary, created_at) VALUES (?, ?, NOW() - INTERVAL 25 MONTH)`, [TAG, 'old']);
    const newAudit = await ins('audit_log', `INSERT INTO audit_log (action, summary, created_at) VALUES (?, ?, NOW() - INTERVAL 23 MONTH)`, [TAG, 'recent']);
    const reg = (status, age) => ins('registration_requests',
      `INSERT INTO registration_requests (full_name, email, password_hash, school_id, status, reviewed_at, created_at)
       VALUES (?, ?, 'x', ?, ?, ${status === 'pending' ? 'NULL' : `NOW() - INTERVAL ${age} MONTH`}, NOW() - INTERVAL ${age} MONTH)`,
      [TAG, `${TAG}-${status}-${age}@verify.local`, school.id, status]);
    const oldRejected = await reg('rejected', 13);
    const newRejected = await reg('rejected', 11);
    const oldPending = await reg('pending', 30);
    const oldAppeal = await ins('registration_appeals', `INSERT INTO registration_appeals (request_id, full_name, email, message) VALUES (?, ?, ?, 'x')`,
      [oldRejected, TAG, TAG + '@verify.local']);
    const newAppeal = await ins('registration_appeals', `INSERT INTO registration_appeals (request_id, full_name, email, message) VALUES (?, ?, ?, 'x')`,
      [newRejected, TAG, TAG + '@verify.local']);
    const conv = (age) => ins('whatsapp_conversations',
      `INSERT INTO whatsapp_conversations (phone, last_message_at, created_at) VALUES (?, NOW() - INTERVAL ${age} MONTH, NOW() - INTERVAL 20 MONTH)`, ['+255000' + age]);
    const oldConv = await conv(13);
    const newConv = await conv(2);   // started long ago, still talking: stays
    const oldMsg = await ins('whatsapp_messages', `INSERT INTO whatsapp_messages (conversation_id, direction) VALUES (?, 'in')`, [oldConv]);
    const newMsg = await ins('whatsapp_messages', `INSERT INTO whatsapp_messages (conversation_id, direction) VALUES (?, 'in')`, [newConv]);
    const ussd = (age) => ins('ussd_sessions',
      `INSERT INTO ussd_sessions (session_id, outcome, created_at, updated_at) VALUES (?, 'test', NOW() - INTERVAL ${age} MONTH, NOW() - INTERVAL ${age} MONTH)`, [`${TAG}-${age}`]);
    const oldUssd = await ussd(13);
    const newUssd = await ussd(6);
    const csp = (days) => ins('csp_reports',
      `INSERT INTO csp_reports (directive, blocked, source, line, count, first_seen, last_seen)
       VALUES ('script-src-attr', 'inline', ?, 1, 1, NOW() - INTERVAL 200 DAY, NOW() - INTERVAL ${days} DAY)`, [`/${TAG}-${days}.js`]);
    const oldCsp = await csp(91);
    const newCsp = await csp(30);
    const acct = (status, age) => ins('users',
      `INSERT INTO users (username, email, password_hash, full_name, role, status, approval_status, updated_at)
       VALUES (?, ?, 'x', 'Verify retention', 'teacher', ?, 'approved', NOW() - INTERVAL ${age} MONTH)`,
      [`${TAG}-${status}-${age}`, `${TAG}-${status}-${age}@verify.local`, status]);
    const oldInactive = await acct('inactive', 13);
    const newInactive = await acct('inactive', 6);
    const oldActive = await acct('active', 30);
    const recoveryToken = (age) => ins('password_recovery_tokens',
      `INSERT INTO password_recovery_tokens (user_id, token_hash, expires_at, used_at, created_at)
       VALUES (?, ?, NOW() - INTERVAL ${age} DAY, NOW() - INTERVAL ${age} DAY, NOW() - INTERVAL ${age} DAY)`,
      [oldActive, String(age).padStart(64, '0')]);
    const oldRecovery = await recoveryToken(31);
    const newRecovery = await recoveryToken(10);

    console.log('\nReport   counts what is due, deletes nothing');
    const rep = await retention.run({ enforce: false });
    ok('the run is marked as report-only', rep.enforce === false);
    for (const id of ['audit_log', 'rejected_registrations', 'whatsapp_conversations', 'ussd_sessions', 'csp_reports', 'password_recovery_tokens'])
      ok(`${id}: exactly the one old row is due`, due(rep, id) === 1, due(rep, id));
    ok('accounts: the one deactivated 13 months ago is counted — not the recent one, not an old active one',
      due(rep, 'inactive_accounts') === before.policies.find(p => p.id === 'inactive_accounts').due + 1);
    ok('...and nothing was removed', rep.policies.every(p => p.removed === 0));
    ok('every fixture row still exists after the report',
      (await Promise.all(Object.entries(made).flatMap(([t, ids]) => ids.map(id => exists(t, id))))).every(Boolean));

    console.log('\nEnforce  removes only what is past its period');
    const run1 = await retention.run({ enforce: true });
    ok('audit trail: the 25-month entry is gone, the 23-month one stays', !(await exists('audit_log', oldAudit)) && await exists('audit_log', newAudit));
    ok('registrations: the rejection from 13 months ago goes, with its appeal',
      !(await exists('registration_requests', oldRejected)) && !(await exists('registration_appeals', oldAppeal)));
    ok('registrations: an 11-month rejection and its appeal stay',
      await exists('registration_requests', newRejected) && await exists('registration_appeals', newAppeal));
    ok('registrations: a PENDING request stays however old — it is still awaiting a decision', await exists('registration_requests', oldPending));
    ok('WhatsApp: a conversation silent for 13 months goes with its messages',
      !(await exists('whatsapp_conversations', oldConv)) && !(await exists('whatsapp_messages', oldMsg)));
    ok('WhatsApp: a conversation started 20 months ago but active 2 months ago stays, with its messages',
      await exists('whatsapp_conversations', newConv) && await exists('whatsapp_messages', newMsg));
    ok('USSD: 13 months goes, 6 months stays', !(await exists('ussd_sessions', oldUssd)) && await exists('ussd_sessions', newUssd));
    ok('CSP inventory: unseen for 91 days goes, seen 30 days ago stays', !(await exists('csp_reports', oldCsp)) && await exists('csp_reports', newCsp));
    ok('recovery links: a 31-day-old spent link goes, a 10-day-old link stays',
      !(await exists('password_recovery_tokens', oldRecovery)) && await exists('password_recovery_tokens', newRecovery));
    ok('the run reports one removal per deleting policy', run1.policies.every(p => p.removed === (p.report_only ? 0 : 1)), run1.policies.map(p => [p.id, p.removed]));
    ok('accounts are never deleted by the job, even when enforcing — a person decides',
      await exists('users', oldInactive) && await exists('users', newInactive) && await exists('users', oldActive));

    const [trail] = await pool.query("SELECT entity_type, meta FROM audit_log WHERE id > ? AND action = 'retention.removed'", [auditBase.m]);
    ok('each enforced policy left one audit entry saying what it removed', trail.length === 6, trail.map(t => t.entity_type));

    const run2 = await retention.run({ enforce: true });
    const [trail2] = await pool.query("SELECT id FROM audit_log WHERE id > ? AND action = 'retention.removed'", [auditBase.m]);
    ok('a second run removes nothing and writes nothing', run2.policies.every(p => p.removed === 0 && (p.report_only || p.due === 0)) && trail2.length === 6);

    console.log('\nOverview the platform admin sees the report');
    const username = fixtures.PREFIX + 'admin';
    const hash = await bcrypt.hash(fixtures.PASSWORD, 10);
    const [ex] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
    if (ex.length) await pool.query("UPDATE users SET password_hash = ?, role = 'admin', status = 'active', approval_status = 'approved', must_change_password = 0 WHERE id = ?", [hash, ex[0].id]);
    else await pool.query(`INSERT INTO users (username, email, password_hash, full_name, role, status, approval_status, must_change_password)
      VALUES (?, ?, ?, 'Verify admin', 'admin', 'active', 'approved', 0)`, [username, username + '@verify.local', hash]);
    const lr = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: fixtures.PASSWORD }) });
    const token = (await lr.json()).token;
    const ov = await (await fetch(BASE + '/api/security/overview', { headers: { Authorization: 'Bearer ' + token } })).json();
    ok('overview.retention lists the seven policies with their periods',
      ov.retention && ov.retention.policies.length === 7 && ov.retention.policies.every(p => p.keep && typeof p.due === 'number'), ov.retention);
    ok('...and says whether it is only reporting', ov.retention && typeof ov.retention.enforce === 'boolean');
    ok('...counted now, not cached: it sees the deactivated account created minutes ago',
      ov.retention && ov.retention.policies.find(p => p.id === 'inactive_accounts').due === before.policies.find(p => p.id === 'inactive_accounts').due + 1);
    await pool.query('DELETE FROM users WHERE id = ?', [oldInactive]);
    const ov2 = await (await fetch(BASE + '/api/security/overview', { headers: { Authorization: 'Bearer ' + token } })).json();
    ok('...and a second read reflects the account being removed (a cached count would still show it)',
      ov2.retention && ov2.retention.policies.find(p => p.id === 'inactive_accounts').due === before.policies.find(p => p.id === 'inactive_accounts').due);
  } finally {
    // Children first; the audit entries written by the enforce runs go too.
    const del = (t) => made[t].length && pool.query(`DELETE FROM ${t} WHERE id IN (?)`, [made[t]]);
    for (const t of ['whatsapp_messages', 'whatsapp_conversations', 'registration_appeals', 'registration_requests', 'ussd_sessions', 'csp_reports', 'password_recovery_tokens', 'audit_log', 'users']) await del(t);
    await pool.query("DELETE FROM audit_log WHERE id > ? AND (action IN ('retention.removed', ?) )", [auditBase.m, TAG]);
    await fixtures.cleanup();
    console.log(`\n${'='.repeat(52)}\n  ${passed} passed, ${failed} failed\n  database restored to the state it was found in`);
    await pool.end();
    process.exitCode = failed ? 1 : 0;
  }
})().catch(async e => { console.error('\nSUITE ERROR:', e.message); try { await pool.end(); } catch (x) {} process.exitCode = 1; });
