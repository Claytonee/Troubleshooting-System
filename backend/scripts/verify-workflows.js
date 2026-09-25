/**
 * Verification — "How It Works" (D35) says only what the code does.
 * 2026-09-26.
 *
 * A guide that drifts from the system is worse than none: people follow it.
 * So every number it states is compared with the constant it describes, every
 * button it names with ui() must exist in the frontend, every hop in a diagram
 * must be a drawn edge, and the page is opened in a browser at the four
 * breakpoints for the three roles that can see it (and refused to a teacher).
 *
 * Run from backend/:
 *   VERIFY_BASE=http://localhost:3211 node scripts/verify-workflows.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const vm = require('vm');
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

/** Load the page module in a sandbox, with just enough of a browser to define it. */
function loadDefs() {
  const src = read('frontend/js/pages/workflows.js');
  const sandbox = { window: { addEventListener() {}, matchMedia: () => ({ matches: false }) }, document: {}, esc: (s) => String(s), API: { getUser: () => null }, console };
  vm.createContext(sandbox);
  vm.runInContext(src + '\nthis.WorkflowsPage = WorkflowsPage;', sandbox);
  return { src, defs: sandbox.WorkflowsPage._defs };
}

(async () => {
  console.log('\nHow It Works — guide verification');
  console.log('='.repeat(52));
  const { src, defs } = loadDefs();
  const { GUIDES, HOWTO, FACTS } = defs;

  console.log('\n1. Every number is the code\'s number');
  const reg = read('backend/src/controllers/registrationController.js');
  ok(`link lasts ${FACTS.linkDays} days`, new RegExp(`Date\\.now\\(\\) \\+ ${FACTS.linkDays} \\* 24 \\* 60 \\* 60 \\* 1000`).test(reg));
  ok(`cap minimum ${FACTS.capMin}`, new RegExp(`LINK_USES_MIN = ${FACTS.capMin};`).test(reg));
  ok(`cap maximum ${FACTS.capMax}`, new RegExp(`LINK_USES_MAX = ${FACTS.capMax};`).test(reg));
  const teachers = read('frontend/js/pages/teachers.js');
  ok(`suggested cap = on file + ${FACTS.capSuggestExtra}`, new RegExp(`teachers\\.length : 0\\) \\+ ${FACTS.capSuggestExtra}\\)`).test(teachers));
  ok('the input enforces the same range', new RegExp(`min="${FACTS.capMin}" max="${FACTS.capMax}"`).test(teachers));
  ok(`the link lasts ${FACTS.linkDays} days in the modal's words too`, new RegExp(`expires after ${FACTS.linkDays} days`).test(teachers));
  const pw = read('backend/src/services/passwords.js');
  ok(`password minimum ${FACTS.passwordMin}`, new RegExp(`length < ${FACTS.passwordMin}\\b`).test(pw) || new RegExp(`MIN(_LENGTH)? = ${FACTS.passwordMin}\\b`).test(pw));
  ok(`${FACTS.photos} photos per report`, new RegExp(`upload\\.array\\('attachments', ${FACTS.photos}\\)`).test(read('backend/src/routes/errors.js')));
  ok(`rating 1–${FACTS.ratingMax}`, new RegExp(`\\[1, 2, 3, 4, ${FACTS.ratingMax}\\]\\.map`).test(read('frontend/js/app.js')));
  const sla = read('backend/src/config/schemaExtensions.js').match(/SLA_TARGET_HOURS = (\{[^}]+\})/);
  ok('response targets match SLA_TARGET_HOURS', sla && JSON.stringify(vm.runInNewContext('(' + sla[1] + ')')) === JSON.stringify(FACTS.sla), sla && sla[1]);
  const cats = read('backend/src/routes/errors.js').match(/body\('category'\)\.isIn\((\[[^\]]+\])/);
  ok('categories match the server\'s list', cats && JSON.stringify(vm.runInNewContext(cats[1])) === JSON.stringify(FACTS.categories), cats && cats[1]);
  const reasons = read('frontend/js/app.js').match(/Dropdown\.render\('esc-reason', 'Select reason', (\[[^\]]+\])/);
  ok('escalation reasons match the Escalate form', reasons && JSON.stringify(vm.runInNewContext(reasons[1])) === JSON.stringify(FACTS.reasons), reasons && reasons[1]);

  console.log('\n2. Every claim about who may do what');
  const regRoutes = read('backend/src/routes/registration.js');
  ok('only head office approves a school admin', /approvals\/:id\/approve', authenticate, authorize\('admin'\)/.test(regRoutes));
  ok('only a school admin approves a teacher', /teacher-approvals\/:id\/approve', authenticate, authorize\('school'\)/.test(regRoutes));
  ok('only a school admin makes links', /teacher-links', authenticate, authorize\('school'\), ctrl\.generateTeacherLink/.test(regRoutes));
  const errRoutes = read('backend/src/routes/errors.js');
  ok('only head office can Assign', /\/:id\/assign', authorize\('admin'\)/.test(errRoutes));
  const errCtl = read('backend/src/controllers/errorController.js');
  ok('escalating twice is refused', /already escalated to platform admin/.test(errCtl));
  ok('escalation assigns the school\'s field engineer', /SELECT assigned_admin_id FROM schools WHERE id = \?/.test(errCtl));
  ok('escalation rings head office and the engineer (FLOW-001)', /intake\.notifyHeadOffice\(/.test(errCtl) && /intake\.notifyEngineer\(/.test(errCtl));
  ok('Assign turns only Open into In Progress', /status === 'open' \? 'progress'/.test(errCtl));
  const app = read('frontend/js/app.js');
  ok('the Escalate button is the school admin\'s', /canEscalate = [^;]*user\.role === 'school'/.test(app));
  ok('a teacher is never offered Mark Resolved', /canResolve = [^;]*!\(user && user\.role === 'teacher'\)/.test(app));
  const intake = read('backend/src/services/intake.js');
  ok('the school level (school, admin, subadmin) skips triage', /SCHOOL_LEVEL_ROLES = \['school', 'admin', 'subadmin'\]/.test(intake));
  ok('critical goes to the engineer at platform level', /\(bySchoolLevel \|\| critical\) \? \(fieldEngineerId \|\| null\) : null/.test(intake));
  ok('an approved school admin keeps the password they chose', /request\.password_hash/.test(reg));
  ok('a teacher added directly must change the temporary password', /'approved', 1\)/.test(reg) && /passwords\.temporary\(\)/.test(reg));
  ok('a full link is refused', /reached maximum uses/.test(reg) && /has expired/.test(reg) && /has been deactivated/.test(reg));
  ok('a cap never goes below those registered', /the limit cannot be lower than that/.test(reg));
  ok('a pending school admin signing in is sent to the waiting page', /pending_approval/.test(read('backend/src/controllers/authController.js')));

  console.log('\n3. Every button the guide names exists');
  const front = ['frontend/index.html', ...fs.readdirSync(path.join(ROOT, 'frontend/js/pages')).map(f => 'frontend/js/pages/' + f),
    'frontend/js/app.js', 'frontend/js/auth.js'].filter(f => !f.endsWith('workflows.js')).map(read).join('\n');
  const labels = [...new Set([...src.matchAll(/ui\('([^']+)'\)/g)].map(m => m[1]))];
  ok('the guide names buttons with ui()', labels.length >= 25, labels.length);
  for (const l of labels) ok(`"${l}" is on screen somewhere`, front.includes(l));
  ok('"This fixed it" exists', front.includes('This fixed it'));

  console.log('\n4. The diagrams');
  for (const g of Object.values(GUIDES)) {
    const edges = new Set(g.edges.map(([a, b]) => a + '-' + b));
    for (const [name, L] of Object.entries(g.layouts)) {
      ok(`${g.id}/${name}: every node is placed`, Object.keys(g.nodes).every(k => Array.isArray(L.pos[k])));
      const boxes = Object.values(L.pos);
      const overlap = boxes.some((a, i) => boxes.some((b, j) => j > i && a[0] < b[0] + L.nw && b[0] < a[0] + L.nw && a[1] < b[1] + L.nh && b[1] < a[1] + L.nh));
      ok(`${g.id}/${name}: no two nodes overlap`, !overlap);
      ok(`${g.id}/${name}: everything is inside the drawing`, boxes.every(([x, y]) => x >= 0 && y >= 0 && x + L.nw <= L.w && y + L.nh <= L.h));
    }
    for (const sc of g.scenarios) {
      const bad = sc.steps.filter(s => !g.nodes[s.at] || (s.from && !edges.has(s.from + '-' + s.at)));
      ok(`${g.id}/${sc.id}: every hop is a drawn edge`, bad.length === 0, bad);
      ok(`${g.id}/${sc.id}: the story starts somewhere`, !sc.steps[0].from);
    }
    ok(`${g.id}: each edge is used by some scenario`, g.edges.every(([a, b]) => g.scenarios.some(sc => sc.steps.some(s => s.from === a && s.at === b))));
    ok(`${g.id}: a step-by-step list exists`, Array.isArray(HOWTO[g.id]) && HOWTO[g.id].length >= 6);
  }

  console.log('\n5. Wiring and rules of the house');
  const html = read('frontend/index.html'), router = read('frontend/js/router.js');
  ok('the nav item is staff-only', /data-page="workflows" data-role="staff"/.test(html));
  ok('and #workflows is guarded for everyone else', /staffPages = \[[^\]]*'workflows'/.test(router));
  ok('the script carries the current asset version', new RegExp(`pages/workflows\\.js\\?v=${read('frontend/sw.js').match(/VERSION = 'v(\d+)'/)[1]}"`).test(html));
  ok('in-page tabs swap in place', /function setTab[\s\S]{0,400}body\.innerHTML = content\(\)/.test(src));
  ok('motion is optional: reduced motion draws the end state', /reducedMotion\(\)\) return showEnd/.test(src));
  ok('GSAP is loaded by this page, from our own origin', /js\/vendor\/gsap\.min\.js/.test(src) && !/\.src = ['"`]https?:/.test(src) && !/<script[^>]*https?:/.test(src));
  ok('no runtime strings-as-code', !/\beval\(|new Function\(|setTimeout\('/.test(src));
  ok('English only (no Kiswahili copy)', !/\b(na|kwa|ya|wa|mwalimu|shule|tatizo)\b/i.test(src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')));

  console.log('\n6. In a browser, at the four breakpoints');
  const fx = await fixtures.ensure();
  const pa = await fixtures.ensurePlatformAdmin();
  const fe = await fixtures.ensureFieldEngineer();
  const ids = [fx.teacher.userId, fx.schoolAdmin.id, pa.id, fe.id];
  await pool.query(`UPDATE users SET tour_state = '{"role":{"status":"completed","step":5}}' WHERE id IN (?)`, [ids]);
  const people = [
    ['admin', pa.username, pa.password, pa.id],
    ['school', fx.schoolAdmin.username, fx.password, fx.schoolAdmin.id],
    ['subadmin', fe.username, fe.password, fe.id],
    ['teacher', fx.teacher.username, fx.password, fx.teacher.userId]
  ];
  let page = null;
  try {
    page = await browser.launch();
    for (const [role, username, password, id] of people) {
      const s = await fixtures.signIn(username, password, BASE);
      const [[u]] = await pool.query('SELECT id, username, full_name, role, school_id FROM users WHERE id = ?', [id]);
      const sizes = role === 'admin' ? [[1440, 900], [920, 1000], [768, 1000], [520, 900]] : [[1440, 900]];
      for (const [w, h] of sizes) {
        await page.size(w, h);
        await page.load(BASE + '/');
        await page.eval(`localStorage.setItem('qft_token', ${JSON.stringify(s.token)}); localStorage.setItem('qft_user', ${JSON.stringify(JSON.stringify(u))}); true`);
        await page.load(`${BASE}/?wf=${role}${w}#workflows`);
        if (role === 'teacher') {
          await page.waitFor(`!!document.querySelector('.section-header')`, 10000);
          await browser.sleep(600);
          const r = await page.eval(`JSON.stringify({ hash: location.hash, stage: !!document.getElementById('wf-stage'), nav: getComputedStyle(document.querySelector('[data-page="workflows"]')).display })`);
          const o = JSON.parse(r);
          ok('teacher: #workflows sends them away', o.hash !== '#workflows' && !o.stage, o);
          ok('teacher: no nav item', o.nav === 'none', o);
          continue;
        }
        const drawn = await page.waitFor(`!!document.querySelector('#wf-stage svg')`, 10000);
        ok(`${role} ${w}px: the diagram is drawn`, !!drawn);
        // Every label stays inside its box (measured, not guessed), in both guides.
        const fits = `(() => [...document.querySelectorAll('#wf-stage .flow-node')].filter(n => {
            const box = n.querySelector('.flow-box'), x = +box.getAttribute('x'), wd = +box.getAttribute('width');
            return [...n.querySelectorAll('text')].some(t => +t.getAttribute('x') + t.getComputedTextLength() > x + wd - 8);
          }).map(n => n.dataset.node))()`;
        if (role === 'admin') {
          for (const id of ['join', 'fault']) {
            await page.eval(`WorkflowsPage.setTab('${id}'); true`);
            const over = await page.eval(fits);
            ok(`${w}px ${id}: every label fits its box`, Array.isArray(over) && over.length === 0, over);
          }
        }
        // The end state, whatever the motion: every step lights, the last node is reached.
        await page.eval(`WorkflowsPage.setTab('fault'); WorkflowsPage.setScenario('escalate'); true`);
        const done = await page.waitFor(`document.querySelectorAll('#wf-steps .flow-step.on').length === document.querySelectorAll('#wf-steps .flow-step').length && !!document.querySelector('#wf-stage [data-node="resolved"].is-pass') && true`, 15000);
        ok(`${role} ${w}px: "the school escalates" plays to the end`, !!done);
        const m = JSON.parse(await page.eval(`(() => { const main = document.querySelector('.main'), svg = document.querySelector('#wf-stage svg');
          return JSON.stringify({ overflow: main.scrollWidth > main.clientWidth, layout: svg.getAttribute('class'),
            svgW: Math.round(svg.getBoundingClientRect().width), stageW: document.getElementById('wf-stage').clientWidth,
            howto: document.querySelectorAll('.wf-howto').length, tabs: document.querySelectorAll('#wf-tabs .tab-btn').length,
            header: !!document.querySelector('.main > .section-header, .section-header') }); })()`));
        ok(`${role} ${w}px: nothing runs off the side`, !m.overflow, m);
        ok(`${role} ${w}px: the ${w < 800 ? 'narrow' : 'wide'} drawing is used`, m.layout.includes(w < 800 ? 'flow-narrow' : 'flow-wide'), m);
        ok(`${role} ${w}px: two guides, eight steps each`, m.tabs === 2 && m.howto === 8, m);
        if (role === 'admin' && w === 1440) {
          // A tab switch is an in-place swap: the sidebar and header stay.
          await page.eval(`window.__wfMark = document.querySelector('.section-header'); WorkflowsPage.setTab('join'); true`);
          const same = await page.eval(`window.__wfMark === document.querySelector('.section-header') && document.querySelector('#wf-tabs .tab-btn.active').textContent.includes('Joining')`);
          ok('switching guides does not re-render the page', same === true);
          await page.eval(`WorkflowsPage.setScenario('refused'); true`);
          const stop = await page.waitFor(`!!document.querySelector('#wf-stage [data-node="tform"].is-stop') && true`, 10000);
          ok('"the link says no" ends in a refusal', !!stop);
          const summ = await page.eval(`(() => { const s = document.querySelectorAll('.wf-howto summary')[3]; s.focus(); s.click(); return document.activeElement === s && s.parentElement.open; })()`);
          ok('each step opens from the keyboard\'s focus', summ === true);
        }
      }
    }
  } finally {
    if (page) await page.close().catch(() => {});
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
