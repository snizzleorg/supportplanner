/**
 * Utility Functions Module
 * 
 * Pure utility functions for date manipulation, color calculations,
 * and other helper operations.
 * 
 * @module utils
 */

/**
 * Calculate default date range for timeline display
 * Returns range from 12 months before today to 12 months after today (2 years total)
 * @returns {{from: Date, to: Date}} Date range object
 */
export function getDefaultDateRange() {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth() - 12, 1);
  const to = new Date(today.getFullYear(), today.getMonth() + 12, 1);
  return { from, to };
}

/**
 * Calculate ISO week number for a given date
 * @param {Date} date - Date to calculate week number for
 * @returns {number} ISO week number (1-53)
 */
export function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Parse date string as local date (not UTC)
 * Prevents timezone issues by parsing as local midnight
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {Date} Local date object
 */
export function parseLocalDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Calculate event position and width in pixels
 * @param {Object} event - Event object with start and end dates
 * @param {Object} dateRange - Date range object with from/to dates
 * @param {number} pixelsPerDay - Current zoom level pixels per day
 * @returns {{left: number, width: number}} Position object
 */
export function calculateEventPosition(event, dateRange, pixelsPerDay) {
  // Parse as local dates to avoid timezone issues
  const eventStart = parseLocalDate(event.start);
  const eventEnd = parseLocalDate(event.end);
  const rangeStart = new Date(dateRange.from);
  rangeStart.setHours(0, 0, 0, 0);
  
  // Debug logging for events starting on Oct 13
  if (event.start === '2025-10-13') {
    console.log('=== Event Position Debug (Oct 13) ===');
    console.log('Event:', event.content);
    console.log('event.start string:', event.start);
    console.log('Parsed eventStart:', eventStart, eventStart.toDateString());
    console.log('rangeStart:', rangeStart, rangeStart.toDateString());
    console.log('Difference in ms:', eventStart - rangeStart);
    console.log('Days from start:', Math.round((eventStart - rangeStart) / (1000 * 60 * 60 * 24)));
    console.log('Calculated left position:', Math.round((eventStart - rangeStart) / (1000 * 60 * 60 * 24)) * pixelsPerDay);
  }
  
  // Calculate days from start (should be whole days)
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysFromStart = Math.round((eventStart - rangeStart) / msPerDay);
  let duration = Math.round((eventEnd - eventStart) / msPerDay);
  
  // For all-day events, the end date is exclusive in the API
  // but we want to display it inclusively (e.g., Oct 20-24 should show 5 days, not 4)
  // Add 1 day to make the visual representation inclusive
  if (duration > 0) {
    duration += 1;
  }
  
  const left = daysFromStart * pixelsPerDay;
  const width = Math.max(duration * pixelsPerDay, 30);
  return { left, width };
}

/**
 * Get contrast color (white or black) based on background brightness
 * Uses luminance calculation to determine readable text color
 * @param {string} color - Background color (hex, rgb, or named color)
 * @returns {string} 'white' or 'black' for best contrast
 */
export function getContrastColor(color) {
  let r, g, b;
  
  // Handle rgb() format
  if (color.startsWith('rgb')) {
    const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      r = parseInt(match[1]);
      g = parseInt(match[2]);
      b = parseInt(match[3]);
    }
  } else {
    // Handle hex format
    const hex = color.replace('#', '');
    r = parseInt(hex.substr(0, 2), 16);
    g = parseInt(hex.substr(2, 2), 16);
    b = parseInt(hex.substr(4, 2), 16);
  }
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return black for light backgrounds, white for dark
  return luminance > 0.5 ? 'black' : 'white';
}

/**
 * Convert hex color to rgba with opacity
 * @param {string} hex - Hex color (e.g., '#FF8A95')
 * @param {number} opacity - Opacity value (0-1)
 * @returns {string} RGBA color string
 */
export function hexToRgba(hex, opacity) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Get color for an event (event color or fallback to calendar color)
 * @param {Object} event - Event object
 * @param {Object} calendar - Calendar object
 * @param {Object} eventTypes - Event type configuration
 * @returns {string} Color string (hex or rgb)
 */
export function getEventColor(event, calendar, eventTypes) {
  // First check if event has its own color
  if (event.color) {
    return event.color;
  }
  
  // Use event types from configuration
  if (eventTypes) {
    const eventTitle = (event.content || event.summary || '').toLowerCase();
    
    // Check each event type's patterns
    for (const [typeName, typeConfig] of Object.entries(eventTypes)) {
      if (typeName === '_default') continue;
      
      const patterns = typeConfig.patterns || [];
      for (const pattern of patterns) {
        if (eventTitle.includes(pattern.toLowerCase())) {
          return typeConfig.color;
        }
      }
    }
    
    // Use default color if configured
    if (eventTypes._default) {
      return eventTypes._default.color;
    }
  }
  
  // Finally use calendar color
  if (calendar?.bg) {
    return calendar.bg;
  }
  
  // Default fallback
  return '#64748B';
}
