/**
 * Verification — SEC-017: teacher registration is throttled, per link.
 * 2026-09-26.
 *
 * The limiter meant for teacher registration was mounted on
 * '/api/register/teacher/register'. No route has that path: teachers register
 * at POST /api/register/teacher/:token. So it never ran, and the endpoint had
 * no throttle at all. Found while writing the joining guide (D35).
 *
 * Checks that the limiter now sits on the real route, that it is per link (a
 * staffroom on one network is not locked out of a second link), and that
 * every registration throttle in server.js names a path a route actually has.
 *
 * Run from backend/:
 *   VERIFY_BASE=http://localhost:3211 node scripts/verify-registration-limits.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const pool = require('../src/config/database');
const fixtures = require('./lib/fixtures');

const BASE = process.env.VERIFY_BASE || 'http://localhost:3100';

let passed = 0, failed = 0;
function ok(name, cond, detail) {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail !== undefined ? ' — ' + JSON.stringify(detail).slice(0, 300) : ''}`); }
}
async function api(method, p, { token, body } = {}) {
  const res = await fetch(BASE + '/api' + p, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  let json = null;
  try { json = await res.json(); } catch (e) {}
  return { status: res.status, body: json };
}

(async () => {
  console.log('\nRegistration limits verification (SEC-017)');
  console.log('='.repeat(52));

  console.log('\n1. Every registration throttle names a real route (source)');
  const server = fs.readFileSync(path.join(__dirname, '..', 'src', 'server.js'), 'utf8');
  const routes = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'registration.js'), 'utf8');
  const mounts = [...server.matchAll(/app\.(?:use|post)\('\/api\/register(\/[^']*)',\s*(\w*[Rr]egistration\w*Limiter)\)/g)]
    .map(m => ({ path: m[1], limiter: m[2] }));
  ok('the throttles are found', mounts.length >= 2, mounts);
  for (const m of mounts) {
    ok(`${m.path} is a route in routes/registration.js`, routes.includes(`router.post('${m.path}'`), m);
  }
  ok('the dead mount is gone', !/app\.use\('\/api\/register\/teacher\/register'/.test(server));
  const limit = Number((server.match(/TEACHER_REGISTRATION_LIMIT = (\d+);/) || [])[1]);
  ok('teacher limit is roomy enough for a staffroom (>= 20)', limit >= 20, limit);

  console.log('\n2. In practice');
  const fx = await fixtures.ensure();
  const linkIds = [];
  try {
    const s = await fixtures.signIn(fx.schoolAdmin.username, fx.password, BASE);
    const mk = async () => {
      const r = await api('POST', '/register/teacher-links', { token: s.token, body: { max_uses: 3 } });
      if (r.body && r.body.id) linkIds.push(r.body.id);
      return r.body && r.body.token;
    };
    const a = await mk();
    ok('a fresh link', typeof a === 'string' && a.length === 64);
    // Empty forms: refused before any account or hash is made, but they count.
    const codes = [];
    for (let i = 0; i < limit; i++) codes.push((await api('POST', `/register/teacher/${a}`, { body: {} })).status);
    ok(`the first ${limit} attempts are answered (400: form incomplete)`, codes.every(c => c === 400), [...new Set(codes)]);
    const over = await api('POST', `/register/teacher/${a}`, { body: {} });
    ok(`attempt ${limit + 1} on the same link is throttled (429)`, over.status === 429, over.status);
    const b = await mk();
    const other = await api('POST', `/register/teacher/${b}`, { body: {} });
    ok('another link from the same network is not (per link, not per network)', other.status === 400, other.status);
    const verify = await api('GET', `/register/verify/${a}`);
    ok('checking the link is not throttled with it', verify.status === 200, verify.status);
    const [[row]] = await pool.query('SELECT use_count FROM registration_links WHERE token = ?', [a]);
    ok('and none of it used up a place on the link', row.use_count === 0, row.use_count);
  } finally {
    if (linkIds.length) await pool.query('DELETE FROM registration_links WHERE id IN (?)', [linkIds]);
    await fixtures.cleanup();
    console.log('\n' + '='.repeat(52));
    console.log(`  ${passed} passed, ${failed} failed`);
    await pool.end();
    process.exit(failed ? 1 : 0);
  }
})().catch(async (e) => {
  console.error('\nSUITE ERROR:', e.message);
  try { await pool.end(); } catch (x) {}
  process.exit(1);
});
