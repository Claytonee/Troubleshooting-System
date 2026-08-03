require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

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
    if (/\.(js|css|html)$/i.test(filePath)) res.setHeader('Cache-Control', 'no-cache, must-revalidate');
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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// Serve frontend for non-API routes
app.get('*', (req, res) => {
  res.set('Cache-Control', 'no-cache, must-revalidate');
  res.sendFile(path.join(__dirname, '..', '..', 'frontend', 'index.html'));
});

// Error handler
app.use(errorHandler);

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
  console.log(`  Database:         ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
  await autoMigrate();
  console.log(`  ================================================\n`);
});

module.exports = app;
