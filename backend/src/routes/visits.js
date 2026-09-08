/**
 * Visit planner routes — admin and sub-admins only. School admins and teachers
 * report faults; they do not plan field trips.
 * docs/features/05-visit-planner.md
 */
const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/visitController');

router.use(authenticate);
router.use(authorize('admin', 'subadmin'));

// Static paths before /:id, or Express reads "queue" as an id.
router.get('/queue', ctrl.queue);
router.get('/suggestions/:schoolId', ctrl.suggestions);
router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.get('/:id', ctrl.getById);
router.patch('/:id', ctrl.update);

module.exports = router;
