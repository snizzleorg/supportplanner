/**
 * Date utility functions
 * 
 * @module utils/date
 */

/**
 * Validate if a string is a valid date
 * 
 * Uses Date.parse() to check if the string can be parsed as a valid date.
 * Returns false for invalid dates, null, undefined, or non-parseable strings.
 * 
 * @param {string} dateString - The date string to validate
 * @returns {boolean} True if valid date, false otherwise
 * 
 * @example
 * isValidDate('2025-10-11') // true
 * isValidDate('invalid') // false
 * isValidDate(null) // false
 */
export function isValidDate(dateString) {
  return !isNaN(Date.parse(dateString));
}
