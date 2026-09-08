/**
 * WhatsApp webhook routes. No user session: Meta calls these.
 * GET  authenticates with WHATSAPP_VERIFY_TOKEN (the subscription handshake).
 * POST authenticates every payload with an HMAC over the raw body.
 * docs/features/03-whatsapp-intake.md
 */
const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { verify, inbound } = require('../controllers/whatsappController');

// Meta delivers in bursts and retries, so this is generous — it exists to bound
// a misbehaving caller, not to shape normal traffic.
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many webhook deliveries.' }
});

router.get('/webhook', verify);
router.post('/webhook', webhookLimiter, inbound);

module.exports = router;
