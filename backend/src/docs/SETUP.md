# Quest Forward Tanzania — Setup Guide

## Prerequisites

- **Node.js** v18+ (https://nodejs.org)
- **MySQL** 8.0+ (https://dev.mysql.com/downloads/)
- **npm** (comes with Node.js)

---

## Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment

Copy the example env file and edit it:

```bash
cp .env.example .env
```

Edit `.env` with your MySQL credentials:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=qft_support

JWT_SECRET=change_this_to_a_long_random_string
```

### 3. Create Database & Tables

```bash
npm run migrate
```

This will:
- Create the `qft_support` database
- Create all required tables (users, schools, errors, etc.)

### 4. Seed Sample Data

```bash
npm run seed
```

This populates the database with:
- 1 admin user + 4 sub-admin users
- 13 schools across Kilimanjaro region
- 12 sample errors at various statuses
- 5 troubleshooting guides
- Weekly check-ins for weeks 1-3
- Communication notes

### 5. Start the Server

Development (with auto-reload):
```bash
npm run dev
```

Production:
```bash
npm start
```

Server starts at: **http://localhost:3000**

---

## Default Login Credentials

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | System Admin |
| knjoro | admin123 | Sub-Admin (Moshi Zone) |
| famani | admin123 | Sub-Admin (Kilema-Kibosho) |
| thassan | admin123 | Sub-Admin (Rombo) |
| cmbowe | admin123 | Sub-Admin (Remote/HQ) |

**Important:** Change all passwords after first login in production!

---

## Project Structure

```
backend/
├── .env                    # Environment variables (DO NOT COMMIT)
├── .env.example            # Template for env vars
├── .gitignore
├── package.json
├── uploads/                # Uploaded manual files (auto-created)
└── src/
    ├── server.js           # Express app entry point
    ├── config/
    │   ├── database.js     # MySQL connection pool
    │   ├── migrate.js      # Database migration script
    │   └── seed.js         # Sample data seeder
    ├── controllers/
    │   ├── authController.js
    │   ├── checkinController.js
    │   ├── communicationController.js
    │   ├── dashboardController.js
    │   ├── errorController.js
    │   ├── guideController.js
    │   ├── manualController.js
    │   ├── schoolController.js
    │   └── teamController.js
    ├── middleware/
    │   ├── auth.js          # JWT authentication + role authorization
    │   ├── errorHandler.js  # Global error handler
    │   └── validate.js      # Request validation
    ├── routes/
    │   ├── auth.js
    │   ├── checkins.js
    │   ├── communications.js
    │   ├── dashboard.js
    │   ├── errors.js
    │   ├── guides.js
    │   ├── manuals.js
    │   ├── schools.js
    │   └── team.js
    ├── utils/
    │   └── apiClient.js     # Frontend JavaScript API client
    └── docs/
        ├── API.md           # Complete API documentation
        ├── SETUP.md         # This file
        └── DATABASE.md      # Database schema documentation
```

---

## API Testing

### Using cURL

Login:
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

Get dashboard (replace TOKEN with the JWT from login):
```bash
curl http://localhost:3000/api/dashboard \
  -H "Authorization: Bearer TOKEN"
```

### Using the Frontend

Open http://localhost:3000 in your browser. The frontend HTML is served directly by the Express server.

---

## Deployment Notes

### Production Checklist

1. Set `NODE_ENV=production` in `.env`
2. Use a strong, random `JWT_SECRET` (min 64 characters)
3. Change all default passwords
4. Set `FRONTEND_URL` for CORS restrictions
5. Use a process manager (PM2, systemd) to keep the server running
6. Set up MySQL with a dedicated user (not root)
7. Enable HTTPS via reverse proxy (nginx/Caddy)
8. Set up database backups

### Example PM2 Setup

```bash
npm install -g pm2
pm2 start src/server.js --name qft-support
pm2 save
pm2 startup
```

### Example Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name support.questforward.org;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Troubleshooting

### "ECONNREFUSED" on startup
- MySQL is not running. Start it with `sudo systemctl start mysql` (Linux) or via MySQL Workbench (Windows).

### "Access denied for user"
- Check your DB_USER and DB_PASSWORD in `.env`
- Ensure the MySQL user has CREATE, SELECT, INSERT, UPDATE, DELETE privileges

### "Unknown database"
- Run `npm run migrate` first to create the database

### Port already in use
- Change `PORT` in `.env` or kill the existing process
