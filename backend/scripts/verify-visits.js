/**
 * End-to-end check for the visit planner (docs/features/05-visit-planner.md).
 *
 *   cd backend && node scripts/verify-visits.js
 *
 * Needs the server running on localhost:3100. It WRITES TO THE DATABASE: it
 * creates faults, a tablet and a visit, then removes them. Do not point it at
 * production.
 */
require('dotenv').config({ path: '.env' });
const pool = require('../src/config/database');

const BASE = 'http://localhost:3100';
const MARK = 'VISIT-TEST';

let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  if (ok) pass++; else fail++;
  console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? '  -> ' + detail : ''));
};

let H = null;
const get = p => fetch(BASE + p, { headers: H }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const send = (m, p, b) => fetch(BASE + p, {
  method: m, headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify(b || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

const iso = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

async function fault(schoolId, code, priority, opts = {}) {
  const [r] = await pool.query(
    `INSERT INTO errors (error_code, title, description, school_id, category, priority, status,
       sla_due_at, escalation_level, intake_channel)
     VALUES (?, ?, ?, ?, 'Connectivity', ?, ?, ?, 'school', 'web')`,
    [code, MARK + ' ' + code, MARK + ' fixture. Safe to delete.', schoolId, priority,
     opts.status || 'open',
     opts.breached ? new Date(Date.now() - 3600000) : new Date(Date.now() + 86400000)]
  );
  return r.insertId;
}

async function cleanup() {
  await pool.query('DELETE FROM errors WHERE title LIKE ?', [MARK + '%']);
  await pool.query('DELETE FROM tablets WHERE asset_tag LIKE ?', [MARK + '%']);
  await pool.query("DELETE FROM visits WHERE notes LIKE ? OR notes IS NULL AND status = 'planned' AND planned_for >= CURDATE()", [MARK + '%']);
  await pool.query("DELETE FROM audit_log WHERE action LIKE 'visit.%'");
}

(async () => {
  const [tables] = await pool.query(
    "SELECT TABLE_NAME t FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'visits'");
  check('schema: visits table exists', tables.length === 1);
  const [col] = await pool.query(
    "SELECT IS_NULLABLE n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='errors' AND COLUMN_NAME='visit_id'");
  check('schema: errors.visit_id exists and is nullable', col.length === 1 && col[0].n === 'YES');

  const login = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  }).then(r => r.json());
  if (!login.token) { console.error('  login failed'); process.exit(1); }
  H = { Authorization: 'Bearer ' + login.token };

  await cleanup();
  const [schools] = await pool.query('SELECT id, name FROM schools ORDER BY id LIMIT 2');
  const [A, B] = schools;
  console.log(`\n  school A = ${A.name}, school B = ${B.name}\n`);

  // A: three faults including a critical and a breach. B: one medium.
  await fault(A.id, MARK + '-A1', 'critical');
  await fault(A.id, MARK + '-A2', 'high', { breached: true });
  await fault(A.id, MARK + '-A3', 'medium');
  await fault(B.id, MARK + '-B1', 'medium');

  // --- the queue, grouped by school ---
  const q = await get('/api/visits/queue');
  check('queue: returns a row per school, not per fault',
    Array.isArray(q.body) && q.body.length === new Set(q.body.map(r => r.school_id)).size,
    q.body.length + ' rows');
  const rowA = q.body.find(r => r.school_id === A.id);
  const rowB = q.body.find(r => r.school_id === B.id);
  check('queue: counts the open faults per school', rowA.open_faults >= 3, 'A has ' + rowA.open_faults);
  check('queue: counts criticals', rowA.critical >= 1, 'A critical=' + rowA.critical);
  check('queue: counts SLA breaches', rowA.breached >= 1, 'A breached=' + rowA.breached);
  check('queue: the school with a critical sorts above one without',
    q.body.findIndex(r => r.school_id === A.id) < q.body.findIndex(r => r.school_id === B.id),
    'A at ' + q.body.findIndex(r => r.school_id === A.id) + ', B at ' + q.body.findIndex(r => r.school_id === B.id));
  check('queue: no visit planned yet', rowA.planned_visit_id == null);

  // --- suggestions: where features 1 and 4 pay off ---
  const [tab] = await pool.query(
    `INSERT INTO tablets (school_id, serial_number, asset_tag, model, status)
     VALUES (?, ?, ?, 'TestTab', 'Faulty')`, [A.id, MARK + '-SN', MARK + '-T1']);
  for (const d of [3, 20, 40]) {
    await pool.query(
      `INSERT INTO tablet_history (tablet_id, action, old_value, new_value, actor_name, created_at)
       VALUES (?, 'status_change', 'Working', 'Faulty', 'visit test', DATE_SUB(NOW(), INTERVAL ? DAY))`,
      [tab.insertId, d]);
  }

  const s = await get('/api/visits/suggestions/' + A.id);
  check('suggestions: lists the open faults', s.body.faults.length >= 3, s.body.faults.length + ' faults');
  check('suggestions: flags the SLA breach',
    s.body.faults.some(f => f.breached), s.body.faults.filter(f => f.breached).length + ' breached');
  check('suggestions: surfaces a repeat-offender device',
    s.body.devices.some(d => d.asset_tag === MARK + '-T1' && d.repeat_offender),
    (s.body.devices[0] || {}).verdict);
  check('suggestions: reports whether the week check-in is due',
    typeof s.body.checkin_due === 'boolean' && Number.isFinite(s.body.week_number),
    'week ' + s.body.week_number + ', due=' + s.body.checkin_due);
  check('suggestions: reports the LRS state',
    s.body.lrs === null || ['up', 'down', 'unknown'].includes(s.body.lrs.state),
    s.body.lrs ? s.body.lrs.state : 'no LRS recorded');

  // --- planning ---
  const bad = await send('POST', '/api/visits', { school_id: A.id, planned_for: 'tomorrow' });
  check('plan: rejects a non-date', bad.status === 400, bad.body.error);
  const noSchool = await send('POST', '/api/visits', { planned_for: iso(1) });
  check('plan: requires a school', noSchool.status === 400);

  const created = await send('POST', '/api/visits', { school_id: A.id, planned_for: iso(1), notes: MARK + ' fixture' });
  check('plan: creates the visit and attaches the open faults',
    created.status === 201 && created.body.attached_faults >= 3,
    'attached=' + created.body.attached_faults);
  const visitId = created.body.id;

  const [statuses] = await pool.query(
    'SELECT DISTINCT status FROM errors WHERE visit_id = ?', [visitId]);
  check('plan: attaching does NOT change fault status',
    statuses.length === 1 && statuses[0].status === 'open',
    statuses.map(x => x.status).join(', '));

  const dupe = await send('POST', '/api/visits', { school_id: A.id, planned_for: iso(2) });
  check('plan: refuses a second open plan for the same school',
    dupe.status === 409 && dupe.body.visit_id === visitId, 'HTTP ' + dupe.status);
  check('plan: the refusal says when the existing visit is', !!dupe.body.planned_for, String(dupe.body.planned_for).slice(0, 10));

  const q2 = await get('/api/visits/queue');
  check('queue: now shows the planned visit',
    q2.body.find(r => r.school_id === A.id).planned_visit_id === visitId);

  // --- the on-site checklist ---
  const v = await get('/api/visits/' + visitId);
  check('checklist: returns the attached faults', v.body.faults.length >= 3, v.body.faults.length + ' faults');
  check('checklist: names the school and engineer', !!v.body.school_name && !!v.body.engineer_name,
    v.body.school_name + ' / ' + v.body.engineer_name);

  // Closing a fault inside a visit must behave like closing it anywhere.
  const first = v.body.faults[0];
  await send('PATCH', '/api/errors/' + first.id + '/status', { status: 'resolved' });
  const listed = await get('/api/visits');
  const mine = listed.body.find(x => x.id === visitId);
  check('checklist: progress reflects a closed fault', mine.closed_faults === 1,
    mine.closed_faults + '/' + mine.attached_faults);
  const [audit] = await pool.query(
    "SELECT action FROM audit_log WHERE entity_type='error' AND entity_id = ? ORDER BY id DESC LIMIT 1", [first.id]);
  check('checklist: closing inside a visit leaves the normal audit trail',
    audit.length === 1 && audit[0].action === 'error.status_changed', audit[0] && audit[0].action);

  // --- cancelling releases the work ---
  const cancelled = await send('PATCH', '/api/visits/' + visitId, { status: 'cancelled' });
  check('cancel: releases the still-open faults back to the queue',
    cancelled.body.released_faults >= 2, 'released=' + cancelled.body.released_faults);
  const [stillAttached] = await pool.query(
    "SELECT COUNT(*) n FROM errors WHERE visit_id = ? AND status <> 'resolved'", [visitId]);
  check('cancel: no open fault is left filed under a trip nobody made',
    Number(stillAttached[0].n) === 0, stillAttached[0].n + ' still attached');
  const [closedKept] = await pool.query(
    "SELECT COUNT(*) n FROM errors WHERE visit_id = ? AND status = 'resolved'", [visitId]);
  check('cancel: the fault that WAS closed stays on the record',
    Number(closedKept[0].n) === 1, closedKept[0].n + ' kept');

  const q3 = await get('/api/visits/queue');
  check('queue: the school is plannable again after a cancellation',
    q3.body.find(r => r.school_id === A.id).planned_visit_id == null);

  // --- completing ---
  const again = await send('POST', '/api/visits', { school_id: A.id, planned_for: iso(1), notes: MARK + ' second' });
  const done = await send('PATCH', '/api/visits/' + again.body.id, { status: 'done', notes: MARK + ' left the router for the ISP' });
  check('complete: marks the visit done', done.status === 200);
  const [[row]] = await pool.query('SELECT status, completed_at, notes FROM visits WHERE id = ?', [again.body.id]);
  check('complete: stamps completed_at', row.status === 'done' && row.completed_at != null);
  check('complete: keeps the note about what was not finished',
    /left the router for the ISP/.test(row.notes || ''), row.notes);

  const badStatus = await send('PATCH', '/api/visits/' + again.body.id, { status: 'maybe' });
  check('update: rejects an unknown status', badStatus.status === 400, badStatus.body.error);

  // --- access control ---
  const [subs] = await pool.query("SELECT id, username FROM users WHERE role = 'subadmin' LIMIT 1");
  if (subs.length) {
    const subLogin = await fetch(BASE + '/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: subs[0].username, password: 'admin123' })
    }).then(r => r.json());
    if (subLogin.token) {
      const subH = { Authorization: 'Bearer ' + subLogin.token };
      const [[owned]] = await pool.query(
        'SELECT COUNT(*) n FROM schools WHERE assigned_admin_id = ?', [subs[0].id]);
      const subQ = await fetch(BASE + '/api/visits/queue', { headers: subH }).then(r => r.json());
      check('scope: a sub-admin sees only their own schools',
        subQ.length === Number(owned.n), subQ.length + ' of ' + owned.n + ' assigned');
      const notMine = await fetch(BASE + '/api/visits/suggestions/' + A.id, { headers: subH })
        .then(async r => ({ status: r.status }));
      const isTheirs = subQ.some(r => r.school_id === A.id);
      check('scope: suggestions for another engineer\'s school are refused',
        isTheirs ? notMine.status === 200 : notMine.status === 403,
        isTheirs ? 'school A is theirs (200 expected)' : 'HTTP ' + notMine.status);
    } else { console.log('  SKIP  sub-admin scope (could not sign in)'); }
  } else { console.log('  SKIP  sub-admin scope (no sub-admin in this database)'); }

  // A throwaway school-role account, so this is a real 403 from the real
  // middleware rather than a skipped assertion. Removed below.
  const bcrypt = require('bcryptjs');
  const tempPw = 'VisitTest!' + Date.now();
  const [tmp] = await pool.query(
    `INSERT INTO users (username, email, password_hash, full_name, role, school_id, status, approval_status)
     VALUES (?, ?, ?, ?, 'school', ?, 'active', 'approved')`,
    [MARK + '-user', MARK + '@example.invalid', await bcrypt.hash(tempPw, 10), MARK + ' School Admin', A.id]
  );
  const sl = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: MARK + '-user', password: tempPw })
  }).then(r => r.json());
  if (sl.token) {
    const sh = { Authorization: 'Bearer ' + sl.token };
    const r1 = await fetch(BASE + '/api/visits/queue', { headers: sh });
    check('scope: a school admin cannot reach the planner', r1.status === 403, 'HTTP ' + r1.status);
    const r2 = await fetch(BASE + '/api/visits/suggestions/' + A.id, { headers: sh });
    check('scope: nor its suggestions, even for their own school', r2.status === 403, 'HTTP ' + r2.status);
    const r3 = await fetch(BASE + '/api/visits', {
      method: 'POST', headers: { ...sh, 'Content-Type': 'application/json' },
      body: JSON.stringify({ school_id: A.id, planned_for: iso(1) })
    });
    check('scope: nor plan a visit', r3.status === 403, 'HTTP ' + r3.status);
  } else {
    check('scope: could sign in as the temporary school admin', false, JSON.stringify(sl).slice(0, 90));
  }
  const r0 = await fetch(BASE + '/api/visits/queue');
  check('scope: an unauthenticated request is rejected', r0.status === 401, 'HTTP ' + r0.status);
  await pool.query('DELETE FROM users WHERE id = ?', [tmp.insertId]);

  console.log('\n  cleanup:');
  await pool.query('DELETE FROM visits WHERE notes LIKE ?', [MARK + '%']);
  await cleanup();
  const [[e]] = await pool.query('SELECT COUNT(*) n FROM errors');
  const [[vv]] = await pool.query('SELECT COUNT(*) n FROM visits');
  const [[tt]] = await pool.query('SELECT COUNT(*) n FROM tablets');
  console.log(`    errors=${e.n} visits=${vv.n} tablets=${tt.n}`);

  console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
  await pool.end();
  process.exit(fail ? 1 : 0);
})().catch(async e => { console.error(e); try { await cleanup(); } catch {} process.exit(1); });
