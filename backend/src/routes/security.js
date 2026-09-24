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
  // The forwarding headers as they ARRIVE here, after the host's proxy: the only
  // way to learn, from outside, which of them the proxy writes and which it
  // passes through from the client. They are the caller's own request, echoed
  // back to the caller; nothing another person could not already see.
  const h = (n) => (req.headers[n] === undefined ? null : String(req.headers[n]).slice(0, 200));
  res.json({
    ip: req.ip,
    // true when the address was the client's own claim (SEC-015): ip is then 0.0.0.0.
    claimed: req.ipClaimed !== undefined,
    headers: {
      'x-forwarded-for': h('x-forwarded-for'), 'x-real-ip': h('x-real-ip'), forwarded: h('forwarded'),
      'x-client-ip': h('x-client-ip'), 'x-forwarded-proto': h('x-forwarded-proto')
    },
    socket_is_loopback: /^(::1|127\.|::ffff:127\.)/.test(req.socket.remoteAddress || '')
  });
});

/**
 * POST /api/security/csp-report — public: browsers send it without a session.
 * Its own parser (the CSP content types are not application/json) with a 16 KB
 * cap. Aggregated, never stored per request (services/cspReports.js).
 */
router.post('/csp-report',
  express.json({ type: ['application/csp-report', 'application/reports+json', 'application/json'], limit: '16kb' }),
  (req, res) => { require('../services/cspReports').ingest(req); res.status(204).end(); });

// Posture facts for the whole platform: platform admin only. A school admin
// must never read another school's accounts, or the platform's configuration.
router.use(authenticate);
router.use(authorize('admin'));

router.get('/overview', ctrl.overview);
// Incidents from the detection rules (D5 b): alert-only, reviewed by a person.
router.get('/incidents', ctrl.incidents);
router.patch('/incidents/:id', ctrl.updateIncident);
router.get('/incidents/:id/evidence', ctrl.incidentEvidence);

module.exports = router;
