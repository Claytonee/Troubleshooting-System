const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const errorController = require('../controllers/errorController');

const router = express.Router();

// Public CSAT submission via tokenised link (must be registered before authenticate).
router.post('/csat/:token', [
  body('rating').isInt({ min: 0, max: 5 }).withMessage('Rating must be 0-5'),
  validate
], errorController.submitCsat);

router.use(authenticate);

router.get('/', errorController.getAll);
router.get('/stats', errorController.getStats);
router.get('/export', authorize('admin', 'subadmin'), errorController.exportErrors);
router.get('/:id', errorController.getById);

router.post('/', [
  body('title').notEmpty().withMessage('Error title is required'),
  body('school_id').isInt().withMessage('School ID is required'),
  body('category').isIn(['Connectivity', 'Hardware', 'Platform', 'Power', 'Accounts', 'Other']).withMessage('Valid category is required'),
  body('priority').optional().isIn(['critical', 'high', 'medium', 'low']),
  validate
], errorController.create);

router.put('/:id', [
  authorize('admin', 'subadmin'),
  body('title').notEmpty().withMessage('Error title is required'),
  validate
], errorController.update);

router.patch('/:id/status', [
  body('status').isIn(['open', 'progress', 'escalated', 'resolved']).withMessage('Valid status is required'),
  validate
], errorController.updateStatus);

router.post('/:id/updates', [
  body('note').notEmpty().withMessage('Update note is required'),
  validate
], errorController.addUpdate);

router.post('/:id/escalate', authorize('school'), errorController.escalateToAdmin);

router.delete('/:id', authorize('admin'), errorController.remove);

module.exports = router;
