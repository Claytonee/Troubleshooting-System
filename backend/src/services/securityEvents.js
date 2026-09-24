const pool = require('../config/database');

/**
 * Security events — the evidence behind SEC-006 (DECISIONS.md D2).
 *
 * One response hook, not a call in every controller: every 401, 403 and 429 on
 * /api/ is classified here, so a refusal added to a controller next year is
 * recorded without anyone remembering to. Handlers add precision through
 * res.locals (secEvent, secUserId, secRule, secDetail); they never write rows.
 *
 * It must not become the outage it is meant to record:
 *  - rows are buffered and flushed every FLUSH_MS, never written in the request;
 *  - the same event (type, IP, user, route, status) within DEDUP_MS folds into
 *    one row's `count` — a thousand guesses are one row, not a thousand;
 *  - at most MAX_PENDING distinct rows wait; beyond that they are counted and
 *    one `events.dropped` row says how many;
 *  - a failed write is logged once and dropped, never retried forever, and
 *    never fails the request;
 *  - rows older than RETAIN_DAYS are deleted in small batches.
 *
 * What is never stored: passwords, tokens, headers, request bodies, query
 * strings, raw URLs (only the route template), or the username typed into a
 * failed sign-in for an account that does not exist.
 *
 * occurred_at is the flush time, so it is accurate to ±FLUSH_MS.
 */

const FLUSH_MS = 2000;
const MAX_PENDING = 500;
const DEDUP_MS = 60 * 1000;
const RECENT_CAP = 5000;
const RETAIN_DAYS = 90;
const PRUNE_EVERY_MS = 6 * 60 * 60 * 1000;

const SEVERITY = {
  'auth.login_failed': 'low',
  'auth.login_throttled': 'medium',
  'auth.login_refused': 'low',        // pending, rejected or deactivated account
  'auth.login_ok': 'info',
  'auth.sessions_revoked': 'info',    // password change/reset, suspension, sign out everywhere
  'auth.mfa_required': 'info',        // password right; second step asked for
  'auth.mfa_ok': 'info',
  'auth.mfa_failed': 'medium',        // wrong code — at sign-in, enrolment or disable
  'auth.mfa_recovery_used': 'medium', // a one-time recovery code was spent
  'auth.mfa_enabled': 'info',
  'auth.mfa_disabled': 'medium',
  'auth.token_rejected': 'low',       // no, bad or expired token; inactive account
  'auth.account_state': 'low',        // pending/rejected account used a token
  'authz.role_refused': 'medium',
  'authz.refused': 'medium',          // record-level: another school, not your row
  'api.rate_limited': 'low',
  'webhook.rejected': 'medium',
  'csp.foreign_script': 'medium',     // a browser blocked a script from another origin, or an eval
  'events.dropped': 'high'
};

// Routes that authenticate with a signature or shared key rather than a session.
const WEBHOOK_PREFIXES = ['/api/whatsapp', '/api/deploy', '/api/heartbeat', '/api/ussd', '/api/sms'];

const pending = [];            // rows not yet inserted
const increments = new Map();  // inserted row id -> { n: repeats since its insert, row }
const recent = new Map();      // dedup key -> { row, at }
let dropped = 0;
let timer = null;
let flushing = false;
let lastPrune = 0;
let lastErrorLogged = 0;

function ensureTimer() {
  if (timer) return;
  timer = setTimeout(() => { timer = null; flush(); }, FLUSH_MS);
  if (timer.unref) timer.unref();
}

/** Queue one event. Never throws, never awaits. */
function record(evt) {
  try {
    if (!evt || !SEVERITY[evt.event_type]) return;
    // The reason is part of the key: a forged token and a missing one on the same
    // route are different evidence, and folding one into the other kept only the
    // first reason — erasing the forgery, which is the one that matters.
    const key = [evt.event_type, evt.source_ip || '', evt.user_id || '', evt.method || '',
      evt.path_template || '', evt.status || '', evt.detail ? JSON.stringify(evt.detail) : ''].join('|');
    const now = Date.now();
    const seen = recent.get(key);
    if (seen && now - seen.at < DEDUP_MS) {
      if (seen.row.id) {
        const inc = increments.get(seen.row.id) || { n: 0, row: seen.row };
        inc.n++;
        increments.set(seen.row.id, inc);
      }
      else seen.row.count++;
      ensureTimer();
      return;
    }
    if (pending.length >= MAX_PENDING) { dropped++; ensureTimer(); return; }
    const row = {
      id: null,
      count: 1,
      event_type: evt.event_type,
      severity: SEVERITY[evt.event_type],
      source_ip: evt.source_ip ? String(evt.source_ip).slice(0, 45) : null,
      user_id: Number.isInteger(evt.user_id) ? evt.user_id : null,
      role: evt.role ? String(evt.role).slice(0, 20) : null,
      school_id: Number.isInteger(evt.school_id) ? evt.school_id : null,
      method: evt.method ? String(evt.method).slice(0, 8) : null,
      path_template: evt.path_template ? String(evt.path_template).slice(0, 160) : null,
      status: Number.isInteger(evt.status) ? evt.status : null,
      detail: evt.detail ? JSON.stringify(evt.detail).slice(0, 500) : null
    };
    pending.push(row);
    recent.set(key, { row, at: now });
    if (recent.size > RECENT_CAP) {
      // Oldest first: Map keeps insertion order.
      for (const k of recent.keys()) { recent.delete(k); if (recent.size <= RECENT_CAP / 2) break; }
    }
    ensureTimer();
  } catch (e) { /* recording must never break a request */ }
}

function logFailure(e) {
  if (Date.now() - lastErrorLogged < 60000) return;
  lastErrorLogged = Date.now();
  console.error('[security-events] write failed:', e.message);
}

async function flush() {
  if (flushing) { ensureTimer(); return; }
  flushing = true;
  try {
    const insert = async (row, count) => {
      const [r] = await pool.query(
        `INSERT INTO security_events
           (occurred_at, last_at, event_type, severity, source_ip, user_id, role, school_id,
            method, path_template, status, count, detail)
         VALUES (NOW(), NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [row.event_type, row.severity, row.source_ip, row.user_id, row.role, row.school_id,
          row.method, row.path_template, row.status, count, row.detail]);
      row.id = r.insertId;
    };
    const batch = pending.splice(0, pending.length);
    for (const row of batch) {
      try { await insert(row, row.count); } catch (e) { logFailure(e); }
    }
    const incs = [...increments.entries()];
    increments.clear();
    for (const [id, inc] of incs) {
      try {
        const [r] = await pool.query('UPDATE security_events SET count = count + ?, last_at = NOW() WHERE id = ?', [inc.n, id]);
        // The row went away under us (retention, or a cleanup): the repeats
        // are still evidence, so they start a row of their own rather than vanish.
        if (!r.affectedRows) await insert(inc.row, inc.n);
      } catch (e) { logFailure(e); }
    }
    if (dropped) {
      const n = dropped;
      dropped = 0;
      try {
        await pool.query(
          `INSERT INTO security_events (occurred_at, last_at, event_type, severity, count, detail)
           VALUES (NOW(), NOW(), 'events.dropped', 'high', ?, ?)`,
          [n, JSON.stringify({ reason: `more than ${MAX_PENDING} distinct events in ${FLUSH_MS} ms` })]);
      } catch (e) { logFailure(e); }
    }
    const now = Date.now();
    for (const [k, v] of recent) if (now - v.at >= DEDUP_MS) recent.delete(k);
    if (now - lastPrune > PRUNE_EVERY_MS) {
      lastPrune = now;
      try {
        await pool.query(
          'DELETE FROM security_events WHERE occurred_at < NOW() - INTERVAL ? DAY LIMIT 5000', [RETAIN_DAYS]);
      } catch (e) { logFailure(e); }
    }
  } finally {
    flushing = false;
    if (pending.length || increments.size || dropped) ensureTimer();
  }
}

/** The route as declared (`/api/errors/:id`), or the URL with ids and tokens masked. */
function pathTemplate(req) {
  if (req.route && typeof req.route.path === 'string') {
    return (req.baseUrl || '') + (req.route.path === '/' ? '' : req.route.path);
  }
  const p = String(req.originalUrl || req.url || '').split('?')[0];
  return p.split('/').map(seg => {
    if (/^\d+$/.test(seg)) return ':id';
    if (seg.length >= 16 && /^[A-Za-z0-9_.~-]+$/.test(seg)) return ':token';
    return seg;
  }).join('/');
}

function classify(req, res, status) {
  if (res.locals.secEvent) return res.locals.secEvent;
  const path = String(req.originalUrl || '').split('?')[0];
  if (path === '/api/auth/login') {
    if (status === 401) return 'auth.login_failed';
    if (status === 429) return 'auth.login_throttled';
    if (status === 403) return 'auth.login_refused';
    return null;
  }
  if (status === 429) return 'api.rate_limited';
  if (WEBHOOK_PREFIXES.some(p => path.startsWith(p))) {
    return (status === 401 || status === 403) ? 'webhook.rejected' : null;
  }
  if (status === 401) return 'auth.token_rejected';
  if (status === 403) {
    if (res.locals.secRule === 'role') return 'authz.role_refused';
    if (res.locals.secRule === 'account_state') return 'auth.account_state';
    return 'authz.refused';
  }
  return null;
}

/** Mount on /api/ before the rate limiters, so their 429s are seen too. */
function middleware(req, res, next) {
  res.on('finish', () => {
    try {
      const status = res.statusCode;
      if (status !== 401 && status !== 403 && status !== 429 && !res.locals.secEvent) return;
      const type = classify(req, res, status);
      if (!type) return;
      const u = req.user || null;
      const uid = res.locals.secUserId !== undefined ? res.locals.secUserId : (u ? u.id : null);
      record({
        event_type: type,
        source_ip: req.ip,
        user_id: uid,
        role: u ? u.role : (res.locals.secRole || null),
        school_id: u ? u.school_id : null,
        method: req.method,
        path_template: pathTemplate(req),
        status,
        // A claimed address is recorded as 0.0.0.0 with a constant flag, never the claim
        // itself: rotating made-up addresses must fold into one row, not bloat the evidence.
        detail: req.ipClaimed !== undefined ? { ...(res.locals.secDetail || {}), ip_claimed: true } : (res.locals.secDetail || null)
      });
    } catch (e) { /* never */ }
  });
  next();
}

module.exports = { middleware, record, flush, pathTemplate, SEVERITY, _state: () => ({ pending: pending.length, recent: recent.size }) };
