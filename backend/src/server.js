require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const schoolRoutes = require('./routes/schools');
const errorRoutes = require('./routes/errors');
const teamRoutes = require('./routes/team');
const checkinRoutes = require('./routes/checkins');
const guideRoutes = require('./routes/guides');
const manualRoutes = require('./routes/manuals');
const commRoutes = require('./routes/communications');
const settingsRoutes = require('./routes/settings');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? (process.env.FRONTEND_URL || true) : '*',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Auth endpoint has stricter rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many login attempts, please try again later.' }
});
app.use('/api/auth/login', authLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('short'));
}

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads')));

// Serve frontend (new modular structure)
app.use(express.static(path.join(__dirname, '..', '..', 'frontend')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/schools', schoolRoutes);
app.use('/api/errors', errorRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/checkins', checkinRoutes);
app.use('/api/guides', guideRoutes);
app.use('/api/manuals', manualRoutes);
app.use('/api/communications', commRoutes);
app.use('/api/settings', settingsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// Serve frontend for non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'frontend', 'index.html'));
});

// Error handler
app.use(errorHandler);

async function autoMigrate() {
  const mysql = require('mysql2/promise');
  const bcrypt = require('bcryptjs');
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : undefined,
      multipleStatements: true
    });

    await conn.query(`CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY, username VARCHAR(100) NOT NULL UNIQUE, email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL, full_name VARCHAR(200) NOT NULL,
      role ENUM('admin','subadmin','school') NOT NULL DEFAULT 'school', phone VARCHAR(50), zone VARCHAR(100),
      color VARCHAR(50) DEFAULT '#4f7cff', title VARCHAR(200),
      status ENUM('active','onsite','remote','inactive') DEFAULT 'active', school_id INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);

    await conn.query(`CREATE TABLE IF NOT EXISTS schools (
      id INT AUTO_INCREMENT PRIMARY KEY, code VARCHAR(50) NOT NULL UNIQUE, name VARCHAR(200) NOT NULL,
      zone VARCHAR(100), students INT DEFAULT 0, tablets INT DEFAULT 0, routers INT DEFAULT 0,
      contact_name VARCHAR(200), contact_role VARCHAR(100), contact_phone VARCHAR(50),
      lrs_ip VARCHAR(50) DEFAULT '192.168.0.10', isp VARCHAR(100), assigned_admin_id INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);

    await conn.query(`CREATE TABLE IF NOT EXISTS errors (
      id INT AUTO_INCREMENT PRIMARY KEY, error_code VARCHAR(20) NOT NULL UNIQUE, title VARCHAR(300) NOT NULL,
      description TEXT, school_id INT NOT NULL, category ENUM('Connectivity','Hardware','Platform','Power','Accounts','Other') NOT NULL,
      subcategory VARCHAR(200), priority ENUM('critical','high','medium','low') NOT NULL DEFAULT 'medium',
      status ENUM('open','progress','escalated','resolved') NOT NULL DEFAULT 'open', assigned_to INT NULL,
      reporter_name VARCHAR(200), reporter_role VARCHAR(100), reporter_contact VARCHAR(100),
      location VARCHAR(200), affected_devices VARCHAR(300), hours_open DECIMAL(10,1) DEFAULT 0,
      resolved_at TIMESTAMP NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);

    await conn.query(`CREATE TABLE IF NOT EXISTS error_updates (
      id INT AUTO_INCREMENT PRIMARY KEY, error_id INT NOT NULL, update_type VARCHAR(100),
      note TEXT NOT NULL, recorded_by VARCHAR(200), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);

    await conn.query(`CREATE TABLE IF NOT EXISTS weekly_checkins (
      id INT AUTO_INCREMENT PRIMARY KEY, school_id INT NOT NULL, week_number INT NOT NULL,
      term VARCHAR(50) NOT NULL DEFAULT 'Term 2 · 2026',
      status ENUM('green','amber','red') NOT NULL DEFAULT 'green',
      connectivity ENUM('ok','issue','na') DEFAULT 'ok', tablets ENUM('ok','issue','na') DEFAULT 'ok',
      platform ENUM('ok','issue','na') DEFAULT 'ok', power ENUM('ok','issue','na') DEFAULT 'ok',
      note TEXT, checked_by VARCHAR(200), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);

    await conn.query(`CREATE TABLE IF NOT EXISTS communications (
      id INT AUTO_INCREMENT PRIMARY KEY, school_id INT NOT NULL, recorded_by VARCHAR(200),
      note TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);

    await conn.query(`CREATE TABLE IF NOT EXISTS troubleshooting_guides (
      id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(300) NOT NULL, category VARCHAR(100),
      icon VARCHAR(100) DEFAULT 'ti-tools', steps JSON NOT NULL, is_custom BOOLEAN DEFAULT FALSE,
      created_by INT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);

    await conn.query(`CREATE TABLE IF NOT EXISTS manuals (
      id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(300) NOT NULL, original_filename VARCHAR(300),
      stored_filename VARCHAR(300), file_type VARCHAR(100), file_size INT DEFAULT 0,
      category VARCHAR(100) DEFAULT 'General', uploaded_by VARCHAR(200) DEFAULT 'System Admin',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);

    await conn.query(`CREATE TABLE IF NOT EXISTS settings (
      id INT AUTO_INCREMENT PRIMARY KEY, setting_key VARCHAR(100) NOT NULL UNIQUE,
      setting_value TEXT, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);

    await conn.query(`INSERT IGNORE INTO settings (setting_key, setting_value) VALUES
      ('brand_name','Quest Forward Tanzania'),('brand_short','QF'),('brand_subtitle','Technical Support'),
      ('brand_logo_url',''),('brand_color','#FFAE00'),('loader_text','Loading system...')`);

    const [existing] = await conn.query('SELECT id FROM users WHERE username = ?', ['admin']);
    if (!existing.length) {
      const hash = await bcrypt.hash('admin123', 10);
      await conn.query(`INSERT INTO users (username, email, password_hash, full_name, role, phone, zone, color, title, status)
        VALUES ('admin','admin@questforward.org',?,'System Administrator','admin','+255 658 000 000','HQ','#4f7cff','System Admin','active')`, [hash]);
      console.log('  Admin user created (admin/admin123)');
    }

    await conn.end();
    console.log('  Database: migrated OK');
  } catch (e) {
    console.error('  Database migration warning:', e.message);
  }
}

app.listen(PORT, async () => {
  console.log(`\n  Quest Forward Tanzania - Technical Support System`);
  console.log(`  ================================================`);
  console.log(`  Server running on http://localhost:${PORT}`);
  console.log(`  API base:         http://localhost:${PORT}/api`);
  console.log(`  Environment:      ${process.env.NODE_ENV || 'development'}`);
  console.log(`  Database:         ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
  await autoMigrate();
  console.log(`  ================================================\n`);
});

module.exports = app;
