/**
 * State Management Module
 * 
 * Manages application state with encapsulation and validation.
 * Provides getters and setters for controlled state access.
 * 
 * @module state
 */

import { getDefaultDateRange } from './utils.js';

/**
 * Application state object
 * @type {Object}
 * @property {Array} calendars - List of calendars from API
 * @property {Array} events - List of events from API
 * @property {Array} holidays - Berlin holidays for shading
 * @property {Object} dateRange - Display date range {from, to}
 * @property {string} zoom - Current zoom level (week|month|quarter)
 * @property {string} searchQuery - Current search filter text
 * @property {Set} selectedCalendars - Set of selected calendar IDs
 * @property {Object} eventTypes - Event type configuration with colors
 */
const state = {
  calendars: [],
  events: [],
  holidays: [],
  dateRange: getDefaultDateRange(),
  zoom: 'week',
  searchQuery: '',
  selectedCalendars: new Set(),
  eventTypes: null
};

// ============================================
// STATE GETTERS
// ============================================

/**
 * Get all calendars
 * @returns {Array} Array of calendar objects
 */
export function getCalendars() {
  return state.calendars;
}

/**
 * Get all events
 * @returns {Array} Array of event objects
 */
export function getEvents() {
  return state.events;
}

/**
 * Get holidays
 * @returns {Array} Array of holiday objects
 */
export function getHolidays() {
  return state.holidays;
}

/**
 * Get date range
 * @returns {Object} Date range object {from, to}
 */
export function getDateRange() {
  return state.dateRange;
}

/**
 * Get current zoom level
 * @returns {string} Zoom level (week|month|quarter)
 */
export function getZoom() {
  return state.zoom;
}

/**
 * Get search query
 * @returns {string} Current search query
 */
export function getSearchQuery() {
  return state.searchQuery;
}

/**
 * Get selected calendars
 * @returns {Set} Set of selected calendar IDs
 */
export function getSelectedCalendars() {
  return state.selectedCalendars;
}

/**
 * Get event types configuration
 * @returns {Object|null} Event types configuration
 */
export function getEventTypes() {
  return state.eventTypes;
}

/**
 * Get entire state object (for debugging or bulk operations)
 * @returns {Object} Complete state object
 */
export function getState() {
  return state;
}

// ============================================
// STATE SETTERS
// ============================================

/**
 * Set calendars
 * @param {Array} calendars - Array of calendar objects
 */
export function setCalendars(calendars) {
  state.calendars = calendars;
}

/**
 * Set events
 * @param {Array} events - Array of event objects
 */
export function setEvents(events) {
  state.events = events;
}

/**
 * Set holidays
 * @param {Array} holidays - Array of holiday objects
 */
export function setHolidays(holidays) {
  state.holidays = holidays;
}

/**
 * Set date range
 * @param {Object} dateRange - Date range object {from, to}
 */
export function setDateRange(dateRange) {
  state.dateRange = dateRange;
}

/**
 * Set zoom level
 * @param {string} zoom - Zoom level (week|month|quarter|custom)
 */
export function setZoom(zoom) {
  if (!['week', 'month', 'quarter', 'custom'].includes(zoom)) {
    console.warn(`Invalid zoom level: ${zoom}. Using 'month' as default.`);
    state.zoom = 'month';
    return;
  }
  state.zoom = zoom;
}

/**
 * Set search query
 * @param {string} query - Search query string
 */
export function setSearchQuery(query) {
  state.searchQuery = query;
}

/**
 * Set selected calendars
 * @param {Set} selectedCalendars - Set of selected calendar IDs
 */
export function setSelectedCalendars(selectedCalendars) {
  state.selectedCalendars = selectedCalendars;
}

/**
 * Set event types configuration
 * @param {Object} eventTypes - Event types configuration
 */
export function setEventTypes(eventTypes) {
  state.eventTypes = eventTypes;
}

// ============================================
// STATE OPERATIONS
// ============================================

/**
 * Toggle calendar selection
 * @param {string} calendarId - Calendar ID to toggle
 */
export function toggleCalendarSelection(calendarId) {
  if (state.selectedCalendars.has(calendarId)) {
    state.selectedCalendars.delete(calendarId);
  } else {
    state.selectedCalendars.add(calendarId);
  }
}

/**
 * Clear all calendar selections
 */
export function clearCalendarSelections() {
  state.selectedCalendars.clear();
}

/**
 * Reset state to initial values
 */
export function resetState() {
  state.calendars = [];
  state.events = [];
  state.holidays = [];
  state.dateRange = getDefaultDateRange();
  state.zoom = 'week';
  state.searchQuery = '';
  state.selectedCalendars = new Set();
  state.eventTypes = null;
}
