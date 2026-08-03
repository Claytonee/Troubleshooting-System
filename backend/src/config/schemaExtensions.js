/**
 * Idempotent schema extensions (audit log, SLA, CSAT) for MySQL.
 * Safe to run on every startup. Called from server.js autoMigrate() and config/migrate.js.
 * `db` is the shared pool from config/database.js (mysql2/promise).
 */

const SLA_TARGET_HOURS = { critical: 4, high: 24, medium: 72, low: 168 };

async function applyExtensions(db) {
  let failed = 0;
  const q = async (sql, params) => {
    try { await db.query(sql, params); }
    catch (e) {
      failed++;
      console.error('  Migration step FAILED:', e.message);
      console.error('    SQL:', sql.replace(/\s+/g, ' ').trim().slice(0, 140));
    }
  };

  // --- Audit log ---
  await q(`CREATE TABLE IF NOT EXISTS audit_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    actor_id INT,
    actor_name VARCHAR(200),
    actor_role VARCHAR(50),
    action VARCHAR(80) NOT NULL,
    entity_type VARCHAR(60) NOT NULL,
    entity_id VARCHAR(60),
    summary VARCHAR(500),
    meta JSON,
    ip VARCHAR(60),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  await q('CREATE INDEX idx_audit_entity ON audit_log (entity_type, entity_id)');
  await q('CREATE INDEX idx_audit_created ON audit_log (created_at)');

  // --- SLA tracking on errors ---
  await q('ALTER TABLE errors ADD COLUMN sla_due_at DATETIME NULL');
  await q('ALTER TABLE errors ADD COLUMN first_response_at DATETIME NULL');
  await q('ALTER TABLE errors ADD COLUMN sla_breach_notified SMALLINT DEFAULT 0');

  // Backfill SLA due dates
  for (const [priority, hours] of Object.entries(SLA_TARGET_HOURS)) {
    await q(
      'UPDATE errors SET sla_due_at = DATE_ADD(created_at, INTERVAL ? HOUR) WHERE priority = ? AND sla_due_at IS NULL',
      [hours, priority]
    );
  }

  // --- CSAT feedback on errors ---
  await q('ALTER TABLE errors ADD COLUMN csat_rating SMALLINT NULL');
  await q('ALTER TABLE errors ADD COLUMN csat_comment TEXT NULL');
  await q('ALTER TABLE errors ADD COLUMN csat_token VARCHAR(64) NULL');

  // --- Extended school profile ---
  await q('ALTER TABLE schools ADD COLUMN contact_email VARCHAR(255) NULL');
  await q('ALTER TABLE schools ADD COLUMN it_name VARCHAR(200) NULL');
  await q('ALTER TABLE schools ADD COLUMN it_email VARCHAR(255) NULL');
  await q('ALTER TABLE schools ADD COLUMN coordinator_name VARCHAR(200) NULL');
  await q('ALTER TABLE schools ADD COLUMN coordinator_email VARCHAR(255) NULL');

  // --- AI Chat ---
  await q(`CREATE TABLE IF NOT EXISTS ai_chats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(300) DEFAULT 'New Chat',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_ai_chats_user (user_id)
  )`);

  await q(`CREATE TABLE IF NOT EXISTS ai_chat_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    chat_id INT NOT NULL,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ai_messages_chat (chat_id),
    FOREIGN KEY (chat_id) REFERENCES ai_chats(id) ON DELETE CASCADE
  )`);

  // --- Self-Registration & Approval System ---
  await q(`CREATE TABLE IF NOT EXISTS registration_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(200) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    password_hash VARCHAR(255) NOT NULL,
    school_id INT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'school',
    title VARCHAR(200),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    reviewed_by INT,
    reviewed_at DATETIME,
    rejection_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_reg_requests_status (status),
    INDEX idx_reg_requests_email (email)
  )`);

  // --- Teacher Registration Links ---
  await q(`CREATE TABLE IF NOT EXISTS registration_links (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    token VARCHAR(100) NOT NULL UNIQUE,
    created_by INT NOT NULL,
    expires_at DATETIME NOT NULL,
    max_uses INT DEFAULT 50,
    use_count INT DEFAULT 0,
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_reg_links_token (token)
  )`);

  // --- Registration Appeals ---
  await q(`CREATE TABLE IF NOT EXISTS registration_appeals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    request_id INT NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    message TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // --- Teachers table ---
  await q(`CREATE TABLE IF NOT EXISTS teachers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNIQUE,
    school_id INT NOT NULL,
    subject VARCHAR(200),
    employee_id VARCHAR(50),
    status VARCHAR(20) DEFAULT 'active',
    registered_via VARCHAR(20) DEFAULT 'link',
    approved_by INT,
    approved_at DATETIME,
    rejection_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_teachers_school (school_id),
    INDEX idx_teachers_user (user_id)
  )`);

  // --- User extensions ---
  await q("ALTER TABLE users ADD COLUMN approval_status VARCHAR(20) DEFAULT 'approved'");
  await q("ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500) NULL");
  await q("ALTER TABLE users ADD COLUMN bio TEXT NULL");
  await q("ALTER TABLE users ADD COLUMN must_change_password TINYINT DEFAULT 0");

  // --- Escalation fields on errors ---
  await q("ALTER TABLE errors ADD COLUMN escalation_level VARCHAR(20) DEFAULT 'school'");
  await q('ALTER TABLE errors ADD COLUMN escalated_by INT NULL');
  await q('ALTER TABLE errors ADD COLUMN escalated_at DATETIME NULL');
  await q('ALTER TABLE errors ADD COLUMN reported_by_user_id INT NULL');

  // --- Weekly check-ins: checkin_date ---
  await q('ALTER TABLE weekly_checkins ADD COLUMN checkin_date DATE NULL');
  await q('UPDATE weekly_checkins SET checkin_date = DATE(created_at) WHERE checkin_date IS NULL');

  // --- Admin notifications ---
  await q(`CREATE TABLE IF NOT EXISTS admin_notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    target_role VARCHAR(20) DEFAULT 'admin',
    type VARCHAR(50) NOT NULL,
    title VARCHAR(300) NOT NULL,
    message TEXT,
    meta JSON,
    is_read TINYINT(1) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_admin_notif_read (is_read, created_at)
  )`);

  // --- Tablet Inventory Module ---
  await q(`CREATE TABLE IF NOT EXISTS tablets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    serial_number VARCHAR(100) NOT NULL,
    asset_tag VARCHAR(50),
    form VARCHAR(20),
    stream VARCHAR(10),
    model VARCHAR(200),
    year_first_used INT,
    status VARCHAR(20) NOT NULL DEFAULT 'Working',
    student_name VARCHAR(200),
    admission_no VARCHAR(100),
    last_checked DATE,
    notes TEXT,
    assigned_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_tablet (school_id, serial_number),
    INDEX idx_tablets_school (school_id),
    INDEX idx_tablets_status (status),
    INDEX idx_tablets_form (school_id, form),
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
  )`);

  await q(`CREATE TABLE IF NOT EXISTS tablet_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tablet_id INT NOT NULL,
    action VARCHAR(50) NOT NULL,
    old_value VARCHAR(200),
    new_value VARCHAR(200),
    actor_name VARCHAR(200),
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tablet_history_tablet (tablet_id),
    FOREIGN KEY (tablet_id) REFERENCES tablets(id) ON DELETE CASCADE
  )`);

  // --- School form-level breakdown ---
  await q(`CREATE TABLE IF NOT EXISTS school_forms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    form_name VARCHAR(50) NOT NULL,
    students INT DEFAULT 0,
    tablets INT DEFAULT 0,
    UNIQUE KEY uq_school_form (school_id, form_name),
    INDEX idx_school_forms_school (school_id),
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
  )`);

  if (failed) console.error(`  schemaExtensions: ${failed} step(s) failed — see errors above.`);
}

module.exports = { applyExtensions, SLA_TARGET_HOURS };
