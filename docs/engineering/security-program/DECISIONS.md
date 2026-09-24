# Decision record

Decisions delegated by the owner on 2026-09-24 ("fanya world class decision na kisha push").
Each one says what was decided, why, and what would make us revisit it. They authorise the
**design**; each is still built, tested and shipped as its own change.

## D1 — Ship phase 1 to production · Decided: yes

The four fixed findings include two P1s that are live on production today. Leaving a known,
reproduced cross-school write and a stored-XSS path deployed is the larger risk. Shipped with
the Security Overview page, which is admin-only and read-only.

## D2 — Record failed sign-ins and refusals (SEC-006) · Decided: yes, next

Nothing in detection or incident response works without evidence, and every framework consulted
starts there (AWS: *maintain traceability*; NIST CSF 2.0: *Detect*). Built exactly as
SECURITY_DESIGN.md §1 specifies: buffered and deduplicated, route templates rather than URLs,
never a password, token or body, 90-day retention.

## D3 — Revoke sessions without signing everyone out (SEC-005) · Decided: yes, no mass sign-out

`users.token_version INT DEFAULT 0` (additive), carried in new tokens as `tv`. A token **without**
`tv` counts as version 0, so every session in use today stays valid: no forced sign-out, no
announcement needed. The version is bumped on password change, admin password reset, suspension
and "sign out everywhere". This removes the only reason this needed approval.

## D4 — Second factor for platform admin (SEC-007) · Decided: TOTP, not SMS

- **TOTP** (RFC 6238, any authenticator app) plus ten one-time recovery codes, shown once and
  stored hashed.
- **Not SMS.** NIST SP 800-63B treats SMS one-time codes as a *restricted* authenticator because
  of SIM swap and number porting. A platform admin account is the target that justifies avoiding it.
- **Rollout:** a 14-day enrolment window with a banner, then enforced for the `admin` role.
  Other roles are optional later. School devices are shared and teachers often have no
  authenticator phone, so enforcing it on them would lock out the people the system serves.
- **Break-glass:** a documented server-side reset (hosting panel access required), audited.
  There is no bypass reachable from the web.

## D5 — Automatic IP blocking · Decided: not yet. Detect and alert first, block later

The practice at AWS and Cloudflare is to run a new rule in **count / log mode** first, measure
false positives, and only then switch it to block. Two facts make that essential here:

1. A whole school shares one public IP (NAT). Blocking a network blocks a staffroom.
2. Whether `req.ip` can be spoofed behind LiteSpeed is **unverified** (THREAT_MODEL T9). An IP
   block keyed on a spoofable address is a tool an attacker can turn against a school.

So the order is fixed:

- (a) Verify proxy IP attribution on production.
- (b) Ship the detection rules alert-only.
- (c) Review 30 days of results.
- (d) Then allow only **temporary (≤ 1 h) automatic** blocks, for **high-confidence rules on
  single addresses** (R4 cross-school probing, R5 webhook forgery), with a human able to lift
  them.
- R2 (spraying from one IP) stays alert-only because of NAT.
- Permanent and CIDR blocks remain manual, with a reason, forever.

## D6 — Where alerts go · Decided: the bell always; email and SMS when configured · **Built 2026-09-24**

The in-app bell (`admin_notifications`, platform admin) is the only channel that works on
production today (`/api/health`: `email:false`). Email to the support mailbox is added the day
SMTP is configured. SMS goes to the platform admin's phone for **high** severity only, through
Africa's Talking. One alert per incident, never one per event.

## D7 — Attachment size (SEC-010) · Decided: 15 MB per file for fault attachments

The report form already shrinks photos to ~80 KB. 15 MB still takes a short video of a fault.
The worst case per request falls from 500 MB held in memory to 75 MB. Manuals, which only a
platform admin can upload, keep the 100 MB limit.

## D8 — Public registration endpoints (SEC-008) · Decided: require proof, uniform answers

An appeal must carry the registration **email** as well as the id. Teacher status answers only
to the id issued at registration plus the email, with the same response whether or not the
account exists. This is the standard defence against account enumeration (OWASP Authentication
Cheat Sheet).

## D9 — Distributed guessing (SEC-009) · Decided: add a per-account ceiling

Keep 20 per account+network (staffroom fairness) and 120 per network. Add 60 per account across
all networks in 15 minutes: enough for a whole staffroom's typos, far below what guessing needs.
D2 makes every refusal visible.

## D10 — Security Overview audience · Decided: platform admin only

It shows configuration and account posture, which is useful to an attacker. Stakeholders get the
**Copy briefing** text, and a printable export can come later. It is not published as a public page.

## D11 — Commit attribution · Decided: keep the Co-Authored-By trailer

CLAUDE.md (checked into the repository) requires it and every recent commit carries it. An older
personal note said the opposite; the repository's rule wins because it is the one the whole
history follows. The note has been corrected.

## Standards — how each moves to "in place"

Decided 2026-09-24 on the owner's second delegation ("fanya world class decision pia na haya").
A standard is marked *in place* only when the thing it asks for exists **and** is kept true by
a test or a routine. A document alone is not enough.

### D13 — NIST Govern · Decided: adopt a written policy; the platform admin owns security

[SECURITY_POLICY.md](SECURITY_POLICY.md): roles, access, sign-in, change control, monitoring,
incidents, recovery, and a quarterly access review. It names one accountable owner, because a
duty everyone shares is a duty nobody performs. **Status: in place.**

### D14 — NIST Identify · Decided: the inventory checks itself

`node scripts/api-matrix.js --check` compares the endpoint matrix (143 today) with the routers and fails
on any new, changed or removed route. It runs inside `verify-security-boundaries`. A new
endpoint cannot ship without someone recording its security gate. **Status: in place.**

### D15 — NIST Protect · Decided: stays in place; the gaps are queued, not hidden

The two real gaps are the second factor (D4) and `'unsafe-inline'` in the CSP. Both are listed on the page.

### D16 — NIST Detect · Decided: record now, rules and alerts next

Recording shipped (SEC-006). It becomes *in place* when D5's alert-only rules raise alerts on the
bell (D6). **Status: partial.**

### D17 — NIST Respond · Decided: adopt the runbook; our own 72-hour notification rule; rehearse quarterly

[INCIDENT_RESPONSE.md](INCIDENT_RESPONSE.md). The PDPA says "without undue delay" and sets no
deadline. We decide within 24 hours whether personal data was affected, and notify the PDPC within
72 hours of confirming it: a fixed rule is easier to meet than a judgement made during a crisis.
People affected are told when harm is likely, although the Act does not require it. **Status:
partial until the first tabletop exercise, due within 30 days.**

### D18 — NIST Recover · Decided: RPO 24 h, RTO 4 h, monthly restore drill

[RECOVERY.md](RECOVERY.md) and `scripts/verify-backup-restore.js`. The drill is proven on a copy
(9/9, and on its first run it found seven orphaned rows left by a test suite). **Status: partial
until the first drill on a production backup, which needs the owner to download one.**

### D19 — OWASP ASVS 5.0 · Decided: target Level 1 in full, Level 2 for sign-in, sessions and access; no certification claim

Level 1 is the baseline ASVS itself recommends as a first step. Level 2 on V6–V8 matches what an
attacker here would actually aim at: accounts and school isolation. We claim no level until each
requirement is ticked in SECURITY_BASELINE.md, and "certified" only after an outside assessor has looked.

### D20 — OWASP API Security Top 10 (2023) · Decided: map all ten and test the ones that bit us

The mapping is in SECURITY_BASELINE.md. API1 (object-level authorisation) caused three of the four
fixed findings and is tested on every run. API9 (inventory) is now tested too. Open: API2 (second
factor, D4) and API4 (upload size, D7).

### D21 — Tanzania PDPA 2022 · Decided: document, minimise, and name what only head office can do

[DATA_PROTECTION.md](DATA_PROTECTION.md): every personal-data column, who sees it, the processors
and where they are, and retention periods. **Minimised today:** the AI assistant no longer sends
the asker's name to AWS in the US. It gets the role only, and a test pins this. Retention periods
are decided, and the job that applies them is built (D25). Registration with the PDPC, the ground
for each cross-border transfer, and the privacy notice are organisational steps for head office.

### D22 — "Honest limits" on the page · Decided: say which kind of limit each one is

Each limit carries one label: **Planned**, **Partly done**, **Impossible: here is what we do
instead**, or **Constraint: how we handle it**. A reader must be able to tell "we cannot" from
"we have not yet".

## D23 — Deploys restart themselves, after a preflight, or roll back

**Problem, measured:** on 2026-09-24 the push of `0eb36d5` pulled the files, but the old process
kept serving for more than an hour, next to the new static files, until someone pressed Restart
in cPanel. The webhook touches `backend/tmp/restart.txt`, and this LiteSpeed/CloudLinux host does
not act on it reliably. The same half-state was recorded on 2026-09-09.

**Decided:** after `git reset` and `npm install`, the webhook asks whether the new checkout can
boot (`services/deployPreflight.js`: every file under `src/` compiles, and every dependency in
`package.json` resolves).
- **If not**, it resets to the commit that was serving, keeps the old process, and answers
  `rolled_back` with the problems. A half-broken build never replaces a working one.
- **If so**, it answers, then exits its own process 1.5 s later; the host starts the new build
  on the next request. The restart file is still touched as well.

`DEPLOY_SELF_RESTART_MS=0` turns the self-restart off.

**Why this and not more:** a shared cPanel host offers no blue/green slots and no health-checked
rolling restart. A preflight plus rollback plus self-restart is the closest equivalent that
host allows.

**Limits:** the preflight does not prove the app *runs*: a thrown error at boot would still get
through. The first deploy of this change is handled by the old webhook and still needs one
manual restart; every deploy after it restarts itself. **Verified:** 10 assertions in
`verify-deploy-preflight.js` on real directories broken on purpose. The proof in production is
the next deploy changing `/api/health`'s `build` without anyone pressing Restart.

## D24 — The strict script policy: report first, migrate, then enforce

**Problem:** the enforced CSP allows inline script because the app has 321 inline event handlers
and one inline script block. Escaping is therefore the only thing standing between a stored-XSS
bug and a stolen session (SEC-003 showed that is not hypothetical).

**Decided:** the order Google's CSP guidance and OWASP both describe.
1. Send the strict policy (`script-src 'self'`) as **Content-Security-Policy-Report-Only** next to
   the enforced one. Nothing breaks.
2. Keep what the browsers report as a **bounded inventory**: one row per site (directive, blocked,
   file, line) with a counter, flushed every 5 minutes. It holds hundreds of rows at most,
   however busy the system is. Recording each report as an event would have meant over a million
   rows a day.
3. Treat a **foreign script or an eval** as what it looks like: injected code. It is recorded as a
   security event, and rule **R8** turns it into a high incident.
4. Migrate module by module to delegated handlers (`data-action`); the Security Overview shows
   how many sites browsers still report.
5. **Enforce** when that number has been zero for 30 days.

**Verified:** `verify-csp.js` 15/15: the header on HTML, API and script responses; the endpoint in
both report formats, refusing oversized bodies; 1,000 reports becoming one row; no query
strings or tokens kept; foreign scripts and eval becoming events while inline handlers don't. In
Chrome, real reports were sent (`disposition: report`) and the inline handler still ran.

## D25 — Retention: count every day, delete only when the owner switches it on

**Problem:** D21 set retention periods (PDPA s.28), but nothing applied them, so the record said
"decided, not enforced" and personal data outlived its purpose indefinitely. Deleting is the one
thing in this programme that cannot be undone, and CLAUDE.md forbids data-losing changes without
an explicit, backed-up confirmation.

**Decided:** one job, two modes.
1. **Report** (default): daily, count what each policy would remove. The Security Overview
   shows it, counted fresh on every view: a cached count showed a deleted row for a day in testing.
2. **Enforce** (`RETENTION_ENFORCE=1`, set by the owner after confirming a backup): delete in
   batches of 1,000, children first, one audit entry per policy per run.
3. **Accounts are never deleted by the job.** Faults, visits and the audit trail refer to people
   by id; deleting an account breaks those records, and anonymising it is a judgement. The job
   counts accounts deactivated over a year ago and a person decides.
4. **Precise edges.** A *pending* registration is kept however old (nobody has decided it yet); a
   WhatsApp conversation is aged by its **last** message, not its first.

**Rejected:** deleting straight away, because the periods are ours but the backup is not proven
(RECOVERY.md: first production restore drill outstanding). A `deleted_at` soft delete was
rejected too: a row that is still stored is not deleted under s.28.

**Verified:** `verify-retention.js` 26/26 on backdated fixtures, including a regression that
fails on the cached version and a baseline check that stops the suite before enforce mode if any
real row is due, so the test cannot delete somebody's data.

## D26 — The verifier chooses: one token algorithm, no cross-origin answers

**Decided:** tokens are HS256 only and every verify site says so (SEC-013); production answers
cross-origin requests only for origins named in `FRONTEND_URL`, none by default (SEC-014). Both
live in `config/httpPolicy.js`, so the next person to add a verify call or an origin finds the rule
in one place, and `verify-token-policy.js` fails on a verify call that skips it.

**Why now:** both were found while correcting SECURITY_BASELINE.md, whose V9 row said
"algorithm not pinned explicitly" and whose V4 row named the CORS default. A known gap written
down and left is still a gap. Neither change affects a user: every token we issue is HS256, and
nothing legitimate calls the API from another origin.

**Revisit when:** a second frontend on another origin appears (name it in `FRONTEND_URL`), or
tokens move to asymmetric signing (the list changes, the rule does not).

## D27 — Guided tours: offered once, five stops at most, kept on the account

**Problem:** a new account opened onto up to eighteen sidebar items with no explanation.
The owner asked for the walk-through that large products give a newcomer.

**Decided** (research in docs/features/12-guided-tour.md):
1. **Offer, never impose.** The first sign-in shows a card with "Show me around" and
   "Not now". Tours people choose finish about twice as often as pushed ones (67% vs 31%),
   and NN/g found pushed tutorials are forgotten.
2. **Five stops at most per tour**, enforced by a test: completion falls to 16% at seven.
3. **Pull-style help where the work is:** "Show me how" on the report form, started by the
   person on that page.
4. **Progress on the account, not the device.** School tablets are shared.
5. **Build, don't vendor.** Shepherd is AGPL. Driver.js covers only the spotlight; the work
   here is this app's routing, drawer, roles and server-side progress.
6. **No new inline handlers** (D24): delegated `data-tour-start`, enforced by a test.
7. **Every existing account is offered it once**, on their next sign-in. Nobody has had any
   onboarding so far; one click declines it for good.

**Verified:** `verify-tour.js` 75/75, including headless Chrome at 1440, 920 and 375 px for
all four roles.

**Revisit when:** someone is seen stuck on a page with no tour (add a page tour; the server
already accepts `page:tracker`, `inventory`, `visits`, `teachers` and `security`), or the
sidebar changes (the content test fails if a stop points at a page its role cannot open).

## D28 — When the address is a claim, record it as unknown

**Problem:** SEC-015. On this host a visitor can make the app see any address they choose,
and the real one is lost before the request reaches Node.

**Options considered:**
1. Believe the proxy (the old behaviour): every address-keyed control can be dodged.
2. Refuse requests that carry a client-supplied header: breaks nothing legitimate today (the
   site is HTTPS-only, so no proxy on the way adds one), but it tells an attacker exactly what
   we check, and a refused request leaves less evidence than a recorded one.
3. **Attribute them to `0.0.0.0`** — chosen. They still work, but they share one allowance, and
   they are recorded as "address unknown" with a flag.

**Consequences:** D5 (blocking by address) stays off. The attribution check failed, so its
precondition is not met, and it cannot be met in the app. It is re-run after the host change.
Audit entries for claimed requests say `0.0.0.0`, which is true: the address is not known.

## D29 — A printed password is compromised: refuse the public pair, force a change otherwise

**Problem:** SEC-016. Passwords printed in a public repository were in daily use.

**Options:** (1) refuse every printed password at sign-in: correct in principle, but the local
database showed thirteen real teachers and the owner's own account on `admin123`; the same on
production would lock schools out the moment it deployed. (2) Force a change only: leaves the
seeded accounts, whose **usernames** were printed too, to whoever signs in first. (3) **Both, by
risk**: chosen.

**Decided:** the seed's usernames with a printed password are refused (the whole credential is
public). Any other account on a printed password signs in but must choose a new one first; the
attacker would need to guess the username and beat the real person to it, and R9 tells the
platform admin about every such sign-in. Nothing can set a printed or guessable password again.
Blank means a random temporary password, shown once. A locked-out platform admin uses
`scripts/password-reset.js` on the server, which a stranger cannot reach.

**Revisit when:** the Security Overview's list is empty on production. Then refusing every printed
password costs nobody anything, and the forced-change path can go.

## D12 — Order of work (phase 2)

1. D2 security events.
2. D3 token versioning.
3. Verify proxy IP attribution (D5 a).
4. D4 TOTP.
5. D5 detection rules, alert-only, plus D6 alerts.
6. D7, D8, D9 small fixes, together with INT-001 and TEST-001.
7. After 30 days of alert data: review, then D5 (d).
8. Standards (D13–D22): first tabletop exercise within 30 days; first production restore drill;
   then switch retention enforcement on (D25, built); the owner's PDPA steps.

## Revisit when

- A CDN or WAF is put in front of the site: edge blocking becomes possible, so revisit D5.
- SMTP is configured: turn on D6 email.
- 30 days of D2 data are in: set D5 and D9 thresholds from measured rates, not guesses.
