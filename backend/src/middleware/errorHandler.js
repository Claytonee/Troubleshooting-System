// Connection-level failures: the database is unreachable, not the caller's fault.
// Worth their own status so operators can tell "DB down" from "code bug" without
// exposing the host, credentials or driver internals to the client.
const DB_DOWN_CODES = new Set([
  'ENOTFOUND',                 // hostname does not resolve (e.g. the DB was deleted)
  'EAI_AGAIN',                 // DNS lookup failed / temporary resolver failure
  'ECONNREFUSED',              // nothing listening on that port
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ER_ACCESS_DENIED_ERROR',    // wrong DB user/password
  'ER_BAD_DB_ERROR',           // database name does not exist
  'ER_CON_COUNT_ERROR',
  'PROTOCOL_CONNECTION_LOST'
]);

function errorHandler(err, req, res, next) {
  // Full detail stays server-side — this is what the cPanel/Render log view shows.
  console.error(`[ERROR] ${req.method} ${req.originalUrl} — ${err.code || 'no-code'}: ${err.message}`, err.stack);

  const isDev = process.env.NODE_ENV === 'development';
  // Only in development do we echo the real message back to the caller.
  const detail = isDev ? { detail: err.message, code: err.code, stack: err.stack } : {};

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body.' });
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large. Maximum size is 5MB.' });
  }

  // Deliberate, user-facing errors: keep the message. Controllers currently answer
  // 4xx with res.status().json() directly and never reach here, but honour an
  // explicit statusCode so `err.statusCode = 4xx` keeps working if it is ever used.
  if (err.statusCode >= 400 && err.statusCode < 500) {
    return res.status(err.statusCode).json({ error: err.message || 'Request could not be processed.' });
  }

  if (DB_DOWN_CODES.has(err.code)) {
    return res.status(503).json({
      error: 'The service is temporarily unavailable. Please try again shortly.',
      ...detail
    });
  }

  // Anything else is an unexpected fault: log it, tell the caller nothing specific.
  res.status(err.statusCode || 500).json({
    error: 'A server error occurred. Please try again.',
    ...detail
  });
}

module.exports = errorHandler;
