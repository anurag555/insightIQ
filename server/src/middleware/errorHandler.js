function errorHandler(err, req, res, next) {
  console.error('[Error Handler]', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.originalUrl,
    method: req.method,
  });

  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'An internal server error occurred';

  res.status(statusCode).json({
    success: false,
    error: message,
    code: err.code || 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV === 'development' && { details: err.stack })
  });
}

module.exports = errorHandler;
