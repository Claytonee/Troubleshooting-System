# Project: QFT Technical Support System

## Stack
- **Backend:** Node.js + Express, MySQL 8.4 (Aiven cloud), JWT auth
- **Frontend:** Vanilla JS SPA, hash-based routing, no framework
- **Hosting:** Render (auto-deploy from GitLab main), Aiven MySQL (free tier)
- **Dual remotes:** `origin` = GitHub, `gitlab` = GitLab. Push to both: `git push origin main && git push gitlab main`

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

## Backend Conventions
- Auto-migration on startup (for Render free tier without shell)
- Demo data seeding when schools table is empty
- JWT in Authorization header, 24h expiry
- Role-based access: admin > subadmin > school
- API prefix: `/api/` (auth, errors, schools, checkins, team, settings, dashboard, communications, guides)
