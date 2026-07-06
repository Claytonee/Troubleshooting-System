# Opportunity Education Tanzania — Technical Support System

A full-stack troubleshooting and error management system for school technical support teams across Tanzania.

## Features

- **Dashboard** — Role-specific KPIs, critical alerts, priority errors
- **Error Tracker** — Full lifecycle management with SLA tracking and breach detection
- **Report Error** — Guided error submission with auto-routing and tiered escalation
- **School Profiles** — School assets, contacts, history, and health status
- **Weekly Check-Ins** — Structured health monitoring (connectivity, tablets, platform, power)
- **Troubleshooting Guides** — Step-by-step tech support procedures
- **Resource Library** — Upload, preview, and download manuals/training materials (Cloudinary CDN)
- **Teacher Registration** — Link-based self-registration with approval workflow
- **Team Management** — Sub-admin and school admin management
- **Analytics** — SLA compliance, error trends, school health
- **Audit Log** — Complete activity history for accountability
- **Branding** — Admin-configurable logo, name, colors
- **4-Tier RBAC** — Platform Admin > Sub-Admin > School Admin > Teacher

## Tech Stack

- **Backend:** Node.js, Express, PostgreSQL (Render Managed)
- **Frontend:** Vanilla JS SPA, dark theme, DM Sans + Axiforma fonts
- **Auth:** JWT with bcrypt password hashing
- **Icons:** Tabler Icons
- **File Storage:** Cloudinary CDN
- **Hosting:** Render Web Service (auto-deploy from main)
- **Source:** GitHub + GitLab (dual remote)

## Quick Start (Local)

```bash
# 1. Clone
git clone https://github.com/Claytonee/Troubleshooting-System.git
cd Troubleshooting-System

# 2. Install
cd backend && npm install

# 3. Configure
cp .env.example .env
# Edit .env with your PostgreSQL credentials (DATABASE_URL or DB_* vars)

# 4. Run (auto-creates tables + seeds demo data on first start)
npm start
# Open http://localhost:3000
```

**Default login:** `admin` / `admin123`

## Deploy to Render (Production)

### Step 1: Create PostgreSQL Database

1. In [Render Dashboard](https://dashboard.render.com), click **New > PostgreSQL**
2. Choose a plan (Free or paid with backups for production)
3. Copy the **Internal Database URL**

### Step 2: Deploy Web Service

1. Click **New > Web Service**
2. Connect your GitHub repo: `Claytonee/Troubleshooting-System`
3. Settings:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `node src/server.js`
4. Add Environment Variables:
   - `DATABASE_URL` = (Internal Database URL from Step 1)
   - `DB_SSL` = `true`
   - `NODE_ENV` = `production`
   - `JWT_SECRET` = (generate a random 64-char string)
   - `JWT_EXPIRES_IN` = `7d`
   - `CLOUDINARY_CLOUD_NAME` = (your Cloudinary cloud name)
   - `CLOUDINARY_API_KEY` = (your Cloudinary API key)
   - `CLOUDINARY_API_SECRET` = (your Cloudinary API secret)
5. Click **Create Web Service**

The app auto-creates tables and seeds demo data on first start. No manual migration needed.

Your app will be live at `https://your-app.onrender.com`

## Documentation

- [System Documentation](docs/SYSTEM_DOCUMENTATION.md) — Complete technical reference
- [API Reference](docs/API_AND_DTO_REFERENCE.md) — Request/response DTOs
- [Deployment Guide](docs/DEPLOY_RENDER_POSTGRES.md) — Detailed Render + PostgreSQL setup
- [Roadmap](docs/ROADMAP_AND_DESIGN.md) — Feature roadmap and design decisions

## Role Hierarchy

```
Platform Admin → full system access, team management, analytics
  └─ Sub-Admin (Field Engineer) → assigned schools, error resolution
      └─ School Admin → own school, teacher management, error reporting
          └─ Teacher → own errors, guides, resources only
```

## License

MIT
