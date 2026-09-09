const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const guideController = require('../controllers/guideController');

const router = express.Router();

router.use(authenticate);

router.get('/', guideController.getAll);

// Static paths MUST come before /:id, or Express reads "suggest" as an id and
// answers 404 — which is exactly what it did the first time these were added.
router.get('/suggest', guideController.suggestGuides);
router.get('/performance', authorize('admin'), guideController.performance);

router.get('/:id', guideController.getById);

// Any authenticated role can say a guide fixed it, or that it did not.
router.post('/:id/helped', guideController.markHelped);
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
