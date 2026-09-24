const pool = require('../config/database');
const securityEvents = require('./securityEvents');

/**
 * Strict CSP, report-only (DECISIONS.md D24).
 *
 * The enforced policy still allows inline script because the app has ~321
 * inline event handlers. Next to it the server sends the strict policy as
 * Content-Security-Policy-Report-Only, and browsers report every place that
 * would break. Those reports are the migration inventory.
 *
 * Volume is the trap: every page view of every user would report dozens of
 * handlers — over a million rows a day in security_events. So reports are
 * aggregated in memory into one row per distinct SITE (directive, what was
 * blocked, which file, which line) and flushed as counters every five
 * minutes: a few hundred rows in total, however busy the system is.
 *
 * Except what looks like an attack. A script from a foreign origin, or an
 * eval, is not the app's own legacy markup — it is what injected code looks
 * like. Those are recorded as security events as well (csp.foreign_script).
 */

const FLUSH_MS = 5 * 60 * 1000;
const MAX_SITES = 1000;
const pending = new Map();   // site key -> { directive, blocked, source, line, n }
let timer = null;

/** Only an origin, 'inline', 'eval', 'self' or 'data' — never a full URL with its query. */
function normaliseBlocked(v) {
  const s = String(v || '').trim();
  if (!s || s === 'inline' || s === 'eval' || s === 'self' || s === 'data' || s === 'blob') return s || 'inline';
  try { return new URL(s).origin; } catch (e) { return s.slice(0, 40); }
}
/** Only the path of the page or script — no query string, no fragment. */
function normaliseSource(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  try { return new URL(s).pathname.slice(0, 160); } catch (e) { return s.split(/[?#]/)[0].slice(0, 160); }
}

/** Accepts both formats: report-uri ({"csp-report": {...}}) and Reporting API ([{type, body}]). */
function extract(body) {
  const out = [];
  const list = Array.isArray(body) ? body : [body];
  for (const item of list) {
    const r = (item && (item['csp-report'] || (item.type === 'csp-violation' ? item.body : null))) || null;
    if (!r) continue;
    out.push({
      directive: String(r['effective-directive'] || r.effectiveDirective || r['violated-directive'] || r.violatedDirective || '').split(' ')[0].slice(0, 40),
      blocked: normaliseBlocked(r['blocked-uri'] || r.blockedURL),
      source: normaliseSource(r['source-file'] || r.sourceFile || r['document-uri'] || r.documentURL),
      line: Number(r['line-number'] || r.lineNumber) || 0
    });
  }
  return out;
}

function ensureTimer() {
  if (timer) return;
  timer = setTimeout(() => { timer = null; flush(); }, FLUSH_MS);
  if (timer.unref) timer.unref();
}

function ingest(req) {
  let reports;
  try { reports = extract(req.body); } catch (e) { return 0; }
  for (const r of reports) {
    if (!r.directive) continue;
    const foreign = r.blocked === 'eval' || /^https?:\/\//.test(r.blocked);
    if (foreign) {
      securityEvents.record({
        event_type: 'csp.foreign_script', source_ip: req.ip, method: 'POST', path_template: '/api/security/csp-report',
        status: 204, detail: { directive: r.directive, blocked: r.blocked, source: r.source }
      });
    }
    const key = [r.directive, r.blocked, r.source, r.line].join('|');
    const seen = pending.get(key);
    if (seen) seen.n++;
    else if (pending.size < MAX_SITES) pending.set(key, { ...r, n: 1 });
  }
  ensureTimer();
  return reports.length;
}

async function flush() {
  const rows = [...pending.values()];
  pending.clear();
  for (const r of rows) {
    try {
      await pool.query(
        `INSERT INTO csp_reports (directive, blocked, source, line, count, first_seen, last_seen)
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE count = count + VALUES(count), last_seen = NOW()`,
        [r.directive, r.blocked, r.source, r.line, r.n]);
    } catch (e) { /* the inventory is advisory; never let it fail anything */ }
  }
}

module.exports = { ingest, flush, extract };
