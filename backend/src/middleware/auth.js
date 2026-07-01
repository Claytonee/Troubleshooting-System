const jwt = require('jsonwebtoken');
const pool = require('../config/database');

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const [rows] = await pool.query('SELECT id, username, full_name, role, zone, school_id, status, approval_status FROM users WHERE id = ?', [decoded.id]);
    if (!rows.length || rows[0].status === 'inactive') {
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }
    if (rows[0].approval_status === 'pending') {
      return res.status(403).json({ error: 'Account pending approval.', code: 'PENDING_APPROVAL' });
    }
    if (rows[0].approval_status === 'rejected') {
      return res.status(403).json({ error: 'Account registration was rejected.', code: 'REJECTED' });
    }
    req.user = rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token.' });
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden. Insufficient permissions.' });
    }
    next();
  };
}

module.exports = { authenticate, authorize };
