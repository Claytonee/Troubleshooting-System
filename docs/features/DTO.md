# DTO layer — adoption

`backend/src/dto/index.js` has existed since the Tier-1 phase with request
descriptors and response shapers, and its own header says the shapers are "safe
to adopt incrementally". They were never adopted: **the module is imported
nowhere.** Every error endpoint returns raw rows from `SELECT e.*`.

## Why this matters, measured

`GET /api/errors` returns 35 keys per error. Checked each against `frontend/`:

| Key | Read by the frontend? |
|-----|----------------------|
| `csat_token` | only in the **detail** modal, to render the star buttons |
| `sla_breach_notified` | no |
| `escalated_by` | no |
| `reported_by_user_id` | no |
| `escalation_level`, `csat_rating`, `csat_comment` | yes |

`csat_token` is the unauthenticated capability that lets someone submit
satisfaction feedback without logging in. Verified on a running server —
resolving an error mints one, and the next `GET /api/errors` hands it out:

```
QFT-0241  token before resolve: null
QFT-0241  token after  resolve: a3bfe3aad87f7bb0a51b95fcb88aeeda   (32 chars)
```

**The problem is the list endpoint, not the token.** `ErrorDetailModal` legitimately
uses the token to render in-app rating buttons, so the detail response should keep
it. But the list response hands a live token for *every* error in one call, to every
user who can see the list, and nothing reads it there. One request, twelve
capabilities, no purpose.

The broader issue is structural: `SELECT e.*` exports every column anyone adds to
`errors` from now on, with no decision made about it — including the heartbeat
columns in feature 1.

## What changes

1. **The list response goes through `pickError()`.** It gains the fields added
   since it was written (`escalation_level`, `escalated_at`) and stops serving
   `csat_token`, `sla_breach_notified`, `escalated_by`, `reported_by_user_id`.
2. **The detail response goes through a `pickErrorDetail()`** — the same fields
   plus `csat_token`, because that view needs it. Two shapers, one explicit
   difference, instead of one implicit `SELECT *`.
3. **`hours_open` is resolved inside the shaper.** The controller currently
   patches it with a `withLiveAge()` helper; that decision belongs beside every
   other field decision, in one place rather than two.
4. **New endpoints ship with their DTO.** Feature 1 adds `Heartbeat` and
   `HeartbeatSweep` request descriptors and a `pickLrsDevice()` shaper.

Not changed here: whether a teacher who did not report an error should be able
to rate it. That is a product decision, not a serialization one.

## Rollout rule

Shapers are applied endpoint by endpoint, each verified against the frontend
that consumes it before moving on — the same incremental promise the module
made. A shaper that drops a field the UI reads is a regression, so the check is
"does the page still render", not "does the test pass".

## Verification for this change

For each endpoint switched to a shaper:
- the response key set before and after, diffed — every removed key must be one
  nothing in `frontend/` reads (`grep -rl <field> frontend/`);
- the pages that consume it re-rendered and screenshotted;
- `csat_token` absent from the list payload, present in the detail payload, and
  the in-app star rating still works.
