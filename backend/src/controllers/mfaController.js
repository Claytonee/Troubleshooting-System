const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_VERIFY } = require('../config/httpPolicy');
const pool = require('../config/database');
const totp = require('../services/totp');
const policy = require('../services/mfaPolicy');
const { revokeSessions } = require('../services/sessions');
const { logAudit } = require('../services/audit');

/**
 * Two-step sign-in (SEC-007, DECISIONS.md D4).
 *
 *   GET  /api/auth/mfa                    status for the signed-in account
 *   POST /api/auth/mfa/setup              new secret (pending until confirmed)
 *   POST /api/auth/mfa/enable {code}      confirm it; returns ten recovery codes, once
 *   POST /api/auth/mfa/verify {ticket, code}   public: the second step of sign-in
 *   POST /api/auth/mfa/recovery-codes {code}   replace the recovery codes
 *   POST /api/auth/mfa/disable {password, code}  not allowed for a role that requires it
 *
 * Nothing here ever returns a stored secret: the secret leaves the server once,
 * at setup, so it can be put into the authenticator.
 */

const SELECT_USER = `SELECT id, username, email, full_name, role, phone, zone, color, title, status, school_id,
    approval_status, avatar_url, bio, must_change_password, token_version, mfa_enabled,
    mfa_secret_enc, mfa_pending_enc, mfa_last_step, mfa_recovery, mfa_enrolled_at
  FROM users WHERE id = ?`;

async function loadUser(id) {
  const [[u]] = await pool.query(SELECT_USER, [id]);
  return u || null;
}

const recoveryList = (u) => { try { return JSON.parse(u.mfa_recovery || '[]'); } catch (e) { return []; } };

/** Claims a TOTP step atomically: a second request with the same code cannot also win. */
async function claimStep(userId, step) {
  const [r] = await pool.query(
    'UPDATE users SET mfa_last_step = ? WHERE id = ? AND (mfa_last_step IS NULL OR mfa_last_step < ?)',
    [step, userId, step]);
  return r.affectedRows === 1;
}

/** A 6-digit code, or a recovery code (consumed). Returns 'totp' | 'recovery' | null. */
async function checkSecondFactor(u, code, secretEnc = u.mfa_secret_enc) {
  const c = String(code || '').trim();
  if (/^\d{6}$/.test(c.replace(/\s/g, ''))) {
    const step = totp.verify(totp.decrypt(secretEnc), c, u.mfa_last_step);
    if (step !== null && await claimStep(u.id, step)) return 'totp';
    return null;
  }
  const hashes = recoveryList(u);
  const h = totp.hashCode(c);
  const i = hashes.indexOf(h);
  if (i < 0) return null;
  hashes.splice(i, 1);
  // Conditional on the old list, so one recovery code cannot be spent twice at once.
  const [r] = await pool.query('UPDATE users SET mfa_recovery = ? WHERE id = ? AND mfa_recovery = ?',
    [JSON.stringify(hashes), u.id, u.mfa_recovery]);
  return r.affectedRows === 1 ? 'recovery' : null;
}

async function status(req, res, next) {
  try {
    const u = await loadUser(req.user.id);
    res.json({
      enabled: !!u.mfa_enabled,
      enrolled_at: u.mfa_enrolled_at,
      recovery_codes_left: u.mfa_enabled ? recoveryList(u).length : 0,
      required_for_role: policy.isRequiredFor(u.role),
      required_from: policy.isRequiredFor(u.role) ? policy.enforceAfter().toISOString() : null,
      must_enrol_now: policy.mustEnrolNow(u)
    });
  } catch (err) { next(err); }
}

async function setup(req, res, next) {
  try {
    const u = await loadUser(req.user.id);
    if (u.mfa_enabled) return res.status(409).json({ error: 'Two-step sign-in is already on. Turn it off first to move it to another phone.' });
    const secret = totp.generateSecret();
    await pool.query('UPDATE users SET mfa_pending_enc = ? WHERE id = ?', [totp.encrypt(secret), u.id]);
    res.json({ secret, otpauth: totp.otpauthUri(secret, u.username) });
  } catch (err) { next(err); }
}

async function enable(req, res, next) {
  try {
    const u = await loadUser(req.user.id);
    if (u.mfa_enabled) return res.status(409).json({ error: 'Two-step sign-in is already on.' });
    if (!u.mfa_pending_enc) return res.status(400).json({ error: 'Start the setup first.' });
    const step = totp.verify(totp.decrypt(u.mfa_pending_enc), req.body.code, null);
    if (step === null) {
      res.locals.secEvent = 'auth.mfa_failed';
      res.locals.secDetail = { stage: 'enrolment' };
      return res.status(400).json({ error: 'That code is not right. Check the time on your phone and try the newest code.' });
    }
    const codes = totp.recoveryCodes();
    await pool.query(
      `UPDATE users SET mfa_enabled = 1, mfa_secret_enc = mfa_pending_enc, mfa_pending_enc = NULL,
              mfa_last_step = ?, mfa_recovery = ?, mfa_enrolled_at = NOW() WHERE id = ?`,
      [step, JSON.stringify(codes.map(totp.hashCode)), u.id]);
    // Sessions opened with the password alone end now; this device continues.
    const tv = await revokeSessions(u.id, 'mfa_enabled', req);
    res.locals.secEvent = 'auth.mfa_enabled';
    await logAudit({ actor: req.user, ip: req.ip, action: 'auth.mfa_enabled', entityType: 'user', entityId: u.id, summary: 'Turned on two-step sign-in' });
    const { generateToken } = require('./authController');
    res.json({ enabled: true, recovery_codes: codes, token: generateToken({ ...u, token_version: tv }) });
  } catch (err) { next(err); }
}

/** Public: the second step of sign-in. */
async function verify(req, res, next) {
  try {
    let claim;
    try { claim = jwt.verify(String(req.body.ticket || ''), process.env.JWT_SECRET, JWT_VERIFY); } catch (e) { claim = null; }
    if (!claim || claim.purpose !== 'mfa') {
      res.locals.secDetail = { reason: 'bad_ticket' };
      return res.status(401).json({ error: 'This sign-in has expired. Enter your password again.', code: 'MFA_TICKET_INVALID' });
    }
    const u = await loadUser(claim.id);
    if (!u || u.status === 'inactive' || !u.mfa_enabled || (claim.tv || 0) !== (u.token_version || 0)) {
      res.locals.secDetail = { reason: 'stale_ticket' };
      return res.status(401).json({ error: 'This sign-in has expired. Enter your password again.', code: 'MFA_TICKET_INVALID' });
    }
    res.locals.secUserId = u.id;
    res.locals.secRole = u.role;
    const how = await checkSecondFactor(u, req.body.code);
    if (!how) {
      res.locals.secEvent = 'auth.mfa_failed';
      res.locals.secDetail = { stage: 'sign_in' };
      return res.status(401).json({ error: 'That code is not right.', code: 'MFA_CODE_WRONG' });
    }
    res.locals.secEvent = how === 'recovery' ? 'auth.mfa_recovery_used' : 'auth.mfa_ok';
    const { sessionPayload } = require('./authController');
    const payload = await sessionPayload(u);
    if (how === 'recovery') payload.recovery_codes_left = recoveryList(await loadUser(u.id)).length;
    res.json(payload);
  } catch (err) { next(err); }
}

async function regenerateRecovery(req, res, next) {
  try {
    const u = await loadUser(req.user.id);
    if (!u.mfa_enabled) return res.status(400).json({ error: 'Two-step sign-in is not on.' });
    if (await checkSecondFactor(u, req.body.code) !== 'totp') {
      res.locals.secEvent = 'auth.mfa_failed';
      res.locals.secDetail = { stage: 'recovery_codes' };
      return res.status(400).json({ error: 'Enter a current code from your authenticator app.' });
    }
    const codes = totp.recoveryCodes();
    await pool.query('UPDATE users SET mfa_recovery = ? WHERE id = ?', [JSON.stringify(codes.map(totp.hashCode)), u.id]);
    await logAudit({ actor: req.user, ip: req.ip, action: 'auth.mfa_recovery_regenerated', entityType: 'user', entityId: u.id, summary: 'Replaced two-step recovery codes' });
    res.json({ recovery_codes: codes });
  } catch (err) { next(err); }
}

async function disable(req, res, next) {
  try {
    const u = await loadUser(req.user.id);
    if (policy.isRequiredFor(u.role)) {
      return res.status(403).json({ error: 'Two-step sign-in is required for your role and cannot be turned off.', code: 'MFA_REQUIRED_FOR_ROLE' });
    }
    if (!u.mfa_enabled) return res.status(400).json({ error: 'Two-step sign-in is not on.' });
    const [[p]] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [u.id]);
    if (!await bcrypt.compare(String(req.body.password || ''), p.password_hash) || !await checkSecondFactor(u, req.body.code)) {
      res.locals.secEvent = 'auth.mfa_failed';
      res.locals.secDetail = { stage: 'disable' };
      return res.status(400).json({ error: 'Your password and a current code are both needed to turn this off.' });
    }
    await pool.query(
      `UPDATE users SET mfa_enabled = 0, mfa_secret_enc = NULL, mfa_pending_enc = NULL, mfa_last_step = NULL,
              mfa_recovery = NULL, mfa_enrolled_at = NULL WHERE id = ?`, [u.id]);
    const tv = await revokeSessions(u.id, 'mfa_disabled', req);
    res.locals.secEvent = 'auth.mfa_disabled';
    await logAudit({ actor: req.user, ip: req.ip, action: 'auth.mfa_disabled', entityType: 'user', entityId: u.id, summary: 'Turned off two-step sign-in' });
    const { generateToken } = require('./authController');
    res.json({ enabled: false, token: generateToken({ ...u, token_version: tv }) });
  } catch (err) { next(err); }
}

module.exports = { status, setup, enable, verify, regenerateRecovery, disable };
