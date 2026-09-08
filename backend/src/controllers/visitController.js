/**
 * Visit planner. Design: docs/features/05-visit-planner.md
 *
 * Field service is organised around trips, not tickets. A sub-admin covering
 * six schools in Kilimanjaro terrain sees a queue ordered by priority and age —
 * a list of faults with no notion of journeys. Nothing tells them "while you
 * are at Marangu, these four other things are open there", which is the
 * difference between a productive day and a day spent driving.
 *
 * Deliberately not a route optimiser: no map API, no distance matrix, no travel
 * estimates. The zones are already on schools.zone and four engineers know the
 * roads far better than any API would. What was missing is batching and a
 * record.
 */
const pool = require('../config/database');
const lc = require('../config/lifecycle');
const { DOWN_AFTER_MINUTES } = require('../config/monitoring');
const { logAudit } = require('../services/audit');

const OPEN = "status <> 'resolved'";

/** Schools this user may plan visits to. Admin: all. Sub-admin: their own. */
function schoolScope(user) {
  if (user.role === 'admin') return { clause: '1=1', params: [] };
  return { clause: 's.assigned_admin_id = ?', params: [user.id] };
}

async function canVisitSchool(user, schoolId) {
  if (user.role === 'admin') return true;
  const [rows] = await pool.query(
    'SELECT id FROM schools WHERE id = ? AND assigned_admin_id = ?', [schoolId, user.id]);
  return rows.length > 0;
}

/**
 * GET /api/visits/queue
 *
 * The queue grouped by school rather than by ticket — sorted by what would be
 * gained by going, not by which single fault is oldest. That reordering is the
 * whole feature: it is what turns six drives into two.
 */
async function queue(req, res, next) {
  try {
    const { clause, params } = schoolScope(req.user);

    const [rows] = await pool.query(
      `SELECT s.id AS school_id, s.name AS school_name, s.zone, s.contact_name, s.contact_phone,
              u.full_name AS engineer_name,
              COUNT(e.id) AS open_faults,
              SUM(e.priority = 'critical') AS critical,
              SUM(e.priority = 'high') AS high,
              SUM(e.sla_due_at IS NOT NULL AND e.sla_due_at < NOW()) AS breached,
              SUM(e.sla_due_at IS NOT NULL AND e.sla_due_at >= NOW()
                  AND e.sla_due_at < DATE_ADD(NOW(), INTERVAL 24 HOUR)) AS due_today,
              MIN(e.created_at) AS oldest_at,
              ROUND(TIMESTAMPDIFF(MINUTE, MIN(e.created_at), NOW()) / 60, 1) AS oldest_hours,
              (SELECT v.id FROM visits v
                 WHERE v.school_id = s.id AND v.status = 'planned'
                 ORDER BY v.planned_for LIMIT 1) AS planned_visit_id,
              (SELECT v.planned_for FROM visits v
                 WHERE v.school_id = s.id AND v.status = 'planned'
                 ORDER BY v.planned_for LIMIT 1) AS planned_for
       FROM schools s
       LEFT JOIN errors e ON e.school_id = s.id AND e.${OPEN}
       LEFT JOIN users u ON s.assigned_admin_id = u.id
       WHERE ${clause}
       GROUP BY s.id
       ORDER BY SUM(e.priority = 'critical') DESC,
                SUM(e.sla_due_at IS NOT NULL AND e.sla_due_at < NOW()) DESC,
                COUNT(e.id) DESC,
                s.name`,
      params
    );

    res.json(rows.map(r => ({
      school_id: r.school_id,
      school_name: r.school_name,
      zone: r.zone,
      contact_name: r.contact_name,
      contact_phone: r.contact_phone,
      engineer_name: r.engineer_name,
      open_faults: Number(r.open_faults),
      critical: Number(r.critical || 0),
      high: Number(r.high || 0),
      breached: Number(r.breached || 0),
      due_today: Number(r.due_today || 0),
      oldest_at: r.oldest_at,
      oldest_hours: r.oldest_hours == null ? null : Number(r.oldest_hours),
      planned_visit_id: r.planned_visit_id,
      planned_for: r.planned_for
    })));
  } catch (err) { next(err); }
}

/**
 * GET /api/visits/suggestions/:schoolId
 *
 * Everything worth doing while standing at this school — not just the open
 * faults. This is where the features compound: the due weekly check-in
 * (feature: checkins), repeat-offender tablets (feature 4) and an LRS that has
 * stopped reporting (feature 1) are all things you can only fix on site.
 */
async function suggestions(req, res, next) {
  try {
    const schoolId = Number(req.params.schoolId);
    if (!await canVisitSchool(req.user, schoolId)) {
      return res.status(403).json({ error: 'Not one of your schools.' });
    }

    const [[school]] = await pool.query(
      'SELECT id, name, zone, contact_name, contact_phone, lrs_ip FROM schools WHERE id = ?', [schoolId]);
    if (!school) return res.status(404).json({ error: 'School not found.' });

    const [faults] = await pool.query(
      `SELECT id, error_code, title, category, priority, status, created_at, sla_due_at, visit_id,
              CASE WHEN sla_due_at IS NOT NULL AND sla_due_at < NOW() THEN 1 ELSE 0 END AS breached
       FROM errors WHERE school_id = ? AND ${OPEN}
       ORDER BY FIELD(priority, 'critical','high','medium','low'), created_at`,
      [schoolId]
    );

    // The ISO week the check-in list uses, so "due" here means the same thing
    // it means on the Weekly Check-Ins page.
    const [[week]] = await pool.query('SELECT YEARWEEK(CURDATE(), 3) AS yw, WEEK(CURDATE(), 3) AS wk');
    const [checkin] = await pool.query(
      'SELECT id FROM weekly_checkins WHERE school_id = ? AND YEARWEEK(COALESCE(checkin_date, created_at), 3) = ?',
      [schoolId, week.yw]
    );

    const [tablets] = await pool.query(
      `SELECT t.id, t.asset_tag, t.serial_number, t.status, t.batch_ref,
              ${lc.lifecycleSelect('t')}
       FROM tablets t
       WHERE t.school_id = ? AND (${lc.repeatOffenderExpr('t')} OR t.status IN ('Faulty','In Repair'))
       ORDER BY t.asset_tag, t.serial_number`,
      [schoolId]
    );

    const [lrs] = await pool.query(
      `SELECT id, hostname, ip_address, last_heartbeat,
              TIMESTAMPDIFF(MINUTE, last_heartbeat, NOW()) AS silent_minutes
       FROM lrs_devices WHERE school_id = ?`, [schoolId]
    );
    const lrsRow = lrs[0] || null;
    const lrsSilent = !!(lrsRow && lrsRow.last_heartbeat
      && Number(lrsRow.silent_minutes) > DOWN_AFTER_MINUTES);

    res.json({
      school,
      faults: faults.map(f => ({ ...f, breached: !!Number(f.breached) })),
      checkin_due: checkin.length === 0,
      week_number: Number(week.wk),
      devices: tablets.map(t => ({
        id: t.id, asset_tag: t.asset_tag, serial_number: t.serial_number, status: t.status,
        batch_ref: t.batch_ref, fault_count: Number(t.fault_count),
        warranty_state: t.warranty_state, verdict: lc.verdict(t),
        repeat_offender: lc.isRepeatOffender(t)
      })),
      lrs: lrsRow ? {
        hostname: lrsRow.hostname, ip_address: lrsRow.ip_address,
        last_heartbeat: lrsRow.last_heartbeat,
        silent_minutes: lrsRow.silent_minutes == null ? null : Number(lrsRow.silent_minutes),
        silent: lrsSilent,
        // Never reported at all is 'unknown', not down — the same rule the
        // heartbeat sweep follows, so the two never disagree.
        state: !lrsRow.last_heartbeat ? 'unknown' : lrsSilent ? 'down' : 'up'
      } : null
    });
  } catch (err) { next(err); }
}

/** GET /api/visits — the engineer's own plan, newest first. */
async function list(req, res, next) {
  try {
    const conditions = [];
    const params = [];
    if (req.user.role !== 'admin') { conditions.push('v.engineer_id = ?'); params.push(req.user.id); }
    if (req.query.status) { conditions.push('v.status = ?'); params.push(req.query.status); }
    if (req.query.school_id) { conditions.push('v.school_id = ?'); params.push(req.query.school_id); }

    const [rows] = await pool.query(
      `SELECT v.*, s.name AS school_name, s.zone, u.full_name AS engineer_name,
              (SELECT COUNT(*) FROM errors e WHERE e.visit_id = v.id) AS attached_faults,
              (SELECT COUNT(*) FROM errors e WHERE e.visit_id = v.id AND e.status = 'resolved') AS closed_faults
       FROM visits v
       JOIN schools s ON v.school_id = s.id
       LEFT JOIN users u ON v.engineer_id = u.id
       ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
       ORDER BY v.status = 'planned' DESC, v.planned_for DESC, v.id DESC`,
      params
    );
    res.json(rows.map(r => ({
      ...r,
      attached_faults: Number(r.attached_faults),
      closed_faults: Number(r.closed_faults)
    })));
  } catch (err) { next(err); }
}

/**
 * POST /api/visits
 *
 * Planning a visit attaches the school's open faults to it. It does not change
 * their status: a plan is not work done, and a ticket that looks touched when
 * nobody has been there is worse than no plan at all.
 */
async function create(req, res, next) {
  try {
    const { school_id, planned_for, notes, error_ids } = req.body || {};
    if (!school_id || !planned_for) {
      return res.status(400).json({ error: 'school_id and planned_for are required.' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(planned_for))) {
      return res.status(400).json({ error: 'planned_for must be a date (YYYY-MM-DD).' });
    }
    if (!await canVisitSchool(req.user, school_id)) {
      return res.status(403).json({ error: 'Not one of your schools.' });
    }

    // One planned visit per school at a time: two open plans for the same place
    // means two people drive there.
    const [existing] = await pool.query(
      "SELECT id, planned_for FROM visits WHERE school_id = ? AND status = 'planned' LIMIT 1", [school_id]);
    if (existing.length) {
      return res.status(409).json({
        error: 'A visit is already planned for this school.',
        visit_id: existing[0].id,
        planned_for: existing[0].planned_for
      });
    }

    const [result] = await pool.query(
      'INSERT INTO visits (school_id, engineer_id, planned_for, notes) VALUES (?, ?, ?, ?)',
      [school_id, req.user.id, planned_for, notes || null]
    );
    const visitId = result.insertId;

    // Attach either the faults named, or every open fault at that school.
    const attach = Array.isArray(error_ids) && error_ids.length
      ? await pool.query(
          `UPDATE errors SET visit_id = ? WHERE school_id = ? AND ${OPEN} AND id IN (?)`,
          [visitId, school_id, error_ids])
      : await pool.query(
          `UPDATE errors SET visit_id = ? WHERE school_id = ? AND ${OPEN} AND visit_id IS NULL`,
          [visitId, school_id]);

    const [[s]] = await pool.query('SELECT name FROM schools WHERE id = ?', [school_id]);
    await logAudit({
      actor: req.user, ip: req.ip, action: 'visit.planned', entityType: 'visit', entityId: visitId,
      summary: `Visit to ${s.name} planned for ${planned_for}`,
      meta: { school_id, attached: attach[0].affectedRows }
    }).catch(err => console.error('[visits] audit failed:', err.message));

    res.status(201).json({ id: visitId, attached_faults: attach[0].affectedRows });
  } catch (err) { next(err); }
}

/**
 * PATCH /api/visits/:id
 *
 * Start, complete or cancel. Cancelling releases the faults back to the plain
 * queue — a cancelled trip must not leave work invisible because it is filed
 * under a journey nobody made.
 */
async function update(req, res, next) {
  try {
    const { status, notes, planned_for } = req.body || {};
    const [rows] = await pool.query('SELECT * FROM visits WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Visit not found.' });
    const visit = rows[0];

    if (req.user.role !== 'admin' && visit.engineer_id !== req.user.id) {
      return res.status(403).json({ error: 'Not your visit.' });
    }
    if (status && !['planned', 'done', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'status must be planned, done or cancelled.' });
    }

    const sets = [];
    const params = [];
    if (status) {
      sets.push('status = ?'); params.push(status);
      if (status === 'done') sets.push('completed_at = NOW()');
      if (status === 'planned' && !visit.started_at) sets.push('started_at = NULL');
    }
    if (notes !== undefined) { sets.push('notes = ?'); params.push(notes || null); }
    if (planned_for) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(planned_for))) {
        return res.status(400).json({ error: 'planned_for must be a date (YYYY-MM-DD).' });
      }
      sets.push('planned_for = ?'); params.push(planned_for);
    }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update.' });

    params.push(req.params.id);
    await pool.query(`UPDATE visits SET ${sets.join(', ')} WHERE id = ?`, params);

    let released = 0;
    if (status === 'cancelled') {
      const [r] = await pool.query(
        `UPDATE errors SET visit_id = NULL WHERE visit_id = ? AND ${OPEN}`, [req.params.id]);
      released = r.affectedRows;
    }

    await logAudit({
      actor: req.user, ip: req.ip, action: 'visit.' + (status || 'updated'),
      entityType: 'visit', entityId: req.params.id,
      summary: `Visit ${req.params.id}: ${status || 'updated'}${released ? ` (${released} fault(s) released)` : ''}`,
      meta: { status, released }
    }).catch(err => console.error('[visits] audit failed:', err.message));

    res.json({ message: 'Visit updated', released_faults: released });
  } catch (err) { next(err); }
}

/** GET /api/visits/:id — the checklist the engineer works from on site. */
async function getById(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT v.*, s.name AS school_name, s.zone, s.contact_name, s.contact_phone,
              u.full_name AS engineer_name
       FROM visits v JOIN schools s ON v.school_id = s.id
       LEFT JOIN users u ON v.engineer_id = u.id
       WHERE v.id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Visit not found.' });
    const visit = rows[0];
    if (req.user.role !== 'admin' && visit.engineer_id !== req.user.id) {
      return res.status(403).json({ error: 'Not your visit.' });
    }

    const [faults] = await pool.query(
      `SELECT id, error_code, title, category, priority, status, created_at, sla_due_at
       FROM errors WHERE visit_id = ?
       ORDER BY status = 'resolved', FIELD(priority, 'critical','high','medium','low'), created_at`,
      [req.params.id]
    );
    res.json({ ...visit, faults });
  } catch (err) { next(err); }
}

module.exports = { queue, suggestions, list, create, update, getById };
