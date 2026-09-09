/**
 * WhatsApp intake. Design: docs/features/03-whatsapp-intake.md
 *
 * A teacher writes a sentence and maybe sends a photo. The assistant answers
 * with the first steps in whatever language they wrote, then offers to log the
 * fault for an engineer. Answering before filing is what makes this deflection
 * rather than a firehose — but the offer is always there, and "log it" always
 * works. Deflection must never mean "harder to reach a human".
 *
 * A phone number is not authentication. A number matched to a user or teacher
 * record files as that person. An unmatched number may file against a school
 * code it supplies, is marked whatsapp-unverified, and can never read anything
 * back — no ticket lists, no school data, no other people's faults.
 */
const pool = require('../config/database');
const wa = require('../services/whatsapp');
const assistant = require('../services/assistant');
const { targetHours } = require('../services/sla');
const intake = require('../services/intake');
const { logAudit } = require('../services/audit');

const MAX_REPLY_CHARS = 900;   // a support answer on a phone, not an essay

/** Words that mean "yes, file it" in the languages people actually write here. */
const AFFIRMATIVE = /^\s*(yes|yeah|yep|ok|okay|sure|please|do it|log it|file it|report it|ndio|ndiyo|naam|sawa|haya|tafadhali|ripoti)\b/i;
const NEGATIVE = /^\s*(no|nope|not now|hapana|sitaki|acha|la)\b/i;

/**
 * A different prompt from the web assistant's. On WhatsApp there is no
 * markdown, no side panel and no scrollback worth reading — long answers are
 * worse than short ones, and every byte costs the sender money.
 */
const WA_SYSTEM = `You are the technical support assistant for Opportunity Education Tanzania (OE Tanzania / QFT), replying over WhatsApp to teachers and school staff in Tanzanian secondary schools. You help with tablets, WiFi and internet, the Quest learning platform, power and UPS, and user accounts.

You are on WhatsApp, so:
- Reply in the language the person wrote in. Swahili gets Swahili; English gets English; a mix gets the same mix. Do not translate their words back at them.
- Be short. At most 4 numbered steps, one line each. Never more than about 120 words.
- No markdown, no headings, no bold. Plain text only — WhatsApp shows it raw.
- Give the most likely fix first, not a list of possibilities.
- Never invent a phone number, price, warranty term or person's name.
- If it is clearly beyond a first-line fix (hardware failure, electrical work, several devices at once), say so in one line and say an engineer should see it.

Do not ask whether to log the fault — the system asks that itself, immediately after your reply.

Troubleshooting guides on file:
{GUIDES_CONTEXT}

About the person writing:
{USER_CONTEXT}`;

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

/** GET — Meta's one-time subscription handshake. */
function verify(req, res) {
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  if (!token) return res.status(503).send('Not configured: set WHATSAPP_VERIFY_TOKEN.');
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === token) {
    return res.status(200).send(String(req.query['hub.challenge'] || ''));
  }
  return res.sendStatus(403);
}

/**
 * POST — inbound messages.
 *
 * Meta retries on anything but a prompt 200, so this acknowledges immediately
 * and processes afterwards. A slow assistant call must not cause a redelivery
 * storm; duplicates are caught on whatsapp_messages.wa_message_id anyway.
 */
async function inbound(req, res) {
  if (!wa.verifySignature(req.rawBody, req.get('X-Hub-Signature-256'))) {
    return res.status(401).json({ error: 'Invalid or missing signature.' });
  }
  res.sendStatus(200);

  try {
    for (const entry of req.body.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        for (const msg of value.messages || []) {
          await handleMessage(msg, value).catch(err =>
            console.error('[whatsapp] handleMessage failed:', err.message));
        }
      }
    }
  } catch (err) {
    console.error('[whatsapp] inbound processing failed:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Conversation
// ---------------------------------------------------------------------------

async function handleMessage(msg, value) {
  const from = wa.normalizeTz(msg.from);
  if (!from) return;

  // Meta redelivers; one message must produce one ticket.
  if (msg.id) {
    const [seen] = await pool.query('SELECT id FROM whatsapp_messages WHERE wa_message_id = ?', [msg.id]);
    if (seen.length) return;
  }

  const text = extractText(msg);
  const conv = await loadConversation(from);
  await recordInbound(conv.id, msg.id, text, msg);

  await pool.query('UPDATE whatsapp_conversations SET last_message_at = NOW() WHERE id = ?', [conv.id]);

  // Nothing readable arrived. A photo is fine on its own — it shows the fault —
  // but a voice note or a bare document gives nothing to work with, and falling
  // through would ask the assistant to answer an empty question.
  if (!text && msg.type !== 'image') {
    return reply(conv, 'I can only read text and photos here. Please describe the problem in a message.');
  }

  if (conv.state === 'awaiting_school') return handleSchoolCode(conv, text);
  if (conv.state === 'offered') {
    if (AFFIRMATIVE.test(text || '')) return fileFromDraft(conv);
    if (NEGATIVE.test(text || '')) {
      await setState(conv.id, 'idle', null);
      return reply(conv, 'Fine — nothing logged. Message me again if it comes back.');
    }
    // Anything else is a new question, not an answer to the offer.
  }

  if (!conv.school_id) {
    await setState(conv.id, 'awaiting_school', { pending_text: text });
    // A verified admin or sub-admin has no single school on file, so asking is
    // right — but telling them their number is unrecognised is both wrong and
    // alarming.
    return reply(conv, conv.verified
      ? 'Which school is this about? Reply with the school name or its code.'
      : 'Hello — this is OE Tanzania technical support. I do not recognise this number yet.\n\n' +
        'Which school are you writing about? Reply with the school name or its code.');
  }

  return answerAndOffer(conv, text, msg);
}

/**
 * Assistant answers first, then the system offers to log it — in a single
 * message. Every WhatsApp message is billed and notifies the recipient, so two
 * where one would do is a real cost, not a style preference. It also keeps the
 * rule "one inbound message, one reply", which is what makes the flow
 * predictable to test and to reason about.
 */
async function answerAndOffer(conv, text, msg, prefix) {
  const draft = { text, media_id: firstMediaId(msg) || null };

  const answer = await askAssistant(conv, text);
  const offer = conv.verified
    ? 'Shall I log this for an engineer? Reply YES to log it.'
    : 'Shall I log this for an engineer? Reply YES to log it. (Your number is not registered, so I cannot show you existing tickets.)';

  await setState(conv.id, 'offered', draft);
  const body = [prefix, answer, offer].filter(Boolean).join('\n\n— — —\n');
  return reply(conv, body);
}

async function askAssistant(conv, text) {
  if (!assistant.isConfigured() || !text) return null;
  try {
    const [guides] = await pool.query('SELECT title, category, steps FROM troubleshooting_guides ORDER BY category, title');
    const guidesText = guides.map(g => {
      const steps = Array.isArray(g.steps) ? g.steps : (typeof g.steps === 'string' ? JSON.parse(g.steps) : []);
      return `[${g.category}] ${g.title}: ${steps.join(' | ')}`;
    }).join('\n');

    const [schools] = await pool.query(
      'SELECT name, zone, tablets, routers, isp, lrs_ip FROM schools WHERE id = ?', [conv.school_id]);
    const s = schools[0] || {};
    const userContext = [
      `School: ${s.name || 'not recorded'}${s.zone ? ' (' + s.zone + ')' : ''}`,
      s.tablets != null ? `Equipment on record: ${s.tablets} tablets, ${s.routers || 0} routers` : null,
      s.isp ? `Internet provider: ${s.isp}` : null,
      s.lrs_ip ? `LRS address: ${s.lrs_ip}` : null,
      conv.verified ? 'This number is registered to a member of staff.' : 'This number is not registered.'
    ].filter(Boolean).join('\n');

    const result = await assistant.ask({
      system: WA_SYSTEM.replace('{GUIDES_CONTEXT}', guidesText || 'None on file.')
                       .replace('{USER_CONTEXT}', userContext),
      messages: [{ role: 'user', content: text }],
      maxTokens: 400
    });
    if (!result.ok) return null;
    return result.text.slice(0, MAX_REPLY_CHARS);
  } catch (err) {
    console.error('[whatsapp] assistant step failed:', err.message);
    return null;   // never block filing on the assistant
  }
}

/** They replied with a school name or code while in awaiting_school. */
async function handleSchoolCode(conv, text) {
  const needle = String(text || '').trim();
  if (!needle) return reply(conv, 'Please reply with the school name or its code.');

  const [rows] = await pool.query(
    `SELECT id, name, code FROM schools
     WHERE LOWER(code) = LOWER(?) OR LOWER(name) LIKE LOWER(?)
     ORDER BY CASE WHEN LOWER(code) = LOWER(?) THEN 0 ELSE 1 END
     LIMIT 3`,
    [needle, `%${needle}%`, needle]
  );

  if (!rows.length) {
    return reply(conv, `I could not find a school matching "${needle}". Please check the spelling, or send the school code.`);
  }
  if (rows.length > 1 && rows[0].code.toLowerCase() !== needle.toLowerCase()) {
    return reply(conv, 'Which one?\n' + rows.map(r => `• ${r.name} (${r.code})`).join('\n'));
  }

  const school = rows[0];
  await pool.query('UPDATE whatsapp_conversations SET school_id = ?, state = ? WHERE id = ?',
    [school.id, 'idle', conv.id]);

  const pending = conv.draft && conv.draft.pending_text;
  const fresh = await loadConversation(conv.phone);
  if (pending) {
    // Acknowledge the school and answer the original question in one message.
    return answerAndOffer(fresh, pending, {}, `Thank you — ${school.name}.`);
  }
  return reply(fresh, `Thank you — ${school.name}. What is the problem?`);
}

/** Turns the held draft into a real ticket. */
async function fileFromDraft(conv) {
  const draft = conv.draft || {};
  const text = draft.text || 'Reported over WhatsApp — no description given.';
  if (!conv.school_id) {
    await setState(conv.id, 'awaiting_school', draft);
    return reply(conv, 'Before I log it — which school is this for?');
  }

  const [[mx]] = await pool.query(
    "SELECT MAX(CAST(SUBSTRING(error_code, 5) AS UNSIGNED)) AS maxnum FROM errors WHERE error_code LIKE 'QFT-%'"
  );
  const errorCode = `QFT-0${((mx && mx.maxnum) ? mx.maxnum : 240) + 1}`;

  const [schoolRows] = await pool.query(
    'SELECT name, assigned_admin_id FROM schools WHERE id = ?', [conv.school_id]);
  const school = schoolRows[0] || {};

  const category = guessCategory(text);
  const priority = guessPriority(text);
  const title = makeTitle(text);

  let reporterName = 'WhatsApp report';
  let identityRole = null;
  if (conv.user_id) {
    const [u] = await pool.query('SELECT full_name, role FROM users WHERE id = ?', [conv.user_id]);
    if (u.length) { reporterName = u[0].full_name; identityRole = u[0].role; }
  }

  // Routing comes from services/intake.js. This handler used to assign the
  // field engineer directly and answer "an engineer has been notified", so the
  // same teacher reporting the same fault got a different chain depending on
  // whether they used the web form or WhatsApp.
  const route = intake.routeFor({
    reporterRole: conv.verified ? identityRole : null,
    priority,
    fieldEngineerId: school.assigned_admin_id
  });

  const [result] = await pool.query(
    `INSERT INTO errors
       (error_code, title, description, school_id, category, priority, status, assigned_to,
        reporter_name, reporter_role, reporter_contact, sla_due_at, escalation_level,
        reported_by_user_id, intake_channel)
     VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR), ?, ?, 'whatsapp')`,
    [errorCode, title, text, conv.school_id, category, priority,
     route.assignedTo, reporterName,
     conv.verified ? 'whatsapp' : 'whatsapp-unverified', conv.phone,
     targetHours(priority), route.escalationLevel, conv.user_id || null]
  );
  const errorId = result.insertId;

  if (route.notifySchoolAdmin) {
    await intake.notifySchoolAdmin({
      schoolId: conv.school_id, errorId, errorCode, priority, category,
      reporterName, critical: route.critical
    });
  }

  await pool.query('UPDATE whatsapp_messages SET error_id = ? WHERE conversation_id = ? AND error_id IS NULL',
    [errorId, conv.id]);
  await logAudit({
    actor: { id: conv.user_id || null, full_name: reporterName, role: conv.verified ? 'whatsapp' : 'whatsapp-unverified' },
    action: 'error.created', entityType: 'error', entityId: errorId,
    summary: `${errorCode}: reported over WhatsApp from ${conv.phone}`,
    meta: { channel: 'whatsapp', school_id: conv.school_id, priority }
  }).catch(err => console.error('[whatsapp] audit failed:', err.message));

  await setState(conv.id, 'idle', null);
  return reply(conv,
    `Logged as ${errorCode} — ${school.name || 'your school'}.\n` +
    `Priority: ${priority}. ` +
    (route.assignedTo ? 'An engineer has been notified.' : 'Your school administrator has been notified.') +
    '\n\nMessage me again if anything changes.');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Finds or creates the conversation for a number, resolving identity from the
 * staff and teacher records. Matching is done on the normalised number so a
 * phone stored as 0754… still matches an inbound +255754….
 */
async function loadConversation(phone) {
  const [existing] = await pool.query('SELECT * FROM whatsapp_conversations WHERE phone = ?', [phone]);
  if (existing.length) {
    const conv = existing[0];
    conv.draft = parseDraft(conv.draft);
    return conv;
  }

  const identity = await resolveIdentity(phone);
  const [ins] = await pool.query(
    'INSERT INTO whatsapp_conversations (phone, user_id, school_id, verified, state) VALUES (?, ?, ?, ?, ?)',
    [phone, identity.user_id, identity.school_id, identity.verified ? 1 : 0, 'idle']
  );
  const [rows] = await pool.query('SELECT * FROM whatsapp_conversations WHERE id = ?', [ins.insertId]);
  const conv = rows[0];
  conv.draft = parseDraft(conv.draft);
  return conv;
}

/** A phone number against the staff and teacher records. */
async function resolveIdentity(phone) {
  const [users] = await pool.query(
    'SELECT id, role, school_id, phone FROM users WHERE phone IS NOT NULL AND phone <> ?', ['']
  );
  const match = users.find(u => wa.normalizeTz(u.phone) === phone);
  if (!match) return { user_id: null, school_id: null, verified: false };

  let schoolId = match.school_id || null;
  if (!schoolId && match.role === 'teacher') {
    const [t] = await pool.query('SELECT school_id FROM teachers WHERE user_id = ?', [match.id]);
    if (t.length) schoolId = t[0].school_id;
  }
  return { user_id: match.id, school_id: schoolId, verified: true };
}

function parseDraft(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return null; }
}

async function setState(id, state, draft) {
  await pool.query('UPDATE whatsapp_conversations SET state = ?, draft = ? WHERE id = ?',
    [state, draft ? JSON.stringify(draft) : null, id]);
}

function extractText(msg) {
  if (msg.type === 'text') return (msg.text && msg.text.body) || '';
  if (msg.type === 'image') return (msg.image && msg.image.caption) || '';
  if (msg.type === 'video') return (msg.video && msg.video.caption) || '';
  if (msg.type === 'document') return (msg.document && msg.document.caption) || '';
  if (msg.type === 'button') return (msg.button && msg.button.text) || '';
  if (msg.type === 'interactive' && msg.interactive) {
    const i = msg.interactive;
    return (i.button_reply && i.button_reply.title) || (i.list_reply && i.list_reply.title) || '';
  }
  return '';
}

const isMedia = msg => ['image', 'video', 'document', 'audio'].includes(msg.type);
const firstMediaId = msg => (isMedia(msg) && msg[msg.type] && msg[msg.type].id) || null;

async function recordInbound(conversationId, waId, body, msg) {
  await pool.query(
    'INSERT INTO whatsapp_messages (conversation_id, wa_message_id, direction, body) VALUES (?, ?, ?, ?)',
    [conversationId, waId || null, 'in', body || `[${msg.type || 'unknown'}]`]
  ).catch(err => {
    if (err.code !== 'ER_DUP_ENTRY') console.error('[whatsapp] transcript insert failed:', err.message);
  });
}

async function reply(conv, body) {
  await pool.query(
    'INSERT INTO whatsapp_messages (conversation_id, direction, body) VALUES (?, ?, ?)',
    [conv.id, 'out', body]
  ).catch(err => console.error('[whatsapp] transcript insert failed:', err.message));
  return wa.sendText(conv.phone, body);
}

/** Keyword routing, matching the categories the rest of the system uses. */
function guessCategory(text) {
  const t = String(text).toLowerCase();
  if (/wifi|wi-fi|internet|network|router|mtandao|intaneti|connection|offline/.test(t)) return 'Connectivity';
  if (/quest|platform|app|login|log in|kuingia|password|nenosiri|account|akaunti/.test(t)) {
    return /login|log in|kuingia|password|nenosiri|account|akaunti/.test(t) ? 'Accounts' : 'Platform';
  }
  if (/power|umeme|generator|jenereta|ups|socket|plug|battery|betri/.test(t)) return 'Power';
  if (/tablet|kompyuta|laptop|screen|kioo|charg|chaji|projector|keyboard|broken|imevunjika|cable/.test(t)) return 'Hardware';
  return 'Other';
}

/**
 * Priority from what they wrote. Deliberately conservative: 'medium' unless the
 * words indicate scale or a stop to teaching. An engineer re-prioritises in the
 * app; inflating everything to critical would make the SLA meaningless.
 */
function guessPriority(text) {
  const t = String(text).toLowerCase();
  if (/all |whole|entire|shule yote|wote|wanafunzi wote|cannot teach|no lesson|hakuna somo|urgent|haraka|emergency|dharura|sparking|fire|moto/.test(t)) return 'critical';

  // Students blocked from the platform is teaching stopped, whoever counted
  // them. "wanafunzi hawawezi kutumia Quest" was landing on medium — a 72-hour
  // target for a class that cannot work today.
  if (/(wanafunzi|students|pupils|watoto)[^.!?]{0,40}(hawawezi|cannot|can.?t|unable|hakuna|wameshindwa)/.test(t)) return 'high';
  if (/(hawawezi|cannot|can.?t|unable)[^.!?]{0,40}(kuingia|kutumia|log ?in|access|use)/.test(t)) return 'high';

  if (/many|several|wengi|nyingi|class|darasa|exam|mtihani|today|leo/.test(t)) return 'high';
  if (/slow|polepole|sometimes|mara nyingine|one |moja/.test(t)) return 'low';
  return 'medium';
}

/** A one-line title from the first sentence, without truncating mid-word. */
function makeTitle(text) {
  const first = String(text).replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s/)[0] || 'WhatsApp report';
  if (first.length <= 90) return first;
  const cut = first.slice(0, 90);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut) + '…';
}

module.exports = {
  verify,
  inbound,
  // exported for scripts/verify-whatsapp.js
  _internal: { guessCategory, guessPriority, makeTitle, resolveIdentity }
};
