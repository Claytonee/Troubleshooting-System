/**
 * Verification — no published password works, anywhere (SEC-016, DECISIONS.md D29).
 *
 * This repository is public and printed `admin123` (the seeded accounts) and
 * `changeme123` (what a blank password field gave a new account). These checks:
 *
 *   Sign-in   username AND password both printed (the seed): refused (403
 *             PUBLISHED_PASSWORD) before any session or two-step ticket. A printed
 *             password on a private username (real teachers used them daily): signs
 *             in but must choose a new one first. Both are high-severity evidence and
 *             open incident R9. A guessable "Teacher@1234" also forces a change.
 *   Setting   no path accepts a published password: create, reset, change.
 *   Blank     every "leave blank" path returns a random temporary password, once,
 *             and the account must change it at first sign-in.
 *   Source    every bcrypt.hash() in the controllers goes through the policy, and no
 *             published password appears in the server code outside the policy itself.
 *
 * Needs the local server; zzverify* accounts only, all removed.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('../src/config/database');
const fixtures = require('./lib/fixtures');
const passwords = require('../src/services/passwords');

const BASE = process.env.VERIFY_BASE || 'http://localhost:3210';
let passed = 0, failed = 0;
function ok(name, cond, detail) {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail !== undefined ? ' — ' + JSON.stringify(detail) : ''}`); }
}
async function api(method, p, { token, body } = {}) {
  const r = await fetch(BASE + '/api' + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => null) };
}
const login = (username, password) => api('POST', '/auth/login', { body: { username, password } });
const TEMP = /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;
const mustChange = async (username) => Number((await pool.query('SELECT must_change_password m FROM users WHERE username = ?', [username]))[0][0]?.m);

async function account(suffix, password, role = 'subadmin') {
  const username = fixtures.PREFIX + suffix;
  await pool.query('DELETE FROM users WHERE username = ?', [username]);
  await pool.query(`INSERT INTO users (username, email, password_hash, full_name, role, status, approval_status, must_change_password)
    VALUES (?, ?, ?, ?, ?, 'active', 'approved', 0)`, [username, username + '@verify.local', await bcrypt.hash(password, 10), 'Verify ' + suffix, role]);
  return username;
}

(async () => {
  const [[evBase]] = await pool.query('SELECT COALESCE(MAX(id), 0) AS m FROM security_events');
  const [[incStart]] = await pool.query('SELECT COALESCE(MAX(id), 0) AS m FROM security_incidents');
  try {
    const fx = await fixtures.ensure();
    const pa = await fixtures.ensurePlatformAdmin();
    const admin = (await login(pa.username, pa.password)).body.token;
    const schoolAdmin = (await login(fx.schoolAdmin.username, fx.password)).body.token;

    console.log('\nSign-in  published username AND password: refused before anything is issued');
    // The real risk case: a seeded account (username printed) that STILL has a printed
    // password. A refused sign-in changes nothing, so testing it touches no data.
    const [seeded] = await pool.query("SELECT id, username, password_hash, must_change_password m, token_version tv FROM users WHERE username IN (?) AND (status IS NULL OR status <> 'inactive')", [[...passwords.PUBLISHED_USERNAMES]]);
    let pair = null;
    for (const s of seeded) for (const pw of passwords.PUBLISHED) if (!pair && await bcrypt.compare(pw, s.password_hash)) pair = { ...s, pw };
    if (pair) {
      const r = await login(pair.username, pair.pw);
      ok(`"${pair.username}" on a printed password (both printed): refused with 403 PUBLISHED_PASSWORD`, r.status === 403 && r.body.code === 'PUBLISHED_PASSWORD', r.status);
      ok('...no session and no two-step ticket in the answer', !r.body.token && !r.body.mfa_ticket);
      ok('...and the answer says what to do', /platform administrator to reset/i.test(r.body.error || ''));
      const [[after]] = await pool.query('SELECT must_change_password m, token_version tv FROM users WHERE id = ?', [pair.id]);
      ok('...and the refused account was not changed in any way', Number(after.m) === Number(pair.m) && Number(after.tv) === Number(pair.tv));
    } else {
      console.log('  note  no seeded account here still has a printed password (a fresh install seeds random ones): the refusal branch is covered by the pair check below and on any database that has one');
    }
    ok('the published pair list is exactly the seed\'s usernames', ['admin', 'knjoro', 'famani', 'thassan', 'cmbowe'].every(n => passwords.isPublishedPair(n, 'admin123')) && !passwords.isPublishedPair('neema', 'admin123'));

    console.log('\nSign-in  published password, private username: in, but a new password first');
    for (const pw of ['admin123', 'changeme123']) {
      const u = await account('pub' + pw.slice(0, 4), pw, 'teacher');
      const r = await login(u, pw);
      ok(`"${pw}": signs in (a real teacher is not locked out)…`, r.status === 200 && !!r.body.token, r.status);
      ok(`"${pw}": …but must choose a new password first`, r.body.user && r.body.user.must_change_password === true && await mustChange(u) === 1);
    }
    const wrong = await login(fixtures.PREFIX + 'pubadmi', 'not-the-password');
    ok('a wrong password still answers 401, as before', wrong.status === 401);

    const guess = await account('guess', 'Teacher@4821', 'teacher');
    const g = await login(guess, 'Teacher@4821');
    ok('"Teacher@4821" (the old generated pattern) signs in…', g.status === 200 && !!g.body.token, g.status);
    ok('…but must be changed first', g.body.user && g.body.user.must_change_password === true && await mustChange(guess) === 1);

    await require('../src/services/securityEvents').flush();
    await new Promise(r => setTimeout(r, 2600));
    const [ev] = await pool.query("SELECT severity, detail FROM security_events WHERE id > ? AND event_type = 'auth.published_password'", [evBase.m]);
    ok('each refusal is recorded as a high-severity event', ev.length >= 2 && ev.every(e => e.severity === 'high'), ev);
    ok('...and never records the password itself', !ev.some(e => /admin123|changeme123/.test(e.detail || '')));
    const [[incBase]] = await pool.query('SELECT COALESCE(MAX(id), 0) AS m FROM security_incidents');
    await require('../src/services/detection').runOnce();
    const [r9] = await pool.query("SELECT severity FROM security_incidents WHERE id > ? AND rule_id = 'R9'", [incBase.m]);
    ok('rule R9 opens a high incident: someone knew the published password', r9.length >= 1 && r9.every(i => i.severity === 'high'), r9);

    console.log('\nSetting  no path accepts a published or short password');
    const setters = [
      ['create a field engineer', () => api('POST', '/team', { token: admin, body: { username: fixtures.PREFIX + 'fe1', email: fixtures.PREFIX + 'fe1@verify.local', full_name: 'Verify FE', password: 'changeme123' } })],
      ['create a school admin', () => api('POST', '/school-admins', { token: admin, body: { username: fixtures.PREFIX + 'sa1', email: fixtures.PREFIX + 'sa1@verify.local', full_name: 'Verify SA', school_id: fx.school.id, password: 'admin123' } })],
      ['add a teacher by hand', () => api('POST', '/register/teachers', { token: schoolAdmin, body: { full_name: 'Verify T1', email: fixtures.PREFIX + 't1@verify.local', password: 'changeme123' } })],
      ['change one\'s own password', () => api('PUT', '/auth/change-password', { token: (g.body || {}).token, body: { current_password: 'Teacher@4821', new_password: 'admin123' } })],
      ['change to a guessable pattern', () => api('PUT', '/auth/change-password', { token: (g.body || {}).token, body: { current_password: 'Teacher@4821', new_password: 'Teacher@1111' } })],
      ['create with 7 characters', () => api('POST', '/team', { token: admin, body: { username: fixtures.PREFIX + 'fe2', email: fixtures.PREFIX + 'fe2@verify.local', full_name: 'Verify FE2', password: 'Abc1234' } })]
    ];
    for (const [label, call] of setters) {
      const r = await call();
      ok(`${label}: refused (400)`, r.status === 400, r);
    }

    console.log('\nBlank    a random temporary password, shown once, changed at first sign-in');
    const fe = await api('POST', '/team', { token: admin, body: { username: fixtures.PREFIX + 'fe3', email: fixtures.PREFIX + 'fe3@verify.local', full_name: 'Verify FE3' } });
    ok('new field engineer: a temporary password in the answer, in the new format', fe.status === 201 && TEMP.test(fe.body.temporary_password || ''), fe.body);
    const feLogin = await login(fixtures.PREFIX + 'fe3', fe.body.temporary_password);
    ok('...it signs in, and must be changed first', feLogin.status === 200 && feLogin.body.user.must_change_password === true, feLogin.status);
    const reset = await api('PATCH', `/team/${fe.body.id}/reset-password`, { token: admin, body: {} });
    ok('field engineer reset, blank: a new temporary password', reset.status === 200 && TEMP.test(reset.body.password || '') && reset.body.password !== fe.body.temporary_password, reset.body);
    const beforeTypedReset = await login(fixtures.PREFIX + 'fe3', reset.body.password);
    const chosen = 'Verify-reset#4826';
    const typedReset = await api('PATCH', `/team/${fe.body.id}/reset-password`, { token: admin, body: { password: chosen } });
    ok('field engineer reset, typed: succeeds without echoing the password', typedReset.status === 200 && !typedReset.body.password && !JSON.stringify(typedReset.body).includes(chosen), typedReset.body);
    const ended = await api('GET', '/auth/profile', { token: beforeTypedReset.body.token });
    ok('...the session that existed before the typed reset is revoked', ended.status === 401 && ended.body.code === 'SESSION_REVOKED', ended);
    const chosenLogin = await login(fixtures.PREFIX + 'fe3', chosen);
    ok('...the typed password works and must be replaced at next sign-in', chosenLogin.status === 200 && chosenLogin.body.user.must_change_password === true, chosenLogin.status);
    const sa = await api('POST', '/school-admins', { token: admin, body: { username: fixtures.PREFIX + 'sa2', email: fixtures.PREFIX + 'sa2@verify.local', full_name: 'Verify SA2', school_id: fx.school.id } });
    ok('new school admin: a temporary password, must change', sa.status === 201 || sa.status === 200 ? TEMP.test(sa.body.temporary_password || '') && await mustChange(fixtures.PREFIX + 'sa2') === 1 : false, sa);
    const [[saRow]] = await pool.query('SELECT id FROM users WHERE username = ?', [fixtures.PREFIX + 'sa2']);
    const saReset = saRow ? await api('PATCH', `/school-admins/${saRow.id}/password`, { token: admin, body: {} }) : { status: 0, body: {} };
    ok('school admin reset, blank: a temporary password', saReset.status === 200 && TEMP.test(saReset.body.password || ''), saReset.body);
    const schoolChosen = 'Verify-school#7264';
    const saTyped = saRow ? await api('PATCH', `/school-admins/${saRow.id}/password`, { token: admin, body: { new_password: schoolChosen } }) : { status: 0, body: {} };
    ok('school admin reset, typed: succeeds without echoing the password', saTyped.status === 200 && !saTyped.body.password && !JSON.stringify(saTyped.body).includes(schoolChosen), saTyped.body);
    const schoolChosenLogin = await login(fixtures.PREFIX + 'sa2', schoolChosen);
    ok('...the typed school-admin password works and must be replaced at next sign-in', schoolChosenLogin.status === 200 && schoolChosenLogin.body.user.must_change_password === true, schoolChosenLogin.status);
    const t = await api('POST', '/register/teachers', { token: schoolAdmin, body: { full_name: 'Verify T2', email: fixtures.PREFIX + 't2@verify.local' } });
    ok('teacher added by hand: no more "Teacher@1234" — a real temporary password', t.status === 201 && TEMP.test(t.body.temporary_password || ''), t.body);
    const [[tRow]] = await pool.query('SELECT must_change_password m FROM users WHERE email = ?', [fixtures.PREFIX + 't2@verify.local']);
    ok('...and the teacher must change it', tRow && Number(tRow.m) === 1);
    const many = new Set(Array.from({ length: 2000 }, () => passwords.temporary()));
    ok('2,000 temporary passwords: all different, all in the unambiguous alphabet', many.size === 2000 && [...many].every(p => TEMP.test(p)));

    console.log('\nSource   the rule cannot be bypassed by a new code path');
    const ctrlDir = path.join(__dirname, '..', 'src', 'controllers');
    const unguarded = [];
    for (const f of fs.readdirSync(ctrlDir).filter(f => f.endsWith('.js'))) {
      const lines = fs.readFileSync(path.join(ctrlDir, f), 'utf8').split(/\r?\n/);
      lines.forEach((l, i) => {
        if (!/bcrypt\.hash\(/.test(l)) return;
        const near = lines.slice(Math.max(0, i - 15), i + 1).join('\n');
        if (!/passwords\.(problem|temporary)/.test(near)) unguarded.push(`${f}:${i + 1}`);
      });
    }
    ok('every bcrypt.hash() in the controllers is preceded by the password policy', !unguarded.length, unguarded);
    const srcDir = path.join(__dirname, '..', 'src');
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.js') ? [path.join(d, e.name)] : []);
    const leaks = walk(srcDir).filter(f => !f.endsWith(path.join('services', 'passwords.js')))
      .filter(f => /['"`](admin123|changeme123)['"`]/.test(fs.readFileSync(f, 'utf8'))).map(f => path.relative(srcDir, f));
    ok('no published password appears in server code outside the policy', !leaks.length, leaks);
    const seed = fs.readFileSync(path.join(srcDir, 'config', 'bootstrap.js'), 'utf8');
    ok('a fresh install seeds a one-time admin password and unusable demo passwords', /passwords'\)\.temporary\(\)/.test(seed) && /randomBytes\(32\)/.test(seed));
    const schoolAdminPage = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'js', 'pages', 'schoolAdmins.js'), 'utf8');
    const teamPage = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'js', 'pages', 'team.js'), 'utf8');
    ok('administrator reset forms use hidden password and confirmation inputs, not prompt()',
      /id="sa-reset-pw"[^>]*type="password"|type="password"[^>]*id="sa-reset-pw"/.test(schoolAdminPage)
      && /id="sa-reset-confirm"/.test(schoolAdminPage) && !/const pw = prompt\(`New temporary password/.test(schoolAdminPage)
      && /id="tm-reset-pw"[^>]*type="password"|type="password"[^>]*id="tm-reset-pw"/.test(teamPage)
      && /id="tm-reset-confirm"/.test(teamPage));
    const recovery = fs.readFileSync(path.join(__dirname, 'password-reset.js'), 'utf8');
    ok('cPanel recovery accepts an operator password only through a masked prompt',
      /--prompt/.test(recovery) && /setRawMode\(true\)/.test(recovery) && /promptedPassword\(\)/.test(recovery)
      && !/args\.includes\(['"]--password['"]\)/.test(recovery));
  } finally {
    await fixtures.cleanup();
    // The evidence this run caused — including the refused sign-in against a real seeded
    // account — and any R9 incident it opened, so the Security Overview shows no test noise.
    // Wait out one recorder flush first, as prepush.js does (TEST-002).
    // Twice: a repeat within the recorder's 60 s fold re-inserts a row deleted under it,
    // and one was seen to land after a single pass.
    for (let pass = 0; pass < 2; pass++) {
      await new Promise(r => setTimeout(r, 2500));
      await pool.query("DELETE FROM security_events WHERE id > ? AND event_type = 'auth.published_password'", [evBase.m]);
      const [r9s] = await pool.query("SELECT id FROM security_incidents WHERE id > ? AND rule_id = 'R9'", [incStart.m]);
      if (r9s.length) {
        await pool.query(`DELETE FROM admin_notifications WHERE type = 'security_incident'
          AND CAST(JSON_UNQUOTE(JSON_EXTRACT(meta, '$.incident_id')) AS UNSIGNED) IN (?)`, [r9s.map(i => i.id)]);
        await pool.query('DELETE FROM security_incidents WHERE id IN (?)', [r9s.map(i => i.id)]);
      }
    }
    console.log(`\n${'='.repeat(52)}\n  ${passed} passed, ${failed} failed`);
    await pool.end();
    process.exitCode = failed ? 1 : 0;
  }
})().catch(async e => { console.error('\nSUITE ERROR:', e.message); try { await fixtures.cleanup(); await pool.end(); } catch (x) {} process.exitCode = 1; });
