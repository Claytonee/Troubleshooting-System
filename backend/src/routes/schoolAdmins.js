const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const schoolAdminController = require('../controllers/schoolAdminController');

const router = express.Router();

// All school-admin management is platform-admin only.
router.use(authenticate);
router.use(authorize('admin'));

router.get('/', schoolAdminController.getAll);
router.get('/:id', schoolAdminController.getById);

router.post('/', [
  body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('full_name').notEmpty().withMessage('Full name is required'),
  body('school_id').notEmpty().withMessage('A school must be assigned'),
  validate
], schoolAdminController.create);

router.put('/:id', [
  body('full_name').notEmpty().withMessage('Full name is required'),
  validate
], schoolAdminController.update);

// Blank means "generate a temporary password" (SEC-016); a typed one is checked by
// services/passwords.js in the controller — 8 characters, never a published one.
router.patch('/:id/password', schoolAdminController.resetPassword);

router.delete('/:id', schoolAdminController.remove);

module.exports = router;
