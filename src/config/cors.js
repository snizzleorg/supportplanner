/**
 * CORS (Cross-Origin Resource Sharing) configuration
 * 
 * Restricts which origins can access the API. In production, only
 * origins listed in ALLOWED_ORIGINS environment variable are permitted.
 * 
 * @module config/cors
 */

import cors from 'cors';
import { createLogger } from '../utils/index.js';

const logger = createLogger('CORS');

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
    logger.debug('Request from origin:', origin);
    
    // Allow requests with no origin (mobile apps, Postman, same-origin requests)
    // These are legitimate requests from native apps or server-to-server calls
    if (!origin) {
      logger.debug('✓ Allowed (no origin - mobile app or same-origin)');
      return callback(null, true);
    }
    
    // Check exact match in allowed origins
    if (allowedOrigins.includes(origin)) {
      logger.debug('✓ Allowed (exact match)');
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
        logger.debug('✓ Allowed (whitelisted dev host + port)');
        return callback(null, true);
      }
    } catch (err) {
      logger.warn('✗ BLOCKED - Invalid origin URL');
      return callback(new Error('Invalid origin'));
    }
    
    logger.warn('✗ BLOCKED - Origin not in allowed list:', origin);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
});
