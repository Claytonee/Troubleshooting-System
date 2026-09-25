const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

/**
 * Throttles for forgotten-password recovery (DECISIONS.md D32).
 *
 * Each step has its own limit per network; the start step is also limited per
 * identifier, keyed by a SHA-256 digest so no username or email is kept inside
 * the limiter. Every flow also allows only five code attempts (accountRecovery.js).
 *
 * A factory, not module constants, so verify-account-recovery.js can build the
 * very same limiter with a small limit and prove the 429 without firing a hundred
 * padded requests. `create()` with no argument gives the production numbers.
 */
const PROD = process.env.NODE_ENV === 'production';
const WINDOW_MS = 15 * 60 * 1000;

// Production limits, and the looser ones every other environment uses so the
// verification suites do not throttle themselves.
const DEFAULTS = {
  startIp:      PROD ? 20 : 200,
  startAccount: PROD ? 5 : 100,
  verifyIp:     PROD ? 30 : 300,
  completeIp:   PROD ? 10 : 100
};

const identifierKey = (req) => 'rec-' + crypto.createHash('sha256')
  .update(String((req.body && req.body.identifier) || '').trim().toLowerCase()).digest('hex');

function limiter(name, max, error, keyGenerator) {
  const mw = rateLimit({
    windowMs: WINDOW_MS, max, standardHeaders: true, legacyHeaders: false,
    ...(keyGenerator ? { keyGenerator } : {}), message: { error }
  });
  mw.limiterName = name;   // lets a test find which limiters a route mounts
  mw.limiterMax = max;
  return mw;
}

function create(overrides = {}) {
  const m = { ...DEFAULTS, ...overrides };
  const again = 'Too many recovery requests. Wait fifteen minutes and try again.';
  return {
    startIp: limiter('recoveryStartIp', m.startIp, again),
    startAccount: limiter('recoveryStartAccount', m.startAccount, again, identifierKey),
    verifyIp: limiter('recoveryVerifyIp', m.verifyIp, 'Too many codes tried. Wait fifteen minutes and start again.'),
    completeIp: limiter('recoveryCompleteIp', m.completeIp, 'Too many attempts. Wait fifteen minutes and start again.')
  };
}

module.exports = { create, DEFAULTS, identifierKey };
