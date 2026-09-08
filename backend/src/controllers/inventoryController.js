const pool = require('../config/database');
const lc = require('../config/lifecycle');
const { logAudit } = require('../services/audit');

// Returns true if `user` may modify a device belonging to `schoolId`.
// admin: any · school: only own school · subadmin: only assigned schools · teacher/other: never.
async function canWriteSchool(user, schoolId) {
  if (user.role === 'admin') return true;
  if (user.role === 'school') return user.school_id === schoolId;
  if (user.role === 'subadmin') {
    const [allowed] = await pool.query(
      'SELECT id FROM schools WHERE id = ? AND assigned_admin_id = ?', [schoolId, user.id]
    );
    return allowed.length > 0;
  }
  return false;
}

async function getAll(req, res, next) {
  try {
    let query = `SELECT t.*, s.name as school_name,
        ${lc.lifecycleSelect('t')},
        ${lc.repeatOffenderExpr('t')} AS repeat_offender
      FROM tablets t
      JOIN schools s ON t.school_id = s.id`;
    const params = [];
    const conditions = [];

    if (req.user.role === 'school' || req.user.role === 'teacher') {
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
      conditions.push("(t.serial_number LIKE ? OR t.asset_tag LIKE ? OR t.student_name LIKE ? OR t.batch_ref LIKE ?)");
      const s = `%${req.query.search}%`;
      params.push(s, s, s, s);
    }

    // Lifecycle filters (feature 4). warranty=unknown is a real answer — the
    // devices whose paperwork is missing are the ones worth chasing.
    if (req.query.batch) { conditions.push('t.batch_ref = ?'); params.push(req.query.batch); }
    if (req.query.repeat_offender === 'true') conditions.push(lc.repeatOffenderExpr('t'));
    const warrantyClause = {
      unknown: 't.warranty_expires_on IS NULL',
      expired: 't.warranty_expires_on < CURDATE()',
      expiring: `t.warranty_expires_on >= CURDATE() AND t.warranty_expires_on <= DATE_ADD(CURDATE(), INTERVAL ${lc.WARRANTY_WARN_DAYS} DAY)`,
      active: `t.warranty_expires_on > DATE_ADD(CURDATE(), INTERVAL ${lc.WARRANTY_WARN_DAYS} DAY)`
    }[req.query.warranty];
    if (warrantyClause) conditions.push(warrantyClause);

    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY t.asset_tag ASC, t.serial_number ASC';

    const [rows] = await pool.query(query, params);
    // The repair-or-replace sentence is composed once, server-side, so the same
    // wording appears in the list, the detail view and the refresh plan.
    res.json(rows.map(r => ({ ...r, repeat_offender: !!Number(r.repeat_offender), lifecycle_verdict: lc.verdict(r) })));
  } catch (err) { next(err); }
}

async function getStats(req, res, next) {
  try {
    let schoolFilter = '';
    const params = [];
    if (req.user.role === 'school' || req.user.role === 'teacher') {
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

    if ((req.user.role === 'school' || req.user.role === 'teacher') && rows[0].school_id !== req.user.school_id) {
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
      year_first_used, status, student_name, admission_no, last_checked, notes,
      purchase_date, purchase_cost, supplier, warranty_expires_on, expected_eol_on, batch_ref } = req.body;

    if (!serial_number) return res.status(400).json({ error: 'Serial number is required' });

    const sid = req.user.role === 'school' ? req.user.school_id : school_id;
    if (!sid) return res.status(400).json({ error: 'School is required' });

    if (req.user.role === 'subadmin') {
      const [allowed] = await pool.query('SELECT id FROM schools WHERE id = ? AND assigned_admin_id = ?', [sid, req.user.id]);
      if (!allowed.length) return res.status(403).json({ error: 'You can only add devices to your assigned schools' });
    }

    const [result] = await pool.query(
      `INSERT INTO tablets (school_id, serial_number, asset_tag, form, stream, model,
        year_first_used, status, student_name, admission_no, last_checked, notes, assigned_at,
        purchase_date, purchase_cost, supplier, warranty_expires_on, expected_eol_on, batch_ref)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [sid, serial_number, asset_tag || null, form || null, stream || null, model || null,
        year_first_used || null, status || 'Working', student_name || null, admission_no || null,
        last_checked || null, notes || null, student_name ? new Date() : null,
        purchase_date || null, purchase_cost || null, supplier || null,
        warranty_expires_on || null, expected_eol_on || null, batch_ref || null]
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
      year_first_used, status, student_name, admission_no, last_checked, notes,
      purchase_date, purchase_cost, supplier, warranty_expires_on, expected_eol_on, batch_ref } = req.body;

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
        -- COALESCE, not assignment: an edit form that does not carry the
        -- purchase fields must not erase the procurement record.
        purchase_date = COALESCE(?, purchase_date),
        purchase_cost = COALESCE(?, purchase_cost),
        supplier = COALESCE(?, supplier),
        warranty_expires_on = COALESCE(?, warranty_expires_on),
        expected_eol_on = COALESCE(?, expected_eol_on),
        batch_ref = COALESCE(?, batch_ref),
        updated_at=NOW() WHERE id=?`,
      [serial_number, asset_tag || null, form || null, stream || null, model || null,
        year_first_used || null, status || old.status, student_name || null, admission_no || null,
        last_checked || null, notes || null, student_name, student_name,
        purchase_date || null, purchase_cost || null, supplier || null,
        warranty_expires_on || null, expected_eol_on || null, batch_ref || null,
        req.params.id]
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

    if (!(await canWriteSchool(req.user, current[0].school_id))) {
      return res.status(403).json({ error: 'Access denied' });
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

    if (!(await canWriteSchool(req.user, current[0].school_id))) {
      return res.status(403).json({ error: 'Access denied' });
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
    if (req.user.role === 'school' || req.user.role === 'teacher') {
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

/** Role scoping shared by the two lifecycle reports. */
function scopeFor(user, schoolId) {
  const conditions = [];
  const params = [];
  if (user.role === 'school' || user.role === 'teacher') {
    conditions.push('t.school_id = ?');
    params.push(user.school_id);
  } else if (user.role === 'subadmin') {
    conditions.push('t.school_id IN (SELECT id FROM schools WHERE assigned_admin_id = ?)');
    params.push(user.id);
    if (schoolId) { conditions.push('t.school_id = ?'); params.push(schoolId); }
  } else if (schoolId) {
    conditions.push('t.school_id = ?');
    params.push(schoolId);
  }
  return { where: conditions.length ? 'WHERE ' + conditions.join(' AND ') : '', params };
}

/**
 * GET /api/inventory/refresh-plan
 *
 * The procurement request, generated rather than assembled by hand: devices
 * past their expected end of life, out of warranty with a fault history, or
 * repeat offenders — with the replacement cost totalled from what devices
 * actually cost.
 *
 * Devices with no purchase record are reported separately, not silently
 * dropped and not counted as due. Missing paperwork is its own action item.
 */
async function refreshPlan(req, res, next) {
  try {
    const { where, params } = scopeFor(req.user, req.query.school_id);

    const [rows] = await pool.query(
      `SELECT t.id, t.serial_number, t.asset_tag, t.model, t.form, t.status,
              t.purchase_date, t.purchase_cost, t.supplier, t.warranty_expires_on,
              t.expected_eol_on, t.batch_ref, s.name AS school_name,
              ${lc.lifecycleSelect('t')},
              ${lc.repeatOffenderExpr('t')} AS repeat_offender
       FROM tablets t JOIN schools s ON t.school_id = s.id
       ${where}
       ORDER BY s.name, t.asset_tag, t.serial_number`,
      params
    );

    // A median, not a mean: one mistyped cost would drag an average up and
    // inflate the whole procurement request.
    const costs = rows.map(r => Number(r.purchase_cost))
      .filter(c => Number.isFinite(c) && c > 0)
      .sort((a, b) => a - b);
    const medianCost = costs.length
      ? (costs.length % 2
          ? costs[(costs.length - 1) / 2]
          : (costs[costs.length / 2 - 1] + costs[costs.length / 2]) / 2)
      : null;

    const due = [];
    let noRecord = 0;
    for (const r of rows) {
      const repeat = !!Number(r.repeat_offender);
      const faults = Number(r.fault_count);
      const reasons = [];
      if (r.eol_state === 'past') reasons.push('past expected end of life');
      if (repeat) reasons.push(faults + ' recorded fault' + (faults === 1 ? '' : 's'));
      if (r.warranty_state === 'expired' && faults > 0) reasons.push('out of warranty with a fault history');
      if (r.status === 'Lost/Missing') reasons.push('recorded lost');

      if (!r.purchase_date && !r.warranty_expires_on && !r.expected_eol_on) noRecord++;
      if (!reasons.length) continue;

      due.push({
        id: r.id,
        serial_number: r.serial_number,
        asset_tag: r.asset_tag,
        model: r.model,
        school_name: r.school_name,
        form: r.form,
        status: r.status,
        batch_ref: r.batch_ref,
        supplier: r.supplier,
        fault_count: faults,
        repeat_offender: repeat,
        warranty_state: r.warranty_state,
        eol_state: r.eol_state,
        age_months: r.age_months == null ? null : Number(r.age_months),
        reasons,
        lifecycle_verdict: lc.verdict(r),
        // What this one cost, or the fleet median when it has no recorded cost.
        // Flagged either way so nobody mistakes an estimate for a price.
        replacement_cost: r.purchase_cost != null ? Number(r.purchase_cost) : medianCost,
        replacement_cost_estimated: r.purchase_cost == null
      });
    }

    const priced = due.filter(d => d.replacement_cost != null);
    const total = priced.reduce((sum, d) => sum + Number(d.replacement_cost), 0);

    res.json({
      devices_total: rows.length,
      due_count: due.length,
      // Null, never 0, when nothing can be priced: a zero would read as "free
      // to replace". Same rule as the SLA card — do not invent a number.
      estimated_cost: priced.length ? Math.round(total) : null,
      currency: 'TZS',
      priced_from_own_record: due.filter(d => !d.replacement_cost_estimated && d.replacement_cost != null).length,
      priced_from_fleet_median: due.filter(d => d.replacement_cost_estimated && d.replacement_cost != null).length,
      unpriced: due.filter(d => d.replacement_cost == null).length,
      median_device_cost: medianCost,
      devices_without_any_purchase_record: noRecord,
      due
    });
  } catch (err) { next(err); }
}

/**
 * GET /api/inventory/batches
 *
 * Fault rate per procurement batch. Devices bought together and used
 * identically fail together, so this is a stronger signal than any single
 * device — and it is the argument a supplier can be held to.
 */
async function batches(req, res, next) {
  try {
    const { where, params } = scopeFor(req.user, req.query.school_id);
    const scoped = where ? where + ' AND t.batch_ref IS NOT NULL' : 'WHERE t.batch_ref IS NOT NULL';

    const [rows] = await pool.query(
      `SELECT t.batch_ref,
              COUNT(*) AS devices,
              MIN(t.purchase_date) AS purchased,
              MIN(t.supplier) AS supplier,
              MIN(t.warranty_expires_on) AS warranty_expires_on,
              ROUND(AVG(t.purchase_cost), 2) AS avg_cost,
              SUM(t.status IN ('Faulty', 'In Repair')) AS faulty_now,
              SUM(${lc.repeatOffenderExpr('t')}) AS repeat_offenders
       FROM tablets t
       ${scoped}
       GROUP BY t.batch_ref
       ORDER BY (SUM(t.status IN ('Faulty', 'In Repair')) / COUNT(*)) DESC, t.batch_ref`,
      params
    );

    res.json(rows.map(r => ({
      batch_ref: r.batch_ref,
      devices: Number(r.devices),
      purchased: r.purchased,
      supplier: r.supplier,
      warranty_expires_on: r.warranty_expires_on,
      avg_cost: r.avg_cost == null ? null : Number(r.avg_cost),
      faulty_now: Number(r.faulty_now),
      repeat_offenders: Number(r.repeat_offenders),
      fault_rate_pct: Number(r.devices) ? Math.round((Number(r.faulty_now) / Number(r.devices)) * 100) : 0
    })));
  } catch (err) { next(err); }
}

module.exports = { getAll, getStats, getById, create, update, assignDevice, changeStatus, bulkImport, exportDevices, remove, refreshPlan, batches };
