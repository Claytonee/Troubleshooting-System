const express = require('express');
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { requireInventoryWrite } = require('../middleware/permissions');
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

// Writes: role OR an explicit per-teacher grant (see middleware/permissions.js).
router.post('/', requireInventoryWrite, [
  body('serial_number').notEmpty().withMessage('Serial number is required'),
  validate
], ctrl.create);

router.put('/:id', requireInventoryWrite, ctrl.update);
router.patch('/:id/assign', requireInventoryWrite, ctrl.assignDevice);
router.patch('/:id/status', requireInventoryWrite, [
  body('status').isIn(['Working', 'Needs Setup', 'In Repair', 'Faulty', 'Lost/Missing']).withMessage('Invalid status'),
  validate
], ctrl.changeStatus);

router.post('/bulk-import', requireInventoryWrite, ctrl.bulkImport);
// Delete stays with head office — a school admin cannot delete a device, so a
// teacher they delegate to cannot either.
router.delete('/:id', authorize('admin', 'subadmin'), ctrl.remove);

module.exports = router;
