/**
 * Retry utility for network operations
 * Implements exponential backoff with jitter
 */

/**
 * Sleep for a given number of milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retries (default: 3)
 * @param {number} options.initialDelay - Initial delay in ms (default: 1000)
 * @param {number} options.maxDelay - Maximum delay in ms (default: 10000)
 * @param {Function} options.shouldRetry - Function to determine if error should be retried (default: retry on network errors)
 * @param {Function} options.onRetry - Callback called before each retry with (error, attempt)
 * @returns {Promise<any>} Result of the function
 * @throws {Error} Last error if all retries fail
 */
export async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    shouldRetry = defaultShouldRetry,
    onRetry = null
  } = options;

  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry if this is the last attempt
      if (attempt === maxRetries) {
        break;
      }
      
      // Check if we should retry this error
      if (!shouldRetry(error, attempt)) {
        throw error;
      }
      
      // Calculate delay with exponential backoff and jitter
      const exponentialDelay = initialDelay * Math.pow(2, attempt);
      const jitter = Math.random() * 0.3 * exponentialDelay; // ±30% jitter
      const delay = Math.min(exponentialDelay + jitter, maxDelay);
      
      console.log(`[Retry] Attempt ${attempt + 1}/${maxRetries} failed, retrying in ${Math.round(delay)}ms...`, error.message);
      
      // Call onRetry callback if provided
      if (onRetry) {
        onRetry(error, attempt + 1);
      }
      
      await sleep(delay);
    }
  }
  
  throw lastError;
}

/**
 * Default retry logic - retry on network errors and 5xx server errors
 * Don't retry on 4xx client errors (except 408 Request Timeout and 429 Too Many Requests)
 * @param {Error} error - The error to check
 * @param {number} attempt - Current attempt number
 * @returns {boolean} True if should retry
 */
function defaultShouldRetry(error, attempt) {
  // Network errors (fetch failed)
  if (error.message.includes('fetch') || error.message.includes('network')) {
    return true;
  }
  
  // Check HTTP status if available
  if (error.status) {
    // Retry on 5xx server errors
    if (error.status >= 500 && error.status < 600) {
      return true;
    }
    
    // Retry on specific 4xx errors
    if (error.status === 408 || error.status === 429) {
      return true;
    }
    
    // Don't retry on other 4xx errors (bad request, not found, conflict, etc.)
    if (error.status >= 400 && error.status < 500) {
      return false;
    }
  }
  
  // Default: retry
  return true;
}

/**
 * Create a retry-enabled fetch wrapper
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {Object} retryOptions - Retry options (see retryWithBackoff)
 * @returns {Promise<Response>} Fetch response
 */
export async function fetchWithRetry(url, options = {}, retryOptions = {}) {
  return retryWithBackoff(async () => {
    const response = await fetch(url, options);
    
    // Attach status to error for retry logic
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
      error.status = response.status;
      error.response = response;
      throw error;
    }
    
    return response;
  }, retryOptions);
}

/**
 * Timeout wrapper for promises
 * @param {Promise} promise - Promise to wrap
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} timeoutMessage - Error message on timeout
 * @returns {Promise<any>} Result or timeout error
 */
export async function withTimeout(promise, timeoutMs, timeoutMessage = 'Operation timed out') {
  let timeoutId;
  
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      const error = new Error(timeoutMessage);
      error.isTimeout = true;
      reject(error);
    }, timeoutMs);
  });
  
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}
