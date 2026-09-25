const crypto = require('crypto');
const pool = require('../config/database');

/**
 * "Trust this browser" — ask for the authenticator code on a new browser, not on
 * every sign-in (DECISIONS.md D33).
 *
 * The problem: the app signs people out after inactivity, and every sign-in then
 * asked for the authenticator code — a phone in hand several times a day, which
 * teaches people to resent the second step rather than value it.
 *
 * What large platforms do: Microsoft Entra's "Don't ask again for X days" sets a
 * persistent cookie in the browser after a successful MFA sign-in (≤ 90 days
 * recommended) and revokes it with the user's sessions; Google offers "Don't ask
 * again on this computer". NIST SP 800-63B-4 lets an AAL2 subscriber reauthenticate
 * with the password alone "in conjunction with the session secret" — here, a secret
 * bound to the browser at the moment both factors were proven.
 *
 * So, after a full two-step sign-in with "Trust this browser" ticked:
 *   - a random 256-bit secret goes into an HttpOnly, SameSite=Strict cookie scoped
 *     to /api/auth (script on the page cannot read it; it travels only to sign-in);
 *   - only its SHA-256 is stored, with the account's session version;
 *   - a later sign-in on that browser needs the password only, until it expires:
 *     14 days for a platform admin, 30 for everyone else;
 *   - anything that ends every session (password change or reset, "Sign out
 *     everywhere", suspension, a supervisor's two-step reset) bumps the session
 *     version, and every trusted browser for the account stops counting with it.
 * The password is always still required. A different browser, a cleared cookie, or
 * another account on the same shared tablet is asked for the code as before.
 */

const COOKIE_PREFIX = 'oe_td_';
const DAYS = { admin: 14, default: 30 };
const MAX_PER_ACCOUNT = 10;

const sha256 = (v) => crypto.createHash('sha256').update(String(v || ''), 'utf8').digest('hex');
const daysFor = (role) => (role === 'admin' ? DAYS.admin : DAYS.default);
const cookieName = (userId) => COOKIE_PREFIX + Number(userId);

function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

function secureCookie(req) {
  return process.env.NODE_ENV === 'production' || req.secure;
}

function setCookie(res, req, name, value, maxAgeSeconds) {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/api/auth', 'HttpOnly', 'SameSite=Strict', `Max-Age=${maxAgeSeconds}`];
  if (secureCookie(req)) parts.push('Secure');
  const prev = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', [].concat(prev || [], parts.join('; ')));
}

/** A short, human label for the list ("Chrome on Windows") — not the full user-agent string. */
function label(ua) {
  const s = String(ua || '');
  const browser = /Edg\//.test(s) ? 'Edge' : /OPR\//.test(s) ? 'Opera' : /Chrome\//.test(s) ? 'Chrome'
    : /Firefox\//.test(s) ? 'Firefox' : /Safari\//.test(s) ? 'Safari' : 'A browser';
  const os = /Android/.test(s) ? 'Android' : /iPhone|iPad|iOS/.test(s) ? 'iOS' : /Windows/.test(s) ? 'Windows'
    : /Mac OS X|Macintosh/.test(s) ? 'macOS' : /Linux/.test(s) ? 'Linux' : 'an unknown system';
  return `${browser} on ${os}`;
}

/**
 * Does this request come from a browser this account trusted? Returns the row's
 * id, or null. Requires the account's CURRENT session version and a trust made
 * after the current authenticator was set up.
 */
async function check(req, user) {
  const token = readCookie(req, cookieName(user.id));
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const [[row]] = await pool.query(
    `SELECT d.id FROM trusted_devices d JOIN users u ON u.id = d.user_id
      WHERE d.token_hash = ? AND d.user_id = ? AND d.revoked_at IS NULL AND d.expires_at > NOW()
        AND d.token_version = COALESCE(u.token_version, 0)
        AND (u.mfa_enrolled_at IS NULL OR d.created_at >= u.mfa_enrolled_at)
      LIMIT 1`, [sha256(token), user.id]);
  if (!row) return null;
  await pool.query('UPDATE trusted_devices SET last_used_at = NOW() WHERE id = ?', [row.id]);
  return row.id;
}

/** Trust this browser for the account, after a successful two-step sign-in. */
async function trust(req, res, user) {
  const token = crypto.randomBytes(32).toString('base64url');
  const days = daysFor(user.role);
  // Tidy first: this account's expired or revoked rows, then keep at most ten.
  await pool.query('DELETE FROM trusted_devices WHERE user_id = ? AND (expires_at <= NOW() OR revoked_at IS NOT NULL)', [user.id]);
  const [[{ n }]] = await pool.query('SELECT COUNT(*) n FROM trusted_devices WHERE user_id = ?', [user.id]);
  if (Number(n) >= MAX_PER_ACCOUNT) {
    await pool.query(`DELETE FROM trusted_devices WHERE user_id = ? ORDER BY COALESCE(last_used_at, created_at) ASC LIMIT ?`,
      [user.id, Number(n) - MAX_PER_ACCOUNT + 1]);
  }
  await pool.query(
    `INSERT INTO trusted_devices (user_id, token_hash, token_version, label, expires_at, last_used_at)
     VALUES (?, ?, ?, ?, NOW() + INTERVAL ? DAY, NOW())`,
    [user.id, sha256(token), Number(user.token_version || 0), label(req.headers['user-agent']), days]);
  setCookie(res, req, cookieName(user.id), token, days * 86400);
  return { days };
}

/** This account's trusted browsers, newest first; `current` marks the one asking. */
async function list(req, userId) {
  const token = readCookie(req, cookieName(userId));
  const mine = token ? sha256(token) : null;
  const [rows] = await pool.query(
    `SELECT d.id, d.label, d.created_at, d.last_used_at, d.expires_at, d.token_hash
       FROM trusted_devices d JOIN users u ON u.id = d.user_id
      WHERE d.user_id = ? AND d.revoked_at IS NULL AND d.expires_at > NOW()
        AND d.token_version = COALESCE(u.token_version, 0)
        AND (u.mfa_enrolled_at IS NULL OR d.created_at >= u.mfa_enrolled_at)
      ORDER BY COALESCE(d.last_used_at, d.created_at) DESC`, [userId]);
  return rows.map(r => ({ id: r.id, label: r.label, created_at: r.created_at, last_used_at: r.last_used_at,
    expires_at: r.expires_at, current: !!mine && r.token_hash === mine }));
}

/** Forget one (id) or every trusted browser of the account. Clears this browser's cookie too. */
async function forget(req, res, userId, id = null) {
  const [r] = id == null
    ? await pool.query('UPDATE trusted_devices SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL', [userId])
    : await pool.query('UPDATE trusted_devices SET revoked_at = NOW() WHERE user_id = ? AND id = ? AND revoked_at IS NULL', [userId, id]);
  const token = readCookie(req, cookieName(userId));
  if (token && (id == null || (await pool.query('SELECT 1 FROM trusted_devices WHERE id = ? AND token_hash = ?', [id, sha256(token)]))[0].length)) {
    setCookie(res, req, cookieName(userId), '', 0);
  }
  return r.affectedRows;
}

module.exports = { check, trust, list, forget, label, daysFor, cookieName, sha256, DAYS };
