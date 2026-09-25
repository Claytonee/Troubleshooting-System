/**
 * Guided resolution, phase 2: the answer in words, above the resources.
 * docs/features/14-guided-resolution.md · method: .claude/skills/guided-resolution/
 *
 * Phase 1 returns everything we hold that might fix this. What it cannot do is
 * say *what the problem probably is* — and a person will not spend four minutes
 * on a procedure until they know what they are dealing with. That sentence is
 * this file.
 *
 * THE RULE THAT MAKES THIS TRUSTWORTHY: the model is handed a numbered list of
 * resources that exist, and may only choose, order and explain from that list.
 * It never names a resource, a document or a video that was not retrieved. A
 * model free to invent eventually recommends a video nobody can find; the
 * teacher searches, fails, and trusts the system less than before they asked.
 * Anything it returns that was not in the list is dropped and the drop is
 * logged — a model that starts inventing is a regression worth seeing.
 *
 * Both languages come back in ONE call (owner's decision, 2026-09-25: Swahili by
 * default, one tap to English). Never a second translation round-trip, which is
 * how two versions of the same sentence drift apart.
 *
 * Optional throughout. Unconfigured, slow or failing, the caller renders phase 1
 * on its own — the resources are still there, only the sentence above them is
 * missing.
 */
const crypto = require('crypto');
const assistant = require('./assistant');

/** The model is a nicety on a page that must stay quick. */
const TIMEOUT_MS = 9000;

/** At most four picks: a fifth suggestion has never fixed anything. */
const MAX_PICKS = 4;

const SYSTEM = `You are the technical support assistant for Opportunity Education Tanzania, helping teachers and school staff in Tanzanian secondary schools with tablets, WiFi, the Quest learning platform, power and UPS systems, and user accounts.

A person is about to report a fault. You are given their report and a numbered list of resources THAT EXIST in this system. Your job is to tell them what the problem most likely is, and which of those resources will actually help.

Answer with a single JSON object and nothing else:
{"assessment_sw":"...","assessment_en":"...","picks":[{"ref":"guide:12","why_sw":"...","why_en":"..."}]}

Rules you must not break:
- Use ONLY refs that appear in the list you were given, exactly as written. Never invent a resource, a document, a video or a page number.
- If none of the resources genuinely address this report, return "picks": [].
- assessment: two or three short sentences saying what this most likely is and why you think so, based on what they wrote. Plain words a teacher reads while standing in a classroom. No greeting, no sign-off, no markdown.
- Never promise a repair, never name a cost, never tell them to buy anything.
- If their report is too vague to assess, say so plainly in the assessment rather than guessing.
- why: one short clause per pick saying why that resource helps this fault.
- assessment_sw and why_sw are Kiswahili; assessment_en and why_en are English. Same meaning, both natural — not a word-for-word translation.`;

/* ------------------------------------------------------------------ *
 * A small cache: the report form asks as somebody types
 * ------------------------------------------------------------------ */

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 200;
const cache = new Map();

function cacheKey(category, text, refs) {
  return crypto.createHash('sha256')
    .update(`${category}|${text.trim().toLowerCase()}|${refs.join(',')}`)
    .digest('hex');
}

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) { cache.delete(key); return null; }
  // Refresh recency — Map preserves insertion order, so re-inserting moves it last.
  cache.delete(key);
  cache.set(key, hit);
  return hit.value;
}

function cacheSet(key, value) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS });
}

/* ------------------------------------------------------------------ *
 * The candidate list the model is allowed to choose from
 * ------------------------------------------------------------------ */

/**
 * One line per resource, with the ref the model must answer with. Deliberately
 * terse: the model needs enough to judge relevance, not the whole corpus.
 */
function describe(found) {
  const lines = [];
  const refs = new Set();

  const add = (ref, line) => { refs.add(ref); lines.push(`${ref} — ${line}`); };

  for (const g of found.steps || []) {
    add(`guide:${g.id}`, `GUIDE "${g.title}" (${g.category}). Steps: ${(g.steps || []).slice(0, 6).join(' / ')}`);
  }
  for (const m of found.watch || []) {
    add(`${m.type === 'photo' ? 'photo' : 'resource'}:${m.id}`, `${m.kind.toUpperCase()} "${m.title}" (${m.category || 'general'})`);
  }
  for (const f of found.fixes || []) {
    add(`fix:${f.id}`, `PAST FIX of "${f.title}" ${f.days_ago} days ago. What was done: ${f.what_was_done}`);
  }
  for (const m of found.read || []) {
    add(`resource:${m.id}`, `${m.kind.toUpperCase()} "${m.title}" (${m.category || 'general'})`);
  }

  return { lines, refs };
}

/** The first balanced JSON object in a reply, however the model wrapped it. */
function extractJson(text) {
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      try { return JSON.parse(text.slice(start, i + 1)); } catch (e) { return null; }
    }
  }
  return null;
}

const clean = (s, max = 600) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, max);

/* ------------------------------------------------------------------ *
 * The assessment
 * ------------------------------------------------------------------ */

/**
 * @returns {Promise<{ok: boolean, reason?: string, assessment?: {sw, en}, why?: Object}>}
 *          `why` is keyed by the same refs phase 1 uses, so the page can put a
 *          reason beside each card without a second lookup.
 */
async function assess({ category, text, found }) {
  if (!assistant.isConfigured()) return { ok: false, reason: 'not_configured' };
  if (!found || !found.matched) return { ok: false, reason: 'nothing_to_assess' };

  const { lines, refs } = describe(found);
  if (!lines.length) return { ok: false, reason: 'no_candidates' };

  const key = cacheKey(category || '', text || '', [...refs].sort());
  const cached = cacheGet(key);
  if (cached) return { ...cached, cached: true };

  const user = [
    `Category: ${category || 'not chosen'}`,
    `What they wrote: ${clean(text, 1200)}`,
    '',
    'Resources that exist in this system:',
    ...lines
  ].join('\n');

  const reply = await assistant.ask({
    system: SYSTEM,
    messages: [{ role: 'user', content: user }],
    maxTokens: 700
  });
  if (!reply.ok) return { ok: false, reason: reply.reason };

  const parsed = extractJson(reply.text);
  if (!parsed) {
    console.error('[assessment] reply was not JSON; falling back to resources alone');
    return { ok: false, reason: 'unparseable' };
  }

  const sw = clean(parsed.assessment_sw);
  const en = clean(parsed.assessment_en);
  if (!sw && !en) return { ok: false, reason: 'empty_assessment' };

  // Grounding, enforced here rather than hoped for in the prompt.
  const why = {};
  let invented = 0;
  for (const p of Array.isArray(parsed.picks) ? parsed.picks.slice(0, MAX_PICKS) : []) {
    const ref = clean(p && p.ref, 40);
    if (!refs.has(ref)) { invented++; continue; }
    why[ref] = { sw: clean(p.why_sw, 180), en: clean(p.why_en, 180) };
  }
  if (invented) {
    console.error(`[assessment] dropped ${invented} ref(s) the model invented — they were not in the candidate list`);
  }

  const value = {
    ok: true,
    assessment: { sw, en },
    why,
    // Visible to the caller so a prompt regression shows up as data, not a rumour.
    invented_refs: invented
  };
  cacheSet(key, value);
  return value;
}

module.exports = { assess, describe, extractJson, TIMEOUT_MS, MAX_PICKS };
