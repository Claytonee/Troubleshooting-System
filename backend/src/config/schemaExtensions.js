/**
 * Idempotent schema extensions (audit log, SLA, CSAT) for MySQL.
 * Safe to run on every startup. Called from server.js autoMigrate() and config/migrate.js.
 * `db` is the shared pool from config/database.js (mysql2/promise).
 */

const SLA_TARGET_HOURS = { critical: 4, high: 24, medium: 72, low: 168 };

// Errors that mean "this step has already been applied". These migrations run
// on every boot by design, so from the second boot onwards every ADD COLUMN and
// CREATE INDEX raises one of these. Counting them as failures printed ~25
// "Migration step FAILED" lines per restart and buried the real ones.
const ALREADY_APPLIED = new Set([
  'ER_DUP_FIELDNAME',      // duplicate column name
  'ER_DUP_KEYNAME',        // duplicate index/key name
  'ER_TABLE_EXISTS_ERROR',
  'ER_DUP_ENTRY'           // seed row already present
]);

async function applyExtensions(db) {
  let failed = 0;
  let skipped = 0;
  const q = async (sql, params) => {
    try { await db.query(sql, params); }
    catch (e) {
      if (ALREADY_APPLIED.has(e.code)) { skipped++; return; }
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

  // Inventory delegation. A school administrator may hand a teacher write
  // access to that school's tablet inventory and take it back when the
  // teacher's turn of duty ends. Additive and defaulted to 0, so every existing
  // teacher reads as read-only — the safe direction for a permission column.
  await q('ALTER TABLE teachers ADD COLUMN can_manage_inventory TINYINT(1) DEFAULT 0');
  await q('ALTER TABLE teachers ADD COLUMN inventory_granted_by INT NULL');
  await q('ALTER TABLE teachers ADD COLUMN inventory_granted_at DATETIME NULL');
  await q('ALTER TABLE teachers ADD COLUMN inventory_revoked_at DATETIME NULL');

  // --- User extensions ---
  await q("ALTER TABLE users ADD COLUMN approval_status VARCHAR(20) DEFAULT 'approved'");
  await q("ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500) NULL");
  await q("ALTER TABLE users ADD COLUMN bio TEXT NULL");
  await q("ALTER TABLE users ADD COLUMN must_change_password TINYINT DEFAULT 0");
  // Older DBs created users.role as ENUM('admin','subadmin','school'), which
  // rejects the later 'teacher' role and breaks teacher creation. Widen to
  // VARCHAR(20) (a superset — safe, idempotent) to match bootstrap.js.
  await q("ALTER TABLE users MODIFY COLUMN role VARCHAR(20) NOT NULL DEFAULT 'school'");

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
    -- Feature 4: asset lifecycle (docs/features/04-asset-lifecycle.md).
    -- All nullable and never backfilled: a device with no purchase record is
    -- "unknown", and is shown as unknown rather than guessed at.
    purchase_date DATE,
    purchase_cost DECIMAL(12,2),
    supplier VARCHAR(200),
    warranty_expires_on DATE,
    expected_eol_on DATE,
    -- Devices bought together and used identically fail together, so a fault
    -- rate per batch is a stronger signal than per device — and it is the
    -- number that justifies a warranty claim to a supplier.
    batch_ref VARCHAR(60),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_tablet (school_id, serial_number),
    INDEX idx_tablets_school (school_id),
    INDEX idx_tablets_status (status),
    INDEX idx_tablets_form (school_id, form),
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
  )`);

  // Feature 4 on databases that already have the tablets table.
  await q("ALTER TABLE tablets ADD COLUMN purchase_date DATE NULL");
  await q("ALTER TABLE tablets ADD COLUMN purchase_cost DECIMAL(12,2) NULL");
  await q("ALTER TABLE tablets ADD COLUMN supplier VARCHAR(200) NULL");
  await q("ALTER TABLE tablets ADD COLUMN warranty_expires_on DATE NULL");
  await q("ALTER TABLE tablets ADD COLUMN expected_eol_on DATE NULL");
  await q("ALTER TABLE tablets ADD COLUMN batch_ref VARCHAR(60) NULL");
  await q("CREATE INDEX idx_tablets_warranty ON tablets (warranty_expires_on)");
  await q("CREATE INDEX idx_tablets_batch ON tablets (school_id, batch_ref)");

  // --- Feature 5: visit planner (docs/features/05-visit-planner.md) ---
  // A trip to a school, so several faults can be closed in one journey instead
  // of one journey per fault.
  await q(`CREATE TABLE IF NOT EXISTS visits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    engineer_id INT NOT NULL,
    planned_for DATE NOT NULL,
    started_at DATETIME NULL,
    completed_at DATETIME NULL,
    -- planned | done | cancelled
    status VARCHAR(20) NOT NULL DEFAULT 'planned',
    -- What could not be finished, and why. This is the part the weekly
    -- check-in and the SLA story currently lack.
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_visits_school (school_id, planned_for),
    INDEX idx_visits_engineer (engineer_id, status),
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
  )`);

  // Nullable, so nothing about existing tickets changes: a fault not attached
  // to a visit behaves exactly as it always did.
  await q('ALTER TABLE errors ADD COLUMN visit_id INT NULL');
  await q('CREATE INDEX idx_errors_visit ON errors (visit_id)');

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

  // --- LRS Inventory Module (admin-only) ---
  await q(`CREATE TABLE IF NOT EXISTS lrs_devices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    asset_tag VARCHAR(50),
    hostname VARCHAR(100),
    serial_number VARCHAR(100),
    device_model VARCHAR(200),
    ip_address VARCHAR(50) NOT NULL,
    mac_address VARCHAR(50),
    port INT DEFAULT 3000,
    connection_type VARCHAR(20) DEFAULT 'ethernet',
    os_version VARCHAR(100),
    lrs_version VARCHAR(100),
    storage_gb INT,
    ram_gb INT,
    power_type VARCHAR(50) DEFAULT 'adapter',
    status VARCHAR(20) NOT NULL DEFAULT 'Online',
    sync_status VARCHAR(20) DEFAULT 'Synced',
    last_sync DATETIME,
    last_heartbeat DATETIME,
    records_pending INT DEFAULT 0,
    uptime_hours INT DEFAULT 0,
    notes TEXT,
    installed_at DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_lrs_school (school_id),
    INDEX idx_lrs_status (status),
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
  )`);

  // --- Feature 1: LRS heartbeat (docs/features/01-lrs-heartbeat.md) ---
  await q("ALTER TABLE lrs_devices ADD COLUMN heartbeat_agent_version VARCHAR(30) NULL");
  await q("ALTER TABLE lrs_devices ADD COLUMN heartbeat_disk_free_pct SMALLINT NULL");
  // When the silence started, so a recovery can report how long it lasted.
  await q("ALTER TABLE lrs_devices ADD COLUMN heartbeat_missed_since DATETIME NULL");
  await q("CREATE INDEX idx_lrs_heartbeat ON lrs_devices (last_heartbeat)");
  // Marks a machine-opened ticket and doubles as the dedup key, so a school
  // that stays down for a week produces one error rather than ~2000.
  await q("ALTER TABLE errors ADD COLUMN auto_source VARCHAR(80) NULL");
  // --- Feature 2: offline replay (docs/features/02-offline-pwa.md) ---
  // Client-generated id for a report filed offline. A queued POST that timed
  // out after the server had already committed would otherwise file the same
  // fault twice on replay.
  await q("ALTER TABLE errors ADD COLUMN client_ref VARCHAR(64) NULL");
  await q("CREATE UNIQUE INDEX uq_errors_client_ref ON errors (client_ref)");

  // --- Feature 3: WhatsApp intake (docs/features/03-whatsapp-intake.md) ---
  // How a ticket arrived: 'web' | 'whatsapp' | 'monitor'. Nullable with no
  // backfill — existing rows predate the distinction and 'unknown' is honest.
  await q("ALTER TABLE errors ADD COLUMN intake_channel VARCHAR(20) NULL");
  await q("CREATE INDEX idx_errors_intake ON errors (intake_channel)");

  // One row per phone number in conversation with the support line.
  await q(`CREATE TABLE IF NOT EXISTS whatsapp_conversations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    phone VARCHAR(30) NOT NULL,
    user_id INT NULL,
    school_id INT NULL,
    -- A number matched to a user or teacher record; unverified numbers may file
    -- against a school code they supply but can never read anything back.
    verified TINYINT(1) NOT NULL DEFAULT 0,
    -- idle | awaiting_school | offered
    state VARCHAR(30) NOT NULL DEFAULT 'idle',
    -- The fault being discussed, held until they confirm it should be filed.
    draft JSON NULL,
    last_message_at DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_wa_phone (phone),
    INDEX idx_wa_school (school_id)
  )`);

  // Transcript, and the dedup key for Meta's webhook retries.
  await q(`CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id INT NOT NULL,
    wa_message_id VARCHAR(120) NULL,
    direction VARCHAR(8) NOT NULL,
    body TEXT,
    media_url VARCHAR(500) NULL,
    error_id INT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_wa_msg (wa_message_id),
    INDEX idx_wa_msg_conv (conversation_id, created_at),
    FOREIGN KEY (conversation_id) REFERENCES whatsapp_conversations(id) ON DELETE CASCADE
  )`);
  await q("CREATE INDEX idx_errors_auto_source ON errors (auto_source, status)");

  await q(`CREATE TABLE IF NOT EXISTS lrs_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    lrs_id INT NOT NULL,
    action VARCHAR(50) NOT NULL,
    old_value VARCHAR(200),
    new_value VARCHAR(200),
    actor_name VARCHAR(200),
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_lrs_history_lrs (lrs_id),
    FOREIGN KEY (lrs_id) REFERENCES lrs_devices(id) ON DELETE CASCADE
  )`);

  // --- Spares and swaps (feature 9) ---
  // A spare is a working device deliberately held aside so a faulty one can be
  // swapped out on the spot. Marking it on the device itself rather than in a
  // parallel table keeps one source of truth for where every device is.
  await q('ALTER TABLE tablets ADD COLUMN is_spare TINYINT(1) DEFAULT 0');
  await q('CREATE INDEX idx_tablets_spare ON tablets (school_id, is_spare, status)');

  // One row per swap. Reconstructing this from two history rows is fragile, and
  // "did the visit fix it first time" is a question worth being able to answer
  // directly — it is the field-service metric that everything else follows.
  await q(`CREATE TABLE IF NOT EXISTS tablet_swaps (
    id INT AUTO_INCREMENT PRIMARY KEY,
    school_id INT NOT NULL,
    faulty_tablet_id INT NOT NULL,
    spare_tablet_id INT NOT NULL,
    error_id INT NULL,
    visit_id INT NULL,
    student_name VARCHAR(200),
    swapped_by VARCHAR(200),
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_swaps_school (school_id, created_at),
    INDEX idx_swaps_error (error_id)
  )`);

  // --- USSD sessions (feature 8) ---
  // One row per call. A session that reaches the menu and stops is a fault
  // somebody wanted to report and could not — the number this feature exists
  // to move — so the abandoned ones matter as much as the filed ones.
  await q(`CREATE TABLE IF NOT EXISTS ussd_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(100) NOT NULL,
    phone VARCHAR(30),
    user_id INT NULL,
    school_id INT NULL,
    outcome VARCHAR(40) NOT NULL,
    error_id INT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_ussd_session (session_id),
    INDEX idx_ussd_outcome (outcome, created_at)
  )`);

  // --- Error Attachments ---
  await q(`CREATE TABLE IF NOT EXISTS error_attachments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    error_id INT NOT NULL,
    original_filename VARCHAR(300) NOT NULL,
    stored_url VARCHAR(500) NOT NULL,
    file_type VARCHAR(100),
    file_size INT DEFAULT 0,
    resource_type VARCHAR(20) DEFAULT 'raw',
    uploaded_by VARCHAR(200),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_err_attach_error (error_id),
    FOREIGN KEY (error_id) REFERENCES errors(id) ON DELETE CASCADE
  )`);

  if (skipped) console.log(`  schemaExtensions: ${skipped} step(s) already applied.`);
  if (failed) console.error(`  schemaExtensions: ${failed} step(s) failed — see errors above.`);
}

module.exports = { applyExtensions, SLA_TARGET_HOURS };
