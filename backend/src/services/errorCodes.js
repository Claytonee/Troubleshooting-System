const pool = require('../config/database');

/**
 * Fault codes (QFT-0####) — INT-001.
 *
 * Every intake path used to compute MAX(existing number) + 1. Two faults filed
 * at the same moment got the same code, and deleting the newest fault handed
 * its code to the next one: on 2026-09-24 QFT-0379 had been issued three times.
 *
 * Now one sequence table issues numbers. An AUTO_INCREMENT insert is atomic, so
 * concurrent callers can never receive the same number, and a number is never
 * given out again because sequence rows are never deleted. It is seeded once,
 * above the highest code already in `errors`, so numbering simply continues.
 */
let seeded = null;

function ensureSequence() {
  if (!seeded) {
    seeded = (async () => {
      await pool.query(`CREATE TABLE IF NOT EXISTS error_code_seq (
        id INT AUTO_INCREMENT PRIMARY KEY,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
      const [[{ maxnum }]] = await pool.query(
        "SELECT MAX(CAST(SUBSTRING(error_code, 5) AS UNSIGNED)) AS maxnum FROM errors WHERE error_code LIKE 'QFT-%'");
      const [[{ seqmax }]] = await pool.query('SELECT COALESCE(MAX(id), 0) AS seqmax FROM error_code_seq');
      // 240: where the original numbering started, kept for an empty database.
      const floor = Math.max(Number(maxnum) || 240, Number(seqmax) || 0);
      if (Number(seqmax) < floor) {
        // Writing the floor explicitly moves AUTO_INCREMENT past it.
        try { await pool.query('INSERT INTO error_code_seq (id) VALUES (?)', [floor]); }
        catch (e) { if (e.code !== 'ER_DUP_ENTRY') throw e; }   // a concurrent first caller got there
      }
    })().catch(e => { seeded = null; throw e; });
  }
  return seeded;
}

/** The next unused code. Safe under concurrency; never reuses a number. */
async function nextErrorCode() {
  await ensureSequence();
  const [r] = await pool.query('INSERT INTO error_code_seq () VALUES ()');
  return `QFT-0${r.insertId}`;
}

module.exports = { nextErrorCode, ensureSequence };
