# Session handoff

## State at 2026-09-24 (end of day) — READY FOR HUMAN REVIEW

Every finding in ISSUE_REGISTER.md is fixed, each with a regression suite that fails on the old
code. Every decision the programme needed is recorded in DECISIONS.md (D1–D25) with its reasons.
Nothing is described as approved, certified or closed beyond what the owner has approved.

### Built and verified (local gate: every suite green before each push)
| Area | What | Decision / issue |
|---|---|---|
| Tenant scope | `canActOnSchool()` for every single-record handler | SEC-001/002/004 |
| Rendering | every stored field escaped; server-side enums | SEC-003 |
| Sessions | `token_version` in the JWT; password change, reset, suspension and "Sign out everywhere" end sessions | D3, SEC-005/011 |
| Two-step sign-in | TOTP + recovery codes for platform admins, required from 2026-10-08; console break-glass | D4, SEC-007 |
| Evidence | `security_events`: every refusal, route templates only, 90 days | D2, SEC-006 |
| Detection | R1–R9 → incidents → one bell alert each; **alert-only** | D5 b, D6 |
| Browser policy | strict CSP in report-only mode with a bounded inventory; foreign scripts → R8 | D24 |
| Retention | daily report per policy; deletes only with `RETENTION_ENFORCE=1`; accounts never auto-deleted | D21, D25 |
| Guessing | per-account ceiling across networks; public registration needs proof | D8, D9 |
| Tokens and origins | HS256 pinned at every verify site; production CORS same-origin only | D26, SEC-013/014 |
| Integrity | fault codes from a sequence table | INT-001 |
| Supply chain | dependencies patched; `npm audit` high/critical fails the gate | SEC-012 |
| Deploys | preflight, rollback, self-restart; the pre-push gate | D23, OPS-001 |
| Test harness | suites provision and remove their own data; the gate removes the events and incidents it causes | TEST-001, TEST-002 |
| Onboarding | Guided tours: offered once per account, five stops per role, "Show me how" on the report form; tested in headless Chrome | D27 |
| Checks on every push | `.github/workflows/verify.yml`: the whole gate on a clean machine (MariaDB, headless Chrome) | D30 |
| Production watch | `.github/workflows/watch.yml` every 30 min: up, database, latest commit, certificate, headers, 401s, SEC-015; GitHub emails the owner on failure | D30 |
| Explaining it | Security Overview (`#security`, platform admin only): animated request journey, layers with evidence, live checks, incidents, standards, labelled limits | D10, D22 |

### Waiting on the owner (the code cannot do these)
**First: GitHub has locked Actions on the account for a billing issue** (every run on 2026-09-25 ended
"The job was not started because your account is locked due to a billing issue"). Until it is
resolved in GitHub → Settings → Billing, neither CI nor the production watch can run. The scheduled
watch is paused so it does not email a failure every 30 minutes; after the fix, turn it back on with
`gh workflow enable watch.yml` (or Actions → Production watch → Enable workflow) and re-run Verify.

0. **Open the Security Overview on production and reset every account it lists under "Published
   passwords"** (SEC-016). Field engineers: Sub-Admins → Reset Pass; school admins: School Admins →
   reset; if `admin` itself is listed and refused: `cd backend && node scripts/password-reset.js admin --yes`
   in the cPanel terminal. Teachers on a printed password are made to change it at their next sign-in.
1. **Ask the host to stop trusting a visitor-supplied `X-Forwarded-For`** (LiteSpeed's *Use Client
   IP in Header* setting). This is SEC-015: until it changes, a visitor can choose the address the
   system sees, which the app now records as unknown. Then re-run the check in TEST_RESULTS.md (D5 a).
   *(The one-time restart is done: production restarted on 2026-09-24 and now deploys itself.
   It ran `4eda5df` within minutes of the push, so OPS-001 is proven.)*
2. **Set `MFA_ENCRYPTION_KEY`** in the panel before any admin enrols, then have every platform
   admin enrol before 2026-10-08.
3. **Confirm the hosting backup and run the first production restore drill** (RECOVERY.md), then
   set `RETENTION_ENFORCE=1` (D25).
4. **PDPA steps** (DATA_PROTECTION.md): PDPC registration, the ground for each cross-border
   transfer, the privacy notice.
5. **Tabletop exercise** within 30 days (INCIDENT_RESPONSE.md).

### Next engineering work, in order
1. The IP-attribution check ran on production on 2026-09-24 and **failed** (SEC-015, mitigated in the
   app, D28). Re-run it after the host change (`GET /api/security/seen-as` with and without a
   forged `X-Forwarded-For`, THREAT_MODEL T9). Only a pass allows any IP block (D5 a).
2. After 30 days of incidents with outcomes: review false positives, then decide temporary
   blocks (D5 d). Until then nothing is blocked.
3. Migrate the 321 inline handlers to delegated `data-action` handlers, module by module; enforce
   the strict CSP once the report-only inventory stays at zero for 30 days (D24).

### How to verify anything here
```bash
cd backend && VERIFY_BASE=http://localhost:3210 node scripts/prepush.js
```
Local MySQL is XAMPP's (`C:\xampp\mysql\bin\mysqld.exe --defaults-file=...\my.ini --standalone`),
not started automatically. The local server is the `qft-server` entry in `.claude/launch.json`.

### Git
Branch `main`, pushed to `origin` only (CLAUDE.md), one commit per piece of work with the
Co-Authored-By trailer. Untracked user files in the repo root (`.pptx`, `.zip`, `.xlsx`,
`presentation/`, `.codex-diagnostics/`, `AGENTS.md`, `package-lock.json`) and the modified
`.claude/launch.json` and root `package.json` are the owner's and were **not committed**.
