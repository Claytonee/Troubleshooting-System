const bcrypt = require('bcryptjs');
const pool = require('./database');
const { applyExtensions } = require('./schemaExtensions');

/**
 * Create the full schema (MySQL), apply feature extensions, and seed
 * demo data + the default admin if the database is empty. Idempotent — safe
 * to run on every server start (server.js) and via `npm run migrate`/`seed`.
 */
async function bootstrap() {
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY, username VARCHAR(100) NOT NULL UNIQUE, email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL, full_name VARCHAR(200) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'school',
    phone VARCHAR(50), zone VARCHAR(100), color VARCHAR(50) DEFAULT '#4f7cff', title VARCHAR(200),
    status VARCHAR(20) DEFAULT 'active', school_id INT,
    must_change_password TINYINT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS schools (
    id INT AUTO_INCREMENT PRIMARY KEY, code VARCHAR(50) NOT NULL UNIQUE, name VARCHAR(200) NOT NULL,
    zone VARCHAR(100), students INT DEFAULT 0, tablets INT DEFAULT 0, routers INT DEFAULT 0,
    contact_name VARCHAR(200), contact_role VARCHAR(100), contact_phone VARCHAR(50), contact_email VARCHAR(255),
    it_name VARCHAR(200), it_email VARCHAR(255), coordinator_name VARCHAR(200), coordinator_email VARCHAR(255),
    lrs_ip VARCHAR(50) DEFAULT '192.168.0.10', isp VARCHAR(100), assigned_admin_id INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS errors (
    id INT AUTO_INCREMENT PRIMARY KEY, error_code VARCHAR(20) NOT NULL UNIQUE, title VARCHAR(300) NOT NULL,
    description TEXT, school_id INT NOT NULL,
    category VARCHAR(20) NOT NULL,
    subcategory VARCHAR(200),
    priority VARCHAR(10) NOT NULL DEFAULT 'medium',
    status VARCHAR(12) NOT NULL DEFAULT 'open', assigned_to INT,
    reporter_name VARCHAR(200), reporter_role VARCHAR(100), reporter_contact VARCHAR(100),
    location VARCHAR(200), affected_devices VARCHAR(300), hours_open DECIMAL(10,1) DEFAULT 0,
    resolved_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS error_updates (
    id INT AUTO_INCREMENT PRIMARY KEY, error_id INT NOT NULL, update_type VARCHAR(100),
    note TEXT NOT NULL, recorded_by VARCHAR(200), created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS weekly_checkins (
    id INT AUTO_INCREMENT PRIMARY KEY, school_id INT NOT NULL, week_number INT NOT NULL,
    term VARCHAR(50) NOT NULL DEFAULT 'Term 2 · 2026',
    status VARCHAR(10) NOT NULL DEFAULT 'green',
    connectivity VARCHAR(10) DEFAULT 'ok', tablets VARCHAR(10) DEFAULT 'ok',
    platform VARCHAR(10) DEFAULT 'ok', power VARCHAR(10) DEFAULT 'ok',
    note TEXT, checked_by VARCHAR(200), checkin_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_checkin (school_id, week_number, term)
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS communications (
    id INT AUTO_INCREMENT PRIMARY KEY, school_id INT NOT NULL, recorded_by VARCHAR(200),
    note TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS troubleshooting_guides (
    id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(300) NOT NULL, category VARCHAR(100),
    icon VARCHAR(100) DEFAULT 'ti-tools', steps JSON NOT NULL, is_custom TINYINT(1) DEFAULT 0,
    created_by INT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS manuals (
    id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(300) NOT NULL, original_filename VARCHAR(300),
    stored_filename VARCHAR(300), file_type VARCHAR(100), file_size INT DEFAULT 0,
    category VARCHAR(100) DEFAULT 'General', uploaded_by VARCHAR(200) DEFAULT 'System Admin',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await pool.query(`CREATE TABLE IF NOT EXISTS settings (
    id INT AUTO_INCREMENT PRIMARY KEY, setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`);

  try {
  await pool.query(`INSERT IGNORE INTO settings (setting_key, setting_value) VALUES
    ('brand_name','Quest Forward Tanzania'),('brand_short','QF'),('brand_subtitle','Technical Support'),
    ('brand_logo_url',''),('brand_color','#FFAE00'),('loader_text','Loading system...')`);

  const [existing] = await pool.query('SELECT id FROM users WHERE username = ?', ['admin']);
  if (!existing.length) {
    // Admin password comes from ADMIN_PASSWORD when set; otherwise a well-known
    // default that MUST be changed on first login (must_change_password = 1).
    // Seeded staff (subadmins) share the default, so they're forced to change too.
    const adminPw = process.env.ADMIN_PASSWORD || 'admin123';
    const usingDefaultAdmin = !process.env.ADMIN_PASSWORD;
    const adminHash = await bcrypt.hash(adminPw, 12);
    const staffHash = await bcrypt.hash('admin123', 12);
    await pool.query(`INSERT INTO users (username, email, password_hash, full_name, role, phone, zone, color, title, status, must_change_password) VALUES
      ('admin','admin@questforward.org',?,'System Administrator','admin','+255 658 000 000','HQ','#4f7cff','System Admin','active',?),
      ('knjoro','knjoro@questforward.org',?,'K. Njoro','subadmin','+255 658 066 983','Moshi Zone','#4f7cff','Senior Engineer · Lead','active',1),
      ('famani','famani@questforward.org',?,'F. Amani','subadmin','+255 754 110 220','Kilema–Kibosho','#2dd98a','Senior Engineer','onsite',1),
      ('thassan','thassan@questforward.org',?,'T. Hassan','subadmin','+255 762 330 440','Rombo','#9b7dff','Senior Engineer','active',1),
      ('cmbowe','cmbowe@questforward.org',?,'Clinton Mbowe','subadmin','+255 715 880 990','Remote / HQ','#36d9cc','IT Officer · Platform','remote',1)
    `, [adminHash, usingDefaultAdmin ? 1 : 0, staffHash, staffHash, staffHash, staffHash]);
    if (usingDefaultAdmin) console.log('  ⚠ Admin seeded with default password "admin123" — you will be required to change it on first login.');
    console.log('  Users seeded');
  }

  const [schoolCheck] = await pool.query('SELECT id FROM schools LIMIT 1');
  if (!schoolCheck.length) {
    const [userRows] = await pool.query('SELECT id, username FROM users');
    const u = {}; userRows.forEach(r => u[r.username] = r.id);

    await pool.query(`INSERT INTO schools (code, name, zone, students, tablets, routers, contact_name, contact_role, contact_phone, lrs_ip, isp, assigned_admin_id) VALUES
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

    const [schools] = await pool.query('SELECT id, code FROM schools');
    const s = {}; schools.forEach(r => s[r.code] = r.id);

    await pool.query(`INSERT INTO errors (error_code, title, description, school_id, category, priority, status, assigned_to, hours_open) VALUES
      ('QFT-0241','WiFi router offline','Lab router not powering on. Whole computer lab offline.',?,'Connectivity','critical','open',?,3),
      ('QFT-0240','Quest platform down','Quest app fails to load for all students. Server reachable but app shows blank.',?,'Platform','critical','open',?,5),
      ('QFT-0239','Tablets not charging','12 tablets on charging hub 2 not charging. Faulty hub suspected.',?,'Hardware','critical','progress',?,7),
      ('QFT-0238','Projector HDMI fault','Projector in Room 3B shows no signal over HDMI.',?,'Hardware','high','progress',?,26),
      ('QFT-0237','Student login failures','34 students cannot log into Quest. Password reset not received.',?,'Accounts','high','escalated',?,28),
      ('QFT-0236','Router slow speed','LAN speeds dropped below 2Mbps in afternoon sessions.',?,'Connectivity','medium','open',?,48),
      ('QFT-0235','Laptop will not boot','Teacher laptop stuck in boot loop after update.',?,'Hardware','medium','progress',?,26),
      ('QFT-0232','Power socket fault','Wall socket in lab sparking - disconnected for safety.',?,'Power','medium','open',NULL,72),
      ('QFT-0231','3 tablets dead screens','3 tablets with cracked/dead screens. Warranty claim submitted.',?,'Hardware','high','escalated',?,144)
    `, [s.kilema, u.famani, s.moshiu, u.cmbowe, s.kibosho, u.famani, s.marangu, u.knjoro, s.mweka, u.cmbowe, s.oldmoshi, u.knjoro, s.uru, u.knjoro, s.machame, s.machame, u.famani]);
    console.log('  Errors seeded');

    await pool.query(`INSERT INTO troubleshooting_guides (title, category, icon, steps) VALUES
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
        const statuses = ['green', 'green', 'amber'];
        const st = statuses[(w + code.length) % 3];
        await pool.query(
          `INSERT IGNORE INTO weekly_checkins (school_id, week_number, term, status, connectivity, tablets, platform, power, note, checked_by)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
          [s[code], w, 'Term 2 · 2026', st, 'ok', 'ok', 'ok', 'ok', w === 1 ? 'Term start setup verified.' : 'Routine weekly check.', 'Field Team']);
      }
    }
    console.log('  Check-ins seeded');
  }
  } catch (e) {
    console.error('  Seed warning (non-fatal):', e.message);
  }

  await applyExtensions(pool);
}

module.exports = { bootstrap };
