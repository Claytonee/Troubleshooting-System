# 6. Trend metrics

**Status:** implemented · **Effort:** S · **Changes:** the numbers that drive decisions

## What the giants do

The whole point of the AIOps and incident-management tooling is reducing mean
time to resolution and cutting alert noise, which means MTTR and alert quality
are tracked *over time* rather than as a current figure
([PagerDuty](https://www.pagerduty.com/resources/incident-management-response/learn/what-is-proactive-incident-management/),
[Datadog/PagerDuty integration](https://webeyez.com/insights/guides/pagerduty-datadog-integration-guide-incident-management)).
In asset management the same principle drives refresh decisions: ticket volume
per device, watched over time
([GroWrk](https://growrk.com/blog/it-asset-lifecycle-management)).

A number without a direction is not a decision.

## What is missing

The columns are all there and mostly unused:

| column | present | read anywhere? |
|---|---|---|
| `first_response_at` | yes | **nothing in `frontend/`** |
| `resolved_at` | yes | yes |
| `sla_due_at` | yes | yes |
| `csat_rating`, `csat_comment` | yes | detail modal only |
| `escalated_at` | yes | **nothing** |
| `ai_chats` / `ai_chat_messages` | yes | history rail only |

Analytics is a snapshot: total errors, SLA compliance, check-in rate, errors by
school, errors by category. Every one is "right now". Nothing answers *is this
getting better or worse*, which is the only question a term review asks.

`first_response_at` is the sharpest omission — it is stamped on every ticket
that moves off `open` and displayed nowhere. Time-to-first-response is usually a
better measure of whether a support team is keeping up than time-to-resolution,
because it is the part the team controls.

## Design

### Six numbers, each with a direction

| Metric | From | Why this one |
|---|---|---|
| MTTR by week | `resolved_at - created_at` | the headline, but only useful as a trend |
| Time to first response | `first_response_at - created_at` | what the team actually controls |
| SLA compliance by week | the fixed calculation from `sla_measurable` / `sla_on_time` | now that it is honest, it can be trended |
| Resolved without escalation | resolved with no `escalated_at` | measures whether the guides work — renamed, see below |
| Escalation rate | `escalated_at IS NOT NULL` over total | rising means the first line is under-supported |
| AI deflection | `ai_chats` with no error filed by that user within an hour | how much the assistant is absorbing |

Deflection is the one that justifies the assistant's cost, and nothing currently
measures it.

### Per-engineer and per-school, deliberately framed

The same numbers split by engineer and by school. Framed as workload and
support, not as a scoreboard: an engineer with the worst MTTR is more likely to
be covering the hardest zone than to be slow — the sub-admin dashboard already
knows who covers what, so the view shows load alongside outcome.

### Weekly digest

`ROADMAP_AND_DESIGN.md` already plans a Monday digest and lists it as designed.
These are its contents: last week versus the four-week average, what moved, and
what breached. One email that gets read beats a dashboard that gets visited.

### Honesty rules, carried over

The SLA fix established these and they apply to every metric here:

- A metric with nothing measurable renders an em dash and the reason, never a
  fabricated 0% or 100%.
- Rows that cannot be judged are excluded from the denominator **and counted
  separately** on screen.
- Percentages are clamped; nothing renders below 0 or above 100.

That last rule exists because this page once displayed −200%.

### Implementation

Weekly buckets via `YEARWEEK(created_at, 3)` (ISO, Monday-based, matching the
existing 52-week check-in selector), computed in SQL. Charts stay inline SVG —
no chart library, since the CSP allows only a short CDN list and these are bar
and line charts over ~13 weeks.

## Not built

- Predictive forecasting. Thirteen schools over one term is not a time series
  worth extrapolating; it would produce confident nonsense.
- A configurable report builder. Six well-chosen numbers beat a builder nobody
  opens.
- Real-time dashboards. Weekly is the decision cadence here; live counters
  would be decoration.

## Decisions taken while building

**Named for what it measures.** The design called for "first-contact
resolution". Nothing in this system records contacts, so the metric is
**"resolved without escalation"** and the card says why. Claiming to count
contacts would have been the same kind of lie as the −200%.

**Buckets are keyed on when the fault was reported, not resolved.** Bucketing by
resolution date lets a bad week look good simply because nothing was closed in
it.

**A week with nothing measurable returns `null`, not `0`.** Every ratio goes
through one clamped `pct()` that returns null on a zero denominator, and the
line chart *breaks* rather than dropping to zero — a gap is the truth, a dip is
a lie.

**Deflection is null when nobody asked.** A 0% deflection rate reads as "the
assistant helps nobody" when in fact nobody used it. `deflectionRate()` is a
pure function so this is tested at the boundary rather than argued about.

**The baseline is the four weeks before last, not the whole period.** A
13-week average would flatten exactly the movement the page exists to show.

**The trends endpoint takes an optional `school_id`.** Per-school trends are
useful in their own right, and it is what let the verification suite measure
exact figures against a school with no history instead of deleting everybody's
data to get a clean slate.

## What testing and the UI pass changed

- **Sparse data was rendering as broken charts.** With one week of history the
  line chart drew a single dot in an empty 90px box, and the volume chart's
  `flex:1` stretched one bar pair across the whole card as a solid block. Under
  three measurable weeks both now show the numbers plainly with "not enough for
  a direction yet".
- **"last week" was a plain untruth** on a database whose newest fault is three
  months old: the latest bucket was week 24. Cards now name the bucket by its
  week number.
- **The visits suite was corrupting this page.** It closed a real seed fault to
  prove the audit trail and left it closed, which made MTTR read 89.7 days off
  that one row. It now records the fault's state and restores it. Worth
  remembering: a suite that mutates shared fixtures poisons every measurement
  taken afterwards.
- The deflection assertions are deltas against a baseline, because this
  database has chats of its own and deleting somebody's conversation history to
  make an assertion tidy is not a trade worth making.

## Verification plan

- Each metric cross-checked against a hand-written SQL query on the same data.
- Week boundaries verified with a ticket created on a Sunday and one on a
  Monday.
- A week with no resolutions shows an em dash, not zero.
- Deflection counted against a manual audit of one week of `ai_chats`.
- Every chart readable at 375px and legible in both light and dark surfaces.
