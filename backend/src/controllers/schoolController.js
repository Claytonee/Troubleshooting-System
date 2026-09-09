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

    const [forms] = await pool.query(
      'SELECT * FROM school_forms WHERE school_id = ? ORDER BY form_name',
      [school.id]
    );

    res.json({ ...school, errors, checkins, communications: comms, forms });
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
    if (req.user.role === 'school' && parseInt(req.params.id) !== req.user.school_id) {
      return res.status(403).json({ error: 'You can only edit your own school.' });
    }

    const { name, zone, students, tablets, routers,
      contact_name, contact_role, contact_phone, contact_email,
      it_name, it_email, coordinator_name, coordinator_email,
      lrs_ip, isp, assigned_admin_id } = req.body;

    // Fetch current data to detect changes (for notifications)
    const [current] = await pool.query('SELECT * FROM schools WHERE id = ?', [req.params.id]);
    if (!current.length) return res.status(404).json({ error: 'School not found.' });
    const old = current[0];

    const [result] = await pool.query(
      `UPDATE schools SET name=?, zone=?, students=?, tablets=?, routers=?,
        contact_name=?, contact_role=?, contact_phone=?, contact_email=?,
        it_name=?, it_email=?, coordinator_name=?, coordinator_email=?,
        lrs_ip=?, isp=?, assigned_admin_id=? WHERE id=?`,
      [name, zone || null, students || 0, tablets || 0, routers || 0,
        contact_name || null, contact_role || null, contact_phone || null, contact_email || null,
        it_name || null, it_email || null, coordinator_name || null, coordinator_email || null,
        lrs_ip || null, isp || null, req.user.role === 'admin' ? (assigned_admin_id || null) : old.assigned_admin_id, req.params.id]
    );

    // Notify admin when school admin changes contact phone or email
    if (req.user.role === 'school') {
      const changes = [];
      if (contact_phone && contact_phone !== old.contact_phone) {
        changes.push({ field: 'Phone', from: old.contact_phone || '(empty)', to: contact_phone });
      }
      if (contact_email && contact_email !== old.contact_email) {
        changes.push({ field: 'Email', from: old.contact_email || '(empty)', to: contact_email });
      }
      if (changes.length) {
        const changeText = changes.map(c => `${c.field}: ${c.from} → ${c.to}`).join(', ');
        await pool.query(
          `INSERT INTO admin_notifications (target_role, type, title, message, meta) VALUES (?, ?, ?, ?, ?)`,
          ['admin', 'contact_update', `${old.name} — contact info updated`,
            `School admin ${req.user.full_name || req.user.username} updated: ${changeText}`,
            JSON.stringify({ school_id: req.params.id, school_name: old.name, actor: req.user.full_name, changes })]
        );
      }
    }

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

// --- Form-level breakdown ---
async function getForms(req, res, next) {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM school_forms WHERE school_id = ? ORDER BY form_name',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

async function saveForms(req, res, next) {
  try {
    if (req.user.role === 'school' && parseInt(req.params.id) !== req.user.school_id) {
      return res.status(403).json({ error: 'You can only edit your own school.' });
    }

    const { forms } = req.body;
    if (!Array.isArray(forms)) return res.status(400).json({ error: 'forms array is required' });

    await pool.query('DELETE FROM school_forms WHERE school_id = ?', [req.params.id]);

    let totalStudents = 0, totalTablets = 0;
    for (const f of forms) {
      if (!f.form_name) continue;
      const students = parseInt(f.students, 10) || 0;
      const tablets = parseInt(f.tablets, 10) || 0;
      totalStudents += students;
      totalTablets += tablets;
      await pool.query(
        'INSERT INTO school_forms (school_id, form_name, students, tablets) VALUES (?, ?, ?, ?)',
        [req.params.id, f.form_name, students, tablets]
      );
    }

    await pool.query('UPDATE schools SET students = ?, tablets = ? WHERE id = ?',
      [totalStudents, totalTablets, req.params.id]);

    res.json({ message: 'Form data saved', totalStudents, totalTablets });
  } catch (err) { next(err); }
}

// --- CSV Bulk Import ---
async function bulkImport(req, res, next) {
  try {
    const { schools: rows } = req.body;
    if (!Array.isArray(rows) || !rows.length) {
      return res.status(400).json({ error: 'No school data provided' });
    }

    const results = { created: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.name) {
        results.errors.push({ row: i + 1, error: 'School name is required' });
        continue;
      }
      try {
        const code = await uniqueCode(row.name);
        const [result] = await pool.query(
          `INSERT INTO schools (code, name, zone, students, tablets, routers,
            contact_name, contact_role, contact_phone, contact_email,
            it_name, it_email, coordinator_name, coordinator_email,
            lrs_ip, isp, assigned_admin_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [code, row.name, row.zone || row.region || null,
            parseInt(row.students) || 0, parseInt(row.tablets) || 0, parseInt(row.routers) || 0,
            row.contact_name || null, row.contact_role || null,
            row.contact_phone || null, row.contact_email || null,
            row.it_name || null, row.it_email || null,
            row.coordinator_name || null, row.coordinator_email || null,
            row.lrs_ip || '192.168.0.10', row.isp || null, null]
        );

        if (row.forms && Array.isArray(row.forms)) {
          for (const f of row.forms) {
            if (!f.form_name) continue;
            await pool.query(
              'INSERT INTO school_forms (school_id, form_name, students, tablets) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE students = VALUES(students), tablets = VALUES(tablets)',
              [result.insertId, f.form_name, parseInt(f.students) || 0, parseInt(f.tablets) || 0]
            );
          }
        }

        results.created++;
      } catch (e) {
        results.errors.push({ row: i + 1, error: e.message || 'Database error' });
      }
    }

    await logAudit({
      actor: req.user, ip: req.ip, action: 'school.bulk_import', entityType: 'school',
      summary: `Bulk imported ${results.created} schools`, meta: { total: rows.length, errors: results.errors.length }
    });

    res.json(results);
  } catch (err) { next(err); }
}

// --- Admin Notifications ---
async function getNotifications(req, res, next) {
  try {
    let query, params;
    if (req.user.role === 'admin') {
      query = 'SELECT * FROM admin_notifications WHERE target_role = ? ORDER BY created_at DESC LIMIT 50';
      params = ['admin'];
    } else if (req.user.role === 'subadmin') {
      query = `SELECT * FROM admin_notifications WHERE target_role = 'subadmin' AND CAST(JSON_UNQUOTE(JSON_EXTRACT(meta, '$.assigned_to')) AS UNSIGNED) = ? ORDER BY created_at DESC LIMIT 50`;
      params = [req.user.id];
    } else if (req.user.role === 'school') {
      // Scoped by the school on the notification, not just the role — one
      // school's escalations must never appear on another school's bell.
      if (!req.user.school_id) return res.json([]);
      query = `SELECT * FROM admin_notifications
                WHERE target_role = 'school'
                  AND CAST(JSON_UNQUOTE(JSON_EXTRACT(meta, '$.school_id')) AS UNSIGNED) = ?
                ORDER BY created_at DESC LIMIT 50`;
      params = [req.user.school_id];
    } else {
      return res.json([]);
    }
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) { next(err); }
}

async function markNotificationRead(req, res, next) {
  try {
    // A school admin may only clear their own school's notifications; head
    // office may clear anything it can see.
    if (req.user.role === 'school') {
      await pool.query(
        `UPDATE admin_notifications SET is_read = true
          WHERE id = ? AND target_role = 'school'
            AND CAST(JSON_UNQUOTE(JSON_EXTRACT(meta, '$.school_id')) AS UNSIGNED) = ?`,
        [req.params.id, req.user.school_id || 0]
      );
    } else {
      await pool.query('UPDATE admin_notifications SET is_read = true WHERE id = ?', [req.params.id]);
    }
    res.json({ message: 'Marked as read' });
  } catch (err) { next(err); }
}

module.exports = { getAll, getById, create, update, remove, reassignAdmin, getForms, saveForms, bulkImport, getNotifications, markNotificationRead };
