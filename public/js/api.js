/**
 * API Client Module
 * 
 * Provides functions to interact with the backend API endpoints.
 * Handles all HTTP communication with the server.
 * 
 * @module api
 */

/**
 * Base URL for API requests
 * @type {string}
 */
let API_BASE = '';

/**
 * Sets the base URL for API requests
 * @param {string} base - The base URL to use for API requests
 */
export function setApiBase(base) { 
  API_BASE = base || ''; 
}

/**
 * Internal fetch wrapper that handles base URL
 * @private
 * @param {string} path - The API path
 * @param {RequestInit} init - Fetch options
 * @returns {Promise<Response>} The fetch response
 */
function apiFetch(path, init) {
  const url = API_BASE ? new URL(path, API_BASE).toString() : path;
  return fetch(url, init);
}

/**
 * Fetches the list of calendars from the server
 * @returns {Promise<Array<Object>>} Array of calendar objects
 */
export async function fetchCalendars() {
  try {
    const res = await apiFetch('/api/calendars');
    if (!res.ok) {
      const text = await res.text();
      console.error('Calendars fetch failed', res.status, res.statusText, text);
      return [];
    }
    const data = await res.json();
    const list = data.calendars || [];
    return list;
  } catch (e) {
    return [];
  }
}

/**
 * Triggers a refresh of the CalDAV cache on the server
 * @returns {Promise<Object>} Response object with refresh status
 */
export async function refreshCaldav() {
  const res = await apiFetch('/api/refresh-caldav', { method: 'POST' });
  return res.json();
}

/**
 * Fetches current user information and authentication status
 * @returns {Promise<Object>} User info object with authentication details
 */
export async function me() {
  const res = await apiFetch('/api/me');
  return res.json();
}

/**
 * Logs out the current user
 * @returns {Promise<boolean>} True if logout was successful
 */
export async function logout() {
  const res = await apiFetch('/auth/logout', { method: 'POST' });
  return res.ok;
}

/**
 * Sends a client-side log message to the server
 * @param {string} level - Log level (info, warn, error)
 * @param {string} message - Log message
 * @param {Object} [extra] - Additional log data
 * @returns {Promise<void>}
 */
export async function clientLog(level, message, extra) {
  try {
    await apiFetch('/api/client-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level, message, extra, userAgent: navigator.userAgent, ts: new Date().toISOString() }),
    });
  } catch (_) {
    // Silently ignore logging errors
  }
}

/**
 * Fetches a single event by UID
 * @param {string} uid - The event UID
 * @returns {Promise<Object>} Event object
 * @throws {Error} If the fetch fails
 */
export async function getEvent(uid) {
  const res = await apiFetch(`/api/events/${uid}`);
  if (!res.ok) throw new Error(`Failed to fetch event: ${res.status}`);
  return res.json();
}

/**
 * Updates an existing event
 * @param {string} uid - The event UID
 * @param {Object} data - Event data to update
 * @returns {Promise<Object>} Updated event object
 * @throws {Error} If the update fails
 */
export async function updateEvent(uid, data) {
  const res = await apiFetch(`/api/events/${uid}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to update event: ${res.status}`);
  return res.json();
}

/**
 * Deletes an event
 * @param {string} uid - The event UID
 * @returns {Promise<Object>} Deletion response
 * @throws {Error} If the deletion fails
 */
export async function deleteEvent(uid) {
  const res = await apiFetch(`/api/events/${uid}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Failed to delete event: ${res.status}`);
  return res.json();
}

/**
 * Creates a new all-day event
 * @param {string} calendarUrl - The calendar URL to create the event in
 * @param {Object} payload - Event data
 * @param {string} payload.summary - Event title
 * @param {string} [payload.description] - Event description
 * @param {string} [payload.location] - Event location
 * @param {string} payload.start - Start date (YYYY-MM-DD)
 * @param {string} payload.end - End date (YYYY-MM-DD)
 * @param {Object} [payload.meta] - Additional metadata
 * @returns {Promise<Object>} Created event object
 * @throws {Error} If the creation fails
 */
export async function createAllDayEvent(calendarUrl, payload) {
  const res = await apiFetch('/api/events/all-day', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      calendarUrl,
      summary: payload.summary,
      description: payload.description,
      location: payload.location,
      start: payload.start,
      end: payload.end,
      meta: payload.meta,
    }),
  });
  if (!res.ok) throw new Error(`Failed to create event: ${res.status}`);
  return res.json();
}
