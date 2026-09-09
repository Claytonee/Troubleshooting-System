/**
 * Preventive maintenance routes.
 * docs/features/11-preventive-maintenance.md
 *
 * Reading is open to every signed-in role and scoped inside the controller — a
 * school administrator should not have to ask an engineer what is due at their
 * own school. Signing a check off is a field action, so it stays with the people
 * who carry the checks out.
 */
const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/maintenanceController');

router.use(authenticate);

// Static paths only here, so there is no /:id to shadow them.
router.get('/tasks', ctrl.tasks);
router.get('/due', ctrl.due);
router.post('/:taskId/done', authorize('admin', 'subadmin', 'school'), ctrl.markDone);

module.exports = router;
