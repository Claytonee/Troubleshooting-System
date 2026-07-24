# QFT World-Class Implementation Plan

**Version:** 1.0  
**Date:** 2026-07-24  
**Approach:** Chunked delivery — each chunk is a self-contained deployable unit  
**Methodology:** Ship daily, test before commit, each chunk builds on the previous

---

## Architecture Principles

Before implementation begins:

1. **DTO Layer** — Every API response goes through a Data Transfer Object. Standardizes shape, strips sensitive fields, adds computed properties.
2. **Service Layer** — Business logic moves from controllers to services. Controllers become thin (validate → call service → respond).
3. **Event System** — Actions emit events (error.created, device.statusChanged). Listeners handle side effects (notifications, audit, webhooks).
4. **Config-driven** — Feature flags, SLA thresholds, notification preferences stored in `settings` table. No hardcoded magic numbers.

---

## Phase 0: Foundation (DTO + Service Layer Refactor)

**Duration:** 2-3 days  
**Goal:** Clean architecture foundation that makes all future features easier

### Chunk 0.1: DTO Layer
**Files:**
- `backend/src/dto/` (new directory)
  - `errorDto.js` — transforms raw error row → safe response object
  - `schoolDto.js` — strips internal fields, adds computed `healthScore`
  - `deviceDto.js` — adds `age`, `daysSinceCheck`, `warrantyStatus`
  - `userDto.js` — strips password_hash, adds display fields
  - `notificationDto.js` — uniform notification shape
  - `index.js` — barrel export

**What each DTO does:**
```javascript
// Example: errorDto.js
function toResponse(row, opts = {}) {
  return {
    id: row.id,
    errorCode: row.error_code,
    title: row.title,
    description: row.description,
    category: row.category,
    priority: row.priority,
    status: row.status,
    school: { id: row.school_id, name: row.school_name },
    assignedTo: row.assigned_to ? { id: row.assigned_to, name: row.assigned_name } : null,
    sla: {
      target: getSlaTarget(row.priority),
      elapsed: Date.now() - new Date(row.created_at).getTime(),
      remaining: getSlaRemaining(row),
      breached: isSlaBreached(row),
      percentage: getSlaPercentage(row)
    },
    timestamps: {
      created: row.created_at,
      updated: row.updated_at,
      resolved: row.resolved_at
    },
    ...(opts.includeComments && { comments: row.comments }),
    ...(opts.includeHistory && { history: row.history })
  };
}

function toList(rows) {
  return rows.map(r => toResponse(r));
}
```

**Key rules:**
- DTOs are pure functions — no DB calls, no side effects
- Always return new objects (never mutate input)
- Sensitive fields (password_hash, internal IDs) never leak
- Computed fields (SLA status, health score, device age) calculated here

### Chunk 0.2: Service Layer
**Files:**
- `backend/src/services/` (extend existing)
  - `errorService.js` — all error business logic
  - `schoolService.js` — school operations + health scoring
  - `inventoryService.js` — device lifecycle logic
  - `notificationService.js` — unified notification dispatch
  - `slaService.js` — SLA calculation, breach detection, escalation

**Controller refactor pattern:**
```javascript
// BEFORE (fat controller):
async function getAll(req, res, next) {
  try {
    let query = `SELECT ...`;
    // 30 lines of query building
    // 10 lines of data manipulation
    res.json(rows);
  } catch (err) { next(err); }
}

// AFTER (thin controller):
async function getAll(req, res, next) {
  try {
    const filters = { role: req.user.role, userId: req.user.id, ...req.query };
    const errors = await errorService.findAll(filters);
    res.json(errorDto.toList(errors));
  } catch (err) { next(err); }
}
```

### Chunk 0.3: Event Emitter
**Files:**
- `backend/src/events/emitter.js` — Node EventEmitter singleton
- `backend/src/events/listeners/` — organized by domain
  - `notificationListener.js` — sends notifications on events
  - `auditListener.js` — logs audit trail
  - `slaListener.js` — starts/stops SLA timers

**Pattern:**
```javascript
// In service:
emitter.emit('error.assigned', { errorId, assignedTo, assignedBy, note });

// In listener:
emitter.on('error.assigned', async ({ errorId, assignedTo, assignedBy, note }) => {
  await notificationService.send(assignedTo, 'error_assigned', { errorId, note });
  await auditService.log('error.assigned', { errorId, assignedTo, actor: assignedBy });
});
```

---

## Phase 1: UX Quick Wins (High impact, fast delivery)

**Duration:** 3-4 days  
**Goal:** Immediately noticeable quality improvements

### Chunk 1.1: Toast Notification System
**Files:**
- `frontend/js/components/toast.js` — Toast module
- `frontend/css/components.css` — toast styles (append)

**Behavior:**
- Bottom-right corner, stacked (max 3)
- Types: success, error, warning, info
- Auto-dismiss (4s success, sticky errors)
- "Undo" button for destructive actions
- Replace all `alert()` calls system-wide

**Integration points:**
- After every API call success/failure
- After form submissions
- After status changes, assignments, deletions

### Chunk 1.2: Skeleton Loading
**Files:**
- `frontend/js/components/skeleton.js` — reusable skeleton templates
- `frontend/css/components.css` — skeleton animation styles

**Templates:**
- `Skeleton.cards(count)` — grid of card skeletons
- `Skeleton.table(rows)` — table with pulsing rows
- `Skeleton.stats(count)` — stat card skeletons
- `Skeleton.detail()` — single entity detail layout

**How it works:**
- Page renders skeleton immediately
- Data loads → skeleton replaced with real content
- Shimmer animation: `@keyframes shimmer` left-to-right gradient sweep

### Chunk 1.3: Global Search (Cmd+K)
**Files:**
- `frontend/js/components/search.js` — GlobalSearch module
- `backend/src/routes/search.js` — unified search endpoint
- `backend/src/controllers/searchController.js`

**Frontend:**
- `Cmd+K` / `Ctrl+K` opens modal overlay
- Search input with debounced query (300ms)
- Results grouped: Errors, Schools, Devices, Resources
- Keyboard navigation: ↑↓ to move, Enter to select, Esc to close
- Recent searches stored in localStorage

**Backend:**
- `GET /api/search?q=term` — searches across:
  - errors (title, error_code, description)
  - schools (name, code, zone)
  - tablets (serial_number, asset_tag, student_name)
  - resources (title, description)
- Returns max 5 results per category
- Uses ILIKE with trigram index for fuzzy matching

### Chunk 1.4: Empty States
**Files:**
- `frontend/js/components/emptyState.js`

**Per-page empty states:**
- Custom SVG illustration (simple, on-brand)
- Helpful message explaining what goes here
- Primary action button: "Report your first error", "Import devices", etc.

### Chunk 1.5: Breadcrumbs
**Files:**
- `frontend/js/components/breadcrumb.js`
- Modify section-header to include breadcrumb trail

**Behavior:**
- Auto-generated from navigation path
- Clickable segments: "Home > Inventory > Mtakuja SS > MTK-T-045"
- Collapses on mobile (show last 2 segments)

---

## Phase 2: Communication & Collaboration

**Duration:** 4-5 days  
**Goal:** Users can communicate within the system

### Chunk 2.1: Comments/Threads on Errors
**Database:**
```sql
CREATE TABLE error_comments (
  id SERIAL PRIMARY KEY,
  error_id INTEGER NOT NULL REFERENCES errors(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Backend:**
- `GET /api/errors/:id/comments` — list comments (filter internal by role)
- `POST /api/errors/:id/comments` — add comment
- `PATCH /api/comments/:id` — edit own comment
- `DELETE /api/comments/:id` — delete own comment (soft-delete)

**Frontend:**
- Comment thread below error detail
- Text area with submit button
- "Internal note" checkbox (admin/subadmin only)
- Edit/delete on own comments
- Relative timestamps with hover for absolute

### Chunk 2.2: @Mentions System
**Database:**
```sql
CREATE TABLE mentions (
  id SERIAL PRIMARY KEY,
  comment_id INTEGER REFERENCES error_comments(id),
  mentioned_user_id INTEGER REFERENCES users(id),
  notified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Behavior:**
- Type `@` → dropdown of users (filtered by typing)
- Mentioned user gets notification
- Mention rendered as colored chip in comment
- Click mention → navigate to user profile

### Chunk 2.3: Email Notifications
**Files:**
- `backend/src/services/emailService.js` — email dispatch
- `backend/src/templates/email/` — HTML email templates
- Environment vars: `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `FROM_EMAIL`

**Templates:**
- Error assigned
- SLA breach warning
- Comment mention
- Weekly digest

**User preferences:**
- `notification_preferences` table: per-user, per-event-type settings
- UI: settings page with toggles per notification type

### Chunk 2.4: Activity Feed
**Database:**
```sql
CREATE TABLE activity_feed (
  id SERIAL PRIMARY KEY,
  actor_id INTEGER REFERENCES users(id),
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(30) NOT NULL,
  entity_id INTEGER,
  summary TEXT,
  meta JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_activity_feed_created ON activity_feed(created_at DESC);
```

**Frontend:**
- Dashboard widget: "Recent Activity" card
- Full page: filterable activity timeline
- Real-time: new activities appear at top (polling every 30s initially)

---

## Phase 3: SLA Engine & Automation

**Duration:** 3-4 days  
**Goal:** Automated SLA tracking, escalation, and routing

### Chunk 3.1: SLA Configuration
**Database additions:**
```sql
ALTER TABLE settings ADD COLUMN IF NOT EXISTS setting_value_json JSONB;
-- Store SLA config as:
-- { "critical": { "target_hours": 4, "warn_percent": 75 },
--   "high": { "target_hours": 12, "warn_percent": 75 },
--   "medium": { "target_hours": 48, "warn_percent": 80 },
--   "low": { "target_hours": 168, "warn_percent": 80 } }
```

**Backend:**
- `slaService.js` — calculate remaining time, % elapsed, breach status
- SLA pause/resume: when error status is "waiting_on_school", clock stops
- SLA fields added to error DTO (target, elapsed, remaining, breached, percentage)

**Frontend:**
- Live countdown on error cards: "2h 15m remaining"
- Color coded: green (>50%), amber (50-75%), red (>75%), pulsing red (breached)
- SLA badge on error tracker table rows

### Chunk 3.2: Auto-Routing Engine
**Database:**
```sql
CREATE TABLE routing_rules (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  conditions JSONB NOT NULL,  -- { "zone": "Moshi", "category": "Hardware" }
  action JSONB NOT NULL,      -- { "assign_to": 5, "priority": "high" }
  priority INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Logic:**
- On error.created event → evaluate routing rules in priority order
- First matching rule wins → auto-assign
- Fallback: if no rule matches → assign to admin (manual routing)
- Load balancing option: distribute among eligible sub-admins by current load

**Admin UI:**
- Routing rules page (admin only)
- Create/edit rules with condition builder
- Test rule: "If this error came in, where would it go?"
- Enable/disable rules

### Chunk 3.3: Auto-Escalation
**Logic:**
- Background job (cron or on-request check):
  - Errors at 75% SLA → notification to assignee: "SLA warning"
  - Errors at 100% SLA → escalate to admin + notification
  - Errors at 150% SLA → mark as "critical breach" in dashboard
- Escalation actions configurable per priority level

**Implementation:**
- `backend/src/jobs/slaChecker.js` — runs every 15 minutes
- Checks all open errors against SLA targets
- Emits events: `sla.warning`, `sla.breached`, `sla.critical`
- Listeners handle notifications and status changes

### Chunk 3.4: Automated Follow-ups
**Rules:**
- Error resolved → schedule follow-up check in 7 days
- No activity on error in 48h → auto-comment: "Any update on this?"
- School hasn't responded in 72h → escalate + notify admin
- Check-in overdue → reminder notification to school admin

---

## Phase 4: Analytics & Reporting

**Duration:** 4-5 days  
**Goal:** Data-driven insights, exportable reports

### Chunk 4.1: Enhanced Dashboard Analytics
**Backend:**
- New endpoint: `GET /api/analytics/dashboard` with time comparison
- Returns: current period stats, previous period stats, % change
- Sparkline data: last 30 days daily counts

**Frontend:**
- Stat cards with trend arrows (↑ green, ↓ red) and % change
- Mini sparkline charts below stat values
- Time period selector: "This week", "This month", "Last 30 days"

### Chunk 4.2: Charts & Visualizations
**Library:** Chart.js (lightweight, no framework dependency)

**Charts to build:**
- Error trend line chart (daily/weekly over time)
- Resolution time box plot by priority
- Category distribution donut chart
- SLA compliance bar chart by sub-admin
- Device status stacked bar by school
- School health radar chart

**Frontend:**
- Analytics page redesign with chart grid
- Each chart in a card with title + export button
- Responsive: charts resize with viewport

### Chunk 4.3: Sub-Admin Performance Dashboard
**Metrics:**
- Errors resolved this period
- Average resolution time (by priority)
- SLA compliance rate
- Schools visited (from check-ins)
- Response time (time from assignment to first action)

**Views:**
- Admin sees all sub-admins in comparison table
- Sub-admin sees own performance + rank
- Leaderboard (optional gamification)

### Chunk 4.4: PDF Report Generation
**Library:** PDFKit (server-side) or jsPDF (client-side)

**Reports:**
- Weekly summary report
- Monthly school health report
- Device inventory report per school
- SLA compliance report

**Flow:**
- User clicks "Generate Report" → select type + date range
- Backend generates PDF → returns download URL
- Scheduled: auto-generate weekly on Monday 6am, email to admin

### Chunk 4.5: Custom Dashboard Widgets
**Database:**
```sql
CREATE TABLE dashboard_layouts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  layout JSONB NOT NULL,  -- [{ widget: 'error_trend', position: {x:0,y:0,w:6,h:4} }]
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Frontend:**
- Drag-and-drop dashboard editor
- Widget library: stat cards, charts, tables, activity feed
- Save custom layout per user
- Reset to default option

---

## Phase 5: Mobile & PWA

**Duration:** 4-5 days  
**Goal:** Full mobile experience with offline capability

### Chunk 5.1: PWA Foundation
**Files:**
- `frontend/manifest.json` — app manifest
- `frontend/sw.js` — service worker
- `frontend/icons/` — app icons (192px, 512px)

**Capabilities:**
- Install to homescreen prompt
- App shell caching (HTML, CSS, JS, fonts)
- API response caching (stale-while-revalidate)
- Offline fallback page

### Chunk 5.2: Push Notifications
**Backend:**
- Web Push API implementation
- `push_subscriptions` table: stores user push endpoints
- `pushService.js` — sends push notifications

**Frontend:**
- Permission request on first login
- Subscribe to push on permission grant
- Display push notifications: error assigned, SLA breach, comment mention

### Chunk 5.3: Offline Sync
**Frontend:**
- IndexedDB store for pending actions
- Background sync registration
- Queue: error reports, check-ins, device status changes
- Conflict resolution on reconnect
- UI indicator: "Offline — 3 pending actions"

### Chunk 5.4: Camera & QR Scanner
**Frontend:**
- HTML5 camera access for photo capture
- QR/barcode scanner library (html5-qrcode)
- Scan flow: camera → detect code → lookup device → show detail
- Photo attach flow: camera → preview → upload to Cloudinary → attach to error

### Chunk 5.5: Mobile UI Optimization
**CSS:**
- Touch-friendly tap targets (min 44px)
- Swipe gestures: swipe-right to go back, swipe-left for actions
- Bottom navigation bar on mobile (instead of sidebar)
- Pull-to-refresh on list pages
- Floating action button (FAB) for primary action

---

## Phase 6: Security Hardening

**Duration:** 2-3 days  
**Goal:** Enterprise-grade security

### Chunk 6.1: Two-Factor Authentication
**Database:**
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS backup_codes JSONB;
```

**Flow:**
- Settings → Enable 2FA → show QR code (TOTP)
- User scans with authenticator app
- Verify with one code to confirm
- On login: password → then TOTP code
- Backup codes: 10 one-time codes for recovery

### Chunk 6.2: Session Management
**Database:**
```sql
CREATE TABLE user_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  token_hash VARCHAR(64) NOT NULL,
  device_info TEXT,
  ip_address VARCHAR(45),
  last_active TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);
```

**Features:**
- View all active sessions in profile
- Last active timestamp per session
- Force-logout individual or all sessions
- Session device fingerprint + IP

### Chunk 6.3: Password Policies
**Rules (configurable in settings):**
- Minimum length: 8 characters
- Require: uppercase + lowercase + number
- Password expiry: 90 days (optional)
- No reuse of last 5 passwords
- Breach check (optional): check against HaveIBeenPwned API

**UI:**
- Password strength meter on change/create
- Warning banner: "Password expires in 7 days"
- Force change on first login after admin reset

### Chunk 6.4: Security Alerts
**Alerts to admin:**
- Failed login attempts (>3 from same IP)
- Login from new device/location
- Bulk data export
- Permission escalation attempt
- API rate limit exceeded

---

## Phase 7: Device Lifecycle Enhancement

**Duration:** 3-4 days  
**Goal:** Complete device management with QR and maintenance

### Chunk 7.1: QR Code System
**Library:** `qrcode` npm package (backend generation)

**Backend:**
- `GET /api/inventory/:id/qr` — generates QR code image
- QR data: `https://domain.com/#device/{id}` or asset tag
- Bulk: `GET /api/inventory/qr-sheet?school_id=X` — PDF of all QR labels

**Frontend:**
- "Print QR" button in device detail
- Bulk print: select school → generate label sheet (PDF)
- Scanner page: camera → decode QR → navigate to device

### Chunk 7.2: Maintenance Scheduling
**Database:**
```sql
CREATE TABLE maintenance_schedules (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES schools(id),
  frequency_days INTEGER DEFAULT 30,
  last_completed TIMESTAMPTZ,
  next_due TIMESTAMPTZ,
  assigned_to INTEGER REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE maintenance_logs (
  id SERIAL PRIMARY KEY,
  schedule_id INTEGER REFERENCES maintenance_schedules(id),
  completed_by INTEGER REFERENCES users(id),
  devices_checked INTEGER DEFAULT 0,
  issues_found INTEGER DEFAULT 0,
  notes TEXT,
  completed_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Features:**
- Per-school maintenance schedule (configurable frequency)
- Auto-flag: "Overdue" when next_due < today
- Maintenance wizard: step-by-step device check flow
- Report: devices checked, issues found, actions taken

### Chunk 7.3: Warranty Tracking
**Database additions:**
```sql
ALTER TABLE tablets ADD COLUMN IF NOT EXISTS warranty_start DATE;
ALTER TABLE tablets ADD COLUMN IF NOT EXISTS warranty_end DATE;
ALTER TABLE tablets ADD COLUMN IF NOT EXISTS purchase_date DATE;
ALTER TABLE tablets ADD COLUMN IF NOT EXISTS purchase_cost DECIMAL(10,2);
ALTER TABLE tablets ADD COLUMN IF NOT EXISTS vendor VARCHAR(100);
```

**Features:**
- Warranty status in device DTO: active, expiring (30d), expired
- Dashboard alert: "12 devices with warranty expiring this month"
- Filter inventory by warranty status
- Cost reports: total investment, cost per school

### Chunk 7.4: Bulk Operations
**Frontend:**
- Checkbox per device card → bulk action bar appears
- "Select all" + "Select filtered"
- Actions: change status, transfer school, print QR labels, export selected
- Confirmation modal with count: "Change status of 23 devices?"

---

## Phase 8: Integrations

**Duration:** 3-4 days  
**Goal:** Connect with external systems

### Chunk 8.1: Webhook System
**Database:**
```sql
CREATE TABLE webhooks (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100),
  url VARCHAR(500) NOT NULL,
  events TEXT[] NOT NULL,  -- ['error.created', 'error.resolved']
  secret VARCHAR(100),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE webhook_deliveries (
  id SERIAL PRIMARY KEY,
  webhook_id INTEGER REFERENCES webhooks(id),
  event VARCHAR(50),
  payload JSONB,
  response_code INTEGER,
  response_body TEXT,
  delivered_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Backend:**
- `webhookService.js` — dispatch events to registered URLs
- HMAC signature verification
- Retry logic: 3 attempts with exponential backoff
- Delivery log: admin can see what was sent and responses

**Admin UI:**
- Manage webhooks: add URL, select events, test
- Delivery history: success/failure per webhook

### Chunk 8.2: WhatsApp Integration
**Provider:** Africa's Talking or WhatsApp Business API (Meta)

**Features:**
- Inbound: school sends message → creates error report
- Outbound: status updates sent to school's WhatsApp
- Templates: check-in reminder, error status update, SLA alert
- Conversation matching: link WhatsApp number to school

### Chunk 8.3: Google OAuth SSO
**Flow:**
- "Sign in with Google" button on login page
- Match Google email to existing user account
- Auto-create school admin account if email matches a school's contact_email
- Link multiple auth methods to one account

---

## Phase 9: Infrastructure & DevOps

**Duration:** 2-3 days  
**Goal:** Production-grade reliability

### Chunk 9.1: Automated Testing
**Files:**
- `backend/tests/` — test directory
- Use: Jest + Supertest for API testing

**Coverage targets:**
- All DTO transformations
- All service layer functions
- Critical API endpoints (auth, errors, inventory)
- SLA calculation edge cases

### Chunk 9.2: CI/CD Pipeline
**File:** `.gitlab-ci.yml`

**Stages:**
1. `lint` — ESLint
2. `test` — Jest with coverage report
3. `build` — verify build succeeds
4. `deploy-staging` — auto-deploy to staging
5. `deploy-prod` — manual trigger to production

### Chunk 9.3: Monitoring & Health
**Backend:**
- `GET /api/health` — returns system status
  - Database connectivity
  - Memory usage
  - Uptime
  - Active sessions count
- Error tracking: log unhandled exceptions with context

**External:**
- UptimeRobot: ping every 5 minutes
- Alert on downtime: email + SMS to admin

### Chunk 9.4: Performance Optimization
- Redis caching: dashboard stats (TTL: 60s), school list (TTL: 5min)
- Database indexes: add composite indexes for common queries
- Query optimization: N+1 elimination, batch queries
- Frontend: lazy-load page JS modules on navigation

---

## Implementation Schedule

### Week 1: Foundation + Quick Wins
| Day | Chunk | Deliverable |
|-----|-------|-------------|
| 1 | 0.1 | DTO layer complete |
| 2 | 0.2 | Service layer refactored |
| 3 | 0.3 | Event emitter wired up |
| 4 | 1.1 | Toast notifications live |
| 5 | 1.2 | Skeleton loading everywhere |

### Week 2: UX + Communication
| Day | Chunk | Deliverable |
|-----|-------|-------------|
| 6 | 1.3 | Global search (Cmd+K) |
| 7 | 1.4 + 1.5 | Empty states + breadcrumbs |
| 8 | 2.1 | Comments on errors |
| 9 | 2.2 | @Mentions working |
| 10 | 2.3 | Email notifications |

### Week 3: SLA + Analytics
| Day | Chunk | Deliverable |
|-----|-------|-------------|
| 11 | 3.1 | SLA configuration + timers |
| 12 | 3.2 | Auto-routing engine |
| 13 | 3.3 + 3.4 | Auto-escalation + follow-ups |
| 14 | 4.1 | Enhanced dashboard analytics |
| 15 | 4.2 | Charts with Chart.js |

### Week 4: Analytics + Mobile
| Day | Chunk | Deliverable |
|-----|-------|-------------|
| 16 | 4.3 | Sub-admin performance metrics |
| 17 | 4.4 | PDF report generation |
| 18 | 5.1 | PWA manifest + service worker |
| 19 | 5.2 | Push notifications |
| 20 | 5.3 | Offline sync |

### Week 5: Mobile + Security
| Day | Chunk | Deliverable |
|-----|-------|-------------|
| 21 | 5.4 | Camera + QR scanner |
| 22 | 5.5 | Mobile UI optimization |
| 23 | 6.1 | Two-factor auth |
| 24 | 6.2 + 6.3 | Sessions + password policies |
| 25 | 6.4 | Security alerts |

### Week 6: Devices + Integrations
| Day | Chunk | Deliverable |
|-----|-------|-------------|
| 26 | 7.1 | QR code system |
| 27 | 7.2 | Maintenance scheduling |
| 28 | 7.3 + 7.4 | Warranty + bulk ops |
| 29 | 8.1 | Webhook system |
| 30 | 9.1 + 9.2 | Tests + CI/CD |

---

## Chunk Dependencies

```
Phase 0 (Foundation) ─── required by everything
  │
  ├── Phase 1 (UX) ─── independent, start immediately after Phase 0
  │
  ├── Phase 2 (Communication) ─── depends on: Phase 0 events
  │     └── Chunk 2.2 (Mentions) depends on Chunk 2.1 (Comments)
  │     └── Chunk 2.3 (Email) depends on Phase 0 events
  │
  ├── Phase 3 (SLA) ─── depends on: Phase 0 services + events
  │     └── Chunk 3.2 (Routing) depends on Chunk 3.1 (SLA config)
  │     └── Chunk 3.3 (Escalation) depends on Chunk 3.1
  │
  ├── Phase 4 (Analytics) ─── depends on: Phase 0 DTOs + services
  │     └── Chunk 4.3 (Performance) depends on Chunk 3.1 (SLA data)
  │
  ├── Phase 5 (PWA) ─── independent, can run parallel with Phase 3-4
  │
  ├── Phase 6 (Security) ─── independent, can run anytime
  │
  ├── Phase 7 (Devices) ─── depends on: Phase 0, can run parallel
  │
  └── Phase 8 (Integrations) ─── depends on: Phase 0 events
```

---

## Definition of Done (per chunk)

Each chunk is DONE when:
- [ ] Code written and syntax verified
- [ ] Tested in browser (frontend) or with API calls (backend)
- [ ] No console errors
- [ ] Works for all roles (admin, subadmin, school) as appropriate
- [ ] Responsive on mobile viewport
- [ ] Committed with clear message
- [ ] Pushed to both remotes (origin + gitlab)
- [ ] SYSTEM_DOCUMENTATION.md updated if new API/table
- [ ] CLAUDE.md updated if new UI pattern/page

---

## Starting Point: Tomorrow's Session

**Start with Chunk 0.1 (DTO Layer):**
1. Create `backend/src/dto/` directory
2. Write `errorDto.js` first (most complex, sets the pattern)
3. Write `schoolDto.js`, `deviceDto.js`, `userDto.js`
4. Wire into existing controllers (one at a time)
5. Verify API responses still work in frontend
6. Commit + push

**Then Chunk 0.2 (Service Layer):**
1. Create `errorService.js` — extract query logic from controller
2. Controller becomes: validate → service call → DTO transform → respond
3. Repeat for school, inventory
4. Verify no regressions

This foundation makes every subsequent chunk faster and cleaner.
