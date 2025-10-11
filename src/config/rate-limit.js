/**
 * Rate limiting configuration
 * 
 * Protects API endpoints from abuse by limiting request rates per IP address.
 * Different limits for general API, authentication, and refresh operations.
 * 
 * @module config/rate-limit
 */

import rateLimit from 'express-rate-limit';

/**
 * General API rate limiter
 * 
 * Limits: 100 requests per 15 minutes per IP
 * Applied to all /api/* endpoints
 * 
 * @type {import('express').RequestHandler}
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Authentication rate limiter
 * 
 * Limits: 5 login attempts per 15 minutes per IP
 * Applied to /auth/login and /auth/callback
 * Skips counting successful requests
 * 
 * @type {import('express').RequestHandler}
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
});

/**
 * CalDAV refresh rate limiter
 * 
 * Limits: 10 refresh requests per 5 minutes per IP
 * Applied to /api/refresh-caldav
 * Prevents excessive calendar data refreshes
 * 
 * @type {import('express').RequestHandler}
 */
export const refreshLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Limit refresh to 10 times per 5 minutes
  message: 'Too many refresh requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
