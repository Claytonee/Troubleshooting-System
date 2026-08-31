#!/bin/bash
# ============================================================
# QFT Technical Support System — Production Deployment
# Triggered by: push to 'main' branch
# ============================================================

set -euo pipefail

DEPLOY_ENV="production"
BRANCH="main"
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$APP_DIR/backend"
ENV_FILE="$BACKEND_DIR/.env.production"
LOCK_FILE="$APP_DIR/deploy/.deploy-lock"
LOG_FILE="$APP_DIR/deploy/deploy.log"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [PRODUCTION] $1" | tee -a "$LOG_FILE"; }

# Prevent concurrent deployments
if [ -f "$LOCK_FILE" ]; then
  log "ERROR: Another deployment is in progress. Remove $LOCK_FILE if stale."
  exit 1
fi
trap 'rm -f "$LOCK_FILE"' EXIT
echo $$ > "$LOCK_FILE"

log "=== Starting production deployment ==="

# 1. Pull latest code
log "Pulling latest from origin/$BRANCH..."
cd "$APP_DIR"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

# 2. Install dependencies
log "Installing backend dependencies..."
cd "$BACKEND_DIR"
npm ci --omit=dev

# 3. Copy environment file
if [ -f "$ENV_FILE" ]; then
  cp "$ENV_FILE" "$BACKEND_DIR/.env"
  log "Environment file loaded: .env.production"
else
  log "WARNING: .env.production not found — using existing .env"
fi

# 4. Run migrations (safe, idempotent)
log "Running database migrations..."
node src/config/migrate.js 2>&1 || log "Migration warnings (non-fatal)"

# 5. Restart the application
log "Restarting application..."
if command -v passenger &>/dev/null; then
  # cPanel uses Phusion Passenger for Node.js
  mkdir -p "$APP_DIR/tmp"
  touch "$APP_DIR/tmp/restart.txt"
  log "Passenger restart triggered"
elif command -v pm2 &>/dev/null; then
  pm2 restart qft-production 2>/dev/null || pm2 start "$BACKEND_DIR/src/server.js" --name qft-production
  log "PM2 restart completed"
else
  # Fallback: kill existing and restart
  pkill -f "node.*server.js" 2>/dev/null || true
  sleep 1
  cd "$BACKEND_DIR"
  NODE_ENV=production nohup node src/server.js >> "$LOG_FILE" 2>&1 &
  log "Server restarted (PID: $!)"
fi

# 6. Health check
sleep 3
PORT=$(grep -oP 'PORT=\K\d+' "$BACKEND_DIR/.env" 2>/dev/null || echo "3000")
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/api/auth/login" -X POST -H "Content-Type: application/json" -d '{}' 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "000" ]; then
  log "WARNING: Health check failed — server may still be starting"
else
  log "Health check: HTTP $HTTP_CODE"
fi

log "=== Production deployment complete ==="
