#!/bin/bash
# ============================================================
# QFT Technical Support System — Development Deployment
# Triggered by: push to 'develop' branch
# ============================================================

set -euo pipefail

DEPLOY_ENV="development"
BRANCH="develop"
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$APP_DIR/backend"
ENV_FILE="$BACKEND_DIR/.env.development"
LOCK_FILE="$APP_DIR/deploy/.deploy-lock-dev"
LOG_FILE="$APP_DIR/deploy/deploy.log"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [DEV] $1" | tee -a "$LOG_FILE"; }

if [ -f "$LOCK_FILE" ]; then
  log "ERROR: Another dev deployment is in progress."
  exit 1
fi
trap 'rm -f "$LOCK_FILE"' EXIT
echo $$ > "$LOCK_FILE"

log "=== Starting development deployment ==="

cd "$APP_DIR"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

log "Installing dependencies..."
cd "$BACKEND_DIR"
npm install

if [ -f "$ENV_FILE" ]; then
  cp "$ENV_FILE" "$BACKEND_DIR/.env"
  log "Environment file loaded: .env.development"
fi

log "Running database migrations..."
node src/config/migrate.js 2>&1 || log "Migration warnings (non-fatal)"

log "Restarting dev app..."
if command -v pm2 &>/dev/null; then
  pm2 restart qft-dev 2>/dev/null || pm2 start "$BACKEND_DIR/src/server.js" --name qft-dev
else
  pkill -f "node.*server.js.*dev" 2>/dev/null || true
  sleep 1
  cd "$BACKEND_DIR"
  NODE_ENV=development nohup node src/server.js >> "$LOG_FILE" 2>&1 &
  log "Server restarted (PID: $!)"
fi

log "=== Development deployment complete ==="
