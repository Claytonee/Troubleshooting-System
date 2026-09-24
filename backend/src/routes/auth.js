const express = require('express');
const multer = require('multer');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const authController = require('../controllers/authController');

const router = express.Router();

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
const rateLimit = require('express-rate-limit');
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
router.post('/mfa/setup', authenticate, mfaController.setup);
router.post('/mfa/enable', authenticate, mfaController.enable);
router.post('/mfa/recovery-codes', authenticate, mfaController.regenerateRecovery);
router.post('/mfa/disable', authenticate, mfaController.disable);

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
