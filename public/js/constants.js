/**
 * Application Constants
 * 
 * UI and interaction constants for SupportPlanner.
 * Centralized configuration for breakpoints, timings, and UI settings.
 * 
 * @module constants
 */

/**
 * Mobile breakpoint in CSS pixels
 * @type {number}
 * @constant
 */
export const MOBILE_BREAKPOINT = 640;

/**
 * Mobile viewport dimensions for common devices
 * @type {Object}
 * @property {Object} IPHONE_LANDSCAPE - iPhone landscape dimensions
 * @property {Object} IPHONE_PORTRAIT - iPhone portrait dimensions
 */
export const MOBILE_VIEWPORT = {
  IPHONE_LANDSCAPE: { width: 844, height: 390 },
  IPHONE_PORTRAIT: { width: 390, height: 844 },
};

/**
 * Touch interaction timings in milliseconds
 * @type {Object}
 * @property {number} LONG_PRESS_DURATION - Duration for long press detection
 * @property {number} MOVEMENT_TOLERANCE - Movement tolerance in pixels
 * @property {number} DOUBLE_TAP_THRESHOLD - Max time between taps for double-tap
 * @property {number} PAN_DEBOUNCE - Debounce time after panning
 * @property {number} TOOLTIP_AUTO_HIDE - Auto-hide delay for tooltips
 */
export const TOUCH = {
  LONG_PRESS_DURATION: 550,
  MOVEMENT_TOLERANCE: 10,
  DOUBLE_TAP_THRESHOLD: 300,
  PAN_DEBOUNCE: 350,
  TOOLTIP_AUTO_HIDE: 2500,
};

/**
 * Timeline configuration settings
 * @type {Object}
 * @property {number} MIN_HEIGHT - Minimum timeline height in pixels
 * @property {number} AXIS_HEIGHT_TOP - Top axis height in pixels
 * @property {number} AXIS_HEIGHT_BOTTOM - Bottom axis height in pixels
 * @property {number} CONDENSED_THRESHOLD - Day threshold for condensed view
 */
export const TIMELINE = {
  MIN_HEIGHT: 600,
  AXIS_HEIGHT_TOP: 56,
  AXIS_HEIGHT_BOTTOM: 22,
  CONDENSED_THRESHOLD: 45,
};

/**
 * Rate limiting configuration for UI feedback
 * @type {Object}
 * @property {number} API_WINDOW - API rate limit window in milliseconds
 * @property {number} API_MAX - Maximum API requests per window
 * @property {number} AUTH_WINDOW - Auth rate limit window in milliseconds
 * @property {number} AUTH_MAX - Maximum auth requests per window
 * @property {number} REFRESH_WINDOW - Refresh rate limit window in milliseconds
 * @property {number} REFRESH_MAX - Maximum refresh requests per window
 */
export const RATE_LIMITS = {
  API_WINDOW: 15 * 60 * 1000,
  API_MAX: 100,
  AUTH_WINDOW: 15 * 60 * 1000,
  AUTH_MAX: 5,
  REFRESH_WINDOW: 5 * 60 * 1000,
  REFRESH_MAX: 10,
};

/**
 * Z-index layers for UI elements
 * @type {Object}
 * @property {number} BACKDROP - Mobile backdrop layer
 * @property {number} PANELS - Side panels layer
 * @property {number} SIDE_TABS - Side tab buttons layer
 * @property {number} ROTATE_OVERLAY - Rotation prompt overlay layer
 * @property {number} MODAL - Modal dialog layer
 */
export const Z_INDEX = {
  BACKDROP: 1000,
  PANELS: 1001,
  SIDE_TABS: 1102,
  ROTATE_OVERLAY: 2000,
  MODAL: 2001,
};

/**
 * Animation durations in milliseconds
 * @type {Object}
 * @property {number} PANEL_SLIDE - Panel slide animation duration
 * @property {number} BACKDROP_FADE - Backdrop fade animation duration
 * @property {number} MODAL_FADE - Modal fade animation duration
 */
export const ANIMATION = {
  PANEL_SLIDE: 220,
  BACKDROP_FADE: 200,
  MODAL_FADE: 300,
};
