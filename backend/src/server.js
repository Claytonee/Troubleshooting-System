const path = require('path');
const envFile = process.env.NODE_ENV && process.env.NODE_ENV !== 'production'
  ? `.env.${process.env.NODE_ENV}`
  : '.env';
require('dotenv').config({ path: path.resolve(__dirname, '..', envFile) });
if (!require('fs').existsSync(path.resolve(__dirname, '..', envFile))) {
  require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
}
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const schoolRoutes = require('./routes/schools');
const errorRoutes = require('./routes/errors');
const teamRoutes = require('./routes/team');
const schoolAdminRoutes = require('./routes/schoolAdmins');
const auditRoutes = require('./routes/audit');
const searchRoutes = require('./routes/search');
const checkinRoutes = require('./routes/checkins');
const guideRoutes = require('./routes/guides');
const manualRoutes = require('./routes/manuals');
const commRoutes = require('./routes/communications');
const settingsRoutes = require('./routes/settings');
const aiChatRoutes = require('./routes/aiChat');
const registrationRoutes = require('./routes/registration');
const inventoryRoutes = require('./routes/inventory');
const lrsRoutes = require('./routes/lrs');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

// Force HTTPS in production (the DirectAdmin proxy terminates SSL and sets
// x-forwarded-proto; redirect any plain-http hit back to https).
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(301, 'https://' + req.headers.host + req.url);
    }
    next();
  });
}

// Security middleware.
// NOTE on CSP: the SPA relies on inline event handlers (onclick=) and inline
// style attributes, so script-src/style-src must keep 'unsafe-inline' — that
// means CSP is defense-in-depth here (it blocks external script origins,
// object/embed, and <base> hijacking), NOT the primary XSS control. Output
// escaping via esc() is the primary control. Removing inline handlers later
// would let us drop 'unsafe-inline' from script-src.
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdn.jsdelivr.net'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdn.jsdelivr.net'],
      imgSrc: ["'self'", 'data:', 'https:'],
      mediaSrc: ["'self'", 'https:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'self'"],
      formAction: ["'self'"]
    }
  },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? (process.env.FRONTEND_URL || true) : '*',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 200 : 1000,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Auth endpoint has stricter rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many login attempts, please try again later.' }
});
app.use('/api/auth/login', authLimiter);

const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many registration attempts, please try again later.' }
});
app.use('/api/register/school-admin', registrationLimiter);
app.use('/api/register/teacher/register', registrationLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('short'));
}

// Serve frontend (new modular structure).
// no-cache on JS/CSS/HTML so browsers always revalidate and pick up new deploys
// (the SPA has no build step / content hashing, so aggressive caching = stale UI).
app.use(express.static(path.join(__dirname, '..', '..', 'frontend'), {
  setHeaders: (res, filePath) => {
    if (/\.(js|css|html)$/i.test(filePath)) res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  }
}));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/schools', schoolRoutes);
app.use('/api/errors', errorRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/school-admins', schoolAdminRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/checkins', checkinRoutes);
app.use('/api/guides', guideRoutes);
app.use('/api/manuals', manualRoutes);
app.use('/api/communications', commRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/ai', aiChatRoutes);
app.use('/api/register', registrationRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/lrs', lrsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// GitHub webhook auto-deploy (environment-aware)
const crypto = require('crypto');
const { execSync } = require('child_process');
const BRANCH_ENV = { 'refs/heads/main': 'main', 'refs/heads/staging': 'staging', 'refs/heads/develop': 'develop' };
const CURRENT_ENV = process.env.NODE_ENV || 'production';
const ENV_BRANCH = { production: 'main', staging: 'staging', development: 'develop' };

app.post('/api/deploy', express.json({ limit: '1mb' }), (req, res) => {
  const secret = process.env.WEBHOOK_SECRET || process.env.DEPLOY_SECRET || '';
  // Fail closed. With no secret configured this endpoint would run
  // `git reset --hard` + `npm install` + restart for any anonymous POST.
  if (!secret) {
    console.error('[DEPLOY] Rejected: WEBHOOK_SECRET is not set, refusing to deploy unauthenticated');
    return res.status(503).json({ error: 'Deploy webhook is not configured.' });
  }
  const sig = 'sha256=' + crypto.createHmac('sha256', secret).update(JSON.stringify(req.body)).digest('hex');
  const expected = Buffer.from(sig);
  const received = Buffer.from(String(req.headers['x-hub-signature-256'] || ''));
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    return res.status(403).json({ error: 'Invalid signature' });
  }

  const ref = req.body.ref;
  const pushedBranch = BRANCH_ENV[ref];
  const myBranch = ENV_BRANCH[CURRENT_ENV] || 'main';

  if (ref && pushedBranch !== myBranch) {
    return res.json({ status: 'skipped', reason: `Push to ${ref}, this instance tracks ${myBranch}` });
  }

  const pusher = req.body.pusher?.name || 'unknown';
  const commitMsg = req.body.head_commit?.message?.split('\n')[0] || '';
  console.log(`[DEPLOY] Push by ${pusher}: "${commitMsg}" → deploying ${myBranch}`);

  try {
    const fs = require('fs');
    const appRoot = path.join(__dirname, '..', '..');   // the git checkout
    const backendDir = path.join(appRoot, 'backend');   // Passenger's application root
    const git = (cmd, opts = {}) => execSync(`git ${cmd}`, { cwd: appRoot, timeout: 30000, encoding: 'utf8', ...opts }).trim();

    // Keep anything hot-fixed directly on the server — the reset below is unforgiving.
    const dirty = git('status --porcelain');
    if (dirty) {
      const dir = path.join(appRoot, 'deploy', 'backups');
      fs.mkdirSync(dir, { recursive: true });
      const patch = path.join(dir, `pre-deploy-${new Date().toISOString().replace(/[:.]/g, '-')}.patch`);
      fs.writeFileSync(patch, git('diff HEAD'));
      console.log(`[DEPLOY] Saved server-side edits to ${patch}`);
    }

    git(`fetch origin ${myBranch}`);
    const target = git(`rev-parse origin/${myBranch}`);
    if (target === git('rev-parse HEAD')) {
      console.log('[DEPLOY] Already up to date, nothing to do');
      return res.json({ status: 'up-to-date', commit: target.slice(0, 7) });
    }
    // Never roll production backwards: two remotes feed this repo, and a remote
    // sitting behind HEAD must not be able to undo newer commits.
    try {
      git(`merge-base --is-ancestor HEAD ${target}`);
    } catch {
      console.error(`[DEPLOY] Refused: origin/${myBranch} (${target}) is not a descendant of HEAD`);
      return res.status(409).json({ error: 'Remote is not ahead of the deployed commit.' });
    }
    git(`reset --hard ${target}`);

    // Dependencies go in backend/, never the repo root: CloudLinux NodeJS Selector
    // owns the application root's node_modules as a symlink into its virtualenv and
    // refuses to work when a real directory of that name sits there.
    // `npm install`, not `npm ci` — ci deletes node_modules first, which fights the
    // symlink. The wrapper's exit status is unreliable, so verify the result instead.
    try {
      execSync('npm install --omit=dev', { cwd: backendDir, timeout: 180000, encoding: 'utf8' });
    } catch (e) {
      console.error('[DEPLOY] npm install reported failure:', e.message);
    }
    if (!fs.existsSync(path.join(backendDir, 'node_modules', 'express', 'package.json'))) {
      throw new Error('dependencies missing after npm install (node_modules/express not found)');
    }

    // Ask Passenger to respawn. Its restart file lives inside its application
    // root, so backend/tmp — not the repo root's tmp.
    fs.mkdirSync(path.join(backendDir, 'tmp'), { recursive: true });
    fs.writeFileSync(path.join(backendDir, 'tmp', 'restart.txt'), '');
    console.log(`[DEPLOY] Deployed ${target.slice(0, 7)} — Passenger restart requested`);
    res.json({ status: 'deployed', branch: myBranch, commit: target.slice(0, 7), timestamp: new Date().toISOString() });
  } catch (e) {
    // git/npm output can carry absolute server paths — log it, don't return it.
    console.error('[DEPLOY] Failed:', e.message);
    res.status(500).json({ error: 'Deploy failed. See server logs.' });
  }
});

// Serve frontend for non-API routes
app.get('*', (req, res) => {
  res.set('Cache-Control', 'no-cache, must-revalidate');
  res.sendFile(path.join(__dirname, '..', '..', 'frontend', 'index.html'));
});

// Error handler
app.use(errorHandler);

/**
 * Where is the pool actually pointing? DATABASE_URL silently wins over every
 * DB_* var (see config/database.js), so print the source that is really in use
 * — with credentials stripped — instead of DB_HOST, which may be ignored.
 */
function describeDbTarget() {
  if (process.env.DATABASE_URL) {
    try {
      const u = new URL(process.env.DATABASE_URL);
      return `${u.hostname}:${u.port || 3306}${u.pathname} (from DATABASE_URL — DB_* vars are ignored)`;
    } catch {
      return 'unparseable DATABASE_URL (DB_* vars are ignored)';
    }
  }
  return `${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}/${process.env.DB_NAME || 'qft_support'}`;
}

/** Connectivity failures, as opposed to a bad query or a schema problem. */
const DB_UNREACHABLE = {
  ENOTFOUND: 'the hostname does not resolve — the database may have been deleted, or the host is misspelt',
  EAI_AGAIN: 'DNS lookup for the database host failed — check the hostname and the server DNS',
  ECONNREFUSED: 'nothing is listening on that host and port',
  ETIMEDOUT: 'the connection timed out — check firewall or remote-access rules',
  EHOSTUNREACH: 'the host is unreachable from this server',
  ER_ACCESS_DENIED_ERROR: 'the database user or password is wrong, or the user lacks privileges on that database',
  ER_BAD_DB_ERROR: 'that database name does not exist on the server'
};

async function checkDatabase() {
  const pool = require('./config/database');
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (e) {
    const why = DB_UNREACHABLE[e.code];
    console.error('\n  ***  DATABASE UNREACHABLE  ***');
    console.error(`  Target: ${describeDbTarget()}`);
    console.error(`  Error:  ${e.code || 'unknown'} — ${why || e.message}`);
    if (process.env.DATABASE_URL) {
      console.error('  Note:   DATABASE_URL is set, so DB_HOST/DB_USER/DB_NAME are being IGNORED.');
      console.error('          To use a local database, unset DATABASE_URL in the hosting panel first.');
    }
    console.error('  The site will load but every data request will answer 503 until this is fixed.\n');
    return false;
  }
}

async function autoMigrate() {
  const { bootstrap } = require('./config/bootstrap');
  try {
    await bootstrap();
    console.log('  Database: migrated OK');
  } catch (e) {
    console.error('  Database migration warning:', e.message);
    console.error(e.stack);
  }
}

app.listen(PORT, async () => {
  console.log(`\n  Quest Forward Tanzania - Technical Support System`);
  console.log(`  ================================================`);
  console.log(`  Server running on http://localhost:${PORT}`);
  console.log(`  API base:         http://localhost:${PORT}/api`);
  console.log(`  Environment:      ${process.env.NODE_ENV || 'development'}`);
  console.log(`  Database:         ${describeDbTarget()}`);
  if (await checkDatabase()) await autoMigrate();
  console.log(`  ================================================\n`);
});

module.exports = app;
