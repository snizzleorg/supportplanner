/**
 * Centralized logging utility
 * 
 * Provides structured logging with different levels and environment-aware behavior.
 * In production, only logs warnings and errors. In development, logs everything.
 * All user-controlled data is sanitized to prevent log injection attacks.
 * 
 * @module utils/logger
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

const CURRENT_LEVEL = process.env.LOG_LEVEL 
  ? LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] 
  : (process.env.NODE_ENV === 'production' ? LOG_LEVELS.WARN : LOG_LEVELS.DEBUG);

/**
 * Sanitize data for logging to prevent log injection
 * @param {any} data - Data to sanitize
 * @returns {string} Sanitized string representation
 * @private
 */
function sanitize(data) {
  if (data === null || data === undefined) return String(data);
  
  // Convert to string and remove control characters
  const str = typeof data === 'object' ? JSON.stringify(data) : String(data);
  return str.replace(/[\x00-\x1F\x7F-\x9F]/g, ''); // Remove control characters
}

/**
 * Format log message with timestamp and context
 * @param {string} level - Log level
 * @param {string} context - Context/module name
 * @param {string} message - Log message
 * @param {any} data - Additional data
 * @returns {string} Formatted log message
 * @private
 */
function formatMessage(level, context, message, data) {
  const timestamp = new Date().toISOString();
  const sanitizedMessage = sanitize(message);
  const contextStr = context ? `[${context}]` : '';
  
  if (data !== undefined) {
    const sanitizedData = sanitize(data);
    return `${timestamp} ${level} ${contextStr} ${sanitizedMessage} ${sanitizedData}`;
  }
  
  return `${timestamp} ${level} ${contextStr} ${sanitizedMessage}`;
}

/**
 * Log error message
 * @param {string} context - Context/module name
 * @param {string} message - Error message
 * @param {any} [data] - Additional data (error object, details, etc.)
 */
export function error(context, message, data) {
  if (CURRENT_LEVEL >= LOG_LEVELS.ERROR) {
    console.error(formatMessage('ERROR', context, message, data));
  }
}

/**
 * Log warning message
 * @param {string} context - Context/module name
 * @param {string} message - Warning message
 * @param {any} [data] - Additional data
 */
export function warn(context, message, data) {
  if (CURRENT_LEVEL >= LOG_LEVELS.WARN) {
    console.warn(formatMessage('WARN', context, message, data));
  }
}

/**
 * Log info message
 * @param {string} context - Context/module name
 * @param {string} message - Info message
 * @param {any} [data] - Additional data
 */
export function info(context, message, data) {
  if (CURRENT_LEVEL >= LOG_LEVELS.INFO) {
    console.log(formatMessage('INFO', context, message, data));
  }
}

/**
 * Log debug message (only in development)
 * @param {string} context - Context/module name
 * @param {string} message - Debug message
 * @param {any} [data] - Additional data
 */
export function debug(context, message, data) {
  if (CURRENT_LEVEL >= LOG_LEVELS.DEBUG) {
    console.log(formatMessage('DEBUG', context, message, data));
  }
}

/**
 * Create a logger instance for a specific context
 * @param {string} context - Context/module name
 * @returns {Object} Logger instance with bound context
 * 
 * @example
 * const logger = createLogger('CalendarService');
 * logger.info('Fetching events', { count: 10 });
 * logger.error('Failed to fetch', error);
 */
export function createLogger(context) {
  return {
    error: (message, data) => error(context, message, data),
    warn: (message, data) => warn(context, message, data),
    info: (message, data) => info(context, message, data),
    debug: (message, data) => debug(context, message, data)
  };
}

/**
 * Get current log level
 * @returns {string} Current log level name
 */
export function getLogLevel() {
  const levelName = Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === CURRENT_LEVEL);
  return levelName || 'UNKNOWN';
}

// Default export for convenience
export default {
  error,
  warn,
  info,
  debug,
  createLogger,
  getLogLevel
};
