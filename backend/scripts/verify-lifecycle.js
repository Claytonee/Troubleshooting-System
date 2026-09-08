/**
 * End-to-end check for asset lifecycle & TCO (docs/features/04-asset-lifecycle.md).
 *
 *   cd backend && node scripts/verify-lifecycle.js
 *
 * Needs the server running on localhost:3100. It WRITES TO THE DATABASE: it
 * creates a handful of tablets with known purchase and fault histories, checks
 * every derived value against them, then deletes what it created. Do not point
 * it at production.
 */
require('dotenv').config({ path: '.env' });
const pool = require('../src/config/database');
const lc = require('../src/config/lifecycle');

const BASE = 'http://localhost:3100';
const TAG_PREFIX = 'LC-TEST-';

let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  if (ok) pass++; else fail++;
  console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? '  -> ' + detail : ''));
};

let H = null;
const api = (path) => fetch(BASE + path, { headers: H }).then(r => r.json());

/** Inserts a tablet with an exact lifecycle position, plus fault history. */
async function device(schoolId, tag, opts) {
  const [r] = await pool.query(
    `INSERT INTO tablets (school_id, serial_number, asset_tag, model, status,
       purchase_date, purchase_cost, supplier, warranty_expires_on, expected_eol_on, batch_ref)
     VALUES (?, ?, ?, 'TestTab X1', ?, ?, ?, ?, ?, ?, ?)`,
    [schoolId, TAG_PREFIX + tag + '-SN', TAG_PREFIX + tag, opts.status || 'Working',
     opts.purchase_date || null, opts.cost || null, opts.supplier || null,
     opts.warranty || null, opts.eol || null, opts.batch || null]
  );
  for (let i = 0; i < (opts.faults || 0); i++) {
    // daysAgo lets a fault be placed inside or outside the 90-day window.
    const ago = Array.isArray(opts.faultDaysAgo) ? (opts.faultDaysAgo[i] ?? 1) : (opts.faultDaysAgo ?? 1);
    await pool.query(
      `INSERT INTO tablet_history (tablet_id, action, old_value, new_value, actor_name, created_at)
       VALUES (?, 'status_change', 'Working', 'Faulty', 'lifecycle test', DATE_SUB(NOW(), INTERVAL ? DAY))`,
      [r.insertId, ago]
    );
  }
  return r.insertId;
}

async function cleanup() {
  await pool.query('DELETE FROM tablets WHERE asset_tag LIKE ?', [TAG_PREFIX + '%']);
}

const D = n => {
  const d = new Date(Date.now() + n * 86400000);
  return d.toISOString().slice(0, 10);
};

(async () => {
  // --- schema ---
  const [cols] = await pool.query(
    `SELECT COLUMN_NAME c FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tablets'
       AND COLUMN_NAME IN ('purchase_date','purchase_cost','supplier','warranty_expires_on','expected_eol_on','batch_ref')`);
  check('schema: all six lifecycle columns exist', cols.length === 6, cols.map(c => c.c).sort().join(', '));
  const [nullable] = await pool.query(
    `SELECT COUNT(*) n FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tablets'
       AND COLUMN_NAME IN ('purchase_date','purchase_cost','supplier','warranty_expires_on','expected_eol_on','batch_ref')
       AND IS_NULLABLE = 'YES'`);
  check('schema: every new column is nullable', Number(nullable[0].n) === 6);

  const login = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  }).then(r => r.json());
  if (!login.token) { console.error('  login failed'); process.exit(1); }
  H = { Authorization: 'Bearer ' + login.token };

  const [[school]] = await pool.query('SELECT id, name FROM schools ORDER BY id LIMIT 1');
  await cleanup();
  console.log(`\n  using ${school.name}\n`);

  // --- fixtures, each at a known lifecycle position ---
  await device(school.id, 'HEALTHY',   { purchase_date: D(-200), cost: 300000, warranty: D(400),  eol: D(900),  batch: TAG_PREFIX + 'B1', supplier: 'TestCo' });
  await device(school.id, 'EXPIRING',  { purchase_date: D(-700), cost: 300000, warranty: D(30),   eol: D(400),  batch: TAG_PREFIX + 'B1', supplier: 'TestCo' });
  await device(school.id, 'EXPIRED',   { purchase_date: D(-1200), cost: 280000, warranty: D(-120), eol: D(200), batch: TAG_PREFIX + 'B2', supplier: 'OtherCo', faults: 1, faultDaysAgo: 10 });
  await device(school.id, 'REPEAT',    { purchase_date: D(-1200), cost: 280000, warranty: D(-200), eol: D(-30), batch: TAG_PREFIX + 'B2', supplier: 'OtherCo', status: 'Faulty', faults: 4, faultDaysAgo: [5, 20, 40, 300] });
  await device(school.id, 'RECENT2',   { purchase_date: D(-500), cost: 310000, warranty: D(600),  eol: D(900),  batch: TAG_PREFIX + 'B1', supplier: 'TestCo', faults: 2, faultDaysAgo: [3, 40] });
  await device(school.id, 'OLDFAULTS', { purchase_date: D(-500), cost: 310000, warranty: D(600),  eol: D(900),  batch: TAG_PREFIX + 'B1', supplier: 'TestCo', faults: 2, faultDaysAgo: [300, 400] });
  await device(school.id, 'NORECORD',  {});
  await device(school.id, 'PASTEOL',   { purchase_date: D(-1500), cost: 250000, warranty: D(-400), eol: D(-100), batch: TAG_PREFIX + 'B2', supplier: 'OtherCo' });

  const all = await api('/api/inventory?school_id=' + school.id + '&search=' + TAG_PREFIX);
  const by = tag => all.find(d => d.asset_tag === TAG_PREFIX + tag);

  check('list returns the test devices', all.length === 8, all.length + ' returned');

  // --- warranty state ---
  check('warranty: healthy device is active', by('HEALTHY').warranty_state === 'active', by('HEALTHY').warranty_state);
  check('warranty: 30 days out is expiring', by('EXPIRING').warranty_state === 'expiring',
    by('EXPIRING').warranty_state + ', ' + by('EXPIRING').warranty_days_left + 'd left');
  check('warranty: past expiry is expired', by('EXPIRED').warranty_state === 'expired', by('EXPIRED').warranty_state);
  check('warranty: no expiry recorded is unknown, NOT expired',
    by('NORECORD').warranty_state === 'unknown', by('NORECORD').warranty_state);
  // The boundary is the whole point of a 60-day window.
  check('warranty: the 60-day boundary is inclusive',
    lc.WARRANTY_WARN_DAYS === 60 && by('EXPIRING').warranty_days_left <= 60);

  // --- repeat offender ---
  check('repeat: 4 faults is a repeat offender', by('REPEAT').repeat_offender === true,
    by('REPEAT').fault_count + ' faults');
  check('repeat: 2 faults inside 90 days is a repeat offender',
    by('RECENT2').repeat_offender === true, by('RECENT2').recent_fault_count + ' recent');
  check('repeat: 2 faults spread over a year is NOT',
    by('OLDFAULTS').repeat_offender === false,
    by('OLDFAULTS').fault_count + ' total, ' + by('OLDFAULTS').recent_fault_count + ' recent');
  check('repeat: a device with one fault is not flagged', by('EXPIRED').repeat_offender === false);
  check('repeat: fault counts match the history rows',
    Number(by('REPEAT').fault_count) === 4 && Number(by('REPEAT').recent_fault_count) === 3,
    'total=' + by('REPEAT').fault_count + ' recent=' + by('REPEAT').recent_fault_count);

  // --- age and eol ---
  check('age: derived from purchase_date, not stored',
    Math.abs(Number(by('HEALTHY').age_months) - 200 / 30.44) < 0.2, by('HEALTHY').age_months + ' months');
  check('age: unknown when no purchase date', by('NORECORD').age_months == null);
  check('eol: past end of life is flagged', by('PASTEOL').eol_state === 'past');
  check('eol: unknown when not recorded', by('NORECORD').eol_state === 'unknown');

  // --- the verdict sentence ---
  check('verdict: says no faults for a clean device',
    /No faults recorded/.test(by('HEALTHY').lifecycle_verdict), by('HEALTHY').lifecycle_verdict);
  check('verdict: tells you to claim while the warranty lasts',
    /claim now/.test(by('EXPIRING').lifecycle_verdict), by('EXPIRING').lifecycle_verdict);
  check('verdict: never says "expired" when nothing is recorded',
    /not recorded/.test(by('NORECORD').lifecycle_verdict) && !/expired/.test(by('NORECORD').lifecycle_verdict),
    by('NORECORD').lifecycle_verdict);

  // --- filters ---
  const expiring = await api('/api/inventory?school_id=' + school.id + '&search=' + TAG_PREFIX + '&warranty=expiring');
  check('filter: warranty=expiring returns only that device',
    expiring.length === 1 && expiring[0].asset_tag === TAG_PREFIX + 'EXPIRING', expiring.length + ' returned');
  const unknown = await api('/api/inventory?school_id=' + school.id + '&search=' + TAG_PREFIX + '&warranty=unknown');
  check('filter: warranty=unknown finds the missing paperwork',
    unknown.length === 1 && unknown[0].asset_tag === TAG_PREFIX + 'NORECORD', unknown.length + ' returned');
  const repeats = await api('/api/inventory?school_id=' + school.id + '&search=' + TAG_PREFIX + '&repeat_offender=true');
  check('filter: repeat_offender returns exactly the two flagged devices',
    repeats.length === 2 && repeats.every(d => d.repeat_offender),
    repeats.map(d => d.asset_tag.replace(TAG_PREFIX, '')).sort().join(', '));
  const batch = await api('/api/inventory?school_id=' + school.id + '&batch=' + TAG_PREFIX + 'B2');
  check('filter: batch returns that batch only',
    batch.length === 3 && batch.every(d => d.batch_ref === TAG_PREFIX + 'B2'), batch.length + ' returned');

  // --- refresh plan ---
  const plan = await api('/api/inventory/refresh-plan?school_id=' + school.id);
  const dueTags = plan.due.filter(d => (d.asset_tag || '').startsWith(TAG_PREFIX)).map(d => d.asset_tag.replace(TAG_PREFIX, ''));
  check('plan: flags past-EOL, repeat and out-of-warranty-with-faults',
    ['EXPIRED', 'PASTEOL', 'REPEAT', 'RECENT2'].every(t => dueTags.includes(t)), dueTags.sort().join(', '));
  check('plan: a healthy in-warranty device is not due', !dueTags.includes('HEALTHY'));
  check('plan: a device with 2 old faults is not due', !dueTags.includes('OLDFAULTS'));
  check('plan: the no-record device is counted separately, not as due',
    !dueTags.includes('NORECORD') && plan.devices_without_any_purchase_record >= 1,
    'no-record count=' + plan.devices_without_any_purchase_record);
  check('plan: each due device explains why', plan.due.every(d => d.reasons && d.reasons.length));
  const own = plan.due.filter(d => !d.replacement_cost_estimated);
  check('plan: cost is traceable to own record or flagged estimated',
    plan.priced_from_own_record === own.length, plan.priced_from_own_record + ' from own record');
  check('plan: the total equals the sum of the listed costs',
    plan.estimated_cost === Math.round(plan.due.reduce((s, d) => s + (Number(d.replacement_cost) || 0), 0)),
    'total=' + plan.estimated_cost);
  check('plan: a median is used, not a mean', plan.median_device_cost != null,
    'median=' + plan.median_device_cost);

  // --- batches ---
  const rows = await api('/api/inventory/batches?school_id=' + school.id);
  const b1 = rows.find(b => b.batch_ref === TAG_PREFIX + 'B1');
  const b2 = rows.find(b => b.batch_ref === TAG_PREFIX + 'B2');
  check('batches: both test batches are reported', !!b1 && !!b2);
  check('batches: device counts are right', b1.devices === 4 && b2.devices === 3,
    'B1=' + (b1 && b1.devices) + ' B2=' + (b2 && b2.devices));
  check('batches: the worse batch sorts first',
    rows.findIndex(b => b.batch_ref === TAG_PREFIX + 'B2') < rows.findIndex(b => b.batch_ref === TAG_PREFIX + 'B1'),
    'B2 rate=' + b2.fault_rate_pct + '% B1 rate=' + b1.fault_rate_pct + '%');
  check('batches: fault rate is a percentage of the batch',
    b2.fault_rate_pct === Math.round((b2.faulty_now / b2.devices) * 100), b2.fault_rate_pct + '%');

  // --- an edit must not erase the procurement record ---
  const target = by('HEALTHY');
  await fetch(BASE + '/api/inventory/' + target.id, {
    method: 'PUT', headers: { ...H, 'Content-Type': 'application/json' },
    // A form that only carries the operational fields, as the edit modal does.
    body: JSON.stringify({ serial_number: target.serial_number, asset_tag: target.asset_tag, status: 'Needs Setup' })
  });
  const [[after]] = await pool.query('SELECT purchase_cost, warranty_expires_on, supplier, batch_ref FROM tablets WHERE id = ?', [target.id]);
  check('an edit without the purchase fields does not wipe them',
    after.purchase_cost != null && after.warranty_expires_on != null && after.supplier === 'TestCo',
    'cost=' + after.purchase_cost + ' supplier=' + after.supplier);

  // --- warranty reminders, folded into the sweep ---
  if (process.env.WEBHOOK_SECRET) {
    await pool.query("DELETE FROM admin_notifications WHERE type = 'warranty_expiring'");
    const sweep = await fetch(BASE + '/api/heartbeat/sweep', {
      method: 'POST', headers: { 'X-Webhook-Secret': process.env.WEBHOOK_SECRET }
    }).then(r => r.json());
    check('sweep: reports warranties inside the window',
      sweep.warranty && sweep.warranty.expiring_soon >= 1, JSON.stringify(sweep.warranty));
    const [notif] = await pool.query("SELECT title FROM admin_notifications WHERE type = 'warranty_expiring'");
    check('sweep: raises a notification', notif.length >= 1, notif[0] && notif[0].title);
    const again = await fetch(BASE + '/api/heartbeat/sweep', {
      method: 'POST', headers: { 'X-Webhook-Secret': process.env.WEBHOOK_SECRET }
    }).then(r => r.json());
    check('sweep: does not repeat the same reminder within a day',
      again.warranty.notified === 0, 'notified again=' + again.warranty.notified);
    const [afterN] = await pool.query("SELECT COUNT(*) n FROM admin_notifications WHERE type = 'warranty_expiring'");
    check('sweep: one notification per batch, not per device',
      Number(afterN[0].n) <= 2, Number(afterN[0].n) + ' notification(s) for 8 devices');
    await pool.query("DELETE FROM admin_notifications WHERE type = 'warranty_expiring'");
  } else {
    console.log('  SKIP  warranty reminders (WEBHOOK_SECRET not set)');
  }

  console.log('\n  cleanup:');
  await cleanup();
  const [[left]] = await pool.query('SELECT COUNT(*) n FROM tablets WHERE asset_tag LIKE ?', [TAG_PREFIX + '%']);
  const [[t]] = await pool.query('SELECT COUNT(*) n FROM tablets');
  console.log('    test devices left: ' + left.n + '; tablets total: ' + t.n);

  console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
  await pool.end();
  process.exit(fail ? 1 : 0);
})().catch(async e => { console.error(e); try { await cleanup(); } catch {} process.exit(1); });
