/**
 * USSD and inbound SMS callbacks (Africa's Talking).
 * Design: docs/features/08-phone-intake.md
 *
 * No `authenticate` here on purpose: the caller is a handset on the Vodacom or
 * Airtel network, not a session. The shared secret in the callback URL is the
 * authentication, checked inside the controller so a missing key fails closed
 * with a message the caller can actually read.
 *
 * Africa's Talking posts form-encoded bodies, so these routes get their own
 * urlencoded parser rather than relying on the global JSON one.
 */
const express = require('express');
const ctrl = require('../controllers/phoneIntakeController');

const router = express.Router();
const form = express.urlencoded({ extended: false, limit: '32kb' });

router.post('/ussd', form, ctrl.ussd);
router.post('/sms/inbound', form, express.json({ limit: '32kb' }), ctrl.smsInbound);

module.exports = router;
