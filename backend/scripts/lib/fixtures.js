/**
 * Self-provisioning fixtures for the verification suites.
 *
 * The suites used to hardcode two accounts that happened to exist in the local
 * database (`njoseph46`, `emushi`). On 2026-09-09 that database was replaced by
 * a fresh seed and every suite broke on a login, which is a bad way to learn
 * that your tests depend on somebody else's rows.
 *
 * So: create what is needed, under names nothing else will collide with, and
 * remove them afterwards. Idempotent — a leftover fixture from an interrupted
 * run is reused rather than duplicated.
 *
 * These are real rows in the real local database. Never point this at
 * production: it writes users.
 */
const bcrypt = require('bcryptjs');
const pool = require('../../src/config/database');

const PREFIX = 'zzverify';
const PASSWORD = 'VerifyPass!2026';

/** A school to hang the fixtures on: the last one, so it is least likely to be the demo the UI shows first. */
async function pickSchool() {
  const [rows] = await pool.query('SELECT id, code, name, assigned_admin_id FROM schools ORDER BY id DESC LIMIT 1');
  if (!rows.length) throw new Error('fixtures: no schools in this database — run the app once to seed it');
  return rows[0];
}

async function upsertUser({ username, email, full_name, role, school_id }) {
  const hash = await bcrypt.hash(PASSWORD, 10);
  const [existing] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
  if (existing.length) {
    await pool.query(
      `UPDATE users SET password_hash = ?, full_name = ?, role = ?, school_id = ?, status = 'active',
              approval_status = 'approved', must_change_password = 0 WHERE id = ?`,
      [hash, full_name, role, school_id, existing[0].id]
    );
    return existing[0].id;
  }
  const [res] = await pool.query(
    `INSERT INTO users (username, email, password_hash, full_name, role, school_id, status, approval_status, must_change_password)
     VALUES (?, ?, ?, ?, ?, ?, 'active', 'approved', 0)`,
    [username, email, hash, full_name, role, school_id]
  );
  return res.insertId;
}

/**
 * Ensures a school admin and a teacher at the same school, plus the platform
 * admin's credentials if one can be reset safely.
 */
async function ensure() {
  const school = await pickSchool();

  const schoolAdminId = await upsertUser({
    username: PREFIX + 'school',
    email: PREFIX + 'school@verify.local',
    full_name: 'Verify School Admin',
    role: 'school',
    school_id: school.id
  });

  const teacherUserId = await upsertUser({
    username: PREFIX + 'teacher',
    email: PREFIX + 'teacher@verify.local',
    full_name: 'Verify Teacher',
    role: 'teacher',
    school_id: school.id
  });

  const [t] = await pool.query('SELECT id FROM teachers WHERE user_id = ?', [teacherUserId]);
  let teacherId;
  if (t.length) {
    teacherId = t[0].id;
    await pool.query(
      `UPDATE teachers SET school_id = ?, status = 'active', can_manage_inventory = 0,
              inventory_granted_by = NULL, inventory_granted_at = NULL, inventory_revoked_at = NULL WHERE id = ?`,
      [school.id, teacherId]
    );
  } else {
    const [res] = await pool.query(
      `INSERT INTO teachers (user_id, school_id, subject, employee_id, status, registered_via, approved_by, approved_at)
       VALUES (?, ?, 'Mathematics', 'VERIFY-001', 'active', 'manual', ?, NOW())`,
      [teacherUserId, school.id, schoolAdminId]
    );
    teacherId = res.insertId;
  }

  return {
    password: PASSWORD,
    school,
    schoolAdmin: { id: schoolAdminId, username: PREFIX + 'school', password: PASSWORD },
    teacher: { userId: teacherUserId, teacherId, username: PREFIX + 'teacher', password: PASSWORD }
  };
}

/** Removes every row `ensure()` created, and anything the suites hung off them. */
async function cleanup() {
  const [users] = await pool.query('SELECT id FROM users WHERE username LIKE ?', [PREFIX + '%']);
  const ids = users.map(u => u.id);
  if (!ids.length) return { removed: 0 };

  for (const id of ids) {
    const [errs] = await pool.query('SELECT id FROM errors WHERE reported_by_user_id = ?', [id]);
    for (const e of errs) {
      await pool.query('DELETE FROM error_attachments WHERE error_id = ?', [e.id]);
      await pool.query('DELETE FROM error_updates WHERE error_id = ?', [e.id]);
      await pool.query('DELETE FROM errors WHERE id = ?', [e.id]);
    }
    await pool.query('DELETE FROM ai_chat_messages WHERE chat_id IN (SELECT id FROM ai_chats WHERE user_id = ?)', [id]);
    await pool.query('DELETE FROM ai_chats WHERE user_id = ?', [id]);
    await pool.query('DELETE FROM registration_links WHERE created_by = ?', [id]);
    await pool.query('DELETE FROM teachers WHERE user_id = ? OR approved_by = ?', [id, id]);
    await pool.query('DELETE FROM audit_log WHERE actor_id = ?', [id]);
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
  }
  return { removed: ids.length };
}

module.exports = { ensure, cleanup, PREFIX, PASSWORD };
