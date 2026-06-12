const pool = require('../config/database');

async function getDashboard(req, res) {
  try {
    let schoolFilter = '';
    let errorFilter = '';
    const params = [];

    if (req.user.role === 'subadmin') {
      schoolFilter = 'WHERE s.assigned_admin_id = ?';
      errorFilter = 'AND e.school_id IN (SELECT id FROM schools WHERE assigned_admin_id = ?)';
      params.push(req.user.id);
    } else if (req.user.role === 'school') {
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
        SUM(CASE WHEN e.status = 'resolved' AND e.resolved_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 ELSE 0 END) as resolved_24h
      FROM errors e WHERE 1=1 ${errorFilter}
    `, params);

    const healthyFilter = schoolFilter
      ? `${schoolFilter} AND s.id NOT IN (SELECT DISTINCT school_id FROM errors WHERE status != 'resolved' AND priority IN ('critical', 'high'))`
      : `WHERE s.id NOT IN (SELECT DISTINCT school_id FROM errors WHERE status != 'resolved' AND priority IN ('critical', 'high'))`;
    const [healthySchools] = await pool.query(`SELECT COUNT(*) as count FROM schools s ${healthyFilter}`, params);

    const [recentErrors] = await pool.query(`
      SELECT e.id, e.error_code, e.title, e.priority, e.status, e.hours_open, e.created_at,
      s.name as school_name
      FROM errors e JOIN schools s ON e.school_id = s.id
      WHERE e.status != 'resolved' ${errorFilter}
      ORDER BY FIELD(e.priority, 'critical', 'high', 'medium', 'low'), e.created_at DESC
      LIMIT 6
    `, params);

    const [checkinStats] = await pool.query(`
      SELECT COUNT(*) as done FROM weekly_checkins wc
      JOIN schools s ON wc.school_id = s.id
      WHERE wc.week_number = 4 AND wc.term = 'Term 2 · 2026' ${schoolFilter ? schoolFilter.replace('WHERE', 'AND') : ''}
    `, params);

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
      checkins: { done: checkinStats[0].count, total: schoolCount[0].count, current_week: 4 },
      category_breakdown: categoryBreakdown
    });
  } catch (err) {
    console.error('Dashboard error:', err.message);
    res.status(500).json({ error: 'Failed to load dashboard data.' });
  }
}

module.exports = { getDashboard };
