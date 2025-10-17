/**
 * CSRF (Cross-Site Request Forgery) protection configuration
 * 
 * Protects state-changing operations (POST, PUT, DELETE) from CSRF attacks.
 * Uses double-submit cookie pattern with csrf-csrf library.
 * 
 * @module config/csrf
 */

import { doubleCsrf } from 'csrf-csrf';

/**
 * CSRF protection configuration
 * 
 * Uses double-submit cookie pattern:
 * 1. Server sends CSRF token in cookie
 * 2. Client includes token in request header
 * 3. Server validates cookie matches header
 * 
 * Configuration:
 * - Cookie name: __Host-psifi.x-csrf-token (secure cookie prefix)
 * - Header name: x-csrf-token
 * - Cookie options: httpOnly, secure, sameSite: 'strict'
 * 
 * @type {Object}
 */
// For development: Always use non-secure cookies since we're on localhost HTTP
// In true production with HTTPS, you would want secure: true and __Host- prefix
const isHttps = process.env.USE_HTTPS === 'true';

console.log('[CSRF Config] NODE_ENV:', process.env.NODE_ENV);
console.log('[CSRF Config] USE_HTTPS:', process.env.USE_HTTPS);
console.log('[CSRF Config] Cookie name:', isHttps ? '__Host-psifi.x-csrf-token' : 'psifi.x-csrf-token');
console.log('[CSRF Config] Secure flag:', isHttps);

export const {
  generateToken,      // Generate new CSRF token
  doubleCsrfProtection, // Middleware to validate CSRF token
} = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || 'default-csrf-secret-change-in-production',
  cookieName: isHttps ? '__Host-psifi.x-csrf-token' : 'psifi.x-csrf-token',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'strict',
    secure: isHttps, // Only require HTTPS when USE_HTTPS=true
    path: '/',
  },
  size: 64, // Token size in bytes
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'], // Don't require CSRF for safe methods
  getTokenFromRequest: (req) => req.headers['x-csrf-token'], // Check header
});
