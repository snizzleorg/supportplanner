/**
 * Escape HTML special characters to prevent XSS
 * @param {string} unsafe - The unsafe string to escape
 * @returns {string} The escaped string
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
