const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const passwords = require('../services/passwords');
const streamifier = require('streamifier');
const pool = require('../config/database');
const cloudinary = require('../config/cloudinary');
const { revokeSessions } = require('../services/sessions');
const accountRecovery = require('../services/accountRecovery');
const notify = require('../services/notify');
const securityEvents = require('../services/securityEvents');
const { logAudit } = require('../services/audit');
const trustedDevices = require('../services/trustedDevices');

function uploadToCloudinary(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (result) resolve(result);
      else reject(error);
    });
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

function generateToken(user) {
  return jwt.sign(
    // tv: the account's session version (SEC-005). Bumping it ends every token issued before.
    { id: user.id, role: user.role, username: user.username, tv: user.token_version || 0 },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

/**
 * The teacher's registration status token (SEC-008), minted if an older row has
 * none. Only ever returned after the password has been checked.
 */
async function teacherStatusToken(userId) {
  const [[t]] = await pool.query('SELECT id, status_token FROM teachers WHERE user_id = ? ORDER BY id DESC LIMIT 1', [userId]);
  if (!t) return null;
  if (t.status_token) return t.status_token;
  const token = require('crypto').randomBytes(24).toString('hex');
  await pool.query('UPDATE teachers SET status_token = ? WHERE id = ?', [token, t.id]);
  return token;
}

async function login(req, res, next) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const [rows] = await pool.query(
      'SELECT id, username, email, full_name, role, phone, zone, color, title, status, password_hash, school_id, approval_status, avatar_url, bio, must_change_password, token_version, mfa_enabled FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)',
      [username, username]
    );

    if (!rows.length) {
      // Recorded without the typed name: an unknown username may be a password
      // pasted into the wrong box, and it is not ours to keep.
      res.locals.secDetail = { reason: 'unknown_account' };
      // Check if this is a pending registration (case-insensitive email match)
      const [regRows] = await pool.query(
        'SELECT id, status, email, password_hash, rejection_reason FROM registration_requests WHERE LOWER(email) = LOWER(?)',
        [username]
      );
      if (regRows.length) {
        const reg = regRows[0];
        const regPwValid = await bcrypt.compare(password, reg.password_hash);
        if (regPwValid) {
          if (reg.status === 'pending') {
            return res.status(403).json({ error: 'pending_approval', request_id: reg.id, email: reg.email });
          }
          if (reg.status === 'rejected') {
            return res.status(403).json({ error: 'registration_rejected', request_id: reg.id, email: reg.email, rejection_reason: reg.rejection_reason });
          }
        }
      }
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const user = rows[0];

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.locals.secUserId = user.id;
      res.locals.secRole = user.role;
      res.locals.secDetail = { reason: 'wrong_password' };
      // Check if this email has a pending/rejected registration with correct password
      const emailToCheck = user.email || username;
      const [regRows] = await pool.query(
        'SELECT id, status, email, password_hash, rejection_reason FROM registration_requests WHERE LOWER(email) = LOWER(?)',
        [emailToCheck]
      );
      if (regRows.length) {
        const reg = regRows[0];
        const regPwValid = await bcrypt.compare(password, reg.password_hash);
        if (regPwValid) {
          if (reg.status === 'pending') {
            return res.status(403).json({ error: 'pending_approval', request_id: reg.id, email: reg.email });
          }
          if (reg.status === 'rejected') {
            return res.status(403).json({ error: 'registration_rejected', request_id: reg.id, email: reg.email, rejection_reason: reg.rejection_reason });
          }
        }
      }
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Check teacher approval status before generic inactive check
    if (user.role === 'teacher' && user.approval_status === 'pending') {
      return res.status(403).json({ error: 'teacher_pending', user_id: user.id, email: user.email, status_token: await teacherStatusToken(user.id) });
    }
    if (user.role === 'teacher' && user.approval_status === 'rejected') {
      const [teacherRows] = await pool.query('SELECT rejection_reason FROM teachers WHERE user_id = ?', [user.id]);
      return res.status(403).json({ error: 'teacher_rejected', user_id: user.id, email: user.email, rejection_reason: teacherRows[0]?.rejection_reason || null, status_token: await teacherStatusToken(user.id) });
    }

    if (user.status === 'inactive') {
      return res.status(403).json({ error: 'Account is deactivated.' });
    }

    res.locals.secUserId = user.id;
    res.locals.secRole = user.role;

    // SEC-016 (D29): a password printed in this public repository is compromised.
    // Where the USERNAME was printed beside it, the whole sign-in is public: refuse,
    // before any ticket or session — a forced change would hand the account to
    // whoever signs in first. Anyone else must still guess the username, and real
    // teachers were using these passwords every day: sign in, but choose a new one
    // before anything else, and tell the platform admin (R9).
    if (passwords.isPublishedPair(user.username, password)) {
      res.locals.secEvent = 'auth.published_password';
      res.locals.secDetail = { reason: 'published_username_and_password' };
      return res.status(403).json({ code: 'PUBLISHED_PASSWORD',
        error: 'This account\'s username and password have both been published, so it cannot be used to sign in. Ask your platform administrator to reset it.' });
    }
    if (passwords.isPublished(password)) {
      res.locals.secEvent = 'auth.published_password';
      res.locals.secDetail = { reason: 'published_password_forced_change' };
    }
    // Published, or the old generated "Teacher@1234": sign in, but a new password first.
    if ((passwords.isPublished(password) || passwords.isGuessable(password)) && !user.must_change_password) {
      await pool.query('UPDATE users SET must_change_password = 1 WHERE id = ?', [user.id]);
      user.must_change_password = 1;
    }

    // Two-step sign-in (SEC-007, D4): with it on, the password earns only a
    // five-minute ticket that can do one thing — be exchanged, with a code, at
    // POST /api/auth/mfa/verify. It is not a session and authenticate() refuses it.
    if (user.mfa_enabled) {
      // D34: a browser this account trusted after a full two-step sign-in needs the
      // password only — until it expires or anything ends every session. Recorded as
      // a sign-in like any other (R3 still sees it), with how the second step was met.
      if (await trustedDevices.check(req, user)) {
        res.locals.secEvent = res.locals.secEvent || 'auth.login_ok';
        res.locals.secDetail = res.locals.secDetail || { second_factor: 'trusted_browser' };
        return res.json(await sessionPayload(user));
      }
      res.locals.secEvent = res.locals.secEvent || 'auth.mfa_required';   // keep auth.published_password (R9)
      return res.json({ mfa_required: true, mfa_ticket: mfaTicket(user) });
    }

    res.locals.secEvent = res.locals.secEvent || 'auth.login_ok';   // keep auth.published_password (R9)
    res.json(await sessionPayload(user));
  } catch (err) { next(err); }
}

/** A short-lived, single-purpose ticket: proof the password was right, nothing more. */
function mfaTicket(user) {
  return jwt.sign({ id: user.id, tv: user.token_version || 0, purpose: 'mfa' },
    process.env.JWT_SECRET, { expiresIn: '5m' });
}

/** What a successful sign-in returns — the same whether it took one step or two. */
async function sessionPayload(user) {
  const token = generateToken(user);
  let school_name = null;
  if (user.school_id) {
    const [schoolRows] = await pool.query('SELECT name FROM schools WHERE id = ?', [user.school_id]);
    if (schoolRows.length) school_name = schoolRows[0].name;
  }
  return {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        phone: user.phone,
        zone: user.zone,
        color: user.color,
        title: user.title,
        status: user.status,
        school_id: user.school_id,
        school_name,
        avatar_url: user.avatar_url || null,
        bio: user.bio || null,
        must_change_password: !!user.must_change_password,
        mfa_enabled: !!user.mfa_enabled
      }
  };
}

async function register(req, res, next) {
  try {
    const { username, email, password, full_name, role, phone, zone, title } = req.body;

    if (!username || !email || !password || !full_name) {
      return res.status(400).json({ error: 'Username, email, password, and full_name are required.' });
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existing.length) {
      return res.status(409).json({ error: 'Username or email already exists.' });
    }

    { const why = passwords.problem(password); if (why) return res.status(400).json({ error: why }); }
    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (username, email, password_hash, full_name, role, phone, zone, title) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [username, email, passwordHash, full_name, role || 'school', phone || null, zone || null, title || null]
    );

    const token = generateToken({ id: result.insertId, role: role || 'school', username });

    res.status(201).json({
      token,
      user: { id: result.insertId, username, email, full_name, role: role || 'school' }
    });
  } catch (err) { next(err); }
}

async function getProfile(req, res, next) {
  try {
    const [rows] = await pool.query(
      'SELECT id, username, email, full_name, role, phone, zone, color, title, status, school_id, bio, avatar_url, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found.' });
    res.json(rows[0]);
  } catch (err) { next(err); }
}

async function updateProfile(req, res, next) {
  try {
    const { full_name, email, phone, zone, title, bio } = req.body;
    if (!full_name || !full_name.trim()) return res.status(400).json({ error: 'Full name is required.' });

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ? AND id != ?', [email, req.user.id]);
    if (existing.length) return res.status(400).json({ error: 'Email already in use.' });

    await pool.query(
      'UPDATE users SET full_name = ?, email = ?, phone = ?, zone = ?, title = ?, bio = ?, updated_at = NOW() WHERE id = ?',
      [full_name.trim(), email || null, phone || null, zone || null, title || null, bio || null, req.user.id]
    );
    const [rows] = await pool.query(
      'SELECT id, username, email, full_name, role, phone, zone, color, title, status, school_id, bio, avatar_url, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
}

async function uploadAvatar(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    if (!req.file.mimetype.startsWith('image/')) return res.status(400).json({ error: 'Only image files are allowed.' });

    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY) {
      return res.status(500).json({ error: 'Cloud storage not configured — contact admin' });
    }

    const result = await uploadToCloudinary(req.file.buffer, {
      resource_type: 'image',
      folder: 'oe-avatars',
      public_id: `avatar-${req.user.id}-${Date.now()}`,
      overwrite: true
    });

    const avatarUrl = result.secure_url.replace('/upload/', '/upload/w_300,h_300,c_fill,g_face/');
    await pool.query('UPDATE users SET avatar_url = ?, updated_at = NOW() WHERE id = ?', [avatarUrl, req.user.id]);
    res.json({ avatar_url: avatarUrl });
  } catch (err) {
    console.error('Avatar upload error:', err && err.message ? err.message : err);
    res.status(500).json({ error: 'Photo upload failed — please try again' });
  }
}

async function changePassword(req, res, next) {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current and new password are required.' });
    }
    { const why = passwords.problem(new_password); if (why) return res.status(400).json({ error: why }); }

    const [rows] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'User not found.' });
    const valid = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!valid) {
      // 400, not 401: a wrong current password is a failed check, not a missing
      // session — the client signs out on 401, which threw people out of the form.
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    const newHash = await bcrypt.hash(new_password, 12);
    // Clear the forced-change flag once the user picks their own password.
    await pool.query('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?', [newHash, req.user.id]);

    // Every other device is signed out; this one gets a fresh token so the
    // person who just changed their password stays signed in where they are.
    const tv = await revokeSessions(req.user.id, 'password_changed', req);
    res.json({
      message: 'Password changed successfully. Other devices have been signed out.',
      token: generateToken({ ...req.user, token_version: tv })
    });
  } catch (err) { next(err); }
}

/** POST /api/auth/sessions/revoke-all — sign this account out on every device, this one included. */
async function revokeAllSessions(req, res, next) {
  try {
    await revokeSessions(req.user.id, 'sign_out_everywhere', req);
    res.json({ message: 'Signed out on every device.' });
  } catch (err) { next(err); }
}

const RECOVERY_PADDING_MS = 400;

function recoveryRefused(res, err) {
  res.locals.secEvent = 'auth.recovery_failed';
  res.locals.secDetail = { reason: err.code === 'PASSWORD_POLICY' ? 'password_policy'
    : err.code === 'RECOVERY_CODES_WRONG' ? 'codes_wrong' : 'expired_or_used' };
  const body = { error: err.message, code: err.code };
  if (typeof err.attemptsLeft === 'number') body.attempts_left = err.attemptsLeft;
  return res.status(400).json(body);
}

/**
 * POST /api/auth/recovery/start — the same answer for every identifier (D32).
 * Padded to a fixed time; the email goes out after the response, so neither the
 * database work nor SMTP latency can tell a real account from an unknown one.
 */
async function startRecovery(req, res, next) {
  const started = Date.now();
  try {
    const result = await accountRecovery.start(req.body.identifier, { ip: req.ip });
    res.locals.secEvent = 'auth.recovery_started';
    res.locals.secUserId = result.userId;
    // Internal evidence only: the identifier and the code are never recorded.
    res.locals.secDetail = { email: result.emailQueued ? 'queued' : (result.reason || 'not_sent') };
    const wait = Math.max(0, RECOVERY_PADDING_MS - (Date.now() - started));
    if (wait) await new Promise(resolve => setTimeout(resolve, wait));
    res.status(202).json({
      flow: result.flowId,
      message: accountRecovery.START_MESSAGE,
      expires_in: accountRecovery.FLOW_MINUTES * 60
    });
    if (result.delivery) {
      result.delivery.then(outcome => {
        if (outcome.sent) return;
        securityEvents.record({
          event_type: 'auth.recovery_failed', source_ip: req.ip, user_id: outcome.userId,
          method: req.method, path_template: '/api/auth/recovery/start', status: 202,
          detail: { reason: 'email_delivery_failed' }
        });
      });
    }
  } catch (err) { next(err); }
}

/** POST /api/auth/recovery/verify — two of: email code, authenticator code, recovery code. */
async function verifyRecovery(req, res, next) {
  try {
    const result = await accountRecovery.verify(req.body.flow, {
      email_code: req.body.email_code, totp_code: req.body.totp_code, recovery_code: req.body.recovery_code
    });
    res.locals.secEvent = 'auth.recovery_verified';
    res.locals.secUserId = result.userId;
    res.locals.secDetail = { factors: result.factors.join('+') };
    res.json({ reset_token: result.resetToken, expires_in: accountRecovery.RESET_MINUTES * 60 });
  } catch (err) {
    if (err instanceof accountRecovery.RecoveryError) return recoveryRefused(res, err);
    next(err);
  }
}

/** POST /api/auth/recovery/complete — set the password; every other session ends. */
async function completeRecovery(req, res, next) {
  try {
    const done = await accountRecovery.complete(req.body.flow, req.body.reset_token, req.body.new_password);
    const [[user]] = await pool.query(
      'SELECT id, username, email, full_name, role, phone, zone, color, title, status, school_id, approval_status, avatar_url, bio, must_change_password, token_version, mfa_enabled FROM users WHERE id = ?',
      [done.userId]);
    res.locals.secEvent = 'auth.recovery_completed';
    res.locals.secUserId = user.id;
    res.locals.secRole = user.role;
    res.locals.secDetail = { factors: done.factors.join('+'), sessions_revoked: true };
    securityEvents.record({
      event_type: 'auth.sessions_revoked', source_ip: req.ip, user_id: user.id, role: user.role,
      method: req.method, path_template: '/api/auth/recovery/complete', status: 200,
      detail: { reason: 'password_recovery' }
    });
    await logAudit({
      action: 'auth.password_recovered', entityType: 'user', entityId: user.id, ip: req.ip,
      actor: { id: user.id, username: user.username, full_name: user.full_name, role: user.role },
      summary: 'Recovered a forgotten password; every other session ended',
      meta: { factors: done.factors, mfa_unchanged: true }
    });
    // NIST SP 800-63B-4: tell the person through a channel the recovery did not
    // depend on. No link, no code — it cannot undo anything.
    notify.sendMail({ to: user.email, ...accountRecovery.changedEmail(user, done.factors) }).catch(() => {});
    const payload = await sessionPayload(user);
    payload.message = 'Password changed. Every other device has been signed out.';
    res.json(payload);
  } catch (err) {
    if (err instanceof accountRecovery.RecoveryError) return recoveryRefused(res, err);
    next(err);
  }
}

module.exports = { login, register, getProfile, updateProfile, uploadAvatar, changePassword, revokeAllSessions,
  startRecovery, verifyRecovery, completeRecovery, sessionPayload, generateToken };

/* ------------------------------------------------------------------ *
 * Reading language (feature 14)
 * ------------------------------------------------------------------ */

/**
 * Kept on the ACCOUNT, not in browser storage — school tablets are shared, so a
 * per-device preference follows the tablet rather than the person, exactly the
 * problem tour_state exists to avoid (D27).
 *
 * Unset means Kiswahili: the owner's default, and the language of the USSD menu.
 * Nobody has to find a setting to be understood.
 */
const LANGUAGES = ['sw', 'en'];
const DEFAULT_LANGUAGE = 'sw';

async function getLanguage(req, res, next) {
  try {
    const [[row]] = await pool.query('SELECT language FROM users WHERE id = ?', [req.user.id]);
    const stored = row && row.language;
    res.json({
      language: LANGUAGES.includes(stored) ? stored : DEFAULT_LANGUAGE,
      chosen: LANGUAGES.includes(stored),
      available: LANGUAGES
    });
  } catch (err) { next(err); }
}

/** PUT /api/auth/language  { language } — own account only; there is no id to pass. */
async function setLanguage(req, res, next) {
  try {
    const wanted = String((req.body && req.body.language) || '').toLowerCase();
    // A fixed-choice field is validated on the server, never only by the control.
    if (!LANGUAGES.includes(wanted)) {
      return res.status(400).json({ error: 'Unknown language.', available: LANGUAGES });
    }
    await pool.query('UPDATE users SET language = ? WHERE id = ?', [wanted, req.user.id]);
    res.json({ language: wanted, chosen: true, available: LANGUAGES });
  } catch (err) { next(err); }
}

module.exports.getLanguage = getLanguage;
module.exports.setLanguage = setLanguage;
module.exports.LANGUAGES = LANGUAGES;
module.exports.DEFAULT_LANGUAGE = DEFAULT_LANGUAGE;
