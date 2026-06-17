# API & DTO Reference

Complete request/response Data Transfer Objects for the Quest Forward Tanzania API.
Companion to [`ROADMAP_AND_DESIGN.md`](./ROADMAP_AND_DESIGN.md). Code form: [`backend/src/dto/index.js`](../backend/src/dto/index.js).

## Conventions
- Base path: `/api`. All times ISO-8601 UTC. Money/ids are integers.
- **Auth:** `Authorization: Bearer <JWT>` on all routes except `POST /auth/login` and the public CSAT submit.
- **Roles:** `admin`, `subadmin`, `school`. "Admin only" = 403 otherwise.
- **Errors:** `{ "error": "message" }` with appropriate HTTP status. Validation failures: `422` `{ "errors": [{ msg, path }] }`.
- Legend: `*` required · `?` optional · `‹enum›` allowed values.

---

## Auth

### `POST /auth/login`
**Request `LoginDTO`**
| field | type | req | notes |
|------|------|-----|------|
| username | string | * | username **or** email |
| password | string | * | |

**Response `AuthDTO`** → `{ token: string, user: UserDTO }`

### `UserDTO` (response shape)
`id:int, username:string, email:string, full_name:string, role:‹admin|subadmin|school›, phone:string?, zone:string?, color:string, title:string?, status:‹active|onsite|remote|inactive›, school_id:int?`

### `PUT /auth/change-password` — `{ current_password*, new_password* (min 6) }`

---

## Errors

### `ErrorDTO` (response)
```
id:int, error_code:string, title:string, description:string?,
school_id:int, school_name:string, school_code:string, school_zone:string?,
category:‹Connectivity|Hardware|Platform|Power|Accounts|Other›,
subcategory:string?, priority:‹critical|high|medium|low›,
status:‹open|progress|escalated|resolved›,
assigned_to:int?, assigned_name:string?, assigned_color:string?,
reporter_name:string?, reporter_role:string?, reporter_contact:string?,
location:string?, affected_devices:string?,
hours_open:number,
sla_due_at:datetime?, sla_breached:0|1, first_response_at:datetime?,
csat_rating:int?, csat_comment:string?,
resolved_at:datetime?, created_at:datetime, updated_at:datetime,
updates: ErrorUpdateDTO[]   // only on GET /errors/:id
```

### `GET /errors` — query `ErrorFilterDTO`
`status?‹all|open|progress|escalated|resolved›, priority?, category?, school_id?:int, search?:string, limit?:int` → `ErrorDTO[]` (role-scoped).

### `GET /errors/:id` → `ErrorDTO` (+ `updates`)

### `POST /errors` — `CreateErrorDTO`
| field | type | req | notes |
|------|------|-----|------|
| title | string | * | |
| school_id | int | * | |
| category | enum | * | one of the 6 categories |
| priority | enum | ? | default `medium` (sets SLA due) |
| description, subcategory, reporter_name, reporter_role, reporter_contact, location, affected_devices | string | ? | |

**Response:** `{ id:int, error_code:string, message:string }`. Side effects: sets `sla_due_at`, audits `error.created`, notifies recipients.

### `PUT /errors/:id` — `UpdateErrorDTO` (admin/subadmin)
All `CreateErrorDTO` fields + `status?`, `assigned_to?:int`. Recomputes `sla_due_at`; audits `error.updated`; notifies on status change.

### `PATCH /errors/:id/status` — `{ status* ‹open|progress|escalated|resolved› }`
Stamps `first_response_at` on first move off `open`; audits `error.status_changed`; notifies.

### `POST /errors/:id/updates` — `AddErrorUpdateDTO` `{ note*, update_type?, recorded_by? }` → audits `error.note_added`.

### `DELETE /errors/:id` (admin) → audits `error.deleted`.

### `GET /errors/stats` → `StatsDTO`
`summary:{ total, open_count, open_status, in_progress, escalated, resolved, critical_open, sla_breached, resolved_24h }, by_category:[{category,count}], by_priority:[{priority,count}]`

### (Planned) `POST /errors/csat/:token` — public — `CsatDTO` `{ rating* (1–5|0/1), comment? }`

---

## Audit  *(admin only)*

### `GET /audit` — query `AuditFilterDTO`
`entity_type?, action?, actor_id?:int, search?, limit?:int(≤1000, default 200)` → `AuditEntryDTO[]`

### `AuditEntryDTO`
`id:int, actor_id:int?, actor_name:string, actor_role:string?, action:string, entity_type:string, entity_id:string?, summary:string?, meta:object?, created_at:datetime`

---

## School Admins  *(admin only)* — role `school` accounts

### `SchoolAdminDTO`
`id, username, email, full_name, phone?, color, title, status‹active|inactive›, school_id?, school_name?, school_code?, school_zone?, created_at`

- `GET /school-admins` → `SchoolAdminDTO[]`
- `GET /school-admins/:id` → `SchoolAdminDTO`
- `POST /school-admins` — `CreateSchoolAdminDTO` `{ username* (≥3), email*, full_name*, school_id*, password? (def changeme123), phone?, color?, title?, status? }`
- `PUT /school-admins/:id` — `UpdateSchoolAdminDTO` `{ full_name*, email?, phone?, color?, title?, status?, school_id? }`
- `PATCH /school-admins/:id/password` — `{ new_password* (≥6) }`
- `DELETE /school-admins/:id`

---

## Sub-Admins (Team)  *(admin only)* — role `subadmin`

### `TeamMemberDTO`
`id, username, email, full_name, phone?, zone?, color, title, status, created_at, school_count:int, open_errors:int`

- `GET /team` → `TeamMemberDTO[]`
- `GET /team/:id` → `TeamMemberDTO + { schools:[], open_errors:[] }`
- `POST /team` — `CreateTeamMemberDTO` `{ username*(≥3), email*, full_name*, password?, phone?, zone?, color?, title?, status? }`
- `PUT /team/:id` — `{ full_name*, email?, phone?, zone?, color?, title?, status? }`
- `PATCH /team/:id/schools` — `{ school_ids*: int[] }`
- `DELETE /team/:id` — `{ reassign_to?: int }`

---

## Schools

### `SchoolDTO`
`id, code, name, zone?, students:int, tablets:int, routers:int, contact_name?, contact_role?, contact_phone?, lrs_ip?, isp?, assigned_admin_id?, admin_name?, admin_phone?, admin_color?, open_errors:int, created_at, updated_at`

- `GET /schools` → role-scoped `SchoolDTO[]`
- `GET /schools/:id` → `SchoolDTO + { errors[], checkins[], communications[] }`
- `POST /schools` (admin) — `{ code*, name*, zone?, students?, tablets?, routers?, contact_*?, lrs_ip?, isp?, assigned_admin_id? }`
- `PUT /schools/:id` (admin) — `{ name*, … }`
- `PATCH /schools/:id/assign` (admin) — `{ admin_id?:int }`
- `DELETE /schools/:id` (admin)

---

## Dashboard
`GET /dashboard` → `{ schools_total, schools_healthy, errors: StatsSummary (incl. sla_breached), recent_errors: ErrorDTO[] (incl. sla_breached), checkins:{done,total,current_week}, category_breakdown:[{category,count}] }`

---

## Other existing resources (unchanged shapes)
- **Check-ins:** `GET /checkins`, `GET /checkins/school/:id`, `POST /checkins` — `{ school_id*, week_number*, term?, status‹green|amber|red›, connectivity/tablets/platform/power ‹ok|issue|na›, note?, checked_by? }`
- **Guides:** `GET/POST/PUT/DELETE /guides` — `{ title*, category?, icon?, steps*: string[] }`
- **Resources (manuals):** `GET /manuals`, `POST /manuals` (multipart `file*`, `title?`, `category?`), `GET /manuals/:id/download`, `DELETE /manuals/:id`
- **Communications:** `GET /communications`, `POST /communications` `{ school_id*, note*, recorded_by? }`
- **Settings:** `GET/PUT /settings` (admin) — branding key/values.

---

## Planned DTOs (Tier 1–2)
- `SearchResultDTO` — `{ type:‹guide|resource›, id, title, snippet?, category?, url? }` for `GET /search?q=`
- `ExportQueryDTO` — same filters as `ErrorFilterDTO`; response `text/csv`.
- `SmsConfig` (env) — `AT_USERNAME, AT_API_KEY, AT_SENDER_ID`.
- `Toa2FADTO` — `{ token* (6 digits) }` for `POST /auth/2fa/verify`.
