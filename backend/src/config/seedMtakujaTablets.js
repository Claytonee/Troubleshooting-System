/**
 * Seed Mtakuja Secondary tablets from parsed Excel data.
 * Run from project root: node backend/src/config/seedMtakujaTablets.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const pool = require('./database');
const path = require('path');
const fs = require('fs');

const SCHOOL_NAME = 'Mtakuja Secondary';
const SCHOOL_CODE = 'mtakuja';

const devices = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'mtk_devices.json'), 'utf8'));

async function run() {
  try {
    // Ensure Mtakuja school exists
    const [existing] = await pool.query('SELECT id FROM schools WHERE code = ?', [SCHOOL_CODE]);
    let schoolId;
    if (existing.length) {
      schoolId = existing[0].id;
      console.log(`School "${SCHOOL_NAME}" exists (id=${schoolId})`);
    } else {
      const [result] = await pool.query(
        `INSERT INTO schools (code, name, zone, students, tablets, routers, contact_name, contact_role, contact_phone, lrs_ip, isp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [SCHOOL_CODE, SCHOOL_NAME, 'Moshi Rural', 190, 190, 2, 'IT Lead', 'IT Coordinator', '+255 700 000 000', '192.168.0.10', 'Vodacom']
      );
      schoolId = result.insertId;
      console.log(`Created school "${SCHOOL_NAME}" (id=${schoolId})`);
    }

    // Clear existing tablets for this school to avoid duplicates on re-run
    await pool.query('DELETE FROM tablet_history WHERE tablet_id IN (SELECT id FROM tablets WHERE school_id = ?)', [schoolId]);
    await pool.query('DELETE FROM tablets WHERE school_id = ?', [schoolId]);
    console.log('Cleared existing tablet data');

    let count = 0;
    for (const d of devices) {
      if (!d.sn && !d.student) continue;
      await pool.query(
        `INSERT INTO tablets (school_id, serial_number, asset_tag, form, stream, model, year_first_used, status, student_name, admission_no, last_checked, notes, assigned_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [schoolId, d.sn || `UNKNOWN-${count}`, d.tag || null, d.form || null, d.stream || null, d.model || null,
         d.year || null, d.status || 'Working', d.student || null, d.adm || null,
         d.checked || null, d.notes || null, d.student ? '2026-07-19' : null]
      );
      count++;
    }

    // Update school tablet count
    await pool.query('UPDATE schools SET tablets = ? WHERE id = ?', [count, schoolId]);

    console.log(`Inserted ${count} tablets for ${SCHOOL_NAME}`);
    await pool.end();
    process.exit(0);
  } catch (e) {
    console.error('Seed failed:', e.message);
    await pool.end();
    process.exit(1);
  }
}

run();
