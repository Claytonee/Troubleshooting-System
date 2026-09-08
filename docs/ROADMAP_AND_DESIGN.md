# Opportunity Education Tanzania — Feature Roadmap & Design

> Living design document for the feature programme.
> Tracks **what** we are building, **why**, the **data model & API** changes, and **status**.
> Companion document: [`API_AND_DTO_REFERENCE.md`](./API_AND_DTO_REFERENCE.md) (request/response DTOs).

---

## 1. Context & principles

- **Users:** platform admins, sub-admins (field engineers), school admins (school staff), teachers.
- **Environment:** rural Tanzania, low/intermittent bandwidth, modest shared hosting.
- **Stack:** Node.js + Express + PostgreSQL backend; vanilla-JS SPA frontend served by Express.
- **Design principles:**
  1. **Graceful degradation** — optional integrations (email, SMS) must no-op safely when unconfigured, never break core flows.
  2. **Additive migrations** — schema changes are expand-and-contract, safe to re-run on every startup (`config/schemaExtensions.js`).
  3. **Accountability** — mutating actions are audited (`audit_log` table).
  4. **Bandwidth-aware** — small payloads, server-side aggregation, offline-tolerant where possible.
  5. **Strict role separation** — uncrossable boundaries between teacher, school admin, and platform admin.

---

## 2. Roadmap status

| # | Feature | Tier | Status |
|---|---------|------|--------|
| 1 | Email notifications | 🟢 1 | **Implemented** (needs SMTP creds to send) |
| 2 | SLA timers + breach flags | 🟢 1 | **Implemented** |
| 3 | Knowledge-base search | 🟢 1 | **Implemented** |
| 4 | CSV/Excel export | 🟢 1 | **Implemented** |
| 5 | Audit log | 🟢 1 | **Implemented** |
| 6 | CSAT feedback | 🟢 1 | **Implemented** |
| 7 | SMS notifications (Africa's Talking) | 🟢 1 | **Implemented** (needs AT creds) |
| 8 | Teacher self-registration | 🟢 1 | **Implemented** |
| 9 | 4-tier RBAC (teacher role) | 🟢 1 | **Implemented** |
| 10 | Tiered escalation (teacher→school→platform) | 🟢 1 | **Implemented** |
| 11 | Custom dropdown system (no native selects) | 🟢 1 | **Implemented** |
| 12 | PostgreSQL migration (from MySQL) | 🟢 1 | **Implemented** (June 2026) |
| 13 | Cloudinary file storage | 🟢 1 | **Implemented** |
| 14 | School admin self-registration + approval | 🟢 1 | **Implemented** |
| 15 | In-app notifications (bell) | 🟢 1 | **Implemented** |
| 16 | Auto-assignment | 🟡 2 | Designed |
| 17 | Reporting trends + weekly digest | 🟡 2 | Designed |
| 18 | 2FA + security hardening | 🟡 2 | Designed |
| 19 | Swahili localization (i18n) | 🟡 2 | Designed |
| 20 | Offline / PWA | 🟢 1 | **Implemented** — [design](features/02-offline-pwa.md) |
| 21 | Recurring-problem detection | 🔵 3 | Planned |
| 24 | LRS heartbeat → self-opening tickets | 🟢 1 | **Implemented** (needs `HEARTBEAT_KEY` + the agent cron) — [design](features/01-lrs-heartbeat.md) |
| 22 | Preventive-maintenance reminders | 🔵 3 | Planned |
| 26 | Asset lifecycle & TCO (warranty, batches, refresh plan) | 🟢 1 | **Implemented** — [design](features/04-asset-lifecycle.md) |
| 27 | Visit planner (queue by school, on-site checklist) | 🟢 1 | **Implemented** — [design](features/05-visit-planner.md) |
| 23 | Email-to-ticket | 🔵 3 | Planned |
| 25 | WhatsApp intake (inbound reports + AI first reply) | 🟢 1 | **Implemented** (needs Meta credentials to send) — [design](features/03-whatsapp-intake.md) |

---

## 3. Implemented this phase (Tier 1 foundation)

### 3.1 Audit log (#5)
- **Table** `audit_log` (`config/schemaExtensions.js`): actor, action, entity_type, entity_id, summary, meta(JSON), ip, created_at.
- **Service** `services/audit.js` → `logAudit({actor, action, entityType, entityId, summary, meta, ip})`. Best-effort; never throws.
- **Wired into:** error create/update/status/note/delete; school-admin & sub-admin create/update/password/delete.
- **API:** `GET /api/audit` (admin only) — filter by `entity_type`, `action`, `actor_id`, `search`, `limit`.
- **UI:** "Audit Log" admin page (`frontend/js/pages/audit.js`), entity filter chips + search.

### 3.2 SLA timers + breach (#2)
- **Targets (hours)** in `config/schemaExtensions.js → SLA_TARGET_HOURS`: critical 4, high 24, medium 72, low 168. Mirrored in `frontend/js/utils.js → SLA`.
- **Columns on `errors`:** `sla_due_at`, `first_response_at`, `sla_breach_notified`.
- `sla_due_at` set on create (`NOW() + target`) and recomputed on priority change (`created_at + target`).
- `first_response_at` stamped when an error first leaves `open` or gets its first note.
- **Breach** is derived live: `status != 'resolved' AND sla_due_at < NOW()` → returned as `sla_breached` (0/1) on `GET /api/errors`, `GET /api/errors/:id`, dashboard recent errors; counted in `/errors/stats` and dashboard stats.
- **UI:** `slaState()` now prefers the authoritative `sla_breached` flag; existing badges (tracker, dashboard, follow-up, analytics) light up correctly.

### 3.3 Email notifications (#1)
- **Service** `services/notify.js`. Reads SMTP from env; **no-ops + logs** if unconfigured.
- **Events:** created, status_changed, escalated, resolved. Recipients = assigned engineer + school-admin accounts of that school.
- **Activate** by setting env: `SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS` (+ optional `SMTP_SECURE`, `MAIL_FROM`, `APP_URL`).

### 3.4 Incidental fix
- Hardened `error_code` generation to use the max numeric code (was last-inserted row → duplicate codes on freshly-seeded DBs).

---

## 4. Designs for upcoming features

### 4.1 Knowledge-base search (#3, Tier 1)
- Add `FULLTEXT` indexes on `troubleshooting_guides(title, steps)` and `manuals(title)`.
- `GET /api/search?q=` → unified results across guides + resources, role-scoped.
- UI: global search box in topbar; results grouped by type.

### 4.2 CSV/Excel export (#4, Tier 1)
- `GET /api/errors/export?…filters` and `GET /api/checkins/export` → `text/csv` stream (no dependency; manual CSV encoder, escape quotes).
- Admin/sub-admin only; respects existing role filters. UI: "Export" button on tracker & weekly.

### 4.3 CSAT feedback (#6, Tier 1)
- Columns ready: `errors.csat_rating` (1–5 or 👍/👎 as 1/0), `csat_comment`, `csat_token`.
- On resolve: generate `csat_token`; resolution email includes a tokenized link.
- `POST /api/errors/csat/:token` (public, no auth) → records rating/comment.
- `GET /api/errors/stats` extended with average CSAT. UI: rating widget + admin CSAT summary.

### 4.4 SMS / WhatsApp (#7, Tier 2)
- `services/sms.js` via **Africa's Talking** (TZ coverage). Same graceful-degradation pattern.
- Trigger on critical-create and escalation/breach. Env: `AT_USERNAME`, `AT_API_KEY`, `AT_SENDER_ID`.
- WhatsApp later via Meta Cloud API (template approval needed).

### 4.5 School self-service portal (#8, Tier 2)
- Reuse `school` role + new school-admin accounts. Scoped "My School" views: own tickets + live status + add comment.
- Mostly frontend + role-scoped queries on existing endpoints.

### 4.6 Auto-assignment (#9, Tier 2)
- On error create, assign to the school's `assigned_admin_id` (already partially done); add category-based override rules table `assignment_rules` (optional).

### 4.7 Reporting + weekly digest (#10, Tier 2)
- Aggregate endpoints (errors by category/school/resolution-time over time).
- `node-cron` weekly job builds a summary and emails admins (reuses `notify.js`).

### 4.8 2FA + security hardening (#11, Tier 2)
- TOTP (`otplib`) opt-in for admin/sub-admin; `users.totp_secret`, `users.totp_enabled`.
- Password reset flow (tokened email), account lockout on repeated failures (login limiter already present).

### 4.9 Swahili localization (#12, Tier 2)
- Externalize UI strings to `frontend/js/i18n/{en,sw}.js`; `t(key)` helper; language toggle persisted in localStorage. Start with report form + school portal.

### 4.10 Tier 3
- **Offline/PWA:** service worker caches guides + report form; IndexedDB queue for offline submissions; sync on reconnect.
- **Recurring-problem detection:** heuristic grouping by school/category/asset; link related errors to a "known issue".
- **Preventive maintenance:** cron-generated recurring check tasks per school asset.
- **Email-to-ticket:** inbound parse (provider webhook) → create error. Lower priority than SMS in this context.

---

## 5. Cron / scheduled jobs (planned)
A single `node-cron` runner (added with #2 breach alerts / #10 digest):
- **SLA breach sweep** (hourly): find unresolved errors past `sla_due_at` with `sla_breach_notified = 0`, send alert (email/SMS), set flag.
- **Weekly digest** (Mon 07:00 EAT): per-admin summary email.
- **LRS heartbeat sweep** (every 5 min): `POST /api/heartbeat/sweep` with `X-Webhook-Secret`. Opens a CRITICAL ticket for any LRS silent for 15 minutes, deduplicated on `errors.auto_source`. Implemented — see [features/01-lrs-heartbeat.md](features/01-lrs-heartbeat.md).

> On cPanel/shared hosting without a long-running process, replace `node-cron` with a cPanel **Cron Job** hitting an internal authenticated endpoint.

---

## 6. Out of scope (deliberately not building)
Full ITIL change/release management, CMDB relationship graphs, AI virtual agents, complex approval workflows, separate native mobile app. These add maintenance burden disproportionate to a small non-profit.
