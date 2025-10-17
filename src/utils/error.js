/**
 * Error handling utilities
 * 
 * Provides safe error message formatting to prevent information disclosure
 * in production environments.
 * 
 * @module utils/error
 */

/**
 * Format error for API response
 * 
 * In development: Returns full error details including stack trace
 * In production: Returns generic message to prevent information disclosure
 * 
 * @param {Error} error - The error object
 * @param {string} [genericMessage='An error occurred'] - Generic message for production
 * @returns {Object} Formatted error object safe for API response
 * 
 * @example
 * try {
 *   // ... some operation
 * } catch (error) {
 *   res.status(500).json(formatError(error, 'Failed to process request'));
 * }
 */
export function formatError(error, genericMessage = 'An error occurred') {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  return {
    error: isDevelopment ? error.message : genericMessage,
    ...(isDevelopment && { 
      details: error.stack,
      type: error.constructor.name 
    })
  };
}

/**
 * Check if error should be exposed to client
 * 
 * Some errors are safe to show to users (validation errors, not found, etc.)
 * Others should be hidden in production (database errors, internal errors, etc.)
 * 
 * @param {Error} error - The error to check
 * @returns {boolean} True if error message can be shown to client
 */
export function isClientSafeError(error) {
  const clientSafeTypes = [
    'ValidationError',
    'NotFoundError',
    'BadRequestError',
    'UnauthorizedError',
    'ForbiddenError'
  ];
  
  return clientSafeTypes.includes(error.constructor.name) ||
         error.statusCode && error.statusCode < 500;
}

/**
 * Format error with appropriate status code
 * 
 * @param {Error} error - The error object
 * @param {number} [defaultStatus=500] - Default status code
 * @returns {{status: number, body: Object}} Status code and response body
 */
export function formatErrorResponse(error, defaultStatus = 500) {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Determine status code
  let status = defaultStatus;
  if (error.statusCode) {
    status = error.statusCode;
  } else if (error.message.includes('not found')) {
    status = 404;
  } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
    status = 401;
  } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
    status = 403;
  } else if (error.message.includes('412') || error.message.includes('Precondition Failed')) {
    status = 409; // Conflict
  }
  
  // Format error message
  const isClientSafe = isClientSafeError(error) || status < 500;
  const errorMessage = (isDevelopment || isClientSafe) 
    ? error.message 
    : 'An error occurred while processing your request';
  
  return {
    status,
    body: {
      success: false,
      error: errorMessage,
      ...(isDevelopment && {
        details: error.stack,
        type: error.constructor.name
      })
    }
  };
}
