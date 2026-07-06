const pool = require('../config/database');
const { logAudit } = require('../services/audit');

// Build a URL-safe unique code from a school name.
async function uniqueCode(name) {
  let base = (name || 'school').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 36) || 'school';
  let code = base;
  for (let i = 0; i < 50; i++) {
    const [ex] = await pool.query('SELECT id FROM schools WHERE code = ?', [code]);
    if (!ex.length) return code;
    code = `${base}-${i + 2}`;
  }
  return `${base}-${Math.floor(Math.random() * 100000)}`;
}

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
    if (req.user.role === 'school' && parseInt(req.params.id) !== req.user.school_id) {
      return res.status(403).json({ error: 'Access denied.' });
    }

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
    const { code, name, zone, students, tablets, routers,
      contact_name, contact_role, contact_phone, contact_email,
      it_name, it_email, coordinator_name, coordinator_email,
      lrs_ip, isp, assigned_admin_id } = req.body;

    if (!name) return res.status(400).json({ error: 'School name is required.' });

    // Code is optional in the UI — auto-generate a unique one from the name if absent.
    let finalCode = (code || '').trim();
    if (finalCode) {
      const [existing] = await pool.query('SELECT id FROM schools WHERE code = ?', [finalCode]);
      if (existing.length) return res.status(409).json({ error: 'School code already exists.' });
    } else {
      finalCode = await uniqueCode(name);
    }

    const [result] = await pool.query(
      `INSERT INTO schools (code, name, zone, students, tablets, routers,
        contact_name, contact_role, contact_phone, contact_email,
        it_name, it_email, coordinator_name, coordinator_email,
        lrs_ip, isp, assigned_admin_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [finalCode, name, zone || null, students || 0, tablets || 0, routers || 0,
        contact_name || null, contact_role || null, contact_phone || null, contact_email || null,
        it_name || null, it_email || null, coordinator_name || null, coordinator_email || null,
        lrs_ip || '192.168.0.10', isp || null, assigned_admin_id || null]
    );

    await logAudit({
      actor: req.user, ip: req.ip, action: 'school.created', entityType: 'school', entityId: result.insertId,
      summary: `Created school "${name}"`, meta: { code: finalCode, zone }
    });

    res.status(201).json({ id: result.insertId, code: finalCode, message: 'School created successfully.' });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const { name, zone, students, tablets, routers,
      contact_name, contact_role, contact_phone, contact_email,
      it_name, it_email, coordinator_name, coordinator_email,
      lrs_ip, isp, assigned_admin_id } = req.body;

    const [result] = await pool.query(
      `UPDATE schools SET name=?, zone=?, students=?, tablets=?, routers=?,
        contact_name=?, contact_role=?, contact_phone=?, contact_email=?,
        it_name=?, it_email=?, coordinator_name=?, coordinator_email=?,
        lrs_ip=?, isp=?, assigned_admin_id=? WHERE id=?`,
      [name, zone || null, students || 0, tablets || 0, routers || 0,
        contact_name || null, contact_role || null, contact_phone || null, contact_email || null,
        it_name || null, it_email || null, coordinator_name || null, coordinator_email || null,
        lrs_ip || null, isp || null, assigned_admin_id || null, req.params.id]
    );

    if (!result.affectedRows) return res.status(404).json({ error: 'School not found.' });

    await logAudit({
      actor: req.user, ip: req.ip, action: 'school.updated', entityType: 'school', entityId: req.params.id,
      summary: `Updated school "${name}"`
    });

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
