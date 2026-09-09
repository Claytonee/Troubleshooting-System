/**
 * DTO definitions — single source of truth for request shapes and response
 * whitelisting. Human-readable catalog: docs/API_AND_DTO_REFERENCE.md
 *
 * Two parts:
 *  1) REQUEST descriptors — field specs (type/required/enum/validation) used
 *     for documentation and as the contract the express-validator chains mirror.
 *  2) RESPONSE shapers — `pickX(row)` functions that whitelist columns so
 *     controllers never accidentally leak sensitive fields (e.g. password_hash).
 *
 * Shapers are safe to adopt incrementally; existing controllers keep working.
 */

// ----- enums -----
const ROLES = ['admin', 'subadmin', 'school'];
const ERROR_CATEGORIES = ['Connectivity', 'Hardware', 'Platform', 'Power', 'Accounts', 'Other'];
const ERROR_PRIORITIES = ['critical', 'high', 'medium', 'low'];
const ERROR_STATUSES = ['open', 'progress', 'escalated', 'resolved'];
const USER_STATUSES = ['active', 'onsite', 'remote', 'inactive'];
const CHECKIN_STATUSES = ['green', 'amber', 'red'];

// ----- REQUEST descriptors (documentation / contract) -----
const requests = {
  Login: { username: 'string*', password: 'string*' },
  ChangePassword: { current_password: 'string*', new_password: 'string* (min 6)' },

  CreateError: {
    title: 'string*', school_id: 'int*', category: `enum* ${ERROR_CATEGORIES.join('|')}`,
    priority: `enum? ${ERROR_PRIORITIES.join('|')}`, description: 'string?', subcategory: 'string?',
    reporter_name: 'string?', reporter_role: 'string?', reporter_contact: 'string?',
    location: 'string?', affected_devices: 'string?'
  },
  UpdateError: { '...CreateError': true, status: `enum? ${ERROR_STATUSES.join('|')}`, assigned_to: 'int?' },
  UpdateErrorStatus: { status: `enum* ${ERROR_STATUSES.join('|')}` },
  AddErrorUpdate: { note: 'string*', update_type: 'string?', recorded_by: 'string?' },
  Csat: { rating: 'int* (0-5)', comment: 'string?' },

  CreateSchoolAdmin: {
    username: 'string* (min 3)', email: 'email*', full_name: 'string*', school_id: 'int*',
    password: 'string? (default changeme123)', phone: 'string?', color: 'string?',
    title: 'string?', status: `enum? active|inactive`
  },
  UpdateSchoolAdmin: {
    full_name: 'string*', email: 'email?', phone: 'string?', color: 'string?',
    title: 'string?', status: 'enum? active|inactive', school_id: 'int?'
  },
  ResetPassword: { new_password: 'string* (min 6)' },

  CreateTeamMember: {
    username: 'string* (min 3)', email: 'email*', full_name: 'string*',
    password: 'string?', phone: 'string?', zone: 'string?', color: 'string?',
    title: 'string?', status: `enum? ${USER_STATUSES.join('|')}`
  },
  AssignSchools: { school_ids: 'int[]*' },

  AuditFilter: { entity_type: 'string?', action: 'string?', actor_id: 'int?', search: 'string?', limit: 'int? (<=1000)' },

  // --- Feature 1: LRS heartbeat ---
  // Posted by the agent on each school LRS. Authenticated by a shared secret in
  // the X-Heartbeat-Key header, not by a user session, so the body carries only
  // what identifies the box and describes its own health.
  Heartbeat: {
    school_code: 'string* (schools.code)',
    hostname: 'string?',
    ip_address: 'string?',
    agent_version: 'string?',
    uptime_seconds: 'int?',
    disk_free_pct: 'int? (0-100)'
  },
  // Triggered by the cPanel cron job, authenticated by WEBHOOK_SECRET.
  HeartbeatSweep: {}
};

// ----- RESPONSE shapers -----
function pickUser(r) {
  if (!r) return null;
  return {
    id: r.id, username: r.username, email: r.email, full_name: r.full_name, role: r.role,
    phone: r.phone, zone: r.zone, color: r.color, title: r.title, status: r.status, school_id: r.school_id
  };
}

function pickSchoolAdmin(r) {
  if (!r) return null;
  return {
    id: r.id, username: r.username, email: r.email, full_name: r.full_name, phone: r.phone,
    color: r.color, title: r.title, status: r.status, school_id: r.school_id,
    school_name: r.school_name, school_code: r.school_code, school_zone: r.school_zone, created_at: r.created_at
  };
}

/**
 * Age in hours. errors.hours_open is written once at insert and never
 * recomputed, so the queries serve a derived value as hours_open_live; prefer
 * it and fall back to the column only for callers that do not select it.
 */
function ageHours(r) {
  return r.hours_open_live != null ? Number(r.hours_open_live) : r.hours_open;
}

/**
 * An error as the list endpoints serve it. Deliberately omits csat_token — the
 * list has no use for it and would hand out one live feedback capability per
 * row — along with the internal columns nothing in the frontend reads
 * (sla_breach_notified, escalated_by, reported_by_user_id).
 */
function pickError(r) {
  if (!r) return null;
  return {
    id: r.id, error_code: r.error_code, title: r.title, description: r.description,
    school_id: r.school_id, school_name: r.school_name, school_code: r.school_code, school_zone: r.school_zone,
    category: r.category, subcategory: r.subcategory, priority: r.priority, status: r.status,
    assigned_to: r.assigned_to, assigned_name: r.assigned_name, assigned_color: r.assigned_color,
    reporter_name: r.reporter_name, reporter_role: r.reporter_role, reporter_contact: r.reporter_contact,
    location: r.location, affected_devices: r.affected_devices, hours_open: ageHours(r),
    sla_due_at: r.sla_due_at, sla_breached: r.sla_breached, first_response_at: r.first_response_at,
    escalation_level: r.escalation_level, escalated_at: r.escalated_at,
    intake_channel: r.intake_channel, auto_source: r.auto_source,
    csat_rating: r.csat_rating, csat_comment: r.csat_comment,
    resolved_at: r.resolved_at, created_at: r.created_at, updated_at: r.updated_at
  };
}

/**
 * Who may rate a resolution: the person who reported it, and their school's
 * administrator. Nobody else — a satisfaction score is the school's answer to
 * "was this actually fixed", and a platform admin rating their own team's work
 * is not feedback, it is marking your own homework (user instruction,
 * 2026-09-09).
 */
function canRateError(row, viewer) {
  if (!row || !viewer) return false;
  if (viewer.role === 'teacher') return row.reported_by_user_id === viewer.id;
  if (viewer.role === 'school') return row.school_id === viewer.school_id;
  return false;
}

/**
 * The detail view additionally needs csat_token: ErrorDetailModal renders the
 * in-app star rating from it. That is the one intentional difference from the
 * list shape — and it is handed out only to a viewer who may actually rate,
 * because the token IS the capability: /api/errors/csat/:token takes no auth.
 */
function pickErrorDetail(r, viewer) {
  if (!r) return null;
  const base = pickError(r);
  return canRateError(r, viewer)
    ? { ...base, csat_token: r.csat_token, can_rate: true }
    : { ...base, can_rate: false };
}

/**
 * An LRS device. Field list checked against frontend/js/pages/lrs.js — every
 * one of these is read by that page — plus the heartbeat state from feature 1.
 */
function pickLrsDevice(r) {
  if (!r) return null;
  return {
    id: r.id, school_id: r.school_id, school_name: r.school_name, school_zone: r.school_zone,
    asset_tag: r.asset_tag, hostname: r.hostname, serial_number: r.serial_number,
    device_model: r.device_model, ip_address: r.ip_address, mac_address: r.mac_address,
    port: r.port, connection_type: r.connection_type, os_version: r.os_version,
    lrs_version: r.lrs_version, storage_gb: r.storage_gb, ram_gb: r.ram_gb,
    power_type: r.power_type, status: r.status, sync_status: r.sync_status,
    last_sync: r.last_sync, records_pending: r.records_pending, uptime_hours: r.uptime_hours,
    notes: r.notes, installed_at: r.installed_at,
    last_heartbeat: r.last_heartbeat, heartbeat_state: r.heartbeat_state,
    heartbeat_agent_version: r.heartbeat_agent_version,
    heartbeat_disk_free_pct: r.heartbeat_disk_free_pct,
    minutes_since_heartbeat: r.minutes_since_heartbeat == null ? null : Number(r.minutes_since_heartbeat),
    created_at: r.created_at, updated_at: r.updated_at
  };
}

function pickAuditEntry(r) {
  if (!r) return null;
  return {
    id: r.id, actor_id: r.actor_id, actor_name: r.actor_name, actor_role: r.actor_role,
    action: r.action, entity_type: r.entity_type, entity_id: r.entity_id,
    summary: r.summary, meta: r.meta, created_at: r.created_at
  };
}

module.exports = {
  enums: { ROLES, ERROR_CATEGORIES, ERROR_PRIORITIES, ERROR_STATUSES, USER_STATUSES, CHECKIN_STATUSES },
  requests,
  shapers: { pickUser, pickSchoolAdmin, pickError, pickErrorDetail, pickLrsDevice, pickAuditEntry, canRateError }
};
