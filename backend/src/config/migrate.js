const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
  });

  console.log('Connected to MySQL server.');

  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'qft_support'}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await connection.query(`USE \`${process.env.DB_NAME || 'qft_support'}\``);

  console.log('Creating tables...');

  await connection.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      full_name VARCHAR(200) NOT NULL,
      role ENUM('admin', 'subadmin', 'school') NOT NULL DEFAULT 'school',
      phone VARCHAR(50),
      zone VARCHAR(100),
      color VARCHAR(50) DEFAULT '#4f7cff',
      title VARCHAR(200),
      status ENUM('active', 'onsite', 'remote', 'inactive') DEFAULT 'active',
      school_id INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS schools (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(200) NOT NULL,
      zone VARCHAR(100),
      students INT DEFAULT 0,
      tablets INT DEFAULT 0,
      routers INT DEFAULT 0,
      contact_name VARCHAR(200),
      contact_role VARCHAR(100),
      contact_phone VARCHAR(50),
      lrs_ip VARCHAR(50) DEFAULT '192.168.0.10',
      isp VARCHAR(100),
      assigned_admin_id INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (assigned_admin_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB;
  `);

  await connection.query(`
    ALTER TABLE users ADD CONSTRAINT fk_user_school
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL;
  `).catch(() => {});

  await connection.query(`
    CREATE TABLE IF NOT EXISTS errors (
      id INT AUTO_INCREMENT PRIMARY KEY,
      error_code VARCHAR(20) NOT NULL UNIQUE,
      title VARCHAR(300) NOT NULL,
      description TEXT,
      school_id INT NOT NULL,
      category ENUM('Connectivity', 'Hardware', 'Platform', 'Power', 'Accounts', 'Other') NOT NULL,
      subcategory VARCHAR(200),
      priority ENUM('critical', 'high', 'medium', 'low') NOT NULL DEFAULT 'medium',
      status ENUM('open', 'progress', 'escalated', 'resolved') NOT NULL DEFAULT 'open',
      assigned_to INT NULL,
      reporter_name VARCHAR(200),
      reporter_role VARCHAR(100),
      reporter_contact VARCHAR(100),
      location VARCHAR(200),
      affected_devices VARCHAR(300),
      hours_open DECIMAL(10,1) DEFAULT 0,
      resolved_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB;
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS error_updates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      error_id INT NOT NULL,
      update_type VARCHAR(100),
      note TEXT NOT NULL,
      recorded_by VARCHAR(200),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (error_id) REFERENCES errors(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS weekly_checkins (
      id INT AUTO_INCREMENT PRIMARY KEY,
      school_id INT NOT NULL,
      week_number INT NOT NULL,
      term VARCHAR(50) NOT NULL DEFAULT 'Term 2 · 2026',
      status ENUM('green', 'amber', 'red') NOT NULL DEFAULT 'green',
      connectivity ENUM('ok', 'issue', 'na') DEFAULT 'ok',
      tablets ENUM('ok', 'issue', 'na') DEFAULT 'ok',
      platform ENUM('ok', 'issue', 'na') DEFAULT 'ok',
      power ENUM('ok', 'issue', 'na') DEFAULT 'ok',
      note TEXT,
      checked_by VARCHAR(200),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
      UNIQUE KEY unique_checkin (school_id, week_number, term)
    ) ENGINE=InnoDB;
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS communications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      school_id INT NOT NULL,
      recorded_by VARCHAR(200),
      note TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
    ) ENGINE=InnoDB;
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS troubleshooting_guides (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(300) NOT NULL,
      category VARCHAR(100),
      icon VARCHAR(100) DEFAULT 'ti-tools',
      steps JSON NOT NULL,
      is_custom BOOLEAN DEFAULT FALSE,
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB;
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS manuals (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(300) NOT NULL,
      original_filename VARCHAR(300),
      stored_filename VARCHAR(300),
      file_type VARCHAR(100),
      file_size INT DEFAULT 0,
      category VARCHAR(100) DEFAULT 'General',
      uploaded_by VARCHAR(200) DEFAULT 'System Admin',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      setting_key VARCHAR(100) NOT NULL UNIQUE,
      setting_value TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `);

  await connection.query(`
    INSERT IGNORE INTO settings (setting_key, setting_value) VALUES
    ('brand_name', 'Quest Forward Tanzania'),
    ('brand_short', 'QF'),
    ('brand_subtitle', 'Technical Support'),
    ('brand_logo_url', ''),
    ('brand_color', '#FFAE00'),
    ('loader_text', 'Loading system...')
  `);

  console.log('All tables created successfully!');
  console.log('Migration complete.');
  await connection.end();
}

migrate().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
