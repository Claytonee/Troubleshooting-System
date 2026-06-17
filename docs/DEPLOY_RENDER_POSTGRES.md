# Deploy to Render with PostgreSQL

The system now uses **PostgreSQL** (migrated from MySQL). Backend + frontend run as one
Render web service; the database is **Render Managed PostgreSQL** (persistent, auto-backups on paid plans).

## One-time setup

### Option A — Blueprint (recommended)
1. Push this repo to GitLab (branch with `render.yaml`).
2. In Render: **New → Blueprint**, connect the repo. Render reads `render.yaml` and creates:
   - the web service `qft-support-system`
   - a managed Postgres `qft-db` (wired via `DATABASE_URL` automatically)
3. ⚠️ **Persistence:** the `free` Postgres plan is **deleted after 30 days**. In the Render
   dashboard, upgrade `qft-db` to a **paid plan** (e.g. basic-256mb) so data persists + gets backups.
4. Fill optional env vars on the web service (Cloudinary, SMTP, Africa's Talking) if/when ready.
5. Deploy. On first boot the app **auto-creates all tables and seeds** the default admin.

### Option B — Manual
1. Render → **New → PostgreSQL** → create (choose a **paid plan** for persistence). Copy its **Internal Database URL**.
2. Render → **New → Web Service** → connect repo, root dir `backend`, build `npm install`, start `node src/server.js`.
3. Set env vars on the web service:
   - `NODE_ENV=production`
   - `DATABASE_URL=<internal database url>`  (or set `DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME` individually)
   - `DB_SSL=true`
   - `JWT_SECRET=<random 64 chars>`, `JWT_EXPIRES_IN=7d`
   - `UPLOAD_DIR=./uploads`, `MAX_FILE_SIZE=5242880`
   - Cloudinary + SMTP + Africa's Talking keys as needed
4. Deploy.

## Login after deploy
`admin` / `admin123` (change immediately).

## Notes
- **No manual migration step needed** — `node src/server.js` runs `bootstrap()` on startup, which
  creates the schema, applies feature extensions (audit/SLA/CSAT), and seeds an empty DB. Idempotent.
- `DB_SSL=true` is required for Render Postgres. Locally we run Postgres without SSL (`DB_SSL=false`).
- The old Aiven/MySQL config (and `ca.pem`) is no longer used.
- Connection precedence in `config/database.js`: `DATABASE_URL` if set, else `DB_*` vars.
