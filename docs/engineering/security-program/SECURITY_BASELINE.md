# Security baseline — 2026-09-24

The controls that exist, where they live, and how each was established. Mapped to the
17 chapters of OWASP ASVS 5.0 as a checklist. **This is not an ASVS certification**; no
level is claimed and nobody outside the project has assessed the system.

Evidence: **T** automated test · **C** code read in this review · **D** hosting record (CLAUDE.md) · **—** not established.

| ASVS 5.0 chapter | What exists | Ev. | Gaps |
|---|---|---|---|
| V1 Encoding & sanitization | `esc()` on rendered data; SQL placeholders everywhere (dynamic SQL is fixed column fragments only) | T C | CSP `'unsafe-inline'` means escaping is the only XSS control |
| V2 Validation & business logic | express-validator on key writes; enums on fault + check-in fields | T C | Many handlers validate by hand or not at all (e.g. profile fields) |
| V3 Web frontend | helmet CSP (`default-src 'self'`, `object-src 'none'`, `frame-ancestors 'self'`), HSTS 1 y preload, referrer policy | C | Inline script allowed; token in localStorage |
| V4 API & web service | Role gate on every router; per-record scope; JSON errors without stack traces in production | T C | CORS reflects any origin in production when `FRONTEND_URL` is unset (low impact: bearer tokens, no cookies) |
| V5 File handling | Extension allow-list, size cap, stored on Cloudinary (separate origin), never executed server-side | C | No content sniffing/malware scan; 100 MB in memory (SEC-010); `.html`/`.svg` accepted |
| V6 Authentication | bcrypt (10–12); per-account + per-network login throttle; registration throttle | C | No MFA (SEC-007); distributed guessing (SEC-009); min length 8 on change, 6 on admin reset |
| V7 Session management | JWT 7 d; account status re-read per request; client-side inactivity timer | C | No revocation (SEC-005); no rotation on password change |
| V8 Authorization | 4 roles; `authorize()`; `canActOnSchool()`; inventory capability; teacher cannot set status | T | Tenant isolation app-layer only |
| V9 Self-contained tokens | `jwt.verify` with a server secret (jsonwebtoken 9 rejects `none`) | C | Algorithm not pinned explicitly |
| V10 OAuth / OIDC | Not used | — | n/a |
| V11 Cryptography | bcrypt; HMAC-SHA256 with `timingSafeEqual`; `crypto.randomBytes` for CSAT/link tokens | C | — |
| V12 Secure communication | HTTPS redirect in production; HSTS; Let's Encrypt | C D | Cert renewal not monitored |
| V13 Configuration | Secrets in panel env; `/api/health` exposes booleans only; deploy fails closed without a secret | C D | `DATABASE_URL` override hazard (documented); CORS default |
| V14 Data protection | Role-scoped caches dropped on logout; offline queue records owner | C | No retention policy; student names on devices |
| V15 Secure coding & architecture | Dependencies pinned by lockfile; no `eval` (CSP + `verify-frontend-safety.js`) | T C | `npm audit` not yet in the routine |
| V16 Logging & error handling | `audit_log` for admin writes; error handler hides detail in production | C | Refusals and failed logins not logged (SEC-006); log not tamper-evident |
| V17 WebRTC | Not used | — | n/a |

## NIST CSF 2.0 functions

| Function | State | Basis |
|---|---|---|
| Govern | Partial | Roles defined; this programme; no written policy |
| Identify | Partial | API matrix (142 endpoints), threat model, asset list |
| Protect | In place | V1–V9, V11–V13 above |
| Detect | Missing | Nothing alerts; throttles act silently |
| Respond | Missing | No rehearsed procedure; PDPA breach notification not yet written into one |
| Recover | Unverified | Host backups expected; no restore test |

## Infrastructure — what we can and cannot configure

- **DNS** is an A record straight to the cPanel host. There is **no CDN or edge WAF** in front
  of the site, so there is no edge block to configure today.
- **LiteSpeed/DirectAdmin** terminates TLS. Host-level ModSecurity/Imunify360 may exist; not
  verified and not under our control.
- **Application-level controls** are therefore the only ones this project fully owns: an IP
  block, when built, is an *application* block — it runs after TLS and Node, and does nothing
  against network-level floods.
