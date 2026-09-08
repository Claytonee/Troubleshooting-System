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
- Rate limiting: 20 req/15min login, 200 req/15min general API

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
| 12 | Tablet Inventory | #inventory | All | Device CRUD, stats, CSV import/export, history |
| 13 | Approvals | #approvals | Admin | School admin registration approval |
| 14 | Teachers | #teachers | School | Teacher management + registration links |
| 15 | Help / User Guide | #help | School | Support documentation with sidebar nav |

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
