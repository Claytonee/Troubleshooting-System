const pool = require('../config/database');

async function getDashboard(req, res) {
  try {
    if (req.user.role === 'teacher') {
      return getTeacherDashboard(req, res);
    }
    if (req.user.role === 'subadmin') {
      return getSubadminDashboard(req, res);
    }

    let schoolFilter = '';
    let errorFilter = '';
    const params = [];

    if (req.user.role === 'school') {
      schoolFilter = 'WHERE s.id = ?';
      errorFilter = 'AND e.school_id = ?';
      params.push(req.user.school_id);
    }

    const [schoolCount] = await pool.query(`SELECT COUNT(*) as count FROM schools s ${schoolFilter}`, params);

    const [errorStats] = await pool.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN e.status != 'resolved' THEN 1 ELSE 0 END) as open_count,
        SUM(CASE WHEN e.status = 'progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN e.priority = 'critical' AND e.status != 'resolved' THEN 1 ELSE 0 END) as critical_open,
        SUM(CASE WHEN e.status != 'resolved' AND e.sla_due_at IS NOT NULL AND e.sla_due_at < NOW() THEN 1 ELSE 0 END) as sla_breached,
        SUM(CASE WHEN e.status = 'resolved' AND e.resolved_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 ELSE 0 END) as resolved_24h,
        SUM(CASE WHEN e.status = 'resolved' THEN 1 ELSE 0 END) as resolved_count,
        -- SLA compliance is a property of RESOLVED errors: was each one closed
        -- before its own due time. A resolution with no resolved_at (or no
        -- due time) cannot be judged either way, so it is counted separately
        -- rather than silently scoring as a miss.
        SUM(CASE WHEN e.status = 'resolved' AND e.resolved_at IS NOT NULL AND e.sla_due_at IS NOT NULL THEN 1 ELSE 0 END) as sla_measurable,
        SUM(CASE WHEN e.status = 'resolved' AND e.resolved_at IS NOT NULL AND e.sla_due_at IS NOT NULL AND e.resolved_at <= e.sla_due_at THEN 1 ELSE 0 END) as sla_on_time,
        SUM(CASE WHEN e.status = 'resolved' AND (e.resolved_at IS NULL OR e.sla_due_at IS NULL) THEN 1 ELSE 0 END) as sla_unmeasurable
      FROM errors e WHERE 1=1 ${errorFilter}
    `, params);

    const healthyFilter = schoolFilter
      ? `${schoolFilter} AND s.id NOT IN (SELECT DISTINCT school_id FROM errors WHERE status != 'resolved' AND priority IN ('critical', 'high'))`
      : `WHERE s.id NOT IN (SELECT DISTINCT school_id FROM errors WHERE status != 'resolved' AND priority IN ('critical', 'high'))`;
    const [healthySchools] = await pool.query(`SELECT COUNT(*) as count FROM schools s ${healthyFilter}`, params);

    const [recentErrors] = await pool.query(`
      SELECT e.id, e.error_code, e.title, e.priority, e.status, e.created_at, e.sla_due_at,
      ROUND(TIMESTAMPDIFF(MINUTE, e.created_at, COALESCE(e.resolved_at, NOW())) / 60, 1) AS hours_open,
      CASE WHEN e.status != 'resolved' AND e.sla_due_at IS NOT NULL AND e.sla_due_at < NOW() THEN 1 ELSE 0 END AS sla_breached,
      s.name as school_name
      FROM errors e JOIN schools s ON e.school_id = s.id
      WHERE e.status != 'resolved' ${errorFilter}
      ORDER BY FIELD(e.priority, 'critical', 'high', 'medium', 'low'), e.created_at DESC
      LIMIT 6
    `, params);

    // Current ISO week (Mon-based) + year term — matches the frontend's 52-week selector.
    const nowD = new Date();
    const wd = new Date(Date.UTC(nowD.getFullYear(), nowD.getMonth(), nowD.getDate()));
    wd.setUTCDate(wd.getUTCDate() - ((wd.getUTCDay() + 6) % 7) + 3);
    const firstThu = new Date(Date.UTC(wd.getUTCFullYear(), 0, 4));
    firstThu.setUTCDate(firstThu.getUTCDate() - ((firstThu.getUTCDay() + 6) % 7) + 3);
    const currentWeek = Math.min(52, Math.max(1, 1 + Math.round((wd - firstThu) / (7 * 86400000))));

    const [checkinStats] = await pool.query(`
      SELECT COUNT(*) as done FROM weekly_checkins wc
      JOIN schools s ON wc.school_id = s.id
      WHERE wc.week_number = ? AND wc.term = ? ${schoolFilter ? schoolFilter.replace('WHERE', 'AND') : ''}
    `, [currentWeek, String(nowD.getFullYear()), ...params]);

    const [categoryBreakdown] = await pool.query(`
      SELECT e.category, COUNT(*) as count
      FROM errors e WHERE e.status != 'resolved' ${errorFilter}
      GROUP BY e.category ORDER BY count DESC
    `, params);

    res.json({
      schools_total: schoolCount[0].count,
      schools_healthy: healthySchools[0].count,
      errors: errorStats[0],
      recent_errors: recentErrors,
      checkins: { done: checkinStats[0].done, total: schoolCount[0].count, current_week: currentWeek },
      category_breakdown: categoryBreakdown
    });
  } catch (err) {
    console.error('Dashboard error:', err.message);
    res.status(500).json({ error: 'Failed to load dashboard data.' });
  }
}

async function getTeacherDashboard(req, res) {
  try {
    const userId = req.user.id;
    const schoolId = req.user.school_id;

    const [myErrors] = await pool.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status != 'resolved' THEN 1 ELSE 0 END) as open_count,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved_count
      FROM errors WHERE reported_by_user_id = ?
    `, [userId]);

    const [recentErrors] = await pool.query(`
      SELECT id, error_code, title, priority, status, category, created_at,
             ROUND(TIMESTAMPDIFF(MINUTE, created_at, COALESCE(resolved_at, NOW())) / 60, 1) AS hours_open
      FROM errors WHERE reported_by_user_id = ?
      ORDER BY created_at DESC LIMIT 5
    `, [userId]);

    const [schoolInfo] = await pool.query(
      'SELECT name, zone FROM schools WHERE id = ?', [schoolId]
    );

    const [guidesCount] = await pool.query('SELECT COUNT(*) as count FROM troubleshooting_guides');

    res.json({
      type: 'teacher',
      school: schoolInfo[0] || null,
      my_errors: myErrors[0],
      recent_errors: recentErrors,
      guides_available: guidesCount[0].count
    });
  } catch (err) {
    console.error('Teacher dashboard error:', err.message);
    res.status(500).json({ error: 'Failed to load dashboard.' });
  }
}

async function getSubadminDashboard(req, res) {
  try {
    const userId = req.user.id;

    // My queue: errors assigned directly to me
    const [myQueue] = await pool.query(`
      SELECT e.id, e.error_code, e.title, e.priority, e.status, e.created_at, e.sla_due_at,
      ROUND(TIMESTAMPDIFF(MINUTE, e.created_at, COALESCE(e.resolved_at, NOW())) / 60, 1) AS hours_open,
      CASE WHEN e.sla_due_at IS NOT NULL AND e.sla_due_at < NOW() THEN 1 ELSE 0 END AS sla_breached,
      TIMESTAMPDIFF(MINUTE, NOW(), e.sla_due_at) AS sla_minutes_left,
      s.name as school_name
      FROM errors e JOIN schools s ON e.school_id = s.id
      WHERE e.assigned_to = ? AND e.status != 'resolved'
      ORDER BY FIELD(e.priority, 'critical', 'high', 'medium', 'low'), e.sla_due_at ASC
    `, [userId]);

    // Personal stats
    const [stats] = await pool.query(`
      SELECT
        SUM(CASE WHEN e.status != 'resolved' AND e.assigned_to = ? THEN 1 ELSE 0 END) as queue_count,
        SUM(CASE WHEN e.status != 'resolved' AND e.assigned_to = ? AND e.sla_due_at IS NOT NULL AND e.sla_due_at < DATE_ADD(NOW(), INTERVAL 2 HOUR) AND e.sla_due_at > NOW() THEN 1 ELSE 0 END) as due_soon,
        SUM(CASE WHEN e.status != 'resolved' AND e.assigned_to = ? AND e.sla_due_at IS NOT NULL AND e.sla_due_at < NOW() THEN 1 ELSE 0 END) as overdue,
        SUM(CASE WHEN e.assigned_to = ? AND e.status = 'resolved' AND e.resolved_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as resolved_week,
        SUM(CASE WHEN e.assigned_to = ? AND e.status = 'resolved' THEN 1 ELSE 0 END) as total_resolved,
        SUM(CASE WHEN e.assigned_to = ? AND e.status = 'resolved' AND e.resolved_at IS NOT NULL AND e.sla_due_at IS NOT NULL AND e.resolved_at <= e.sla_due_at THEN 1 ELSE 0 END) as resolved_within_sla,
        SUM(CASE WHEN e.assigned_to = ? AND e.status = 'resolved' AND e.resolved_at IS NOT NULL AND e.sla_due_at IS NOT NULL THEN 1 ELSE 0 END) as total_with_sla
      FROM errors e WHERE e.assigned_to = ?
    `, [userId, userId, userId, userId, userId, userId, userId, userId]);

    // My schools with health status
    const [mySchools] = await pool.query(`
      SELECT s.id, s.name, s.code, s.zone,
        (SELECT COUNT(*) FROM errors e WHERE e.school_id = s.id AND e.status != 'resolved') as open_errors,
        (SELECT COUNT(*) FROM errors e WHERE e.school_id = s.id AND e.status != 'resolved' AND e.priority IN ('critical','high')) as critical_errors
      FROM schools s WHERE s.assigned_admin_id = ?
      ORDER BY critical_errors DESC, open_errors DESC, s.name ASC
    `, [userId]);

    // Recent activity on my errors
    const [recentActivity] = await pool.query(`
      SELECT eu.note, eu.recorded_by, eu.created_at, e.error_code, e.title
      FROM error_updates eu
      JOIN errors e ON eu.error_id = e.id
      WHERE e.assigned_to = ?
      ORDER BY eu.created_at DESC LIMIT 5
    `, [userId]);

    // Check-ins for my schools
    const nowD = new Date();
    const wd = new Date(Date.UTC(nowD.getFullYear(), nowD.getMonth(), nowD.getDate()));
    wd.setUTCDate(wd.getUTCDate() - ((wd.getUTCDay() + 6) % 7) + 3);
    const firstThu = new Date(Date.UTC(wd.getUTCFullYear(), 0, 4));
    firstThu.setUTCDate(firstThu.getUTCDate() - ((firstThu.getUTCDay() + 6) % 7) + 3);
    const currentWeek = Math.min(52, Math.max(1, 1 + Math.round((wd - firstThu) / (7 * 86400000))));

    const [checkinStats] = await pool.query(`
      SELECT COUNT(*) as done FROM weekly_checkins wc
      JOIN schools s ON wc.school_id = s.id
      WHERE wc.week_number = ? AND wc.term = ? AND s.assigned_admin_id = ?
    `, [currentWeek, String(nowD.getFullYear()), userId]);

    res.json({
      type: 'subadmin',
      my_queue: myQueue,
      stats: stats[0],
      my_schools: mySchools,
      recent_activity: recentActivity,
      checkins: { done: checkinStats[0].done, total: mySchools.length, current_week: currentWeek }
    });
  } catch (err) {
    console.error('Subadmin dashboard error:', err.message);
    res.status(500).json({ error: 'Failed to load dashboard.' });
  }
}

module.exports = { getDashboard };
