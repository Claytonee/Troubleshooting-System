const https = require('https');
const pool = require('../config/database');

const BEDROCK_TOKEN = process.env.AWS_BEARER_TOKEN_BEDROCK || '';
const BEDROCK_HOST = process.env.AWS_BEDROCK_HOST || 'bedrock-runtime.us-east-1.amazonaws.com';
const CHAT_MODEL = process.env.AI_MODEL || 'us.anthropic.claude-opus-4-6-v1';

const SYSTEM_PROMPT = `You are a technical support assistant for Quest Forward Tanzania (QFT), a school technology program. You help school administrators and teachers troubleshoot technical issues with tablets, WiFi/internet connectivity, the learning platform, power/UPS systems, and user accounts.

IMPORTANT RULES:
1. ONLY answer questions related to technical troubleshooting for school equipment and systems.
2. If someone asks about anything unrelated to troubleshooting (politics, personal questions, homework, general knowledge, etc.), politely redirect them: "Samahani, ninaweza kusaidia tu na maswali ya kiufundi kuhusu vifaa vya shule. Tafadhali uliza swali kuhusu tatizo la kiufundi."
3. Use the knowledge base and resources provided below as your primary source of truth.
4. Answer in the same language the user writes in (Swahili or English).
5. Be concise, practical, and step-by-step in your troubleshooting guidance.
6. If you cannot find the answer in the provided context, say so and suggest they report the issue via the Report Error page for engineer follow-up.
7. Never make up solutions that could damage equipment. When unsure, recommend professional help.

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

async function getChats(req, res) {
  const [chats] = await pool.query(
    'SELECT id, title, created_at, updated_at FROM ai_chats WHERE user_id = ? ORDER BY updated_at DESC',
    [req.user.id]
  );
  res.json(chats);
}

async function getChat(req, res) {
  const [chats] = await pool.query('SELECT * FROM ai_chats WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!chats.length) return res.status(404).json({ error: 'Chat not found' });

  const [messages] = await pool.query(
    'SELECT id, role, content, created_at FROM ai_chat_messages WHERE chat_id = ? ORDER BY created_at ASC',
    [req.params.id]
  );
  res.json({ ...chats[0], messages });
}

async function deleteChat(req, res) {
  const [result] = await pool.query('DELETE FROM ai_chats WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (result.affectedRows === 0) return res.status(404).json({ error: 'Chat not found' });
  res.json({ success: true });
}

async function sendMessage(req, res) {
  const { message, chat_id } = req.body;
  if (!message || !message.trim()) return res.status(400).json({ error: 'Message is required' });

  if (!BEDROCK_TOKEN) {
    return res.status(503).json({ error: 'AI service not configured. Please set AWS_BEARER_TOKEN_BEDROCK.' });
  }

  let chatId = chat_id;

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

  const [history] = await pool.query(
    'SELECT role, content FROM ai_chat_messages WHERE chat_id = ? ORDER BY created_at ASC',
    [chatId]
  );

  const { guidesText, manualsText } = await getKnowledgeContext();
  const systemPrompt = SYSTEM_PROMPT
    .replace('{GUIDES_CONTEXT}', guidesText || 'No guides available.')
    .replace('{MANUALS_CONTEXT}', manualsText || 'No manuals available.');

  const messages = history.map(m => ({ role: m.role, content: m.content }));

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Chat-Id', chatId.toString());
  res.flushHeaders();

  try {
    const stream = await invokeBedrockStream({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 2048,
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
        if (fullResponse) {
          await pool.query(
            'INSERT INTO ai_chat_messages (chat_id, role, content) VALUES (?, ?, ?)',
            [chatId, 'assistant', fullResponse]
          );
          await pool.query('UPDATE ai_chats SET updated_at = NOW() WHERE id = ?', [chatId]);
        }
        res.write(`data: ${JSON.stringify({ type: 'done', chat_id: chatId })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      },
      (err) => {
        res.write(`data: ${JSON.stringify({ type: 'error', error: 'Stream interrupted' })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      }
    );
  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: 'error', error: 'Failed to connect to AI service' })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
}

module.exports = { getChats, getChat, deleteChat, sendMessage };
