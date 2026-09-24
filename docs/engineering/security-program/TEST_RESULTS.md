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

## SEC-006 — security events (later on 2026-09-24)

| Check | Result |
|---|---|
| `verify-security-boundaries.js` | **49 / 49**, run twice back to back (the second run inside the first run's 60 s dedup window) |
| Direct service test: record → flush → delete row → repeat | repeats landed in a new row (count 2), not lost |
| Burst: 200 concurrent anonymous probes, distinct ids | **1 row, count 200**, 0.84 s for all 200 requests |
| All other suites after the change | role-matrix 125, teacher-scope 61, school-chain 55, phone-intake 59, whatsapp 38, spares 45, lifecycle 41, visits 37, maintenance 33, knowledge 30, frontend-safety 19, offline-dedup 7 — all passing |
| Browser: "What the system refused" card | counts and bars match the rows; no overflow at 748 px |

Production check (read-only): after the owner restarted the app, `/api/health` reported build
`0eb36d5`, and `/api/security/overview` and `/api/errors/1/attachments` answered 401 to an
anonymous request. That is the new code: the old process answered 200 on the first.

## Standards batch, TEST-001 and OPS-001 (2026-09-24, afternoon)

| Check | Result |
|---|---|
| `scripts/prepush.js` (new gate): syntax of 131 files, asset versions, endpoint inventory, every suite | see the final run in the commit message |
| `verify-heartbeat.js` after the TEST-001 rewrite | **21 / 21**; before/after snapshot of devices, faults, updates, audit, history, notifications **identical**; 5 devices parked and restored |
| `verify-security-boundaries.js` right after `verify-heartbeat.js` (the dedup collision) | first **49 / 51**: exposed that the dedup key ignored the reason, so a forged token folded into a missing-token row. After the fix **52 / 52**, including a new regression for exactly that |
| `verify-deploy-preflight.js` | **10 / 10**; the real backend passes, and copies broken four ways each fail for the right reason; 16.3 s → 0.1 s after switching to in-process compilation |
| `api-matrix.js --check` | matches 142 endpoints; a tampered row is caught (exit 1); `--write` round-trips with zero diff |
| `verify-backup-restore.js --self` | first run **8 / 9**: found 7 orphaned `error_updates` rows left by the old heartbeat suite. After removing them **9 / 9**: dump 1.2 s, restore 1.4 s |
| Browser, Security Overview | 9 standards with their new statuses and 5 labelled limits render; no overflow at 748 px |

## SEC-005 / SEC-011 — session revocation (2026-09-24)

| Check | Result |
|---|---|
| New assertions in verify-security-boundaries.js | **19 / 19**. Pre-versioning token still accepted (no mass sign-out); password change ends other devices, keeps this one with a fresh token; sign-out-everywhere; admin reset needs 8+ chars, forces change and ends sessions; a token from before a suspension stays refused after reactivation; every revocation recorded with its reason |
| Endpoint inventory | caught the new POST /api/auth/sessions/revoke-all before it was recorded (exit 1), as designed; matrix regenerated to 143 |
| Browser | profile menu shows Sign Out Everywhere; Auth.signOutEverywhere is wired |

## SEC-009 and the throttle itself (2026-09-24)

Nothing had ever tested the login throttle. Now 4 assertions do (see SEC-009). Found on the way:
the gate's suites tripped the production login limit on their own fixture account. Non-production
now runs 10× looser, production is unchanged, and a test pins the production numbers.
`verify-teacher-scope.js` now asserts D3 as well (62/62): a token from before a suspension is
still refused after reactivation, and the suite signs in again.

## SEC-008, SEC-010, INT-001 and the address check (2026-09-24)

| Check | Result |
|---|---|
| `verify-integrity.js` (new) | **7 / 7**: 25 simultaneous reports get 25 codes; a deleted fault's code is not reissued; unique index present; no code path computes MAX()+1 |
| Old logic, same race | 25 concurrent `MAX()+1` callers → **1** code (QFT-0384). The new sequence → 25 |
| `verify-security-boundaries.js` | **86 / 86** (+8 SEC-008, +2 SEC-010, +1 seen-as) |
| `GET /api/security/seen-as` | works locally. Locally a forged `X-Forwarded-For` *does* win, because there is no proxy in front and `trust proxy 1` trusts the last hop. **The real test is on production**, where LiteSpeed is that hop |

## Dependencies and secrets (2026-09-24)

| Check | Result |
|---|---|
| `npm audit --omit=dev` before | 6 advisories: 1 high (nodemailer), 5 moderate |
| after `npm audit fix` + nodemailer 10 | **0** |
| nodemailer 10 smoke test (`jsonTransport`) | sendMail builds and addresses the message correctly |
| Secret scan, tracked files + full history | clean (one documentation placeholder) |
| `.env` ever committed | never; only `.env.example` |

## SEC-007 — two-step sign-in (2026-09-24)

| Check | Result |
|---|---|
| RFC 6238 appendix-B vectors (SHA-1, 8 digits) | **6 / 6** |
| `verify-mfa.js` | **36 / 36**: policy as a pure function; secret encrypted at rest; wrong code doesn't enable; enabling ends other sessions; password alone → ticket only; ticket isn't a session; codes and recovery codes work once; a session token isn't a ticket; admin can't disable; teacher opt-in and opt-out with password + code; all six event types recorded |
| Browser, end to end | enrolled via the menu (QR + key + code), recovery codes shown once in a locked screen; sign-out; password → code step; wrong code refused **without** signing out; right code (computed in the page with WebCrypto, at human speed) signed in |
| A code computed ~4.5 min before submission | refused: expired, as intended. That's how the test harness's latency showed up; the flow itself is fine |
| Banner date | first showed "7 October" (UTC formatting of a midnight-EAT deadline); now formatted in Africa/Dar_es_Salaam → "8 October 2026" |
| `scripts/mfa-reset.js` (break-glass) | without `--yes`: refuses (exit 2). With it: two-step off, secret and recovery hashes wiped, token_version 1 to 2 (every session ended), audit row `auth.mfa_reset_break_glass` written; a second run changes nothing; password-only sign-in works again |
