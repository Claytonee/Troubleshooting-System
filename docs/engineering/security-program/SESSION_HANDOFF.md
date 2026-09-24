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

### Also done since (afternoon)
- SEC-006 recording shipped (`1d90d70`).
- Standards decided (D13–D22): policy, incident runbook, data-protection record, recovery plan,
  inventory self-check, restore drill, AI no longer sends names abroad, honest limits labelled.
- TEST-001 fixed (the heartbeat suite no longer deletes other rows).
- OPS-001: deploys restart themselves after a preflight, or roll back (D23).
- `scripts/prepush.js` is the gate to run before every push.

### Open — in the order fixed by DECISIONS.md D12
1. **D2 / SEC-006 security events** — everything in detection depends on it.
2. **D3 / SEC-005 token versioning** — tokens without `tv` count as version 0, so there is no mass sign-out.
3. Verify proxy IP attribution on production (THREAT_MODEL T9, D5 a) **before** any IP block.
4. **D4 / SEC-007 TOTP for platform admin** — 14-day enrolment window, then enforced.
5. Detection rules **alert-only**, plus alerts to the bell (D5, D6).
6. SEC-008/009/010, INT-001, TEST-001 (D7–D9).
7. Remove `'unsafe-inline'` from `script-src` — large (every inline handler), the long-term XSS control.

### Decisions
All the pending decisions were taken on 2026-09-24 under the owner's delegation: see
[DECISIONS.md](DECISIONS.md). Phase 1 was approved for production and pushed (D1).

### Git
Branch `main`. Commits of this session are listed in `git log --since=2026-09-24`.
Pushed to `origin` only (CLAUDE.md), with the owner's approval (D1). Untracked user files in the repo root (`.pptx`, `.zip`,
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
