/**
 * Verification — spares and first-time fix (feature 9), 2026-09-10.
 *
 * The claim: an engineer can see, before leaving, whether the school they are
 * driving to has a working device to put in a child's hands — and if it does,
 * the swap takes one action and leaves an honest trail on both devices.
 *
 * Run from backend/:  node scripts/verify-spares.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const pool = require('../src/config/database');
const fixtures = require('./lib/fixtures');
const spares = require('../src/services/spares');

const BASE = process.env.VERIFY_BASE || 'http://localhost:3100';
let passed = 0, failed = 0;
function ok(name, cond, detail) {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail !== undefined ? ' — ' + JSON.stringify(detail) : ''}`); }
}
function eq(name, actual, expected) {
  ok(name, JSON.stringify(actual) === JSON.stringify(expected), { actual, expected });
}

async function api(method, path, { token, body } = {}) {
  const res = await fetch(BASE + '/api' + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (e) { json = { raw: text.slice(0, 160) }; }
  return { status: res.status, body: json };
}
async function login(u, p) {
  const r = await api('POST', '/auth/login', { body: { username: u, password: p } });
  if (r.status !== 200) throw new Error(`login ${u} -> ${r.status}`);
  return r.body.token;
}

(async () => {
  console.log('\nSpares and first-time fix verification');
  console.log('='.repeat(56));

  const fx = await fixtures.ensure();
  const school = fx.school;
  const token = await login(fx.schoolAdmin.username, fx.password);
  const made = [];

  const addDevice = async (tag, status, student) => {
    const [r] = await pool.query(
      `INSERT INTO tablets (school_id, serial_number, asset_tag, model, status, student_name)
       VALUES (?, ?, ?, 'VerifyTab', ?, ?)`,
      [school.id, 'VERIFY-' + tag, 'VERIFY-' + tag, status, student || null]
    );
    made.push(r.insertId);
    return r.insertId;
  };

  try {
    // ---- 1. stock, before anything is marked ------------------------------
    console.log('\n1. Stock is counted from the devices themselves');
    // The fixture school is a REAL school with real devices already in it, so
    // every count here is a delta against what was there first. Asserting
    // absolutes passed only by accident on an empty database.
    const base = await spares.stockFor(school.id);
    console.log(`      baseline: ${base.awaiting_swap} awaiting, ${base.spares_available} spares`);
    const faulty1 = await addDevice('F1', 'Faulty', 'Neema J.');
    const faulty2 = await addDevice('F2', 'Faulty', 'Amina K.');
    const before = await spares.stockFor(school.id);
    eq('two more devices are awaiting a swap', before.awaiting_swap - base.awaiting_swap, 2);
    eq('no new spares yet', before.spares_available - base.spares_available, 0);
    eq('so two more must be carried in', before.needed - base.needed, 2);
    eq('and a school with faults and no spare is a stockout', before.stockout, before.spares_available === 0);

    // ---- 2. only a working, unassigned device can be a spare --------------
    console.log('\n2. What may be held aside');
    const assigned = await addDevice('A1', 'Working', 'Juma P.');
    const busy = await api('PATCH', `/inventory/${assigned}/spare`, { token, body: { is_spare: true } });
    eq('an assigned device is refused', busy.status, 400);
    ok('and says who has it', /Juma P\./.test(busy.body.error || ''), busy.body);

    const brokenSpare = await api('PATCH', `/inventory/${faulty1}/spare`, { token, body: { is_spare: true } });
    eq('a faulty device is refused', brokenSpare.status, 400);

    const spare1 = await addDevice('S1', 'Working', null);
    const marked = await api('PATCH', `/inventory/${spare1}/spare`, { token, body: { is_spare: true } });
    eq('a working, unassigned one is accepted', marked.status, 200);
    eq('and reports the new state', marked.body.is_spare, true);

    const [hist] = await pool.query("SELECT action FROM tablet_history WHERE tablet_id = ? AND action = 'marked_spare'", [spare1]);
    eq('the change is on the device history', hist.length, 1);

    const after = await spares.stockFor(school.id);
    eq('one more spare on the shelf', after.spares_available - base.spares_available, 1);
    eq('which is one fewer to carry in', before.needed - after.needed, 1);
    eq('and with a spare present it is not a stockout', after.stockout, false);

    // ---- 3. the swap ------------------------------------------------------
    console.log('\n3. The swap puts a working device in the student\'s hands');
    const bad = await api('POST', `/inventory/${faulty1}/swap`, { token, body: { spare_id: faulty1 } });
    eq('a device cannot replace itself', bad.status, 400);

    const notASpare = await api('POST', `/inventory/${faulty1}/swap`, { token, body: { spare_id: assigned } });
    eq('an assigned device cannot be used as the spare', notASpare.status, 400);

    const swap = await api('POST', `/inventory/${faulty1}/swap`, { token, body: { spare_id: spare1, note: 'VERIFY screen cracked' } });
    eq('the swap succeeds', swap.status, 200);
    ok('and names who now has the device', /Neema J\./.test(swap.body.message), swap.body.message);

    const [[rows]] = [await pool.query('SELECT id, status, student_name, is_spare FROM tablets WHERE id IN (?, ?)', [faulty1, spare1])];
    const nowFaulty = rows.find(r => r.id === faulty1);
    const nowInUse = rows.find(r => r.id === spare1);
    eq('the student moved to the spare', nowInUse.student_name, 'Neema J.');
    eq('which is no longer a spare', Number(nowInUse.is_spare), 0);
    eq('the broken one is unassigned', nowFaulty.student_name, null);
    eq('and is in the repair pile', nowFaulty.status, 'In Repair');

    const [swapRow] = await pool.query('SELECT * FROM tablet_swaps WHERE faulty_tablet_id = ?', [faulty1]);
    eq('one swap row records it', swapRow.length, 1);
    eq('with the student it was for', swapRow[0].student_name, 'Neema J.');
    const [both] = await pool.query(
      "SELECT action FROM tablet_history WHERE tablet_id IN (?, ?) AND action IN ('swapped_in','swapped_out') ORDER BY action", [faulty1, spare1]);
    eq('and both devices carry the history', both.map(b => b.action), ['swapped_in', 'swapped_out']);

    const depleted = await spares.stockFor(school.id);
    eq('the shelf is back to where it started', depleted.spares_available, base.spares_available);
    // F1 was swapped out and is now In Repair, so the count does not fall: a
    // swap moves the problem to the repair pile, it does not delete it.
    eq('and the broken one is still counted, now in repair', depleted.awaiting_swap - base.awaiting_swap, 2);

    // ---- 4. the overview an engineer reads before leaving -----------------
    console.log('\n4. The overview is sorted by what is missing');
    const overview = await api('GET', '/inventory/spares', { token });
    eq('it loads', overview.status, 200);
    const mine = overview.body.schools.find(s => s.school_id === school.id);
    ok('the school appears', !!mine, overview.body.schools);
    eq('with the same gap the service reports', mine.needed, depleted.needed);
    eq('and the same stockout verdict', mine.stockout, depleted.stockout);
    ok('totals add up', overview.body.totals.awaiting_swap >= 2, overview.body.totals);

    // ---- 5. first-time fix is null until it is measurable -----------------
    console.log('\n5. First-time fix: null is not zero');
    const fresh = await spares.firstTimeFix({ schoolIds: [school.id] });
    eq('no completed visits yet -> null, not 0%', fresh.rate, null);

    const [v1] = await pool.query(
      "INSERT INTO visits (school_id, engineer_id, planned_for, status, completed_at) VALUES (?, ?, CURDATE(), 'done', NOW())",
      [school.id, fx.schoolAdmin.id]
    );
    const emptyVisit = await spares.firstTimeFix({ schoolIds: [school.id] });
    eq('a visit with no faults attached is still not measurable', emptyVisit.rate, null);
    eq('but it is counted and reported separately', emptyVisit.visits_no_faults_attached, 1);

    const [e1] = await pool.query(
      `INSERT INTO errors (error_code, title, description, school_id, category, priority, status, visit_id, sla_due_at)
       VALUES ('VERIFY-S1', 'VERIFY spares fault one', 'x', ?, 'Hardware', 'medium', 'resolved', ?, NOW())`,
      [school.id, v1.insertId]
    );
    const oneGood = await spares.firstTimeFix({ schoolIds: [school.id] });
    eq('a visit that closed everything it carried is 100%', oneGood.rate, 100);

    const [v2] = await pool.query(
      "INSERT INTO visits (school_id, engineer_id, planned_for, status, completed_at) VALUES (?, ?, CURDATE(), 'done', NOW())",
      [school.id, fx.schoolAdmin.id]
    );
    const [e2] = await pool.query(
      `INSERT INTO errors (error_code, title, description, school_id, category, priority, status, visit_id, sla_due_at)
       VALUES ('VERIFY-S2', 'VERIFY spares fault two', 'x', ?, 'Hardware', 'medium', 'open', ?, NOW())`,
      [school.id, v2.insertId]
    );
    const halved = await spares.firstTimeFix({ schoolIds: [school.id] });
    eq('a visit that left one open drops it to 50%', halved.rate, 50);
    eq('two visits were measurable', halved.visits_measurable, 2);

    // ---- 6. scope ---------------------------------------------------------
    console.log('\n6. Everyone sees only their own shelf');
    const teacherToken = await login(fx.teacher.username, fx.password);
    const teacherView = await api('GET', '/inventory/spares', { token: teacherToken });
    eq('a teacher may read it', teacherView.status, 200);
    ok('scoped to their own school', teacherView.body.schools.every(s => s.school_id === school.id), teacherView.body.schools);
    eq('but cannot mark a spare', (await api('PATCH', `/inventory/${spare1}/spare`, { token: teacherToken, body: { is_spare: true } })).status, 403);
    eq('nor swap', (await api('POST', `/inventory/${faulty2}/swap`, { token: teacherToken, body: { spare_id: spare1 } })).status, 403);
    eq('and an unauthenticated request is refused', (await api('GET', '/inventory/spares')).status, 401);

    // ---- 7. a swap linked to a fault leaves a trail on the ticket ---------
    console.log('\n7. A swap done against a fault is written on the ticket');
    const spare2 = await addDevice('S2', 'Working', null);
    await api('PATCH', `/inventory/${spare2}/spare`, { token, body: { is_spare: true } });
    const linked = await api('POST', `/inventory/${faulty2}/swap`, {
      token, body: { spare_id: spare2, error_id: e2.insertId, note: 'VERIFY swapped during a visit' }
    });
    eq('it succeeds', linked.status, 200);
    const [upd] = await pool.query("SELECT note FROM error_updates WHERE error_id = ? AND update_type = 'Swap'", [e2.insertId]);
    eq('the fault gains one update', upd.length, 1);
    ok('naming both devices', /VERIFY-F2/.test(upd[0].note) && /VERIFY-S2/.test(upd[0].note), upd[0].note);
  } finally {
    await pool.query("DELETE FROM error_updates WHERE error_id IN (SELECT id FROM errors WHERE error_code LIKE 'VERIFY-S%')");
    await pool.query("DELETE FROM errors WHERE error_code LIKE 'VERIFY-S%'");
    await pool.query("DELETE FROM tablet_swaps WHERE school_id = ?", [fx.school.id]);
    await pool.query("DELETE FROM tablet_history WHERE tablet_id IN (SELECT id FROM tablets WHERE serial_number LIKE 'VERIFY-%')");
    await pool.query("DELETE FROM tablets WHERE serial_number LIKE 'VERIFY-%'");
    await pool.query("DELETE FROM visits WHERE school_id = ?", [fx.school.id]);
    await pool.query("DELETE FROM audit_log WHERE action = 'inventory.swapped'");
    await fixtures.cleanup();

    console.log('\n' + '='.repeat(56));
    console.log(`  ${passed} passed, ${failed} failed`);
    const [left] = await pool.query("SELECT COUNT(*) n FROM tablets WHERE serial_number LIKE 'VERIFY-%'");
    console.log(`  verification devices left behind: ${left[0].n}`);
    await pool.end();
    process.exit(failed ? 1 : 0);
  }
})().catch(async (e) => {
  console.error('\nSUITE ERROR:', e.message);
  try { await pool.end(); } catch (x) {}
  process.exit(1);
});
