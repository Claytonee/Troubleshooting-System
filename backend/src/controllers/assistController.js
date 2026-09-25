/**
 * Guided resolution (feature 14, phase 1).
 * docs/features/14-guided-resolution.md
 */
const resources = require('../services/resources');

const CATEGORIES = ['Connectivity', 'Hardware', 'Platform', 'Power', 'Accounts', 'Other'];

/**
 * GET /api/assist/resources?category=&text=
 *
 * Everything internal that might fix this, ranked and shaped for reading:
 * steps, then what shows those steps, then what worked here before, then what
 * to read. Nothing matched is answered honestly — `matched: false` and four
 * empty lists — never with the least-bad guess.
 *
 * The school scope comes from the signed-in account, never the query string: a
 * school id in a request is a key, not a permission (SEC-001/002/004).
 */
async function resourcesFor(req, res, next) {
  try {
    const raw = String(req.query.category || '').trim();
    // Fixed-choice fields are validated on the server, not just by the dropdown.
    const category = CATEGORIES.includes(raw) ? raw : '';
    const text = String(req.query.text || '').slice(0, 400);

    if (!category && text.trim().length < 6) {
      return res.json({ matched: false, steps: [], watch: [], fixes: [], read: [], total: 0, candidate_ids: [] });
    }

    const found = await resources.find({
      category,
      text,
      viewerSchoolId: req.user.school_id || null
    });

    res.json(found);
  } catch (err) { next(err); }
}

module.exports = { resources: resourcesFor };
