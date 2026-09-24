const bcrypt = require('bcryptjs');
const pool = require('../config/database');

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
  scope: 'Whole application: 142 API endpoints, 4 roles, every page that renders stored data',
  findings: [
    { id: 'SEC-001', severity: 'P1', status: 'fixed', title: 'Any signed-in user could attach files to another school\'s fault' },
    { id: 'SEC-002', severity: 'P2', status: 'fixed', title: 'School forms, and a field engineer\'s school detail, were not scoped' },
    { id: 'SEC-003', severity: 'P1', status: 'fixed', title: 'Stored text could run as script in a platform admin\'s browser' },
    { id: 'SEC-004', severity: 'P2', status: 'fixed', title: 'A field engineer could write for schools not assigned to them' },
    { id: 'SEC-005', severity: 'P2', status: 'open', title: 'Sign-in tokens cannot be revoked before they expire (7 days)' },
    { id: 'SEC-006', severity: 'P2', status: 'open', title: 'Failed sign-ins and refused requests are not recorded' },
    { id: 'SEC-007', severity: 'P2', status: 'open', title: 'No second factor on platform admin sign-in' },
    { id: 'SEC-008', severity: 'P3', status: 'open', title: 'Public appeal and teacher-status endpoints accept guessable input' },
    { id: 'SEC-009', severity: 'P3', status: 'open', title: 'Password throttle is per account per network, not per account' },
    { id: 'SEC-010', severity: 'P3', status: 'open', title: 'Fault attachments allow up to 5 × 100 MB held in memory' }
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
      audit: { events_last_30_days: Number(audit.last_30_days), latest_event_at: audit.latest },
      // Signals the system does not collect yet. Planned in the Security Center
      // phase (docs/engineering/security-program/SECURITY_DESIGN.md).
      not_collected: [
        { signal: 'failed_sign_ins', why: 'Failed sign-ins are throttled but not recorded (SEC-006).' },
        { signal: 'refused_requests', why: 'Requests refused for role or school are answered 403 but not recorded (SEC-006).' }
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
        email_alerts_configured: require('../services/notify').isConfigured()
      },
      review: REVIEW
    });
  } catch (err) { next(err); }
}

module.exports = { overview, REVIEW };
