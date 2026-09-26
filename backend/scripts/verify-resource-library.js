/**
 * Verification — the Resource Library shows what the system holds, and never
 * reports a failed request as an empty library. 2026-09-26.
 *
 * Reported by the owner: the platform admin's Resource Library read "No files
 * uploaded yet" on the live site. Two things were true at once:
 *   - nothing had ever been uploaded (no `manuals` rows, no qft-manuals folder
 *     on Cloudinary), so the files list was honestly empty; and
 *   - the system DID hold resources — the animated explainers (feature 15) —
 *     but the library read only `manuals`, so they were reachable from the
 *     report form and nowhere else.
 * And the page caught any failure of GET /api/manuals and printed the same
 * "No files uploaded yet", which would have hidden an outage as an empty shelf.
 *
 * Checks the API, the source, and the page itself in a headless browser at the
 * four breakpoints. Creates only fixture accounts. Run from backend/:
 *   VERIFY_BASE=http://localhost:3211 node scripts/verify-resource-library.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const pool = require('../src/config/database');
const fixtures = require('./lib/fixtures');
const browser = require('./lib/browser');

const BASE = process.env.VERIFY_BASE || 'http://localhost:3100';
const ROOT = path.join(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let passed = 0, failed = 0;
function ok(name, cond, detail) {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail !== undefined ? ' — ' + JSON.stringify(detail).slice(0, 300) : ''}`); }
}

async function api(method, p, { token } = {}) {
  const res = await fetch(BASE + '/api' + p, { method, headers: token ? { Authorization: 'Bearer ' + token } : {} });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (e) { json = { raw: text.slice(0, 160) }; }
  return { status: res.status, body: json };
}
async function signIn(u) {
  const r = await fixtures.signIn(u.username, u.password, BASE);
  if (!r.token) throw new Error(`sign-in ${u.username} -> ${r.status}`);
  return r.token;
}

(async () => {
  console.log('\nResource Library verification');
  console.log('='.repeat(52));

  const fx = await fixtures.ensure();
  const pa = await fixtures.ensurePlatformAdmin();
  await pool.query(`UPDATE users SET tour_state = '{"role":{"status":"completed","step":5}}' WHERE id IN (?)`,
    [[fx.teacher.userId, fx.schoolAdmin.id, pa.id]]);
  let page = null;

  try {
    const teacher = await signIn({ username: fx.teacher.username, password: fx.password });
    const school = await signIn({ username: fx.schoolAdmin.username, password: fx.password });
    const head = await signIn(pa);
    const [[{ n: active }]] = await pool.query('SELECT COUNT(*) n FROM explainers WHERE is_active = 1');

    console.log('\n1. GET /api/assist/explainers lists every active explainer, as cards');
    ok('refused without a session', (await api('GET', '/assist/explainers')).status === 401);
    let list = [];
    for (const [who, token] of [['teacher', teacher], ['school admin', school], ['platform admin', head]]) {
      const r = await api('GET', '/assist/explainers', { token });
      ok(`${who}: 200 with ${active} explainer(s)`, r.status === 200 && Array.isArray(r.body) && r.body.length === Number(active), { status: r.status, n: r.body && r.body.length });
      if (who === 'platform admin') list = r.body || [];
    }
    ok('the system holds at least one explainer (the library is not empty)', active > 0, { active });
    ok('each card has both titles, steps and a running time',
      list.every(x => Number.isInteger(x.id) && x.title && x.title.sw && x.title.en && x.steps_count > 0 && x.duration_s > 0), list[0]);
    ok('cards carry no script (the script is fetched when opened)', list.every(x => !('scenes' in x)));
    for (const x of list) {
      const r = await api('GET', `/assist/explainers/${x.id}`, { token: teacher });
      ok(`explainer ${x.id} opens with ${x.steps_count} scene(s)`, r.status === 200 && Array.isArray(r.body.scenes) && r.body.scenes.length === x.steps_count);
    }

    console.log('\n2. Source: failure is not emptiness; offline is true');
    const page_ = read('frontend/js/pages/manuals.js');
    ok('a failed GET /api/manuals is no longer turned into []', !/catch \(e\) \{ manuals = \[\]; \}/.test(page_));
    ok('files, explainers and language load side by side (allSettled)', /Promise\.allSettled\(\[\s*API\.getManuals\(\), API\.listExplainers\(\)/.test(page_));
    ok('a load error has its own message and a retry', /could not be loaded/.test(page_) && /ManualsPage\.reload\(\)/.test(page_));
    const sw = read('frontend/sw.js');
    const rule = (sw.match(/\/\^\\\/api\\\/assist\\\/explainers[^,]*\//) || [''])[0];
    let re = null; try { re = eval(rule); } catch (e) { re = null; }
    ok('the service worker caches the list', !!re && re.test('/api/assist/explainers'), rule);
    ok('...and each script', !!re && re.test('/api/assist/explainers/1'));
    ok('...and nothing beside them', !!re && !re.test('/api/assist/explainersX'));
    ok('sign-in warms every script, so "plays offline" is true on first use',
      /get\('\/api\/assist\/explainers'\)/.test(read('frontend/js/offline.js')) && /\/api\/assist\/explainers\/' \+ Number\(x\.id\)/.test(read('frontend/js/offline.js')));
    const ver = (sw.match(/const VERSION = 'v(\d+)'/) || [])[1];
    const html = read('frontend/index.html');
    const tags = html.match(/\?v=\d+/g) || [];
    ok(`sw.js VERSION (v${ver}) matches every ?v= in index.html`, tags.length > 0 && tags.every(t => t === '?v=' + ver), [...new Set(tags)]);

    console.log('\n3. In a browser: the page, at the four breakpoints');
    const [[headUser]] = await pool.query('SELECT id, username, full_name, role, school_id FROM users WHERE id = ?', [pa.id]);
    const [[teacherUser]] = await pool.query('SELECT id, username, full_name, role, school_id FROM users WHERE id = ?', [fx.teacher.userId]);
    const [[{ files }]] = await pool.query('SELECT COUNT(*) files FROM manuals');
    page = await browser.launch();
    const open = async (token, user, w, h) => {
      await page.size(w, h);
      await page.load(BASE + '/');
      await page.eval(`localStorage.setItem('qft_token', ${JSON.stringify(token)}); localStorage.setItem('qft_user', ${JSON.stringify(JSON.stringify(user))}); true`);
      await page.load(`${BASE}/?n=${w}#manuals`);
      return page.waitFor(`document.querySelectorAll('.explainer-card').length === ${list.length} && true`, 10000);
    };
    for (const [w, h] of [[1440, 900], [920, 800], [768, 1024], [390, 844]]) {
      const shown = await open(head, headUser, w, h);
      ok(`${w}px: platform admin sees ${list.length} explainer card(s)`, shown === true);
      const title = await page.eval(`(document.querySelector('.explainer-card') || {}).textContent || ''`);
      ok(`${w}px: titles are in the reader's language (Kiswahili unless chosen)`, title.includes(list[0].title.sw), title.slice(0, 80));
      const fit = await page.eval(`(() => { const m = document.querySelector('.main'); return m.scrollWidth <= m.clientWidth + 1 && [...document.querySelectorAll('.explainer-card')].every(c => c.getBoundingClientRect().right <= m.getBoundingClientRect().right + 1); })()`);
      ok(`${w}px: nothing runs off the side`, fit === true);
      if (!Number(files)) {
        ok(`${w}px: with no files, the files list says so`, await page.eval(`document.querySelector('.main').textContent.includes('No files uploaded yet')`) === true);
      }
    }

    await page.eval(`document.querySelector('.explainer-card').click(); true`);
    ok('clicking a card plays the explainer', await page.waitFor(`document.querySelector('#modal.open') && document.querySelector('#modal').textContent.includes(${JSON.stringify(list[0].title.sw)}) && true`, 8000) === true);
    await page.eval(`typeof Explainer !== 'undefined' && Explainer.close(); true`);

    await page.eval(`API.getManuals = () => Promise.reject(new Error('Service unavailable')); ManualsPage.reload(); true`);
    const failedText = await page.waitFor(`document.querySelector('.main').textContent.includes('could not be loaded') && true`, 8000);
    ok('a failed request says so, with a retry', failedText === true && await page.eval(`!!document.querySelector('button[onclick="ManualsPage.reload()"]')`) === true);
    ok('...and never claims the library is empty', await page.eval(`!document.querySelector('.main').textContent.includes('No files uploaded yet')`) === true);
    ok('...while the explainers still show', await page.eval(`document.querySelectorAll('.explainer-card').length`) === list.length);

    const teacherSees = await open(teacher, teacherUser, 390, 844);
    ok('a teacher sees the explainers too', teacherSees === true);
    ok('...and no Upload Resource button', await page.eval(`!document.querySelector('.main').textContent.includes('Upload Resource')`) === true);
  } finally {
    if (page) await page.close().catch(() => {});
  }

  console.log('\n' + '='.repeat(52));
  console.log(`  ${passed} passed, ${failed} failed`);
  await pool.end();
  process.exit(failed ? 1 : 0);
})().catch(async (e) => {
  console.error('\nSuite crashed:', e.message);
  try { await pool.end(); } catch (x) { /* already closed */ }
  process.exit(1);
});
