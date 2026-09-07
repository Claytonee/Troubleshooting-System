#!/bin/bash
# ============================================================
# QFT Technical Support System — shared deploy routine.
# Called by deploy-production.sh / deploy-staging.sh / deploy-development.sh.
#
# Written for cPanel + CloudLinux NodeJS Selector, where Passenger's
# APPLICATION ROOT IS backend/, not the repo root. See deploy/CPANEL-SETUP.md.
# ============================================================

set -euo pipefail

DEPLOY_ENV="${DEPLOY_ENV:?DEPLOY_ENV must be set by the calling wrapper}"
BRANCH="${BRANCH:?BRANCH must be set by the calling wrapper}"

# Derived from this script's own location, so it does not care what the checkout
# folder is called. On the live host it is ~/troubleshooting.pathfindereducation.or.tz,
# which is nothing like the "troubleshooting-production" the old doc assumed.
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$APP_DIR/backend"
# Passenger watches tmp/restart.txt *inside its application root* = backend/.
RESTART_FILE="$BACKEND_DIR/tmp/restart.txt"
LOCK_FILE="$APP_DIR/deploy/.deploy-lock"
LOG_FILE="$APP_DIR/deploy/deploy.log"
BACKUP_DIR="$APP_DIR/deploy/backups"
HEALTH_URL="${HEALTH_URL:-https://troubleshooting.pathfindereducation.or.tz/api/health}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$DEPLOY_ENV] $1" | tee -a "$LOG_FILE"; }
die() { log "ERROR: $1"; exit 1; }

if [ -f "$LOCK_FILE" ]; then
  die "another deployment is in progress (remove $LOCK_FILE if stale)"
fi
trap 'rm -f "$LOCK_FILE"' EXIT
echo $$ > "$LOCK_FILE"

log "=== deploy start: $BRANCH -> $APP_DIR ==="
cd "$APP_DIR"

# ------------------------------------------------------------
# 1. Preserve anything edited directly on the server.
#    `git reset --hard` below is unforgiving, and people DO hot-fix in place.
# ------------------------------------------------------------
mkdir -p "$BACKUP_DIR"
PATCH="$BACKUP_DIR/pre-deploy-$(date '+%Y%m%d-%H%M%S').patch"
if ! git diff --quiet HEAD; then
  git diff HEAD > "$PATCH"
  log "server-side edits saved to $PATCH (restore with: git apply <patch>)"
else
  log "working tree clean, no backup needed"
fi

# ------------------------------------------------------------
# 2. Fast-forward only. Two remotes feed this repo; a remote sitting behind
#    HEAD must never be allowed to roll production backwards.
# ------------------------------------------------------------
git fetch origin "$BRANCH" || die "git fetch failed"
TARGET="$(git rev-parse "origin/$BRANCH")"
if [ "$TARGET" = "$(git rev-parse HEAD)" ]; then
  log "already at $TARGET, nothing to deploy"
  exit 0
fi
git merge-base --is-ancestor HEAD "$TARGET" \
  || die "origin/$BRANCH ($TARGET) is not a descendant of HEAD — refusing to deploy backwards"

log "resetting to $TARGET"
git reset --hard "$TARGET"

# ------------------------------------------------------------
# 3. Dependencies — inside backend/, which is the Selector's application root.
#    NEVER run npm in the repo root: CloudLinux replaces the app root's
#    node_modules with a symlink into the virtualenv and refuses to operate
#    when a real directory of that name sits there.
#
#    Measured on this host: when the wrapper refuses it exits 1 and prints the
#    reason, so its status IS worth checking — but read it from PIPESTATUS,
#    because the pipe into tee would otherwise hand us tee's status instead.
# ------------------------------------------------------------
cd "$BACKEND_DIR"
log "installing dependencies in $BACKEND_DIR"
set +e
npm install --omit=dev 2>&1 | tee -a "$LOG_FILE"
NPM_STATUS=${PIPESTATUS[0]}
set -e
[ "$NPM_STATUS" -eq 0 ] || die "npm install exited $NPM_STATUS — see $LOG_FILE"
# Belt and braces: a zero exit still does not prove the tree is usable.
if [ ! -e node_modules/express/package.json ]; then
  die "dependencies missing after npm install (node_modules/express not found) — check the Selector virtualenv"
fi
log "dependencies present: $(ls node_modules | wc -l) entries"

# ------------------------------------------------------------
# 4. Config. Deliberately NOT copied from .env.<env>: backend/.env holds the
#    live database password, and overwriting it with a template took the site
#    down once already. Deploy verifies, it does not author config.
# ------------------------------------------------------------
if [ ! -f "$BACKEND_DIR/.env" ]; then
  die "$BACKEND_DIR/.env is missing — the app would boot with defaults and fail to reach the database"
fi
for KEY in DB_HOST DB_USER DB_NAME JWT_SECRET; do
  grep -q "^$KEY=" "$BACKEND_DIR/.env" || log "WARNING: $KEY is not set in backend/.env"
done
grep -q "^DATABASE_URL=" "$BACKEND_DIR/.env" \
  && log "WARNING: DATABASE_URL is set — it overrides every DB_* var (see CLAUDE.md)"

# ------------------------------------------------------------
# 5. Restart. Passenger only. No pkill: on shared hosting
#    `pkill -f "node.*server.js"` matches every other Node app owned by the
#    same cPanel user and would take unrelated sites down with it.
# ------------------------------------------------------------
mkdir -p "$BACKEND_DIR/tmp"
touch "$RESTART_FILE"
log "Passenger restart requested via $RESTART_FILE"

# Schema migrations are idempotent and run from bootstrap() on every boot,
# so the restart above is the migration step. Nothing to do here.

# ------------------------------------------------------------
# 6. Health check against the real hostname. There is no fixed port under
#    Passenger — it assigns one per spawn — so probing localhost:3000 is
#    meaningless. /api/health is used because it touches no rate limiter.
# ------------------------------------------------------------
sleep 5
CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$HEALTH_URL" || echo 000)"
case "$CODE" in
  200) log "health check OK (HTTP 200 from $HEALTH_URL)" ;;
  000) log "WARNING: health check unreachable — app may still be spawning, or DNS does not point here yet" ;;
  *)   log "WARNING: health check returned HTTP $CODE" ;;
esac

log "=== deploy complete: $(git rev-parse --short HEAD) ==="
