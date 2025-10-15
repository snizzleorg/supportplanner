/**
 * API Module
 * 
 * Handles all API calls with retry logic and error handling.
 * Provides functions for fetching calendars, events, and holidays.
 * 
 * @module api
 */

import { API_BASE } from './config.js';
import {
  getCalendars,
  getDateRange,
  getHolidays,
  setCalendars,
  setEvents,
  setHolidays
} from './state.js';

// ============================================
// RETRY UTILITIES
// ============================================

/**
 * Sleep for a given number of milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Default retry logic - retry on network errors and 5xx server errors
 * @param {Error} error - Error object
 * @param {number} attempt - Current attempt number
 * @returns {boolean} Whether to retry
 */
function defaultShouldRetry(error, attempt) {
  if (error.message.includes('fetch') || error.message.includes('network')) {
    return true;
  }
  if (error.status) {
    if (error.status >= 500 && error.status < 600) return true;
    if (error.status === 408 || error.status === 429) return true;
    if (error.status >= 400 && error.status < 500) return false;
  }
  return true;
}

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {Object} options - Retry options
 * @returns {Promise<any>} Result of function
 */
async function retryWithBackoff(fn, options = {}) {
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
      if (attempt === maxRetries) break;
      if (!shouldRetry(error, attempt)) throw error;
      
      const exponentialDelay = initialDelay * Math.pow(2, attempt);
      const jitter = Math.random() * 0.3 * exponentialDelay;
      const delay = Math.min(exponentialDelay + jitter, maxDelay);
      
      console.log(`[Retry] Attempt ${attempt + 1}/${maxRetries} failed, retrying in ${Math.round(delay)}ms...`, error.message);
      if (onRetry) onRetry(error, attempt + 1);
      await sleep(delay);
    }
  }
  throw lastError;
}

/**
 * Create a retry-enabled fetch wrapper
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {Object} retryOptions - Retry options
 * @returns {Promise<Response>} Fetch response
 */
export async function fetchWithRetry(url, options = {}, retryOptions = {}) {
  return retryWithBackoff(async () => {
    const response = await fetch(url, options);
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
      reject(new Error(timeoutMessage));
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

// ============================================
// API FUNCTIONS
// ============================================

/**
 * Load calendar and event data from the API
 * Fetches calendars, events for date range, and Berlin holidays
 * Updates application state with loaded data
 * @async
 * @returns {Promise<void>}
 * @throws {Error} If calendar or event fetch fails
 */
export async function loadData() {
  try {
    console.log('Loading calendars...');
    
    // Fetch calendars
    const calRes = await fetch(`${API_BASE}/api/calendars`);
    if (!calRes.ok) throw new Error(`Calendar fetch failed: ${calRes.status}`);
    
    const calData = await calRes.json();
    setCalendars(calData.calendars || []);
    console.log(`Got ${getCalendars().length} calendars`);
    
    // Fetch events
    const calendarUrls = getCalendars().map(c => c.url);
    // Format dates as local YYYY-MM-DD to avoid timezone issues
    const formatLocalDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    const fromStr = formatLocalDate(getDateRange().from);
    const toStr = formatLocalDate(getDateRange().to);
    
    console.log('Loading events...');
    console.log('Date range:', fromStr, 'to', toStr);
    console.log('Calendar URLs count:', calendarUrls.length);
    const evtRes = await fetch(`${API_BASE}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ calendarUrls, from: fromStr, to: toStr })
    });
    
    if (!evtRes.ok) throw new Error(`Events fetch failed: ${evtRes.status}`);
    
    const evtData = await evtRes.json();
    // Process events to extract UID from the id field
    setEvents((evtData.items || []).map(event => ({
      ...event,
      // Extract UID: if id is a URL, get last segment and remove leading hyphen
      uid: event.id.includes('/') 
        ? event.id.split('/').pop().replace(/^-/, '') 
        : event.id.split('-').slice(1).join('-')
    })));
    
    // Use groups for calendar display names
    if (evtData.groups) {
      setCalendars(evtData.groups);
    }
    
    console.log(`Loaded: ${getCalendars().length} calendars, ${getEvents().length} events`);
    
    // Fetch holidays for Berlin (optional, don't fail if it errors)
    try {
      const startYear = getDateRange().from.getFullYear();
      const endYear = getDateRange().to.getFullYear();
      const allHolidays = [];
      
      // Fetch holidays for all years in range
      for (let year = startYear; year <= endYear; year++) {
        const holidayRes = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/DE`);
        if (holidayRes.ok) {
          const yearHolidays = await holidayRes.json();
          // Filter for Berlin-specific holidays (Germany + Berlin state holidays)
          const berlinHolidays = yearHolidays.filter(h => !h.counties || h.counties.includes('DE-BE'));
          allHolidays.push(...berlinHolidays);
        }
      }
      
      setHolidays(allHolidays);
      console.log(`Loaded ${getHolidays().length} Berlin holidays for ${startYear}-${endYear}`);
    } catch (err) {
      console.warn('Could not load holidays:', err);
    }
    
  } catch (error) {
    console.error('Load error:', error);
    console.error('Error stack:', error.stack);
    
    // Show error on screen
    const container = document.getElementById('timelineContainer');
    if (container) {
      container.innerHTML = `
        <div style="padding: 20px; color: red;">
          <h3>Error Loading Data</h3>
          <p>${error.message}</p>
          <p>Check console for details.</p>
        </div>
      `;
    }
    throw error;
  }
}
