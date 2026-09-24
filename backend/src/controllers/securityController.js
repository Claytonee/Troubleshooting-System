const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { logAudit } = require('../services/audit');

/**
 * GET /api/security/overview — platform admin only.
 *
 * Facts about this deployment's security posture, for the Security Overview
 * page that a platform admin uses to brief stakeholders. Everything here is
 * measured on the running system or read from this repository's issue
 * register; nothing is estimated. Where a signal is not collected yet the
 * value is null and `why` says so — a null is not a zero.
 *
 * Never returns a secret, a hash, a prefix or a length: booleans and counts only.
 */

// Mirrors docs/engineering/security-program/ISSUE_REGISTER.md. Kept here so the
// page and the register cannot drift silently: verify-security-boundaries.js
// asserts every id below appears in that file.
const REVIEW = {
  date: '2026-09-24',
  scope: 'Whole application: 154 API endpoints, 4 roles, every page that renders stored data',
  findings: [
    { id: 'SEC-001', severity: 'P1', status: 'fixed', title: 'Any signed-in user could attach files to another school\'s fault' },
    { id: 'SEC-002', severity: 'P2', status: 'fixed', title: 'School forms, and a field engineer\'s school detail, were not scoped' },
    { id: 'SEC-003', severity: 'P1', status: 'fixed', title: 'Stored text could run as script in a platform admin\'s browser' },
    { id: 'SEC-004', severity: 'P2', status: 'fixed', title: 'A field engineer could write for schools not assigned to them' },
    { id: 'SEC-005', severity: 'P2', status: 'fixed', title: 'Sign-in tokens could not be revoked before they expired (7 days)' },
    { id: 'SEC-006', severity: 'P2', status: 'fixed', title: 'Failed sign-ins and refused requests were not recorded' },
    { id: 'SEC-007', severity: 'P2', status: 'fixed', title: 'No second factor on platform admin sign-in (required from 8 October 2026)' },
    { id: 'SEC-008', severity: 'P3', status: 'fixed', title: 'Public appeal and teacher-status endpoints accepted guessable input' },
    { id: 'SEC-009', severity: 'P3', status: 'fixed', title: 'Password throttle was per account per network, not per account' },
    { id: 'SEC-010', severity: 'P3', status: 'fixed', title: 'Fault attachments allowed up to 5 × 100 MB held in memory' },
    { id: 'SEC-012', severity: 'P1', status: 'fixed', title: 'Six known-vulnerable dependencies, one high (email library)' },
    { id: 'SEC-011', severity: 'P2', status: 'fixed', title: 'An admin-set password was permanent, could be 6 characters, and left sessions alive' },
    { id: 'SEC-013', severity: 'P3', status: 'fixed', title: 'Sign-in tokens were accepted in any HMAC algorithm, not only the one we issue' },
    { id: 'SEC-014', severity: 'P3', status: 'fixed', title: 'In production, any website\'s script got a cross-origin answer' }
  ]
};

const DEFAULT_PASSWORD = 'changeme123';   // what teamController hands a new sub-admin
const CACHE_MS = 10 * 60 * 1000;
let defaultPwCache = null;                // { at, count, checked }
let defaultPwRunning = null;              // the in-flight scan, so two page loads share one

/**
 * How many ACTIVE accounts still accept the documented default password.
 *
 * bcrypt is slow on purpose — 24 accounts took 8.5 s measured — so the scan
 * runs in the background, at most every ten minutes, and never holds the
 * request. Until the first scan finishes the answer is null ("checking"),
 * which the page shows as such rather than as zero.
 */
function defaultPasswordStatus() {
  const fresh = defaultPwCache && Date.now() - defaultPwCache.at < CACHE_MS;
  if (!fresh && !defaultPwRunning) {
    defaultPwRunning = (async () => {
      const [rows] = await pool.query("SELECT password_hash FROM users WHERE status = 'active' AND password_hash IS NOT NULL");
      let count = 0;
      for (const r of rows) {
        try { if (await bcrypt.compare(DEFAULT_PASSWORD, r.password_hash)) count++; } catch (e) { /* malformed hash: not a match */ }
      }
      defaultPwCache = { at: Date.now(), count, checked: rows.length };
    })().catch(e => console.error('[security] default-password scan failed:', e.message))
      .finally(() => { defaultPwRunning = null; });
  }
  return defaultPwCache || { count: null, checked: null, at: null };
}

async function overview(req, res, next) {
  try {
    const [roles] = await pool.query(
      `SELECT role, SUM(status = 'active') AS active, SUM(status <> 'active') AS inactive,
              SUM(must_change_password = 1 AND status = 'active') AS must_change
         FROM users GROUP BY role`);
    const [[audit]] = await pool.query(
      `SELECT COUNT(*) AS last_30_days, MAX(created_at) AS latest
         FROM audit_log WHERE created_at >= NOW() - INTERVAL 30 DAY`);
    const [[pending]] = await pool.query(
      "SELECT COUNT(*) AS n FROM registration_requests WHERE status = 'pending'");
    const defaults = defaultPasswordStatus();
    // What the system refused in the last 7 days (SEC-006). Sums of `count`,
    // because repeats within a minute are folded into one row.
    const [signals] = await pool.query(
      `SELECT event_type, SUM(count) AS n, COUNT(DISTINCT source_ip) AS sources, MAX(last_at) AS latest
         FROM security_events
        WHERE occurred_at >= NOW() - INTERVAL 7 DAY AND event_type <> 'auth.login_ok'
        GROUP BY event_type`);
    const [[since]] = await pool.query('SELECT MIN(occurred_at) AS first_at FROM security_events');
    // Two-step sign-in coverage (SEC-007): the live answer to "is the admin protected?"
    const [[mfa]] = await pool.query(
      `SELECT SUM(role = 'admin' AND status = 'active') AS admins,
              SUM(role = 'admin' AND status = 'active' AND mfa_enabled = 1) AS admins_mfa,
              SUM(status = 'active' AND mfa_enabled = 1) AS anyone_mfa FROM users`);

    const secret = process.env.JWT_SECRET || '';
    res.json({
      generated_at: new Date().toISOString(),
      build: req.app.locals.build || 'unknown',
      accounts: {
        by_role: roles.map(r => ({
          role: r.role, active: Number(r.active), inactive: Number(r.inactive), must_change_password: Number(r.must_change)
        })),
        on_default_password: defaults.count,
        checked_for_default_password: defaults.checked,
        default_password_checked_at: defaults.at ? new Date(defaults.at).toISOString() : null,
        pending_registrations: Number(pending.n)
      },
      mfa: {
        admins_active: Number(mfa.admins) || 0,
        admins_enrolled: Number(mfa.admins_mfa) || 0,
        accounts_enrolled: Number(mfa.anyone_mfa) || 0,
        required_from: require('../services/mfaPolicy').enforceAfter().toISOString()
      },
      audit: { events_last_30_days: Number(audit.last_30_days), latest_event_at: audit.latest },
      incidents: await (async () => {
        const [r] = await pool.query("SELECT severity, COUNT(*) AS n FROM security_incidents WHERE status <> 'closed' GROUP BY severity");
        const o = { high: 0, medium: 0, low: 0 };
        r.forEach(x => { o[x.severity] = Number(x.n); });
        return o;
      })(),
      // Retention (D25): what is past its period right now, and the last scheduled run.
      retention: await require('../services/retention').status().catch(() => null),
      csp: await (async () => {
        try {
          const [[c]] = await pool.query("SELECT COUNT(*) AS sites, COALESCE(SUM(count), 0) AS reports, MAX(last_seen) AS latest FROM csp_reports WHERE blocked = 'inline' AND last_seen >= NOW() - INTERVAL 30 DAY");
          return { inline_sites_30d: Number(c.sites), reports_30d: Number(c.reports), latest: c.latest };
        } catch (e) { return null; }
      })(),
      signals: {
        window_days: 7,
        recording_since: since.first_at,
        by_type: signals.map(r => ({
          event_type: r.event_type, count: Number(r.n), sources: Number(r.sources), latest_at: r.latest
        }))
      },
      // Recorded, but nothing acts on it yet — detection rules and alerts are
      // the next phase (DECISIONS.md D5, D6).
      not_collected: [
        { signal: 'email_alerts', why: 'Security alerts go to the in-app bell; email is added the day SMTP is configured (D6).' }
      ],
      checks: {
        https_enforced: process.env.NODE_ENV === 'production',
        signing_secret_strong: secret.length >= 32 && !/change|secret|example|your_/i.test(secret),
        deploy_webhook_signed: !!(process.env.WEBHOOK_SECRET || process.env.DEPLOY_SECRET),
        heartbeat_key_set: !!process.env.HEARTBEAT_KEY,
        whatsapp_signature_set: !!process.env.WHATSAPP_APP_SECRET,
        phone_intake_key_set: !!process.env.PHONE_INTAKE_KEY,
        // DATABASE_URL overrides every DB_* variable and caused the 2026-09-07 outage.
        database_url_absent: !process.env.DATABASE_URL,
        platform_admin_two_step: Number(mfa.admins) > 0 && Number(mfa.admins) === Number(mfa.admins_mfa),
        email_alerts_configured: require('../services/notify').isConfigured()
      },
      review: REVIEW
    });
  } catch (err) { next(err); }
}

// ---- Incidents (D5 b, D6) ---------------------------------------------------
const INCIDENT_STATUS = ['open', 'acknowledged', 'closed'];
const INCIDENT_OUTCOME = ['true_positive', 'false_positive', 'benign'];

/** GET /api/security/incidents?status=open|acknowledged|closed|all */
async function incidents(req, res, next) {
  try {
    const status = String(req.query.status || 'active');
    const where = status === 'all' ? '' : status === 'active' ? "WHERE i.status <> 'closed'"
      : INCIDENT_STATUS.includes(status) ? 'WHERE i.status = ?' : "WHERE i.status <> 'closed'";
    const [rows] = await pool.query(
      `SELECT i.id, i.rule_id, i.rule_name, i.severity, i.subject_type, i.subject, i.event_count,
              i.first_seen, i.last_seen, i.summary, i.why, i.status, i.outcome, i.notes,
              i.acknowledged_at, i.closed_at, i.created_at,
              u.username AS subject_username, u.role AS subject_role, s.name AS subject_school
         FROM security_incidents i
         LEFT JOIN users u ON i.subject_type = 'account' AND u.id = CAST(i.subject AS UNSIGNED)
         LEFT JOIN schools s ON s.id = u.school_id
         ${where}
        ORDER BY FIELD(i.status, 'open', 'acknowledged', 'closed'), FIELD(i.severity, 'high', 'medium', 'low', 'info'), i.last_seen DESC
        LIMIT 100`, INCIDENT_STATUS.includes(status) ? [status] : []);
    res.json(rows);
  } catch (err) { next(err); }
}

/** PATCH /api/security/incidents/:id { status, outcome, notes } — closing needs an outcome. */
async function updateIncident(req, res, next) {
  try {
    const { status, outcome, notes } = req.body || {};
    if (!['acknowledged', 'closed'].includes(status)) return res.status(400).json({ error: 'Status must be acknowledged or closed.' });
    if (status === 'closed' && !INCIDENT_OUTCOME.includes(outcome)) {
      return res.status(400).json({ error: 'Closing an incident needs an outcome: true_positive, false_positive or benign.' });
    }
    const [[inc]] = await pool.query('SELECT id, rule_id, status FROM security_incidents WHERE id = ?', [req.params.id]);
    if (!inc) return res.status(404).json({ error: 'Incident not found.' });
    if (inc.status === 'closed') return res.status(409).json({ error: 'This incident is already closed.' });
    if (status === 'acknowledged') {
      await pool.query("UPDATE security_incidents SET status = 'acknowledged', acknowledged_by = ?, acknowledged_at = NOW(), notes = COALESCE(?, notes) WHERE id = ?",
        [req.user.id, notes ? String(notes).slice(0, 2000) : null, inc.id]);
    } else {
      await pool.query("UPDATE security_incidents SET status = 'closed', outcome = ?, closed_by = ?, closed_at = NOW(), notes = COALESCE(?, notes) WHERE id = ?",
        [outcome, req.user.id, notes ? String(notes).slice(0, 2000) : null, inc.id]);
    }
    await logAudit({ actor: req.user, ip: req.ip, action: 'security.incident_' + status, entityType: 'security_incident', entityId: inc.id,
      summary: `${status === 'closed' ? 'Closed' : 'Acknowledged'} incident #${inc.id} (${inc.rule_id})${outcome ? ' as ' + outcome : ''}` });
    res.json({ message: 'Incident updated.' });
  } catch (err) { next(err); }
}

/** GET /api/security/incidents/:id/evidence — the recorded events behind an incident. */
async function incidentEvidence(req, res, next) {
  try {
    const [[inc]] = await pool.query('SELECT subject_type, subject, first_seen, last_seen FROM security_incidents WHERE id = ?', [req.params.id]);
    if (!inc) return res.status(404).json({ error: 'Incident not found.' });
    const col = inc.subject_type === 'account' ? 'user_id' : inc.subject_type === 'address' ? 'source_ip' : null;
    const [rows] = await pool.query(
      `SELECT occurred_at, last_at, event_type, severity, source_ip, user_id, role, method, path_template, status, count, detail
         FROM security_events
        WHERE ${col ? col + ' = ? AND ' : "event_type = 'events.dropped' AND "}
              last_at BETWEEN ? - INTERVAL 1 HOUR AND ? + INTERVAL 5 MINUTE
        ORDER BY last_at DESC LIMIT 200`,
      col ? [col === 'user_id' ? Number(inc.subject) : inc.subject, inc.first_seen, inc.last_seen] : [inc.first_seen, inc.last_seen]);
    res.json(rows);
  } catch (err) { next(err); }
}

module.exports = { overview, incidents, updateIncident, incidentEvidence, REVIEW };
