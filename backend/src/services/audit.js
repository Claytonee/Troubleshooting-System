const pool = require('../config/database');

/**
 * Append an entry to the audit trail. Never throws — auditing must not break
 * the request that triggered it.
 *
 * @param {object}  opts
 * @param {object}  [opts.actor]      req.user (id, full_name, role)
 * @param {string}  opts.action       short verb, e.g. 'error.status_changed'
 * @param {string}  opts.entityType   'error' | 'school_admin' | 'sub_admin' | 'school' | ...
 * @param {string|number} [opts.entityId]
 * @param {string}  [opts.summary]    human-readable one-liner
 * @param {object}  [opts.meta]       arbitrary JSON detail (before/after, etc.)
 * @param {string}  [opts.ip]
 */
async function logAudit({ actor, action, entityType, entityId, summary, meta, ip } = {}) {
  try {
    await pool.query(
      `INSERT INTO audit_log (actor_id, actor_name, actor_role, action, entity_type, entity_id, summary, meta, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        actor && actor.id ? actor.id : null,
        actor && actor.full_name ? actor.full_name : 'System',
        actor && actor.role ? actor.role : null,
        action,
        entityType,
        entityId != null ? String(entityId) : null,
        summary || null,
        meta ? JSON.stringify(meta) : null,
        ip || null
      ]
    );
  } catch (e) {
    // Swallow — auditing is best-effort.
    if (process.env.NODE_ENV !== 'production') console.warn('audit log failed:', e.message);
  }
}

/** Convenience to pull actor + ip straight off an Express request. */
function fromReq(req) {
  return { actor: req.user, ip: req.ip };
}

module.exports = { logAudit, fromReq };
