const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const notify = require('./notify');
const passwords = require('./passwords');

const TOKEN_BYTES = 32;
const TOKEN_MINUTES = 15;
const ACCOUNT_COOLDOWN_MINUTES = 2;
const ACCOUNT_HOURLY_LIMIT = 3;
const GENERIC_MESSAGE = 'If this is an active Platform Admin account and email recovery is available, a password reset link has been sent. It expires in 15 minutes.';

class RecoveryError extends Error {
  constructor(message, code = 'RECOVERY_LINK_INVALID') {
    super(message);
    this.name = 'RecoveryError';
    this.code = code;
  }
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token || ''), 'utf8').digest('hex');
}

function trustedAppUrl(explicit) {
  // FRONTEND_URL may list several CORS origins; a link can only use one.
  const value = String(explicit || process.env.APP_URL || process.env.FRONTEND_URL || '').split(',')[0].trim();
  if (!/^https?:\/\/[^\s]+$/i.test(value)) return null;
  return value.replace(/\/+$/, '');
}

/**
 * Issue a recovery link for an active Platform Admin.
 *
 * The return value is internal diagnostics. Controllers must always return the
 * same GENERIC_MESSAGE, whether the identifier matched or not. Tests may inject
 * a sender; production uses the configured SMTP transport.
 */
async function issue(identifier, options = {}) {
  const normalized = String(identifier || '').trim().toLowerCase();
  const appUrl = trustedAppUrl(options.appUrl);
  const emailConfigured = options.emailConfigured !== undefined
    ? !!options.emailConfigured
    : notify.isConfigured();
  const sendMail = options.sendMail || notify.sendMail;

  if (!normalized) return { matched: false, sent: false, reason: 'invalid_identifier' };

  const conn = await pool.getConnection();
  let user = null;
  let rawToken = null;
  let tokenHash = null;
  try {
    await conn.beginTransaction();
    const [users] = await conn.query(
      `SELECT id, email, full_name, status
         FROM users
        WHERE (LOWER(username) = ? OR LOWER(email) = ?)
          AND role = 'admin'
        LIMIT 1 FOR UPDATE`,
      [normalized, normalized]
    );
    user = users[0] || null;
    if (!user || user.status !== 'active') {
      await conn.commit();
      return { matched: false, sent: false, reason: 'not_eligible' };
    }

    if (!emailConfigured || !appUrl || !user.email) {
      await conn.commit();
      return { matched: true, userId: user.id, sent: false, reason: 'delivery_unavailable' };
    }

    const [[limits]] = await conn.query(
      `SELECT
         SUM(created_at >= NOW() - INTERVAL ? MINUTE) AS cooling_down,
         SUM(created_at >= NOW() - INTERVAL 1 HOUR) AS sent_last_hour
       FROM password_recovery_tokens WHERE user_id = ?`,
      [ACCOUNT_COOLDOWN_MINUTES, user.id]
    );
    if (Number(limits.cooling_down) > 0 || Number(limits.sent_last_hour) >= ACCOUNT_HOURLY_LIMIT) {
      await conn.commit();
      return { matched: true, userId: user.id, sent: false, reason: 'account_throttled' };
    }

    // Only the newest link remains usable. The raw value is never stored.
    await conn.query('UPDATE password_recovery_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL', [user.id]);
    rawToken = crypto.randomBytes(TOKEN_BYTES).toString('base64url');
    tokenHash = hashToken(rawToken);
    await conn.query(
      `INSERT INTO password_recovery_tokens (user_id, token_hash, expires_at)
       VALUES (?, ?, NOW() + INTERVAL ? MINUTE)`,
      [user.id, tokenHash, TOKEN_MINUTES]
    );
    await conn.commit();
  } catch (err) {
    try { await conn.rollback(); } catch (_) { /* best effort */ }
    throw err;
  } finally {
    conn.release();
  }

  const delivery = deliver(user, rawToken, tokenHash, appUrl, sendMail);
  // The public endpoint must not wait for SMTP: a slow mail server would make
  // real accounts answer measurably later than unknown ones. It passes
  // `background: true` and reports the delivery outcome after responding.
  if (options.background) return { matched: true, userId: user.id, queued: true, delivery };
  return delivery;
}

/** Send the link. Never rejects; a link that did not leave the server is spent. */
async function deliver(user, rawToken, tokenHash, appUrl, sendMail) {
  const link = `${appUrl}/#reset-password?token=${encodeURIComponent(rawToken)}`;
  let result;
  try {
    result = await sendMail({
      to: user.email,
      subject: 'Platform Admin password reset',
      text: [
        `Hello ${user.full_name || 'Platform Administrator'},`,
        '',
        'A password reset was requested for your Platform Admin account.',
        `Open this one-time link within ${TOKEN_MINUTES} minutes:`,
        link,
        '',
        'If you did not request this, ignore this message and report it to the system owner.',
        'Changing the password signs out every existing session. Two-step sign-in remains required.'
      ].join('\n')
    });
  } catch (err) {
    result = { sent: false, error: err.message };
  }

  if (!result || !result.sent) {
    try {
      await pool.query('UPDATE password_recovery_tokens SET used_at = NOW() WHERE token_hash = ? AND used_at IS NULL', [tokenHash]);
    } catch (_) { /* the link still expires in TOKEN_MINUTES */ }
    return { matched: true, userId: user.id, sent: false, reason: (result && (result.error || result.skipped)) || 'delivery_failed' };
  }
  return { matched: true, userId: user.id, sent: true };
}

/** Spend a one-time link and atomically replace the password + revoke sessions. */
async function consume(rawToken, newPassword) {
  const token = String(rawToken || '');
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new RecoveryError('This password reset link is invalid or has expired.');
  const problem = passwords.problem(newPassword);
  if (problem) throw new RecoveryError(problem, 'PASSWORD_POLICY');

  const tokenHash = hashToken(token);
  // Reject random guesses before paying bcrypt's cost. The row is re-checked
  // under a transaction lock after hashing to preserve one-time semantics.
  const [preflight] = await pool.query(
    `SELECT t.user_id
       FROM password_recovery_tokens t
       JOIN users u ON u.id = t.user_id
      WHERE t.token_hash = ? AND t.used_at IS NULL AND t.expires_at > NOW()
        AND u.role = 'admin' AND u.status = 'active' LIMIT 1`,
    [tokenHash]
  );
  if (!preflight.length) throw new RecoveryError('This password reset link is invalid or has expired.');

  const passwordHash = await bcrypt.hash(String(newPassword), 12);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      `SELECT t.id, t.user_id, u.username, u.full_name, u.email
         FROM password_recovery_tokens t
         JOIN users u ON u.id = t.user_id
        WHERE t.token_hash = ? AND t.used_at IS NULL AND t.expires_at > NOW()
          AND u.role = 'admin' AND u.status = 'active'
        LIMIT 1 FOR UPDATE`,
      [tokenHash]
    );
    if (!rows.length) throw new RecoveryError('This password reset link is invalid or has expired.');
    const user = rows[0];

    await conn.query(
      `UPDATE users
          SET password_hash = ?, must_change_password = 0,
              token_version = COALESCE(token_version, 0) + 1
        WHERE id = ?`,
      [passwordHash, user.user_id]
    );
    await conn.query('UPDATE password_recovery_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL', [user.user_id]);
    await conn.commit();
    return { id: user.user_id, username: user.username, full_name: user.full_name, email: user.email };
  } catch (err) {
    try { await conn.rollback(); } catch (_) { /* best effort */ }
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  issue, consume, hashToken, trustedAppUrl, RecoveryError,
  GENERIC_MESSAGE, TOKEN_MINUTES, ACCOUNT_COOLDOWN_MINUTES, ACCOUNT_HOURLY_LIMIT
};
