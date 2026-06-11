function errorHandler(err, req, res, next) {
  console.error(`[ERROR] ${err.message}`, err.stack);

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body.' });
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large. Maximum size is 5MB.' });
  }

  res.status(err.statusCode || 500).json({
    error: err.message || 'Internal server error.',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}

module.exports = errorHandler;
