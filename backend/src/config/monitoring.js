/**
 * Monitoring thresholds, in one place so the heartbeat endpoint, the sweep and
 * the health KPI cannot drift apart.
 * docs/features/01-lrs-heartbeat.md
 */

/** How often the agent on each school LRS is expected to report. */
const BEAT_MINUTES = 5;

/**
 * Missed beats before a device counts as down. Three, not one: a single missed
 * beat is normal on a rural link. 15 minutes still leaves almost the whole
 * 4-hour critical SLA window for the engineer.
 */
const MISSED_BEATS_TO_OPEN = 3;

const DOWN_AFTER_MINUTES = BEAT_MINUTES * MISSED_BEATS_TO_OPEN;

/** Prefix of errors.auto_source for heartbeat-opened tickets; also the dedup key. */
const HEARTBEAT_SOURCE = 'lrs_heartbeat';

/**
 * SQL fragment: schools whose LRS has gone silent. A device that has never
 * reported is excluded — a school without the agent installed is `unknown`,
 * not down, and must not be marked unhealthy or generate tickets.
 */
const SILENT_SCHOOLS_SUBQUERY = `
  SELECT school_id FROM lrs_devices
  WHERE last_heartbeat IS NOT NULL
    AND last_heartbeat < DATE_SUB(NOW(), INTERVAL ${DOWN_AFTER_MINUTES} MINUTE)`;

/** SQL fragment: liveness of one lrs_devices row, for the given table alias. */
const heartbeatStateSelect = (alias = 'd') => `
  CASE
    WHEN ${alias}.last_heartbeat IS NULL THEN 'unknown'
    WHEN ${alias}.last_heartbeat < DATE_SUB(NOW(), INTERVAL ${DOWN_AFTER_MINUTES} MINUTE) THEN 'down'
    ELSE 'up'
  END AS heartbeat_state,
  TIMESTAMPDIFF(MINUTE, ${alias}.last_heartbeat, NOW()) AS minutes_since_heartbeat`;

module.exports = {
  BEAT_MINUTES,
  MISSED_BEATS_TO_OPEN,
  DOWN_AFTER_MINUTES,
  HEARTBEAT_SOURCE,
  SILENT_SCHOOLS_SUBQUERY,
  heartbeatStateSelect
};
