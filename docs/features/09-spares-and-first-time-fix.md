# 09 — Spares, swaps and first-time fix

**Status:** built and verified, 2026-09-10 · **Suite:** `backend/scripts/verify-spares.js` (45 assertions)

## The gap

The system knew a tablet was faulty, how old it was, whether it was still under
warranty and whether it was worth repairing. It did **not** know whether there
was a working device to put in the child's hands.

So an engineer drove to a school, confirmed what the school had already told
them, wrote a note, and drove back. The visit checklist listed what was broken
and never what to bring.

Field-service research is blunt about this: **first-time fix rate** is the metric
every other one follows from — it is what cuts repeat visits, downtime and cost
— and it depends on the technician having the part in the vehicle. Stockout rate
sits next to it. We could not improve either, because we could not measure them.

## What was built

### A spare is a device, not a new concept

`tablets.is_spare` — one additive column. A **spare** is a device that is marked
aside, **Working**, and **unassigned**. All three conditions, always, in one SQL
fragment (`SPARE_WHERE`) so the definition cannot drift between the count and
the picker.

Marking is refused for anything else, with the reason:

- an assigned device → *"This device is assigned to Juma P. Unassign it first."*
  Promising the engineer a device that is under a student's hand is worse than
  promising nothing.
- a faulty device → *"A Faulty device cannot be held as a spare."*

### The number that matters is what is missing

```
needed = max(0, awaiting_swap − spares_available)
stockout = awaiting_swap > 0 AND spares_available = 0
```

`needed` is what to load into the vehicle, never negative — it is a packing
list, not an accounting figure. The Spares view is **sorted by what is missing**,
because the only question an engineer asks here is *"which school can I not fix
today"*, and a list sorted by stock answers a question nobody has.

### The swap is one action, and it is a transaction

`POST /api/inventory/:id/swap` with a `spare_id`:

1. the student and admission number move to the spare,
2. the spare stops being a spare and is stamped `assigned_at`,
3. the broken device is unassigned and moved to **In Repair**,
4. both devices get a history row (`swapped_out` / `swapped_in`),
5. a `tablet_swaps` row records the pair, the student, the fault and the visit,
6. if a fault was named, the ticket gains a *Swap* update.

All six inside one transaction with `SELECT … FOR UPDATE`. Half of this
happening is worse than none of it: a student assigned to two devices, or to
none.

**Why a `tablet_swaps` table** rather than reading it back out of history: "how
many swaps, for which faults, on which visits" is a question worth answering
directly, and reconstructing it from two history rows is fragile.

### First-time fix, honestly

```
of the visits completed in the window,
  measurable   = those with faults attached
  fixed_first  = those where every attached fault was resolved
  rate         = fixed_first / measurable        (null when measurable = 0)
```

Two deliberate choices, both following the rule this codebase already uses for
SLA compliance:

- **A visit with no faults attached is not counted.** It tells us nothing about
  fixing, and counting it as a success would inflate the number for free. Those
  visits are reported separately (`visits_no_faults_attached`) rather than
  folded in.
- **`null` is not `0%`.** "No completed visits yet" and "every visit failed" are
  different statements and must not look the same. The card shows "—" with the
  reason underneath.

### Where it appears

- **Inventory → Spares** — four cards (cannot fix today / awaiting a swap /
  spares on the shelf / first-time fix) and a table sorted by the gap.
- **Device detail** — *Hold as spare* on a working unassigned device, *Swap for
  a spare* on a faulty one, and a `SPARE` badge on the card.
- **Visit checklist** — a **What to carry** block, placed *above* the fault list
  on purpose: it is the part you read before you leave, and the fault list is
  the part you read on arrival. When the school has no spare it says so in red:
  *"without one in the vehicle, these cannot be fixed today"*.

## What testing changed

**The first suite was wrong, not the code.** It asserted absolute counts —
"two faulty devices are awaiting a swap" — against a fixture school that is a
*real* school with 190 devices already in it, several of them faulty. Three
assertions failed on a number that was correct. Every count is now a **delta
against a baseline** taken at the start, the same discipline the deflection
assertions in the trends suite use.

The lesson is worth keeping: a suite that assumes an empty world passes only on
an empty database, and the day it runs against real data it reports a bug that
does not exist.

**A double full stop.** "UIDEMO-S1 is now with Neema J.." — Tanzanian names
routinely end in an initial, so the message now checks before adding one.

## Verification

`node backend/scripts/verify-spares.js` — 45 assertions, no rows left behind.
Covers: stock counting as deltas, the three refusals for marking a spare, the
history row, self-swap and assigned-device rejection, the full swap with both
devices and both histories, the swap row, the depleted shelf, the overview
matching the service, first-time fix at null / 100% / 50% with the
no-faults-attached case counted separately, role scope (teacher may read, may
not write; unauthenticated refused), and the ticket update when a swap is linked
to a fault.

Checked in the browser as a school administrator: the Spares tab reads
*0 cannot fix today · 4 awaiting · 1 spare · first-time fix —*, and a swap from
the device detail moved the student across and left the broken device In Repair.

Every other suite still passes (523 assertions across eleven suites).

## Deployment

Nothing to configure. The column and table are additive and apply themselves on
startup; a system with no spares marked simply reports zero and says so.
