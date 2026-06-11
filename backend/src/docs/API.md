# Quest Forward Tanzania — Technical Support System API

## Base URL
```
http://localhost:3000/api
```

## Authentication

All API endpoints (except login and health check) require a JWT Bearer token.

### Headers
```
Authorization: Bearer <your_jwt_token>
Content-Type: application/json
```

---

## Endpoints

### Auth

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/auth/login` | Login and get JWT token | Public |
| POST | `/auth/register` | Register new user | Admin only |
| GET | `/auth/profile` | Get current user profile | Authenticated |
| PUT | `/auth/change-password` | Change password | Authenticated |

#### POST /auth/login
```json
{
  "username": "admin",
  "password": "admin123"
}
```
**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@questforward.org",
    "full_name": "System Administrator",
    "role": "admin",
    "phone": "+255 658 000 000",
    "zone": "HQ",
    "color": "#4f7cff",
    "title": "System Admin",
    "status": "active"
  }
}
```

#### POST /auth/register (Admin only)
```json
{
  "username": "newuser",
  "email": "newuser@questforward.org",
  "password": "securepassword",
  "full_name": "New User",
  "role": "subadmin",
  "phone": "+255 700 000 000",
  "zone": "Moshi",
  "title": "Field Engineer"
}
```

---

### Dashboard

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/dashboard` | Get dashboard overview stats | Authenticated |

Returns role-scoped data (admin sees all, subadmin sees their schools, school sees own).

---

### Schools

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/schools` | List all schools (role-scoped) | Authenticated |
| GET | `/schools/:id` | Get school detail with errors, checkins, comms | Authenticated |
| POST | `/schools` | Create new school | Admin |
| PUT | `/schools/:id` | Update school | Admin |
| PATCH | `/schools/:id/assign` | Reassign sub-admin | Admin |
| DELETE | `/schools/:id` | Delete school | Admin |

#### POST /schools
```json
{
  "code": "newschool",
  "name": "New School Secondary",
  "zone": "Moshi Urban",
  "students": 300,
  "tablets": 40,
  "routers": 2,
  "contact_name": "Mr. Example",
  "contact_role": "IT Coordinator",
  "contact_phone": "+255 712 000 200",
  "lrs_ip": "192.168.0.10",
  "isp": "Vodacom Fibre",
  "assigned_admin_id": 2
}
```

---

### Errors (Tickets)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/errors` | List errors (filterable) | Authenticated |
| GET | `/errors/stats` | Get error statistics | Authenticated |
| GET | `/errors/:id` | Get error detail with updates | Authenticated |
| POST | `/errors` | Report new error | Authenticated |
| PUT | `/errors/:id` | Update error fully | Admin/Subadmin |
| PATCH | `/errors/:id/status` | Change status only | Authenticated |
| POST | `/errors/:id/updates` | Add progress update | Authenticated |
| DELETE | `/errors/:id` | Delete error | Admin |

#### Query Parameters for GET /errors
- `status` - Filter by status: `open`, `progress`, `escalated`, `resolved`, `all`
- `priority` - Filter by priority: `critical`, `high`, `medium`, `low`
- `category` - Filter by category: `Connectivity`, `Hardware`, `Platform`, `Power`, `Accounts`, `Other`
- `school_id` - Filter by school
- `search` - Search in title, error code, school name
- `limit` - Limit results

#### POST /errors
```json
{
  "title": "WiFi router offline",
  "description": "Lab router not powering on since morning.",
  "school_id": 1,
  "category": "Connectivity",
  "subcategory": "WiFi router down",
  "priority": "critical",
  "reporter_name": "Mr. Mushi",
  "reporter_role": "IT Coordinator",
  "reporter_contact": "+255 712 000 101",
  "location": "Computer Lab 1",
  "affected_devices": "All lab devices"
}
```

#### PATCH /errors/:id/status
```json
{
  "status": "resolved"
}
```

#### POST /errors/:id/updates
```json
{
  "update_type": "Progress Update",
  "note": "Technician dispatched. ETA 1 hour.",
  "recorded_by": "F. Amani"
}
```

---

### Team (Sub-Admins)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/team` | List all sub-admins with stats | Admin |
| GET | `/team/:id` | Get sub-admin detail + assigned schools | Admin |
| POST | `/team` | Create sub-admin | Admin |
| PUT | `/team/:id` | Update sub-admin | Admin |
| PATCH | `/team/:id/schools` | Assign schools to sub-admin | Admin |
| DELETE | `/team/:id` | Remove sub-admin | Admin |

#### POST /team
```json
{
  "username": "amushi",
  "email": "amushi@questforward.org",
  "password": "changeme123",
  "full_name": "A. Mushi",
  "phone": "+255 700 111 222",
  "zone": "Moshi Rural",
  "color": "#9b7dff",
  "title": "Field Engineer",
  "status": "active"
}
```

#### PATCH /team/:id/schools
```json
{
  "school_ids": [1, 3, 5, 7]
}
```

---

### Weekly Check-Ins

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/checkins` | List check-ins (filterable) | Authenticated |
| GET | `/checkins/stats` | Get check-in statistics | Authenticated |
| GET | `/checkins/school/:schoolId` | Get all check-ins for a school | Authenticated |
| POST | `/checkins` | Record/update check-in | Authenticated |

#### Query Parameters for GET /checkins
- `week` - Filter by week number
- `school_id` - Filter by school
- `term` - Filter by term (default: "Term 2 · 2026")

#### POST /checkins
```json
{
  "school_id": 1,
  "week_number": 4,
  "term": "Term 2 · 2026",
  "status": "green",
  "connectivity": "ok",
  "tablets": "ok",
  "platform": "ok",
  "power": "ok",
  "note": "All systems healthy. LRS reachable.",
  "checked_by": "K. Njoro"
}
```

---

### Troubleshooting Guides

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/guides` | List all guides | Authenticated |
| GET | `/guides/:id` | Get guide detail | Authenticated |
| POST | `/guides` | Create guide | Admin |
| PUT | `/guides/:id` | Update guide | Admin |
| DELETE | `/guides/:id` | Delete guide | Admin |

#### POST /guides
```json
{
  "title": "LRS Not Reachable",
  "category": "Connectivity",
  "icon": "ti-router",
  "steps": [
    "Check if the LRS device has power.",
    "Ping 192.168.0.10 from a connected device.",
    "Restart the LRS device.",
    "If still unreachable, report as CRITICAL."
  ]
}
```

---

### Manuals (File Library)

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/manuals` | List all manuals | Authenticated |
| POST | `/manuals` | Upload manual (multipart/form-data) | Admin |
| GET | `/manuals/:id/download` | Download manual file | Authenticated |
| DELETE | `/manuals/:id` | Delete manual | Admin |

#### POST /manuals (multipart/form-data)
```
file: <binary file>
title: "Router Setup Guide"
category: "Connectivity"
uploaded_by: "System Admin"
```

Accepted file types: PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, TXT, HTML, PNG, JPG  
Max file size: 5MB

---

### Communications

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/communications` | List communication notes | Authenticated |
| POST | `/communications` | Add communication note | Authenticated |
| DELETE | `/communications/:id` | Delete note | Admin/Subadmin |

#### Query Parameters for GET /communications
- `school_id` - Filter by school
- `limit` - Limit results

#### POST /communications
```json
{
  "school_id": 1,
  "note": "Confirmed technician visit scheduled for tomorrow.",
  "recorded_by": "F. Amani"
}
```

---

### Health Check

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/health` | Server health check | Public |

---

## Error Responses

All errors follow this format:
```json
{
  "error": "Error message",
  "details": [...] // validation errors (optional)
}
```

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad request / validation error
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden (insufficient role)
- `404` - Not found
- `409` - Conflict (duplicate)
- `413` - File too large
- `429` - Too many requests (rate limited)
- `500` - Internal server error

---

## Role-Based Access Control

| Role | Description | Access |
|------|-------------|--------|
| `admin` | System Administrator | Full access to all endpoints and all schools |
| `subadmin` | Sub-Admin / Field Engineer | Access to assigned schools only; cannot manage team |
| `school` | School user | Access to own school data only |

---

## Rate Limiting

- General API: 200 requests / 15 minutes per IP
- Login endpoint: 20 attempts / 15 minutes per IP
