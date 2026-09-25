# Feature 13 — Dashboards, one per level

**Status:** shipped · 2026-09-25
**Code:** `backend/src/controllers/dashboardController.js`, `frontend/js/pages/dashboard.js`
**Verified by:** `backend/scripts/verify-dashboards.js` (34 assertions)

## The test

Every figure on a dashboard has to answer one question:

> **If this number changed, what would this person do differently today?**

A count that cannot change anybody's next action is decoration — and it is decoration
in the most expensive space in the product, because it spends the reader's attention
on nothing. Cheapness to compute is not a reason to show something.

Three figures failed that test outright and are gone:

| Removed | Why |
|---|---|
| *Total Reported · all time* (teacher) | A lifetime counter. It never falls, so it can never prompt anything. |
| *Guides Available: 24* (teacher) | The number of guides that exist answers no question a teacher has. What they need is the guide for **their** fault. |
| *In Progress* (head office) | A subset of Open. Moving a fault from open to progress changes this tile and changes nothing anybody does. |
| *Weekly check-in ring* (head office) | The same fraction as the tile two inches to its left. |

## What was wrong

**The SLA figure was undercounted.** The tile read `N SLA breach`, where `N` came from
filtering `recent_errors` — a list the backend caps at `LIMIT 6`. So on a day with
twenty-five breaches it said six. The backend had already computed the true figure over
every row and the page ignored it. The one number that means *we are failing a school
right now* was the one number that could not tell the truth. `verify-dashboards.js`
reproduces it: eight breaches are created and the count must match the database, and must
exceed the length of the list beside it.

**The school administrator was shown head office's dashboard, shrunk.** The `school` role
fell through the same query, filtered to one row, and got *Schools Healthy: 1/1* — a
tautology — and *Week 39 Check-Ins: 0/1*, a binary dressed as a fraction. Nothing about the
two hundred tablets they are actually responsible for.

**The asset was invisible.** `grep -ci "tablet|lrs|heartbeat|maintenance|spare|visit|csat"`
over the dashboard frontend returned **0**. The fleet, the heartbeat, the maintenance
schedule, the spares stockout, the satisfaction ratings — all collected, none shown.

## What each level decides, and the tiles that serve it

### Head office — *what has to move today*

Direction and term-scale analysis live on `#analytics`, which already holds 13 weeks of
it. The dashboard is the dispatch question.

| Tile | The decision |
|---|---|
| **Past the agreed time** + due within 4h | What to escalate before the end of the day. Counted over every fault. |
| **Nobody has answered** (`first_response_at IS NULL`) + oldest | Where work is being dropped. Distinct from *unassigned*: a teacher's fault is deliberately unassigned while it waits for their school administrator, and that is the system working. |
| **Schools needing attention** *n/m* | Which school to call. A silent LRS disqualifies a school, so a blackout does not read as health. |
| **Devices out of service** *n/m* + schools with no spare | Procurement, and what goes in the vehicle. |
| **Time to resolve · 28d** with the previous 28d | Whether the operation is improving. A number without a direction is not a decision. |

Below: *What to move first* (past-due first, then severity, oldest at the top — priority
alone put a fresh critical above a high two days past due), and *Where to send someone*,
one row per school with its real reasons.

### School administrator — *can lessons run tomorrow, and what is mine*

| Tile | The decision |
|---|---|
| **Devices working** *n/m* + faulty / in repair | Whether classes can run. |
| **Waiting on you** + oldest | Their actual to-do list: faults still at school level with nobody assigned — exactly the rule `errorController.create()` applies. |
| **With the engineer** + past due | Who to chase, and what to tell the head teacher. |
| **Learning server** up / down / not monitored | The single most consequential fact at a school. *Never reported* is not *down*. |
| **Checks due** *n/m* + overdue | What to ask the engineer to do on the next visit. |

Below: open faults with a **Held by** column (You / the engineer's name), *Classes short of
devices* by form, and the next checks due.

### Teacher — *is my report moving, and what do I do while I wait*

| Tile | The decision |
|---|---|
| **Still open** + how many picked up + oldest | Whether to chase. |
| **Waiting on your word** | Confirm a repair. It is the only quality signal in the system: a resolution nobody confirmed is a resolution nobody checked. |
| **Fixed for you · 30d** | That the loop closes. |

The status column is in plain language — *Waiting to be picked up* / *Someone is working on
it* / *Fixed — please confirm* — not a status chip they have to decode. Beside it, **While
you wait** suggests guides for the fault they actually have open, via
`services/knowledge.js`. With no open fault it suggests nothing: an unmatched guide panel
teaches people to ignore the panel.

### Field engineer — *my queue, and what I cannot fix empty-handed*

Already the strongest of the four. Changed:

- **On time is windowed to 30 days.** A lifetime figure barely moves, so it could never say
  whether this month went well. With nothing timed it stays a dash, never a perfect score.
- **Lifetime "total resolved" removed.**
- **Spares to carry** added (`services/spares.js`): what to load, how many schools are short,
  and how many cannot be fixed today at all. Short and stocked-out are different states and
  are labelled differently — "3 to carry" beside "every school has a spare" is nonsense.
- **Stalled** replaces the activity feed. What happened is history; what stopped moving
  in three days is a decision.
- **Planned visits** shown when there are any.
- School rows carry devices down, spares needed and LRS state, not just an open count.

## Rules that hold here

- **Nothing measurable means nothing claimed.** `null`, never 0 and never 100%. A resolution
  time with no resolutions is a dash; an engineer with nothing timed gets a dash, not a pass.
- **A figure counted over a list is a figure capped by that list.** Count in SQL over every
  row; the list beside it is a top-N and nothing more.
- **"Spares needed" is a packing list, never negative** — `max(0, down − spares)`.
- **A heartbeat age is formatted, not printed.** A week-old outage reads `8d`, not `11190m`.
- **One definition per concept.** A usable spare is `spareWhere()` in `services/spares.js`,
  qualified by alias where a join needs it — never a hand-copied fragment, or the count and
  the picker drift apart.
- **One banner per page**, for the sharpest fact. A blackout outranks a clock.
