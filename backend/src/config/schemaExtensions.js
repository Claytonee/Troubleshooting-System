/**
 * Idempotent schema extensions (audit log, SLA, CSAT) for PostgreSQL.
 * Safe to run on every startup. Called from server.js autoMigrate() and config/migrate.js.
 * `db` is the shared pool from config/database.js (mysql2-compatible wrapper).
 */

// SLA response/resolution target in HOURS, per priority.
const SLA_TARGET_HOURS = { critical: 4, high: 24, medium: 72, low: 168 };

async function applyExtensions(db) {
  // --- Audit log (Tier 1 #5) ---
  await db.query(`CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    actor_id INTEGER,
    actor_name VARCHAR(200),
    actor_role VARCHAR(50),
    action VARCHAR(80) NOT NULL,
    entity_type VARCHAR(60) NOT NULL,
    entity_id VARCHAR(60),
    summary VARCHAR(500),
    meta JSONB,
    ip VARCHAR(60),
    created_at TIMESTAMP DEFAULT NOW()
  )`);
  await db.query('CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log (entity_type, entity_id)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log (created_at)');

  // --- SLA tracking on errors (Tier 1 #2) ---
  await db.query('ALTER TABLE errors ADD COLUMN IF NOT EXISTS sla_due_at TIMESTAMP');
  await db.query('ALTER TABLE errors ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMP');
  await db.query('ALTER TABLE errors ADD COLUMN IF NOT EXISTS sla_breach_notified SMALLINT DEFAULT 0');

  // Backfill SLA due dates for rows that don't have one yet.
  for (const [priority, hours] of Object.entries(SLA_TARGET_HOURS)) {
    await db.query(
      'UPDATE errors SET sla_due_at = created_at + make_interval(hours => ?) WHERE priority = ? AND sla_due_at IS NULL',
      [hours, priority]
    );
  }

  // --- CSAT feedback on errors (Tier 1 #6) ---
  await db.query('ALTER TABLE errors ADD COLUMN IF NOT EXISTS csat_rating SMALLINT');
  await db.query('ALTER TABLE errors ADD COLUMN IF NOT EXISTS csat_comment TEXT');
  await db.query('ALTER TABLE errors ADD COLUMN IF NOT EXISTS csat_token VARCHAR(64)');
}

module.exports = { applyExtensions, SLA_TARGET_HOURS };
