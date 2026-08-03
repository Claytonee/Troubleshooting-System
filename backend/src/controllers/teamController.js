const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { logAudit } = require('../services/audit');

async function getAll(req, res, next) {
  try {
    const [rows] = await pool.query(`
      SELECT u.id, u.username, u.email, u.full_name, u.role, u.phone, u.zone, u.color, u.title, u.status, u.created_at,
      (SELECT COUNT(*) FROM schools s WHERE s.assigned_admin_id = u.id) as school_count,
      (SELECT COUNT(*) FROM errors e WHERE e.assigned_to = u.id AND e.status != 'resolved') as open_errors
      FROM users u WHERE u.role = 'subadmin' ORDER BY u.full_name ASC
    `);
    res.json(rows);
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const [rows] = await pool.query(`
      SELECT u.id, u.username, u.email, u.full_name, u.role, u.phone, u.zone, u.color, u.title, u.status, u.created_at
      FROM users u WHERE u.id = ? AND u.role = 'subadmin'
    `, [req.params.id]);

    if (!rows.length) return res.status(404).json({ error: 'Sub-admin not found.' });

    const [schools] = await pool.query('SELECT id, code, name, zone FROM schools WHERE assigned_admin_id = ?', [req.params.id]);
    const [errors] = await pool.query(
      'SELECT id, error_code, title, priority, status FROM errors WHERE assigned_to = ? AND status != ? ORDER BY created_at DESC LIMIT 20',
      [req.params.id, 'resolved']
    );

    res.json({ ...rows[0], schools, open_errors: errors });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { username, email, password, full_name, phone, zone, color, title, status } = req.body;

    if (!username || !email || !full_name) {
      return res.status(400).json({ error: 'Username, email, and full_name are required.' });
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existing.length) return res.status(409).json({ error: 'Username or email already exists.' });

    const passwordHash = await bcrypt.hash(password || 'changeme123', 10);
    const [result] = await pool.query(
      'INSERT INTO users (username, email, password_hash, full_name, role, phone, zone, color, title, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [username, email, passwordHash, full_name, 'subadmin', phone || null, zone || null, color || '#4f7cff', title || 'Field Engineer', status || 'active']
    );

    await logAudit({
      actor: req.user, ip: req.ip, action: 'sub_admin.created', entityType: 'sub_admin', entityId: result.insertId,
      summary: `Created sub-admin "${full_name}" (@${username})`
    });

    res.status(201).json({ id: result.insertId, message: 'Sub-admin created successfully.' });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const { full_name, email, phone, zone, color, title, status } = req.body;

    await pool.query(
      'UPDATE users SET full_name=?, email=?, phone=?, zone=?, color=?, title=?, status=? WHERE id=? AND role=?',
      [full_name, email, phone, zone, color, title, status, req.params.id, 'subadmin']
    );

    await logAudit({
      actor: req.user, ip: req.ip, action: 'sub_admin.updated', entityType: 'sub_admin', entityId: req.params.id,
      summary: `Updated sub-admin "${full_name}"`, meta: { status }
    });

    res.json({ message: 'Sub-admin updated successfully.' });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const { reassign_to } = req.body;

    if (reassign_to) {
      await pool.query('UPDATE schools SET assigned_admin_id = ? WHERE assigned_admin_id = ?', [reassign_to, req.params.id]);
      await pool.query('UPDATE errors SET assigned_to = ? WHERE assigned_to = ?', [reassign_to, req.params.id]);
    } else {
      await pool.query('UPDATE schools SET assigned_admin_id = NULL WHERE assigned_admin_id = ?', [req.params.id]);
      await pool.query('UPDATE errors SET assigned_to = NULL WHERE assigned_to = ?', [req.params.id]);
    }

    await pool.query('DELETE FROM users WHERE id = ? AND role = ?', [req.params.id, 'subadmin']);
    await logAudit({
      actor: req.user, ip: req.ip, action: 'sub_admin.deleted', entityType: 'sub_admin', entityId: req.params.id,
      summary: `Removed sub-admin #${req.params.id}`, meta: { reassign_to: reassign_to || null }
    });
    res.json({ message: 'Sub-admin removed successfully.' });
  } catch (err) { next(err); }
}

async function assignSchools(req, res, next) {
  try {
    const { school_ids } = req.body;

    await pool.query('UPDATE schools SET assigned_admin_id = NULL WHERE assigned_admin_id = ?', [req.params.id]);

    if (school_ids && school_ids.length) {
      await pool.query('UPDATE schools SET assigned_admin_id = ? WHERE id IN (?)', [req.params.id, school_ids]);
    }

    res.json({ message: 'Schools assigned successfully.' });
  } catch (err) { next(err); }
}

module.exports = { getAll, getById, create, update, remove, assignSchools };
