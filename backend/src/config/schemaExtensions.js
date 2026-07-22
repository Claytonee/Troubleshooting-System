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

  // --- Extended school profile (contact email, IT personnel, coordinator) ---
  await db.query('ALTER TABLE schools ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255)');
  await db.query('ALTER TABLE schools ADD COLUMN IF NOT EXISTS it_name VARCHAR(200)');
  await db.query('ALTER TABLE schools ADD COLUMN IF NOT EXISTS it_email VARCHAR(255)');
  await db.query('ALTER TABLE schools ADD COLUMN IF NOT EXISTS coordinator_name VARCHAR(200)');
  await db.query('ALTER TABLE schools ADD COLUMN IF NOT EXISTS coordinator_email VARCHAR(255)');

  // --- AI Chat (self-service troubleshooting assistant) ---
  await db.query(`CREATE TABLE IF NOT EXISTS ai_chats (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    title VARCHAR(300) DEFAULT 'New Chat',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`);
  await db.query('CREATE INDEX IF NOT EXISTS idx_ai_chats_user ON ai_chats (user_id)');

  await db.query(`CREATE TABLE IF NOT EXISTS ai_chat_messages (
    id SERIAL PRIMARY KEY,
    chat_id INTEGER NOT NULL REFERENCES ai_chats(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user','assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  )`);
  await db.query('CREATE INDEX IF NOT EXISTS idx_ai_messages_chat ON ai_chat_messages (chat_id)');

  // --- Self-Registration & Approval System ---
  await db.query(`CREATE TABLE IF NOT EXISTS registration_requests (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(200) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    password_hash VARCHAR(255) NOT NULL,
    school_id INTEGER NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'school',
    title VARCHAR(200),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    reviewed_by INTEGER,
    reviewed_at TIMESTAMP,
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`);
  await db.query('CREATE INDEX IF NOT EXISTS idx_reg_requests_status ON registration_requests (status)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_reg_requests_email ON registration_requests (email)');

  // --- Teacher Registration Links ---
  await db.query(`CREATE TABLE IF NOT EXISTS registration_links (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL,
    token VARCHAR(100) NOT NULL UNIQUE,
    created_by INTEGER NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    max_uses INTEGER DEFAULT 50,
    use_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
  )`);
  await db.query('CREATE INDEX IF NOT EXISTS idx_reg_links_token ON registration_links (token)');

  // --- Registration Appeals ---
  await db.query(`CREATE TABLE IF NOT EXISTS registration_appeals (
    id SERIAL PRIMARY KEY,
    request_id INTEGER NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    message TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
  )`);

  // --- Teachers table (links user to school with extra metadata) ---
  await db.query(`CREATE TABLE IF NOT EXISTS teachers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE,
    school_id INTEGER NOT NULL,
    subject VARCHAR(200),
    employee_id VARCHAR(50),
    status VARCHAR(20) DEFAULT 'active',
    registered_via VARCHAR(20) DEFAULT 'link',
    approved_by INTEGER,
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`);
  await db.query('CREATE INDEX IF NOT EXISTS idx_teachers_school ON teachers (school_id)');
  await db.query('CREATE INDEX IF NOT EXISTS idx_teachers_user ON teachers (user_id)');
  await db.query("ALTER TABLE teachers ADD COLUMN IF NOT EXISTS rejection_reason TEXT");

  // --- Add approval_status to users (existing users = approved) ---
  await db.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'approved'");

  // --- Add teacher role to users CHECK constraint ---
  // PostgreSQL: drop old constraint and add new one that includes 'teacher'
  await db.query(`DO $$ BEGIN
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
    ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin','subadmin','school','teacher'));
  EXCEPTION WHEN others THEN NULL;
  END $$`);

  // --- Add escalation fields to errors ---
  await db.query("ALTER TABLE errors ADD COLUMN IF NOT EXISTS escalation_level VARCHAR(20) DEFAULT 'school'");
  await db.query('ALTER TABLE errors ADD COLUMN IF NOT EXISTS escalated_by INTEGER');
  await db.query('ALTER TABLE errors ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMP');
  await db.query('ALTER TABLE errors ADD COLUMN IF NOT EXISTS reported_by_user_id INTEGER');

  // --- Weekly check-ins: actual visit date (chosen by the user, not just the week) ---
  await db.query('ALTER TABLE weekly_checkins ADD COLUMN IF NOT EXISTS checkin_date DATE');
  await db.query('UPDATE weekly_checkins SET checkin_date = created_at::date WHERE checkin_date IS NULL');

  // --- User profile extensions (avatar, bio) ---
  await db.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500)");
  await db.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT");

  // --- Admin notifications (persistent in-app notifications) ---
  await db.query(`CREATE TABLE IF NOT EXISTS admin_notifications (
    id SERIAL PRIMARY KEY,
    target_role VARCHAR(20) DEFAULT 'admin',
    type VARCHAR(50) NOT NULL,
    title VARCHAR(300) NOT NULL,
    message TEXT,
    meta JSONB,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
  )`);
  await db.query('CREATE INDEX IF NOT EXISTS idx_admin_notif_read ON admin_notifications (is_read, created_at DESC)');

  // --- School form-level breakdown (students & tablets per form/class) ---
  await db.query(`CREATE TABLE IF NOT EXISTS school_forms (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    form_name VARCHAR(50) NOT NULL,
    students INTEGER DEFAULT 0,
    tablets INTEGER DEFAULT 0,
    UNIQUE(school_id, form_name)
  )`);
  await db.query('CREATE INDEX IF NOT EXISTS idx_school_forms_school ON school_forms (school_id)');
}

module.exports = { applyExtensions, SLA_TARGET_HOURS };
