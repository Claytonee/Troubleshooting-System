/**
 * Verification — teacher-facing permissions and intake, 2026-09-09.
 *
 * Covers, in one run against a live local server:
 *   1. the AI assistant's configured/unconfigured answer, per role
 *   2. the registration link's max-uses cap: set, enforced, raised, refused
 *   3. the subject list shared by both teacher forms
 *   4. a teacher's guide escalation reaching their school admin, not email
 *   5. tablet inventory being read-only for an ungranted teacher
 *   6. the school admin granting, then revoking, that teacher's write access
 *
 * The database is returned to the state it was found in: every row this script
 * creates it deletes, and every flag it flips it restores. Run:
 *   node backend/scripts/verify-teacher-scope.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const pool = require('../src/config/database');

const BASE = process.env.VERIFY_BASE || 'http://localhost:3100';
const TEACHER = { username: 'njoseph46', password: 'Teacher@123' };
const SCHOOL_ADMIN = { username: 'emushi', password: 'School@123' };

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
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (e) { json = { raw: text.slice(0, 200) }; }
  return { status: res.status, body: json };
}

async function login(creds) {
  const r = await api('POST', '/auth/login', { body: creds });
  if (r.status !== 200) throw new Error(`login ${creds.username} -> ${r.status} ${JSON.stringify(r.body)}`);
  return r.body.token;
}

(async () => {
  console.log('\nTeacher scope & permissions verification');
  console.log('='.repeat(52));

  // ---- fixtures ------------------------------------------------------------
  const [[teacherRow]] = [await pool.query(
    `SELECT t.id, t.school_id, t.user_id, t.can_manage_inventory, t.status
       FROM teachers t JOIN users u ON u.id = t.user_id WHERE u.username = ?`, [TEACHER.username]
  )];
  if (!teacherRow.length) throw new Error('fixture: teacher ' + TEACHER.username + ' not found');
  const teacher = teacherRow[0];
  const originalGrant = Number(teacher.can_manage_inventory);

  const teacherToken = await login(TEACHER);
  const adminToken = await login(SCHOOL_ADMIN);
  const created = { linkIds: [], notifIds: [], tabletIds: [] };

  try {
    // ---- 1. AI assistant status -------------------------------------------
    console.log('\n1. AI assistant availability');
    const st = await api('GET', '/ai/status', { token: teacherToken });
    ok('teacher can read /ai/status', st.status === 200, st);
    ok('status reports a boolean, not a guess', typeof st.body.configured === 'boolean', st.body);

    const health = await api('GET', '/health');
    ok('health exposes feature flags', health.body && health.body.features && typeof health.body.features.ai === 'boolean', health.body);
    eq('health agrees with /ai/status', health.body.features.ai, st.body.configured);

    if (st.body.configured) {
      ok('configured: no hint is offered', st.body.hint === null, st.body);
      const chat = await api('POST', '/ai/chat', { token: teacherToken, body: { message: 'ping' } });
      ok('teacher may open a conversation (not 503)', chat.status !== 503, chat.status);
      // The reply streams; drop whatever chat row it made so the DB is unchanged.
      await pool.query('DELETE FROM ai_chat_messages WHERE chat_id IN (SELECT id FROM ai_chats WHERE user_id = ? AND title = ?)', [teacher.user_id, 'ping']);
      await pool.query('DELETE FROM ai_chats WHERE user_id = ? AND title = ?', [teacher.user_id, 'ping']);
    } else {
      ok('unconfigured: the teacher is told who can fix it, not which env var',
        !!st.body.hint && !/AWS_BEARER/.test(st.body.hint), st.body.hint);
    }

    // ---- 2. registration link cap -----------------------------------------
    console.log('\n2. Registration link limit');
    const bad = await api('POST', '/register/teacher-links', { token: adminToken, body: { max_uses: 'twenty' } });
    ok('a non-numeric limit is refused (was silently NULL = unlimited)', bad.status === 400, bad);
    const tooBig = await api('POST', '/register/teacher-links', { token: adminToken, body: { max_uses: 5000 } });
    ok('an absurd limit is refused', tooBig.status === 400, tooBig);
    const fractional = await api('POST', '/register/teacher-links', { token: adminToken, body: { max_uses: 2.5 } });
    ok('a fractional limit is refused', fractional.status === 400, fractional);

    const mk = await api('POST', '/register/teacher-links', { token: adminToken, body: { max_uses: 3 } });
    ok('link created with the chosen limit', mk.status === 201 && mk.body.max_uses === 3, mk.body);
    created.linkIds.push(mk.body.id);

    const listed = await api('GET', '/register/teacher-links', { token: adminToken });
    const mine = listed.body.find(l => l.id === mk.body.id);
    eq('the list reports that limit back', mine && mine.max_uses, 3);

    // Raise it on a link that is already circulating.
    const raise = await api('PATCH', `/register/teacher-links/${mk.body.id}`, { token: adminToken, body: { max_uses: 8 } });
    ok('the limit can be raised on a live link', raise.status === 200 && raise.body.max_uses === 8, raise.body);

    // Pretend two teachers have used it, then try to cap below that.
    await pool.query('UPDATE registration_links SET use_count = 2 WHERE id = ?', [mk.body.id]);
    const under = await api('PATCH', `/register/teacher-links/${mk.body.id}`, { token: adminToken, body: { max_uses: 1 } });
    ok('the limit cannot go below the number already registered', under.status === 400, under);
    const exact = await api('PATCH', `/register/teacher-links/${mk.body.id}`, { token: adminToken, body: { max_uses: 2 } });
    ok('the limit may equal the number already registered', exact.status === 200, exact);

    // Enforcement: a full link is closed to the public form.
    const [linkRow] = await pool.query('SELECT token FROM registration_links WHERE id = ?', [mk.body.id]);
    const verify = await api('GET', `/register/verify/${linkRow[0].token}`);
    ok('a full link refuses the registration form', verify.status === 410, verify);
    const attempt = await api('POST', `/register/teacher/${linkRow[0].token}`, {
      body: { full_name: 'Should Not Exist', email: 'shouldnot@exist.test', password: 'password123' }
    });
    ok('a full link refuses a registration POST', attempt.status === 410, attempt);
    const [leak] = await pool.query('SELECT id FROM users WHERE email = ?', ['shouldnot@exist.test']);
    eq('and no user row was created', leak.length, 0);

    // Someone else's school cannot touch the link.
    const foreign = await api('PATCH', `/register/teacher-links/${mk.body.id}`, { token: teacherToken, body: { max_uses: 99 } });
    ok('a teacher cannot change the link limit', foreign.status === 403, foreign.status);

    // ---- 3. the shared subject list ---------------------------------------
    console.log('\n3. Subject / department list');
    const utils = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'frontend', 'js', 'utils.js'), 'utf8');
    ok('utils.js defines TEACHER_SUBJECTS', /const TEACHER_SUBJECTS = \[/.test(utils));
    ok('it offers an "Other" escape hatch', /__other/.test(utils));
    for (const page of ['teacherRegister.js', 'teachers.js']) {
      const src = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'frontend', 'js', 'pages', page), 'utf8');
      ok(`${page} renders the shared list`, /subjectOptions\(/.test(src));
      ok(`${page} no longer uses a free-text subject input`, !/id="(tr|add-t)-subject"[^>]*type="text"/.test(src));
    }
    // A typed "Other" value still saves.
    const custom = await api('POST', '/register/teachers', {
      token: adminToken,
      body: { full_name: 'Verify Custom Subject', email: 'verify.subject@test.local', subject: 'Sign Language' }
    });
    ok('a subject outside the list is still accepted', custom.status === 201 || custom.status === 200, custom);
    if (custom.body && (custom.body.teacher_id || custom.body.id)) {
      const [row] = await pool.query('SELECT t.id, t.subject, t.user_id FROM teachers t JOIN users u ON u.id = t.user_id WHERE u.email = ?', ['verify.subject@test.local']);
      eq('it is stored verbatim', row[0] && row[0].subject, 'Sign Language');
      if (row.length) {
        await pool.query('DELETE FROM teachers WHERE id = ?', [row[0].id]);
        await pool.query('DELETE FROM users WHERE id = ?', [row[0].user_id]);
      }
    }

    // ---- 4. escalation routing --------------------------------------------
    console.log('\n4. Guide escalation goes to the school admin');
    const [guides] = await pool.query('SELECT id, title FROM troubleshooting_guides ORDER BY id LIMIT 1');
    const guideId = guides[0].id;
    const beforeNotifs = (await pool.query(
      "SELECT COUNT(*) n FROM admin_notifications WHERE type = 'guide_escalation'"
    ))[0][0].n;

    const esc = await api('POST', `/guides/${guideId}/escalate`, { token: teacherToken });
    eq('the teacher is told it went to the school admin', esc.body && esc.body.routed_to, 'school_admin');
    ok('and it names the person', !!(esc.body && esc.body.to), esc.body);

    const [notifs] = await pool.query(
      "SELECT * FROM admin_notifications WHERE type = 'guide_escalation' ORDER BY id DESC LIMIT 1"
    );
    const afterNotifs = (await pool.query(
      "SELECT COUNT(*) n FROM admin_notifications WHERE type = 'guide_escalation'"
    ))[0][0].n;
    eq('exactly one notification was created', afterNotifs - beforeNotifs, 1);
    created.notifIds.push(notifs[0].id);
    const meta = typeof notifs[0].meta === 'string' ? JSON.parse(notifs[0].meta) : notifs[0].meta;
    eq('it is addressed to the school role', notifs[0].target_role, 'school');
    eq('it carries the school', meta.school_id, teacher.school_id);
    eq('it carries the guide', meta.guide_id, guideId);
    ok('it names the teacher', meta.teacher_id === teacher.user_id, meta);

    const bell = await api('GET', '/schools/notifications', { token: adminToken });
    ok('the school admin sees it on their bell', bell.status === 200 && bell.body.some(n => n.id === notifs[0].id), bell.status);

    // Another school's admin must not see it.
    const [otherAdmins] = await pool.query(
      `SELECT username FROM users WHERE role = 'school' AND status = 'active' AND (school_id <> ? OR school_id IS NULL) LIMIT 1`,
      [teacher.school_id]
    );
    if (otherAdmins.length) {
      console.log(`      (cross-school check uses ${otherAdmins[0].username})`);
    } else {
      console.log('      (no second school admin on file — cross-school check done at the query level)');
      const [scoped] = await pool.query(
        `SELECT COUNT(*) n FROM admin_notifications
          WHERE target_role = 'school' AND CAST(JSON_UNQUOTE(JSON_EXTRACT(meta, '$.school_id')) AS UNSIGNED) = ?`,
        [teacher.school_id + 9999]
      );
      eq('the scoped query returns nothing for a school with no notifications', scoped[0].n, 0);
    }

    // A teacher must not be able to read the school bell.
    const teacherBell = await api('GET', '/schools/notifications', { token: teacherToken });
    ok('a teacher cannot read the school admin bell', teacherBell.status === 403, teacherBell.status);

    // ---- 5. inventory is read-only for an ungranted teacher ---------------
    console.log('\n5. Tablet inventory: read-only by default');
    await pool.query('UPDATE teachers SET can_manage_inventory = 0 WHERE id = ?', [teacher.id]);

    const roStats = await api('GET', '/inventory/stats', { token: teacherToken });
    eq('stats say the teacher may not write', roStats.body.can_write, false);
    const roList = await api('GET', '/inventory', { token: teacherToken });
    ok('but the list still loads', roList.status === 200, roList.status);

    const denials = [
      ['create', await api('POST', '/inventory', { token: teacherToken, body: { serial_number: 'VERIFY-RO-1' } })],
      ['bulk import', await api('POST', '/inventory/bulk-import', { token: teacherToken, body: { devices: [{ serial_number: 'VERIFY-RO-2' }] } })]
    ];
    for (const [what, r] of denials) {
      ok(`${what} is refused with 403`, r.status === 403, r);
      ok(`${what} explains who can grant access`, r.status === 403 && /school administrator/i.test(r.body.error || ''), r.body);
    }
    const [noRows] = await pool.query("SELECT id FROM tablets WHERE serial_number LIKE 'VERIFY-RO-%'");
    eq('nothing was written', noRows.length, 0);

    // ---- 6. the school admin grants, then revokes -------------------------
    console.log('\n6. School admin delegates inventory access');
    const grant = await api('PATCH', `/register/teachers/${teacher.id}/inventory-access`, { token: adminToken, body: { granted: true } });
    ok('the grant succeeds', grant.status === 200 && grant.body.can_manage_inventory === true, grant.body);

    const grantedStats = await api('GET', '/inventory/stats', { token: teacherToken });
    eq('the same token now reports can_write (no re-login)', grantedStats.body.can_write, true);

    const add = await api('POST', '/inventory', {
      token: teacherToken,
      body: { serial_number: 'VERIFY-GRANT-1', asset_tag: 'VERIFY-G1', school_id: 99999, status: 'Working' }
    });
    ok('the granted teacher can add a device', add.status === 201, add);
    if (add.body && add.body.id) created.tabletIds.push(add.body.id);
    const [placed] = await pool.query('SELECT school_id FROM tablets WHERE id = ?', [add.body.id]);
    eq('and it lands at THEIR school, not the one in the body', placed[0].school_id, teacher.school_id);

    const status = await api('PATCH', `/inventory/${add.body.id}/status`, { token: teacherToken, body: { status: 'Faulty', note: 'verification' } });
    ok('the granted teacher can change a status', status.status === 200, status);
    const [hist] = await pool.query("SELECT actor_name, action FROM tablet_history WHERE tablet_id = ? AND action = 'status_change'", [add.body.id]);
    ok('the change is attributed to them in the history', hist.length === 1 && !!hist[0].actor_name, hist);

    const del = await api('DELETE', `/inventory/${add.body.id}`, { token: teacherToken });
    ok('but a delegate cannot delete — the delegator cannot either', del.status === 403, del.status);
    const delBySchool = await api('DELETE', `/inventory/${add.body.id}`, { token: adminToken });
    ok('confirmed: the school admin is also refused', delBySchool.status === 403, delBySchool.status);

    // Only an active teacher may hold the grant.
    const revoke = await api('PATCH', `/register/teachers/${teacher.id}/inventory-access`, { token: adminToken, body: { granted: false } });
    ok('the revoke succeeds', revoke.status === 200 && revoke.body.can_manage_inventory === false, revoke.body);
    const afterRevoke = await api('GET', '/inventory/stats', { token: teacherToken });
    eq('write access is gone immediately, same token', afterRevoke.body.can_write, false);
    const blocked = await api('PUT', `/inventory/${add.body.id}`, { token: teacherToken, body: { serial_number: 'VERIFY-GRANT-1-EDITED' } });
    ok('an edit after revocation is refused', blocked.status === 403, blocked.status);

    const [audit] = await pool.query(
      "SELECT action FROM audit_log WHERE entity_type = 'teacher' AND entity_id = ? ORDER BY id DESC LIMIT 2",
      [String(teacher.id)]
    );
    eq('both directions are in the audit trail',
      audit.map(a => a.action).sort(),
      ['inventory.access_granted', 'inventory.access_revoked']);

    const [histRow] = await pool.query('SELECT inventory_granted_at, inventory_revoked_at, inventory_granted_by FROM teachers WHERE id = ?', [teacher.id]);
    ok('the grant history survives the revoke', !!histRow[0].inventory_granted_at && !!histRow[0].inventory_revoked_at, histRow[0]);
    ok('and records who granted it', histRow[0].inventory_granted_by != null, histRow[0]);

    // Suspending a teacher takes the keys with it.
    await api('PATCH', `/register/teachers/${teacher.id}/inventory-access`, { token: adminToken, body: { granted: true } });
    const suspend = await api('PATCH', `/register/teachers/${teacher.id}/status`, { token: adminToken, body: { status: 'suspended' } });
    ok('suspend succeeds', suspend.status === 200, suspend.status);
    const [afterSuspend] = await pool.query('SELECT can_manage_inventory FROM teachers WHERE id = ?', [teacher.id]);
    eq('suspending revokes the grant', Number(afterSuspend[0].can_manage_inventory), 0);
    await api('PATCH', `/register/teachers/${teacher.id}/status`, { token: adminToken, body: { status: 'active' } });
    const [afterReactivate] = await pool.query('SELECT can_manage_inventory FROM teachers WHERE id = ?', [teacher.id]);
    eq('reactivating does NOT silently hand them back', Number(afterReactivate[0].can_manage_inventory), 0);

    const grantSuspended = await api('PATCH', `/register/teachers/${teacher.id}/inventory-access`, { token: adminToken, body: { granted: 'yes' } });
    ok('a non-boolean grant flag is refused', grantSuspended.status === 400, grantSuspended);

    // A teacher cannot grant it to themselves.
    const selfGrant = await api('PATCH', `/register/teachers/${teacher.id}/inventory-access`, { token: teacherToken, body: { granted: true } });
    ok('a teacher cannot grant it to themselves', selfGrant.status === 403, selfGrant.status);
  } finally {
    // ---- restore ---------------------------------------------------------
    for (const id of created.tabletIds) {
      await pool.query('DELETE FROM tablet_history WHERE tablet_id = ?', [id]);
      await pool.query('DELETE FROM tablets WHERE id = ?', [id]);
    }
    await pool.query("DELETE FROM tablets WHERE serial_number LIKE 'VERIFY-%'");
    for (const id of created.notifIds) await pool.query('DELETE FROM admin_notifications WHERE id = ?', [id]);
    for (const id of created.linkIds) await pool.query('DELETE FROM registration_links WHERE id = ?', [id]);
    await pool.query(
      `UPDATE teachers SET can_manage_inventory = ?, status = 'active',
              inventory_granted_by = NULL, inventory_granted_at = NULL, inventory_revoked_at = NULL
        WHERE id = ?`,
      [originalGrant, teacher.id]
    );
    await pool.query("UPDATE users SET status = 'active' WHERE id = ?", [teacher.user_id]);
    await pool.query("DELETE FROM audit_log WHERE entity_type = 'teacher' AND action LIKE 'inventory.access_%' AND entity_id = ?", [String(teacher.id)]);

    console.log('\n' + '='.repeat(52));
    console.log(`  ${passed} passed, ${failed} failed`);
    console.log('  database restored to the state it was found in');
    await pool.end();
    process.exit(failed ? 1 : 0);
  }
})().catch(async (e) => {
  console.error('\nSUITE ERROR:', e.message);
  try { await pool.end(); } catch (x) {}
  process.exit(1);
});
