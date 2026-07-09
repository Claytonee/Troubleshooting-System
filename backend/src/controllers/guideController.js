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
    res.json({ sent: !!result.sent });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    await pool.query('DELETE FROM troubleshooting_guides WHERE id = ?', [req.params.id]);
    res.json({ message: 'Guide deleted successfully.' });
  } catch (err) { next(err); }
}

module.exports = { getAll, getById, create, update, remove, escalate };
