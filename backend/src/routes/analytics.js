/**
 * Trend metrics. Any signed-in role may read them; the controller scopes rows
 * to what that role is allowed to see.
 * docs/features/06-trend-metrics.md
 */
const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/analyticsController');

router.use(authenticate);
// Aggregates over a whole school are a management view. The controller scopes
// rows per role, but a teacher has no page for this and no business with the
// school's totals — the endpoint should not answer them at all.
router.use(authorize('admin', 'subadmin', 'school'));
router.get('/trends', ctrl.trends);

module.exports = router;
