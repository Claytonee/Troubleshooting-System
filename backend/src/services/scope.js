const pool = require('../config/database');

/**
 * May `user` act on school `schoolId`?
 *
 *   admin     every school
 *   subadmin  the schools assigned to them (schools.assigned_admin_id)
 *   school    their own school
 *   teacher   their own school
 *
 * The list endpoints already scope this way in SQL. Single-record reads and
 * writes that take a school id from the URL or the body must ask the same
 * question, or an id is a key to somebody else's school (SEC-002, SEC-004).
 */
async function canActOnSchool(user, schoolId) {
  if (!user) return false;
  const id = Number(schoolId);
  if (!Number.isInteger(id) || id <= 0) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'school' || user.role === 'teacher') return Number(user.school_id) === id;
  if (user.role === 'subadmin') {
    const [rows] = await pool.query('SELECT id FROM schools WHERE id = ? AND assigned_admin_id = ?', [id, user.id]);
    return rows.length > 0;
  }
  return false;
}

module.exports = { canActOnSchool };
