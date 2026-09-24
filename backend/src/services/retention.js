const pool = require('../config/database');
const { logAudit } = require('./audit');

/**
 * Data retention — Tanzania PDPA s.28 (DATA_PROTECTION.md, DECISIONS.md D21, D25).
 *
 * The periods are decided; deleting is irreversible. So this job REPORTS by
 * default — how many rows each policy would remove — and deletes only when the
 * owner has set RETENTION_ENFORCE=1 after confirming a backup exists
 * (CLAUDE.md: no data-losing change without an explicit, backed-up
 * confirmation). The Security Overview shows the report either way, so nothing
 * is removed without anyone knowing, and nothing piles up without anyone knowing.
 *
 * Deletes run in batches of 1000 and write one audit entry per policy per run.
 */

const DAY = 24 * 60 * 60 * 1000;

// Each policy: what, how old, and the SQL fragments to count and to delete.
// `before` statements run first (children of the rows about to go).
const POLICIES = [
  {
    id: 'audit_log', label: 'Audit trail entries', keep: '2 years',
    where: 'created_at < NOW() - INTERVAL 2 YEAR', table: 'audit_log'
  },
  {
    id: 'rejected_registrations', label: 'Rejected registration requests', keep: '1 year after the decision',
    where: "status = 'rejected' AND COALESCE(reviewed_at, updated_at, created_at) < NOW() - INTERVAL 1 YEAR",
    table: 'registration_requests',
    before: (ids) => [['DELETE FROM registration_appeals WHERE request_id IN (?)', [ids]]]
  },
  {
    id: 'whatsapp_conversations', label: 'WhatsApp conversations and their messages', keep: '1 year since the last message',
    where: 'COALESCE(last_message_at, updated_at, created_at) < NOW() - INTERVAL 1 YEAR',
    table: 'whatsapp_conversations',
    before: (ids) => [['DELETE FROM whatsapp_messages WHERE conversation_id IN (?)', [ids]]]
  },
  {
    id: 'ussd_sessions', label: 'USSD sessions', keep: '1 year',
    where: 'COALESCE(updated_at, created_at) < NOW() - INTERVAL 1 YEAR', table: 'ussd_sessions'
  },
  {
    id: 'csp_reports', label: 'Browser policy reports no longer seen', keep: '90 days since last seen',
    where: 'last_seen < NOW() - INTERVAL 90 DAY', table: 'csp_reports'
  },
  {
    // Reported, never deleted by the job. Faults, visits and the audit trail name
    // these people; removing an account is a person's decision (anonymise or keep),
    // made from this count — not something a timer should do.
    id: 'inactive_accounts', label: 'Accounts deactivated over a year ago', keep: '1 year, then reviewed by a person',
    where: "status = 'inactive' AND updated_at < NOW() - INTERVAL 1 YEAR", table: 'users', reportOnly: true
  }
];

let lastRun = null;   // the last SCHEDULED run — what was actually removed, and when
let timer = null;

const enforcing = () => process.env.RETENTION_ENFORCE === '1';

/**
 * One pass over every policy. With enforce=false (the default) nothing is
 * deleted; the counts are what WOULD go. Returns the report.
 */
async function run({ enforce = enforcing() } = {}) {
  const report = { at: new Date().toISOString(), enforce, policies: [] };
  for (const p of POLICIES) {
    const entry = { id: p.id, label: p.label, keep: p.keep, due: 0, removed: 0, report_only: !!p.reportOnly };
    try {
      const [[c]] = await pool.query(`SELECT COUNT(*) AS n FROM ${p.table} WHERE ${p.where}`);
      entry.due = Number(c.n);
      if (enforce && !p.reportOnly && entry.due > 0) {
        for (;;) {
          const [rows] = await pool.query(`SELECT id FROM ${p.table} WHERE ${p.where} ORDER BY id LIMIT 1000`);
          if (!rows.length) break;
          const ids = rows.map(r => r.id);
          for (const [sql, params] of (p.before ? p.before(ids) : [])) await pool.query(sql, params);
          const [d] = await pool.query(`DELETE FROM ${p.table} WHERE id IN (?)`, [ids]);
          entry.removed += d.affectedRows;
          if (rows.length < 1000) break;
        }
        await logAudit({ action: 'retention.removed', entityType: p.table,
          summary: `Retention: removed ${entry.removed} — ${p.label}, kept ${p.keep}`,
          meta: { policy: p.id, removed: entry.removed } });
      }
    } catch (e) {
      entry.error = e.code === 'ER_NO_SUCH_TABLE' ? 'table not present' : e.message;
    }
    report.policies.push(entry);
  }
  return report;
}

async function scheduled() {
  try { lastRun = await run(); } catch (e) { console.error('[retention]', e.message); }
}

/**
 * For the Security Overview: counts taken NOW (a few COUNT queries, cheap), plus
 * the last scheduled run. A cached count would go on showing rows that are long
 * gone — or miss ones that just crossed the line — for up to a day.
 */
async function status() {
  const now = await run({ enforce: false });
  return { ...now, enforce: enforcing(), last_run: lastRun && { at: lastRun.at, enforce: lastRun.enforce,
    removed: lastRun.policies.reduce((n, p) => n + p.removed, 0) } };
}

function start() {
  if (timer) return;
  // Ten minutes after boot, then daily: never in the middle of a deploy's first requests.
  setTimeout(scheduled, 10 * 60 * 1000).unref?.();
  timer = setInterval(scheduled, DAY);
  if (timer.unref) timer.unref();
}

module.exports = { run, start, status, POLICIES, enforcing };
