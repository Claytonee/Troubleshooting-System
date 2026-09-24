# TROUBLESHOOTING SYSTEM — FINAL SECURITY & ENGINEERING REPORT

**System:** Opportunity Education Tanzania — Technical Support System (`support.mkatolikikiganjani.com`)
**Period:** 2026-09-24 · commits `6a4a4c7` … this report (base `c564c2f`)
**Status:** **READY FOR HUMAN REVIEW.** Not certified, not externally assessed, and not "secure"
in any absolute sense. Everything below states how it was verified, and the limits are listed
as limits.

---

## 1. Summary

The review covered the whole application: 154 API endpoints, four roles (teacher, school
administrator, field engineer, platform administrator), every page that renders stored data,
the integrations (WhatsApp, SMS/USSD, LRS heartbeat, deploy webhook) and the deployment path.

- **18 findings** were recorded, reproduced and fixed. Three were P1: another school's fault
  could take attachments, stored text could run as script in a platform admin's browser, and six
  dependencies had known vulnerabilities. Each fix has a regression test that fails on the old
  code.
- **Controls that did not exist were built:** revocable sessions, two-step sign-in for
  platform admins, a record of every refused request, eight detection rules with incidents and
  alerts, a report-only strict script policy, a data-retention job, a deploy preflight with
  rollback, and a pre-push gate.
- **26 decisions** (D1–D26) are recorded with their reasons and the conditions for revisiting
  them. The riskiest ones deliberately stop short of automation: nothing blocks traffic, and
  nothing deletes data, until the owner has the evidence and the backup.
- **Tests:** 21 suites, **788 assertions, 0 failures**, together with syntax, asset-version,
  endpoint-inventory and dependency checks. The pre-push gate runs all of it: 26/26.
- **Production** runs the programme's first commit (`0eb36d5`). The fixes after it are pushed
  but not yet running, because that version needs one manual restart (§7).

## 2. Scope and method

1. **Discover:** read every router and controller; build the endpoint matrix (auth, role gate,
   scope) and check it against the code on every push.
2. **Threat model:** assets, actors, the request path, trust boundaries, and STRIDE by boundary
   (THREAT_MODEL.md).
3. **Reproduce before fixing:** each finding got a failing test first. A fix counts only when
   that test passes and the rest stay green.
4. **Decide in writing:** where there was a real choice (blocking, alerting, MFA method,
   retention), the options, the choice and the "revisit when" go in DECISIONS.md.
5. **Never test attacks against production.** All attack traffic ran against a local server
   and database with synthetic `zzverify*` accounts. The suites remove what they create, and the
   gate also removes the evidence its own attacks leave behind (TEST-002).

Sources: OWASP ASVS 5.0, OWASP API Security Top 10 (2023), NIST CSF 2.0, NIST SP 800-61r3,
NIST SP 800-63B, RFC 6238, the Tanzania Personal Data Protection Act 2022, and the vendors'
documentation. RESEARCH_LIBRARY.md records how each was read: several official pages (NIST
included) refused the connection, and those are marked as leads to confirm, not citations.

## 3. Findings

| ID | Pri | Finding | Fix | Verified by |
|---|---|---|---|---|
| SEC-001 | P1 | Any signed-in user could attach files to any school's fault | Access checked before files; `canActOnSchool()` | `verify-security-boundaries.js` |
| SEC-002 | P2 | School forms, and a field engineer's school detail, unscoped | Scoped per record | same |
| SEC-003 | P1 | Stored text ran as script in a platform admin's session (LRS, inventory, check-ins, faults, registration) | Every stored field escaped; server-side enums | same |
| SEC-004 | P2 | Field engineer could write check-ins and communications for schools not theirs | Scoped writes and deletes | same |
| SEC-005 | P2 | A token could not be revoked before its 7-day expiry | `token_version` in the token; password change, reset, suspension and "Sign out everywhere" end sessions | same, `verify-teacher-scope.js` |
| SEC-006 | P2 | Failed sign-ins and refusals were not recorded | `security_events`: every 401/403/429, route templates only | `verify-security-boundaries.js` |
| SEC-007 | P2 | No second factor for platform admins | TOTP + recovery codes, required from 2026-10-08; console break-glass | `verify-mfa.js` (36) |
| SEC-008 | P3 | Public appeal and teacher-status endpoints took guessable input | Proof required; uniform answers | `verify-security-boundaries.js` |
| SEC-009 | P3 | Password throttle was per account *per network* only | Per-account ceiling from anywhere | same |
| SEC-010 | P3 | 5 × 100 MB attachments held in memory | 15 MB per fault attachment | same |
| SEC-011 | P2 | Admin-set passwords permanent, 6 characters allowed, sessions left alive | 8-character minimum, change on first sign-in, sessions revoked | same |
| SEC-012 | P1 | Six vulnerable production dependencies (one high) | Patched; `npm audit` high/critical fails the gate | gate step 4 |
| SEC-013 | P3 | Tokens accepted in HS384/HS512 beside the HS256 we issue | Algorithm pinned at every verify site | `verify-token-policy.js` |
| SEC-014 | P3 | Production CORS answered every origin | Same-origin only unless `FRONTEND_URL` names others | same |
| INT-001 | P3 | Fault codes reissued after deletion; a race duplicated them | Sequence table and unique index | `verify-integrity.js` |
| OPS-001 | P2 | A deploy left the old process serving next to the new files | Preflight, rollback, self-restart | `verify-deploy-preflight.js` |
| TEST-001 | P2 | A test suite swept real devices and deleted rows it did not create | Rewritten on baselines; database restored | `verify-heartbeat.js` |
| TEST-002 | P3 | The gate left test evidence that reopened an incident | Gate removes its own loopback events | gate output |

Evidence, root cause and before/after for each: ISSUE_REGISTER.md and TEST_RESULTS.md.

## 4. What the system now does

| Layer | Control |
|---|---|
| Transport | HTTPS redirect, HSTS 1 year, Let's Encrypt (host-managed) |
| Sign-in | bcrypt; throttles per account+network, per network, per account from anywhere; TOTP for platform admins; 8-character minimum |
| Sessions | JWT (HS256 pinned), 7 days, revocable per account; a two-step ticket is never a session |
| Authorisation | Role gate on every router; per-record school scope; a 125-assertion role matrix; the endpoint inventory checked on every push |
| Input / output | Parameterised SQL; every stored field escaped; server-side enums; CSP blocks foreign scripts; a strict policy runs report-only |
| Integrations | HMAC or shared key on every inbound callback; all fail closed; rejections recorded |
| Evidence | `audit_log` for administrative actions; `security_events` for every refusal (90 days) |
| Detection | R1–R8 every minute → deduplicated incidents → one bell alert each (SMS for high when configured). **Alert-only.** |
| Response | Incidents are acknowledged and closed with an outcome, and a false positive is counted; runbook with PDPC notification |
| Data protection | PDPA record; the AI gets the role, never the name; retention reported daily, deleted on the owner's switch |
| Change safety | Pre-push gate; deploy preflight with rollback and self-restart; additive migrations only |
| Explaining it | Security Overview (`#security`): an animated request journey, layers with their evidence, live checks, incidents, standards and labelled limits |

## 5. Decisions (full text in DECISIONS.md)

| | Decision |
|---|---|
| D2–D3 | Record every refusal; revoke per account, never a mass sign-out |
| D4 | TOTP, not SMS (SIM swap), for platform admins first |
| **D5** | **No automatic IP blocking yet.** Detect and alert, measure false positives for 30 days, verify proxy IP attribution first. A whole school shares one address. |
| D6 | Alerts go to the bell always; email and SMS when configured |
| D7–D9 | 15 MB attachments; proof on public registration endpoints; a per-account guessing ceiling |
| D13–D22 | One decision per standard (NIST functions, ASVS, API Top 10, PDPA); limits labelled by kind |
| D23 | Deploys preflight, roll back on failure, restart themselves |
| D24 | Strict CSP: report, migrate, then enforce |
| **D25** | **Retention reports daily and deletes only after the owner confirms a backup**; accounts are never deleted by the job |
| D26 | The verifier picks the token algorithm; no cross-origin answers in production |

## 6. Standards: where it stands (no certification is claimed)

| Standard | State |
|---|---|
| NIST CSF 2.0 | Govern, Identify, Protect, Detect **in place**; Respond and Recover **partial**: the first tabletop exercise and the first production restore drill are due |
| OWASP ASVS 5.0 | Mapped chapter by chapter (SECURITY_BASELINE.md). Remaining gaps: inline script still allowed while enforced, token in `localStorage`, logs not tamper-evident, no malware scan on uploads |
| OWASP API Top 10 (2023) | API1, 2, 5, 6, 9 covered and tested; API4 covered at the application level; API8 and API10 partial; API7 not exposed |
| Tanzania PDPA 2022 | Documented, minimised, retention built. PDPC registration, transfer grounds and the privacy notice are head office's steps |

## 7. Production state and the owner's actions

The live site runs **`0eb36d5`** (checked 2026-09-24 16:28 UTC), with files already at asset
`v61`. The deploys after it pulled the files, but the running process predates the self-restart
(D23), so the backend is behind the frontend. **Until a restart, the fixes after `0eb36d5` are
not live in production.**

In order:
1. **Restart the app once:** cPanel → Setup Node.js App → Restart. Then check that
   `curl -s https://support.mkatolikikiganjani.com/api/health` shows the latest commit as `build`.
   Later deploys restart themselves.
2. **Set `MFA_ENCRYPTION_KEY`** (a long random value) in the panel, then have every platform admin
   enrol in two-step sign-in **before 2026-10-08**.
3. **Run the IP-attribution check** on production (`GET /api/security/seen-as`, with and
   without a forged `X-Forwarded-For`). Nothing may block by IP before it passes.
4. **Confirm hosting backups and run the first production restore drill** (RECOVERY.md). Then
   decide on `RETENTION_ENFORCE=1`.
5. **Hold the tabletop exercise** within 30 days (INCIDENT_RESPONSE.md).
6. **PDPA:** register with the PDPC, record the ground for each transfer abroad, publish the
   privacy notice.

## 8. Limits, stated plainly

- **REMOTE MAC BLOCKING: NOT TECHNICALLY AVAILABLE.** A website never sees a device's hardware
  address: the school router replaces it and phones randomise it. The system blocks by account
  and session instead. Device-level blocking belongs in the school's own Wi-Fi.
- **No automatic IP blocking** (D5). Blocking waits for the attribution check and 30 days of
  measured false-positive rates. Even then it would be an application-level block, with no edge
  protection against network floods: there is no CDN or WAF in front of the site.
- **Two-step sign-in is enforced for platform admins only**, and a real-time phishing proxy can
  relay a TOTP code. Only passkeys stop that.
- **Inline script is still allowed** by the enforced CSP: 321 inline handlers await migration
  (D24). Escaping is therefore still the first line against XSS.
- **Logs are not tamper-evident.** A database administrator could edit them.
- **Recovery is proven on a copy**, not yet on a production backup.
- **Nothing here is a certification.** No outside party has assessed the system.

## 9. Next engineering work

1. After the restart, the attribution check (§7.3). Then, after 30 days of incidents with
   outcomes, decide short, reviewed IP blocks (D5 d).
2. Migrate inline handlers to delegated `data-action` handlers, module by module. Enforce the
   strict CSP once browsers have reported zero inline sites for 30 days.
3. Offer two-step sign-in to school administrators; consider passkeys for platform admins.
4. Hash-chain `audit_log` and `security_events` so that edits are detectable.

## 10. How to reproduce every claim here

```bash
cd backend && VERIFY_BASE=http://localhost:3210 node scripts/prepush.js
```
It needs a local MySQL/MariaDB and the server on port 3210. Suites create `zzverify*` fixtures and
remove them. They refuse to run destructive steps when real data would be touched, and must never
be pointed at production.

## Appendix: commits

| Commit | Change |
|---|---|
| `6a4a4c7` | Let every verification suite take VERIFY_BASE |
| `f87672f` | Close four holes where an id reached another school's data (SEC-001…004) |
| `d30582f` | The Security Overview page |
| `0eb36d5` | Decisions D1–D11 — **running in production** |
| `1d90d70` | Record every refusal (SEC-006) |
| `3567582` | Standards D13–D22, self-checks, deploy preflight (D23) |
| `d7a6dc8` | Revocable sessions, per-account throttle (SEC-005, 009, 011) |
| `8e8bbef` | Fault-code sequence, registration proof, 15 MB attachments (INT-001, SEC-008, 010) |
| `37632f1` | Dependencies patched; audit in the gate (SEC-012) |
| `616070f` | Two-step sign-in for platform admins (SEC-007) |
| `697fae8` | Detection rules, incidents and alerts (D5 b, D6) |
| `1a71c98` | Strict CSP, report-only (D24) |
| `8e57eea` | Retention job (D25); the gate cleans up after itself (TEST-002) |
| `3e81814` | Token algorithm pinned; same-origin CORS (SEC-013, 014, D26) |
| `51d2a25` | The Security Overview's statements corrected and pinned by a test |
