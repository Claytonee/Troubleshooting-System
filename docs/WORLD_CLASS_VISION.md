# QFT Technical Support System — World-Class Vision Document

**Version:** 1.0  
**Date:** 2026-07-23  
**Goal:** Transform QFT from a functional support tool into the #1 education-tech field support platform in East Africa

---

## Executive Summary

The QFT Technical Support System currently handles error reporting, school management, tablet inventory, and team coordination. To reach world-class status, it needs: **real-time collaboration**, **intelligent automation**, **mobile-first field experience**, **deep analytics**, and **enterprise-grade security**.

This document defines the complete vision across 10 pillars, each with specific features, user stories, and success metrics.

---

## Pillar 1: Real-Time Communication & Collaboration

### 1.1 WebSocket Live Updates
- Real-time badge counters (no page refresh needed)
- Live error status changes visible to all stakeholders
- "User is typing" / "User is viewing this error" presence indicators
- Connection status indicator in topbar

### 1.2 Threaded Comments on Errors
- Any role can comment on an error (like GitHub issues)
- @mention system — type `@` to tag a user → they get notification
- Rich text: bold, links, inline images
- Comment edit/delete with audit trail
- "Internal note" (admin/subadmin only) vs "Public comment" (school can see)

### 1.3 In-App Messaging
- Direct messages between admin ↔ sub-admin ↔ school admin
- Group channels per zone (e.g., "Moshi Urban team")
- Message read receipts
- File/image sharing in chat

### 1.4 Email & SMS Notifications
- Configurable per user: which events trigger email/SMS
- Email templates: error assigned, SLA breach, weekly digest
- SMS via Africa's Talking or Twilio for critical alerts
- Digest mode: "Send me one email per day with all updates"

### 1.5 Activity Feed
- Global timeline: "K. Njoro resolved Error #MTK-045 · 2 min ago"
- Filterable by: school, user, action type, date range
- Real-time streaming (new items appear at top without refresh)

---

## Pillar 2: Mobile-First Field Experience

### 2.1 Progressive Web App (PWA)
- Install to homescreen on Android/iOS
- App icon, splash screen, full-screen mode
- Push notifications via service worker
- Manifest + service worker caching strategy

### 2.2 Offline Mode
- IndexedDB local store for: pending error reports, check-in forms, device updates
- Sync queue: actions performed offline queue and submit when reconnected
- Conflict resolution: last-write-wins with admin override
- Visual indicator: "Offline — 3 actions pending sync"

### 2.3 Camera & Scanner Integration
- Scan device QR/barcode → opens device detail instantly
- Capture photo of hardware issue → attach to error report
- OCR: scan serial number from device back → auto-fill field
- Document scanner: photograph maintenance receipts

### 2.4 GPS & Location
- Auto-tag error reports with GPS coordinates
- "Navigate to school" button → opens Google Maps
- Map view: see all schools as pins, color-coded by health
- Geofencing: auto check-in when sub-admin arrives at school

---

## Pillar 3: Intelligence & Automation

### 3.1 Auto-Routing Engine
- Rules-based: Error at School X → assign to sub-admin responsible for Zone Y
- Load balancing: if sub-admin has 10+ open errors, distribute to another
- Escalation ladder: unresolved 24h → escalate to next tier
- Manual override always available

### 3.2 SLA Engine
- Per-priority SLA targets (Critical: 4h, High: 12h, Medium: 48h, Low: 7d)
- Live countdown timers on error cards
- Auto-escalation: 75% elapsed → warning to assignee, 100% → escalate to admin
- SLA pause: "Waiting on school" stops the clock
- SLA reports: compliance % by sub-admin, zone, school, category

### 3.3 Predictive Analytics
- Pattern detection: "Tablets from Batch X fail 3x more than Batch Y"
- Seasonal trends: "Internet issues spike every January (new term)"
- Predictive maintenance: "5 devices at Mtakuja due for check-up based on age + usage"
- Risk scoring per school: composite of error frequency, device age, last check-in

### 3.4 Duplicate Detection
- On error submit: "Similar error #MTK-032 reported 2 days ago — is this the same?"
- Fuzzy matching on: title, category, school, device
- Merge duplicates: combine into one with both reporters notified
- Auto-link related errors: "3 schools reporting same internet issue → possible ISP outage"

### 3.5 AI-Powered Suggestions
- On error view: "Similar past errors were resolved by: [steps]"
- Auto-suggest category based on error description
- Recommended priority based on keywords + school history
- Resolution templates: "Click to apply solution from Error #MTK-019"

### 3.6 Automated Workflows
- No response in 48h → auto-follow-up message to school
- Error resolved → auto-schedule 7-day follow-up check
- Weekly digest auto-generated and emailed to stakeholders
- Inventory alert: device not checked in 60 days → flag

---

## Pillar 4: Deep Analytics & Reporting

### 4.1 Executive Dashboard
- KPI cards with sparkline trends (not just current numbers)
- Comparison: this week vs last week, this month vs last month
- Goal tracking: "Target: 95% SLA compliance — Currently: 87%"

### 4.2 Custom Report Builder
- Drag-and-drop widgets: charts, tables, stat cards
- Save custom dashboards per user
- Schedule: "Email me this report every Monday 8am"
- Export: PDF, Excel, Google Sheets link

### 4.3 Visualizations
- Error trends: line chart over time (daily/weekly/monthly)
- Resolution time distribution: histogram
- Category breakdown: pie/donut with drill-down
- Geographic heatmap: errors by school location
- Team performance: radar chart per sub-admin
- Device health: stacked bar by status over time

### 4.4 Sub-Admin Performance Metrics
- Avg resolution time (by priority)
- Errors handled per week
- SLA compliance rate
- School satisfaction score (from check-in data)
- Visit frequency per school
- Comparison leaderboard (gamification-light)

### 4.5 Automated Reports
- Weekly summary PDF: auto-generated, emailed to admin
- Monthly school health report: per school, shareable
- Quarterly executive summary: trends, achievements, risks
- Incident post-mortem template: for critical resolved errors

---

## Pillar 5: Security & Compliance

### 5.1 Authentication Hardening
- Two-Factor Authentication (TOTP via authenticator app)
- SMS OTP fallback for field staff without authenticator
- Password policies: min 8 chars, complexity, 90-day expiry, no reuse of last 5
- Account lockout: 5 failed attempts → 15min cooldown + admin alert
- "Remember this device" trusted device management

### 5.2 Session Management
- View all active sessions (device, IP, last activity)
- Force-logout specific sessions or all devices
- Session timeout: configurable (default 7d, high-security: 8h)
- Concurrent session limit per user

### 5.3 Audit & Compliance
- Full audit trail UI: searchable, filterable, exportable
- Data retention policies: auto-archive after N months
- GDPR-style data export: "Download all my data"
- Right to deletion: school can request data purge
- Role-based data masking: school sees own data only

### 5.4 API Security
- Rate limiting per user/IP with visibility in admin panel
- API key management for external integrations
- Request signing for webhooks
- IP allowlisting option for admin panel

---

## Pillar 6: UX Excellence

### 6.1 Global Search (Cmd+K)
- Unified search across: errors, schools, devices, users, resources
- Fuzzy matching + recent searches
- Keyboard navigable results
- Action shortcuts: "new error", "go to analytics"
- Search from anywhere — modal overlay

### 6.2 Keyboard Shortcuts
- `Cmd+K` / `Ctrl+K` → global search
- `N` → new (context-dependent: new error, new device)
- `E` → edit current item
- `Esc` → close modal/panel
- `/` → focus search/filter
- `?` → show shortcuts help

### 6.3 Theme System
- Dark mode (current default)
- Light mode
- Auto (follows system preference)
- High contrast accessibility mode
- Per-user preference saved server-side

### 6.4 Skeleton Loading
- Content-shaped placeholders while data loads
- Staggered reveal animation
- Never show blank white/dark screen
- Progressive loading: header → stats → table/cards

### 6.5 Toast Notifications
- Bottom-right stack (max 3 visible)
- Types: success (green), error (red), warning (amber), info (blue)
- Auto-dismiss: 4s for success, sticky for errors
- Action button: "Undo" on destructive actions
- Queue system: new toasts wait for space

### 6.6 Empty States
- Custom illustration per page when no data
- Helpful action: "No devices yet — Import your first batch"
- Don't show error-looking UI for expected empty state

### 6.7 Onboarding
- First-login guided tour (tooltips pointing to key UI)
- Role-specific: school admin sees different tour than sub-admin
- "Skip" and "Don't show again" options
- Video walkthroughs linked from help page

### 6.8 Breadcrumb Navigation
- Shows hierarchy: "Inventory → Mtakuja SS → MTK-T-045"
- Clickable at each level
- Replaces "back" guessing

---

## Pillar 7: Knowledge & Self-Service

### 7.1 Knowledge Base
- Searchable wiki of solved problems
- Auto-populated: when an error is resolved with steps → "Save as KB article?"
- Categories matching error categories
- Upvote/downvote articles
- "Was this helpful?" feedback loop

### 7.2 Contextual Help
- `?` icon next to complex fields → tooltip explanation
- "Learn more" links to relevant KB article
- Error-specific: "Errors like this are usually caused by..."

### 7.3 Self-Service for Schools
- Password reset without admin intervention
- Update own contact info (with admin notification)
- View own error history and resolution status
- Download own data / reports
- Submit feedback / feature requests

---

## Pillar 8: Device Lifecycle Excellence

### 8.1 QR Code System
- Generate printable QR sticker per device
- Scan → instant device detail page
- Bulk print: generate PDF sheet of QR labels
- QR contains: asset tag + short URL

### 8.2 Warranty & Procurement
- Warranty start/end date per device
- "Warranty expiring in 30 days" alerts
- Purchase order tracking
- Vendor/supplier database
- Cost tracking: total cost of ownership per device

### 8.3 Maintenance Scheduling
- Recurring maintenance calendar per school
- "Due for check-up" auto-flags
- Maintenance log: what was done, by whom, parts replaced
- Predictive: "Based on age and history, schedule check for..."

### 8.4 Bulk Operations
- Multi-select devices → bulk status change
- Bulk transfer: move 50 devices from School A to School B
- Bulk retire: mark batch as end-of-life
- Bulk print QR labels

### 8.5 Visual Condition Log
- Photo gallery per device (before/after repair)
- Condition rating: 1-5 stars
- Damage map: tap on tablet silhouette to mark damage location

---

## Pillar 9: Infrastructure & DevOps

### 9.1 CI/CD Pipeline
- GitLab CI: lint → test → build → deploy staging → deploy prod
- Automated test suite: unit + integration + E2E
- Database migration validation in pipeline
- Rollback: one-click revert to previous deploy

### 9.2 Monitoring & Alerting
- Application health: response time, error rate, uptime
- Database: connection pool, slow queries, disk usage
- Custom metrics: errors per minute, active users
- Alerts: PagerDuty/Slack when thresholds breached

### 9.3 Performance
- Redis caching for dashboard stats, school lists
- Database query optimization: indexes, materialized views
- CDN for static assets (already using Cloudinary for files)
- Lazy loading: pages load JS only when navigated to

### 9.4 Backup & Recovery
- Automated daily database backups
- Point-in-time recovery capability
- Monthly restore testing
- Geo-redundant backup storage
- Documented RTO/RPO targets

### 9.5 Staging Environment
- Identical to production but separate database
- Auto-deploy from `develop` branch
- Seed with anonymized production-like data
- Feature flags: toggle features per environment

---

## Pillar 10: Integrations & Ecosystem

### 10.1 WhatsApp Business API
- School admins report errors via WhatsApp message
- Status updates sent back to WhatsApp
- Template messages: check-in reminders, SLA alerts
- Rich messages: buttons, lists, media

### 10.2 Google Workspace
- SSO via Google OAuth (school staff already have Google accounts)
- Google Calendar: auto-create events for check-in schedules
- Google Sheets: live export option for reports
- Google Drive: alternative file storage integration

### 10.3 MDM Integration
- Pull device status from MDM (Hexnode, Jamf, etc.)
- Auto-update device "last seen" timestamp
- Push configuration profiles to devices
- Remote lock/wipe capability linked from inventory

### 10.4 Webhook System
- Event-driven: error.created, error.resolved, device.status_changed
- Admin configures webhook URLs per event
- Retry logic with exponential backoff
- Webhook logs: see delivery history

### 10.5 Public API
- REST API with API key auth for external systems
- Rate limited per key
- Versioned: /api/v1/, /api/v2/
- OpenAPI/Swagger documentation
- SDKs: JavaScript, Python

---

## Success Metrics

| Metric | Current | Target (6 months) |
|--------|---------|-------------------|
| SLA compliance | ~70% (estimated) | 95%+ |
| Avg resolution time | Unknown | < 8h critical, < 24h high |
| User adoption (daily active) | Low | 90%+ of staff daily |
| Mobile usage | 0% (no PWA) | 60%+ of field actions |
| School self-service | 0% | 40% of inquiries resolved without admin |
| System uptime | Unknown | 99.5%+ |
| Mean time to acknowledge | Unknown | < 30min during work hours |

---

## Design Principles

1. **Mobile-first, always** — Field engineers are the primary users. Every feature must work beautifully on phone.
2. **Zero training needed** — UI must be so intuitive that new users are productive in < 5 minutes.
3. **Automate the boring** — If a human repeats it 3+ times, automate it.
4. **Data-driven decisions** — Every action generates data. Surface insights, not just records.
5. **Offline-resilient** — Tanzania's connectivity is unreliable. Never lose work due to network drop.
6. **Secure by default** — Least privilege, encrypted at rest + transit, audit everything.
7. **Delightful interactions** — Micro-animations, smart defaults, contextual help. Make work feel good.

---

*This vision document guides all future development. Each pillar maps to implementation chunks in `IMPLEMENTATION_PLAN.md`.*
