#!/bin/bash
# ============================================================
# QFT Technical Support System — Staging Deployment
# Triggered by: push to 'staging' branch
# ============================================================

set -euo pipefail

DEPLOY_ENV="staging"
BRANCH="staging"
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$APP_DIR/backend"
ENV_FILE="$BACKEND_DIR/.env.staging"
LOCK_FILE="$APP_DIR/deploy/.deploy-lock-staging"
LOG_FILE="$APP_DIR/deploy/deploy.log"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [STAGING] $1" | tee -a "$LOG_FILE"; }

if [ -f "$LOCK_FILE" ]; then
  log "ERROR: Another staging deployment is in progress."
  exit 1
fi
trap 'rm -f "$LOCK_FILE"' EXIT
echo $$ > "$LOCK_FILE"

log "=== Starting staging deployment ==="

cd "$APP_DIR"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

log "Installing dependencies..."
cd "$BACKEND_DIR"
npm ci --omit=dev

if [ -f "$ENV_FILE" ]; then
  cp "$ENV_FILE" "$BACKEND_DIR/.env"
  log "Environment file loaded: .env.staging"
fi

log "Running database migrations..."
node src/config/migrate.js 2>&1 || log "Migration warnings (non-fatal)"

log "Restarting staging app..."
if command -v passenger &>/dev/null; then
  mkdir -p "$APP_DIR/tmp"
  touch "$APP_DIR/tmp/restart.txt"
elif command -v pm2 &>/dev/null; then
  pm2 restart qft-staging 2>/dev/null || pm2 start "$BACKEND_DIR/src/server.js" --name qft-staging
else
  pkill -f "node.*server.js.*staging" 2>/dev/null || true
  sleep 1
  cd "$BACKEND_DIR"
  NODE_ENV=staging nohup node src/server.js >> "$LOG_FILE" 2>&1 &
  log "Server restarted (PID: $!)"
fi

sleep 3
PORT=$(grep -oP 'PORT=\K\d+' "$BACKEND_DIR/.env" 2>/dev/null || echo "3001")
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/" 2>/dev/null || echo "000")
log "Health check: HTTP $HTTP_CODE"

log "=== Staging deployment complete ==="
