/**
 * Idempotent schema extensions for new features (audit log, SLA, CSAT, ...).
 * Safe to run on every startup. Called from server.js autoMigrate() and config/migrate.js.
 */

// SLA response/resolution target in HOURS, per priority.
const SLA_TARGET_HOURS = { critical: 4, high: 24, medium: 72, low: 168 };

async function columnExists(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows.length > 0;
}

async function addColumnIfMissing(conn, table, column, definition) {
  if (!(await columnExists(conn, table, column))) {
    await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN ${definition}`);
  }
}

async function applyExtensions(conn) {
  // --- Audit log (Tier 1 #5) ---
  await conn.query(`CREATE TABLE IF NOT EXISTS audit_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    actor_id INT NULL,
    actor_name VARCHAR(200),
    actor_role VARCHAR(50),
    action VARCHAR(80) NOT NULL,
    entity_type VARCHAR(60) NOT NULL,
    entity_id VARCHAR(60),
    summary VARCHAR(500),
    meta JSON NULL,
    ip VARCHAR(60),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_entity (entity_type, entity_id),
    INDEX idx_audit_created (created_at)
  ) ENGINE=InnoDB`);

  // --- SLA tracking on errors (Tier 1 #2) ---
  await addColumnIfMissing(conn, 'errors', 'sla_due_at', 'sla_due_at DATETIME NULL AFTER hours_open');
  await addColumnIfMissing(conn, 'errors', 'first_response_at', 'first_response_at DATETIME NULL AFTER sla_due_at');
  await addColumnIfMissing(conn, 'errors', 'sla_breach_notified', 'sla_breach_notified TINYINT DEFAULT 0 AFTER first_response_at');

  // Backfill SLA due dates for existing rows that don't have one yet.
  for (const [priority, hours] of Object.entries(SLA_TARGET_HOURS)) {
    await conn.query(
      `UPDATE errors SET sla_due_at = DATE_ADD(created_at, INTERVAL ? HOUR)
       WHERE priority = ? AND sla_due_at IS NULL`,
      [hours, priority]
    );
  }

  // --- CSAT feedback on errors (Tier 1 #6) ---
  await addColumnIfMissing(conn, 'errors', 'csat_rating', 'csat_rating TINYINT NULL');
  await addColumnIfMissing(conn, 'errors', 'csat_comment', 'csat_comment TEXT NULL');
  await addColumnIfMissing(conn, 'errors', 'csat_token', 'csat_token VARCHAR(64) NULL');
}

module.exports = { applyExtensions, SLA_TARGET_HOURS, columnExists, addColumnIfMissing };
