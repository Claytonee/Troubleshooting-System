# 07 — Teacher scope: read-only inventory, delegated access, and escalation that lands

**Status:** built and verified, 2026-09-09 · **Suite:** `backend/scripts/verify-teacher-scope.js` (62 assertions)

Six things a teacher's account did wrong. They share one theme: the system offered teachers
controls it would then refuse, and sent their requests to people who could not act on them.

---

## 1. "AI service not configured"

**What was reported:** the assistant answers `AI service not configured` for a teacher.

**Root cause.** Not a teacher problem — `AWS_BEARER_TOKEN_BEDROCK` is unset on cPanel, so the
assistant is off for **every** role. It is set in `backend/.env` locally, which is why nobody
saw it in development. The reason it was never set in production: the variable was **missing
from the deployment env list in CLAUDE.md**. It has been added there.

**Evidence.** Locally, with the key present, a teacher's request streams normally:

```
teacher user keys: id,username,email,full_name,role,…
status 200 text/event-stream
data: {"type":"delta","text":"Tablet"}
data: {"type":"delta","text":" haiwaki kabisa —"}
```

So the code path was never role-gated; the credential is simply absent on the server.

**What was fixed in the code**, since the credential itself is the user's to paste into cPanel:

- `GET /api/ai/status` → `{ configured, model, hint }`. The page asks **before** rendering a
  composer nobody can use.
- The chat page renders an honest unavailable state instead: no text box, and the two routes
  that still work — the troubleshooting guides, and a fault report that reaches a human.
- **The env var name goes only to an administrator.** Telling a teacher to "set
  AWS_BEARER_TOKEN_BEDROCK" gives them a task they cannot do. An admin also gets an
  "I have set the key — check again" button.
- `GET /api/health` now carries `features: { ai, email, sms, whatsapp_inbound, whatsapp_send,
  heartbeat, uploads }` — booleans only, taken from the services' own `isConfigured()` where one
  exists. This is how the same question gets answered next time without cPanel access.

**To switch it on:** set `AWS_BEARER_TOKEN_BEDROCK` in cPanel → Setup Node.js App →
Environment variables, then restart the app. Confirm with
`curl -s https://support.mkatolikikiganjani.com/api/health` → `features.ai: true`.

---

## 2. The registration link's capacity is the school admin's to choose

`max_uses` was hardcoded to 50 for every school. A link shared in a staff WhatsApp group
travels; 50 slots at a school with 12 teachers is 38 openings nobody is watching.

- The Generate button now opens a form: **how many teachers may register with this link?**
  Bounds 1–500, pre-filled with *(teachers on file + 5)* — a suggestion from what the system
  already knows, not a round number.
- `PATCH /api/register/teacher-links/:id` raises or lowers the cap on a link that is already
  circulating. The alternative — deactivate and re-share — quietly locks out everyone who kept
  the old URL.
- **Never below `use_count`.** Those teachers exist; a cap under the count reads as "over
  capacity" in every list.
- **Change limit stays visible on a full link.** It used to hide every button once
  `use_count >= max_uses`, which is precisely the moment the cap needs raising.

**A real bug found on the way.** `req.body.max_uses || 50` accepted `"twenty"`: `Number` gives
NaN, MySQL stores NULL, and `use_count >= NULL` is never true — so a mistyped limit produced an
**unlimited** link. `parseMaxUses()` now refuses non-integers, fractions and out-of-range values.
Verified: `"twenty"` → 400, `5000` → 400, `2.5` → 400.

---

## 3. One subject list, two forms

Typed freely, one subject arrived as "Maths", "MATHEMATICS", "math" and "Mathematics/Physics",
which makes *how many science teachers are there* unanswerable.

`TEACHER_SUBJECTS` in `frontend/js/utils.js` is a single grouped list — Sciences, Languages,
Humanities, Business & ICT, Vocational & Arts, School roles — used by the **public registration
form and the school admin's Add Teacher modal**, so the two cannot drift.

Decisions:

- **"Other" stays, with a text box.** A list that cannot express a real teacher's post just gets
  the nearest wrong answer picked. Verified end to end: "Sign Language" typed into Other is
  stored verbatim.
- **A stored value that is not on the list is kept as its own option.** Opening a form must never
  silently rewrite what is on file.
- **School roles are in the list** (Academic Master, ICT Coordinator, Laboratory Technician) —
  the people most likely to be the school's inventory delegate do not teach a single subject.

---

## 4. A teacher's escalation goes to their school administrator

**Before:** Escalate emailed `ESCALATION_EMAIL` — head office — over the school's head. The
teacher got no way to see what happened next, and the person who could actually walk to the
room was not told.

**Now:** for `role === 'teacher'`, `POST /api/guides/:id/escalate` writes an
`admin_notifications` row (`target_role='school'`, `type='guide_escalation'`) carrying the
school, the guide, the category and the teacher. The reply names the recipient, and the toast
says so: *"Your school administrator (Eliya Mushi) has been notified."*

The school admin's bell shows *"Neema Joseph needs help: WiFi / Internet Not Working"*, and
clicking it **opens the report form pre-filled**:

```
title: WiFi / Internet Not Working — still not resolved
desc:  Neema Joseph followed the "WiFi / Internet Not Working" guide and the problem is
       still there.
       Category: Connectivity

       What I checked myself:
```

That closes the loop teacher → school admin → engineer, with the school admin adding what only
they can add.

Decisions:

- **No school administrator on file → fall back to email**, and say so
  (`no_school_admin: true` → *"Your school has no administrator on file, so support was emailed
  directly"*). Silently dropping an escalation is the worst of the three outcomes.
- **`/api/schools/notifications` is scoped by `meta.school_id`** for the `school` role, in the
  read **and** in mark-as-read. Role alone would show one school another school's escalations.
- The hint beside the button now says where it goes: *"Escalate to your school administrator"*
  for a teacher, *"Escalate for engineer follow-up"* for everyone else.

---

## 5. Tablet inventory is read-only for a teacher

The backend already refused teacher writes (`authorize('admin','subadmin','school')`). The
**page did not know that**, so it drew Add, Import, the per-card pencil, Edit and Change Status
for teachers — every one of them a 403 waiting to happen.

Fixed by asking the server what this account may do, not the role in `localStorage`:

- `GET /api/inventory/stats` returns `can_write`.
- `InventoryPage.canWrite()` gates the header buttons, the card pencil and the detail modal's
  actions. Where Add stood, a teacher sees a **"Read-only"** chip — a page that reads as
  deliberately read-only, not as one whose buttons failed to load.
- `guardWrite()` also guards `openAdd` / `openEdit` / `openStatusChange` / `openImport`, so a
  stale render cannot open a form whose submit is going to fail.
- The 403 itself now explains who can lift it: *"Inventory is read-only for your account. Your
  school administrator can give you edit access."*

**Until the load finishes, assume read-only.** A button that turns out to 403 is worse than a
button that appears a second late.

---

## 6. The school admin delegates that access — and takes it back

`teachers.can_manage_inventory` + `inventory_granted_by` / `_granted_at` / `_revoked_at`
(additive, defaulted to 0 — the safe direction for a permission column).

`PATCH /api/register/teachers/:id/inventory-access` with `{ granted: true|false }`, school-scoped.
The Teachers table gains an **Inventory** column (*Can edit* / *Read-only*) and a per-teacher
tablet button, above a line that states the rule and names the current holders:

> **Tablet inventory** is read-only for teachers. Neema Joseph can add and edit devices
> (since 9/9/2026).

Decisions:

- **`granted` is explicit, not a toggle.** A toggle sent twice on a bad connection lands back
  where it started and the school admin cannot tell which state won.
- **A delegate never outranks the delegator.** A granted teacher gets exactly what a school
  admin has — add, edit, assign, change status, import. **Not delete**: a school admin cannot
  delete a device either, so DELETE keeps its own role check. Verified from both accounts.
- **The grant is read on every request**, from a `LEFT JOIN` in `authenticate()`. A revoke has
  to bite immediately, not at the delegate's next login. Verified with the *same token*:
  `can_write` flips true → false with no re-login.
- **A teacher's school comes from their account, never the body.** `OWN_SCHOOL_ROLES` covers
  `school` and `teacher`; a granted teacher POSTing `school_id: 99999` files the device at
  their own school. Verified.
- **Suspending a teacher revokes the grant, and reactivating does not hand it back.** Otherwise
  a reactivated account silently regains the keys nobody re-granted.
- **Only an active teacher can be granted access**, and a teacher cannot grant it to themselves
  (403).
- **More than one holder is allowed.** Schools with two ICT teachers exist; forcing exclusivity
  would be an invented constraint. Revoking is one click per holder, and the summary line names
  them all.
- **Both directions are audited** (`inventory.access_granted` / `inventory.access_revoked`), and
  a revoke **keeps** the grant history rather than blanking it — *who had the keys in June* is a
  question worth being able to answer.

---

## Verification

`node backend/scripts/verify-teacher-scope.js` — 62 assertions, all passing, against a live
local server. It restores everything it touches: rows deleted, flags returned to what they were,
audit entries removed. Baseline before and after: errors 12, resolved 3, tablets 0, visits 0,
teachers 1, users 7, links 0, `client_ref` 0, grants 0.

The whole suite set still passes alongside it:

| Suite | Assertions |
|---|---|
| verify-heartbeat | 21 |
| verify-offline-dedup | 7 |
| verify-whatsapp | 38 |
| verify-lifecycle | 41 |
| verify-visits | 38 |
| verify-trends | 34 |
| **verify-teacher-scope** | **62** |
| | **241** |

Checked in the browser as both roles, at 1200px and at 375px:

- teacher, ungranted: Read-only chip, no Add/Import, no card pencil, detail modal with no Edit
  and no Change Status;
- teacher, granted: all of them back, `can_write: true`, edits attributed to them in the device
  history;
- school admin: the Inventory column, the delegation summary, the limit modals, and the
  escalation on the bell opening a pre-filled report;
- public registration form: 6 option groups, 34 options, Other revealing a text box and
  clearing it when the choice changes;
- 375px: the Teachers table drops Email and Subject and keeps Name / Status / Inventory /
  Actions, with **no horizontal page overflow**.

## Deployment note

Nothing here needs a new environment variable **except** the one that was already missing:
`AWS_BEARER_TOKEN_BEDROCK`, which is what makes the AI assistant answer at all. The schema
change is additive and applies itself on startup.
