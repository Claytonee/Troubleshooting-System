const pool = require('../config/database');

async function getAll(req, res, next) {
  try {
    let query = `
      SELECT e.*, s.name as school_name, s.code as school_code, s.zone as school_zone,
      u.full_name as assigned_name, u.color as assigned_color
      FROM errors e
      JOIN schools s ON e.school_id = s.id
      LEFT JOIN users u ON e.assigned_to = u.id
    `;
    const params = [];
    const conditions = [];

    if (req.user.role === 'subadmin') {
      conditions.push('s.assigned_admin_id = ?');
      params.push(req.user.id);
    } else if (req.user.role === 'school') {
      conditions.push('s.id = ?');
      params.push(req.user.school_id);
    }

    if (req.query.status && req.query.status !== 'all') {
      conditions.push('e.status = ?');
      params.push(req.query.status);
    }
    if (req.query.priority) {
      conditions.push('e.priority = ?');
      params.push(req.query.priority);
    }
    if (req.query.category) {
      conditions.push('e.category = ?');
      params.push(req.query.category);
    }
    if (req.query.school_id) {
      conditions.push('e.school_id = ?');
      params.push(req.query.school_id);
    }
    if (req.query.search) {
      conditions.push('(e.title LIKE ? OR e.error_code LIKE ? OR s.name LIKE ?)');
      const term = `%${req.query.search}%`;
      params.push(term, term, term);
    }

    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY e.created_at DESC';

    if (req.query.limit) {
      query += ' LIMIT ?';
      params.push(parseInt(req.query.limit));
    }

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const [rows] = await pool.query(`
      SELECT e.*, s.name as school_name, s.code as school_code,
      u.full_name as assigned_name, u.color as assigned_color
      FROM errors e
      JOIN schools s ON e.school_id = s.id
      LEFT JOIN users u ON e.assigned_to = u.id
      WHERE e.id = ?
    `, [req.params.id]);

    if (!rows.length) return res.status(404).json({ error: 'Error not found.' });

    const [updates] = await pool.query(
      'SELECT * FROM error_updates WHERE error_id = ? ORDER BY created_at DESC',
      [req.params.id]
    );

    res.json({ ...rows[0], updates });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { title, description, school_id, category, subcategory, priority, reporter_name, reporter_role, reporter_contact, location, affected_devices } = req.body;

    const [maxCode] = await pool.query("SELECT error_code FROM errors ORDER BY id DESC LIMIT 1");
    let seq = 242;
    if (maxCode.length) {
      const num = parseInt(maxCode[0].error_code.replace('QFT-0', ''));
      if (!isNaN(num)) seq = num + 1;
    }
    const errorCode = `QFT-0${seq}`;

    const [school] = await pool.query('SELECT assigned_admin_id FROM schools WHERE id = ?', [school_id]);
    const assignedTo = school.length ? school[0].assigned_admin_id : null;

    const [result] = await pool.query(
      `INSERT INTO errors (error_code, title, description, school_id, category, subcategory, priority, status, assigned_to, reporter_name, reporter_role, reporter_contact, location, affected_devices)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?)`,
      [errorCode, title, description, school_id, category, subcategory || null, priority || 'medium', assignedTo, reporter_name || null, reporter_role || null, reporter_contact || null, location || null, affected_devices || null]
    );

    res.status(201).json({ id: result.insertId, error_code: errorCode, message: 'Error reported successfully.' });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const { title, description, category, subcategory, priority, status, assigned_to, location, affected_devices } = req.body;

    const resolvedAt = status === 'resolved' ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null;

    await pool.query(
      `UPDATE errors SET title=?, description=?, category=?, subcategory=?, priority=?, status=?, assigned_to=?, location=?, affected_devices=?, resolved_at=COALESCE(?, resolved_at) WHERE id=?`,
      [title, description, category, subcategory, priority, status, assigned_to || null, location, affected_devices, resolvedAt, req.params.id]
    );

    res.json({ message: 'Error updated successfully.' });
  } catch (err) { next(err); }
}

async function updateStatus(req, res, next) {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'Status is required.' });

    const resolvedAt = status === 'resolved' ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null;

    await pool.query(
      'UPDATE errors SET status = ?, resolved_at = COALESCE(?, resolved_at) WHERE id = ?',
      [status, resolvedAt, req.params.id]
    );

    res.json({ message: `Error status changed to ${status}.` });
  } catch (err) { next(err); }
}

async function addUpdate(req, res, next) {
  try {
    const { update_type, note, recorded_by } = req.body;
    if (!note) return res.status(400).json({ error: 'Note is required.' });

    await pool.query(
      'INSERT INTO error_updates (error_id, update_type, note, recorded_by) VALUES (?, ?, ?, ?)',
      [req.params.id, update_type || 'Progress Update', note, recorded_by || req.user.full_name]
    );

    res.status(201).json({ message: 'Update added successfully.' });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    await pool.query('DELETE FROM error_updates WHERE error_id = ?', [req.params.id]);
    await pool.query('DELETE FROM errors WHERE id = ?', [req.params.id]);
    res.json({ message: 'Error deleted successfully.' });
  } catch (err) { next(err); }
}

async function getStats(req, res, next) {
  try {
    let schoolFilter = '';
    const params = [];

    if (req.user.role === 'subadmin') {
      schoolFilter = 'AND e.school_id IN (SELECT id FROM schools WHERE assigned_admin_id = ?)';
      params.push(req.user.id);
    } else if (req.user.role === 'school') {
      schoolFilter = 'AND e.school_id = ?';
      params.push(req.user.school_id);
    }

    const [totals] = await pool.query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status != 'resolved' THEN 1 ELSE 0 END) as open_count,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_status,
        SUM(CASE WHEN status = 'progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'escalated' THEN 1 ELSE 0 END) as escalated,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
        SUM(CASE WHEN priority = 'critical' AND status != 'resolved' THEN 1 ELSE 0 END) as critical_open,
        SUM(CASE WHEN status = 'resolved' AND resolved_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 ELSE 0 END) as resolved_24h
      FROM errors e WHERE 1=1 ${schoolFilter}
    `, params);

    const [byCategory] = await pool.query(`
      SELECT category, COUNT(*) as count FROM errors e WHERE status != 'resolved' ${schoolFilter} GROUP BY category ORDER BY count DESC
    `, params);

    const [byPriority] = await pool.query(`
      SELECT priority, COUNT(*) as count FROM errors e WHERE status != 'resolved' ${schoolFilter} GROUP BY priority
    `, params);

    res.json({
      summary: totals[0],
      by_category: byCategory,
      by_priority: byPriority
    });
  } catch (err) { next(err); }
}

module.exports = { getAll, getById, create, update, updateStatus, addUpdate, remove, getStats };
