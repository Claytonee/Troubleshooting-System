/**
 * Which address a request came from — and when we cannot know (SEC-015, DECISIONS.md D28).
 *
 * Measured on production 2026-09-24 (TEST_RESULTS.md): the host's LiteSpeed
 * proxy trusts a client-sent X-Forwarded-For. A request with no such header
 * reaches the app carrying exactly ONE address, written by the proxy from the
 * real connection. A request that sends one reaches it as the client's list
 * plus the proxy's copy of the client's leftmost claim:
 *
 *     client sends            app receives                 Express's req.ip
 *     (nothing)               197.186.57.130               the real address
 *     203.0.113.77            203.0.113.77, 203.0.113.77,203.0.113.77   203.0.113.77 (forged)
 *
 * The real address is then in no header at all, so no code here can recover
 * it. What we can do is notice: more than one address means the client wrote
 * the header (the site is HTTPS-only, so no school proxy on the way can add
 * one). Such a request is attributed to 0.0.0.0 — "address unspecified" —
 * rather than to whatever it claims:
 *   - every rate limit keyed by address puts all claimed requests in ONE bucket,
 *     so rotating fake addresses no longer buys a fresh allowance;
 *   - security events record 0.0.0.0 with the claim kept in their detail, so an
 *     attacker cannot frame someone else's address or hide in a new one each time;
 *   - the audit trail says "unknown" instead of repeating a lie.
 * The fix for the cause is the host's setting; see RECOVERY/SESSION_HANDOFF.
 */
const UNKNOWN = '0.0.0.0';

function attribute(req) {
  const raw = req.headers['x-forwarded-for'];
  if (!raw) return null;
  const entries = String(raw).split(',').map(s => s.trim()).filter(Boolean);
  if (entries.length <= 1) return null;          // the proxy's own single entry: trusted
  return entries[0].slice(0, 45);                // what the client claimed to be
}

/** First middleware: overrides req.ip for requests whose address is a client claim. */
function middleware(req, res, next) {
  const claimed = attribute(req);
  if (claimed !== null) {
    Object.defineProperty(req, 'ip', { value: UNKNOWN, configurable: true, enumerable: true });
    req.ipClaimed = claimed;
  }
  next();
}

module.exports = { middleware, attribute, UNKNOWN };
