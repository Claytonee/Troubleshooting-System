/**
 * Guided resolution (feature 14, phase 1).
 * docs/features/14-guided-resolution.md
 */
const pool = require('../config/database');
const resources = require('../services/resources');
const assessment = require('../services/assessment');

const CATEGORIES = ['Connectivity', 'Hardware', 'Platform', 'Power', 'Accounts', 'Other'];

/** Below this, a description is too thin for a model to say anything useful about. */
const ASSESS_MIN_CHARS = 25;

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

/**
 * POST /api/assist/assess   { category, text }
 *
 * The sentence above the resources: what this most likely is, in Kiswahili and
 * English, plus one line per resource saying why it helps.
 *
 * A separate call from `/resources` on purpose. That one fires as somebody
 * types and must stay instant; this one costs a model round-trip, so the page
 * asks for it once, when there is actually something to assess. The resources
 * render either way — an unconfigured, slow or failing model loses the
 * sentence, never the help.
 */
async function assessFor(req, res, next) {
  try {
    const raw = String((req.body && req.body.category) || '').trim();
    const category = CATEGORIES.includes(raw) ? raw : '';
    const text = String((req.body && req.body.text) || '').slice(0, 1200);

    if (text.trim().length < ASSESS_MIN_CHARS) {
      return res.json({ ok: false, reason: 'too_short' });
    }

    const found = await resources.find({
      category,
      text,
      viewerSchoolId: req.user.school_id || null
    });
    if (!found.matched) return res.json({ ok: false, reason: 'nothing_to_assess' });

    const result = await assessment.assess({ category, text, found });
    // `ok: false` is a normal answer here, not an error: it is how the page
    // learns to render the resources without a sentence above them.
    res.json(result);
  } catch (err) { next(err); }
}

/**
 * GET /api/assist/explainers — every active explainer, as cards (no scripts).
 * The Resource Library lists these beside the uploaded files; any signed-in
 * role, like the resources endpoint.
 */
async function explainerList(req, res, next) {
  try {
    res.json(await resources.listExplainers());
  } catch (err) { next(err); }
}

/**
 * GET /api/assist/explainers/:id — one explainer's script.
 *
 * Only the script: the captions in both languages, which part of the drawing to
 * light up, and how long to hold. The drawing itself ships with the app, so the
 * bytes over the wire are a few kilobytes and the whole thing is cacheable
 * offline — which is the point, since the explainer about a dead router is
 * needed precisely when the router is dead.
 */
async function explainerFor(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Bad explainer id.' });

    const [[row]] = await pool.query(
      `SELECT id, explainer_key, art, category, equipment, title_sw, title_en, scenes
         FROM explainers WHERE id = ? AND is_active = 1`, [id]
    );
    if (!row) return res.status(404).json({ error: 'Not found.' });

    const scenes = typeof row.scenes === 'string' ? JSON.parse(row.scenes) : (row.scenes || []);
    res.json({
      id: row.id,
      key: row.explainer_key,
      art: row.art,
      category: row.category,
      equipment: row.equipment,
      title: { sw: row.title_sw, en: row.title_en },
      scenes: (Array.isArray(scenes) ? scenes : []).map(s => ({
        focus: Array.isArray(s.focus) ? s.focus : [],
        ms: Number(s.ms) || 7000,
        sw: String(s.sw || ''),
        en: String(s.en || '')
      }))
    });
  } catch (err) { next(err); }
}

module.exports = { resources: resourcesFor, assess: assessFor, explainers: explainerList, explainer: explainerFor };
