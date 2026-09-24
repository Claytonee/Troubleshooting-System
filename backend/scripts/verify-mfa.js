/**
 * Verification — two-step sign-in (SEC-007, DECISIONS.md D4).
 *
 *  1. TOTP matches the RFC 6238 appendix B test vectors (not just itself).
 *  2. The enforcement decision (who must enrol, from when) as a pure function.
 *  3. The whole flow through the API: setup, secret encrypted at rest, enable,
 *     a password alone earns only a ticket, a ticket is not a session, codes work
 *     once, recovery codes work once, the admin cannot turn it off, a teacher can.
 *
 * Runs against a live local server; removes every row it creates. Run from backend/.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('../src/config/database');
const fixtures = require('./lib/fixtures');
const totp = require('../src/services/totp');
const policy = require('../src/services/mfaPolicy');

const BASE = process.env.VERIFY_BASE || 'http://localhost:3100';
let passed = 0, failed = 0;
function ok(name, cond, detail) {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail !== undefined ? ' — ' + JSON.stringify(detail) : ''}`); }
}
async function api(method, p, { token, body } = {}) {
  const res = await fetch(BASE + '/api' + p, {
    method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  let json = null; try { json = await res.json(); } catch (e) {}
  return { status: res.status, body: json };
}
/** The code for the NEXT 30 s step: valid now (±1 window) and never already spent. */
const nextCode = (secret) => totp.hotp(totp.base32Decode(secret), totp.stepAt() + 1);
const codeAt = (secret, offset = 0) => totp.hotp(totp.base32Decode(secret), totp.stepAt() + offset);

(async () => {
  console.log('\nRFC 6238  the implementation matches the published test vectors');
  const key = Buffer.from('12345678901234567890');
  for (const [T, exp] of [[59, '94287082'], [1111111109, '07081804'], [1111111111, '14050471'],
    [1234567890, '89005924'], [2000000000, '69279037'], [20000000000, '65353130']]) {
    ok(`T=${T} → ${exp}`, totp.hotp(key, Math.floor(T / 30), 8) === exp);
  }

  console.log('\nPolicy   who must enrol, and from when');
  const after = new Date('2026-10-08T00:00:00+03:00');
  ok('an admin without two-step, after the date, must enrol', policy.mustEnrolNow({ role: 'admin', mfa_enabled: 0 }, new Date('2026-10-09'), after));
  ok('...but not before the date', !policy.mustEnrolNow({ role: 'admin', mfa_enabled: 0 }, new Date('2026-10-01'), after));
  ok('an enrolled admin is never stopped', !policy.mustEnrolNow({ role: 'admin', mfa_enabled: 1 }, new Date('2027-01-01'), after));
  ok('school admins and teachers are never forced', ['school', 'teacher', 'subadmin'].every(r => !policy.mustEnrolNow({ role: r, mfa_enabled: 0 }, new Date('2027-01-01'), after)));
  ok('an admin who must enrol can reach only the enrolment endpoints',
    policy.isEnrolmentPath('/api/auth/mfa') && policy.isEnrolmentPath('/api/auth/mfa/setup') && policy.isEnrolmentPath('/api/auth/mfa/enable')
    && !policy.isEnrolmentPath('/api/schools') && !policy.isEnrolmentPath('/api/auth/mfa/disable') && !policy.isEnrolmentPath('/api/team/1/reset-password'));
  const authSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'middleware', 'auth.js'), 'utf8');
  ok('authenticate() applies that rule on every request', /mustEnrolNow\(rows\[0\]\) && !mfaPolicy\.isEnrolmentPath\(req\.originalUrl\)/.test(authSrc));

  const fx = await fixtures.ensure();
  const hash = await bcrypt.hash(fixtures.PASSWORD, 10);
  await pool.query(
    `INSERT INTO users (username, email, password_hash, full_name, role, status, approval_status, must_change_password)
     VALUES (?, ?, ?, 'Verify admin', 'admin', 'active', 'approved', 0)
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), token_version = 0, mfa_enabled = 0,
       mfa_secret_enc = NULL, mfa_pending_enc = NULL, mfa_last_step = NULL, mfa_recovery = NULL`,
    [fixtures.PREFIX + 'admin', fixtures.PREFIX + 'admin@verify.local', hash]);
  const ADMIN = fixtures.PREFIX + 'admin';
  const [[{ eventsBaseline }]] = await pool.query('SELECT COALESCE(MAX(id), 0) AS eventsBaseline FROM security_events');

  try {
    console.log('\nFlow     enrol, sign in in two steps, codes work once');
    const first = await api('POST', '/auth/login', { body: { username: ADMIN, password: fixtures.PASSWORD } });
    const t0 = first.body && first.body.token;
    ok('before enrolling, the admin signs in with a password (enforcement starts 8 October)', first.status === 200 && !!t0, first.status);
    const st = await api('GET', '/auth/mfa', { token: t0 });
    ok('status: off, required for the admin role, with the date', st.body && st.body.enabled === false && st.body.required_for_role === true && !!st.body.required_from, st.body);

    const setup = await api('POST', '/auth/mfa/setup', { token: t0 });
    const secret = setup.body && setup.body.secret;
    ok('setup returns a base32 secret and an otpauth URI for the QR code',
      /^[A-Z2-7]{32}$/.test(secret || '') && String(setup.body.otpauth).startsWith('otpauth://totp/'), setup.body && Object.keys(setup.body));
    const [[pend]] = await pool.query('SELECT mfa_pending_enc, mfa_enabled FROM users WHERE username = ?', [ADMIN]);
    ok('the pending secret is stored encrypted, never in plain text', String(pend.mfa_pending_enc).startsWith('v1.') && !String(pend.mfa_pending_enc).includes(secret));
    ok('...and nothing is switched on until a code confirms it', Number(pend.mfa_enabled) === 0);

    const bad = await api('POST', '/auth/mfa/enable', { token: t0, body: { code: '000000' === codeAt(secret) ? '111111' : '000000' } });
    ok('a wrong code does not switch it on', bad.status === 400, bad.status);
    const en = await api('POST', '/auth/mfa/enable', { token: t0, body: { code: codeAt(secret) } });
    const recovery = (en.body && en.body.recovery_codes) || [];
    ok('the right code switches it on and shows ten recovery codes, once', en.status === 200 && recovery.length === 10, en.status);
    const [[row]] = await pool.query('SELECT mfa_secret_enc, mfa_recovery FROM users WHERE username = ?', [ADMIN]);
    ok('the stored secret is ciphertext; recovery codes are stored hashed',
      String(row.mfa_secret_enc).startsWith('v1.') && !String(row.mfa_secret_enc).includes(secret) && !String(row.mfa_recovery).includes(recovery[0]));
    ok('sessions opened with the password alone end when it is switched on',
      (await api('GET', '/dashboard', { token: t0 })).status === 401);
    ok('...while this device continues with its new token', (await api('GET', '/dashboard', { token: en.body.token })).status === 200);

    const pw = await api('POST', '/auth/login', { body: { username: ADMIN, password: fixtures.PASSWORD } });
    ok('now the password alone earns only a ticket — no token', pw.status === 200 && pw.body.mfa_required === true && !pw.body.token && !!pw.body.mfa_ticket, pw.body && Object.keys(pw.body));
    const ticket = pw.body.mfa_ticket;
    ok('the ticket is not a session', (await api('GET', '/dashboard', { token: ticket })).status === 401);
    const wrong = await api('POST', '/auth/mfa/verify', { body: { ticket, code: '123456' === nextCode(secret) ? '654321' : '123456' } });
    ok('a wrong code is refused', wrong.status === 401 && wrong.body.code === 'MFA_CODE_WRONG', wrong.body);
    const code = nextCode(secret);
    const good = await api('POST', '/auth/mfa/verify', { body: { ticket, code } });
    ok('the right code completes the sign-in', good.status === 200 && !!good.body.token && good.body.user.mfa_enabled === true, good.status);
    ok('...and that token works', (await api('GET', '/dashboard', { token: good.body.token })).status === 200);
    const pw2 = await api('POST', '/auth/login', { body: { username: ADMIN, password: fixtures.PASSWORD } });
    const replay = await api('POST', '/auth/mfa/verify', { body: { ticket: pw2.body.mfa_ticket, code } });
    ok('the same code cannot be used twice', replay.status === 401, replay.status);
    const rec = await api('POST', '/auth/mfa/verify', { body: { ticket: pw2.body.mfa_ticket, code: recovery[0] } });
    ok('a recovery code signs in, and says how many are left', rec.status === 200 && rec.body.recovery_codes_left === 9, rec.body && rec.body.recovery_codes_left);
    const pw3 = await api('POST', '/auth/login', { body: { username: ADMIN, password: fixtures.PASSWORD } });
    const rec2 = await api('POST', '/auth/mfa/verify', { body: { ticket: pw3.body.mfa_ticket, code: recovery[0] } });
    ok('...and works only once', rec2.status === 401, rec2.status);
    const forged = await api('POST', '/auth/mfa/verify', { body: { ticket: good.body.token, code: nextCode(secret) } });
    ok('a full session token cannot be used as a ticket', forged.status === 401 && forged.body.code === 'MFA_TICKET_INVALID', forged.body);
    const off = await api('POST', '/auth/mfa/disable', { token: good.body.token, body: { password: fixtures.PASSWORD, code: codeAt(secret, 1) } });
    ok('the platform admin cannot turn it off — the role requires it', off.status === 403 && off.body.code === 'MFA_REQUIRED_FOR_ROLE', off.body);

    console.log('\nOpt-in   other roles may turn it on and off');
    const tt = await api('POST', '/auth/login', { body: { username: fx.teacher.username, password: fx.password } });
    const ts = await api('POST', '/auth/mfa/setup', { token: tt.body.token });
    const te = await api('POST', '/auth/mfa/enable', { token: tt.body.token, body: { code: codeAt(ts.body.secret) } });
    ok('a teacher can switch it on', te.status === 200, te.status);
    const tOffWrong = await api('POST', '/auth/mfa/disable', { token: te.body.token, body: { password: 'wrong-password', code: codeAt(ts.body.secret, 1) } });
    ok('turning it off needs the password as well as a code', tOffWrong.status === 400, tOffWrong.status);
    const tOff = await api('POST', '/auth/mfa/disable', { token: te.body.token, body: { password: fx.password, code: codeAt(ts.body.secret, 1) } });
    ok('...and with both, it turns off', tOff.status === 200 && tOff.body.enabled === false, tOff.body);

    await new Promise(r => setTimeout(r, 2600));
    const [ev] = await pool.query('SELECT event_type FROM security_events WHERE id > ?', [eventsBaseline]);
    const types = new Set(ev.map(e => e.event_type));
    ok('the evidence records the two-step events',
      ['auth.mfa_required', 'auth.mfa_ok', 'auth.mfa_failed', 'auth.mfa_recovery_used', 'auth.mfa_enabled', 'auth.mfa_disabled'].every(t => types.has(t)), [...types]);
  } finally {
    await new Promise(r => setTimeout(r, 2600));
    await pool.query('DELETE FROM security_events WHERE id > ?', [eventsBaseline]);
    // Audit rows written by the fixture accounts go with them in fixtures.cleanup() (by actor_id).
    await fixtures.cleanup();
    console.log(`\n${'='.repeat(52)}\n  ${passed} passed, ${failed} failed\n  database restored to the state it was found in`);
    await pool.end();
    process.exitCode = failed ? 1 : 0;
  }
})().catch(async e => { console.error('\nSUITE ERROR:', e.message); try { await fixtures.cleanup(); await pool.end(); } catch (x) {} process.exitCode = 1; });
