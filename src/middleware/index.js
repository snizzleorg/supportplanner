/**
 * Middleware module exports
 * 
 * Central export point for all middleware modules.
 * Import from this file to access authentication and validation middleware.
 * 
 * @module middleware
 */
export { initializeAuth, requireRole } from './auth.js';
export { validate, eventValidation, uidValidation } from './validation.js';
