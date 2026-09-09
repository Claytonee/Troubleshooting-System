# Project: QFT Technical Support System

## Git Workflow (IMPORTANT — auto commit & push)
- **After completing and verifying EACH feature/fix, automatically commit and push — do not wait to be asked.**
- Steps every time: stage the relevant files → `git commit` with a clear, descriptive message (end with the `Co-Authored-By: Claude` trailer) → `git push`.
- Push to the branch currently checked out, and push **`origin` (GitHub) only** — cPanel deploys from it. Do **not** push the `gitlab` remote: it feeds only the non-live Render mirror and its TLS is flaky (user instruction, 2026-09-08). Only commit code that has been verified/tested.
- Always verify the feature works (syntax check + run/test) **before** committing. Never commit known-broken code.
- One commit per feature/fix with a focused message; group only tightly-related changes.

## Database Safety (additive · expand-and-contract — NEVER lose data)
All schema changes MUST be **additive and backward-compatible** so a new deploy can never destroy existing data (the discipline Google/AWS use for zero-downtime migrations).

**The 3 phases — follow in order, across SEPARATE deploys:**
1. **EXPAND (safe, default):** only ADD new tables/columns. Never drop, rename, or narrow a type in the same change. New columns must be **nullable or have a DEFAULT** (never add `NOT NULL` without a default to a populated table). Add columns via `ADD COLUMN IF NOT EXISTS` in `backend/src/config/schemaExtensions.js`, and to the base table in `bootstrap.js`.
2. **MIGRATE / BACKFILL:** backfill the new columns for existing rows; ship code that reads old **and** writes new (dual-write) so old and new code coexist safely during rollout.
3. **CONTRACT (rare, dangerous):** only drop/rename old columns in a LATER, separate change — after all data is migrated, no code references the old schema, **a DB backup/snapshot exists, and the user has explicitly confirmed.**

**Hard rules:**
- Migrations are **idempotent** — safe to re-run on every startup (`bootstrap()` + `applyExtensions()`); guard with `IF NOT EXISTS` / `ON CONFLICT`.
- **Renames are never in-place.** Rename = add new column → backfill → dual-write → (later) drop old.
- **No destructive `DROP`/`TRUNCATE`/data-losing `ALTER`** without an explicit, separate, user-confirmed, backed-up "contract" step.
- The production database must stay on a **paid plan with backups**; verify a backup before any contract step.
- `bootstrap.js` only seeds when tables are **empty** — it must never overwrite or reset existing data.

## Stack
- **Backend:** Node.js + Express, **MySQL/MariaDB** (via mysql2), JWT auth
- **Frontend:** Vanilla JS SPA, hash-based routing, no framework (served by the Express backend)
- **File Storage:** Cloudinary (cloud CDN)
- **Hosting:** cPanel / DirectAdmin — served at **`support.mkatolikikiganjani.com`**, Node.js app + MySQL on `localhost` in the same account. The document root is still the directory `~/troubleshooting.pathfindereducation.or.tz/`, named after the retired hostname; paths keep that name, URLs do not.
- **DB access:** `backend/src/config/database.js` is a `mysql2/promise` pool. Schema + seed in `backend/src/config/bootstrap.js`, run automatically on startup. Connection via `DB_*` vars (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME) — **or** `DATABASE_URL`, which takes priority and makes every `DB_*` var be ignored (see Deployments).
- **Remote:** `origin` = GitHub (`Claytonee/Troubleshooting-System`), `gitlab` = GitLab (`claytonecurth/Troubleshooting-System`). Push both.

## Deployments (two targets, two remotes)
- **cPanel — `support.mkatolikikiganjani.com` — the LIVE site (server `213.139.204.238`).** MySQL runs on `localhost` beside the app. Code arrives via the `POST /api/deploy` webhook, which does `git fetch origin` + a fast-forward-only `git reset --hard` + `npm install` in `backend/` + a Passenger restart — so **cPanel tracks the `origin` (GitHub) remote**. The webhook requires `WEBHOOK_SECRET`; with no secret set it refuses to deploy rather than accepting anonymous POSTs.
- **Render — `troubleshooting-system-j7ln.onrender.com`** — free Node plan, auto-deploys from the **`gitlab`** remote's `main`. Kept as a mirror; it is not the live site. Being external, it cannot reach the cPanel `localhost` MySQL (free Render has no static outbound IP), so it needs its own database or it will answer 503.

**Hostnames (as of 2026-09-08).** `support.mkatolikikiganjani.com` is the live name — A record to
`213.139.204.238`, TTL 300, managed in DirectAdmin, added as a cPanel addon domain whose document root is the existing
`troubleshooting.pathfindereducation.or.tz` directory. Both names therefore reach **one** Passenger application, one
database and one uploads directory.

`troubleshooting.pathfindereducation.or.tz` is **retired**: `server.js` answers 404 for it (`RETIRED_HOSTS`, above the
HTTPS redirect and static handlers so assets do not keep serving). It still resolves here and is still on the certificate,
so removing it entirely means re-registering the Node app against the new hostname — deliberately deferred. Set
`RETIRED_HOSTS=` empty to serve it again. It was a Render custom domain until 2026-09-07; that CNAME is gone.

**The webhook payload URL lives on the new hostname.** Retiring a name that the webhook posts to kills deploys — including
the deploy of the change that retires it. Move the webhook first, then retire. Never infer the live target from cPanel
listing a domain, or from `deploy/CPANEL-SETUP.md` — check DNS.

**Test cPanel without touching DNS** (works any time, and checks the certificate too):
```bash
curl --resolve support.mkatolikikiganjani.com:443:213.139.204.238 https://support.mkatolikikiganjani.com/api/health
```
`{"status":"ok"}` means the Node app is up; swap in `/api/settings` to check the database. `Server: LiteSpeed` confirms the
reply came from cPanel, not Render, and a handshake that completes without `--insecure` means the certificate is valid.
Prefer `--resolve` over a `Host:` header against `http://<ip>/`, which can land on the account's default vhost
(`cgi-sys/defaultwebpage.cgi`) and says nothing about TLS. The host's Let's Encrypt integration already covers the
subdomain and this account has no **SSL/TLS Status** page (that URL 404s), so there is no AutoSSL button to press —
verify with the command above instead of assuming.

**Never check DNS propagation from the cPanel server.** It resolves its own hosted domains locally and answers
`213.139.204.238` the moment the zone is edited, whether or not the world can see it. Compare the zone's own answer with a
public resolver: `nslookup <host> ns23.oneway.africa` versus `nslookup <host> 8.8.8.8`. The **old** record's TTL governs how
long stale answers survive, not the new one's.

**Connection-string gotcha (this caused a full outage on 2026-09-07):** `DATABASE_URL` overrides every `DB_*` var, and `dotenv` runs without `override`, so variables set in the cPanel Node.js app UI or the Render dashboard beat `backend/.env` on disk. **When repointing the database, delete `DATABASE_URL` from the hosting panel first** — otherwise editing `.env` changes nothing. Startup logs print the target actually in use (credentials masked) plus a `DATABASE UNREACHABLE` diagnostic, so check the log before editing config.

## UI Architecture Rules

### Layout (Fixed Shell)
- **Topbar:** `position: fixed; top: 0;` — always visible, never scrolls
- **Sidebar:** `position: fixed; top: 56px; bottom: 0;` — always visible, scrolls independently if nav overflows
- **Main content area:** `grid-column: 2; margin-top: 56px; height: calc(100vh - 56px); overflow-y: auto;` — this is the ONLY scrollable region on desktop

### Stylesheet cascade (read before touching responsive CSS)
`index.html` loads `variables.css` → `base.css` → `components.css`. **A `@media` block does not raise
specificity**, so a same-selector rule in `components.css` silently beats a `base.css` media query.
Put responsive **component** rules in `components.css`'s own `@media (max-width: 920px / 768px / 520px)`
blocks (keep that order). `base.css` keeps only the shell: `.app`, `.sidebar`, `.main`, `.topbar`,
`.menu-toggle`, `.app-footer`. Verify with computed style, not by reading the file.

### Full-bleed children use the padding variables
`.main` declares `--pad-x` / `--pad-y` per breakpoint (28/24 desktop, 16/16 at 920, 14/18 at 520).
Anything that must span the full width negates them instead of hardcoding an offset:
```css
margin: calc(-1 * var(--pad-y)) calc(-1 * var(--pad-x)) 20px;
padding: var(--pad-y) var(--pad-x) 16px;
top: calc(-1 * var(--pad-y));   /* sticky offset */
```
`.section-header`, `.tracker-sticky-header` and `.sa-page` all do this. Hardcoding `-28px` against a
14px padding is what made the header hang off the right edge and sit behind the topbar.

### The fixed footer has a height
`--footer-h` (32px desktop, 23px at 520). Any panel sized to the viewport must subtract it:
`height: calc(100vh - 56px - var(--pad-y) - var(--footer-h))`. `.sa-page` and `.chat-page-wrap` do.
The footer paints `--bg2` and only its logo is dimmed — never put `opacity` on the footer itself.

### Second sticky bars
Only one sticky bar per page. `.section-header` is much taller on a phone than on desktop, so a
second sticky element with a hardcoded `top` covers it — `.inv-toolbar` and `.lrs-toolbar` are
therefore `position: static` at ≤920px.

### Mobile page header is centred
At ≤520px `.section-header` stacks and centres (title, subtitle and the action group). Do not
left-align it.

### Standalone pages must scroll
`.login-container` and `.reg-page` are `position: fixed; inset: 0` — they need `overflow-y: auto`
and `margin: auto` on the child (not `align-items: center`, which clips the top once content
overflows). Never `overflow: hidden` or `touch-action: none` there: the registration form is taller
than a 640px phone and was unreachable.

### Sticky Section Headers
Every page MUST start with a `.section-header` element. This header is sticky within `.main`:
```css
.section-header {
  position: sticky;
  top: -24px;
  z-index: 10;
  background: rgba(15,17,23,0.88);
  backdrop-filter: blur(12px);
}
```
When the user scrolls past 10px, JS adds `.elevated` class which shows a bottom border + shadow. This gives context of which page you're on while scrolling long content.

### Scroll Reveal
Cards (`.card`, `.stat-card`, `.alert-banner`) get a scroll-reveal animation on first appearance:
- JS adds `.reveal` class on render
- IntersectionObserver adds `.visible` when element enters viewport
- CSS transitions from `opacity:0; translateY(12px)` to visible

**Nested containers caveat:** The observer uses `root: .main`. Cards inside nested grids/tabs may NOT trigger. Any page with in-page navigation (tabs, sidebar sections) MUST implement `afterRender()` to force `.visible`:
```javascript
function afterRender() {
  const el = document.getElementById('my-content');
  if (el) el.querySelectorAll('.card').forEach(c => c.classList.add('reveal', 'visible'));
}
```

### In-Page Navigation (Tabs / Sidebar Sections)
Pages with internal navigation MUST swap content in-place — never call `App.render()` on tab/section click (causes flicker, sidebar disappears). Pattern:
```javascript
function setSection(id) {
  activeSection = id;
  const contentEl = document.getElementById('page-content');
  const navEl = document.getElementById('page-nav');
  if (contentEl && navEl) {
    contentEl.innerHTML = getContent(id);
    navEl.innerHTML = buildNav();
    contentEl.querySelectorAll('.card').forEach(c => c.classList.add('reveal', 'visible'));
  } else {
    App.render(); // fallback for first load only
  }
}

### Stat Cards (NOT glassmorphism)
Use the flat `.stat-card` class with colored left border stripe:
```html
<div class="stat-card r">        <!-- .r = red, .a = amber, .g = green, .t = teal, no class = accent -->
  <div class="stat-label">Title</div>
  <div class="stat-val" style="color:var(--red)">42</div>
  <div class="stat-sub">subtitle text</div>
</div>
```
Do NOT use glassmorphism, backdrop-filter, glow effects, or fancy hover transforms on stat cards.

### Grid Layouts
- **5 stat cards (dashboard):** `.stats-grid` with `repeat(auto-fit, minmax(160px, 1fr))`
- **3 stat cards (analytics):** `.three-col`
- **4 stat cards (resource library):** inline `grid-template-columns: repeat(4, 1fr)`
- **2-panel content:** `.two-col` (equal halves) or inline `grid-template-columns: 1fr 340px` for main+sidebar
- **Responsive:** Collapses to single column at 920px

### Cards
Simple flat cards, no glassmorphism:
```css
.card { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; }
```
No backdrop-filter. No hover transforms. No glow.

### Modals (Compact)
- **Default:** 480px — profile, error detail, change password, confirmations
- **Wide (600px):** forms with many fields (school profiles, resource upload)
- **Preview (1080px):** media preview only
- Never use `wide` for content that fits in default. Modals must be proportional to content.

### Info Table Pattern (Read-Only Fields)
Display entity metadata (email, phone, username, dates) in a modern bordered table with colored icons — NOT tiles, NOT plain lists:
```html
<table style="width:100%;border-collapse:separate;border-spacing:0;background:var(--bg3);border-radius:10px;border:1px solid var(--border);overflow:hidden">
  <tr>
    <td style="padding:9px 12px"><span style="display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--text3)">
      <i class="ti ti-at" style="font-size:13px;color:var(--accent)"></i>Email</span></td>
    <td style="padding:9px 12px;font-weight:500;font-size:13px;color:var(--text)">value</td>
  </tr>
  <tr><td colspan="2" style="padding:0;height:1px;background:var(--border)"></td></tr>
</table>
```
**Icon colors:** Email=accent, Phone=green, Username=purple, Date=amber, Location=teal, Role=red

### Dual-Column Info Table (Entity Detail Modals)
For entity detail views (device, school, user) showing many fields compactly — 4-column layout (label-value-label-value):
```html
<table style="width:100%;border-collapse:separate;border-spacing:0;background:var(--bg3);border-radius:10px;border:1px solid var(--border);overflow:hidden">
  <tr>
    <td style="padding:9px 12px"><span style="display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--text3)">
      <i class="ti ti-hash" style="font-size:13px;color:var(--accent)"></i>Asset Tag</span></td>
    <td style="padding:9px 12px;font-weight:500;font-size:13px;color:var(--text)">MTK-T-001</td>
    <td style="padding:9px 12px"><span style="display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--text3)">
      <i class="ti ti-barcode" style="font-size:13px;color:var(--teal)"></i>Serial</span></td>
    <td style="padding:9px 12px;font-weight:500;font-size:13px;color:var(--text);font-family:var(--font-mono)">G0K1AB100001</td>
  </tr>
  <tr><td colspan="4" style="padding:0;height:1px;background:var(--border)"></td></tr>
</table>
```
- Two label-value pairs per row (4 columns), separator `<tr>` between rows
- Each label has a colored icon (varies by field type)
- Full-span notes/long-text: last row can use `colspan="3"` on value
- Use for: modals showing entity metadata (tablets, schools, users, errors)

### Modal Action Buttons
Action buttons at bottom of detail modals use this pattern:
```html
<div style="display:flex;gap:8px;margin-top:14px;justify-content:space-between">
  <button style="padding:8px 16px;font-size:12px;background:rgba(79,124,255,.12);color:var(--accent);border:1px solid rgba(79,124,255,.25);border-radius:8px">Edit</button>
  <button style="padding:8px 16px;font-size:12px;background:rgba(54,217,204,.12);color:var(--teal);border:1px solid rgba(54,217,204,.25);border-radius:8px">Action</button>
</div>
```
- Primary action (Edit) = left, secondary = right (`justify-content:space-between`)
- Compact size, NO full-width stretch
- Color tints: blue/accent for edit, teal for secondary, amber for warning actions

### Page Structure Template
Every page render function MUST follow this structure:
```javascript
return `
  <div class="section-header">
    <div>
      <div class="section-title">Page Title</div>
      <div class="section-sub">Context · subtitle</div>
    </div>
    <div style="display:flex;gap:10px">
      <!-- action buttons here if needed -->
    </div>
  </div>

  <!-- optional: alert-banner for critical notices -->
  <!-- stat cards row -->
  <!-- main content in cards/tables -->
`;
```

### Offline / PWA (bump BOTH versions together)
`frontend/sw.js` caches the shell, the guides, the manuals, the settings and the
school list; `frontend/js/offline.js` queues writes in IndexedDB and replays them.

- **`sw.js`'s `VERSION` and the `?v=NN` query on every asset in `index.html` must
  match.** The cache names derive from `VERSION`, so bumping only one leaves
  clients on a half-old shell. Change both, every time.
- **Offline is detected by a failed request, never `navigator.onLine`.** School
  LANs are up while the uplink is dead, so the browser reports itself online.
- **A backoff retry is the only reliable resync trigger**, for the same reason:
  the `online` event and Background Sync both key on `navigator.onLine`, which
  never moves in that case. Measured — a queued report with the tab left open
  still sat there after the uplink returned. `Offline.scheduleRetry()` runs at
  15s / 30s / 60s / 2min **only while the queue is non-empty**, resets to the
  short step on a success, and disarms when it drains: a device with nothing
  pending polls nothing.
- Reference data the offline paths need (`/api/schools`, `/api/guides`,
  `/api/settings`, `/api/errors`) is fetched by `Offline.warm()` on login — a
  route being *cacheable* is not enough, it has to have been fetched once.
- Anything served from cache is labelled with when it was fetched
  (`API.lastCachedAt(path)`). Never present cached data as live.
- Every queued mutation carries a `client_ref`; the server returns the existing
  row on a repeat, so a replay cannot file the same fault twice.
- Role-scoped caches are dropped on logout (`Offline.forgetUserData()`), and
  queued items record their owner. School tablets are shared.

### Permissions that role alone cannot answer
`backend/src/middleware/permissions.js` holds capability checks. Today: inventory writes.
A school admin may delegate tablet-inventory write access to a teacher
(`PATCH /api/register/teachers/:id/inventory-access` with `{granted:true|false}`), and
`teachers.can_manage_inventory` is loaded into `req.user` by `authenticate()` on **every**
request, so a revoke bites immediately rather than at the delegate's next login.

- Write routes use `requireInventoryWrite`, never `authorize(...)` role lists.
- **A delegate never outranks the delegator.** A school admin cannot DELETE a device, so
  a granted teacher cannot either — DELETE keeps `authorize('admin','subadmin')`.
- A teacher's school comes from their account (`OWN_SCHOOL_ROLES`), never the request body.
- Suspending a teacher revokes the grant; reactivating does **not** hand it back.
- **The UI asks the server**: `GET /api/inventory/stats` returns `can_write`, and
  `InventoryPage.canWrite()` gates every write control on it. Never gate write UI on the
  role in `localStorage` — a grant made after login would not show, and a revoked one
  would leave buttons that 403.

### A fault reported by a teacher goes to their school administrator
`errorController.create()` decides who holds a new fault:

| Reported by | `assigned_to` | `escalation_level` | Also |
|---|---|---|---|
| teacher | **null** | `school` | school admin's bell (`admin_notifications`, `type='error_reported'`) |
| teacher, **critical** | field engineer | `platform` | school admin still notified, and told why |
| school admin | field engineer | `platform` | they *are* the school level |

It used to assign the school's field engineer for everybody, which skipped the person who
can walk to the room (reported 2026-09-09). **`POST /errors/:id/escalate` is what hands a
fault to the engineer** — it fills `assigned_to` with `schools.assigned_admin_id` when the
row is still unassigned, or an escalation would raise the level and leave nobody holding it.

**A teacher cannot change a fault's status** — not by `PATCH /status` and not through the
full `PUT` (both refuse with `TEACHER_CANNOT_SET_STATUS`). They own the row, so the access
check passes; closing their own ticket took it out of the school admin's queue unlooked-at.
They report and they rate.

### Who may rate a resolution
`pickErrorDetail(row, viewer)` hands out `csat_token` **only** to the teacher who reported
the fault or a school admin of that school (`canRateError`), and sets `can_rate` for the UI
to follow. The token takes no auth on submission — it *is* the capability — so giving it to
a platform admin was giving them the school's answer to "was this actually fixed".
List rows never carry it, for anybody.

### The offline queue carries its photos
`Offline.enqueue({ files })` stores Blobs in IndexedDB and `requestFor()` replays them as
the same multipart POST the online form sends — **never set `Content-Type` by hand there**,
or the boundary is missing and multer sees no fields at all. `report.js` downscales images
first (`shrinkImage`, 1600px / q0.72 — measured 371 KB → 81 KB) and `Offline.budgetFiles()`
keeps what fits 6 MB per report, naming anything it had to leave behind.

**The "N reports waiting to sync" banner is mounted by the shell** (`App.mountQueueBanner`,
refreshed via `Offline.onChange`), not by one page. It used to live only in the tracker, so
a teacher — sent to the dashboard after queueing, and with no tracker at all — saw no sign
the queue existed.

### Verification suites provision their own fixtures
`backend/scripts/lib/fixtures.js` creates a `zzverify*` school admin + teacher and removes
them afterwards. Suites used to hardcode two accounts that happened to exist locally, and
every one of them broke the day the local database was reseeded. Run them from `backend/`
(they load `.env` relative to the script, but the older ones use a relative path).

### Escalation goes up the user's own chain
`POST /api/guides/:id/escalate` routes a **teacher** to their own school administrator as an
in-app notification (`admin_notifications`, `target_role='school'`, `type='guide_escalation'`,
`meta.school_id`) — not to the support mailbox. The school admin's bell opens the report form
pre-filled with the teacher's name, the guide and the category. Everyone else still gets email.
If the school has no active administrator it falls back to email and the reply says so
(`no_school_admin: true`) — never silently dropped. `/api/schools/notifications` is scoped by
`meta.school_id` for the `school` role, in both the read and the mark-as-read.

### One subject list, two forms
`TEACHER_SUBJECTS` / `subjectOptions()` in `frontend/js/utils.js` is used by the public
registration form **and** the school admin's Add Teacher modal. Free text produced "Maths",
"MATHEMATICS", "math" and "Mathematics/Physics" for one subject. "Other" reveals a text box, and
a stored value that is not on the list is kept as its own option so opening a form never
rewrites what is on file.

### Registration links carry a cap the school admin chooses
`max_uses` is set when the link is generated (1–500, default = teachers on file + 5) and can be
raised later with `PATCH /api/register/teacher-links/:id` — never below `use_count`, and the
Change limit / Deactivate buttons stay visible on a **full** link, which is exactly when the cap
needs raising. `parseMaxUses()` refuses non-integers: `req.body.max_uses || 50` stored `"twenty"`
as NULL, and `use_count >= NULL` is never true, so the link was silently unlimited.

### /api/health says which commit is RUNNING
`build` is read from `git rev-parse HEAD` once at boot, so it describes the **process**, not
the working tree. On 2026-09-09 a deploy left `index.html` at the new asset version while
`/api/health` came from the previous build: the files had been pulled and Passenger had not
respawned. Static files are read off disk per request, so they are never proof of a deploy.
Compare `build` with `git rev-parse --short HEAD` locally; if it lags, the app needs a
restart (cPanel → Setup Node.js App → Restart, or
`touch ~/troubleshooting.pathfindereducation.or.tz/backend/tmp/restart.txt`).
The deploy webhook now reports `restart_requested` and the path it touched.

### /api/health carries feature flags
`features: { ai, email, sms, whatsapp_inbound, whatsapp_send, heartbeat, uploads }` — booleans
only, asked of the services' own `isConfigured()` where one exists. It exists so "the AI says it
is not configured" can be diagnosed without cPanel access:
```bash
curl -s https://support.mkatolikikiganjani.com/api/health
```

### The knowledge loop runs both ways
`services/knowledge.js`. Forward: `GET /api/guides/suggest` puts up to three guides above the
description field on the report form, scored +10 category / +3 title word / +2 step word, and
shows **nothing** when nothing matches — suggesting the least-bad guide teaches people to
ignore the panel. Backward: `errors.tried_guide_id` remembers the guide someone read before
filing anyway, which is the only signal saying which guide needs rewriting.

**A deflection is recorded only because a person pressed "This fixed it".** Never inferred from
"opened the guide and did not file within N minutes", which would count every interruption and
every flat battery as a success. `success_rate` is `null`, never 0%, for a guide nobody has met.

`/api/guides/suggest` and `/performance` sit **above** `router.get('/:id')` — placed below, Express
reads "suggest" as an id and answers 404, which is exactly what happened the first time.

### Spares are devices, not a separate store
`tablets.is_spare` + `SPARE_WHERE` in `services/spares.js`: a spare is marked aside, **Working**
and **unassigned** — all three, in one SQL fragment, so the count and the picker cannot
disagree. Marking is refused for an assigned or faulty device, with the reason.

`needed = max(0, awaiting_swap - spares_available)` is a packing list, never negative, and
the Spares view sorts by it: the only question there is which school cannot be fixed today.

A swap is **one transaction** (`services/spares.js:swap`) moving the student across, retiring
the broken device to In Repair, writing both histories, a `tablet_swaps` row and a ticket
update. Half of it happening leaves a student assigned to two devices or none.

**First-time fix** counts only visits that had faults attached, and returns `null` — never
0% — when nothing is measurable. Same honesty rule as the SLA figure.

### Who sees what (the matrix, and the two halves of it)
`backend/scripts/verify-role-matrix.js` is the executable version of this table —
124 assertions, and it fails if the sidebar and the hash guard stop agreeing.

| | admin | subadmin | school | teacher |
|---|---|---|---|---|
| Dashboard, Errors, Guides, Resources, Inventory, Search, Settings | ✔ | ✔ | ✔ | ✔ |
| **AI Assistant** | — | ✔ | ✔ | ✔ |
| Error Tracker | ✔ | ✔ | ✔ | ✔ (own reports) |
| Analytics, School Profiles, Check-Ins, Communications, notifications | ✔ | ✔ | ✔ | — |
| Visit Planner | ✔ | ✔ | — | — |
| Sub-Admins, School Admins, Audit, LRS, Approvals, Branding | ✔ | — | — | — |
| Teachers, registration links | — | — | ✔ | — |

**The assistant is not head office's.** It helps whoever is standing in front of the
equipment. A platform admin runs the system; they were seeing it because the nav item
carried no `data-role` at all (found 2026-09-09).

**A permission has two halves and both must be set.** The nav marker hides the link;
the matching `*Pages` array in `applyRoleVisibility()` stops the hash. `#team` had the
first and not the second, so the Sub-Admins page rendered for every role and merely
403'd its data. The suite now asserts every marked page appears in its array.

**`/api/analytics/trends` answered teachers.** The page is admin-only in the nav, but the
endpoint took any signed-in role and scoped rows to their school — so a teacher could read
their school's totals with no page for it. Now `admin, subadmin, school`.

### Role markers on nav items
`data-role` gates sidebar items in `router.js`: `admin`, `subadmin`, `school`,
`school-teacher`, `no-admin`, `staff` (admin+subadmin+school), `staff-teacher`
(staff + teachers — the Error Tracker) and `field`
(admin+subadmin only — whoever drives out to schools). Use `field`, not
`staff`, for anything a school admin should not see: `staff` includes them.
A page gated this way must also be listed in the matching `*Pages` array in
`applyRoleVisibility()`, or a user can still reach it by typing the hash.

### Module guards: use `typeof`, never `window.X`
Page modules are `const X = (() => { … })()`, which is a script-scope binding and
**not** a property of `window`. `if (window.ChatPage)` is permanently false and
had silently disabled the logout chat reset. Always `typeof X !== 'undefined'`.

### Icons
- Use ONLY Tabler Icons: `<i class="ti ti-icon-name"></i>`
- Do NOT use Unicons, Font Awesome, or any other icon library
- Reference: https://tabler.io/icons

### Topbar Elements
- Left: menu-toggle (mobile only) + brand logo + "/ Technical Support" subtitle
- Right: role-switch (ti-user-cog icon + select) + bell notification (ti-bell + notif-dot) + profile avatar + dropdown

### Sidebar Navigation
- Nav items use `.nav-item` with `.active` class (blue-tinted background)
- Badges use `.nav-badge` (or `.nav-badge.alert` for red)
- Badges are hidden by default (`display:none`) and shown via JS when count > 0
- Footer has "Logged in as" box + Sign Out

### Color System
```
--red: #ff5263       (errors, critical, danger)
--amber: #f5a623    (warnings, in-progress)
--green: #2dd98a    (success, resolved, healthy)
--purple: #9b7dff   (escalated, check-ins)
--teal: #36d9cc     (school health)
--accent: #4f7cff   (primary actions, links)
--gold: #FFAE00     (brand)
```

### Typography
- Font: DM Sans (300-700), DM Mono for code/IDs
- Page title: 18px, font-weight: 600
- Card titles: 13px, uppercase, letter-spacing .5px
- Stat values: 28px, font-weight: 600
- Body text: 13-14px
- Labels: 11-12px, color: var(--text3)

### Animation Guidelines
- Page transitions: `fade .25s ease` (opacity + translateY 6px)
- Scroll reveal: `opacity .4s ease, transform .4s ease` (translateY 12px)
- Hover effects: subtle only — `transition: all .15s`
- No bounce, no elastic, no heavy transforms

### Responsive Breakpoints (4 mandatory)
Every page/feature MUST be tested and functional at all 4 breakpoints:
- `>1200px` (Desktop): Full multi-column layouts, inline stats
- `920px` (Tablet Landscape): Sidebar collapses to mobile drawer, grids reduce columns, toolbars wrap
- `768px` (Tablet Portrait): 2-col grids become 1-col, section headers stack vertically, stat badges go 2x2
- `520px` (Mobile): Single column everything, stacked toolbars, full-width cards, smaller padding/fonts

**Rules:**
- Use CSS classes (not inline styles) for any layout that needs to adapt
- Add `@media` rules in `components.css` for each new page/component
- Grids: use `auto-fill` with `minmax()` on desktop, explicit column counts at smaller breakpoints
- Modals: `max-width: 100%; padding` reduces on mobile
- Never ship a feature without verifying all 4 breakpoints

### Data Display Patterns
- **Progress bars:** `.progress` (6px height) + `.progress-fill` with inline color
- **Tables:** Inside `.card` with `.table-wrap > table`, rows have hover highlight
- **Error items:** Bordered cards with `border-left: 3px solid` color-coded by severity
- **Badges:** `.badge-{color}` for status labels
- **Priority dots:** `.dot-{color}` (7px circles with optional box-shadow glow)
- **File cards:** Icon box (42px, colored background) + title/meta + action buttons

## Backend Conventions
- Auto-migration on startup (for Render free tier without shell)
- Demo data seeding when schools table is empty
- JWT in Authorization header, 7-day expiry
- Role-based access: admin > subadmin > school > teacher
- Sub-admin accounts are created by admin via #team page; **default password: `changeme123`** (when none specified)
- Admin can reset a sub-admin's password via PATCH /api/team/:id/reset-password
- API prefix: `/api/` (auth, errors, schools, checkins, team, settings, dashboard, communications, guides, manuals)
- File uploads go to Cloudinary (not local disk)
- **Rate limiting is keyed per ACCOUNT, not per IP** (`rateKey()` in server.js reads the JWT's
  `id` without verifying it — a fairness key, not an authorisation decision). Behind LiteSpeed
  every request looks like it comes from the proxy, and a school is behind one router besides,
  so an IP bucket is shared by strangers: 900 req/15min general (this SPA fires 3–6 per page
  render), `/api/health` exempt, login 20 per account plus 120 per address.

## Environment Variables (Production — cPanel)
Set these in **cPanel → Setup Node.js App → Environment variables**, not in `backend/.env`:
panel variables win, because `dotenv` runs without `override`.
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=pathfind_claytone
DB_PASSWORD=your_db_password
DB_NAME=pathfind_qft
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d
NODE_ENV=production
WEBHOOK_SECRET=your_webhook_secret        # required — /api/deploy refuses to deploy without it
                                          # also authenticates POST /api/heartbeat/sweep
HEARTBEAT_KEY=your_heartbeat_key           # required for POST /api/heartbeat; unset, it refuses
WHATSAPP_APP_SECRET=your_app_secret        # signs every inbound webhook; unset, /api/whatsapp refuses
WHATSAPP_VERIFY_TOKEN=your_verify_token    # Meta's one-time subscription handshake
WHATSAPP_TOKEN=your_permanent_token        # sending only — unset, replies are logged and skipped
WHATSAPP_PHONE_ID=your_phone_number_id
PHONE_INTAKE_KEY=your_ussd_sms_key         # required for POST /api/ussd and /api/sms/inbound;
                                          # unset, both refuse (Africa's Talking does not sign callbacks)
AT_USERNAME=your_at_username               # Africa's Talking, also used for outbound SMS
AT_API_KEY=your_at_api_key
AWS_BEARER_TOKEN_BEDROCK=your_bedrock_token  # REQUIRED for the AI Assistant. Unset, every role
                                          # gets "AI service not configured" — this variable was
                                          # missing from this list, so it was never set on cPanel
                                          # and teachers hit it first (2026-09-09).
AI_MODEL=us.anthropic.claude-opus-4-6-v1   # optional; this account has no Opus 5 access
AWS_BEDROCK_HOST=bedrock-runtime.us-east-1.amazonaws.com   # optional
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
MAX_FILE_SIZE=104857600
```
**`DATABASE_URL` must NOT be set here.** It overrides every `DB_*` variable above
(`config/database.js:18`), which is how a deleted Aiven host survived config changes
and took both deployments down on 2026-09-07.

## Pages & Features (Complete List)

| # | Page | Route | Role | Description |
|---|------|-------|------|-------------|
| 1 | Dashboard | #dashboard | All | KPIs, alerts, priority table, categories, check-in ring |
| 2 | Report Error | #report | All | Form to submit new error with auto-routing |
| 3 | Error Tracker | #tracker | All | Filterable table of all errors with status chips |
| 4 | Follow-Up Center | #followup | All | SLA breaches, escalations, team status, comms log |
| 5 | Weekly Check-Ins | #weekly | All | Week selector, school checkin table, modal form |
| 6 | School Profiles | #schools | All | Grid of school cards, detail view with history |
| 7 | Troubleshooting | #troubleshoot | All | Step-by-step guides for common issues |
| 8 | Resource Library | #manuals | All | Upload/preview/download manuals (admin uploads) |
| 9 | Analytics | #analytics | Admin | SLA compliance, errors by school/category |
| 10 | Sub-Admins | #team | Admin | Manage field engineers, assign schools |
| 11 | Branding | #branding | Admin | Customize system name, logo, colors |
| 12 | Tablet Inventory | #inventory | All (teachers **read-only** unless granted) | Device CRUD, stats, CSV import/export, history |
| 13 | Approvals | #approvals | Admin | School admin registration approval |
| 14 | Teachers | #teachers | School | Teacher management, registration-link cap, inventory delegation |
| 15 | Help / User Guide | #help | School | Support documentation with sidebar nav |
| 16 | Visit Planner | #visits | Admin, Sub-admin | Queue grouped by school, on-site checklist, visit record |

**Non-page intake channels** (no UI of their own; both stamp `errors.intake_channel`
and are labelled in the error detail modal by `intakeLabel()`):
- `POST /api/heartbeat` + `/sweep` — a silent school LRS opens its own CRITICAL
  ticket (`intake_channel='monitor'`, `auto_source='lrs_heartbeat:<id>'`).
- `POST /api/ussd` — a feature phone dialling the shortcode. No internet, no
  bundle, no smartphone. Menu in Swahili, four presses, scale not severity
  (`intake_channel='ussd'`). An unrecognised number may report but never read.
- `POST /api/sms/inbound` — a plain SMS; keywords STATUS and MSAADA, anything
  else is a fault (`intake_channel='sms'`).
- `POST /api/whatsapp/webhook` — a teacher's WhatsApp message; the assistant
  replies with first steps, then offers to log it
  (`intake_channel='whatsapp'`). **A phone number is not authentication:** an
  unmatched number files against a school code it supplies, is recorded as
  `whatsapp-unverified`, and can never read anything back.

## File Upload System (Cloudinary)

### Supported File Types
- **Documents:** PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, TXT, HTML
- **Images:** PNG, JPG, JPEG, GIF, WEBP, SVG
- **Video:** MP4, WEBM, MOV, AVI, MKV
- **Audio:** MP3, WAV, OGG, M4A, AAC

### Upload Flow
```
Client → multer(memoryStorage) → buffer → cloudinary.upload_stream → DB stores CDN URL → frontend fetches from Cloudinary CDN
```

### Resource Types (Cloudinary mapping)
- `image/*` → resource_type: "image"
- `video/*` or `audio/*` → resource_type: "video"
- Everything else → resource_type: "raw"

### Frontend Capabilities
- All roles: browse, filter by category, download, preview (image/video/audio)
- Admin only: upload new resources, delete resources
- Preview uses native HTML5 `<img>`, `<video>`, `<audio>` elements
- Max file size: 100MB (configurable via MAX_FILE_SIZE env var)
