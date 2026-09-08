/**
 * Prints one real WhatsApp conversation through the live webhook, so the
 * behaviour can be read rather than inferred (docs/features/03-whatsapp-intake.md).
 *
 *   cd backend && node scripts/demo-whatsapp.js
 *
 * Needs the server running with WHATSAPP_APP_SECRET set. Outbound sending stays
 * unconfigured; replies are read from the whatsapp_messages transcript.
 * WRITES TO THE DATABASE and removes everything it created. Not for production.
 */
require('dotenv').config({ path: '.env' });
const crypto = require('crypto');
const pool = require('../src/config/database');

const BASE = 'http://localhost:3100';
const PHONE = '+255700000222';
let seq = 0;

function body(text) {
  seq++;
  return {
    object: 'whatsapp_business_account',
    entry: [{ id: '0', changes: [{ field: 'messages', value: { messaging_product: 'whatsapp',
      messages: [{ from: PHONE.replace('+', ''), id: `wamid.demo.${Date.now()}.${seq}`, type: 'text', text: { body: text } }] } }] }]
  };
}

async function outCount() {
  const [r] = await pool.query(
    `SELECT COUNT(*) n FROM whatsapp_messages m JOIN whatsapp_conversations c ON m.conversation_id = c.id
     WHERE c.phone = ? AND m.direction = 'out'`, [PHONE]);
  return Number(r[0].n);
}

async function send(text) {
  const raw = JSON.stringify(body(text));
  const before = await outCount();
  await fetch(BASE + '/api/whatsapp/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Hub-Signature-256': 'sha256=' + crypto.createHmac('sha256', process.env.WHATSAPP_APP_SECRET).update(raw).digest('hex')
    },
    body: raw
  });
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline && (await outCount()) <= before) await new Promise(r => setTimeout(r, 250));
  await new Promise(r => setTimeout(r, 600));
}

(async () => {
  await pool.query('DELETE FROM whatsapp_conversations WHERE phone = ?', [PHONE]);

  const [[school]] = await pool.query('SELECT code, name FROM schools ORDER BY id LIMIT 1');
  await send('Mtandao wa wifi haufanyi kazi tangu asubuhi, wanafunzi hawawezi kutumia Quest');
  await send(school.code);
  await send('ndio');

  const [rows] = await pool.query(
    `SELECT m.direction, m.body FROM whatsapp_messages m
     JOIN whatsapp_conversations c ON m.conversation_id = c.id
     WHERE c.phone = ? ORDER BY m.id`, [PHONE]);

  console.log('\n=== transcript (' + PHONE + ', unregistered number) ===\n');
  for (const m of rows) {
    const who = m.direction === 'in' ? 'teacher' : 'support ';
    console.log(who + ' | ' + String(m.body).split('\n').join('\n         | '));
    console.log('         |');
  }

  const [[filed]] = await pool.query(
    `SELECT error_code, title, category, priority, reporter_role, intake_channel
     FROM errors WHERE reporter_contact = ? ORDER BY id DESC LIMIT 1`, [PHONE]);
  if (filed) {
    console.log('=== ticket created ===');
    console.log('  ' + filed.error_code + '  ' + filed.category + '/' + filed.priority +
      '  channel=' + filed.intake_channel + '  reporter_role=' + filed.reporter_role);
    console.log('  title: ' + filed.title);
  }

  await pool.query('DELETE FROM errors WHERE reporter_contact = ?', [PHONE]);
  await pool.query('DELETE FROM whatsapp_conversations WHERE phone = ?', [PHONE]);
  await pool.query("DELETE FROM audit_log WHERE summary LIKE '%reported over WhatsApp%'");
  const [[c]] = await pool.query('SELECT COUNT(*) n FROM errors');
  console.log('\ncleaned up; errors now ' + c.n);
  await pool.end();
})().catch(e => { console.error(e); process.exit(1); });
