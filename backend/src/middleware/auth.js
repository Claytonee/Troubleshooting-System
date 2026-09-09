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
    // The inventory grant lives on the teacher's own row, not on users, and is
    // read on every request on purpose: a school admin who revokes it must have
    // that take effect immediately, not at the delegate's next login.
    const [rows] = await pool.query(
      `SELECT u.id, u.username, u.full_name, u.role, u.zone, u.school_id, u.status, u.approval_status,
              COALESCE(t.can_manage_inventory, 0) AS can_manage_inventory
         FROM users u
         LEFT JOIN teachers t ON t.user_id = u.id
        WHERE u.id = ? LIMIT 1`,
      [decoded.id]
    );
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
