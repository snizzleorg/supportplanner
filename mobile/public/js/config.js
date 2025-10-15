/**
 * Configuration Module
 * 
 * Central configuration for the mobile timeline app.
 * Contains all constants, settings, and configuration values.
 * 
 * @module config
 */

// ============================================
// UI CONFIGURATION
// ============================================

/**
 * High-contrast color palette for calendar lane labels and backgrounds
 * @constant {Array<string>}
 */
export const LABEL_PALETTE = [
  '#FF8A95', // Vibrant coral/pink
  '#80C7FF', // Vibrant sky blue
  '#80FF9E', // Vibrant mint green
  '#FFBC80', // Vibrant peach/orange
  '#C780FF', // Vibrant purple
  '#FFFF80', // Vibrant yellow
  '#80E8FF', // Vibrant cyan
  '#FF80D5', // Vibrant magenta
  '#C4C480', // Vibrant olive
  '#9580FF', // Vibrant periwinkle
];

/**
 * Lane background opacity (0-1)
 * @constant {number}
 */
export const LANE_OPACITY = 0.30;

/**
 * Unconfirmed event opacity (0-1) - Events with ??? in title are dimmed
 * @constant {number}
 */
export const UNCONFIRMED_EVENT_OPACITY = 0.50;

// ============================================
// API CONFIGURATION
// ============================================

/**
 * API base URL - automatically detects localhost vs production
 * @constant {string}
 */
export const API_BASE = window.location.hostname === 'localhost' 
  ? 'http://localhost:5175'
  : window.location.origin.replace(':5174', ':5175');

// ============================================
// LAYOUT CONSTANTS
// ============================================

/**
 * Layout constants for timeline rendering
 * @constant {Object}
 */
export const LAYOUT = {
  LABEL_WIDTH: 100,           // Width of calendar name labels
  MONTH_HEADER_HEIGHT: 40,    // Height of month header row
  WEEK_HEADER_HEIGHT: 20,     // Height of week number row
  DAY_HEADER_HEIGHT: 20,      // Height of day number row
  LANE_HEIGHT: 80,            // Height of each calendar lane
  EVENT_HEIGHT: 24,           // Height of event bars
  EVENT_GAP: 2                // Gap between stacked events
};

/**
 * Z-index layers for stacking elements
 * @constant {Object}
 */
export const Z_INDEX = {
  BACKGROUND: 1,
  EVENTS: 2,
  DAY_HEADER: 100,
  WEEK_HEADER: 101,
  MONTH_HEADER: 102,
  LANE_LABEL: 103,
  TODAY_INDICATOR: 104
};

/**
 * Zoom settings: pixels per day for each zoom level
 * @constant {Object}
 */
export const ZOOM_SETTINGS = {
  week: 20,    // 20px per day = 140px per week
  month: 10,   // 10px per day = 300px per month
  quarter: 5   // 5px per day = 150px per month
};

/**
 * Timing constants for async operations
 * @constant {Object}
 */
export const TIMING = {
  SAVE_DELAY_MS: 2000,    // Wait time before reload after create
  DELETE_DELAY_MS: 2000   // Wait time before reload after delete
};

/**
 * Auto-refresh interval in milliseconds (60 seconds)
 * @constant {number}
 */
export const AUTO_REFRESH_INTERVAL_MS = 60000;
