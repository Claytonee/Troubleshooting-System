const pool = require('../config/database');

async function getAll(req, res, next) {
  try {
    let query = `
      SELECT s.*, u.full_name as admin_name, u.phone as admin_phone, u.color as admin_color,
      (SELECT COUNT(*) FROM errors e WHERE e.school_id = s.id AND e.status != 'resolved') as open_errors
      FROM schools s
      LEFT JOIN users u ON s.assigned_admin_id = u.id
    `;
    const params = [];

    if (req.user.role === 'subadmin') {
      query += ' WHERE s.assigned_admin_id = ?';
      params.push(req.user.id);
    } else if (req.user.role === 'school') {
      query += ' WHERE s.id = ?';
      params.push(req.user.school_id);
    }

    query += ' ORDER BY s.name ASC';
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const [rows] = await pool.query(`
      SELECT s.*, u.full_name as admin_name, u.phone as admin_phone, u.color as admin_color, u.title as admin_title
      FROM schools s
      LEFT JOIN users u ON s.assigned_admin_id = u.id
      WHERE s.id = ?
    `, [req.params.id]);

    if (!rows.length) return res.status(404).json({ error: 'School not found.' });

    const school = rows[0];

    const [errors] = await pool.query(
      'SELECT * FROM errors WHERE school_id = ? ORDER BY created_at DESC',
      [school.id]
    );

    const [checkins] = await pool.query(
      'SELECT * FROM weekly_checkins WHERE school_id = ? ORDER BY week_number DESC',
      [school.id]
    );

    const [comms] = await pool.query(
      'SELECT * FROM communications WHERE school_id = ? ORDER BY created_at DESC LIMIT 20',
      [school.id]
    );

    res.json({ ...school, errors, checkins, communications: comms });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { code, name, zone, students, tablets, routers, contact_name, contact_role, contact_phone, lrs_ip, isp, assigned_admin_id } = req.body;

    if (!code || !name) return res.status(400).json({ error: 'School code and name are required.' });

    const [existing] = await pool.query('SELECT id FROM schools WHERE code = ?', [code]);
    if (existing.length) return res.status(409).json({ error: 'School code already exists.' });

    const [result] = await pool.query(
      'INSERT INTO schools (code, name, zone, students, tablets, routers, contact_name, contact_role, contact_phone, lrs_ip, isp, assigned_admin_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [code, name, zone, students || 0, tablets || 0, routers || 0, contact_name, contact_role, contact_phone, lrs_ip || '192.168.0.10', isp, assigned_admin_id || null]
    );

    res.status(201).json({ id: result.insertId, message: 'School created successfully.' });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const { name, zone, students, tablets, routers, contact_name, contact_role, contact_phone, lrs_ip, isp, assigned_admin_id } = req.body;

    await pool.query(
      'UPDATE schools SET name=?, zone=?, students=?, tablets=?, routers=?, contact_name=?, contact_role=?, contact_phone=?, lrs_ip=?, isp=?, assigned_admin_id=? WHERE id=?',
      [name, zone, students, tablets, routers, contact_name, contact_role, contact_phone, lrs_ip, isp, assigned_admin_id || null, req.params.id]
    );

    res.json({ message: 'School updated successfully.' });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    await pool.query('DELETE FROM errors WHERE school_id = ?', [req.params.id]);
    await pool.query('DELETE FROM weekly_checkins WHERE school_id = ?', [req.params.id]);
    await pool.query('DELETE FROM communications WHERE school_id = ?', [req.params.id]);
    await pool.query('DELETE FROM schools WHERE id = ?', [req.params.id]);
    res.json({ message: 'School deleted successfully.' });
  } catch (err) { next(err); }
}

async function reassignAdmin(req, res, next) {
  try {
    const { admin_id } = req.body;
    await pool.query('UPDATE schools SET assigned_admin_id = ? WHERE id = ?', [admin_id || null, req.params.id]);
    res.json({ message: 'Sub-admin reassigned successfully.' });
  } catch (err) { next(err); }
}

module.exports = { getAll, getById, create, update, remove, reassignAdmin };
