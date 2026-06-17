/**
 * Notification service (Tier 1 #1).
 *
 * Sends email on key error events. Designed to DEGRADE GRACEFULLY:
 * if SMTP env vars are not set, it logs and no-ops instead of throwing,
 * so the system runs fine before email is configured.
 *
 * Required env to activate email:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
 * Optional:
 *   SMTP_SECURE=true|false (default: true if port 465)
 *   MAIL_FROM="Quest Forward Support <support@domain.org>"
 *   APP_URL=https://your-app-url   (used to build links in emails)
 */

let transporter = null;
let initialized = false;

function isConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
  if (initialized) return transporter;
  initialized = true;
  if (!isConfigured()) return null;
  // Lazy-require so the dependency is only needed when email is actually used.
  const nodemailer = require('nodemailer');
  const port = parseInt(process.env.SMTP_PORT, 10);
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  return transporter;
}

/**
 * Low-level send. Returns { sent: boolean, skipped?: string, error?: string }.
 */
async function sendMail({ to, subject, text, html }) {
  if (!to) return { sent: false, skipped: 'no recipient' };
  const t = getTransporter();
  if (!t) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[notify] email skipped (SMTP not configured): "${subject}" -> ${to}`);
    }
    return { sent: false, skipped: 'smtp not configured' };
  }
  try {
    await t.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to, subject, text, html: html || undefined
    });
    return { sent: true };
  } catch (e) {
    console.error('[notify] email send failed:', e.message);
    return { sent: false, error: e.message };
  }
}

const STATUS_LABELS = {
  open: 'Open', progress: 'In Progress', escalated: 'Escalated', resolved: 'Resolved'
};

/**
 * Build & send notification for an error event. Best-effort, never throws.
 * @param {string} event 'created' | 'assigned' | 'status_changed' | 'escalated' | 'resolved'
 * @param {object} error full error row (must include error_code, title, priority, status, school_name)
 * @param {object} [opts] { recipients: string[], actorName, previousStatus }
 */
async function notifyErrorEvent(event, error, opts = {}) {
  try {
    const recipients = (opts.recipients || []).filter(Boolean);
    if (!recipients.length) return { sent: false, skipped: 'no recipients' };

    const appUrl = process.env.APP_URL || '';
    const link = appUrl ? `${appUrl}/#tracker` : '';
    const code = error.error_code || `#${error.id}`;
    const school = error.school_name || error.school || '';

    const subjects = {
      created: `[${code}] New ${error.priority} issue: ${error.title}`,
      assigned: `[${code}] Assigned to you: ${error.title}`,
      status_changed: `[${code}] Status: ${STATUS_LABELS[error.status] || error.status} — ${error.title}`,
      escalated: `[${code}] ESCALATED: ${error.title}`,
      resolved: `[${code}] Resolved: ${error.title}`
    };
    const subject = subjects[event] || `[${code}] Update: ${error.title}`;

    const lines = [
      `Issue: ${error.title}`,
      `Code: ${code}`,
      school ? `School: ${school}` : '',
      `Priority: ${error.priority}`,
      `Status: ${STATUS_LABELS[error.status] || error.status}`,
      opts.previousStatus ? `(was: ${STATUS_LABELS[opts.previousStatus] || opts.previousStatus})` : '',
      opts.actorName ? `By: ${opts.actorName}` : '',
      link ? `\nOpen the tracker: ${link}` : ''
    ].filter(Boolean);
    const text = lines.join('\n');

    // De-duplicate recipients.
    const to = [...new Set(recipients)].join(', ');
    return await sendMail({ to, subject, text });
  } catch (e) {
    console.error('[notify] notifyErrorEvent failed:', e.message);
    return { sent: false, error: e.message };
  }
}

module.exports = { isConfigured, sendMail, notifyErrorEvent };
