/**
 * End-to-end check for trend metrics (docs/features/06-trend-metrics.md).
 *
 *   cd backend && node scripts/verify-trends.js
 *
 * Needs the server running on localhost:3100. It WRITES TO THE DATABASE: it
 * creates faults across several ISO weeks with known resolution times, checks
 * every derived figure against a hand calculation, then removes them. Do not
 * point it at production.
 */
require('dotenv').config({ path: '.env' });
const pool = require('../src/config/database');
const { _internal } = require('../src/controllers/analyticsController');
const { pct, deflectionRate } = _internal;

const BASE = 'http://localhost:3100';
const MARK = 'TREND-TEST';

let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  if (ok) pass++; else fail++;
  console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? '  -> ' + detail : ''));
};

let H = null;
let SCHOOL = null;
const get = p => fetch(BASE + p, { headers: H }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
/** Trends narrowed to the fixture school, so the figures are exact. */
const trendsFor = () => get('/api/analytics/trends?school_id=' + SCHOOL.id);

/**
 * A fault created `daysAgo` days back. resolveHours sets resolved_at relative
 * to creation, so mean-time-to-resolve is known exactly. slaHours sets the
 * target, so on-time versus late is known exactly too.
 */
async function fault(schoolId, code, o) {
  const created = `DATE_SUB(NOW(), INTERVAL ${o.daysAgo} DAY)`;
  const resolved = o.resolveHours != null
    ? `DATE_ADD(DATE_SUB(NOW(), INTERVAL ${o.daysAgo} DAY), INTERVAL ${Math.round(o.resolveHours * 60)} MINUTE)`
    : 'NULL';
  const first = o.firstResponseHours != null
    ? `DATE_ADD(DATE_SUB(NOW(), INTERVAL ${o.daysAgo} DAY), INTERVAL ${Math.round(o.firstResponseHours * 60)} MINUTE)`
    : 'NULL';
  const due = o.slaHours != null
    ? `DATE_ADD(DATE_SUB(NOW(), INTERVAL ${o.daysAgo} DAY), INTERVAL ${o.slaHours} HOUR)`
    : 'NULL';
  const [r] = await pool.query(
    `INSERT INTO errors (error_code, title, description, school_id, category, priority, status,
       created_at, resolved_at, first_response_at, sla_due_at, escalated_at, escalation_level,
       assigned_to, intake_channel)
     VALUES (?, ?, ?, ?, 'Connectivity', 'medium', ?, ${created}, ${resolved}, ${first}, ${due},
       ${o.escalated ? created : 'NULL'}, 'school', ?, ?)`,
    [code, MARK + ' ' + code, MARK + ' fixture. Safe to delete.', schoolId,
     o.resolveHours != null ? 'resolved' : 'open', o.assignedTo || null, o.channel || 'web']
  );
  return r.insertId;
}

async function cleanup() {
  await pool.query('DELETE FROM errors WHERE title LIKE ?', [MARK + '%']);
  await pool.query('DELETE FROM ai_chat_messages WHERE chat_id IN (SELECT id FROM ai_chats WHERE title LIKE ?)', [MARK + '%']);
  await pool.query('DELETE FROM ai_chats WHERE title LIKE ?', [MARK + '%']);
}

(async () => {
  const login = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  }).then(r => r.json());
  if (!login.token) { console.error('  login failed'); process.exit(1); }
  H = { Authorization: 'Bearer ' + login.token };
  const adminId = login.user.id;

  // A school with no faults of its own, so every figure is attributable to a
  // fixture — without deleting anybody's data. The trends endpoint takes a
  // school_id, which is what makes this possible.
  await cleanup();
  const [candidates] = await pool.query(
    `SELECT s.id, s.name FROM schools s
     LEFT JOIN errors e ON e.school_id = s.id
     GROUP BY s.id HAVING COUNT(e.id) = 0 ORDER BY s.id LIMIT 1`);
  if (!candidates.length) {
    console.error('  No school without existing faults; this suite needs one to measure exactly.');
    console.error('  Nothing was changed.');
    process.exit(1);
  }
  const school = candidates[0];
  SCHOOL = school;
  const [[sub]] = await pool.query("SELECT id FROM users WHERE role = 'subadmin' LIMIT 1");
  console.log(`\n  measuring against ${school.name} (no pre-existing faults)\n`);

  // --- the pure functions, checked directly ---
  check('pct: nothing to divide by returns null, not 0', pct(0, 0) === null);
  check('pct: a negative numerator clamps to 0, never below', pct(-6, 3) === 0, String(pct(-6, 3)));
  check('pct: above 100 clamps to 100', pct(9, 3) === 100);
  check('pct: an ordinary ratio', pct(1, 4) === 25);

  // --- this week: two resolved (2h and 4h), one open ---
  await fault(school.id, MARK + '-W0-A', { daysAgo: 1, resolveHours: 2, firstResponseHours: 0.5, slaHours: 24, assignedTo: adminId });
  await fault(school.id, MARK + '-W0-B', { daysAgo: 1, resolveHours: 4, firstResponseHours: 1.5, slaHours: 24, assignedTo: adminId });
  await fault(school.id, MARK + '-W0-C', { daysAgo: 1, slaHours: 24, assignedTo: adminId });
  // Resolved LATE against its own target, and one escalated.
  await fault(school.id, MARK + '-W0-D', { daysAgo: 1, resolveHours: 30, firstResponseHours: 2, slaHours: 24, assignedTo: adminId });
  await fault(school.id, MARK + '-W0-E', { daysAgo: 1, resolveHours: 3, firstResponseHours: 1, slaHours: 24, escalated: true, assignedTo: sub ? sub.id : adminId });
  // Resolved but with no timestamps to judge: must be excluded, not counted a miss.
  await pool.query(
    `INSERT INTO errors (error_code, title, description, school_id, category, priority, status,
       created_at, resolved_at, sla_due_at, escalation_level, intake_channel)
     VALUES (?, ?, ?, ?, 'Connectivity', 'medium', 'resolved', DATE_SUB(NOW(), INTERVAL 1 DAY), NULL, NULL, 'school', 'whatsapp')`,
    [MARK + '-W0-F', MARK + ' W0-F', MARK + ' fixture.', school.id]
  );
  // A previous week, slower, so a direction exists.
  await fault(school.id, MARK + '-W1-A', { daysAgo: 9, resolveHours: 20, firstResponseHours: 6, slaHours: 24 });
  await fault(school.id, MARK + '-W2-A', { daysAgo: 16, resolveHours: 22, firstResponseHours: 7, slaHours: 24 });
  await fault(school.id, MARK + '-W3-A', { daysAgo: 23, resolveHours: 24, firstResponseHours: 8, slaHours: 24 });
  await fault(school.id, MARK + '-W4-A', { daysAgo: 30, resolveHours: 26, firstResponseHours: 9, slaHours: 24 });

  const r = await trendsFor();
  check('trends: responds', r.status === 200);
  const t = r.body;
  check('trends: buckets by ISO week', t.weekly.length >= 4, t.weekly.length + ' weeks');
  check('trends: weeks are in chronological order',
    t.weekly.every((w, i, a) => i === 0 || a[i - 1].yearweek <= w.yearweek));

  const thisWeek = t.weekly[t.weekly.length - 1];

  // MTTR over 2, 4, 30 and 3 hours = 9.75
  check('mttr: mean over the resolved faults only',
    Math.abs(thisWeek.mttr_hours - 9.75) < 0.06,
    thisWeek.mttr_hours + 'h over ' + thisWeek.mttr_basis + ' resolved');
  check('mttr: the basis excludes resolutions with no timestamp',
    thisWeek.mttr_basis === 4, 'basis=' + thisWeek.mttr_basis);

  // TTFR over 0.5, 1.5, 2 and 1 = 1.25
  check('ttfr: mean over the faults that got a first response',
    Math.abs(thisWeek.ttfr_hours - 1.25) < 0.06,
    thisWeek.ttfr_hours + 'h over ' + thisWeek.ttfr_basis);

  // SLA: 4 judgeable (2h, 4h, 30h, 3h vs a 24h target) => 3 on time = 75%
  check('sla: only faults with both timestamps are judged',
    thisWeek.sla_measurable === 4, 'measurable=' + thisWeek.sla_measurable);
  check('sla: the late one counts as a miss', thisWeek.sla_pct === 75, thisWeek.sla_pct + '%');
  check('sla: the untimed resolution is excluded AND counted separately',
    thisWeek.sla_unmeasurable === 1, 'unmeasurable=' + thisWeek.sla_unmeasurable);

  // Escalation: 1 of 6 reported = 17%
  check('escalation: a rate over what was reported', thisWeek.escalation_pct === 17,
    thisWeek.escalation_pct + '% (' + thisWeek.escalated + '/' + thisWeek.reported + ')');
  // Resolved without escalation: 4 of 5 resolved = 80%
  check('no-escalation: a rate over what was resolved',
    thisWeek.no_escalation_pct === 80, thisWeek.no_escalation_pct + '%');

  check('counts: reported and resolved per week',
    thisWeek.reported === 6 && thisWeek.resolved === 5,
    thisWeek.reported + ' reported, ' + thisWeek.resolved + ' resolved');

  // --- direction against the four-week average ---
  const ch = t.totals.change;
  check('direction: MTTR fell against the four-week average', ch.mttr_hours < 0,
    'change=' + ch.mttr_hours + 'h vs avg ' + t.totals.four_week_average.mttr_hours + 'h');
  check('direction: TTFR fell too', ch.ttfr_hours < 0, 'change=' + ch.ttfr_hours + 'h');
  check('direction: the baseline is the four weeks before, not all of them',
    t.totals.four_week_average.mttr_hours != null &&
    Math.abs(t.totals.four_week_average.mttr_hours - 23) < 0.6,
    'avg=' + t.totals.four_week_average.mttr_hours + 'h (20,22,24,26 => 23)');

  // --- a week with nothing measurable must read as null, not 0 ---
  await pool.query('DELETE FROM errors WHERE title LIKE ?', [MARK + '%']);
  await fault(school.id, MARK + '-NONE', { daysAgo: 1 });   // open, no timestamps
  const empty = await trendsFor();
  const ew = empty.body.weekly[empty.body.weekly.length - 1];
  check('unmeasurable week: MTTR is null, not 0', ew.mttr_hours === null, String(ew.mttr_hours));
  check('unmeasurable week: SLA is null, not 0 or 100', ew.sla_pct === null, String(ew.sla_pct));
  check('unmeasurable week: the count of reported is still right', ew.reported === 1);

  // --- assistant deflection ---
  await pool.query('DELETE FROM errors WHERE title LIKE ?', [MARK + '%']);
  const baselineRes = await trendsFor();
  const baseline = baselineRes.body.ai_deflection;

  const mkChat = async (minsAgo) => {
    const [c] = await pool.query(
      'INSERT INTO ai_chats (user_id, title, created_at, updated_at) VALUES (?, ?, DATE_SUB(NOW(), INTERVAL ? MINUTE), DATE_SUB(NOW(), INTERVAL ? MINUTE))',
      [adminId, MARK + ' chat', minsAgo, minsAgo]);
    return c.insertId;
  };
  await mkChat(600);   // deflected: no report followed
  await mkChat(500);   // deflected
  await mkChat(400);   // will be followed by a report inside the hour
  await pool.query(
    `INSERT INTO errors (error_code, title, description, school_id, category, priority, status,
       created_at, sla_due_at, escalation_level, reported_by_user_id, intake_channel)
     VALUES (?, ?, ?, ?, 'Connectivity', 'medium', 'open',
       DATE_SUB(NOW(), INTERVAL 380 MINUTE), DATE_ADD(NOW(), INTERVAL 1 DAY), 'school', ?, 'web')`,
    [MARK + '-AFTER', MARK + ' after chat', MARK + ' fixture.', school.id, adminId]
  );

  // Measured as a delta: this database already has chats of its own, and
  // deleting somebody's conversation history to make an assertion tidy is not
  // a trade worth making.
  const dr = await trendsFor();
  const d = dr.body.ai_deflection;
  check('deflection: the three new chats are counted',
    d.chats === baseline.chats + 3, d.chats + ' chats (baseline ' + baseline.chats + ')');
  check('deflection: a report inside the hour counts as not deflected',
    d.followed_by_a_report === baseline.followed_by_a_report + 1,
    d.followed_by_a_report + ' followed by a report (baseline ' + baseline.followed_by_a_report + ')');
  check('deflection: the rate matches the pure function on those totals',
    d.deflected_pct === deflectionRate(d.chats, d.followed_by_a_report),
    d.deflected_pct + '%');

  await pool.query('DELETE FROM ai_chats WHERE title LIKE ?', [MARK + '%']);
  const back = await trendsFor();
  check('deflection: removing the fixtures returns it to the baseline',
    back.body.ai_deflection.chats === baseline.chats,
    back.body.ai_deflection.chats + ' vs ' + baseline.chats);

  // The "nobody asked" case cannot be produced without deleting real chats, so
  // it is asserted on the pure function instead.
  check('deflection: null, not 0%, when nobody used the assistant',
    deflectionRate(0, 0) === null, String(deflectionRate(0, 0)));
  check('deflection: every chat deflected is 100%', deflectionRate(4, 0) === 100);
  check('deflection: every chat followed by a report is 0%, not null',
    deflectionRate(4, 4) === 0, String(deflectionRate(4, 4)));
  check('deflection: more reports than chats cannot go below 0',
    deflectionRate(2, 5) === 0, String(deflectionRate(2, 5)));

  // --- channel breakdown ---
  await pool.query('DELETE FROM errors WHERE title LIKE ?', [MARK + '%']);
  await fault(school.id, MARK + '-CH1', { daysAgo: 1, channel: 'web' });
  await fault(school.id, MARK + '-CH2', { daysAgo: 1, channel: 'whatsapp' });
  await fault(school.id, MARK + '-CH3', { daysAgo: 1, channel: 'monitor' });
  const cr = await trendsFor();
  const chans = cr.body.channels.reduce((m, c) => (m[c.channel] = c.count, m), {});
  check('channels: each intake channel is counted',
    chans.web === 1 && chans.whatsapp === 1 && chans.monitor === 1, JSON.stringify(chans));

  // --- scoping ---
  if (sub) {
    const [subUser] = await pool.query('SELECT username FROM users WHERE id = ?', [sub.id]);
    const sl = await fetch(BASE + '/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: subUser[0].username, password: 'admin123' })
    }).then(r => r.json());
    if (sl.token) {
      const [[owned]] = await pool.query('SELECT COUNT(*) n FROM schools WHERE assigned_admin_id = ?', [sub.id]);
      const st = await fetch(BASE + '/api/analytics/trends', { headers: { Authorization: 'Bearer ' + sl.token } }).then(r => r.json());
      const isTheirs = Number(owned.n) > 0;
      check('scope: a sub-admin sees only their own schools',
        st.schools.length <= Number(owned.n), st.schools.length + ' of ' + owned.n + ' assigned');
      check('scope: their engineer view still loads', Array.isArray(st.engineers));
      void isTheirs;
    } else { console.log('  SKIP  sub-admin scope (could not sign in)'); }
  }
  const anon = await fetch(BASE + '/api/analytics/trends');
  check('scope: an unauthenticated request is rejected', anon.status === 401, 'HTTP ' + anon.status);

  console.log('\n  cleanup:');
  await cleanup();
  const [[e]] = await pool.query('SELECT COUNT(*) n FROM errors');
  const [[c]] = await pool.query('SELECT COUNT(*) n FROM ai_chats');
  console.log(`    errors=${e.n} ai_chats=${c.n}`);

  console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
  await pool.end();
  process.exit(fail ? 1 : 0);
})().catch(async e => { console.error(e); try { await cleanup(); } catch {} process.exit(1); });
