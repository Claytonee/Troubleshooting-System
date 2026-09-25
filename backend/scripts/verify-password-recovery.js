/**
 * Verification — self-service Platform Admin password recovery (D31).
 *
 * Uses a suite-owned administrator and an injected mail sender. No external
 * email is sent, no real account changes, and every row is removed afterwards.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const pool = require('../src/config/database');
const fixtures = require('./lib/fixtures');
const recovery = require('../src/services/passwordRecovery');

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
const token = () => crypto.randomBytes(32).toString('base64url');

(async () => {
  const admin = await fixtures.ensurePlatformAdmin();
  const fx = await fixtures.ensure();
  const [[eventBase]] = await pool.query('SELECT COALESCE(MAX(id), 0) m, NOW() t FROM security_events');
  let newPassword = 'Recovery-verified#4826';
  try {
    const login = await api('POST', '/auth/login', { username: admin.username, password: admin.password });
    ok('fixture Platform Admin signs in before recovery', login.status === 200 && !!login.body.token, login.status);

    console.log('\nPrivacy  the public request never confirms an account');
    const unknown = await api('POST', '/auth/password-recovery/request', { identifier: 'nobody-' + Date.now() + '@verify.local' });
    const ordinary = await api('POST', '/auth/password-recovery/request', { identifier: fx.teacher.username });
    const known = await api('POST', '/auth/password-recovery/request', { identifier: admin.username });
    ok('unknown identifier receives 202', unknown.status === 202, unknown);
    ok('non-admin identifier receives the same 202', ordinary.status === 202, ordinary);
    ok('known Platform Admin receives the same 202', known.status === 202, known);
    ok('all three public responses are byte-for-byte equivalent',
      JSON.stringify(unknown.body) === JSON.stringify(ordinary.body) && JSON.stringify(ordinary.body) === JSON.stringify(known.body));
    ok('the public response never returns a reset token', !/token|verify\.local/i.test(JSON.stringify(known.body)), known.body);

    console.log('\nTiming  mail delivery happens after the answer');
    await pool.query('DELETE FROM password_recovery_tokens WHERE user_id = ?', [admin.id]);
    let hung = false;
    const started = Date.now();
    const queued = await recovery.issue(admin.username + '@verify.local', {
      appUrl: 'https://support.example.test', emailConfigured: true, background: true,
      sendMail: () => new Promise(resolve => setTimeout(() => { hung = true; resolve({ sent: false, error: 'smtp timeout' }); }, 1500))
    });
    ok('the public path returns before SMTP finishes, so mail latency cannot reveal an account',
      queued.queued === true && !hung && Date.now() - started < 1000, { queued: queued.queued, ms: Date.now() - started });
    const late = await queued.delivery;
    const [[lateRow]] = await pool.query('SELECT used_at FROM password_recovery_tokens WHERE user_id = ? ORDER BY id DESC LIMIT 1', [admin.id]);
    ok('a link whose email failed is spent, never left usable', late.sent === false && lateRow && !!lateRow.used_at, late);
    await pool.query('DELETE FROM password_recovery_tokens WHERE user_id = ?', [admin.id]);




    console.log('\nIssuance  cryptographic, hashed, trusted URL and one active link');
    let mail = null;
    const issued = await recovery.issue(admin.username, {
      appUrl: 'https://support.example.test', emailConfigured: true,
      sendMail: async message => { mail = message; return { sent: true }; }
    });
    ok('eligible admin creates one email', issued.sent === true && !!mail, issued);
    const raw = ((mail && mail.text || '').match(/#reset-password\?token=([A-Za-z0-9_-]{43})/) || [])[1];
    ok('email carries a 256-bit URL-fragment token', !!raw && raw.length === 43, mail && mail.text);
    ok('link uses the configured application URL, never the request Host header',
      mail.text.includes('https://support.example.test/#reset-password?token=') && !mail.text.includes('localhost'));
    const [[stored]] = await pool.query('SELECT token_hash, expires_at, used_at FROM password_recovery_tokens WHERE user_id = ? ORDER BY id DESC LIMIT 1', [admin.id]);
    ok('database stores only SHA-256, never the raw link value', stored && stored.token_hash === recovery.hashToken(raw) && stored.token_hash !== raw);
    ok('fresh token is unused and expires in about 15 minutes', stored && !stored.used_at && new Date(stored.expires_at) > new Date(Date.now() + 13 * 60000));

    const secondRaw = token();
    await pool.query(`INSERT INTO password_recovery_tokens (user_id, token_hash, expires_at)
      VALUES (?, ?, NOW() + INTERVAL 15 MINUTE)`, [admin.id, recovery.hashToken(secondRaw)]);

    console.log('\nConsumption  policy, ownership, expiry, replay and session revocation');
    const malformed = await api('POST', '/auth/password-recovery/reset', { token: 'not-a-token', new_password: newPassword });
    ok('malformed token is refused', malformed.status === 400 && malformed.body.code === 'RECOVERY_LINK_INVALID', malformed);
    const short = await api('POST', '/auth/password-recovery/reset', { token: raw, new_password: 'short' });
    ok('short password is refused without spending the link', short.status === 400, short);
    const [[stillUnused]] = await pool.query('SELECT used_at FROM password_recovery_tokens WHERE token_hash = ?', [recovery.hashToken(raw)]);
    ok('password-policy failure does not spend the link', stillUnused && !stillUnused.used_at);

    const expiredRaw = token();
    await pool.query(`INSERT INTO password_recovery_tokens (user_id, token_hash, expires_at)
      VALUES (?, ?, NOW() - INTERVAL 1 MINUTE)`, [admin.id, recovery.hashToken(expiredRaw)]);
    const expired = await api('POST', '/auth/password-recovery/reset', { token: expiredRaw, new_password: newPassword });
    ok('expired link is refused', expired.status === 400 && expired.body.code === 'RECOVERY_LINK_INVALID', expired);

    const teacherRaw = token();
    await pool.query(`INSERT INTO password_recovery_tokens (user_id, token_hash, expires_at)
      VALUES (?, ?, NOW() + INTERVAL 15 MINUTE)`, [fx.teacher.userId, recovery.hashToken(teacherRaw)]);
    const teacher = await api('POST', '/auth/password-recovery/reset', { token: teacherRaw, new_password: newPassword });
    ok('a valid token tied to a non-admin cannot use the Platform Admin portal', teacher.status === 400, teacher);

    const inactiveRaw = token();
    await pool.query(`INSERT INTO password_recovery_tokens (user_id, token_hash, expires_at)
      VALUES (?, ?, NOW() + INTERVAL 15 MINUTE)`, [admin.id, recovery.hashToken(inactiveRaw)]);
    await pool.query("UPDATE users SET status = 'inactive' WHERE id = ?", [admin.id]);
    const inactive = await api('POST', '/auth/password-recovery/reset', { token: inactiveRaw, new_password: newPassword });
    await pool.query("UPDATE users SET status = 'active' WHERE id = ?", [admin.id]);
    ok('a link stops working once the admin is deactivated', inactive.status === 400 && inactive.body.code === 'RECOVERY_LINK_INVALID', inactive);

    // Two-step sign-in must survive recovery: only the password factor changes.
    await pool.query("UPDATE users SET mfa_enabled = 1, mfa_secret_enc = 'verify-sentinel', mfa_recovery = 'verify-sentinel' WHERE id = ?", [admin.id]);
    const reset = await api('POST', '/auth/password-recovery/reset', { token: raw, new_password: newPassword });
    ok('valid one-time link changes the password without returning any secret',
      reset.status === 200 && !JSON.stringify(reset.body).includes(raw) && !JSON.stringify(reset.body).includes(newPassword), reset);
    const oldSession = await api('GET', '/auth/profile', null, login.body.token);
    ok('every session issued before recovery is revoked', oldSession.status === 401 && oldSession.body.code === 'SESSION_REVOKED', oldSession);
    const [[mfaAfter]] = await pool.query('SELECT mfa_enabled, mfa_secret_enc, mfa_recovery FROM users WHERE id = ?', [admin.id]);
    ok('recovery leaves the authenticator and recovery codes untouched',
      mfaAfter.mfa_enabled === 1 && mfaAfter.mfa_secret_enc === 'verify-sentinel' && mfaAfter.mfa_recovery === 'verify-sentinel', mfaAfter);
    const freshLogin = await api('POST', '/auth/login', { username: admin.username, password: newPassword });
    ok('the new password is accepted but two-step sign-in is still demanded, with no session yet',
      freshLogin.status === 200 && freshLogin.body.mfa_required === true && !freshLogin.body.token, freshLogin.body);
    await pool.query('UPDATE users SET mfa_enabled = 0, mfa_secret_enc = NULL, mfa_recovery = NULL WHERE id = ?', [admin.id]);
    const replay = await api('POST', '/auth/password-recovery/reset', { token: raw, new_password: 'Recovery-second#8426' });
    ok('the same link cannot be replayed', replay.status === 400 && replay.body.code === 'RECOVERY_LINK_INVALID', replay);
    const [[other]] = await pool.query('SELECT used_at FROM password_recovery_tokens WHERE token_hash = ?', [recovery.hashToken(secondRaw)]);
    ok('successful recovery invalidates every other outstanding link for the account', other && !!other.used_at);

    console.log('\nEvidence  useful without secrets');
    const [audit] = await pool.query("SELECT summary, meta FROM audit_log WHERE action = 'auth.password_recovery_completed' AND entity_id = ?", [String(admin.id)]);
    ok('successful recovery writes an audit entry', audit.length === 1, audit);
    ok('audit evidence contains no link token or password', !JSON.stringify(audit).includes(raw) && !JSON.stringify(audit).includes(newPassword));
    await new Promise(resolve => setTimeout(resolve, 2600));
    const [events] = await pool.query("SELECT event_type, detail FROM security_events WHERE (id > ? OR last_at >= ?) AND event_type LIKE 'auth.password_recovery_%'", [eventBase.m, eventBase.t]);
    ok('request, refusal and completion are observable security events',
      ['auth.password_recovery_requested', 'auth.password_recovery_failed', 'auth.password_recovery_completed'].every(type => events.some(e => e.event_type === type)), events);
    ok('security events contain no reset token or password', !JSON.stringify(events).includes(raw) && !JSON.stringify(events).includes(newPassword));

    console.log('\nFrontend  accessible recovery route, confirmation and safe fallback');
    const authSource = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'js', 'auth.js'), 'utf8');
    const html = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'index.html'), 'utf8');
    ok('sign-in page exposes a real Forgot password control', /id="forgot-password-link"/.test(html));
    ok('reset UI asks for password plus confirmation and keeps the token out of storage',
      /id="recovery-password"/.test(authSource) && /id="recovery-confirm"/.test(authSource)
      && !/localStorage\.setItem\([^\n]*recovery/i.test(authSource));
    ok('the reset page removes the one-time token from the address bar before showing the form',
      /history\.replaceState\([^\n]*#forgot-password'\);\s*if \(token\) showRecoveryReset/.test(authSource));
    ok('UI explains the protected hosting fallback without offering a public bypass',
      /protected hosting-terminal recovery procedure/i.test(authSource)
      && !/API\.mfa/.test(authSource.slice(authSource.indexOf('function recoveryFrame'), authSource.indexOf('function routeRecovery'))));
    ok('server builds links only from configured APP_URL/FRONTEND_URL',
      /process\.env\.APP_URL/.test(fs.readFileSync(path.join(__dirname, '..', 'src', 'services', 'passwordRecovery.js'), 'utf8')));
  } finally {
    await pool.query("DELETE FROM audit_log WHERE action = 'auth.password_recovery_completed' AND entity_id = ?", [String(admin.id)]);
    // Refusals carry no user id, so this suite's recovery events are matched by type too.
    await pool.query("DELETE FROM security_events WHERE id > ? AND (user_id IN (?, ?) OR event_type LIKE 'auth.password_recovery_%')", [eventBase.m, admin.id, fx.teacher.userId]);
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
