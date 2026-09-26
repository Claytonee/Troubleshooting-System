/**
 * Guided resolution, phase 1: everything we already hold that might fix this.
 * Design: docs/features/14-guided-resolution.md · method: .claude/skills/guided-resolution/
 *
 * Feature 10 put three text guides above the description field, which was the
 * right idea aimed at a fifth of the evidence. The system also holds uploaded
 * manuals, training videos, photographs teachers took of real faults, and —
 * most valuable and least visible — a record of what was actually done the last
 * time this exact fault was fixed on this exact equipment. None of it was ever
 * shown to the person about to file.
 *
 * Four sources, one ranking:
 *
 *   guides       troubleshooting_guides   steps to follow
 *   resources    manuals                  video, image, audio, PDF, DOCX
 *   fixes        errors + error_updates   what worked here before
 *   photos       error_attachments        what it looked like
 *
 * Two rules carried over from feature 10, unchanged:
 *   - nothing matches → return nothing. Suggesting the least-bad resource every
 *     time teaches people to ignore the panel.
 *   - a resource that somebody confirmed fixed this outranks one that merely
 *     shares words with it. Text similarity alone ranks the wordiest document
 *     first, which is how a 40-page PDF beats a 40-second video.
 *
 * NOTHING here calls a model. The written assessment is phase 2 and sits on top
 * of this; with Bedrock unset, down or rate-limited the panel still renders
 * everything below. A feature that helps people fix classrooms must not be
 * all-or-nothing on an external service.
 */
const pool = require('../config/database');
const { parseSteps } = require('./knowledge');

/** Below this, a candidate is noise and is not shown at all. */
const FLOOR = 6;

/** How far back a past resolution still counts as current practice. */
const FIX_WINDOW_DAYS = 400;

/** Shorter than this and a note cannot be describing a repair. */
const FIX_NOTE_MIN = 25;

/**
 * Notes that describe the *process* rather than the *fix*.
 *
 * "Teacher followed the troubleshooting guide and confirmed it worked" is true,
 * is logged against a resolved fault, and teaches the next person nothing. The
 * value of this source is a sentence saying what somebody actually did to the
 * equipment; anything that only records that the workflow completed is noise,
 * and noise here is worse than an empty band — it makes the panel look busy
 * while helping nobody.
 */
const PROCESS_BOILERPLATE = [
  /followed the troubleshooting guide/i,
  /confirmed it (worked|was fixed)/i,
  /^assigned to /i,
  /^escalated to /i,
  /marked (as )?resolved/i,
  /no further action/i
];

const isRealFixNote = (note) => {
  const n = String(note || '').trim();
  if (n.length < FIX_NOTE_MIN) return false;
  return !PROCESS_BOILERPLATE.some(re => re.test(n));
};

/**
 * Words worth matching on. Short words match everything, so they are dropped —
 * and so are the words that appear in every fault report we have, which would
 * otherwise pull every resource to the top of every query.
 */
const STOP = new Set([
  'the', 'and', 'not', 'with', 'this', 'that', 'have', 'has', 'for', 'are', 'was',
  'when', 'from', 'they', 'their', 'there', 'been', 'will', 'would', 'about',
  // The vocabulary of every report in the system.
  'error', 'issue', 'problem', 'fault', 'help', 'please', 'working', 'work',
  // Swahili equivalents — reports arrive in both languages.
  'hii', 'hiyo', 'kwa', 'ina', 'haifanyi', 'kazi', 'tatizo', 'shida', 'naomba', 'sana'
]);

function keywords(text) {
  return [...new Set(
    String(text || '')
      .toLowerCase()
      .split(/[^a-z0-9']+/)
      .filter(w => w.length > 3 && !STOP.has(w))
  )].slice(0, 8);
}

/** How many of `words` appear in `hay`, and how many of them in its title. */
function overlap(words, hay, title) {
  let body = 0, head = 0;
  const h = (hay || '').toLowerCase();
  const t = (title || '').toLowerCase();
  for (const w of words) {
    if (h.includes(w)) body++;
    if (t.includes(w)) head++;
  }
  return { body, head };
}

/** Which of our media kinds a stored MIME type or filename is. */
function kindOf(fileType, filename) {
  const t = String(fileType || '').toLowerCase();
  const n = String(filename || '').toLowerCase();
  if (t.startsWith('video/') || /\.(mp4|webm|mov|avi|mkv)$/.test(n)) return 'video';
  if (t.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac)$/.test(n)) return 'audio';
  if (t.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/.test(n)) return 'image';
  if (t.includes('pdf') || /\.pdf$/.test(n)) return 'pdf';
  return 'document';
}

/**
 * What a kind is worth when somebody is standing in a classroom mid-lesson.
 *
 * A short video that shows the thing beats a manual that describes it; a photo
 * of the right cable beats both. A forty-page PDF is the most expensive thing
 * we can hand them, so it ranks last — it is still offered, under "read more",
 * because sometimes it is the only place the answer exists.
 */
const KIND_WEIGHT = { animation: 6, video: 5, image: 4, audio: 2, pdf: 1, document: 1 };

/* ------------------------------------------------------------------ *
 * The four sources
 * ------------------------------------------------------------------ */

async function guideCandidates(words, category) {
  const [rows] = await pool.query(
    `SELECT g.id, g.title, g.category, g.icon, g.steps,
            (SELECT COUNT(*) FROM guide_deflections d WHERE d.guide_id = g.id) AS deflected,
            (SELECT COUNT(*) FROM errors e WHERE e.tried_guide_id = g.id)      AS filed_anyway
       FROM troubleshooting_guides g
      ORDER BY g.id`
  );
  return rows.map(g => {
    const steps = parseSteps(g.steps);
    const { body, head } = overlap(words, g.title + ' ' + g.category + ' ' + steps.join(' '), g.title);
    const deflected = Number(g.deflected) || 0;
    const filed = Number(g.filed_anyway) || 0;
    const met = deflected + filed;
    let score = (category && g.category === category ? 10 : 0) + body * 2 + head * 3;
    // Evidence, not rhetoric: a guide people confirmed fixed this rises, and one
    // they read before filing anyway falls. Only once it has met enough people
    // for the ratio to mean anything.
    if (met >= 3) score += Math.round(((deflected / met) - 0.5) * 8);
    return {
      type: 'guide', id: g.id, score,
      title: g.title, category: g.category, icon: g.icon || 'ti-tools', steps,
      // null, never 0%, for a guide nobody has met — they are different facts.
      success_rate: met ? Math.round((deflected / met) * 100) : null,
      times_met: met
    };
  });
}

/**
 * Animated explainers (feature 15). Ranked above video on purpose: they are the
 * same explanation at ~1/180th of the bytes, they step at the reader's pace
 * while their hands are on the equipment, and they are the only kind of media
 * small enough to already be on the device when the uplink is dead — which is
 * exactly when the explainer about the dead uplink is needed.
 */
async function activeExplainers() {
  const [rows] = await pool.query(
    `SELECT id, explainer_key, art, category, equipment, title_sw, title_en, scenes
       FROM explainers WHERE is_active = 1 ORDER BY sort_order, id`
  );
  return rows;
}

/** The card an explainer shows as: no script, just enough to decide whether to open it. */
function explainerSummary(x, scenes) {
  return {
    id: x.id,
    kind: 'animation',
    key: x.explainer_key, art: x.art,
    category: x.category, equipment: x.equipment,
    title: { sw: x.title_sw, en: x.title_en },
    steps_count: scenes.length,
    // Roughly how long it runs, so the card can say so before anybody commits.
    duration_s: Math.round(scenes.reduce((t, s) => t + (Number(s.ms) || 7000), 0) / 1000)
  };
}

const scenesOf = (x) => (typeof x.scenes === 'string' ? safeJson(x.scenes) : (Array.isArray(x.scenes) ? x.scenes : []));

/**
 * Every active explainer, for the Resource Library. The library used to read
 * only `manuals`, so it said "No files uploaded yet" while the system held
 * explainers that the report form could play (reported 2026-09-26).
 */
async function listExplainers() {
  return (await activeExplainers()).map(x => explainerSummary(x, scenesOf(x)));
}

async function explainerCandidates(words, category) {
  const rows = await activeExplainers();
  return rows.map(x => {
    const scenes = scenesOf(x);
    // Both languages are searched: a teacher types "haichaji" as readily as
    // "not charging", and the panel must find the same explainer either way.
    const hay = [x.title_sw, x.title_en, x.category, x.equipment,
      ...scenes.map(s => `${s.sw || ''} ${s.en || ''}`)].join(' ');
    const { body, head } = overlap(words, hay, `${x.title_sw} ${x.title_en}`);
    if (!body && !head && !(category && x.category === category)) return null;
    return {
      type: 'explainer',
      score: (category && x.category === category ? 9 : 0) + body * 2 + head * 3 + KIND_WEIGHT.animation,
      ...explainerSummary(x, scenes)
    };
  }).filter(Boolean);
}

const safeJson = (raw) => { try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch (e) { return []; } };

async function resourceCandidates(words, category) {
  const [rows] = await pool.query(
    `SELECT id, title, original_filename, stored_filename, file_type, file_size, category, created_at
       FROM manuals ORDER BY id`
  );
  return rows.map(m => {
    const kind = kindOf(m.file_type, m.original_filename);
    const { body, head } = overlap(words, m.title + ' ' + m.category + ' ' + m.original_filename, m.title);
    if (!body && !head && !(category && m.category === category)) return null;
    return {
      type: 'resource', id: m.id,
      score: (category && m.category === category ? 8 : 0) + body * 2 + head * 3 + (KIND_WEIGHT[kind] || 1),
      title: m.title, category: m.category, kind,
      url: m.stored_filename, filename: m.original_filename,
      file_size: Number(m.file_size) || 0
    };
  }).filter(Boolean);
}

/**
 * What was actually done the last time this was fixed.
 *
 * Cross-school by the owner's decision (2026-09-25) and **stripped**: the fix is
 * the knowledge, the school is somebody else's business. No school name, no
 * reporter, no contact, no attachments belonging to another school. A row only
 * qualifies when it is resolved AND carries a note saying what was done — a
 * ticket closed in silence teaches nobody anything.
 */
async function fixCandidates(words, category, viewerSchoolId) {
  const [rows] = await pool.query(
    `SELECT e.id, e.title, e.category, e.subcategory, e.school_id, e.resolved_at,
            DATEDIFF(NOW(), e.resolved_at) AS days_ago,
            -- Only an update that records a resolution. A progress note or an
            -- escalation note says where the ticket went, not what was done to
            -- the equipment.
            (SELECT u.note FROM error_updates u
              WHERE u.error_id = e.id AND u.note IS NOT NULL
                AND CHAR_LENGTH(u.note) >= ${FIX_NOTE_MIN}
                AND LOWER(COALESCE(u.update_type, '')) IN ('resolved', 'resolution')
              ORDER BY u.created_at DESC LIMIT 1) AS fix_note
       FROM errors e
      WHERE e.status = 'resolved'
        AND e.resolved_at IS NOT NULL
        AND e.resolved_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      ORDER BY e.resolved_at DESC
      LIMIT 400`,
    [FIX_WINDOW_DAYS]
  );

  return rows.map(e => {
    if (!isRealFixNote(e.fix_note)) return null;
    const { body, head } = overlap(words, e.title + ' ' + e.category + ' ' + (e.subcategory || '') + ' ' + e.fix_note, e.title);
    if (!body && !head) return null;
    const days = Number(e.days_ago) || 0;
    let score = (category && e.category === category ? 9 : 0) + body * 2 + head * 3;
    // Recent practice beats old practice; a fix from the reader's own school is
    // the most transferable of all — same room, same equipment, same power.
    if (days <= 30) score += 4; else if (days <= 120) score += 2;
    if (viewerSchoolId && e.school_id === viewerSchoolId) score += 3;
    return {
      type: 'fix', id: e.id, score,
      title: e.title, category: e.category, subcategory: e.subcategory || null,
      what_was_done: e.fix_note,
      days_ago: days,
      // True only for the reader's own school. Never names anyone else's.
      same_school: !!(viewerSchoolId && e.school_id === viewerSchoolId)
    };
  }).filter(Boolean);
}

/**
 * Photographs of the same fault — but only ones the reader is entitled to see.
 * Another school's photograph is of another school's room, and no ranking score
 * makes that shareable.
 */
async function photoCandidates(words, category, viewerSchoolId) {
  if (!viewerSchoolId) return [];
  const [rows] = await pool.query(
    `SELECT a.id, a.original_filename, a.stored_url, a.file_type, e.title, e.category, e.id AS error_id
       FROM error_attachments a
       JOIN errors e ON e.id = a.error_id
      WHERE e.school_id = ? AND e.status = 'resolved'
      ORDER BY a.created_at DESC
      LIMIT 120`,
    [viewerSchoolId]
  );
  return rows.map(a => {
    const kind = kindOf(a.file_type, a.original_filename);
    if (kind !== 'image' && kind !== 'video') return null;
    const { body, head } = overlap(words, a.title + ' ' + a.category, a.title);
    if (!body && !head && !(category && a.category === category)) return null;
    return {
      type: 'photo', id: a.id,
      score: (category && a.category === category ? 6 : 0) + body * 2 + head * 3 + (KIND_WEIGHT[kind] || 1),
      title: a.title, category: a.category, kind,
      url: a.stored_url, filename: a.original_filename, error_id: a.error_id
    };
  }).filter(Boolean);
}

/* ------------------------------------------------------------------ *
 * The answer
 * ------------------------------------------------------------------ */

/**
 * Everything worth showing, in the order a person can act on it.
 *
 * The shape follows what search engines settled on for "how do I fix X": steps
 * to follow, then the media that shows those steps, then what was done before,
 * then documents to read. Never media first — a video costs bandwidth, sound and
 * minutes, which is the most expensive thing to ask of somebody standing in a
 * classroom during a lesson.
 */
async function find({ category, text, viewerSchoolId, limit = 6 }) {
  const words = keywords(text);
  if (!words.length && !category) return empty();

  const [guides, explainers, resources, fixes, photos] = await Promise.all([
    guideCandidates(words, category),
    explainerCandidates(words, category),
    resourceCandidates(words, category),
    fixCandidates(words, category, viewerSchoolId),
    photoCandidates(words, category, viewerSchoolId)
  ]);

  const all = [...guides, ...explainers, ...resources, ...fixes, ...photos]
    .filter(c => c.score >= FLOOR)
    // Ties broken deterministically. Without this the same query can render a
    // different order twice — MySQL is free to return unordered rows however it
    // likes — and a panel that reshuffles between keystrokes is one people stop
    // reading.
    .sort((a, b) => b.score - a.score || a.type.localeCompare(b.type) || a.id - b.id);

  if (!all.length) return empty();

  const take = (type, n) => all.filter(c => c.type === type).slice(0, n).map(strip);
  // An explainer first, then the heavy media. Same band, cheapest thing on top.
  const watch = [...all.filter(c => c.type === 'explainer'),
    ...all.filter(c => (c.type === 'resource' || c.type === 'photo') && (c.kind === 'video' || c.kind === 'image'))]
    .slice(0, 4).map(strip);
  const read = all.filter(c => c.type === 'resource' && c.kind !== 'video' && c.kind !== 'image')
    .slice(0, 3).map(strip);

  return {
    matched: true,
    // Steps first: the thing they can do without downloading anything.
    steps: take('guide', 2),
    // Then what shows those steps.
    watch,
    // Then what worked here before.
    fixes: take('fix', 2),
    // Then what to read, last and smallest.
    read,
    total: Math.min(all.length, limit),
    // What the panel was built from, so phase 2 can be grounded in exactly this
    // set and nothing else.
    candidate_ids: all.slice(0, 12).map(c => `${c.type}:${c.id}`)
  };
}

const strip = ({ score, ...rest }) => rest;

/**
 * Nothing matched. An honest empty state, and the signal phase 3 needs: this is
 * the moment a resource request is born, and the number worth counting.
 */
function empty() {
  return { matched: false, steps: [], watch: [], fixes: [], read: [], total: 0, candidate_ids: [] };
}

module.exports = { find, keywords, kindOf, listExplainers, FLOOR, KIND_WEIGHT };
