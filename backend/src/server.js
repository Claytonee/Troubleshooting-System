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

app.set('trust proxy', 1);

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
  const fs = require('fs');
  try {
    const sslOpts = process.env.NODE_ENV === 'production'
      ? { ca: fs.readFileSync(path.join(__dirname, 'config', 'ca.pem'), 'utf8'), rejectUnauthorized: false }
      : undefined;
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: sslOpts,
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
      await conn.query(`INSERT INTO users (username, email, password_hash, full_name, role, phone, zone, color, title, status) VALUES
        ('admin','admin@questforward.org',?,'System Administrator','admin','+255 658 000 000','HQ','#4f7cff','System Admin','active'),
        ('knjoro','knjoro@questforward.org',?,'K. Njoro','subadmin','+255 658 066 983','Moshi Zone','#4f7cff','Senior Engineer · Lead','active'),
        ('famani','famani@questforward.org',?,'F. Amani','subadmin','+255 754 110 220','Kilema–Kibosho','#2dd98a','Senior Engineer','onsite'),
        ('thassan','thassan@questforward.org',?,'T. Hassan','subadmin','+255 762 330 440','Rombo','#9b7dff','Senior Engineer','active'),
        ('cmbowe','cmbowe@questforward.org',?,'Clinton Mbowe','subadmin','+255 715 880 990','Remote / HQ','#36d9cc','IT Officer · Platform','remote')
      `, [hash, hash, hash, hash, hash]);
      console.log('  Users seeded');
    }

    const [schoolCheck] = await conn.query('SELECT id FROM schools LIMIT 1');
    if (!schoolCheck.length) {
      const [userRows] = await conn.query('SELECT id, username FROM users');
      const u = {}; userRows.forEach(r => u[r.username] = r.id);

      await conn.query(`INSERT INTO schools (code, name, zone, students, tablets, routers, contact_name, contact_role, contact_phone, lrs_ip, isp, assigned_admin_id) VALUES
        ('kilema','Kilema Secondary','Rombo',340,48,2,'Mr. Eliya Mushi','IT Coordinator','+255 712 000 101','192.168.0.10','Vodacom Fibre',?),
        ('moshiu','Moshi Urban Sec.','Moshi Urban',510,72,3,'Ms. Neema Lyimo','Head Teacher','+255 712 000 102','192.168.0.10','TTCL Fibre',?),
        ('kibosho','Kibosho Boys Sec.','Hai',280,40,2,'Mr. Baraka Swai','IT Coordinator','+255 712 000 103','192.168.0.10','Vodacom Fibre',?),
        ('marangu','Marangu Girls Sec.','Moshi Rural',220,32,1,'Ms. Asha Kileo','Quest Coordinator','+255 712 000 104','192.168.0.10','Airtel',?),
        ('mweka','Mweka Secondary','Hai',195,28,1,'Mr. John Massawe','IT Coordinator','+255 712 000 105','192.168.0.10','TTCL Fibre',?),
        ('oldmoshi','Old Moshi Sec.','Moshi Rural',310,44,2,'Ms. Grace Mollel','Head Teacher','+255 712 000 106','192.168.0.10','Vodacom Fibre',?),
        ('machame','Machame Secondary','Hai',260,38,2,'Mr. Frank Mushi','IT Coordinator','+255 712 000 107','192.168.0.10','Airtel',?),
        ('uru','Uru Secondary','Moshi Rural',180,24,1,'Ms. Tatu Hassan','Quest Coordinator','+255 712 000 108','192.168.0.10','TTCL',?),
        ('pasua','Pasua Secondary','Moshi Urban',290,42,2,'Ms. Salma Juma','Quest Coordinator','+255 712 000 111','192.168.0.10','TTCL Fibre',?)
      `, [u.thassan, u.knjoro, u.famani, u.knjoro, u.famani, u.knjoro, u.famani, u.knjoro, u.knjoro]);
      console.log('  Schools seeded');

      const [schools] = await conn.query('SELECT id, code FROM schools');
      const s = {}; schools.forEach(r => s[r.code] = r.id);

      await conn.query(`INSERT INTO errors (error_code, title, description, school_id, category, priority, status, assigned_to, hours_open) VALUES
        ('QFT-0241','WiFi router offline','Lab router not powering on. Whole computer lab offline.',?,'Connectivity','critical','open',?,3),
        ('QFT-0240','Quest platform down','Quest app fails to load for all students. Server reachable but app shows blank.',?,'Platform','critical','open',?,5),
        ('QFT-0239','Tablets not charging','12 tablets on charging hub 2 not charging. Faulty hub suspected.',?,'Hardware','critical','progress',?,7),
        ('QFT-0238','Projector HDMI fault','Projector in Room 3B shows no signal over HDMI.',?,'Hardware','high','progress',?,26),
        ('QFT-0237','Student login failures','34 students cannot log into Quest. Password reset not received.',?,'Accounts','high','escalated',?,28),
        ('QFT-0236','Router slow speed','LAN speeds dropped below 2Mbps in afternoon sessions.',?,'Connectivity','medium','open',?,48),
        ('QFT-0235','Laptop won\\'t boot','Teacher laptop stuck in boot loop after update.',?,'Hardware','medium','progress',?,26),
        ('QFT-0232','Power socket fault','Wall socket in lab sparking - disconnected for safety.',?,'Power','medium','open',NULL,72),
        ('QFT-0231','3 tablets dead screens','3 tablets with cracked/dead screens. Warranty claim submitted.',?,'Hardware','high','escalated',?,144)
      `, [s.kilema, u.famani, s.moshiu, u.cmbowe, s.kibosho, u.famani, s.marangu, u.knjoro, s.mweka, u.cmbowe, s.oldmoshi, u.knjoro, s.uru, u.knjoro, s.machame, s.machame, u.famani]);
      console.log('  Errors seeded');

      await conn.query(`INSERT INTO troubleshooting_guides (title, category, icon, steps) VALUES
        ('WiFi / Internet Not Working','Connectivity','ti-wifi-off','["Check router power light","Restart router (30s off)","Check ethernet cable","Test other devices","Ping LRS at 192.168.0.10","Check router admin at 192.168.0.1","Report as CRITICAL if still down after 20min"]'),
        ('Tablets Not Charging','Hardware','ti-device-tablet','["Test with known-working USB-C cable","Try different port on hub","Clear debris from charging port","Charge directly from wall socket","If multiple fail on one hub, replace hub","Note serial number and report","Use only QFT-supplied chargers"]'),
        ('Quest Platform Login Failures','Platform','ti-apps','["Confirm internet works first","Clear browser cache","Try Incognito window","Confirm username format","Use Forgot Password flow","Contact platform team for locked accounts","Report as CRITICAL if many affected"]'),
        ('No Power / Generator Issues','Power','ti-bolt','["Check main breaker panel","Check if neighbours have power","Check generator fuel/oil/coolant","Start generator manually if auto-start failed","Verify UPS for router and LRS","Do NOT attempt electrical repairs","Report as CRITICAL if all tech offline"]'),
        ('Projector Not Working','Hardware','ti-video','["Check power cable both ends","Double press power button","Check HDMI/VGA connections","Press Win+P on laptop","Match projector input source","Red lamp = lamp needs replacing","Let cool 5min if overheated"]')
      `);
      console.log('  Guides seeded');

      const schoolCodes = Object.keys(s);
      for (const code of schoolCodes) {
        for (let w = 1; w <= 3; w++) {
          const statuses = ['green','green','amber'];
          const status = statuses[(w + code.length) % 3];
          await conn.query(`INSERT IGNORE INTO weekly_checkins (school_id, week_number, term, status, connectivity, tablets, platform, power, note, checked_by) VALUES (?,?,?,?,?,?,?,?,?,?)`,
            [s[code], w, 'Term 2 · 2026', status, 'ok', 'ok', 'ok', 'ok', w === 1 ? 'Term start setup verified.' : 'Routine weekly check.', 'Field Team']);
        }
      }
      console.log('  Check-ins seeded');
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
