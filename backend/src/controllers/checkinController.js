const pool = require('../config/database');

async function getAll(req, res, next) {
  try {
    let query = 'SELECT wc.*, s.name as school_name, s.code as school_code FROM weekly_checkins wc JOIN schools s ON wc.school_id = s.id';
    const params = [];
    const conditions = [];

    if (req.user.role === 'subadmin') {
      conditions.push('s.assigned_admin_id = ?');
      params.push(req.user.id);
    } else if (req.user.role === 'school') {
      conditions.push('s.id = ?');
      params.push(req.user.school_id);
    }

    if (req.query.week) {
      conditions.push('wc.week_number = ?');
      params.push(parseInt(req.query.week));
    }
    if (req.query.school_id) {
      conditions.push('wc.school_id = ?');
      params.push(parseInt(req.query.school_id));
    }
    if (req.query.term) {
      conditions.push('wc.term = ?');
      params.push(req.query.term);
    }

    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY wc.week_number DESC, s.name ASC';

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) { next(err); }
}

async function getBySchool(req, res, next) {
  try {
    const schoolId = parseInt(req.params.schoolId, 10);

    // Tenant scoping: a school user may only read their own school; a
    // subadmin only schools assigned to them; admin may read any.
    if (req.user.role === 'school' && schoolId !== req.user.school_id) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    if (req.user.role === 'subadmin') {
      const [allowed] = await pool.query(
        'SELECT id FROM schools WHERE id = ? AND assigned_admin_id = ?', [schoolId, req.user.id]
      );
      if (!allowed.length) return res.status(403).json({ error: 'Access denied.' });
    }

    const [rows] = await pool.query(
      'SELECT * FROM weekly_checkins WHERE school_id = ? ORDER BY week_number ASC',
      [schoolId]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

async function createOrUpdate(req, res, next) {
  try {
    const { school_id, week_number, term, status, connectivity, tablets, platform, power, note, checked_by, checkin_date } = req.body;

    if (!school_id || !week_number) return res.status(400).json({ error: 'school_id and week_number are required.' });

    if (req.user.role === 'school' && parseInt(school_id) !== req.user.school_id) {
      return res.status(403).json({ error: 'You can only submit check-ins for your own school.' });
    }

    // Validate checkin_date (YYYY-MM-DD); fall back to today when absent/invalid.
    const dateOk = typeof checkin_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(checkin_date);

    await pool.query(`
      INSERT INTO weekly_checkins (school_id, week_number, term, status, connectivity, tablets, platform, power, note, checked_by, checkin_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURDATE()))
      ON DUPLICATE KEY UPDATE
        status=VALUES(status), connectivity=VALUES(connectivity), tablets=VALUES(tablets),
        platform=VALUES(platform), power=VALUES(power), note=VALUES(note), checked_by=VALUES(checked_by),
        checkin_date=VALUES(checkin_date)
    `, [school_id, week_number, term || 'Term 2 · 2026', status || 'green', connectivity || 'ok', tablets || 'ok', platform || 'ok', power || 'ok', note || null, checked_by || req.user.full_name, dateOk ? checkin_date : null]);

    res.status(201).json({ message: 'Check-in recorded successfully.' });
  } catch (err) { next(err); }
}

async function getStats(req, res, next) {
  try {
    const term = req.query.term || 'Term 2 · 2026';
    const week = parseInt(req.query.week) || 4;

    let schoolFilter = '';
    const filterParams = [];

    if (req.user.role === 'subadmin') {
      schoolFilter = 'AND s.assigned_admin_id = ?';
      filterParams.push(req.user.id);
    }

    const [total] = await pool.query(
      `SELECT COUNT(*) as count FROM schools s WHERE 1=1 ${schoolFilter}`,
      filterParams
    );
    const [done] = await pool.query(
      `SELECT COUNT(*) as count FROM weekly_checkins wc JOIN schools s ON wc.school_id = s.id WHERE wc.term = ? AND wc.week_number = ? ${schoolFilter}`,
      [term, week, ...filterParams]
    );

    const [byStatus] = await pool.query(
      'SELECT status, COUNT(*) as count FROM weekly_checkins WHERE term = ? GROUP BY status',
      [term]
    );

    res.json({
      total_schools: total[0].count,
      checked_this_week: done[0].count,
      due: total[0].count - done[0].count,
      by_status: byStatus
    });
  } catch (err) { next(err); }
}

module.exports = { getAll, getBySchool, createOrUpdate, getStats };
