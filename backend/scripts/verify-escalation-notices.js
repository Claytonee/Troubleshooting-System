/**
 * Verification — a fault reaches the PERSON it is routed to, not only their queue.
 * 2026-09-26.
 *
 * Found while writing the escalation guide (D34):
 *   - "Escalate to OE" changed the row and told nobody: no bell for head office,
 *     no bell for the field engineer it was handed to, no email, no SMS.
 *   - A critical report and a school admin's own report were assigned to the
 *     engineer with nothing on the engineer's bell. Only the manual Assign
 *     button ever wrote to it.
 *   - The school admin's bell never drew `error_reported`. The server has
 *     written one for every teacher's fault since 2026-09-09; the panel only
 *     drew guide escalations, so the rule "a teacher's fault goes to their
 *     school administrator" held in the database and nowhere on screen.
 *
 * Checks the API, the source, and the bell itself in a headless browser.
 * Restores everything it creates. Run from backend/:
 *   VERIFY_BASE=http://localhost:3211 node scripts/verify-escalation-notices.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const pool = require('../src/config/database');
const fixtures = require('./lib/fixtures');
const browser = require('./lib/browser');

const BASE = process.env.VERIFY_BASE || 'http://localhost:3100';
const ROOT = path.join(__dirname, '..', '..');

let passed = 0, failed = 0;
function ok(name, cond, detail) {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail !== undefined ? ' — ' + JSON.stringify(detail).slice(0, 300) : ''}`); }
}

async function api(method, p, { token, body } = {}) {
  const res = await fetch(BASE + '/api' + p, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
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
const metaOf = (n) => (typeof n.meta === 'string' ? JSON.parse(n.meta) : (n.meta || {}));
const bellFor = async (token, type, errorId) => {
  const r = await api('GET', '/schools/notifications', { token });
  return (r.body || []).filter(n => n.type === type && Number(metaOf(n).error_id) === Number(errorId));
};

(async () => {
  console.log('\nEscalation notices verification');
  console.log('='.repeat(52));

  const fx = await fixtures.ensure();
  const pa = await fixtures.ensurePlatformAdmin();
  const fe = await fixtures.ensureFieldEngineer();
  const schoolId = fx.school.id;
  const [[orig]] = await pool.query('SELECT assigned_admin_id FROM schools WHERE id = ?', [schoolId]);
  const errorIds = [];
  let page = null;

  // Fixture accounts must not meet the first-sign-in tour offer over the bell.
  await pool.query(`UPDATE users SET tour_state = '{"role":{"status":"completed","step":5}}' WHERE id IN (?)`,
    [[fx.teacher.userId, fx.schoolAdmin.id, pa.id, fe.id]]);

  try {
    await pool.query('UPDATE schools SET assigned_admin_id = ? WHERE id = ?', [fe.id, schoolId]);
    const teacher = await signIn({ username: fx.teacher.username, password: fx.password });
    const school = await signIn({ username: fx.schoolAdmin.username, password: fx.password });
    const head = await signIn(pa);
    const engineer = await signIn(fe);
    const report = async (token, title, priority) => {
      const r = await api('POST', '/errors', { token, body: {
        title: 'VERIFY notices — ' + title, description: 'Verification row.', school_id: schoolId,
        category: 'Hardware', priority } });
      if (r.body && r.body.id) errorIds.push(r.body.id);
      return r;
    };

    console.log('\n1. A teacher\'s fault: the school admin\'s bell, nobody else\'s');
    const a = await report(teacher, 'projector', 'medium');
    ok('reported', a.status === 201, a);
    ok('on the school admin\'s bell', (await bellFor(school, 'error_reported', a.body.id)).length === 1);
    ok('not on the engineer\'s bell yet — the school triages first', (await bellFor(engineer, 'error_assigned', a.body.id)).length === 0);
    ok('not on head office\'s bell', (await bellFor(head, 'error_escalated', a.body.id)).length === 0);

    console.log('\n2. "Escalate to OE" reaches head office AND the engineer');
    const esc = await api('POST', `/errors/${a.body.id}/escalate`, { token: school, body: { reason: 'Beyond school capacity', note: 'verification' } });
    ok('escalated', esc.status === 200, esc);
    ok('the answer names who holds it now', esc.body && esc.body.assigned_to === fe.id, esc.body);
    ok('and who was told', esc.body && JSON.stringify(esc.body.notified) === JSON.stringify(['head_office', 'engineer']), esc.body);
    const ho = await bellFor(head, 'error_escalated', a.body.id);
    ok('on head office\'s bell', ho.length === 1, ho.length);
    ok('with the school admin\'s reason', ho[0] && /Beyond school capacity/.test(ho[0].message), ho[0] && ho[0].message);
    ok('marked as having an engineer', ho[0] && metaOf(ho[0]).unassigned === false);
    const en = await bellFor(engineer, 'error_assigned', a.body.id);
    ok('on the field engineer\'s bell', en.length === 1, en.length);
    ok('addressed to that engineer', en[0] && Number(metaOf(en[0]).assigned_to) === fe.id);
    ok('the bell query is per engineer (source)', /assigned_to'\)\) AS UNSIGNED\) = \?/.test(
      fs.readFileSync(path.join(ROOT, 'backend/src/controllers/schoolController.js'), 'utf8')));
    const again = await api('POST', `/errors/${a.body.id}/escalate`, { token: school, body: { reason: 'Beyond school capacity' } });
    ok('a second escalation is refused', again.status === 400, again.status);
    ok('and writes no second notice', (await bellFor(head, 'error_escalated', a.body.id)).length === 1);

    console.log('\n3. Routed straight to the engineer: on their bell at once');
    const c = await report(teacher, 'no internet anywhere', 'critical');
    ok('critical from a teacher: on the engineer\'s bell', (await bellFor(engineer, 'error_assigned', c.body.id)).length === 1);
    ok('and still on the school admin\'s, saying why', (await bellFor(school, 'error_reported', c.body.id)).some(n => /critical/i.test(n.message)));
    const s = await report(school, 'school admin report', 'high');
    ok('a school admin\'s own report: on the engineer\'s bell', (await bellFor(engineer, 'error_assigned', s.body.id)).length === 1);
    ok('and not on their own bell', (await bellFor(school, 'error_reported', s.body.id)).length === 0);

    console.log('\n4. A school with no field engineer: head office is told to assign one');
    await pool.query('UPDATE schools SET assigned_admin_id = NULL WHERE id = ?', [schoolId]);
    const b = await report(teacher, 'nobody holds this', 'low');
    const escB = await api('POST', `/errors/${b.body.id}/escalate`, { token: school, body: { reason: 'Requires hardware replacement' } });
    ok('escalated', escB.status === 200, escB);
    ok('nobody holds it', escB.body && escB.body.assigned_to === null, escB.body);
    const hoB = await bellFor(head, 'error_escalated', b.body.id);
    ok('head office\'s bell marks it unassigned', hoB[0] && metaOf(hoB[0]).unassigned === true, hoB[0]);
    ok('and says what to do', hoB[0] && /assign one/i.test(hoB[0].message), hoB[0] && hoB[0].message);
    const asg = await api('PATCH', `/errors/${b.body.id}/assign`, { token: head, body: { assigned_to: fe.id, note: 'verification' } });
    ok('head office assigns it', asg.status === 200, asg);
    ok('which reaches the engineer\'s bell', (await bellFor(engineer, 'error_assigned', b.body.id)).length === 1);
    const [[st]] = await pool.query('SELECT status, assigned_to FROM errors WHERE id = ?', [b.body.id]);
    ok('Assign keeps Escalated (only Open becomes In Progress)', st.status === 'escalated' && st.assigned_to === fe.id, st);
    const d = await report(teacher, 'assign from open', 'low');
    await api('PATCH', `/errors/${d.body.id}/assign`, { token: head, body: { assigned_to: fe.id } });
    const [[st2]] = await pool.query('SELECT status FROM errors WHERE id = ?', [d.body.id]);
    ok('Assign on an Open fault makes it In Progress', st2.status === 'progress', st2);
    const refused = await api('PATCH', `/errors/${d.body.id}/assign`, { token: school, body: { assigned_to: fe.id } });
    ok('only head office can Assign', refused.status === 403, refused.status);

    console.log('\n5. The other intake channels tell the engineer too (source)');
    for (const f of ['phoneIntakeController.js', 'whatsappController.js']) {
      const src = fs.readFileSync(path.join(ROOT, 'backend/src/controllers', f), 'utf8');
      ok(`${f} calls notifyEngineer when routed to an engineer`, /if \(route\.assignedTo\) \{\s*await intake\.notifyEngineer/.test(src));
    }

    console.log('\n6. The bells draw them (source)');
    const bell = fs.readFileSync(path.join(ROOT, 'frontend/js/components/notifications.js'), 'utf8');
    ok('the school admin\'s bell draws error_reported', /n\.type === 'error_reported'/.test(bell));
    ok('head office\'s bell draws error_escalated', /n\.type === 'error_escalated'/.test(bell));
    ok('both open the fault itself', (bell.match(/openError\(meta\.error_id\)/g) || []).length >= 2);

    console.log('\n7. In a browser: the bell shows it and opens the fault');
    const fresh = await report(teacher, 'bell in the browser', 'high');
    const [[schoolUser]] = await pool.query('SELECT id, username, full_name, role, school_id FROM users WHERE id = ?', [fx.schoolAdmin.id]);
    page = await browser.launch();
    for (const [w, h] of [[1440, 900], [390, 844]]) {
      await page.size(w, h);
      await page.load(BASE + '/');
      await page.eval(`localStorage.setItem('qft_token', ${JSON.stringify(school)}); localStorage.setItem('qft_user', ${JSON.stringify(JSON.stringify(schoolUser))}); true`);
      await page.load(`${BASE}/?n=${w}#dashboard`);
      await page.waitFor(`!!document.querySelector('.section-header')`, 10000);
      await page.eval(`Notifications.toggle(); true`);
      const code = fresh.body.error_code;
      const shown = await page.waitFor(`[...document.querySelectorAll('.notif-item-title')].some(t => t.textContent.includes(${JSON.stringify(code)})) && true`, 8000);
      ok(`${w}px: the teacher's fault is on the school admin's bell`, !!shown);
      await page.eval(`(() => { const i = [...document.querySelectorAll('.notif-item')].find(x => x.textContent.includes(${JSON.stringify(code)})); i && i.click(); return true; })()`);
      const opened = await page.waitFor(`document.querySelector('#modal.open') && document.body.textContent.includes(${JSON.stringify(code)}) && document.body.textContent.includes('Escalate to OE') && true`, 8000);
      ok(`${w}px: clicking it opens that fault, with Escalate to OE`, !!opened);
      await pool.query(`UPDATE admin_notifications SET is_read = 0 WHERE type = 'error_reported' AND JSON_UNQUOTE(JSON_EXTRACT(meta, '$.error_id')) = ?`, [String(fresh.body.id)]);
    }
  } finally {
    if (page) await page.close().catch(() => {});
    for (const id of errorIds) {
      await pool.query('DELETE FROM error_updates WHERE error_id = ?', [id]);
      await pool.query('DELETE FROM errors WHERE id = ?', [id]);
      await pool.query(`DELETE FROM admin_notifications WHERE JSON_UNQUOTE(JSON_EXTRACT(meta, '$.error_id')) = ?`, [String(id)]);
    }
    await pool.query("DELETE FROM errors WHERE title LIKE 'VERIFY notices%'");
    await pool.query("DELETE FROM audit_log WHERE summary LIKE '%VERIFY notices%'");
    await pool.query('UPDATE schools SET assigned_admin_id = ? WHERE id = ?', [orig.assigned_admin_id, schoolId]);
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
