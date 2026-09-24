const pool = require('../config/database');
const { canActOnSchool } = require('../services/scope');

async function getAll(req, res, next) {
  try {
    let query = `
      SELECT c.*, s.name as school_name, s.code as school_code
      FROM communications c
      JOIN schools s ON c.school_id = s.id
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

    if (req.query.school_id) {
      conditions.push('c.school_id = ?');
      params.push(parseInt(req.query.school_id));
    }

    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY c.created_at DESC';

    if (req.query.limit) {
      query += ' LIMIT ?';
      params.push(parseInt(req.query.limit));
    }

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { school_id, note, recorded_by } = req.body;

    if (!school_id || !note) {
      return res.status(400).json({ error: 'school_id and note are required.' });
    }

    if (!(await canActOnSchool(req.user, school_id))) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const [result] = await pool.query(
      'INSERT INTO communications (school_id, recorded_by, note) VALUES (?, ?, ?)',
      [school_id, recorded_by || req.user.full_name, note]
    );

    res.status(201).json({ id: result.insertId, message: 'Communication note added.' });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    // The route admits admin and subadmin; a field engineer deletes only the
    // notes of schools assigned to them (SEC-004).
    const [rows] = await pool.query('SELECT school_id FROM communications WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Communication not found.' });
    if (!(await canActOnSchool(req.user, rows[0].school_id))) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    await pool.query('DELETE FROM communications WHERE id = ?', [req.params.id]);
    res.json({ message: 'Communication deleted.' });
  } catch (err) { next(err); }
}

module.exports = { getAll, create, remove };
