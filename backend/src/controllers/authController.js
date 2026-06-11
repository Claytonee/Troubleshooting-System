const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

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
      'SELECT id, username, email, full_name, role, phone, zone, color, title, status, password_hash, school_id FROM users WHERE username = ? OR email = ?',
      [username, username]
    );

    if (!rows.length) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const user = rows[0];
    if (user.status === 'inactive') {
      return res.status(403).json({ error: 'Account is deactivated.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const token = generateToken(user);

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
        school_id: user.school_id
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
      'SELECT id, username, email, full_name, role, phone, zone, color, title, status, school_id, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found.' });
    res.json(rows[0]);
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

module.exports = { login, register, getProfile, changePassword };
