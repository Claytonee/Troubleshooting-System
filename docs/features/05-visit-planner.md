# 5. Visit planner for field engineers

**Status:** designed · **Effort:** M · **Changes:** one trip fixes four faults

## What the giants do

Field service management is built around scheduling and travel, not around
tickets. The mobile apps track travel time separately from work time, and
dispatch batches jobs by location before assigning them
([Dynamics 365 Field Service](https://learn.microsoft.com/id-id/dynamics365/field-service/mobile/overview),
[field service apps 2026](https://www.arrivy.com/blog/best-field-service-mobile-apps-for-technicians/)).
AI-assisted parts management exists for the same reason: arriving without the
part is a wasted trip
([InvGate](https://invgate.com/itsm/it-asset-management/hardware-asset-management)).

## What is missing

There is no scheduling of any kind in the schema. A sub-admin covering six
schools sees a queue ordered by priority and age — a list of *tickets*, with no
notion of *trips*.

K. Njoro's queue is a real example: QFT-0238 at Marangu Girls, QFT-0236 at Old
Moshi, QFT-0235 at Uru. Three schools, three drives, in Kilimanjaro terrain.
Nothing in the system says "while you are at Marangu, these four other things
are open there" — which is the difference between a productive day and a day
spent driving.

## Design

### Deliberately not a route optimiser

No map API, no distance matrix, no travel-time estimates. The zones are already
in `schools.zone` and the engineers know the roads far better than any API
would. What is missing is not navigation, it is **batching and a record**.

### What it actually does

**a. Group the queue by school, not by ticket.** The default view for a
sub-admin becomes: school, count of open faults, worst priority, oldest age,
whether an SLA is about to breach. Sorted by what would be gained by going.

**b. Plan a visit.** Pick a school and a date; the open faults there attach to
that visit. On arrival the engineer works a checklist rather than three separate
tickets.

**c. Suggest what else to do while there.** Not just open faults: the weekly
check-in if it is due, tablets flagged as repeat offenders (feature 4), and the
LRS if its heartbeat is unstable (feature 1). This is where the features
compound.

**d. Record the visit.** Date, engineer, school, what was closed, what was not
and why. That record is what the weekly check-in and the SLA story currently
lack — and it is what makes "we visited" auditable.

### Schema (additive)

`visits`
| column | why |
|---|---|
| `id`, `school_id`, `engineer_id` | who went where |
| `planned_for` DATE | the plan |
| `started_at`, `completed_at` DATETIME NULL | what happened |
| `status` | planned / done / cancelled |
| `notes` TEXT | what could not be finished |

`errors.visit_id` INT NULL — the fault-to-visit link, nullable so nothing about
existing tickets changes.

### Offline

A visit is precisely the moment there is no signal — the engineer is standing
in the failed school. The visit checklist and its status changes ride on
feature 2's queue. Planning happens online; execution must not need to be.

## Not built

- Route optimisation and travel-time estimates. Four engineers who know the
  district do not need a distance matrix.
- Automatic dispatch or assignment. `assigned_admin_id` per school already
  covers it, and the person choosing their own day is better than an algorithm
  choosing it.
- Calendar integration. Worth revisiting only if visits become frequent enough
  to clash.

## Verification plan

- The grouped queue counts match the ticket list per school exactly.
- Planning a visit attaches the open faults and does not alter their status.
- Closing a fault inside a visit produces the same audit trail as closing it
  from the tracker.
- A cancelled visit releases its faults back to the plain queue.
- Suggestions are correct: a school with a due check-in, a repeat-offender
  tablet and an unstable LRS shows all three.
- All four breakpoints, since this is a phone screen in a car.
