/**
 * Verification — token algorithm and cross-origin policy (ASVS V9, V4 · DECISIONS.md D26).
 *
 *  SEC-013  jwt.verify() was called without `algorithms`, so a token signed
 *           with ANY HMAC algorithm under our secret was a session: HS512 and
 *           HS384 were accepted next to the HS256 we issue. Not a hole on its
 *           own (it still needs the secret) — but "which algorithms do we
 *           trust" was answered by the library's defaults, not by us.
 *  SEC-014  In production with FRONTEND_URL unset, CORS reflected every
 *           Origin, so any website's script got an Access-Control-Allow-Origin
 *           answer. The SPA is same-origin and every integration is
 *           server-to-server: nobody else needs one.
 *
 * Runs against a live local server; creates only fixture accounts, removes them.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const jwt = require('jsonwebtoken');
const pool = require('../src/config/database');
const fixtures = require('./lib/fixtures');

const BASE = process.env.VERIFY_BASE || 'http://localhost:3210';
let passed = 0, failed = 0;
function ok(name, cond, detail) {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail !== undefined ? ' — ' + JSON.stringify(detail) : ''}`); }
}
const profile = (token) => fetch(BASE + '/api/auth/profile', { headers: { Authorization: 'Bearer ' + token } }).then(r => r.status);

(async () => {
  try {
    const fx = await fixtures.ensure();
    const [[u]] = await pool.query('SELECT id, role, username, token_version FROM users WHERE id = ?', [fx.teacher.userId]);
    const claims = { id: u.id, role: u.role, username: u.username, tv: u.token_version || 0 };
    const secret = process.env.JWT_SECRET;

    console.log('\nSEC-013  only the algorithm we issue is a session');
    ok('control: an HS256 token (what we issue) is accepted', await profile(jwt.sign(claims, secret, { algorithm: 'HS256', expiresIn: '5m' })) === 200);
    for (const alg of ['HS384', 'HS512']) {
      const s = await profile(jwt.sign(claims, secret, { algorithm: alg, expiresIn: '5m' }));
      ok(`an ${alg} token under the same secret is refused (401)`, s === 401, s);
    }
    const none = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url') + '.' +
      Buffer.from(JSON.stringify({ ...claims, exp: Math.floor(Date.now() / 1000) + 300 })).toString('base64url') + '.';
    ok('an unsigned ("alg": "none") token is refused (401)', await profile(none) === 401);

    // Every verify site, present and future — the two-step ticket included — must
    // pass the pinned options. Read from the source, as verify-frontend-safety does.
    const fs = require('fs'), path = require('path');
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap(e =>
      e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.js') ? [path.join(d, e.name)] : []);
    const calls = walk(path.join(__dirname, '..', 'src')).flatMap(f =>
      (fs.readFileSync(f, 'utf8').match(/jwt\.verify\((?!\))[^;]*/g) || []).map(c => ({ f: path.basename(f), c })));
    const loose = calls.filter(x => !/JWT_VERIFY\)/.test(x.c));
    ok(`every jwt.verify() in src/ passes the pinned algorithms (${calls.length} call sites)`, calls.length >= 2 && !loose.length, loose);

    console.log('\nSEC-014  other websites get no cross-origin answer in production');
    const { corsOrigin } = require('../src/config/httpPolicy');
    ok('production, FRONTEND_URL unset → same origin only (no CORS header for anyone)', corsOrigin({ NODE_ENV: 'production' }) === false);
    ok('production, FRONTEND_URL set → exactly those origins',
      JSON.stringify(corsOrigin({ NODE_ENV: 'production', FRONTEND_URL: 'https://a.example, https://b.example' })) === '["https://a.example","https://b.example"]');
    ok('development → any origin, never with credentials', corsOrigin({ NODE_ENV: 'development' }) === '*');
    // The running server is whatever mode it was started in; in either mode an
    // arbitrary site must not be granted credentials.
    const r = await fetch(BASE + '/api/health', { headers: { Origin: 'https://evil.example' } });
    const allow = r.headers.get('access-control-allow-origin');
    const creds = r.headers.get('access-control-allow-credentials');
    ok('the live server never grants credentials to an arbitrary website', !(allow === 'https://evil.example' && creds === 'true'), { allow, creds });
    const same = await fetch(BASE + '/api/health');
    ok('same-origin requests still work', same.ok);
  } finally {
    await fixtures.cleanup();
    console.log(`\n${'='.repeat(52)}\n  ${passed} passed, ${failed} failed`);
    await pool.end();
    process.exitCode = failed ? 1 : 0;
  }
})().catch(async e => { console.error('\nSUITE ERROR:', e.message); try { await pool.end(); } catch (x) {} process.exitCode = 1; });
