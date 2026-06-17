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

  AuditFilter: { entity_type: 'string?', action: 'string?', actor_id: 'int?', search: 'string?', limit: 'int? (<=1000)' }
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

function pickError(r) {
  if (!r) return null;
  return {
    id: r.id, error_code: r.error_code, title: r.title, description: r.description,
    school_id: r.school_id, school_name: r.school_name, school_code: r.school_code, school_zone: r.school_zone,
    category: r.category, subcategory: r.subcategory, priority: r.priority, status: r.status,
    assigned_to: r.assigned_to, assigned_name: r.assigned_name, assigned_color: r.assigned_color,
    reporter_name: r.reporter_name, reporter_role: r.reporter_role, reporter_contact: r.reporter_contact,
    location: r.location, affected_devices: r.affected_devices, hours_open: r.hours_open,
    sla_due_at: r.sla_due_at, sla_breached: r.sla_breached, first_response_at: r.first_response_at,
    csat_rating: r.csat_rating, csat_comment: r.csat_comment,
    resolved_at: r.resolved_at, created_at: r.created_at, updated_at: r.updated_at
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
  shapers: { pickUser, pickSchoolAdmin, pickError, pickAuditEntry }
};
