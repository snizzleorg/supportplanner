/**
 * HTML utility functions
 * 
 * @module utils/html
 */

/**
 * Escape HTML special characters to prevent XSS attacks
 * 
 * Escapes: & < > " '
 * Returns empty string for falsy input.
 * 
 * @param {string} unsafe - The unsafe string to escape
 * @returns {string} The escaped string safe for HTML insertion
 * 
 * @example
 * escapeHtml('<script>alert("xss")</script>')
 * // Returns: '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
 */
export function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
