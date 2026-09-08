/**
 * LRS heartbeat routes. Neither endpoint uses a user session: the LRS agent and
 * the cron job have no login. Each carries a shared secret in a header instead.
 * docs/features/01-lrs-heartbeat.md
 */
const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { receive, sweep, requireSecret } = require('../controllers/heartbeatController');

// ~13 schools beating every 5 minutes is ~156 requests/hour. This ceiling is
// far above that but still bounds a misconfigured agent stuck in a loop.
const heartbeatLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many heartbeats.' }
});

router.post('/', heartbeatLimiter, requireSecret('HEARTBEAT_KEY', 'X-Heartbeat-Key'), receive);
router.post('/sweep', requireSecret('WEBHOOK_SECRET', 'X-Webhook-Secret'), sweep);

module.exports = router;
