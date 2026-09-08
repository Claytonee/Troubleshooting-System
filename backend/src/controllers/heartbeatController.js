/**
 * LRS heartbeat — proactive outage detection.
 * Design and thresholds: docs/features/01-lrs-heartbeat.md
 *
 * Two endpoints:
 *  - POST /api/heartbeat        the agent on each school LRS, every 5 minutes
 *  - POST /api/heartbeat/sweep  a cPanel cron job, every 5 minutes
 *
 * The LRS pushes outward rather than the server polling schools.lrs_ip: those
 * are private LAN addresses behind school NAT and unreachable from the host.
 * A dead uplink and a dead box therefore look the same, which is right — from
 * the school's point of view both mean "no Quest".
 */
const crypto = require('crypto');
const pool = require('../config/database');
const { SLA_TARGET_HOURS } = require('../config/schemaExtensions');
const notify = require('../services/notify');
const sms = require('../services/sms');
const { logAudit } = require('../services/audit');

const {
  BEAT_MINUTES, MISSED_BEATS_TO_OPEN, DOWN_AFTER_MINUTES, HEARTBEAT_SOURCE
} = require('../config/monitoring');

const sourceKey = deviceId => `${HEARTBEAT_SOURCE}:${deviceId}`;

/** Constant-time compare that tolerates differing lengths. */
function secretMatches(provided, expected) {
  if (!provided || !expected) return false;
  const a = Buffer.from(String(provided));
  const b = Buffer.from(String(expected));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Shared-secret guard. With no secret configured the endpoint refuses rather
 * than accepting anonymous posts — the same stance /api/deploy takes.
 */
function requireSecret(envName, headerName) {
  return (req, res, next) => {
    const expected = process.env[envName];
    if (!expected) {
      return res.status(503).json({ error: `Not configured: set ${envName} to enable this endpoint.` });
    }
    if (!secretMatches(req.get(headerName), expected)) {
      return res.status(401).json({ error: 'Invalid or missing credentials.' });
    }
    next();
  };
}

/**
 * POST /api/heartbeat — "I am alive".
 *
 * Identified by schools.code because the agent is installed per school and
 * lrs_devices has a unique key on school_id. Only ever updates; a school with
 * no LRS row recorded is reported back so the mismatch is visible rather than
 * silently creating half-populated inventory.
 */
async function receive(req, res, next) {
  try {
    const { school_code, hostname, ip_address, agent_version, uptime_seconds, disk_free_pct } = req.body || {};
    if (!school_code) return res.status(400).json({ error: 'school_code is required.' });

    const [schools] = await pool.query('SELECT id, name FROM schools WHERE code = ?', [String(school_code).trim()]);
    if (!schools.length) return res.status(404).json({ error: 'Unknown school_code.' });
    const school = schools[0];

    const [devices] = await pool.query(
      'SELECT id, status, last_heartbeat, heartbeat_missed_since FROM lrs_devices WHERE school_id = ?', [school.id]
    );
    if (!devices.length) {
      return res.status(404).json({ error: 'No LRS device recorded for this school. Add it under LRS Inventory first.' });
    }
    const device = devices[0];

    const uptimeHours = Number.isFinite(Number(uptime_seconds))
      ? Math.floor(Number(uptime_seconds) / 3600) : null;
    const diskPct = Number.isFinite(Number(disk_free_pct))
      ? Math.max(0, Math.min(100, Math.round(Number(disk_free_pct)))) : null;

    await pool.query(
      `UPDATE lrs_devices SET
         last_heartbeat = NOW(),
         heartbeat_missed_since = NULL,
         status = 'Online',
         hostname = COALESCE(?, hostname),
         ip_address = COALESCE(?, ip_address),
         heartbeat_agent_version = COALESCE(?, heartbeat_agent_version),
         uptime_hours = COALESCE(?, uptime_hours),
         heartbeat_disk_free_pct = COALESCE(?, heartbeat_disk_free_pct)
       WHERE id = ?`,
      [hostname || null, ip_address || null, agent_version || null, uptimeHours, diskPct, device.id]
    );

    // Recovery: close whatever this device opened while it was silent.
    const recovered = await closeAutoError(device.id, school, device.heartbeat_missed_since);

    res.json({
      ok: true,
      school: school.name,
      device_id: device.id,
      recovered_error: recovered ? recovered.error_code : null,
      next_expected_within_minutes: DOWN_AFTER_MINUTES
    });
  } catch (err) { next(err); }
}

/** Resolves the auto-opened error for a device, if one is open. */
async function closeAutoError(deviceId, school, missedSince) {
  const [open] = await pool.query(
    `SELECT id, error_code FROM errors WHERE auto_source = ? AND status <> 'resolved' ORDER BY id DESC LIMIT 1`,
    [sourceKey(deviceId)]
  );
  if (!open.length) return null;
  const e = open[0];

  const downFor = missedSince
    ? `after ${Math.max(1, Math.round((Date.now() - new Date(missedSince).getTime()) / 60000))} minutes of silence`
    : 'after a period of silence';

  await pool.query('UPDATE errors SET status = ?, resolved_at = NOW() WHERE id = ?', ['resolved', e.id]);
  await pool.query(
    'INSERT INTO error_updates (error_id, update_type, note, recorded_by) VALUES (?, ?, ?, ?)',
    [e.id, 'auto_recovery', `LRS at ${school.name} resumed reporting ${downFor}. Closed automatically.`, 'System monitor']
  );
  await logAudit({
    actor: { id: null, full_name: 'System monitor', role: 'system' },
    action: 'error.auto_resolved', entityType: 'error', entityId: e.id,
    summary: `${e.error_code}: LRS at ${school.name} recovered`,
    meta: { source: sourceKey(deviceId) }
  }).catch(err => console.error('[heartbeat] audit failed:', err.message));
  return e;
}

/**
 * POST /api/heartbeat/sweep — find silent devices and open tickets for them.
 *
 * An endpoint rather than an in-process timer: Passenger recycles the app on
 * shared hosting, so setInterval is not a schedule (ROADMAP_AND_DESIGN.md §5).
 * Idempotent — a double fire opens nothing extra.
 */
async function sweep(req, res, next) {
  try {
    // Never reported at all => 'unknown', not down. A school without the agent
    // installed must not manufacture tickets.
    const [silent] = await pool.query(
      `SELECT d.id, d.school_id, d.hostname, d.ip_address, d.last_heartbeat, d.heartbeat_missed_since,
              s.name AS school_name, s.code AS school_code, s.assigned_admin_id,
              TIMESTAMPDIFF(MINUTE, d.last_heartbeat, NOW()) AS silent_minutes
       FROM lrs_devices d
       JOIN schools s ON d.school_id = s.id
       WHERE d.last_heartbeat IS NOT NULL
         AND d.last_heartbeat < DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
      [DOWN_AFTER_MINUTES]
    );

    const opened = [];
    for (const d of silent) {
      if (!d.heartbeat_missed_since) {
        await pool.query('UPDATE lrs_devices SET heartbeat_missed_since = last_heartbeat WHERE id = ?', [d.id]);
      }
      await pool.query("UPDATE lrs_devices SET status = 'Offline' WHERE id = ? AND status <> 'Offline'", [d.id]);

      // Dedup: at most one open auto-error per device.
      const [existing] = await pool.query(
        `SELECT id FROM errors WHERE auto_source = ? AND status <> 'resolved' LIMIT 1`, [sourceKey(d.id)]
      );
      if (existing.length) continue;

      const created = await openOutageError(d);
      if (created) opened.push(created);
    }

    res.json({
      ok: true,
      threshold_minutes: DOWN_AFTER_MINUTES,
      silent_devices: silent.length,
      errors_opened: opened.length,
      opened
    });
  } catch (err) { next(err); }
}

/** Opens one CRITICAL connectivity error for a silent LRS and notifies. */
async function openOutageError(d) {
  const [[{ maxnum }]] = await pool.query(
    "SELECT MAX(CAST(SUBSTRING(error_code, 5) AS UNSIGNED)) AS maxnum FROM errors WHERE error_code LIKE 'QFT-%'"
  );
  const errorCode = `QFT-0${(maxnum || 240) + 1}`;
  const slaHours = SLA_TARGET_HOURS.critical;
  const silentFor = d.silent_minutes == null ? DOWN_AFTER_MINUTES : d.silent_minutes;

  const description =
    `Detected automatically: the LRS at ${d.school_name} has not reported in for ${silentFor} minutes ` +
    `(expected every ${BEAT_MINUTES} minutes). Last contact ${d.last_heartbeat ? new Date(d.last_heartbeat).toISOString().slice(0, 16).replace('T', ' ') : 'unknown'} UTC.\n\n` +
    `This means either the LRS itself is down or the school has lost its internet uplink — from the classroom both look the same: Quest will not load.\n\n` +
    `Device: ${d.hostname || 'hostname not recorded'} at ${d.ip_address || 'IP not recorded'}.\n` +
    `No one at the school has necessarily noticed yet. This ticket closes itself when the LRS reports in again.`;

  const [result] = await pool.query(
    `INSERT INTO errors
       (error_code, title, description, school_id, category, subcategory, priority, status,
        assigned_to, reporter_name, reporter_role, location, sla_due_at, escalation_level, auto_source)
     VALUES (?, ?, ?, ?, 'Connectivity', 'LRS unreachable', 'critical', 'open',
        ?, 'System monitor', 'Automated detection', ?, DATE_ADD(NOW(), INTERVAL ? HOUR), 'platform', ?)`,
    [errorCode, `LRS unreachable — ${d.school_name}`, description, d.school_id,
     d.assigned_admin_id || null, d.hostname || null, slaHours, sourceKey(d.id)]
  );
  const errorId = result.insertId;

  await pool.query(
    'INSERT INTO lrs_history (lrs_id, action, old_value, new_value, actor_name, note) VALUES (?, ?, ?, ?, ?, ?)',
    [d.id, 'heartbeat_lost', 'Online', 'Offline', 'System monitor',
     `No heartbeat for ${silentFor} minutes. Opened ${errorCode}.`]
  ).catch(e => console.error('[heartbeat] lrs_history insert failed:', e.message));

  await logAudit({
    actor: { id: null, full_name: 'System monitor', role: 'system' },
    action: 'error.auto_created', entityType: 'error', entityId: errorId,
    summary: `${errorCode}: LRS at ${d.school_name} unreachable for ${silentFor}m`,
    meta: { source: sourceKey(d.id), silent_minutes: silentFor }
  }).catch(err => console.error('[heartbeat] audit failed:', err.message));

  // Notify the assigned engineer. Both channels no-op when unconfigured.
  const row = { id: errorId, error_code: errorCode, title: `LRS unreachable — ${d.school_name}`,
                priority: 'critical', school_name: d.school_name, status: 'open' };
  if (d.assigned_admin_id) {
    const [contacts] = await pool.query('SELECT email, phone FROM users WHERE id = ?', [d.assigned_admin_id]);
    const c = contacts[0] || {};
    if (c.email) await notify.notifyErrorEvent('created', row, { recipients: [c.email] })
      .catch(e => console.error('[heartbeat] email notify failed:', e.message));
    if (c.phone) await sms.notifyErrorSms('created', row, { phones: [c.phone] })
      .catch(e => console.error('[heartbeat] sms notify failed:', e.message));
  }

  return { error_code: errorCode, error_id: errorId, school: d.school_name, silent_minutes: silentFor };
}

module.exports = {
  receive,
  sweep,
  requireSecret,
  constants: { BEAT_MINUTES, MISSED_BEATS_TO_OPEN, DOWN_AFTER_MINUTES, HEARTBEAT_SOURCE }
};
