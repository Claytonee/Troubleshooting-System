# Issue register — security programme

Every material finding, with the evidence that it was real and the evidence that it is fixed.
Priorities: **P0** critical · **P1** high · **P2** medium · **P3** low. Nothing here is inflated:
a P1 is a finding with a working path from a real, low-privileged role to someone else's data
or session.

The Security Overview page (`#security`) shows the `SEC-*` rows of this file.
`backend/scripts/verify-security-boundaries.js` fails if the page lists an id this file lacks.

| ID | Pri | Status | Module | Title |
|---|---|---|---|---|
| SEC-001 | P1 | **Fixed** 2026-09-24 | Faults | Any signed-in user could attach files to any school's fault |
| SEC-002 | P2 | **Fixed** 2026-09-24 | Schools | School forms unscoped; field engineer's school detail unscoped |
| SEC-003 | P1 | **Fixed** 2026-09-24 | LRS, Inventory, Check-ins, Faults, Registration | Stored XSS into a platform admin's session |
| SEC-004 | P2 | **Fixed** 2026-09-24 | Check-ins, Communications | Field engineer writes for schools not assigned to them |
| SEC-005 | P2 | Open | Auth | A JWT cannot be revoked before it expires |
| SEC-006 | P2 | **Fixed** 2026-09-24 | Auth, all | Failed sign-ins and 401/403 refusals were not recorded |
| SEC-007 | P2 | Open | Auth | No second factor for platform admin |
| SEC-008 | P3 | Open | Registration | Public appeal and teacher-status endpoints accept guessable input |
| SEC-009 | P3 | Open | Auth | Login throttle is per account **per network** |
| SEC-010 | P3 | Open | Faults | Attachments: 5 × 100 MB held in memory, any signed-in user |
| OPS-001 | P2 | **Fixed** 2026-09-24 (verify on next deploy) | Deploy | A deploy left the old process serving next to new files until a manual restart |
| INT-001 | P3 | Open | Faults | Fault codes reissued after deletion; race can duplicate them |
| TEST-001 | P2 | **Fixed** 2026-09-24 | Test harness | `verify-heartbeat.js` swept every real LRS device, and its cleanup deleted rows it did not create |

---

## SEC-001 — Any signed-in user could attach files to any school's fault · P1 · Fixed

- **Route:** `POST /api/errors/:id/attachments`
- **Root cause:** `addAttachments()` looked the fault up by id and uploaded. It was the only
  write on the faults router that never called `userCanAccessError()`; every sibling
  (`PUT`, `PATCH /status`, `POST /updates`, `GET /:id`) did. Checking for files *before* the
  fault also hid the gap behind a 400.
- **Impact:** a teacher at school A attaches files — any allowed type, up to 5 × 100 MB — to
  a fault at school B. Fault ids are sequential. The files appear in school B's fault
  modal, for school B's admin, its engineer and head office: planted content in front of
  exactly the people who act on it. OWASP API1:2023 (BOLA).
- **Reproduction (safe):** send the request with **no file**. Unpatched it answers
  `400 No files uploaded` — it got past authorisation; with a file it would have uploaded
  to the live Cloudinary account, so the suite never sends one.
- **Evidence (before):** teacher, school admin and unassigned field engineer each got 400
  on another school's fault; a non-existent id got 400 instead of 404.
- **Fix:** `errorController.addAttachments` — fetch `school_id, reported_by_user_id`, call
  `userCanAccessError()`, only then look at files.
- **Regression:** `verify-security-boundaries.js` SEC-001 block, 7 assertions, including
  the positive paths (reporter and their school admin still reach the upload step).

## SEC-002 — School records unscoped · P2 · Fixed

- **Routes:** `GET /api/schools/:id/forms` (no scope at all); `GET /api/schools/:id`
  (checked the `school` role only).
- **Root cause:** `getAll()` scopes a field engineer to `assigned_admin_id` in SQL; the
  single-record handlers did not ask the same question.
- **Impact:** a school admin reads any school's per-form student/tablet counts; a field
  engineer opens any school's detail, which carries **every fault** of that school and its
  contacts. Internal roles only, hence P2.
- **Fix:** new `services/scope.js` → `canActOnSchool(user, schoolId)`, one answer for all
  four roles; used by `getById` and `getForms`.
- **Regression:** SEC-002 block, 5 assertions (negative for school admin and engineer,
  positive for own school and platform admin).

## SEC-003 — Stored text ran as script in a platform admin's browser · P1 · Fixed

- **Sinks (render without `esc()`):** `lrs.js` — school name, asset tag, hostname, serial,
  model, notes, history values, actor, and a school name spliced into an `onclick` string;
  `inventory.js` — school `<option>`s; `register.js` (public page) — school name and zone,
  also spliced into an `onclick`; `weekly.js` — connectivity/tablets/platform/power;
  `tracker.js` and `app.js` — fault category.
- **Sources a low-privilege role controls:** a **school admin** can rename their own school
  (`PUT /api/schools/:id` accepts `name`); check-in fields were free text
  (`POST /api/checkins` validated only `status`); a field engineer could set any
  `category` through `PUT /api/errors/:id`.
- **Impact:** the session token lives in `localStorage` and the CSP allows inline script
  (`'unsafe-inline'`), so markup in any of those fields runs in the viewer's session and
  can read the token. A school admin → platform admin takeover path. ASVS V1 (encoding),
  V3 (frontend).
- **Evidence (before):** check-in with `power: "<img src=x onerror=alert(1)>"` → 201;
  `PUT /errors/:id` with that as category → 200; source scan found 19 raw sinks.
- **Fix, both halves:** every sink escapes (`esc()`), `onclick` handlers take an id and look
  the record up; the server now refuses values outside the fixed lists (check-in fields
  `ok|issue`; fault category/priority/status on `PUT`). Existing data was checked first: all
  30 local check-ins use `ok`.
- **Regression:** SEC-003 block, 10 assertions (server refusals, and a source scan of the six
  files for raw stored fields).
- **Not done here (tracked):** removing `'unsafe-inline'` from `script-src` needs every
  inline handler rewritten — large, and the real long-term control.

## SEC-004 — Field engineer writes outside their schools · P2 · Fixed

- **Routes:** `POST /api/checkins`, `POST /api/communications`, `DELETE /api/communications/:id`.
- **Root cause:** only the `school` role was checked; a `subadmin` passed for any school id.
- **Impact:** an engineer files check-ins and notes against, or deletes notes of, schools
  they cannot even list. `recorded_by`/`checked_by` are also free text from the body
  (repudiation; noted, not yet changed).
- **Fix:** `canActOnSchool()` on create; on delete, the row's own school.
- **Regression:** SEC-004 block, 5 assertions, including "the row is still there".

## SEC-005 — JWT cannot be revoked before expiry · P2 · Open

7-day HS256 tokens. `authenticate()` re-reads account status per request, so **suspension is
immediate** — but a password change, a logout, or a stolen token on an active account stays
valid until expiry. Proposed: `users.token_version` (additive column) carried in the token
and compared in `authenticate()`; bump on password change/reset and "sign out everywhere".
Needs approval: it signs every current user out once.

## SEC-006 — Failed sign-ins and refusals were not recorded · P2 · Fixed

- **Was:** throttling existed but left no evidence. `authLimiter` refused silently, 401/403
  answers left no trace, and `audit_log` recorded only successful administrative writes.
- **Fix:** `security_events` (additive table) and `services/securityEvents.js`. One response
  hook on `/api/` classifies every 401/403/429, so a refusal added to any controller later is
  recorded without anyone remembering to. It records sign-ins as well. Rows are buffered and
  flushed every 2 s, repeats within 60 s fold into one row's `count`, pending rows are capped
  at 500 (overflow is counted), and rows are kept 90 days.
- **Never stored:** passwords, tokens, headers, bodies, query strings, raw URLs (only route
  templates, with ids masked), or the typed name of an account that does not exist.
- **Found while testing it:** a repeat folded into a row that had since been deleted (by
  retention or a cleanup) was lost. Repeats now start a new row instead.
- **Regression:** SEC-006 block in `verify-security-boundaries.js`, 14 assertions. The suite
  was run twice back to back to cover the deleted-row case. Measured: 200 concurrent probes
  became 1 row with count 200 in 0.84 s.
- **Still open:** nothing raises an alert on these events yet (DECISIONS.md D5/D6).

## SEC-007 — No second factor for platform admin · P2 · Open

One password protects every school's data. TOTP for the `admin` role is the proportionate
control. Changes the sign-in flow for head office — needs approval.

## SEC-008 — Guessable input on public registration endpoints · P3 · Open

`POST /api/register/appeal` takes a sequential `request_id` and resets any *rejected* request to
`pending` (no ownership proof; general 900/15 min limit only). `POST /api/register/teacher-status`
confirms whether an email belongs to a teacher and returns the rejection reason. Fix: require
the registration email alongside the id; answer teacher-status only with the id issued at
registration, or a uniform response.

## SEC-009 — Login throttle is per account per network · P3 · Open

`authLimiter` keys on `username|ip`, so the same account attacked from many addresses has no
shared cap. Deliberate trade-off (a school shares one IP) that leaves distributed guessing
unthrottled. Proposed: add a per-account-only limiter with a higher ceiling, plus SEC-006
recording so the pattern is visible.

## SEC-010 — Attachment memory ceiling · P3 · Open

`multer.memoryStorage()` with `MAX_FILE_SIZE` 100 MB × 5 files, open to every signed-in role on
`POST /api/errors` and `/attachments`: a few concurrent requests can exhaust the Passenger
process. The report form already shrinks images to ~80 KB. Proposed: 15 MB per file for fault
attachments (manuals keep 100 MB, admin-only). A policy change — needs a yes.

## INT-001 — Fault codes reissued · P3 · Open (data integrity, not security)

`nextErrorCode()` = `MAX(number)+1` over existing rows, in three places (`errorController`,
`services/intake.js`, `heartbeatController`). Deleting the newest fault reissues its code —
observed: `QFT-0379` issued to faults 459, 471 and 478 on 2026-09-24 — and two concurrent
reports can receive the same code. Fix: a sequence table or `UNIQUE(error_code)` + retry
(check for existing duplicates first).

## TEST-001 — `verify-heartbeat.js` swept real devices and deleted others' rows · P2 · Fixed

Its sweep opens critical tickets for **every** silent LRS device, not only the one it created,
and asserts none are silent. On a database with silent seed devices it fails, and it leaves
tickets behind: on 2026-09-24 it opened QFT-0379…0383 for devices 9–13, which were removed by
hand afterwards (TEST_RESULTS.md). Worse than first recorded: its cleanup deleted **every** `lrs_heartbeat:*` ticket, **every**
`error.auto_*` audit row and **every** `heartbeat_lost` history row, so running it against a
database with genuine heartbeat tickets destroyed them. Raised to P2 for that reason.

**Fix:** it now snapshots baselines, parks every other device (a device that never reported is
ignored by the sweep), removes only rows created after the baseline for its own device (with their
updates and notifications), and restores every device exactly. Verified: 21/21, and a before/after
snapshot of devices, faults, updates, audit, history and notifications is byte-identical. The same suite also leaves its
`auto_recovery` rows in `error_updates` after deleting its test faults: the restore drill found
seven such orphans from 9–10 September, and they were removed on 2026-09-24.

## OPS-001 — Deploys did not restart the app · P2 · Fixed, pending proof on the next deploy

- **Evidence:** at 07:28–07:31 on 2026-09-24, production served `index.html` at v53 and
  `security.js` (new files) while `/api/health` reported `c564c2f`, and `/api/security/overview`
  answered 200 through the page catch-all instead of 401. The new backend was not running. It
  stayed that way for over an hour, until a manual restart. The same happened on 2026-09-09.
- **Impact:** security fixes pushed are not live; the frontend and backend disagree.
- **Fix:** DECISIONS.md D23: preflight, roll back on failure, self-restart on success.
- **Regression:** `verify-deploy-preflight.js` (10 assertions).
