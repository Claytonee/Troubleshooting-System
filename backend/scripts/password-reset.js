/**
 * Break-glass: give one account a new temporary password (SEC-016, DECISIONS.md D29).
 *
 * For the case the web cannot handle: the platform admin's own account still
 * has a published password, so sign-in refuses it, and there is nobody above
 * them to press "Reset". It runs only where the database is reachable — the
 * hosting panel's terminal — so a stranger on the internet can never use it.
 *
 *   cd backend && node scripts/password-reset.js <username> --yes
 *
 * Sets a random temporary password (printed once, here), makes the person choose
 * their own at next sign-in, ends every session, and writes an audit entry.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const pool = require('../src/config/database');
const passwords = require('../src/services/passwords');

(async () => {
  const [username, flag] = process.argv.slice(2);
  if (!username || flag !== '--yes') {
    console.log('usage: node scripts/password-reset.js <username> --yes');
    process.exitCode = 2;
    return pool.end();
  }
  const [[u]] = await pool.query('SELECT id, username, full_name, role FROM users WHERE username = ?', [username]);
  if (!u) { console.log(`No account "${username}".`); process.exitCode = 1; return pool.end(); }

  const temp = passwords.temporary();
  await pool.query(
    'UPDATE users SET password_hash = ?, must_change_password = 1, token_version = token_version + 1 WHERE id = ?',
    [await bcrypt.hash(temp, 12), u.id]);
  await pool.query(
    `INSERT INTO audit_log (actor_id, actor_name, actor_role, action, entity_type, entity_id, summary, meta, ip)
     VALUES (NULL, 'Break-glass (server console)', NULL, 'auth.password_reset_break_glass', 'user', ?, ?, ?, NULL)`,
    [String(u.id), `Password reset for ${u.username} from the server console`,
      JSON.stringify({ os_user: require('os').userInfo().username, host: require('os').hostname() })]);
  console.log(`New temporary password for ${u.username} (${u.full_name}, ${u.role}):\n\n    ${temp}\n`);
  console.log('It is shown only here. They must choose their own at the next sign-in; every session has ended.');
  console.log('Recorded in the audit trail as auth.password_reset_break_glass.');
  await pool.end();
})().catch(async e => { console.error('password-reset failed:', e.message); try { await pool.end(); } catch (x) {} process.exitCode = 1; });
