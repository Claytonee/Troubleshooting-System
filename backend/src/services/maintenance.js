/**
 * Preventive maintenance. Design: docs/features/11-preventive-maintenance.md
 *
 * Everything in this system was reactive except one heartbeat. The LRS tells us
 * when it has already died; nothing schedules the check that would have stopped
 * it dying — the dust, the battery, the loose cable, the disk filling up.
 *
 * Field-service research is direct about the link: "a high first-time fix rate
 * is a clear sign your preventive maintenance programme is working". Scheduled
 * work is also the only kind that can be batched into a trip somebody is
 * already making, which is the whole premise of the visit planner.
 *
 * The model is deliberately the smallest thing that answers "what is due at
 * this school": a task list with intervals, and a log of when each was last
 * done where. No calendars, no recurrence rules, no assignments.
 */
const pool = require('../config/database');

/** Days past due at which a check stops being a nudge and starts being a risk. */
const OVERDUE_GRACE_DAYS = 14;

/**
 * Every active task with, per school, when it was last done and whether it is
 * due. A task that has NEVER been done at a school counts as due — the most
 * common real state, and the one a "days since last" calculation silently
 * skips when it divides by a null.
 */
async function dueFor(schoolId) {
  const [rows] = await pool.query(
    `SELECT t.id, t.name, t.description, t.interval_days, t.applies_to,
            l.done_on AS last_done,
            DATEDIFF(CURDATE(), l.done_on) AS days_since
       FROM maintenance_tasks t
       LEFT JOIN (
         SELECT task_id, MAX(done_on) AS done_on
           FROM maintenance_log WHERE school_id = ? GROUP BY task_id
       ) l ON l.task_id = t.id
      WHERE t.is_active = 1
      ORDER BY t.sort_order, t.id`,
    [schoolId]
  );

  return rows.map(r => {
    const never = r.last_done == null;
    const daysSince = never ? null : Number(r.days_since);
    const due = never || daysSince >= r.interval_days;
    const daysOverdue = due && !never ? daysSince - r.interval_days : null;
    return {
      task_id: r.id,
      name: r.name,
      description: r.description,
      interval_days: r.interval_days,
      applies_to: r.applies_to,
      last_done: r.last_done,
      days_since: daysSince,
      due,
      never_done: never,
      days_overdue: daysOverdue,
      // "Overdue" is reserved for a real risk, so a task one day past its
      // interval is still just due. Crying wolf on day one trains people to
      // ignore the list.
      overdue: never || (daysOverdue != null && daysOverdue > OVERDUE_GRACE_DAYS)
    };
  });
}

/** How many checks are due at each school, for the visit queue. */
async function dueCounts(schoolIds) {
  if (!schoolIds || !schoolIds.length) return {};
  const [rows] = await pool.query(
    `SELECT s.id AS school_id, t.id AS task_id, t.interval_days,
            (SELECT MAX(done_on) FROM maintenance_log l WHERE l.school_id = s.id AND l.task_id = t.id) AS last_done
       FROM schools s CROSS JOIN maintenance_tasks t
      WHERE s.id IN (?) AND t.is_active = 1`,
    [schoolIds]
  );
  const out = {};
  for (const id of schoolIds) out[id] = { due: 0, overdue: 0 };
  const today = new Date();
  for (const r of rows) {
    const bucket = out[r.school_id];
    if (!bucket) continue;
    if (!r.last_done) { bucket.due++; bucket.overdue++; continue; }
    const days = Math.floor((today - new Date(r.last_done)) / 86400000);
    if (days >= r.interval_days) {
      bucket.due++;
      if (days - r.interval_days > OVERDUE_GRACE_DAYS) bucket.overdue++;
    }
  }
  return out;
}

/** Record that a check was done. Today unless told otherwise. */
async function markDone({ taskId, schoolId, doneBy, visitId, note, doneOn }) {
  const [task] = await pool.query('SELECT id, name FROM maintenance_tasks WHERE id = ? AND is_active = 1', [taskId]);
  if (!task.length) return { ok: false, error: 'That check does not exist.' };

  const [res] = await pool.query(
    `INSERT INTO maintenance_log (school_id, task_id, done_on, done_by, visit_id, note)
     VALUES (?, ?, COALESCE(?, CURDATE()), ?, ?, ?)`,
    [schoolId, taskId, doneOn || null, doneBy || null, visitId || null, note || null]
  );
  return { ok: true, id: res.insertId, task: task[0].name };
}

module.exports = { dueFor, dueCounts, markDone, OVERDUE_GRACE_DAYS };
