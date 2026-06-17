/**
 * SMS notification service via Africa's Talking (Tier 2 #7).
 *
 * Most context-relevant channel for rural Tanzania (SMS reaches basic phones
 * with intermittent data). DEGRADES GRACEFULLY: no-ops + logs when unconfigured.
 *
 * Required env to activate:
 *   AT_USERNAME, AT_API_KEY
 * Optional:
 *   AT_SENDER_ID   (registered alphanumeric/short code; omit to use shared pool)
 *   AT_ENV=sandbox (use the sandbox endpoint for testing; default = live)
 */

function isConfigured() {
  return !!(process.env.AT_USERNAME && process.env.AT_API_KEY);
}

// Normalise a TZ number toward E.164 (+255...). Best-effort; passes through if unsure.
function normalizeTz(num) {
  if (!num) return null;
  let n = String(num).replace(/[^\d+]/g, '');
  if (n.startsWith('+')) return n;
  if (n.startsWith('255')) return '+' + n;
  if (n.startsWith('0')) return '+255' + n.slice(1);
  if (n.length === 9) return '+255' + n; // bare 7XXXXXXXX
  return n;
}

async function sendSms(to, message) {
  const recipients = (Array.isArray(to) ? to : [to]).map(normalizeTz).filter(Boolean);
  if (!recipients.length) return { sent: false, skipped: 'no recipient' };
  if (!isConfigured()) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[sms] skipped (Africa's Talking not configured): "${String(message).slice(0, 40)}…" -> ${recipients.join(', ')}`);
    }
    return { sent: false, skipped: 'not configured' };
  }
  try {
    const base = process.env.AT_ENV === 'sandbox'
      ? 'https://api.sandbox.africastalking.com'
      : 'https://api.africastalking.com';
    const body = new URLSearchParams({
      username: process.env.AT_USERNAME,
      to: recipients.join(','),
      message
    });
    if (process.env.AT_SENDER_ID) body.set('from', process.env.AT_SENDER_ID);

    const res = await fetch(base + '/version1/messaging', {
      method: 'POST',
      headers: {
        apiKey: process.env.AT_API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
      },
      body
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.error('[sms] send failed:', res.status, txt.slice(0, 200));
      return { sent: false, error: `HTTP ${res.status}` };
    }
    return { sent: true };
  } catch (e) {
    console.error('[sms] send error:', e.message);
    return { sent: false, error: e.message };
  }
}

/** Short SMS for an error event. Best-effort, never throws. */
async function notifyErrorSms(event, error, opts = {}) {
  try {
    const phones = (opts.phones || []).filter(Boolean);
    if (!phones.length) return { sent: false, skipped: 'no phones' };
    const code = error.error_code || `#${error.id}`;
    const school = error.school_name || '';
    const verbs = {
      created: `New ${error.priority} issue`,
      escalated: 'ESCALATED',
      breached: 'SLA BREACHED'
    };
    const verb = verbs[event] || 'Update';
    const msg = `QFT ${code}: ${verb} - ${error.title}${school ? ' @ ' + school : ''}`.slice(0, 160);
    return await sendSms(phones, msg);
  } catch (e) {
    console.error('[sms] notifyErrorSms failed:', e.message);
    return { sent: false, error: e.message };
  }
}

module.exports = { isConfigured, sendSms, notifyErrorSms, normalizeTz };
