/**
 * Security Module
 * 
 * Provides security utilities for protecting against XSS attacks.
 * All user-generated content and external data (CalDAV) must be
 * sanitized before insertion into the DOM.
 * 
 * @module security
 */

/**
 * Escape HTML special characters to prevent XSS attacks
 * 
 * Converts potentially dangerous characters into their HTML entity equivalents:
 * - & becomes &amp;
 * - < becomes &lt;
 * - > becomes &gt;
 * - " becomes &quot;
 * - ' becomes &#039;
 * 
 * This function MUST be used whenever inserting untrusted data into HTML,
 * including:
 * - Event titles, descriptions, locations from CalDAV
 * - User input from forms
 * - Metadata values
 * - Any external data source
 * 
 * @param {string} unsafe - Untrusted string that may contain malicious code
 * @returns {string} HTML-safe string with special characters escaped
 * 
 * @example
 * // Unsafe - DO NOT DO THIS:
 * element.innerHTML = eventTitle;  // ❌ XSS vulnerability!
 * 
 * // Safe - Always escape first:
 * element.innerHTML = escapeHtml(eventTitle);  // ✅ Protected
 * 
 * @example
 * escapeHtml('<script>alert("XSS")</script>')
 * // Returns: '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
 * 
 * @example
 * escapeHtml('Tom & Jerry say "Hello"')
 * // Returns: 'Tom &amp; Jerry say &quot;Hello&quot;'
 */
export function escapeHtml(unsafe) {
  if (!unsafe) return '';
  
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Sanitize object properties recursively
 * 
 * Applies HTML escaping to all string properties in an object,
 * useful for sanitizing entire event objects or metadata.
 * 
 * @param {Object} obj - Object with potentially unsafe string properties
 * @returns {Object} New object with all strings escaped
 * 
 * @example
 * const event = {
 *   title: '<script>alert(1)</script>',
 *   meta: { note: 'Test & Demo' }
 * };
 * const safe = sanitizeObject(event);
 * // Returns: {
 * //   title: '&lt;script&gt;alert(1)&lt;/script&gt;',
 * //   meta: { note: 'Test &amp; Demo' }
 * // }
 */
export function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  
  const sanitized = Array.isArray(obj) ? [] : {};
  
  for (const key in obj) {
    const value = obj[key];
    
    if (typeof value === 'string') {
      sanitized[key] = escapeHtml(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Create a text node safely
 * 
 * Alternative to innerHTML for simple text content.
 * Always safe because it creates a text node, not HTML.
 * 
 * @param {HTMLElement} element - Element to set text content
 * @param {string} text - Text to display
 * 
 * @example
 * // Instead of:
 * element.innerHTML = userInput;  // ❌ Unsafe
 * 
 * // Use:
 * setTextContent(element, userInput);  // ✅ Always safe
 */
export function setTextContent(element, text) {
  element.textContent = text || '';
}
