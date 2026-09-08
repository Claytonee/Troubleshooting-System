/**
 * End-to-end check for WhatsApp intake (docs/features/03-whatsapp-intake.md).
 *
 *   cd backend && node scripts/verify-whatsapp.js
 *
 * Needs the server running on localhost:3100 with WHATSAPP_APP_SECRET and
 * WHATSAPP_VERIFY_TOKEN set. Sending stays unconfigured on purpose — outbound
 * is a no-op that logs, which is exactly what makes the inbound half testable
 * without a Meta account. Replies are asserted from the whatsapp_messages
 * transcript instead.
 *
 * It WRITES TO THE DATABASE: conversations, transcript rows and one ticket,
 * all removed at the end. Do not point it at production.
 */
require('dotenv').config({ path: '.env' });
const crypto = require('crypto');
const pool = require('../src/config/database');

const BASE = 'http://localhost:3100';
const SECRET = process.env.WHATSAPP_APP_SECRET;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

const UNKNOWN = '+255700000111';   // not in users
let STAFF = null;                  // filled from a real user row

let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  if (ok) pass++; else fail++;
  console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + name + (detail ? '  -> ' + detail : ''));
};

let msgSeq = 0;
function payload(from, text, opts = {}) {
  msgSeq++;
  const message = opts.type === 'image'
    ? { from: from.replace('+', ''), id: opts.id || `wamid.test.${Date.now()}.${msgSeq}`, type: 'image',
        image: { id: 'media-1', mime_type: 'image/jpeg', caption: text } }
    : opts.type === 'audio'
      ? { from: from.replace('+', ''), id: opts.id || `wamid.test.${Date.now()}.${msgSeq}`, type: 'audio',
          audio: { id: 'media-2', mime_type: 'audio/ogg' } }
      : { from: from.replace('+', ''), id: opts.id || `wamid.test.${Date.now()}.${msgSeq}`, type: 'text',
          text: { body: text } };
  return {
    object: 'whatsapp_business_account',
    entry: [{ id: '0', changes: [{ field: 'messages', value: { messaging_product: 'whatsapp', messages: [message] } }] }]
  };
}

function sign(raw) {
  return 'sha256=' + crypto.createHmac('sha256', SECRET).update(raw).digest('hex');
}

async function post(body, { badSignature = false, noSignature = false, awaitReply = true } = {}) {
  const raw = JSON.stringify(body);
  const headers = { 'Content-Type': 'application/json' };
  if (!noSignature) headers['X-Hub-Signature-256'] = badSignature ? sign(raw + 'x') : sign(raw);
  const phone = wireToE164(body);
  const before = awaitReply ? await outboundCount(phone) : 0;
  const res = await fetch(BASE + '/api/whatsapp/webhook', { method: 'POST', headers, body: raw });
  // The handler acknowledges before processing (Meta retries anything slower),
  // and the assistant step is a real network call, so wait for the reply to be
  // recorded rather than guessing a duration.
  if (awaitReply && res.status === 200) await waitForReply(phone, before);
  return res.status;
}

function wireToE164(body) {
  const m = body.entry[0].changes[0].value.messages[0];
  return '+' + String(m.from).replace(/\D/g, '');
}

async function outboundCount(phone) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) n FROM whatsapp_messages m
      JOIN whatsapp_conversations c ON m.conversation_id = c.id
      WHERE c.phone = ? AND m.direction = 'out'`, [phone]);
  return Number(rows[0].n);
}

/**
 * Waits for the reply to this inbound message and for the handler to settle.
 *
 * The endpoint acknowledges before processing — Meta retries anything slower —
 * and the assistant step is a real network call taking seconds. A fixed sleep
 * made the suite race against itself: assertions ran while the previous
 * message was still being handled. So wait for the outbound count to rise, then
 * confirm it has stopped rising before asserting anything.
 */
async function waitForReply(phone, before) {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    if (await outboundCount(phone) > before) break;
    await new Promise(r => setTimeout(r, 200));
  }
  let last = await outboundCount(phone);
  for (let stable = 0; stable < 2 && Date.now() < deadline;) {
    await new Promise(r => setTimeout(r, 300));
    const now = await outboundCount(phone);
    if (now === last) stable++; else { stable = 0; last = now; }
  }
  return last > before;
}

async function lastReply(phone) {
  const [rows] = await pool.query(
    `SELECT m.body FROM whatsapp_messages m
     JOIN whatsapp_conversations c ON m.conversation_id = c.id
     WHERE c.phone = ? AND m.direction = 'out'
     ORDER BY m.id DESC LIMIT 1`, [phone]);
  return rows.length ? rows[0].body : null;
}

async function conv(phone) {
  const [rows] = await pool.query('SELECT * FROM whatsapp_conversations WHERE phone = ?', [phone]);
  return rows[0] || null;
}

async function cleanup() {
  await pool.query("DELETE FROM errors WHERE intake_channel = 'whatsapp' AND reporter_contact LIKE '+2557000001%'");
  await pool.query('DELETE FROM whatsapp_conversations WHERE phone IN (?, ?)', [UNKNOWN, STAFF || '']);
  await pool.query("DELETE FROM audit_log WHERE summary LIKE '%reported over WhatsApp%'");
}

(async () => {
  if (!SECRET || !VERIFY_TOKEN) {
    console.error('  WHATSAPP_APP_SECRET and WHATSAPP_VERIFY_TOKEN must be set in backend/.env');
    process.exit(1);
  }

  // --- schema ---
  const [tables] = await pool.query(
    "SELECT TABLE_NAME t FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('whatsapp_conversations','whatsapp_messages')");
  check('schema: both whatsapp tables exist', tables.length === 2, tables.map(x => x.t).join(', '));
  const [ch] = await pool.query(
    "SELECT COLUMN_NAME c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='errors' AND COLUMN_NAME='intake_channel'");
  check('schema: errors.intake_channel exists', ch.length === 1);

  // Pick a real staff phone so identity resolution has something to match.
  // A user with a school on file, so the "verified, no question asked" path is
  // exercised. An admin has no single school by design and is checked after.
  let [[staff]] = await pool.query(
    "SELECT id, full_name, phone, role, school_id FROM users WHERE phone IS NOT NULL AND phone <> '' AND school_id IS NOT NULL ORDER BY id LIMIT 1");
  let staffHasSchool = !!staff;
  if (!staff) {
    // No school-scoped user has a phone in this database; fall back and adjust
    // the expectation rather than asserting something untrue.
    [[staff]] = await pool.query(
      "SELECT id, full_name, phone, role, school_id FROM users WHERE phone IS NOT NULL AND phone <> '' ORDER BY id LIMIT 1");
  }
  const norm = p => { let n = String(p).replace(/[^\d+]/g, ''); if (n.startsWith('+')) return n; if (n.startsWith('255')) return '+' + n; if (n.startsWith('0')) return '+255' + n.slice(1); return n.length === 9 ? '+255' + n : n; };
  STAFF = norm(staff.phone);
  await cleanup();
  console.log(`\n  staff test number: ${STAFF} (${staff.full_name}, ${staff.role})\n`);

  // --- webhook authentication ---
  check('GET handshake returns the challenge',
    await fetch(`${BASE}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(VERIFY_TOKEN)}&hub.challenge=42`)
      .then(async r => r.status === 200 && (await r.text()) === '42'));
  check('GET handshake rejects a wrong token',
    await fetch(`${BASE}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=42`)
      .then(r => r.status === 403));
  check('POST rejects a forged signature', await post(payload(UNKNOWN, 'hello'), { badSignature: true }) === 401);
  check('POST rejects a missing signature', await post(payload(UNKNOWN, 'hello'), { noSignature: true }) === 401);
  const [afterRejects] = await pool.query('SELECT COUNT(*) n FROM whatsapp_conversations WHERE phone = ?', [UNKNOWN]);
  check('a rejected webhook creates nothing', Number(afterRejects[0].n) === 0);

  // --- unknown number: asked for a school, cannot read anything ---
  check('valid signature is accepted', await post(payload(UNKNOWN, 'Wifi haiwaki tangu asubuhi')) === 200);
  let c = await conv(UNKNOWN);
  check('unknown number is not verified', c && c.verified === 0);
  check('unknown number is asked which school', c && c.state === 'awaiting_school',
    'state=' + (c && c.state));
  let r = await lastReply(UNKNOWN);
  check('the reply asks for the school', /which school/i.test(r || ''), (r || '').split('\n')[0]);

  // --- naming the school moves it on and picks the original question back up ---
  const [[school]] = await pool.query('SELECT id, name, code FROM schools ORDER BY id LIMIT 1');
  await post(payload(UNKNOWN, school.code));
  c = await conv(UNKNOWN);
  check('school code resolves and is remembered', c && c.school_id === school.id,
    school.code + ' -> ' + (c && c.school_id));
  check('it then offers to log the original problem', c && c.state === 'offered', 'state=' + (c && c.state));
  r = await lastReply(UNKNOWN);
  check('the offer says YES logs it', /reply yes/i.test(r || ''));
  check('an unregistered number is told it cannot see tickets',
    /not registered/i.test(r || ''), (r || '').slice(-70));

  // --- confirming files the ticket ---
  await post(payload(UNKNOWN, 'ndio'));
  const [filed] = await pool.query(
    "SELECT error_code, title, category, priority, reporter_role, intake_channel, school_id, reporter_contact FROM errors WHERE reporter_contact = ? ORDER BY id DESC LIMIT 1",
    [UNKNOWN]);
  check('"ndio" files the ticket', filed.length === 1, filed[0] && filed[0].error_code);
  const e = filed[0] || {};
  check('ticket is routed to Connectivity from the Swahili text', e.category === 'Connectivity', 'category=' + e.category);
  check('ticket is marked as WhatsApp intake', e.intake_channel === 'whatsapp');
  check('unverified sender is recorded as such', e.reporter_role === 'whatsapp-unverified', e.reporter_role);
  check('ticket is attached to the named school', e.school_id === school.id);
  c = await conv(UNKNOWN);
  check('conversation returns to idle after filing', c && c.state === 'idle' && !c.draft);
  r = await lastReply(UNKNOWN);
  // new RegExp(undefined) is /(?:)/ and matches anything, so this passed even
  // when nothing had been filed. Require the code to exist.
  check('the confirmation quotes the ticket code',
    !!e.error_code && (r || '').includes(e.error_code), (r || '').split('\n')[0]);

  // --- Meta retries the same message: one ticket only ---
  const dupId = 'wamid.duplicate.test';
  await post(payload(UNKNOWN, 'Tablets hazichaji', { id: dupId }));
  // The redelivery is dropped, so it produces no reply — do not wait for one.
  await post(payload(UNKNOWN, 'Tablets hazichaji', { id: dupId }), { awaitReply: false });
  await new Promise(r => setTimeout(r, 1500));
  const [dupRows] = await pool.query('SELECT COUNT(*) n FROM whatsapp_messages WHERE wa_message_id = ?', [dupId]);
  check('a redelivered message is stored once', Number(dupRows[0].n) === 1, 'count=' + dupRows[0].n);

  // --- declining logs nothing ---
  await post(payload(UNKNOWN, 'hapana'));
  c = await conv(UNKNOWN);
  const [afterNo] = await pool.query('SELECT COUNT(*) n FROM errors WHERE reporter_contact = ?', [UNKNOWN]);
  check('"hapana" logs nothing and clears the offer',
    c && c.state === 'idle' && Number(afterNo[0].n) === 1, 'tickets=' + afterNo[0].n);

  // --- a known staff number skips the school question ---
  await post(payload(STAFF, 'Projector haina signal kwenye HDMI'));
  const cs = await conv(STAFF);
  check('a registered number is verified', cs && cs.verified === 1);
  if (staffHasSchool) {
    check('a registered number with a school is never asked for one',
      cs && cs.state === 'offered', 'state=' + (cs && cs.state));
  } else {
    check('a verified user with no school on file is asked which school',
      cs && cs.state === 'awaiting_school', staff.role + ' has no school_id — asking is correct');
  }
  const rs = await lastReply(STAFF);
  check('a registered number is never told it is unrecognised',
    !/do not recognise/i.test(rs || '') && !/not registered/i.test(rs || ''),
    (rs || '').split('\n')[0]);

  // --- unsupported message kinds say so ---
  await post(payload(UNKNOWN, null, { type: 'audio' }));
  const ra = await lastReply(UNKNOWN);
  check('a voice note gets an explanation, not silence',
    /only read text and photos/i.test(ra || ''), (ra || '').slice(0, 60));

  // --- classifier, checked directly ---
  const { _internal } = require('../src/controllers/whatsappController');
  const cat = _internal.guessCategory, pri = _internal.guessPriority;
  check('classifier: Swahili connectivity', cat('mtandao hauna intaneti') === 'Connectivity');
  check('classifier: Swahili power', cat('umeme umekatika na jenereta haifanyi') === 'Power');
  check('classifier: accounts beats platform for login wording',
    cat('wanafunzi hawawezi kuingia Quest, nenosiri') === 'Accounts');
  check('classifier: hardware', cat('tablet screen imevunjika') === 'Hardware');
  check('priority: whole-school wording is critical', pri('shule yote haina internet') === 'critical');
  check('priority: a single slow device is not', pri('tablet moja ni polepole') === 'low');
  check('priority: default is medium, not critical', pri('projector haifanyi kazi') === 'medium');
  check('priority: students blocked from the platform is high',
    pri('wanafunzi hawawezi kutumia Quest') === 'high', pri('wanafunzi hawawezi kutumia Quest'));
  check('priority: English equivalent is high too',
    pri('students cannot log in to Quest') === 'high');
  check('title: trimmed on a word boundary, not mid-word',
    !/\S…$/.test(_internal.makeTitle('a'.repeat(40) + ' ' + 'b'.repeat(80))) ||
    _internal.makeTitle('short one').length < 90);

  console.log('\n  cleanup:');
  const [[before]] = await pool.query("SELECT COUNT(*) n FROM errors");
  await cleanup();
  const [[after]] = await pool.query('SELECT COUNT(*) n FROM errors');
  const [[cc]] = await pool.query('SELECT COUNT(*) n FROM whatsapp_conversations');
  console.log(`    errors ${before.n} -> ${after.n}; whatsapp_conversations left: ${cc.n}`);

  console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
  await pool.end();
  process.exit(fail ? 1 : 0);
})().catch(async e => { console.error(e); try { await cleanup(); } catch {} process.exit(1); });
