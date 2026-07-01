# World-Class System Upgrade — Implementation Plan

## Executive Summary

This document outlines the complete architecture for upgrading the QFT Technical Support System from an admin-managed registration model to a **self-service, hierarchical, tiered support system** — modeled after enterprise platforms like ServiceNow, Zendesk, and Google Workspace Admin.

---

## 1. NEW ROLE HIERARCHY (4-Tier)

```
Platform Admin (super-admin)
    │
    ├── Reviews & approves School Admin registrations
    ├── Manages subadmins (field engineers)
    ├── Receives ESCALATED errors only (from School Admins)
    ├── System-wide analytics & branding
    │
School Admin (self-registered, approved)
    │
    ├── Generates teacher registration links
    ├── Full CRUD on teachers (add, suspend, delete, edit)
    ├── Receives error reports FROM teachers
    ├── Resolves errors OR escalates to Platform Admin
    ├── Reports own errors to Platform Admin (when stuck)
    │
Teacher (registered via school link)
    │
    ├── Reports errors to School Admin (NOT platform admin)
    ├── Views own error status
    ├── Access troubleshooting guides & AI chat
    │
Sub-Admin / Field Engineer (assigned by Platform Admin)
    │
    ├── Assigned to schools for on-ground support
    ├── Can update/resolve errors assigned to them
    └── Views assigned schools' data
```

---

## 2. FEATURE BREAKDOWN

### Feature A: School Admin Self-Registration & Approval

**Flow:**
```
1. School Admin visits registration page
2. Fills form: full name, phone, email, password, school (dropdown)
3. Submits → record created with status='pending'
4. Sees modern "Pending Approval" page with animations
5. Platform Admin sees notification badge + approval queue
6. Platform Admin reviews details → Approve or Reject
7. On Approve: School Admin page updates → "Approved! Go to Dashboard"
8. On Reject: School Admin page updates → "Rejected" + appeal form
9. Appeal form: name, email, message → stored for admin review
```

**Key Design Decisions:**
- Real-time status polling (every 10s) on pending page
- Email notification to admin on new registration
- Audit log entries for approve/reject actions
- Rejected users can appeal once

### Feature B: Teacher Registration via School Link

**Flow:**
```
1. School Admin clicks "Generate Teacher Registration Link"
2. System creates unique token-based URL (expires in 7 days)
3. School Admin shares link with teachers
4. Teacher opens link → sees registration form
5. Teacher fills: full name, phone, email, subject, password
6. Submits → record created with status='pending'
7. School Admin sees notification + approval queue
8. School Admin reviews → Approve or Reject
9. On Approve: Teacher gets access to system
10. On Reject: Teacher informed
```

**Key Design Decisions:**
- Link has school_id embedded (teachers auto-linked to that school)
- Link expires after 7 days or configurable
- Multiple teachers can use same link
- School Admin has full CRUD: add manually, suspend, reactivate, delete
- Suspended teachers can't login but data preserved

### Feature C: Tiered Error Reporting (Teacher → School Admin → Platform Admin)

**Flow:**
```
Teacher Reports Error:
  Teacher → fills error form → submitted to School Admin queue
  School Admin sees notification → reviews → resolves
  
  IF School Admin cannot resolve:
    School Admin → fills escalation form → submitted to Platform Admin
    Platform Admin sees notification → assigns to subadmin or resolves
    
  Teachers NEVER reach Platform Admin directly.
  School Admins escalate only when stuck.
```

**Key Design Decisions:**
- Error has `escalation_level`: 'school' (default) or 'platform'
- Error has `escalated_by` and `escalated_at` fields
- School Admin sees only their school's errors
- Platform Admin sees only escalated errors + their own reports
- Each level can mark as resolved independently

---

## 3. DATABASE SCHEMA CHANGES (Additive Only)

### New Table: `registration_requests`
```sql
CREATE TABLE IF NOT EXISTS registration_requests (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(200) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  password_hash VARCHAR(255) NOT NULL,
  school_id INTEGER NOT NULL REFERENCES schools(id),
  role VARCHAR(20) NOT NULL DEFAULT 'school',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, approved, rejected
  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TIMESTAMP,
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### New Table: `registration_links`
```sql
CREATE TABLE IF NOT EXISTS registration_links (
  id SERIAL PRIMARY KEY,
  school_id INTEGER NOT NULL REFERENCES schools(id),
  token VARCHAR(100) UNIQUE NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  expires_at TIMESTAMP NOT NULL,
  max_uses INTEGER DEFAULT 50,
  use_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### New Table: `registration_appeals`
```sql
CREATE TABLE IF NOT EXISTS registration_appeals (
  id SERIAL PRIMARY KEY,
  request_id INTEGER NOT NULL REFERENCES registration_requests(id),
  full_name VARCHAR(200) NOT NULL,
  email VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',  -- pending, reviewed
  created_at TIMESTAMP DEFAULT NOW()
);
```

### New Table: `teachers`
```sql
CREATE TABLE IF NOT EXISTS teachers (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE REFERENCES users(id),
  school_id INTEGER NOT NULL REFERENCES schools(id),
  subject VARCHAR(200),
  employee_id VARCHAR(50),
  status VARCHAR(20) DEFAULT 'active',  -- active, suspended, inactive
  registered_via VARCHAR(20) DEFAULT 'link',  -- link, manual
  approved_by INTEGER REFERENCES users(id),
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Modify `users` table (additive columns):
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'approved';
-- Values: 'pending', 'approved', 'rejected'
-- Existing users default to 'approved'
```

### Modify `errors` table (additive columns):
```sql
ALTER TABLE errors ADD COLUMN IF NOT EXISTS escalation_level VARCHAR(20) DEFAULT 'school';
-- Values: 'school' (seen by school admin), 'platform' (escalated to super admin)

ALTER TABLE errors ADD COLUMN IF NOT EXISTS escalated_by INTEGER REFERENCES users(id);
ALTER TABLE errors ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMP;
ALTER TABLE errors ADD COLUMN IF NOT EXISTS reported_by_user_id INTEGER REFERENCES users(id);
-- Links error to the actual teacher/school admin who reported it
```

---

## 4. NEW API ENDPOINTS

### Public Registration
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/auth/schools-list` | None | Get schools dropdown for registration |
| POST | `/api/auth/register-school-admin` | None | School admin self-registration |
| GET | `/api/auth/registration-status/:id` | Token | Check registration approval status |
| POST | `/api/auth/appeal` | None | Submit rejection appeal |

### Teacher Registration (via link)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/register/verify/:token` | None | Verify link validity, get school info |
| POST | `/api/register/teacher/:token` | None | Teacher self-registration via link |

### School Admin: Teacher Management
| Method | Path | Auth | Role |Description |
|--------|------|------|------|-------------|
| GET | `/api/teachers` | Yes | school | List teachers for my school |
| GET | `/api/teachers/:id` | Yes | school | Teacher detail |
| POST | `/api/teachers` | Yes | school | Manually add teacher |
| PUT | `/api/teachers/:id` | Yes | school | Update teacher |
| PATCH | `/api/teachers/:id/status` | Yes | school | Suspend/reactivate |
| DELETE | `/api/teachers/:id` | Yes | school | Delete teacher |
| POST | `/api/teachers/generate-link` | Yes | school | Generate registration link |
| GET | `/api/teachers/links` | Yes | school | List active links |
| DELETE | `/api/teachers/links/:id` | Yes | school | Deactivate link |

### Platform Admin: Approval Queue
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/api/approvals/pending` | Yes | admin | List pending registrations |
| GET | `/api/approvals/:id` | Yes | admin | Registration detail |
| POST | `/api/approvals/:id/approve` | Yes | admin | Approve registration |
| POST | `/api/approvals/:id/reject` | Yes | admin | Reject with reason |
| GET | `/api/approvals/appeals` | Yes | admin | List appeals |

### School Admin: Teacher Approval
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/api/teacher-approvals/pending` | Yes | school | Pending teacher registrations |
| POST | `/api/teacher-approvals/:id/approve` | Yes | school | Approve teacher |
| POST | `/api/teacher-approvals/:id/reject` | Yes | school | Reject teacher |

### Error Escalation
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| POST | `/api/errors/:id/escalate` | Yes | school | Escalate error to platform admin |

---

## 5. FRONTEND CHANGES

### New Pages
| Page | Route | Visibility | Purpose |
|------|-------|-----------|---------|
| Self-Register | `#register` | Public | School admin registration form |
| Pending Approval | `#pending` | Pending users | Waiting screen with animations |
| Appeal Form | `#appeal` | Rejected users | Appeal form after rejection |
| Teacher Register | `/register/:token` | Public | Teacher registration (direct URL) |
| Approvals | `#approvals` | Admin only | Registration approval queue |
| Teachers | `#teachers` | School admin | Teacher CRUD + links management |

### Modified Pages
| Page | Changes |
|------|---------|
| Dashboard | Add approval notification badge for admin |
| Error Tracker | Filter by escalation_level; school admins see school-level only |
| Report Error | Teachers report to school; school admins report to platform |
| Login | Add "Register as School Admin" link |

---

## 6. NOTIFICATION SYSTEM

### Events → Notifications
| Event | Who Gets Notified | Channel |
|-------|-------------------|---------|
| New school admin registration | Platform Admin | Badge + in-app |
| Registration approved | School Admin | Page update + (email) |
| Registration rejected | School Admin | Page update + (email) |
| Appeal submitted | Platform Admin | Badge |
| Teacher registered | School Admin | Badge + in-app |
| Teacher approved | Teacher | Page update |
| Error reported by teacher | School Admin | Badge + in-app |
| Error escalated to platform | Platform Admin | Badge + in-app |
| Error resolved | Reporter (teacher/school admin) | In-app |

---

## 7. SECURITY CONSIDERATIONS

1. **Rate limiting** on public endpoints (registration, appeal) — 5 req/15min
2. **Email uniqueness** enforced across registration_requests + users
3. **Password hashing** with bcrypt (cost 12) before storing
4. **Token security** for registration links — crypto.randomBytes(32)
5. **Pending users cannot login** — middleware checks approval_status
6. **CSRF protection** on public forms
7. **Input sanitization** on all text fields
8. **Expired links** auto-rejected with clear message

---

## 8. IMPLEMENTATION ORDER (Phases)

### Phase 1: Database & Schema (Day 1)
- Add new tables to schemaExtensions.js
- Add approval_status column to users
- Add escalation columns to errors
- Test migrations are idempotent

### Phase 2: School Admin Self-Registration (Day 1-2)
- Public registration API endpoint
- Registration form page (frontend)
- Pending approval page with polling
- Admin approval queue page
- Approve/reject functionality
- Appeal system

### Phase 3: Teacher Registration System (Day 2-3)
- Registration link generation
- Public teacher registration page
- School admin teacher approval queue
- Teacher CRUD management page
- Teacher role in auth middleware

### Phase 4: Tiered Error Reporting (Day 3-4)
- Add 'teacher' role to system
- Modify error creation: teacher → school admin
- Add escalation endpoint
- Modify error tracker: filter by level
- School admin escalation form

### Phase 5: Notifications & Polish (Day 4)
- In-app notification badges
- Status polling for pending pages
- Modern animations and UX
- Testing end-to-end flows

---

## 9. DATA TRANSFER OBJECTS (DTOs)

### SchoolAdminRegistrationDTO (Input)
```json
{
  "full_name": "string (required, 3-200 chars)",
  "email": "string (required, valid email, unique)",
  "phone": "string (required, valid phone)",
  "password": "string (required, min 8 chars)",
  "school_id": "integer (required, must exist in schools)",
  "title": "string (optional, e.g. 'IT Coordinator')"
}
```

### TeacherRegistrationDTO (Input)
```json
{
  "full_name": "string (required, 3-200 chars)",
  "email": "string (required, valid email, unique)",
  "phone": "string (required)",
  "password": "string (required, min 8 chars)",
  "subject": "string (optional, teaching subject)",
  "employee_id": "string (optional, school employee ID)"
}
```

### ApprovalActionDTO (Input)
```json
{
  "action": "'approve' | 'reject'",
  "reason": "string (required if reject)"
}
```

### TeacherCreateDTO (Manual Add by School Admin)
```json
{
  "full_name": "string (required)",
  "email": "string (required, unique)",
  "phone": "string (required)",
  "subject": "string (optional)",
  "employee_id": "string (optional)",
  "password": "string (optional, default generated)"
}
```

### ErrorEscalationDTO (Input)
```json
{
  "reason": "string (required, why escalating)",
  "note": "string (optional, additional context)"
}
```

### RegistrationLinkDTO (Output)
```json
{
  "id": "integer",
  "token": "string",
  "url": "string (full URL)",
  "school_name": "string",
  "expires_at": "ISO datetime",
  "max_uses": "integer",
  "use_count": "integer",
  "is_active": "boolean",
  "created_at": "ISO datetime"
}
```

### RegistrationRequestDTO (Output — Admin View)
```json
{
  "id": "integer",
  "full_name": "string",
  "email": "string",
  "phone": "string",
  "school": { "id": "integer", "name": "string", "zone": "string" },
  "status": "'pending' | 'approved' | 'rejected'",
  "created_at": "ISO datetime",
  "reviewed_by": "string | null",
  "reviewed_at": "ISO datetime | null",
  "rejection_reason": "string | null"
}
```

### AppealDTO (Input)
```json
{
  "full_name": "string (required)",
  "email": "string (required)",
  "phone": "string (optional)",
  "message": "string (required, 10-2000 chars)"
}
```

---

## 10. UI/UX DESIGN PRINCIPLES

Following **world-class** design patterns from:
- **Linear** — clean, fast, minimal
- **Notion** — approval workflows
- **Slack** — notification badges
- **ServiceNow** — tiered support escalation
- **Google Admin** — user management

### Key UX Elements:
1. **Registration form** — step indicator, inline validation, accessible
2. **Pending page** — animated illustration, status badge, auto-refresh
3. **Approval queue** — sortable table, quick-actions, detail drawer
4. **Teacher management** — searchable table, bulk actions, status chips
5. **Escalation** — one-click with required reason modal
6. **Notifications** — real-time badge count, dropdown list

---

## 11. BACKWARD COMPATIBILITY

- All existing users remain functional (approval_status defaults to 'approved')
- Existing errors remain at 'school' escalation_level
- No data loss — all changes are additive
- Existing login flow unchanged for approved users
- New middleware check is additive (checks approval_status only if column exists)
