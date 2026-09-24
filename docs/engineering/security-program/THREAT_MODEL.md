# Threat model

Written 2026-09-24 from the code and the hosting record in `CLAUDE.md`. Anything marked
**unverified** was not observed on the live server in this session.

## What is worth protecting

| Asset | Where | Why it matters |
|---|---|---|
| Accounts & sessions | `users`, JWT in the browser's `localStorage` | A platform admin session reaches every school |
| Fault records & attachments | `errors`, `error_updates`, Cloudinary | School operations; photos may show students or rooms |
| People data | names, emails, phones of staff and teachers; student names on devices (`tablets.student_name`) | Tanzania PDPA 2022 personal data |
| Device inventory | `tablets`, `lrs_devices` | Asset records, serials |
| Integration secrets | `JWT_SECRET`, `WEBHOOK_SECRET`, `HEARTBEAT_KEY`, `WHATSAPP_*`, `PHONE_INTAKE_KEY`, Cloudinary, Bedrock | Forge sessions, deploy code, file faults |
| The deploy path | `POST /api/deploy` → `git reset --hard` + `npm install` + restart | Remote code execution if abused |

## Actors

| Actor | Realistic capability |
|---|---|
| Anonymous internet | Public endpoints (17), scanning, password guessing, registration spam |
| Teacher | Own reports, school inventory read — the largest and least-vetted population (self-registered via link) |
| School admin | Self-registered, then approved; controls their school's record, **including its name** |
| Field engineer (`subadmin`) | Assigned schools; staff |
| Platform admin | Everything; the target worth phishing |
| Outside systems | WhatsApp (Meta), Africa's Talking (USSD/SMS), school LRS servers, GitHub |
| Hosting operator | Full access to files, env vars and DB — trusted by necessity |

## Request path and trust boundaries

```
Browser / feature phone / Meta / Africa's Talking / LRS
   │  DNS: support.mkatolikikiganjani.com → A 213.139.204.238 (no CDN, no edge WAF under our control)
   ▼
LiteSpeed (cPanel/DirectAdmin) — TLS termination, Let's Encrypt       ← boundary 1: internet → host
   │  host-level ModSecurity / Imunify360: unverified
   ▼
Passenger → Node/Express (one process tree)                            ← boundary 2: proxy → app
   │  trust proxy = 1 → req.ip = last X-Forwarded-For hop (unverified that LiteSpeed overwrites it)
   │  helmet (CSP, HSTS…), rate limits (per account; login per account|IP + per IP)
   │  authenticate(): JWT verify + account re-read      ← boundary 3: anonymous → identified
   │  authorize(roles) on every router                  ← boundary 4: role
   │  controller scope: school / assigned / own row     ← boundary 5: tenant (application-enforced only)
   ▼
MySQL on localhost (same account)  ·  Cloudinary (separate origin)  ·  Bedrock (AI)
```

**Tenant isolation is enforced in application code only.** Every school's rows share tables;
there is no database-level row security. One missed `WHERE school_id` is a cross-school leak —
which is exactly what SEC-001/002/004 were. The regression suites are therefore the control.

## Threats by boundary (STRIDE, the ones that matter here)

| # | Threat | Boundary | Current control | Gap |
|---|---|---|---|---|
| T1 | Password guessing / credential stuffing | 3 | bcrypt; 20/account+IP, 120/IP, 60/account from anywhere per 15 min; every failure recorded; R1–R3 alert | An address shared by a school cannot be blocked without blocking the school (D5) |
| T2 | Stolen token (XSS, shared tablet, stolen laptop) | 3 | Status re-read per request; revocable sessions ("Sign out everywhere", D3); esc() on output; CSP blocks foreign scripts, R8 alerts on them | Token in localStorage; enforced CSP still allows inline (D24) |
| T3 | Phished platform admin | 3 | TOTP two-step, required from 2026-10-08 (D4); R3 alerts on success after failures | A real-time phishing proxy can relay a TOTP code; only a passkey stops that |
| T4 | Cross-school read/write by id (BOLA) | 5 | Per-handler scope checks, now `canActOnSchool()` | App-layer only; guarded by suites |
| T5 | Stored XSS from a lower role into a higher one | 5→browser | esc() everywhere audited; server enums; strict CSP report-only | `'unsafe-inline'` still enforced-allowed until the migration (D24) |
| T6 | Forged webhook / callback | 2 | HMAC (WhatsApp, deploy), shared keys (heartbeat, USSD/SMS), all fail closed | Shared keys travel in URL/header — rotate if leaked |
| T7 | Abuse of deploy webhook | 2 | HMAC, fast-forward only, fixed branch | — |
| T8 | Resource exhaustion | 2 | 900 req/15 min/account, JSON 10 MB, 15 MB attachments | No edge protection against network floods (no CDN) |
| T9 | Spoofed client IP | 2 | `trust proxy 1`; `GET /api/security/seen-as` built to test it | **Still unverified on production**: the check waits for the owner's restart. No IP block before it passes (D5 a) |
| T10 | Repudiation / no evidence | all | `audit_log` for admin writes; `security_events` for every refusal and sign-in (SEC-006) | Not tamper-evident |
| T11 | Secrets exposure | host | Env vars in panel; `/api/health` booleans only | `.env.*` files exist on dev machines — never commit, never zip |
| T12 | Data loss | host | Host backups (expected); restore drill script (RECOVERY.md), proven on a local copy | First production restore drill outstanding |

## Things that are technically impossible here, said plainly

- **REMOTE MAC BLOCKING: NOT TECHNICALLY AVAILABLE.** A MAC address does not cross a router;
  no web server can see a visitor's. There is no managed-device or school-LAN integration that
  exposes one. Realistic alternatives: suspend the account, revoke sessions (after SEC-005),
  block an IP (after T9 is verified), or disable a registration link.
- **IP attribution is weak.** A school sits behind one NAT; mobile networks use carrier NAT.
  An IP is evidence of a network, not of a person. Automatic blocks must be short and reviewed.
