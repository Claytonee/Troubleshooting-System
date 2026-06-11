const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const authController = require('../controllers/authController');

const router = express.Router();

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

router.put('/change-password', [
  authenticate,
  body('current_password').notEmpty().withMessage('Current password is required'),
  body('new_password').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
  validate
], authController.changePassword);

module.exports = router;
