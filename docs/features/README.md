# Feature plan — proactive, offline-capable, reachable

Six features, researched against what ServiceNow, Datadog/PagerDuty, Jamf/Google
Admin and the field-service platforms actually ship, then filtered down to what
is worth building for **13 schools in Kilimanjaro with intermittent
connectivity and four field engineers**.

This extends the existing plans; it does not replace them.
- `docs/ROADMAP_AND_DESIGN.md` — tier status of everything already shipped
- `docs/IMPLEMENTATION_PLAN.md` — phase structure (Phase 5 is PWA)
- `docs/WORLD_CLASS_VISION.md` — the pillars these map onto
- `docs/DTO_SPEC.md` — DTO conventions every new endpoint follows

---

## The problem all six answer

Every row in `errors` exists because a human noticed a fault and typed it in.
Nothing in the system observes anything. That has one measurable consequence,
visible in `dashboardController.js`:

```sql
-- "schools healthy"
s.id NOT IN (SELECT school_id FROM errors
             WHERE status != 'resolved' AND priority IN ('critical','high'))
```

**Healthy means "nobody has filed a ticket".** A school in a total blackout,
where nobody *can* file a ticket because the link is down, counts as healthy.
And a teacher cannot report that the network is down using the network that is
down.

The industry answer is to stop waiting for the complaint: the device reports,
the incident opens itself, the on-call engineer is paged
([PagerDuty](https://www.pagerduty.com/resources/incident-management-response/learn/what-is-proactive-incident-management/)).

---

## Order and rationale

| # | Feature | Changes | Effort | Doc |
|---|---------|---------|--------|-----|
| 1 | LRS heartbeat → self-opening tickets | reactive → proactive | S | [01](01-lrs-heartbeat.md) |
| 2 | Offline-first PWA | works when it matters most | M | [02](02-offline-pwa.md) |
| 3 | WhatsApp intake | who will actually use it | M | [03](03-whatsapp-intake.md) |
| 4 | Asset lifecycle & TCO | repair-vs-replace becomes answerable | S | [04](04-asset-lifecycle.md) |
| 5 | Visit planner | one trip fixes four faults | M | [05](05-visit-planner.md) |
| 6 | Trend metrics | the numbers that drive decisions | S | [06](06-trend-metrics.md) |
| 7 | Teacher scope & delegated inventory | the account stops offering what it refuses | M | [07](07-teacher-scope.md) |
| 8 | USSD + SMS intake | any phone, no internet, no bundle | M | [08](08-phone-intake.md) |
| 9 | Spares & first-time fix | the trip ends with a child able to work | M | [09](09-spares-and-first-time-fix.md) |
| 10 | Guide-first reporting | the fault that never needed an engineer | S | [10](10-guide-first-reporting.md) |
| 11 | Preventive maintenance | stop waiting for things to break | M | [11](11-preventive-maintenance.md) |

7 came from the field, not the roadmap: six things a teacher's account did
wrong, reported after the first six shipped.

**1 → 2 → 3 first.** They push the same way: *the system knows about the
problem, or is easy to reach, even when the network is poor.* 4–6 improve what
already exists; 1–3 change what kind of system this is.

1 is first because it is the smallest change with the largest effect, and it
repairs the "schools healthy" falsehood on the way.

---

## Constraints every one of these respects

**No long-running process.** cPanel/Passenger recycles the app; a `node-cron`
timer cannot be relied on. Scheduled work is an **authenticated internal
endpoint** hit by a cPanel Cron Job — the decision already recorded in
`ROADMAP_AND_DESIGN.md` §5. New sweeps follow it.

**Additive schema only.** `ADD COLUMN IF NOT EXISTS` in `schemaExtensions.js`
plus the base table in `bootstrap.js`, nullable or defaulted, idempotent on
every boot. No drops, renames or narrowing without a separate, backed-up,
user-confirmed contract step (CLAUDE.md).

**DTO in front of every new endpoint.** Request descriptor + response shaper in
`backend/src/dto/`, so no route ever returns `SELECT *`. See `DTO.md`.

**Bandwidth is the scarce resource.** Every payload, poll interval and asset is
costed in KB before it ships.

**Deliberately still out of scope:** AIOps/ML anomaly detection (13 schools do
not produce enough data to train anything — heartbeats plus thresholds get ~90%
of the value), a full CMDB, and a native mobile app.
