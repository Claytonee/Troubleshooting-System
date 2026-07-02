const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const streamifier = require('streamifier');
const pool = require('../config/database');
const cloudinary = require('../config/cloudinary');

function uploadToCloudinary(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (result) resolve(result);
      else reject(error);
    });
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

async function login(req, res, next) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const [rows] = await pool.query(
      'SELECT id, username, email, full_name, role, phone, zone, color, title, status, password_hash, school_id, approval_status FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)',
      [username, username]
    );

    if (!rows.length) {
      // Check if this is a pending registration (case-insensitive email match)
      const [regRows] = await pool.query(
        'SELECT id, status, email, password_hash, rejection_reason FROM registration_requests WHERE LOWER(email) = LOWER(?)',
        [username]
      );
      if (regRows.length) {
        const reg = regRows[0];
        const regPwValid = await bcrypt.compare(password, reg.password_hash);
        if (regPwValid) {
          if (reg.status === 'pending') {
            return res.status(403).json({ error: 'pending_approval', request_id: reg.id, email: reg.email });
          }
          if (reg.status === 'rejected') {
            return res.status(403).json({ error: 'registration_rejected', request_id: reg.id, email: reg.email, rejection_reason: reg.rejection_reason });
          }
        }
      }
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const user = rows[0];

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      // Check if this email has a pending/rejected registration with correct password
      const emailToCheck = user.email || username;
      const [regRows] = await pool.query(
        'SELECT id, status, email, password_hash, rejection_reason FROM registration_requests WHERE LOWER(email) = LOWER(?)',
        [emailToCheck]
      );
      if (regRows.length) {
        const reg = regRows[0];
        const regPwValid = await bcrypt.compare(password, reg.password_hash);
        if (regPwValid) {
          if (reg.status === 'pending') {
            return res.status(403).json({ error: 'pending_approval', request_id: reg.id, email: reg.email });
          }
          if (reg.status === 'rejected') {
            return res.status(403).json({ error: 'registration_rejected', request_id: reg.id, email: reg.email, rejection_reason: reg.rejection_reason });
          }
        }
      }
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Check teacher approval status before generic inactive check
    if (user.role === 'teacher' && user.approval_status === 'pending') {
      return res.status(403).json({ error: 'teacher_pending', user_id: user.id, email: user.email });
    }
    if (user.role === 'teacher' && user.approval_status === 'rejected') {
      const [teacherRows] = await pool.query('SELECT rejection_reason FROM teachers WHERE user_id = ?', [user.id]);
      return res.status(403).json({ error: 'teacher_rejected', user_id: user.id, email: user.email, rejection_reason: teacherRows[0]?.rejection_reason || null });
    }

    if (user.status === 'inactive') {
      return res.status(403).json({ error: 'Account is deactivated.' });
    }

    const token = generateToken(user);

    let school_name = null;
    if (user.school_id) {
      const [schoolRows] = await pool.query('SELECT name FROM schools WHERE id = ?', [user.school_id]);
      if (schoolRows.length) school_name = schoolRows[0].name;
    }

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        phone: user.phone,
        zone: user.zone,
        color: user.color,
        title: user.title,
        status: user.status,
        school_id: user.school_id,
        school_name
      }
    });
  } catch (err) { next(err); }
}

async function register(req, res, next) {
  try {
    const { username, email, password, full_name, role, phone, zone, title } = req.body;

    if (!username || !email || !password || !full_name) {
      return res.status(400).json({ error: 'Username, email, password, and full_name are required.' });
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existing.length) {
      return res.status(409).json({ error: 'Username or email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (username, email, password_hash, full_name, role, phone, zone, title) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [username, email, passwordHash, full_name, role || 'school', phone || null, zone || null, title || null]
    );

    const token = generateToken({ id: result.insertId, role: role || 'school', username });

    res.status(201).json({
      token,
      user: { id: result.insertId, username, email, full_name, role: role || 'school' }
    });
  } catch (err) { next(err); }
}

async function getProfile(req, res, next) {
  try {
    const [rows] = await pool.query(
      'SELECT id, username, email, full_name, role, phone, zone, color, title, status, school_id, bio, avatar_url, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found.' });
    res.json(rows[0]);
  } catch (err) { next(err); }
}

async function updateProfile(req, res, next) {
  try {
    const { full_name, email, phone, zone, title, bio } = req.body;
    if (!full_name || !full_name.trim()) return res.status(400).json({ error: 'Full name is required.' });

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ? AND id != ?', [email, req.user.id]);
    if (existing.length) return res.status(400).json({ error: 'Email already in use.' });

    await pool.query(
      'UPDATE users SET full_name = ?, email = ?, phone = ?, zone = ?, title = ?, bio = ?, updated_at = NOW() WHERE id = ?',
      [full_name.trim(), email || null, phone || null, zone || null, title || null, bio || null, req.user.id]
    );
    const [rows] = await pool.query(
      'SELECT id, username, email, full_name, role, phone, zone, color, title, status, school_id, bio, avatar_url, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
}

async function uploadAvatar(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    if (!req.file.mimetype.startsWith('image/')) return res.status(400).json({ error: 'Only image files are allowed.' });

    const result = await uploadToCloudinary(req.file.buffer, {
      resource_type: 'image',
      folder: 'oe-avatars',
      public_id: `avatar-${req.user.id}-${Date.now()}`,
      transformation: [{ width: 300, height: 300, crop: 'fill', gravity: 'face' }]
    });

    await pool.query('UPDATE users SET avatar_url = ?, updated_at = NOW() WHERE id = ?', [result.secure_url, req.user.id]);
    res.json({ avatar_url: result.secure_url });
  } catch (err) { next(err); }
}

async function changePassword(req, res, next) {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Current and new password are required.' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }

    const [rows] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    const valid = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    const newHash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, req.user.id]);

    res.json({ message: 'Password changed successfully.' });
  } catch (err) { next(err); }
}

module.exports = { login, register, getProfile, updateProfile, uploadAvatar, changePassword };
