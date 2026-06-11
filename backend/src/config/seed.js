const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function seed() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'qft_support'
  });

  console.log('Seeding database...');

  const passwordHash = await bcrypt.hash('admin123', 10);

  // Seed users (admin + sub-admins)
  const users = [
    ['admin', 'admin@questforward.org', passwordHash, 'System Administrator', 'admin', '+255 658 000 000', 'HQ', '#4f7cff', 'System Admin', 'active'],
    ['knjoro', 'knjoro@questforward.org', passwordHash, 'K. Njoro', 'subadmin', '+255 658 066 983', 'Moshi Zone', '#4f7cff', 'Senior Engineer · Lead', 'active'],
    ['famani', 'famani@questforward.org', passwordHash, 'F. Amani', 'subadmin', '+255 754 110 220', 'Kilema–Kibosho', '#2dd98a', 'Senior Engineer', 'onsite'],
    ['thassan', 'thassan@questforward.org', passwordHash, 'T. Hassan', 'subadmin', '+255 762 330 440', 'Rombo', '#9b7dff', 'Senior Engineer', 'active'],
    ['cmbowe', 'cmbowe@questforward.org', passwordHash, 'Clinton Mbowe', 'subadmin', '+255 715 880 990', 'Remote / HQ', '#36d9cc', 'IT Officer · Platform', 'remote'],
  ];

  for (const u of users) {
    await connection.query(
      `INSERT IGNORE INTO users (username, email, password_hash, full_name, role, phone, zone, color, title, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      u
    );
  }
  console.log('Users seeded.');

  // Get user IDs
  const [userRows] = await connection.query('SELECT id, username FROM users');
  const userMap = {};
  userRows.forEach(r => userMap[r.username] = r.id);

  // Seed schools
  const schools = [
    ['kilema', 'Kilema Secondary', 'Rombo', 340, 48, 2, 'Mr. Eliya Mushi', 'IT Coordinator', '+255 712 000 101', '192.168.0.10', 'Vodacom Fibre', userMap.thassan],
    ['moshiu', 'Moshi Urban Sec.', 'Moshi Urban', 510, 72, 3, 'Ms. Neema Lyimo', 'Head Teacher', '+255 712 000 102', '192.168.0.10', 'TTCL Fibre', userMap.knjoro],
    ['kibosho', 'Kibosho Boys Sec.', 'Hai', 280, 40, 2, 'Mr. Baraka Swai', 'IT Coordinator', '+255 712 000 103', '192.168.0.10', 'Vodacom Fibre', userMap.famani],
    ['marangu', 'Marangu Girls Sec.', 'Moshi Rural', 220, 32, 1, 'Ms. Asha Kileo', 'Quest Coordinator', '+255 712 000 104', '192.168.0.10', 'Airtel', userMap.knjoro],
    ['mweka', 'Mweka Secondary', 'Hai', 195, 28, 1, 'Mr. John Massawe', 'IT Coordinator', '+255 712 000 105', '192.168.0.10', 'TTCL Fibre', userMap.famani],
    ['oldmoshi', 'Old Moshi Sec.', 'Moshi Rural', 310, 44, 2, 'Ms. Grace Mollel', 'Head Teacher', '+255 712 000 106', '192.168.0.10', 'Vodacom Fibre', userMap.knjoro],
    ['machame', 'Machame Secondary', 'Hai', 260, 38, 2, 'Mr. Frank Mushi', 'IT Coordinator', '+255 712 000 107', '192.168.0.10', 'Airtel', userMap.famani],
    ['uru', 'Uru Secondary', 'Moshi Rural', 180, 24, 1, 'Ms. Tatu Hassan', 'Quest Coordinator', '+255 712 000 108', '192.168.0.10', 'TTCL', userMap.knjoro],
    ['moshig', 'Moshi Girls Sec.', 'Moshi Urban', 400, 56, 2, 'Ms. Rehema Kimaro', 'Head Teacher', '+255 712 000 109', '192.168.0.10', 'Vodacom Fibre', userMap.knjoro],
    ['rombo', 'Rombo Secondary', 'Rombo', 155, 22, 1, 'Mr. Daudi Massawe', 'IT Coordinator', '+255 712 000 110', '192.168.0.10', 'Airtel', userMap.thassan],
    ['pasua', 'Pasua Secondary', 'Moshi Urban', 290, 42, 2, 'Ms. Salma Juma', 'Quest Coordinator', '+255 712 000 111', '192.168.0.10', 'TTCL Fibre', userMap.knjoro],
    ['mkuu', 'Mkuu Secondary', 'Rombo', 170, 24, 1, 'Mr. Joseph Lema', 'IT Coordinator', '+255 712 000 112', '192.168.0.10', 'Airtel', userMap.thassan],
    ['arusha', 'Arusha Technical', 'Arusha', 445, 60, 3, 'Mr. Peter Nkya', 'IT Coordinator', '+255 712 000 113', '192.168.0.10', 'TTCL Fibre', userMap.cmbowe],
  ];

  for (const s of schools) {
    await connection.query(
      `INSERT IGNORE INTO schools (code, name, zone, students, tablets, routers, contact_name, contact_role, contact_phone, lrs_ip, isp, assigned_admin_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      s
    );
  }
  console.log('Schools seeded.');

  // Get school IDs
  const [schoolRows] = await connection.query('SELECT id, code FROM schools');
  const schoolMap = {};
  schoolRows.forEach(r => schoolMap[r.code] = r.id);

  // Seed errors
  const errors = [
    ['QFT-0241', 'WiFi router offline', 'Lab router not powering on. Whole computer lab offline.', 'kilema', 'Connectivity', 'critical', 'open', userMap.famani, 3],
    ['QFT-0240', 'Quest platform down', 'Quest app fails to load for all students. Server reachable but app shows blank.', 'moshiu', 'Platform', 'critical', 'open', userMap.cmbowe, 5],
    ['QFT-0239', 'Tablets not charging', '12 tablets on charging hub 2 not charging. Faulty hub suspected.', 'kibosho', 'Hardware', 'critical', 'progress', userMap.famani, 7],
    ['QFT-0238', 'Projector HDMI fault', 'Projector in Room 3B shows no signal over HDMI.', 'marangu', 'Hardware', 'high', 'progress', userMap.knjoro, 26],
    ['QFT-0237', 'Student login failures', '34 students cannot log into Quest. Password reset not received.', 'mweka', 'Accounts', 'high', 'escalated', userMap.cmbowe, 28],
    ['QFT-0236', 'Router slow speed', 'LAN speeds dropped below 2Mbps in afternoon sessions.', 'oldmoshi', 'Connectivity', 'medium', 'open', userMap.knjoro, 48],
    ['QFT-0235', "Laptop won't boot", 'Teacher laptop stuck in boot loop after update.', 'uru', 'Hardware', 'medium', 'progress', userMap.knjoro, 26],
    ['QFT-0234', 'Projector display issue', 'HDMI cable replaced and tested OK.', 'uru', 'Hardware', 'low', 'resolved', userMap.knjoro, 96],
    ['QFT-0233', 'Quest login restored', 'Batch password reset completed. 34/34 active.', 'oldmoshi', 'Accounts', 'high', 'resolved', userMap.cmbowe, 120],
    ['QFT-0232', 'Power socket fault', 'Wall socket in lab sparking — disconnected for safety.', 'machame', 'Power', 'medium', 'open', null, 72],
    ['QFT-0231', '3 tablets dead screens', '3 tablets with cracked/dead screens. Warranty claim submitted.', 'machame', 'Hardware', 'high', 'escalated', userMap.famani, 144],
    ['QFT-0230', 'Internet cable cut', 'Fibre line repaired by ISP. 45Mbps confirmed.', 'moshig', 'Connectivity', 'critical', 'resolved', userMap.thassan, 168],
  ];

  for (const e of errors) {
    const createdAt = new Date(Date.now() - e[8] * 3600000).toISOString().slice(0, 19).replace('T', ' ');
    await connection.query(
      `INSERT IGNORE INTO errors (error_code, title, description, school_id, category, priority, status, assigned_to, hours_open, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [e[0], e[1], e[2], schoolMap[e[3]], e[4], e[5], e[6], e[7], e[8], createdAt]
    );
  }
  console.log('Errors seeded.');

  // Seed communications
  const comms = [
    [schoolMap.kilema, 'F. Amani', 'Confirmed technician visit. Head teacher notified. Lab closed until repair.'],
    [schoolMap.moshiu, 'C. Mbowe', 'Platform team confirmed remote fix in progress. Expected 2h.'],
    [schoolMap.kibosho, 'F. Amani', 'Ordered replacement USB-C hub. Arrives tomorrow. 12 tablets offline temporarily.'],
  ];

  for (const c of comms) {
    await connection.query(
      `INSERT INTO communications (school_id, recorded_by, note) VALUES (?, ?, ?)`, c
    );
  }
  console.log('Communications seeded.');

  // Seed troubleshooting guides
  const guides = [
    ['WiFi / Internet Not Working', 'Connectivity', 'ti-wifi-off', JSON.stringify([
      'Check if the router power light is ON. If off, check the power cable and switch.',
      'Restart the router: unplug power for 30 seconds, plug back in and wait 2 minutes.',
      'Check the ethernet cable from the ISP wall socket to the router is firmly connected.',
      'Check if other devices (teacher laptop) can connect. If yes, it is a device issue.',
      'Confirm the LRS is reachable: ping 192.168.0.10 from a connected device.',
      'Log in to router admin at 192.168.0.1 and check WAN status.',
      'If still down after 20 mins, report via this system as CRITICAL.'
    ])],
    ['Tablets Not Charging', 'Hardware', 'ti-device-tablet', JSON.stringify([
      'Test with a known-working USB-C cable first.',
      'Try a different port on the charging station/hub.',
      'Gently clear debris/lint from the tablet charging port with a dry brush.',
      'Charge 1–2 tablets directly from the wall socket, not the hub.',
      'If multiple tablets fail on one hub, test/replace the hub.',
      'If a single tablet still fails: note its serial number and report as MEDIUM hardware.',
      'Use only QFT-supplied charging equipment — never third-party chargers.'
    ])],
    ['Quest Platform Login Failures', 'Platform', 'ti-apps', JSON.stringify([
      'Confirm internet works first — open any website in the browser.',
      'Clear browser cache: Ctrl+Shift+Delete → clear cookies & cached files.',
      'Try an Incognito/Private window.',
      'Confirm the username format: firstname.lastname@school.qft',
      'For a forgotten password use "Forgot Password" — reset goes to the teacher.',
      'If a teacher account is locked, contact the platform team immediately.',
      'If many students are affected at once, report as CRITICAL — likely platform-side.'
    ])],
    ['No Power / Generator Issues', 'Power', 'ti-bolt', JSON.stringify([
      'Check the main breaker panel for any tripped breaker.',
      'Check whether neighbouring buildings have power (TANESCO outage vs local fault).',
      'For a generator: check fuel, oil and coolant levels.',
      'Start the generator manually if auto-start failed — follow the posted procedure.',
      'Check UPS units — router and LRS must stay on UPS power.',
      'Do NOT attempt electrical repairs — contact a licensed electrician.',
      'If power loss stops all tech operation, report as CRITICAL.'
    ])],
    ['Projector Not Working', 'Hardware', 'ti-video', JSON.stringify([
      'Check the power cable at both the projector and the socket.',
      'Press the power button twice (some models need a double press).',
      'Check HDMI/VGA connections at both ends — try a different cable.',
      'On the laptop press Windows + P → choose Duplicate or Extend.',
      'Match the projector input source to the cable (HDMI1, VGA, etc).',
      'A red/orange lamp indicator means the lamp may need replacing.',
      'Let the projector cool 5 minutes if it auto-shut from overheating.'
    ])],
  ];

  for (const g of guides) {
    await connection.query(
      `INSERT INTO troubleshooting_guides (title, category, icon, steps) VALUES (?, ?, ?, ?)`, g
    );
  }
  console.log('Troubleshooting guides seeded.');

  // Seed weekly checkins (weeks 1-3 for most schools)
  const schoolCodes = Object.keys(schoolMap);
  for (const code of schoolCodes) {
    for (let w = 1; w <= 3; w++) {
      const statuses = ['green', 'green', 'amber'];
      const status = statuses[(w + code.length) % 3];
      await connection.query(
        `INSERT IGNORE INTO weekly_checkins (school_id, week_number, term, status, connectivity, tablets, platform, power, note, checked_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [schoolMap[code], w, 'Term 2 · 2026', status, 'ok', 'ok', 'ok', 'ok', w === 1 ? 'Term start setup verified. All systems nominal.' : 'Routine weekly check — devices healthy, LRS reachable.', 'Field Team']
      );
    }
  }
  console.log('Weekly check-ins seeded.');

  console.log('\nSeed complete! Default login:');
  console.log('  Username: admin');
  console.log('  Password: admin123');
  console.log('  (All users share password: admin123)');

  await connection.end();
}

seed().catch(err => {
  console.error('Seeding failed:', err.message);
  process.exit(1);
});
