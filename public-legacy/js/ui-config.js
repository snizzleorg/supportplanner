/**
 * UI Configuration Module
 * 
 * Central configuration for UI colors, themes, and visual settings.
 * 
 * @module ui-config
 */

/**
 * High-contrast color palette for calendar lane labels and backgrounds
 * 
 * Colors are optimized for:
 * - Maximum visual distinction between adjacent lanes
 * - Readability with both light and dark text
 * - Accessibility (WCAG AA contrast ratios)
 * - Professional appearance
 * 
 * @type {Array<string>}
 * @constant
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
 * Controls how transparent the lane background tint is
 * 
 * @type {number}
 * @constant
 */
export const LANE_OPACITY = 0.30;

/**
 * Unconfirmed event opacity (0-1)
 * Events with ??? in title are dimmed to this opacity
 * 
 * @type {number}
 * @constant
 */
export const UNCONFIRMED_EVENT_OPACITY = 0.50;

/**
 * Alternative high-contrast palette (uncomment to use)
 * Stronger colors for even more distinction
 */
// export const LABEL_PALETTE = [
//   '#FFD6D6', // Stronger red/pink
//   '#D6E9FF', // Stronger blue
//   '#D6FFD6', // Stronger green
//   '#FFE9D6', // Stronger orange
//   '#E9D6FF', // Stronger purple
//   '#FFFFD6', // Stronger yellow
//   '#D6FFFF', // Stronger cyan
//   '#FFD6E9', // Stronger magenta
//   '#E9E9D6', // Stronger beige
//   '#D6E0FF', // Stronger sky blue
// ];

/**
 * Vibrant palette option (uncomment to use)
 * Bold, saturated colors for maximum impact
 */
// export const LABEL_PALETTE = [
//   '#FFCCCC', // Vibrant red
//   '#CCE5FF', // Vibrant blue
//   '#CCFFCC', // Vibrant green
//   '#FFDDCC', // Vibrant orange
//   '#E5CCFF', // Vibrant purple
//   '#FFFFCC', // Vibrant yellow
//   '#CCFFFF', // Vibrant cyan
//   '#FFCCEE', // Vibrant magenta
//   '#EEEEDD', // Vibrant tan
//   '#CCDEFF', // Vibrant periwinkle
// ];
