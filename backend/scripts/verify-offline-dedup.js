/**
 * Server-side half of the offline check (docs/features/02-offline-pwa.md):
 * that replaying a queued report twice files it once.
 *
 *   cd backend && node scripts/verify-offline-dedup.js
 *
 * Needs the server running on localhost:3100. It WRITES TO THE DATABASE: it
 * files one report, replays it, then deletes what it created. Do not point it
 * at production.
 */
require('dotenv').config({ path: '.env' });
const pool = require('../src/config/database');
const BASE = 'http://localhost:3100';

let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  if (ok) pass++; else fail++;
  console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? '  -> ' + detail : ''));
};

(async () => {
  const [cols] = await pool.query(
    "SELECT COLUMN_NAME c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='errors' AND COLUMN_NAME='client_ref'");
  const [idx] = await pool.query(
    "SELECT INDEX_NAME i FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='errors' AND INDEX_NAME='uq_errors_client_ref'");
  check('schema: errors.client_ref exists', cols.length === 1);
  check('schema: unique index on client_ref', idx.length >= 1);

  const login = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  }).then(r => r.json());
  if (!login.token) { console.error('  login failed:', JSON.stringify(login)); process.exit(1); }
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.token };

  const [[school]] = await pool.query('SELECT id, name FROM schools ORDER BY id LIMIT 1');
  const ref = 'verify-' + Date.now();
  const payload = {
    client_ref: ref,
    title: 'Offline replay check',
    description: 'Filed by scripts/verify-offline-dedup.js. Safe to delete.',
    school_id: school.id,
    category: 'Connectivity',
    priority: 'low'
  };

  const first = await fetch(BASE + '/api/errors', { method: 'POST', headers: H, body: JSON.stringify(payload) })
    .then(async r => ({ status: r.status, body: await r.json() }));
  check('first submission creates the report', first.status === 201 || first.status === 200,
    first.body.error_code + ' (HTTP ' + first.status + ')');

  const replay = await fetch(BASE + '/api/errors', { method: 'POST', headers: H, body: JSON.stringify(payload) })
    .then(async r => ({ status: r.status, body: await r.json() }));
  check('replay returns the same report, not a new one',
    replay.body.error_code === first.body.error_code && replay.body.deduplicated === true,
    replay.body.error_code + ' deduplicated=' + replay.body.deduplicated);

  const [[cnt]] = await pool.query('SELECT COUNT(*) n FROM errors WHERE client_ref = ?', [ref]);
  check('exactly one row exists for that client_ref', Number(cnt.n) === 1, 'count=' + cnt.n);

  const [[stored]] = await pool.query('SELECT client_ref, title FROM errors WHERE error_code = ?', [first.body.error_code]);
  check('client_ref is persisted on the row', stored && stored.client_ref === ref);

  // A report without a client_ref (an online submission) must still work.
  const plain = await fetch(BASE + '/api/errors', {
    method: 'POST', headers: H,
    body: JSON.stringify({ ...payload, client_ref: undefined, title: 'Offline replay check (no ref)' })
  }).then(async r => ({ status: r.status, body: await r.json() }));
  check('a submission with no client_ref still files',
    !!plain.body.error_code && plain.body.deduplicated === undefined, plain.body.error_code);

  console.log('\n  cleanup:');
  const [d1] = await pool.query('DELETE FROM errors WHERE client_ref = ?', [ref]);
  const [d2] = await pool.query("DELETE FROM errors WHERE title LIKE 'Offline replay check%'");
  await pool.query("DELETE FROM audit_log WHERE summary LIKE '%Offline replay check%'");
  console.log('    removed ' + (d1.affectedRows + d2.affectedRows) + ' row(s)');
  const [[left]] = await pool.query("SELECT COUNT(*) n FROM errors WHERE client_ref IS NOT NULL OR title LIKE 'Offline replay check%'");
  console.log('    rows left with a client_ref or that title: ' + left.n);

  console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
  await pool.end();
  // Set the code and let Node wind down on its own. Calling process.exit() the
  // instant after pool.end() aborted libuv on Windows —
  // `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` — and the shell
  // saw 127 from a run where all seven assertions had passed.
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
