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

## D6 — Where alerts go · Decided: the bell always; email and SMS when configured

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

## D12 — Order of work (phase 2)

1. D2 security events.
2. D3 token versioning.
3. Verify proxy IP attribution (D5 a).
4. D4 TOTP.
5. D5 detection rules, alert-only, plus D6 alerts.
6. D7, D8, D9 small fixes, together with INT-001 and TEST-001.
7. After 30 days of alert data: review, then D5 (d).

## Revisit when

- A CDN or WAF is put in front of the site: edge blocking becomes possible, so revisit D5.
- SMTP is configured: turn on D6 email.
- 30 days of D2 data are in: set D5 and D9 thresholds from measured rates, not guesses.
