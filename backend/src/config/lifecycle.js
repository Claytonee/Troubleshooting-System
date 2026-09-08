/**
 * Asset lifecycle thresholds and the SQL that derives everything from them.
 * Design: docs/features/04-asset-lifecycle.md
 *
 * Nothing here is stored. Age, warranty state and fault counts are all computed
 * at query time, because a stored derived value freezes — `errors.hours_open`
 * did exactly that and drifted 2141 hours out of date before anyone noticed.
 */

/** A warranty inside this window is worth claiming on now, not later. */
const WARRANTY_WARN_DAYS = 60;

/**
 * A device is a repeat offender at 3 faults ever, or 2 inside this window.
 * Two in three months is a pattern; two across four years is bad luck.
 */
const REPEAT_FAULT_TOTAL = 3;
const REPEAT_FAULT_RECENT = 2;
const REPEAT_WINDOW_DAYS = 90;

/** Statuses in tablet_history.new_value that count as a fault, not a move. */
const FAULT_STATUSES = ['Faulty', 'In Repair'];

const faultList = FAULT_STATUSES.map(s => `'${s}'`).join(', ');

/**
 * Per-device derived columns, for the given tablets alias.
 *
 * warranty_state is 'unknown' when no expiry is recorded — never 'expired'.
 * A missing purchase record is a gap in the paperwork, not an expired warranty,
 * and showing it as expired would send someone to argue with a supplier who
 * owes them nothing.
 */
const lifecycleSelect = (alias = 't') => `
  CASE
    WHEN ${alias}.warranty_expires_on IS NULL THEN 'unknown'
    WHEN ${alias}.warranty_expires_on < CURDATE() THEN 'expired'
    WHEN ${alias}.warranty_expires_on <= DATE_ADD(CURDATE(), INTERVAL ${WARRANTY_WARN_DAYS} DAY) THEN 'expiring'
    ELSE 'active'
  END AS warranty_state,
  DATEDIFF(${alias}.warranty_expires_on, CURDATE()) AS warranty_days_left,
  CASE
    WHEN ${alias}.purchase_date IS NULL THEN NULL
    ELSE ROUND(DATEDIFF(CURDATE(), ${alias}.purchase_date) / 30.44, 1)
  END AS age_months,
  CASE
    WHEN ${alias}.expected_eol_on IS NULL THEN 'unknown'
    WHEN ${alias}.expected_eol_on < CURDATE() THEN 'past'
    ELSE 'within'
  END AS eol_state,
  (SELECT COUNT(*) FROM tablet_history h
     WHERE h.tablet_id = ${alias}.id AND h.new_value IN (${faultList})) AS fault_count,
  (SELECT COUNT(*) FROM tablet_history h
     WHERE h.tablet_id = ${alias}.id AND h.new_value IN (${faultList})
       AND h.created_at >= DATE_SUB(NOW(), INTERVAL ${REPEAT_WINDOW_DAYS} DAY)) AS recent_fault_count,
  (SELECT MAX(h.created_at) FROM tablet_history h
     WHERE h.tablet_id = ${alias}.id AND h.new_value IN (${faultList})) AS last_fault_at`;

/**
 * SQL predicate for "repeat offender". Kept as a fragment rather than computed
 * in JS so it can also be used in a WHERE clause for filtering.
 */
const repeatOffenderExpr = (alias = 't') => `(
  (SELECT COUNT(*) FROM tablet_history h
     WHERE h.tablet_id = ${alias}.id AND h.new_value IN (${faultList})) >= ${REPEAT_FAULT_TOTAL}
  OR (SELECT COUNT(*) FROM tablet_history h
     WHERE h.tablet_id = ${alias}.id AND h.new_value IN (${faultList})
       AND h.created_at >= DATE_SUB(NOW(), INTERVAL ${REPEAT_WINDOW_DAYS} DAY)) >= ${REPEAT_FAULT_RECENT}
)`;

/**
 * The sentence an engineer actually needs before deciding repair or replace.
 * Built server-side so the same wording appears everywhere it is shown.
 */
function verdict(row) {
  const parts = [];
  const faults = Number(row.fault_count || 0);

  if (faults === 0) parts.push('No faults recorded');
  else {
    const last = row.last_fault_at ? daysAgo(row.last_fault_at) : null;
    parts.push(`${faults} fault${faults === 1 ? '' : 's'}${last != null ? `, last ${describeDays(last)}` : ''}`);
  }

  if (row.warranty_state === 'active') parts.push(`warranty active for ${describeDays(Number(row.warranty_days_left))}`);
  else if (row.warranty_state === 'expiring') parts.push(`warranty expires in ${describeDays(Number(row.warranty_days_left))} — claim now`);
  else if (row.warranty_state === 'expired') parts.push(`warranty expired ${describeDays(-Number(row.warranty_days_left))} ago`);
  else parts.push('warranty not recorded');

  return parts.join(' · ');
}

function daysAgo(when) {
  return Math.max(0, Math.round((Date.now() - new Date(when).getTime()) / 86400000));
}

function describeDays(d) {
  if (!Number.isFinite(d)) return 'an unknown time';
  if (d === 0) return 'today';
  if (d < 30) return `${d} day${d === 1 ? '' : 's'}`;
  const months = Math.round(d / 30.44);
  if (months < 24) return `${months} month${months === 1 ? '' : 's'}`;
  return `${(d / 365.25).toFixed(1)} years`;
}

/** True when this device should be replaced rather than repaired again. */
function isRepeatOffender(row) {
  return Number(row.fault_count || 0) >= REPEAT_FAULT_TOTAL
    || Number(row.recent_fault_count || 0) >= REPEAT_FAULT_RECENT;
}

module.exports = {
  WARRANTY_WARN_DAYS,
  REPEAT_FAULT_TOTAL,
  REPEAT_FAULT_RECENT,
  REPEAT_WINDOW_DAYS,
  FAULT_STATUSES,
  lifecycleSelect,
  repeatOffenderExpr,
  verdict,
  isRepeatOffender,
  describeDays
};
