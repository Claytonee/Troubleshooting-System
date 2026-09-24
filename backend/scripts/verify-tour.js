/**
 * Verification — guided tours (DECISIONS.md D27, docs/features/12-guided-tour.md).
 *
 *  API        progress is per account: signed-in only, validated, bounded,
 *             never goes backwards, and nobody can write another account's.
 *  Content    every stop points at a page its role can actually see (read from
 *             the sidebar's own data-role markers), and no tour is longer than
 *             five stops — the research's line between finished and abandoned.
 *  Browser    each role, on a desktop, a phone and a tablet: the tour is offered
 *             once, every stop lights up its target with the bubble fully on
 *             screen, the phone drawer opens for sidebar stops, the keyboard
 *             works, focus stays in the bubble, and the result is stored.
 *
 * Needs the local server; creates zzverify* accounts and removes them. The
 * browser half needs Chrome or Edge and says so if there is none.
 * VERIFY_SHOTS=<dir> also saves a screenshot of every stop.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const bcrypt = require('bcryptjs');
const pool = require('../src/config/database');
const fixtures = require('./lib/fixtures');
const browser = require('./lib/browser');
const { TOUR_ID } = require('../src/controllers/tourController');

const BASE = process.env.VERIFY_BASE || 'http://localhost:3210';
const SHOTS = process.env.VERIFY_SHOTS || '';
const FRONT = path.join(__dirname, '..', '..', 'frontend');
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
const login = async (u) => (await api('POST', '/auth/login', { body: { username: u, password: fixtures.PASSWORD } })).body;

async function staff(role, suffix, name) {
  const u = fixtures.PREFIX + suffix;
  const hash = await bcrypt.hash(fixtures.PASSWORD, 10);
  const [ex] = await pool.query('SELECT id FROM users WHERE username = ?', [u]);
  if (ex.length) await pool.query("UPDATE users SET password_hash=?, role=?, full_name=?, status='active', approval_status='approved', must_change_password=0 WHERE id=?", [hash, role, name, ex[0].id]);
  else await pool.query(`INSERT INTO users (username, email, password_hash, full_name, role, status, approval_status, must_change_password)
    VALUES (?, ?, ?, ?, ?, 'active', 'approved', 0)`, [u, u + '@verify.local', hash, name, role]);
  return u;
}
const resetTours = () => pool.query("UPDATE users SET tour_state = NULL WHERE username LIKE 'zzverify%'");

/** The tour definitions, read from the shipped file itself. */
function loadDefs() {
  const src = fs.readFileSync(path.join(FRONT, 'js', 'components', 'tour.js'), 'utf8') + '\n;this.__Tour = Tour;';
  const ctx = { window: {}, document: {} };
  vm.runInNewContext(src, ctx);
  return ctx.__Tour._defs;
}

/** Which roles each sidebar marker lets in — the same table as Router.applyRoleVisibility(). */
const MARKER = {
  '': ['admin', 'subadmin', 'school', 'teacher'],
  admin: ['admin'], subadmin: ['subadmin'], school: ['school'], 'school-teacher': ['school', 'teacher'],
  staff: ['admin', 'subadmin', 'school'], 'staff-teacher': ['admin', 'subadmin', 'school', 'teacher'],
  field: ['admin', 'subadmin'], 'no-admin': ['subadmin', 'school', 'teacher']
};

(async () => {
  let page = null;
  try {
    const fx = await fixtures.ensure();
    const users = {
      teacher: fx.teacher.username, school: fx.schoolAdmin.username,
      subadmin: await staff('subadmin', 'sub', 'Baraka Field'), admin: await staff('admin', 'admin', 'Amina Platform')
    };
    await pool.query("UPDATE users SET full_name = 'Neema Teacher' WHERE username = ?", [users.teacher]);
    await resetTours();
    const s = {};
    for (const [role, u] of Object.entries(users)) s[role] = await login(u);

    // ── API ──────────────────────────────────────────────────────────────
    console.log('\nAPI      progress is per account, validated and bounded');
    ok('reading without signing in is refused (401)', (await api('GET', '/auth/tour')).status === 401);
    ok('writing without signing in is refused (401)', (await api('PUT', '/auth/tour/role', { body: { status: 'completed', step: 5 } })).status === 401);
    const t = s.teacher.token;
    ok('a new account has no progress', JSON.stringify((await api('GET', '/auth/tour', { token: t })).body) === '{"tours":{}}');
    for (const [label, id, body] of [
      ['an unknown tour id', 'evil', { status: 'completed', step: 1 }],
      ['a page tour that does not exist', 'page:passwords', { status: 'completed', step: 1 }],
      ['an unknown status', 'role', { status: 'hacked', step: 1 }],
      ['a negative step', 'role', { status: 'started', step: -1 }],
      ['a step past the limit', 'role', { status: 'started', step: 21 }],
      ['a step that is not a number', 'role', { status: 'started', step: 'two' }]
    ]) ok(`${label} is refused (400)`, (await api('PUT', '/auth/tour/' + encodeURIComponent(id), { token: t, body })).status === 400);
    await api('PUT', '/auth/tour/role', { token: t, body: { status: 'started', step: 0 } });
    const done = await api('PUT', '/auth/tour/role', { token: t, body: { status: 'completed', step: 5 } });
    ok('completing is stored', done.body.tours.role.status === 'completed' && done.body.tours.role.step === 5);
    const back1 = await api('PUT', '/auth/tour/role', { token: t, body: { status: 'dismissed', step: 1 } });
    const back2 = await api('PUT', '/auth/tour/role', { token: t, body: { status: 'started', step: 0 } });
    ok('a status never goes backwards (replaying and closing early keeps "completed")',
      back1.body.tours.role.status === 'completed' && back2.body.tours.role.status === 'completed');
    const other = await api('GET', '/auth/tour', { token: s.school.token });
    ok('one account\'s progress is invisible to another', JSON.stringify(other.body) === '{"tours":{}}');
    await api('PUT', '/auth/tour/role', { token: t, body: { status: 'completed', step: 5, user_id: 1, id: 1 } });
    const [[adminRow]] = await pool.query('SELECT tour_state FROM users WHERE username = ?', [users.admin]);
    ok('an id in the body cannot write another account', adminRow.tour_state === null);
    await pool.query("UPDATE users SET tour_state = ? WHERE username = ?", [JSON.stringify({ role: { status: 'completed', step: 5 }, junk: 'x'.repeat(5000) }), users.teacher]);
    await api('PUT', '/auth/tour/page:report', { token: t, body: { status: 'completed', step: 4 } });
    const [[row]] = await pool.query('SELECT tour_state FROM users WHERE username = ?', [users.teacher]);
    ok('a key that is not a known tour is dropped on the next write (the column cannot grow)', !row.tour_state.includes('junk') && row.tour_state.length < 400, row.tour_state.length);
    await pool.query("UPDATE users SET tour_state = '{not json' WHERE username = ?", [users.teacher]);
    const broken = await api('GET', '/auth/tour', { token: t });
    ok('a corrupt stored value reads as "no progress", not a 500', broken.status === 200 && JSON.stringify(broken.body) === '{"tours":{}}');

    // ── Content ──────────────────────────────────────────────────────────
    console.log('\nContent  every stop points at something its role can see');
    const defs = loadDefs();
    const html = fs.readFileSync(path.join(FRONT, 'index.html'), 'utf8');
    const navRole = {};
    for (const m of html.matchAll(/class="nav-item[^"]*" data-page="([a-z]+)"(?: data-role="([a-z-]+)")?/g)) navRole[m[1]] = m[2] || '';
    for (const [role, def] of Object.entries(defs.ROLE_TOURS)) {
      ok(`${role}: at most five stops (${def.steps.length})`, def.steps.length >= 3 && def.steps.length <= 5);
      const bad = def.steps.filter(st => typeof st.target === 'string').map(st => st.target)
        .map(sel => (sel.match(/data-page="([a-z]+)"/) || [])[1]).filter(Boolean)
        .filter(p => !(p in navRole) || !MARKER[navRole[p]].includes(role));
      ok(`${role}: every sidebar stop is a page this role can open`, !bad.length, bad);
      ok(`${role}: every stop has a title and an explanation`, def.steps.every(st => st.title && st.body && st.body.length > 30));
    }
    ok('every role that can sign in has a tour', ['admin', 'subadmin', 'school', 'teacher'].every(r => defs.ROLE_TOURS[r]));
    for (const id of Object.keys(defs.PAGE_TOURS)) {
      ok(`${id}: the server accepts this tour id`, TOUR_ID.test(id));
      ok(`${id}: at most five stops`, defs.PAGE_TOURS[id].steps.length <= 5);
    }
    ok('the server accepts the role tour id', TOUR_ID.test('role'));
    const tourSrc = fs.readFileSync(path.join(FRONT, 'js', 'components', 'tour.js'), 'utf8');
    ok('tour.js adds no inline event handlers — the strict script policy is waiting for them to go (D24)', !/\son[a-z]+\s*=\s*["']/.test(tourSrc.replace(/^\s*(\/\/|\*).*$/gm, '')));
    ok('the profile menu item starts the tour by delegation, not onclick', /data-tour-start="role"/.test(html) && !/onclick="Tour./.test(html));

    // ── Browser ──────────────────────────────────────────────────────────
    console.log('\nBrowser  each role, desktop · phone · tablet');
    page = await browser.launch();
    if (!page) { console.log('  skip  no Chrome or Edge on this machine — browser checks not run'); }
    else {
      if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
      let loads = 0;
      const open = async (role, [w, h]) => {
        const sess = await login(users[role]);
        await page.size(w, h);
        await page.load(BASE + '/');
        await page.eval(`localStorage.setItem('qft_token', ${JSON.stringify(sess.token)});
          localStorage.setItem('qft_user', ${JSON.stringify(JSON.stringify(sess.user))}); true`);
        await page.load(`${BASE}/?v=${++loads}#dashboard`);
        return sess;
      };
      const bubbleText = `document.querySelector('.tour-bubble') ? document.querySelector('.tour-bubble').innerText : ''`;
      const stored = async (u) => { const [[r]] = await pool.query('SELECT tour_state FROM users WHERE username = ?', [u]); return r.tour_state ? JSON.parse(r.tour_state) : {}; };
      // The PUT is fire-and-forget in the page: give it a moment to land before reading.
      const storedWhen = async (u, pred, ms = 4000) => { const until = Date.now() + ms; let v; do { v = await stored(u); if (pred(v)) return v; await browser.sleep(150); } while (Date.now() < until); return v; };
      // Measures the current stop from inside the page.
      const measure = (role, k, tourKey) => page.eval(`(() => {
        const defs = Tour._defs; const d = ${tourKey ? `defs.PAGE_TOURS[${JSON.stringify(tourKey)}]` : `defs.ROLE_TOURS[${JSON.stringify(role)}]`};
        const st = d.steps[${k}]; const el = typeof st.target === 'function' ? st.target() : document.querySelector(st.target);
        const b = document.querySelector('.tour-bubble').getBoundingClientRect();
        const sp = document.querySelector('.tour-spot').getBoundingClientRect();
        const r = el ? el.getBoundingClientRect() : null;
        const vw = innerWidth, vh = innerHeight;
        return {
          bubbleOnScreen: b.left >= 0 && b.top >= 0 && b.right <= vw + 0.5 && b.bottom <= vh + 0.5,
          spotOnTarget: !!r && Math.abs(sp.left - (r.left - 6)) < 3 && Math.abs(sp.top - (r.top - 6)) < 3 && Math.abs(sp.width - (r.width + 12)) < 3,
          targetOnScreen: !!r && r.top >= 0 && r.bottom <= vh && r.left >= 0 && r.right <= vw,
          overlap: !!r && !(b.right <= r.left || b.left >= r.right || b.bottom <= r.top || b.top >= r.bottom),
          drawerOpen: document.getElementById('sidebar').classList.contains('open'),
          inSidebar: !!el && !!el.closest('#sidebar'),
          live: document.querySelector('[data-tour="live"]').textContent,
          focusInBubble: document.querySelector('.tour-bubble').contains(document.activeElement),
          title: st.title
        };
      })()`);

      const walk = async (role, size, label, tourKey) => {
        const d = await page.eval(`(${tourKey ? `Tour._defs.PAGE_TOURS[${JSON.stringify(tourKey)}]` : `Tour._defs.ROLE_TOURS[${JSON.stringify(role)}]`}).steps.length`);
        const problems = [];
        for (let k = 0; k < d; k++) {
          const want = `Step ${k + 1} of ${d}`;
          const live = await page.waitFor(`(document.querySelector('[data-tour="live"]') || {}).textContent?.startsWith(${JSON.stringify(want)}) && true`, 6000);
          await browser.sleep(450);
          const m = live ? await measure(role, k, tourKey) : null;
          if (!m) { problems.push(`stop ${k + 1} never appeared`); break; }
          if (!m.bubbleOnScreen) problems.push(`stop ${k + 1}: bubble off screen`);
          if (!m.spotOnTarget) problems.push(`stop ${k + 1}: spotlight not on its target`);
          if (!m.targetOnScreen) problems.push(`stop ${k + 1}: target off screen`);
          if (m.overlap) problems.push(`stop ${k + 1}: bubble covers its own target`);
          if (m.inSidebar && size[0] <= 920 && !m.drawerOpen) problems.push(`stop ${k + 1}: drawer closed over a sidebar stop`);
          if (!m.focusInBubble) problems.push(`stop ${k + 1}: focus left the bubble`);
          if (SHOTS) await page.screenshot(path.join(SHOTS, `${tourKey ? tourKey.replace(':', '-') : role}-${size[0]}-${k + 1}.png`));
          await page.eval(`document.querySelector('.tour-bubble [data-act="next"]').click(); true`);
        }
        ok(`${label}: every stop lit its target with the bubble on screen and focus inside it`, !problems.length, problems);
        const gone = await page.waitFor(`!document.querySelector('.tour-root') && true`, 3000);
        ok(`${label}: Done closes it`, !!gone);
        return d;
      };

      const DESK = [1440, 900], PHONE = [375, 812], TAB = [920, 1000];

      // Teacher, desktop — the full story.
      await resetTours();
      await open('teacher', DESK);
      let w = await page.waitFor(`${bubbleText}.includes('Welcome, Neema') && true`, 7000);
      ok('teacher: the tour is OFFERED on first sign-in, not started', !!w && (await page.eval(bubbleText)).includes('Show me around'));
      ok('teacher: the offer is a labelled dialog with focus on "Show me around"', await page.eval(`(() => { const b = document.querySelector('.tour-bubble');
        return b.getAttribute('role') === 'dialog' && b.getAttribute('aria-modal') === 'true' && document.getElementById(b.getAttribute('aria-labelledby')).textContent.startsWith('Welcome')
          && document.activeElement.textContent.trim() === 'Show me around'; })()`));
      await page.load(`${BASE}/?v=${++loads}#dashboard`);
      w = await page.waitFor(`${bubbleText}.includes('Welcome') && true`, 7000);
      ok('teacher: reloading before answering does not use up the offer', !!w);
      ok('teacher: nothing is stored until a real stop is reached', JSON.stringify(await stored(users.teacher)) === '{}');
      await page.eval(`document.querySelector('.tour-bubble [data-act="next"]').click(); true`);
      await page.waitFor(`(document.querySelector('[data-tour="live"]') || {}).textContent?.startsWith('Step 1') && true`);
      await browser.sleep(400);
      await page.key('ArrowRight', 'ArrowRight', 39);
      ok('teacher: → moves to the next stop', !!await page.waitFor(`document.querySelector('[data-tour="live"]').textContent.startsWith('Step 2') && true`, 3000));
      await page.key('ArrowLeft', 'ArrowLeft', 37);
      ok('teacher: ← moves back', !!await page.waitFor(`document.querySelector('[data-tour="live"]').textContent.startsWith('Step 1') && true`, 3000));
      for (let i = 0; i < 5; i++) await page.key('Tab', 'Tab', 9);
      ok('teacher: Tab never leaves the bubble', await page.eval(`document.querySelector('.tour-bubble').contains(document.activeElement)`));
      const n = await walk('teacher', DESK, 'teacher · desktop 1440');
      let st = await storedWhen(users.teacher, v => v.role && v.role.status === 'completed');
      ok('teacher: completion is stored on the account', st.role && st.role.status === 'completed' && st.role.step === n, st);
      await page.load(`${BASE}/?v=${++loads}#dashboard`);
      await browser.sleep(2500);
      ok('teacher: after finishing, the next sign-in offers nothing', !(await page.eval(`!!document.querySelector('.tour-bubble')`)));
      // Replay from the profile menu, then Esc.
      await page.eval(`document.getElementById('topbar-profile').click(); true`);
      await browser.sleep(300);
      await page.eval(`[...document.querySelectorAll('.profile-dropdown-item')].find(e => /Product tour/.test(e.textContent)).click(); true`);
      ok('teacher: "Product tour" in the profile menu replays it — straight to stop 1, no welcome',
        !!await page.waitFor(`document.querySelector('[data-tour="live"]')?.textContent.startsWith('Step 1') && true`, 4000));
      ok('teacher: the profile menu closed when the tour began', !(await page.eval(`document.getElementById('profile-dropdown').classList.contains('open')`)));
      await page.key('Escape', 'Escape', 27);
      ok('teacher: Esc ends it', !!await page.waitFor(`!document.querySelector('.tour-root') && true`, 3000));
      await browser.sleep(400);
      st = await stored(users.teacher);
      ok('teacher: ending a replay early keeps "completed"', st.role.status === 'completed', st);
      // The page tour on the report form.
      await page.eval(`Router.navigate('report'); App.loadAndRender(); true`);
      const btn = await page.waitFor(`!!document.querySelector('.tour-page-btn') && true`, 5000);
      ok('report form: a "Show me how" button is on the page', !!btn);
      await page.eval(`document.querySelector('.tour-page-btn').click(); true`);
      await walk('teacher', DESK, 'report form · desktop 1440', 'page:report');
      st = await storedWhen(users.teacher, v => v['page:report'] && v['page:report'].status === 'completed');
      ok('report form: its tour is stored separately', st['page:report'] && st['page:report'].status === 'completed', st);

      // Every other role on the desktop, and every role on a phone.
      for (const [role, size, label] of [
        ['school', DESK, 'school admin · desktop 1440'], ['subadmin', DESK, 'field engineer · desktop 1440'], ['admin', DESK, 'platform admin · desktop 1440'],
        ['teacher', PHONE, 'teacher · phone 375'], ['school', PHONE, 'school admin · phone 375'],
        ['subadmin', PHONE, 'field engineer · phone 375'], ['admin', PHONE, 'platform admin · phone 375']
      ]) {
        await resetTours();
        await open(role, size);
        const offered = await page.waitFor(`${bubbleText}.includes('Show me around') && true`, 7000);
        if (!offered) { ok(`${label}: offered`, false); continue; }
        await page.eval(`document.querySelector('.tour-bubble [data-act="next"]').click(); true`);
        await walk(role, size, label);
        if (size === PHONE) ok(`${label}: the drawer is closed again afterwards`, !(await page.eval(`document.getElementById('sidebar').classList.contains('open')`)));
      }
      await resetTours();
      await open('teacher', PHONE);
      await page.waitFor(`${bubbleText}.includes('Show me around') && true`, 7000);
      await page.eval(`document.querySelector('.tour-bubble [data-act="skip"]').click(); true`);
      await browser.sleep(300);
      await page.eval(`Router.navigate('report'); App.loadAndRender(); true`);
      await page.waitFor(`!!document.querySelector('.tour-page-btn') && true`, 5000);
      await page.eval(`document.querySelector('.tour-page-btn').click(); true`);
      await walk('teacher', PHONE, 'report form · phone 375', 'page:report');

      // "Not now" on a tablet.
      await resetTours();
      await open('admin', TAB);
      await page.waitFor(`${bubbleText}.includes('Show me around') && true`, 7000);
      await page.eval(`document.querySelector('.tour-bubble [data-act="skip"]').click(); true`);
      st = await storedWhen(users.admin, v => !!v.role);
      ok('platform admin · tablet 920: "Not now" is stored as dismissed at step 0', st.role && st.role.status === 'dismissed' && st.role.step === 0, st);
      await page.load(`${BASE}/?v=${++loads}#dashboard`);
      await browser.sleep(2500);
      ok('platform admin · tablet 920: and is not offered again', !(await page.eval(`!!document.querySelector('.tour-bubble')`)));
      // Signing out mid-tour leaves nothing on screen for the next person on the tablet.
      await page.eval(`Tour.replay(); true`);
      await page.waitFor(`!!document.querySelector('.tour-root') && true`, 3000);
      await page.eval(`Auth.logout(); true`);
      await browser.sleep(400);
      ok('signing out mid-tour removes it (shared tablets)', !(await page.eval(`!!document.querySelector('.tour-root')`)));
    }
  } finally {
    if (page) await page.close();
    await fixtures.cleanup();
    console.log(`\n${'='.repeat(52)}\n  ${passed} passed, ${failed} failed`);
    await pool.end();
    process.exitCode = failed ? 1 : 0;
  }
})().catch(async e => { console.error('\nSUITE ERROR:', e.message); try { await pool.end(); } catch (x) {} process.exitCode = 1; });
