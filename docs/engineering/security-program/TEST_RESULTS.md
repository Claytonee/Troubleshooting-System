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

## Detection rules and alerts — D5 (b), D6 (2026-09-24)

| Check | Result |
|---|---|
| `verify-detection.js` | **24 / 24**, run twice back to back. Real attack-shaped traffic opens R1–R7, each exactly one incident with one bell alert; a second run adds no incident or alert but grows the count; only the platform admin reads incidents; closing needs an outcome; the audit trail records it; **nothing is blocked** |
| Bug found and fixed before shipping | `INSERT … ON DUPLICATE KEY UPDATE` reported an unchanged duplicate as "1 affected row, insertId 0", so repeats sent a second alert pointing at incident 0. Now `INSERT IGNORE` + `UPDATE`, with a regression assertion that no alert points at a missing incident |
| R6 across two tables | the UNION failed on this server (different collations in `security_events` and `audit_log`); now two queries |
| Browser | the incidents card names account, role, school, count and time; evidence expands to the events; the bell lists security alerts with their own icon, and one click opens the Security Overview |

## D24 — strict CSP, report-only (2026-09-24)

| Check | Result |
|---|---|
| Inline handlers measured | 321 (`on*=` attributes) + 1 inline script block |
| `verify-csp.js` | **15 / 15** |
| Chrome, real page | `securitypolicyviolation` fired with `disposition: report`; `POST /api/security/csp-report` → 204; the inline handler still ran |

## D25 — retention (2026-09-24)

| Check | Result |
|---|---|
| `verify-retention.js` | **26 / 26**: one row just past and one just inside each period (25/23 months, 13/11, 13/6, 91/30 days) |
| Report mode | counts exactly the one old row per policy; deletes nothing |
| Enforce mode | removes only rows past their period, with their appeals and messages; a pending registration 30 months old stays; a conversation started 20 months ago but active 2 months ago stays whole |
| Accounts | an account deactivated 13 months ago is counted and **not** deleted, even when enforcing |
| Audit | one `retention.removed` entry per policy; a second run removes and writes nothing |
| Regression | the overview's count after a row disappears: **failed on the cached first version** (25/26), passes on the fix |
| Safety | the suite checks that no real row is due before it enforces, and stops if one is |
| Browser | the Security Overview's live checks show "Data retention (report-only)" with each period |

## SEC-013 / SEC-014 — token algorithm and CORS (2026-09-24)

| Check | Before | After |
|---|---|---|
| HS384 token under our secret → `/api/auth/profile` | **200** | 401 |
| HS512 token under our secret → `/api/auth/profile` | **200** | 401 |
| `alg: none` token | 401 | 401 |
| Every `jwt.verify(` in `src/` passes `JWT_VERIFY` | — | 2 / 2 call sites; **fails** with the old `auth.js` restored |
| `corsOrigin()` production, no `FRONTEND_URL` | reflect any origin | `false` (none) |
| `verify-token-policy.js` | 3 passed, 2 failed | **10 / 10** |

## Security Overview accuracy pass (2026-09-24)

Found while taking the review screenshots: the page still said "seven rules" after R8 shipped,
"nothing alerts on them yet" after detection shipped, "196 assertions" after the security suite
grew to 86, and listed the second factor and upload size as open API risks after both closed.
All corrected. `verify-detection.js` now fails if any rule count on the page differs from
`RULES.length` — it failed on the old page (`["seven","seven","seven"]`), 25/25 on the fix.

## D27 — guided tours (2026-09-24)

| Check | Result |
|---|---|
| `verify-tour.js` | **75 / 75**: API 15, content 18, headless Chrome 42 |
| Browser coverage | all four roles at 1440 px and 375 px (plus 920 px); spotlight on target, bubble on screen and clear of the target, focus inside, drawer open for sidebar stops on a phone |
| Bugs found by the suite before shipping | (1) the offer was spent the moment the card appeared, so a reload lost it for good: now recorded at the first real stop. (2) replaying a finished tour and pressing Esc turned "completed" into "dismissed": statuses are now ranked. (3) the report form's button was empty: a build script had evaluated `${…}` in Node. (4) harness: `load()` returned while the old page still answered "complete"; and a browser that failed to start was reported as a skip, a false green. It now throws. |

## D5 a — production IP attribution (2026-09-24, first run after the restart)

`curl --resolve support.mkatolikikiganjani.com:443:213.139.204.238 …/api/security/seen-as`, from 197.186.57.130:

| Sent | ip before the fix | After the fix (`d7c5d44` → this commit) |
|---|---|---|
| nothing | 197.186.57.130 | 197.186.57.130 |
| `X-Forwarded-For: 203.0.113.77` | **203.0.113.77** | 0.0.0.0, `claimed: true` |
| `X-Forwarded-For: 203.0.113.77, 198.51.100.9` | **203.0.113.77** | 0.0.0.0, `claimed: true` |
| `X-Real-IP: 203.0.113.99` | 197.186.57.130 | 197.186.57.130 |

**Result: FAILED**, and recorded as SEC-015. `verify-client-ip.js`: **1/9 before, 9/9 after**; on the old
code, three made-up addresses became three evidence rows and rotating addresses was never refused.

## SEC-016 — printed passwords (2026-09-24)

| Check | Before | After |
|---|---|---|
| `verify-passwords.js` | **6 passed, 24 failed** | **32 / 32** |
| Seeded username + printed password (`admin` / `admin123`, local) | signed in | 403 `PUBLISHED_PASSWORD`, account unchanged |
| Private username + printed password | signed in | signs in, must change first; high event; R9 incident |
| Blank password on create / reset (field engineer, school admin, teacher) | `changeme123` / `Teacher@NNNN` | random `XXXX-XXXX-XXXX`, shown once, must change |
| Security Overview count, local database | "0" | **18**, named (1 platform admin, 3 field engineers, 13 teachers, 1 fixture) |
| Suites that used the printed password | 5 | 0; 2 silent skips removed; 1 suite no longer overwrites the real admin's password |
| Browser | — | refusal message on the sign-in form; the Security Overview banner names the accounts; the temporary-password dialog copies and closes |

## D30 — production watch (2026-09-25)

| Check | Result |
|---|---|
| `watch-production.js` against the live site (`600d0ed`) | **13 / 13**: up, database, latest commit, certificate (73 days left), HSTS, CSP enforced and report-only, nosniff, two protected routes 401, forged address recorded as 0.0.0.0 |
| A stale deploy (expected commit 83 minutes newer than the running one) | **fails**, "the deploy did not restart the app" |
| A deploy still in progress (expected commit 1 minute old) | passes, marked "deploy in progress" |
| An unreachable host | fails on the first check and stops (no minutes of repeated timeouts) |
| `verify.yml` | runs on the push that adds it; its result is on the Actions tab |
| First runs on GitHub (`2882ff7`) | **not started**: "account is locked due to a billing issue". Workflow correct as far as GitHub read it; the jobs never ran. Scheduled watch paused (`disabled_manually`) until billing is fixed |

## Administrator password recovery (2026-09-25)

| Check | Result |
|---|---|
| `verify-passwords.js` | **39 / 39**: both administrator reset APIs accept a valid typed password, never echo it, revoke the prior session, set `must_change_password`, and accept the replacement at sign-in; generated-password behavior remains covered |
| Complete pre-push gate | **29 / 29 checks passed** after the local MariaDB service was restored; 914 assertions across all executed suites, 159 JavaScript files parsed, endpoint matrix current at 156, and no high/critical dependency advisories |
| cPanel terminal, synthetic platform admin | `node scripts/password-reset.js zzverify_breakglass --prompt --yes` accepted two hidden entries; bcrypt comparison true; `must_change_password=1`; `token_version` 7 → 8; audit action `auth.password_reset_break_glass`, method `masked_prompt`; fixture and audit row removed |
| Command-line exposure | No option accepts a password as an argument. `--prompt` uses terminal raw mode; default mode still generates and prints a one-time temporary password |
| Administrator UI | Browser prompt and visible text field replaced by labelled password + confirmation fields with reveal controls, mismatch recovery, session-revocation warning, and secure-generation fallback |
| Responsive browser verification | 520×800, 768×900, 920×900, 1280×900: dialog fully inside viewport, no page/modal horizontal overflow, both inputs remained `type=password`; mobile field width 479 px, larger widths 439 px |
| Interaction verification | Initial focus lands on the first field; reveal changes only that field to text and the accessible label to “Hide password”; mismatched entries leave the dialog open, keep the action enabled and show “The passwords do not match” without calling the API |

## D34 — trusted browsers (2026-09-26)

| Check | Result |
|---|---|
| `verify-trusted-devices.js` | **35 / 35**: opt-in only; app code only (never a recovery code); cookie HttpOnly, SameSite=Strict, `/api/auth`, 30 days / 14 for admins; SHA-256 at rest; password still required; bound to its account; tampered, expired, forgotten, "sign out everywhere" and re-enrolment all ask for the code again; ten per account; audited; no secret in any evidence |
| Browser (headless Chrome, 1440 and 390 px) | box unticked by default; tick, code, sign out, sign in: **no code asked**; the Two-Step window lists "this browser"; Forget empties it |

## FLOW-001 — routed faults reach a bell (2026-09-26)

| Check | Result |
|---|---|
| `verify-escalation-notices.js` | **37 / 37**: a teacher's fault is on the school admin's bell and nobody else's; "Escalate to OE" puts it on head office's bell (with the reason) and on the field engineer's; a second escalation is refused and writes no second notice; critical and school-admin reports reach the engineer at once; a school with no engineer is flagged to head office as unassigned; Assign reaches the engineer, only head office may Assign, Open becomes In Progress and Escalated stays Escalated; WhatsApp and USSD/SMS call the same helper |
| Browser (headless Chrome, 1440 and 390 px) | the school admin's bell lists the teacher's fault; clicking it opens that fault with **Escalate to OE** |

## D35 — How It Works (2026-09-26)

| Check | Result |
|---|---|
| `verify-workflows.js` | **144 / 144**: every stated number equals the code's constant; every "who may" claim matches a route guard or UI condition; all buttons the guide names exist in the frontend; every diagram hop is an edge, no nodes overlap, every node is placed inside the drawing; staff-only nav and hash guard |
| Browser (headless Chrome) | platform admin at 1440 / 920 / 768 / 520 px, school admin and field engineer at 1440: diagram drawn, "the school escalates" plays to the end, no horizontal overflow, wide drawing above 800 px and narrow below, every label inside its box, tabs swap in place, "the link says no" ends in a refusal. A teacher is sent away from `#workflows` and has no nav item |
