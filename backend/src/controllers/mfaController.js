const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_VERIFY } = require('../config/httpPolicy');
const pool = require('../config/database');
const totp = require('../services/totp');
const policy = require('../services/mfaPolicy');
const { revokeSessions } = require('../services/sessions');
const { logAudit } = require('../services/audit');
const passwords = require('../services/passwords');
const notify = require('../services/notify');
const trustedDevices = require('../services/trustedDevices');

/**
 * Two-step sign-in (SEC-007, DECISIONS.md D4).
 *
 *   GET  /api/auth/mfa                    status for the signed-in account
 *   POST /api/auth/mfa/setup              new secret (pending until confirmed)
 *   POST /api/auth/mfa/enable {code}      confirm it; returns ten recovery codes, once
 *   POST /api/auth/mfa/verify {ticket, code}   public: the second step of sign-in
 *   POST /api/auth/mfa/recovery-codes {code}   replace the recovery codes
 *   POST /api/auth/mfa/disable {password, code}  not allowed for a role that requires it
 *   POST /api/auth/mfa/assist-reset {user_id, code, reset_password}
 *        a supervisor clears someone's lost authenticator (D32)
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
      required_from: policy.isRequiredFor(u.role) ? policy.enforceAfter(u.role).toISOString() : null,
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
    // D33 "Trust this browser": only when asked, and only after a code from the app.
    // A recovery code means the phone is gone — and a stolen one must not plant a
    // 30-day trust — so that sign-in is never remembered.
    if (req.body.remember_device === true && how === 'totp') {
      const t = await trustedDevices.trust(req, res, u);
      payload.trusted_days = t.days;
      res.locals.secDetail = { trusted_browser: true, days: t.days };
      await logAudit({ actor: { id: u.id, full_name: u.full_name, role: u.role }, ip: req.ip, action: 'auth.browser_trusted',
        entityType: 'user', entityId: u.id, summary: `Trusted a browser for ${t.days} days (${trustedDevices.label(req.headers['user-agent'])})` });
    }
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

/**
 * Who may clear whose two-step sign-in: the person's own line of support, never
 * sideways and never oneself (D32).
 *   platform admin  -> anyone else, including another platform admin
 *   field engineer  -> school admins and teachers of the schools assigned to them
 *   school admin    -> teachers of their own school
 */
async function canAssist(actor, target) {
  if (!actor || !target || actor.id === target.id) return false;
  if (actor.role === 'admin') return true;
  if (actor.role === 'school') return target.role === 'teacher' && !!actor.school_id && target.school_id === actor.school_id;
  if (actor.role === 'subadmin' && ['school', 'teacher'].includes(target.role) && target.school_id) {
    const [[s]] = await pool.query('SELECT id FROM schools WHERE id = ? AND assigned_admin_id = ?', [target.school_id, actor.id]);
    return !!s;
  }
  return false;
}

/**
 * The last resort, for someone who lost their phone AND their recovery codes:
 * their supervisor confirms who they are (a call to the registered number), then
 * clears the authenticator with a current code from their own. The person signs in
 * with their password and must scan a new QR code at once. Optionally a temporary
 * password too, for someone who also forgot it. Everything is audited, the person
 * is emailed, and every session of theirs ends.
 */
async function assistReset(req, res, next) {
  try {
    const actor = await loadUser(req.user.id);
    const targetId = Number(req.body.user_id);
    const target = Number.isInteger(targetId) ? await loadUser(targetId) : null;
    if (!await canAssist(actor, target)) {
      res.locals.secRule = 'mfa_assist_scope';
      return res.status(403).json({ error: 'You can only help people you support: your own teachers or schools.', code: 'MFA_ASSIST_FORBIDDEN' });
    }
    if (!actor.mfa_enabled) {
      return res.status(403).json({ error: 'Turn on your own two-step sign-in first.', code: 'MFA_ASSIST_NEEDS_MFA' });
    }
    if (await checkSecondFactor(actor, req.body.code) !== 'totp') {
      res.locals.secEvent = 'auth.mfa_failed';
      res.locals.secDetail = { stage: 'assist_reset' };
      return res.status(400).json({ error: 'Enter a current 6-digit code from your own authenticator app.' });
    }

    const temporary = req.body.reset_password ? passwords.temporary() : null;
    await pool.query(
      `UPDATE users SET mfa_enabled = 0, mfa_secret_enc = NULL, mfa_pending_enc = NULL, mfa_last_step = NULL,
              mfa_recovery = NULL, mfa_enrolled_at = NULL${temporary ? ', password_hash = ?, must_change_password = 1' : ''}
        WHERE id = ?`,
      temporary ? [await bcrypt.hash(temporary, 12), target.id] : [target.id]);
    await revokeSessions(target.id, 'mfa_reset_assisted', req);

    res.locals.secEvent = 'auth.mfa_reset_assisted';
    res.locals.secDetail = { target_user_id: target.id, target_role: target.role, password_reset: !!temporary };
    await logAudit({
      actor: req.user, ip: req.ip, action: 'auth.mfa_reset_assisted', entityType: 'user', entityId: target.id,
      summary: `Cleared two-step sign-in for ${target.full_name || target.username}${temporary ? ' and set a temporary password' : ''}`,
      meta: { target_role: target.role, password_reset: !!temporary }
    });
    notify.sendMail({
      to: target.email,
      subject: 'Your two-step sign-in was reset',
      text: [
        `Hello${target.full_name ? ' ' + target.full_name : ''},`, '',
        `${actor.full_name || 'Your supervisor'} reset your two-step sign-in${temporary ? ' and your password' : ''} for OE Technical Support.`,
        'Every device you were signed in on has been signed out. At your next sign-in you will scan a new QR code with your authenticator app.',
        'If you did not ask for this, tell the platform administrator immediately.'
      ].join('\n')
    }).catch(() => {});
    res.json({
      message: `Two-step sign-in cleared for ${target.full_name || target.username}. They set it up again at their next sign-in.`,
      ...(temporary ? { password: temporary } : {})
    });
  } catch (err) { next(err); }
}

/** GET /api/auth/mfa/trusted — this account's trusted browsers (D33); `current` is the one asking. */
async function trustedList(req, res, next) {
  try { res.json({ browsers: await trustedDevices.list(req, req.user.id), days: trustedDevices.daysFor(req.user.role) }); }
  catch (err) { next(err); }
}

/** DELETE /api/auth/mfa/trusted[/:id] — forget one trusted browser, or all of them. Own account only. */
async function trustedForget(req, res, next) {
  try {
    const id = req.params.id !== undefined ? Number(req.params.id) : null;
    if (id !== null && !Number.isInteger(id)) return res.status(400).json({ error: 'Unknown browser.' });
    const n = await trustedDevices.forget(req, res, req.user.id, id);
    if (id !== null && !n) return res.status(404).json({ error: 'That browser is not trusted.' });
    await logAudit({ actor: req.user, ip: req.ip, action: 'auth.browser_forgotten', entityType: 'user', entityId: req.user.id,
      summary: id === null ? 'Forgot every trusted browser' : 'Forgot a trusted browser', meta: { count: n } });
    res.json({ forgotten: n });
  } catch (err) { next(err); }
}

module.exports = { status, setup, enable, verify, regenerateRecovery, disable, assistReset, canAssist, trustedList, trustedForget };
