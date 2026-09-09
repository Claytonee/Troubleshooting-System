/**
 * Spares and swaps. Design: docs/features/09-spares-and-first-time-fix.md
 *
 * The system knew a tablet was faulty, how old it was and whether it was worth
 * repairing. It did not know whether there was **a working one to put in its
 * place**, so an engineer drove out, confirmed what the school had already told
 * them, and drove back. First-time fix rate is the field-service metric every
 * other one follows from, and it is unimprovable — in fact unmeasurable —
 * without knowing what is in the van.
 */
const pool = require('../config/database');

/** A device is a usable spare when it is marked as one, working, and unassigned. */
const SPARE_WHERE = `is_spare = 1 AND status = 'Working' AND (student_name IS NULL OR student_name = '')`;

/**
 * What one school has and needs.
 *
 * `needed` is deliberately "faulty devices minus spares on site" and never
 * negative: it is what to load into the vehicle, not an accounting figure.
 */
async function stockFor(schoolId) {
  const [rows] = await pool.query(
    `SELECT
       SUM(CASE WHEN ${SPARE_WHERE} THEN 1 ELSE 0 END)                         AS spares_available,
       SUM(CASE WHEN is_spare = 1 AND status <> 'Working' THEN 1 ELSE 0 END)   AS spares_unusable,
       SUM(CASE WHEN status IN ('Faulty','In Repair') THEN 1 ELSE 0 END)       AS awaiting_swap,
       COUNT(*)                                                                AS total
     FROM tablets WHERE school_id = ?`,
    [schoolId]
  );
  const r = rows[0] || {};
  const spares = Number(r.spares_available) || 0;
  const awaiting = Number(r.awaiting_swap) || 0;
  return {
    spares_available: spares,
    spares_unusable: Number(r.spares_unusable) || 0,
    awaiting_swap: awaiting,
    needed: Math.max(0, awaiting - spares),
    // A school with broken devices and no spare cannot be fixed on the day,
    // however good the engineer is. That is the stockout the research names.
    stockout: awaiting > 0 && spares === 0,
    total: Number(r.total) || 0
  };
}

/** The same figures for every school an engineer covers, worst first. */
async function stockAcross(schoolIds) {
  if (!schoolIds || !schoolIds.length) return [];
  const [rows] = await pool.query(
    `SELECT t.school_id, s.name AS school_name,
       SUM(CASE WHEN ${SPARE_WHERE} THEN 1 ELSE 0 END)                       AS spares_available,
       SUM(CASE WHEN t.status IN ('Faulty','In Repair') THEN 1 ELSE 0 END)   AS awaiting_swap
     FROM tablets t JOIN schools s ON s.id = t.school_id
     WHERE t.school_id IN (?)
     GROUP BY t.school_id, s.name`,
    [schoolIds]
  );
  return rows.map(r => {
    const spares = Number(r.spares_available) || 0;
    const awaiting = Number(r.awaiting_swap) || 0;
    return {
      school_id: r.school_id,
      school_name: r.school_name,
      spares_available: spares,
      awaiting_swap: awaiting,
      needed: Math.max(0, awaiting - spares),
      stockout: awaiting > 0 && spares === 0
    };
  }).sort((a, b) => b.needed - a.needed || b.awaiting_swap - a.awaiting_swap);
}

/** The spares actually sitting at a school, so the engineer can name one. */
async function listSpares(schoolId) {
  const [rows] = await pool.query(
    `SELECT id, asset_tag, serial_number, model, form, status, is_spare, student_name
       FROM tablets WHERE school_id = ? AND is_spare = 1
       ORDER BY status = 'Working' DESC, asset_tag`,
    [schoolId]
  );
  return rows.map(r => ({
    ...r,
    usable: r.status === 'Working' && !r.student_name
  }));
}

/**
 * Swap a faulty device for a spare, in one transaction.
 *
 * The student keeps working; the broken device goes into the repair pile with
 * its history intact; the spare stops being a spare. Half of this happening is
 * worse than none of it — a student assigned to two devices, or to none — so it
 * is a transaction rather than four updates in a row.
 */
async function swap({ faultyId, spareId, errorId, visitId, actorName, note }) {
  if (!faultyId || !spareId) return { ok: false, error: 'Both devices are required.' };
  if (Number(faultyId) === Number(spareId)) return { ok: false, error: 'A device cannot replace itself.' };

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      'SELECT id, school_id, asset_tag, serial_number, status, is_spare, student_name, admission_no FROM tablets WHERE id IN (?, ?) FOR UPDATE',
      [faultyId, spareId]
    );
    const faulty = rows.find(r => r.id === Number(faultyId));
    const spare = rows.find(r => r.id === Number(spareId));
    if (!faulty || !spare) { await conn.rollback(); return { ok: false, error: 'Device not found.' }; }
    if (faulty.school_id !== spare.school_id) {
      await conn.rollback();
      return { ok: false, error: 'Both devices must be at the same school. Transfer the spare first.' };
    }
    if (spare.status !== 'Working') {
      await conn.rollback();
      return { ok: false, error: `That spare is marked ${spare.status} — it cannot replace a faulty device.` };
    }
    if (spare.student_name) {
      await conn.rollback();
      return { ok: false, error: `That device is already assigned to ${spare.student_name}.` };
    }

    const student = faulty.student_name || null;
    const admission = faulty.admission_no || null;

    // The spare takes over the student and stops being a spare.
    await conn.query(
      `UPDATE tablets SET student_name = ?, admission_no = ?, is_spare = 0, assigned_at = NOW(), updated_at = NOW()
        WHERE id = ?`,
      [student, admission, spare.id]
    );
    // The faulty one goes to the repair pile, unassigned, never a spare.
    await conn.query(
      `UPDATE tablets SET student_name = NULL, admission_no = NULL, is_spare = 0,
              status = CASE WHEN status = 'Lost/Missing' THEN status ELSE 'In Repair' END,
              updated_at = NOW()
        WHERE id = ?`,
      [faulty.id]
    );

    const label = (t) => t.asset_tag || t.serial_number;
    await conn.query(
      `INSERT INTO tablet_history (tablet_id, action, old_value, new_value, actor_name, note) VALUES
        (?, 'swapped_out', ?, ?, ?, ?), (?, 'swapped_in', ?, ?, ?, ?)`,
      [faulty.id, student || '(unassigned)', label(spare), actorName || 'System', note || null,
        spare.id, '(spare)', student || '(unassigned)', actorName || 'System', note || null]
    );

    const [res] = await conn.query(
      `INSERT INTO tablet_swaps (school_id, faulty_tablet_id, spare_tablet_id, error_id, visit_id, student_name, swapped_by, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [faulty.school_id, faulty.id, spare.id, errorId || null, visitId || null, student, actorName || null, note || null]
    );

    if (errorId) {
      await conn.query(
        'INSERT INTO error_updates (error_id, update_type, note, recorded_by) VALUES (?, ?, ?, ?)',
        [errorId, 'Swap', `Swapped ${label(faulty)} for spare ${label(spare)}${student ? ` (${student})` : ''}.`, actorName || 'System']
      );
    }

    await conn.commit();
    return {
      ok: true,
      swap_id: res.insertId,
      student,
      faulty: { id: faulty.id, label: label(faulty), status: 'In Repair' },
      spare: { id: spare.id, label: label(spare) }
    };
  } catch (e) {
    try { await conn.rollback(); } catch (x) {}
    return { ok: false, error: e.message };
  } finally {
    conn.release();
  }
}


/**
 * First-time fix: of the visits that were completed, how many left nothing
 * behind.
 *
 * A visit counts as measurable only if it had faults attached — a trip with
 * nothing attached tells us nothing about fixing, and counting it as a success
 * would inflate the number for free. Visits with no attached faults are
 * reported separately rather than folded in, the same rule the SLA figure
 * follows.
 *
 * `rate` is null when nothing is measurable yet. A rate of 0% and "no data" are
 * different statements and must not look the same.
 */
async function firstTimeFix({ schoolIds, days = 90 } = {}) {
  const scope = schoolIds && schoolIds.length ? 'AND v.school_id IN (?)' : '';
  const params = schoolIds && schoolIds.length ? [days, schoolIds] : [days];
  const [rows] = await pool.query(
    `SELECT
        COUNT(*) AS completed,
        SUM(CASE WHEN f.attached = 0 THEN 1 ELSE 0 END) AS no_faults_attached,
        SUM(CASE WHEN f.attached > 0 AND f.unresolved = 0 THEN 1 ELSE 0 END) AS fixed_first_time,
        SUM(CASE WHEN f.attached > 0 THEN 1 ELSE 0 END) AS measurable
      FROM visits v
      JOIN (
        SELECT v2.id AS vid,
               COUNT(e.id) AS attached,
               SUM(CASE WHEN e.status <> 'resolved' THEN 1 ELSE 0 END) AS unresolved
        FROM visits v2 LEFT JOIN errors e ON e.visit_id = v2.id
        GROUP BY v2.id
      ) f ON f.vid = v.id
      WHERE v.status = 'done' AND v.completed_at >= DATE_SUB(NOW(), INTERVAL ? DAY) ${scope}`,
    params
  );
  const r = rows[0] || {};
  const measurable = Number(r.measurable) || 0;
  const fixed = Number(r.fixed_first_time) || 0;
  return {
    window_days: days,
    visits_completed: Number(r.completed) || 0,
    visits_measurable: measurable,
    visits_no_faults_attached: Number(r.no_faults_attached) || 0,
    fixed_first_time: fixed,
    rate: measurable ? Math.round((fixed / measurable) * 100) : null
  };
}

module.exports = { stockFor, stockAcross, listSpares, swap, firstTimeFix, SPARE_WHERE };
