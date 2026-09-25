const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const passwords = require('../services/passwords');
const streamifier = require('streamifier');
const pool = require('../config/database');
const cloudinary = require('../config/cloudinary');
const { revokeSessions } = require('../services/sessions');
const passwordRecovery = require('../services/passwordRecovery');
const notify = require('../services/notify');
const securityEvents = require('../services/securityEvents');
const { logAudit } = require('../services/audit');

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

/** POST /api/auth/password-recovery/request — deliberately non-enumerating. */
async function requestPasswordRecovery(req, res, next) {
  const started = Date.now();
  try {
    const result = await passwordRecovery.issue(req.body.identifier, { background: true });
    res.locals.secEvent = 'auth.password_recovery_requested';
    res.locals.secUserId = result.userId || null;
    // Internal evidence may say whether a link was queued, but never stores the
    // identifier or reset token and the public answer never changes.
    res.locals.secDetail = { delivery: result.queued ? 'queued' : 'not_sent' };
    const wait = Math.max(0, 400 - (Date.now() - started));
    if (wait) await new Promise(resolve => setTimeout(resolve, wait));
    res.status(202).json({ message: passwordRecovery.GENERIC_MESSAGE });

    // SMTP finishes after the response so its latency cannot reveal an account.
    if (result.delivery) {
      result.delivery.then(outcome => {
        if (outcome.sent) return;
        securityEvents.record({
          event_type: 'auth.password_recovery_failed', source_ip: req.ip, user_id: outcome.userId,
          role: 'admin', method: req.method, path_template: '/api/auth/password-recovery/request',
          status: 202, detail: { reason: 'delivery_failed' }
        });
      });
    }
  } catch (err) {
    res.locals.secEvent = 'auth.password_recovery_failed';
    res.locals.secDetail = { reason: 'service_unavailable' };
    next(err);
  }
}

/** POST /api/auth/password-recovery/reset — spends a one-time email link. */
async function resetPasswordRecovery(req, res, next) {
  try {
    const user = await passwordRecovery.consume(req.body.token, req.body.new_password);
    res.locals.secEvent = 'auth.password_recovery_completed';
    res.locals.secUserId = user.id;
    res.locals.secDetail = { sessions_revoked: true, mfa_preserved: true };

    securityEvents.record({
      event_type: 'auth.sessions_revoked', source_ip: req.ip, user_id: user.id,
      role: 'admin', method: req.method, path_template: '/api/auth/password-recovery/reset',
      status: 200, detail: { reason: 'password_recovery' }
    });
    await logAudit({
      action: 'auth.password_recovery_completed', entityType: 'user', entityId: user.id,
      summary: 'Platform Admin completed one-time email password recovery; all sessions revoked',
      meta: { method: 'one_time_email_link', mfa_preserved: true }, ip: req.ip
    });

    // NIST SP 800-63B calls for an independent account-recovery notification.
    // This second message contains no link or secret and cannot undo the reset.
    await notify.sendMail({
      to: user.email,
      subject: 'Your Platform Admin password was changed',
      text: [
        `Hello ${user.full_name || 'Platform Administrator'},`, '',
        'Your Platform Admin password was changed through account recovery.',
        'Every previous session has been signed out. Two-step sign-in remains enabled.',
        'If you did not do this, contact the system owner immediately and use the hosting recovery procedure.'
      ].join('\n')
    });
    res.json({ message: 'Password updated. Every previous session has been signed out. Sign in with your new password; two-step sign-in still applies.' });
  } catch (err) {
    if (err instanceof passwordRecovery.RecoveryError) {
      res.locals.secEvent = 'auth.password_recovery_failed';
      res.locals.secDetail = { reason: err.code === 'PASSWORD_POLICY' ? 'password_policy' : 'invalid_or_expired' };
      return res.status(400).json({ error: err.message, code: err.code });
    }
    next(err);
  }
}

module.exports = { login, register, getProfile, updateProfile, uploadAvatar, changePassword, revokeAllSessions,
  requestPasswordRecovery, resetPasswordRecovery, sessionPayload, generateToken };
