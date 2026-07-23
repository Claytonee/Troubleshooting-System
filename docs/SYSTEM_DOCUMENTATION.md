# Quest Forward Tanzania — Technical Support System
## Complete System Documentation v3.0

*Last updated: 23 July 2026*

---

## 1. System Overview

The QFT Technical Support System is a web-based platform that enables Opportunity Education Tanzania to manage technical issues across multiple school sites. It provides real-time error tracking, team coordination, weekly health check-ins, a knowledge base, and a resource library for training materials.

### Key Capabilities
- **Error Lifecycle Management** — Report, assign, track, escalate, and resolve technical issues
- **SLA Enforcement** — Automated breach detection (Critical ≤2h, High ≤8h, Medium ≤24h, Low ≤72h)
- **Team Coordination** — Assign field engineers to schools, track workload distribution
- **Weekly Health Monitoring** — Structured weekly check-ins per school (connectivity, tablets, platform, power)
- **Knowledge Base** — Step-by-step troubleshooting guides for common problems
- **Resource Library** — Upload and share user manuals, training videos, documents (via Cloudinary CDN)
- **Tablet Inventory Management** — Full device lifecycle: register, assign to students, track status, CSV import/export, history audit trail
- **Role-Based Access** — Four-tier permissions (Platform Admin > Sub-Admin > School Admin > Teacher)
- **Teacher Self-Registration** — Link-based registration with approval workflow
- **Tiered Escalation** — Teacher → School Admin → Platform Admin escalation chain
- **Multi-View Dashboard** — Role-specific dashboards with customized data
- **Error Assignment** — Admin can assign errors to sub-admins from error detail
- **Admin Notifications** — School admin profile changes trigger admin alerts
- **School Form-Level Data** — Track students and tablets per form (Form 1-4)

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (SPA)                            │
│  Vanilla JS · Hash Routing · DM Sans + Axiforma · Tabler Icons │
│  Static files served by Express from /frontend                  │
└────────────────────────────────┬────────────────────────────────┘
                                 │ HTTP/JSON + JWT Bearer Token
┌────────────────────────────────┴────────────────────────────────┐
│                     BACKEND (Express.js)                         │
│  Node.js · JWT Auth · Role Middleware · Rate Limiting           │
│  morgan logging · helmet security · CORS                        │
└──────┬──────────────────────────────────┬───────────────────────┘
       │ pg (node-postgres)               │ cloudinary SDK
┌──────┴──────────────────┐     ┌─────────┴─────────────┐
│  Render PostgreSQL      │     │  Cloudinary CDN       │
│  (Managed DB)           │     │  (File Storage)       │
│  SSL · DATABASE_URL     │     │  Images/Video/Audio   │
└─────────────────────────┘     └───────────────────────┘
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Vanilla JavaScript (ES6+) | SPA with module pattern |
| Styling | CSS Custom Properties | Dark theme, responsive design |
| Fonts | DM Sans (body) + Axiforma (brand) | Typography system |
| Icons | Tabler Icons (CDN) | 4000+ icons via webfont |
| Backend | Node.js 18+ / Express 4 | REST API server |
| Database | **PostgreSQL** (Render Managed) | Relational data storage |
| DB Access | `pg` pool with mysql2-compat wrapper | `?`→`$n` auto-translation |
| Auth | JWT (jsonwebtoken) | Stateless authentication |
| Passwords | bcryptjs | Secure password hashing |
| Uploads | Multer + Cloudinary | Cloud file storage |
| Email | Nodemailer (optional) | Notifications (SMTP required) |
| SMS | Africa's Talking (optional) | Critical alerts |
| Hosting | Render Web Service | Auto-deploy from main branch |
| Source | GitHub + GitLab | Dual remote, push to both |

---

## 3. Database Schema

### Entity Relationship Diagram

```
users (1)──────(N) errors
  │                   │
  │                   └──(N) error_updates
  │
  ├──(N) teachers (teacher profile data)
  │
  └──(N) schools (1)──(N) errors
              │
              ├──(N) weekly_checkins
              ├──(N) communications
              ├──(N) teacher_registration_links
              ├──(N) school_forms (form-level breakdown)
              ├──(N) tablets (1)──(N) tablet_history
              └──(N) manuals (via uploaded_by)

registration_requests (pending school admin sign-ups)
admin_notifications (persistent admin alerts)
audit_log (all mutating actions)
settings (key-value store)
troubleshooting_guides (standalone)
manuals (standalone, Cloudinary URLs)
notifications (bell icon alerts)
```

### Table Definitions

#### `users`
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Unique identifier |
| username | VARCHAR(100) UNIQUE | Login name |
| email | VARCHAR(200) | Contact email |
| password_hash | VARCHAR(255) | bcrypt hash |
| full_name | VARCHAR(200) | Display name |
| role | VARCHAR(20) | admin / subadmin / school / teacher |
| phone | VARCHAR(50) | Phone number |
| zone | VARCHAR(100) | Geographic zone |
| color | VARCHAR(20) | UI avatar color |
| title | VARCHAR(100) | Job title |
| status | VARCHAR(50) DEFAULT 'active' | active / inactive |
| school_id | INT FK→schools | For school/teacher role users |
| approval_status | VARCHAR(20) DEFAULT 'approved' | pending / approved / rejected (teacher flow) |
| created_at | TIMESTAMP | Registration date |

#### `teachers`
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Unique identifier |
| user_id | INT FK→users | Linked user account |
| school_id | INT FK→schools | School the teacher belongs to |
| subjects | TEXT | Subjects taught |
| phone | VARCHAR(50) | Teacher contact |
| rejection_reason | TEXT | Reason if registration rejected |
| created_at | TIMESTAMP | Registration date |

#### `teacher_registration_links`
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Unique identifier |
| school_id | INT FK→schools | School this link is for |
| token | VARCHAR(100) UNIQUE | URL token |
| created_by | INT FK→users | School admin who generated it |
| expires_at | TIMESTAMP | Link expiry |
| max_uses | INT DEFAULT 10 | Max registrations allowed |
| use_count | INT DEFAULT 0 | Current registrations via link |
| created_at | TIMESTAMP | Creation date |

#### `schools`
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Unique identifier |
| code | VARCHAR(20) UNIQUE | Short code (e.g., KLM) |
| name | VARCHAR(200) | Full school name |
| zone | VARCHAR(100) | Geographic zone |
| students | INT DEFAULT 0 | Student count |
| tablets | INT DEFAULT 0 | Tablet count |
| routers | INT DEFAULT 0 | Router count |
| contact_name | VARCHAR(200) | Primary contact |
| contact_role | VARCHAR(200) | Contact's role |
| contact_phone | VARCHAR(50) | Contact phone |
| contact_email | VARCHAR(200) | Contact email |
| lrs_ip | VARCHAR(50) | LRS server IP |
| isp | VARCHAR(100) | Internet provider |
| assigned_admin_id | INT FK→users | Assigned sub-admin |
| created_at | TIMESTAMP | Creation date |

#### `errors`
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Unique identifier |
| error_code | VARCHAR(20) UNIQUE | Auto-generated (QFT-0###) |
| title | VARCHAR(300) | Short description |
| description | TEXT | Full details |
| school_id | INT FK→schools | Affected school |
| category | VARCHAR(100) | Connectivity/Hardware/Platform/Power/Accounts/Other |
| subcategory | VARCHAR(200) | Specific issue type |
| priority | VARCHAR(20) | critical / high / medium / low |
| status | VARCHAR(20) | open / progress / escalated / resolved |
| assigned_to | INT FK→users | Responsible engineer |
| reported_by_user_id | INT FK→users | User who reported (for teacher scoping) |
| reporter_name | VARCHAR(200) | Display name of reporter |
| reporter_role | VARCHAR(100) | Reporter's role |
| reporter_contact | VARCHAR(100) | Reporter's phone |
| location | VARCHAR(300) | Physical location |
| affected_devices | VARCHAR(200) | Device description |
| hours_open | DECIMAL(10,2) DEFAULT 0 | Auto-calculated age |
| sla_due_at | TIMESTAMP | SLA deadline (created_at + target hours) |
| first_response_at | TIMESTAMP NULL | First status change or note |
| resolved_at | TIMESTAMP NULL | Resolution timestamp |
| escalation_level | VARCHAR(20) | school / platform |
| escalated_by | INT FK→users | Who escalated |
| escalated_at | TIMESTAMP NULL | Escalation timestamp |
| csat_token | VARCHAR(64) | Feedback link token |
| csat_rating | INT | 0-5 satisfaction score |
| csat_comment | TEXT | Feedback comment |
| created_at | TIMESTAMP | Report date |

#### `error_updates`
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Unique identifier |
| error_id | INT FK→errors | Parent error |
| update_type | VARCHAR(50) | Progress Update / Escalation / Status Change |
| note | TEXT | Update content |
| recorded_by | VARCHAR(200) | Who added it |
| created_at | TIMESTAMP | When added |

#### `weekly_checkins`
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Unique identifier |
| school_id | INT FK→schools | Target school |
| week_number | INT | Week 1-12 |
| term | VARCHAR(50) | e.g., "Term 2 · 2026" |
| status | VARCHAR(10) | green / amber / red |
| connectivity | VARCHAR(20) | ok / issue / na |
| tablets | VARCHAR(20) | ok / issue / na |
| platform | VARCHAR(20) | ok / issue / na |
| power | VARCHAR(20) | ok / issue / na |
| note | TEXT | Observer notes |
| checked_by | VARCHAR(200) | Who checked |
| created_at | TIMESTAMP | Check date |
| UNIQUE | (school_id, week_number, term) | One per school per week |

#### `communications`
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Unique identifier |
| school_id | INT FK→schools | Related school |
| recorded_by | VARCHAR(200) | Author |
| note | TEXT | Message content |
| created_at | TIMESTAMP | When recorded |

#### `manuals`
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Unique identifier |
| title | VARCHAR(300) | Display title |
| original_filename | VARCHAR(300) | Upload filename |
| stored_filename | VARCHAR(500) | Cloudinary CDN URL |
| file_type | VARCHAR(100) | MIME type |
| file_size | INT DEFAULT 0 | Bytes |
| category | VARCHAR(100) | General/User Guide/Training/Technical/Policy/Other |
| uploaded_by | VARCHAR(200) | Who uploaded |
| created_at | TIMESTAMP | Upload date |

#### `troubleshooting_guides` (aliased as `guides`)
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Unique identifier |
| title | VARCHAR(300) | Guide title |
| category | VARCHAR(100) | Issue category |
| icon | VARCHAR(50) | Tabler icon name |
| steps | JSON | Array of step strings |
| is_custom | SMALLINT DEFAULT 0 | Custom vs built-in |
| created_by | VARCHAR(200) | Author |
| created_at | TIMESTAMP | Creation date |
| updated_at | TIMESTAMP | Last edit |

#### `audit_log`
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Unique identifier |
| actor_id | INT | User who performed action |
| actor_name | VARCHAR(200) | Display name |
| actor_role | VARCHAR(50) | Role at time of action |
| action | VARCHAR(100) | Action identifier (e.g. error.created) |
| entity_type | VARCHAR(50) | Target type (error, school, user...) |
| entity_id | INT | Target record ID |
| summary | TEXT | Human-readable description |
| meta | JSON | Additional structured data |
| ip | VARCHAR(100) | Client IP address |
| created_at | TIMESTAMP | When it happened |

#### `notifications`
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Unique identifier |
| user_id | INT FK→users | Recipient |
| type | VARCHAR(50) | Notification type |
| title | VARCHAR(300) | Short title |
| body | TEXT | Full message |
| link | VARCHAR(300) | Navigation target |
| read | BOOLEAN DEFAULT false | Read status |
| created_at | TIMESTAMP | When created |

#### `settings`
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | — |
| setting_key | VARCHAR(100) UNIQUE | Key name |
| setting_value | TEXT | Value |

#### `registration_requests`
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Unique identifier |
| email | VARCHAR(200) | Applicant email |
| full_name | VARCHAR(200) | Applicant name |
| school_name | VARCHAR(200) | Requested school |
| password_hash | VARCHAR(255) | bcrypt hash |
| status | VARCHAR(20) | pending / approved / rejected |
| rejection_reason | TEXT | Reason if rejected |
| created_at | TIMESTAMP | Submission date |

#### `tablets`
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Unique identifier |
| school_id | INT FK→schools | Owning school |
| serial_number | VARCHAR(100) | Device serial (unique per school) |
| asset_tag | VARCHAR(50) | Human-readable tag (e.g., MTK-T-001) |
| form | VARCHAR(20) | Form 1 / Form 2 / Form 3 / Form 4 |
| stream | VARCHAR(10) | A / B / C |
| model | VARCHAR(200) | Device model (e.g., Amazon Fire HD 10) |
| year_first_used | INT | Year device entered service |
| status | VARCHAR(20) | Working / Needs Setup / In Repair / Faulty / Lost/Missing |
| student_name | VARCHAR(200) | Assigned student |
| admission_no | VARCHAR(100) | Student admission number |
| last_checked | DATE | Last physical check date |
| notes | TEXT | Free-text notes |
| assigned_at | TIMESTAMP | When student was assigned |
| created_at | TIMESTAMP | Record creation |
| updated_at | TIMESTAMP | Last modification |
| UNIQUE | (school_id, serial_number) | No duplicate serials within school |

#### `tablet_history`
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Unique identifier |
| tablet_id | INT FK→tablets | Parent device |
| action | VARCHAR(50) | created / status_change / assigned |
| old_value | VARCHAR(200) | Previous state |
| new_value | VARCHAR(200) | New state |
| actor_name | VARCHAR(200) | Who performed the action |
| note | TEXT | Context/reason |
| created_at | TIMESTAMP | When it happened |

#### `school_forms`
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Unique identifier |
| school_id | INT FK→schools | Parent school |
| form_name | VARCHAR(50) | Form 1 / Form 2 / Form 3 / Form 4 |
| students | INT DEFAULT 0 | Number of students in form |
| tablets | INT DEFAULT 0 | Number of tablets for form |
| UNIQUE | (school_id, form_name) | One entry per form per school |

#### `admin_notifications`
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL PK | Unique identifier |
| target_role | VARCHAR(20) | Recipient role (default 'admin') |
| type | VARCHAR(50) | Notification type (e.g., school_contact_update) |
| title | VARCHAR(300) | Short title |
| message | TEXT | Full message body |
| meta | JSONB | Structured metadata |
| is_read | BOOLEAN DEFAULT false | Read/unread state |
| created_at | TIMESTAMP | When created |

---

## 4. API Reference

### Authentication
All endpoints except `/api/auth/login`, `/api/settings`, `/api/health`, and registration endpoints require:
```
Authorization: Bearer <jwt_token>
```

### Endpoints

#### Auth (`/api/auth`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| POST | /login | No | — | Login → token + user (includes school_name) |
| POST | /register | Yes | admin | Create user account |
| GET | /profile | Yes | any | Get current user profile |
| PUT | /change-password | Yes | any | Update password |

#### Dashboard (`/api/dashboard`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | / | Yes | any | Role-filtered KPIs (returns `type:'teacher'` for teachers) |

#### Schools (`/api/schools`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | / | Yes | staff | List schools (blocked for teachers) |
| GET | /:id | Yes | staff | School detail + history |
| POST | / | Yes | admin | Create school |
| PUT | /:id | Yes | admin | Update school |
| PATCH | /:id/assign | Yes | admin | Reassign sub-admin |
| DELETE | /:id | Yes | admin | Delete (cascading) |

#### Errors (`/api/errors`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | / | Yes | any | List errors (teachers see own only) |
| GET | /stats | Yes | any | Statistics (scoped by role) |
| GET | /export | Yes | admin/subadmin | CSV export |
| GET | /:id | Yes | any | Detail + updates (teachers: own only) |
| POST | / | Yes | any | Report new error |
| PUT | /:id | Yes | admin/subadmin | Update all fields |
| PATCH | /:id/status | Yes | any | Change status (scoped) |
| POST | /:id/updates | Yes | any | Add progress note (scoped) |
| POST | /:id/escalate | Yes | school/teacher | Tiered escalation |
| POST | /csat/:token | No | — | Submit satisfaction rating |
| DELETE | /:id | Yes | admin | Delete error |

#### Team (`/api/team`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | / | Yes | any | List sub-admins |
| GET | /:id | Yes | any | Sub-admin detail |
| POST | / | Yes | admin | Create sub-admin |
| PUT | /:id | Yes | admin | Update profile |
| DELETE | /:id | Yes | admin | Remove |

#### Check-Ins (`/api/checkins`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | / | Yes | staff | List (blocked for teachers) |
| GET | /stats | Yes | staff | Completion statistics |
| GET | /school/:schoolId | Yes | staff | All checkins for school |
| POST | / | Yes | staff | Create/upsert checkin |

#### Communications (`/api/communications`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | / | Yes | staff | List notes (blocked for teachers) |
| POST | / | Yes | staff | Add note |
| DELETE | /:id | Yes | admin/subadmin | Remove note |

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
| POST | /link | Yes | admin | Add webpage/URL resource |
| DELETE | /:id | Yes | admin | Delete file + CDN cleanup |

#### Registration (`/api/registration`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | /link/:token | No | — | Validate teacher registration link |
| POST | /teacher | No | — | Submit teacher registration |
| GET | /teacher/status/:userId | No | — | Poll teacher approval status |
| GET | /pending | Yes | school | List pending teacher registrations |
| POST | /approve/:id | Yes | school | Approve teacher |
| POST | /reject/:id | Yes | school | Reject teacher |
| POST | /generate-link | Yes | school | Generate teacher registration link |
| GET | /links | Yes | school | List registration links |
| DELETE | /teacher/:id | Yes | school | Delete/deactivate teacher |

#### Tablet Inventory (`/api/inventory`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | / | Yes | any | List devices (school role scoped to own school; supports ?status, ?form, ?search, ?school_id) |
| GET | /stats | Yes | any | Summary stats: total, working, faulty, in_repair, lost, assigned, by_form |
| GET | /export | Yes | any | Download CSV export of all devices |
| GET | /:id | Yes | any | Device detail + full history log |
| POST | / | Yes | any | Add single device (serial_number required) |
| PUT | /:id | Yes | any | Update device fields; auto-logs status/assignment changes |
| PATCH | /:id/assign | Yes | any | Assign/unassign student to device |
| PATCH | /:id/status | Yes | any | Change device status with optional note |
| POST | /bulk-import | Yes | admin/subadmin/school | Import array of devices (upsert by serial_number) |
| DELETE | /:id | Yes | admin/subadmin | Remove device from inventory |

#### Settings (`/api/settings`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | / | No | — | Get all settings (branding) |
| PUT | / | Yes | admin | Update settings |

#### Approvals (`/api/approvals`) — School Admin Registration
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | / | Yes | admin | List pending requests |
| POST | /:id/approve | Yes | admin | Approve school admin |
| POST | /:id/reject | Yes | admin | Reject school admin |

#### Audit (`/api/audit`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | / | Yes | admin | List audit entries |

#### Notifications (`/api/notifications`)
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | / | Yes | any | Get user's notifications |
| PATCH | /:id/read | Yes | any | Mark as read |
| POST | /read-all | Yes | any | Mark all as read |

#### Health
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/health | No | System status check |

---

## 5. SLA System

### Targets
| Priority | Max Resolution Time | SLA Due Calculation |
|----------|--------------------|--------------------|
| Critical | 2 hours | `created_at + INTERVAL 2 hours` |
| High | 8 hours | `created_at + INTERVAL 8 hours` |
| Medium | 24 hours | `created_at + INTERVAL 24 hours` |
| Low | 72 hours | `created_at + INTERVAL 72 hours` |

### Breach Detection
The `sla_due_at` column stores the absolute deadline. At query time, `sla_due_at < NOW()` flags breaches:
- Red dot + "SLA Breach" badge in error lists
- Red border on follow-up cards
- Alert banner on dashboard (for critical errors)
- Notification dot on topbar bell icon
- CSV export includes breach column

### First Response Tracking
- `first_response_at` is set when error first moves off "open" status or first note is added
- Used for analytics (response time vs resolution time)

---

## 6. Role-Based Access Control

### Role Hierarchy (4 Tiers)
```
┌─────────────────────────────────────────────────────────────────┐
│ PLATFORM ADMIN (System Administrator)                            │
│ ✓ All operations                                                 │
│ ✓ Manage team, schools, settings, branding                      │
│ ✓ Upload manuals, create guides                                 │
│ ✓ View analytics, audit log                                     │
│ ✓ Approve/reject school admin registrations                     │
│ ✓ Switch view to any sub-admin perspective                      │
├─────────────────────────────────────────────────────────────────┤
│ SUB-ADMIN (Field Engineer)                                       │
│ ✓ View/update assigned schools only                             │
│ ✓ Report and resolve errors                                     │
│ ✓ Record weekly check-ins                                       │
│ ✓ Add communication notes                                       │
│ ✓ Export error data                                             │
│ ✗ Cannot manage team or settings                                │
├─────────────────────────────────────────────────────────────────┤
│ SCHOOL ADMIN (School Staff)                                      │
│ ✓ View own school data only                                     │
│ ✓ Report errors for own school                                  │
│ ✓ Escalate errors to platform admin                             │
│ ✓ Record weekly check-ins for own school                        │
│ ✓ Manage teachers (registration links, approve/reject)          │
│ ✓ View guides and manuals                                       │
│ ✗ Cannot see other schools                                      │
├─────────────────────────────────────────────────────────────────┤
│ TEACHER                                                          │
│ ✓ View own dashboard (personal error stats)                     │
│ ✓ Report errors for own school                                  │
│ ✓ View own reported errors only                                 │
│ ✓ Escalate own errors to school admin                           │
│ ✓ View troubleshooting guides                                   │
│ ✓ View resource library                                         │
│ ✗ Cannot see Error Tracker, Follow-Up, Weekly Check-Ins         │
│ ✗ Cannot see School Profiles or other schools' data             │
│ ✗ Cannot see communications or other users' errors              │
└─────────────────────────────────────────────────────────────────┘
```

### Enforcement Points
1. **Backend route guards** — `authorize('admin', 'subadmin', 'school')` middleware blocks teachers from staff-only routes
2. **Backend query scoping** — Teachers' error queries filter by `reported_by_user_id`
3. **Frontend sidebar** — `data-role` attributes hide nav items (`staff`, `admin`, `school`, `school-teacher`)
4. **Frontend router** — `applyRoleVisibility()` redirects unauthorized page attempts to dashboard

### Tiered Escalation
```
Teacher reports error
  → Escalation goes to: School Admin level
    → School Admin escalates to: Platform Admin level
```

---

## 7. Teacher Registration Flow

### Link-Based Registration
```
1. School Admin generates registration link (token + expiry + max uses)
2. Teacher opens link in browser → /register/teacher/:token
3. System validates token (not expired, under max uses)
4. Teacher fills form: name, email, password, phone, subjects
5. System creates user (approval_status='pending') + teacher record
6. Teacher sees "Pending Approval" page with animated ring + polling
7. School Admin sees pending teacher in "Teachers" tab
8. School Admin approves or rejects (with reason)
9. Teacher's polling detects status change → shows approved/rejected page
10. If approved: teacher can login and access their dashboard
```

### Re-Registration
- Rejected or deleted teachers can re-register using the same email
- System detects existing inactive/rejected user record and resets it

---

## 8. File Upload System (Cloudinary)

### Why Cloudinary
Render's hosting has no persistent disk — files are deleted on every deploy/restart. Cloudinary provides cloud storage with global CDN delivery.

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
- **PDF:** Inline `<iframe>` with PDF viewer
- **Office docs:** Microsoft Office Online viewer (embed URL)
- **Text:** Sandboxed `<iframe>` for plain text/HTML
- **URLs:** Embedded webpage `<iframe>` with fallback notice

### Limits
- Max file size: 100MB (configurable via `MAX_FILE_SIZE` env var)
- Cloudinary free tier: 25 credits/month

---

## 9. Frontend Architecture

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
    → applyRoleVisibility()  // enforce access
    → handler.load()          // async data fetch
    → handler.render()        // returns HTML string
    → main.innerHTML = html
    → initScrollReveal()      // animate cards
```

### File Structure
```
frontend/
├── index.html          # SPA shell (login + app container)
├── fonts/
│   └── axiforma.woff2  # Brand font for "Opportunity Education Tanzania"
├── css/
│   ├── variables.css   # CSS custom properties (colors, fonts, Axiforma @font-face)
│   ├── base.css        # Layout, scrollbar, responsive, animations
│   └── components.css  # Cards, buttons, forms, tables, badges, dropdowns
└── js/
    ├── api.js          # HTTP client (fetch wrapper + JWT)
    ├── utils.js        # Helpers (esc, ageStr, PRI, STAT, CAT_META, Dropdown)
    ├── auth.js         # Login, logout, profile, role-switch
    ├── router.js       # Hash-based routing + role enforcement
    ├── app.js          # Main controller + ErrorDetailModal
    ├── components/
    │   └── modal.js    # Reusable modal (open, close, init)
    └── pages/
        ├── dashboard.js      # KPIs (role-specific: staff vs teacher)
        ├── report.js         # Error submission form
        ├── tracker.js        # Error list with filters (staff only)
        ├── followup.js       # SLA breaches, team, comms (staff only)
        ├── weekly.js         # Week tabs, school check-in (staff only)
        ├── schools.js        # School grid + detail view (staff only)
        ├── guides.js         # Troubleshooting knowledge base
        ├── manuals.js        # Resource library (upload/preview/download)
        ├── analytics.js      # Charts, trends, SLA compliance (admin only)
        ├── schoolAdmins.js   # School Admin management (admin only)
        ├── branding.js       # System appearance settings (admin only)
        ├── audit.js          # Audit log viewer (admin only)
        ├── approvals.js      # School admin registration approvals (admin only)
        ├── teachers.js       # Teacher management (school admin only)
        ├── inventory.js      # Tablet inventory management (all roles)
        ├── chat.js           # AI help assistant
        ├── help.js           # Help & support page (school only)
        ├── search.js         # Global search
        ├── register.js       # School admin self-registration
        └── teacherRegister.js # Teacher self-registration
```

### Custom Dropdown Component (System-Wide)

**Rule: No native `<select>` elements anywhere in the system.**

All dropdowns use the shared `Dropdown` utility (`utils.js`):

```javascript
// Render a dropdown
Dropdown.render(id, placeholder, items, { defaultValue, onSelect })

// Get selected value
Dropdown.getValue(id)

// Update options dynamically
Dropdown.updateItems(id, newItems)
```

CSS classes: `.reg-select`, `.reg-dropdown`, `.reg-dropdown-search`, `.reg-dropdown-list`, `.reg-dropdown-item`

Positioning: side-right (preferred if 290px+ space) → below → above (fallback)

Features: searchable, dark theme consistent, click-outside-close, keyboard accessible search

---

## 10. UI Design System

### Typography
| Element | Font | Size | Weight |
|---------|------|------|--------|
| Brand text ("Opportunity Education Tanzania") | Axiforma | varies | 600 |
| Page titles | DM Sans | 18px | 600 |
| Card titles | DM Sans | 13px uppercase | 600 |
| Stat values | DM Sans | 28px | 600 |
| Body text | DM Sans | 13-14px | 400 |
| Labels | DM Sans | 11-12px | 400 |
| Code/IDs | DM Mono | 11px | 400 |

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

### Layout (Fixed Shell)
- **Topbar:** `position: fixed; top: 0;` — always visible
- **Sidebar:** `position: fixed; top: 56px; bottom: 0;`
- **Main content:** `margin-top: 56px; height: calc(100vh - 56px); overflow-y: auto;`
- **Document:** `html, body { overflow: hidden; }` — no body scroll ever

### OE Branding Pattern
- Standalone pages (login, register): OE icon in header + OE logo in footer
- Animated ring: ONLY on waiting/pending approval states
- "Opportunity Education Tanzania" text: ALWAYS uses Axiforma font (`.font-brand`)

---

## 11. Deployment

### Prerequisites
- Node.js 18+
- PostgreSQL database (Render Managed recommended)
- Cloudinary account (free)
- Render account
- Git with GitHub + GitLab remotes

### Environment Variables
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| DATABASE_URL | Yes | — | PostgreSQL connection string |
| DB_SSL | No | false | Enable SSL for DB connection |
| JWT_SECRET | Yes | — | Token signing key |
| JWT_EXPIRES_IN | No | 7d | Token lifetime |
| NODE_ENV | No | development | Environment mode |
| PORT | No | 3000 | Server port |
| CLOUDINARY_CLOUD_NAME | Yes (prod) | — | Cloudinary cloud name |
| CLOUDINARY_API_KEY | Yes (prod) | — | Cloudinary API key |
| CLOUDINARY_API_SECRET | Yes (prod) | — | Cloudinary API secret |
| MAX_FILE_SIZE | No | 104857600 | Max upload bytes (100MB) |
| SMTP_HOST | No | — | Email server host |
| SMTP_PORT | No | 587 | Email server port |
| SMTP_USER | No | — | Email username |
| SMTP_PASS | No | — | Email password |
| AT_API_KEY | No | — | Africa's Talking API key |
| AT_USERNAME | No | — | Africa's Talking username |

### Deploy Steps
1. Push to both remotes: `git push origin main && git push gitlab main`
2. Render auto-deploys from main branch
3. On first start, `bootstrap.js` creates all tables + seeds demo data
4. `schemaExtensions.js` applies additive migrations on every startup
5. Default login: `admin` / `admin123`

### Database Migrations
- **Additive only** — never drop/rename columns in-place
- `bootstrap.js` — creates base tables (IF NOT EXISTS), seeds when empty
- `schemaExtensions.js` — adds new columns/tables with `ADD COLUMN IF NOT EXISTS`
- Safe to re-run on every startup (idempotent)

---

## 12. Security Measures

| Measure | Implementation |
|---------|---------------|
| Password hashing | bcryptjs (10 salt rounds) |
| Authentication | JWT in Authorization header (7d expiry) |
| Rate limiting | 20 login/15min, 200 API/15min |
| CORS | Restricted origins |
| HTTP headers | helmet middleware |
| Input validation | express-validator schemas |
| SQL injection | Parameterized queries (pg pool) |
| XSS prevention | HTML escaping (frontend `esc()` helper) |
| File validation | Extension whitelist + multer fileFilter |
| SSL/TLS | Database connection via `DATABASE_URL` with SSL |
| Role enforcement | Backend `authorize()` middleware on every route |
| Data scoping | Query-level filtering by role (teachers see own errors only) |
| Audit trail | All mutating actions logged with actor, IP, timestamp |
| Account states | approval_status blocks pending/rejected users at login |

---

## 13. Demo Data (Auto-Seeded)

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

### Errors, Check-ins, Communications
Sample data seeded to demonstrate system capabilities.

---

## 14. Pages & Features

| # | Page | Route | Role Access | Description |
|---|------|-------|-------------|-------------|
| 1 | Dashboard | #dashboard | All (role-specific) | KPIs, alerts, priorities (teachers: own stats) |
| 2 | Report Error | #report | school + teacher | Submit new error with auto-routing |
| 3 | Error Tracker | #tracker | staff only | Filterable table of all errors |
| 4 | Follow-Up Center | #followup | staff only | SLA breaches, escalations, comms |
| 5 | Weekly Check-Ins | #weekly | staff only | School health monitoring |
| 6 | School Profiles | #schools | staff only | School grid + detail view |
| 7 | Troubleshooting | #troubleshoot | All | Step-by-step guides |
| 8 | Resource Library | #manuals | All | Upload/preview/download |
| 9 | Analytics | #analytics | admin only | SLA compliance, trends |
| 10 | School Admins | #schooladmins | admin only | Manage school admin accounts |
| 11 | Branding | #branding | admin only | Customize system appearance |
| 12 | Audit Log | #audit | admin only | Activity history |
| 13 | Approvals | #approvals | admin only | School admin registration |
| 14 | Teachers | #teachers | school only | Teacher management + links |
| 15 | Help | #help | school only | Support & documentation |
| 16 | Tablet Inventory | #inventory | All | Device management, status tracking, CSV import/export |

*"staff" = admin + subadmin + school (NOT teacher)*

---

## 15. Tablet Inventory Management Module

### Overview
A complete device lifecycle management system for school tablets. Tracks every device from registration through assignment, maintenance, and retirement.

### Device Statuses
| Status | Color | Meaning |
|--------|-------|---------|
| Working | Green | Fully operational, in use |
| Needs Setup | Amber | Awaiting initial configuration |
| In Repair | Amber | Under maintenance |
| Faulty | Red | Defective, needs replacement |
| Lost/Missing | Purple | Cannot be located |

### Features

#### Stats Dashboard
Five stat cards showing real-time fleet health:
- Working count + fleet health percentage
- Faulty, In Repair, Lost/Missing counts
- Assigned vs total ratio

#### Device Table
- Sortable by asset tag
- Filterable by: school (admin), status, form, free-text search
- Columns: Asset Tag, Serial, Model, Form, Status, Student, Last Checked
- Click row for full device detail

#### Device Detail Modal
- Info table with all fields (colored icons per field type)
- Full history timeline (created, status changes, assignments)
- Quick actions: Edit, Change Status

#### Add/Edit Device
- 2-column grid form (600px wide modal)
- Fields: serial (required), asset tag, model, year, form, stream, status, last checked
- Student assignment section: name + admission number
- Notes textarea

#### CSV Bulk Import
- Upload CSV file with auto-column mapping
- Smart header matching (e.g., "Serial" matches serial_number)
- Preview before import (first 10 rows shown)
- Upsert logic: existing serials updated, new ones created
- Template download button

#### CSV Export
- Downloads all devices (filtered by current school if applicable)
- Headers: serial_number, asset_tag, form, stream, model, year_first_used, status, student_name, admission_no, last_checked, notes

#### History / Audit Trail
Every device change is logged in `tablet_history`:
- Device creation
- Status changes (with optional note/reason)
- Student assignment changes
- Actor name + timestamp on every entry

### Access Control
| Role | Can Do |
|------|--------|
| Admin | View all schools, CRUD any device, delete, bulk import |
| Sub-Admin | View assigned schools, CRUD, delete, bulk import |
| School Admin | View own school only, CRUD, bulk import |
| Teacher | View own school only (read-only planned) |

### File Structure
```
backend/
  src/controllers/inventoryController.js  — CRUD, stats, bulk import, export
  src/routes/inventory.js                 — 10 REST endpoints
  src/config/schemaExtensions.js          — tablets + tablet_history DDL
frontend/
  js/pages/inventory.js                   — Full page with modals
```

---

## 16. Recent Features (July 2026)

### Error Assignment (Admin → Sub-Admin)
- Admin can assign any error to a sub-admin from the error detail modal
- Auto-moves status from "open" → "progress" on assignment
- Adds audit trail entry and update note

### School Profile Enhancements
- **Form-level breakdown:** Track students + tablets per Form 1-4
- **CSV bulk import:** Import schools from CSV file
- **School admin self-edit:** School role can edit own profile (phone, email, contact)
- **Admin notifications:** Contact changes by school admins trigger admin alerts
- **Compact sticky header:** School profile detail has fixed hero card

### Resource Library — Open in New Tab
- Cloudinary raw resources (PDF, DOCX) now open inline via blob URL
- Previously forced download due to Cloudinary Content-Disposition headers

### User Guide — In-Place Navigation
- Sidebar sections swap content without full page re-render
- Cards use afterRender() pattern to force scroll-reveal visibility
