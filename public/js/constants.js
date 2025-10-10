// UI and interaction constants for SupportPlanner

// Mobile breakpoints (CSS pixels)
export const MOBILE_BREAKPOINT = 640; // max-width for mobile layout
export const MOBILE_VIEWPORT = {
  IPHONE_LANDSCAPE: { width: 844, height: 390 },
  IPHONE_PORTRAIT: { width: 390, height: 844 },
};

// Touch interaction timings (milliseconds)
export const TOUCH = {
  LONG_PRESS_DURATION: 550,
  MOVEMENT_TOLERANCE: 10, // pixels
  DOUBLE_TAP_THRESHOLD: 300,
  PAN_DEBOUNCE: 350,
  TOOLTIP_AUTO_HIDE: 2500,
};

// Timeline settings
export const TIMELINE = {
  MIN_HEIGHT: 600, // pixels
  AXIS_HEIGHT_TOP: 56, // pixels
  AXIS_HEIGHT_BOTTOM: 22, // pixels
  CONDENSED_THRESHOLD: 45, // days
};

// Rate limiting (for display/UI feedback)
export const RATE_LIMITS = {
  API_WINDOW: 15 * 60 * 1000, // 15 minutes
  API_MAX: 100,
  AUTH_WINDOW: 15 * 60 * 1000,
  AUTH_MAX: 5,
  REFRESH_WINDOW: 5 * 60 * 1000,
  REFRESH_MAX: 10,
};

// Z-index layers
export const Z_INDEX = {
  BACKDROP: 1000,
  PANELS: 1001,
  SIDE_TABS: 1102,
  ROTATE_OVERLAY: 2000,
  MODAL: 2001,
};

// Animation durations (milliseconds)
export const ANIMATION = {
  PANEL_SLIDE: 220,
  BACKDROP_FADE: 200,
  MODAL_FADE: 300,
};
