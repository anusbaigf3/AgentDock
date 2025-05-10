const { createLogger } = require('../utils/logger');
const logger = createLogger('errorHandler');

/**
 * Custom error handler middleware for Express
 */
const errorHandler = (err, req, res, next) => {
  // Log the error
  logger.error('Error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  // Create error response
  const error = {
    status: 'error',
    message: err.message || 'Server Error'
  };

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    error.stack = err.stack;
  }

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    error.message = Object.values(err.errors)
      .map(val => val.message)
      .join(', ');
    return res.status(400).json(error);
  }

  // Handle Mongoose duplicate key errors
  if (err.code === 11000) {
    error.message = `Duplicate field value: ${Object.keys(err.keyValue).join(
      ', '
    )}. Please use another value.`;
    return res.status(400).json(error);
  }

  // Handle Mongoose CastError (invalid ID)
  if (err.name === 'CastError') {
    error.message = `Resource not found with id of ${err.value}`;
    return res.status(404).json(error);
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    error.message = 'Invalid token';
    return res.status(401).json(error);
  }

  if (err.name === 'TokenExpiredError') {
    error.message = 'Token expired';
    return res.status(401).json(error);
  }

  // Return error response with appropriate status code
  res.status(err.statusCode || 500).json(error);
};

module.exports = errorHandler;
