/**
 * Break-glass: turn two-step sign-in off for one account (DECISIONS.md D4).
 *
 * For a platform admin who has lost their phone AND their recovery codes. It
 * runs only where the database is reachable — the hosting panel's terminal —
 * which is the point: there is no way to do this from the web, so a stolen
 * password can never be turned into a reset.
 *
 *   cd backend && node scripts/mfa-reset.js <username> --yes
 *
 * It ends every session of the account, writes an audit entry, and prints what
 * it did. The person signs in with their password and must enrol again at once
 * if their role requires it. Record the reset in the issue register as an incident.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const pool = require('../src/config/database');

(async () => {
  const [username, flag] = process.argv.slice(2);
  if (!username || flag !== '--yes') {
    console.log('usage: node scripts/mfa-reset.js <username> --yes');
    process.exitCode = 2;
    return pool.end();
  }
  const [[u]] = await pool.query('SELECT id, username, full_name, role, mfa_enabled FROM users WHERE username = ?', [username]);
  if (!u) { console.log(`No account "${username}".`); process.exitCode = 1; return pool.end(); }
  if (!Number(u.mfa_enabled)) { console.log(`${u.username} does not have two-step sign-in on. Nothing changed.`); return pool.end(); }

  await pool.query(
    `UPDATE users SET mfa_enabled = 0, mfa_secret_enc = NULL, mfa_pending_enc = NULL, mfa_last_step = NULL,
            mfa_recovery = NULL, mfa_enrolled_at = NULL, token_version = token_version + 1 WHERE id = ?`, [u.id]);
  await pool.query(
    `INSERT INTO audit_log (actor_id, actor_name, actor_role, action, entity_type, entity_id, summary, meta, ip)
     VALUES (NULL, 'Break-glass (server console)', NULL, 'auth.mfa_reset_break_glass', 'user', ?, ?, ?, NULL)`,
    [String(u.id), `Two-step sign-in reset for ${u.username} from the server console`,
      JSON.stringify({ os_user: require('os').userInfo().username, host: require('os').hostname() })]);
  console.log(`Two-step sign-in is OFF for ${u.username} (${u.full_name}, ${u.role}). Every session has ended.`);
  console.log('Recorded in the audit trail as auth.mfa_reset_break_glass. Log it as an incident (INCIDENT_RESPONSE.md).');
  await pool.end();
})().catch(async e => { console.error('mfa-reset failed:', e.message); try { await pool.end(); } catch (x) {} process.exitCode = 1; });
