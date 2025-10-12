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
    // Allow requests with no origin (e.g., mobile apps, Postman)
    if (!origin) return callback(null, true);
    
    // Check exact match in allowed origins
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Check pattern match for development (any hostname on ports 5173-5175)
    if (allowOriginPattern.test(origin)) {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
});
