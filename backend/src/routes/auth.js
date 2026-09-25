const express = require('express');
const multer = require('multer');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const authController = require('../controllers/authController');
const tourController = require('../controllers/tourController');

const router = express.Router();
const rateLimit = require('express-rate-limit');

// Forgotten-password recovery (D32): per-network throttles on every step, plus a
// per-identifier one on start. Built by a factory so the suite can prove the 429
// with the same limiter at a small limit (middleware/recoveryLimits.js).
const recoveryLimits = require('../middleware/recoveryLimits').create();

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed'));
  }
});

router.post('/login', [
  body('username').notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required'),
  validate
], authController.login);

router.post('/recovery/start', recoveryLimits.startIp, recoveryLimits.startAccount, [
  body('identifier').isString().trim().isLength({ min: 3, max: 255 }).withMessage('Enter your username or email.'),
  validate
], authController.startRecovery);

router.post('/recovery/verify', recoveryLimits.verifyIp, [
  body('flow').isString().isLength({ min: 43, max: 43 }).withMessage('This recovery has expired. Start again.'),
  body('email_code').optional({ values: 'falsy' }).isString().isLength({ max: 20 }),
  body('totp_code').optional({ values: 'falsy' }).isString().isLength({ max: 20 }),
  body('recovery_code').optional({ values: 'falsy' }).isString().isLength({ max: 40 }),
  validate
], authController.verifyRecovery);

router.post('/recovery/complete', recoveryLimits.completeIp, [
  body('flow').isString().isLength({ min: 43, max: 43 }).withMessage('This recovery has expired. Start again.'),
  body('reset_token').isString().isLength({ min: 43, max: 43 }).withMessage('This recovery has expired. Start again.'),
  body('new_password').isString().isLength({ min: 8, max: 1024 }).withMessage('Password must be at least 8 characters.'),
  validate
], authController.completeRecovery);

router.post('/register', [
  authenticate,
  authorize('admin'),
  body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('full_name').notEmpty().withMessage('Full name is required'),
  body('role').isIn(['admin', 'subadmin', 'school']).withMessage('Valid role is required'),
  validate
], authController.register);

router.get('/profile', authenticate, authController.getProfile);
// Two-step sign-in (SEC-007, D4). /verify is public — it is the second step of
// signing in — and carries its own throttle: 10 attempts per account per 15
// minutes in production against a million possible codes.
const mfaController = require('../controllers/mfaController');
const mfaVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 10 : 100,
  keyGenerator: (req) => {
    // Keyed by the account inside the ticket (read without verifying: a fairness
    // key, not a decision — verify() checks the signature), else by address.
    try {
      const p = JSON.parse(Buffer.from(String(req.body.ticket || '').split('.')[1], 'base64url').toString('utf8'));
      if (p && p.id) return 'mfa-u' + p.id;
    } catch (e) { /* fall through */ }
    return 'mfa-ip' + (req.ip || 'unknown');
  },
  message: { error: 'Too many codes tried. Wait fifteen minutes and sign in again.' }
});
router.post('/mfa/verify', mfaVerifyLimiter, mfaController.verify);
router.get('/mfa', authenticate, mfaController.status);
// Trusted browsers (D33): list and forget, own account only — no id of another account can be named.
router.get('/mfa/trusted', authenticate, mfaController.trustedList);
router.delete('/mfa/trusted', authenticate, mfaController.trustedForget);
router.delete('/mfa/trusted/:id', authenticate, mfaController.trustedForget);
router.post('/mfa/setup', authenticate, mfaController.setup);
router.post('/mfa/enable', authenticate, mfaController.enable);
router.post('/mfa/recovery-codes', authenticate, mfaController.regenerateRecovery);
router.post('/mfa/disable', authenticate, mfaController.disable);
router.post('/mfa/assist-reset', authenticate, authorize('admin', 'subadmin', 'school'), [
  body('user_id').isInt({ min: 1 }).withMessage('Choose the person to help.'),
  body('code').isString().notEmpty().withMessage('Enter a current code from your authenticator app.'),
  body('reset_password').optional().isBoolean(),
  validate
], mfaController.assistReset);

// Guided tours: where this account got to (D27). Own account only — there is no id to pass.
router.get('/tour', authenticate, tourController.get);
router.put('/tour/:id', authenticate, tourController.update);

// Reading language (feature 14). On the account, not the device: tablets are shared.
router.get('/language', authenticate, authController.getLanguage);
router.put('/language', authenticate, authController.setLanguage);

// Sign this account out on every device (SEC-005).
router.post('/sessions/revoke-all', authenticate, authController.revokeAllSessions);
router.put('/profile', authenticate, authController.updateProfile);
router.post('/profile/avatar', authenticate, (req, res, next) => {
  avatarUpload.single('avatar')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'File upload failed' });
    next();
  });
}, authController.uploadAvatar);

router.put('/change-password', [
  authenticate,
  body('current_password').notEmpty().withMessage('Current password is required'),
  body('new_password').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
  validate
], authController.changePassword);

module.exports = router;
