/**
 * Backup restore drill — NIST CSF 2.0 "Recover" (DECISIONS.md D18, RECOVERY.md).
 *
 * A backup is proven by restoring it, not by its existence. This loads a SQL dump
 * into a scratch database, checks that it is complete and consistent, measures how
 * long the restore took (RTO evidence) and how old the newest data is (RPO
 * evidence), and drops the scratch database again.
 *
 *   node scripts/verify-backup-restore.js <dump.sql>   a dump downloaded from cPanel
 *   node scripts/verify-backup-restore.js --self       dump THIS database first (to test the drill)
 *   add --keep to leave the scratch database for inspection
 *
 * Needs the mysql / mysqldump clients: on PATH, in C:\xampp\mysql\bin, or MYSQL_BIN.
 * Refuses to run with NODE_ENV=production — the drill belongs on a workstation,
 * never on the live server. The scratch database is <DB_NAME>_restore_check and the
 * drill refuses any name that is not that.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const mysql = require('mysql2/promise');

const DB_NAME = process.env.DB_NAME || 'qft_support';
const SCRATCH = `${DB_NAME}_restore_check`;
const conn = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || ''
};

// Tables the service cannot run without. A dump missing any of them is not a backup of this system.
const CORE = ['users', 'schools', 'errors', 'error_updates', 'audit_log', 'tablets', 'settings', 'weekly_checkins'];
// Rows that must point at something that exists.
const REFERENCES = [
  ['errors.school_id → schools', 'SELECT COUNT(*) n FROM errors e LEFT JOIN schools s ON s.id = e.school_id WHERE s.id IS NULL'],
  ['users.school_id → schools', 'SELECT COUNT(*) n FROM users u LEFT JOIN schools s ON s.id = u.school_id WHERE u.school_id IS NOT NULL AND s.id IS NULL'],
  ['error_updates.error_id → errors', 'SELECT COUNT(*) n FROM error_updates x LEFT JOIN errors e ON e.id = x.error_id WHERE e.id IS NULL'],
  ['tablets.school_id → schools', 'SELECT COUNT(*) n FROM tablets t LEFT JOIN schools s ON s.id = t.school_id WHERE t.school_id IS NOT NULL AND s.id IS NULL']
];

let passed = 0, failed = 0;
function ok(name, cond, detail) {
  if (cond) { passed++; console.log(`  PASS  ${name}${detail !== undefined ? ' — ' + detail : ''}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail !== undefined ? ' — ' + JSON.stringify(detail) : ''}`); }
}

function findBin(name) {
  const exe = process.platform === 'win32' ? name + '.exe' : name;
  const dirs = [process.env.MYSQL_BIN, 'C:\\xampp\\mysql\\bin', 'C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin'].filter(Boolean);
  for (const d of dirs) if (fs.existsSync(path.join(d, exe))) return path.join(d, exe);
  const probe = spawnSync(exe, ['--version'], { encoding: 'utf8' });
  if (probe.status === 0) return exe;
  throw new Error(`${name} not found — set MYSQL_BIN to the folder that contains it`);
}

// The password travels in MYSQL_PWD, never on the command line where `ps` could show it.
const clientEnv = () => ({ ...process.env, MYSQL_PWD: conn.password });
const clientArgs = () => ['-h', conn.host, '-P', String(conn.port), '-u', conn.user];

(async () => {
  if (process.env.NODE_ENV === 'production') throw new Error('refusing to run with NODE_ENV=production');
  if (SCRATCH !== `${DB_NAME}_restore_check` || !/^[A-Za-z0-9_]+$/.test(SCRATCH)) throw new Error('unsafe scratch name');
  const args = process.argv.slice(2);
  const keep = args.includes('--keep');
  let dump = args.find(a => !a.startsWith('--'));

  if (args.includes('--self')) {
    dump = path.join(require('os').tmpdir(), `${DB_NAME}-drill-${Date.now()}.sql`);
    const t = Date.now();
    const r = spawnSync(findBin('mysqldump'), [...clientArgs(), '--single-transaction', '--routines', '--result-file=' + dump, DB_NAME],
      { env: clientEnv(), encoding: 'utf8' });
    if (r.status !== 0) throw new Error('mysqldump failed: ' + (r.stderr || '').slice(0, 300));
    console.log(`Dumped ${DB_NAME} in ${((Date.now() - t) / 1000).toFixed(1)} s → ${dump}`);
  }
  if (!dump || !fs.existsSync(dump)) throw new Error('usage: verify-backup-restore.js <dump.sql> | --self [--keep]');
  const size = fs.statSync(dump).size;
  console.log(`\nRestore drill: ${path.basename(dump)} (${(size / 1048576).toFixed(2)} MB) → scratch database ${SCRATCH}\n`);

  const admin = await mysql.createConnection(conn);
  await admin.query(`DROP DATABASE IF EXISTS \`${SCRATCH}\``);
  await admin.query(`CREATE DATABASE \`${SCRATCH}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);

  const t0 = Date.now();
  const r = spawnSync(findBin('mysql'), [...clientArgs(), SCRATCH], {
    env: clientEnv(), input: fs.readFileSync(dump), maxBuffer: 1 << 30, encoding: 'utf8'
  });
  const restoreSec = (Date.now() - t0) / 1000;
  ok('the dump restores without errors', r.status === 0, r.status === 0 ? `${restoreSec.toFixed(1)} s` : (r.stderr || '').slice(0, 300));

  const db = await mysql.createConnection({ ...conn, database: SCRATCH });
  try {
    const [tables] = await db.query('SHOW TABLES');
    const names = tables.map(t => Object.values(t)[0]);
    const missing = CORE.filter(t => !names.includes(t));
    ok(`all ${CORE.length} core tables are present`, !missing.length, missing.length ? missing : `${names.length} tables in total`);

    if (!missing.length) {
      const [[u]] = await db.query("SELECT COUNT(*) n, SUM(role = 'admin' AND status = 'active') admins FROM users");
      ok('accounts are present, including an active platform admin', u.n > 0 && Number(u.admins) > 0, `${u.n} users, ${u.admins} active admin(s)`);
      const [[s]] = await db.query('SELECT COUNT(*) n FROM schools');
      ok('schools are present', s.n > 0, `${s.n} schools`);
      for (const [name, sql] of REFERENCES) {
        const [[x]] = await db.query(sql);
        ok(`no orphans: ${name}`, Number(x.n) === 0, Number(x.n) ? `${x.n} orphaned rows` : undefined);
      }
      const [[h]] = await db.query('SELECT COUNT(*) n FROM users WHERE password_hash IS NULL OR password_hash NOT LIKE "$2%"');
      ok('every password is still a bcrypt hash', Number(h.n) === 0, Number(h.n) ? `${h.n} not bcrypt` : undefined);

      // RPO evidence: the newest activity in the backup. Everything after it would be lost.
      // Aged by the database's own clock: DATETIME is stored in server-local time,
      // and mixing it with the Node clock was off by the timezone (3 h here).
      const [[fresh]] = await db.query(`SELECT DATE_FORMAT(x.newest, '%Y-%m-%d %H:%i') AS newest,
          TIMESTAMPDIFF(MINUTE, x.newest, NOW()) AS age_min
        FROM (SELECT GREATEST(
          COALESCE((SELECT MAX(created_at) FROM errors), '1970-01-01'),
          COALESCE((SELECT MAX(created_at) FROM error_updates), '1970-01-01'),
          COALESCE((SELECT MAX(created_at) FROM audit_log), '1970-01-01')) AS newest) x`);
      console.log(`\n  Newest activity in the backup: ${fresh.newest} server time (${(fresh.age_min / 60).toFixed(1)} h ago)`);
      console.log(`  Restore time: ${restoreSec.toFixed(1)} s for ${(size / 1048576).toFixed(2)} MB`);
      console.log('  Targets (RECOVERY.md): RPO 24 h — data at most a day old; RTO 4 h — service back within four hours.');
      console.log('  Freshness is measured against the newest activity, so on a quiet week it overstates the age.');
    }
  } finally {
    await db.end();
    if (!keep) await admin.query(`DROP DATABASE IF EXISTS \`${SCRATCH}\``);
    await admin.end();
    if (args.includes('--self')) fs.unlinkSync(dump);
    console.log(`\n${'='.repeat(52)}\n  ${passed} passed, ${failed} failed${keep ? `\n  scratch database ${SCRATCH} kept` : '\n  scratch database dropped'}`);
    process.exitCode = failed ? 1 : 0;
  }
})().catch(e => { console.error('\nDRILL ERROR:', e.message); process.exitCode = 1; });
