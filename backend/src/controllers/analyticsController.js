/**
 * Trend metrics. Design: docs/features/06-trend-metrics.md
 *
 * Analytics was a snapshot: total errors, SLA compliance, check-in rate, errors
 * by school and by category — every one of them "right now". Nothing answered
 * *is this getting better or worse*, which is the only question a term review
 * asks. A number without a direction is not a decision.
 *
 * Honesty rules, carried over from the SLA fix (that card once read −200%):
 *  - a metric with nothing measurable returns null, never 0 or 100;
 *  - rows that cannot be judged are excluded from the denominator AND counted
 *    separately, so the gap is visible rather than hidden;
 *  - every metric is named for what it actually measures.
 */
const pool = require('../config/database');

/** How many ISO weeks of history to return. One school term, roughly. */
const WEEKS = 13;

/**
 * ISO week, Monday-based — mode 3, the same mode the 52-week check-in selector
 * uses, so "week 37" means the same thing on every page.
 */
const ISO_WEEK = 'YEARWEEK(%s, 3)';

/** Role scoping. Sub-admins see their own schools; everyone else, all. */
function scope(user, schoolId) {
  const parts = [];
  const params = [];
  if (user.role === 'subadmin') {
    parts.push('e.school_id IN (SELECT id FROM schools WHERE assigned_admin_id = ?)');
    params.push(user.id);
  } else if (user.role !== 'admin') {
    parts.push('e.school_id = ?');
    params.push(user.school_id);
  }
  // Optional narrowing to one school — per-school trends, and what lets the
  // verification suite measure exact figures without touching other rows.
  if (schoolId) { parts.push('e.school_id = ?'); params.push(Number(schoolId)); }
  return { clause: parts.length ? parts.join(' AND ') : '1=1', params };
}

/**
 * GET /api/analytics/trends
 *
 * Weekly buckets for the last 13 ISO weeks, plus the same measures split by
 * engineer and by school. Computed in SQL: pulling every row into Node to
 * bucket it would move megabytes to save a GROUP BY.
 */
async function trends(req, res, next) {
  try {
    const schoolId = req.query.school_id ? Number(req.query.school_id) : null;
    const { clause, params } = scope(req.user, schoolId);
    const since = `DATE_SUB(CURDATE(), INTERVAL ${WEEKS} WEEK)`;

    // --- weekly buckets, keyed on when the fault was REPORTED -------------
    // Bucketing resolutions by resolution date would let a slow week look good
    // simply because nothing was closed in it.
    const [weekly] = await pool.query(
      `SELECT ${ISO_WEEK.replace('%s', 'e.created_at')} AS yearweek,
              WEEK(e.created_at, 3) AS week_number,
              MIN(DATE(e.created_at)) AS week_start,
              COUNT(*) AS reported,
              SUM(e.status = 'resolved') AS resolved,

              -- Mean time to resolve, in hours, over the faults that were
              -- actually resolved. NULL when none were.
              ROUND(AVG(CASE WHEN e.status = 'resolved' AND e.resolved_at IS NOT NULL
                        THEN TIMESTAMPDIFF(MINUTE, e.created_at, e.resolved_at) / 60 END), 1) AS mttr_hours,
              SUM(e.status = 'resolved' AND e.resolved_at IS NOT NULL) AS mttr_basis,

              -- Time to first response: the part the team actually controls.
              ROUND(AVG(CASE WHEN e.first_response_at IS NOT NULL
                        THEN TIMESTAMPDIFF(MINUTE, e.created_at, e.first_response_at) / 60 END), 1) AS ttfr_hours,
              SUM(e.first_response_at IS NOT NULL) AS ttfr_basis,

              -- SLA compliance, same definition as the dashboard card: judged
              -- only where a resolution and a due time both exist.
              SUM(e.status = 'resolved' AND e.resolved_at IS NOT NULL AND e.sla_due_at IS NOT NULL) AS sla_measurable,
              SUM(e.status = 'resolved' AND e.resolved_at IS NOT NULL AND e.sla_due_at IS NOT NULL
                  AND e.resolved_at <= e.sla_due_at) AS sla_on_time,
              SUM(e.status = 'resolved' AND (e.resolved_at IS NULL OR e.sla_due_at IS NULL)) AS sla_unmeasurable,

              -- Named for what it measures. "First-contact resolution" would
              -- claim to count contacts, which nothing here records.
              SUM(e.status = 'resolved' AND e.escalated_at IS NULL) AS resolved_without_escalation,
              SUM(e.escalated_at IS NOT NULL) AS escalated
       FROM errors e
       WHERE ${clause} AND e.created_at >= ${since}
       GROUP BY yearweek, week_number
       ORDER BY yearweek`,
      params
    );

    // --- per engineer: load beside outcome, never a scoreboard -----------
    const [engineers] = await pool.query(
      `SELECT u.id, u.full_name, u.zone,
              COUNT(e.id) AS assigned,
              SUM(e.status <> 'resolved') AS still_open,
              SUM(e.status = 'resolved') AS resolved,
              ROUND(AVG(CASE WHEN e.status = 'resolved' AND e.resolved_at IS NOT NULL
                        THEN TIMESTAMPDIFF(MINUTE, e.created_at, e.resolved_at) / 60 END), 1) AS mttr_hours,
              SUM(e.status = 'resolved' AND e.resolved_at IS NOT NULL AND e.sla_due_at IS NOT NULL) AS sla_measurable,
              SUM(e.status = 'resolved' AND e.resolved_at IS NOT NULL AND e.sla_due_at IS NOT NULL
                  AND e.resolved_at <= e.sla_due_at) AS sla_on_time,
              (SELECT COUNT(*) FROM schools s WHERE s.assigned_admin_id = u.id) AS schools_covered
       FROM users u
       LEFT JOIN errors e ON e.assigned_to = u.id AND e.created_at >= ${since}
       WHERE u.role IN ('admin','subadmin')
       GROUP BY u.id
       HAVING assigned > 0 OR schools_covered > 0
       ORDER BY assigned DESC, u.full_name`
    );

    // --- per school -------------------------------------------------------
    const [schools] = await pool.query(
      `SELECT s.id, s.name, s.zone,
              COUNT(e.id) AS reported,
              SUM(e.status <> 'resolved') AS still_open,
              ROUND(AVG(CASE WHEN e.status = 'resolved' AND e.resolved_at IS NOT NULL
                        THEN TIMESTAMPDIFF(MINUTE, e.created_at, e.resolved_at) / 60 END), 1) AS mttr_hours,
              SUM(e.escalated_at IS NOT NULL) AS escalated
       FROM schools s
       LEFT JOIN errors e ON e.school_id = s.id AND e.created_at >= ${since}
       ${schoolWhere(req.user, schoolId)}
       GROUP BY s.id
       HAVING reported > 0
       ORDER BY reported DESC, s.name`,
      schoolWhereParams(req.user, schoolId)
    );

    // --- how the channels are used ---------------------------------------
    const [channels] = await pool.query(
      `SELECT COALESCE(e.intake_channel, 'unrecorded') AS channel, COUNT(*) AS n
       FROM errors e WHERE ${clause} AND e.created_at >= ${since}
       GROUP BY channel ORDER BY n DESC`,
      params
    );

    const deflection = await aiDeflection(req.user, WEEKS);

    res.json({
      weeks: WEEKS,
      weekly: weekly.map(shapeWeek),
      totals: totalsFrom(weekly),
      engineers: engineers.map(e => ({
        id: e.id,
        full_name: e.full_name,
        zone: e.zone,
        schools_covered: Number(e.schools_covered),
        assigned: Number(e.assigned),
        still_open: Number(e.still_open || 0),
        resolved: Number(e.resolved || 0),
        mttr_hours: e.mttr_hours == null ? null : Number(e.mttr_hours),
        sla_pct: pct(e.sla_on_time, e.sla_measurable)
      })),
      schools: schools.map(s => ({
        id: s.id,
        name: s.name,
        zone: s.zone,
        reported: Number(s.reported),
        still_open: Number(s.still_open || 0),
        mttr_hours: s.mttr_hours == null ? null : Number(s.mttr_hours),
        escalated: Number(s.escalated || 0)
      })),
      channels: channels.map(c => ({ channel: c.channel, count: Number(c.n) })),
      ai_deflection: deflection
    });
  } catch (err) { next(err); }
}

/** WHERE clause for the per-school breakdown, honouring role and filter. */
function schoolWhere(user, schoolId) {
  const parts = [];
  if (user.role === 'subadmin') parts.push('s.assigned_admin_id = ?');
  if (schoolId) parts.push('s.id = ?');
  return parts.length ? 'WHERE ' + parts.join(' AND ') : '';
}
function schoolWhereParams(user, schoolId) {
  const params = [];
  if (user.role === 'subadmin') params.push(user.id);
  if (schoolId) params.push(Number(schoolId));
  return params;
}

/** One weekly bucket, with every ratio clamped and nulled where unmeasurable. */
function shapeWeek(w) {
  return {
    yearweek: Number(w.yearweek),
    week_number: Number(w.week_number),
    week_start: w.week_start,
    reported: Number(w.reported),
    resolved: Number(w.resolved || 0),
    mttr_hours: w.mttr_hours == null ? null : Number(w.mttr_hours),
    mttr_basis: Number(w.mttr_basis || 0),
    ttfr_hours: w.ttfr_hours == null ? null : Number(w.ttfr_hours),
    ttfr_basis: Number(w.ttfr_basis || 0),
    sla_pct: pct(w.sla_on_time, w.sla_measurable),
    sla_measurable: Number(w.sla_measurable || 0),
    sla_unmeasurable: Number(w.sla_unmeasurable || 0),
    no_escalation_pct: pct(w.resolved_without_escalation, w.resolved),
    escalation_pct: pct(w.escalated, w.reported),
    escalated: Number(w.escalated || 0)
  };
}

/**
 * A percentage, or null when there is nothing to divide by. Clamped to 0..100:
 * this page once displayed −200%.
 */
function pct(numerator, denominator) {
  const d = Number(denominator);
  if (!Number.isFinite(d) || d <= 0) return null;
  const n = Number(numerator) || 0;
  return Math.max(0, Math.min(100, Math.round((n / d) * 100)));
}

/**
 * Last week against the average of the four before it — the comparison the
 * Monday digest is built on. Direction only, never a forecast.
 */
function totalsFrom(weekly) {
  const rows = weekly.map(shapeWeek);
  const last = rows[rows.length - 1] || null;
  const prior = rows.slice(-5, -1);

  const avg = key => {
    const vals = prior.map(r => r[key]).filter(v => v != null);
    if (!vals.length) return null;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  };

  const move = key => {
    if (!last || last[key] == null) return null;
    const base = avg(key);
    if (base == null) return null;
    return Math.round((last[key] - base) * 10) / 10;
  };

  return {
    reported_total: rows.reduce((s, r) => s + r.reported, 0),
    resolved_total: rows.reduce((s, r) => s + r.resolved, 0),
    last_week: last,
    four_week_average: {
      mttr_hours: avg('mttr_hours'),
      ttfr_hours: avg('ttfr_hours'),
      sla_pct: avg('sla_pct'),
      escalation_pct: avg('escalation_pct')
    },
    // Positive means the number went up. Whether up is good depends on the
    // metric, so the UI decides the colour, not this.
    change: {
      mttr_hours: move('mttr_hours'),
      ttfr_hours: move('ttfr_hours'),
      sla_pct: move('sla_pct'),
      escalation_pct: move('escalation_pct')
    }
  };
}

/**
 * The share of chats that did NOT lead to a fault being filed.
 *
 * Null, not 0%, when nobody used the assistant: a 0% deflection rate reads as
 * "the assistant helps nobody" when in fact nobody asked it anything. Clamped,
 * for the same reason every other ratio here is.
 */
function deflectionRate(chats, filed) {
  if (!Number.isFinite(chats) || chats <= 0) return null;
  const deflected = Math.max(0, chats - Math.max(0, Number(filed) || 0));
  return Math.max(0, Math.min(100, Math.round((deflected / chats) * 100)));
}

/**
 * How much the assistant is absorbing: chats after which the same person did
 * NOT file a fault within the hour. Nothing measured this before, and it is the
 * number that justifies the assistant's cost.
 *
 * An hour is the window: long enough that a genuine follow-up report is caught,
 * short enough that an unrelated fault two days later is not counted as a
 * failure to deflect.
 */
async function aiDeflection(user, weeks) {
  try {
    const since = `DATE_SUB(CURDATE(), INTERVAL ${weeks} WEEK)`;
    const [[row]] = await pool.query(
      `SELECT COUNT(*) AS chats,
              SUM(EXISTS (
                SELECT 1 FROM errors e
                WHERE e.reported_by_user_id = c.user_id
                  AND e.created_at BETWEEN c.updated_at AND DATE_ADD(c.updated_at, INTERVAL 1 HOUR)
              )) AS followed_by_a_report
       FROM ai_chats c
       WHERE c.updated_at >= ${since}
         ${user.role === 'admin' ? '' : 'AND c.user_id = ' + Number(user.id)}`
    );
    const chats = Number(row.chats);
    const filed = Number(row.followed_by_a_report || 0);
    return {
      chats,
      followed_by_a_report: filed,
      deflected_pct: deflectionRate(chats, filed),
      window: '1 hour'
    };
  } catch (err) {
    console.error('[analytics] deflection failed:', err.message);
    return { chats: 0, followed_by_a_report: 0, deflected_pct: null, error: err.message };
  }
}

module.exports = { trends, _internal: { pct, deflectionRate, totalsFrom, WEEKS } };
