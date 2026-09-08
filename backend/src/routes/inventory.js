const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/inventoryController');

const router = express.Router();
router.use(authenticate);

router.get('/', ctrl.getAll);
router.get('/stats', ctrl.getStats);
router.get('/export', ctrl.exportDevices);
// Lifecycle reports (feature 4). Both before /:id, or Express would read
// "refresh-plan" as an id.
router.get('/refresh-plan', ctrl.refreshPlan);
router.get('/batches', ctrl.batches);
router.get('/:id', ctrl.getById);

router.post('/', authorize('admin', 'subadmin', 'school'), [
  body('serial_number').notEmpty().withMessage('Serial number is required'),
  validate
], ctrl.create);

router.put('/:id', authorize('admin', 'subadmin', 'school'), ctrl.update);
router.patch('/:id/assign', authorize('admin', 'subadmin', 'school'), ctrl.assignDevice);
router.patch('/:id/status', authorize('admin', 'subadmin', 'school'), [
  body('status').isIn(['Working', 'Needs Setup', 'In Repair', 'Faulty', 'Lost/Missing']).withMessage('Invalid status'),
  validate
], ctrl.changeStatus);

router.post('/bulk-import', authorize('admin', 'subadmin', 'school'), ctrl.bulkImport);
router.delete('/:id', authorize('admin', 'subadmin'), ctrl.remove);

module.exports = router;
