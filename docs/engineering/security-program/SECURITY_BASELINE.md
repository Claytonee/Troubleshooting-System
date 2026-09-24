# Security baseline — 2026-09-24

The controls that exist, where they live, and how each was established. Mapped to the
17 chapters of OWASP ASVS 5.0 as a checklist. **This is not an ASVS certification**; no
level is claimed and nobody outside the project has assessed the system.

Evidence: **T** automated test · **C** code read in this review · **D** hosting record (CLAUDE.md) · **—** not established.

| ASVS 5.0 chapter | What exists | Ev. | Gaps |
|---|---|---|---|
| V1 Encoding & sanitization | `esc()` on rendered data; SQL placeholders everywhere (dynamic SQL is fixed column fragments only) | T C | Enforced CSP still allows inline script; the strict policy runs report-only while 321 handlers migrate (D24) |
| V2 Validation & business logic | express-validator on key writes; enums on fault + check-in fields | T C | Many handlers validate by hand or not at all (e.g. profile fields) |
| V3 Web frontend | helmet CSP (`default-src 'self'`, `object-src 'none'`, `frame-ancestors 'self'`), strict CSP report-only with foreign-script alerts (R8), HSTS 1 y preload, referrer policy | T C | Inline script still allowed while enforced; token in localStorage (revocable, D3) |
| V4 API & web service | Role gate on every router; per-record scope; JSON errors without stack traces in production; CORS same-origin only in production (SEC-014) | T C | — |
| V5 File handling | Extension allow-list, size cap (15 MB per fault attachment, SEC-010), stored on Cloudinary (separate origin), never executed server-side | T C | No content sniffing/malware scan; `.html`/`.svg` accepted, served from Cloudinary's origin, not ours |
| V6 Authentication | bcrypt (10–12); throttles per account+network, per network, and per account from anywhere (SEC-009); TOTP two-step for platform admins with recovery codes (SEC-007); minimum 8 characters everywhere, admin-set passwords must be changed (SEC-011) | T C | Two-step not offered to other roles yet (D4 scope) |
| V7 Session management | JWT 7 d carrying `token_version`; password change, reset, suspension and "Sign out everywhere" end every session (SEC-005); a new token on password change; status re-read per request; inactivity timer | T C | Token in localStorage, not an HttpOnly cookie |
| V8 Authorization | 4 roles; `authorize()`; `canActOnSchool()`; inventory capability; teacher cannot set status | T | Tenant isolation app-layer only |
| V9 Self-contained tokens | `jwt.verify` with a server secret, HS256 pinned at every site (SEC-013); a two-step ticket is never a session | T C | — |
| V10 OAuth / OIDC | Not used | — | n/a |
| V11 Cryptography | bcrypt; HMAC-SHA256 with `timingSafeEqual`; `crypto.randomBytes` for CSAT/link tokens | C | — |
| V12 Secure communication | HTTPS redirect in production; HSTS; Let's Encrypt | C D | Certificate renewal not monitored by us (host-managed) |
| V13 Configuration | Secrets in panel env; `/api/health` exposes booleans only; deploy fails closed without a secret; deploy preflight + rollback (D23) | T C D | `DATABASE_URL` override hazard (documented, logged at start) |
| V14 Data protection | Role-scoped caches dropped on logout; offline queue records owner; PDPA record; retention job (D25); the AI gets no names (D21) | T C | Retention deletes only once the owner enforces it; student names on devices |
| V15 Secure coding & architecture | Dependencies pinned by lockfile; `npm audit` in the pre-push gate (fails on high/critical; 0 today); no `eval` (CSP + `verify-frontend-safety.js`); secret scan of history clean | T C | — |
| V16 Logging & error handling | `audit_log` for admin writes; `security_events` for every 401/403/429 and sign-in (SEC-006); detection rules R1–R8 alert the platform admin (D5 b); error handler hides detail in production | T C | Not tamper-evident (a database admin could edit rows) |
| V17 WebRTC | Not used | — | n/a |

## NIST CSF 2.0 functions

| Function | State | Basis |
|---|---|---|
| Govern | In place | SECURITY_POLICY.md adopted; platform admin is security owner; quarterly access review |
| Identify | In place | API matrix of every endpoint, kept true by `api-matrix.js --check` in the gate; threat model; data inventory |
| Protect | In place | V1–V9, V11–V13 above |
| Detect | In place | Every refusal recorded; 8 rules open deduplicated incidents with one bell alert each (`services/detection.js`, tested); alert-only by D5; email alerts await SMTP |
| Respond | Partial | INCIDENT_RESPONSE.md adopted, with PDPC notification; first tabletop due within 30 days |
| Recover | Partial | RPO 24 h / RTO 4 h; restore drill proven on a copy; first production drill due |

## Infrastructure — what we can and cannot configure

- **DNS** is an A record straight to the cPanel host. There is **no CDN or edge WAF** in front
  of the site, so there is no edge block to configure today.
- **LiteSpeed/DirectAdmin** terminates TLS. Host-level ModSecurity/Imunify360 may exist; not
  verified and not under our control.
- **Application-level controls** are therefore the only ones this project fully owns: an IP
  block, when built, is an *application* block — it runs after TLS and Node, and does nothing
  against network-level floods.

## OWASP API Security Top 10 (2023)

| Risk | Here | Evidence | State |
|---|---|---|---|
| API1 Broken object-level authorisation | Per-record checks, `canActOnSchool()` | SEC-001/002/004 fixed; suite | **Covered, tested** |
| API2 Broken authentication | bcrypt, three throttles, two-step for platform admins, revocable sessions, pinned algorithm | Suites | **Covered, tested** |
| API3 Broken object property-level authorisation | Whitelisted UPDATE columns; DTO shapers on responses | Code | Partial: some handlers take free-text author fields (SEC-004 note) |
| API4 Unrestricted resource consumption | Per-account rate limits; JSON 10 MB; 15 MB per attachment | Code, suite | **Covered** — application level only; no edge protection against floods |
| API5 Broken function-level authorisation | `authorize()` on every router; role matrix | 125-assertion suite | **Covered, tested** |
| API6 Unrestricted access to sensitive business flows | Registration throttled; link caps; appeals and status need proof (SEC-008) | Suite | **Covered, tested** |
| API7 Server-side request forgery | The server fetches only fixed hosts (Bedrock, Meta, Africa's Talking, Cloudinary) | Code | Not exposed |
| API8 Security misconfiguration | helmet, HSTS, fail-closed webhooks, same-origin CORS | Code, suite, hosting record | Partial: enforced CSP still allows inline script (D24) |
| API9 Improper inventory management | Endpoint matrix, checked against the code on every push | `api-matrix.js --check` | **Covered, tested** |
| API10 Unsafe consumption of APIs | WhatsApp HMAC verified; AI output rendered escaped | Code | Partial: AI output not validated beyond escaping |
