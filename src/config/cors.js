/**
 * CORS (Cross-Origin Resource Sharing) configuration
 * 
 * Restricts which origins can access the API. In production, only
 * origins listed in ALLOWED_ORIGINS environment variable are permitted.
 * 
 * @module config/cors
 */

import cors from 'cors';

/**
 * List of allowed origins for CORS requests
 * Configured via ALLOWED_ORIGINS environment variable (comma-separated)
 * Falls back to localhost URLs for development
 * 
 * @type {string[]}
 */
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [
      'http://localhost:5175', 
      'http://localhost:5173',
      'http://localhost:5174', // Mobile app
      'http://support-planner:5173', // Docker internal hostname for tests
      'http://mobile-planner:5174', // Mobile app Docker hostname
    ];

// Also allow any origin from the same hostname on different ports (for mobile testing)
// This allows http://m4.local:5174, http://192.168.x.x:5174, etc.
const allowOriginPattern = /^https?:\/\/[^:]+:(5173|5174|5175)$/;

/**
 * CORS middleware configured with origin validation
 * 
 * - Validates origin against allowedOrigins list
 * - Allows requests with no origin (mobile apps, Postman)
 * - Enables credentials (cookies, authorization headers)
 * 
 * @type {import('express').RequestHandler}
 */
export const corsMiddleware = cors({
  origin: (origin, callback) => {
    console.log('[CORS] Request from origin:', origin);
    
    // In production, require origin header (tighter security)
    // In development, allow no-origin for mobile apps and Postman
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    if (!origin) {
      if (isDevelopment) {
        console.log('[CORS] ✓ Allowed (no origin - development mode)');
        return callback(null, true);
      } else {
        console.log('[CORS] ✗ BLOCKED - No origin header (production requires origin)');
        return callback(new Error('Origin header required'));
      }
    }
    
    // Check exact match in allowed origins
    if (allowedOrigins.includes(origin)) {
      console.log('[CORS] ✓ Allowed (exact match)');
      return callback(null, true);
    }
    
    // Check pattern match for development (specific hostnames on ports 5173-5175)
    // Whitelist specific development hostnames for security
    const allowedDevHosts = ['localhost', '127.0.0.1', 'm4.local'];
    
    try {
      const url = new URL(origin);
      const hostname = url.hostname;
      const isAllowedHost = allowedDevHosts.includes(hostname);
      const isAllowedPort = ['5173', '5174', '5175'].includes(url.port);
      
      if (isAllowedHost && isAllowedPort) {
        console.log('[CORS] ✓ Allowed (whitelisted dev host + port)');
        return callback(null, true);
      }
    } catch (err) {
      console.log('[CORS] ✗ BLOCKED - Invalid origin URL');
      return callback(new Error('Invalid origin'));
    }
    
    console.log('[CORS] ✗ BLOCKED - Origin not in allowed list');
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
});
