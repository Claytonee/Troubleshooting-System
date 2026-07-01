const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

function generateToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

async function getSchoolsList(req, res, next) {
  try {
    const [schools] = await pool.query('SELECT id, name, code, zone FROM schools ORDER BY name');
    res.json(schools);
  } catch (err) { next(err); }
}

async function registerSchoolAdmin(req, res, next) {
  try {
    const { full_name, email, phone, password, school_id, title } = req.body;

    if (!full_name || !email || !password || !school_id) {
      return res.status(400).json({ error: 'Full name, email, password, and school are required.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const [existingUser] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser.length) {
      return res.status(409).json({ error: 'Email already registered.' });
    }

    const [existingReq] = await pool.query(
      "SELECT id FROM registration_requests WHERE email = ? AND status = 'pending'", [email]
    );
    if (existingReq.length) {
      return res.status(409).json({ error: 'A registration request with this email is already pending.' });
    }

    const [school] = await pool.query('SELECT id, name FROM schools WHERE id = ?', [school_id]);
    if (!school.length) {
      return res.status(400).json({ error: 'Invalid school selected.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const [result] = await pool.query(
      `INSERT INTO registration_requests (full_name, email, phone, password_hash, school_id, role, title)
       VALUES (?, ?, ?, ?, ?, 'school', ?)`,
      [full_name, email, phone || null, passwordHash, school_id, title || null]
    );

    res.status(201).json({
      message: 'Registration submitted successfully. Awaiting approval.',
      request_id: result.insertId,
      status: 'pending'
    });
  } catch (err) { next(err); }
}

async function getRegistrationStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const [rows] = await pool.query(
      'SELECT id, status, rejection_reason, reviewed_at FROM registration_requests WHERE id = ? AND email = ?',
      [id, email]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Registration request not found.' });
    }

    const request = rows[0];

    if (request.status === 'approved') {
      const [user] = await pool.query('SELECT id, username, role FROM users WHERE email = ?', [email]);
      if (user.length) {
        const token = generateToken(user[0]);
        return res.json({ status: 'approved', token, user: user[0] });
      }
    }

    res.json({
      status: request.status,
      rejection_reason: request.rejection_reason || null,
      reviewed_at: request.reviewed_at || null
    });
  } catch (err) { next(err); }
}

async function submitAppeal(req, res, next) {
  try {
    const { request_id, full_name, email, phone, message } = req.body;

    if (!request_id || !full_name || !email || !message) {
      return res.status(400).json({ error: 'Name, email, and message are required.' });
    }
    if (message.length < 10) {
      return res.status(400).json({ error: 'Message must be at least 10 characters.' });
    }

    const [request] = await pool.query(
      "SELECT id FROM registration_requests WHERE id = ? AND status = 'rejected'", [request_id]
    );
    if (!request.length) {
      return res.status(400).json({ error: 'No rejected request found to appeal.' });
    }

    const [existing] = await pool.query(
      "SELECT id FROM registration_appeals WHERE request_id = ? AND status = 'pending'", [request_id]
    );
    if (existing.length) {
      return res.status(409).json({ error: 'An appeal is already pending for this request.' });
    }

    await pool.query(
      'INSERT INTO registration_appeals (request_id, full_name, email, phone, message) VALUES (?, ?, ?, ?, ?)',
      [request_id, full_name, email, phone || null, message]
    );

    // Reset request status to pending so admin sees it again and polling works
    await pool.query(
      "UPDATE registration_requests SET status = 'pending', reviewed_at = NULL, reviewed_by = NULL, rejection_reason = NULL WHERE id = ?",
      [request_id]
    );

    res.status(201).json({ message: 'Appeal submitted successfully.' });
  } catch (err) { next(err); }
}

// --- Admin Approval Endpoints ---

async function getPendingApprovals(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT r.id, r.full_name, r.email, r.phone, r.school_id, r.title, r.status, r.created_at,
              s.name as school_name, s.zone as school_zone
       FROM registration_requests r
       LEFT JOIN schools s ON r.school_id = s.id
       WHERE r.status = 'pending'
       ORDER BY r.created_at ASC`
    );
    res.json(rows);
  } catch (err) { next(err); }
}

async function getAllApprovals(req, res, next) {
  try {
    const status = req.query.status || null;
    let query = `SELECT r.id, r.full_name, r.email, r.phone, r.school_id, r.title, r.role,
                        r.status, r.reviewed_at, r.rejection_reason, r.created_at,
                        s.name as school_name, s.zone as school_zone,
                        u.full_name as reviewed_by_name
                 FROM registration_requests r
                 LEFT JOIN schools s ON r.school_id = s.id
                 LEFT JOIN users u ON r.reviewed_by = u.id`;
    const params = [];
    if (status) {
      query += ' WHERE r.status = ?';
      params.push(status);
    }
    query += ' ORDER BY r.created_at DESC';

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) { next(err); }
}

async function getApprovalDetail(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT r.*, s.name as school_name, s.zone as school_zone, s.code as school_code
       FROM registration_requests r
       LEFT JOIN schools s ON r.school_id = s.id
       WHERE r.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Request not found.' });
    res.json(rows[0]);
  } catch (err) { next(err); }
}

async function approveRegistration(req, res, next) {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(
      "SELECT * FROM registration_requests WHERE id = ? AND status IN ('pending', 'rejected')", [id]
    );
    if (!rows.length) {
      return res.status(400).json({ error: 'Request not found or already processed.' });
    }

    const request = rows[0];

    const username = request.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    let finalUsername = username;
    const [existUser] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
    if (existUser.length) {
      finalUsername = username + Math.floor(Math.random() * 999);
    }

    const [userResult] = await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name, role, phone, title, school_id, approval_status)
       VALUES (?, ?, ?, ?, 'school', ?, ?, ?, 'approved')`,
      [finalUsername, request.email, request.password_hash, request.full_name,
       request.phone, request.title, request.school_id]
    );

    await pool.query(
      "UPDATE registration_requests SET status = 'approved', reviewed_by = ?, reviewed_at = NOW() WHERE id = ?",
      [req.user.id, id]
    );

    await pool.query(
      `INSERT INTO audit_log (actor_id, actor_name, actor_role, action, entity_type, entity_id, summary, ip)
       VALUES (?, ?, ?, 'registration.approved', 'user', ?, ?, ?)`,
      [req.user.id, req.user.full_name, req.user.role, userResult.insertId.toString(),
       `Approved school admin registration for ${request.full_name}`, req.ip]
    );

    res.json({ message: 'Registration approved.', user_id: userResult.insertId });
  } catch (err) { next(err); }
}

async function rejectRegistration(req, res, next) {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: 'Rejection reason is required.' });
    }

    const [rows] = await pool.query(
      "SELECT * FROM registration_requests WHERE id = ? AND status = 'pending'", [id]
    );
    if (!rows.length) {
      return res.status(400).json({ error: 'Request not found or already processed.' });
    }

    await pool.query(
      "UPDATE registration_requests SET status = 'rejected', reviewed_by = ?, reviewed_at = NOW(), rejection_reason = ? WHERE id = ?",
      [req.user.id, reason, id]
    );

    await pool.query(
      `INSERT INTO audit_log (actor_id, actor_name, actor_role, action, entity_type, entity_id, summary, ip)
       VALUES (?, ?, ?, 'registration.rejected', 'registration_request', ?, ?, ?)`,
      [req.user.id, req.user.full_name, req.user.role, id.toString(),
       `Rejected registration for ${rows[0].full_name}: ${reason}`, req.ip]
    );

    res.json({ message: 'Registration rejected.' });
  } catch (err) { next(err); }
}

async function getAppeals(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT a.*, r.full_name as original_name, r.email as original_email, r.school_id,
              s.name as school_name
       FROM registration_appeals a
       JOIN registration_requests r ON a.request_id = r.id
       LEFT JOIN schools s ON r.school_id = s.id
       ORDER BY a.created_at DESC`
    );
    res.json(rows);
  } catch (err) { next(err); }
}

// --- Teacher Registration via Link ---

async function generateTeacherLink(req, res, next) {
  try {
    const schoolId = req.user.school_id;
    if (!schoolId) {
      return res.status(400).json({ error: 'You must be linked to a school.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const maxUses = req.body.max_uses || 50;

    const [result] = await pool.query(
      'INSERT INTO registration_links (school_id, token, created_by, expires_at, max_uses) VALUES (?, ?, ?, ?, ?)',
      [schoolId, token, req.user.id, expiresAt, maxUses]
    );

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    res.status(201).json({
      id: result.insertId,
      token,
      url: `${baseUrl}/register/teacher/${token}`,
      expires_at: expiresAt,
      max_uses: maxUses
    });
  } catch (err) { next(err); }
}

async function getTeacherLinks(req, res, next) {
  try {
    const schoolId = req.user.school_id;
    const [rows] = await pool.query(
      'SELECT id, token, expires_at, max_uses, use_count, is_active, created_at FROM registration_links WHERE school_id = ? ORDER BY created_at DESC',
      [schoolId]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

async function deactivateLink(req, res, next) {
  try {
    const { id } = req.params;
    await pool.query(
      'UPDATE registration_links SET is_active = false WHERE id = ? AND school_id = ?',
      [id, req.user.school_id]
    );
    res.json({ message: 'Link deactivated.' });
  } catch (err) { next(err); }
}

async function verifyTeacherLink(req, res, next) {
  try {
    const { token } = req.params;
    const [rows] = await pool.query(
      `SELECT l.*, s.name as school_name, s.zone as school_zone
       FROM registration_links l
       JOIN schools s ON l.school_id = s.id
       WHERE l.token = ?`,
      [token]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Invalid registration link.' });
    }

    const link = rows[0];
    if (!link.is_active) {
      return res.status(410).json({ error: 'This registration link has been deactivated.' });
    }
    if (new Date(link.expires_at) < new Date()) {
      return res.status(410).json({ error: 'This registration link has expired.' });
    }
    if (link.use_count >= link.max_uses) {
      return res.status(410).json({ error: 'This registration link has reached maximum uses.' });
    }

    res.json({
      valid: true,
      school_name: link.school_name,
      school_zone: link.school_zone,
      school_id: link.school_id
    });
  } catch (err) { next(err); }
}

async function registerTeacher(req, res, next) {
  try {
    const { token } = req.params;
    const { full_name, email, phone, password, subject, employee_id } = req.body;

    if (!full_name || !email || !password) {
      return res.status(400).json({ error: 'Full name, email, and password are required.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const [linkRows] = await pool.query(
      'SELECT * FROM registration_links WHERE token = ? AND is_active = true', [token]
    );
    if (!linkRows.length) {
      return res.status(400).json({ error: 'Invalid or inactive registration link.' });
    }

    const link = linkRows[0];
    if (new Date(link.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Registration link has expired.' });
    }
    if (link.use_count >= link.max_uses) {
      return res.status(410).json({ error: 'Registration link has reached maximum uses.' });
    }

    const [existingUser] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser.length) {
      return res.status(409).json({ error: 'Email already registered.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') + Math.floor(Math.random() * 99);

    const [userResult] = await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name, role, phone, school_id, approval_status)
       VALUES (?, ?, ?, ?, 'teacher', ?, ?, 'pending')`,
      [username, email, passwordHash, full_name, phone || null, link.school_id]
    );

    await pool.query(
      `INSERT INTO teachers (user_id, school_id, subject, employee_id, status, registered_via)
       VALUES (?, ?, ?, ?, 'pending', 'link')`,
      [userResult.insertId, link.school_id, subject || null, employee_id || null]
    );

    await pool.query(
      'UPDATE registration_links SET use_count = use_count + 1 WHERE id = ?', [link.id]
    );

    res.status(201).json({
      message: 'Registration submitted. Awaiting approval from your school administrator.',
      status: 'pending'
    });
  } catch (err) { next(err); }
}

// --- School Admin: Teacher Approval ---

async function getPendingTeachers(req, res, next) {
  try {
    const schoolId = req.user.school_id;
    if (!schoolId) return res.status(400).json({ error: 'No school linked.' });

    const [rows] = await pool.query(
      `SELECT u.id as user_id, u.full_name, u.email, u.phone, u.created_at,
              t.id as teacher_id, t.subject, t.employee_id, t.status
       FROM teachers t
       JOIN users u ON t.user_id = u.id
       WHERE t.school_id = ? AND t.status = 'pending'
       ORDER BY u.created_at ASC`,
      [schoolId]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

async function approveTeacher(req, res, next) {
  try {
    const { id } = req.params;
    const schoolId = req.user.school_id;

    const [rows] = await pool.query(
      "SELECT t.*, u.full_name, u.email FROM teachers t JOIN users u ON t.user_id = u.id WHERE t.id = ? AND t.school_id = ? AND t.status = 'pending'",
      [id, schoolId]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Pending teacher not found.' });
    }

    await pool.query(
      "UPDATE teachers SET status = 'active', approved_by = ?, approved_at = NOW() WHERE id = ?",
      [req.user.id, id]
    );
    await pool.query(
      "UPDATE users SET approval_status = 'approved' WHERE id = ?",
      [rows[0].user_id]
    );

    res.json({ message: `Teacher ${rows[0].full_name} approved.` });
  } catch (err) { next(err); }
}

async function rejectTeacher(req, res, next) {
  try {
    const { id } = req.params;
    const schoolId = req.user.school_id;

    const [rows] = await pool.query(
      "SELECT t.*, u.full_name FROM teachers t JOIN users u ON t.user_id = u.id WHERE t.id = ? AND t.school_id = ? AND t.status = 'pending'",
      [id, schoolId]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Pending teacher not found.' });
    }

    await pool.query("UPDATE teachers SET status = 'rejected' WHERE id = ?", [id]);
    await pool.query("UPDATE users SET approval_status = 'rejected', status = 'inactive' WHERE id = ?", [rows[0].user_id]);

    res.json({ message: `Teacher ${rows[0].full_name} rejected.` });
  } catch (err) { next(err); }
}

// --- School Admin: Teacher CRUD ---

async function getTeachers(req, res, next) {
  try {
    const schoolId = req.user.school_id;
    if (!schoolId) return res.status(400).json({ error: 'No school linked.' });

    const [rows] = await pool.query(
      `SELECT u.id as user_id, u.full_name, u.email, u.phone, u.status as user_status, u.created_at,
              t.id, t.subject, t.employee_id, t.status, t.registered_via, t.approved_at
       FROM teachers t
       JOIN users u ON t.user_id = u.id
       WHERE t.school_id = ?
       ORDER BY u.full_name`,
      [schoolId]
    );
    res.json(rows);
  } catch (err) { next(err); }
}

async function getTeacher(req, res, next) {
  try {
    const { id } = req.params;
    const schoolId = req.user.school_id;

    const [rows] = await pool.query(
      `SELECT u.id as user_id, u.full_name, u.email, u.phone, u.status as user_status, u.created_at,
              t.id, t.subject, t.employee_id, t.status, t.registered_via, t.approved_by, t.approved_at
       FROM teachers t
       JOIN users u ON t.user_id = u.id
       WHERE t.id = ? AND t.school_id = ?`,
      [id, schoolId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Teacher not found.' });
    res.json(rows[0]);
  } catch (err) { next(err); }
}

async function createTeacher(req, res, next) {
  try {
    const schoolId = req.user.school_id;
    if (!schoolId) return res.status(400).json({ error: 'No school linked.' });

    const { full_name, email, phone, subject, employee_id, password } = req.body;
    if (!full_name || !email) {
      return res.status(400).json({ error: 'Full name and email are required.' });
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) {
      return res.status(409).json({ error: 'Email already registered.' });
    }

    const pw = password || 'Teacher@' + Math.floor(Math.random() * 9000 + 1000);
    const passwordHash = await bcrypt.hash(pw, 12);
    const username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') + Math.floor(Math.random() * 99);

    const [userResult] = await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name, role, phone, school_id, approval_status)
       VALUES (?, ?, ?, ?, 'teacher', ?, ?, 'approved')`,
      [username, email, passwordHash, full_name, phone || null, schoolId]
    );

    const [teacherResult] = await pool.query(
      `INSERT INTO teachers (user_id, school_id, subject, employee_id, status, registered_via, approved_by, approved_at)
       VALUES (?, ?, ?, ?, 'active', 'manual', ?, NOW())`,
      [userResult.insertId, schoolId, subject || null, employee_id || null, req.user.id]
    );

    res.status(201).json({
      message: 'Teacher created successfully.',
      teacher_id: teacherResult.insertId,
      temporary_password: password ? undefined : pw
    });
  } catch (err) { next(err); }
}

async function updateTeacher(req, res, next) {
  try {
    const { id } = req.params;
    const schoolId = req.user.school_id;
    const { full_name, phone, subject, employee_id } = req.body;

    const [rows] = await pool.query(
      'SELECT t.user_id FROM teachers t WHERE t.id = ? AND t.school_id = ?', [id, schoolId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Teacher not found.' });

    if (full_name || phone) {
      const updates = [];
      const params = [];
      if (full_name) { updates.push('full_name = ?'); params.push(full_name); }
      if (phone) { updates.push('phone = ?'); params.push(phone); }
      params.push(rows[0].user_id);
      await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    if (subject !== undefined || employee_id !== undefined) {
      const updates = [];
      const params = [];
      if (subject !== undefined) { updates.push('subject = ?'); params.push(subject); }
      if (employee_id !== undefined) { updates.push('employee_id = ?'); params.push(employee_id); }
      params.push(id);
      await pool.query(`UPDATE teachers SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    res.json({ message: 'Teacher updated.' });
  } catch (err) { next(err); }
}

async function updateTeacherStatus(req, res, next) {
  try {
    const { id } = req.params;
    const schoolId = req.user.school_id;
    const { status } = req.body;

    if (!['active', 'suspended', 'inactive'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Use: active, suspended, inactive.' });
    }

    const [rows] = await pool.query(
      'SELECT t.user_id FROM teachers t WHERE t.id = ? AND t.school_id = ?', [id, schoolId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Teacher not found.' });

    await pool.query('UPDATE teachers SET status = ? WHERE id = ?', [status, id]);

    const userStatus = status === 'active' ? 'active' : 'inactive';
    await pool.query('UPDATE users SET status = ? WHERE id = ?', [userStatus, rows[0].user_id]);

    res.json({ message: `Teacher status updated to ${status}.` });
  } catch (err) { next(err); }
}

async function deleteTeacher(req, res, next) {
  try {
    const { id } = req.params;
    const schoolId = req.user.school_id;

    const [rows] = await pool.query(
      'SELECT t.user_id, u.full_name FROM teachers t JOIN users u ON t.user_id = u.id WHERE t.id = ? AND t.school_id = ?',
      [id, schoolId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Teacher not found.' });

    await pool.query('DELETE FROM teachers WHERE id = ?', [id]);
    await pool.query("UPDATE users SET status = 'inactive' WHERE id = ?", [rows[0].user_id]);

    res.json({ message: `Teacher ${rows[0].full_name} removed.` });
  } catch (err) { next(err); }
}

module.exports = {
  getSchoolsList,
  registerSchoolAdmin,
  getRegistrationStatus,
  submitAppeal,
  getPendingApprovals,
  getAllApprovals,
  getApprovalDetail,
  approveRegistration,
  rejectRegistration,
  getAppeals,
  generateTeacherLink,
  getTeacherLinks,
  deactivateLink,
  verifyTeacherLink,
  registerTeacher,
  getPendingTeachers,
  approveTeacher,
  rejectTeacher,
  getTeachers,
  getTeacher,
  createTeacher,
  updateTeacher,
  updateTeacherStatus,
  deleteTeacher
};
