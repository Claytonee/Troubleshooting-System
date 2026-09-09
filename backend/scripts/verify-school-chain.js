/**
 * Verification — the school chain: routing, resolved-error visibility, ratings.
 * 2026-09-09.
 *
 * Reported from the field:
 *   - a teacher's fault "ilienda moja kwa moja kwa platform admin" instead of
 *     passing through their school administrator;
 *   - a resolved fault was visible only as a dashboard row a teacher could not
 *     open;
 *   - the satisfaction rating was offered to the platform admin, when it should
 *     be the teacher's and the school admin's answer.
 *
 * Restores everything it creates. Run from backend/:
 *   node scripts/verify-school-chain.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const pool = require('../src/config/database');

const BASE = process.env.VERIFY_BASE || 'http://localhost:3100';
const fixtures = require('./lib/fixtures');
const PLATFORM_ADMIN = { username: process.env.VERIFY_ADMIN_USER || 'admin', password: process.env.VERIFY_ADMIN_PASS || 'admin123' };
let TEACHER, SCHOOL_ADMIN;

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

async function login(creds) {
  const r = await api('POST', '/auth/login', { body: creds });
  if (r.status !== 200) throw new Error(`login ${creds.username} -> ${r.status} ${JSON.stringify(r.body)}`);
  return r.body.token;
}

(async () => {
  console.log('\nSchool chain verification');
  console.log('='.repeat(52));

  const created = { errorIds: [], notifIds: [] };
  // Provisioned, not borrowed: these suites used to depend on two accounts that
  // happened to exist locally, and broke the day the database was reseeded.
  const fx = await fixtures.ensure();
  TEACHER = { username: fx.teacher.username, password: fx.password };
  SCHOOL_ADMIN = { username: fx.schoolAdmin.username, password: fx.password };
  const teacherToken = await login(TEACHER);
  const adminToken = await login(SCHOOL_ADMIN);
  let platformToken = null;
  try { platformToken = await login(PLATFORM_ADMIN); }
  catch (e) { console.log('  (no platform admin credentials — platform-side checks will be skipped)'); }

  const teacherUser = { id: fx.teacher.userId, school_id: fx.school.id };
  const [[sch]] = [await pool.query('SELECT assigned_admin_id FROM schools WHERE id = ?', [teacherUser.school_id])];
  const fieldEngineer = sch[0].assigned_admin_id;
  console.log(`  fixtures: teacher user ${teacherUser.id}, school ${teacherUser.school_id}, field engineer ${fieldEngineer === null ? '(none)' : fieldEngineer}`);

  try {
    // ---- 1. a teacher's report stops at the school -------------------------
    console.log('\n1. A teacher\'s report goes to the school administrator');
    const rep = await api('POST', '/errors', {
      token: teacherToken,
      body: { title: 'VERIFY chain — projector will not start', description: 'Verification row.',
              school_id: teacherUser.school_id, category: 'Hardware', priority: 'medium' }
    });
    ok('the report is accepted', rep.status === 201, rep);
    created.errorIds.push(rep.body.id);

    const [row] = await pool.query('SELECT assigned_to, escalation_level, status, reported_by_user_id FROM errors WHERE id = ?', [rep.body.id]);
    eq('it is NOT assigned to the field engineer', row[0].assigned_to, null);
    eq('it sits at school level', row[0].escalation_level, 'school');
    eq('it is open', row[0].status, 'open');
    eq('it records who reported it', row[0].reported_by_user_id, teacherUser.id);

    const [notif] = await pool.query(
      "SELECT * FROM admin_notifications WHERE type = 'error_reported' ORDER BY id DESC LIMIT 1"
    );
    ok('the school admin gets a notification', notif.length > 0, notif.length);
    if (notif.length) {
      created.notifIds.push(notif[0].id);
      const meta = typeof notif[0].meta === 'string' ? JSON.parse(notif[0].meta) : notif[0].meta;
      eq('addressed to the school role', notif[0].target_role, 'school');
      eq('scoped to their school', meta.school_id, teacherUser.school_id);
      eq('and carries the fault', meta.error_id, rep.body.id);
    }
    const bell = await api('GET', '/schools/notifications', { token: adminToken });
    ok('it is on the school admin\'s bell', bell.status === 200 && bell.body.some(n => n.type === 'error_reported'), bell.status);

    // The school admin escalating is what hands it to the engineer.
    const esc = await api('POST', `/errors/${rep.body.id}/escalate`, {
      token: adminToken, body: { reason: 'Beyond school capacity', note: 'verification' }
    });
    ok('the school admin can escalate it', esc.status === 200 || esc.status === 201, esc);
    const [after] = await pool.query('SELECT assigned_to, escalation_level, status FROM errors WHERE id = ?', [rep.body.id]);
    eq('escalation raises the level', after[0].escalation_level, 'platform');
    eq('and NOW it is assigned to the field engineer', after[0].assigned_to, fieldEngineer);
    eq('status reflects the escalation', after[0].status, 'escalated');

    // ---- 2. critical is the one exception ---------------------------------
    console.log('\n2. Critical does not wait for a human');
    const crit = await api('POST', '/errors', {
      token: teacherToken,
      body: { title: 'VERIFY chain — no internet in the whole school', description: 'Verification row.',
              school_id: teacherUser.school_id, category: 'Connectivity', priority: 'critical' }
    });
    ok('accepted', crit.status === 201, crit);
    created.errorIds.push(crit.body.id);
    const [critRow] = await pool.query('SELECT assigned_to, escalation_level FROM errors WHERE id = ?', [crit.body.id]);
    eq('a critical fault is assigned immediately', critRow[0].assigned_to, fieldEngineer);
    eq('at platform level', critRow[0].escalation_level, 'platform');
    const [critNotif] = await pool.query(
      "SELECT message FROM admin_notifications WHERE type = 'error_reported' ORDER BY id DESC LIMIT 1"
    );
    ok('and the school admin is still told, and told why', /critical/i.test(critNotif[0].message), critNotif[0].message);
    const [cn] = await pool.query("SELECT id FROM admin_notifications WHERE type = 'error_reported' ORDER BY id DESC LIMIT 1");
    created.notifIds.push(cn[0].id);

    // ---- 3. a school admin's own report still goes up ---------------------
    console.log('\n3. A school admin\'s own report goes straight to platform');
    const own = await api('POST', '/errors', {
      token: adminToken,
      body: { title: 'VERIFY chain — school admin report', description: 'Verification row.',
              school_id: teacherUser.school_id, category: 'Platform', priority: 'high' }
    });
    ok('accepted', own.status === 201, own);
    created.errorIds.push(own.body.id);
    const [ownRow] = await pool.query('SELECT assigned_to, escalation_level FROM errors WHERE id = ?', [own.body.id]);
    eq('assigned to the engineer', ownRow[0].assigned_to, fieldEngineer);
    eq('at platform level — there is nobody below them', ownRow[0].escalation_level, 'platform');
    const [ownNotif] = await pool.query(
      "SELECT COUNT(*) n FROM admin_notifications WHERE type = 'error_reported' AND JSON_UNQUOTE(JSON_EXTRACT(meta, '$.error_id')) = ?",
      [String(own.body.id)]
    );
    eq('no notification to themselves', ownNotif[0].n, 0);

    // ---- 4. the teacher can see and open a resolved fault -----------------
    console.log('\n4. A resolved fault stays visible to the teacher');
    const resolved = await api('PATCH', `/errors/${rep.body.id}/status`, { token: adminToken, body: { status: 'resolved' } });
    ok('the school admin resolves it', resolved.status === 200, resolved);

    const listAll = await api('GET', '/errors', { token: teacherToken });
    ok('the teacher\'s list still contains it', listAll.status === 200 && listAll.body.some(e => e.id === rep.body.id), listAll.status);
    const listResolved = await api('GET', '/errors?status=resolved', { token: teacherToken });
    ok('and it is there under the resolved filter', listResolved.body.some(e => e.id === rep.body.id), listResolved.body.length);
    const detail = await api('GET', `/errors/${rep.body.id}`, { token: teacherToken });
    eq('the teacher can open it in full', detail.status, 200);
    ok('with its update trail', Array.isArray(detail.body.updates), typeof detail.body.updates);

    // Somebody else's fault stays invisible.
    const [other] = await pool.query(
      'SELECT id FROM errors WHERE (reported_by_user_id IS NULL OR reported_by_user_id <> ?) LIMIT 1', [teacherUser.id]
    );
    if (other.length) {
      const denied = await api('GET', `/errors/${other[0].id}`, { token: teacherToken });
      eq('a fault they did not report is still refused', denied.status, 403);
    }

    // ---- 5. who may rate --------------------------------------------------
    console.log('\n5. Rating belongs to the teacher and the school admin');
    eq('the reporter is offered the rating', detail.body.can_rate, true);
    ok('and is given a token to do it with', typeof detail.body.csat_token === 'string' && detail.body.csat_token.length > 10, detail.body.csat_token);

    const adminView = await api('GET', `/errors/${rep.body.id}`, { token: adminToken });
    eq('the school admin may rate too', adminView.body.can_rate, true);
    ok('and gets a token', !!adminView.body.csat_token, adminView.body.csat_token);

    if (platformToken) {
      const platformView = await api('GET', `/errors/${rep.body.id}`, { token: platformToken });
      eq('the platform admin may NOT rate', platformView.body.can_rate, false);
      eq('and is given no token at all', platformView.body.csat_token, undefined);
    }

    // The list endpoint never carries a token, for anybody.
    const anyToken = (listAll.body || []).some(e => 'csat_token' in e);
    eq('no list row carries a rating token', anyToken, false);

    // Rating it works, once.
    const rated = await api('POST', `/errors/csat/${detail.body.csat_token}`, { body: { rating: 4, comment: 'VERIFY comment' } });
    eq('the rating is accepted', rated.status, 200);
    const [ratedRow] = await pool.query('SELECT csat_rating, csat_comment FROM errors WHERE id = ?', [rep.body.id]);
    eq('and stored', Number(ratedRow[0].csat_rating), 4);
    const afterRating = await api('GET', `/errors/${rep.body.id}`, { token: teacherToken });
    eq('the list/detail now shows the score', Number(afterRating.body.csat_rating), 4);

    // ---- 6. a teacher does not close their own ticket ---------------------
    console.log('\n6. A teacher reports and rates; they do not close');
    const [open2] = await pool.query('SELECT id FROM errors WHERE id = ?', [crit.body.id]);
    const teacherResolve = await api('PATCH', `/errors/${open2[0].id}/status`, { token: teacherToken, body: { status: 'resolved' } });
    eq('the API refuses a teacher closing their own fault', teacherResolve.status, 403);
    eq('with a reason they can act on', teacherResolve.body.code, 'TEACHER_CANNOT_SET_STATUS');
    const viaPut = await api('PUT', `/errors/${open2[0].id}`, { token: teacherToken, body: { title: 'VERIFY chain — via put', description: 'x', category: 'Hardware', priority: 'low', status: 'resolved' } });
    eq('and the full-edit door is closed too', viaPut.status, 403);
    const [stillOpen] = await pool.query('SELECT status FROM errors WHERE id = ?', [open2[0].id]);
    ok('the fault is still open', stillOpen[0].status !== 'resolved', stillOpen[0].status);
    ok('the UI no longer offers Resolve to a teacher (checked in the source)',
      /!\(user && user\.role === 'teacher'\)/.test(require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'frontend', 'js', 'app.js'), 'utf8')));
    const trackerSrc = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'frontend', 'js', 'pages', 'tracker.js'), 'utf8');
    ok('nor in the tracker row actions', /!isTeacher\(\)/.test(trackerSrc));
    ok('the tracker is reachable by a teacher', /staff-teacher/.test(
      require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'frontend', 'index.html'), 'utf8')));
    ok('and gated for the hash route as well', /staffTeacherPages/.test(
      require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'frontend', 'js', 'router.js'), 'utf8')));

    // ---- 7. the offline queue keeps its photos ---------------------------
    console.log('\n7. The offline queue carries attachments');
    const offlineSrc = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'frontend', 'js', 'offline.js'), 'utf8');
    ok('records hold their files', /files,/.test(offlineSrc) && /budgetFiles/.test(offlineSrc));
    ok('replay is multipart when there are files', /new FormData\(\)/.test(offlineSrc) && /append\('attachments'/.test(offlineSrc));
    ok('and the Content-Type header is left to the browser',
      /if \(!item\.files \|\| !item\.files\.length\)/.test(offlineSrc));
    const reportSrc = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'frontend', 'js', 'pages', 'report.js'), 'utf8');
    ok('photos are downscaled before being queued', /shrinkImage/.test(reportSrc));
    ok('the old "attachments were not kept" message is gone', !/Attachments were not kept/.test(reportSrc));
    const appSrc = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'frontend', 'js', 'app.js'), 'utf8');
    ok('the pending-sync banner is mounted by the shell, not one page', /mountQueueBanner/.test(appSrc));

    // A multipart POST with a client_ref still de-duplicates (the replay path).
    const ref = 'verify-chain-' + Date.now();
    const form = new FormData();
    form.append('title', 'VERIFY chain — multipart replay');
    form.append('description', 'Verification row.');
    form.append('school_id', String(teacherUser.school_id));
    form.append('category', 'Hardware');
    form.append('priority', 'low');
    form.append('client_ref', ref);
    form.append('attachments', new Blob([Buffer.from('not-a-real-photo')], { type: 'text/plain' }), 'evidence.txt');
    const send = () => fetch(BASE + '/api/errors', { method: 'POST', headers: { Authorization: 'Bearer ' + teacherToken }, body: form });
    const first = await send();
    const firstBody = await first.json();
    ok('a multipart report is accepted', first.status === 201, { status: first.status, firstBody });
    if (firstBody.id) created.errorIds.push(firstBody.id);
    const second = await send();
    const secondBody = await second.json();
    eq('replaying the same client_ref does not file it twice', secondBody.deduplicated, true);
    const [dupes] = await pool.query('SELECT COUNT(*) n FROM errors WHERE client_ref = ?', [ref]);
    eq('exactly one row for that client_ref', dupes[0].n, 1);
  } finally {
    for (const id of created.errorIds) {
      await pool.query('DELETE FROM error_attachments WHERE error_id = ?', [id]);
      await pool.query('DELETE FROM error_updates WHERE error_id = ?', [id]);
      await pool.query('DELETE FROM errors WHERE id = ?', [id]);
    }
    await pool.query("DELETE FROM errors WHERE title LIKE 'VERIFY chain%'");
    for (const id of created.notifIds) await pool.query('DELETE FROM admin_notifications WHERE id = ?', [id]);
    await pool.query("DELETE FROM admin_notifications WHERE type = 'error_reported'");
    await pool.query("DELETE FROM audit_log WHERE summary LIKE '%VERIFY chain%'");
    await fixtures.cleanup();

    console.log('\n' + '='.repeat(52));
    console.log(`  ${passed} passed, ${failed} failed`);
    const [base] = await pool.query('SELECT COUNT(*) errors, SUM(status = "resolved") resolved FROM errors');
    console.log(`  database: ${base[0].errors} errors, ${base[0].resolved} resolved`);
    await pool.end();
    process.exit(failed ? 1 : 0);
  }
})().catch(async (e) => {
  console.error('\nSUITE ERROR:', e.message);
  try { await pool.end(); } catch (x) {}
  process.exit(1);
});
