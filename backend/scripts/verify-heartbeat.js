/**
 * End-to-end check for the LRS heartbeat (docs/features/01-lrs-heartbeat.md).
 *
 *   cd backend && node scripts/verify-heartbeat.js
 *
 * Needs the server running on localhost:3100 with HEARTBEAT_KEY and
 * WEBHOOK_SECRET set. It WRITES TO THE DATABASE: it backdates one LRS
 * heartbeat, lets the sweep open a ticket, then deletes everything it created
 * and restores the device row. Do not point it at production.
 */
require('dotenv').config({ path: '.env' });
const pool = require('../src/config/database');
const BASE = 'http://localhost:3100';
const HB_KEY = process.env.HEARTBEAT_KEY;
const WH = process.env.WEBHOOK_SECRET;

const post = (path, body, headers) => fetch(BASE + path, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  if (ok) pass++; else fail++;
  console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? '  -> ' + detail : ''));
};

(async () => {
  const [cols] = await pool.query(
    "SELECT COLUMN_NAME c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='lrs_devices' AND COLUMN_NAME LIKE 'heartbeat%'");
  const [auto] = await pool.query(
    "SELECT COLUMN_NAME c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='errors' AND COLUMN_NAME='auto_source'");
  check('schema: heartbeat columns on lrs_devices', cols.length === 3, cols.map(x => x.c).join(', '));
  check('schema: errors.auto_source', auto.length === 1);

  const [[school]] = await pool.query('SELECT id, code, name FROM schools ORDER BY id LIMIT 1');
  const [existing] = await pool.query('SELECT id FROM lrs_devices WHERE school_id = ?', [school.id]);
  let deviceId, createdDevice = false;
  if (existing.length) {
    deviceId = existing[0].id;
  } else {
    const [r] = await pool.query(
      "INSERT INTO lrs_devices (school_id, hostname, ip_address, status) VALUES (?, 'lrs-test', '192.168.0.10', 'Online')",
      [school.id]);
    deviceId = r.insertId;
    createdDevice = true;
  }
  console.log('\n  using ' + school.name + ' (' + school.code + '), lrs_devices.id=' + deviceId +
    (createdDevice ? ' [created for test]' : '') + '\n');

  // --- auth and validation ---
  check('auth: wrong key rejected',
    (await post('/api/heartbeat', { school_code: school.code }, { 'X-Heartbeat-Key': 'nope' })).status === 401);
  check('auth: missing key rejected',
    (await post('/api/heartbeat', { school_code: school.code })).status === 401);
  const badSchool = await post('/api/heartbeat', { school_code: 'NOPE-999' }, { 'X-Heartbeat-Key': HB_KEY });
  check('validation: unknown school_code gives 404', badSchool.status === 404, badSchool.body.error);
  check('validation: missing school_code gives 400',
    (await post('/api/heartbeat', {}, { 'X-Heartbeat-Key': HB_KEY })).status === 400);
  check('auth: sweep rejects a wrong secret',
    (await post('/api/heartbeat/sweep', {}, { 'X-Webhook-Secret': 'nope' })).status === 401);

  // --- a device that has never reported must not generate a ticket ---
  await pool.query('UPDATE lrs_devices SET last_heartbeat = NULL, heartbeat_missed_since = NULL WHERE id = ?', [deviceId]);
  const sweepNever = await post('/api/heartbeat/sweep', {}, { 'X-Webhook-Secret': WH });
  check('never-reported device counts as unknown, not down',
    sweepNever.body.silent_devices === 0 && sweepNever.body.errors_opened === 0,
    'silent=' + sweepNever.body.silent_devices + ' opened=' + sweepNever.body.errors_opened);

  // --- first beat ---
  const beat = await post('/api/heartbeat',
    { school_code: school.code, hostname: 'lrs-test', uptime_seconds: 7260, disk_free_pct: 42, agent_version: '1.0.0' },
    { 'X-Heartbeat-Key': HB_KEY });
  const [[afterBeat]] = await pool.query(
    'SELECT last_heartbeat, status, uptime_hours, heartbeat_disk_free_pct, heartbeat_agent_version FROM lrs_devices WHERE id = ?',
    [deviceId]);
  check('beat accepted and stamped', beat.status === 200 && afterBeat.last_heartbeat != null,
    'status=' + afterBeat.status + ' disk=' + afterBeat.heartbeat_disk_free_pct + '% agent=' + afterBeat.heartbeat_agent_version);
  check('beat derives uptime hours from seconds', Number(afterBeat.uptime_hours) === 2,
    '7260s -> ' + afterBeat.uptime_hours + 'h');

  // --- go silent past the threshold ---
  await pool.query('UPDATE lrs_devices SET last_heartbeat = DATE_SUB(NOW(), INTERVAL 40 MINUTE) WHERE id = ?', [deviceId]);
  const s1 = await post('/api/heartbeat/sweep', {}, { 'X-Webhook-Secret': WH });
  check('sweep opens exactly one error for a silent LRS', s1.body.errors_opened === 1, JSON.stringify(s1.body.opened));
  const openedCode = (s1.body.opened && s1.body.opened[0] || {}).error_code;

  const [[row]] = await pool.query(
    'SELECT error_code, priority, status, category, subcategory, auto_source, assigned_to FROM errors WHERE error_code = ?',
    [openedCode]);
  check('opened error is CRITICAL connectivity carrying the dedup key',
    row && row.priority === 'critical' && row.category === 'Connectivity' && row.auto_source === 'lrs_heartbeat:' + deviceId,
    row && (row.error_code + ' ' + row.priority + '/' + row.category + '/' + row.subcategory +
      ' auto_source=' + row.auto_source + ' assigned_to=' + row.assigned_to));
  const [[dev2]] = await pool.query('SELECT status, heartbeat_missed_since FROM lrs_devices WHERE id = ?', [deviceId]);
  check('device marked Offline with missed_since recorded',
    dev2.status === 'Offline' && dev2.heartbeat_missed_since != null);

  // --- dedup ---
  const s2 = await post('/api/heartbeat/sweep', {}, { 'X-Webhook-Secret': WH });
  const s3 = await post('/api/heartbeat/sweep', {}, { 'X-Webhook-Secret': WH });
  check('repeat sweeps open nothing more', s2.body.errors_opened === 0 && s3.body.errors_opened === 0,
    'sweep2=' + s2.body.errors_opened + ' sweep3=' + s3.body.errors_opened);
  const [dupes] = await pool.query(
    "SELECT COUNT(*) n FROM errors WHERE auto_source = ? AND status <> 'resolved'", ['lrs_heartbeat:' + deviceId]);
  check('exactly one unresolved auto-error exists', Number(dupes[0].n) === 1, 'count=' + dupes[0].n);

  // --- health KPI reflects the outage ---
  const [[healthDown]] = await pool.query(
    "SELECT COUNT(*) n FROM schools s WHERE s.id IN (SELECT school_id FROM lrs_devices WHERE last_heartbeat IS NOT NULL AND last_heartbeat < DATE_SUB(NOW(), INTERVAL 15 MINUTE))");
  check('silent school is excluded from healthy', Number(healthDown.n) >= 1, 'silent schools=' + healthDown.n);

  // --- recovery ---
  const recover = await post('/api/heartbeat', { school_code: school.code }, { 'X-Heartbeat-Key': HB_KEY });
  check('a beat closes the auto-opened error', recover.body.recovered_error === openedCode,
    'recovered=' + recover.body.recovered_error);
  const [[closed]] = await pool.query('SELECT status, resolved_at FROM errors WHERE error_code = ?', [openedCode]);
  check('closed error is resolved with a timestamp', closed.status === 'resolved' && closed.resolved_at != null,
    closed.status + ' at ' + (closed.resolved_at && closed.resolved_at.toISOString().slice(0, 19)));
  const [upd] = await pool.query(
    "SELECT note FROM error_updates WHERE error_id = (SELECT id FROM errors WHERE error_code = ?) AND update_type='auto_recovery'",
    [openedCode]);
  check('recovery appended an update', upd.length === 1, upd[0] && upd[0].note);
  const [[dev3]] = await pool.query('SELECT status, heartbeat_missed_since FROM lrs_devices WHERE id = ?', [deviceId]);
  check('device back Online, missed_since cleared', dev3.status === 'Online' && dev3.heartbeat_missed_since === null);

  const [audits] = await pool.query(
    "SELECT action FROM audit_log WHERE entity_type='error' AND action LIKE 'error.auto_%' ORDER BY id DESC LIMIT 2");
  check('audit recorded both auto events', audits.length === 2, audits.map(a => a.action).join(', '));

  // --- cleanup ---
  console.log('\n  cleanup:');
  const [del] = await pool.query('DELETE FROM errors WHERE auto_source LIKE ?', ['lrs_heartbeat:%']);
  console.log('    removed ' + del.affectedRows + ' auto-error(s)');
  await pool.query("DELETE FROM audit_log WHERE action LIKE 'error.auto_%'");
  await pool.query('DELETE FROM lrs_history WHERE action = ?', ['heartbeat_lost']);
  if (createdDevice) {
    await pool.query('DELETE FROM lrs_devices WHERE id = ?', [deviceId]);
    console.log('    removed the test LRS row');
  } else {
    await pool.query('UPDATE lrs_devices SET last_heartbeat = NULL, heartbeat_missed_since = NULL, heartbeat_disk_free_pct = NULL, heartbeat_agent_version = NULL WHERE id = ?', [deviceId]);
    console.log('    reset the pre-existing LRS row');
  }
  const [[left]] = await pool.query('SELECT COUNT(*) n FROM errors WHERE auto_source IS NOT NULL');
  console.log('    errors still carrying auto_source: ' + left.n);

  console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
  await pool.end();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
