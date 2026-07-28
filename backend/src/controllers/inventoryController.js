const pool = require('../config/database');
const { logAudit } = require('../services/audit');

async function getAll(req, res, next) {
  try {
    let query = `SELECT t.*, s.name as school_name FROM tablets t
      JOIN schools s ON t.school_id = s.id`;
    const params = [];
    const conditions = [];

    if (req.user.role === 'school') {
      conditions.push('t.school_id = ?');
      params.push(req.user.school_id);
    } else if (req.user.role === 'subadmin') {
      conditions.push('t.school_id IN (SELECT id FROM schools WHERE assigned_admin_id = ?)');
      params.push(req.user.id);
      if (req.query.school_id) { conditions.push('t.school_id = ?'); params.push(req.query.school_id); }
    } else if (req.query.school_id) {
      conditions.push('t.school_id = ?');
      params.push(req.query.school_id);
    }

    if (req.query.status) { conditions.push('t.status = ?'); params.push(req.query.status); }
    if (req.query.form) { conditions.push('t.form = ?'); params.push(req.query.form); }
    if (req.query.search) {
      conditions.push("(t.serial_number LIKE ? OR t.asset_tag LIKE ? OR t.student_name LIKE ?)");
      const s = `%${req.query.search}%`;
      params.push(s, s, s);
    }

    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY t.asset_tag ASC, t.serial_number ASC';

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) { next(err); }
}

async function getStats(req, res, next) {
  try {
    let schoolFilter = '';
    const params = [];
    if (req.user.role === 'school') {
      schoolFilter = 'WHERE school_id = ?';
      params.push(req.user.school_id);
    } else if (req.user.role === 'subadmin') {
      schoolFilter = 'WHERE school_id IN (SELECT id FROM schools WHERE assigned_admin_id = ?)';
      params.push(req.user.id);
    } else if (req.query.school_id) {
      schoolFilter = 'WHERE school_id = ?';
      params.push(req.query.school_id);
    }

    const [totals] = await pool.query(`SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'Working' THEN 1 ELSE 0 END) as working,
      SUM(CASE WHEN status = 'Needs Setup' THEN 1 ELSE 0 END) as needs_setup,
      SUM(CASE WHEN status = 'In Repair' THEN 1 ELSE 0 END) as in_repair,
      SUM(CASE WHEN status = 'Faulty' THEN 1 ELSE 0 END) as faulty,
      SUM(CASE WHEN status = 'Lost/Missing' THEN 1 ELSE 0 END) as lost_missing,
      SUM(CASE WHEN student_name IS NOT NULL AND student_name != '' THEN 1 ELSE 0 END) as assigned,
      SUM(CASE WHEN student_name IS NULL OR student_name = '' THEN 1 ELSE 0 END) as unassigned,
      SUM(CASE WHEN last_checked < DATE_SUB(CURDATE(), INTERVAL 30 DAY) OR last_checked IS NULL THEN 1 ELSE 0 END) as overdue_check
      FROM tablets ${schoolFilter}`, params);

    const [byForm] = await pool.query(`SELECT form, status, COUNT(*) as count
      FROM tablets ${schoolFilter} GROUP BY form, status ORDER BY form`, params);

    res.json({ summary: totals[0], byForm });
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT t.*, s.name as school_name FROM tablets t JOIN schools s ON t.school_id = s.id WHERE t.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Device not found' });

    if (req.user.role === 'school' && rows[0].school_id !== req.user.school_id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (req.user.role === 'subadmin') {
      const [allowed] = await pool.query('SELECT id FROM schools WHERE id = ? AND assigned_admin_id = ?', [rows[0].school_id, req.user.id]);
      if (!allowed.length) return res.status(403).json({ error: 'Access denied' });
    }

    const [history] = await pool.query(
      'SELECT * FROM tablet_history WHERE tablet_id = ? ORDER BY created_at DESC LIMIT 50',
      [req.params.id]
    );

    res.json({ ...rows[0], history });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { school_id, serial_number, asset_tag, form, stream, model,
      year_first_used, status, student_name, admission_no, last_checked, notes } = req.body;

    if (!serial_number) return res.status(400).json({ error: 'Serial number is required' });

    const sid = req.user.role === 'school' ? req.user.school_id : school_id;
    if (!sid) return res.status(400).json({ error: 'School is required' });

    if (req.user.role === 'subadmin') {
      const [allowed] = await pool.query('SELECT id FROM schools WHERE id = ? AND assigned_admin_id = ?', [sid, req.user.id]);
      if (!allowed.length) return res.status(403).json({ error: 'You can only add devices to your assigned schools' });
    }

    const [result] = await pool.query(
      `INSERT INTO tablets (school_id, serial_number, asset_tag, form, stream, model,
        year_first_used, status, student_name, admission_no, last_checked, notes, assigned_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [sid, serial_number, asset_tag || null, form || null, stream || null, model || null,
        year_first_used || null, status || 'Working', student_name || null, admission_no || null,
        last_checked || null, notes || null, student_name ? new Date() : null]
    );

    await pool.query(
      'INSERT INTO tablet_history (tablet_id, action, new_value, actor_name, note) VALUES (?, ?, ?, ?, ?)',
      [result.insertId, 'created', status || 'Working', req.user.full_name || req.user.username, 'Device added to inventory']
    );

    res.status(201).json({ id: result.insertId, message: 'Device added' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Serial number already exists for this school' });
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { serial_number, asset_tag, form, stream, model,
      year_first_used, status, student_name, admission_no, last_checked, notes } = req.body;

    const [current] = await pool.query('SELECT * FROM tablets WHERE id = ?', [req.params.id]);
    if (!current.length) return res.status(404).json({ error: 'Device not found' });
    const old = current[0];

    if (req.user.role === 'school' && old.school_id !== req.user.school_id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (req.user.role === 'subadmin') {
      const [allowed] = await pool.query('SELECT id FROM schools WHERE id = ? AND assigned_admin_id = ?', [old.school_id, req.user.id]);
      if (!allowed.length) return res.status(403).json({ error: 'Access denied' });
    }

    await pool.query(
      `UPDATE tablets SET serial_number=?, asset_tag=?, form=?, stream=?, model=?,
        year_first_used=?, status=?, student_name=?, admission_no=?, last_checked=?, notes=?,
        assigned_at = CASE WHEN ? IS NOT NULL AND ? != '' AND (student_name IS NULL OR student_name = '') THEN NOW() ELSE assigned_at END,
        updated_at=NOW() WHERE id=?`,
      [serial_number, asset_tag || null, form || null, stream || null, model || null,
        year_first_used || null, status || old.status, student_name || null, admission_no || null,
        last_checked || null, notes || null, student_name, student_name, req.params.id]
    );

    if (status && status !== old.status) {
      await pool.query(
        'INSERT INTO tablet_history (tablet_id, action, old_value, new_value, actor_name) VALUES (?, ?, ?, ?, ?)',
        [req.params.id, 'status_change', old.status, status, req.user.full_name || req.user.username]
      );
    }
    if (student_name && student_name !== old.student_name) {
      await pool.query(
        'INSERT INTO tablet_history (tablet_id, action, old_value, new_value, actor_name) VALUES (?, ?, ?, ?, ?)',
        [req.params.id, 'assigned', old.student_name || '(unassigned)', student_name, req.user.full_name || req.user.username]
      );
    }

    res.json({ message: 'Device updated' });
  } catch (err) { next(err); }
}

async function assignDevice(req, res, next) {
  try {
    const { student_name, admission_no } = req.body;
    const [current] = await pool.query('SELECT * FROM tablets WHERE id = ?', [req.params.id]);
    if (!current.length) return res.status(404).json({ error: 'Device not found' });

    if (req.user.role === 'subadmin') {
      const [allowed] = await pool.query('SELECT id FROM schools WHERE id = ? AND assigned_admin_id = ?', [current[0].school_id, req.user.id]);
      if (!allowed.length) return res.status(403).json({ error: 'Access denied' });
    }

    await pool.query(
      'UPDATE tablets SET student_name=?, admission_no=?, assigned_at=NOW(), updated_at=NOW() WHERE id=?',
      [student_name || null, admission_no || null, req.params.id]
    );

    await pool.query(
      'INSERT INTO tablet_history (tablet_id, action, old_value, new_value, actor_name) VALUES (?, ?, ?, ?, ?)',
      [req.params.id, 'assigned', current[0].student_name || '(unassigned)', student_name || '(unassigned)',
        req.user.full_name || req.user.username]
    );

    res.json({ message: student_name ? `Assigned to ${student_name}` : 'Assignment removed' });
  } catch (err) { next(err); }
}

async function changeStatus(req, res, next) {
  try {
    const { status, note } = req.body;
    const validStatuses = ['Working', 'Needs Setup', 'In Repair', 'Faulty', 'Lost/Missing'];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const [current] = await pool.query('SELECT * FROM tablets WHERE id = ?', [req.params.id]);
    if (!current.length) return res.status(404).json({ error: 'Device not found' });

    if (req.user.role === 'subadmin') {
      const [allowed] = await pool.query('SELECT id FROM schools WHERE id = ? AND assigned_admin_id = ?', [current[0].school_id, req.user.id]);
      if (!allowed.length) return res.status(403).json({ error: 'Access denied' });
    }

    await pool.query('UPDATE tablets SET status=?, updated_at=NOW() WHERE id=?', [status, req.params.id]);

    await pool.query(
      'INSERT INTO tablet_history (tablet_id, action, old_value, new_value, actor_name, note) VALUES (?, ?, ?, ?, ?, ?)',
      [req.params.id, 'status_change', current[0].status, status,
        req.user.full_name || req.user.username, note || null]
    );

    res.json({ message: `Status changed to ${status}` });
  } catch (err) { next(err); }
}

async function bulkImport(req, res, next) {
  try {
    const { devices, school_id } = req.body;
    if (!Array.isArray(devices) || !devices.length) {
      return res.status(400).json({ error: 'No devices provided' });
    }

    const sid = req.user.role === 'school' ? req.user.school_id : school_id;
    if (!sid) return res.status(400).json({ error: 'School is required' });

    if (req.user.role === 'subadmin') {
      const [allowed] = await pool.query('SELECT id FROM schools WHERE id = ? AND assigned_admin_id = ?', [sid, req.user.id]);
      if (!allowed.length) return res.status(403).json({ error: 'You can only import devices to your assigned schools' });
    }

    const results = { created: 0, updated: 0, errors: [] };

    for (let i = 0; i < devices.length; i++) {
      const d = devices[i];
      if (!d.serial_number) { results.errors.push({ row: i + 1, error: 'Missing serial number' }); continue; }
      try {
        const [existing] = await pool.query(
          'SELECT id FROM tablets WHERE school_id = ? AND serial_number = ?', [sid, d.serial_number]
        );
        if (existing.length) {
          await pool.query(
            `UPDATE tablets SET asset_tag=COALESCE(?,asset_tag), form=COALESCE(?,form), stream=COALESCE(?,stream),
              model=COALESCE(?,model), year_first_used=COALESCE(?,year_first_used), status=COALESCE(?,status),
              student_name=COALESCE(?,student_name), admission_no=COALESCE(?,admission_no),
              last_checked=COALESCE(?,last_checked), notes=COALESCE(?,notes), updated_at=NOW() WHERE id=?`,
            [d.asset_tag||null, d.form||null, d.stream||null, d.model||null, d.year_first_used||null,
              d.status||null, d.student_name||null, d.admission_no||null, d.last_checked||null,
              d.notes||null, existing[0].id]
          );
          results.updated++;
        } else {
          await pool.query(
            `INSERT INTO tablets (school_id, serial_number, asset_tag, form, stream, model,
              year_first_used, status, student_name, admission_no, last_checked, notes, assigned_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [sid, d.serial_number, d.asset_tag||null, d.form||null, d.stream||null, d.model||null,
              d.year_first_used||null, d.status||'Working', d.student_name||null, d.admission_no||null,
              d.last_checked||null, d.notes||null, d.student_name ? new Date() : null]
          );
          results.created++;
        }
      } catch (e) {
        results.errors.push({ row: i + 1, error: e.message });
      }
    }

    await logAudit({
      actor: req.user, ip: req.ip, action: 'inventory.bulk_import', entityType: 'tablet',
      summary: `Imported ${results.created} new, updated ${results.updated} devices`,
      meta: { school_id: sid, total: devices.length }
    });

    res.json(results);
  } catch (err) { next(err); }
}

async function exportDevices(req, res, next) {
  try {
    let query = 'SELECT * FROM tablets';
    const params = [];
    const conditions = [];
    if (req.user.role === 'school') {
      conditions.push('school_id = ?');
      params.push(req.user.school_id);
    } else if (req.user.role === 'subadmin') {
      conditions.push('school_id IN (SELECT id FROM schools WHERE assigned_admin_id = ?)');
      params.push(req.user.id);
    } else if (req.query.school_id) {
      conditions.push('school_id = ?');
      params.push(req.query.school_id);
    }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY asset_tag ASC';
    const [rows] = await pool.query(query, params);

    const headers = 'serial_number,asset_tag,form,stream,model,year_first_used,status,student_name,admission_no,last_checked,notes';
    const csv = [headers, ...rows.map(r =>
      [r.serial_number, r.asset_tag, r.form, r.stream, r.model, r.year_first_used,
        r.status, r.student_name, r.admission_no, r.last_checked ? r.last_checked.toISOString().split('T')[0] : '', r.notes]
        .map(v => `"${(v||'').toString().replace(/"/g,'""')}"`)
        .join(',')
    )].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=tablet_inventory.csv');
    res.send(csv);
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    if (req.user.role === 'subadmin') {
      const [device] = await pool.query('SELECT school_id FROM tablets WHERE id = ?', [req.params.id]);
      if (!device.length) return res.status(404).json({ error: 'Device not found' });
      const [allowed] = await pool.query('SELECT id FROM schools WHERE id = ? AND assigned_admin_id = ?', [device[0].school_id, req.user.id]);
      if (!allowed.length) return res.status(403).json({ error: 'Access denied' });
    }
    const [result] = await pool.query('DELETE FROM tablets WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Device not found' });
    res.json({ message: 'Device removed' });
  } catch (err) { next(err); }
}

module.exports = { getAll, getStats, getById, create, update, assignDevice, changeStatus, bulkImport, exportDevices, remove };
