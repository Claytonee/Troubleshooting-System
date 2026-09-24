# API security matrix

Generated from the router source on 2026-09-24 (`routes/*.js` + `server.js`), then annotated by hand.
**143 endpoints.** "Role gate" is what the router enforces; per-record school scoping lives in the
controllers and is listed in *Notes* where it was audited or changed. Regenerate the first four columns
rather than editing them.

Auth: `JWT` = `authenticate()` (signature + account status re-read per request). `key:` = shared secret header.

| Method | Route | Auth | Role gate | Notes |
|---|---|---|---|---|
| POST | `/api/ai/chat` | JWT | subadmin,school,teacher |  |
| GET | `/api/ai/chats` | JWT | subadmin,school,teacher |  |
| DELETE | `/api/ai/chats/:id` | JWT | subadmin,school,teacher |  |
| GET | `/api/ai/chats/:id` | JWT | subadmin,school,teacher |  |
| GET | `/api/ai/status` | JWT | subadmin,school,teacher |  |
| GET | `/api/analytics/trends` | JWT | admin,subadmin,school |  |
| GET | `/api/audit` | JWT | admin |  |
| PUT | `/api/auth/change-password` | JWT | any signed-in | Ends every other session; returns a fresh token for this device (SEC-005). |
| POST | `/api/auth/login` | — | public | Throttled: 20/account+network, 120/network per 15 min. Failures not recorded (SEC-006). |
| GET | `/api/auth/profile` | JWT | any signed-in |  |
| PUT | `/api/auth/profile` | JWT | any signed-in |  |
| POST | `/api/auth/profile/avatar` | JWT | any signed-in |  |
| POST | `/api/auth/register` | JWT | admin |  |
| POST | `/api/auth/sessions/revoke-all` | JWT | any signed-in | New (SEC-005): bumps the caller's own token_version only — no id in the request, so it cannot touch another account. |
| GET | `/api/checkins` | JWT | admin,subadmin,school |  |
| POST | `/api/checkins` | JWT | admin,subadmin,school | SEC-003/004 fixed: enum fields validated; subadmin scoped. |
| GET | `/api/checkins/school/:schoolId` | JWT | admin,subadmin,school |  |
| GET | `/api/checkins/stats` | JWT | admin,subadmin,school |  |
| GET | `/api/communications` | JWT | admin,subadmin,school |  |
| POST | `/api/communications` | JWT | admin,subadmin,school | SEC-004 fixed: canActOnSchool. |
| DELETE | `/api/communications/:id` | JWT | admin,subadmin | SEC-004 fixed: canActOnSchool on the row's school. |
| GET | `/api/dashboard` | JWT | any signed-in |  |
| POST | `/api/deploy` | HMAC: WEBHOOK_SECRET | GitHub webhook | HMAC over body, timing-safe; refuses when secret unset; fast-forward only. |
| GET | `/api/errors` | JWT | any signed-in |  |
| POST | `/api/errors` | JWT | any signed-in |  |
| DELETE | `/api/errors/:id` | JWT | admin |  |
| GET | `/api/errors/:id` | JWT | any signed-in |  |
| PUT | `/api/errors/:id` | JWT | admin,subadmin | SEC-003 fixed: category/priority/status validated. |
| PATCH | `/api/errors/:id/assign` | JWT | admin |  |
| POST | `/api/errors/:id/attachments` | JWT | any signed-in | SEC-001 fixed 2026-09-24: userCanAccessError before files. |
| POST | `/api/errors/:id/escalate` | JWT | school,teacher |  |
| PATCH | `/api/errors/:id/status` | JWT | any signed-in |  |
| POST | `/api/errors/:id/updates` | JWT | any signed-in |  |
| POST | `/api/errors/csat/:token` | — | public | Capability token (128-bit random) issued only to the reporter / school admin. |
| GET | `/api/errors/export` | JWT | admin,subadmin |  |
| GET | `/api/errors/stats` | JWT | any signed-in |  |
| GET | `/api/guides` | JWT | any signed-in |  |
| POST | `/api/guides` | JWT | admin |  |
| DELETE | `/api/guides/:id` | JWT | admin |  |
| GET | `/api/guides/:id` | JWT | any signed-in |  |
| PUT | `/api/guides/:id` | JWT | admin |  |
| POST | `/api/guides/:id/escalate` | JWT | any signed-in |  |
| POST | `/api/guides/:id/helped` | JWT | any signed-in |  |
| GET | `/api/guides/performance` | JWT | admin |  |
| GET | `/api/guides/suggest` | JWT | any signed-in |  |
| GET | `/api/health` | — | public |  |
| POST | `/api/heartbeat` | key: HEARTBEAT_KEY | public |  |
| POST | `/api/heartbeat/sweep` | key: WEBHOOK_SECRET | public |  |
| GET | `/api/inventory` | JWT | any signed-in |  |
| POST | `/api/inventory` | JWT | inventory-write capability |  |
| DELETE | `/api/inventory/:id` | JWT | admin,subadmin |  |
| GET | `/api/inventory/:id` | JWT | any signed-in |  |
| PUT | `/api/inventory/:id` | JWT | inventory-write capability |  |
| PATCH | `/api/inventory/:id/assign` | JWT | inventory-write capability |  |
| PATCH | `/api/inventory/:id/spare` | JWT | inventory-write capability |  |
| PATCH | `/api/inventory/:id/status` | JWT | inventory-write capability |  |
| POST | `/api/inventory/:id/swap` | JWT | inventory-write capability |  |
| GET | `/api/inventory/batches` | JWT | any signed-in |  |
| POST | `/api/inventory/bulk-import` | JWT | inventory-write capability |  |
| GET | `/api/inventory/export` | JWT | any signed-in |  |
| GET | `/api/inventory/refresh-plan` | JWT | any signed-in |  |
| GET | `/api/inventory/spares` | JWT | any signed-in |  |
| GET | `/api/inventory/stats` | JWT | any signed-in |  |
| GET | `/api/lrs` | JWT | admin |  |
| POST | `/api/lrs` | JWT | admin |  |
| DELETE | `/api/lrs/:id` | JWT | admin |  |
| GET | `/api/lrs/:id` | JWT | admin |  |
| PUT | `/api/lrs/:id` | JWT | admin |  |
| PATCH | `/api/lrs/:id/status` | JWT | admin |  |
| GET | `/api/lrs/stats` | JWT | admin |  |
| POST | `/api/maintenance/:taskId/done` | JWT | admin,subadmin,school |  |
| GET | `/api/maintenance/due` | JWT | any signed-in |  |
| GET | `/api/maintenance/tasks` | JWT | any signed-in |  |
| GET | `/api/manuals` | JWT | any signed-in |  |
| POST | `/api/manuals` | JWT | admin |  |
| DELETE | `/api/manuals/:id` | JWT | admin |  |
| GET | `/api/manuals/:id/download` | JWT | any signed-in |  |
| POST | `/api/manuals/link` | JWT | admin |  |
| POST | `/api/register/appeal` | — | public | Guessable sequential request_id reopens a rejected request (SEC-008). |
| GET | `/api/register/approvals` | JWT | admin |  |
| GET | `/api/register/approvals/:id` | JWT | admin |  |
| POST | `/api/register/approvals/:id/approve` | JWT | admin |  |
| POST | `/api/register/approvals/:id/reject` | JWT | admin |  |
| GET | `/api/register/approvals/appeals` | JWT | admin |  |
| GET | `/api/register/approvals/pending` | JWT | admin |  |
| POST | `/api/register/school-admin` | — | public | 5 per 15 min per IP. |
| GET | `/api/register/schools-list` | — | public |  |
| GET | `/api/register/status/:id` | — | public | Needs id AND email; never mints a token. |
| POST | `/api/register/teacher-approvals/:id/approve` | JWT | school |  |
| POST | `/api/register/teacher-approvals/:id/reject` | JWT | school |  |
| GET | `/api/register/teacher-approvals/pending` | JWT | school |  |
| GET | `/api/register/teacher-links` | JWT | school |  |
| POST | `/api/register/teacher-links` | JWT | school |  |
| DELETE | `/api/register/teacher-links/:id` | JWT | school |  |
| PATCH | `/api/register/teacher-links/:id` | JWT | school |  |
| POST | `/api/register/teacher-status` | — | public | Confirms whether an email belongs to a teacher; returns rejection reason (SEC-008). |
| POST | `/api/register/teacher/:token` | — | public | Link token + max_uses cap; 5 per 15 min per IP. |
| GET | `/api/register/teachers` | JWT | school |  |
| POST | `/api/register/teachers` | JWT | school |  |
| DELETE | `/api/register/teachers/:id` | JWT | school |  |
| GET | `/api/register/teachers/:id` | JWT | school |  |
| PUT | `/api/register/teachers/:id` | JWT | school |  |
| PATCH | `/api/register/teachers/:id/inventory-access` | JWT | school |  |
| PATCH | `/api/register/teachers/:id/status` | JWT | school |  |
| GET | `/api/register/verify/:token` | — | public | Link token. |
| GET | `/api/school-admins` | JWT | admin |  |
| POST | `/api/school-admins` | JWT | admin |  |
| DELETE | `/api/school-admins/:id` | JWT | admin |  |
| GET | `/api/school-admins/:id` | JWT | admin |  |
| PUT | `/api/school-admins/:id` | JWT | admin |  |
| PATCH | `/api/school-admins/:id/password` | JWT | admin |  |
| GET | `/api/schools` | JWT | admin,subadmin,school |  |
| POST | `/api/schools` | JWT | admin |  |
| DELETE | `/api/schools/:id` | JWT | admin |  |
| GET | `/api/schools/:id` | JWT | admin,subadmin,school | SEC-002 fixed: canActOnSchool (subadmin scoped). |
| PUT | `/api/schools/:id` | JWT | admin,school |  |
| PATCH | `/api/schools/:id/assign` | JWT | admin |  |
| GET | `/api/schools/:id/forms` | JWT | admin,subadmin,school | SEC-002 fixed: canActOnSchool. |
| PUT | `/api/schools/:id/forms` | JWT | admin,school |  |
| POST | `/api/schools/bulk-import` | JWT | admin |  |
| GET | `/api/schools/notifications` | JWT | admin,subadmin,school |  |
| PATCH | `/api/schools/notifications/:id/read` | JWT | admin,subadmin,school | Subadmin may mark any notification read (P3, not yet registered as a vuln — no data exposed). |
| GET | `/api/search` | JWT | any signed-in |  |
| GET | `/api/security/overview` | JWT | admin | New. Booleans and counts only; asserted to leak no secret. |
| GET | `/api/settings` | — | public | Branding keys only (settings table holds nothing else). |
| PUT | `/api/settings` | JWT | admin |  |
| POST | `/api/sms/inbound` | — | public | Shared key PHONE_INTAKE_KEY checked in handler; fails closed. |
| GET | `/api/team` | JWT | admin |  |
| POST | `/api/team` | JWT | admin |  |
| DELETE | `/api/team/:id` | JWT | admin |  |
| GET | `/api/team/:id` | JWT | admin |  |
| PUT | `/api/team/:id` | JWT | admin |  |
| PATCH | `/api/team/:id/reset-password` | JWT | admin |  |
| PATCH | `/api/team/:id/schools` | JWT | admin |  |
| POST | `/api/ussd` | — | public | Shared key PHONE_INTAKE_KEY checked in handler; fails closed. |
| GET | `/api/visits` | JWT | admin,subadmin |  |
| POST | `/api/visits` | JWT | admin,subadmin |  |
| GET | `/api/visits/:id` | JWT | admin,subadmin |  |
| PATCH | `/api/visits/:id` | JWT | admin,subadmin |  |
| GET | `/api/visits/queue` | JWT | admin,subadmin |  |
| GET | `/api/visits/suggestions/:schoolId` | JWT | admin,subadmin |  |
| GET | `/api/whatsapp/webhook` | — | public | WHATSAPP_VERIFY_TOKEN handshake. |
| POST | `/api/whatsapp/webhook` | — | public | HMAC-SHA256 over raw body (WHATSAPP_APP_SECRET), timing-safe; fails closed. |

## Public surface (no JWT)

18 endpoints take no session. Each one either needs a shared secret / capability
token or is deliberately public (login, registration, branding, health). All are listed above with how they are protected.
