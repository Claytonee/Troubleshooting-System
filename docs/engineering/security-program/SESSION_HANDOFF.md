# Session handoff

## 2026-09-24 — phase 1: discovery, containment, Security Overview

**Phase:** system-wide discovery and threat model done; confirmed P1/P2 access-control and
XSS findings fixed; the Security Overview page shipped. **READY FOR HUMAN REVIEW** — not
approved or closed.

### Done
- Threat model, baseline (ASVS 5.0 / CSF 2.0), 142-endpoint API matrix, research library.
- SEC-001…004 fixed, each reproduced first (8/27 → 27/27).
- `services/scope.js` → `canActOnSchool()`: one tenant-scope answer for all roles.
- `GET /api/security/overview` (admin only) + `#security` page: plain-language layers with
  "how we know", an animated request-journey diagram (GSAP, loaded on this page only, from our
  own origin), rings for the layers, live deployment checks, the review table, honest limits.
- Six suites made to honour `VERIFY_BASE`.

### Open, in the order I would take them
1. **SEC-006 security events** (SECURITY_DESIGN.md §1) — everything in detection depends on it.
2. **SEC-005 token versioning** — needs approval (signs everyone out once).
3. **SEC-007 TOTP for platform admin** — needs approval.
4. Verify proxy IP attribution on production (THREAT_MODEL T9) **before** any IP block.
5. SEC-008/009/010, INT-001, TEST-001.
6. Remove `'unsafe-inline'` from `script-src` — large (every inline handler), the long-term XSS control.

### Pending decisions for the owner
See SECURITY_DESIGN.md, "Decisions that need the owner's approval". Also: whether the
Security Overview should be shareable outside the app (it is admin-only today).

### Git
Branch `main`. Commits of this session are listed in `git log --since=2026-09-24`.
Pushed to `origin` only (CLAUDE.md). Untracked user files in the repo root (`.pptx`, `.zip`,
`.xlsx`, `presentation/`, `.codex-diagnostics/`, `AGENTS.md`) and modified `.claude/launch.json`,
`package.json` were **not touched and not committed**.

### Local environment notes
- The local MySQL is XAMPP's (`C:\xampp\mysql\bin\mysqld.exe --defaults-file=...\my.ini --standalone`),
  not the MySQL 8.4 service; it is not started automatically.
- Suites: `cd backend && VERIFY_BASE=http://localhost:3210 node scripts/verify-<name>.js`.

### Exact next action
Build `security_events` (additive table in `schemaExtensions.js` + `services/securityEvents.js`
buffered writer), record `auth.login_failed` / `auth.login_throttled` / `authz.*_refused`, and
extend `verify-security-boundaries.js` to assert each is recorded and that no password or token
ever reaches the table.
