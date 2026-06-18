# Project: QFT Technical Support System

## Git Workflow (IMPORTANT — auto commit & push)
- **After completing and verifying EACH feature/fix, automatically commit and push — do not wait to be asked.**
- Steps every time: stage the relevant files → `git commit` with a clear, descriptive message (end with the `Co-Authored-By: Claude` trailer) → `git push`.
- Push to the branch currently checked out. Pushing to `main` **auto-deploys to the live Render site**, so only commit code that has been verified/tested.
- Always verify the feature works (syntax check + run/test) **before** committing. Never commit known-broken code.
- One commit per feature/fix with a focused message; group only tightly-related changes.

## Stack
- **Backend:** Node.js + Express, **PostgreSQL** (migrated from MySQL June 2026), JWT auth
- **Frontend:** Vanilla JS SPA, hash-based routing, no framework (served by the Express backend)
- **File Storage:** Cloudinary (cloud CDN — Render has no persistent disk)
- **Hosting:** Render web service (auto-deploy from `main`) + **Render Managed PostgreSQL**
- **DB access:** `backend/src/config/database.js` is a `pg` pool with a mysql2-compatible wrapper (`?`→`$n`, auto `RETURNING id`). Schema + seed in `backend/src/config/bootstrap.js`, run automatically on startup. Connection via `DATABASE_URL` (prod) or `DB_*` vars; `DB_SSL` toggles SSL.
- **Remote:** `origin` = GitLab (`claytonecurth/Troubleshooting-System`). Push: `git push origin <branch>`

## UI Architecture Rules

### Layout (Fixed Shell)
- **Topbar:** `position: fixed; top: 0;` — always visible, never scrolls
- **Sidebar:** `position: fixed; top: 56px; bottom: 0;` — always visible, scrolls independently if nav overflows
- **Main content area:** `grid-column: 2; margin-top: 56px; height: calc(100vh - 56px); overflow-y: auto;` — this is the ONLY scrollable region on desktop

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

### Responsive Breakpoints
- `920px`: Sidebar collapses to mobile drawer, grids become single-column
- `520px`: Stats grid becomes single column, tighter padding

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
- Role-based access: admin > subadmin > school
- API prefix: `/api/` (auth, errors, schools, checkins, team, settings, dashboard, communications, guides, manuals)
- File uploads go to Cloudinary (not local disk)
- Rate limiting: 20 req/15min login, 200 req/15min general API

## Environment Variables (Production)
```
DATABASE_URL=mysql://user:pass@host:port/db
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d
NODE_ENV=production
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
MAX_FILE_SIZE=104857600
```

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
