/**
 * Single-shot access to the assistant.
 *
 * aiChatController streams into an SSE response, which suits a web chat and
 * suits nothing else. WhatsApp needs one complete answer as a string, so this
 * calls Bedrock's non-streaming /invoke with the same bearer token and model.
 *
 * Degrades gracefully: returns { ok: false, reason } rather than throwing, so a
 * caller can carry on without the assistant. An unconfigured AI must not stop a
 * teacher from filing a fault.
 */
const https = require('https');

const BEDROCK_HOST = process.env.AWS_BEDROCK_HOST || 'bedrock-runtime.us-east-1.amazonaws.com';
const BEDROCK_TOKEN = process.env.AWS_BEARER_TOKEN_BEDROCK || '';
const MODEL = process.env.AI_MODEL || 'us.anthropic.claude-opus-4-6-v1';

function isConfigured() {
  return !!BEDROCK_TOKEN;
}

function invoke(payload, timeoutMs) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = https.request({
      hostname: BEDROCK_HOST,
      path: `/model/${MODEL}/invoke`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${BEDROCK_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: timeoutMs || 20000
    }, response => {
      let raw = '';
      response.on('data', d => { raw += d.toString(); });
      response.on('end', () => {
        if (response.statusCode !== 200) {
          return reject(new Error(`Bedrock ${response.statusCode}: ${raw.slice(0, 300)}`));
        }
        try { resolve(JSON.parse(raw)); }
        catch (e) { reject(new Error('Bedrock returned unparseable JSON')); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('Bedrock timed out')));
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * @param {object} opts
 * @param {string} opts.system      system prompt
 * @param {Array}  opts.messages    [{ role, content }], first must be 'user'
 * @param {number} [opts.maxTokens]
 * @returns {Promise<{ok: boolean, text?: string, reason?: string}>}
 */
async function ask({ system, messages, maxTokens }) {
  if (!isConfigured()) return { ok: false, reason: 'not_configured' };
  if (!messages || !messages.length) return { ok: false, reason: 'no_messages' };

  // Bedrock rejects a conversation that does not open with a user turn.
  let turns = messages.slice();
  while (turns.length && turns[0].role !== 'user') turns = turns.slice(1);
  if (!turns.length) return { ok: false, reason: 'no_user_turn' };

  try {
    const data = await invoke({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: maxTokens || 700,
      system,
      messages: turns
    });
    const text = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim();
    if (!text) return { ok: false, reason: 'empty_response' };
    return { ok: true, text };
  } catch (err) {
    console.error('[assistant] request failed:', err.message);
    return { ok: false, reason: err.message };
  }
}

module.exports = { isConfigured, ask };
