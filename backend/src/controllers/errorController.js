const crypto = require('crypto');
const streamifier = require('streamifier');
const cloudinary = require('../config/cloudinary');
const pool = require('../config/database');
const { toCsv } = require('../utils/csv');
const { logAudit } = require('../services/audit');
const { notifyErrorEvent } = require('../services/notify');
const { notifyErrorSms } = require('../services/sms');
const { targetHours } = require('../services/sla');
const intake = require('../services/intake');

function getResourceType(mimetype) {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/') || mimetype.startsWith('audio/')) return 'video';
  return 'raw';
}

function uploadToCloudinary(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (result) resolve(result);
      else reject(error);
    });
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

async function uploadAttachments(files, errorId, uploadedBy) {
  const results = [];
  for (const file of files) {
    const resourceType = getResourceType(file.mimetype);
    const cloudResult = await uploadToCloudinary(file.buffer, {
      resource_type: resourceType,
      folder: 'qft-errors',
      public_id: Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')
    });
    await pool.query(
      'INSERT INTO error_attachments (error_id, original_filename, stored_url, file_type, file_size, resource_type, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [errorId, file.originalname, cloudResult.secure_url, file.mimetype, file.size, resourceType, uploadedBy]
    );
    results.push({ url: cloudResult.secure_url, filename: file.originalname, type: file.mimetype });
  }
  return results;
}

// Ensure a resolved error has a CSAT feedback token (for the rating link). Returns the token.
async function ensureCsatToken(errorId) {
  const [rows] = await pool.query('SELECT csat_token FROM errors WHERE id = ?', [errorId]);
  if (rows.length && rows[0].csat_token) return rows[0].csat_token;
  const token = crypto.randomBytes(16).toString('hex');
  await pool.query('UPDATE errors SET csat_token = ? WHERE id = ?', [token, errorId]);
  return token;
}

// SQL fragment: 1 when an unresolved error is past its SLA due date.
const SLA_BREACH_SELECT = `CASE WHEN e.status != 'resolved' AND e.sla_due_at IS NOT NULL AND e.sla_due_at < NOW() THEN 1 ELSE 0 END AS sla_breached`;

// The errors.hours_open column is written once at insert and never recomputed,
// so it freezes at the age the row had when it was created. Derive the age from
// created_at instead — in SQL, so it uses the same clock as sla_due_at. The
// column is left in place (additive-only schema rule); it is simply not served.
const HOURS_OPEN_SELECT = `ROUND(TIMESTAMPDIFF(MINUTE, e.created_at, COALESCE(e.resolved_at, NOW())) / 60, 1) AS hours_open_live`;

// Response shaping lives in the DTO layer: it resolves hours_open from
// hours_open_live and whitelists the columns, so adding a column to the errors
// table never silently exports it (docs/features/DTO.md).
const { shapers } = require('../dto');

// Tenant access check for a single error row. Returns true if `user` may view/modify it.
// admin: any · school: own school · teacher: own-reported · subadmin: schools assigned to them.
async function userCanAccessError(user, errorRow) {
  if (!errorRow) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'school') return errorRow.school_id === user.school_id;
  if (user.role === 'teacher') return errorRow.reported_by_user_id === user.id;
  if (user.role === 'subadmin') {
    const [allowed] = await pool.query(
      'SELECT id FROM schools WHERE id = ? AND assigned_admin_id = ?', [errorRow.school_id, user.id]
    );
    return allowed.length > 0;
  }
  return false;
}

// Email recipients for an error: the assigned engineer + any school-admin accounts of that school.
async function getRecipients(errorId) {
  const [rows] = await pool.query(`
    SELECT u.email FROM errors e JOIN users u ON e.assigned_to = u.id WHERE e.id = ? AND u.email IS NOT NULL
    UNION
    SELECT u.email FROM errors e JOIN users u ON u.school_id = e.school_id AND u.role = 'school' WHERE e.id = ? AND u.email IS NOT NULL
  `, [errorId, errorId]);
  return rows.map(r => r.email).filter(Boolean);
}

// Phone numbers for SMS: assigned engineer + school contact.
async function getPhoneRecipients(errorId) {
  const [rows] = await pool.query(`
    SELECT u.phone AS p FROM errors e JOIN users u ON e.assigned_to = u.id WHERE e.id = ? AND u.phone IS NOT NULL
    UNION
    SELECT s.contact_phone AS p FROM errors e JOIN schools s ON e.school_id = s.id WHERE e.id = ? AND s.contact_phone IS NOT NULL
  `, [errorId, errorId]);
  return rows.map(r => r.p).filter(Boolean);
}

// Full error row (with school name) for notification payloads.
async function getErrorRow(id) {
  const [r] = await pool.query(
    `SELECT e.*, s.name AS school_name FROM errors e JOIN schools s ON e.school_id = s.id WHERE e.id = ?`, [id]
  );
  return r[0];
}

// Shared WHERE/params for the error list, honouring role scope + query filters.
function buildErrorFilters(req) {
  const conditions = [];
  const params = [];

  if (req.user.role === 'subadmin') {
    conditions.push('(s.assigned_admin_id = ? OR e.assigned_to = ?)');
    params.push(req.user.id, req.user.id);
  } else if (req.user.role === 'school') {
    conditions.push('s.id = ?');
    params.push(req.user.school_id);
  } else if (req.user.role === 'teacher') {
    conditions.push('e.reported_by_user_id = ?');
    params.push(req.user.id);
  }
  if (req.query.status && req.query.status !== 'all') { conditions.push('e.status = ?'); params.push(req.query.status); }
  if (req.query.priority) { conditions.push('e.priority = ?'); params.push(req.query.priority); }
  if (req.query.category) { conditions.push('e.category = ?'); params.push(req.query.category); }
  if (req.query.school_id) { conditions.push('e.school_id = ?'); params.push(req.query.school_id); }
  if (req.query.search) {
    conditions.push('(e.title LIKE ? OR e.error_code LIKE ? OR s.name LIKE ?)');
    const term = `%${req.query.search}%`;
    params.push(term, term, term);
  }
  return { where: conditions.length ? ' WHERE ' + conditions.join(' AND ') : '', params };
}

async function getAll(req, res, next) {
  try {
    const { where, params } = buildErrorFilters(req);
    let query = `
      SELECT e.*, s.name as school_name, s.code as school_code, s.zone as school_zone,
      u.full_name as assigned_name, u.color as assigned_color,
      ${SLA_BREACH_SELECT}, ${HOURS_OPEN_SELECT}
      FROM errors e
      JOIN schools s ON e.school_id = s.id
      LEFT JOIN users u ON e.assigned_to = u.id${where}
      ORDER BY e.created_at DESC`;

    if (req.query.limit) {
      query += ' LIMIT ?';
      params.push(parseInt(req.query.limit));
    }

    const [rows] = await pool.query(query, params);
    res.json(rows.map(shapers.pickError));
  } catch (err) { next(err); }
}

// CSV export of the (filtered, role-scoped) error list — Tier 1 #4.
async function exportErrors(req, res, next) {
  try {
    const { where, params } = buildErrorFilters(req);
    const [rows] = await pool.query(`
      SELECT e.error_code, e.title, e.category, e.subcategory, e.priority, e.status,
      s.name as school_name, s.zone as school_zone, u.full_name as assigned_name,
      e.reporter_name, ${HOURS_OPEN_SELECT}, e.sla_due_at,
      ${SLA_BREACH_SELECT}, e.created_at, e.resolved_at
      FROM errors e
      JOIN schools s ON e.school_id = s.id
      LEFT JOIN users u ON e.assigned_to = u.id${where}
      ORDER BY e.created_at DESC`, params);

    const columns = [
      { key: 'error_code', label: 'Code' }, { key: 'title', label: 'Title' },
      { key: 'category', label: 'Category' }, { key: 'subcategory', label: 'Subcategory' },
      { key: 'priority', label: 'Priority' }, { key: 'status', label: 'Status' },
      { key: 'school_name', label: 'School' }, { key: 'school_zone', label: 'Zone' },
      { key: 'assigned_name', label: 'Assigned To' }, { key: 'reporter_name', label: 'Reporter' },
      { key: 'hours_open_live', label: 'Hours Open' }, { key: 'sla_due_at', label: 'SLA Due' },
      { key: 'sla_breached', label: 'SLA Breached' }, { key: 'created_at', label: 'Created' },
      { key: 'resolved_at', label: 'Resolved' }
    ];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="errors-export.csv"');
    res.send(toCsv(rows, columns));
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const [rows] = await pool.query(`
      SELECT e.*, s.name as school_name, s.code as school_code,
      u.full_name as assigned_name, u.color as assigned_color,
      ${SLA_BREACH_SELECT}, ${HOURS_OPEN_SELECT}
      FROM errors e
      JOIN schools s ON e.school_id = s.id
      LEFT JOIN users u ON e.assigned_to = u.id
      WHERE e.id = ?
    `, [req.params.id]);

    if (!rows.length) return res.status(404).json({ error: 'Error not found.' });

    if (!(await userCanAccessError(req.user, rows[0]))) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const [updates] = await pool.query(
      'SELECT * FROM error_updates WHERE error_id = ? ORDER BY created_at DESC',
      [req.params.id]
    );

    const [attachments] = await pool.query(
      'SELECT id, original_filename, stored_url, file_type, file_size, resource_type, uploaded_by, created_at FROM error_attachments WHERE error_id = ? ORDER BY created_at ASC',
      [req.params.id]
    );

    res.json({ ...shapers.pickErrorDetail(rows[0], req.user), updates, attachments });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { title, description, school_id, category, subcategory, priority, reporter_name, reporter_role, reporter_contact, location, affected_devices } = req.body;

    if ((req.user.role === 'school' || req.user.role === 'teacher') && parseInt(school_id) !== req.user.school_id) {
      return res.status(403).json({ error: 'You can only report errors for your own school.' });
    }

    // Offline replay: a queued POST whose response was lost still committed on
    // the server, so a retry must return the existing row rather than file the
    // same fault twice (docs/features/02-offline-pwa.md).
    const clientRef = req.body.client_ref ? String(req.body.client_ref).slice(0, 64) : null;
    if (clientRef) {
      const [prior] = await pool.query('SELECT id FROM errors WHERE client_ref = ?', [clientRef]);
      if (prior.length) {
        const existing = await getErrorRow(prior[0].id);
        return res.status(200).json({ ...shapers.pickErrorDetail(existing, req.user), deduplicated: true });
      }
    }

    // Derive next code from the highest numeric code (not last-inserted row),
    // so seeded data with non-sequential ids can't cause a duplicate code.
    const [mx] = await pool.query(
      "SELECT MAX(CAST(SUBSTRING(error_code, 5) AS UNSIGNED)) AS maxnum FROM errors WHERE error_code LIKE 'QFT-%'"
    );
    const seq = ((mx[0] && mx[0].maxnum) ? mx[0].maxnum : 240) + 1;
    const errorCode = `QFT-0${seq}`;

    const [school] = await pool.query('SELECT assigned_admin_id FROM schools WHERE id = ?', [school_id]);
    const fieldEngineer = school.length ? school[0].assigned_admin_id : null;

    const prio = priority || 'medium';
    const slaHours = targetHours(prio);

    /**
     * Who this lands on.
     *
     * A teacher's fault used to be assigned to the school's field engineer the
     * moment it was filed, which skipped the person who can walk to the room:
     * their own school administrator. Reported 2026-09-09 — "error haikupitia
     * kwa school admin, ilienda moja kwa moja kwa platform admin". So a
     * teacher's report is created UNASSIGNED at school level, and the school
     * admin is notified; they fix it or escalate it on with the Escalate
     * action, which is what sets escalation_level = 'platform'.
     *
     * One exception, and it is deliberate: **critical** goes to the engineer
     * immediately as well. Critical means the school cannot teach today, and a
     * ticket like that must not wait for someone to open their bell. The school
     * admin is still notified — they are told, they are simply not the only
     * one.
     *
     * A school admin's own report still goes straight to platform: they ARE the
     * school level, so there is nobody below to triage it.
     */
    // The rule lives in services/intake.js — four channels file faults now, and
    // the copy that used to live in the WhatsApp handler had already drifted.
    const route = intake.routeFor({
      reporterRole: req.user.role,
      priority: prio,
      fieldEngineerId: fieldEngineer
    });
    const assignedTo = route.assignedTo;
    const escalationLevel = route.escalationLevel;
    const critical = route.critical;

    const [result] = await pool.query(
      `INSERT INTO errors (error_code, title, description, school_id, category, subcategory, priority, status, assigned_to, reporter_name, reporter_role, reporter_contact, location, affected_devices, sla_due_at, escalation_level, reported_by_user_id, client_ref, intake_channel)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR), ?, ?, ?, 'web')`,
      [errorCode, title, description, school_id, category, subcategory || null, prio, assignedTo, reporter_name || null, reporter_role || null, reporter_contact || null, location || null, affected_devices || null, slaHours, escalationLevel, req.user.id, clientRef]
    );

    await logAudit({
      actor: req.user, ip: req.ip, action: 'error.created', entityType: 'error', entityId: result.insertId,
      summary: `Reported ${prio} issue "${title}" (${errorCode})`, meta: { priority: prio, category, school_id }
    });

    // Notify assignee + school admins (best-effort; no-op if SMTP unconfigured).
    const row = await getErrorRow(result.insertId);
    const recipients = await getRecipients(result.insertId);
    notifyErrorEvent('created', row, { recipients, actorName: req.user.full_name });

    // A teacher's fault also lands on the school administrator's bell. Email is
    // best-effort and unconfigured on this deployment, so in-app is the only
    // channel that actually reaches them.
    if (route.notifySchoolAdmin) {
      await intake.notifySchoolAdmin({
        schoolId: school_id, errorId: result.insertId, errorCode,
        priority: prio, category, reporterName: req.user.full_name, critical
      });
    }
    // Critical issues also fire an SMS (most reliable channel in the field).
    if (prio === 'critical') {
      const phones = await getPhoneRecipients(result.insertId);
      notifyErrorSms('created', row, { phones });
    }

    // Upload attachments if any
    let attachments = [];
    if (req.files && req.files.length > 0) {
      attachments = await uploadAttachments(req.files, result.insertId, req.user.full_name);
    }

    res.status(201).json({ id: result.insertId, error_code: errorCode, attachments, message: 'Error reported successfully.' });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const { title, description, category, subcategory, priority, status, assigned_to, location, affected_devices } = req.body;

    const prev = await getErrorRow(req.params.id);
    if (!prev) return res.status(404).json({ error: 'Error not found.' });

    if (!(await userCanAccessError(req.user, prev))) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    // The full edit carries `status` too, so the same rule has to hold here or
    // it is simply a second door into the same room.
    if (status && status !== prev.status && teacherMayNotSetStatus(req, res)) return;

    const resolvedAt = status === 'resolved' ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null;
    const slaHours = targetHours(priority);

    // Recompute SLA due date relative to original creation when priority changes.
    await pool.query(
      `UPDATE errors SET title=?, description=?, category=?, subcategory=?, priority=?, status=?, assigned_to=?, location=?, affected_devices=?,
         sla_due_at = DATE_ADD(created_at, INTERVAL ? HOUR),
         resolved_at=COALESCE(?, resolved_at)
       WHERE id=?`,
      [title, description, category, subcategory, priority, status, assigned_to || null, location, affected_devices, slaHours, resolvedAt, req.params.id]
    );

    await logAudit({
      actor: req.user, ip: req.ip, action: 'error.updated', entityType: 'error', entityId: req.params.id,
      summary: `Edited ${prev.error_code} "${title}"`,
      meta: { from: { status: prev.status, priority: prev.priority }, to: { status, priority } }
    });

    if (status && status !== prev.status) {
      const row = await getErrorRow(req.params.id);
      const recipients = await getRecipients(req.params.id);
      const event = status === 'resolved' ? 'resolved' : status === 'escalated' ? 'escalated' : 'status_changed';
      notifyErrorEvent(event, row, { recipients, actorName: req.user.full_name, previousStatus: prev.status });
    }

    res.json({ message: 'Error updated successfully.' });
  } catch (err) { next(err); }
}

/**
 * A teacher reports a fault and rates the fix. Deciding it is fixed is not
 * theirs to make: they own the row, so the access check passed, and they could
 * close their own ticket — which takes it out of the school admin's queue with
 * nobody having looked at it. The UI stopped offering it; this is the same rule
 * where it actually binds.
 */
function teacherMayNotSetStatus(req, res) {
  if (req.user.role !== 'teacher') return false;
  res.status(403).json({
    error: 'A teacher can report and rate a fault, but not change its status. Your school administrator or the engineer handling it does that.',
    code: 'TEACHER_CANNOT_SET_STATUS'
  });
  return true;
}

async function updateStatus(req, res, next) {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'Status is required.' });
    if (teacherMayNotSetStatus(req, res)) return;

    const prev = await getErrorRow(req.params.id);
    if (!prev) return res.status(404).json({ error: 'Error not found.' });

    if (!(await userCanAccessError(req.user, prev))) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const resolvedAt = status === 'resolved' ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null;

    // Stamp first response when an error first moves off "open".
    const setFirstResponse = (prev.status === 'open' && status !== 'open' && !prev.first_response_at)
      ? ', first_response_at = NOW()' : '';

    await pool.query(
      `UPDATE errors SET status = ?, resolved_at = COALESCE(?, resolved_at)${setFirstResponse} WHERE id = ?`,
      [status, resolvedAt, req.params.id]
    );

    await logAudit({
      actor: req.user, ip: req.ip, action: 'error.status_changed', entityType: 'error', entityId: req.params.id,
      summary: `${prev.error_code}: ${prev.status} → ${status}`, meta: { from: prev.status, to: status }
    });

    if (status === 'resolved') await ensureCsatToken(req.params.id);

    const row = await getErrorRow(req.params.id);
    const recipients = await getRecipients(req.params.id);
    const event = status === 'resolved' ? 'resolved' : status === 'escalated' ? 'escalated' : 'status_changed';
    notifyErrorEvent(event, row, { recipients, actorName: req.user.full_name, previousStatus: prev.status });
    // Escalations also fire an SMS.
    if (status === 'escalated') {
      const phones = await getPhoneRecipients(req.params.id);
      notifyErrorSms('escalated', row, { phones });
    }

    res.json({ message: `Error status changed to ${status}.` });
  } catch (err) { next(err); }
}

// Public CSAT submission via tokenised link (no auth) — Tier 1 #6.
async function submitCsat(req, res, next) {
  try {
    const { rating, comment } = req.body;
    const r = parseInt(rating, 10);
    if (isNaN(r) || r < 0 || r > 5) return res.status(400).json({ error: 'Rating must be between 0 and 5.' });

    const [rows] = await pool.query('SELECT id, error_code FROM errors WHERE csat_token = ?', [req.params.token]);
    if (!rows.length) return res.status(404).json({ error: 'Invalid or expired feedback link.' });

    await pool.query('UPDATE errors SET csat_rating = ?, csat_comment = ? WHERE id = ?', [r, comment || null, rows[0].id]);
    await logAudit({ action: 'error.csat_submitted', entityType: 'error', entityId: rows[0].id, summary: `CSAT ${r}/5 for ${rows[0].error_code}` });
    res.json({ message: 'Thank you for your feedback!' });
  } catch (err) { next(err); }
}

async function addUpdate(req, res, next) {
  try {
    const { update_type, note, recorded_by } = req.body;
    if (!note) return res.status(400).json({ error: 'Note is required.' });

    const target = await getErrorRow(req.params.id);
    if (!target) return res.status(404).json({ error: 'Error not found.' });
    if (!(await userCanAccessError(req.user, target))) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    await pool.query(
      'INSERT INTO error_updates (error_id, update_type, note, recorded_by) VALUES (?, ?, ?, ?)',
      [req.params.id, update_type || 'Progress Update', note, recorded_by || req.user.full_name]
    );

    // First note also counts as first response for SLA.
    await pool.query(
      "UPDATE errors SET first_response_at = COALESCE(first_response_at, NOW()) WHERE id = ?",
      [req.params.id]
    );

    await logAudit({
      actor: req.user, ip: req.ip, action: 'error.note_added', entityType: 'error', entityId: req.params.id,
      summary: `Note added: ${String(note).slice(0, 80)}`
    });

    res.status(201).json({ message: 'Update added successfully.' });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const prev = await getErrorRow(req.params.id);
    await pool.query('DELETE FROM error_updates WHERE error_id = ?', [req.params.id]);
    await pool.query('DELETE FROM errors WHERE id = ?', [req.params.id]);
    await logAudit({
      actor: req.user, ip: req.ip, action: 'error.deleted', entityType: 'error', entityId: req.params.id,
      summary: prev ? `Deleted ${prev.error_code} "${prev.title}"` : `Deleted error #${req.params.id}`
    });
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
    } else if (req.user.role === 'teacher') {
      schoolFilter = 'AND e.reported_by_user_id = ?';
      params.push(req.user.id);
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
        SUM(CASE WHEN status != 'resolved' AND sla_due_at IS NOT NULL AND sla_due_at < NOW() THEN 1 ELSE 0 END) as sla_breached,
        SUM(CASE WHEN status = 'resolved' AND resolved_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 ELSE 0 END) as resolved_24h,
        SUM(CASE WHEN csat_rating IS NOT NULL THEN 1 ELSE 0 END) as csat_responses,
        ROUND(AVG(csat_rating), 2) as csat_avg
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

async function escalateToAdmin(req, res, next) {
  try {
    const { id } = req.params;
    const { reason, note } = req.body;

    if (!reason) return res.status(400).json({ error: 'Escalation reason is required.' });

    const row = await getErrorRow(id);
    if (!row) return res.status(404).json({ error: 'Error not found.' });

    if (req.user.role === 'school' && row.school_id !== req.user.school_id) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    if (req.user.role === 'teacher' && row.reported_by_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    // Tiered escalation: teacher → school admin, school admin → platform admin
    const targetLevel = req.user.role === 'teacher' ? 'school' : 'platform';
    const targetLabel = targetLevel === 'school' ? 'school admin' : 'platform admin';

    if (row.escalation_level === 'platform') {
      return res.status(400).json({ error: 'Error is already escalated to platform admin.' });
    }
    if (req.user.role === 'teacher' && row.escalation_level === 'school') {
      return res.status(400).json({ error: 'Error is already escalated to school admin.' });
    }

    // Escalating to platform is what hands the fault to the school's field
    // engineer. Faults reported by a teacher are created unassigned on purpose
    // (see create()), so without this an escalation would raise the level and
    // still leave nobody holding it.
    let assignee = null;
    if (targetLevel === 'platform' && !row.assigned_to) {
      const [sch] = await pool.query('SELECT assigned_admin_id FROM schools WHERE id = ?', [row.school_id]);
      assignee = sch.length ? sch[0].assigned_admin_id : null;
    }

    await pool.query(
      `UPDATE errors SET escalation_level = ?, escalated_by = ?, escalated_at = NOW(), status = 'escalated',
              assigned_to = COALESCE(assigned_to, ?) WHERE id = ?`,
      [targetLevel, req.user.id, assignee, id]
    );

    await pool.query(
      'INSERT INTO error_updates (error_id, update_type, note, recorded_by) VALUES (?, ?, ?, ?)',
      [id, 'Escalation', `Escalated to ${targetLabel}: ${reason}${note ? ' — ' + note : ''}`, req.user.full_name]
    );

    await logAudit({
      actor: req.user, ip: req.ip, action: 'error.escalated', entityType: 'error', entityId: id,
      summary: `${row.error_code} escalated to ${targetLevel}: ${reason}`, meta: { reason, target: targetLevel }
    });

    res.json({ message: `Error escalated to ${targetLabel}.` });
  } catch (err) { next(err); }
}

async function assignError(req, res, next) {
  try {
    const { assigned_to, note } = req.body;
    if (!assigned_to) return res.status(400).json({ error: 'assigned_to is required' });

    const [error] = await pool.query('SELECT * FROM errors WHERE id = ?', [req.params.id]);
    if (!error.length) return res.status(404).json({ error: 'Error not found' });

    await pool.query('UPDATE errors SET assigned_to = ?, status = ? WHERE id = ?',
      [assigned_to, error[0].status === 'open' ? 'progress' : error[0].status, req.params.id]);

    const [assignee] = await pool.query('SELECT full_name FROM users WHERE id = ?', [assigned_to]);
    const assigneeName = assignee.length ? assignee[0].full_name : 'Unknown';

    if (note) {
      await pool.query(
        'INSERT INTO error_updates (error_id, note, recorded_by, created_at) VALUES (?, ?, ?, NOW())',
        [req.params.id, `Assigned to ${assigneeName}. ${note}`, req.user.full_name || req.user.username]
      );
    } else {
      await pool.query(
        'INSERT INTO error_updates (error_id, note, recorded_by, created_at) VALUES (?, ?, ?, NOW())',
        [req.params.id, `Assigned to ${assigneeName}`, req.user.full_name || req.user.username]
      );
    }

    await pool.query(
      `INSERT INTO admin_notifications (target_role, type, title, message, meta) VALUES (?, ?, ?, ?, ?)`,
      ['subadmin', 'error_assigned', `Error ${error[0].error_code} assigned to you`,
        `${req.user.full_name || 'Admin'} assigned "${error[0].title}" to you${note ? '. Note: ' + note : ''}`,
        JSON.stringify({ error_id: req.params.id, error_code: error[0].error_code, assigned_to })]
    );

    await logAudit({
      actor: req.user, ip: req.ip, action: 'error.assigned', entityType: 'error', entityId: req.params.id,
      summary: `Assigned error ${error[0].error_code} to ${assigneeName}`, meta: { assigned_to }
    });

    res.json({ message: `Error assigned to ${assigneeName}` });
  } catch (err) { next(err); }
}

async function addAttachments(req, res, next) {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded.' });
    }

    const [error] = await pool.query('SELECT id FROM errors WHERE id = ?', [req.params.id]);
    if (!error.length) return res.status(404).json({ error: 'Error not found.' });

    const attachments = await uploadAttachments(req.files, req.params.id, req.user.full_name);
    res.status(201).json({ attachments, message: 'Attachments uploaded.' });
  } catch (err) { next(err); }
}

module.exports = { getAll, getById, create, update, updateStatus, addUpdate, remove, getStats, exportErrors, submitCsat, escalateToAdmin, assignError, addAttachments };
