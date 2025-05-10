const winston = require('winston');
const path = require('path');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format for readability
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(
    ({ timestamp, level, message, label = '', ...meta }) => {
      return `${timestamp} ${level} [${label}]: ${message} ${
        Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
      }`;
    }
  )
);

/**
 * Create a logger with the given module name
 * @param {string} module - Module name for identification
 * @returns {object} Winston logger instance
 */
const createLogger = (module) => {
  const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: logFormat,
    defaultMeta: { service: 'agentdock', module },
    transports: [
      // Write logs to console
      new winston.transports.Console({
        format: consoleFormat,
      }),
      // Write all logs to `logs/agentdock.log`
      new winston.transports.File({
        filename: path.join('logs', 'agentdock.log'),
        level: 'info',
      }),
      // Write error logs to `logs/error.log`
      new winston.transports.File({
        filename: path.join('logs', 'error.log'),
        level: 'error',
      }),
    ],
  });

  // If we're not in production, also log to the console with prettier format
  if (process.env.NODE_ENV !== 'production') {
    logger.add(
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        ),
      })
    );
  }

  return logger;
};

module.exports = { createLogger };
