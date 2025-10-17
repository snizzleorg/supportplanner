/**
 * Calendar color overrides configuration
 * 
 * ⚠️ **DEPRECATED / NOT CURRENTLY USED**
 * 
 * The mobile app (primary interface) ignores backend calendar colors and uses
 * its own frontend LABEL_PALETTE (mobile/public/js/config.js) instead.
 * Colors are assigned cyclically by calendar index, not from this config.
 * 
 * This configuration is still applied in the backend and returned in API responses,
 * but the frontend does not consume it.
 * 
 * **To change calendar colors**: Edit LABEL_PALETTE in mobile/public/js/config.js
 * 
 * **Future consideration**: Could be used for per-calendar color API if frontend
 * is updated to respect calendar.color from backend responses.
 * 
 * ---
 * 
 * @module config/calendar-colors
 * @deprecated Not used by mobile app frontend (v0.6.0)
 * 
 * @example
 * // How it WOULD work if frontend used it:
 * export const calendarColorOverrides = {
 *   Steffen: '#f59e0b',        // Override by firstname
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
 * ⚠️ NOT CURRENTLY USED - See module documentation above
 * 
 * Maps calendar identifiers (firstname or URL) to color values.
 * Colors can be hex (#f59e0b) or rgb/rgba (rgb(255, 255, 255)).
 * 
 * @deprecated Mobile app uses LABEL_PALETTE instead (mobile/public/js/config.js)
 * @type {Object.<string, string>}
 * @property {string} [calendarId] - Calendar identifier mapped to color value
 */
export const calendarColorOverrides = {
  // NOT USED - Edit LABEL_PALETTE in mobile/public/js/config.js instead
  Melanie: 'rgb(255, 255, 255)'
};
