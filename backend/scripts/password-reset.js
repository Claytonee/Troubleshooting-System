/**
 * Break-glass: give one account a new temporary password (SEC-016, DECISIONS.md D29).
 *
 * For the case the web cannot handle: the platform admin's own account still
 * has a published password, so sign-in refuses it, and there is nobody above
 * them to press "Reset". It runs only where the database is reachable — the
 * hosting panel's terminal — so a stranger on the internet can never use it.
 *
 *   cd backend && node scripts/password-reset.js <username> --prompt --yes
 *
 * `--prompt` asks twice through a masked terminal prompt, so the password does
 * not appear in shell history or process listings. Without it, the command
 * generates a random temporary password and prints it once. Both paths make the
 * person choose their own password at next sign-in, end every session, and write
 * an audit entry.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const readline = require('readline');
const pool = require('../src/config/database');
const passwords = require('../src/services/passwords');

/** Read one secret without echoing it. Deliberately no `--password value` option:
 * command-line arguments are visible in shell history and process listings. */
function readHidden(label) {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    if (!input.isTTY || !process.stdout.isTTY || typeof input.setRawMode !== 'function') {
      reject(new Error('A real terminal is required for --prompt. Run this directly in the cPanel terminal.'));
      return;
    }

    let value = '';
    const wasRaw = !!input.isRaw;
    const finish = (error) => {
      input.removeListener('keypress', onKey);
      if (!wasRaw) input.setRawMode(false);
      input.pause();
      process.stdout.write('\n');
      if (error) reject(error); else resolve(value);
    };
    const onKey = (str, key = {}) => {
      if (key.ctrl && key.name === 'c') return finish(new Error('Cancelled.'));
      if (key.name === 'return' || key.name === 'enter') return finish();
      if (key.name === 'backspace' || key.name === 'delete') { value = value.slice(0, -1); return; }
      if (!key.ctrl && !key.meta && str) value += str;
    };

    process.stdout.write(label);
    readline.emitKeypressEvents(input);
    input.setRawMode(true);
    input.resume();
    input.on('keypress', onKey);
  });
}

async function promptedPassword() {
  const first = await readHidden('New temporary password (input hidden): ');
  const why = passwords.problem(first);
  if (why) throw new Error(why);
  const second = await readHidden('Confirm temporary password (input hidden): ');
  if (first !== second) throw new Error('The passwords do not match. Nothing was changed.');
  return first;
}

(async () => {
  const args = process.argv.slice(2);
  const positionals = args.filter(arg => !arg.startsWith('--'));
  const username = positionals[0];
  const prompt = args.includes('--prompt');
  const flags = args.filter(arg => arg.startsWith('--'));
  if (positionals.length !== 1 || !flags.includes('--yes') || flags.some(flag => !['--yes', '--prompt'].includes(flag))) {
    console.log('usage: node scripts/password-reset.js <username> [--prompt] --yes');
    console.log('  --prompt  enter and confirm a password without showing it');
    console.log('  otherwise a secure temporary password is generated and shown once');
    process.exitCode = 2;
    return pool.end();
  }
  const [[u]] = await pool.query('SELECT id, username, full_name, role FROM users WHERE username = ?', [username]);
  if (!u) { console.log(`No account "${username}".`); process.exitCode = 1; return pool.end(); }

  const temp = prompt ? await promptedPassword() : passwords.temporary();
  await pool.query(
    'UPDATE users SET password_hash = ?, must_change_password = 1, token_version = token_version + 1 WHERE id = ?',
    [await bcrypt.hash(temp, 12), u.id]);
  await pool.query(
    `INSERT INTO audit_log (actor_id, actor_name, actor_role, action, entity_type, entity_id, summary, meta, ip)
     VALUES (NULL, 'Break-glass (server console)', NULL, 'auth.password_reset_break_glass', 'user', ?, ?, ?, NULL)`,
    [String(u.id), `Password reset for ${u.username} from the server console`,
      JSON.stringify({ os_user: require('os').userInfo().username, host: require('os').hostname(), method: prompt ? 'masked_prompt' : 'generated' })]);
  if (prompt) {
    console.log(`Password reset for ${u.username} (${u.full_name}, ${u.role}).`);
  } else {
    console.log(`New temporary password for ${u.username} (${u.full_name}, ${u.role}):\n\n    ${temp}\n`);
    console.log('It is shown only here.');
  }
  console.log('They must choose their own password at the next sign-in; every session has ended.');
  console.log('Recorded in the audit trail as auth.password_reset_break_glass.');
  await pool.end();
})().catch(async e => { console.error('password-reset failed:', e.message); try { await pool.end(); } catch (x) {} process.exitCode = 1; });
