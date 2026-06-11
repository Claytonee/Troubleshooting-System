const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getAll, update } = require('../controllers/settingsController');

router.get('/', getAll);
router.put('/', authenticate, authorize('admin'), update);

module.exports = router;
