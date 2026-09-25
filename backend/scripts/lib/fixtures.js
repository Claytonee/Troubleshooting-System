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
 * Every fixture account is enrolled in two-step sign-in (D32: required of every
 * staff role from MFA_ENFORCE_ADMIN_AFTER / MFA_ENFORCE_STAFF_AFTER), exactly as a
 * person who scanned the QR code would be, so the suites keep passing on and after
 * those dates with no switch in the server. Sign in through signIn(): password,
 * then the current authenticator code. A suite that tests an account WITHOUT
 * two-step sign-in says so with unenrol().
 *
 * These are real rows in the real local database. Never point this at
 * production: it writes users.
 */
const bcrypt = require('bcryptjs');
const pool = require('../../src/config/database');
const totp = require('../../src/services/totp');

const PREFIX = 'zzverify';
const PASSWORD = 'VerifyPass!2026';
const BASE = process.env.VERIFY_BASE || 'http://localhost:3210';

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
 * Turns two-step sign-in on for an account, as the setup screen would: an
 * encrypted secret, hashed recovery codes, no step spent yet. Returns what the
 * person would hold — the secret in their authenticator and the recovery codes.
 */
async function enrol(userId) {
  const secret = totp.generateSecret();
  const recoveryCodes = totp.recoveryCodes();
  await pool.query(
    `UPDATE users SET mfa_enabled = 1, mfa_secret_enc = ?, mfa_pending_enc = NULL, mfa_last_step = NULL,
            mfa_recovery = ?, mfa_enrolled_at = NOW() WHERE id = ?`,
    [totp.encrypt(secret), JSON.stringify(recoveryCodes.map(totp.hashCode)), userId]);
  return { secret, recoveryCodes };
}

/** For suites that test an account without two-step sign-in: say so explicitly. */
async function unenrol(userId) {
  await pool.query(
    `UPDATE users SET mfa_enabled = 0, mfa_secret_enc = NULL, mfa_pending_enc = NULL, mfa_last_step = NULL,
            mfa_recovery = NULL, mfa_enrolled_at = NULL WHERE id = ?`, [userId]);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * The authenticator code this account can use next. A code works once: the
 * server keeps the last step spent (mfa_last_step) and accepts only later steps,
 * within one step either side of now. So: the earliest unspent step the server
 * will still accept, and when those are used up, wait for the clock like a
 * person would. Never rewinds mfa_last_step. Read from the row, so it is right
 * however the account was enrolled and whatever else spent a code.
 */
async function nextCode(username) {
  for (;;) {
    const [[u]] = await pool.query(
      'SELECT mfa_enabled, mfa_secret_enc, mfa_last_step FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)',
      [username, username]);
    if (!u || !Number(u.mfa_enabled) || !u.mfa_secret_enc) throw new Error(`fixtures: ${username} has no two-step sign-in`);
    const ms = Date.now();
    const now = totp.stepAt(ms);
    // The step behind is accepted only until the server's clock ticks: use it
    // only while there are seconds to spare before that happens.
    const earliest = (ms / 1000) % totp.STEP < totp.STEP - 5 ? now - 1 : now;
    const step = u.mfa_last_step == null ? earliest : Math.max(earliest, Number(u.mfa_last_step) + 1);
    if (step <= now + 1) return totp.hotp(totp.base32Decode(totp.decrypt(u.mfa_secret_enc)), step);
    await sleep((now + 1) * totp.STEP * 1000 - ms + 100);
  }
}

// One sign-in per account at a time: two at once would compute the same code.
const inFlight = new Map();

/**
 * Signs in the way a person does: password, then — if the account has two-step
 * sign-in — the current authenticator code. Returns { status, body, token } of
 * the step that decided it: a wrong password answers from /login, an enrolled
 * account from /mfa/verify, and an account without two-step from /login.
 */
function signIn(username, password = PASSWORD, base = BASE) {
  const key = String(username).toLowerCase();
  const run = async () => {
    const post = async (p, body) => {
      const r = await fetch(base + '/api/auth' + p, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      });
      const json = await r.json().catch(() => null);
      return { status: r.status, body: json, token: (json && json.token) || null };
    };
    const first = await post('/login', { username, password });
    if (first.status !== 200 || !first.body || !first.body.mfa_required) return first;
    return post('/mfa/verify', { ticket: first.body.mfa_ticket, code: await nextCode(username) });
  };
  const p = (inFlight.get(key) || Promise.resolve()).then(run, run);
  inFlight.set(key, p.catch(() => {}));
  return p;
}

/**
 * Ensures a school admin and a teacher at the same school, plus the platform
 * admin's credentials if one can be reset safely. Both are enrolled in two-step
 * sign-in; each carries its `secret` and `recoveryCodes`.
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

  const schoolAdminMfa = await enrol(schoolAdminId);
  const teacherMfa = await enrol(teacherUserId);

  return {
    password: PASSWORD,
    school,
    schoolAdmin: { id: schoolAdminId, username: PREFIX + 'school', password: PASSWORD, ...schoolAdminMfa },
    teacher: { userId: teacherUserId, teacherId, username: PREFIX + 'teacher', password: PASSWORD, ...teacherMfa }
  };
}

/** Removes every row `ensure()` created, and anything the suites hung off them. */
async function cleanup() {
  const [users] = await pool.query('SELECT id FROM users WHERE username LIKE ?', [PREFIX + '%']);
  const ids = users.map(u => u.id);
  if (!ids.length) return { removed: 0 };

  // The detection rules (services/detection.js) run inside the server and can open
  // incidents — and bell alerts — about fixture accounts while a suite deliberately
  // trips them. Those belong to the fixtures and go with them.
  try {
    const [incs] = await pool.query(
      "SELECT id FROM security_incidents WHERE subject_type = 'account' AND subject IN (?)", [ids.map(String)]);
    if (incs.length) {
      const incIds = incs.map(i => i.id);
      await pool.query(
        `DELETE FROM admin_notifications WHERE type = 'security_incident'
           AND CAST(JSON_UNQUOTE(JSON_EXTRACT(meta, '$.incident_id')) AS UNSIGNED) IN (?)`, [incIds]);
      await pool.query('DELETE FROM security_incidents WHERE id IN (?)', [incIds]);
    }
  } catch (e) { /* table absent on an older schema: nothing to remove */ }

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

/**
 * A platform admin of the suite's own. Suites used to sign in as the seeded
 * `admin` with its published password — which sign-in now refuses (SEC-016) —
 * and one suite overwrote the real admin's password for the duration of the run.
 */
async function ensurePlatformAdmin() {
  const username = PREFIX + 'admin';
  const id = await upsertUser({ username, email: username + '@verify.local', full_name: 'Verify Platform Admin', role: 'admin', school_id: null });
  return { id, username, password: PASSWORD, ...await enrol(id) };
}

/**
 * A field engineer with NO schools assigned. Scope checks against it are exact:
 * everything it can see beyond nothing is a leak. Suites used to borrow a seeded
 * engineer with the published password and, when that failed, skip the check.
 */
async function ensureFieldEngineer() {
  const username = PREFIX + 'field';
  const id = await upsertUser({ username, email: username + '@verify.local', full_name: 'Verify Field Engineer', role: 'subadmin', school_id: null });
  await pool.query('UPDATE schools SET assigned_admin_id = NULL WHERE assigned_admin_id = ?', [id]);
  return { id, username, password: PASSWORD, ...await enrol(id) };
}

module.exports = {
  ensure, ensurePlatformAdmin, ensureFieldEngineer, cleanup,
  enrol, unenrol, nextCode, signIn, PREFIX, PASSWORD
};
