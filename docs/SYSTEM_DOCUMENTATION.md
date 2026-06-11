# Quest Forward Tanzania — Technical Support System

## Complete System Documentation

**Version:** 1.0.0  
**Last Updated:** June 2026  
**Organization:** Quest Forward Tanzania  
**Stack:** Node.js + Express · MySQL 8.4 · Vanilla JS Frontend  

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture](#2-architecture)
3. [Features](#3-features)
4. [Database Schema](#4-database-schema)
5. [API Reference](#5-api-reference)
6. [Authentication & Authorization](#6-authentication--authorization)
7. [Frontend Architecture](#7-frontend-architecture)
8. [Error Lifecycle & SLA](#8-error-lifecycle--sla)
9. [Deployment Guide](#9-deployment-guide)
10. [Security](#10-security)

---

## 1. System Overview

### Purpose

The Quest Forward Tanzania Technical Support System is a web-based platform for tracking, managing, and resolving technical issues across 13+ partner schools in Tanzania. It provides:

- **Centralized error tracking** with priority-based SLA enforcement
- **School health monitoring** via weekly check-ins
- **Role-based dashboards** for admins, field engineers, and school staff
- **Troubleshooting guides** for common issues
- **Communication logging** between support staff and schools

### Problem It Solves

Quest Forward deploys tablets, routers, and LRS (Learning Record Store) servers in rural and peri-urban schools. Hardware failures, network outages, and platform issues need rapid response. This system replaces ad-hoc WhatsApp communication with structured issue tracking and SLA accountability.

### Users & Roles

| Role | Description | Access Level |
|------|-------------|-------------|
| **Admin** | Central IT manager | Full system access, team management |
| **Sub-Admin** | Field engineer assigned to specific schools | Assigned schools only |
| **School** | School contact person | Own school data only |

---

## 2. Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT BROWSER                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │ Auth.js  │ │ Router   │ │ Pages/*  │ │ API Client│  │
│  └──────────┘ └──────────┘ └──────────┘ └─────┬─────┘  │
└───────────────────────────────────────────────┼─────────┘
                                                │ REST/JSON
┌───────────────────────────────────────────────┼─────────┐
│                  EXPRESS SERVER                │         │
│  ┌────────┐ ┌────────┐ ┌────────────┐ ┌──────┴──────┐  │
│  │ Helmet │ │ CORS   │ │ Rate Limit │ │   Routes    │  │
│  └────────┘ └────────┘ └────────────┘ └──────┬──────┘  │
│                                               │         │
│  ┌──────────────┐    ┌───────────────────┐    │         │
│  │ JWT Auth MW  │────│   Controllers     │────┘         │
│  └──────────────┘    └────────┬──────────┘              │
│                               │                         │
│                      ┌────────┴──────────┐              │
│                      │   MySQL Pool      │              │
│                      └────────┬──────────┘              │
└───────────────────────────────┼─────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    │     MySQL 8.4         │
                    │  ┌──────┐ ┌────────┐  │
                    │  │users │ │schools │  │
                    │  │errors│ │checkins│  │
                    │  │guides│ │manuals │  │
                    │  └──────┘ └────────┘  │
                    └───────────────────────┘
```

### Directory Structure

```
Troubleshooting System/
├── backend/
│   ├── package.json
│   ├── .env
│   └── src/
│       ├── server.js              # Express entry point
│       ├── config/
│       │   ├── database.js        # MySQL connection pool
│       │   ├── migrate.js         # Schema creation script
│       │   └── seed.js            # Sample data seeder
│       ├── controllers/
│       │   ├── authController.js
│       │   ├── dashboardController.js
│       │   ├── errorController.js
│       │   ├── schoolController.js
│       │   ├── checkinController.js
│       │   ├── teamController.js
│       │   ├── guideController.js
│       │   ├── manualController.js
│       │   └── communicationController.js
│       ├── middleware/
│       │   ├── auth.js            # JWT verification + role guard
│       │   ├── errorHandler.js    # Global error handler
│       │   └── validate.js        # express-validator result checker
│       ├── routes/
│       │   ├── auth.js
│       │   ├── dashboard.js
│       │   ├── errors.js
│       │   ├── schools.js
│       │   ├── team.js
│       │   ├── checkins.js
│       │   ├── guides.js
│       │   ├── manuals.js
│       │   └── communications.js
│       └── docs/
│           ├── API.md
│           ├── SETUP.md
│           └── DATABASE.md
├── frontend/
│   ├── index.html                 # SPA shell
│   ├── css/
│   │   ├── variables.css          # Design tokens
│   │   ├── base.css               # Layout, grid, responsive
│   │   └── components.css         # All UI components
│   └── js/
│       ├── api.js                 # HTTP client + token management
│       ├── utils.js               # Helpers, constants, formatters
│       ├── auth.js                # Login/logout/session
│       ├── router.js              # SPA navigation
│       ├── app.js                 # Main controller
│       ├── components/
│       │   └── modal.js
│       └── pages/
│           ├── dashboard.js
│           ├── report.js
│           ├── tracker.js
│           ├── schools.js
│           ├── team.js
│           └── guides.js
└── docs/
    └── SYSTEM_DOCUMENTATION.md    # This file
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Runtime | Node.js 20+ | Server runtime |
| Framework | Express 4.x | HTTP routing, middleware |
| Database | MySQL 8.4 | Relational data storage |
| Driver | mysql2/promise | Async MySQL connection pooling |
| Auth | jsonwebtoken + bcryptjs | Stateless JWT authentication |
| Security | helmet, cors, express-rate-limit | HTTP hardening |
| Uploads | multer | File upload handling |
| Validation | express-validator | Input validation |
| Frontend | Vanilla JS (ES6+) | No framework dependency |
| Styling | Custom CSS with CSS Variables | Dark theme, responsive |
| Icons | Tabler Icons (webfont) | UI iconography |
| Fonts | DM Sans + DM Mono | Typography |

---

## 3. Features

### 3.1 Dashboard

The main overview page shows at a glance:

- **Open error count** with critical alert prominence
- **In-progress errors** being actively worked on
- **Resolved in last 24h** — daily throughput metric
- **School health ratio** — healthy vs. needing attention
- **Weekly check-in progress** — done / total
- **Category breakdown** — visual proportions of issue types
- **Active priorities table** — top 6 open errors sorted by severity

The dashboard is **role-scoped**: sub-admins see only their assigned schools' data.

### 3.2 Error Reporting

Users can submit new errors with:

- **Title** — short description of the problem
- **School** — dropdown of all schools (filtered by role)
- **Category** — Network, Hardware, Software, Power, Platform, LRS, Other
- **Subcategory** — dynamic based on category (e.g., Network → Router, Switch, Cabling)
- **Priority** — Critical, High, Medium, Low
- **Reporter details** — name, role, contact
- **Location / affected devices** — specifics for field resolution

Auto-generates a sequential error code (QFT-0243, QFT-0244, etc.) and auto-assigns to the school's designated sub-admin.

### 3.3 Error Tracker

Full filterable list of all errors with:

- **Status filter** — All, Open, In Progress, Escalated, Resolved
- **Search** — by title, error code, or school name
- **Click-to-detail** — modal with full error info, updates timeline
- **Resolve action** — mark errors as resolved directly

### 3.4 School Profiles

Card grid of all schools showing:

- School name, code, zone
- Assigned sub-admin
- Open error count (color-coded)
- Click into detail: infrastructure (tablets, routers, LRS IP), contact info, error history, communication log, check-in history

### 3.5 Troubleshooting Guides

Step-by-step resolution guides for common issues:

- Split view: guide list (left) + steps (right)
- Categorized by issue type (Network, Hardware, Software, etc.)
- Custom guides can be created by admins
- "Still broken? Report it" button for escalation

### 3.6 Sub-Admin Management (Admin only)

- Card view of all field engineers
- Stats: assigned school count, open error count
- Contact details, zone assignment
- Create/edit/remove sub-admins
- Assign/reassign schools to engineers

### 3.7 Weekly Check-Ins

Structured weekly monitoring of school health:

- Status indicators: Connectivity, Tablets, Platform, Power
- Per-school, per-week tracking
- Stats: done this week, due, overdue
- Historical trend per school

### 3.8 Communications Log

Timestamped notes for school interactions:

- Logged per school
- Supports: calls, visits, WhatsApp, emails
- Visible in school detail view

### 3.9 Manual Uploads

Document management for procedures:

- File upload with categories
- Download by ID
- Supports PDF, DOCX, images

---

## 4. Database Schema

### Entity-Relationship Diagram

```
┌──────────┐       ┌───────────┐       ┌──────────────┐
│  users   │───────│  schools  │───────│   errors     │
│          │ 1   N │           │ 1   N │              │
│ id       │       │ id        │       │ id           │
│ username │       │ code      │       │ error_code   │
│ email    │       │ name      │       │ title        │
│ role     │       │ zone      │       │ status       │
│ ...      │       │ ...       │       │ priority     │
└────┬─────┘       └─────┬─────┘       │ school_id FK │
     │                    │             │ assigned_to  │
     │                    │             └──────┬───────┘
     │                    │                    │
     │              ┌─────┴──────┐      ┌──────┴───────┐
     │              │weekly_     │      │error_updates │
     │              │checkins    │      │              │
     │              │            │      │ error_id FK  │
     │              │ school_id  │      │ note         │
     │              │ week_number│      │ recorded_by  │
     │              └────────────┘      └──────────────┘
     │
     │         ┌────────────────┐    ┌──────────────────┐
     └─────────│communications  │    │troubleshooting_  │
               │                │    │guides            │
               │ school_id FK   │    │                  │
               │ recorded_by    │    │ title            │
               │ note           │    │ category         │
               └────────────────┘    │ steps (JSON)     │
                                     └──────────────────┘
```

### Table Definitions

#### `users`

| Column | Type | Description |
|--------|------|-------------|
| id | INT AUTO_INCREMENT | Primary key |
| username | VARCHAR(50) UNIQUE | Login identifier |
| email | VARCHAR(100) UNIQUE | Email address |
| password_hash | VARCHAR(255) | bcrypt hash |
| full_name | VARCHAR(100) | Display name |
| role | ENUM('admin','subadmin','school') | Access role |
| phone | VARCHAR(20) | Contact phone |
| zone | VARCHAR(50) | Geographic zone |
| color | VARCHAR(10) | UI avatar color |
| title | VARCHAR(100) | Job title |
| status | ENUM('active','inactive') | Account state |
| school_id | INT | FK to schools (for school role) |
| created_at | TIMESTAMP | Auto-set |

#### `schools`

| Column | Type | Description |
|--------|------|-------------|
| id | INT AUTO_INCREMENT | Primary key |
| code | VARCHAR(10) UNIQUE | School code (e.g., KBG) |
| name | VARCHAR(100) | Full school name |
| zone | VARCHAR(50) | Geographic zone |
| students | INT | Student count |
| tablets | INT | Tablet count |
| routers | INT | Router count |
| contact_name | VARCHAR(100) | School contact person |
| contact_role | VARCHAR(50) | Contact's role |
| contact_phone | VARCHAR(20) | Contact phone |
| lrs_ip | VARCHAR(45) | LRS server IP address |
| isp | VARCHAR(50) | Internet provider |
| assigned_admin_id | INT | FK to users (sub-admin) |
| created_at | TIMESTAMP | Auto-set |

#### `errors`

| Column | Type | Description |
|--------|------|-------------|
| id | INT AUTO_INCREMENT | Primary key |
| error_code | VARCHAR(20) UNIQUE | Sequential code (QFT-0XXX) |
| title | VARCHAR(255) | Error summary |
| description | TEXT | Detailed description |
| school_id | INT | FK to schools |
| category | VARCHAR(50) | Issue category |
| subcategory | VARCHAR(50) | Issue subcategory |
| priority | ENUM('critical','high','medium','low') | Severity |
| status | ENUM('open','progress','escalated','resolved') | Lifecycle state |
| assigned_to | INT | FK to users (handler) |
| reporter_name | VARCHAR(100) | Who reported |
| reporter_role | VARCHAR(50) | Reporter's role |
| reporter_contact | VARCHAR(100) | Reporter phone/email |
| location | VARCHAR(100) | Physical location detail |
| affected_devices | VARCHAR(255) | Affected hardware |
| hours_open | INT | Calculated open duration |
| resolved_at | TIMESTAMP | When resolved |
| created_at | TIMESTAMP | When reported |

#### `error_updates`

| Column | Type | Description |
|--------|------|-------------|
| id | INT AUTO_INCREMENT | Primary key |
| error_id | INT | FK to errors |
| update_type | VARCHAR(50) | Type of update |
| note | TEXT | Update content |
| recorded_by | VARCHAR(100) | Who posted |
| created_at | TIMESTAMP | Auto-set |

#### `weekly_checkins`

| Column | Type | Description |
|--------|------|-------------|
| id | INT AUTO_INCREMENT | Primary key |
| school_id | INT | FK to schools |
| week_number | INT | Week of term (1-12) |
| term | VARCHAR(30) | Term identifier |
| status | ENUM('green','amber','red') | Overall health |
| connectivity | VARCHAR(20) | Network status |
| tablets | VARCHAR(20) | Tablet status |
| platform | VARCHAR(20) | Platform status |
| power | VARCHAR(20) | Power status |
| note | TEXT | Additional notes |
| checked_by | VARCHAR(100) | Who performed check |
| created_at | TIMESTAMP | Auto-set |
| UNIQUE | (school_id, week_number, term) | One entry per school per week |

#### `communications`

| Column | Type | Description |
|--------|------|-------------|
| id | INT AUTO_INCREMENT | Primary key |
| school_id | INT | FK to schools |
| recorded_by | VARCHAR(100) | Staff name |
| note | TEXT | Communication content |
| created_at | TIMESTAMP | Auto-set |

#### `troubleshooting_guides`

| Column | Type | Description |
|--------|------|-------------|
| id | INT AUTO_INCREMENT | Primary key |
| title | VARCHAR(200) | Guide title |
| category | VARCHAR(50) | Category |
| icon | VARCHAR(50) | Tabler icon class |
| steps | JSON | Array of step strings |
| is_custom | BOOLEAN | User-created flag |
| created_by | INT | FK to users |
| created_at | TIMESTAMP | Auto-set |

#### `manuals`

| Column | Type | Description |
|--------|------|-------------|
| id | INT AUTO_INCREMENT | Primary key |
| title | VARCHAR(200) | Document title |
| original_filename | VARCHAR(255) | Upload filename |
| stored_filename | VARCHAR(255) | Server filename |
| file_type | VARCHAR(50) | MIME type |
| file_size | INT | Bytes |
| category | VARCHAR(50) | Document category |
| uploaded_by | VARCHAR(100) | Uploader name |
| created_at | TIMESTAMP | Auto-set |

---

## 5. API Reference

### Base URL

```
http://localhost:3000/api
```

### Authentication

All endpoints (except `/auth/login`) require a JWT token:

```
Authorization: Bearer <token>
```

### Endpoints Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /auth/login | No | Authenticate user |
| POST | /auth/register | Admin | Create new user |
| GET | /auth/profile | Yes | Get current user profile |
| PUT | /auth/change-password | Yes | Change password |
| GET | /dashboard | Yes | Dashboard aggregated data |
| GET | /errors | Yes | List errors (filterable) |
| GET | /errors/:id | Yes | Error detail with updates |
| GET | /errors/stats | Yes | Error statistics |
| POST | /errors | Yes | Create new error |
| PUT | /errors/:id | Yes | Update error |
| PATCH | /errors/:id/status | Yes | Change error status |
| POST | /errors/:id/updates | Yes | Add progress note |
| DELETE | /errors/:id | Admin | Delete error |
| GET | /schools | Yes | List schools |
| GET | /schools/:id | Yes | School detail |
| POST | /schools | Admin | Create school |
| PUT | /schools/:id | Admin | Update school |
| DELETE | /schools/:id | Admin | Delete school |
| PATCH | /schools/:id/assign | Admin | Reassign sub-admin |
| GET | /team | Yes | List sub-admins |
| GET | /team/:id | Yes | Sub-admin detail |
| POST | /team | Admin | Create sub-admin |
| PUT | /team/:id | Admin | Update sub-admin |
| DELETE | /team/:id | Admin | Remove sub-admin |
| PATCH | /team/:id/schools | Admin | Assign schools |
| GET | /checkins | Yes | List check-ins |
| GET | /checkins/school/:id | Yes | School check-ins |
| POST | /checkins | Yes | Create/update check-in |
| GET | /checkins/stats | Yes | Check-in statistics |
| GET | /guides | Yes | List guides |
| GET | /guides/:id | Yes | Guide detail |
| POST | /guides | Admin | Create guide |
| PUT | /guides/:id | Admin | Update guide |
| DELETE | /guides/:id | Admin | Delete guide |
| GET | /manuals | Yes | List manuals |
| POST | /manuals | Admin | Upload manual |
| GET | /manuals/:id/download | Yes | Download file |
| DELETE | /manuals/:id | Admin | Delete manual |
| GET | /communications | Yes | List communications |
| POST | /communications | Yes | Add note |
| DELETE | /communications/:id | Admin | Delete note |
| GET | /health | No | Server health check |

### Example: Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@questforward.tz",
    "full_name": "Kelvin Mwangi",
    "role": "admin",
    "phone": "+255 712 345 678",
    "zone": "All Zones",
    "color": "#4f7cff",
    "title": "Head of Technical Operations",
    "status": "active",
    "school_id": null
  }
}
```

### Example: Create Error

```bash
curl -X POST http://localhost:3000/api/errors \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Router offline at Kibeta",
    "description": "Main router not responding to pings since morning",
    "school_id": 1,
    "category": "Network",
    "subcategory": "Router",
    "priority": "high",
    "reporter_name": "John Mushi",
    "location": "Server Room"
  }'
```

Response:
```json
{
  "id": 13,
  "error_code": "QFT-0254",
  "message": "Error reported successfully."
}
```

### Query Parameters (GET /errors)

| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | Filter: open, progress, escalated, resolved, all |
| priority | string | Filter: critical, high, medium, low |
| category | string | Filter by category |
| school_id | int | Filter by school |
| search | string | Search title, code, school name |
| limit | int | Limit results |

---

## 6. Authentication & Authorization

### How It Works

1. User submits credentials to `POST /api/auth/login`
2. Server verifies password against bcrypt hash
3. Server issues a JWT token (7-day expiry)
4. Client stores token in `localStorage`
5. All subsequent requests include `Authorization: Bearer <token>`
6. Server middleware decodes token, attaches `req.user`
7. Route-level `authorize(['admin'])` restricts by role

### Token Structure

```json
{
  "id": 1,
  "role": "admin",
  "username": "admin",
  "iat": 1718000000,
  "exp": 1718604800
}
```

### Role-Based Access Control (RBAC)

```
Admin
├── Full CRUD on all resources
├── Team management
├── School management
├── Guide/manual management
└── Delete operations

Sub-Admin
├── View/edit assigned schools only
├── Create/resolve errors for assigned schools
├── Weekly check-ins for assigned schools
└── Communication logs for assigned schools

School
├── View own school profile
├── Report errors
├── View own errors
└── View guides
```

### Data Scoping

Controllers automatically filter data by role:

```javascript
if (req.user.role === 'subadmin') {
  conditions.push('s.assigned_admin_id = ?');
  params.push(req.user.id);
} else if (req.user.role === 'school') {
  conditions.push('s.id = ?');
  params.push(req.user.school_id);
}
// Admin: no filter — sees everything
```

---

## 7. Frontend Architecture

### Design Philosophy

- **Single Page Application** without a framework — pure JavaScript modules
- **Dark theme** with carefully tuned contrast ratios
- **Fixed sidebar** with premium micro-interactions
- **Sticky page headers** with scroll-reveal elevation
- **Card-based UI** with consistent spacing (8px grid)
- **Responsive** down to 360px mobile

### Module Responsibilities

| Module | Role |
|--------|------|
| `api.js` | All HTTP calls, token management, auth state |
| `utils.js` | DOM helper (`$`), XSS escaping (`esc`), formatters, constants |
| `auth.js` | Login form handling, session check, logout |
| `router.js` | Page state, nav highlighting, role visibility |
| `app.js` | Page rendering orchestrator, scroll effects |
| `modal.js` | Generic modal open/close |
| `pages/*.js` | Each page: `load()` → `render()` → `afterRender()` |

### Page Lifecycle

```
User clicks nav → Router.navigate(page) → App.loadAndRender()
                                            ├── handler.load()  [async — fetch data]
                                            └── App.render()
                                                 ├── handler.render()  [returns HTML]
                                                 ├── handler.afterRender()  [bind events]
                                                 └── initScrollReveal()
```

### Design Tokens (CSS Variables)

```css
--bg: #0f1117       /* Page background */
--bg2: #161921      /* Card/sidebar background */
--bg3: #1d2130      /* Input/nested background */
--bg4: #252a3a      /* Hover/scrollbar */
--border: rgba(255,255,255,0.08)
--text: #e8eaf2     /* Primary text */
--text2: #9ba1b5    /* Secondary text */
--text3: #636a82    /* Tertiary/label text */
--accent: #4f7cff   /* Primary action color */
--green: #2dd98a    /* Success/healthy */
--amber: #f5a623    /* Warning/in-progress */
--red: #ff5263      /* Error/critical */
```

---

## 8. Error Lifecycle & SLA

### Status Flow

```
┌──────────┐     ┌───────────┐     ┌──────────────┐     ┌──────────┐
│   OPEN   │────▶│ PROGRESS  │────▶│  ESCALATED   │────▶│ RESOLVED │
│          │     │           │     │              │     │          │
│ Created  │     │ Being     │     │ Needs higher │     │ Fixed    │
│ by user  │     │ worked on │     │ intervention │     │          │
└──────────┘     └───────────┘     └──────────────┘     └──────────┘
      │                                                       ▲
      └───────────────────────────────────────────────────────┘
                        (can resolve directly)
```

### SLA Targets

| Priority | Response Time | Resolution Target | Auto-Escalation |
|----------|--------------|-------------------|-----------------|
| Critical | Immediate | 2 hours | After 2h |
| High | 1 hour | 8 hours | After 8h |
| Medium | 4 hours | 24 hours | After 24h |
| Low | 8 hours | 72 hours | After 72h |

### SLA Breach Detection (Frontend)

```javascript
function slaState(error) {
  const hoursOpen = error.hours_open || 0;
  const limit = SLA[error.priority]; // { critical:2, high:8, medium:24, low:72 }
  if (hoursOpen >= limit) return 'breach';
  if (hoursOpen >= limit * 0.75) return 'warning';
  return 'ok';
}
```

### Error Categories

| Category | Subcategories | Icon |
|----------|--------------|------|
| Network | Router, Switch, Cabling, ISP, Firewall | ti-wifi |
| Hardware | Tablet, Charger, Screen, Battery, Storage | ti-device-tablet |
| Software | OS, App, Update, Configuration | ti-apps |
| Power | UPS, Solar, Grid, Wiring | ti-bolt |
| Platform | LRS, Content, Sync, Assessment | ti-cloud |
| LRS | Server, Database, Sync, API | ti-server |
| Other | — | ti-help |

---

## 9. Deployment Guide

### Prerequisites

- Node.js 18+
- MySQL 8.0+
- Git

### Local Development

```bash
# 1. Clone repository
git clone <repo-url>
cd "Troubleshooting System"

# 2. Install dependencies
cd backend && npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your MySQL credentials

# 4. Initialize database
node src/config/migrate.js
node src/config/seed.js

# 5. Start server
npm start
# Server runs at http://localhost:3000
```

### Environment Variables

```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=qft_support
JWT_SECRET=change_this_to_random_64_char_string
JWT_EXPIRES_IN=7d
UPLOAD_DIR=uploads
NODE_ENV=development
```

### Production Deployment (Render.com)

**This system can be deployed for free on Render:**

1. Push code to GitHub
2. Create a **MySQL database** on [PlanetScale](https://planetscale.com) or [Railway](https://railway.app) (free tier)
3. Create a **Web Service** on Render:
   - Build Command: `cd backend && npm install`
   - Start Command: `cd backend && node src/config/migrate.js && node src/server.js`
   - Set environment variables (DB_HOST, DB_USER, etc.)
4. The server serves both API and frontend (no separate frontend deploy needed)

### Production Checklist

- [ ] Change `JWT_SECRET` to a random 64+ character string
- [ ] Set `NODE_ENV=production`
- [ ] Set proper `DB_PASSWORD`
- [ ] Enable HTTPS (Render does this automatically)
- [ ] Set `FRONTEND_URL` for CORS in production
- [ ] Remove default credentials from seed data
- [ ] Set up automated database backups

---

## 10. Security

### Implemented Measures

| Measure | Implementation |
|---------|---------------|
| Password hashing | bcrypt with 10 rounds |
| JWT authentication | Stateless tokens, 7-day expiry |
| Rate limiting | 200 req/15min (general), 20 req/15min (login) |
| HTTP headers | Helmet.js (X-Frame-Options, HSTS, etc.) |
| CORS | Restricted to frontend URL in production |
| SQL injection prevention | Parameterized queries (mysql2 prepared statements) |
| XSS prevention | HTML escaping (`esc()` utility) on all dynamic content |
| Input validation | express-validator on sensitive endpoints |
| Role-based access | Middleware-enforced per route |
| Error handling | Global handler — no stack traces leaked to client |

### Security Best Practices Applied

1. **No raw SQL concatenation** — all user input passed as `?` parameters
2. **Passwords never stored or logged** — only bcrypt hashes
3. **Token invalidation** — client clears on 401 response
4. **File upload restrictions** — multer with file size limits
5. **No eval/innerHTML with user data** — all output escaped

---

## Appendix A: Default Seed Data

### Users

| Username | Password | Role | Assigned Schools |
|----------|----------|------|-----------------|
| admin | admin123 | admin | All |
| amani | admin123 | subadmin | Kibeta, Bagamoyo, Chalinze, Kilosa |
| juma | admin123 | subadmin | Dodoma Central, Kondoa, Mpwapwa |
| aisha | admin123 | subadmin | Singida, Manyoni, Iramba |
| baraka | admin123 | subadmin | Tanga, Pangani, Lushoto |

### Schools (13 total)

Kibeta, Bagamoyo, Chalinze, Kilosa, Dodoma Central, Kondoa, Mpwapwa, Singida, Manyoni, Iramba, Tanga, Pangani, Lushoto

---

## Appendix B: Error Code Format

```
QFT-0XXX
│   │
│   └── Sequential number (starts at 242)
└────── Quest Forward Tanzania prefix
```

New errors increment from the highest existing code.

---

## Appendix C: Category Metadata (Frontend)

Used for UI rendering (icons, colors, subcategory options):

```javascript
const CAT_META = {
  Network:  { ic: 'ti-wifi', color: '#4f7cff' },
  Hardware: { ic: 'ti-device-tablet', color: '#f5a623' },
  Software: { ic: 'ti-apps', color: '#9b7dff' },
  Power:    { ic: 'ti-bolt', color: '#ff5263' },
  Platform: { ic: 'ti-cloud', color: '#36d9cc' },
  LRS:      { ic: 'ti-server', color: '#2dd98a' },
  Other:    { ic: 'ti-help', color: '#636a82' }
};
```

---

*End of Documentation*
