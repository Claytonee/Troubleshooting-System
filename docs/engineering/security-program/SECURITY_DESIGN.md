# Security Center — design proposal (phase 2)

**Status: §1 (evidence), §2 (rules) and §3 (incidents and alerts) are built and tested; §4 (IP blocking) waits for D5 (a) and 30 days of data.** Phase 1 (2026-09-24) fixed the confirmed
authorisation and XSS findings and shipped the explanatory Security Overview page. This is what
turns "attacks are slowed" into "attacks are seen, and someone is told".

Sized for the real deployment: one Passenger process tree, MySQL on localhost, ~25 accounts,
10 schools, no CDN. No queue broker, no SIEM, no new paid service.

## 1. Evidence first — `security_events` (closes SEC-006)

Additive table, written by a small `services/securityEvents.js`:

| Column | Notes |
|---|---|
| `id`, `occurred_at` | |
| `event_type` | `auth.login_failed`, `auth.login_throttled`, `auth.login_ok_after_failures`, `authz.role_refused`, `authz.scope_refused`, `input.rejected`, `webhook.bad_signature`, `admin.block_created`… |
| `severity` | info / low / medium / high |
| `source_ip` | `req.ip`, with `ip_source='x-forwarded-for(1 hop)'` — see §4 |
| `user_id`, `role`, `school_id` | only when authenticated; **never** a username for a failed login that matches no account |
| `method`, `path_template` | `/api/errors/:id`, not the raw URL (no ids, no query strings) |
| `status`, `rule_id`, `detail` (JSON, whitelisted keys) | never a password, token, header or body |

**Must not take the site down under attack:** writes are buffered in memory and flushed in
batches every 2 s (bounded to 500 rows; overflow is counted, not stored); identical events
from one IP+type within 60 s collapse into one row with a `count`; rows older than 90 days are
deleted by the existing sweep. A failed write never fails the request.

## 2. Detection rules — deterministic, explainable

| Rule | Condition (tunable) | Confidence | Response |
|---|---|---|---|
| R1 Guessing on one account | ≥10 `login_failed` for one account in 15 min, any IPs | medium | incident + alert |
| R2 Spraying from one network | ≥5 distinct accounts failing from one IP in 15 min | medium | incident + alert; *propose* a temporary block |
| R3 Success after failures | `login_ok` after ≥5 failures on that account | high | alert — possible compromise |
| R4 Cross-school probing | ≥5 `scope_refused` by one account in 10 min | high | incident + alert; *propose* suspension |
| R5 Webhook forgery | ≥3 `bad_signature` in 10 min | medium | incident |
| R6 Privileged change | any admin created, role changed, block lifted | info | always logged, digest |

A school behind one NAT can trip R2 honestly (a staff room forgetting passwords on Monday
morning). Hence: proposals, not automatic blocks, until thresholds are measured on real
traffic.

## 3. Incidents and alerts

`security_incidents` (detected → triaged → contained → closed, with a false-positive
outcome); dedup key = rule + subject + hour. Alerts go through what exists: the in-app bell
(`admin_notifications`) always; email when SMTP is configured (it is not on production today);
SMS for high severity only. One alert per incident, not per event.

## 4. IP blocking — application-level, reviewed

- **Before any block exists:** verify on production that `req.ip` cannot be spoofed — send a
  request with a forged `X-Forwarded-For` and confirm the logged IP is the real one. If
  LiteSpeed appends rather than overwrites, `trust proxy 1` is correct; if not, blocking by
  IP is unsafe and must not ship.
- `ip_blocks` (IPv4/IPv6, single address; CIDR only by a human), reason, incident, operator,
  `expires_at` (required for automatic blocks, max 1 hour), lift history.
- Enforced by middleware **after** `/api/health` and **never** on `/api/auth/login` for an
  address that holds an active platform-admin session — the recovery path for a mis-block.
  Break-glass: `SECURITY_BLOCKS_DISABLED=1` in the panel, documented, audited at boot.
- The blocked page: 403, a reference id, no rule detail, a "request review" link that files an
  appeal — never an endpoint that lifts the block.
- **Edge blocking is not available** (no CDN/WAF in front). Saying otherwise would be false.

## 5. AI assistant for triage — optional, never in the request path

Bedrock is already configured. It may summarise an incident's events on demand, from
structured fields only (no request bodies — they are attacker-controlled text). It recommends;
it never blocks. Enforcement works unchanged if the AI is down.

## Decisions

Taken on 2026-09-24 under the owner's delegation. Each is recorded, with its reasoning, in
[DECISIONS.md](DECISIONS.md): ship phase 1 (D1); record events (D2); token versioning
**without** a mass sign-out (D3); TOTP rather than SMS for platform admin (D4); **no automatic
blocking** until proxy attribution is verified and 30 days of alert-only data exist (D5); bell
first, email and SMS when configured (D6); 15 MB attachments (D7).
