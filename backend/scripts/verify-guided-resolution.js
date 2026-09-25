/**
 * Verification — guided resolution, phase 1 (docs/features/14-guided-resolution.md).
 *
 *  Sources   all four are searched: guides, uploaded resources, what was fixed
 *            here before, and photographs of past faults — not guides alone,
 *            which is all feature 10 could see.
 *  Shape     steps first, then the media that shows them, then past fixes, then
 *            documents. Never media above the steps: a video costs bandwidth,
 *            sound and minutes.
 *  Honesty   nothing matched returns nothing, never the least-bad guess. A
 *            guide nobody has met has success_rate null, never 0%.
 *  Scope     a past fix crosses schools STRIPPED — what was done and how long
 *            ago, never the school, the reporter or their contact details. A
 *            photograph never crosses at all: it is a picture of their room.
 *  Gates     the endpoint needs a session, validates the category server-side,
 *            and takes its school from the account, never from the query.
 *
 * Needs the local server. Creates zzverify* rows and removes them.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const pool = require('../src/config/database');
const fixtures = require('./lib/fixtures');

const BASE = process.env.VERIFY_BASE || 'http://localhost:3210';

let passed = 0, failed = 0;
function ok(name, cond, detail) {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail !== undefined ? ' — ' + JSON.stringify(detail) : ''}`); }
}
const section = t => console.log('\n' + t);

async function api(method, p, { token } = {}) {
  const r = await fetch(BASE + '/api' + p, {
    method, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}) }
  });
  return { status: r.status, body: await r.json().catch(() => null) };
}
const ask = (token, params) => api('GET', '/assist/resources?' + new URLSearchParams(params), { token });

async function send(method, p, token, body) {
  const r = await fetch(BASE + '/api' + p, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {})
  });
  return { status: r.status, body: await r.json().catch(() => null) };
}
const postJson = (p, token, body) => send('POST', p, token, body);
const putJson = (p, token, body) => send('PUT', p, token, body);

/** Everything this suite wrote, removed in the finally. */
const made = { guides: [], manuals: [], errors: [], attachments: [], schools: [] };

// A phrase nothing else in the database contains, so every match is one we made.
const MARK = 'zzkifaa';

async function run() {
  const f = await fixtures.ensure();
  const token = (await fixtures.signIn(f.teacher.username, fixtures.PASSWORD, BASE)).token;
  const ownSchool = f.school.id;

  // Another school, so "does a fix cross schools, and does a photograph not"
  // can be asked exactly rather than inferred.
  const [otherRows] = await pool.query('SELECT id FROM schools WHERE id <> ? ORDER BY id LIMIT 1', [ownSchool]);
  const otherSchool = otherRows.length ? otherRows[0].id : ownSchool;

  /* -- fixtures ---------------------------------------------------------- */

  const [g] = await pool.query(
    `INSERT INTO troubleshooting_guides (title, category, icon, steps, is_custom)
     VALUES (?, 'Hardware', 'ti-plug', ?, 1)`,
    [`${MARK} charging hub will not power`, JSON.stringify(['Unplug the hub', 'Reseat the lead', 'Watch the LED'])]
  );
  made.guides.push(g.insertId);

  const [vid] = await pool.query(
    `INSERT INTO manuals (title, original_filename, stored_filename, file_type, file_size, category, uploaded_by)
     VALUES (?, 'hub.mp4', 'https://example.invalid/hub.mp4', 'video/mp4', 900000, 'Hardware', 'verify')`,
    [`${MARK} reseating a charging hub`]
  );
  made.manuals.push(vid.insertId);

  const [pdf] = await pool.query(
    `INSERT INTO manuals (title, original_filename, stored_filename, file_type, file_size, category, uploaded_by)
     VALUES (?, 'hub.pdf', 'https://example.invalid/hub.pdf', 'application/pdf', 4000000, 'Hardware', 'verify')`,
    [`${MARK} charging hub manual`]
  );
  made.manuals.push(pdf.insertId);

  // A fault resolved at ANOTHER school, with a note saying what was done.
  const code = 'ZZG-' + Math.random().toString(36).slice(2, 8).toUpperCase();
  const [e] = await pool.query(
    `INSERT INTO errors (error_code, title, description, school_id, category, priority, status,
       reported_by_user_id, reporter_name, reporter_contact, resolved_at, created_at)
     VALUES (?, ?, 'fixture', ?, 'Hardware', 'high', 'resolved', ?, 'Mwalimu Fulani', '+255 700 000 999',
       DATE_SUB(NOW(), INTERVAL 5 DAY), DATE_SUB(NOW(), INTERVAL 7 DAY))`,
    [code, `${MARK} charging hub dead in Form 2`, otherSchool, f.teacher.userId]
  );
  made.errors.push(e.insertId);
  await pool.query(
    `INSERT INTO error_updates (error_id, update_type, note, recorded_by)
     VALUES (?, 'Resolution', 'Reseated the power lead at the back of the hub and it came straight back.', 'Engineer')`,
    [e.insertId]
  );

  // A photograph on that other school's fault — must never reach this teacher.
  const [att] = await pool.query(
    `INSERT INTO error_attachments (error_id, original_filename, stored_url, file_type, resource_type, uploaded_by)
     VALUES (?, 'their-room.jpg', 'https://example.invalid/their-room.jpg', 'image/jpeg', 'image', 'verify')`,
    [e.insertId]
  );
  made.attachments.push(att.insertId);

  /* -- the questions ----------------------------------------------------- */

  section('All four sources are searched, not guides alone');

  const r = await ask(token, { category: 'Hardware', text: `${MARK} charging hub will not power on` });
  ok('the endpoint answers', r.status === 200, r.status);
  ok('and says it matched something', r.body && r.body.matched === true, r.body);

  ok('a guide comes back under steps',
    (r.body.steps || []).some(s => s.id === g.insertId), (r.body.steps || []).map(s => s.title));
  ok('an uploaded video comes back under watch',
    (r.body.watch || []).some(m => m.id === vid.insertId && m.kind === 'video'), r.body.watch);
  ok('a PDF comes back under read, not watch',
    (r.body.read || []).some(m => m.id === pdf.insertId && m.kind === 'pdf')
    && !(r.body.watch || []).some(m => m.kind === 'pdf'), { read: r.body.read, watch: r.body.watch });
  ok('what was done last time comes back under fixes',
    (r.body.fixes || []).some(x => /reseated the power lead/i.test(x.what_was_done || '')), r.body.fixes);

  section('The shape is steps, then what shows them, then what was done, then what to read');

  const order = Object.keys(r.body).filter(k => ['steps', 'watch', 'fixes', 'read'].includes(k));
  ok('the payload carries the four bands in that order',
    order.join(',') === 'steps,watch,fixes,read', order);
  ok('every step carries its steps, so the panel needs no second request',
    (r.body.steps || []).every(s => Array.isArray(s.steps) && s.steps.length), r.body.steps);

  section('A past fix crosses schools stripped; a photograph does not cross at all');

  const fix = (r.body.fixes || []).find(x => /reseated the power lead/i.test(x.what_was_done || ''));
  ok('the fix is shown even though it happened at another school', !!fix, r.body.fixes);
  if (fix) {
    const blob = JSON.stringify(fix);
    ok('...without naming the school', !/school_id|school_name/.test(blob) && !/"name"/.test(blob), fix);
    ok('...without the reporter or their phone number',
      !/Mwalimu Fulani/.test(blob) && !/255 700 000 999/.test(blob), fix);
    ok('...and says it was somewhere else, not "fixed here"', fix.same_school === false, fix);
    ok('...with how long ago, because last week counts for more than last year',
      typeof fix.days_ago === 'number', fix);
  }
  const blobAll = JSON.stringify(r.body);
  ok('another school\'s photograph is never offered — it is a picture of their room',
    !blobAll.includes('their-room.jpg'), (r.body.watch || []).map(w => w.filename));

  section('Nothing matched is answered honestly');

  const none = await ask(token, { category: 'Accounts', text: 'zzabsolutelynothinglikethisexists anywhere' });
  ok('matched is false', none.body && none.body.matched === false, none.body);
  ok('and all four bands are empty — never the least-bad guess',
    ['steps', 'watch', 'fixes', 'read'].every(k => (none.body[k] || []).length === 0), none.body);

  const tooShort = await ask(token, { category: '', text: 'abc' });
  ok('a query too short to mean anything is not answered with guesses either',
    tooShort.body && tooShort.body.matched === false, tooShort.body);

  section('A resource nobody has met is null, never 0%');

  const fresh = (r.body.steps || []).find(s => s.id === g.insertId);
  ok('a brand-new guide reports success_rate null, not 0',
    fresh && fresh.success_rate === null, fresh);

  section('The gates');

  const anon = await api('GET', '/assist/resources?text=' + MARK);
  ok('no session, no answer', anon.status === 401, anon.status);

  const bogus = await ask(token, { category: '<script>alert(1)</script>', text: `${MARK} charging hub` });
  ok('a category that is not on the list is ignored, not passed through',
    bogus.status === 200 && bogus.body && !JSON.stringify(bogus.body).includes('<script'), bogus.status);

  // The school scope is the account's, never the query string: a school id in a
  // request is a key, not a permission (SEC-001/002/004). Same text as the first
  // call, so the only variable is the school id somebody tried to smuggle in.
  const sameText = { category: 'Hardware', text: `${MARK} charging hub will not power on` };
  const spoof = await ask(token, { ...sameText, school_id: otherSchool });
  ok('a school_id in the query changes nothing — scope comes from the account',
    JSON.stringify(spoof.body) === JSON.stringify(r.body), {
      with: (spoof.body.fixes || []).length, without: (r.body.fixes || []).length
    });

  // Same request twice must render the same order, or the panel reshuffles while
  // somebody is reading it. MySQL is free to return unordered rows however it likes.
  const again = await ask(token, sameText);
  ok('...and the same question twice gives the same order',
    JSON.stringify(again.body) === JSON.stringify(r.body), 'order was unstable');

  section('A note about the process is not a note about the fix');

  // True, logged against a resolved fault, and it teaches the next person
  // nothing. Noise here is worse than an empty band: it makes the panel look
  // busy while helping nobody.
  const code2 = 'ZZG-' + Math.random().toString(36).slice(2, 8).toUpperCase();
  const [e2] = await pool.query(
    `INSERT INTO errors (error_code, title, description, school_id, category, priority, status,
       reported_by_user_id, resolved_at, created_at)
     VALUES (?, ?, 'fixture', ?, 'Hardware', 'high', 'resolved', ?,
       DATE_SUB(NOW(), INTERVAL 2 DAY), DATE_SUB(NOW(), INTERVAL 3 DAY))`,
    [code2, `${MARK} charging hub boilerplate case`, ownSchool, f.teacher.userId]
  );
  made.errors.push(e2.insertId);
  await pool.query(
    `INSERT INTO error_updates (error_id, update_type, note, recorded_by)
     VALUES (?, 'resolved', 'Teacher followed the troubleshooting guide and confirmed it worked.', 'System')`,
    [e2.insertId]
  );
  const afterBoiler = await ask(token, { category: 'Hardware', text: `${MARK} charging hub will not power on` });
  ok('"followed the guide and confirmed it worked" is not offered as a fix',
    !(afterBoiler.body.fixes || []).some(x => /followed the troubleshooting guide/i.test(x.what_was_done || '')),
    (afterBoiler.body.fixes || []).map(x => x.what_was_done));
  ok('...while the note that says what was actually done still is',
    (afterBoiler.body.fixes || []).some(x => /reseated the power lead/i.test(x.what_was_done || '')),
    (afterBoiler.body.fixes || []).map(x => x.what_was_done));

  /* -- phase 2: the sentence above the resources ------------------------- */

  section('The assessment is grounded in the retrieved set, or it is not shown');

  // These run against the real service with no model configured on a dev
  // machine, so they assert the CONTRACT rather than the prose: what the
  // grounding does with invented refs, and that a missing model costs the
  // sentence and never the resources.
  const assessment = require('../src/services/assessment');
  const fakeFound = {
    matched: true,
    steps: [{ id: 41, title: 'A guide', category: 'Hardware', steps: ['one', 'two'] }],
    watch: [{ type: 'resource', id: 7, kind: 'video', title: 'A video', category: 'Hardware' }],
    fixes: [{ id: 99, title: 'A past fault', days_ago: 4, what_was_done: 'Reseated the lead.' }],
    read: []
  };
  const described = assessment.describe(fakeFound);
  ok('every candidate is handed to the model with a ref it must answer with',
    described.refs.has('guide:41') && described.refs.has('resource:7') && described.refs.has('fix:99'),
    [...described.refs]);
  ok('...and nothing else is in the allowed set', described.refs.size === 3, [...described.refs]);
  ok('the past fix is described by what was done, which is the whole point of it',
    described.lines.some(l => /Reseated the lead/.test(l)), described.lines);

  ok('a reply wrapped in prose still parses',
    (assessment.extractJson('Here you go:\n{"assessment_sw":"a","picks":[]}\nHope that helps') || {}).assessment_sw === 'a');
  ok('a reply with a nested object parses to the outer one',
    (assessment.extractJson('{"a":{"b":1},"c":2}') || {}).c === 2);
  ok('a reply that is not JSON at all yields null, so the caller falls back',
    assessment.extractJson('I could not do that') === null);
  ok('a brace inside a string does not end the object early',
    (assessment.extractJson('{"assessment_sw":"tumia } hii","picks":[]}') || {}).assessment_sw === 'tumia } hii');

  section('A model that is unconfigured costs the sentence, never the help');

  const assessed = await api('POST', '/assist/assess', { token }) ;
  ok('the endpoint answers rather than erroring', assessed.status === 200 || assessed.status === 400, assessed.status);

  const shortAsk = await postJson('/assist/assess', token, { category: 'Hardware', text: 'short' });
  ok('a description too thin to assess is refused politely, not guessed at',
    shortAsk.status === 200 && shortAsk.body.ok === false && shortAsk.body.reason === 'too_short', shortAsk.body);

  const realAsk = await postJson('/assist/assess', token, {
    category: 'Hardware',
    text: `${MARK} charging hub will not power on, all 12 tablets on hub 2 are dead and the light is off`
  });
  ok('a real description gets a structured answer either way', realAsk.status === 200, realAsk.status);
  if (realAsk.body && realAsk.body.ok) {
    ok('...with both languages, because a second translation call is how they drift',
      !!(realAsk.body.assessment && realAsk.body.assessment.sw && realAsk.body.assessment.en), realAsk.body.assessment);
    ok('...and every "why" is keyed by a ref that was actually retrieved',
      Object.keys(realAsk.body.why || {}).every(k => /^(guide|resource|photo|fix):\d+$/.test(k)),
      Object.keys(realAsk.body.why || {}));
    ok('...with nothing invented', realAsk.body.invented_refs === 0, realAsk.body.invented_refs);
  } else {
    ok('...or a named reason the page can fall back on',
      typeof realAsk.body.reason === 'string' && realAsk.body.reason.length > 0, realAsk.body);
  }

  // The resources must be unaffected by whatever the model did.
  const stillThere = await ask(token, { category: 'Hardware', text: `${MARK} charging hub will not power on` });
  ok('the resources are there whatever the model did',
    stillThere.body.matched === true && (stillThere.body.steps || []).length > 0, stillThere.body.matched);

  section('Reading language lives on the account, not the device');

  const langGet = await api('GET', '/auth/language', { token });
  ok('an account that has not chosen reads Kiswahili',
    langGet.status === 200 && langGet.body.language === 'sw' && langGet.body.chosen === false, langGet.body);

  const setEn = await putJson('/auth/language', token, { language: 'en' });
  ok('a choice is accepted', setEn.status === 200 && setEn.body.language === 'en', setEn.body);

  const langAgain = await api('GET', '/auth/language', { token });
  ok('...and survives, because it is on the account not in browser storage',
    langAgain.body.language === 'en' && langAgain.body.chosen === true, langAgain.body);

  const bogusLang = await putJson('/auth/language', token, { language: 'fr; DROP TABLE users' });
  ok('a language that is not on the list is refused on the server',
    bogusLang.status === 400, bogusLang.status);

  const anonLang = await api('GET', '/auth/language');
  ok('and no session, no preference', anonLang.status === 401, anonLang.status);

  section('Its own mount, so no /:id can swallow it');

  ok('the route is not read as a guide id',
    r.status === 200 && r.body.matched !== undefined, r.status);
}

(async () => {
  try { await run(); }
  catch (e) { failed++; console.log('  FAIL  suite threw —', e.message); }
  finally {
    const del = async (sql, ids) => { if (ids.length) await pool.query(sql, [ids]).catch(() => {}); };
    await del('DELETE FROM error_attachments WHERE id IN (?)', made.attachments);
    await del('DELETE FROM error_updates WHERE error_id IN (?)', made.errors);
    await del('DELETE FROM errors WHERE id IN (?)', made.errors);
    await del('DELETE FROM manuals WHERE id IN (?)', made.manuals);
    await del('DELETE FROM troubleshooting_guides WHERE id IN (?)', made.guides);
    await fixtures.cleanup().catch(() => {});
    console.log(`\n  ${passed} passed, ${failed} failed`);
    await pool.end();
    process.exit(failed ? 1 : 0);
  }
})();
