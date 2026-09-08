/**
 * WhatsApp Business Cloud API — outbound messages and webhook authentication.
 * Design: docs/features/03-whatsapp-intake.md
 *
 * DEGRADES GRACEFULLY, like notify.js and sms.js: with no credentials it logs
 * what it would have sent and reports skipped. That keeps the inbound webhook
 * fully testable without a Meta account.
 *
 * Required env to activate sending:
 *   WHATSAPP_TOKEN          permanent access token for the phone number
 *   WHATSAPP_PHONE_ID       the phone number id (not the number itself)
 * Required to accept webhooks:
 *   WHATSAPP_APP_SECRET     signs the payload; verified per request
 *   WHATSAPP_VERIFY_TOKEN   the one-time subscription handshake
 * Optional:
 *   WHATSAPP_API_VERSION    default v21.0
 */
const crypto = require('crypto');

const API_VERSION = process.env.WHATSAPP_API_VERSION || 'v21.0';

function isConfigured() {
  return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID);
}

/** Normalise a Tanzanian number toward E.164. Mirrors sms.js. */
function normalizeTz(num) {
  if (!num) return null;
  let n = String(num).replace(/[^\d+]/g, '');
  if (n.startsWith('+')) return n;
  if (n.startsWith('255')) return '+' + n;
  if (n.startsWith('0')) return '+255' + n.slice(1);
  if (n.length === 9) return '+255' + n;
  return n;
}

/**
 * Verifies Meta's X-Hub-Signature-256 over the raw request body.
 *
 * Without a configured secret this returns false rather than true: an
 * unauthenticated webhook would let anyone file tickets as any school, so the
 * safe default is to refuse — the same stance /api/deploy and /api/heartbeat
 * take.
 */
function verifySignature(rawBody, header) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !rawBody || !header) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(header));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Sends a plain text message. Returns { sent, skipped? , error? }. */
async function sendText(to, body) {
  const number = normalizeTz(to);
  if (!number) return { sent: false, skipped: 'no recipient' };
  if (!body) return { sent: false, skipped: 'empty body' };

  if (!isConfigured()) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[whatsapp] skipped (not configured) -> ${number}: "${String(body).replace(/\s+/g, ' ').slice(0, 90)}…"`);
    }
    return { sent: false, skipped: 'not configured' };
  }

  try {
    const res = await fetch(`https://graph.facebook.com/${API_VERSION}/${process.env.WHATSAPP_PHONE_ID}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: number,
        type: 'text',
        // Link previews are noise on a support thread and cost bandwidth.
        text: { preview_url: false, body: String(body).slice(0, 4096) }
      })
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('[whatsapp] send failed:', res.status, detail.slice(0, 200));
      return { sent: false, error: `HTTP ${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    console.error('[whatsapp] send error:', err.message);
    return { sent: false, error: err.message };
  }
}

/**
 * Downloads a media item the sender attached. Two calls: resolve the id to a
 * short-lived URL, then fetch the bytes with the same bearer token.
 * Returns { ok, buffer, mimeType } or { ok: false, reason }.
 */
async function fetchMedia(mediaId) {
  if (!isConfigured() || !mediaId) return { ok: false, reason: 'not configured' };
  try {
    const meta = await fetch(`https://graph.facebook.com/${API_VERSION}/${mediaId}`, {
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` }
    }).then(r => (r.ok ? r.json() : null));
    if (!meta || !meta.url) return { ok: false, reason: 'no media url' };

    const bin = await fetch(meta.url, {
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` }
    });
    if (!bin.ok) return { ok: false, reason: `HTTP ${bin.status}` };
    const buffer = Buffer.from(await bin.arrayBuffer());
    return { ok: true, buffer, mimeType: meta.mime_type || 'application/octet-stream' };
  } catch (err) {
    console.error('[whatsapp] media fetch failed:', err.message);
    return { ok: false, reason: err.message };
  }
}

module.exports = { isConfigured, normalizeTz, verifySignature, sendText, fetchMedia };
