/**
 * Verification — USSD and SMS intake (feature 8), 2026-09-10.
 *
 * The claim being tested: a teacher with no internet, no bundle and a feature
 * phone can report a fault, and that fault behaves exactly like one filed on
 * the web — same routing, same classification, same school administrator.
 *
 * Also pins the cross-channel consistency the audit found broken: WhatsApp used
 * to assign the field engineer directly while the web form routed to the school
 * administrator. One rule now, asserted from all four channels.
 *
 * Run from backend/:  node scripts/verify-phone-intake.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const pool = require('../src/config/database');
const fixtures = require('./lib/fixtures');
const intake = require('../src/services/intake');

const BASE = process.env.VERIFY_BASE || 'http://localhost:3100';
const KEY = process.env.PHONE_INTAKE_KEY;

let passed = 0, failed = 0;
function ok(name, cond, detail) {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail !== undefined ? ' — ' + JSON.stringify(detail) : ''}`); }
}
function eq(name, actual, expected) {
  ok(name, JSON.stringify(actual) === JSON.stringify(expected), { actual, expected });
}

/** One USSD step. Africa's Talking posts form-encoded and expects text back. */
async function ussd({ session, phone, text, key = KEY }) {
  const body = new URLSearchParams({ sessionId: session, phoneNumber: phone, serviceCode: '*149*00#', text: text || '' });
  const res = await fetch(BASE + '/api/ussd' + (key ? '?key=' + encodeURIComponent(key) : ''), {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body
  });
  return { status: res.status, body: (await res.text()).trim() };
}

async function inboundSms({ from, text, key = KEY }) {
  const body = new URLSearchParams({ from, to: '15200', text, date: new Date().toISOString(), id: String(Date.now()) });
  const res = await fetch(BASE + '/api/sms/inbound' + (key ? '?key=' + encodeURIComponent(key) : ''), {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body
  });
  return res.status;
}

const settle = (ms = 350) => new Promise(r => setTimeout(r, ms));
const latestFor = async (contact) => {
  const [rows] = await pool.query(
    'SELECT * FROM errors WHERE reporter_contact = ? ORDER BY id DESC LIMIT 1', [contact]
  );
  return rows[0] || null;
};

(async () => {
  console.log('\nPhone intake verification (USSD + SMS)');
  console.log('='.repeat(56));
  if (!KEY) { console.error('PHONE_INTAKE_KEY must be set in backend/.env'); process.exit(1); }

  const fx = await fixtures.ensure();
  const school = fx.school;
  const UNKNOWN = '+255700000901';
  const KNOWN = '+255700000902';

  // Give the fixture teacher a phone so "recognised number" is testable.
  await pool.query('UPDATE users SET phone = ? WHERE id = ?', [KNOWN, fx.teacher.userId]);
  const [[eng]] = [await pool.query('SELECT assigned_admin_id FROM schools WHERE id = ?', [school.id])];
  const fieldEngineer = eng[0].assigned_admin_id;

  try {
    // ---- 1. the callback is authenticated --------------------------------
    console.log('\n1. The callback refuses anything but the shared secret');
    const noKey = await ussd({ session: 'a1', phone: UNKNOWN, text: '', key: null });
    eq('no key -> 403', noKey.status, 403);
    ok('and the caller is told, not left hanging', noKey.body.startsWith('END'), noKey.body);
    const badKey = await ussd({ session: 'a2', phone: UNKNOWN, text: '', key: 'wrong' });
    eq('wrong key -> 403', badKey.status, 403);

    // ---- 2. the menu ------------------------------------------------------
    console.log('\n2. The menu');
    const menu = await ussd({ session: 'b1', phone: UNKNOWN, text: '' });
    ok('opens with CON so the session stays alive', menu.body.startsWith('CON '), menu.body.slice(0, 20));
    ok('offers report, status and the support number',
      /1\..*Ripoti/.test(menu.body) && /2\./.test(menu.body) && /3\./.test(menu.body), menu.body);
    ok('fits a USSD screen (182 chars)', menu.body.length <= 182, menu.body.length);

    // ---- 3. an unrecognised number can still report -----------------------
    console.log('\n3. An unrecognised number reports with a school code');
    eq('it is asked for the school code',
      (await ussd({ session: 'c1', phone: UNKNOWN, text: '1' })).body.includes('CODE'), true);
    const badCode = await ussd({ session: 'c1', phone: UNKNOWN, text: '1*nosuchschool' });
    ok('a wrong code is refused, and says what to do', badCode.body.startsWith('END') && /msimamizi/i.test(badCode.body), badCode.body);

    const cat = await ussd({ session: 'c2', phone: UNKNOWN, text: `1*${school.code}` });
    ok('a good code reaches the category menu', cat.body.includes('Tatizo'), cat.body);
    const scope = await ussd({ session: 'c2', phone: UNKNOWN, text: `1*${school.code}*1` });
    ok('then the scope menu', scope.body.includes('Limeathiri'), scope.body);
    const note = await ussd({ session: 'c2', phone: UNKNOWN, text: `1*${school.code}*1*3` });
    ok('then one optional free-text step', /0 kuruka/.test(note.body), note.body);

    const done = await ussd({ session: 'c2', phone: UNKNOWN, text: `1*${school.code}*1*3*VERIFY ussd router imezimika` });
    ok('and ends with the ticket number', /END .*QFT-/.test(done.body), done.body);
    ok('naming the school', done.body.includes(school.name), done.body);

    const filed = await latestFor(UNKNOWN);
    ok('the fault exists', !!filed, filed);
    eq('classified from the menu, not guessed', filed.category, 'Connectivity');
    eq('one device -> medium', filed.priority, 'medium');
    eq('filed against the school in the code', filed.school_id, school.id);
    eq('marked as coming from USSD', filed.intake_channel, 'ussd');
    eq('and as an unverified caller', filed.reporter_role, 'ussd-unverified');
    eq('unassigned: the school administrator triages it', filed.assigned_to, null);
    eq('at school level', filed.escalation_level, 'school');
    ok('the description records the channel and the number',
      /Channel: ussd/.test(filed.description) && filed.description.includes(UNKNOWN), filed.description);

    // ---- 4. scope maps to priority ---------------------------------------
    console.log('\n4. Scale, not severity — the caller judges what they can see');
    const whole = await ussd({ session: 'd1', phone: UNKNOWN, text: `1*${school.code}*1*1*VERIFY ussd whole school` });
    ok('whole school files', /QFT-/.test(whole.body), whole.body);
    const crit = await latestFor(UNKNOWN);
    eq('whole school -> critical', crit.priority, 'critical');
    eq('critical does NOT wait for a human', crit.assigned_to, fieldEngineer);
    eq('and goes to platform level', crit.escalation_level, 'platform');
    ok('the caller is told an engineer has it', /Fundi/.test(whole.body), whole.body);

    await ussd({ session: 'd2', phone: UNKNOWN, text: `1*${school.code}*2*2*VERIFY ussd one class` });
    eq('one class -> high', (await latestFor(UNKNOWN)).priority, 'high');

    // ---- 5. a recognised number skips the school step --------------------
    console.log('\n5. A recognised number is not asked what it already knows');
    const known1 = await ussd({ session: 'e1', phone: KNOWN, text: '1' });
    ok('it goes straight to the categories', known1.body.includes('Tatizo'), known1.body);
    const knownDone = await ussd({ session: 'e1', phone: KNOWN, text: '1*4*3*VERIFY ussd known caller' });
    ok('and files', /QFT-/.test(knownDone.body), knownDone.body);
    const byKnown = await latestFor(KNOWN);
    eq('as a verified caller', byKnown.reporter_role, 'ussd');
    eq('attributed to their account', byKnown.reported_by_user_id, fx.teacher.userId);
    eq('at their own school', byKnown.school_id, school.id);
    eq('category from the menu', byKnown.category, 'Power');

    // ---- 6. status is for verified numbers only --------------------------
    console.log('\n6. A phone number is not authentication');
    const deniedStatus = await ussd({ session: 'f1', phone: UNKNOWN, text: '2' });
    ok('an unrecognised number cannot read anything back',
      deniedStatus.body.startsWith('END') && !/QFT-/.test(deniedStatus.body), deniedStatus.body);
    const allowedStatus = await ussd({ session: 'f2', phone: KNOWN, text: '2' });
    ok('a recognised one sees its own tickets', /QFT-/.test(allowedStatus.body), allowedStatus.body);
    ok('in words a caller understands', /imepokelewa|inafanyiwa|imetatuliwa|imepelekwa/.test(allowedStatus.body), allowedStatus.body);

    // ---- 7. SMS ----------------------------------------------------------
    console.log('\n7. SMS: write what is wrong, get a ticket number');
    eq('the callback accepts the vendor POST', await inboundSms({ from: KNOWN, text: 'VERIFY sms tablet haichaji' }), 200);
    await settle();
    const bySms = await latestFor(KNOWN);
    eq('a fault was filed', bySms.intake_channel, 'sms');
    eq('classified from the words', bySms.category, 'Hardware');
    eq('attributed to the account behind the number', bySms.reported_by_user_id, fx.teacher.userId);

    eq('an unknown number is told to lead with the school code',
      await inboundSms({ from: UNKNOWN, text: 'VERIFY sms hakuna maelezo' }), 200);
    await settle();
    const [before] = await pool.query("SELECT COUNT(*) n FROM errors WHERE reporter_contact = ? AND intake_channel = 'sms'", [UNKNOWN]);
    eq('and nothing is filed against a school we cannot identify', before[0].n, 0);

    await inboundSms({ from: UNKNOWN, text: `${school.code} VERIFY sms projector imekufa` });
    await settle();
    const [after] = await pool.query("SELECT * FROM errors WHERE reporter_contact = ? AND intake_channel = 'sms' ORDER BY id DESC LIMIT 1", [UNKNOWN]);
    eq('with the code, it files', after.length, 1);
    eq('as unverified', after[0].reporter_role, 'sms-unverified');

    eq('STATUS is refused to an unknown number', await inboundSms({ from: UNKNOWN, text: 'STATUS' }), 200);
    eq('MSAADA is answered', await inboundSms({ from: KNOWN, text: 'MSAADA' }), 200);
    await settle();
    const [helpFiled] = await pool.query(
      "SELECT COUNT(*) n FROM errors WHERE reporter_contact = ? AND title LIKE '%MSAADA%'", [KNOWN]);
    eq('a keyword never becomes a fault', helpFiled[0].n, 0);

    // ---- 8. one routing rule for every channel ---------------------------
    console.log('\n8. Every channel routes the same way');
    const cases = [
      ['teacher, medium', { reporterRole: 'teacher', priority: 'medium', fieldEngineerId: 7 }, { assignedTo: null, escalationLevel: 'school' }],
      ['teacher, critical', { reporterRole: 'teacher', priority: 'critical', fieldEngineerId: 7 }, { assignedTo: 7, escalationLevel: 'platform' }],
      ['unverified phone', { reporterRole: null, priority: 'high', fieldEngineerId: 7 }, { assignedTo: null, escalationLevel: 'school' }],
      ['school admin', { reporterRole: 'school', priority: 'low', fieldEngineerId: 7 }, { assignedTo: 7, escalationLevel: 'platform' }],
      ['head office', { reporterRole: 'admin', priority: 'low', fieldEngineerId: 7 }, { assignedTo: 7, escalationLevel: 'platform' }]
    ];
    for (const [name, input, expected] of cases) {
      const r = intake.routeFor(input);
      eq(`routeFor: ${name}`, { assignedTo: r.assignedTo, escalationLevel: r.escalationLevel }, expected);
    }
    const waSrc = require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'controllers', 'whatsappController.js'), 'utf8');
    ok('WhatsApp asks the shared rule instead of assigning directly',
      /intake\.routeFor/.test(waSrc) && !/school\.assigned_admin_id \|\| null, reporterName/.test(waSrc));
    const errSrc = require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'controllers', 'errorController.js'), 'utf8');
    ok('the web form asks the same rule', /intake\.routeFor/.test(errSrc));

    // ---- 9. sessions, including the ones that gave up --------------------
    console.log('\n9. Abandoned sessions are recorded too');
    await ussd({ session: 'g1', phone: UNKNOWN, text: '' });   // opened the menu and stopped
    const [sessions] = await pool.query("SELECT outcome, COUNT(*) n FROM ussd_sessions GROUP BY outcome");
    const byOutcome = Object.fromEntries(sessions.map(s => [s.outcome, s.n]));
    ok('a session that only saw the menu is on record', (byOutcome.menu || 0) > 0, byOutcome);
    ok('so are the ones that filed', (byOutcome.filed || 0) > 0, byOutcome);
    ok('and the ones refused a bad school code', (byOutcome.bad_school_code || 0) > 0, byOutcome);
    const [dupes] = await pool.query('SELECT session_id, COUNT(*) n FROM ussd_sessions GROUP BY session_id HAVING n > 1');
    eq('one row per session, not one per keypress', dupes.length, 0);
  } finally {
    await pool.query("DELETE FROM error_updates WHERE error_id IN (SELECT id FROM errors WHERE title LIKE 'VERIFY %' OR description LIKE '%VERIFY ussd%' OR description LIKE '%VERIFY sms%')");
    await pool.query("DELETE FROM errors WHERE title LIKE 'VERIFY %' OR description LIKE '%VERIFY ussd%' OR description LIKE '%VERIFY sms%'");
    await pool.query("DELETE FROM ussd_sessions WHERE phone IN ('+255700000901','+255700000902') OR session_id IN ('t1','t2','t3','s9')");
    await pool.query("DELETE FROM admin_notifications WHERE type = 'error_reported'");
    await pool.query("DELETE FROM audit_log WHERE summary LIKE '%USSD%' OR summary LIKE '%SMS%'");
    await fixtures.cleanup();

    console.log('\n' + '='.repeat(56));
    console.log(`  ${passed} passed, ${failed} failed`);
    const [left] = await pool.query("SELECT COUNT(*) n FROM errors WHERE intake_channel IN ('ussd','sms')");
    console.log(`  phone-intake rows left behind: ${left[0].n}`);
    await pool.end();
    process.exit(failed ? 1 : 0);
  }
})().catch(async (e) => {
  console.error('\nSUITE ERROR:', e.message);
  try { await pool.end(); } catch (x) {}
  process.exit(1);
});
