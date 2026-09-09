/**
 * Shared intake: identity, classification, and the ONE definition of where a
 * newly reported fault goes.
 *
 * There are now four ways into this system — the web form, WhatsApp, USSD and
 * SMS — and the routing rule was written twice: once in errorController.create
 * and once inside the WhatsApp handler. They had already drifted. A teacher
 * reporting on the web reached their school administrator (the rule the school
 * asked for on 2026-09-09); the same teacher reporting the same fault over
 * WhatsApp was assigned straight to the field engineer and told "an engineer
 * has been notified". Two channels, two answers, one system.
 *
 * So the rule lives here, and every channel asks this module.
 */
const pool = require('../config/database');

/** Roles that ARE the school level: their reports have nobody below to triage. */
const SCHOOL_LEVEL_ROLES = ['school', 'admin', 'subadmin'];

/**
 * Where a new fault lands.
 *
 * - A school administrator (or head office) reporting goes straight to the
 *   field engineer: they are the school level, so there is no one to triage it.
 * - Anyone else — a teacher, or a phone number over WhatsApp/USSD/SMS — is
 *   triaged by their own school administrator first. Unassigned on purpose:
 *   an assignee makes it look handled.
 * - **Critical is the exception.** A school that cannot teach today does not
 *   wait for somebody to open their bell, so it goes to the engineer
 *   immediately AND the school administrator is told why.
 */
function routeFor({ reporterRole, priority, fieldEngineerId }) {
  const bySchoolLevel = SCHOOL_LEVEL_ROLES.includes(reporterRole);
  const critical = priority === 'critical';
  return {
    assignedTo: (bySchoolLevel || critical) ? (fieldEngineerId || null) : null,
    escalationLevel: (bySchoolLevel || critical) ? 'platform' : 'school',
    notifySchoolAdmin: !bySchoolLevel,
    critical
  };
}

/**
 * Puts a fault on the school administrator's bell.
 *
 * Email is not configured on this deployment and SMS costs money per message,
 * so the in-app notification is the channel that actually reaches them.
 * Best-effort: a notification failure must never lose the fault.
 */
async function notifySchoolAdmin({ schoolId, errorId, errorCode, priority, category, reporterName, critical }) {
  try {
    await pool.query(
      `INSERT INTO admin_notifications (target_role, type, title, message, meta)
       VALUES ('school', 'error_reported', ?, ?, ?)`,
      [
        `${reporterName || 'Someone'} reported: ${errorCode}`.slice(0, 300),
        `${errorCode} · ${priority} · ${category}${critical ? ' — critical, already sent to the engineers too' : ''}`,
        JSON.stringify({ school_id: Number(schoolId), error_id: errorId, error_code: errorCode, priority })
      ]
    );
    return true;
  } catch (e) {
    console.error('[intake] school-admin notification failed:', e.message);
    return false;
  }
}

/** Next QFT-#### code, derived from the highest number rather than the last row. */
async function nextErrorCode() {
  const [mx] = await pool.query(
    "SELECT MAX(CAST(SUBSTRING(error_code, 5) AS UNSIGNED)) AS maxnum FROM errors WHERE error_code LIKE 'QFT-%'"
  );
  return `QFT-0${((mx[0] && mx[0].maxnum) ? mx[0].maxnum : 240) + 1}`;
}

/** Normalise a Tanzanian number toward E.164. Best-effort; passes through if unsure. */
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
 * Who is on the other end of this number.
 *
 * **A phone number is not authentication.** A match tells us which school to
 * file against and lets us greet them by name; it never grants the ability to
 * read anything back that they could not already see. Channels that expose
 * status must check `verified` themselves.
 */
async function resolveIdentity(phone) {
  const normalised = normalizeTz(phone);
  if (!normalised) return { user_id: null, school_id: null, verified: false, name: null, role: null };

  const [users] = await pool.query(
    "SELECT id, role, school_id, phone, full_name FROM users WHERE phone IS NOT NULL AND phone <> '' AND status = 'active'"
  );
  const match = users.find(u => normalizeTz(u.phone) === normalised);
  if (!match) return { user_id: null, school_id: null, verified: false, name: null, role: null };

  let schoolId = match.school_id || null;
  if (!schoolId && match.role === 'teacher') {
    const [t] = await pool.query('SELECT school_id FROM teachers WHERE user_id = ?', [match.id]);
    if (t.length) schoolId = t[0].school_id;
  }
  return { user_id: match.id, school_id: schoolId, verified: true, name: match.full_name, role: match.role };
}

/** A school from the code a caller typed, so an unrecognised number can still report. */
async function schoolByCode(code) {
  if (!code) return null;
  const [rows] = await pool.query(
    'SELECT id, name, code, assigned_admin_id FROM schools WHERE LOWER(code) = LOWER(?) LIMIT 1',
    [String(code).trim()]
  );
  return rows[0] || null;
}

// --- classification --------------------------------------------------------
// Shared with the WhatsApp handler so one set of rules covers every channel.

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
 * words indicate scale or a stop to teaching. Inflating everything to critical
 * would make the SLA meaningless.
 */
function guessPriority(text) {
  const t = String(text).toLowerCase();
  if (/all |whole|entire|shule yote|wote|wanafunzi wote|cannot teach|no lesson|hakuna somo|urgent|haraka|emergency|dharura|sparking|fire|moto/.test(t)) return 'critical';
  if (/(wanafunzi|students|pupils|watoto)[^.!?]{0,40}(hawawezi|cannot|can.?t|unable|hakuna|wameshindwa)/.test(t)) return 'high';
  if (/(hawawezi|cannot|can.?t|unable)[^.!?]{0,40}(kuingia|kutumia|log ?in|access|use)/.test(t)) return 'high';
  if (/many|several|wengi|nyingi|class|darasa|exam|mtihani|today|leo/.test(t)) return 'high';
  if (/slow|polepole|sometimes|mara nyingine|one |moja/.test(t)) return 'low';
  return 'medium';
}

/** A one-line title from the first sentence, without truncating mid-word. */
function makeTitle(text, fallback = 'Reported by phone') {
  const first = String(text || '').replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s/)[0] || fallback;
  if (first.length <= 90) return first;
  const cut = first.slice(0, 90);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut) + '…';
}

module.exports = {
  routeFor, notifySchoolAdmin, nextErrorCode,
  normalizeTz, resolveIdentity, schoolByCode,
  guessCategory, guessPriority, makeTitle,
  SCHOOL_LEVEL_ROLES
};
