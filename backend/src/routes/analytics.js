/**
 * Trend metrics. Any signed-in role may read them; the controller scopes rows
 * to what that role is allowed to see.
 * docs/features/06-trend-metrics.md
 */
const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/analyticsController');

router.use(authenticate);
router.get('/trends', ctrl.trends);

module.exports = router;
