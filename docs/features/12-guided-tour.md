# 12 — Guided tours: showing a newcomer where things are

**Status:** built and verified, 2026-09-24 · **Suite:** `backend/scripts/verify-tour.js` (75 assertions, a real browser included)
**Decision:** DECISIONS.md D27

## The gap

A new account opened onto a dashboard and a sidebar of up to eighteen items, with
no explanation of any of them. A teacher had to work out alone that a broken tablet
starts at **Report Error**, and that the guides might fix it before anyone had to come.
A school administrator had to find out that teachers' faults arrive with them first.
The User Guide exists, but only school administrators see it, and it is a document to
read rather than something that points at the screen.

## What the research says

| Source | Finding | What it decided here |
|---|---|---|
| [NN/g, *Onboarding Tutorials vs. Contextual Help*](https://www.nngroup.com/articles/onboarding-tutorials/) (fetched) | Tutorials pushed on people "interrupt users, don't necessarily improve task performance, and are quickly forgotten". Help that appears in context, when it is needed, works. Keep it dismissible and retrievable. | The first sign-in **offers** a tour and never starts one. Page tours are started from the page they explain. Every tour can be ended at any stop and replayed from the profile menu. |
| [Chameleon, *What 550M data points say about your product tour*](https://www.chameleon.io/blog/mastering-product-tours) (fetched) | 3-step tours: 72% completion; 4-step: 74%; 7 or more: **16%**. Tours people start themselves: 67%; tours started on a delay: 31%. | **At most five stops**, with a test that enforces it. The tour is opt-in. |
| [Shepherd.js](https://www.shepherdjs.dev/) (fetched) | The accessibility baseline: keyboard navigation, focus trapping, ARIA attributes. **AGPL-3.0** unless licensed commercially. | Matched feature for feature. Not used, because of the licence. |
| [Driver.js](https://github.com/kamranahmedse/driver.js) (fetched) | MIT, ~5 kB, zero dependencies; spotlight and popover. Nothing for multi-page tours or waiting on pages that render asynchronously. | Its spotlight technique (a box whose shadow dims the rest of the screen) is used. The library is not: see below. |
| Adobe Spectrum, *Coach mark* | The page returned no content to the fetch. | Not relied on. |

## What was built

### One offer, per account

After the first page renders, `Tour.boot()` asks `GET /api/auth/tour`. If this account
has never been offered the tour, a centred card appears 0.9 s later. It is never shown
over an open modal, and never during a forced password change:

> **Welcome, Neema**
> This is where you report a device that is not working and follow it until it is fixed.
> Would you like a one-minute look around? It is 5 stops.
> [Not now] [**Show me around**]
> *You can find it later under Product tour in your profile menu.*

Nothing is recorded until the person reaches a real stop. A reload or a closed tab
while the card is up does not use up the offer. This was found in testing: the first
version spent it on display.

Progress is kept on the **account**, not the device. School tablets are shared, so
browser storage would have shown the tour to the first teacher on a tablet and to
nobody after them.

### Role tours: five stops each

| Teacher | School administrator | Field engineer | Platform admin |
|---|---|---|---|
| Report Error | Error Tracker: teachers' faults arrive with you; Escalate | Follow-Up Center: what is late | Approvals |
| Troubleshooting: try a guide first, works offline | Teachers: links, approvals, inventory grants | Visit Planner | Analytics |
| Error Tracker: follow your reports, rate the repair | Tablet Inventory | School Profiles | Sub-Admins |
| AI Assistant | The bell | The bell: assignments | Security Overview |
| Where the tour lives | Where the tour lives | Where the tour lives | Your account: two-step, sign out everywhere |

The stops are the sidebar and the topbar. They exist on every page and in every data
state, so a tour never depends on what a school has in its tables. Every claim a stop
makes was checked against the code first. Teachers get no bell stop because nothing is
sent to a teacher's bell.

### Page tours: "Show me how"

The report form has a **Show me how** button: category → title (and the guides that
appear under it) → photos → submit, which works without internet. It is started by
whoever is on that page, at the moment they need it. That is the pull-style help NN/g
found works.

### The engine: `frontend/js/components/tour.js`

- **Spotlight and bubble.** A fixed box around the target whose 9999 px shadow dims
  everything else. The bubble sits beside the target wherever it fits (right, bottom,
  top, left), clamped 16 px inside the screen, with an arrow at the target's centre.
  On a phone (≤ 520 px) it docks to whichever half of the screen the target is not in.
- **Across pages.** A stop may name a page: the tour navigates, waits for the render
  and polls up to 4 s for the target. A stop whose target is not on this account's
  screen is skipped, not shown pointing at nothing.
- **The phone drawer.** Sidebar stops open the drawer at ≤ 920 px and close it after.
- **Accessibility.** The bubble is a `role="dialog"` with `aria-modal`, `aria-labelledby`
  and `aria-describedby`. Focus moves to the primary button and Tab cycles inside the
  bubble. Esc skips; → and ← step. Each stop is announced ("Step 2 of 5: …") through a
  polite live region, and focus returns where it was when the tour ends.
  `prefers-reduced-motion` turns off the glide.
- **Nothing lost to a stray tap.** A tap on the dimmed page refocuses the bubble instead
  of ending the tour. On a school tablet, an accidental touch is likelier than a
  deliberate one.
- **Shared tablets.** Signing out mid-tour removes it. Nothing carries over to the next
  person.
- **No inline handlers.** The menu item and the page buttons use `data-tour-start`, with
  one delegated listener. The strict script policy (D24) is waiting for the existing
  inline handlers to be migrated, so none are added. A test enforces this.

### Why not a library

Shepherd's AGPL licence rules it out. Driver.js solves the easy half, the spotlight and
the popover. The half that matters here is this app's own: hash-route navigation with
asynchronous renders, the phone drawer, stops that depend on role, and progress kept on
the account. That would have been glue around a dependency. The engine is about 470
lines, vendors nothing, and uses the app's own design tokens.

## API

| Method | Path | Body | Answer |
|---|---|---|---|
| GET | `/api/auth/tour` | — | `{ tours: { role: { status, step, at }, … } }` |
| PUT | `/api/auth/tour/:id` | `{ status: started\|dismissed\|completed, step: 0–20 }` | the updated `tours` |

Signed-in only, and own account only: there is no id to pass. `:id` must be `role` or a
known `page:<name>`. A status never goes backwards (completed > dismissed > started), so
replaying a finished tour and closing it early keeps "completed". Unknown keys are dropped
on every write, so the column cannot grow. A corrupt value reads as no progress, not a 500.

Schema: `users.tour_state TEXT NULL`, added additively in `schemaExtensions.js`. NULL means
never offered.

## Verification

`backend/scripts/verify-tour.js`, **75 assertions**:

- **API (15):** 401s, six kinds of bad input refused, stored, never backwards, isolated
  per account, bounded, corrupt value tolerated.
- **Content (18):** every sidebar stop is a page that role can open, read from
  `index.html`'s own `data-role` markers with the same table as
  `Router.applyRoleVisibility()`; ≤ 5 stops; every stop explained; page-tour ids accepted
  by the server; no inline handlers.
- **Browser (42), headless Chrome:** each role at 1440 px and 375 px, plus 920 px. At every
  stop, the spotlight is on its target, the bubble is fully on screen and does not cover
  the target, focus is inside the bubble, and the drawer is open for sidebar stops on a
  phone. Also: the offer, reload-safety, → ←, Tab trapping, completion stored, no second
  offer, replay from the menu, Esc, "Not now", the report-form tour on desktop and phone,
  and sign-out mid-tour.

The browser half needs Chrome or Edge. With none installed it says so and skips. If one is
installed but will not start, the suite fails: a silent skip once reported green having
checked nothing.

## Not done, on purpose

- **No analytics dashboard of completion rates.** `tour_state` records where each account
  stopped, so it can be counted later; with four roles and a few hundred accounts, a
  chart is not yet worth building.
- **Page tours for other pages.** Report is the one most people use. The rest get one when
  someone is seen to get stuck on them. The server already accepts `page:tracker`,
  `inventory`, `visits`, `teachers` and `security`.
