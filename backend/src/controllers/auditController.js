const pool = require('../config/database');

async function getAll(req, res, next) {
  try {
    const conditions = [];
    const params = [];

    if (req.query.entity_type) { conditions.push('entity_type = ?'); params.push(req.query.entity_type); }
    if (req.query.action) { conditions.push('action = ?'); params.push(req.query.action); }
    if (req.query.actor_id) { conditions.push('actor_id = ?'); params.push(req.query.actor_id); }
    if (req.query.search) {
      conditions.push('(summary LIKE ? OR actor_name LIKE ?)');
      const t = `%${req.query.search}%`;
      params.push(t, t);
    }

    let query = 'SELECT id, actor_id, actor_name, actor_role, action, entity_type, entity_id, summary, meta, created_at FROM audit_log';
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(Math.min(parseInt(req.query.limit, 10) || 200, 1000));

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) { next(err); }
}

module.exports = { getAll };
