const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { logAudit } = require('../services/audit');

/**
 * School Admins = users with role 'school', each linked to a school via school_id.
 * These accounts let school staff log in and manage their own school's issues.
 * Full CRUD here is restricted to platform admins (see routes/schoolAdmins.js).
 */

async function getAll(req, res, next) {
  try {
    const [rows] = await pool.query(`
      SELECT u.id, u.username, u.email, u.full_name, u.role, u.phone, u.zone, u.color, u.title,
             u.status, u.school_id, u.created_at,
             s.name AS school_name, s.code AS school_code, s.zone AS school_zone
      FROM users u
      LEFT JOIN schools s ON u.school_id = s.id
      WHERE u.role = 'school'
      ORDER BY u.full_name ASC
    `);
    res.json(rows);
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const [rows] = await pool.query(`
      SELECT u.id, u.username, u.email, u.full_name, u.role, u.phone, u.zone, u.color, u.title,
             u.status, u.school_id, u.created_at,
             s.name AS school_name, s.code AS school_code
      FROM users u
      LEFT JOIN schools s ON u.school_id = s.id
      WHERE u.id = ? AND u.role = 'school'
    `, [req.params.id]);

    if (!rows.length) return res.status(404).json({ error: 'School admin not found.' });
    res.json(rows[0]);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { username, email, password, full_name, phone, color, title, status, school_id } = req.body;

    if (!username || !email || !full_name) {
      return res.status(400).json({ error: 'Username, email, and full_name are required.' });
    }
    if (!school_id) {
      return res.status(400).json({ error: 'A school must be assigned to the school admin.' });
    }

    const [school] = await pool.query('SELECT id FROM schools WHERE id = ?', [school_id]);
    if (!school.length) return res.status(400).json({ error: 'Assigned school does not exist.' });

    const [existing] = await pool.query('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existing.length) return res.status(409).json({ error: 'Username or email already exists.' });

    const passwordHash = await bcrypt.hash(password || 'changeme123', 10);
    const [result] = await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name, role, phone, zone, color, title, status, school_id)
       VALUES (?, ?, ?, ?, 'school', ?, ?, ?, ?, ?, ?)`,
      [username, email, passwordHash, full_name, phone || null, null,
       color || '#2dd98a', title || 'School Administrator', status || 'active', school_id]
    );

    await logAudit({
      actor: req.user, ip: req.ip, action: 'school_admin.created', entityType: 'school_admin', entityId: result.insertId,
      summary: `Created school admin "${full_name}" (@${username})`, meta: { school_id }
    });

    res.status(201).json({ id: result.insertId, message: 'School admin created successfully.' });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const { full_name, email, phone, color, title, status, school_id } = req.body;

    if (school_id) {
      const [school] = await pool.query('SELECT id FROM schools WHERE id = ?', [school_id]);
      if (!school.length) return res.status(400).json({ error: 'Assigned school does not exist.' });
    }

    // Guard against email collision with a different user.
    if (email) {
      const [dupe] = await pool.query('SELECT id FROM users WHERE email = ? AND id != ?', [email, req.params.id]);
      if (dupe.length) return res.status(409).json({ error: 'Email already in use by another account.' });
    }

    const [result] = await pool.query(
      `UPDATE users SET full_name = ?, email = ?, phone = ?, color = ?, title = ?, status = ?, school_id = ?
       WHERE id = ? AND role = 'school'`,
      [full_name, email, phone || null, color || '#2dd98a', title || 'School Administrator',
       status || 'active', school_id || null, req.params.id]
    );

    if (!result.affectedRows) return res.status(404).json({ error: 'School admin not found.' });
    await logAudit({
      actor: req.user, ip: req.ip, action: 'school_admin.updated', entityType: 'school_admin', entityId: req.params.id,
      summary: `Updated school admin "${full_name}"`, meta: { status, school_id }
    });
    res.json({ message: 'School admin updated successfully.' });
  } catch (err) { next(err); }
}

async function resetPassword(req, res, next) {
  try {
    const { new_password } = req.body;
    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }
    const passwordHash = await bcrypt.hash(new_password, 10);
    const [result] = await pool.query(
      "UPDATE users SET password_hash = ? WHERE id = ? AND role = 'school'",
      [passwordHash, req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'School admin not found.' });
    await logAudit({
      actor: req.user, ip: req.ip, action: 'school_admin.password_reset', entityType: 'school_admin', entityId: req.params.id,
      summary: 'Reset school admin password'
    });
    res.json({ message: 'Password reset successfully.' });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const [target] = await pool.query("SELECT full_name FROM users WHERE id = ? AND role = 'school'", [req.params.id]);
    const [result] = await pool.query("DELETE FROM users WHERE id = ? AND role = 'school'", [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'School admin not found.' });
    await logAudit({
      actor: req.user, ip: req.ip, action: 'school_admin.deleted', entityType: 'school_admin', entityId: req.params.id,
      summary: `Deleted school admin "${target.length ? target[0].full_name : '#' + req.params.id}"`
    });
    res.json({ message: 'School admin removed successfully.' });
  } catch (err) { next(err); }
}

module.exports = { getAll, getById, create, update, resetPassword, remove };
