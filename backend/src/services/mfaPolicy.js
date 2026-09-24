/**
 * Who must use two-step sign-in, and from when (DECISIONS.md D4).
 *
 * The platform admin: one password protects every school, so it is the account
 * that justifies a second factor. From MFA_ENFORCE_ADMIN_AFTER (default: 14 days
 * after the feature shipped) an admin who has not enrolled can reach only the
 * enrolment endpoints — every other request answers 403 MFA_ENROLLMENT_REQUIRED
 * and the app opens the setup screen. Other roles may opt in; nobody else is
 * forced, because school tablets are shared and many teachers have no second device.
 *
 * Pure functions, so the enforcement decision is tested directly (verify-mfa.js)
 * rather than by waiting for a date.
 */
const DEFAULT_ENFORCE_AFTER = '2026-10-08T00:00:00+03:00';   // 14 days from 2026-09-24, East Africa Time
const REQUIRED_ROLES = ['admin'];

// What an admin who must enrol can still do: read and set up two-step sign-in,
// read their profile, and sign out everywhere. Nothing that touches school data.
const ENROLMENT_PATHS = [
  /^\/api\/auth\/mfa\/?$/,
  /^\/api\/auth\/mfa\/(setup|enable)$/,
  /^\/api\/auth\/profile$/,
  /^\/api\/auth\/sessions\/revoke-all$/
];

function enforceAfter() {
  const d = new Date(process.env.MFA_ENFORCE_ADMIN_AFTER || DEFAULT_ENFORCE_AFTER);
  return isNaN(d) ? new Date(DEFAULT_ENFORCE_AFTER) : d;
}

function isRequiredFor(role) { return REQUIRED_ROLES.includes(role); }

/** True when this user must enrol before doing anything else. */
function mustEnrolNow(user, now = new Date(), after = enforceAfter()) {
  return !!user && isRequiredFor(user.role) && !Number(user.mfa_enabled) && now >= after;
}

function isEnrolmentPath(path) {
  const p = String(path || '').split('?')[0];
  return ENROLMENT_PATHS.some(re => re.test(p));
}

module.exports = { enforceAfter, isRequiredFor, mustEnrolNow, isEnrolmentPath, REQUIRED_ROLES, DEFAULT_ENFORCE_AFTER };
