/**
 * Two answers the libraries would otherwise give for us (DECISIONS.md D26).
 *
 * JWT_VERIFY — which token algorithms are a session. We issue HS256 only;
 * without `algorithms`, jsonwebtoken also accepted HS384 and HS512 under the
 * same secret (SEC-013). Every jwt.verify() in src/ passes this, and
 * verify-token-policy.js fails on any call that does not.
 *
 * corsOrigin — which other websites' scripts get a cross-origin answer. The
 * SPA is served from the API's own origin and every integration (WhatsApp,
 * Africa's Talking, the LRS heartbeat, the deploy webhook) is server-to-server,
 * so in production nobody else needs one (SEC-014). FRONTEND_URL, when set,
 * names the exceptions (comma-separated).
 */
const JWT_VERIFY = Object.freeze({ algorithms: ['HS256'] });

function corsOrigin(env = process.env) {
  if (env.NODE_ENV !== 'production') return '*';
  const list = String(env.FRONTEND_URL || '').split(',').map(s => s.trim()).filter(Boolean);
  return list.length ? list : false;
}

module.exports = { JWT_VERIFY, corsOrigin };
