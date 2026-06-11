const pool = require('../config/database');

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

async function remove(req, res, next) {
  try {
    await pool.query('DELETE FROM troubleshooting_guides WHERE id = ?', [req.params.id]);
    res.json({ message: 'Guide deleted successfully.' });
  } catch (err) { next(err); }
}

module.exports = { getAll, getById, create, update, remove };
