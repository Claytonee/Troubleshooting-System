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
`node scripts/password-reset.js admin --prompt --yes` on the server. The password is entered twice
through a masked terminal prompt—never a command-line argument—so it is not left in shell history or
process listings. Omitting `--prompt` retains the secure generated-password recovery path. Both paths
end every session, force a change at the next sign-in, and write an audit row. A stranger cannot reach
this server-console recovery path.

**Revisit when:** the Security Overview's list is empty on production. Then refusing every printed
password costs nobody anything, and the forced-change path can go.

## D30 — The gate runs on a clean machine, and production is watched from outside

**Problem:** 788+ checks existed, but only on the machine that pushed. Pushing to `origin`
deploys the live site, so nothing stopped broken code from shipping. Nothing told anyone
when the site went down either: the in-app bell is part of the app.

**Decided:**
1. **`.github/workflows/verify.yml`** runs the whole pre-push gate on every push and pull
   request: a fresh MariaDB 10.6, the app from its own bootstrap and seed, headless Chrome for
   the browser suites, throwaway secrets generated per run. No production secret is used.
2. **`.github/workflows/watch.yml`** runs `scripts/watch-production.js` every 30 minutes against
   the live site: up, database reachable, latest commit running (20 minutes allowed for a deploy),
   certificate valid with 14+ days left, security headers present, protected routes returning 401,
   and a forged address still not believed (SEC-015). Read-only GET requests, no credentials.
   GitHub emails the owner when a run fails, which does not depend on the site being up.
3. **Free, and no new account:** the repository is public, so Actions minutes are free. A
   third-party uptime service would have meant creating an account on the owner's behalf.

**Not decided here:** whether the repository should stay public. SEC-016 showed what a public
repository costs when a secret is written into it. That is the owner's call; CI and the watch
keep working if it goes private, within the free private-repository minutes.

**Revisit when:** a staging site exists (deploy there first, then promote), or the watch's
30-minute interval proves too slow for the schools' needs.

## D31 — A locked-out Platform Admin recovers by email link, never by username alone

> **Superseded by D32** before it shipped. The link flow was replaced by one recovery for every
> role; its principles (same answer for every identifier, email sent after the answer, secrets
> hashed, sessions ended, two-step untouched) carry over.

**Problem:** D29's server-console reset needs cPanel access. The request was a public "admin
portal" that resets the Platform Admin password. If knowing the username were enough, that page
would be the easiest way to take over the most powerful account.

**Options:** (1) a public reset form keyed on the username: an account-takeover path, refused.
(2) cPanel only: safe, but slow for an admin who still has their email. (3) **A one-time link sent
to the address already on the account, with cPanel kept as the fallback**: chosen (OWASP Forgot
Password Cheat Sheet, NIST SP 800-63B §6.1.2.3).

**Decided:**
1. **"Forgot password?" on the sign-in page** asks for a username or email and always answers the
   same 202 with the same text, whether the account exists, is a teacher, is inactive or has no
   email. The answer is padded to 400 ms and the email is sent *after* it, so SMTP latency cannot
   reveal an account either. Only active `admin` accounts get a link.
2. **The link** carries 256 random bits in the URL fragment (never sent to the server in logs or
   the Referer header). Only its SHA-256 is stored, in `password_recovery_tokens`. It expires in 15
   minutes, works once, and a new link or a completed reset spends every other. A link whose email
   failed is spent at once. It is built from `APP_URL` (else the first `FRONTEND_URL`), never from
   the request's Host header. The page removes it from the address bar as soon as it is read.
3. **Completing it** sets the password (policy checked, entered twice), bumps `token_version` so
   every session ends, and writes an audit row and security events with no token or password in
   them. A second email says the password was changed. **Two-step sign-in is untouched:** the link
   proves the email, not the authenticator, so the next sign-in still asks for a code.
4. **Throttles:** 20 requests per network and 5 per identifier per 15 minutes; one link per account
   every 2 minutes and 3 per hour; 10 reset attempts per network per 15 minutes.
5. **Retention:** spent or expired links are deleted 30 days later (D25).
6. **When email is not an option** (SMTP unset or the mailbox lost), D29's
   `node scripts/password-reset.js admin --prompt --yes` on the server remains the path; a lost
   authenticator is D4's `node scripts/mfa-reset.js <username> --yes`. Both need the hosting
   terminal. The page points there and offers nothing else.

**Revisit when:** SMTP is configured on production (until then every request ends at
`delivery_unavailable` and the console path is the only one), or a second person becomes a
Platform Admin, who could then reset another's password from inside the app.

## D32 — Every staff account uses the authenticator, and recovers with two of three proofs

**Problem:** the owner asked that school admins and teachers, like the platform admin, be able to
reset a forgotten password themselves — by the authenticator app or by an emailed code — with the
authenticator made mandatory at first sign-in, a prompt after two wrong passwords, and no terminal
for the platform admin either. Taken literally, either factor alone would reset the password: a
borrowed phone, or an email inbox, would be the whole account.

**Research (September 2026):** GitHub asks for the email link *and* a 2FA code or recovery code
when a 2FA account resets its password. Microsoft Entra forces a "two-gate" policy (two methods)
on every administrator and recommends two for everyone. Google uses the authenticator and ten
single-use backup codes. NIST SP 800-63B-4 §4.2: recovering an AAL2 account needs a recovery code
plus a bound authenticator, or two recovery codes obtained by different methods; email is not an
acceptable out-of-band authenticator. OWASP: recovery must be no weaker than sign-in, answer the
same for real and unknown accounts, and never lock accounts.

**Decided:**
1. **Required for every staff role** (`mfaPolicy.REQUIRED_ROLES`: admin, subadmin, school,
   teacher). The app asks at every sign-in; from `MFA_ENFORCE_STAFF_AFTER` (default 9 October
   2026, two weeks out; the admin keeps D4's 8 October) nothing works until it is set up. The
   setup screen says to use one's **own phone, not a shared school tablet** — D4's reason for not
   forcing teachers. The ten recovery codes cannot be dismissed without ticking "I have saved
   these somewhere other than my phone". Nobody on a staff role can turn it off.
2. **Recovery = two of three**, the same flow for every role: a 6-digit code emailed to the
   address on the account (10 minutes), a code from the authenticator app, or one saved recovery
   code. Any two work, so a lost phone (email + recovery code) and a dead mailbox (authenticator +
   recovery code) are both covered. An account that has not enrolled yet uses the email code alone
   — exactly what it needs to sign in anyway. Afterwards the person is signed in on that device,
   every other session ends, a notice is emailed, and two-step sign-in stays on.
3. **Two wrong passwords in a row** open "Forgot your password?" on the sign-in page. It is shown
   for names that do not exist too, and nothing is ever locked.
4. **Nothing reveals an account:** `/recovery/start` returns the same 202 and fields for any
   identifier (unknown ones get a real flow row, so later answers match too), padded to 400 ms,
   with the email sent after the answer.
5. **Nothing secret at rest:** flow ids and reset tokens as SHA-256; email codes as an HMAC keyed by
   the server secret and bound to their flow; recovery codes as SHA-256 (D4). Codes are checked
   before any is spent, so a wrong second code does not burn a good first one. Five tries per flow;
   throttles per network and per identifier; one email per account per minute, five per hour.
6. **Lost phone *and* recovery codes:** the person's own line of support clears their two-step
   sign-in from inside the app, after confirming who they are by phone, with a current code from
   their own authenticator (`POST /api/auth/mfa/assist-reset`): a school admin for their teachers,
   a field engineer for their schools' people, a platform admin for anyone else. Optionally a
   temporary password, shown once. Audited, emailed, sessions ended. The terminal scripts (D29, D4)
   remain only for a sole platform admin who has lost everything — add a second platform admin to
   remove that case too.
7. D31's link table (`password_recovery_tokens`) only ever existed in an unpushed commit, so it is
   simply no longer created — there is nothing on production to contract, and CLAUDE.md forbids a
   `DROP` without a separate step the owner confirmed. `account_recovery_flows` is kept 30 days
   past expiry (D25).
8. **The owner's audit trail** gets `auth.recovery_requested` only after SMTP confirms that a code
   was actually sent to a real, eligible account: the account id and `{ email: "sent" }`, never the
   name typed, the code or the flow. Unknown, ineligible and failed-delivery starts stay in
   `security_events` only, so an anonymous caller cannot flood `audit_log`.
9. **Both emails have an HTML version** as well as the text, branded "OE Technical Support", with no
   link at all — a recovery email that never asks you to click is easier to tell apart from
   phishing. **The header is the sign-in page**: the gold Opportunity Education mark, the words
   “Opportunity Education Tanzania” set in Axiforma, then “Technical Support”; the official
   horizontal logo (the unmodified light-background asset published at `opportunityeducation.org`)
   closes the email where `.oe-footer-logo` puts it on that page. All three are **inline CID
   attachments, never remote images** — an email that fetches is an email that reports who opened
   it — and each carries alt text for a client with images turned off.

   They are images because email is not the web: Gmail and Outlook strip `@font-face`, so Axiforma
   as live text silently renders as Arial, and they drop inline SVG entirely. `scripts/build-email-wordmark.js`
   renders the wordmark and the mark from the very `.woff2` and `.svg` the browser loads, through
   headless Chrome, so the email and the sign-in page cannot drift apart; the PNGs are committed, so
   no deploy needs a browser. The heading and the code itself are OE navy (`#073763`) and
   “Nobody from OE will ever ask you for this code.” is OE crimson (`#c02b0a`), inlined because
   email has no CSS variables — `verify-account-recovery.js` holds all of it in place.

**Not done:** SMS codes (D4), security questions (OWASP, NIST), or any recovery by one proof.

**SMTP is configured on production:** `/api/health` answered `"email": true` (build `8642907`) at
2026-09-25 17:29 UTC, so emailed codes work there.

**Before 9 October 2026:** schools must be told that **each teacher needs their own phone** for the
authenticator — from `MFA_ENFORCE_STAFF_AFTER` the app is unusable without it. The date is an
environment variable the owner can move without a deploy, and the supervisor reset (point 6) covers
lost phones.

**Revisit when:** the teachers' `@school.oetz.org` addresses are confirmed to be real mailboxes, or
passkeys become practical on the schools' phones.

## D33 — A dashboard tile must change somebody's next action

**Problem:** the owner's brief was that data is expensive, and that what goes on a dashboard must be
*data that matters* — per level, and only if it leads to a decision. Audited against that, the page
failed three ways. The SLA tile counted breaches by filtering a list the backend caps at `LIMIT 6`,
so on a twenty-five-breach day it reported six — the one figure meaning *we are failing a school
right now* was the one that could not tell the truth, and had been wrong since it was written. The
`school` role fell through head office's query filtered to one row and was shown *Schools Healthy:
1/1*, a tautology, and *Week N Check-Ins: 0/1*, a binary dressed as a fraction. And a grep for
`tablet|lrs|heartbeat|maintenance|spare|visit|csat` over the dashboard frontend returned **0** —
the fleet, the heartbeat, the maintenance schedule and the spares stockout were all collected and
none of them shown, while *Guides Available: 24* and *Total Reported: all time* held prime tiles.

**Decision:** one test for every figure — *if this number changed, what would this person do
differently today?* No answer, no tile. The four roles get four separate queries and four separate
renders (`docs/features/13-dashboards-by-level.md`): head office gets the dispatch question, a
school administrator gets their devices, their queue, their LRS and their checks due, a teacher gets
whether their own report is moving and what to try while they wait, an engineer gets the queue and
what to load into the vehicle. Direction and term-scale analysis stay on `#analytics`, which already
holds thirteen weeks of it.

**Rules that came out of it:** never count over a list (count in SQL over every row; the list beside
it is a top-N); nothing measurable means `null`, never 0 or 100%; on-time is windowed to 30 days
because a lifetime figure barely moves; order a queue by what is late, then by severity; `spares_needed`
is `max(0, down − spares)` and *short of spares* is not *no spares at all*; format an age rather than
printing raw minutes; one banner per page, and a blackout outranks a clock.

**Verified by:** `backend/scripts/verify-dashboards.js` — 34 assertions, including one that
reproduces the LIMIT-6 undercount (eight breaches created; the count must match the database and
exceed the list beside it) and one that ties the school administrator's "waiting on you" to the
routing rule in `errorController.create()`.

**Not done:** cost-per-school, device cost-to-date and batch failure rates. The lifecycle columns
exist (feature 4) but are unpopulated, and a procurement figure computed from empty columns is worse
than none. Revisit when purchase data is entered.

## D34 — Ask for the authenticator on a new browser, not at every sign-in

*Written as D33 on 2026-09-26 and renumbered the same day, because D33 was already the dashboard
decision (a4d3a4e). Commit 7f11e17 calls it D33.*

**Problem (reported by the owner, 2026-09-26):** every time a session ended, signing in asked for the
authenticator code as well as the password. The app signs people out after 15 idle minutes, so that
was a code every idle quarter-hour. That kind of friction makes people resent the second step
instead of valuing it.

**Research:** Microsoft Entra's *remember multifactor authentication* sets a persistent browser
cookie after a successful MFA sign-in ("Don't ask again for X days", 90 days or less recommended),
and revoking the user's sessions revokes it. Google offers "Don't ask again on this computer". NIST
SP 800-63B-4 lets an AAL2 subscriber reauthenticate "using only a successful password … in
conjunction with the session secret", and sets AAL2 inactivity at no more than one hour.

**Decided:**
1. **"Trust this browser"** is a tick box on the code step, **off by default** because school tablets are
   shared. The box says so in plain words. When ticked, later sign-ins on that browser need only the
   password. A new browser, a new computer, a cleared cookie or another account on the same tablet is
   asked for the code as before.
2. **Only after a code from the app.** A sign-in with a recovery code is never remembered: it usually
   means the phone is gone, and a stolen recovery code must not plant a 30-day trust.
3. **30 days, 14 for a platform admin**, because the account with the most reach gets asked most often.
4. **The secret:** 256 random bits in an **HttpOnly, SameSite=Strict** cookie scoped to `/api/auth`, `Secure`
   in production. Script on the page cannot read it, and it travels only to sign-in. Only its SHA-256 is
   stored (`trusted_devices`), bound to one account (`oe_td_<id>`), at most ten per account.
5. **It ends with the sessions:** each trust carries the session version it was made under, so a password
   change or reset, "Sign out everywhere", a suspension or a supervisor's two-step reset ends every trusted
   browser at once. A new authenticator ends trusts made with the old one.
6. **Visible and revocable:** the Two-Step window lists each trusted browser ("Chrome on Windows",
   last used, until) with **Forget** and **Forget all**. Trusting and forgetting are audited, and a
   password-only sign-in is recorded as `auth.login_ok` with `second_factor: trusted_browser`, so
   R3 still sees it.
7. **The idle sign-out is 30 minutes**, up from 15. NIST allows up to 60 at AAL2; 30 keeps some margin
   for shared tablets.

**Not done:** trusting by network or IP address (SEC-015: this host lets the visitor choose the address).

### D34a — Amended 2026-09-26, same day, because point 1 did not work in practice

**What happened:** the owner reported the identical complaint again, with a screenshot. Everything in
D34 was built, deployed and correct — the probe below passes on the shipped build — but **the tick box
defaulted to OFF**, so in real use nothing changed. A remedy nobody notices is not a remedy. It shipped
with **no verification coverage at all**, which is exactly why the gap survived: `verify-mfa.js` never
signed in twice.

**Amended:**

1. **"Trust this browser" is ticked by default.** The password is still always required; this only
   decides whether the CODE is asked for again on a browser that has already proved both factors. The
   copy now reads *"your password alone will be enough here from now on — untick this on a shared
   school tablet, so the next person is still asked for a code."* Shared tablets are protected by an
   untick and by the visible Forget list, not by making every engineer type a code all day.
2. **The idle sign-out depends on the browser.** 30 minutes on an untrusted one, as before. **Eight
   hours — a school day — on a trusted one**, because it holds the trust cookie and 800-63B-4 permits
   reauthentication with the password in conjunction with the session secret. `login` now answers
   `trusted_browser: true` so the page knows which it is. That flag is a **comfort setting, never a
   permission**: every request is still checked by `authenticate()`, the trust itself is an HttpOnly
   cookie the page cannot read, and the worst somebody can do by editing it is make their own browser
   ask them sooner.
3. **Thirteen assertions now cover it** in `verify-mfa.js`: the cookie's flags and path, that the secret
   never comes back in the body, that a second sign-in on that browser needs the password only and says
   so, that a different browser and a forged cookie are still challenged, that a recovery code never
   plants a trust, and that Forget all puts the challenge back.

**The residual risk, stated plainly:** on a shared tablet where somebody forgets to untick, a colleague
who already knows that person's password no longer needs their code for up to 30 days. That is the
trade the owner asked for, it is what Microsoft and Google default to, and it is bounded by the Forget
list, by the session-version revocation in point 5 above, and by 14 days rather than 30 for a platform
admin.

**Revisit when:** passkeys become practical on the schools' devices (a passkey *is* the second factor, so
nothing needs remembering), or when expired `trusted_devices` rows need a retention policy. Today they go
at the account's next trust, and with the account.

## D35 — Explain the two processes people ask about, and check the explanation against the code

**Asked by the owner (2026-09-26):** a guide showing how a school admin registers and is approved,
how they create the link their teachers register with (and its limit), and how a teacher is approved.
Then a second guide for the whole fault chain, from the teacher to the school admin, to head office, to
the field engineer, including how head office assigns one.

**Decided:**
1. **One page, "How It Works" (`#workflows`), for staff: platform admin, field engineer and school
   admin.** Every one of them takes part in both processes. Teachers are left out because the page
   describes other people's screens. Their own steps are already on the report form and in their tour.
2. **Drawn, then written.** Each guide opens with the animated path (the Security Overview's flow
   drawing, reused) and scenario chips: a school admin joins, rejected then an appeal, teachers join
   through a link, the link says no; and for faults: fixed at the school, the school escalates, a critical
   fault, the school admin reports, head office assigns. Under it: numbered steps naming the exact buttons,
   and a short "Worth knowing" table. The numbered list is the text equivalent of the drawing.
3. **The guide is tested like code** (`verify-workflows.js`). Every number (7-day link, 1–500 cap,
   suggestion = on file + 5, 8-character password, 5 photos, 1–5 rating, response targets, the categories
   and the six escalation reasons) is compared with the constant it describes. Every button the guide
   names must exist in the frontend. Every hop in a diagram must be a drawn edge. Every label must fit
   its box, measured in a browser at 1440, 920, 768 and 520 px.
4. **Write only what is true, and fix what is not.** Checking each step before writing it found
   FLOW-001: escalation told nobody, routing to an engineer did not reach the engineer's bell, and the
   school admin's bell never drew a teacher's fault. It was fixed first (3bc1f5b), and the guide
   describes the fixed behaviour.

**Not done:** a separate copy inside the school admin's User Guide (`#help`). One page for every
role cannot drift from itself; two copies would.

**Revisit when:** registration, escalation or assignment changes. The suite fails first, which is the point.

## D36 — Explainer videos: evaluate HyperFrames on one 30-second prototype, outside the app

**Asked (2026-09-26):** a PowerCert-style technical explainer, "How a School Connects to the Internet", made
with HyperFrames + GSAP + SVG. The request said to stop after one prototype for human review, and the owner
said "make the world class decision".

**Decided:**
1. **HyperFrames is the engine under evaluation, one video only.** It is HeyGen's open-source framework
   (Apache-2.0, heygen-com/hyperframes, ~53k stars, npm `hyperframes` published by HeyGen). Provenance was checked
   before anything was installed. Remotion is not built in parallel: two engines at once would halve the
   evaluation of each.
2. **It lives in `videos/`, never in the app.** The server serves only `frontend/`. In-app explainers stay
   drawn live (5be4f8f: ~45 KB against ~8 MB, and they play offline on a dead uplink). The MP4 is for places a
   video belongs: staff WhatsApp groups, training sessions, a channel.
3. **Local, free, offline-capable tools:** FFmpeg 8.1.3 (BtbN win64 build, SHA-256 checked, in `~/tools`), the
   Kokoro-82M voice `af_heart` (the top grade in Kokoro's own ratings) and faster-whisper for word timings,
   both in a separate Python 3.12 environment (the system 3.14 has no wheels). No HeyGen account: its hosted
   voices were not needed to judge the visual system.
4. **Teaching pace over machine pace.** A single TTS take read "cable, switch, router, provider" in 1.3 s, so
   each line is voiced phrase by phrase with designed pauses (`compose-voice.mjs`). That also gives the exact
   time each device is named, and every reveal and sound lands on it.
5. **One stage, generated.** The five frames are emitted from one drawing (`build-frames.mjs`), so every cut
   is invisible. Packets run on a global clock, so a packet in flight at a cut continues in the next frame.
6. **Rendered frames are the evidence, not the build.** The first review of real snapshots found five defects
   that passed every automated check: a zoom that swung through empty cable, chips thrown to the top edge (a
   GSAP transform replacing an SVG translate), dying packets scaled about the drawing's origin, a drawing too
   small for a phone, and a callout repeating the narration. All were fixed before the draft render.

**Not done:** more videos (the owner approves the visual system first); Swahili narration (Kokoro has no
Swahili voice, and the product copy is English-only); background music (needs a HeyGen account or a local
MusicGen install, and the brief did not need it).

**Revisit when:** the owner has reviewed the draft. If the look is approved, the three project scripts become
the reusable engine for the troubleshooting guides. If not, the review names what to change first.

## D37 — The explainer series: one engine, one video per fault type

**Asked (2026-09-26), after the prototype was approved:** videos for every scenario and every challenge,
with great creativity; "the camera movement is the killer".

**Decided:**
1. **One video per fault type the system knows** (`SUBCATS`, 26 plus "Other"), ordered by how often each is
   reported. The plan, sources and status are in `videos/SERIES.md`.
2. **An engine before episodes** (`videos/_engine`): the device library, the stage, the camera, flows on one
   global clock, voice composed phrase by phrase, the logo and the checks, shared by every episode. 26
   hand-built files would drift apart. It was proved by porting the approved prototype onto it: the voice came
   out identical to the millisecond and the frames matched.
3. **Every episode teaches the same habit**: the moment → how it works → check in order → fixed, or report it
   (with the priority). The look is shared; the **visual idea and camera signature are the episode's own** (a
   fork in the road for the LRS, a macro slide along the router's lights, current down a charging lead, a
   camera riding a projector beam).
4. **Facts come from the system** (its guides, its explainers, its routing rules). A step it does not state
   yet is marked **[confirm]** in `SERIES.md` and confirmed by the owner before that episode is rendered. Power
   episodes never ask anyone to open or repair anything electrical (guide #4).

**Revisit when:** production fault counts are pulled (the order may change), or the owner reviews the first
batch.

## D38 — Direct one prototype to a standard before making a series

**Asked (2026-09-26):** the owner adopted a Motion Director Master Brief that makes success "a learner understands
the concept from the animation alone". It asks for directed shots, one focal point at a time, failure as a visible
mechanism, investigation, isolation, a visible fix and a verified repair. It also stops all other videos until one
prototype passes review.

**Decided:**
1. **The series pauses** after episode 01 (built on the v1 language, to be rebuilt). `videos/SERIES.md` says so.
2. **Episode 00 is rebuilt as a directed film (v2)** on the engine, planned before code in
   `videos/how-a-school-connects/DIRECTION.md`: diagnosis, learning objective, shot storyboard, motion plan, and
   afterwards the rationale, primitives, assets, corrections, remaining weaknesses and recommendations.
3. **The fault is acted out where it really happens:** a WAN plug worked loose, seen at the WAN port's unlit light.
   It is fixed on the spot and verified by a round trip to a server. Faults a school cannot fix are named as the next
   suspects, never acted out.
4. **Close-up-ready devices** (`devices2.mjs`) and named primitives (PacketBlocked, VerifyPacket, DiagnosticCheck,
   CheckThePath, FaultDomain, CableReconnect, ContextTag) become part of the engine. Captions are made quieter for
   every episode.

**Revisit when:** the owner has reviewed the v2 render. The recommendations in DIRECTION.md are the agenda.

## D39 — Hybrid 2D + real 3D: prove it on one sequence before it becomes part of the system

**Asked (2026-09-26):** upgrade the engine into a hybrid system — clean 2D for how the system works, real 3D
hardware for what to check — and prove it on ONE section of the polished film (fault domain → 3D router → WAN
inspection → reconnect → link restored → verification). Stop there for review.

**Decided:**
1. **HyperFrames stays the engine; GSAP stays the choreographer.** The 3D view is a *layer* composition over the
   2D frames (`lib/hardware-layer.mjs`, the `layers` hook in `make.mjs`), with its own copy of the slate, logo and
   scrim so the hand-over is invisible. Its scene is a pure function of the layer's own timeline, read through a
   clock setter — never `requestAnimationFrame`, never global `hf-seek` time.
2. **The hand-over is a silhouette match.** The 3D router is built to the 2D router's exact layout, so a long-lens
   front view lands its face on the drawing's; the layer fades in there, and only then does the camera reveal
   depth. The return mirrors it. While the layer is opaque the drawing beneath is not drawn at all.
3. **The prototype's hardware is original (category A), authored as Blender scripts → GLB.** No free model was a
   close-up-quality generic router; the good ones are brand-specific (a D-Link trademark, a real TP-Link switch),
   GrabCAD is non-commercial by default, and marketplaces need a signed-in account. Research, licensing gate and
   the starter set: `videos/_engine/hardware-3d/RESEARCH.md`; provenance: `PROVENANCE.md` (no external models).
4. **Pipeline:** Blender 5.2.2 (headless, reproducible script) → GLB → glTF-Transform (dedup, weld, meshopt) →
   three.js 0.186.1 bundled with the OE3D runtime into one classic script (`shared/three-oe3d.js`, no CDN) →
   HyperFrames. Router 10.7k triangles / 129 KB; plug 16 KB; no textures.
5. **Behaviour is generic and written down.** LED states (`OE3D.LED`, hardware-3d/README.md) follow common
   convention; the WAN light stays dark while the link negotiates, then lights, then flickers with traffic. A
   category-B twin of deployed hardware must state its own manufacturer's meanings.

**Not done (by the brief):** the rest of the library, the rest of the film, any other episode.

**Revisit when:** the owner has reviewed `videos/how-a-school-connects-3d/renders/video.mp4` against the polished
2D film and answered: does the hybrid materially improve clarity and quality enough to join the system? If yes,
category B needs the deployed models (router, switch, AP, UPS, charging hub, LRS).

## D40 — 3D-first: one continuous technical world, and the camera does the explaining

**Asked (2026-09-26, after the D39 prototype):** the 3D hardware sequence was stronger, clearer and more
professional than the drawn hardware around it. That is an architectural signal, not a polish note. Move the
explainer system to 3D-first and rebuild the SAME film — same topic, same script — so the two production
systems can be compared.

**Decided:**

1. **The rule.** *If it physically exists, model it. If it communicates information, overlay it. If it
   represents data flow, illuminate the path.* Routers, switches, modems, computers, connectors and cables
   are hardware from `videos/_engine/hardware-3d/`. 2D is kept for labels, status, titles, captions and the
   closing rule — information, not objects. There is no hand-over between a diagram and a photograph,
   because there is no diagram.
2. **One world, many distances.** The system view, the teaching view, the port inspection and the repair are
   the same objects in the same space under the same light. **The camera changes the level of explanation**,
   through a semantic rig — `topology()`, `devices([…])`, `device(id)`, `port('router.wan')` — never through
   coordinates typed into a scene. The system view is near-orthographic (an 8° lens from 7 m) so hardware
   behaves like a clean diagram while keeping material, depth and form.
3. **The network is a graph, not a layout.** `lib/school-network.mjs` names devices, ports and connections,
   and the order a person checks them; cables, plugs, the signal's route, the check list and the fault domain
   all read from it. One definition, so the picture and the troubleshooting order cannot drift apart.
4. **Data is a light inside the cable** (a shader on a sheath around the tube), never a dot flying above the
   hardware. A failed link is shown by the hardware first: the light pushes a few centimetres in, dies, tries
   again, and the WAN light never comes on — *then* a restrained label says NO PHYSICAL LINK.
5. **Physical link ≠ service.** The provider's modem keeps LINK and INTERNET lit all through the fault; only
   its LAN light, the one facing the loose cable, is dark. A film must never teach a teacher to read a loose
   cable as an outage.
6. **Everything that must scale with the shot is one call** (`OE3D.shoot`): the shadow camera, how far the
   floor reaches, halo size, and how wide the travelling light is. A shot that sets the camera and forgets one
   of them looks wrong in a way that is hard to name.
7. **The lighting rig follows the camera**, not the world: the key is always three-quarters to the viewer's
   left and above. A fixed key backlit every shot taken from the other side — the computer's rear port, the
   one the film asks you to look at, was a black mass.
8. **Labels are screen-space, collision-aware, and may be dropped.** Two rings of candidate positions, zones
   they may never enter (slate, logo, captions), and no label at all rather than two that collide.
9. **The world is proved before the film is built.** `tools/world-sheet.mjs` renders nine views of the real
   runtime, real models and real scene configuration in headless Chrome and tiles them into one sheet, with a
   `--probe` that says what a pixel is actually showing. It found, in minutes: a mirrored screen, a
   default-white material where a boolean had left faces on an empty slot, an invisible signal pulse at system
   scale, and a floor with a visible edge.

**Also fixed at the source, for every asset:** a face left on an empty material slot now points at slot 0
(`oe_kit.no_orphan_faces`), and the monitor's screen UVs are computed from vertex positions, after any face
reversal, so the picture cannot come out mirrored.

**Cost:** the film is the same length (72.5 s) and the same script as the 2D film; ~490 KB of models plus the
817 KB runtime, once per page.

**Not done:** the other episodes, and category-B twins of the hardware OE actually deploys. Nothing in the
series is rebuilt until the owner has compared the three films.

**Revisit when:** the owner has watched `videos/how-a-school-connects-world/renders/video.mp4` beside the 2D
film and the hybrid, and answered which production system the series is built on.

## D41 — Prove the object layer, bind the series to delivery, and add people last

**Asked (2026-09-26):** after the cinematic-studio proposal was frozen (`675ad85`), the owner said
*"fanya world class decision"* — decide, rather than hand the questions back. These are the calls.

**Decided:**

1. **The freeze stands, and it was the right call.** Building a second production system while the first one
   has never been proved to a standard is how studios die. `videos/how-a-school-connects-world` is the
   gating artefact. Gate 2 does not open until it passes its ten gates on rendered evidence.

2. **The binding constraint on this series is megabytes at the point of use — not render quality.**
   Measured on the delivered film: **41.9 MB for 72.5 s** — 4.62 Mbps, 1920×1080, **60 fps** —
   **34.7 MB per minute**. A ten-minute cinematic film is therefore ~350 MB, aimed at an audience whose
   defining problem is that the school's uplink is down. This is the same reasoning that keeps in-app
   explainers drawn live at ~45 KB instead of 8 MB (D36.2), and it was not applied to the films. Measured
   on the same 72.5 s, x264 CRF 21 preset medium:

   | Encode | Size | Per minute | A 10-minute film |
   |---|---|---|---|
   | **as delivered** — 1080p60, 4.62 Mbps | 41.9 MB | 34.7 MB | ~347 MB |
   | 1080p**60**, quality-targeted | **17.3 MB** (−59 %) | 14.3 MB | ~143 MB |
   | 1080p**30**, quality-targeted | **14.5 MB** (−65 %) | 12.0 MB | ~120 MB |
   | 720p30, quality-targeted | **7.2 MB** (−83 %) | 6.0 MB | ~60 MB |

   The 1080p30 frame at 36.6 s was inspected: legends crisp, LED falloff clean, no banding in the dark floor
   gradient, caption legible. **Two thirds of the delivered file is waste, not picture.** (These are
   re-encodes of an already-compressed source, which is easier than encoding from frames — treat the
   percentages as the direction and the ceiling, not the promise; the real figure comes from the next render.)
   **So: a delivery budget is a gate beside the quality gates** — a film is not finished until it meets it,
   and length follows from the budget instead of from ambition.

3. **Render at 30 fps, not 60.** The direction doc asks for moves that decelerate to rest with no idle
   drift; 60 fps spends half the bits on a film whose motion is deliberately slow, and every one of those
   bits is carried over a school's uplink. 60 fps is kept only for a shot that demonstrably needs it.

4. **People are sequenced, not commissioned.** In order, each step independently deliverable and
   independently cancellable: **(a)** the object layer to an undeniable standard — that is this benchmark;
   **(b)** *hands only*, in the one beat where a human presence changes comprehension (the press, the plug,
   the swap); **(c)** a face, only if the hands prove out. No cast, no classroom of characters, no facial
   performance is commissioned now. The reason is measured, not aesthetic: there is no GPU here, there is
   one operator, there are 26 films to make, and bad acting is worse than no acting.

5. **No money and no installations.** Everything runs on route R1 (the existing three.js runtime, ~0.33 s a
   frame). No GPU is rented or bought until a specific shot exists that R1 demonstrably cannot carry.

6. **The uncommitted tree is resolved today, not left.** The 15:20–15:22 edits (scope card, tower decal,
   captured support screen, `hyperframes` 0.8.77 → 0.8.78) are coherent and pass lint, but they are
   unrendered, unreviewed and uncommitted — three sessions can see them and none owns them, which is one
   stray command from losing them. They are **rendered to a review filename** (never over `video.mp4`),
   judged on frames, then committed or reverted per change.

7. **The OE decal on the tower is rejected.** It breaks the library's own rule — *"No forced branding.
   Hardware keeps believable colours; OE's colours belong to callouts, highlights, labels and transitions"*
   (`hardware-3d/README.md`). A school's desktop tower does not carry an Opportunity Education logo, so it
   is also a small lie in a film whose authority rests on telling none. The logo is already top-right on
   every frame.

8. **The payoff shot must be the lesson, not the sign-in page.** `screenPainter`'s `else if (okImage)` branch
   draws the captured screen *instead of* the lesson mock, so the film's resolution beat — the thing the
   children were waiting for — is now an authentication form, and it argues circularly that restored
   connectivity means you can log in to the fault-reporting system. The capture itself is exemplary work
   (deterministic, from this repo's own frontend, no account data, with a regeneration command in
   `assets/media/SOURCE.md`); it is pointed at the wrong beat.

9. **Two defects in the screen, both in the working tree.** `world.js:426` paints
   `support.school.ac.tz` — a domain that does not exist; the teachers this film trains type
   `support.mkatolikikiganjani.com`, and it is on screen in the opening shot because the failure state draws
   the chrome and the capture only appears later. And `drawImage(okImage, 0, 0, 1280, 720)` paints over the
   browser chrome it just drew, so the window frame vanishes at the moment of the fix — a continuity break
   between the two states of the same monitor.

10. **The screen is not glass, and that has consequences beyond this film.** It is
    `new THREE.MeshBasicMaterial({ map, toneMapped: false })`: unlit, so it can never carry a reflection of
    the room — the one cue that separates a screen from a lit rectangle — and outside the tone-mapping
    pipeline, so its whites will not move with the curve. If the engine adopts `AgXToneMapping` to match
    Blender (the mismatch recorded in the Gate 1 proposal §2.4), this screen gets **worse**, not better,
    unless it is changed in the same commit.

11. **Two findings from the macro frame at 36.6 s, where the film is strongest and so must be flawless.**
    The **empty LAN ports read brighter than the subject** — the contact springs inside ports 3 and 4 are
    near-white and unlit, so at macro distance they are the brightest objects in that half of the frame and
    pull the eye off the WAN port the shot exists to show. And the router's front face carries **no
    micro-surface detail at all** at 12 cm: no mould texture, no fingerprints, no roughness break-up, which
    is the asset standard's own requirement and the difference between a render and a photograph.

12. **One owner per artefact, because three agents are in this tree.** Network accuracy and continuity
    belong to the engine's author, who holds `school-network.mjs`; geometry, materials, physical contact,
    camera, lighting, temporal, audio and branding are reviewed independently. Every finding is timestamped
    against a **named artefact**, never "the render" — `renders/contact-sheet.jpg` (14:39) and
    `snapshots/frame-00-at-1.559s.png` (15:23) are different films.

13. **When the benchmark passes, D40 wins and the other two prototypes are deleted**, as `SERIES.md` already
    planned. Three films of the same script are a comparison, not a library.

**Evidence:** Blender 5.2.2 on this machine has no Cycles compute device at all (OptiX/CUDA/HIP/oneAPI all
empty); a 960×540 64-spp frame of a trivial classroom costs **84.2 s**, EEVEE **91.1 s** — slower. A
Blender-rigged, skinned, animated GLB played in the existing runtime deterministically (same `t` → identical
pixels). Full working: `docs/engineering/animation-studio/GATE-1-PRODUCTION-SYSTEM.md`.

**Not done:** the review render itself, the eight-gate pass on it, and the delivery-budget figure in
megabytes per minute — all of which wait on the tree being rendered. Category-B twins still wait on the
owner's list of deployed hardware; nothing else is blocked on him.

**Revisit when:** the benchmark film passes its ten gates on rendered evidence. Then, and only then, (b) —
hands in one beat of one film — is built and judged on the same standard.

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
