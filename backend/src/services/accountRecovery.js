const crypto = require('crypto');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const notify = require('./notify');
const passwords = require('./passwords');
const totp = require('./totp');
const { logAudit } = require('./audit');

/**
 * Forgotten-password recovery for every role (DECISIONS.md D32).
 *
 *   start(identifier)             always the same answer; emails a 6-digit code if the account is eligible
 *   verify(flow, codes)           two of three: email code, authenticator code, recovery code
 *   complete(flow, reset, pw)     sets the password once, ends every session
 *
 * An account with two-step sign-in needs TWO different proofs (GitHub, Microsoft's
 * admin policy, NIST SP 800-63B-4 §4.2): email + authenticator, email + recovery
 * code, or authenticator + recovery code. The email alone is enough only for an
 * account that has not enrolled yet — the same proof it would need to sign in.
 *
 * Nothing secret is stored in the clear: the flow id and reset token as SHA-256,
 * the email code as an HMAC keyed by the server secret and bound to its flow, so
 * a copy of the database cannot be turned back into codes.
 */

const FLOW_MINUTES = 15;
const EMAIL_CODE_MINUTES = 10;
const RESET_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const EMAIL_COOLDOWN_SECONDS = 60;
const EMAIL_HOURLY_LIMIT = 5;
const RECOVERABLE_ROLES = ['admin', 'subadmin', 'school', 'teacher'];

const START_MESSAGE = 'If this account can be recovered, a 6-digit code has been sent to its email address. It expires in 10 minutes.';
const WRONG_CODES = 'Those codes did not verify. Enter two different codes, exactly as shown.';
const EXPIRED = 'This recovery has expired or was used. Start again.';

class RecoveryError extends Error {
  constructor(message, code, extra = {}) {
    super(message);
    this.name = 'RecoveryError';
    this.code = code;
    Object.assign(this, extra);
  }
}

const sha256 = (value) => crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');

function emailCodeHash(flowId, code) {
  const key = process.env.JWT_SECRET || 'unset';
  return crypto.createHmac('sha256', key).update(`${flowId}:${String(code || '').replace(/\D/g, '')}`).digest('hex');
}

function sameHex(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

const recoveryList = (u) => { try { return JSON.parse(u.mfa_recovery || '[]'); } catch (e) { return []; } };

// ── The two emails (D32): plain text and HTML, branded, and without a single link ──
// No link on purpose: a recovery email that asks you to click is what phishing
// looks like, and one that never does is easier to tell apart from it.
const escHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const BRAND = 'OE Technical Support';
const ORG = 'Opportunity Education Tanzania';
const ICONS = path.join(__dirname, '..', '..', '..', 'frontend', 'icons');

/**
 * Brand colours, named once so changing one is one line.
 *
 * NAVY is the `--navy` token in frontend/css/variables.css. CRIMSON is the
 * accent red Opportunity Education paints on opportunityeducation.org (#c02b0a,
 * read off the rendered site alongside the gold #ffae00 and the logo's #263746).
 * Email has no CSS variables, so these are inlined at every use.
 */
const NAVY = '#073763';
const CRIMSON = '#c02b0a';

/**
 * The header is the sign-in page: the gold mark, the organisation's name set in
 * Axiforma, then "Technical Support". The official horizontal Opportunity
 * Education logo closes the email, exactly where `.oe-footer-logo` puts it on
 * that page.
 *
 * All three are images because email is not the web: Gmail and Outlook strip
 * `@font-face`, so Axiforma as live text silently becomes Arial, and they drop
 * inline SVG entirely. Each carries `alt` text, so a client with images turned
 * off still reads the organisation's name rather than an empty box. The two
 * rendered files come from `scripts/build-email-wordmark.js`, which draws them
 * from the very font and SVG the browser loads, so the email and the sign-in
 * page cannot drift apart.
 */
const BRAND_ASSETS = [
  { key: 'mark', file: 'oe-mark.png', cid: 'oe-mark@oe-support' },
  { key: 'wordmark', file: 'oe-wordmark-tz.png', cid: 'oe-wordmark-tz@oe-support' },
  { key: 'logo', file: 'oe-logo-official.png', cid: 'oe-logo@oe-support' }
];
const CID = Object.fromEntries(BRAND_ASSETS.map(a => [a.key, a.cid]));

function brandAttachments() {
  return BRAND_ASSETS.map(a => ({
    filename: a.file,
    path: path.join(ICONS, a.file),
    cid: a.cid,
    contentDisposition: 'inline'
  }));
}

function htmlShell(title, bodyHtml) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f4f5f7">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:24px 0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:10px;border:1px solid #e3e5ea;font-family:Arial,Helvetica,sans-serif;color:#1d2130">
<tr><td align="center" style="padding:26px 24px 20px;border-bottom:3px solid #FFAE00">
  <img src="cid:${CID.mark}" width="34" height="34" alt="" style="display:block;margin:0 auto 14px;border:0;outline:none">
  <img src="cid:${CID.wordmark}" width="300" alt="${ORG}" style="display:block;margin:0 auto;width:100%;max-width:300px;height:auto;border:0;outline:none">
  <div style="margin-top:6px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.3;font-weight:bold;letter-spacing:1.2px;text-transform:uppercase;color:#6b7185">Technical Support</div>
</td></tr>
<tr><td style="padding:22px 24px 8px;font-size:17px;font-weight:bold;color:${NAVY}">${escHtml(title)}</td></tr>
<tr><td style="padding:0 24px 22px;font-size:14px;line-height:1.6;color:#3a4050">${bodyHtml}</td></tr>
<tr><td align="center" style="padding:18px 24px;border-top:1px solid #e3e5ea">
  <img src="cid:${CID.logo}" width="160" alt="Opportunity Education" style="display:block;margin:0 auto;width:100%;max-width:160px;height:auto;border:0;outline:none;opacity:0.7">
</td></tr>
</table></td></tr></table></body></html>`;
}

/** The recovery-code email. The code appears in the subject, the text and the HTML; nothing else is secret. */
function codeEmail(user, code) {
  const hello = `Hello${user.full_name ? ' ' + user.full_name : ''},`;
  const text = [
    hello,
    '',
    `Your password recovery code is: ${code}`,
    `It expires in ${EMAIL_CODE_MINUTES} minutes. Enter it together with a code from your authenticator app, or one of your saved recovery codes.`,
    '',
    'If you did not ask for this, ignore this email: your password has not changed.',
    'Nobody from OE will ever ask you for this code.'
  ].join('\n');
  const html = htmlShell('Your password recovery code', `
    <p style="margin:0 0 14px">${escHtml(hello)}</p>
    <p style="margin:0 0 8px">Your password recovery code is:</p>
    <p style="margin:0 0 16px;font-size:28px;font-weight:bold;letter-spacing:6px;font-family:'Courier New',monospace;color:${NAVY}">${escHtml(code)}</p>
    <p style="margin:0 0 14px">It expires in ${EMAIL_CODE_MINUTES} minutes. Enter it together with a code from your authenticator app, or one of your saved recovery codes.</p>
    <p style="margin:0 0 6px">If you did not ask for this, ignore this email: your password has not changed.</p>
    <p style="margin:0;font-weight:bold;color:${CRIMSON}">Nobody from OE will ever ask you for this code.</p>`);
  return { subject: `${code} is your ${BRAND} recovery code`, text, html, attachments: brandAttachments() };
}

/** The "your password was changed" notice (NIST SP 800-63B-4). It cannot undo anything, so it carries no link or code. */
function changedEmail(user, factors) {
  const hello = `Hello${user.full_name ? ' ' + user.full_name : ''},`;
  const how = (factors || []).join(' + ').replace(/_/g, ' ');
  const text = [
    hello, '',
    `Your password was just changed using account recovery (${how}).`,
    'Every other device has been signed out. Your authenticator app still works as before.',
    'If this was not you, tell your school admin or the platform administrator immediately.'
  ].join('\n');
  const html = htmlShell('Your password was changed', `
    <p style="margin:0 0 14px">${escHtml(hello)}</p>
    <p style="margin:0 0 14px">Your password was just changed using account recovery (${escHtml(how)}).</p>
    <p style="margin:0 0 14px">Every other device has been signed out. Your authenticator app still works as before.</p>
    <p style="margin:0;font-weight:bold">If this was not you, tell your school admin or the platform administrator immediately.</p>`);
  return { subject: `Your ${BRAND} password was changed`, text, html, attachments: brandAttachments() };
}

/** Who may recover by themselves: active, approved staff. */
function eligible(user) {
  return !!user && RECOVERABLE_ROLES.includes(user.role) && user.status === 'active'
    && user.approval_status !== 'pending' && user.approval_status !== 'rejected';
}

/**
 * Begin a recovery. Returns { flowId, delivery } for the controller: flowId goes
 * to the browser whether or not the account exists; delivery (a promise, or null)
 * is awaited after the response so SMTP latency cannot reveal an account.
 */
async function start(identifier, options = {}) {
  const normalized = String(identifier || '').trim().toLowerCase();
  const sendMail = options.sendMail || notify.sendMail;
  const emailConfigured = options.emailConfigured !== undefined ? !!options.emailConfigured : notify.isConfigured();
  const flowId = crypto.randomBytes(32).toString('base64url');

  const [users] = normalized ? await pool.query(
    `SELECT id, email, full_name, role, status, approval_status
       FROM users WHERE LOWER(username) = ? OR LOWER(email) = ? LIMIT 1`,
    [normalized, normalized]) : [[]];
  const user = eligible(users[0]) ? users[0] : null;

  // Unknown accounts get a real row too, so every later answer looks the same.
  let code = null;
  let reason = user ? null : 'not_eligible';
  if (user && (!user.email || !emailConfigured)) reason = 'email_unavailable';
  if (user && !reason) {
    const [[recent]] = await pool.query(
      `SELECT SUM(created_at >= NOW() - INTERVAL ? SECOND) AS cooling, SUM(created_at >= NOW() - INTERVAL 1 HOUR) AS hour
         FROM account_recovery_flows WHERE user_id = ? AND email_code_hash IS NOT NULL`,
      [EMAIL_COOLDOWN_SECONDS, user.id]);
    if (Number(recent.cooling) > 0 || Number(recent.hour) >= EMAIL_HOURLY_LIMIT) reason = 'email_throttled';
    else code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  }

  const codeHash = code ? emailCodeHash(flowId, code) : null;
  await pool.query(
    `INSERT INTO account_recovery_flows (flow_hash, user_id, email_code_hash, email_code_expires, expires_at)
     VALUES (?, ?, ?, IF(? IS NULL, NULL, NOW() + INTERVAL ? MINUTE), NOW() + INTERVAL ? MINUTE)`,
    [sha256(flowId), user ? user.id : null, codeHash, codeHash, EMAIL_CODE_MINUTES, FLOW_MINUTES]);

  // Delivery happens after the public answer. The audit row is written by
  // deliver() only after SMTP confirms the message actually left this service.
  const delivery = code ? deliver(user, code, flowId, sendMail, options.ip) : null;
  return { flowId, userId: user ? user.id : null, emailQueued: !!code, reason, delivery };
}

/** Send the code. Never rejects; a code that did not leave the server is voided. */
async function deliver(user, code, flowId, sendMail, ip) {
  let result;
  try {
    result = await sendMail({ to: user.email, ...codeEmail(user, code) });
  } catch (err) {
    result = { sent: false, error: err.message };
  }
  if (!result || !result.sent) {
    try {
      await pool.query('UPDATE account_recovery_flows SET email_code_hash = NULL WHERE flow_hash = ?', [sha256(flowId)]);
    } catch (_) { /* it still expires in EMAIL_CODE_MINUTES */ }
    return { sent: false, userId: user.id, reason: (result && (result.error || result.skipped)) || 'delivery_failed' };
  }
  // Real account + confirmed delivery only. Never identifier, code or flow.
  await logAudit({
    action: 'auth.recovery_requested', entityType: 'user', entityId: user.id, ip: ip || null,
    summary: 'Password recovery requested; a code was sent to the account email',
    meta: { email: 'sent' }
  });
  return { sent: true, userId: user.id };
}

/**
 * Check the codes. On success returns a one-time reset token (10 minutes) and
 * which proofs were used; the authenticator step and any recovery code are spent.
 */
async function verify(flowId, codes = {}) {
  const flowHash = sha256(flowId);
  // Count the attempt before looking at the codes: guesses run out even if they race.
  const [bump] = await pool.query(
    `UPDATE account_recovery_flows SET attempts = attempts + 1
      WHERE flow_hash = ? AND attempts < ? AND expires_at > NOW()
        AND completed_at IS NULL AND reset_hash IS NULL`,
    [flowHash, MAX_ATTEMPTS]);
  if (!bump.affectedRows) throw new RecoveryError(EXPIRED, 'RECOVERY_EXPIRED');

  const [[flow]] = await pool.query(
    `SELECT id, user_id, attempts, email_code_hash, email_code_expires > NOW() AS email_fresh
       FROM account_recovery_flows WHERE flow_hash = ?`, [flowHash]);
  const attemptsLeft = Math.max(0, MAX_ATTEMPTS - flow.attempts);
  const wrong = () => new RecoveryError(WRONG_CODES, 'RECOVERY_CODES_WRONG', { attemptsLeft });

  const [[user]] = flow.user_id ? await pool.query(
    `SELECT id, role, status, approval_status, mfa_enabled, mfa_secret_enc, mfa_last_step, mfa_recovery
       FROM users WHERE id = ?`, [flow.user_id]) : [[null]];
  if (!eligible(user)) throw wrong();

  const emailCode = String(codes.email_code || '').replace(/\s/g, '');
  const appCode = String(codes.totp_code || '').replace(/\s/g, '');
  const savedCode = String(codes.recovery_code || '').trim();

  // Look first, spend later: a wrong second code must not burn a good first one.
  const emailOk = /^\d{6}$/.test(emailCode) && !!Number(flow.email_fresh)
    && sameHex(emailCodeHash(flowId, emailCode), flow.email_code_hash);
  const mfaOn = !!Number(user.mfa_enabled);
  const step = mfaOn && /^\d{6}$/.test(appCode)
    ? totp.verify(totp.decrypt(user.mfa_secret_enc), appCode, user.mfa_last_step) : null;
  const saved = recoveryList(user);
  const savedIndex = mfaOn && savedCode ? saved.indexOf(totp.hashCode(savedCode)) : -1;

  const needed = mfaOn ? 2 : 1;
  const chosen = [];
  if (emailOk) chosen.push('email');
  if (step !== null && chosen.length < needed) chosen.push('authenticator');
  if (savedIndex >= 0 && chosen.length < needed) chosen.push('recovery_code');
  if (chosen.length < needed) throw wrong();

  if (chosen.includes('authenticator')) {
    const [r] = await pool.query(
      'UPDATE users SET mfa_last_step = ? WHERE id = ? AND (mfa_last_step IS NULL OR mfa_last_step < ?)',
      [step, user.id, step]);
    if (!r.affectedRows) throw wrong();   // the same code was just used elsewhere
  }
  if (chosen.includes('recovery_code')) {
    const left = saved.slice(); left.splice(savedIndex, 1);
    const [r] = await pool.query('UPDATE users SET mfa_recovery = ? WHERE id = ? AND mfa_recovery = ?',
      [JSON.stringify(left), user.id, user.mfa_recovery]);
    if (!r.affectedRows) throw wrong();
  }

  const resetToken = crypto.randomBytes(32).toString('base64url');
  const [done] = await pool.query(
    `UPDATE account_recovery_flows
        SET reset_hash = ?, reset_expires = NOW() + INTERVAL ? MINUTE, factors = ?, email_code_hash = NULL
      WHERE id = ? AND reset_hash IS NULL AND completed_at IS NULL`,
    [sha256(resetToken), RESET_MINUTES, chosen.join('+'), flow.id]);
  if (!done.affectedRows) throw new RecoveryError(EXPIRED, 'RECOVERY_EXPIRED');
  return { resetToken, factors: chosen, userId: user.id };
}

/** Set the new password with the reset token. Returns the account, freshly versioned. */
async function complete(flowId, resetToken, newPassword) {
  const problem = passwords.problem(newPassword);
  if (problem) throw new RecoveryError(problem, 'PASSWORD_POLICY');
  const flowHash = sha256(flowId);
  const resetHash = sha256(resetToken);

  // Reject a wrong token before paying for bcrypt; re-checked under the lock below.
  const [pre] = await pool.query(
    `SELECT id FROM account_recovery_flows
      WHERE flow_hash = ? AND reset_hash = ? AND reset_expires > NOW() AND completed_at IS NULL`,
    [flowHash, resetHash]);
  if (!pre.length) throw new RecoveryError(EXPIRED, 'RECOVERY_EXPIRED');

  const passwordHash = await bcrypt.hash(String(newPassword), 12);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[flow]] = await conn.query(
      `SELECT id, user_id, factors FROM account_recovery_flows
        WHERE flow_hash = ? AND reset_hash = ? AND reset_expires > NOW() AND completed_at IS NULL
        FOR UPDATE`, [flowHash, resetHash]);
    if (!flow) throw new RecoveryError(EXPIRED, 'RECOVERY_EXPIRED');
    const [[user]] = await conn.query(
      'SELECT id, role, status, approval_status FROM users WHERE id = ? FOR UPDATE', [flow.user_id]);
    if (!eligible(user)) throw new RecoveryError(EXPIRED, 'RECOVERY_EXPIRED');

    await conn.query(
      `UPDATE users SET password_hash = ?, must_change_password = 0,
              token_version = COALESCE(token_version, 0) + 1 WHERE id = ?`,
      [passwordHash, user.id]);
    // This flow is spent, and so is every other open one for the account.
    await conn.query(
      'UPDATE account_recovery_flows SET completed_at = NOW() WHERE user_id = ? AND completed_at IS NULL',
      [user.id]);
    await conn.commit();
    return { userId: user.id, factors: String(flow.factors || '').split('+').filter(Boolean) };
  } catch (err) {
    try { await conn.rollback(); } catch (_) { /* best effort */ }
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  start, verify, complete, RecoveryError, sha256, emailCodeHash, codeEmail, changedEmail,
  START_MESSAGE, FLOW_MINUTES, EMAIL_CODE_MINUTES, RESET_MINUTES, MAX_ATTEMPTS, RECOVERABLE_ROLES
};
