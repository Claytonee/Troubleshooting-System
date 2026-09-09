/**
 * Verification — who sees what. 2026-09-09.
 *
 * Asked for after a platform admin found the AI Assistant in their sidebar.
 * This suite pins the whole matrix down in one place: for each role, which API
 * endpoints answer and which refuse, and whether the sidebar and the hash-route
 * guard agree with each other.
 *
 * The two halves both matter. A nav marker with no matching entry in
 * `applyRoleVisibility()`'s page arrays hides the link and still lets the hash
 * through — that is how `#team` rendered for every role. And a page hidden in
 * the nav whose endpoint still answers is a permission hole with a polite face.
 *
 * Run from backend/:  node scripts/verify-role-matrix.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('../src/config/database');
const fixtures = require('./lib/fixtures');

const BASE = process.env.VERIFY_BASE || 'http://localhost:3100';
const FRONTEND = path.join(__dirname, '..', '..', 'frontend');

let passed = 0, failed = 0;
function ok(name, cond, detail) {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail !== undefined ? ' — ' + JSON.stringify(detail) : ''}`); }
}

async function api(method, p, token) {
  const res = await fetch(BASE + '/api' + p, {
    method,
    headers: token ? { Authorization: 'Bearer ' + token } : {}
  });
  return res.status;
}

async function login(username, password) {
  const res = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (res.status !== 200) throw new Error(`login ${username} -> ${res.status}`);
  return (await res.json()).token;
}

/**
 * READ endpoints and who may reach them. `true` = must answer 2xx,
 * `false` = must be refused (403). Written as the product rule, not as a copy
 * of the code, so a change in either has to be a deliberate edit here.
 */
const MATRIX = [
  // path,                     admin, subadmin, school, teacher
  ['/dashboard',                true,  true,  true,  true],
  ['/errors',                   true,  true,  true,  true],
  ['/guides',                   true,  true,  true,  true],
  ['/manuals',                  true,  true,  true,  true],
  ['/inventory',                true,  true,  true,  true],
  ['/inventory/stats',          true,  true,  true,  true],
  ['/search?q=wifi',            true,  true,  true,  true],
  ['/settings',                 true,  true,  true,  true],

  // The assistant is for whoever is in front of the equipment — not head office.
  ['/ai/status',                false, true,  true,  true],
  ['/ai/chats',                 false, true,  true,  true],

  // Management views.
  ['/analytics/trends',         true,  true,  true,  false],
  ['/schools',                  true,  true,  true,  false],
  ['/checkins',                 true,  true,  true,  false],
  ['/communications',           true,  true,  true,  false],
  ['/schools/notifications',    true,  true,  true,  false],

  // Head office only.
  ['/team',                     true,  false, false, false],
  ['/school-admins',            true,  false, false, false],
  ['/audit',                    true,  false, false, false],
  ['/lrs',                      true,  false, false, false],
  ['/register/approvals/pending', true, false, false, false],

  // Whoever drives out to schools.
  ['/visits/queue',             true,  true,  false, false],

  // The school's own staff list.
  ['/register/teachers',        false, false, true,  false],
  ['/register/teacher-links',   false, false, true,  false]
];

const ROLES = ['admin', 'subadmin', 'school', 'teacher'];

(async () => {
  console.log('\nRole matrix verification');
  console.log('='.repeat(56));

  const fx = await fixtures.ensure();
  const tokens = {};

  // Head office + an engineer: reset a password, use it, put the old hash back.
  const restore = [];
  for (const role of ['admin', 'subadmin']) {
    const [rows] = await pool.query('SELECT id, username, password_hash FROM users WHERE role = ? LIMIT 1', [role]);
    if (!rows.length) { console.log(`  (no ${role} account in this database — its column is skipped)`); continue; }
    const hash = await bcrypt.hash(fixtures.PASSWORD, 10);
    restore.push({ id: rows[0].id, hash: rows[0].password_hash });
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, rows[0].id]);
    tokens[role] = await login(rows[0].username, fixtures.PASSWORD);
  }
  tokens.school = await login(fx.schoolAdmin.username, fixtures.PASSWORD);
  tokens.teacher = await login(fx.teacher.username, fixtures.PASSWORD);

  try {
    console.log('\n1. API — who each endpoint answers');
    for (const [p, ...expect] of MATRIX) {
      for (let i = 0; i < ROLES.length; i++) {
        const role = ROLES[i];
        if (!tokens[role]) continue;
        const allowed = expect[i];
        const status = await api('GET', p, tokens[role]);
        const answered = status >= 200 && status < 300;
        // 404 is an answer: the role got through and there was simply no row.
        const reached = answered || status === 404;
        ok(`${role.padEnd(8)} ${allowed ? 'may   ' : 'may NOT'} GET ${p}`,
          allowed ? reached : status === 403,
          { status });
      }
    }

    console.log('\n2. Unauthenticated requests are refused');
    for (const p of ['/errors', '/ai/status', '/inventory', '/team', '/analytics/trends']) {
      ok(`no token: ${p}`, (await api('GET', p)) === 401);
    }

    console.log('\n3. Sidebar markers and hash guards agree');
    const html = fs.readFileSync(path.join(FRONTEND, 'index.html'), 'utf8');
    const router = fs.readFileSync(path.join(FRONTEND, 'js', 'router.js'), 'utf8');

    // Every nav item that carries a role marker...
    const marked = [...html.matchAll(/data-page="([a-z]+)"[^>]*data-role="([a-z-]+)"/g)]
      .map(m => ({ page: m[1], marker: m[2] }));
    ok('nav items carry role markers', marked.length > 10, marked.length);

    // ...must appear in the page array that matches its marker, or the hash
    // still reaches the page.
    const ARRAY_FOR = {
      admin: 'adminPages', school: 'schoolPages', subadmin: 'subadminPages',
      staff: 'staffPages', 'staff-teacher': 'staffTeacherPages',
      field: 'fieldPages', 'no-admin': 'noAdminPages', 'school-teacher': null
    };
    for (const { page, marker } of marked) {
      const arrayName = ARRAY_FOR[marker];
      if (arrayName === null) continue;      // report: every role may file one
      if (!arrayName) { ok(`marker "${marker}" is known`, false, { page, marker }); continue; }
      const arr = (router.match(new RegExp(arrayName + "\\s*=\\s*\\[([^\\]]*)\\]")) || [])[1] || '';
      ok(`#${page} (${marker}) is guarded by ${arrayName}`, arr.includes(`'${page}'`), { arrayName, arr: arr.trim() });
    }

    // Every page array must actually be consulted.
    for (const name of ['adminPages', 'schoolPages', 'subadminPages', 'staffPages', 'staffTeacherPages', 'fieldPages', 'noAdminPages']) {
      ok(`${name} is used in a redirect`, new RegExp(name + '\\.includes\\(currentPage\\)').test(router));
    }

    console.log('\n4. The assistant is gone from head office, front and back');
    ok('the nav item is marked no-admin', /data-page="chat"[^>]*data-role="no-admin"/.test(html));
    ok('and #chat redirects an admin away', /noAdminPages\s*=\s*\[[^\]]*'chat'/.test(router));
    const aiRoute = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'aiChat.js'), 'utf8');
    ok('the route no longer authorizes admin', !/authorize\([^)]*'admin'/.test(aiRoute), aiRoute.match(/authorize\([^)]*\)/)[0]);
  } finally {
    for (const r of restore) await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [r.hash, r.id]);
    await fixtures.cleanup();
    console.log('\n' + '='.repeat(56));
    console.log(`  ${passed} passed, ${failed} failed`);
    console.log('  passwords restored, fixtures removed');
    await pool.end();
    process.exit(failed ? 1 : 0);
  }
})().catch(async (e) => {
  console.error('\nSUITE ERROR:', e.message);
  try { await pool.end(); } catch (x) {}
  process.exit(1);
});
