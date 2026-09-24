const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/securityController');

const router = express.Router();

/**
 * GET /api/security/seen-as — public. The address this server attributes the
 * request to, and nothing else: the caller already knows their own address.
 * It exists to verify, from outside, that a forged X-Forwarded-For cannot change
 * it (THREAT_MODEL T9) — the precondition for any IP-based decision (D5 a).
 */
router.get('/seen-as', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ ip: req.ip });
});

// Posture facts for the whole platform: platform admin only. A school admin
// must never read another school's accounts, or the platform's configuration.
router.use(authenticate);
router.use(authorize('admin'));

router.get('/overview', ctrl.overview);

module.exports = router;
