const path = require('path');
const fs = require('fs');
const pool = require('../config/database');

async function getAll(req, res, next) {
  try {
    const [rows] = await pool.query('SELECT id, title, original_filename, file_type, file_size, category, uploaded_by, created_at FROM manuals ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) { next(err); }
}

async function upload(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

    const { title, category, uploaded_by } = req.body;

    const [result] = await pool.query(
      'INSERT INTO manuals (title, original_filename, stored_filename, file_type, file_size, category, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        title || req.file.originalname.replace(/\.[^.]+$/, ''),
        req.file.originalname,
        req.file.filename,
        req.file.mimetype,
        req.file.size,
        category || 'General',
        uploaded_by || req.user.full_name
      ]
    );

    res.status(201).json({ id: result.insertId, message: 'Manual uploaded successfully.' });
  } catch (err) { next(err); }
}

async function download(req, res, next) {
  try {
    const [rows] = await pool.query('SELECT * FROM manuals WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Manual not found.' });

    const manual = rows[0];
    const filePath = path.join(process.env.UPLOAD_DIR || './uploads', manual.stored_filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on server.' });
    }

    res.download(filePath, manual.original_filename);
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const [rows] = await pool.query('SELECT stored_filename FROM manuals WHERE id = ?', [req.params.id]);
    if (rows.length) {
      const filePath = path.join(process.env.UPLOAD_DIR || './uploads', rows[0].stored_filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await pool.query('DELETE FROM manuals WHERE id = ?', [req.params.id]);
    res.json({ message: 'Manual deleted successfully.' });
  } catch (err) { next(err); }
}

module.exports = { getAll, upload, download, remove };
