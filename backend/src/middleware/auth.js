const jwt = require('jsonwebtoken');
const { JWT_VERIFY } = require('../config/httpPolicy');
const pool = require('../config/database');
const mfaPolicy = require('../services/mfaPolicy');

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.locals.secDetail = { reason: 'no_token' };
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, JWT_VERIFY);
    // A two-step sign-in ticket proves only the password; it is never a session.
    if (decoded.purpose) {
      res.locals.secDetail = { reason: 'ticket_not_a_session' };
      return res.status(401).json({ error: 'Invalid token.' });
    }
    // The inventory grant lives on the teacher's own row, not on users, and is
    // read on every request on purpose: a school admin who revokes it must have
    // that take effect immediately, not at the delegate's next login.
    const [rows] = await pool.query(
      `SELECT u.id, u.username, u.full_name, u.role, u.zone, u.school_id, u.status, u.approval_status, u.token_version, u.mfa_enabled,
              COALESCE(t.can_manage_inventory, 0) AS can_manage_inventory
         FROM users u
         LEFT JOIN teachers t ON t.user_id = u.id
        WHERE u.id = ? LIMIT 1`,
      [decoded.id]
    );
    if (!rows.length || rows[0].status === 'inactive') {
      res.locals.secDetail = { reason: rows.length ? 'inactive_account' : 'unknown_account' };
      res.locals.secUserId = rows.length ? rows[0].id : null;
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }
    // Signed out everywhere since this token was issued (SEC-005). A token from
    // before versioning has no tv and counts as 0 — the column's default.
    if ((decoded.tv || 0) !== (rows[0].token_version || 0)) {
      res.locals.secDetail = { reason: 'revoked_token' };
      res.locals.secUserId = rows[0].id;
      return res.status(401).json({ error: 'This session has ended. Please sign in again.', code: 'SESSION_REVOKED' });
    }
    if (rows[0].approval_status === 'pending' || rows[0].approval_status === 'rejected') {
      res.locals.secRule = 'account_state';
      res.locals.secUserId = rows[0].id;
    }
    if (rows[0].approval_status === 'pending') {
      return res.status(403).json({ error: 'Account pending approval.', code: 'PENDING_APPROVAL' });
    }
    if (rows[0].approval_status === 'rejected') {
      return res.status(403).json({ error: 'Account registration was rejected.', code: 'REJECTED' });
    }
    // A platform admin past the enrolment date without two-step sign-in can reach
    // only the enrolment endpoints (D4); the app opens the setup screen on this code.
    if (mfaPolicy.mustEnrolNow(rows[0]) && !mfaPolicy.isEnrolmentPath(req.originalUrl)) {
      res.locals.secRule = 'mfa_enrolment';
      res.locals.secUserId = rows[0].id;
      return res.status(403).json({ error: 'Set up two-step sign-in to continue.', code: 'MFA_ENROLLMENT_REQUIRED' });
    }
    req.user = rows[0];
    next();
  } catch (err) {
    // Expired and forged tokens both land here; the name says which, the token is never kept.
    res.locals.secDetail = { reason: err && err.name === 'TokenExpiredError' ? 'expired_token' : 'bad_token' };
    return res.status(401).json({ error: 'Invalid token.' });
  }
}

/**
 * Role gate.
 *
 * The refusal names the role it saw and the roles it wanted. "Forbidden.
 * Insufficient permissions." is unfalsifiable from the outside: on 2026-09-09 a
 * platform admin got it from the AI assistant and it took a git archaeology
 * session to find out why — the running process was an old build whose route
 * allowed only school+subadmin. Either message would have been refused; only
 * one of them would have said which role was rejected.
 *
 * It reveals nothing: a person already knows their own role, and the required
 * roles are visible in the nav they can see.
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      res.locals.secRule = 'role';
      return res.status(403).json({
        error: `Forbidden. This is for ${roles.join(', ')} accounts — yours is ${req.user.role}.`,
        code: 'ROLE_NOT_ALLOWED',
        your_role: req.user.role,
        allowed_roles: roles
      });
    }
    next();
  };
}

module.exports = { authenticate, authorize };
