# Quest Forward Tanzania — Technical Support System
## Complete System Documentation v1.0

---

## 1. System Overview

The QFT Technical Support System is a web-based platform that enables Quest Forward Tanzania to manage technical issues across multiple school sites. It provides real-time error tracking, team coordination, weekly health check-ins, a knowledge base, and a resource library for training materials.

### Key Capabilities
- **Error Lifecycle Management** — Report, assign, track, escalate, and resolve technical issues
- **SLA Enforcement** — Automated breach detection (Critical ≤2h, High ≤8h, Medium ≤24h, Low ≤72h)
- **Team Coordination** — Assign field engineers to schools, track workload distribution
- **Weekly Health Monitoring** — Structured weekly check-ins per school (connectivity, tablets, platform, power)
- **Knowledge Base** — Step-by-step troubleshooting guides for common problems
- **Resource Library** — Upload and share user manuals, training videos, documents
- **Role-Based Access** — Three-tier permissions (Admin > Sub-Admin > School)
- **Multi-View Dashboard** — Admin can switch perspective to view as any sub-admin or school

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (SPA)                            │
│  Vanilla JS · Hash Routing · DM Sans · Tabler Icons            │
│  Static files served by Express from /frontend                  │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP/JSON + JWT Bearer Token
┌────────────────────────────┴────────────────────────────────────┐
│                     BACKEND (Express.js)                         │
│  Node.js · JWT Auth · Role Middleware · Rate Limiting           │
│  morgan logging · helmet security · CORS                        │
└──────┬──────────────────────────────────┬───────────────────────┘
       │ mysql2/promise                   │ cloudinary SDK
┌──────┴──────────┐             ┌─────────┴─────────────┐
│  Aiven MySQL    │             │  Cloudinary CDN       │
│  (Cloud DB)     │             │  (File Storage)       │
│  SSL + CA cert  │             │  Images/Video/Audio   │
└─────────────────┘             └───────────────────────┘
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Vanilla JavaScript (ES6+) | SPA with module pattern |
| Styling | CSS Custom Properties | Dark theme, responsive design |
| Icons | Tabler Icons (CDN) | 4000+ icons via webfont |
| Backend | Node.js 18+ / Express 4 | REST API server |
| Database | MySQL 8.4 (Aiven) | Relational data storage |
| Auth | JWT (jsonwebtoken) | Stateless authentication |
| Passwords | bcryptjs | Secure password hashing |
| Uploads | Multer + Cloudinary | Cloud file storage |
| Hosting | Render (free tier) | Auto-deploy from GitLab |
| Source | GitHub + GitLab | Dual remote, GitLab triggers deploy |

---

## 3. Database Schema

### Entity Relationship Diagram

```
users (1)──────(N) errors
  │                   │
  │                   └──(N) error_updates
  │
  └──(N) schools (1)──(N) errors
              │
              ├──(N) weekly_checkins
              ├──(N) communications
              └──(N) manuals (via uploaded_by)

settings (key-value store)
troubleshooting_guides (standalone)
manuals (standalone, Cloudinary URLs)
```

### Table Definitions

#### `users`
| Column | Type | Description |
|--------|------|-------------|
| id | INT PK AUTO | Unique identifier |
| username | VARCHAR(100) UNIQUE | Login name |
| email | VARCHAR(200) | Contact email |
| password_hash | VARCHAR(255) | bcrypt hash |
| full_name | VARCHAR(200) | Display name |
| role | ENUM('admin','subadmin','school') | Access level |
| phone | VARCHAR(50) | Phone number |
| zone | VARCHAR(100) | Geographic zone |
| color | VARCHAR(20) | UI avatar color |
| title | VARCHAR(100) | Job title |
| status | VARCHAR(50) DEFAULT 'active' | active/onsite/remote |
| school_id | INT FK→schools | For school-role users |

#### `schools`
| Column | Type | Description |
|--------|------|-------------|
| id | INT PK AUTO | Unique identifier |
| code | VARCHAR(20) UNIQUE | Short code (e.g., KLM) |
| name | VARCHAR(200) | Full school name |
| zone | VARCHAR(100) | Geographic zone |
| students | INT DEFAULT 0 | Student count |
| tablets | INT DEFAULT 0 | Tablet count |
| routers | INT DEFAULT 0 | Router count |
| contact_name | VARCHAR(200) | Primary contact |
| contact_phone | VARCHAR(50) | Contact phone |
| contact_email | VARCHAR(200) | Contact email |
| lrs_ip | VARCHAR(50) | LRS server IP |
| isp | VARCHAR(100) | Internet provider |
| assigned_admin_id | INT FK→users | Assigned sub-admin |
| created_at | TIMESTAMP | Creation date |

#### `errors`
| Column | Type | Description |
|--------|------|-------------|
| id | INT PK AUTO | Unique identifier |
| error_code | VARCHAR(20) UNIQUE | Auto-generated (QFT-0###) |
| title | VARCHAR(300) | Short description |
| description | TEXT | Full details |
| school_id | INT FK→schools | Affected school |
| category | VARCHAR(100) | Connectivity/Hardware/Platform/Power/Accounts/Other |
| subcategory | VARCHAR(200) | Specific issue type |
| priority | ENUM('critical','high','medium','low') | Urgency level |
| status | ENUM('open','progress','escalated','resolved') | Current state |
| assigned_to | INT FK→users | Responsible engineer |
| reporter_name | VARCHAR(200) | Who reported it |
| reporter_role | VARCHAR(100) | Reporter's role |
| location | VARCHAR(300) | Physical location |
| affected_devices | INT DEFAULT 1 | Number of devices |
| hours_open | DECIMAL(10,2) DEFAULT 0 | Auto-calculated age |
| resolved_at | TIMESTAMP NULL | Resolution timestamp |
| created_at | TIMESTAMP | Report date |

#### `error_updates`
| Column | Type | Description |
|--------|------|-------------|
| id | INT PK AUTO | Unique identifier |
| error_id | INT FK→errors | Parent error |
| update_type | VARCHAR(50) | note/status_change/escalation |
| note | TEXT | Update content |
| recorded_by | VARCHAR(200) | Who added it |
| created_at | TIMESTAMP | When added |

#### `weekly_checkins`
| Column | Type | Description |
|--------|------|-------------|
| id | INT PK AUTO | Unique identifier |
| school_id | INT FK→schools | Target school |
| week_number | INT | Week 1-10 |
| term | VARCHAR(50) | e.g., "Term 2 · 2026" |
| status | ENUM('green','amber','red') | Overall health |
| connectivity | VARCHAR(20) | ok/issue/na |
| tablets | VARCHAR(20) | ok/issue/na |
| platform | VARCHAR(20) | ok/issue/na |
| power | VARCHAR(20) | ok/issue/na |
| note | TEXT | Observer notes |
| checked_by | VARCHAR(200) | Who checked |
| created_at | TIMESTAMP | Check date |
| UNIQUE | (school_id, week_number, term) | One per school per week |

#### `communications`
| Column | Type | Description |
|--------|------|-------------|
| id | INT PK AUTO | Unique identifier |
| school_id | INT FK→schools | Related school |
| recorded_by | VARCHAR(200) | Author |
| note | TEXT | Message content |
| created_at | TIMESTAMP | When recorded |

#### `manuals`
| Column | Type | Description |
|--------|------|-------------|
| id | INT PK AUTO | Unique identifier |
| title | VARCHAR(300) | Display title |
| original_filename | VARCHAR(300) | Upload filename |
| stored_filename | VARCHAR(500) | Cloudinary CDN URL |
| file_type | VARCHAR(100) | MIME type |
| file_size | INT DEFAULT 0 | Bytes |
| category | VARCHAR(100) | General/User Guide/Training/Technical/Policy/Other |
| uploaded_by | VARCHAR(200) | Who uploaded |
| created_at | TIMESTAMP | Upload date |

#### `troubleshooting_guides`
| Column | Type | Description |
|--------|------|-------------|
| id | INT PK AUTO | Unique identifier |
| title | VARCHAR(300) | Guide title |
| category | VARCHAR(100) | Issue category |
| icon | VARCHAR(50) | Tabler icon name |
| steps | JSON | Array of step strings |
| is_custom | TINYINT DEFAULT 0 | Custom vs built-in |
| created_by | VARCHAR(200) | Author |
| created_at | TIMESTAMP | Creation date |
| updated_at | TIMESTAMP | Last edit |

#### `settings`
| Column | Type | Description |
|--------|------|-------------|
| id | INT PK AUTO | — |
| setting_key | VARCHAR(100) UNIQUE | Key name |
| setting_value | TEXT | Value |

---

## 4. API Reference

### Authentication
All endpoints except `/api/auth/login`, `/api/settings`, and `/api/health` require:
```
Authorization: Bearer <jwt_token>
```

### Endpoints

#### Auth (`/api/auth`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| POST | /login | No | — | Login → token + user |
| POST | /register | Yes | admin | Create user |
| GET | /profile | Yes | any | Get current user |
| PUT | /change-password | Yes | any | Update password |

#### Dashboard (`/api/dashboard`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | / | Yes | any | Aggregated KPIs (role-filtered) |

#### Schools (`/api/schools`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | / | Yes | any | List schools |
| GET | /:id | Yes | any | School detail + history |
| POST | / | Yes | admin | Create school |
| PUT | /:id | Yes | admin | Update school |
| PATCH | /:id/assign | Yes | admin | Reassign sub-admin |
| DELETE | /:id | Yes | admin | Delete (cascading) |

#### Errors (`/api/errors`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | / | Yes | any | List with filters (?status, ?priority, ?category, ?school_id, ?search) |
| GET | /stats | Yes | any | Aggregated statistics |
| GET | /:id | Yes | any | Detail + updates |
| POST | / | Yes | any | Report new error |
| PUT | /:id | Yes | subadmin+ | Update details |
| PATCH | /:id/status | Yes | any | Change status |
| POST | /:id/updates | Yes | any | Add progress note |
| DELETE | /:id | Yes | admin | Delete error |

#### Team (`/api/team`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | / | Yes | any | List sub-admins |
| GET | /:id | Yes | any | Sub-admin detail |
| POST | / | Yes | admin | Create sub-admin |
| PUT | /:id | Yes | admin | Update profile |
| PATCH | /:id/schools | Yes | admin | Assign schools |
| DELETE | /:id | Yes | admin | Remove (reassign) |

#### Check-Ins (`/api/checkins`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | / | Yes | any | List (?week, ?school_id, ?term) |
| GET | /stats | Yes | any | Completion statistics |
| GET | /school/:schoolId | Yes | any | All checkins for school |
| POST | / | Yes | any | Create/upsert checkin |

#### Guides (`/api/guides`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | / | Yes | any | List all guides |
| GET | /:id | Yes | any | Guide detail |
| POST | / | Yes | admin | Create guide |
| PUT | /:id | Yes | admin | Update guide |
| DELETE | /:id | Yes | admin | Delete guide |

#### Manuals / Resource Library (`/api/manuals`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | / | Yes | any | List all files |
| GET | /:id/download | Yes | any | Get Cloudinary URL |
| POST | / | Yes | admin | Upload file (multipart/form-data) |
| DELETE | /:id | Yes | admin | Delete file + CDN cleanup |

#### Communications (`/api/communications`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | / | Yes | any | List notes |
| POST | / | Yes | any | Add note |
| DELETE | /:id | Yes | subadmin+ | Remove note |

#### Settings (`/api/settings`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | / | No | — | Get all settings |
| PUT | / | Yes | admin | Update settings |

#### Health
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/health | No | System status check |

---

## 5. SLA System

### Targets
| Priority | Max Resolution Time | Auto-Breach After |
|----------|--------------------|--------------------|
| Critical | 2 hours | 2h open without resolution |
| High | 8 hours | 8h open without resolution |
| Medium | 24 hours | 24h open without resolution |
| Low | 72 hours | 72h open without resolution |

### Breach Detection
The `hours_open` column is calculated at query time. When `hours_open > SLA[priority]`, the error is flagged as breached in the UI with:
- Red dot + "SLA Breach" badge
- Red border on follow-up cards
- Alert banner on dashboard (for critical errors)
- Notification dot on topbar bell icon

---

## 6. Role-Based Access Control

### Role Hierarchy
```
┌─────────────────────────────────────────────────┐
│ ADMIN (System Administrator)                     │
│ ✓ All operations                                 │
│ ✓ Manage team, schools, settings                │
│ ✓ Upload manuals, create guides                 │
│ ✓ View analytics                                │
│ ✓ Switch view to any sub-admin or school        │
├─────────────────────────────────────────────────┤
│ SUBADMIN (Field Engineer)                        │
│ ✓ View/update assigned schools only             │
│ ✓ Report and resolve errors                     │
│ ✓ Record weekly check-ins                       │
│ ✓ Add communication notes                       │
│ ✗ Cannot manage team or settings                │
├─────────────────────────────────────────────────┤
│ SCHOOL (School Staff)                            │
│ ✓ View own school data only                     │
│ ✓ Report errors                                 │
│ ✓ View guides and manuals                       │
│ ✗ Cannot escalate or reassign                   │
│ ✗ Cannot see other schools                      │
└─────────────────────────────────────────────────┘
```

---

## 7. File Upload System (Cloudinary)

### Why Cloudinary
Render's free tier has ephemeral filesystem — files are deleted on every deploy/restart. Cloudinary provides free cloud storage with global CDN delivery.

### Supported File Types
| Category | Extensions | Cloudinary resource_type |
|----------|-----------|------------------------|
| Documents | pdf, doc, docx, ppt, pptx, xls, xlsx, txt, html | raw |
| Images | png, jpg, jpeg, gif, webp, svg | image |
| Video | mp4, webm, mov, avi, mkv | video |
| Audio | mp3, wav, ogg, m4a, aac | video |

### Upload Flow
```
1. Admin selects file + title + category in modal
2. Frontend sends multipart FormData to POST /api/manuals
3. Multer captures file in memory buffer (memoryStorage)
4. Controller determines Cloudinary resource_type from mimetype
5. streamifier pipes buffer to cloudinary.uploader.upload_stream
6. Cloudinary returns secure_url (CDN link)
7. Database stores: title, original_filename, secure_url, mimetype, size, category
8. Frontend displays file in Resource Library with icon + meta
```

### Preview Capabilities
- **Images:** `<img>` tag with max-height constraint
- **Video:** HTML5 `<video controls>` with browser-native player
- **Audio:** HTML5 `<audio controls>` with playback bar
- **Documents:** Download only (no in-app rendering)

### Limits
- Max file size: 100MB (configurable via `MAX_FILE_SIZE` env var)
- Cloudinary free tier: 25 credits/month (~25GB combined storage + bandwidth)

---

## 8. Frontend Architecture

### Module Pattern
Each page is an IIFE returning `{ load, render }`:
```javascript
const PageName = (() => {
  let data = null;

  async function load() {
    // Fetch data from API
  }

  function render() {
    // Return HTML string
  }

  return { load, render };
})();
```

### Page Lifecycle
```
User clicks nav item
  → Router.navigate(page)
  → window.location.hash = page
  → App.loadAndRender()
    → handler.load()   // async data fetch
    → handler.render() // returns HTML string
    → main.innerHTML = html
    → initScrollReveal() // animate cards
```

### File Structure
```
frontend/
├── index.html          # SPA shell (login + app container)
├── css/
│   ├── variables.css   # CSS custom properties (colors, fonts)
│   ├── base.css        # Layout, scrollbar, responsive, animations
│   └── components.css  # Cards, buttons, forms, tables, badges
└── js/
    ├── api.js          # HTTP client (fetch wrapper + JWT)
    ├── utils.js        # Helpers (esc, ageStr, PRI, STAT, CAT_META)
    ├── auth.js         # Login, logout, profile, role-switch
    ├── router.js       # Hash-based routing
    ├── app.js          # Main controller + ErrorDetailModal
    ├── components/
    │   └── modal.js    # Reusable modal (open, close, init)
    └── pages/
        ├── dashboard.js   # KPIs, alerts, priorities, categories
        ├── report.js      # Error submission form
        ├── tracker.js     # Error list with filters
        ├── followup.js    # SLA breaches, team, comms
        ├── weekly.js      # Week tabs, school check-in table
        ├── schools.js     # School grid + detail view
        ├── guides.js      # Troubleshooting knowledge base
        ├── manuals.js     # Resource library (upload/preview/download)
        ├── analytics.js   # Charts, trends, SLA compliance
        ├── team.js        # Sub-admin management
        └── branding.js    # System appearance settings
```

---

## 9. Deployment Guide

### Prerequisites
- Node.js 18+
- MySQL 8.x database
- Cloudinary account (free)
- Render account (free)
- Git with GitHub + GitLab remotes

### Environment Variables
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| DATABASE_URL | Yes | — | MySQL connection string |
| JWT_SECRET | Yes | — | Token signing key |
| JWT_EXPIRES_IN | No | 7d | Token lifetime |
| NODE_ENV | No | development | Environment mode |
| PORT | No | 3000 | Server port |
| CLOUDINARY_CLOUD_NAME | Yes (prod) | — | Cloudinary cloud name |
| CLOUDINARY_API_KEY | Yes (prod) | — | Cloudinary API key |
| CLOUDINARY_API_SECRET | Yes (prod) | — | Cloudinary API secret |
| MAX_FILE_SIZE | No | 104857600 | Max upload bytes (100MB) |

### Deploy Steps
1. Push to GitLab: `git push gitlab main`
2. Render auto-deploys from GitLab main branch
3. On first start, auto-migration creates all tables + seeds demo data
4. Default login: `admin` / `admin123`

### SSL (Aiven MySQL)
The `backend/src/config/ca.pem` file contains the Aiven CA certificate. In production:
```javascript
ssl: { ca: fs.readFileSync('ca.pem'), rejectUnauthorized: false }
```

---

## 10. Security Measures

| Measure | Implementation |
|---------|---------------|
| Password hashing | bcryptjs (10 salt rounds) |
| Authentication | JWT in Authorization header |
| Rate limiting | 20 login/15min, 200 API/15min |
| CORS | Restricted origins |
| HTTP headers | helmet middleware |
| Input validation | express-validator schemas |
| SQL injection | Parameterized queries (mysql2) |
| XSS prevention | HTML escaping (frontend esc() helper) |
| File validation | Extension whitelist + multer fileFilter |
| SSL/TLS | Database connection encrypted with CA cert |

---

## 11. Demo Data (Auto-Seeded)

On first startup with empty tables, the system seeds:

### Users
| Username | Password | Role | Zone |
|----------|----------|------|------|
| admin | admin123 | admin | System |
| knjoro | changeme123 | subadmin | Moshi Urban |
| famani | changeme123 | subadmin | Kilema |
| thassan | changeme123 | subadmin | Hai |
| cmbowe | changeme123 | subadmin | Rombo |

### Schools (9 total)
Spread across Moshi Urban, Kilema, Hai, and Rombo zones with realistic student/tablet counts.

### Errors (9 total)
Mix of priorities (critical to low), categories (Connectivity, Hardware, Platform, Power), and statuses (open, progress, resolved).

### Guides (5 total)
WiFi troubleshooting, Tablet charging, Platform login, Generator/power, Projector setup.

---

## 12. Known Limitations & Future Improvements

### Current Limitations
- No real-time updates (data fetches on page load only)
- No email/SMS notifications for SLA breaches
- No data export (CSV/PDF)
- No 2FA authentication
- No audit trail (soft deletes)
- English only (no i18n)

### Recommended Improvements
1. **WebSocket or SSE** — Real-time error status updates
2. **Email notifications** — SLA breach alerts via SendGrid/Mailgun
3. **Data export** — CSV/PDF generation for reports
4. **Error attachments** — Photos of physical damage/equipment
5. **Calendar view** — Visual weekly check-in scheduling
6. **Historical trends** — Charts comparing week-over-week performance
7. **Mobile app** — React Native or PWA for field engineers
8. **Bulk operations** — Mass error resolution, bulk school import
9. **API versioning** — `/api/v1/` prefix for breaking changes

---

*Document Version: 1.0*  
*Last Updated: June 2026*  
*System Version: QFT Support v1.0*
