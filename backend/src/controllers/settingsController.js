const pool = require('../config/database');

async function getAll(req, res, next) {
  try {
    const [rows] = await pool.query('SELECT setting_key, setting_value FROM settings');
    const settings = {};
    rows.forEach(r => { settings[r.setting_key] = r.setting_value; });
    res.json(settings);
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const updates = req.body;
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ error: 'Invalid settings data.' });
    }

    const allowed = ['brand_name', 'brand_short', 'brand_subtitle', 'brand_logo_url', 'brand_color', 'loader_text'];

    for (const [key, value] of Object.entries(updates)) {
      if (!allowed.includes(key)) continue;
      await pool.query(
        'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
        [key, value, value]
      );
    }

    res.json({ message: 'Settings updated successfully.' });
  } catch (err) { next(err); }
}

module.exports = { getAll, update };
