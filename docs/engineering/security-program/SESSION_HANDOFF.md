# Session handoff

## 2026-09-24 — phase 1: discovery, containment, Security Overview

**Phase:** system-wide discovery and threat model done; confirmed P1/P2 access-control and
XSS findings fixed; the Security Overview page shipped. **READY FOR HUMAN REVIEW** — not
approved or closed.

### Done
- Threat model, baseline (ASVS 5.0 / CSF 2.0), 143-endpoint API matrix, research library.
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
- SEC-005 session revocation (D3), SEC-011 admin resets, SEC-009 per-account throttle fixed.
- SEC-008 status tokens, SEC-010 15 MB attachments, INT-001 fault-code sequence fixed.
- SEC-012 dependencies patched (npm audit 0, now in the gate); secret scan clean.
- SEC-007 two-step sign-in (D4): enforced for platform admins from 2026-10-08.
- Detection rules R1–R8 + incidents + bell alerts (D5 b, D6), alert-only.
- Strict CSP in report-only mode with a bounded migration inventory (D24).

### Open — in the order fixed by DECISIONS.md D12
1. **D2 / SEC-006 security events** — everything in detection depends on it.
3. Verify proxy IP attribution on production (THREAT_MODEL T9, D5 a) **before** any IP block.
7. Migrate the 321 inline handlers to delegated `data-action` handlers, module by module; enforce the strict CSP when the report-only inventory stays at zero for 30 days (D24).

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
