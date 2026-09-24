const pool = require('../config/database');
const securityEvents = require('./securityEvents');

/**
 * Session revocation (SEC-005, DECISIONS.md D3).
 *
 * Every token carries the account's `token_version` as `tv`; authenticate()
 * refuses a token whose `tv` is older than the account's. Bumping the version
 * therefore signs the account out everywhere, at once, without a token list.
 *
 * A token issued before this existed has no `tv` and counts as version 0 — the
 * column's default — so rolling this out signed nobody out.
 *
 * Called for every event after which an old session must not survive: a
 * password change or reset, a suspension or removal, and "sign out everywhere".
 * Suspension is already refused per request by status; bumping as well means
 * that REACTIVATING an account does not revive a token stolen before it.
 */
async function revokeSessions(userId, reason, req) {
  const id = Number(userId);
  if (!Number.isInteger(id) || id <= 0) return null;
  await pool.query('UPDATE users SET token_version = token_version + 1 WHERE id = ?', [id]);
  const [[row]] = await pool.query('SELECT token_version FROM users WHERE id = ?', [id]);
  securityEvents.record({
    event_type: 'auth.sessions_revoked',
    source_ip: req ? req.ip : null,
    user_id: id,
    method: req ? req.method : null,
    path_template: req ? securityEvents.pathTemplate(req) : null,
    status: 200,
    detail: { reason, by: req && req.user && req.user.id !== id ? req.user.id : 'self' }
  });
  return row ? row.token_version : null;
}

module.exports = { revokeSessions };
