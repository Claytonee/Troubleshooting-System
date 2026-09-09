const https = require('https');
const pool = require('../config/database');

const BEDROCK_TOKEN = process.env.AWS_BEARER_TOKEN_BEDROCK || '';
const BEDROCK_HOST = process.env.AWS_BEDROCK_HOST || 'bedrock-runtime.us-east-1.amazonaws.com';
// Bedrock model id. This account currently only has Claude Opus 4.6 enabled —
// anthropic.claude-opus-5 answers 403 "not available for this account" until
// model access is requested in the Bedrock console. Override with AI_MODEL.
const CHAT_MODEL = process.env.AI_MODEL || 'us.anthropic.claude-opus-4-6-v1';

const ROLE_LABELS = {
  admin: 'System administrator',
  subadmin: 'Field engineer / sub-admin',
  school: 'School administrator',
  teacher: 'Teacher',
};

// Turns of history sent to the model. The Bedrock invoke path this account uses
// does not honour cache_control (measured: cache_read_input_tokens stays 0), so
// every turn is billed in full — an unbounded transcript would grow without limit.
const HISTORY_LIMIT = 24;
const MAX_TOKENS = 4096;

const SYSTEM_PROMPT = `You are the technical support assistant inside the Opportunity Education Tanzania (OE Tanzania / QFT) school technology support system. The people talking to you are school administrators, teachers and field engineers in Tanzanian secondary schools. You help them fix tablets, WiFi and internet connectivity, the Quest learning platform, power and UPS systems, and user accounts.

LANGUAGE — this matters most:
- Reply in the SAME language the user wrote in. Swahili question, Swahili answer. English question, English answer.
- If they mix Swahili and English (very common here), mirror that mix naturally. Keep technical terms people actually use in English — router, cable, charger, password, WiFi, tablet, app.
- If they ask for a specific language, or switch language mid-conversation, follow them immediately.
- Never translate a question into another language before answering, and never answer in a language the user has not used.
- This applies to every reply, including a refusal, a clarifying question or an apology — an English question gets an English refusal.

HOW TO ANSWER:
- Lead with the single most likely fix, not with a preamble. No "Pole kwa tatizo" openers, no restating the question.
- Give numbered steps that a non-technical teacher can follow alone, with what to look for after each one ("the power light should turn green").
- Stop at 5 steps. If it is still not fixed by then, say so and send them to escalate.
- Only use headings when the answer genuinely covers two or more separate problems. A single fix needs no heading.
- Use **bold** for the thing they must press, unplug or type. Never for whole sentences.
- Ask one clarifying question instead of guessing when the symptom could have very different causes.

STAYING IN SCOPE:
- Answer only questions about the school's equipment, this support system, and the Quest platform.
- For anything else — politics, homework, general knowledge, personal advice — decline in one short sentence, in their language, and offer to help with a technical problem instead.

TRUTHFULNESS AND SAFETY:
- The knowledge base below is your source of truth. Follow its steps rather than inventing your own.
- If the answer is not in it, say plainly that you do not have it, then tell them to open **Report Error** so an engineer follows up.
- Never suggest opening a device, changing electrical wiring, flashing firmware or resetting the LRS. For those, tell them to wait for an engineer.
- Never invent an asset tag, serial number, IP address, phone number or error code. Use only what appears in the context below.

POINTING THEM AT THE RIGHT PLACE IN THIS SYSTEM:
- **Report Error** — log a NEW fault so an engineer is assigned and the SLA clock starts.
- **Error Tracker** — check the status of a fault that is already logged. Send them here, never to Report Error, when they ask about an existing ticket.
- **Troubleshooting** — the step-by-step guides; name the guide when one covers their problem.
- **Resource Library** — manuals and training videos; name the document when one exists.
- **Tablet Inventory** — record a tablet as faulty, lost or in repair.
- **Weekly Check-Ins** — the weekly report of the school's equipment health.
Refer to them by those names only, and only when it is the natural next step.

WHO YOU ARE TALKING TO:
{USER_CONTEXT}

KNOWLEDGE BASE:
{GUIDES_CONTEXT}

AVAILABLE RESOURCES/MANUALS:
{MANUALS_CONTEXT}`;

async function getKnowledgeContext() {
  const [guides] = await pool.query('SELECT title, category, steps FROM troubleshooting_guides ORDER BY category, title');
  const [manuals] = await pool.query('SELECT title, category, file_type FROM manuals ORDER BY category, title');

  const guidesText = guides.map(g => {
    const steps = Array.isArray(g.steps) ? g.steps : (typeof g.steps === 'string' ? JSON.parse(g.steps) : []);
    return `[${g.category}] ${g.title}\nSteps:\n${steps.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}`;
  }).join('\n\n');

  const manualsText = manuals.map(m =>
    `[${m.category || 'General'}] ${m.title} (${m.file_type || 'document'})`
  ).join('\n');

  return { guidesText, manualsText };
}

/**
 * Resolves the school this user is asking on behalf of. School admins carry it
 * on the user row; teachers carry it on their teachers row; a sub-admin covers
 * several schools, so there is no single one.
 */
async function resolveSchoolId(user) {
  if (user.school_id) return user.school_id;
  if (user.role === 'teacher') {
    const [rows] = await pool.query('SELECT school_id FROM teachers WHERE user_id = ?', [user.id]);
    if (rows.length) return rows[0].school_id;
  }
  return null;
}

/**
 * What the assistant knows about the person asking: their school, the faults
 * already logged for it, and the state of its tablets. Without this the model
 * gives generic advice and re-asks things the system already knows.
 */
async function getUserContext(user) {
  const lines = [`Name: ${user.full_name}`, `Role: ${ROLE_LABELS[user.role] || user.role}`];

  try {
    const schoolId = await resolveSchoolId(user);

    if (schoolId) {
      const [schools] = await pool.query(
        'SELECT name, zone, students, tablets, routers, lrs_ip, isp FROM schools WHERE id = ?', [schoolId]
      );
      if (schools.length) {
        const s = schools[0];
        lines.push(`School: ${s.name} (${s.zone || 'zone not recorded'})`);
        lines.push(`Equipment on record: ${s.tablets || 0} tablets, ${s.routers || 0} routers, ${s.students || 0} students`);
        if (s.isp) lines.push(`Internet provider: ${s.isp}`);
        if (s.lrs_ip) lines.push(`LRS address: ${s.lrs_ip}`);
      }

      const [open] = await pool.query(
        `SELECT error_code, title, category, priority, status FROM errors
         WHERE school_id = ? AND status <> 'resolved' ORDER BY FIELD(priority,'critical','high','medium','low'), created_at DESC LIMIT 8`,
        [schoolId]
      );
      lines.push(open.length
        ? `Faults already logged for this school (do not tell them to report these again — they are open):
${open.map(e => `  - ${e.error_code} [${e.priority}/${e.status}] ${e.title} (${e.category})`).join('\n')}`
        : 'No open faults logged for this school.');

      const [tabs] = await pool.query(
        'SELECT status, COUNT(*) AS n FROM tablets WHERE school_id = ? GROUP BY status', [schoolId]
      );
      if (tabs.length) lines.push(`Tablet inventory: ${tabs.map(t => `${t.n} ${t.status}`).join(', ')}`);
    } else if (user.role === 'subadmin') {
      const [mine] = await pool.query('SELECT name FROM schools WHERE assigned_admin_id = ? ORDER BY name', [user.id]);
      lines.push(mine.length
        ? `Field engineer covering: ${mine.map(s => s.name).join(', ')}`
        : 'Field engineer with no schools assigned yet.');
    } else if (user.role === 'admin') {
      lines.push('System administrator — sees every school. Ask which school they mean when it changes the answer.');
    }
  } catch (e) {
    // Context is an enhancement, never a reason to fail the conversation.
  }

  return lines.join('\n');
}

function invokeBedrockStream(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname: BEDROCK_HOST,
      path: `/model/${CHAT_MODEL}/invoke-with-response-stream`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${BEDROCK_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (response) => {
      if (response.statusCode !== 200) {
        let errBody = '';
        response.on('data', d => errBody += d.toString());
        response.on('end', () => reject(new Error(`Bedrock ${response.statusCode}: ${errBody}`)));
      } else {
        resolve(response);
      }
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function parseEventStream(stream, onDelta, onDone, onError) {
  let rawBuffer = Buffer.alloc(0);

  stream.on('data', (chunk) => {
    rawBuffer = Buffer.concat([rawBuffer, chunk]);

    while (rawBuffer.length >= 16) {
      const totalLen = rawBuffer.readUInt32BE(0);
      if (rawBuffer.length < totalLen) break;

      const headerLen = rawBuffer.readUInt32BE(4);
      const payloadStart = 12 + headerLen;
      const payloadEnd = totalLen - 4;

      if (payloadEnd > payloadStart) {
        const payloadBuf = rawBuffer.slice(payloadStart, payloadEnd);
        try {
          const frameJson = JSON.parse(payloadBuf.toString('utf8'));
          if (frameJson.bytes) {
            const decoded = Buffer.from(frameJson.bytes, 'base64').toString('utf8');
            const data = JSON.parse(decoded);

            if (data.type === 'content_block_delta' && data.delta && data.delta.text) {
              onDelta(data.delta.text);
            }
          }
        } catch (e) {}
      }

      rawBuffer = rawBuffer.slice(totalLen);
    }
  });

  stream.on('end', onDone);
  stream.on('error', onError);
}

/**
 * Is the assistant switched on for this deployment?
 *
 * The page asks before it renders a composer nobody can use. The env var name
 * only goes to an administrator: a teacher who is told to "set
 * AWS_BEARER_TOKEN_BEDROCK" learns nothing and can do nothing.
 */
function status(req, res) {
  res.json({
    configured: !!BEDROCK_TOKEN,
    model: BEDROCK_TOKEN ? CHAT_MODEL : null,
    hint: BEDROCK_TOKEN ? null : (req.user.role === 'admin'
      ? 'Set AWS_BEARER_TOKEN_BEDROCK in cPanel → Setup Node.js App → Environment variables, then restart the app.'
      : 'The AI assistant has not been switched on yet. Ask the system administrator.')
  });
}

async function getChats(req, res, next) {
  try {
    const [chats] = await pool.query(
      'SELECT id, title, created_at, updated_at FROM ai_chats WHERE user_id = ? ORDER BY updated_at DESC',
      [req.user.id]
    );
    res.json(chats);
  } catch (err) { next(err); }
}

async function getChat(req, res, next) {
  try {
    const [chats] = await pool.query('SELECT * FROM ai_chats WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!chats.length) return res.status(404).json({ error: 'Chat not found' });

    const [messages] = await pool.query(
      'SELECT id, role, content, created_at FROM ai_chat_messages WHERE chat_id = ? ORDER BY created_at ASC',
      [req.params.id]
    );
    res.json({ ...chats[0], messages });
  } catch (err) { next(err); }
}

async function deleteChat(req, res, next) {
  try {
    const [result] = await pool.query('DELETE FROM ai_chats WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Chat not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
}

async function sendMessage(req, res, next) {
  const { message, chat_id } = req.body;
  if (!message || !message.trim()) return res.status(400).json({ error: 'Message is required' });

  if (!BEDROCK_TOKEN) {
    return res.status(503).json({
      error: req.user.role === 'admin'
        ? 'AI service not configured. Set AWS_BEARER_TOKEN_BEDROCK and restart the app.'
        : 'The AI assistant is not switched on. Use Troubleshooting for step-by-step guides, or Report Error to reach an engineer.',
      code: 'AI_NOT_CONFIGURED'
    });
  }

  let chatId = chat_id;

  // Everything up to flushHeaders() may fail on a DB error; route those to the
  // Express error handler. Once the SSE stream is open, errors are reported as
  // SSE 'error' frames instead (headers are already sent).
  try {
    if (!chatId) {
      const [result] = await pool.query(
        'INSERT INTO ai_chats (user_id, title) VALUES (?, ?)',
        [req.user.id, message.substring(0, 80)]
      );
      chatId = result.insertId;
    } else {
      const [chats] = await pool.query('SELECT id FROM ai_chats WHERE id = ? AND user_id = ?', [chatId, req.user.id]);
      if (!chats.length) return res.status(404).json({ error: 'Chat not found' });
    }

    await pool.query(
      'INSERT INTO ai_chat_messages (chat_id, role, content) VALUES (?, ?, ?)',
      [chatId, 'user', message.trim()]
    );

    var [history] = await pool.query(
      'SELECT role, content FROM ai_chat_messages WHERE chat_id = ? ORDER BY created_at ASC',
      [chatId]
    );

    var { guidesText, manualsText } = await getKnowledgeContext();
    var userContext = await getUserContext(req.user);
  } catch (err) { return next(err); }

  const systemPrompt = SYSTEM_PROMPT
    .replace('{USER_CONTEXT}', userContext || 'No details on file.')
    .replace('{GUIDES_CONTEXT}', guidesText || 'No guides available.')
    .replace('{MANUALS_CONTEXT}', manualsText || 'No manuals available.');

  // Keep the tail of the conversation. The first message must be from the user,
  // or Bedrock rejects the request.
  let recent = history.slice(-HISTORY_LIMIT);
  while (recent.length && recent[0].role !== 'user') recent = recent.slice(1);
  const messages = recent.map(m => ({ role: m.role, content: m.content }));

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Chat-Id', chatId.toString());
  res.flushHeaders();

  try {
    const stream = await invokeBedrockStream({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages
    });

    let fullResponse = '';

    parseEventStream(
      stream,
      (text) => {
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ type: 'delta', text })}\n\n`);
      },
      async () => {
        try {
          if (fullResponse) {
            await pool.query(
              'INSERT INTO ai_chat_messages (chat_id, role, content) VALUES (?, ?, ?)',
              [chatId, 'assistant', fullResponse]
            );
            await pool.query('UPDATE ai_chats SET updated_at = NOW() WHERE id = ?', [chatId]);
          }
        } catch (e) { /* persistence failed; still close the stream cleanly below */ }
        res.write(`data: ${JSON.stringify({ type: 'done', chat_id: chatId })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      },
      (err) => {
        console.error('[ai] stream error:', err.message);
        res.write(`data: ${JSON.stringify({ type: 'error', error: 'The connection dropped mid-answer. Send the message again.' })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      }
    );
  } catch (err) {
    // The headers are already sent, so the real cause can only reach the log —
    // print it rather than swallowing it, and tell the user which class of
    // failure it was so they know whether retrying will help.
    console.error('[ai] bedrock request failed:', err.message);
    const m = /Bedrock (\d+)/.exec(err.message || '');
    const status = m ? Number(m[1]) : 0;
    const friendly =
      status === 403 ? 'The AI service rejected our credentials, or this model is not enabled for this account. An administrator needs to check the Bedrock configuration.'
      : status === 400 ? 'The AI service rejected the request. An administrator needs to check the configured model.'
      : status === 429 ? 'The AI service is rate limited right now. Wait a moment and send the message again.'
      : status >= 500 ? 'The AI service is having trouble. Try again in a minute.'
      : 'Could not reach the AI service. Check the connection and try again.';
    res.write(`data: ${JSON.stringify({ type: 'error', error: friendly })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
}

module.exports = { status, getChats, getChat, deleteChat, sendMessage };
