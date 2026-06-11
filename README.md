# Quest Forward Tanzania — Technical Support System

A full-stack troubleshooting and error management system for school technical support teams.

## Features

- **Dashboard** — Real-time KPIs, critical alerts, priority errors
- **Error Tracker** — Full lifecycle management with SLA tracking
- **Report Error** — Guided error submission with school/category routing
- **School Profiles** — All school assets, contacts, and history
- **Troubleshooting Guides** — Step-by-step tech support procedures
- **Team Management** — Sub-admin CRUD and school assignments
- **Branding** — Admin-configurable logo, name, colors, loader text
- **Role-Based Access** — Admin, Sub-Admin, School roles with JWT auth

## Tech Stack

- **Backend:** Node.js, Express, MySQL 8.4
- **Frontend:** Vanilla JS SPA with glassmorphism dark UI
- **Auth:** JWT with bcrypt password hashing
- **Icons:** Tabler Icons + Iconscout Unicons

## Quick Start (Local)

```bash
# 1. Clone
git clone https://github.com/Claytonee/Troubleshooting-System.git
cd Troubleshooting-System

# 2. Install
cd backend && npm install

# 3. Configure
cp .env.example .env
# Edit .env with your MySQL credentials

# 4. Database setup
npm run migrate
npm run seed

# 5. Run
npm start
# Open http://localhost:3000
```

**Default login:** `admin` / `admin123`

## Deploy to Render + Aiven (Free)

### Step 1: Create Free MySQL Database (Aiven)

1. Go to [aiven.io](https://aiven.io) and sign up (free)
2. Create a new **MySQL** service (Free plan)
3. Wait for it to be "Running"
4. Copy the connection details: host, port, user, password, database name

### Step 2: Deploy to Render

1. Go to [render.com](https://render.com) and sign up (free)
2. Click **New > Web Service**
3. Connect your GitHub repo: `Claytonee/Troubleshooting-System`
4. Settings:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `node src/server.js`
   - **Instance Type:** Free
5. Add Environment Variables:
   - `NODE_ENV` = `production`
   - `DB_HOST` = (from Aiven)
   - `DB_PORT` = (from Aiven)
   - `DB_USER` = (from Aiven)
   - `DB_PASSWORD` = (from Aiven)
   - `DB_NAME` = (from Aiven)
   - `JWT_SECRET` = (generate a random 64-char string)
   - `JWT_EXPIRES_IN` = `7d`
   - `UPLOAD_DIR` = `./uploads`
   - `MAX_FILE_SIZE` = `5242880`
6. Click **Create Web Service**

### Step 3: Run Migration on Render

After deploy, open the Render shell and run:
```bash
node src/config/migrate.js
node src/config/seed.js
```

Your app will be live at `https://your-app.onrender.com`

## License

MIT
