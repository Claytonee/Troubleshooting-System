# cPanel Deployment — QFT Technical Support System

Live host: **cPanel / CloudLinux on `213.139.204.238`**, serving
**`support.mkatolikikiganjani.com`**. One Node.js application, one database.

The document root is the directory `~/troubleshooting.pathfindereducation.or.tz/`, named after the hostname retired on
2026-09-08 — **filesystem paths keep that name, URLs do not.** The old hostname still resolves here and is answered with
404 by `RETIRED_HOSTS` in `backend/src/server.js`.

> Rewritten 2026-09-07 after the previous version was tested against the real host and
> found wrong in six places. The **why** notes below are the reasons — read them before
> "simplifying" a step.

---

## 1. Architecture on this host

```
~/troubleshooting.pathfindereducation.or.tz/     <- git checkout, and the subdomain document root
├── backend/                                     <- PASSENGER APPLICATION ROOT
│   ├── src/server.js                            <-   startup file
│   ├── .env                                     <-   the only config the app reads
│   ├── node_modules -> ~/nodevenv/.../18/...    <-   symlink, managed by CloudLinux
│   ├── package.json                             <-   the real dependency list (14 deps)
│   └── tmp/restart.txt                          <-   touch this to restart
├── frontend/                                    <- served by Express, code-relative
├── deploy/
└── package.json                                 <- runner scripts only, ZERO dependencies
```

**Why the application root is `backend/`, not the repo root.** CloudLinux NodeJS
Selector insists on owning the application root's `node_modules` as a symlink into a
virtualenv, and refuses to run `npm` at all when a real directory of that name sits
there:

```
Cloudlinux NodeJS Selector demands to store node modules for application in
separate folder (virtual environment) pointed by symlink called "node_modules".
That's why application should not contain folder/file with such name in application root
```

The dependency list lives in `backend/package.json`, so `backend/` has to be the
application root for `npm install` and the panel's **Run NPM Install** button to work.
Pointing the application root at the repo root cannot work — the root `package.json`
declares **zero** dependencies.

Moving the application root does **not** break the frontend. `express.static` and the
SPA fallback both resolve `path.join(__dirname, '..', '..', 'frontend')`, which is
code-relative, so they still find the repo's `frontend/` whatever Passenger's
application root is.

---

## 2. First-time setup

### 2.1 Get the code

```bash
cd ~
git clone https://github.com/Claytonee/Troubleshooting-System.git troubleshooting.pathfindereducation.or.tz
```

The folder name only has to match the subdomain's document root. Nothing in `deploy/`
hardcodes it — the scripts derive `APP_DIR` from their own location.

### 2.2 Database

cPanel → **MySQL Databases**:

1. Create the database and a user.
2. **Add User To Database** → grant **ALL PRIVILEGES**. Creating both without linking
   them produces `ER_ACCESS_DENIED_ERROR`, which reads exactly like a wrong password.

Both names carry the cPanel account prefix (currently `pathfind_`). Use the full
prefixed names — those are what MySQL knows.

### 2.3 Node.js application

cPanel → **Setup Node.js App** → *Create Application*:

| Field | Value |
|---|---|
| Node.js version | 18.x or newer (`backend/package.json` requires `>=18`) |
| Application mode | Production |
| **Application root** | `troubleshooting.pathfindereducation.or.tz/backend` |
| Application URL | `troubleshooting.pathfindereducation.or.tz`, path left empty |
| **Application startup file** | `src/server.js` — relative to the application root |

Leave **Environment variables** empty and use `backend/.env` (§2.4) instead. Panel
variables silently override the file, so mixing the two makes the effective config
impossible to read off disk. Pick one place; this project picks the file.

> **Changing the application root of an existing app** makes cPanel *move* the old
> root's contents into the new one, and it aborts on any name collision:
> `shutil.Error: Destination path '.../tmp' already exists`. Move the colliding entries
> out of the old root first. It also expects the virtualenv at
> `~/nodevenv/<old app root>/<version>` and fails with `Unable to find app venv folder`
> if it is not there. Destroying and recreating the application avoids both.

### 2.4 Configuration — `backend/.env`

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=<prefixed mysql user>
DB_PASSWORD=<mysql password>
DB_NAME=<prefixed database name>
JWT_SECRET=<openssl rand -hex 32>
JWT_EXPIRES_IN=7d
MAX_FILE_SIZE=104857600
WEBHOOK_SECRET=<openssl rand -hex 32>
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

```bash
chmod 600 ~/troubleshooting.pathfindereducation.or.tz/backend/.env
```

`NODE_ENV` comes from *Application mode*; do not set it here. **Never set
`DATABASE_URL`** — it overrides every `DB_*` variable above, and that is how a deleted
Aiven host survived config changes and took the site down on 2026-09-07.

> **Which `.env` gets read.** Current code resolves the path from `__dirname`
> (`backend/src/server.js:5`, `backend/src/config/database.js:5`), so it is always
> **`backend/.env`** — the process working directory is irrelevant. Code at or before
> `9231be9` (Aug 2026) called bare `dotenv.config()` and so read `<cwd>/.env`, which
> under Passenger meant the **repo root** `.env`. Upgrading past that commit therefore
> moves the file the app reads. dotenv says nothing about a missing file, so the app
> boots with defaults (`localhost`, user `root`, empty password) and fails at the first
> query with no explanation. **On a host still running the old code, make both files
> identical before deploying.**

### 2.5 Dependencies

```bash
source ~/nodevenv/troubleshooting.pathfindereducation.or.tz/backend/18/bin/activate
cd ~/troubleshooting.pathfindereducation.or.tz/backend
npm install --omit=dev
```

or use the panel's **Run NPM Install**. Then confirm it actually worked:

```bash
ls node_modules/express/package.json
```

When the Selector's `npm` wrapper refuses, it **exits 1** and prints the reason, so its
status is worth checking — measured on this host. Read it from `PIPESTATUS` if you pipe
the output anywhere, or `$?` gives you the last command in the pipe instead. Check that
the files exist as well: a zero exit does not prove the tree is usable.

The virtualenv path follows the application root, so it changes whenever the root does.
Destroying an application removes its virtualenv; the one recreated with root
`…/backend` lives at `~/nodevenv/<checkout>/backend/<version>/`, not
`~/nodevenv/<checkout>/<version>/`. Activating the wrong one runs a dead virtualenv's
node, or the system's.

Never run `npm` in the repo root. If a real `node_modules` directory already exists
there — it can be created while the application root is mis-set — delete it once the
`backend/` install is confirmed. Node's upward module resolution will otherwise quietly
serve packages from it and mask something missing in `backend/`.

### 2.6 DNS and TLS

The hostname may still point elsewhere; it was a Render custom domain until
2026-09-07. Test cPanel without touching DNS:

```bash
curl --resolve support.mkatolikikiganjani.com:443:213.139.204.238 https://support.mkatolikikiganjani.com/api/health
```

`--resolve` is the reliable form. Sending a `Host:` header to `http://<ip>/` can land on
the account's default vhost instead (`cgi-sys/defaultwebpage.cgi`), and it tells you
nothing about the certificate. `{"status":"ok"}` plus `Server: LiteSpeed` in the headers
means the cPanel app is healthy; a handshake that completes without `--insecure` means
the certificate is valid too.

Then:

1. cPanel → **Zone Editor** → replace any `troubleshooting` CNAME with an
   **A record → `213.139.204.238`** (TTL 300). Edit the existing record rather than
   deleting and re-adding it, so the name is never briefly absent.
2. Remove the custom domain from the Render service, or it keeps claiming the name.
3. **Certificate:** on this account the host's Let's Encrypt integration already covers
   the subdomain, and there is no **SSL/TLS Status** page to run AutoSSL from (the URL
   404s). Verify with the `--resolve` command above rather than assuming. If a
   certificate is ever missing, it matters: the app 301-redirects all HTTP to HTTPS, so
   every visitor would meet a TLS warning.

> **Checking propagation: do not run `getent hosts` or `nslookup` on the cPanel server.**
> It resolves its own hosted domains locally and will return `213.139.204.238` the moment
> the zone is edited, whether or not the world can see it. Ask the authoritative
> nameservers, then a public resolver, and compare:
> ```bash
> nslookup troubleshooting.pathfindereducation.or.tz ns23.oneway.africa   # the zone's own answer
> nslookup troubleshooting.pathfindereducation.or.tz 8.8.8.8              # what the public sees
> ```
> The old CNAME's TTL governs how long stale answers survive, not the new record's, so
> propagation can outlast the 300s you just set.

> **Lower the TTL a day before you plan to move, not on the day.** The 2026-09-07 move
> was published with TTL 300, but the CNAME being replaced had been cached with the
> zone default of 86400, so resolvers kept the old answer for hours: Cloudflare and
> Quad9 picked up the new address within minutes while Google and OpenDNS were still
> returning Render more than an hour later. That produces a genuine split brain — some
> visitors on the new host, some on the old — so make sure **both** targets are in a
> serviceable state before switching, and remove the old host's claim on the domain
> only once a public resolver agrees. Read the remaining TTL with
> `dig +noall +answer @8.8.8.8 <host>` (or `nslookup -debug`) to get a real ETA rather
> than guessing.

### 2.7 First login

`bootstrap()` runs on every start, creates the schema when the database is empty, and
seeds demo data plus an `admin` user with password `admin123` (override with
`ADMIN_PASSWORD` before the first boot). A password change is forced at first login.
Seeding only happens when no `admin` user exists, so restarts never touch existing data.

---

## 3. Deploying new code

### 3.1 Webhook on port 443 (recommended)

`POST /api/deploy` is part of the app, so it is already covered by the existing
LiteSpeed certificate.

GitHub → repo → *Settings* → **Webhooks** → *Add webhook*:

| Field | Value |
|---|---|
| Payload URL | `https://support.mkatolikikiganjani.com/api/deploy` |
| Content type | `application/json` |
| Secret | the same value as `WEBHOOK_SECRET` in `backend/.env` |
| Events | Just the push event |

The endpoint **fails closed**: with no `WEBHOOK_SECRET` set it answers `503` rather
than accepting anonymous POSTs, and signatures are compared with `timingSafeEqual`. It
then backs up any server-side edits into `deploy/backups/`, fetches `origin`, refuses
the push unless the remote commit is a descendant of `HEAD` — so a stale remote cannot
roll production backwards — resets, installs dependencies in `backend/`, verifies
`node_modules/express` exists, and touches `backend/tmp/restart.txt`.

> **Do not use `deploy/webhook-server.js` on port 9000.** It is a plain-HTTP Node
> server while the TLS certificate is terminated by LiteSpeed on 443, so an
> `https://…:9000/` payload URL cannot complete a handshake — even if the host firewall
> allowed inbound 9000, which on shared hosting it generally does not.

### 3.2 Cron polling (if inbound webhooks are blocked)

cPanel → **Cron Jobs**, every 5 minutes:

```
*/5 * * * * ~/troubleshooting.pathfindereducation.or.tz/deploy/deploy-production.sh >> ~/troubleshooting.pathfindereducation.or.tz/deploy/deploy.log 2>&1
```

`deploy-production.sh` is a thin wrapper over `deploy/deploy.sh`, which exits early
when there is nothing new, holds a lock against concurrent runs, and applies the same
fast-forward-only guard as the webhook.

### 3.3 Verifying a deploy actually landed

**A `git reset --hard` on its own looks like a successful deploy and is not one.**
Express reads `frontend/` off disk on every request, so the new `index.html` and its
`?v=` bumps appear the instant the reset finishes — while the Node process keeps
running the *old* `server.js` until Passenger respawns it. On 2026-09-07 this cost
hours: the homepage looked freshly deployed and seven webhook deliveries were blamed on
a broken secret, when the webhook was fine and the process had simply never restarted.

A manual reset must be followed by a restart (§3.4). `deploy.sh` and `POST /api/deploy`
both touch the restart file for you.

Then run all four checks — the first two can pass while the deploy has not landed, so
they are not sufficient on their own:

| Check | Proves | Expected |
|---|---|---|
| `curl --resolve support.mkatolikikiganjani.com:443:213.139.204.238 https://support.mkatolikikiganjani.com/` | Express static + new frontend | 200 HTML containing the current `app.js?v=` |
| `curl --resolve support.mkatolikikiganjani.com:443:213.139.204.238 -I https://support.mkatolikikiganjani.com/css/components.css` | **Express** is serving static, not LiteSpeed | `cache-control: no-store, no-cache, must-revalidate` — set only by our `setHeaders` (`server.js:121`) — plus `content-type: text/css` |
| `curl --resolve support.mkatolikikiganjani.com:443:213.139.204.238 https://support.mkatolikikiganjani.com/lrs` | the SPA catch-all `res.sendFile` | 200 HTML, not 404 |
| `curl --resolve support.mkatolikikiganjani.com:443:213.139.204.238 https://support.mkatolikikiganjani.com/api/lrs` | **the backend process actually restarted** | `401 application/json` |

The last row is the one that matters. `/api/lrs` is a route that exists only in current
code; an old process falls through to the SPA catch-all and answers **200 text/html**.
That single difference distinguishes "new code running" from "new files on disk". Pick a
similarly recent route whenever this one stops being new.

The second row matters for a different reason: after moving the application root, the
homepage can still be served while `express.static` is dead, so a 200 on `/` alone
proves nothing. The `no-store` header is the provenance check.

### 3.4 Restarting by hand

```bash
touch ~/troubleshooting.pathfindereducation.or.tz/backend/tmp/restart.txt
```

The restart file lives inside **Passenger's application root**, which is `backend/` —
not the repo root. Never restart with `pkill -f "node.*server.js"`: on shared hosting
that pattern matches every other Node application owned by the same cPanel user.

---

## 4. Troubleshooting

| Symptom | Cause |
|---|---|
| `Cannot find module 'express'` | `npm install` ran in the repo root, whose `package.json` has no dependencies. Install in `backend/`. |
| Selector refuses `npm`, mentions a `node_modules` symlink | A real `node_modules` directory exists in the application root. Remove it. |
| `ER_ACCESS_DENIED_ERROR` | Wrong `DB_PASSWORD`, or the user was never added to the database with ALL PRIVILEGES. |
| `ER_BAD_DB_ERROR` | `DB_NAME` is missing the account prefix, or names a different database than the one granted. |
| `ENOTFOUND` on a database host | The database no longer exists — check the hostname with `nslookup` before touching config. |
| Every API call answers 503 | Startup logged `DATABASE UNREACHABLE`; read the log, it names the target actually in use and translates the driver code. |
| Config edits have no effect | A panel environment variable is overriding the file, or `DATABASE_URL` is set, or the running code predates `9231be9` and is reading the repo root `.env`. |
| Site loads but shows a TLS warning | AutoSSL has not issued a certificate for the subdomain since the DNS move. |
| `shutil.Error: Destination path ... already exists` on Save | Changing an existing app's root; cPanel is moving the old root's contents and hit a name collision. |

Startup log:

```bash
tail -40 ~/troubleshooting.pathfindereducation.or.tz/stderr.log
```

A healthy boot prints the database target actually in use, with credentials masked,
followed by `Database: migrated OK`.
