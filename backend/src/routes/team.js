const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const teamController = require('../controllers/teamController');

const router = express.Router();

router.use(authenticate);
router.use(authorize('admin'));

router.get('/', teamController.getAll);
router.get('/:id', teamController.getById);

router.post('/', [
  body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('full_name').notEmpty().withMessage('Full name is required'),
  validate
], teamController.create);

router.put('/:id', [
  body('full_name').notEmpty().withMessage('Full name is required'),
  validate
], teamController.update);

router.patch('/:id/schools', [
  body('school_ids').isArray().withMessage('School IDs must be an array'),
  validate
], teamController.assignSchools);

router.patch('/:id/reset-password', teamController.resetPassword);

router.delete('/:id', teamController.remove);

module.exports = router;
