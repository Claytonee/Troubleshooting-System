/**
 * Preventive maintenance endpoints.
 * Design: docs/features/11-preventive-maintenance.md
 *
 * Read is open to anyone who can see the school — a school administrator should
 * be able to see what is due at their own school without waiting for an
 * engineer to tell them. Recording a check done is a field action, so it stays
 * with the people who do the checks.
 */
const pool = require('../config/database');
const maintenance = require('../services/maintenance');
const { logAudit } = require('../services/audit');

/** Schools this user may look at. Mirrors the inventory and visit scoping. */
async function scopeSchools(user, requested) {
  if (user.role === 'school' || user.role === 'teacher') {
    return user.school_id ? [user.school_id] : [];
  }
  if (user.role === 'subadmin') {
    const [rows] = await pool.query('SELECT id FROM schools WHERE assigned_admin_id = ?', [user.id]);
    const mine = rows.map(r => r.id);
    return requested ? mine.filter(id => id === Number(requested)) : mine;
  }
  if (requested) return [Number(requested)];
  const [rows] = await pool.query('SELECT id FROM schools');
  return rows.map(r => r.id);
}

/** GET /api/maintenance/due?school_id= — what is due, per school. */
async function due(req, res, next) {
  try {
    const schoolIds = await scopeSchools(req.user, req.query.school_id);
    if (!schoolIds.length) return res.json({ schools: [], tasks: [] });

    // One school: the full task list with its history, for the checklist.
    if (schoolIds.length === 1) {
      const tasks = await maintenance.dueFor(schoolIds[0]);
      const [school] = await pool.query('SELECT id, name FROM schools WHERE id = ?', [schoolIds[0]]);
      return res.json({
        school: school[0] || null,
        tasks,
        due_count: tasks.filter(t => t.due).length,
        overdue_count: tasks.filter(t => t.overdue).length
      });
    }

    // Many: counts only, so the queue can be sorted by them.
    const counts = await maintenance.dueCounts(schoolIds);
    const [names] = await pool.query('SELECT id, name FROM schools WHERE id IN (?)', [schoolIds]);
    const schools = names.map(s => ({ school_id: s.id, school_name: s.name, ...counts[s.id] }))
      .sort((a, b) => b.overdue - a.overdue || b.due - a.due);
    res.json({
      schools,
      totals: schools.reduce((a, s) => ({ due: a.due + s.due, overdue: a.overdue + s.overdue }), { due: 0, overdue: 0 })
    });
  } catch (err) { next(err); }
}

/** GET /api/maintenance/tasks — the schedule itself. */
async function tasks(req, res, next) {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, description, interval_days, applies_to, is_active, sort_order FROM maintenance_tasks ORDER BY sort_order, id'
    );
    res.json({ tasks: rows });
  } catch (err) { next(err); }
}

/**
 * POST /api/maintenance/:taskId/done — a check was carried out.
 *
 * `school_id` is required and validated against what this user may touch: an
 * engineer marking a check done at a school they do not cover would quietly
 * reset that school's clock.
 */
async function markDone(req, res, next) {
  try {
    const schoolId = Number(req.body.school_id);
    if (!schoolId) return res.status(400).json({ error: 'Which school?' });

    const allowed = await scopeSchools(req.user, schoolId);
    if (!allowed.includes(schoolId)) {
      return res.status(403).json({ error: 'That school is not yours to sign off.' });
    }

    const result = await maintenance.markDone({
      taskId: Number(req.params.taskId),
      schoolId,
      doneBy: req.user.full_name || req.user.username,
      visitId: req.body.visit_id || null,
      note: req.body.note || null,
      doneOn: req.body.done_on || null
    });
    if (!result.ok) return res.status(404).json({ error: result.error });

    await logAudit({
      actor: req.user, ip: req.ip, action: 'maintenance.done', entityType: 'school',
      entityId: schoolId, summary: `${result.task} done`,
      meta: { task_id: Number(req.params.taskId), visit_id: req.body.visit_id || null }
    });
    res.json({ message: `${result.task} — recorded.`, id: result.id });
  } catch (err) { next(err); }
}

module.exports = { due, tasks, markDone };
