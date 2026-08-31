# cPanel CI/CD Setup Guide — QFT Technical Support System

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  Developer pushes code to GitHub                        │
│                                                         │
│  git push origin main      → Production deploy          │
│  git push origin staging   → Staging deploy             │
│  git push origin develop   → Development deploy         │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│  GitHub Webhook (POST)                                  │
│  → https://troubleshooting.pathfindereducation.or.tz    │
│    /webhook (port 9000)                                 │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│  Webhook Server (deploy/webhook-server.js)              │
│  • Verifies GitHub signature                            │
│  • Maps branch → environment                            │
│  • Runs deploy-{env}.sh                                 │
└────────────┬────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────┐
│  Deploy Script                                          │
│  1. git pull                                            │
│  2. npm ci                                              │
│  3. Copy .env.{environment}                             │
│  4. Run migrations                                      │
│  5. Restart Node.js app (Passenger / PM2)               │
│  6. Health check                                        │
└─────────────────────────────────────────────────────────┘
```

## Environments

| Environment | Branch   | Database              | Subdomain                                          | Port |
|-------------|----------|-----------------------|----------------------------------------------------|------|
| Production  | `main`   | `CPUSER_qft_production` | troubleshooting.pathfindereducation.or.tz          | 3000 |
| Staging     | `staging`| `CPUSER_qft_staging`    | staging-troubleshooting.pathfindereducation.or.tz  | 3001 |
| Development | `develop`| `CPUSER_qft_dev`        | dev-troubleshooting.pathfindereducation.or.tz      | 3003 |
| Testing     | —        | `CPUSER_qft_testing`    | (no web access, CI only)                           | 3002 |

> Replace `CPUSER` with your actual cPanel username (e.g., `pathfind`).

---

## Step 1: Create MySQL Databases in cPanel

1. Log in to cPanel → **MySQL Databases**
2. Create 4 databases:
   - `CPUSER_qft_production` (or keep your existing production DB name)
   - `CPUSER_qft_staging`
   - `CPUSER_qft_dev`
   - `CPUSER_qft_testing`
3. Create a database user (or use existing):
   - `CPUSER_qft` with a strong password
4. Add the user to ALL 4 databases with **ALL PRIVILEGES**
5. Note down the database names and password

---

## Step 2: Create Subdomains

1. cPanel → **Subdomains**
2. Create:
   - `staging-troubleshooting` → points to a separate app directory
   - `dev-troubleshooting` → points to a separate app directory
3. Each subdomain gets its own Node.js application directory:
   ```
   ~/staging-troubleshooting.pathfindereducation.or.tz/
   ~/dev-troubleshooting.pathfindereducation.or.tz/
   ```

   OR use the same directory with different Node.js app configurations (recommended — less disk usage).

---

## Step 3: Clone Repository on Server

SSH into your server (cPanel → **Terminal** or use SSH client):

```bash
# Navigate to your home directory
cd ~

# Clone for production (if not already done)
git clone https://github.com/Claytonee/Troubleshooting-System.git troubleshooting-production
cd troubleshooting-production
git checkout main

# Clone for staging
cd ~
git clone https://github.com/Claytonee/Troubleshooting-System.git troubleshooting-staging
cd troubleshooting-staging
git checkout staging

# Clone for development
cd ~
git clone https://github.com/Claytonee/Troubleshooting-System.git troubleshooting-dev
cd troubleshooting-dev
git checkout develop
```

---

## Step 4: Configure Environment Files

For EACH clone, create the `.env` file in the `backend/` directory:

### Production (`~/troubleshooting-production/backend/.env`):
```bash
cd ~/troubleshooting-production/backend
nano .env
# Paste contents from .env.production, fill in real values
```

### Staging (`~/troubleshooting-staging/backend/.env`):
```bash
cd ~/troubleshooting-staging/backend
nano .env
# Paste contents from .env.staging, fill in real values
```

### Development (`~/troubleshooting-dev/backend/.env`):
```bash
cd ~/troubleshooting-dev/backend
nano .env
# Paste contents from .env.development, fill in real values
```

---

## Step 5: Setup Node.js Apps in cPanel

1. cPanel → **Setup Node.js App**
2. Create 3 applications:

### Production App
- **Node.js version:** 18+
- **Application mode:** Production
- **Application root:** `troubleshooting-production`
- **Application URL:** `troubleshooting.pathfindereducation.or.tz`
- **Application startup file:** `backend/src/server.js`

### Staging App
- **Node.js version:** 18+
- **Application mode:** Production
- **Application root:** `troubleshooting-staging`
- **Application URL:** `staging-troubleshooting.pathfindereducation.or.tz`
- **Application startup file:** `backend/src/server.js`
- **Environment variables:** `NODE_ENV=staging`, `PORT=3001`

### Development App
- **Node.js version:** 18+
- **Application mode:** Development
- **Application root:** `troubleshooting-dev`
- **Application URL:** `dev-troubleshooting.pathfindereducation.or.tz`
- **Application startup file:** `backend/src/server.js`
- **Environment variables:** `NODE_ENV=development`, `PORT=3003`

3. For each app, click **Run NPM Install** to install dependencies.

---

## Step 6: Install Dependencies & Migrate

SSH into the server:

```bash
# Production
cd ~/troubleshooting-production/backend && npm install && node src/server.js &

# Staging
cd ~/troubleshooting-staging/backend && npm install && node src/server.js &

# Development
cd ~/troubleshooting-dev/backend && npm install && node src/server.js &
```

Each app will auto-migrate its database on first start (bootstrap.js + schemaExtensions.js).

---

## Step 7: Setup Webhook Server

The webhook server runs as a separate process that receives GitHub notifications:

```bash
cd ~/troubleshooting-production/deploy

# Generate a webhook secret
WEBHOOK_SECRET=$(openssl rand -hex 32)
echo "Save this secret for GitHub: $WEBHOOK_SECRET"

# Start the webhook server
WEBHOOK_SECRET=$WEBHOOK_SECRET \
APP_DIR=~/troubleshooting-production \
WEBHOOK_PORT=9000 \
nohup node webhook-server.js >> deploy.log 2>&1 &

echo "Webhook server PID: $!"
```

### Keep Webhook Alive with Cron

cPanel → **Cron Jobs** → Add:
```
*/5 * * * * pgrep -f "webhook-server.js" > /dev/null || cd ~/troubleshooting-production/deploy && WEBHOOK_SECRET=YOUR_SECRET APP_DIR=~/troubleshooting-production WEBHOOK_PORT=9000 nohup node webhook-server.js >> deploy.log 2>&1 &
```

This checks every 5 minutes if the webhook server is running and restarts it if not.

---

## Step 8: Configure GitHub Webhook

1. Go to: **github.com/Claytonee/Troubleshooting-System → Settings → Webhooks**
2. Click **Add webhook**
3. Fill in:
   - **Payload URL:** `https://troubleshooting.pathfindereducation.or.tz:9000/webhook`
     > If port 9000 is blocked, see "Proxy via cPanel" below
   - **Content type:** `application/json`
   - **Secret:** The `WEBHOOK_SECRET` you generated in Step 7
   - **Which events:** Select **Just the push event**
   - **Active:** ✅ checked
4. Click **Add webhook**

### If Port 9000 is Blocked (common on shared hosting)

Create a proxy route in your Express app instead. Add to the production Node.js app:

```bash
# In cPanel, add a proxy rule:
# /deploy-webhook → localhost:9000/webhook
```

Or use the `.htaccess` approach:
```apache
# In ~/troubleshooting-production/.htaccess
RewriteEngine On
RewriteRule ^webhook$ http://localhost:9000/webhook [P]
```

Then use `https://troubleshooting.pathfindereducation.or.tz/webhook` as the Payload URL.

---

## Step 9: Create Git Branches

On your local machine:

```bash
# Create staging branch from main
git checkout main
git checkout -b staging
git push origin staging

# Create develop branch from main
git checkout main
git checkout -b develop
git push origin develop
```

---

## Step 10: Test the Pipeline

```bash
# Test staging deploy
git checkout staging
echo "# test" >> README.md
git add README.md && git commit -m "test: staging deploy"
git push origin staging

# Check the webhook log on server:
# tail -f ~/troubleshooting-production/deploy/deploy.log
```

---

## Daily Workflow

```
Feature Development:
  develop branch → code & test locally
       ↓
  git push origin develop → auto-deploys to dev server
       ↓ (when ready)
  git checkout staging && git merge develop
  git push origin staging → auto-deploys to staging
       ↓ (after QA approval)
  git checkout main && git merge staging
  git push origin main → auto-deploys to PRODUCTION
```

---

## Troubleshooting

### Check webhook server status
```bash
curl http://localhost:9000/health
```

### View deploy logs
```bash
tail -50 ~/troubleshooting-production/deploy/deploy.log
```

### Manual deploy (if webhook fails)
```bash
cd ~/troubleshooting-production
bash deploy/deploy-production.sh
```

### Restart all apps
```bash
# If using Passenger (cPanel default)
touch ~/troubleshooting-production/tmp/restart.txt
touch ~/troubleshooting-staging/tmp/restart.txt
touch ~/troubleshooting-dev/tmp/restart.txt
```

---

## Database Safety Rules

| Action | Dev DB | Testing DB | Staging DB | Production DB |
|--------|--------|------------|------------|---------------|
| Reset/wipe | ✅ | ✅ | ⚠️ Ask first | ❌ NEVER |
| Seed demo data | ✅ | ✅ | ✅ | ❌ |
| Schema migration | ✅ | ✅ | ✅ | ✅ (additive only) |
| Drop columns | ✅ | ✅ | ⚠️ | ❌ (expand-contract only) |
| Backup before change | Optional | No | Yes | ALWAYS |
