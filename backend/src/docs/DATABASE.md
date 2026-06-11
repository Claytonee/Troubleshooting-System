# Quest Forward Tanzania — Database Schema

## Database: `qft_support`
Engine: MySQL 8.0+  
Charset: utf8mb4  
Collation: utf8mb4_unicode_ci

---

## Entity Relationship Diagram (Text)

```
┌─────────┐     ┌─────────────┐     ┌──────────┐
│  users  │────<│   schools   │>────│  errors  │
└─────────┘     └─────────────┘     └──────────┘
     │                 │                   │
     │                 │              ┌────┴─────┐
     │                 │              │ error_   │
     │                 │              │ updates  │
     │                 │              └──────────┘
     │                 │
     │          ┌──────┴──────┐     ┌──────────────────┐
     │          │   weekly_   │     │ communications   │
     │          │  checkins   │     └──────────────────┘
     │          └─────────────┘
     │
     │     ┌─────────────────────┐     ┌──────────┐
     └────>│troubleshooting_guides│     │ manuals  │
           └─────────────────────┘     └──────────┘
```

---

## Tables

### `users`
Stores all system users (admin, sub-admins, school users).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PK, AUTO_INCREMENT | Unique user ID |
| username | VARCHAR(100) | UNIQUE, NOT NULL | Login username |
| email | VARCHAR(255) | UNIQUE, NOT NULL | Email address |
| password_hash | VARCHAR(255) | NOT NULL | Bcrypt hashed password |
| full_name | VARCHAR(200) | NOT NULL | Display name |
| role | ENUM | NOT NULL | `admin`, `subadmin`, `school` |
| phone | VARCHAR(50) | | Contact phone |
| zone | VARCHAR(100) | | Geographic zone |
| color | VARCHAR(50) | DEFAULT '#4f7cff' | UI avatar color |
| title | VARCHAR(200) | | Job title/role |
| status | ENUM | DEFAULT 'active' | `active`, `onsite`, `remote`, `inactive` |
| school_id | INT | FK → schools.id | For school-role users |
| created_at | TIMESTAMP | DEFAULT NOW() | |
| updated_at | TIMESTAMP | AUTO UPDATE | |

---

### `schools`
All registered schools in the QFT network.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PK, AUTO_INCREMENT | Unique school ID |
| code | VARCHAR(50) | UNIQUE, NOT NULL | Short code (e.g., 'kilema') |
| name | VARCHAR(200) | NOT NULL | Full school name |
| zone | VARCHAR(100) | | Geographic zone |
| students | INT | DEFAULT 0 | Number of students |
| tablets | INT | DEFAULT 0 | Number of tablets |
| routers | INT | DEFAULT 0 | Number of routers |
| contact_name | VARCHAR(200) | | School contact person |
| contact_role | VARCHAR(100) | | Contact's role |
| contact_phone | VARCHAR(50) | | Contact phone number |
| lrs_ip | VARCHAR(50) | DEFAULT '192.168.0.10' | LRS IP address |
| isp | VARCHAR(100) | | Internet service provider |
| assigned_admin_id | INT | FK → users.id | Assigned sub-admin |
| created_at | TIMESTAMP | DEFAULT NOW() | |
| updated_at | TIMESTAMP | AUTO UPDATE | |

---

### `errors`
Technical support tickets/error reports.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PK, AUTO_INCREMENT | Unique error ID |
| error_code | VARCHAR(20) | UNIQUE, NOT NULL | Human-readable code (QFT-0XXX) |
| title | VARCHAR(300) | NOT NULL | Brief error description |
| description | TEXT | | Detailed description |
| school_id | INT | FK → schools.id, NOT NULL | Reporting school |
| category | ENUM | NOT NULL | Error category |
| subcategory | VARCHAR(200) | | Specific subcategory |
| priority | ENUM | NOT NULL, DEFAULT 'medium' | `critical`, `high`, `medium`, `low` |
| status | ENUM | NOT NULL, DEFAULT 'open' | `open`, `progress`, `escalated`, `resolved` |
| assigned_to | INT | FK → users.id | Assigned engineer |
| reporter_name | VARCHAR(200) | | Person who reported |
| reporter_role | VARCHAR(100) | | Reporter's role |
| reporter_contact | VARCHAR(100) | | Reporter's phone |
| location | VARCHAR(200) | | Physical location |
| affected_devices | VARCHAR(300) | | Devices affected |
| hours_open | DECIMAL(10,1) | DEFAULT 0 | Hours since creation |
| resolved_at | TIMESTAMP | NULL | Resolution timestamp |
| created_at | TIMESTAMP | DEFAULT NOW() | |
| updated_at | TIMESTAMP | AUTO UPDATE | |

**Categories:** `Connectivity`, `Hardware`, `Platform`, `Power`, `Accounts`, `Other`

**SLA Targets:**
| Priority | Target |
|----------|--------|
| Critical | ≤ 2 hours |
| High | ≤ 8 hours |
| Medium | ≤ 24 hours |
| Low | ≤ 72 hours |

---

### `error_updates`
Progress updates and notes on errors.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PK, AUTO_INCREMENT | |
| error_id | INT | FK → errors.id, ON DELETE CASCADE | Parent error |
| update_type | VARCHAR(100) | | Type of update |
| note | TEXT | NOT NULL | Update text |
| recorded_by | VARCHAR(200) | | Who recorded it |
| created_at | TIMESTAMP | DEFAULT NOW() | |

---

### `weekly_checkins`
Structured weekly school visit records.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PK, AUTO_INCREMENT | |
| school_id | INT | FK → schools.id, ON DELETE CASCADE | School checked |
| week_number | INT | NOT NULL | Week 1-12 of the term |
| term | VARCHAR(50) | DEFAULT 'Term 2 · 2026' | Term identifier |
| status | ENUM | DEFAULT 'green' | `green`, `amber`, `red` |
| connectivity | ENUM | DEFAULT 'ok' | `ok`, `issue`, `na` |
| tablets | ENUM | DEFAULT 'ok' | `ok`, `issue`, `na` |
| platform | ENUM | DEFAULT 'ok' | `ok`, `issue`, `na` |
| power | ENUM | DEFAULT 'ok' | `ok`, `issue`, `na` |
| note | TEXT | | Visit notes |
| checked_by | VARCHAR(200) | | Who did the check-in |
| created_at | TIMESTAMP | DEFAULT NOW() | |
| updated_at | TIMESTAMP | AUTO UPDATE | |

**Unique Constraint:** `(school_id, week_number, term)` — one check-in per school per week.

---

### `communications`
Free-form communication notes with schools.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PK, AUTO_INCREMENT | |
| school_id | INT | FK → schools.id, ON DELETE CASCADE | Related school |
| recorded_by | VARCHAR(200) | | Who recorded |
| note | TEXT | NOT NULL | Communication content |
| created_at | TIMESTAMP | DEFAULT NOW() | |

---

### `troubleshooting_guides`
Step-by-step troubleshooting instructions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PK, AUTO_INCREMENT | |
| title | VARCHAR(300) | NOT NULL | Guide title |
| category | VARCHAR(100) | | Related category |
| icon | VARCHAR(100) | DEFAULT 'ti-tools' | Tabler icon class |
| steps | JSON | NOT NULL | Array of step strings |
| is_custom | BOOLEAN | DEFAULT FALSE | Admin-created guide |
| created_by | INT | FK → users.id | Creator user |
| created_at | TIMESTAMP | DEFAULT NOW() | |
| updated_at | TIMESTAMP | AUTO UPDATE | |

---

### `manuals`
Uploaded reference documents and user guides.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INT | PK, AUTO_INCREMENT | |
| title | VARCHAR(300) | NOT NULL | Display title |
| original_filename | VARCHAR(300) | | Original file name |
| stored_filename | VARCHAR(300) | | Server storage name |
| file_type | VARCHAR(100) | | MIME type |
| file_size | INT | DEFAULT 0 | Size in bytes |
| category | VARCHAR(100) | DEFAULT 'General' | Document category |
| uploaded_by | VARCHAR(200) | DEFAULT 'System Admin' | Uploader name |
| created_at | TIMESTAMP | DEFAULT NOW() | |

---

## Indexes

The following indexes are automatically created:
- Primary keys on all `id` columns
- Unique indexes on `users.username`, `users.email`, `schools.code`, `errors.error_code`
- Unique composite index on `weekly_checkins(school_id, week_number, term)`
- Foreign key indexes on all FK columns

### Recommended Additional Indexes for Production

```sql
CREATE INDEX idx_errors_status ON errors(status);
CREATE INDEX idx_errors_priority ON errors(priority);
CREATE INDEX idx_errors_school ON errors(school_id);
CREATE INDEX idx_errors_created ON errors(created_at);
CREATE INDEX idx_checkins_week ON weekly_checkins(week_number, term);
CREATE INDEX idx_comms_school ON communications(school_id);
CREATE INDEX idx_schools_admin ON schools(assigned_admin_id);
```
