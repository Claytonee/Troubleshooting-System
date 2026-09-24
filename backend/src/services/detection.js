const pool = require('../config/database');

/**
 * Detection rules — alert only (DECISIONS.md D5 b, D6).
 *
 * Every minute these deterministic rules read the recorded evidence
 * (security_events, audit_log). A match opens a security incident — one per
 * rule, subject and hour, however many events feed it — and the platform
 * admin's bell gets ONE alert when the incident opens. Nothing here blocks a
 * request: D5 says detect and alert first, measure false positives for 30
 * days, and only then consider temporary blocks.
 *
 * Every rule explains itself: a person reading the incident sees which rule,
 * which account or address, how many events, and in what window. No AI in the
 * loop; it may summarise later, but it never decides (SECURITY_DESIGN.md §5).
 */

// Thresholds are the design's (SECURITY_DESIGN.md §2). They are starting points
// to be tuned on 30 days of real data, which is exactly why nothing blocks yet.
const RULES = [
  {
    id: 'R1', name: 'Password guessing on one account', severity: 'medium', window: 15,
    why: 'Ten or more wrong passwords for one account within 15 minutes, from any address.',
    sql: `SELECT CAST(user_id AS CHAR) AS subject, 'account' AS subject_type, SUM(count) AS n,
                 COUNT(DISTINCT source_ip) AS sources, MIN(occurred_at) AS first_at, MAX(last_at) AS last_at
            FROM security_events
           WHERE event_type = 'auth.login_failed' AND user_id IS NOT NULL
             AND last_at >= NOW() - INTERVAL 15 MINUTE
           GROUP BY user_id HAVING n >= 10`
  },
  {
    id: 'R2', name: 'Password spraying from one address', severity: 'medium', window: 15,
    why: 'Failed sign-ins against five or more different accounts from one address within 15 minutes. A school shares one address, so this alerts and never blocks.',
    sql: `SELECT source_ip AS subject, 'address' AS subject_type, SUM(count) AS n,
                 COUNT(DISTINCT COALESCE(user_id, CONCAT('unknown-', id))) AS accounts,
                 MIN(occurred_at) AS first_at, MAX(last_at) AS last_at
            FROM security_events
           WHERE event_type = 'auth.login_failed' AND source_ip IS NOT NULL
             AND last_at >= NOW() - INTERVAL 15 MINUTE
           GROUP BY source_ip HAVING accounts >= 5`
  },
  {
    id: 'R3', name: 'Sign-in succeeded after many failures', severity: 'high', window: 15,
    why: 'A successful sign-in to an account that had five or more wrong passwords in the 15 minutes before — possibly a guessed password.',
    sql: `SELECT CAST(ok.user_id AS CHAR) AS subject, 'account' AS subject_type, SUM(f.count) AS n,
                 MIN(f.occurred_at) AS first_at, MAX(ok.last_at) AS last_at
            FROM security_events ok
            JOIN security_events f ON f.user_id = ok.user_id AND f.event_type = 'auth.login_failed'
             AND f.last_at BETWEEN ok.last_at - INTERVAL 15 MINUTE AND ok.last_at
           WHERE ok.event_type IN ('auth.login_ok', 'auth.mfa_required')
             AND ok.last_at >= NOW() - INTERVAL 15 MINUTE
           GROUP BY ok.user_id HAVING n >= 5`
  },
  {
    id: 'R4', name: 'Probing another school\'s records', severity: 'high', window: 10,
    why: 'Five or more requests for records that are not the account\'s own (403) within 10 minutes.',
    sql: `SELECT CAST(user_id AS CHAR) AS subject, 'account' AS subject_type, SUM(count) AS n,
                 COUNT(DISTINCT path_template) AS routes, MIN(occurred_at) AS first_at, MAX(last_at) AS last_at
            FROM security_events
           WHERE event_type = 'authz.refused' AND user_id IS NOT NULL
             AND last_at >= NOW() - INTERVAL 10 MINUTE
           GROUP BY user_id HAVING n >= 5`
  },
  {
    id: 'R5', name: 'Forged messages to an integration', severity: 'medium', window: 10,
    why: 'Three or more webhook or callback requests without a valid key or signature from one address within 10 minutes.',
    sql: `SELECT source_ip AS subject, 'address' AS subject_type, SUM(count) AS n,
                 MIN(occurred_at) AS first_at, MAX(last_at) AS last_at
            FROM security_events
           WHERE event_type = 'webhook.rejected' AND source_ip IS NOT NULL
             AND last_at >= NOW() - INTERVAL 10 MINUTE
           GROUP BY source_ip HAVING n >= 3`
  },
  {
    id: 'R6', name: 'Two-step sign-in removed', severity: 'high', window: 60,
    why: 'Two-step sign-in was turned off, or reset from the server console. Legitimate after a lost phone; worth confirming every time.',
    sql: [`SELECT CAST(user_id AS CHAR) AS subject, 'account' AS subject_type, SUM(count) AS n,
                 MIN(occurred_at) AS first_at, MAX(last_at) AS last_at
            FROM security_events
           WHERE event_type = 'auth.mfa_disabled' AND user_id IS NOT NULL
             AND last_at >= NOW() - INTERVAL 60 MINUTE
           GROUP BY user_id`,
         // Separate query, not a UNION: the two tables can carry different collations
         // (they do on this server), and a UNION across them fails outright.
         `SELECT entity_id AS subject, 'account' AS subject_type, COUNT(*) AS n,
                 MIN(created_at) AS first_at, MAX(created_at) AS last_at
            FROM audit_log
           WHERE action = 'auth.mfa_reset_break_glass' AND created_at >= NOW() - INTERVAL 60 MINUTE
           GROUP BY entity_id`]
  },
  {
    id: 'R8', name: 'A browser blocked a foreign script', severity: 'high', window: 60,
    why: 'The strict content policy stopped a script from another website, or an eval, on one of our pages. The app loads no such script, so this is what injected code looks like.',
    sql: `SELECT source_ip AS subject, 'address' AS subject_type, SUM(count) AS n,
                 MIN(occurred_at) AS first_at, MAX(last_at) AS last_at
            FROM security_events
           WHERE event_type = 'csp.foreign_script' AND source_ip IS NOT NULL
             AND last_at >= NOW() - INTERVAL 60 MINUTE
           GROUP BY source_ip`
  },
  {
    id: 'R9', name: 'Sign-in with a published password', severity: 'high', window: 60,
    why: 'The right password was typed for this account, and it is one printed in the public repository. If the username was published too, the sign-in was refused and the account needs a reset. Otherwise the person was made to choose a new password at once — confirm it was the account\'s owner.',
    sql: `SELECT CAST(user_id AS CHAR) AS subject, 'account' AS subject_type, SUM(count) AS n,
                 COUNT(DISTINCT source_ip) AS sources, MIN(occurred_at) AS first_at, MAX(last_at) AS last_at
            FROM security_events
           WHERE event_type = 'auth.published_password' AND user_id IS NOT NULL
             AND last_at >= NOW() - INTERVAL 60 MINUTE
           GROUP BY user_id`
  },
  {
    id: 'R7', name: 'Security monitoring dropped events', severity: 'high', window: 60,
    why: 'More distinct events arrived than the recorder could hold — evidence was lost, which is itself a sign of an attack or an overload.',
    sql: `SELECT 'monitoring' AS subject, 'system' AS subject_type, SUM(count) AS n,
                 MIN(occurred_at) AS first_at, MAX(last_at) AS last_at
            FROM security_events
           WHERE event_type = 'events.dropped' AND last_at >= NOW() - INTERVAL 60 MINUTE
          HAVING n > 0`
  }
];

let timer = null;
let running = false;

/** Words a person can act on, without leaking anything they should not see. */
function describe(rule, m) {
  const who = m.subject_type === 'account' ? `account #${m.subject}`
    : m.subject_type === 'address' ? (m.subject === '0.0.0.0' ? 'requests with a made-up address (the host proxy hides the real one, SEC-015)' : `address ${m.subject}`)
    : 'the monitoring';
  const extra = m.accounts ? `, ${m.accounts} accounts` : m.routes ? `, ${m.routes} routes` : m.sources ? `, from ${m.sources} address${Number(m.sources) === 1 ? '' : 'es'}` : '';
  return `${rule.name}: ${who} — ${m.n} event${Number(m.n) === 1 ? '' : 's'} in ${rule.window} min${extra}.`;
}

/** One alert per incident, to the platform admin's bell (and SMS for high, when configured). */
async function alert(incidentId, rule, m) {
  await pool.query(
    `INSERT INTO admin_notifications (target_role, type, title, message, meta) VALUES ('admin', 'security_incident', ?, ?, ?)`,
    [`Security: ${rule.name}`, describe(rule, m) + ' ' + rule.why,
      JSON.stringify({ incident_id: incidentId, rule: rule.id, severity: rule.severity })]);
  if (rule.severity === 'high') {
    try {
      const sms = require('./sms');
      if (sms.isConfigured()) {
        const [admins] = await pool.query("SELECT phone FROM users WHERE role = 'admin' AND status = 'active' AND phone IS NOT NULL");
        for (const a of admins) await sms.sendSms(a.phone, `OE Support security: ${rule.name}. Open the Security Overview.`).catch(() => {});
      }
    } catch (e) { /* SMS is a courtesy; the bell is the record */ }
  }
}

/** Run every rule once. Returns the incidents opened (new) and touched (existing). */
async function runOnce() {
  if (running) return { opened: [], touched: 0, skipped: true };
  running = true;
  const opened = [];
  let touched = 0;
  try {
    for (const rule of RULES) {
      let matches = [];
      try {
        // A rule is one query, or several whose rows are combined.
        for (const q of [].concat(rule.sql)) { const [rows] = await pool.query(q); matches = matches.concat(rows); }
      }
      catch (e) { console.error(`[detection] ${rule.id} failed:`, e.message); continue; }
      for (const m of matches) {
        if (m.subject == null) continue;
        // One incident per rule, subject and hour: a burst is one incident, not a flood.
        const hour = new Date().toISOString().slice(0, 13);
        const key = `${rule.id}|${m.subject}|${hour}`;
        const detail = JSON.stringify({ window_minutes: rule.window, accounts: m.accounts || undefined, routes: m.routes || undefined, sources: m.sources || undefined });
        // Insert-or-nothing, then update: "is this new?" must have one unambiguous
        // answer. With ON DUPLICATE KEY UPDATE the driver reports a matched-but-
        // unchanged row as 1 affected row with insertId 0 — indistinguishable from
        // an insert — and every repeat sent a second alert pointing at incident 0.
        const [ins] = await pool.query(
          `INSERT IGNORE INTO security_incidents
             (dedup_key, rule_id, rule_name, severity, subject_type, subject, event_count, first_seen, last_seen, summary, why, detail)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [key, rule.id, rule.name, rule.severity, m.subject_type, String(m.subject).slice(0, 64), Number(m.n) || 0,
            m.first_at, m.last_at, describe(rule, m), rule.why, detail]);
        if (ins.affectedRows === 1 && ins.insertId > 0) {
          opened.push({ id: ins.insertId, rule: rule.id });
          await alert(ins.insertId, rule, m);
        } else {
          await pool.query(
            `UPDATE security_incidents SET event_count = GREATEST(event_count, ?), last_seen = GREATEST(last_seen, ?),
                    summary = ?, detail = ? WHERE dedup_key = ?`,
            [Number(m.n) || 0, m.last_at, describe(rule, m), detail, key]);
          touched++;
        }
      }
    }
  } finally { running = false; }
  return { opened, touched };
}

function start(intervalMs = 60 * 1000) {
  if (timer) return;
  timer = setInterval(() => { runOnce().catch(e => console.error('[detection]', e.message)); }, intervalMs);
  if (timer.unref) timer.unref();
}

module.exports = { runOnce, start, RULES };
