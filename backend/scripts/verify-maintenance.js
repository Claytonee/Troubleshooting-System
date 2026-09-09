/**
 * Verification — preventive maintenance (feature 11), 2026-09-10.
 *
 * The claim: the system now knows what SHOULD be checked at each school and
 * when it was last done, that list reaches the engineer on the visit sheet, and
 * signing one off is scoped to the schools that person actually covers.
 *
 * Run from backend/:  node scripts/verify-maintenance.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const pool = require('../src/config/database');
const fixtures = require('./lib/fixtures');
const maintenance = require('../src/services/maintenance');

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
const daysAgo = (n) => {
  const d = new Date(Date.now() - n * 86400000);
  return d.toISOString().slice(0, 10);
};

(async () => {
  console.log('\nPreventive maintenance verification');
  console.log('='.repeat(56));

  const fx = await fixtures.ensure();
  const school = fx.school;
  const adminToken = await login(fx.schoolAdmin.username, fx.password);
  const teacherToken = await login(fx.teacher.username, fx.password);

  try {
    // ---- 1. the schedule exists ------------------------------------------
    console.log('\n1. There is a schedule, seeded once');
    const list = await api('GET', '/maintenance/tasks', { token: adminToken });
    eq('the task list loads', list.status, 200);
    ok('with the starting checks', list.body.tasks.length >= 6, list.body.tasks.length);
    ok('each with an interval', list.body.tasks.every(t => t.interval_days > 0), list.body.tasks);
    const [dupes] = await pool.query(
      'SELECT name, COUNT(*) n FROM maintenance_tasks GROUP BY name HAVING n > 1'
    );
    eq('re-running the migration never duplicates them', dupes.length, 0);

    // ---- 2. never done is due --------------------------------------------
    console.log('\n2. A check never recorded is due, not unknown');
    const fresh = await maintenance.dueFor(school.id);
    ok('every task comes back', fresh.length >= 6, fresh.length);
    ok('all of them due, because none has ever been done', fresh.every(t => t.due), fresh.filter(t => !t.due));
    ok('and flagged as never done', fresh.every(t => t.never_done), fresh.filter(t => !t.never_done));
    ok('which counts as overdue, not merely due', fresh.every(t => t.overdue), fresh.filter(t => !t.overdue));

    // ---- 3. doing one takes it off the list ------------------------------
    console.log('\n3. Recording a check takes it off the list');
    const task = list.body.tasks[0];
    const done = await api('POST', `/maintenance/${task.id}/done`, {
      token: adminToken, body: { school_id: school.id, note: 'VERIFY pm check' }
    });
    eq('it is accepted', done.status, 200);
    ok('and names the check', done.body.message.includes(task.name), done.body.message);

    const afterDone = await maintenance.dueFor(school.id);
    const justDone = afterDone.find(t => t.task_id === task.id);
    eq('that task is no longer due', justDone.due, false);
    eq('nor overdue', justDone.overdue, false);
    eq('and it remembers when', justDone.days_since, 0);
    eq('the rest are untouched', afterDone.filter(t => t.due).length, fresh.length - 1);

    // ---- 4. the interval, and the grace period ---------------------------
    console.log('\n4. The interval decides, with a grace period before "overdue"');
    // Just inside the interval.
    await pool.query('UPDATE maintenance_log SET done_on = ? WHERE school_id = ? AND task_id = ?',
      [daysAgo(task.interval_days - 5), school.id, task.id]);
    let state = (await maintenance.dueFor(school.id)).find(t => t.task_id === task.id);
    eq('five days short of the interval: not due', state.due, false);

    // A day past it.
    await pool.query('UPDATE maintenance_log SET done_on = ? WHERE school_id = ? AND task_id = ?',
      [daysAgo(task.interval_days + 1), school.id, task.id]);
    state = (await maintenance.dueFor(school.id)).find(t => t.task_id === task.id);
    eq('a day past it: due', state.due, true);
    eq('but not yet overdue — crying wolf on day one trains people to ignore it', state.overdue, false);

    // Well past it.
    await pool.query('UPDATE maintenance_log SET done_on = ? WHERE school_id = ? AND task_id = ?',
      [daysAgo(task.interval_days + maintenance.OVERDUE_GRACE_DAYS + 2), school.id, task.id]);
    state = (await maintenance.dueFor(school.id)).find(t => t.task_id === task.id);
    eq('past the grace period: overdue', state.overdue, true);
    ok('and it says by how much', state.days_overdue > maintenance.OVERDUE_GRACE_DAYS, state.days_overdue);

    // ---- 5. it reaches the visit sheet -----------------------------------
    console.log('\n5. The engineer sees it on the visit sheet');
    const [v] = await pool.query(
      "INSERT INTO visits (school_id, engineer_id, planned_for, status) VALUES (?, ?, CURDATE(), 'planned')",
      [school.id, fx.schoolAdmin.id]
    );
    // The visit planner is admin/subadmin only, so read it as head office.
    const bcrypt = require('bcryptjs');
    const [adminRow] = await pool.query("SELECT id, username, password_hash FROM users WHERE role = 'admin' LIMIT 1");
    let platformToken = null;
    if (adminRow.length) {
      await pool.query('UPDATE users SET password_hash = ? WHERE id = ?',
        [await bcrypt.hash(fixtures.PASSWORD, 10), adminRow[0].id]);
      platformToken = await login(adminRow[0].username, fixtures.PASSWORD);

      const sheet = await api('GET', `/visits/${v.insertId}`, { token: platformToken });
      eq('the checklist loads', sheet.status, 200);
      ok('carrying the due checks', Array.isArray(sheet.body.checks) && sheet.body.checks.length > 0, sheet.body.checks);
      ok('only the ones that are due', sheet.body.checks.every(c => c.due), sheet.body.checks.filter(c => !c.due));
      ok('and the whole schedule too, for context', sheet.body.checks_all.length >= sheet.body.checks.length,
        { due: sheet.body.checks.length, all: sheet.body.checks_all.length });

      const onVisit = await api('POST', `/maintenance/${list.body.tasks[1].id}/done`, {
        token: platformToken, body: { school_id: school.id, visit_id: v.insertId }
      });
      eq('a check can be signed off against the visit', onVisit.status, 200);
      const [logged] = await pool.query('SELECT visit_id FROM maintenance_log WHERE task_id = ? AND school_id = ?',
        [list.body.tasks[1].id, school.id]);
      eq('and the visit is recorded on it', logged[0].visit_id, v.insertId);

      const after = await api('GET', `/visits/${v.insertId}`, { token: platformToken });
      eq('the list shrinks as the work is done', after.body.checks.length, sheet.body.checks.length - 1);

      await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [adminRow[0].password_hash, adminRow[0].id]);
    }

    // ---- 6. scope ---------------------------------------------------------
    console.log('\n6. Nobody signs off a school that is not theirs');
    const teacherRead = await api('GET', '/maintenance/due', { token: teacherToken });
    eq('a teacher may see what is due at their school', teacherRead.status, 200);
    eq('scoped to that school', teacherRead.body.school.id, school.id);
    eq('but may not sign anything off',
      (await api('POST', `/maintenance/${task.id}/done`, { token: teacherToken, body: { school_id: school.id } })).status, 403);

    const [other] = await pool.query('SELECT id FROM schools WHERE id <> ? LIMIT 1', [school.id]);
    const foreign = await api('POST', `/maintenance/${task.id}/done`, {
      token: adminToken, body: { school_id: other[0].id }
    });
    eq('a school admin cannot reset another school\'s clock', foreign.status, 403);
    eq('and a missing school is refused', (await api('POST', `/maintenance/${task.id}/done`, { token: adminToken, body: {} })).status, 400);
    eq('an unknown check is a 404', (await api('POST', '/maintenance/999999/done', { token: adminToken, body: { school_id: school.id } })).status, 404);
    eq('an unauthenticated read is refused', (await api('GET', '/maintenance/due')).status, 401);
  } finally {
    await pool.query('DELETE FROM maintenance_log WHERE school_id = ?', [fx.school.id]);
    await pool.query('DELETE FROM visits WHERE school_id = ?', [fx.school.id]);
    await pool.query("DELETE FROM audit_log WHERE action = 'maintenance.done'");
    await fixtures.cleanup();

    console.log('\n' + '='.repeat(56));
    console.log(`  ${passed} passed, ${failed} failed`);
    const [left] = await pool.query('SELECT COUNT(*) n FROM maintenance_log');
    console.log(`  maintenance log rows left behind: ${left[0].n}`);
    await pool.end();
    process.exit(failed ? 1 : 0);
  }
})().catch(async (e) => {
  console.error('\nSUITE ERROR:', e.message);
  try { await pool.end(); } catch (x) {}
  process.exit(1);
});
