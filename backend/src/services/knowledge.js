/**
 * The knowledge loop. Design: docs/features/10-guide-first-reporting.md
 *
 * Five guides existed and nothing connected them to the faults being filed. A
 * teacher opened the report form, typed "WiFi haifanyi kazi", and an engineer
 * drove out to restart a router — while a guide called "WiFi / Internet Not
 * Working" sat two clicks away with "restart the router" as step 2.
 *
 * Deflection was measured. It was never *engineered*: nothing put the right
 * guide in front of the right person at the moment they were about to file.
 *
 * Two directions, both recorded:
 *   forward  — suggest a guide before the fault is filed, and count the ones
 *              that made the fault unnecessary (`guide_deflections`)
 *   backward — remember which guide someone tried and filed anyway
 *              (`errors.tried_guide_id`), because a guide that is read and does
 *              not help is a guide that needs rewriting, and nothing else in
 *              the system can tell you which one that is.
 */
const pool = require('../config/database');

/**
 * The guides worth showing for what someone is about to report.
 *
 * Category is the strong signal — it is chosen from a fixed list, so it cannot
 * be misspelled — and the words they typed refine the order within it. Deliberately
 * capped at three: a wall of suggestions is a wall, and the fourth-best guide
 * has never fixed anything.
 */
async function suggest({ category, text, limit = 3 }) {
  const words = String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9']+/)
    .filter(w => w.length > 3)
    .slice(0, 6);

  const [rows] = await pool.query(
    'SELECT id, title, category, icon, steps FROM troubleshooting_guides ORDER BY id'
  );

  const scored = rows.map(g => {
    const steps = parseSteps(g.steps);
    const hay = (g.title + ' ' + g.category + ' ' + steps.join(' ')).toLowerCase();
    let score = 0;
    if (category && g.category === category) score += 10;
    for (const w of words) if (hay.includes(w)) score += 2;
    // A title match is worth more than a match buried in step 7.
    for (const w of words) if (g.title.toLowerCase().includes(w)) score += 3;
    return { id: g.id, title: g.title, category: g.category, icon: g.icon, steps, score };
  });

  return scored
    .filter(g => g.score > 0)
    .sort((a, b) => b.score - a.score || a.id - b.id)
    .slice(0, limit)
    .map(({ score, ...g }) => g);
}

function parseSteps(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch (e) { return []; } }
  return [];
}

/**
 * Records that a guide made a fault unnecessary.
 *
 * Only ever written when a person says so — never inferred from "they looked at
 * the guide and did not file within N minutes", which would count every
 * interruption, every dead battery and every lunch break as a success.
 */
async function recordDeflection({ guideId, userId, schoolId, category, source }) {
  const [res] = await pool.query(
    `INSERT INTO guide_deflections (guide_id, user_id, school_id, category, source)
     VALUES (?, ?, ?, ?, ?)`,
    [guideId, userId || null, schoolId || null, category || null, source || 'report_form']
  );
  return res.insertId;
}

/**
 * How each guide is doing: how often it prevented a fault, how often it was
 * tried and the fault was filed anyway.
 *
 * `null` for a guide nobody has met yet — a guide with no data and a guide that
 * never helps are different, and showing 0% for both would send someone to
 * rewrite the wrong one.
 */
async function guidePerformance({ days = 90 } = {}) {
  const [rows] = await pool.query(
    `SELECT g.id, g.title, g.category,
            (SELECT COUNT(*) FROM guide_deflections d
              WHERE d.guide_id = g.id AND d.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)) AS deflected,
            (SELECT COUNT(*) FROM errors e
              WHERE e.tried_guide_id = g.id AND e.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)) AS filed_anyway
       FROM troubleshooting_guides g
      ORDER BY g.category, g.title`,
    [days, days]
  );
  return rows.map(r => {
    const deflected = Number(r.deflected) || 0;
    const filed = Number(r.filed_anyway) || 0;
    const met = deflected + filed;
    return {
      id: r.id, title: r.title, category: r.category,
      deflected, filed_anyway: filed, times_met: met,
      // Of the people this guide met, the share who did not need an engineer.
      success_rate: met ? Math.round((deflected / met) * 100) : null
    };
  });
}

module.exports = { suggest, recordDeflection, guidePerformance, parseSteps };
