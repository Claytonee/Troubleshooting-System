# System audit, research and plan — September 2026

Commissioned 2026-09-10: audit the whole system and every role, research what the
best systems in the world and the best systems in East Africa do, find the gaps,
decide what to build, build it, and write down why.

---

## Part 1 — What exists today

Measured, not remembered: 26 tables, 128 API endpoints, 24 pages, ~20,000 lines.

### The four roles and what each can reach

Pinned by `backend/scripts/verify-role-matrix.js` (124 assertions), so this table
is executable rather than aspirational.

| | platform admin | field engineer (subadmin) | school admin | teacher |
|---|---|---|---|---|
| Dashboard, Errors, Guides, Resources, Inventory, Search | ✔ | ✔ | ✔ | ✔ |
| AI Assistant | — | ✔ | ✔ | ✔ |
| Error Tracker | all | assigned schools | own school | own reports |
| Analytics, School Profiles, Check-Ins, Communications | ✔ | ✔ | ✔ | — |
| Visit Planner | ✔ | ✔ | — | — |
| Sub-Admins, School Admins, Audit, LRS, Approvals, Branding | ✔ | — | — | — |
| Teachers, registration links, inventory delegation | — | — | ✔ | — |
| Tablet inventory writes | ✔ | ✔ | ✔ | only if granted |

### The eleven capabilities that carry the system

1. **Fault lifecycle** — report → route → assign → escalate → resolve → rate,
   with SLA targets per priority and an audit trail.
2. **Tiered escalation** — teacher → school admin → platform, each step recorded.
3. **Tablet inventory** — 190 devices, CRUD, CSV import/export, per-device history.
4. **Asset lifecycle & TCO** — warranty state, repeat offenders, repair-or-replace.
5. **LRS heartbeat** — a silent school server opens its own critical ticket.
6. **Offline-first PWA** — queued writes with photos, `client_ref` idempotency,
   backoff resync.
7. **WhatsApp intake** — signature-verified, assistant replies, files a fault.
8. **Visit planner** — one trip per school instead of one per fault.
9. **Trend metrics** — weekly buckets, honest nulls, no fabricated percentages.
10. **Weekly check-ins** — a health pulse per school.
11. **AI assistant** — grounded in the school's own guides and open faults.

### What the numbers say about usage

`errors 22 · tablets 190 · weekly_checkins 30 · guides 5 · schools 10` and
**zero rows** in `visits`, `teachers`, `lrs_devices`, `manuals`,
`communications`, `whatsapp_conversations`, `ai_chats`.

That distribution is the most useful finding in the whole audit. The reactive
core is in use. Everything that requires somebody to sit at a browser and enter
data ahead of time — visits, teacher accounts, the LRS register, the resource
library — is empty. **A feature nobody can reach from a phone with no bundle is
a feature that does not exist here.**

---

## Part 2 — Research

### What the global leaders do (ServiceNow, Jira Service Management, Freshservice)

- Automation and AI for routing and approvals, low-code workflow, analytics.
- **Asset and configuration management is treated as foundational** — "it is
  nearly impossible to solve tickets quickly without a clear view of what assets
  you have, who is using them, and their service history".
- Jira Service Management wins on time-to-live (weeks, not months); ServiceNow
  wins on depth for organisations with dedicated platform owners.

**Read across to us:** we already have the asset spine and the automation the
research calls foundational. We are not short of ITSM features. Copying more of
them is not where the next unit of value is.

### What works in East Africa and Tanzania

- **Tanzania's national School Information System (SIS/TAMISEMI)** is explicitly
  built to work **online and offline** in low-connectivity areas.
- **InfoTaaluma** reaches **200,000+ parents across 253 Tanzanian schools using
  a mobile app *and SMS*** — "to ensure even parents without internet access can
  stay involved".
- **Eneza Education** (Kenya) reached rural students **over plain SMS**.
- **USSD** is session-based, needs **no internet**, works on **feature phones**,
  is already familiar to everyone from mobile money, has a smaller packet than
  SMS and therefore arrives faster.
- **Africa's Talking** provisions USSD shortcodes on **Vodacom Tanzania and
  Airtel Tanzania**, driven by a callback URL — and it is already this system's
  SMS vendor (`backend/src/services/sms.js`).
- Offline LMS deployments in Tanzania run on **micro-servers** (Raspberry Pi
  class) precisely because the uplink cannot be relied on — the same premise as
  our LRS heartbeat.

### What field service measures

First-time fix rate, stockout rate, inventory turnover, MTBF and uptime. "A high
first-time fix rate is a clear sign your preventive maintenance programme is
working." Technicians need **the right part in the van**, or the visit is a
second visit.

---

## Part 3 — The gaps, in order of what they cost

### G1 — There is no way to report a fault without the internet 🔴

The whole intake surface — web, PWA, WhatsApp — needs data. WhatsApp needs a
smartphone *and* a bundle. A teacher whose bundle ran out, or who carries a
feature phone, has **no way to reach this system at all**. That is not a missing
feature; it is a missing floor.

Every comparable Tanzanian system solves this with SMS or USSD. We already pay
for the vendor that provides both.

**Cost of the gap:** faults that are never reported. They do not show up in any
metric, which is exactly why this gap survives.

### G2 — An engineer drives out without knowing if a spare exists 🔴

We know a tablet is faulty, its warranty state, and whether it is a repeat
offender. We do **not** know whether there is a working spare to swap in. The
visit checklist says what is broken, never what to carry.

First-time fix rate is *the* field-service KPI, and it is unimprovable without
parts. Right now we cannot even measure it.

### G3 — Everything is reactive except one heartbeat 🟠

The LRS tells us when it dies. Nothing schedules the check that would have
stopped it dying: batteries, dust, cabling, disk space, termly device audits.
Preventive maintenance is the practice that raises first-time fix and uptime.

### G4 — The knowledge loop is open 🟠

Five guides exist. Nothing connects "this fault was resolved" to "this guide
fixed it", and nothing puts the right guide in front of the next teacher
*before* they file. Deflection is measured; it is not engineered.

### G5 — Nobody is told anything unless they log in 🟠

The Monday digest was specified and never wired. A head teacher who never opens
the app never learns that their school has three open faults. Email is not
configured on this deployment, so in practice the only channel that reaches a
human is the one G1 says we do not have.

### G6 — "Was my school's equipment working this term?" cannot be answered 🟡

Trends are system-wide and per-school by fault count, but there is no uptime or
availability figure per school over a term — the question a head teacher and a
funder actually ask.

---

## Part 4 — The plan

Ordered by the cost of the gap, not by how interesting the feature is.

| # | Build | Closes | Why now |
|---|---|---|---|
| 8 | **USSD + SMS intake** | G1 | Restores the floor: any phone, no internet, no bundle. Vendor already integrated. |
| 9 | **Spare pool & first-time fix** | G2 | Makes the trip productive and the KPI measurable. |
| 10 | **Preventive maintenance** | G3 | Turns the visit planner from reactive to scheduled. |
| 11 | **Guide-first reporting** | G4 | Deflects the faults that never needed an engineer. |

Deliberately **not** built, and why:

- **WebSockets / live updates.** Bandwidth is the scarce resource; polling on a
  30s badge already costs more than it should.
- **A parent portal.** Out of this system's remit — it supports equipment, not
  learners.
- **ML anomaly detection.** Ten schools and 22 faults will not train anything the
  heartbeat and a threshold do not already catch.
- **A second mobile app.** The PWA plus USSD covers every phone in the country.

Each feature ships with a verification suite, a document explaining the reasoning
and the trade-offs, and a commit of its own.

---

## Part 5 — What was delivered

All four, same day, each with a verification suite and a document of its own.

| # | Built | Assertions | Doc |
|---|---|---|---|
| 8 | USSD + SMS intake | 59 | [08](features/08-phone-intake.md) |
| 9 | Spares, swaps & first-time fix | 45 | [09](features/09-spares-and-first-time-fix.md) |
| 10 | Guide-first reporting | 30 | [10](features/10-guide-first-reporting.md) |
| 11 | Preventive maintenance | 33 | [11](features/11-preventive-maintenance.md) |

**586 assertions across thirteen suites, all passing**, with the database
returned to the state it was found in after every run.

### What the work found on the way

Three real defects, none of them in the features being built:

1. **WhatsApp faults skipped the school administrator.** Extracting the routing
   rule into `services/intake.js` exposed it: a teacher reporting on the web
   reached their school administrator, while the same teacher reporting the same
   fault over WhatsApp was assigned straight to the field engineer and told *"an
   engineer has been notified"*. Two channels, two answers. One rule now,
   asserted from all four.
2. **`GET /api/guides/suggest` answered 404**, because the static routes were
   added below `router.get('/:id')` — directly beneath a comment saying not to.
3. **The first spares suite asserted absolute counts** against a fixture school
   that holds 190 real devices, and reported a bug that did not exist. Every
   count is now a delta against a baseline taken at the start.

### What is now possible that was not

- A teacher with **no bundle and a feature phone** can file a fault, and check
  its status, on any handset on Vodacom or Airtel Tanzania.
- An engineer knows **before leaving** whether the school has a working device to
  swap in and how many to load — and first-time fix is measurable at last.
- A fault a guide would have fixed **is never filed**, and the guides that fail
  are named so somebody can rewrite them.
- A trip can be justified by **work that prevents the next fault**, not only by
  faults that have already happened.

### Still deliberately not built

Everything in Part 4's list stands. Two additions, deferred with reasons rather
than forgotten:

- **The Monday digest email.** Its contents are defined; SMTP is unconfigured on
  this deployment, and now that USSD and SMS exist the digest should probably go
  out over SMS instead. That is a decision to take, not a build task.
- **A per-school uptime figure for a term** (gap G6). It needs a definition of
  "up" that the data can actually support. Inventing one would produce exactly
  the kind of number this codebase has spent a fortnight removing.
