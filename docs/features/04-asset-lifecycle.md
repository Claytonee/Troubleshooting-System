# 4. Asset lifecycle & total cost of ownership

**Status:** implemented · **Effort:** S · **Changes:** repair-vs-replace becomes answerable

## What the giants do

Warranty status sits in the same record as acquisition cost, depreciation,
end-of-life date, location and owner, so one asset record shows the whole
financial and operational picture. Refresh cycles are then set from **data, not
the calendar** — warranty expiry, EOL milestones and *ticket volume per device*
are treated as more reliable signals than a blanket replacement rule, because
fixed cycles retire healthy assets and keep failing ones
([InvGate hardware lifecycle](https://blog.invgate.com/hardware-lifecycle),
[GroWrk](https://growrk.com/blog/it-asset-lifecycle-management),
[schools checklist](https://adminremix.com/blog/complete-it-asset-management-checklist-for-schools)).

Standardising on a few models is the other half: fewer models means a smaller
spare-parts inventory and faster support.

## What is missing

`tablets` has serial, asset tag, form, stream, model, year first used, status,
student and notes. There is no `ALTER TABLE tablets` anywhere in
`schemaExtensions.js` — the table is as first written. Missing: **purchase
date, cost, supplier, warranty expiry, expected end of life.**

So two questions cannot be answered at all:

1. *Which tablets should we replace next year, and what will that cost?*
2. *Is this one still under warranty, or are we about to pay for a repair the
   supplier owes us?*

And one is answerable but not asked: `tablet_history` already records every
status change, so the repeat-offender data is sitting there unused. A tablet
repaired five times should not be repaired a sixth — that is a replacement.

## Design

### Schema (additive)

`tablets`
| column | type | why |
|---|---|---|
| `purchase_date` | DATE NULL | start of the lifecycle |
| `purchase_cost` | DECIMAL(12,2) NULL | TCO, in TZS |
| `supplier` | VARCHAR(200) NULL | who owes the warranty |
| `warranty_expires_on` | DATE NULL | repair-vs-claim, and the alert |
| `expected_eol_on` | DATE NULL | refresh planning |
| `batch_ref` | VARCHAR(60) NULL | procurement batches fail together |

`batch_ref` earns its place: devices bought together and used identically fail
together, so a fault rate per batch is a much stronger signal than per device —
and it is the number that justifies a warranty claim to a supplier.

All nullable, `ADD COLUMN IF NOT EXISTS`, no backfill invented. A device with no
purchase date is *unknown*, and shown as unknown.

### Derived, never stored

- **Age** — from `purchase_date`. Stored ages freeze; that mistake is already
  documented in this codebase (`errors.hours_open` drifted by 2141 hours).
- **Warranty state** — `active` / `expiring within 60 days` / `expired` /
  `unknown`, computed at query time.
- **Fault count** — from `tablet_history`, not a counter column.
- **Repeat offender** — 3+ faults, or 2+ within 90 days.

### What it puts on screen

- Inventory filters: warranty state, batch, repeat offender.
- On a device: "3 faults, last 12 days ago · warranty expired 4 months ago" —
  the sentence that decides repair or replace.
- A refresh view: devices past EOL or out of warranty with a fault history,
  totalled in TZS. That is the procurement request, generated rather than
  assembled by hand.
- A batch view: fault rate per batch, which is the warranty-claim argument.

### Alerts

The existing SLA sweep endpoint gains a weekly pass: warranties expiring within
60 days, so a claim is made while it can still be made. No new cron —
`ROADMAP_AND_DESIGN.md` §5 already has the runner.

## Not built

- Depreciation schedules and book value. That is the finance system's job.
- Barcode scanning. The CSV import already handles bulk entry, and phone camera
  scanning is a separate piece of work.
- Automatic supplier integration. Thirteen schools and a handful of suppliers
  do not justify it.

## Decisions taken while building

**The replacement total uses a median, not a mean.** One mistyped cost would
drag an average up and inflate the whole procurement request. The response also
reports how many devices were priced from their own record versus estimated at
the fleet median, so the number is traceable rather than merely plausible.

**`estimated_cost` is `null`, never `0`, when nothing can be priced.** A zero
would read as "free to replace" — the same class of lie as the SLA card that
once showed −200%.

**Warranty reminders ride on the heartbeat sweep.** ROADMAP_AND_DESIGN.md §5 has
one scheduled endpoint; a second schedule to maintain for a weekly check would
be disproportionate. The sweep runs every 5 minutes, so reminders are
deduplicated to one per batch per day via `admin_notifications` — a batch of 40
tablets bought the same day expires the same day, and 40 identical alerts would
train everyone to ignore them.

**`update` uses `COALESCE`, not assignment, for the six new fields.** The edit
modal does not carry the purchase fields, so a plain assignment would silently
erase the procurement record on every ordinary status change. There is a test
for exactly that.

**Repeat-offender thresholds are 3 ever, or 2 within 90 days.** Two faults in
three months is a pattern; two across four years is bad luck. Both are tested at
the boundary.

## What testing and the UI pass changed

- The "Repeat faults" toggle kept its text at every width. `.inv-toolbar`
  stretches its children on a phone, and `.btn-label` hid the label there — an
  icon alone in a full-width bar reads as broken, not as a button.
- The tab row lives outside the swapped `#inv-view`, so changing view left the
  previous tab looking active. `setView` now moves the active class too.
- The exclusion banner said "1 device have no purchase date".

## Verification plan

- Migration runs twice with no error and no data change.
- A device with no purchase data reads "unknown" everywhere, never "expired".
- Warranty state is correct at the boundaries: yesterday, today, tomorrow, and
  exactly 60 days out.
- Repeat-offender flags match a hand count from `tablet_history`.
- The refresh total matches the sum of the listed devices.
- The inventory page renders at all four breakpoints with the new columns.
