# DTO Specification — QFT Technical Support System

**Purpose:** Define request/response Data-Transfer Objects (DTOs) so that (1) input validation is consistent, (2) tenant scoping (`school_id` / `assigned_admin_id`) is enforced the same way everywhere, and (3) responses never leak fields or secrets. Several audit P1 findings (B2, B4, B5, B6) collapse to "the DTO wasn't enforced."

**Companion doc:** [SYSTEM_AUDIT_2026-08.md](docs/SYSTEM_AUDIT_2026-08.md).

---

## Conventions

- **Placement:** DTOs live in `backend/src/dto/` as plain modules, one file per resource (`deviceDto.js`, `checkinDto.js`, `errorDto.js`, `registrationDto.js`, `authDto.js`). Each exports pure functions — no DB, no `req`/`res`.
- **Shape of each module:**
  - `pickCreate(body)` / `pickUpdate(body)` — return only the allowed fields, coercing types and dropping anything not listed (mass-assignment protection).
  - `validate(dto)` — return `{ ok: true }` or `{ ok: false, error: '...' }`.
  - `toResponse(row, role)` — strip fields the given role must not see.
- **Tenant fields are never trusted from the body.** `school_id` for a `school` user is always taken from `req.user.school_id`. `assigned_admin_id` is never client-settable.
- **Enums are validated against a single source of truth** exported from the DTO and reused by the frontend where possible.
- **Escaping is a rendering concern, not a DTO concern** — DTOs store raw values; the frontend escapes on render (`esc()`). DTOs must NOT HTML-encode data at rest.

---

## 1. Device (Tablet Inventory) — `deviceDto.js`

Backs `tablets` table. Closes **B2** (authorization + scoping) and supports **B3** (defined field set to escape on render).

### Enums
```js
const DEVICE_STATUS = ['Working', 'Needs Setup', 'In Repair', 'Faulty', 'Lost/Missing'];
```

### Create DTO — `pickCreate(body, user)`
| Field | Type | Rules |
|-------|------|-------|
| `school_id` | int | **Derived**: if `user.role === 'school'` → `user.school_id`; else required from body. Sub-admin must own it (`assigned_admin_id = user.id`, checked in controller). |
| `serial_number` | string | **required**, non-empty, trimmed, ≤ 100 |
| `asset_tag` | string\|null | optional, ≤ 100 |
| `form` | string\|null | optional, ≤ 20 |
| `stream` | string\|null | optional, ≤ 20 |
| `model` | string\|null | optional, ≤ 100 |
| `year_first_used` | int\|null | optional, 2000..current+1 |
| `status` | enum | default `'Working'`; must be in `DEVICE_STATUS` |
| `student_name` | string\|null | optional, ≤ 120 |
| `admission_no` | string\|null | optional, ≤ 50 |
| `last_checked` | date\|null | optional, `YYYY-MM-DD` |
| `notes` | string\|null | optional, ≤ 1000 |

### Update DTO — `pickUpdate(body)`
Same fields as create **except** `school_id` (a device cannot change schools via update). `serial_number` still required.

### Assign DTO — `pickAssign(body)`
`{ student_name?: string≤120, admission_no?: string≤50 }` only.

### Status DTO — `pickStatus(body)`
`{ status: enum(required), note?: string≤500 }`.

### Authorization matrix (enforce in routes + controller)
| Action | admin | subadmin | school | teacher |
|--------|:---:|:---:|:---:|:---:|
| list / get / export | all | own-assigned only | own school only | own school only (read) |
| create | ✓ | own-assigned | own school | ✗ |
| update | ✓ | own-assigned | own school | ✗ |
| assign | ✓ | own-assigned | **own school** ← *missing today* | ✗ |
| status | ✓ | own-assigned | **own school** ← *missing today* | ✗ |
| delete | ✓ | own-assigned | ✗ | ✗ |

> Today `assignDevice`/`changeStatus` only check `subadmin`; add the `school` ownership check and a teacher denial. Add `authorize('admin','subadmin','school')` to the write routes.

### Response DTO — `toResponse(row)`
Return the device row + `school_name`; no user PII beyond what's on the device. History rows expose `action`, `old_value`, `new_value`, `actor_name`, `note`, `created_at`.

---

## 2. Check-in — `checkinDto.js`

Backs `weekly_checkins`. Supports **B4** (scoping) and **A5** (consistent term/week).

### Enums
```js
const CHECKIN_STATUS = ['green', 'amber', 'red'];      // overall
const SUB_STATUS     = ['ok', 'issue', 'na'];          // connectivity/tablets/platform/power
```

### Create/Update DTO — `pickUpsert(body, user)`
| Field | Type | Rules |
|-------|------|-------|
| `school_id` | int | **Derived** for `school` role from `user.school_id`; validated against ownership for subadmin |
| `week_number` | int | **required**, 1..53 |
| `term` | string | default from a single `currentTerm()` helper (e.g. `"Term 2 · 2026"`) — **must match the dashboard's filter** |
| `status` | enum | `CHECKIN_STATUS`, default `green` |
| `connectivity`/`tablets`/`platform`/`power` | enum | `SUB_STATUS`, default `ok` |
| `note` | string\|null | ≤ 1000 |
| `checkin_date` | date\|null | `YYYY-MM-DD`, defaults to today |
| `checked_by` | string | server-set to `user.full_name` (not trusted from body) |

### Scoping (read/write)
`getBySchool` and upsert: `school` role → only `user.school_id`; `subadmin` → only schools with `assigned_admin_id = user.id`; admin → any.

---

## 3. Error / Ticket — `errorDto.js`

Backs `errors`. Supports **B5** (sub-admin scope on read/write).

### Create DTO — `pickCreate(body, user)`
`school_id` (derived for school role), `title` (required ≤ 200), `description` (≤ 5000), `category`, `priority` (`low|medium|high|critical`), `device_info?`, `reported_by` (server-set).

### Update DTO — `pickUpdate(body)`
`title`, `description`, `category`, `priority`, `status` (`open|in_progress|resolved|escalated|closed`), `assigned_to?`. No `school_id` change.

### Assign DTO — `pickAssign(body)`
`{ assigned_to: int (subadmin user id) }`.

### Scoping helper — `assertErrorAccess(errorRow, user)`
- `school` → `errorRow.school_id === user.school_id`
- `subadmin` → the error's school has `assigned_admin_id = user.id`
- `teacher` → only own-reported (or own school, per product decision)
- `admin` → always
Apply in `getById`, `updateStatus`, `addUpdate`, and `update`.

---

## 4. Registration / Teacher — `registrationDto.js`

Supports **B6** (never issue tokens from a public endpoint).

### Public submit DTOs (unauthenticated)
- `pickSchoolAdminRegister(body)` → `{ full_name≤120, email(valid), phone?, school_id(int), password(≥8) }`
- `pickAppeal(body)` → `{ request_id(int), message≤1000 }`
- `pickTeacherJoin(body, link)` → `{ full_name≤120, email(valid), phone?, subject? }` — `school_id` comes from the invite link, never the body.

### Status response DTO — `toStatusResponse(request)` ⚠️
Returns **status only**: `{ status: 'pending'|'approved'|'rejected', message? }`.
**Never** returns a JWT or credentials. The current endpoint mints a token on `approved` — remove that; approved users log in with their password.

### Admin-only DTOs
`approveRegistration`, `createTeacher` operate on admin input and run inside a **transaction** (audit A4).

---

## 5. Auth — `authDto.js`

Supports **B15** (one password policy).

```js
const PASSWORD_MIN = 8;
function validatePassword(pw) { return typeof pw === 'string' && pw.length >= PASSWORD_MIN; }
const BCRYPT_COST = 12;   // used everywhere a hash is created
```

- `pickLogin(body)` → `{ username, password }`.
- `pickChangePassword(body)` → `{ current_password, new_password }`; `new_password` must pass `validatePassword`.
- Response DTO `toUserResponse(row)` → `{ id, username, full_name, role, school_id, email }` — **never** `password_hash`.

---

## Rollout note (matches CLAUDE.md DB discipline)

Introducing DTOs is **code-only and additive** — no schema change, no data migration. Wire them controller-by-controller so old and new coexist; ship inventory first (it has the most gaps), then check-ins, errors, registration, auth. Each controller keeps working through the swap because the DTO produces the same field set the SQL already expects.
