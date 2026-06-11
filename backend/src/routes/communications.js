const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const commController = require('../controllers/communicationController');

const router = express.Router();

router.use(authenticate);

router.get('/', commController.getAll);

router.post('/', [
  body('school_id').isInt().withMessage('School ID is required'),
  body('note').notEmpty().withMessage('Note is required'),
  validate
], commController.create);

router.delete('/:id', authorize('admin', 'subadmin'), commController.remove);

module.exports = router;
