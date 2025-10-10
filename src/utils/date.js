/**
 * Validate if a string is a valid date
 * @param {string} dateString - The date string to validate
 * @returns {boolean} True if valid date, false otherwise
 */
export function isValidDate(dateString) {
  return !isNaN(Date.parse(dateString));
}
