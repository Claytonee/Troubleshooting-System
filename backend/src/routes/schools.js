const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const schoolController = require('../controllers/schoolController');

const router = express.Router();

router.use(authenticate);

router.get('/', authorize('admin', 'subadmin', 'school'), schoolController.getAll);
router.get('/:id', authorize('admin', 'subadmin', 'school'), schoolController.getById);

router.post('/', [
  authorize('admin'),
  body('name').notEmpty().withMessage('School name is required'),
  body('it_email').optional({ checkFalsy: true }).isEmail().withMessage('IT personnel email must be valid'),
  body('coordinator_email').optional({ checkFalsy: true }).isEmail().withMessage('Coordinator email must be valid'),
  body('contact_email').optional({ checkFalsy: true }).isEmail().withMessage('Contact email must be valid'),
  validate
], schoolController.create);

router.put('/:id', [
  authorize('admin'),
  body('name').notEmpty().withMessage('School name is required'),
  validate
], schoolController.update);

router.patch('/:id/assign', [
  authorize('admin'),
  body('admin_id').optional(),
  validate
], schoolController.reassignAdmin);

router.delete('/:id', authorize('admin'), schoolController.remove);

module.exports = router;
