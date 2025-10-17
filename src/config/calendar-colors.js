/**
 * Calendar color overrides configuration
 * 
 * Provides per-calendar color customization for timeline lanes.
 * Keys can be either the calendar displayName (extracted firstname) or the full CalDAV URL.
 * 
 * @module config/calendar-colors
 * 
 * @example
 * // Override by firstname
 * export const calendarColorOverrides = {
 *   Steffen: '#f59e0b',
 *   Melanie: 'rgb(255, 255, 255)'
 * };
 * 
 * @example
 * // Override by full URL
 * export const calendarColorOverrides = {
 *   'https://example.com/remote.php/dav/calendars/support/travel_shared_by_steffen/': '#f59e0b'
 * };
 */

/**
 * Per-calendar color overrides
 * 
 * Maps calendar identifiers (firstname or URL) to color values.
 * Colors can be hex (#f59e0b) or rgb/rgba (rgb(255, 255, 255)).
 * 
 * @type {Object.<string, string>}
 * @property {string} [calendarId] - Calendar identifier mapped to color value
 */
export const calendarColorOverrides = {
  // Add overrides here, e.g.:
  Melanie: 'rgb(255, 255, 255)'
};
