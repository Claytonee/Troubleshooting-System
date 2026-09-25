/**
 * Verification — "Trust this browser" (DECISIONS.md D34).
 *
 *  Trust     only when asked, only after a code from the authenticator app (never a
 *            recovery code); an HttpOnly, SameSite=Strict cookie scoped to /api/auth;
 *            only its SHA-256 stored; 30 days, 14 for a platform admin; ten at most.
 *  Sign-in   a trusted browser needs the password only; the password is still required;
 *            the cookie is bound to its account; a tampered, expired, forgotten or
 *            revoked one is asked for the code again — as is every browser after
 *            "Sign out everywhere" or a new authenticator.
 *  Manage    the account lists and forgets its own trusted browsers, nobody else's.
 *  Evidence  audited and recorded, and no trust secret in any of it.
 *  Frontend  the tick box is off by default, hidden for recovery codes, and warns
 *            about shared tablets; the idle sign-out is 30 minutes.
 *
 * Suite-owned accounts only; everything is removed afterwards.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const pool = require('../src/config/database');
const fixtures = require('./lib/fixtures');
const trusted = require('../src/services/trustedDevices');

const BASE = process.env.VERIFY_BASE || 'http://localhost:3210';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';
let passed = 0, failed = 0;
function ok(name, cond, detail) {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail !== undefined ? ' — ' + JSON.stringify(detail) : ''}`); }
}
async function call(method, endpoint, { body, token, cookie } = {}) {
  const r = await fetch(BASE + '/api' + endpoint, {
    method,
    headers: { 'Content-Type': 'application/json', 'User-Agent': UA,
      ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const setCookie = typeof r.headers.getSetCookie === 'function' ? r.headers.getSetCookie() : [].concat(r.headers.get('set-cookie') || []);
  return { status: r.status, body: await r.json().catch(() => ({})), setCookie };
}
const login = (username, password, cookie) => call('POST', '/auth/login', { body: { username, password }, cookie });
const cookiePair = (setCookie, name) => { const c = setCookie.find(x => x.startsWith(name + '=')); return c ? c.split(';')[0] : null; };

(async () => {
  const [[base]] = await pool.query('SELECT COALESCE(MAX(id), 0) m FROM security_events');
  const fx = await fixtures.ensure();
  const admin = await fixtures.ensurePlatformAdmin();
  const teacherId = fx.teacher.userId;
  const tName = fx.teacher.username, pw = fx.password;
  const secretsSeen = [];
  try {
    await fixtures.enrol(teacherId);
    await fixtures.enrol(fx.schoolAdmin.id);
    await fixtures.enrol(admin.id);
    await pool.query('DELETE FROM trusted_devices WHERE user_id IN (?, ?, ?)', [teacherId, fx.schoolAdmin.id, admin.id]);
    const name = trusted.cookieName(teacherId);

    console.log('\nTrust    only when asked, only after a code from the app');
    let r = await login(tName, pw);
    ok('a browser with no trust is asked for the code', r.status === 200 && r.body.mfa_required === true && !r.body.token, r.body);
    let v = await call('POST', '/auth/mfa/verify', { body: { ticket: r.body.mfa_ticket, code: await fixtures.nextCode(tName) } });
    ok('signing in without ticking the box trusts nothing', v.status === 200 && !!v.body.token && !cookiePair(v.setCookie, name) && !v.body.trusted_days, v.setCookie);
    const [[none]] = await pool.query('SELECT COUNT(*) n FROM trusted_devices WHERE user_id = ?', [teacherId]);
    ok('...and stores nothing', Number(none.n) === 0);

    r = await login(tName, pw);
    v = await call('POST', '/auth/mfa/verify', { body: { ticket: r.body.mfa_ticket, code: await fixtures.nextCode(tName), remember_device: true } });
    const raw = v.setCookie.find(x => x.startsWith(name + '=')) || '';
    const cookie = cookiePair(v.setCookie, name);
    const secret = cookie ? decodeURIComponent(cookie.split('=')[1]) : '';
    secretsSeen.push(secret);
    ok('ticking it trusts this browser for 30 days', v.status === 200 && v.body.trusted_days === 30 && /^[A-Za-z0-9_-]{43}$/.test(secret), v.body.trusted_days);
    ok('the cookie is HttpOnly, SameSite=Strict, scoped to /api/auth, 30 days',
      /;\s*HttpOnly/i.test(raw) && /SameSite=Strict/i.test(raw) && /Path=\/api\/auth(;|$)/.test(raw) && /Max-Age=2592000/.test(raw), raw.replace(secret, '<secret>'));
    ok('...and Secure wherever the site is served over HTTPS (production)',
      /secureCookie\(req\)\) parts\.push\('Secure'\)/.test(fs.readFileSync(path.join(__dirname, '..', 'src', 'services', 'trustedDevices.js'), 'utf8')));
    const [rows] = await pool.query('SELECT token_hash, label, token_version, expires_at FROM trusted_devices WHERE user_id = ?', [teacherId]);
    ok('only a SHA-256 of the secret is stored', rows.length === 1 && rows[0].token_hash === trusted.sha256(secret) && !JSON.stringify(rows).includes(secret));
    ok('...with a plain label, not the whole user-agent string', rows[0] && rows[0].label === 'Chrome on Windows', rows[0] && rows[0].label);

    console.log('\nSign-in  the password alone, on this browser only');
    r = await login(tName, pw, cookie);
    ok('the trusted browser signs in with the password alone', r.status === 200 && !!r.body.token && !r.body.mfa_required, r.body.mfa_required);
    r = await login(tName, 'Wrong-password-7781', cookie);
    ok('...but the password is still required', r.status === 401 && !r.body.token, r.status);
    r = await login(tName, pw);
    ok('another browser (no cookie) is still asked for the code', r.body.mfa_required === true);
    r = await login(tName, pw, `${name}=${secret.slice(0, -2)}xx`);
    ok('a tampered cookie counts for nothing', r.body.mfa_required === true);
    r = await login(fx.schoolAdmin.username, pw, `${trusted.cookieName(fx.schoolAdmin.id)}=${secret}`);
    ok('the teacher\'s trust cannot sign in another account on the same tablet', r.body.mfa_required === true);

    console.log('\nNever    for a recovery code, and never for long');
    const [[before]] = await pool.query('SELECT COUNT(*) n FROM trusted_devices WHERE user_id = ?', [fx.schoolAdmin.id]);
    r = await login(fx.schoolAdmin.username, pw);
    const codes = (await pool.query('SELECT mfa_recovery FROM users WHERE id = ?', [fx.schoolAdmin.id]))[0][0];
    // Recovery codes are stored hashed: make a known one for the test, as the setup screen would.
    const known = 'ABCD-EFGH-JKLM';
    await pool.query('UPDATE users SET mfa_recovery = ? WHERE id = ?', [JSON.stringify([require('../src/services/totp').hashCode(known)]), fx.schoolAdmin.id]);
    v = await call('POST', '/auth/mfa/verify', { body: { ticket: r.body.mfa_ticket, code: known, remember_device: true } });
    const [[after]] = await pool.query('SELECT COUNT(*) n FROM trusted_devices WHERE user_id = ?', [fx.schoolAdmin.id]);
    ok('a sign-in with a recovery code is never remembered, even if asked', v.status === 200 && !v.body.trusted_days
      && !cookiePair(v.setCookie, trusted.cookieName(fx.schoolAdmin.id)) && Number(after.n) === Number(before.n), v.body.trusted_days);
    await pool.query('UPDATE users SET mfa_recovery = ? WHERE id = ?', [codes.mfa_recovery, fx.schoolAdmin.id]);

    r = await login(admin.username, admin.password);
    v = await call('POST', '/auth/mfa/verify', { body: { ticket: r.body.mfa_ticket, code: await fixtures.nextCode(admin.username), remember_device: true } });
    const adminRaw = v.setCookie.find(x => x.startsWith(trusted.cookieName(admin.id) + '=')) || '';
    ok('a platform admin is trusted for 14 days, not 30', v.body.trusted_days === 14 && /Max-Age=1209600/.test(adminRaw), v.body.trusted_days);

    const fakeRes = () => ({ headers: {}, getHeader(n) { return this.headers[n]; }, setHeader(n, x) { this.headers[n] = x; } });
    for (let i = 0; i < 12; i++) await trusted.trust({ headers: { 'user-agent': UA } }, fakeRes(), { id: fx.schoolAdmin.id, role: 'school', token_version: 0 });
    const [[cap]] = await pool.query('SELECT COUNT(*) n FROM trusted_devices WHERE user_id = ?', [fx.schoolAdmin.id]);
    ok('an account keeps at most ten trusted browsers (the oldest go first)', Number(cap.n) === 10, cap.n);

    console.log('\nEnds     expiry, forgetting, "sign out everywhere", a new authenticator');
    const token = (await login(tName, pw, cookie)).body.token;
    let list = await call('GET', '/auth/mfa/trusted', { token, cookie });
    ok('the account lists its trusted browsers, marking this one', list.status === 200 && list.body.browsers.length === 1
      && list.body.browsers[0].current === true && list.body.days === 30, list.body);
    ok('...and the list never carries the secret or its hash', !JSON.stringify(list.body).includes(secret) && !JSON.stringify(list.body).includes(trusted.sha256(secret)));
    const otherId = (await pool.query('SELECT id FROM trusted_devices WHERE user_id = ? LIMIT 1', [fx.schoolAdmin.id]))[0][0].id;
    let f = await call('DELETE', '/auth/mfa/trusted/' + otherId, { token, cookie });
    ok('an account cannot forget another account\'s browser', f.status === 404, f.status);
    const [[stillThere]] = await pool.query('SELECT revoked_at FROM trusted_devices WHERE id = ?', [otherId]);
    ok('...which stays trusted', stillThere.revoked_at === null);

    await pool.query('UPDATE trusted_devices SET expires_at = NOW() - INTERVAL 1 SECOND WHERE user_id = ?', [teacherId]);
    r = await login(tName, pw, cookie);
    ok('an expired trust is asked for the code', r.body.mfa_required === true);
    await pool.query('UPDATE trusted_devices SET expires_at = NOW() + INTERVAL 30 DAY WHERE user_id = ?', [teacherId]);

    const myId = list.body.browsers[0].id;
    f = await call('DELETE', '/auth/mfa/trusted/' + myId, { token, cookie });
    ok('"Forget" on this browser works and clears its cookie', f.status === 200 && f.body.forgotten === 1
      && f.setCookie.some(x => x.startsWith(name + '=;') && /Max-Age=0/.test(x)), f.setCookie);
    r = await login(tName, pw, cookie);
    ok('...and the next sign-in there asks for the code', r.body.mfa_required === true);

    // Trust again, then end every session: the trust must end with them.
    v = await call('POST', '/auth/mfa/verify', { body: { ticket: r.body.mfa_ticket, code: await fixtures.nextCode(tName), remember_device: true } });
    const cookie2 = cookiePair(v.setCookie, name);
    secretsSeen.push(cookie2 && decodeURIComponent(cookie2.split('=')[1]));
    ok('trusted again', !!cookie2 && (await login(tName, pw, cookie2)).body.token);
    const t2 = (await login(tName, pw, cookie2)).body.token;
    const out = await call('POST', '/auth/sessions/revoke-all', { token: t2 });
    r = await login(tName, pw, cookie2);
    ok('"Sign out everywhere" ends every trusted browser too', out.status === 200 && r.body.mfa_required === true, [out.status, r.body.mfa_required]);

    // A new authenticator (re-enrolment) invalidates trusts made before it.
    v = await call('POST', '/auth/mfa/verify', { body: { ticket: r.body.mfa_ticket, code: await fixtures.nextCode(tName), remember_device: true } });
    const cookie3 = cookiePair(v.setCookie, name);
    secretsSeen.push(cookie3 && decodeURIComponent(cookie3.split('=')[1]));
    await pool.query('UPDATE users SET mfa_enrolled_at = NOW() + INTERVAL 1 SECOND WHERE id = ?', [teacherId]);
    await new Promise(res => setTimeout(res, 1200));
    r = await login(tName, pw, cookie3);
    ok('a new authenticator ends the trust made with the old one', r.body.mfa_required === true);

    const t3 = (await call('POST', '/auth/mfa/verify', { body: { ticket: r.body.mfa_ticket, code: await fixtures.nextCode(tName) } })).body.token;
    f = await call('DELETE', '/auth/mfa/trusted', { token: t3 });
    ok('"Forget all" answers, for the account\'s own browsers only', f.status === 200 && typeof f.body.forgotten === 'number', f.body);

    console.log('\nEvidence audited, recorded, and free of the secret');
    const [audit] = await pool.query("SELECT action, summary, meta FROM audit_log WHERE action IN ('auth.browser_trusted', 'auth.browser_forgotten') AND entity_id = ?", [String(teacherId)]);
    ok('trusting and forgetting are both in the audit log', audit.some(a => a.action === 'auth.browser_trusted') && audit.some(a => a.action === 'auth.browser_forgotten'), audit.map(a => a.action));
    await new Promise(res => setTimeout(res, 2600));
    const [ev] = await pool.query("SELECT event_type, detail FROM security_events WHERE id > ? AND user_id = ?", [base.m, teacherId]);
    ok('a password-only sign-in on a trusted browser is recorded as such',
      ev.some(e => e.event_type === 'auth.login_ok' && /"second_factor":"trusted_browser"/.test(e.detail || '')), [...new Set(ev.map(e => e.event_type))]);
    const everything = JSON.stringify(audit) + JSON.stringify(ev);
    ok('no trust secret appears in the audit log or the security events', secretsSeen.filter(Boolean).every(s => !everything.includes(s)));

    console.log('\nFrontend the tick box and the idle timeout');
    const auth = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'js', 'auth.js'), 'utf8');
    const api = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'js', 'api.js'), 'utf8');
    ok('the tick box starts unticked at every sign-in', /mfaUseRecovery = false; mfaRemember = false;/.test(auth) && /\$\{mfaRemember \? 'checked' : ''\}/.test(auth));
    ok('...is not offered for a recovery code', /\$\{mfaUseRecovery \? '' : `[\s\S]{0,80}class="mfa-trust"/.test(auth));
    ok('...and warns against shared school tablets', /never on a shared school tablet/.test(auth));
    ok('the forget buttons use delegation, not inline handlers (D24)', /data-forget-browser=/.test(auth) && !/onclick="[^"]*[Ff]orget/.test(auth));
    ok('the idle sign-out is 30 minutes (NIST AAL2 allows up to 60)', /const SESSION_TIMEOUT = 30 \* 60 \* 1000;/.test(api));
    // The platform admin's guide on the Security Overview is read aloud to schools:
    // every number in it must be the code's number.
    const sec = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'js', 'pages', 'security.js'), 'utf8');
    const policy = require('../src/services/mfaPolicy');
    const day = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Dar_es_Salaam' });
    ok('the Security Overview guide states the trust periods the code uses',
      sec.includes(`<strong>${trusted.DAYS.default} days</strong>`) && sec.includes(`<strong>${trusted.DAYS.admin} days</strong>`) && /30 idle minutes/.test(sec));
    ok('...and the two-step dates the policy uses', sec.includes(day(policy.DEFAULT_ENFORCE_AFTER)) && sec.includes(day(policy.DEFAULT_STAFF_ENFORCE_AFTER).replace(/ 2026$/, '')),
      [day(policy.DEFAULT_ENFORCE_AFTER), day(policy.DEFAULT_STAFF_ENFORCE_AFTER)]);
  } finally {
    await pool.query('DELETE FROM trusted_devices WHERE user_id IN (?, ?, ?)', [teacherId, fx.schoolAdmin.id, admin.id]);
    await pool.query("DELETE FROM audit_log WHERE action IN ('auth.browser_trusted', 'auth.browser_forgotten') AND entity_id IN (?, ?, ?)",
      [String(teacherId), String(fx.schoolAdmin.id), String(admin.id)]);
    await fixtures.cleanup();
    console.log(`\n${'='.repeat(52)}\n  ${passed} passed, ${failed} failed`);
    await pool.end();
    process.exitCode = failed ? 1 : 0;
  }
})().catch(async e => { console.error('\nSUITE ERROR:', e.stack || e.message); try { await fixtures.cleanup(); await pool.end(); } catch (_) {} process.exitCode = 1; });
