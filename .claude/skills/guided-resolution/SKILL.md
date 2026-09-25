---
name: guided-resolution
description: Design an answer-first, internally-grounded resolution assistant — one that answers in words before it shows media, recommends only resources the system actually holds, and turns a failure to help into a specific request for the missing resource. Use when building or changing ticket deflection, "try this first" panels, knowledge suggestions, AI support assistants, diagnostic question flows, or knowledge-gap capture.
---

# Guided resolution

How to help someone fix a problem themselves, using only what your system already
holds — and how to make the times you *cannot* help produce the thing that will
help the next person.

This is a design method, not a library. It assumes a support system with a
knowledge base, uploaded resources, and a history of resolved cases.

---

## 1. The shape of an answer

Search engines converged on one ordering for "how do I fix X", and it is not a
list of links. Google's 2026 how-to result is: **a short answer in words**, then
**numbered steps**, with **video cards embedded inline between the steps** — not
in a separate video section — and documents below that. The ordering is the
finding. Reproduce it:

| Position | What | Why it is there |
|---|---|---|
| 1 | **The answer in one short paragraph** | "This is almost certainly the charging hub, not the tablets." A person needs to know *what they are dealing with* before they will invest in steps. |
| 2 | **Numbered steps** | The actual procedure, shortest first. |
| 3 | **Media at the step it belongs to** | A video card beside step 3, because it shows step 3. Not a gallery at the bottom. |
| 4 | **Documents** | "Read more" — the manual page, the spec sheet. Lowest, because reading a PDF is the most expensive thing you can ask of someone standing in a classroom. |

**Never lead with media.** A video is a large ask: it needs bandwidth, sound,
and minutes. Lead with the sentence that might save them from needing it.

**Show nothing rather than something weak.** A panel that surfaces the
least-bad match every time teaches people to ignore the panel. An empty state
that says "we have nothing for this yet — help us fix that" is worth more than
a wrong guess, because it is *true* and it leads somewhere (§4).

## 2. Retrieval is deterministic; the model only selects

The hard rule, and the one that decides whether this is trustworthy:

> **Candidates come from a query. The model may only choose, order and explain
> from the candidates it was given. It may never name a resource that was not
> retrieved.**

Retrieval in SQL (or your search index) → a candidate set → the model ranks,
writes the one-paragraph answer, and says *why each resource is relevant* ("the
hub is shown at 2:14"). If the model can invent a resource, it eventually
recommends a video that does not exist, and the feature is worse than nothing:
the person searches for it, fails, and trusts you less than before they asked.

Practical consequences:

- Pass the model an explicit list with ids; require it to answer with ids.
- Drop any id it returns that was not in the list, and log that it did — a model
  that starts inventing is a prompt regression you want to see.
- **Degrade to retrieval alone.** When the model is unconfigured, rate-limited or
  down, show the ranked candidates without the written answer. The feature must
  never be all-or-nothing on an external service.

## 3. What counts as a resource

Most systems under-count what they already have. Look for all five:

1. **Authored guides** — the obvious one.
2. **Uploaded files** — manuals, videos, images, audio. Rank by type *for the
   situation*: a photo of the right cable beats a 40-page PDF.
3. **Past resolved cases** — the strongest and the most overlooked. "This was
   fixed at another site three weeks ago, and here is what was done." Nobody has
   to author it; it accumulates by itself; it is specific to your equipment.
4. **Attachments on those cases** — the photo a colleague took of the same fault.
5. **Nothing.** An honest empty state is a resource (§4).

Ranking signal beats text match. Prefer, in order: a resource somebody confirmed
fixed this before (a recorded deflection), a case resolved on the same model or
at the same site, recency, then text similarity. Text match alone ranks the
wordiest document first.

## 4. When you have nothing: ask, then convert the gap into a request

This is where most systems stop, and it is where the value is. Two halves.

### 4a. The questions — psychology

Classic support training teaches the **funnel**: broad open questions, narrowing
to closed ones. Invert it here. You already have their written description, so
you are not gathering the big picture — you are closing specific gaps, and the
person is stressed and standing up. Under stress, open questions feel aimless
while closed ones signal *someone has a plan*.

Rules that keep questions from becoming an interrogation:

- **Three at most.** Completion collapses beyond that, the same way it does on
  onboarding flows.
- **Closed and specific first.** "Is the light on the hub green, orange, or off?"
  Momentum comes from a question that is cheap to answer.
- **One open question, last, and optional.** "Anything else you noticed?"
- **Answerable from where they are standing.** Never ask for a serial number, a
  log, or a model name they would have to go and find.
- **Multiple choice wherever possible.** On a shared device with a poor keyboard,
  tapping is an order of magnitude cheaper than typing.
- **Never ask what you already know.** Their school, their device model, the
  guides they already opened, whether their server is reachable — all on file.
  Asking again tells them you were not listening.
- **Every question must change something.** If neither the diagnosis nor the
  resource request would differ based on the answer, delete the question. (The
  same test as any dashboard figure: if it changed, what would be different?)
- **Say why you are asking.** "So the engineer does not have to drive out to ask
  you this." A question with a stated purpose is collaboration; without one it is
  an obstacle.
- **Always skippable, always visibly.** Deflection must never mean a human is
  harder to reach. The button that files the ticket stays exactly where it was.

### 4b. The request — Knowledge-Centered Service

KCS's core idea: knowledge is written **in response to real demand**, not in
advance. A failure to help is a precisely specified authoring task, and you
should emit it automatically:

> **Nobody could fix "Tablets not charging in Form 2" at Mtakuja Secondary**
> Tried: the *Tablets Not Charging* guide (opened, did not fix); swapped the cable.
> Told us: hub light off · 12 tablets on hub 2 · started after a power cut.
> We had nothing to show: no video, no photo, no document mentioning a charging hub.
> **Suggested:** a 60-second video of reseating a hub · a photo of a healthy vs dead hub LED · the hub's manual page.
> `[ Add a resource ]  [ Not needed ]`

Design notes that decide whether this works:

- **Deduplicate on the problem, not the report.** One open request per
  (category, sub-category, normalised problem). Increment a demand counter
  instead of creating a second row — decide "new or existing" with an atomic
  insert-if-absent, never by counting affected rows.
- **Rank the queue by demand.** Eight teachers blocked by the same gap is the
  next thing to author. One is a note.
- **Name the resource type.** "Add a video" is actionable; "improve docs" is not.
- **Close the loop visibly.** When the resource is added, tell the people who
  hit the gap. Otherwise they learn that answering questions achieves nothing,
  and they stop.
- **A request is evidence, not a task assignment.** It records what was missing.
  Whether to author it is a human's call.

## 5. Measuring it honestly

- **A deflection is only ever recorded because a person said so.** "Opened a
  guide and did not file within N minutes" counts every interruption, every flat
  battery and every lunch break as a success. Require the press of *This fixed
  it*.
- **Success rate is `null`, never 0%, for a resource nobody has met.**
- **Count the empty states.** "How often did we have nothing?" is the single
  most useful number this feature produces, and it is the one nobody instruments.
- **Track what was opened but did not help** — the resource that is tried and
  fails is the one that needs rewriting, and nothing else can tell you which.

## 6. Feature usage, if you are instrumenting it alongside

Three different questions; do not collapse them into "usage":

- **Breadth** — what share of the people who *could* use it have used it once.
  A reach problem is a discoverability or training problem.
- **Depth / frequency** — uses per active user. A depth problem is a value problem.
- **Stickiness** — active-today over active-this-month, per feature.

Then the one that drives improvement: **opened and abandoned**. A feature with
high breadth and no depth is being found and rejected, which is a far more
useful finding than a raw count.

Record the role and the site, keep raw events on a retention clock, and make a
new table of personal data carry a policy from the day it is created.

## 7. Checklist before shipping

- [ ] Answer in words appears above any media.
- [ ] Every recommended resource exists in the system and is linked by id.
- [ ] Nothing matches → an honest empty state, not the least-bad guess.
- [ ] The model is optional: retrieval-only still renders.
- [ ] At most three questions, closed first, multiple-choice where possible.
- [ ] No question asks something already on file.
- [ ] Skip is visible at every step; the report button never moved.
- [ ] A gap emits one deduplicated request, with a demand count and a named resource type.
- [ ] Deflection is recorded only from an explicit human confirmation.
- [ ] Empty-state rate is measured.
