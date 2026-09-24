const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/securityController');

const router = express.Router();

// Posture facts for the whole platform: platform admin only. A school admin
// must never read another school's accounts, or the platform's configuration.
router.use(authenticate);
router.use(authorize('admin'));

router.get('/overview', ctrl.overview);

module.exports = router;
