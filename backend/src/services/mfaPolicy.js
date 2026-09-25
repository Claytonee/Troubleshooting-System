/**
 * Who must use two-step sign-in, and from when (DECISIONS.md D4, D32).
 *
 * Every staff account: the platform admin (one password protects every school),
 * field engineers, school admins and teachers. Two-step sign-in is also what lets
 * a person recover a forgotten password without anyone's help (D32), so it is
 * required of everyone who can sign in.
 *
 * Each group has a date. Before it, the app asks at every sign-in and "Not now"
 * is allowed. From it, an account that has not enrolled can reach only the
 * enrolment endpoints — every other request answers 403 MFA_ENROLLMENT_REQUIRED
 * and the app opens the setup screen.
 *   platform admin      MFA_ENFORCE_ADMIN_AFTER  (default 2026-10-08)
 *   everyone else       MFA_ENFORCE_STAFF_AFTER  (default 2026-10-09)
 * The staff date is two weeks from D32 so teachers can move the authenticator to
 * a phone of their own: a shared school tablet is not a second factor.
 *
 * Pure functions, so the enforcement decision is tested directly (verify-mfa.js)
 * rather than by waiting for a date.
 */
const DEFAULT_ENFORCE_AFTER = '2026-10-08T00:00:00+03:00';        // 14 days from 2026-09-24, East Africa Time
const DEFAULT_STAFF_ENFORCE_AFTER = '2026-10-09T00:00:00+03:00';  // 14 days from 2026-09-25, East Africa Time
const REQUIRED_ROLES = ['admin', 'subadmin', 'school', 'teacher'];

// What an account that must enrol can still do: read and set up two-step sign-in,
// read their profile, and sign out everywhere. Nothing that touches school data.
const ENROLMENT_PATHS = [
  /^\/api\/auth\/mfa\/?$/,
  /^\/api\/auth\/mfa\/(setup|enable)$/,
  /^\/api\/auth\/profile$/,
  /^\/api\/auth\/sessions\/revoke-all$/
];

function dateFrom(value, fallback) {
  const d = new Date(value || fallback);
  return isNaN(d) ? new Date(fallback) : d;
}

/** The enforcement date for a role; the platform admin's date when no role is given. */
function enforceAfter(role = 'admin') {
  return role === 'admin'
    ? dateFrom(process.env.MFA_ENFORCE_ADMIN_AFTER, DEFAULT_ENFORCE_AFTER)
    : dateFrom(process.env.MFA_ENFORCE_STAFF_AFTER, DEFAULT_STAFF_ENFORCE_AFTER);
}

function isRequiredFor(role) { return REQUIRED_ROLES.includes(role); }

/** True when this user must enrol before doing anything else. */
function mustEnrolNow(user, now = new Date(), after = user && enforceAfter(user.role)) {
  return !!user && isRequiredFor(user.role) && !Number(user.mfa_enabled) && now >= after;
}

function isEnrolmentPath(path) {
  const p = String(path || '').split('?')[0];
  return ENROLMENT_PATHS.some(re => re.test(p));
}

module.exports = {
  enforceAfter, isRequiredFor, mustEnrolNow, isEnrolmentPath,
  REQUIRED_ROLES, DEFAULT_ENFORCE_AFTER, DEFAULT_STAFF_ENFORCE_AFTER
};
