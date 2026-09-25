/**
 * Verification — dashboards, one per level (docs/features/13-dashboards-by-level.md).
 *
 *  Shape      each role gets its own payload, not head office's filtered to one
 *             row. A school administrator's dashboard has devices, a learning
 *             server and a maintenance list; it has no "schools healthy", which
 *             for one school can only ever read 1/1.
 *  Counting   the SLA figure is counted over every fault, not over the handful
 *             the page happens to list. This reproduces the bug it replaces:
 *             the old tile filtered a LIMIT 6 list, so it could not report a
 *             seventh breach however bad the day was.
 *  Routing    the school administrator's "waiting on you" is exactly the rule
 *             errorController.create() applies — a teacher's fault waits at the
 *             school, and escalating it moves it to the engineer.
 *  Honesty    nothing measurable stays null. No tile invents a 0 or a 100%.
 *  Scope      every figure is the signed-in person's own: their school's
 *             devices, their own reports.
 *
 * Needs the local server. Creates zzverify* accounts and rows and removes them.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const pool = require('../src/config/database');
const fixtures = require('./lib/fixtures');

const BASE = process.env.VERIFY_BASE || 'http://localhost:3210';
const DASH = path.join(__dirname, '..', '..', 'frontend', 'js', 'pages', 'dashboard.js');

let passed = 0, failed = 0;
function ok(name, cond, detail) {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail !== undefined ? ' — ' + JSON.stringify(detail) : ''}`); }
}
function section(t) { console.log('\n' + t); }

async function api(method, p, { token, body } = {}) {
  const r = await fetch(BASE + '/api' + p, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: r.status, body: await r.json().catch(() => null) };
}
const dash = token => api('GET', '/dashboard', { token });
const one = async (sql, params) => (await pool.query(sql, params))[0][0];

/** Faults this suite created, so they go even though it wrote them directly. */
const made = [];

/** The school borrowed for the fixture engineer, and who really covers it. */
let borrowed = null;
async function makeFault({ schoolId, reporterUserId, priority = 'high', status = 'open', agedHours = 30, dueHoursAgo = 6 }) {
  const code = 'ZZV-' + Math.random().toString(36).slice(2, 8).toUpperCase();
  const [res] = await pool.query(
    `INSERT INTO errors (error_code, title, description, school_id, category, priority, status,
       reported_by_user_id, escalation_level, created_at, sla_due_at)
     VALUES (?, ?, 'verification fixture', ?, 'Hardware', ?, ?, ?, 'school',
       DATE_SUB(NOW(), INTERVAL ? HOUR), DATE_SUB(NOW(), INTERVAL ? HOUR))`,
    [code, 'zzverify fault ' + code, schoolId, priority, status, reporterUserId, agedHours, dueHoursAgo]
  );
  made.push(res.insertId);
  return res.insertId;
}

async function run() {
  const f = await fixtures.ensure();
  const admin = await fixtures.ensurePlatformAdmin();
  const engineer = await fixtures.ensureFieldEngineer();
  const school = f.school;

  // The engineer needs a school to have a dashboard at all. Borrowed, and given
  // back in the finally below however this run ends — this is the real database,
  // and a school left pointing at a deleted engineer drops out of every
  // "my schools" query without anybody noticing.
  borrowed = { schoolId: school.id, engineerId: school.assigned_admin_id };
  await pool.query('UPDATE schools SET assigned_admin_id = ? WHERE id = ?', [engineer.id, school.id]);

  const tokens = {};
  for (const [k, u] of Object.entries({ admin: admin.username, school: f.schoolAdmin.username, teacher: f.teacher.username, engineer: engineer.username })) {
    tokens[k] = (await fixtures.signIn(u, fixtures.PASSWORD, BASE)).token;
  }

  /* ---------------------------------------------------------------- */
  section('Every level gets its own dashboard');

  const [A, S, T, E] = await Promise.all([dash(tokens.admin), dash(tokens.school), dash(tokens.teacher), dash(tokens.engineer)]);
  ok('platform admin', A.status === 200 && A.body.type === 'admin', A.body && A.body.type);
  ok('school administrator', S.status === 200 && S.body.type === 'school', S.body && S.body.type);
  ok('teacher', T.status === 200 && T.body.type === 'teacher', T.body && T.body.type);
  ok('field engineer', E.status === 200 && E.body.type === 'subadmin', E.body && E.body.type);

  ok('a school administrator is not shown "schools healthy" — for one school it can only read 1/1',
    S.body.schools_healthy === undefined && S.body.schools_total === undefined, Object.keys(S.body));
  ok('their dashboard carries the things they actually run: devices, learning server, checks',
    !!S.body.devices && !!S.body.lrs && !!S.body.maintenance, Object.keys(S.body));
  ok('the teacher is not shown how many guides exist',
    T.body.guides_available === undefined, Object.keys(T.body));

  /* ---------------------------------------------------------------- */
  section('The SLA figure counts every fault, not the six on the page');

  // Eight breaches: more than the six the list shows, which is exactly what the
  // old tile could not report.
  for (let i = 0; i < 8; i++) {
    await makeFault({ schoolId: school.id, reporterUserId: f.teacher.userId, priority: 'high', agedHours: 40 + i, dueHoursAgo: 10 + i });
  }
  const truth = await one(
    `SELECT COUNT(*) AS n FROM errors WHERE status <> 'resolved' AND sla_due_at IS NOT NULL AND sla_due_at < NOW()`);
  const A2 = await dash(tokens.admin);
  ok('the count matches the database exactly', A2.body.faults.breaching_now === Number(truth.n),
    { api: A2.body.faults.breaching_now, sql: Number(truth.n) });
  ok('it is not capped at the length of the list beside it',
    A2.body.faults.breaching_now > 6 && (A2.body.priorities || []).length <= 6,
    { breaching: A2.body.faults.breaching_now, listed: (A2.body.priorities || []).length });

  const src = fs.readFileSync(DASH, 'utf8');
  ok('the page does not recompute it by filtering a list',
    !/filter\([^)]*slaState\([^)]*\)\s*===\s*'breach'/.test(src));

  ok('the list is ordered past-due first, not by severity alone',
    (A2.body.priorities || []).every((e, i, arr) => i === 0 || Number(arr[i - 1].sla_breached) >= Number(e.sla_breached)),
    (A2.body.priorities || []).map(e => e.sla_breached));

  /* ---------------------------------------------------------------- */
  section('"Waiting on you" is the routing rule, not a guess');

  // Counted, not read off the list: the list is a top-N and a fault can be
  // routed correctly while sitting below the fold.
  const S1 = (await dash(tokens.school)).body.faults;

  const filed = await api('POST', '/errors', {
    token: tokens.teacher,
    body: { title: 'zzverify routing check', description: 'filed by a teacher', school_id: school.id, category: 'Hardware', priority: 'medium' }
  });
  ok('a teacher can file', filed.status === 201 || filed.status === 200, filed.status);
  const filedId = filed.body && (filed.body.id || (filed.body.error && filed.body.error.id));
  if (filedId) made.push(filedId);

  const S2 = await dash(tokens.school);
  const beforeWaiting = S2.body.faults.waiting_on_me;
  ok('a teacher\'s fault waits with the school administrator, who can walk to the room',
    beforeWaiting === S1.waiting_on_me + 1, { before: S1.waiting_on_me, after: beforeWaiting });
  ok('it is not counted as being with the engineer at the same time',
    S2.body.faults.with_engineer === S1.with_engineer,
    { before: S1.with_engineer, after: S2.body.faults.with_engineer });
  const rec = await one('SELECT escalation_level, assigned_to FROM errors WHERE id = ?', [filedId]);
  ok('and the row itself is held at school level, unassigned',
    rec.escalation_level === 'school' && rec.assigned_to === null, rec);

  const esc = await api('POST', `/errors/${filedId}/escalate`, { token: tokens.school, body: { reason: 'zzverify escalation' } });
  ok('the school administrator can hand it up', esc.status === 200, esc.status);

  const S3 = await dash(tokens.school);
  ok('escalating moves it out of their queue', S3.body.faults.waiting_on_me === beforeWaiting - 1,
    { before: beforeWaiting, after: S3.body.faults.waiting_on_me });
  ok('and into the engineer\'s column', S3.body.faults.with_engineer >= 1, S3.body.faults.with_engineer);

  /* ---------------------------------------------------------------- */
  section('Nothing measurable means nothing claimed');

  ok('resolution time is null when nothing was resolved in the window, never 0',
    A2.body.resolution.basis > 0 ? A2.body.resolution.hours != null : A2.body.resolution.hours === null,
    A2.body.resolution);
  ok('a period with no earlier period to compare says so rather than inventing one',
    A2.body.resolution.prev_basis > 0 || A2.body.resolution.prev_hours === null, A2.body.resolution);

  const E2 = await dash(tokens.engineer);
  ok('an engineer with nothing timed gets a basis of 0, and the page shows a dash',
    E2.body.stats.sla_basis_30d === 0 ? /slaPct === null \? '&mdash;'/.test(src) : true,
    E2.body.stats);
  ok('on-time is windowed to 30 days — a lifetime figure never moves',
    'sla_basis_30d' in E2.body.stats && !('total_resolved' in E2.body.stats), Object.keys(E2.body.stats));

  ok('a teacher with no open fault is offered no guides rather than the least-bad one',
    T.body.my.open > 0 || (T.body.suggested_guides || []).length === 0,
    { open: T.body.my.open, guides: (T.body.suggested_guides || []).length });

  /* ---------------------------------------------------------------- */
  section('Spares are a packing list, never a negative number');

  const negatives = [...(A2.body.schools_attention || []), ...(E2.body.my_schools || [])].filter(s => s.spares_needed < 0);
  ok('no school is ever shown as needing fewer than zero spares', negatives.length === 0, negatives);
  ok('the engineer is told what to carry and where the day cannot be saved',
    typeof E2.body.spares.to_carry === 'number' && typeof E2.body.spares.stockout_schools === 'number', E2.body.spares);

  /* ---------------------------------------------------------------- */
  section('Every figure is the reader\'s own');

  const devTruth = await one('SELECT COUNT(*) AS total, SUM(status IN (\'Faulty\',\'In Repair\')) AS down FROM tablets WHERE school_id = ?', [school.id]);
  ok('the school administrator\'s device counts are their school\'s',
    S3.body.devices.total === Number(devTruth.total) && S3.body.devices.out_of_service === Number(devTruth.down || 0),
    { api: S3.body.devices, sql: devTruth });

  const mineTruth = await one(
    `SELECT SUM(status <> 'resolved') AS open_count, SUM(status = 'resolved' AND csat_rating IS NULL) AS unrated
       FROM errors WHERE reported_by_user_id = ?`, [f.teacher.userId]);
  const T2 = await dash(tokens.teacher);
  ok('a teacher sees their own reports and nobody else\'s',
    T2.body.my.open === Number(mineTruth.open_count || 0), { api: T2.body.my.open, sql: Number(mineTruth.open_count || 0) });

  // A resolution nobody confirmed is a resolution nobody checked.
  await pool.query("UPDATE errors SET status = 'resolved', resolved_at = NOW(), csat_rating = NULL WHERE id = ?", [made[0]]);
  const T3 = await dash(tokens.teacher);
  ok('a resolution the teacher has not confirmed is surfaced to them',
    T3.body.my.awaiting_rating >= 1, T3.body.my);
  await pool.query('UPDATE errors SET csat_rating = 5 WHERE id = ?', [made[0]]);
  const T4 = await dash(tokens.teacher);
  ok('confirming it clears the prompt', T4.body.my.awaiting_rating === T3.body.my.awaiting_rating - 1,
    { before: T3.body.my.awaiting_rating, after: T4.body.my.awaiting_rating });

  /* ---------------------------------------------------------------- */
  section('The tiles that answered nothing are gone');

  for (const dead of ['Guides Available', 'Total Reported', 'guides_available']) {
    ok(`"${dead}" no longer occupies a tile`, !src.includes(dead));
  }
  ok('no lifetime "all time" counter is shown', !/all time/i.test(src));
  ok('"in progress" is no longer a headline: it is a subset of open, not a decision',
    !/stat-label">In Progress/.test(src));
}

(async () => {
  try {
    await run();
  } catch (e) {
    failed++;
    console.log('  FAIL  suite threw —', e.message);
  } finally {
    if (borrowed) {
      await pool.query('UPDATE schools SET assigned_admin_id = ? WHERE id = ?',
        [borrowed.engineerId, borrowed.schoolId]).catch(() => {});
    }
    if (made.length) {
      await pool.query('DELETE FROM error_updates WHERE error_id IN (?)', [made]).catch(() => {});
      await pool.query('DELETE FROM errors WHERE id IN (?)', [made]).catch(() => {});
    }
    await fixtures.cleanup().catch(() => {});
    console.log(`\n  ${passed} passed, ${failed} failed`);
    await pool.end();
    process.exit(failed ? 1 : 0);
  }
})();
