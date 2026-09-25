/**
 * Dashboards, one per level. Design note: docs/features/13-dashboards-by-level.md
 *
 * The test every figure here has to pass is "if this number changed, what would
 * this person do differently today". A count that cannot change anybody's next
 * action is decoration, and it is decoration in the most expensive space in the
 * product — so it does not go here, however easy it is to compute.
 *
 * That test is why the four roles no longer share a query. A school
 * administrator was being served head office's dashboard filtered to one row,
 * which told them "Schools Healthy: 1/1" — a tautology — while saying nothing
 * about the two hundred tablets they are actually responsible for.
 *
 * Honesty rules, carried over from analyticsController:
 *  - nothing measurable means null, never 0 and never 100%;
 *  - rows that cannot be judged are excluded from the denominator and counted
 *    separately, so a gap shows as a gap;
 *  - every field is named for what it actually measures.
 */
const pool = require('../config/database');
const { SILENT_SCHOOLS_SUBQUERY, heartbeatStateSelect, DOWN_AFTER_MINUTES } = require('../config/monitoring');
const { spareWhere } = require('../services/spares');
const maintenance = require('../services/maintenance');
const knowledge = require('../services/knowledge');

/** A device counted as out of service: not in a student's hands today. */
const DEVICE_DOWN = "t.status IN ('Faulty','In Repair')";

/** The one definition of a usable spare, qualified for the `tablets t` alias. */
const SPARE_T = spareWhere('t');

/** Open faults still sitting at school level — nobody upstream holds them. */
const AT_SCHOOL = "e.status <> 'resolved' AND e.escalation_level = 'school' AND e.assigned_to IS NULL";

/** Window for the resolution-time comparison, in days. Four weeks, and the four before. */
const TREND_DAYS = 28;

/** A fault nobody has updated in this long is stalled, whatever its status says. */
const STALE_HOURS = 72;

async function getDashboard(req, res, next) {
  try {
    if (req.user.role === 'teacher') return await teacherDashboard(req, res);
    if (req.user.role === 'school') return await schoolDashboard(req, res);
    if (req.user.role === 'subadmin') return await subadminDashboard(req, res);
    return await adminDashboard(req, res);
  } catch (err) {
    console.error('Dashboard error:', err.message);
    res.status(500).json({ error: 'Failed to load dashboard data.' });
  }
}

/* ------------------------------------------------------------------ *
 * Shared helpers
 * ------------------------------------------------------------------ */

/**
 * Current ISO week (Monday-based), matching the 52-week check-in selector and
 * the ISO_WEEK mode analytics uses, so "week 37" means one thing system-wide.
 */
function currentWeek() {
  const now = new Date();
  const wd = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  wd.setUTCDate(wd.getUTCDate() - ((wd.getUTCDay() + 6) % 7) + 3);
  const firstThu = new Date(Date.UTC(wd.getUTCFullYear(), 0, 4));
  firstThu.setUTCDate(firstThu.getUTCDate() - ((firstThu.getUTCDay() + 6) % 7) + 3);
  return {
    week: Math.min(52, Math.max(1, 1 + Math.round((wd - firstThu) / (7 * 86400000)))),
    term: String(now.getFullYear())
  };
}

const num = v => Number(v) || 0;

/** Hours, to one decimal, or null when the basis is empty. Never 0 as a stand-in. */
const hoursOrNull = v => (v == null ? null : Number(v));

/* ------------------------------------------------------------------ *
 * Head office — the dispatch question: what has to move today
 * ------------------------------------------------------------------ */

async function adminDashboard(req, res) {
  const { week, term } = currentWeek();

  const [
    [[schoolCount]],
    [[healthy]],
    [[silent]],
    [[faults]],
    [[devices]],
    [[stockouts]],
    [[resolution]],
    [priorities],
    [attention],
    [categories],
    [[checkins]]
  ] = await Promise.all([
    pool.query('SELECT COUNT(*) AS n FROM schools'),

    // Healthy excludes a school whose LRS has gone silent: a blackout is not
    // health just because nobody in it could file a ticket.
    pool.query(`SELECT COUNT(*) AS n FROM schools s
      WHERE s.id NOT IN (SELECT DISTINCT school_id FROM errors WHERE status <> 'resolved' AND priority IN ('critical','high'))
        AND s.id NOT IN (${SILENT_SCHOOLS_SUBQUERY})`),

    pool.query(`SELECT COUNT(*) AS n FROM (${SILENT_SCHOOLS_SUBQUERY}) x`),

    // One pass over the fault table for every headline figure.
    pool.query(`
      SELECT
        SUM(e.status <> 'resolved')                                                      AS open_count,
        SUM(e.status <> 'resolved' AND e.priority = 'critical')                          AS critical_open,
        SUM(e.status <> 'resolved' AND e.sla_due_at IS NOT NULL AND e.sla_due_at < NOW()) AS breaching_now,
        SUM(e.status <> 'resolved' AND e.sla_due_at IS NOT NULL AND e.sla_due_at >= NOW()
            AND e.sla_due_at < DATE_ADD(NOW(), INTERVAL 4 HOUR))                         AS due_soon,
        -- Nobody has answered these at all. Distinct from "unassigned": a
        -- teacher's fault is deliberately unassigned while it waits for the
        -- school administrator, and that is the system working.
        SUM(e.status <> 'resolved' AND e.first_response_at IS NULL)                      AS unanswered,
        ROUND(MAX(CASE WHEN e.status <> 'resolved' AND e.first_response_at IS NULL
                  THEN TIMESTAMPDIFF(MINUTE, e.created_at, NOW()) END) / 60, 1)          AS unanswered_oldest_hours
      FROM errors e`),

    pool.query(`SELECT COUNT(*) AS total, SUM(${DEVICE_DOWN}) AS down FROM tablets t`),

    // A school with faulty devices and no usable spare cannot be fixed on the
    // day, however good the engineer is. That is the number that decides what
    // goes in the vehicle — and, over a term, what to buy.
    pool.query(`
      SELECT COUNT(*) AS n FROM (
        SELECT t.school_id,
               SUM(${DEVICE_DOWN}) AS awaiting,
               SUM(CASE WHEN ${SPARE_T} THEN 1 ELSE 0 END) AS spares
          FROM tablets t GROUP BY t.school_id
      ) x WHERE x.awaiting > 0 AND x.spares = 0`),

    // Direction, not a snapshot: this four weeks against the four before it.
    pool.query(`
      SELECT
        ROUND(AVG(CASE WHEN e.resolved_at >= DATE_SUB(NOW(), INTERVAL ${TREND_DAYS} DAY)
                  THEN TIMESTAMPDIFF(MINUTE, e.created_at, e.resolved_at) / 60 END), 1) AS hours,
        SUM(e.resolved_at >= DATE_SUB(NOW(), INTERVAL ${TREND_DAYS} DAY))               AS basis,
        ROUND(AVG(CASE WHEN e.resolved_at >= DATE_SUB(NOW(), INTERVAL ${TREND_DAYS * 2} DAY)
                        AND e.resolved_at <  DATE_SUB(NOW(), INTERVAL ${TREND_DAYS} DAY)
                  THEN TIMESTAMPDIFF(MINUTE, e.created_at, e.resolved_at) / 60 END), 1) AS prev_hours,
        SUM(e.resolved_at >= DATE_SUB(NOW(), INTERVAL ${TREND_DAYS * 2} DAY)
            AND e.resolved_at < DATE_SUB(NOW(), INTERVAL ${TREND_DAYS} DAY))            AS prev_basis
      FROM errors e WHERE e.status = 'resolved' AND e.resolved_at IS NOT NULL`),

    // Breached first: priority alone put a fresh critical above a high that has
    // been past its due time for two days.
    pool.query(`
      SELECT e.id, e.error_code, e.title, e.priority, e.status, e.created_at, e.sla_due_at,
             e.first_response_at,
             ROUND(TIMESTAMPDIFF(MINUTE, e.created_at, NOW()) / 60, 1) AS hours_open,
             CASE WHEN e.sla_due_at IS NOT NULL AND e.sla_due_at < NOW() THEN 1 ELSE 0 END AS sla_breached,
             s.name AS school_name
        FROM errors e JOIN schools s ON s.id = e.school_id
       WHERE e.status <> 'resolved'
       ORDER BY sla_breached DESC, FIELD(e.priority,'critical','high','medium','low'), e.created_at ASC
       LIMIT 6`),

    // Where to send somebody. One row per school that has a reason to be visited.
    pool.query(`
      SELECT * FROM (
        SELECT s.id, s.name, s.zone,
          (SELECT COUNT(*) FROM errors e WHERE e.school_id = s.id AND e.status <> 'resolved') AS open_count,
          (SELECT COUNT(*) FROM errors e WHERE e.school_id = s.id AND e.status <> 'resolved' AND e.priority = 'critical') AS critical_count,
          (SELECT COUNT(*) FROM errors e WHERE e.school_id = s.id AND e.status <> 'resolved'
             AND e.sla_due_at IS NOT NULL AND e.sla_due_at < NOW()) AS breached_count,
          (SELECT COUNT(*) FROM tablets t WHERE t.school_id = s.id AND ${DEVICE_DOWN}) AS devices_down,
          (SELECT COUNT(*) FROM tablets t WHERE t.school_id = s.id
             AND ${SPARE_T}) AS spares_available,
          ${heartbeatStateSelect('d')}
        FROM schools s LEFT JOIN lrs_devices d ON d.school_id = s.id
      ) x
      WHERE x.open_count > 0 OR x.devices_down > 0 OR x.heartbeat_state = 'down'
      ORDER BY (x.heartbeat_state = 'down') DESC, x.critical_count DESC,
               x.breached_count DESC, x.open_count DESC, x.devices_down DESC
      LIMIT 6`),

    pool.query(`SELECT e.category, COUNT(*) AS n FROM errors e
                 WHERE e.status <> 'resolved' GROUP BY e.category ORDER BY n DESC`),

    pool.query('SELECT COUNT(*) AS done FROM weekly_checkins WHERE week_number = ? AND term = ?', [week, term])
  ]);

  const total = num(schoolCount.n);

  res.json({
    type: 'admin',
    schools: {
      total,
      healthy: num(healthy.n),
      needing_attention: total - num(healthy.n),
      lrs_silent: num(silent.n),
      silent_after_minutes: DOWN_AFTER_MINUTES
    },
    faults: {
      open: num(faults.open_count),
      critical: num(faults.critical_open),
      breaching_now: num(faults.breaching_now),
      due_soon: num(faults.due_soon),
      unanswered: num(faults.unanswered),
      unanswered_oldest_hours: hoursOrNull(faults.unanswered_oldest_hours)
    },
    devices: {
      total: num(devices.total),
      out_of_service: num(devices.down),
      stockout_schools: num(stockouts.n)
    },
    resolution: {
      hours: hoursOrNull(resolution.hours),
      basis: num(resolution.basis),
      prev_hours: hoursOrNull(resolution.prev_hours),
      prev_basis: num(resolution.prev_basis),
      window_days: TREND_DAYS
    },
    priorities,
    schools_attention: attention.map(s => ({
      id: s.id,
      name: s.name,
      zone: s.zone,
      open_count: num(s.open_count),
      critical_count: num(s.critical_count),
      breached_count: num(s.breached_count),
      devices_down: num(s.devices_down),
      spares_available: num(s.spares_available),
      // Never negative: this is a packing list, not an accounting figure.
      spares_needed: Math.max(0, num(s.devices_down) - num(s.spares_available)),
      heartbeat_state: s.heartbeat_state,
      minutes_since_heartbeat: s.minutes_since_heartbeat == null ? null : num(s.minutes_since_heartbeat)
    })),
    category_breakdown: categories.map(c => ({ category: c.category, count: num(c.n) })),
    checkins: { done: num(checkins.done), total, current_week: week }
  });
}

/* ------------------------------------------------------------------ *
 * School administrator — can lessons run tomorrow, and what is mine
 * ------------------------------------------------------------------ */

async function schoolDashboard(req, res) {
  const schoolId = req.user.school_id;
  const { week, term } = currentWeek();

  if (!schoolId) {
    return res.json({ type: 'school', school: null, unlinked: true });
  }

  const [
    [[school]],
    [[devices]],
    [byForm],
    [[faults]],
    [openErrors],
    [[lrs]],
    [[checkin]],
    [[teachers]]
  ] = await Promise.all([
    pool.query('SELECT id, name, zone, students, tablets AS tablets_expected FROM schools WHERE id = ?', [schoolId]),

    pool.query(`
      SELECT COUNT(*) AS total,
             SUM(t.status = 'Working')                                       AS working,
             SUM(t.status = 'Faulty')                                        AS faulty,
             SUM(t.status = 'In Repair')                                     AS in_repair,
             SUM(CASE WHEN ${SPARE_T} THEN 1 ELSE 0 END) AS spares_available
        FROM tablets t WHERE t.school_id = ?`, [schoolId]),

    // Which class is short of devices — the question a head teacher asks, and
    // the one that decides where the working ones get moved to.
    pool.query(`
      SELECT COALESCE(NULLIF(t.form,''),'Unassigned') AS form,
             COUNT(*) AS total, SUM(${DEVICE_DOWN}) AS down
        FROM tablets t WHERE t.school_id = ?
       GROUP BY form HAVING down > 0 ORDER BY down DESC, form LIMIT 6`, [schoolId]),

    pool.query(`
      SELECT
        SUM(${AT_SCHOOL})                                                                AS waiting_on_me,
        ROUND(MAX(CASE WHEN ${AT_SCHOOL} THEN TIMESTAMPDIFF(MINUTE, e.created_at, NOW()) END) / 60, 1) AS waiting_oldest_hours,
        SUM(e.status <> 'resolved' AND NOT (e.escalation_level = 'school' AND e.assigned_to IS NULL)) AS with_engineer,
        SUM(e.status <> 'resolved' AND NOT (e.escalation_level = 'school' AND e.assigned_to IS NULL)
            AND e.sla_due_at IS NOT NULL AND e.sla_due_at < NOW())                       AS engineer_breached,
        SUM(e.status = 'resolved' AND e.resolved_at >= DATE_SUB(NOW(), INTERVAL 30 DAY))  AS resolved_30d,
        SUM(e.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY))                             AS reported_30d
      FROM errors e WHERE e.school_id = ?`, [schoolId]),

    pool.query(`
      SELECT e.id, e.error_code, e.title, e.priority, e.status, e.category, e.created_at,
             e.escalation_level, e.assigned_to, e.reporter_name,
             ROUND(TIMESTAMPDIFF(MINUTE, e.created_at, NOW()) / 60, 1) AS hours_open,
             CASE WHEN e.sla_due_at IS NOT NULL AND e.sla_due_at < NOW() THEN 1 ELSE 0 END AS sla_breached,
             u.full_name AS assignee_name
        FROM errors e LEFT JOIN users u ON u.id = e.assigned_to
       WHERE e.school_id = ? AND e.status <> 'resolved'
       ORDER BY (e.escalation_level = 'school' AND e.assigned_to IS NULL) DESC,
                FIELD(e.priority,'critical','high','medium','low'), e.created_at ASC
       LIMIT 8`, [schoolId]),

    pool.query(`SELECT d.ip_address, d.last_heartbeat, ${heartbeatStateSelect('d')}
                  FROM lrs_devices d WHERE d.school_id = ?`, [schoolId]),

    pool.query('SELECT id, status, checked_by FROM weekly_checkins WHERE school_id = ? AND week_number = ? AND term = ?',
      [schoolId, week, term]),

    pool.query(`SELECT COUNT(*) AS active FROM teachers WHERE school_id = ? AND status = 'active'`, [schoolId])
  ]);

  const checks = await maintenance.dueFor(schoolId);

  res.json({
    type: 'school',
    school: school || null,
    devices: {
      total: num(devices.total),
      working: num(devices.working),
      faulty: num(devices.faulty),
      in_repair: num(devices.in_repair),
      out_of_service: num(devices.faulty) + num(devices.in_repair),
      spares_available: num(devices.spares_available)
    },
    by_form: byForm.map(f => ({ form: f.form, total: num(f.total), down: num(f.down) })),
    faults: {
      waiting_on_me: num(faults.waiting_on_me),
      waiting_oldest_hours: hoursOrNull(faults.waiting_oldest_hours),
      with_engineer: num(faults.with_engineer),
      engineer_breached: num(faults.engineer_breached),
      resolved_30d: num(faults.resolved_30d),
      reported_30d: num(faults.reported_30d)
    },
    open_errors: openErrors,
    // No LRS row at all is "not monitored", which is a different fact from
    // "down" and must not be shown as a failure.
    lrs: lrs
      ? { state: lrs.heartbeat_state, minutes_since: lrs.minutes_since_heartbeat, ip: lrs.ip_address,
          down_after_minutes: DOWN_AFTER_MINUTES }
      : { state: 'none', minutes_since: null, ip: null, down_after_minutes: DOWN_AFTER_MINUTES },
    maintenance: {
      total: checks.length,
      due: checks.filter(c => c.due).length,
      overdue: checks.filter(c => c.overdue).length,
      next: checks.filter(c => c.due).slice(0, 4).map(c => ({
        name: c.name, never_done: c.never_done, last_done: c.last_done, overdue: c.overdue
      }))
    },
    checkin: { done: !!checkin, status: checkin ? checkin.status : null, current_week: week },
    teachers: { active: num(teachers.active) }
  });
}

/* ------------------------------------------------------------------ *
 * Teacher — is my report moving, and what do I do while I wait
 * ------------------------------------------------------------------ */

async function teacherDashboard(req, res) {
  const userId = req.user.id;
  const schoolId = req.user.school_id;

  const [
    [[mine]],
    [recent],
    [[school]]
  ] = await Promise.all([
    pool.query(`
      SELECT
        SUM(status <> 'resolved')                                                    AS open_count,
        ROUND(MAX(CASE WHEN status <> 'resolved' THEN TIMESTAMPDIFF(MINUTE, created_at, NOW()) END) / 60, 1) AS oldest_open_hours,
        -- Someone has picked it up, so the teacher knows it is not lost.
        SUM(status <> 'resolved' AND first_response_at IS NOT NULL)                   AS answered_open,
        SUM(status = 'resolved' AND resolved_at >= DATE_SUB(NOW(), INTERVAL 30 DAY))  AS resolved_30d,
        -- The only quality signal the system has comes from this number
        -- falling: a resolution nobody confirmed is a resolution nobody checked.
        SUM(status = 'resolved' AND csat_rating IS NULL)                              AS awaiting_rating
      FROM errors WHERE reported_by_user_id = ?`, [userId]),

    pool.query(`
      SELECT id, error_code, title, priority, status, category, created_at, csat_rating,
             first_response_at, resolved_at,
             ROUND(TIMESTAMPDIFF(MINUTE, created_at, COALESCE(resolved_at, NOW())) / 60, 1) AS hours_open
        FROM errors WHERE reported_by_user_id = ?
       ORDER BY (status <> 'resolved') DESC, created_at DESC LIMIT 6`, [userId]),

    pool.query('SELECT name, zone FROM schools WHERE id = ?', [schoolId])
  ]);

  // "While you wait" — guides for the fault they actually have open. With no
  // open fault there is nothing to suggest, and an unmatched guide panel
  // teaches people to ignore the panel.
  const waiting = recent.find(r => r.status !== 'resolved');
  const guides = waiting
    ? await knowledge.suggest({ category: waiting.category, text: waiting.title, limit: 3 })
    : [];

  res.json({
    type: 'teacher',
    school: school || null,
    my: {
      open: num(mine.open_count),
      oldest_open_hours: hoursOrNull(mine.oldest_open_hours),
      answered_open: num(mine.answered_open),
      resolved_30d: num(mine.resolved_30d),
      awaiting_rating: num(mine.awaiting_rating)
    },
    recent_errors: recent,
    waiting_on: waiting ? { id: waiting.id, title: waiting.title, category: waiting.category } : null,
    suggested_guides: guides
  });
}

/* ------------------------------------------------------------------ *
 * Field engineer — my queue, and what I cannot fix without loading the van
 * ------------------------------------------------------------------ */

async function subadminDashboard(req, res) {
  const userId = req.user.id;
  const { week, term } = currentWeek();

  const [
    [queue],
    [[stats]],
    [schools],
    [stale],
    [visits],
    [[checkins]]
  ] = await Promise.all([
    pool.query(`
      SELECT e.id, e.error_code, e.title, e.priority, e.status, e.created_at, e.sla_due_at,
             ROUND(TIMESTAMPDIFF(MINUTE, e.created_at, NOW()) / 60, 1) AS hours_open,
             CASE WHEN e.sla_due_at IS NOT NULL AND e.sla_due_at < NOW() THEN 1 ELSE 0 END AS sla_breached,
             TIMESTAMPDIFF(MINUTE, NOW(), e.sla_due_at) AS sla_minutes_left,
             s.name AS school_name
        FROM errors e JOIN schools s ON s.id = e.school_id
       WHERE e.assigned_to = ? AND e.status <> 'resolved'
       ORDER BY sla_breached DESC, FIELD(e.priority,'critical','high','medium','low'), e.sla_due_at ASC`, [userId]),

    // SLA is windowed to 30 days. A lifetime figure barely moves, so it can
    // never tell anybody whether this month went well or badly.
    pool.query(`
      SELECT
        SUM(e.status <> 'resolved')                                                        AS queue_count,
        SUM(e.status <> 'resolved' AND e.sla_due_at IS NOT NULL
            AND e.sla_due_at > NOW() AND e.sla_due_at < DATE_ADD(NOW(), INTERVAL 2 HOUR))  AS due_soon,
        SUM(e.status <> 'resolved' AND e.sla_due_at IS NOT NULL AND e.sla_due_at < NOW())  AS overdue,
        SUM(e.status = 'resolved' AND e.resolved_at >= DATE_SUB(NOW(), INTERVAL 7 DAY))    AS resolved_week,
        SUM(e.status = 'resolved' AND e.resolved_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            AND e.resolved_at IS NOT NULL AND e.sla_due_at IS NOT NULL)                    AS sla_basis_30d,
        SUM(e.status = 'resolved' AND e.resolved_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            AND e.resolved_at IS NOT NULL AND e.sla_due_at IS NOT NULL
            AND e.resolved_at <= e.sla_due_at)                                             AS sla_on_time_30d
      FROM errors e WHERE e.assigned_to = ?`, [userId, userId]),

    // Each school with the three things that decide whether a trip there is
    // worth making: what is broken, whether the LRS is alive, and whether
    // there is anything on site to swap in.
    pool.query(`
      SELECT s.id, s.name, s.zone,
        (SELECT COUNT(*) FROM errors e WHERE e.school_id = s.id AND e.status <> 'resolved') AS open_errors,
        (SELECT COUNT(*) FROM errors e WHERE e.school_id = s.id AND e.status <> 'resolved'
           AND e.priority IN ('critical','high')) AS critical_errors,
        (SELECT COUNT(*) FROM tablets t WHERE t.school_id = s.id AND ${DEVICE_DOWN}) AS devices_down,
        (SELECT COUNT(*) FROM tablets t WHERE t.school_id = s.id
           AND ${SPARE_T}) AS spares_available,
        ${heartbeatStateSelect('d')}
      FROM schools s LEFT JOIN lrs_devices d ON d.school_id = s.id
      WHERE s.assigned_admin_id = ?
      ORDER BY (heartbeat_state = 'down') DESC, critical_errors DESC, open_errors DESC, s.name`, [userId]),

    // Replaces the activity feed. A list of recent notes says work happened;
    // this says where work stopped, which is the only one of the two that
    // changes what the engineer does next.
    pool.query(`
      SELECT * FROM (
        SELECT e.id, e.error_code, e.title, e.priority, s.name AS school_name,
               ROUND(TIMESTAMPDIFF(MINUTE,
                 GREATEST(e.created_at, COALESCE((SELECT MAX(u.created_at) FROM error_updates u WHERE u.error_id = e.id), e.created_at)),
                 NOW()) / 60, 1) AS stale_hours
          FROM errors e JOIN schools s ON s.id = e.school_id
         WHERE e.assigned_to = ? AND e.status <> 'resolved'
      ) x WHERE x.stale_hours >= ${STALE_HOURS}
      ORDER BY x.stale_hours DESC LIMIT 5`, [userId]),

    pool.query(`
      SELECT v.id, v.planned_for, v.status, s.name AS school_name,
             (SELECT COUNT(*) FROM errors e WHERE e.visit_id = v.id AND e.status <> 'resolved') AS open_faults
        FROM visits v JOIN schools s ON s.id = v.school_id
       WHERE v.engineer_id = ? AND v.status = 'planned' AND v.planned_for >= CURDATE()
       ORDER BY v.planned_for LIMIT 4`, [userId]),

    pool.query(`SELECT COUNT(*) AS done FROM weekly_checkins wc JOIN schools s ON s.id = wc.school_id
                 WHERE wc.week_number = ? AND wc.term = ? AND s.assigned_admin_id = ?`, [week, term, userId])
  ]);

  const shaped = schools.map(s => ({
    id: s.id, name: s.name, zone: s.zone,
    open_errors: num(s.open_errors),
    critical_errors: num(s.critical_errors),
    devices_down: num(s.devices_down),
    spares_available: num(s.spares_available),
    spares_needed: Math.max(0, num(s.devices_down) - num(s.spares_available)),
    heartbeat_state: s.heartbeat_state,
    minutes_since_heartbeat: s.minutes_since_heartbeat == null ? null : num(s.minutes_since_heartbeat)
  }));

  res.json({
    type: 'subadmin',
    my_queue: queue,
    stats: {
      queue_count: num(stats.queue_count),
      due_soon: num(stats.due_soon),
      overdue: num(stats.overdue),
      resolved_week: num(stats.resolved_week),
      sla_basis_30d: num(stats.sla_basis_30d),
      sla_on_time_30d: num(stats.sla_on_time_30d)
    },
    my_schools: shaped,
    spares: {
      // What to load before leaving, and the two different kinds of shortage:
      // a school that is short of spares can still swap something today; a
      // school with none at all cannot be helped without the vehicle.
      to_carry: shaped.reduce((t, s) => t + s.spares_needed, 0),
      short_schools: shaped.filter(s => s.spares_needed > 0).length,
      stockout_schools: shaped.filter(s => s.devices_down > 0 && s.spares_available === 0).length
    },
    stale: stale.map(s => ({ ...s, stale_hours: hoursOrNull(s.stale_hours) })),
    stale_after_hours: STALE_HOURS,
    visits: visits.map(v => ({ ...v, open_faults: num(v.open_faults) })),
    checkins: { done: num(checkins.done), total: shaped.length, current_week: week }
  });
}

module.exports = { getDashboard };
