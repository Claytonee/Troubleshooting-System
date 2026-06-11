# Quest Forward Tanzania — Developer Setup Guide

Complete guide to set up this project on your computer, run it locally, and push changes to production.

**Target:** Windows 10/11 (works on Mac/Linux too with minor differences noted below)

---

## STEP 1: Install Required Software

You need 3 programs installed. If you already have them, skip to Step 2.

### 1a. Install Node.js (JavaScript runtime)

1. Go to https://nodejs.org/
2. Download the **LTS** version (green button)
3. Run the installer — click Next on everything (default settings are fine)
4. **Verify it worked:** Open Command Prompt or PowerShell and run:
   ```bash
   node --version
   ```
   You should see something like `v20.x.x` or `v22.x.x`. Any version 18+ is fine.

   Also check npm (comes with Node):
   ```bash
   npm --version
   ```
   Should show `10.x.x` or similar.

### 1b. Install MySQL (Database)

**Option A: Standalone MySQL (recommended)**
1. Go to https://dev.mysql.com/downloads/mysql/
2. Download MySQL Installer for Windows
3. During install, choose "Developer Default" or "Server Only"
4. Set root password (remember it!) or leave empty for no password
5. Finish installation

**Option B: XAMPP (easier for beginners)**
1. Go to https://www.apachefriends.org/
2. Download and install XAMPP
3. Open XAMPP Control Panel → Click "Start" next to MySQL
4. Root password is empty by default

**Verify MySQL is running:**
```bash
mysql -u root -p
```
Enter your password (or just press Enter if no password). If you see `mysql>` prompt, it's working. Type `exit` to leave.

### 1c. Install Git (Version control)

1. Go to https://git-scm.com/downloads
2. Download for your OS and install (default settings are fine)
3. **Verify:**
   ```bash
   git --version
   ```
   Should show `git version 2.x.x`

### 1d. Install VS Code (Code editor — recommended)

1. Go to https://code.visualstudio.com/
2. Download and install
3. Recommended extensions: "ES7+ React/Redux/React-Native snippets", "Prettier"

---

## STEP 2: Configure Git Identity

Git needs to know who you are. Run these commands (replace with your name and email):

```bash
git config --global user.name "Your Full Name"
git config --global user.email "your.email@example.com"
```

**Verify:**
```bash
git config --global user.name
git config --global user.email
```

---

## STEP 3: Clone the Project

This downloads the entire project to your computer.

```bash
cd Desktop
git clone https://gitlab.com/claytonecurth/Troubleshooting-System.git
cd Troubleshooting-System
```

**What happened:** A folder called `Troubleshooting-System` now exists on your Desktop with all the code.

**Verify:** Run `ls` (Mac/Linux) or `dir` (Windows). You should see:
```
backend/
frontend/
docs/
SETUP.md
README.md
package.json
render.yaml
```

---

## STEP 4: Install Project Dependencies

```bash
cd backend
npm install
```

This downloads all the Node.js packages the project needs. It creates a `node_modules` folder (this is normal — it's big, ~100MB).

**Verify:** No red "ERR!" messages. You should see something like:
```
added 150 packages in 10s
```

If you see errors about `node-gyp` or Python, ignore them — they're optional build tools.

---

## STEP 5: Configure Environment Variables

The `.env` file tells the app how to connect to YOUR local database. It is private and never pushed to GitLab.

**On Windows (Command Prompt):**
```bash
copy .env.example .env
```

**On Windows (PowerShell/Git Bash) or Mac/Linux:**
```bash
cp .env.example .env
```

Now open `.env` in VS Code (or any text editor) and set these values:

```env
PORT=3000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=qft_support

JWT_SECRET=dev_secret_key_2026
JWT_EXPIRES_IN=7d

UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880
```

**IMPORTANT:** 
- If you set a MySQL root password during installation, put it in `DB_PASSWORD=yourpassword`
- If you used XAMPP or didn't set a password, leave `DB_PASSWORD=` empty
- Do NOT add quotes around values
- Do NOT add spaces around `=`

---

## STEP 6: Create Database and Seed Demo Data

These commands create the database tables and fill them with sample data:

```bash
npm run migrate
npm run seed
```

**Expected output for migrate:**
```
Connected to MySQL server.
Creating tables...
All tables created successfully!
Migration complete.
```

**Expected output for seed:**
```
Seeding database...
Users seeded.
Schools seeded.
Errors seeded.
...
Seed complete! Default login:
  Username: admin
  Password: admin123
```

**If you get "Access denied" error:**
- Check your DB_PASSWORD in `.env` matches your actual MySQL password

**If you get "ECONNREFUSED" error:**
- MySQL is not running. Start it via XAMPP Control Panel or Windows Services

---

## STEP 7: Start the Server

```bash
npm start
```

**Expected output:**
```
Quest Forward Tanzania - Technical Support System
================================================
Server running on http://localhost:3000
API base:         http://localhost:3000/api
Environment:      development
Database:         localhost:3306/qft_support
================================================
```

Now open your browser and go to: **http://localhost:3000**

**Login credentials:**
- Username: `admin`
- Password: `admin123`

You should see the dashboard with data (schools, errors, etc.)

**To stop the server:** Press `Ctrl + C` in the terminal.

---

## STEP 8: Development Workflow

### Making changes

1. Edit any file in `frontend/` or `backend/`
2. Frontend changes: just refresh the browser (F5)
3. Backend changes: restart the server (Ctrl+C then `npm start`)
   - OR use `npm run dev` instead — this auto-restarts on file changes

### Auto-restart mode (recommended while developing):

```bash
npm run dev
```

This uses `nodemon` — every time you save a backend file, the server restarts automatically.

---

## STEP 9: Saving and Pushing Your Changes

After making changes you want to keep:

```bash
# 1. Go to project root (not inside backend/)
cd ..

# 2. See what you changed
git status

# 3. Stage all changes
git add .

# 4. Commit with a message describing what you did
git commit -m "Add: new feature description"

# 5. Push to GitLab (this also auto-deploys to production!)
git push origin main
```

**IMPORTANT:** Pushing to `main` automatically deploys to the live site at https://troubleshooting-system-j7ln.onrender.com — so make sure your changes work locally first!

### Getting changes others made:

```bash
git pull origin main
```

Do this before starting work each day to get the latest code.

### If git push asks for credentials:

GitLab will ask for username/password or a Personal Access Token:
1. Go to GitLab → Settings → Access Tokens
2. Create a token with `write_repository` scope
3. Use that token as your password when git asks

---

## STEP 10: Understanding the Project Structure

```
Troubleshooting-System/
│
├── backend/                    ← SERVER (Node.js + Express)
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.js    ← Database connection pool
│   │   │   ├── migrate.js     ← Creates all tables
│   │   │   ├── seed.js        ← Fills tables with demo data
│   │   │   └── ca.pem         ← SSL certificate for production DB
│   │   ├── controllers/       ← API logic (what happens when endpoints are called)
│   │   │   ├── authController.js
│   │   │   ├── errorController.js
│   │   │   ├── schoolController.js
│   │   │   ├── dashboardController.js
│   │   │   └── ...
│   │   ├── middleware/
│   │   │   ├── auth.js        ← JWT token verification
│   │   │   ├── errorHandler.js← Catches all errors
│   │   │   └── validate.js    ← Input validation
│   │   ├── routes/            ← URL → controller mapping
│   │   │   ├── auth.js        ← /api/auth/*
│   │   │   ├── errors.js      ← /api/errors/*
│   │   │   ├── schools.js     ← /api/schools/*
│   │   │   └── ...
│   │   └── server.js          ← MAIN FILE — starts everything
│   ├── .env                   ← YOUR local config (never push this)
│   ├── .env.example           ← Template for .env
│   └── package.json           ← Dependencies list
│
├── frontend/                   ← CLIENT (Vanilla JavaScript SPA)
│   ├── css/
│   │   ├── variables.css      ← Colors, fonts, spacing tokens
│   │   ├── base.css           ← Layout (sidebar, topbar, main)
│   │   └── components.css     ← All UI components (cards, modals, tables, etc)
│   ├── js/
│   │   ├── api.js             ← Talks to backend (/api/* calls)
│   │   ├── auth.js            ← Login, logout, profile dropdown
│   │   ├── router.js          ← Hash-based page navigation (#dashboard, #tracker)
│   │   ├── app.js             ← Main controller + Error Detail modal
│   │   ├── utils.js           ← Helper functions (esc, ageStr, relTime, etc)
│   │   ├── components/
│   │   │   └── modal.js       ← Reusable modal popup
│   │   └── pages/
│   │       ├── dashboard.js   ← Dashboard KPIs and panels
│   │       ├── report.js      ← Error reporting form
│   │       ├── tracker.js     ← Error list with filters
│   │       ├── schools.js     ← School profiles
│   │       ├── team.js        ← Sub-admin management
│   │       ├── guides.js      ← Troubleshooting guides
│   │       └── branding.js    ← Admin branding settings
│   └── index.html             ← The single HTML page (SPA shell)
│
├── docs/
│   └── SYSTEM_DOCUMENTATION.md ← Full system documentation
├── SETUP.md                    ← THIS FILE
├── README.md                   ← Project overview
├── render.yaml                 ← Render.com deploy config
└── .gitignore                  ← Files git should ignore
```

---

## Key Concepts

### How the app works:
1. User opens `http://localhost:3000` → Express serves `frontend/index.html`
2. JavaScript loads and checks if user is logged in (JWT token in localStorage)
3. If not logged in → shows login page
4. If logged in → shows the app with sidebar navigation
5. Clicking nav items changes the URL hash (#dashboard, #tracker, etc.)
6. Each page module (e.g., `dashboard.js`) has `load()` and `render()` functions
7. `load()` fetches data from the API, `render()` returns HTML string

### How to add a new page:
1. Create `frontend/js/pages/yourpage.js` with `load()` and `render()` methods
2. Add `<script src="js/pages/yourpage.js"></script>` to `index.html` (before app.js)
3. Add `yourpage: YourPage` to the `pages` object in `app.js`
4. Add `'yourpage'` to the `validPages` array in `router.js`
5. Add a nav item in `index.html` sidebar: `<div class="nav-item" data-page="yourpage"><i class="ti ti-icon"></i>Your Page</div>`

### How to add a new API endpoint:
1. Create or edit a controller in `backend/src/controllers/`
2. Create or edit a route in `backend/src/routes/`
3. Register the route in `backend/src/server.js`
4. Add the API call in `frontend/js/api.js`

---

## Troubleshooting Common Issues

| Problem | Solution |
|---------|----------|
| `npm: command not found` | Node.js not installed or not in PATH. Restart terminal after installing. |
| `ECONNREFUSED 127.0.0.1:3306` | MySQL is not running. Start it. |
| `Access denied for user 'root'` | Wrong password in `.env`. Check DB_PASSWORD. |
| `Module not found` | Run `npm install` again inside `backend/` folder. |
| `Port 3000 already in use` | Another server is running. Kill it or change PORT in `.env` to 3001. |
| `git push rejected` | Run `git pull origin main` first, then push again. |
| Page shows blank after login | Check browser console (F12) for JavaScript errors. |
| Changes not showing on live site | Did you push to GitLab? Check Render dashboard for deploy status. |

---

## Useful Commands Reference

```bash
# --- Project ---
npm install          # Install all packages
npm start            # Start server (production mode)
npm run dev          # Start server with auto-restart (development)
npm run migrate      # Create/update database tables
npm run seed         # Fill database with demo data

# --- Git ---
git status           # See changed files
git add .            # Stage all changes
git commit -m "msg"  # Save changes locally
git push origin main # Send to GitLab (triggers deploy)
git pull origin main # Get latest from GitLab
git log --oneline    # See commit history
git diff             # See what changed (before staging)

# --- Database ---
mysql -u root -p     # Open MySQL shell
# Inside MySQL:
USE qft_support;
SHOW TABLES;
SELECT * FROM users;
SELECT * FROM schools;
```

---

## Live Site

- **URL:** https://troubleshooting-system-j7ln.onrender.com
- **Hosting:** Render.com (auto-deploys from GitLab main branch)
- **Database:** Aiven MySQL (cloud, persistent)
- **Auto-deploy:** Every push to `main` on GitLab triggers a new deployment (~2-3 min)

---

## Contact

Project owner: claytonecurth@gmail.com
