/**
 * Verification — forgotten-password recovery and supervisor MFA resets (D32).
 *
 * Suite-owned accounts only, and an injected mail sender: no email leaves the
 * machine, no real account changes, and every row is removed afterwards.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const pool = require('../src/config/database');
const fixtures = require('./lib/fixtures');
const recovery = require('../src/services/accountRecovery');
const policy = require('../src/services/mfaPolicy');
const totp = require('../src/services/totp');

const BASE = process.env.VERIFY_BASE || 'http://localhost:3210';
let passed = 0, failed = 0;
function ok(name, condition, detail) {
  if (condition) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail !== undefined ? ' — ' + JSON.stringify(detail) : ''}`); }
}
async function api(method, endpoint, body, token) {
  const response = await fetch(BASE + '/api' + endpoint, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

const appCode = (secret) => totp.hotp(totp.base32Decode(secret), totp.stepAt());
// A code works once per 30-second step; the suite spends several, so it forgets the last one.
const forgetStep = (userId) => pool.query('UPDATE users SET mfa_last_step = NULL WHERE id = ?', [userId]);
const savedLeft = async (userId) => JSON.parse((await pool.query('SELECT mfa_recovery FROM users WHERE id = ?', [userId]))[0][0].mfa_recovery || '[]').length;

/** A recovery started through the service with a captured email, past the per-account cooldown. */
async function flowFor(identifier, userId) {
  if (userId) await pool.query('UPDATE account_recovery_flows SET created_at = created_at - INTERVAL 2 HOUR WHERE user_id = ?', [userId]);
  let mail = null;
  const result = await recovery.start(identifier, { emailConfigured: true, sendMail: async m => { mail = m; return { sent: true }; } });
  if (result.delivery) await result.delivery;
  const code = mail ? ((mail.text.match(/code is: (\d{6})/) || [])[1] || null) : null;
  return { flow: result.flowId, code, result, mail };
}

(async () => {
  const fx = await fixtures.ensure();
  const admin = await fixtures.ensurePlatformAdmin();
  const field = await fixtures.ensureFieldEngineer();
  const teacherId = fx.teacher.userId;
  const schoolAdminId = fx.schoolAdmin.id;
  // Recovery WITHOUT the authenticator is part of what this suite tests, so the
  // teacher, the school admin and the platform admin start without two-step sign-in
  // — explicitly — and are enrolled below where the story needs it. The field
  // engineer keeps the fixture enrolment.
  for (const id of [teacherId, schoolAdminId, admin.id]) await fixtures.unenrol(id);
  const [[clock]] = await pool.query('SELECT COALESCE(MAX(id), 0) m, NOW() t FROM security_events');
  const newPassword = 'Recovered-teacher#5173';
  const secrets = [];
  const remember = (...values) => { secrets.push(...values.filter(Boolean)); };
  const auditRequests = async (id) => Number((await pool.query(
    "SELECT COUNT(*) n FROM audit_log WHERE action = 'auth.recovery_requested' AND entity_id = ?", [String(id)]))[0][0].n);
  try {
    console.log('\nPolicy  two-step sign-in is required for every staff role');
    ok('platform admin, field engineer, school admin and teacher all require it',
      ['admin', 'subadmin', 'school', 'teacher'].every(policy.isRequiredFor));
    ok('staff are asked before their date and required from it',
      !policy.mustEnrolNow({ role: 'teacher', mfa_enabled: 0 }, new Date('2026-10-08T12:00:00+03:00'))
      && policy.mustEnrolNow({ role: 'teacher', mfa_enabled: 0 }, new Date('2026-10-09T00:00:01+03:00')));
    ok('the platform admin keeps its own, earlier date', policy.enforceAfter('admin') < policy.enforceAfter('teacher'));

    console.log('\nPrivacy  every identifier gets the same answer');
    const unknown = await api('POST', '/auth/recovery/start', { identifier: 'nobody-' + Date.now() + '@verify.local' });
    const known = await api('POST', '/auth/recovery/start', { identifier: fx.teacher.username });
    ok('unknown and real accounts both answer 202', unknown.status === 202 && known.status === 202, [unknown.status, known.status]);
    ok('...with the same message and the same fields',
      unknown.body.message === known.body.message
      && JSON.stringify(Object.keys(unknown.body).sort()) === JSON.stringify(Object.keys(known.body).sort()), [unknown.body, known.body]);
    ok('...and a 256-bit flow id that says nothing about the account',
      /^[A-Za-z0-9_-]{43}$/.test(unknown.body.flow) && /^[A-Za-z0-9_-]{43}$/.test(known.body.flow));
    const ghost = await api('POST', '/auth/recovery/verify', { flow: unknown.body.flow, email_code: '123456', totp_code: '123456' });
    const real = await api('POST', '/auth/recovery/verify', { flow: known.body.flow, email_code: '123456', totp_code: '123456' });
    ok('wrong codes on an unknown account look exactly like wrong codes on a real one',
      ghost.status === 400 && real.status === 400 && JSON.stringify(ghost.body) === JSON.stringify(real.body), [ghost.body, real.body]);

    console.log('\nTiming and storage  mail after the answer, nothing secret at rest');
    let hung = false;
    await pool.query('UPDATE account_recovery_flows SET created_at = created_at - INTERVAL 2 HOUR WHERE user_id = ?', [field.id]);
    const failedAuditBefore = await auditRequests(field.id);
    const began = Date.now();
    const slow = await recovery.start(field.username, {
      emailConfigured: true,
      sendMail: () => new Promise(resolve => setTimeout(() => { hung = true; resolve({ sent: false, error: 'smtp timeout' }); }, 1500))
    });
    ok('start() returns before SMTP finishes', slow.emailQueued && !hung && Date.now() - began < 1000, Date.now() - began);
    const late = await slow.delivery;
    const [[voided]] = await pool.query('SELECT email_code_hash FROM account_recovery_flows WHERE flow_hash = ?', [recovery.sha256(slow.flowId)]);
    ok('a code whose email failed is voided', late.sent === false && voided.email_code_hash === null);
    ok('a failed email writes no recovery-request audit row', await auditRequests(field.id) === failedAuditBefore);

    const stored = await flowFor(fx.teacher.username, teacherId);
    remember(stored.code, stored.flow);
    const [[row]] = await pool.query('SELECT flow_hash, email_code_hash, email_code_expires, expires_at FROM account_recovery_flows WHERE flow_hash = ?', [recovery.sha256(stored.flow)]);
    ok('the email carries a 6-digit code', /^\d{6}$/.test(stored.code || ''), stored.mail && stored.mail.subject);
    ok('the flow id is stored only as SHA-256', row && row.flow_hash === recovery.sha256(stored.flow) && row.flow_hash !== stored.flow);
    ok('the email code is stored only as an HMAC bound to its flow',
      row.email_code_hash === recovery.emailCodeHash(stored.flow, stored.code) && row.email_code_hash !== recovery.sha256(stored.code));
    ok('the code lasts 10 minutes, the flow 15',
      new Date(row.email_code_expires) - Date.now() > 9 * 60000 && new Date(row.email_code_expires) - Date.now() <= 10 * 60000 + 2000
      && new Date(row.expires_at) - Date.now() > 14 * 60000);
    const [[pending]] = await pool.query("SELECT approval_status FROM users WHERE id = ?", [teacherId]);
    await pool.query("UPDATE users SET approval_status = 'pending' WHERE id = ?", [teacherId]);
    const notApproved = await flowFor(fx.teacher.username, teacherId);
    await pool.query('UPDATE users SET approval_status = ? WHERE id = ?', [pending.approval_status, teacherId]);
    ok('an account still awaiting approval gets no code', !notApproved.result.emailQueued && !notApproved.mail);

    console.log('\nEmails  plain text and HTML, branded, and not one link');
    const m = stored.mail || {};
    const noLink = (s) => !/<a\b|href\s*=|https?:\/\/|www\./i.test(s || '');
    ok('the code email has an HTML version as well as the text, both carrying the code',
      !!m.html && m.html.includes(stored.code) && (m.text || '').includes(stored.code));
    ok('...branded "OE Technical Support" in the subject and the HTML', /OE Technical Support/.test(m.subject || '') && /OE Technical Support/.test(m.html || ''));
    ok('...with no link anywhere', noLink(m.html) && noLink(m.text));
    ok('...and "Nobody from OE will ever ask you for this code." in both versions',
      [m.text, m.html].every(s => (s || '').includes('Nobody from OE will ever ask you for this code.')));
    const notice = recovery.changedEmail({ full_name: '<img src=x onerror=alert(1)>' }, ['email', 'recovery_code']);
    ok('the "password was changed" notice has HTML too, says how, and escapes the name',
      !!notice.html && /email \+ recovery code/.test(notice.html) && /email \+ recovery code/.test(notice.text)
      && !/<img/.test(notice.html) && /&lt;img/.test(notice.html), notice.subject);
    ok('...branded, and with no link', /OE Technical Support/.test(notice.subject) && noLink(notice.html) && noLink(notice.text));

    console.log('\nCooldown and audit  one email a minute; the trail only after confirmed delivery');
    let before = await auditRequests(teacherId);
    const queued = await flowFor(fx.teacher.username, teacherId);   // past the cooldown: a code is sent
    remember(queued.code, queued.flow);
    ok('a code sent to a real, eligible account writes one audit row', queued.result.emailQueued && await auditRequests(teacherId) === before + 1);
    before = await auditRequests(teacherId);
    let againMail = null;
    const again = await recovery.start(fx.teacher.username, { emailConfigured: true, sendMail: async mail => { againMail = mail; return { sent: true }; } });
    if (again.delivery) await again.delivery;
    ok('a second start within 60 seconds queues no new code (per-account cooldown)',
      !again.emailQueued && again.reason === 'email_throttled' && !againMail, { queued: again.emailQueued, reason: again.reason });
    ok('...and writes no audit row', await auditRequests(teacherId) === before);
    await pool.query("UPDATE users SET approval_status = 'pending' WHERE id = ?", [teacherId]);
    const ineligible = await flowFor(fx.teacher.username, teacherId);
    await pool.query('UPDATE users SET approval_status = ? WHERE id = ?', [pending.approval_status, teacherId]);
    ok('an ineligible account writes no audit row either', !ineligible.result.emailQueued && await auditRequests(teacherId) === before);
    const [[anonBefore]] = await pool.query("SELECT COUNT(*) n FROM audit_log WHERE action = 'auth.recovery_requested' AND (entity_id IS NULL OR entity_id = '')");
    await recovery.start('nobody-' + Date.now() + '@verify.local', { emailConfigured: true, sendMail: async () => ({ sent: true }) });
    const [[anonAfter]] = await pool.query("SELECT COUNT(*) n FROM audit_log WHERE action = 'auth.recovery_requested' AND (entity_id IS NULL OR entity_id = '')");
    ok('an unknown name writes no audit row: an anonymous caller cannot flood the audit trail', Number(anonAfter.n) === Number(anonBefore.n));

    console.log('\nTwo of three  an account with the authenticator needs two proofs');
    const login0 = await api('POST', '/auth/login', { username: fx.teacher.username, password: fx.password });
    ok('the teacher signs in before recovery (no two-step yet)', login0.status === 200 && !!login0.body.token, login0.body);
    const teacher = await fixtures.enrol(teacherId);
    remember(teacher.secret, ...teacher.recoveryCodes);

    let f = await flowFor(fx.teacher.username, teacherId);
    remember(f.code);
    let r = await api('POST', '/auth/recovery/verify', { flow: f.flow, email_code: f.code });
    ok('the email code alone is refused', r.status === 400 && r.body.code === 'RECOVERY_CODES_WRONG' && r.body.attempts_left === 4, r.body);
    r = await api('POST', '/auth/recovery/verify', { flow: f.flow, totp_code: appCode(teacher.secret) });
    ok('the authenticator code alone is refused', r.status === 400 && r.body.code === 'RECOVERY_CODES_WRONG', r.body);
    await forgetStep(teacherId);
    r = await api('POST', '/auth/recovery/verify', { flow: f.flow, email_code: f.code, totp_code: '000000' === appCode(teacher.secret) ? '111111' : '000000' });
    ok('email + a wrong authenticator code is refused', r.status === 400 && r.body.attempts_left === 2, r.body);
    r = await api('POST', '/auth/recovery/verify', { flow: f.flow, email_code: f.code, totp_code: appCode(teacher.secret) });
    ok('...and the email code was not burned by that: email + authenticator now passes', r.status === 200 && /^[A-Za-z0-9_-]{43}$/.test(r.body.reset_token || ''), r.body);
    remember(r.body.reset_token);
    const firstReset = { flow: f.flow, token: r.body.reset_token };
    const [[claimed]] = await pool.query('SELECT mfa_last_step FROM users WHERE id = ?', [teacherId]);
    ok('the authenticator step is spent, so the same code cannot sign in next', claimed.mfa_last_step !== null);
    r = await api('POST', '/auth/recovery/verify', { flow: f.flow, email_code: f.code, totp_code: appCode(teacher.secret) });
    ok('a verified flow cannot be verified again', r.status === 400 && r.body.code === 'RECOVERY_EXPIRED', r.body);

    await forgetStep(teacherId);
    f = await flowFor(fx.teacher.username, teacherId);
    r = await api('POST', '/auth/recovery/verify', { flow: f.flow, totp_code: appCode(teacher.secret), recovery_code: teacher.recoveryCodes[0] });
    ok('lost email: authenticator + a saved recovery code passes', r.status === 200 && !!r.body.reset_token, r.body);
    ok('...and that recovery code is spent (9 left)', await savedLeft(teacherId) === 9);

    f = await flowFor(fx.teacher.username, teacherId);
    remember(f.code);
    r = await api('POST', '/auth/recovery/verify', { flow: f.flow, email_code: f.code, recovery_code: teacher.recoveryCodes[1] });
    ok('lost phone: email + a saved recovery code passes', r.status === 200 && !!r.body.reset_token, r.body);
    r = await api('POST', '/auth/recovery/verify', { flow: (await flowFor(fx.teacher.username, teacherId)).flow, totp_code: '123456', recovery_code: teacher.recoveryCodes[1] });
    ok('a spent recovery code does not count again', r.status === 400, r.body);

    f = await flowFor(fx.teacher.username, teacherId);
    for (let i = 0; i < 5; i++) await api('POST', '/auth/recovery/verify', { flow: f.flow, email_code: '000000', totp_code: '000000' });
    await forgetStep(teacherId);
    r = await api('POST', '/auth/recovery/verify', { flow: f.flow, email_code: f.code, totp_code: appCode(teacher.secret) });
    ok('after five wrong tries the flow is dead, even for the right codes', r.status === 400 && r.body.code === 'RECOVERY_EXPIRED', r.body);

    f = await flowFor(fx.teacher.username, teacherId);
    await pool.query('UPDATE account_recovery_flows SET email_code_expires = NOW() - INTERVAL 1 SECOND WHERE flow_hash = ?', [recovery.sha256(f.flow)]);
    await forgetStep(teacherId);
    r = await api('POST', '/auth/recovery/verify', { flow: f.flow, email_code: f.code, totp_code: appCode(teacher.secret) });
    ok('an email code older than 10 minutes does not count', r.status === 400 && r.body.code === 'RECOVERY_CODES_WRONG', r.body);

    const schoolFlow = await flowFor(fx.schoolAdmin.username, schoolAdminId);
    remember(schoolFlow.code);
    r = await api('POST', '/auth/recovery/verify', { flow: schoolFlow.flow, email_code: schoolFlow.code });
    ok('an account without the authenticator yet recovers with the email code alone', r.status === 200 && !!r.body.reset_token, r.body);

    f = await flowFor(fx.teacher.username, teacherId);
    await pool.query("UPDATE users SET status = 'inactive' WHERE id = ?", [teacherId]);
    await forgetStep(teacherId);
    r = await api('POST', '/auth/recovery/verify', { flow: f.flow, email_code: f.code, totp_code: appCode(teacher.secret) });
    await pool.query("UPDATE users SET status = 'active' WHERE id = ?", [teacherId]);
    ok('a deactivated account cannot recover', r.status === 400, r.body);

    console.log('\nNew password  set once, every other session ends, two-step stays');
    r = await api('POST', '/auth/recovery/complete', { flow: firstReset.flow, reset_token: crypto.randomBytes(32).toString('base64url'), new_password: newPassword });
    ok('a wrong reset token is refused', r.status === 400 && r.body.code === 'RECOVERY_EXPIRED', r.body);
    r = await api('POST', '/auth/recovery/complete', { flow: firstReset.flow, reset_token: firstReset.token, new_password: 'admin123' });
    ok('a published password is refused by the policy, without spending the token', r.status === 400 && r.body.code === 'PASSWORD_POLICY', r.body);
    r = await api('POST', '/auth/recovery/complete', { flow: firstReset.flow, reset_token: firstReset.token, new_password: newPassword });
    ok('the password is set and a session is returned', r.status === 200 && !!r.body.token && r.body.user && r.body.user.id === teacherId, r.body);
    ok('...without echoing the password, codes or token', !secrets.concat(newPassword).some(s => JSON.stringify(r.body).includes(s)));
    const fresh = r.body.token;
    const old = await api('GET', '/auth/profile', null, login0.body.token);
    ok('the session from before recovery is signed out', old.status === 401 && old.body.code === 'SESSION_REVOKED', old.body);
    ok('the new session works', (await api('GET', '/auth/profile', null, fresh)).status === 200);
    const [[mfaAfter]] = await pool.query('SELECT mfa_enabled, mfa_secret_enc IS NOT NULL AS has_secret FROM users WHERE id = ?', [teacherId]);
    ok('two-step sign-in is still on', mfaAfter.mfa_enabled === 1 && mfaAfter.has_secret === 1, mfaAfter);
    const relogin = await api('POST', '/auth/login', { username: fx.teacher.username, password: newPassword });
    ok('signing in with the new password still asks for the authenticator code', relogin.status === 200 && relogin.body.mfa_required === true && !relogin.body.token, relogin.body);
    r = await api('POST', '/auth/recovery/complete', { flow: firstReset.flow, reset_token: firstReset.token, new_password: 'Recovered-again#8821' });
    ok('the reset token cannot be replayed', r.status === 400 && r.body.code === 'RECOVERY_EXPIRED', r.body);
    const [[open]] = await pool.query('SELECT COUNT(*) n FROM account_recovery_flows WHERE user_id = ? AND completed_at IS NULL', [teacherId]);
    ok('every other open recovery for the account is closed', Number(open.n) === 0, open);

    console.log('\nSupervisor reset  for someone who lost the phone and the codes');
    const school = await fixtures.enrol(schoolAdminId);
    remember(school.secret, ...school.recoveryCodes);
    const schoolSession = (await fixtures.signIn(fx.schoolAdmin.username, fx.password, BASE)).token;
    ok('the school admin signs in with two steps', !!schoolSession);
    const teacherSessionBefore = fresh;
    r = await api('POST', '/auth/mfa/assist-reset', { user_id: teacherId, code: '000000' === appCode(school.secret) ? '111111' : '000000' }, schoolSession);
    ok('a wrong code from the supervisor is refused', r.status === 400, r.body);
    r = await api('POST', '/auth/mfa/assist-reset', { user_id: schoolAdminId, code: '123456' }, schoolSession);
    ok('nobody can reset their own two-step this way', r.status === 403 && r.body.code === 'MFA_ASSIST_FORBIDDEN', r.body);
    r = await api('POST', '/auth/mfa/assist-reset', { user_id: admin.id, code: '123456' }, schoolSession);
    ok('a school admin cannot reset a platform admin', r.status === 403, r.body);
    await forgetStep(schoolAdminId);
    r = await api('POST', '/auth/mfa/assist-reset', { user_id: teacherId, code: appCode(school.secret), reset_password: true }, schoolSession);
    ok('the school admin resets their own teacher with a current code', r.status === 200 && typeof r.body.password === 'string' && r.body.password.length >= 12, r.body);
    remember(r.body.password);
    const [[cleared]] = await pool.query('SELECT mfa_enabled, mfa_secret_enc, mfa_recovery, must_change_password FROM users WHERE id = ?', [teacherId]);
    ok('...clearing the teacher\'s authenticator and recovery codes', cleared.mfa_enabled === 0 && !cleared.mfa_secret_enc && !cleared.mfa_recovery, cleared);
    ok('...and the temporary password must be changed at sign-in', cleared.must_change_password === 1);
    ok('...and the teacher is signed out everywhere', (await api('GET', '/auth/profile', null, teacherSessionBefore)).status === 401);
    const tempLogin = await api('POST', '/auth/login', { username: fx.teacher.username, password: r.body.password });
    ok('the teacher signs in with the temporary password and must choose a new one', tempLogin.status === 200 && tempLogin.body.user && tempLogin.body.user.must_change_password === true, tempLogin.body);

    const teacherToken = tempLogin.body.token;
    r = await api('POST', '/auth/mfa/assist-reset', { user_id: schoolAdminId, code: '123456' }, teacherToken);
    ok('a teacher cannot use it at all', r.status === 403, r.body);
    const fieldLogin = await fixtures.signIn(field.username, field.password, BASE);
    r = await api('POST', '/auth/mfa/assist-reset', { user_id: teacherId, code: '123456' }, fieldLogin.token);
    ok('a field engineer cannot reset people at schools not assigned to them', r.status === 403 && r.body.code === 'MFA_ASSIST_FORBIDDEN', r.body);
    // Password only, on purpose: this admin has no two-step sign-in. Before its
    // enforcement date the reset itself refuses; from it, the enrolment gate does.
    const adminLogin = await api('POST', '/auth/login', { username: admin.username, password: admin.password });
    const adminMfa = await api('GET', '/auth/mfa', null, adminLogin.body.token);
    const refusal = adminMfa.body && adminMfa.body.must_enrol_now ? 'MFA_ENROLLMENT_REQUIRED' : 'MFA_ASSIST_NEEDS_MFA';
    r = await api('POST', '/auth/mfa/assist-reset', { user_id: teacherId, code: '123456' }, adminLogin.body.token);
    ok('a supervisor without two-step of their own cannot reset anyone', r.status === 403 && r.body.code === refusal, [refusal, r.body]);

    console.log('\nThrottles  the start step answers 429 once its limit is spent');
    // The same limiter the route mounts, built at a small limit — not a hundred padded
    // requests against the real server (middleware/recoveryLimits.js).
    const limits = require('../src/middleware/recoveryLimits');
    const express = require('express');
    const hit = async (mw, identifiers) => {
      const app = express();
      app.use(express.json());
      app.post('/start', mw, (req, res) => res.status(202).json({ ok: true }));
      const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
      const out = [];
      try {
        for (const identifier of identifiers) {
          const resp = await fetch(`http://127.0.0.1:${server.address().port}/start`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier }) });
          out.push({ status: resp.status, body: await resp.json().catch(() => ({})) });
        }
      } finally { await new Promise(resolve => server.close(resolve)); }
      return out;
    };
    const perAccount = await hit(limits.create({ startAccount: 3 }).startAccount, ['neema', 'NEEMA ', 'neema', 'neema']);
    ok('per identifier: the 4th start for one name answers 429 (limit 3; case and spaces do not reset it)',
      perAccount.map(x => x.status).join(',') === '202,202,202,429', perAccount.map(x => x.status));
    ok('...with the recovery message, not a generic error', /Too many recovery requests/.test((perAccount[3] || {}).body && perAccount[3].body.error || ''), perAccount[3]);
    const perAccountOther = await hit(limits.create({ startAccount: 1 }).startAccount, ['first-name', 'second-name']);
    ok('...and it is per identifier: another name is not throttled by the first', perAccountOther.every(x => x.status === 202), perAccountOther.map(x => x.status));
    const perNetwork = await hit(limits.create({ startIp: 3 }).startIp, ['a1-name', 'a2-name', 'a3-name', 'a4-name']);
    ok('per network: the 4th start from one address answers 429 even with a new name each time',
      perNetwork.map(x => x.status).join(',') === '202,202,202,429', perNetwork.map(x => x.status));
    ok('the limiter key holds a digest, never the name typed', /^rec-[0-9a-f]{64}$/.test(limits.identifierKey({ body: { identifier: 'neema@school.oetz.org' } })));
    const route = require('../src/routes/auth').stack.find(l => l.route && l.route.path === '/recovery/start');
    const mounted = route ? route.route.stack.map(s => s.handle) : [];
    ok('the live route mounts both, at the configured limits',
      ['recoveryStartIp', 'recoveryStartAccount'].every(n => mounted.some(h => h.limiterName === n))
      && mounted.find(h => h.limiterName === 'recoveryStartAccount').limiterMax === limits.DEFAULTS.startAccount,
      mounted.map(h => h.limiterName || h.name));
    ok('production allows 5 starts per name and 20 per network in 15 minutes',
      /startIp:\s+PROD \? 20/.test(fs.readFileSync(path.join(__dirname, '..', 'src', 'middleware', 'recoveryLimits.js'), 'utf8'))
      && /startAccount:\s+PROD \? 5/.test(fs.readFileSync(path.join(__dirname, '..', 'src', 'middleware', 'recoveryLimits.js'), 'utf8')));

    console.log('\nEvidence  useful, and free of secrets');
    const [audit] = await pool.query(
      "SELECT action, summary, meta FROM audit_log WHERE action IN ('auth.password_recovered', 'auth.mfa_reset_assisted', 'auth.recovery_requested') AND entity_id IN (?, ?)",
      [String(teacherId), String(schoolAdminId)]);
    ok('recovery and the supervisor reset are both in the audit log',
      audit.some(a => a.action === 'auth.password_recovered') && audit.some(a => a.action === 'auth.mfa_reset_assisted'), audit.map(a => a.action));
    ok('the audit log holds no code, token or password — the recovery requests included',
      audit.some(a => a.action === 'auth.recovery_requested') && !secrets.concat(newPassword).some(s => JSON.stringify(audit).includes(s)));
    const requested = audit.filter(a => a.action === 'auth.recovery_requested');
    const identifiers = [fx.teacher.username, fx.schoolAdmin.username, fixtures.PREFIX + 'teacher@verify.local', fixtures.PREFIX + 'school@verify.local'];
    ok('a recovery request records the account and "email sent" — never the name typed, the code or the flow',
      requested.length > 0 && requested.every(a => JSON.stringify(typeof a.meta === 'string' ? JSON.parse(a.meta) : a.meta) === '{"email":"sent"}')
      && !identifiers.some(s => JSON.stringify(requested).toLowerCase().includes(s.toLowerCase())), requested);
    await new Promise(resolve => setTimeout(resolve, 2600));
    const [events] = await pool.query(
      "SELECT event_type, detail FROM security_events WHERE (id > ? OR last_at >= ?) AND (event_type LIKE 'auth.recovery_%' OR event_type = 'auth.mfa_reset_assisted')",
      [clock.m, clock.t]);
    ok('start, failure, verification, completion and the supervisor reset are security events',
      ['auth.recovery_started', 'auth.recovery_failed', 'auth.recovery_verified', 'auth.recovery_completed', 'auth.mfa_reset_assisted']
        .every(type => events.some(e => e.event_type === type)), [...new Set(events.map(e => e.event_type))]);
    ok('security events hold no code, token or password', !secrets.concat(newPassword).some(s => JSON.stringify(events).includes(s)));

    console.log('\nFrontend  the recovery screens and the sign-in prompt');
    const auth = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'js', 'auth.js'), 'utf8');
    ok('two wrong passwords in a row offer recovery', /failedLogins\.count < 2\) return;/.test(auth) && /noteFailedLogin\(username\)/.test(auth));
    ok('step 2 asks for two of: email code, authenticator code, saved recovery code',
      ['recovery-email-code', 'recovery-app-code', 'recovery-saved-code'].every(id => auth.includes(`'${id}'`)));
    ok('the new password is entered twice and compared', /password !== confirmation/.test(auth) && auth.includes('recovery-confirm'));
    ok('codes and tokens are never written to browser storage', !/(localStorage|sessionStorage)\.setItem\([^\n]*(recovery|flow|reset)/i.test(auth));
    ok('recovery codes cannot be dismissed without confirming they were saved', /id="mfa-codes-done" disabled/.test(auth));
    ok('every staff role is asked to set up the authenticator at sign-in', /const MFA_ROLES = \['admin', 'subadmin', 'school', 'teacher'\]/.test(auth));
    ok('supervisors have a reset button on the people they support',
      ['teachers', 'schoolAdmins', 'team'].every(p => fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'js', 'pages', p + '.js'), 'utf8').includes('Auth.showAssistReset(')));
  } finally {
    await pool.query("DELETE FROM security_events WHERE id > ? AND (event_type LIKE 'auth.recovery_%' OR event_type LIKE 'auth.mfa_%' OR user_id IN (?, ?, ?, ?))",
      [clock.m, teacherId, schoolAdminId, admin.id, field.id]);
    await pool.query('DELETE FROM account_recovery_flows WHERE user_id IS NULL AND created_at >= ?', [clock.t]);
    await pool.query("DELETE FROM audit_log WHERE action IN ('auth.password_recovered', 'auth.mfa_reset_assisted', 'auth.recovery_requested') AND entity_id IN (?, ?, ?)",
      [String(teacherId), String(schoolAdminId), String(admin.id)]);
    await fixtures.cleanup();
    console.log(`\n${'='.repeat(52)}\n  ${passed} passed, ${failed} failed\n  database restored to the state it was found in`);
    await pool.end();
    process.exitCode = failed ? 1 : 0;
  }
})().catch(async error => {
  console.error('\nSUITE ERROR:', error.stack || error.message);
  try { await fixtures.cleanup(); await pool.end(); } catch (_) { /* best effort */ }
  process.exitCode = 1;
});
