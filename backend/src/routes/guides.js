const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const guideController = require('../controllers/guideController');

const router = express.Router();

router.use(authenticate);

router.get('/', guideController.getAll);
router.get('/:id', guideController.getById);

// Any authenticated role can escalate a guide that didn't solve their issue.
router.post('/:id/escalate', guideController.escalate);

router.post('/', [
  authorize('admin'),
  body('title').notEmpty().withMessage('Guide title is required'),
  body('steps').isArray({ min: 1 }).withMessage('At least one step is required'),
  validate
], guideController.create);

router.put('/:id', [
  authorize('admin'),
  body('title').notEmpty().withMessage('Guide title is required'),
  body('steps').isArray({ min: 1 }).withMessage('At least one step is required'),
  validate
], guideController.update);

router.delete('/:id', authorize('admin'), guideController.remove);

module.exports = router;
