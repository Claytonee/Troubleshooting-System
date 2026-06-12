const streamifier = require('streamifier');
const cloudinary = require('../config/cloudinary');
const pool = require('../config/database');

function getResourceType(mimetype) {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/') || mimetype.startsWith('audio/')) return 'video';
  return 'raw';
}

function uploadToCloudinary(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (result) resolve(result);
      else reject(error);
    });
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

async function getAll(req, res, next) {
  try {
    const [rows] = await pool.query(
      'SELECT id, title, original_filename, stored_filename, file_type, file_size, category, uploaded_by, created_at FROM manuals ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (err) { next(err); }
}

async function upload(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

    const { title, category } = req.body;
    const resourceType = getResourceType(req.file.mimetype);

    const result = await uploadToCloudinary(req.file.buffer, {
      resource_type: resourceType,
      folder: 'qft-manuals',
      public_id: Date.now() + '-' + req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')
    });

    const [dbResult] = await pool.query(
      'INSERT INTO manuals (title, original_filename, stored_filename, file_type, file_size, category, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        title || req.file.originalname.replace(/\.[^.]+$/, ''),
        req.file.originalname,
        result.secure_url,
        req.file.mimetype,
        req.file.size,
        category || 'General',
        req.user.full_name
      ]
    );

    res.status(201).json({ id: dbResult.insertId, url: result.secure_url, message: 'Manual uploaded successfully.' });
  } catch (err) { next(err); }
}

async function download(req, res, next) {
  try {
    const [rows] = await pool.query('SELECT * FROM manuals WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Manual not found.' });

    const manual = rows[0];
    res.json({ url: manual.stored_filename, filename: manual.original_filename });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    const [rows] = await pool.query('SELECT stored_filename, file_type FROM manuals WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Manual not found.' });

    const url = rows[0].stored_filename;
    const publicId = extractPublicId(url);
    if (publicId) {
      const resourceType = getResourceType(rows[0].file_type);
      try { await cloudinary.uploader.destroy(publicId, { resource_type: resourceType }); } catch (e) {}
    }

    await pool.query('DELETE FROM manuals WHERE id = ?', [req.params.id]);
    res.json({ message: 'Manual deleted successfully.' });
  } catch (err) { next(err); }
}

function extractPublicId(url) {
  if (!url) return null;
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/);
  return match ? match[1] : null;
}

module.exports = { getAll, upload, download, remove };
