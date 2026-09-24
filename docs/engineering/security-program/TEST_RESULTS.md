# Test results — 2026-09-24

Everything below was run in this session against a local server (`http://localhost:3210`,
XAMPP MySQL, `NODE_ENV=development`). **Nothing was run against production.**

```bash
cd backend
VERIFY_BASE=http://localhost:3210 node scripts/verify-security-boundaries.js
```

## The regression suite proves the bugs were real

`verify-security-boundaries.js` states correct behaviour, so it has to fail on the old code.

| Run | Code | Result |
|---|---|---|
| Before fixes | `c564c2f` + suite only | **8 passed, 19 failed** — every finding reproduced |
| After fixes | working tree | **27 passed, 0 failed** |
| After Security Overview (SEC-UI block added) | working tree | **35 passed, 0 failed** |

The 8 that passed on the old code are the positive controls (own school, platform admin),
so the suite does not just refuse everything.

## Every other suite, after the fixes

| Suite | Result | Note |
|---|---|---|
| verify-role-matrix | 125 / 125 | was 124; the new `#security` page is picked up and asserted in `adminPages` |
| verify-teacher-scope | 61 / 61 | |
| verify-school-chain | 55 / 55 | |
| verify-phone-intake | 59 / 59 | |
| verify-spares | 45 / 45 | |
| verify-lifecycle | 41 / 41 | first run hit the wrong port (see below) |
| verify-whatsapp | 38 / 38 | |
| verify-visits | 37 / 37 | |
| verify-maintenance | 33 / 33 | |
| verify-knowledge | 30 / 30 | |
| verify-frontend-safety | 19 / 19 | GSAP vendored file scanned: no `eval` / `new Function` |
| verify-offline-dedup | 7 / 7 | |
| verify-heartbeat | 20 / 21 | **pre-existing, unrelated** — TEST-001 |
| verify-trends | skipped itself | precondition: needs a school with no faults; none exists locally. Changed nothing |

### Harness findings made on the way

- Six suites hardcoded `http://localhost:3100` and ignored `VERIFY_BASE`, so against any
  other port they failed with no summary line. They now read `VERIFY_BASE` like the rest.
- **TEST-001:** `verify-heartbeat.js`'s sweep opened critical tickets QFT-0379…0383 for five
  real seeded LRS devices. Removed in one transaction, using `lrs_history` to restore each
  device's previous status (`Online`) exactly: errors 478–482, their audit rows 432–436,
  `lrs_history` 14–18, plus three orphans from other suites (notification 145, audit 410,
  error_update 102). Final counts: users 22, errors 88 — the same as before the session.

## Browser verification (Security Overview, `#security`)

Signed in as a temporary `zzverifyadmin` fixture (removed afterwards).

| Viewport | Checked |
|---|---|
| 1440 × 900 | wide flow layout; stats 4-up; two-column cards; no horizontal overflow |
| 1024 (pane) | renders after page fade; console clean |
| 920 × 1000 | two-column blocks collapse; no overflow |
| 768 × 1024 | layer numbers drop, rings above the list; no overflow |
| 748 (pane) | flow switches to the vertical layout below a 720 px stage |
| 375 × 812 | header centred; stats 2 × 2; review list stacks with level shown; 32 px touch targets; no overflow |

Flow scenarios checked by state after playback: *cross-school* stops at "Your school?" with 4
checkpoints passed and 5/5 steps lit; *password guessing* ends with "Who are you?" ×3 refused
and the gate closed. Copy briefing: fixed to copy synchronously after the async clipboard was
seen to stay pending in the embedded browser.

## Not tested

- Anything on production: no requests were sent to `support.mkatolikikiganjani.com`.
- Real email/SMS delivery (not configured locally; nothing sends).
- Proxy IP attribution (THREAT_MODEL T9) — needs the live proxy.
