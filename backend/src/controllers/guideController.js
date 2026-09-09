const pool = require('../config/database');
const { sendMail } = require('../services/notify');

// Where "Escalate Issue" clicks on troubleshooting guides are sent.
const ESCALATION_EMAIL = process.env.ESCALATION_EMAIL || 'jmassawe@questforward.org';

async function getAll(req, res, next) {
  try {
    const [rows] = await pool.query('SELECT * FROM troubleshooting_guides ORDER BY id ASC');
    rows.forEach(r => { if (typeof r.steps === 'string') r.steps = JSON.parse(r.steps); });
    res.json(rows);
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const [rows] = await pool.query('SELECT * FROM troubleshooting_guides WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Guide not found.' });
    const guide = rows[0];
    if (typeof guide.steps === 'string') guide.steps = JSON.parse(guide.steps);
    res.json(guide);
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { title, category, icon, steps } = req.body;

    if (!title || !steps || !steps.length) {
      return res.status(400).json({ error: 'Title and steps are required.' });
    }

    const [result] = await pool.query(
      'INSERT INTO troubleshooting_guides (title, category, icon, steps, is_custom, created_by) VALUES (?, ?, ?, ?, TRUE, ?)',
      [title, category || 'Other', icon || 'ti-tools', JSON.stringify(steps), req.user.id]
    );

    res.status(201).json({ id: result.insertId, message: 'Guide created successfully.' });
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const { title, category, icon, steps } = req.body;

    await pool.query(
      'UPDATE troubleshooting_guides SET title=?, category=?, icon=?, steps=? WHERE id=?',
      [title, category, icon, JSON.stringify(steps), req.params.id]
    );

    res.json({ message: 'Guide updated successfully.' });
  } catch (err) { next(err); }
}

// "Escalate Issue" on a guide: emails the support lead that the guide didn't
// resolve the user's problem. Best-effort — reports whether the email went out
// so the frontend can fall back to the error-report form when SMTP is off.
/**
 * A teacher's escalation goes up their own school's chain, not out to email.
 *
 * The school administrator is the person who can actually walk to the room,
 * confirm the symptom and — if it is real — file it as a fault for the field
 * engineers. Emailing head office over their head loses them the context and
 * leaves the teacher with no way to see what happened next. Delivered as an
 * in-app notification on the school admin's bell, with the guide and the
 * teacher named.
 *
 * If the school has no active administrator the escalation must still land
 * somewhere, so it falls back to the support mailbox and says so in the reply —
 * silently dropping it would be the worst of the three outcomes.
 */
async function escalateToSchoolAdmin(req, res, guide, schoolName) {
  const [admins] = await pool.query(
    `SELECT id, full_name FROM users
      WHERE role = 'school' AND school_id = ? AND status = 'active' AND approval_status = 'approved'
      ORDER BY id LIMIT 1`,
    [req.user.school_id]
  );
  if (!admins.length) return null;

  const admin = admins[0];
  const title = `${req.user.full_name} needs help: ${guide.title}`;
  const message = `Followed the "${guide.title}" guide (${guide.category}) and the problem is still there.`;

  await pool.query(
    `INSERT INTO admin_notifications (target_role, type, title, message, meta) VALUES ('school', 'guide_escalation', ?, ?, ?)`,
    [title, message, JSON.stringify({
      school_id: req.user.school_id,
      school_name: schoolName || null,
      guide_id: guide.id,
      guide_title: guide.title,
      guide_category: guide.category,
      teacher_id: req.user.id,
      teacher_name: req.user.full_name
    })]
  );

  return { to: admin.full_name, to_id: admin.id };
}

async function escalate(req, res, next) {
  try {
    const [rows] = await pool.query('SELECT * FROM troubleshooting_guides WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Guide not found.' });
    const guide = rows[0];

    let schoolName = '';
    if (req.user.school_id) {
      const [s] = await pool.query('SELECT name FROM schools WHERE id = ?', [req.user.school_id]);
      if (s.length) schoolName = s[0].name;
    }

    if (req.user.role === 'teacher' && req.user.school_id) {
      const routed = await escalateToSchoolAdmin(req, res, guide, schoolName);
      if (routed) {
        return res.json({
          sent: true,
          routed_to: 'school_admin',
          to: routed.to,
          message: `Your school administrator (${routed.to}) has been notified.`
        });
      }
      // No school admin on file — fall through to the support mailbox below,
      // and the reply says which route was actually used.
    }

    const appUrl = process.env.APP_URL || '';
    const subject = `[Guide Escalation] ${guide.title}${schoolName ? ' — ' + schoolName : ''}`;
    const text = [
      `A user followed the troubleshooting guide "${guide.title}" (${guide.category}) but the issue is NOT resolved.`,
      '',
      `Reported by: ${req.user.full_name} (${req.user.role})`,
      schoolName ? `School: ${schoolName}` : '',
      req.user.zone ? `Zone: ${req.user.zone}` : '',
      `Time: ${new Date().toISOString()}`,
      appUrl ? `\nOpen the system: ${appUrl}` : ''
    ].filter(Boolean).join('\n');

    const result = await sendMail({ to: ESCALATION_EMAIL, subject, text });
    res.json({
      sent: !!result.sent,
      routed_to: 'support_email',
      // A teacher only reaches this line when their school has no active
      // administrator; tell the truth about it rather than implying the normal
      // route worked.
      no_school_admin: req.user.role === 'teacher'
    });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    await pool.query('DELETE FROM troubleshooting_guides WHERE id = ?', [req.params.id]);
    res.json({ message: 'Guide deleted successfully.' });
  } catch (err) { next(err); }
}

module.exports = { getAll, getById, create, update, remove, escalate };
