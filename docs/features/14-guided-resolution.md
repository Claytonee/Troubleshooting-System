# Feature 14 — Guided resolution: answer first, then our own resources, then a request for what we lack

**Status:** planned · written 2026-09-25
**Method:** `.claude/skills/guided-resolution/SKILL.md`
**Builds on:** feature 10 (the knowledge loop), feature 12 (tours), D33 (dashboards)

---

## The brief

> Before a teacher escalates, the AI should measure the challenge and recommend
> resources — videos, images, documents — that are close to the solution, so the
> user can watch, read and explore. **All resources must come from inside our
> system.** If we have nothing that helps, the AI should ask a few well-judged
> questions, and their answers should tell the platform admin: *this person hit
> a, b, c; they tried 1, 2, 3; add resources 1, 2, 3, 4 so the next person does
> not have to escalate.* The system should also learn which features are used
> most and how.

## Where we are today

Feature 10 already puts up to three **text guides** above the description field
on the report form (`services/knowledge.js`, `GET /api/guides/suggest`), records
`errors.tried_guide_id`, and counts a deflection only when somebody presses
*This fixed it*. That is the foundation, and its rules carry forward unchanged.

What it does not do:

- It only knows **guides**. The `manuals` table holds PDFs, DOCX, images, video
  and audio on Cloudinary, and `error_attachments` holds photographs teachers
  took of real faults. Neither is ever suggested to anybody.
- It never uses **what was already fixed**. Every resolved fault carries
  `error_updates` notes saying what actually worked, on our equipment, often at a
  school down the road. That is the most specific knowledge the system owns and
  it is invisible.
- It gives a **list, not an answer**. Three titles, no statement of what the
  problem probably is.
- When it matches nothing it shows nothing — correct, and a dead end. Nobody
  learns that the gap existed.

## What gets built

### The result, in the order Google settled on

Research finding (see the skill): the 2026 how-to result is a short written
answer, then numbered steps, with **video cards inline between the steps**, and
documents last. Not a list of links, and never media first — a video costs
bandwidth, sound and minutes, which is the most expensive thing to ask of
somebody standing in a classroom during a lesson.

```
┌────────────────────────────────────────────────────────┐
│  This looks like the charging hub, not the tablets.    │  ← answer, 2–3 sentences
│  All 12 are on hub 2 and the hub light is off, which   │
│  is the pattern we have seen at three other schools.   │
├────────────────────────────────────────────────────────┤
│  1. Unplug the hub at the wall, wait 30 seconds        │
│  2. Reseat the power lead at the back of the hub       │
│  3. Watch the LED                       [▶ 0:42 video] │  ← media beside the step it shows
│  4. If still off, move 2 tablets to hub 1 and test     │
├────────────────────────────────────────────────────────┤
│  Fixed here before  · Kibosho Boys, 3 weeks ago        │  ← past resolution
│  Read more          · Charging hub manual, p.4 (PDF)   │  ← documents last
├────────────────────────────────────────────────────────┤
│  [ This fixed it ]              [ Report it anyway → ] │  ← escape hatch never moves
└────────────────────────────────────────────────────────┘
```

### Retrieval is SQL; the model only chooses

**The rule that makes this trustworthy: candidates come from a query, and the
model may only select, order and explain from the list it was handed. It may
never name a resource that was not retrieved.** A model free to invent will
eventually recommend a video that does not exist; the teacher searches, fails,
and trusts the system less than before they asked.

Five internal sources, unified behind one ranked query:

| Source | Table | Gives |
|---|---|---|
| Guides | `troubleshooting_guides` | steps |
| Uploaded resources | `manuals` | video, image, audio, PDF, DOCX (Cloudinary) |
| Past resolutions | `errors` + `error_updates` | what actually worked here |
| Fault photographs | `error_attachments` | what it looked like |
| Nothing | — | an honest empty state (below) |

Ranking, strongest signal first: a resource somebody **confirmed fixed this**
(recorded deflection) → a case resolved on the **same model or same school** →
recency → text match. Text match alone ranks the wordiest document first.

**The model is optional.** With `AWS_BEARER_TOKEN_BEDROCK` unset, rate-limited or
down, the panel renders the ranked resources without the written answer. The
feature never becomes all-or-nothing on an external service — the same rule
`/api/health`'s feature flags exist to make visible.

### When we have nothing: three questions, then a request

**The questions.** Classic support training teaches the funnel — open questions
narrowing to closed. We invert it: we already have their written description, so
we are closing specific gaps, not gathering a picture, and the person is stressed
and standing up. Under stress open questions feel aimless; closed ones signal
*somebody has a plan*.

- **Three at most**, closed and specific first, one optional open question last.
- **Answerable from where they stand** — "is the hub light green, orange or off?",
  never "what is the serial number?"
- **Multiple choice wherever possible** — tapping beats typing on a shared tablet.
- **Never ask what is on file.** School, device model, LRS state, which guides
  they already opened — all known. Asking again says we were not listening.
- **Every question must change something.** If neither the diagnosis nor the
  resource request would differ, delete it. (The D33 test, applied to questions.)
- **Say why**: "so the engineer does not have to drive out to ask you this."
- **Skip stays visible throughout.** Deflection must never mean a human is harder
  to reach — the Report button does not move. This is already a rule in
  `report.js` and it is not being relaxed.

**The request.** Their answers become one row the platform admin can act on —
Knowledge-Centered Service: content authored in response to real demand, never in
advance.

> **Nobody could fix "Tablets not charging in Form 2" — Mtakuja Secondary**
> Tried: *Tablets Not Charging* guide (opened, did not fix) · swapped the cable
> Told us: hub light off · 12 tablets on hub 2 · started after a power cut
> We had nothing: no video, no photo, no document mentioning a charging hub
> **Suggested:** 60-second video of reseating a hub · photo of healthy vs dead hub LED · hub manual page
> `[ Add a resource ]  [ Not needed ]`   — asked for by **7 people** at **3 schools**

- **One open request per (category, sub-category, normalised problem)** — a
  demand counter increments instead of a second row, decided with `INSERT IGNORE`
  and never from affected-row counts (the rule `services/detection.js` already
  follows). Otherwise the admin's bell floods.
- **The queue sorts by demand.** Seven teachers blocked by one gap is the next
  thing to author; one is a note.
- **Name the resource type.** "Add a video" is actionable; "improve docs" is not.
- **Close the loop visibly.** When the resource is added, the people who hit the
  gap are told. Otherwise they learn that answering questions achieves nothing.

### Feature usage

Three different questions, not one "usage" number:

- **Breadth** — share of the people who *could* use a feature who used it once.
  A reach problem is discoverability or training.
- **Depth** — uses per active user. A depth problem is a value problem.
- **Opened and abandoned** — high breadth with no depth means the feature is
  found and rejected, which is the finding worth having.

Records the role and the school; a user id only where the audit log already keeps
one. A new table of personal data carries a retention policy from the day it is
created (D25) or `verify-retention.js` refuses it.

---

## Phases — additive, each shippable alone

Expand-and-contract throughout: new tables and nullable columns only.

**Phase 1 — Retrieval, no AI.** Unify the five sources behind one ranked query;
render answer-shaped (steps first, media beside the step, documents last) on the
report form. Ships value before any model is involved, and becomes the permanent
fallback.
*New:* `resource_index` (or a query across the existing tables), extended
`knowledge.js`.

**Phase 2 — The written answer.** The model receives the retrieved candidates and
returns: the one-paragraph assessment, the chosen ids in order, and one line per
resource saying why it is relevant. Ids not in the candidate list are dropped and
the drop is logged.
*New:* a grounded prompt in `services/assistant.js`; no schema change.

**Phase 3 — Questions and the gap request.** Only when Phase 1+2 return nothing
above a relevance floor. Three questions, mostly multiple choice, always skippable.
*New:* `resource_requests` (problem key, category, demand_count, evidence JSON,
status), `resource_request_reports` (who hit it), notification type
`resource_gap`.

**Phase 4 — The platform admin's queue.** A page listing requests by demand, with
*Add a resource* wired to the existing Cloudinary upload, and a notice back to
everyone who hit the gap when it is filled.
*New:* routes + a page; reuses `manualController` upload.

**Phase 5 — Feature usage.** `feature_events` plus breadth / depth / abandonment
on `#analytics`. Retention policy on day one.

---

## Rules this feature must not break

- **Nothing matches → show nothing**, never the least-bad guess (feature 10).
- **A deflection is recorded only because a person pressed "This fixed it"** —
  never inferred from silence.
- **`success_rate` is `null`, not 0%,** for a resource nobody has met.
- **The report button never moves.** Deflection is not a wall.
- **A teacher cannot change a fault's status** — nothing here creates a path to it.
- **`/api/guides/suggest` sits above `router.get('/:id')`** — a new route on that
  router goes above it too, or Express reads the word as an id and answers 404.
- **Every stored field is escaped where it is rendered**, including resource
  titles and anything a teacher typed into an answer.
- **Scope**: a teacher sees resources, not other schools' fault records — a past
  resolution is surfaced as *what was done*, never with another school's reporter,
  contact details or photographs of their rooms unless the resource was uploaded
  as a shared one.

## Decided by the owner, 2026-09-25

**1. Past resolutions cross school, stripped.** (Delegated — "fanya world class
decision".) A teacher sees *what was done* and *how long ago*; they never see the
school, the reporter, the contact details, or another school's photographs. The
fix is the knowledge; the school is somebody else's business. This keeps the
security programme's rule intact — a school id is a key, not a permission — while
releasing the one resource that accumulates by itself and costs nobody any
authoring time. A resolution is only eligible when it is resolved, has a note
saying what was done, and is not the reader's own school's private detail.

**2. Only the platform admin fills a gap.** Resource upload stays exactly where
it is today (`manualController`, admin-only). Field engineers and school admins
raise demand; one person curates what gets published. No permission change.

**3. Swahili by default, one tap to English.** Every question is stored and shown
in **both** languages, Kiswahili first, with a clear translate control beside it;
tapping it swaps that panel to English (and back). The choice is remembered **on
the account**, not in browser storage — school tablets are shared, the same reason
`users.tour_state` lives there (D27). Default stays Kiswahili until the reader
touches the control, so nobody has to find a setting to be understood.

Consequences for the build:

- Questions come from a **bilingual bank** wherever one fits, so the wording is
  authored and reviewable rather than generated afresh each time. Where the model
  must compose a question, it returns **both languages in one call** — never a
  second translation round-trip, which would let the two drift.
- A question missing one language is not shown. Half-translated is worse than
  one language done properly.
- `users.language` (nullable, defaults to Swahili when unset) is additive, per
  the expand-and-contract rule.
