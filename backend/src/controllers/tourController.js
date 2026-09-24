const pool = require('../config/database');

/**
 * Guided tours — progress per ACCOUNT (DECISIONS.md D27, docs/features/12-guided-tour.md).
 *
 * Not per device: school tablets are shared, so browser storage would show the
 * tour once per tablet — the first teacher would see it, the next thirty would
 * not — and a person who switched devices would be offered it again.
 *
 * Stored as a small JSON object in users.tour_state:
 *   { "role": { "status": "completed", "step": 5, "at": "2026-09-25T…" }, "page:report": { … } }
 * The client decides what to show; the server only remembers, and validates
 * everything it remembers so the column can never grow without bound.
 */

// Tour ids the frontend defines (frontend/js/components/tour.js). Anything else is refused.
const TOUR_ID = /^(role|page:(report|tracker|inventory|visits|teachers|security))$/;
const STATUSES = ['started', 'completed', 'dismissed'];
const RANK = { started: 0, dismissed: 1, completed: 2 };
const MAX_STEP = 20;

function parse(raw) {
  if (!raw) return {};
  try {
    const o = JSON.parse(raw);
    return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
  } catch (e) { return {}; }
}

/** GET /api/auth/tour — this account's progress. */
async function get(req, res, next) {
  try {
    const [[row]] = await pool.query('SELECT tour_state FROM users WHERE id = ?', [req.user.id]);
    res.json({ tours: parse(row && row.tour_state) });
  } catch (err) { next(err); }
}

/** PUT /api/auth/tour/:id  { status, step } — record where this account got to. */
async function update(req, res, next) {
  try {
    const id = String(req.params.id || '');
    if (!TOUR_ID.test(id)) return res.status(400).json({ error: 'Unknown tour.' });
    const status = req.body && req.body.status;
    if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Status must be started, completed or dismissed.' });
    const step = Number(req.body.step ?? 0);
    if (!Number.isInteger(step) || step < 0 || step > MAX_STEP) return res.status(400).json({ error: 'Step must be a whole number from 0 to 20.' });

    const [[row]] = await pool.query('SELECT tour_state FROM users WHERE id = ?', [req.user.id]);
    const tours = parse(row && row.tour_state);
    // Keep only ids that are still valid: an old or hand-edited entry cannot survive a write.
    for (const k of Object.keys(tours)) if (!TOUR_ID.test(k)) delete tours[k];
    // A status never goes backwards: replaying a finished tour and closing it early
    // must not turn "completed" into "dismissed", or a dismissal back into "started".
    const prev = tours[id];
    if (!prev || RANK[status] >= (RANK[prev.status] ?? -1)) {
      tours[id] = { status, step, at: new Date().toISOString() };
    }
    await pool.query('UPDATE users SET tour_state = ? WHERE id = ?', [JSON.stringify(tours), req.user.id]);
    res.json({ tours });
  } catch (err) { next(err); }
}

module.exports = { get, update, TOUR_ID };
