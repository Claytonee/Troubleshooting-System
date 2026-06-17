const pool = require('../config/database');

/**
 * Unified knowledge-base search across troubleshooting guides and resources
 * (Tier 1 #3). LIKE-based — robust at this scale, no FULLTEXT index setup needed.
 */
async function search(req, res, next) {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json({ query: q, guides: [], resources: [] });
    const like = `%${q}%`;

    const [guides] = await pool.query(
      `SELECT id, title, category, icon, 'guide' AS type
       FROM troubleshooting_guides
       WHERE title ILIKE ? OR steps::text ILIKE ? OR category ILIKE ?
       ORDER BY title LIMIT 25`,
      [like, like, like]
    );

    const [resources] = await pool.query(
      `SELECT id, title, category, file_type, stored_filename AS url, 'resource' AS type
       FROM manuals
       WHERE title ILIKE ? OR original_filename ILIKE ? OR category ILIKE ?
       ORDER BY created_at DESC LIMIT 25`,
      [like, like, like]
    );

    res.json({ query: q, guides, resources });
  } catch (err) { next(err); }
}

module.exports = { search };
