# 10 — Guide-first reporting: closing the knowledge loop

**Status:** built and verified, 2026-09-10 · **Suite:** `backend/scripts/verify-knowledge.js` (30 assertions)

## The gap

Five troubleshooting guides existed. Nothing connected them to the moment a
teacher was about to file a fault.

So a teacher opened the report form, typed *"WiFi haifanyi kazi"*, and an
engineer eventually drove out to restart a router — while a guide titled *"WiFi /
Internet Not Working"*, whose **second step is "Restart router (30s off)"**, sat
two clicks away in another part of the app.

Deflection was already *measured* (the analytics page reports it). It was never
**engineered**: nothing put the right guide in front of the right person at the
one moment it would have mattered.

## What was built

### Forward: the guide is in the way

Choosing a category on the report form — or typing a sentence — fetches up to
three matching guides and renders them **above the description field**, the last
thing read before writing the report out.

```
GET /api/guides/suggest?category=Connectivity&text=wifi+haifanyi+kazi
```

Scoring is deliberately plain: **+10** for the category (chosen from a fixed
list, so it cannot be misspelled), **+3** per word matching the title, **+2** per
word matching anywhere in the steps. No search engine, no embedding, nothing to
tune — and a guide that matches nothing scores zero and is **not shown**.
Suggesting the least-bad guide when there is no good one teaches people to
ignore the panel.

Capped at three. A wall of suggestions is a wall, and the fourth-best guide has
never fixed anything.

Each suggestion expands in place to its full steps, with two buttons:

- **This fixed it** → records a deflection and takes them home.
- **Still not fixed** → clears the panel, remembers which guide failed, and puts
  the cursor in the description field.

**Deflection must never mean "harder to reach a human".** The Report button does
not move, nothing is hidden behind the panel, and no step is mandatory.

### Backward: the guide that was read and failed

`errors.tried_guide_id` records which guide someone read before filing anyway —
on the online path *and* the offline queue.

This is the half that was completely missing. A guide that is **tried and still
ends in a fault** is a guide that needs rewriting, and nothing else in the system
can tell you which one that is. The fault also carries it forward: whoever picks
the ticket up knows what has already been attempted, so they do not open by
asking the teacher to restart the router.

### What the two halves add up to

`GET /api/guides/performance` (head office):

| | meaning |
|---|---|
| `deflected` | times this guide made a fault unnecessary |
| `filed_anyway` | times it was read and the fault was filed regardless |
| `times_met` | the people it met at all |
| `success_rate` | `deflected / times_met`, or **`null`** |

`null`, not `0%`, for a guide nobody has met. A guide with no data and a guide
that never helps are different, and showing 0% for both would send someone to
rewrite the wrong one. Same rule as the SLA figure and first-time fix.

## Decisions, and why

**A deflection is only ever recorded because a person said so.** The tempting
alternative — "they opened the guide and did not file within N minutes" — would
count every interruption, every flat battery and every lunch break as a success,
and the number would climb forever while nothing improved.

**Category beats keywords.** Free text in two languages is noisy; the category
is a fixed list. Words only reorder within the category.

**No suggestions on nonsense.** `?text=zzzz nonsense qqqq` returns an empty list,
asserted by the suite.

## The bug this found

The static routes were added *below* `router.get('/:id')`, so `/api/guides/suggest`
was read as a guide with the id `"suggest"` and answered **404** — with a comment
directly above it saying "Static paths before /:id". The rule was written and
then not followed on the very next line. The suite caught it on the first run;
the routes now sit above `/:id` and the comment says what actually happened.

## Verification

`node backend/scripts/verify-knowledge.js` — 30 assertions, no rows left behind.
Covers: suggestion by category alone, by typed words alone, the cap, the empty
result for nonsense; the deflection row with its person, school and source, and
the 404 for an unknown guide; `tried_guide_id` written when a guide was tried
and null when it was not; performance counting both halves with a null rate for
an unmet guide; access (a session is required, a teacher cannot read performance,
head office can); and six source-level checks that the form really does put the
panel in the way, refresh it on category change, and carry the failed guide on
both the online and offline paths.

Checked in the browser as a teacher: choosing **Connectivity** raises *"Try this
first — most of these are fixed in a few minutes"* with the WiFi guide's seven
steps inline, and **This fixed it** records the deflection and answers *"Good —
nothing to report then."*

All twelve suites pass together — 553 assertions.

## Deployment

Nothing to configure. Both schema changes are additive; a deployment with no
deflections simply reports none.
