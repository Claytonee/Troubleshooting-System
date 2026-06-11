# Developer Setup Guide

Hatua za kupata project hii na kuanza kufanya kazi.

---

## 1. Vitu unavyohitaji (Prerequisites)

Install hizi kwanza kama huna:

- **Node.js 18+** → [nodejs.org](https://nodejs.org/) (download LTS)
- **MySQL 8.x** → [mysql.com/downloads](https://dev.mysql.com/downloads/mysql/) au XAMPP
- **Git** → [git-scm.com](https://git-scm.com/downloads)
- **VS Code** (recommended) → [code.visualstudio.com](https://code.visualstudio.com/)

---

## 2. Clone Project

```bash
git clone https://gitlab.com/claytonecurth/Troubleshooting-System.git
cd Troubleshooting-System
```

---

## 3. Install Dependencies

```bash
cd backend
npm install
```

---

## 4. Setup Database

Fungua MySQL (au XAMPP → Start MySQL), kisha:

```bash
# Copy environment file
cp .env.example .env
```

Fungua `.env` na edit (kama unatumia XAMPP, password ni empty):

```
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

Kisha run migration na seed:

```bash
npm run migrate
npm run seed
```

---

## 5. Start Server

```bash
npm start
```

Fungua browser → `http://localhost:3000`

**Login:** `admin` / `admin123`

---

## 6. Workflow ya Kufanya Mabadiliko

```bash
# Angalia status
git status

# Ongeza changes
git add .

# Commit
git commit -m "description ya ulichobadilisha"

# Push kwenda GitLab
git push origin main

# Pull changes za wengine
git pull origin main
```

---

## 7. Project Structure

```
Troubleshooting-System/
├── backend/
│   ├── src/
│   │   ├── config/       ← Database, migration, seed
│   │   ├── controllers/  ← Business logic (API handlers)
│   │   ├── middleware/    ← Auth, validation, error handler
│   │   ├── routes/       ← API route definitions
│   │   └── server.js     ← Main entry point
│   ├── .env              ← Local config (DON'T push this)
│   └── package.json
├── frontend/
│   ├── css/              ← Styles (variables, base, components)
│   ├── js/
│   │   ├── pages/        ← Each page module (dashboard, tracker, etc)
│   │   ├── components/   ← Shared components (modal)
│   │   ├── api.js        ← API client
│   │   ├── auth.js       ← Login/logout/profile
│   │   ├── router.js     ← SPA hash routing
│   │   └── app.js        ← Main controller
│   └── index.html        ← Single page shell
├── docs/                 ← Documentation
└── render.yaml           ← Deploy config
```

---

## 8. Tips

- **Frontend** ni vanilla JS — hakuna build step. Edit file, refresh browser.
- **Backend** ukitumia `npm run dev` (badala ya `npm start`) server ita-restart peke yake ukibadilisha file.
- **Database changes** → edit `backend/src/config/migrate.js` kisha run `npm run migrate`
- **.env** haipushwi GitHub/GitLab — kila developer ana yake local

---

## 9. Production Deployment

Push kwenda `main` branch → Render ita-deploy automatically kutoka GitLab.

```bash
git push origin main
```

Hakuna hatua nyingine — auto-deploy iko enabled.

---

## Maswali?

Contact: claytonecurth@gmail.com
