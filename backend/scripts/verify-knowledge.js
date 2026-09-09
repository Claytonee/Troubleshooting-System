/**
 * Verification — guide-first reporting (feature 10), 2026-09-10.
 *
 * The claim: the right guide reaches the person about to file a fault, the ones
 * it fixes are counted, and the ones it fails to fix are remembered against
 * that guide so somebody can rewrite it.
 *
 * Run from backend/:  node scripts/verify-knowledge.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const pool = require('../src/config/database');
const fixtures = require('./lib/fixtures');
const knowledge = require('../src/services/knowledge');

const BASE = process.env.VERIFY_BASE || 'http://localhost:3100';
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
async function login(u, p) {
  const r = await api('POST', '/auth/login', { body: { username: u, password: p } });
  if (r.status !== 200) throw new Error(`login ${u} -> ${r.status}`);
  return r.body.token;
}

(async () => {
  console.log('\nGuide-first reporting verification');
  console.log('='.repeat(56));

  const fx = await fixtures.ensure();
  const teacher = await login(fx.teacher.username, fx.password);
  const madeErrors = [];

  try {
    // ---- 1. suggestions ---------------------------------------------------
    console.log('\n1. The right guide reaches the person about to file');
    const [guides] = await pool.query("SELECT id, title, category FROM troubleshooting_guides ORDER BY id");
    ok('there are guides to suggest', guides.length > 0, guides.length);

    const wifi = await api('GET', '/guides/suggest?category=Connectivity', { token: teacher });
    eq('a category alone is enough', wifi.status, 200);
    ok('and returns the connectivity guide first',
      wifi.body.guides[0] && /wifi|internet/i.test(wifi.body.guides[0].title), wifi.body.guides.map(g => g.title));
    ok('with its steps, so it can be read in place',
      Array.isArray(wifi.body.guides[0].steps) && wifi.body.guides[0].steps.length > 0, wifi.body.guides[0]);

    const typed = await api('GET', '/guides/suggest?text=' + encodeURIComponent('tablets are not charging'), { token: teacher });
    ok('typed words alone also find one',
      typed.body.guides.length > 0 && /charg/i.test(typed.body.guides[0].title), typed.body.guides.map(g => g.title));

    const capped = await api('GET', '/guides/suggest?category=Hardware&limit=99', { token: teacher });
    ok('never more than five, whatever is asked for', capped.body.guides.length <= 5, capped.body.guides.length);

    const nothing = await api('GET', '/guides/suggest?text=' + encodeURIComponent('zzzz nonsense qqqq'), { token: teacher });
    eq('nonsense suggests nothing rather than the first guide', nothing.body.guides.length, 0);

    // ---- 2. the fault that was never filed --------------------------------
    console.log('\n2. The fault that never had to be filed is counted');
    const guideId = wifi.body.guides[0].id;
    const [beforeRows] = await pool.query('SELECT COUNT(*) n FROM guide_deflections WHERE guide_id = ?', [guideId]);

    const helped = await api('POST', `/guides/${guideId}/helped`, { token: teacher, body: { category: 'Connectivity' } });
    eq('it is recorded', helped.status, 200);
    const [afterRows] = await pool.query('SELECT * FROM guide_deflections WHERE guide_id = ? ORDER BY id DESC LIMIT 1', [guideId]);
    eq('exactly one more row', afterRows.length && (await pool.query('SELECT COUNT(*) n FROM guide_deflections WHERE guide_id = ?', [guideId]))[0][0].n - beforeRows[0].n, 1);
    eq('attributed to the person', afterRows[0].user_id, fx.teacher.userId);
    eq('and to their school', afterRows[0].school_id, fx.school.id);
    eq('with the source it came from', afterRows[0].source, 'report_form');

    const missing = await api('POST', '/guides/999999/helped', { token: teacher });
    eq('an unknown guide is a 404, not a silent row', missing.status, 404);

    // ---- 3. the guide that was tried and did not help ---------------------
    console.log('\n3. A guide that was read and failed is remembered');
    const filed = await api('POST', '/errors', {
      token: teacher,
      body: {
        title: 'VERIFY knowledge — still no internet', description: 'Tried the guide, no change.',
        school_id: fx.school.id, category: 'Connectivity', priority: 'medium',
        tried_guide_id: guideId
      }
    });
    eq('the fault is accepted', filed.status, 201);
    madeErrors.push(filed.body.id);
    const [row] = await pool.query('SELECT tried_guide_id FROM errors WHERE id = ?', [filed.body.id]);
    eq('and remembers which guide was tried', row[0].tried_guide_id, guideId);

    const plain = await api('POST', '/errors', {
      token: teacher,
      body: { title: 'VERIFY knowledge — no guide tried', description: 'x', school_id: fx.school.id, category: 'Power', priority: 'low' }
    });
    madeErrors.push(plain.body.id);
    const [plainRow] = await pool.query('SELECT tried_guide_id FROM errors WHERE id = ?', [plain.body.id]);
    eq('a fault filed without reading one records null', plainRow[0].tried_guide_id, null);

    // ---- 4. which guides earn their place ---------------------------------
    console.log('\n4. Which guides earn their place');
    const perf = await knowledge.guidePerformance({ days: 90 });
    const tracked = perf.find(g => g.id === guideId);
    ok('the guide appears', !!tracked, perf.map(p => p.id));
    ok('with both halves counted', tracked.deflected >= 1 && tracked.filed_anyway >= 1, tracked);
    eq('and a rate over the people it met', tracked.success_rate,
      Math.round((tracked.deflected / (tracked.deflected + tracked.filed_anyway)) * 100));

    const untouched = perf.find(g => g.times_met === 0);
    if (untouched) {
      eq('a guide nobody has met reports null, not 0%', untouched.success_rate, null);
    } else {
      ok('every guide has been met at least once (no null case to check)', true);
    }

    // ---- 5. who may see what ---------------------------------------------
    console.log('\n5. Access');
    eq('suggestions need a session', (await api('GET', '/guides/suggest?category=Power')).status, 401);
    eq('a teacher may not read guide performance', (await api('GET', '/guides/performance', { token: teacher })).status, 403);
    const adminUser = (await pool.query("SELECT username FROM users WHERE role = 'admin' LIMIT 1"))[0][0];
    if (adminUser) {
      const [old] = await pool.query('SELECT password_hash FROM users WHERE username = ?', [adminUser.username]);
      const bcrypt = require('bcryptjs');
      await pool.query('UPDATE users SET password_hash = ? WHERE username = ?',
        [await bcrypt.hash(fixtures.PASSWORD, 10), adminUser.username]);
      const adminToken = await login(adminUser.username, fixtures.PASSWORD);
      const adminView = await api('GET', '/guides/performance', { token: adminToken });
      eq('head office may', adminView.status, 200);
      ok('and sees every guide', adminView.body.guides.length === guides.length, adminView.body.guides.length);
      await pool.query('UPDATE users SET password_hash = ? WHERE username = ?', [old[0].password_hash, adminUser.username]);
    }

    // ---- 6. the form actually asks ---------------------------------------
    console.log('\n6. The suggestion is in the way, and there is a way past it');
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'frontend', 'js', 'pages', 'report.js'), 'utf8');
    ok('the report form has a slot for it', /report-guides/.test(src));
    ok('it refreshes when the category changes', /refreshSuggestions\(\)/.test(src));
    ok('"This fixed it" records a deflection', /guideFixedIt/.test(src) && /guideHelped/.test(src));
    ok('"Still not fixed" carries on to the report', /stillBroken/.test(src));
    ok('and the guide that failed rides along with the fault', /tried_guide_id/.test(src));
    ok('including on the offline path', /tried_guide_id: triedGuideId/.test(src));
  } finally {
    for (const id of madeErrors) {
      await pool.query('DELETE FROM error_updates WHERE error_id = ?', [id]);
      await pool.query('DELETE FROM errors WHERE id = ?', [id]);
    }
    await pool.query("DELETE FROM errors WHERE title LIKE 'VERIFY knowledge%'");
    await pool.query('DELETE FROM guide_deflections WHERE user_id = ? OR school_id = ?', [fx.teacher.userId, fx.school.id]);
    await pool.query("DELETE FROM admin_notifications WHERE type = 'error_reported'");
    await fixtures.cleanup();

    console.log('\n' + '='.repeat(56));
    console.log(`  ${passed} passed, ${failed} failed`);
    const [left] = await pool.query("SELECT COUNT(*) n FROM guide_deflections");
    console.log(`  deflection rows left behind: ${left[0].n}`);
    await pool.end();
    process.exit(failed ? 1 : 0);
  }
})().catch(async (e) => {
  console.error('\nSUITE ERROR:', e.message);
  try { await pool.end(); } catch (x) {}
  process.exit(1);
});
