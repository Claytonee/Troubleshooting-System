const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const checkinController = require('../controllers/checkinController');

const router = express.Router();

router.use(authenticate, authorize('admin', 'subadmin', 'school'));

router.get('/', checkinController.getAll);
router.get('/stats', checkinController.getStats);
router.get('/school/:schoolId', checkinController.getBySchool);

router.post('/', [
  body('school_id').isInt().withMessage('School ID is required'),
  body('week_number').isInt({ min: 1, max: 52 }).withMessage('Week number must be between 1 and 52'),
  body('status').isIn(['green', 'amber', 'red']).withMessage('Status must be green, amber, or red'),
  // The form only ever sends ok/issue. Unchecked, these were free text rendered
  // into a platform admin's check-in modal (SEC-003).
  body(['connectivity', 'tablets', 'platform', 'power']).optional({ values: 'falsy' })
    .isIn(['ok', 'issue']).withMessage('Must be ok or issue'),
  validate
], checkinController.createOrUpdate);

module.exports = router;
