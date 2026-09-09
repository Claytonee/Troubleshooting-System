# 11 — Preventive maintenance: stop waiting for things to break

**Status:** built and verified, 2026-09-10 · **Suite:** `backend/scripts/verify-maintenance.js` (33 assertions)

## The gap

Everything in this system was reactive except one heartbeat — and the heartbeat
reports a machine that has **already died**.

Nothing scheduled the check that would have stopped it dying: the dust in the
LRS fans, the UPS battery nobody has load-tested since installation, the
extension lead running warm, the disk quietly filling. Those are the failures
that arrive as a critical ticket on an exam morning.

The field-service research draws the line directly: *"a high first-time fix rate
is a clear sign your preventive maintenance programme is working"*. Scheduled
work is also the only kind that can be **batched into a trip somebody is already
making**, which is the entire premise of the visit planner.

## What was built

### The smallest model that answers "what is due here"

Two tables. No calendars, no recurrence rules, no assignments, no reminders
engine.

- `maintenance_tasks` — name, description, `interval_days`, what it applies to.
- `maintenance_log` — school, task, `done_on`, who, and which visit.

"What is due at this school" is then one left join, and "when was this last
done" is a fact rather than an inference.

### The starting schedule

Seeded once, from what actually kills equipment in these schools — dust, heat,
power and a disk nobody watches — not from a generic IT checklist:

| Check | Every | Why it is on the list |
|---|---|---|
| UPS and battery test | 90d | A UPS that has never been load-tested is a decoration |
| Router and cabling check | 90d | Rodents, loose ethernet, and the WAN light nobody looks at |
| LRS disk and dust | 120d | The heartbeat tells you it died; this is why it died |
| Tablet trolley and chargers | 90d | Dead ports, and swollen batteries that must leave service |
| Power and socket safety | 180d | Scorched or loose is replaced, not noted |
| Termly device audit | 120d | Walking the register is what keeps the inventory true |

`UNIQUE(name)` means the seed is idempotent: re-running the migration on every
boot never duplicates a task and never overwrites an edited one.

### Two decisions that keep the list credible

**A check that has never been recorded is `due`, and counts as overdue.** It is
the most common real state, and a naive "days since last done" quietly skips it
by dividing by a null. A school with no history is exactly the school to visit.

**Due and overdue are not the same thing.** One day past a 90-day interval is
*due*. It becomes **overdue** only after a 14-day grace period
(`OVERDUE_GRACE_DAYS`). Turning the list red on day one is how a maintenance
list becomes wallpaper.

### Where it appears

The **visit checklist** carries `checks` (the due ones) and `checks_all` (the
whole schedule, for context), each with a **Done** button that records the check
*against that visit*. So the sheet an engineer works from now has three parts:

1. **What to carry** — spares and the gap (feature 9)
2. **The faults** — what the school reported
3. **Scheduled checks due** — the work that stops the next fault

Ticking one shrinks the list immediately, and `maintenance_log.visit_id`
preserves "what did we actually do out there" after the drive home.

## Access

Reading is open to every signed-in role and scoped in the controller: a **school
administrator should not have to ask an engineer what is due at their own
school**, and a teacher can see it too. Signing a check off belongs to the people
who carry them out — admin, field engineer, school administrator — and is
validated against the schools that person actually covers, because an engineer
marking a check done at a school they do not visit would silently reset that
school's clock.

## Verification

`node backend/scripts/verify-maintenance.js` — 33 assertions, nothing left
behind. Covers: the seeded schedule and its idempotence; never-done being due
*and* overdue; recording one taking it off the list without touching the others;
the interval boundary at −5 days, +1 day and past the grace period; the visit
sheet carrying only the due checks plus the full schedule, signing one off
against the visit, and the list shrinking; and the whole scope matrix — teacher
reads but cannot sign, a school admin cannot sign for another school, a missing
school is 400, an unknown check 404, no session 401.

All thirteen suites pass together — **586 assertions**.

## Deployment

Nothing to configure. The tables and the starting schedule apply themselves on
startup. A school with no history simply shows every check as due, which is the
honest answer.
