const logger = require('./logger');

/**
 * Global Express error handler middleware.
 */
function errorHandler(err, req, res, next) {
  logger.error(err.message, { stack: err.stack });

  // Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      error: 'File too large. Maximum size is 50MB.',
    });
  }

  // Multer errors
  if (err.name === 'MulterError') {
    return res.status(400).json({
      success: false,
      error: `Upload error: ${err.message}`,
    });
  }

  // Generic errors
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: process.env.NODE_ENV === 'production'
      ? 'An internal error occurred'
      : err.message,
  });
}

module.exports = errorHandler;
