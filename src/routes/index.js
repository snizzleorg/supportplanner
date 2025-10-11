/**
 * Route registration module
 * 
 * Registers all application routes with the Express app.
 * Organizes routes by domain: events, calendars, health, client.
 * 
 * @module routes
 */

import eventsRouter from './events.js';
import calendarsRouter from './calendars.js';
import healthRouter from './health.js';
import clientRouter from './client.js';

/**
 * Register all application routes
 * 
 * Mounts route modules at their respective paths:
 * - /api/events - Event CRUD operations
 * - /api/calendars - Calendar operations
 * - /health - Health check endpoints
 * - / - Client utilities (logging, logged-out page)
 * 
 * @param {import('express').Application} app - Express application instance
 * @returns {void}
 */
export function registerRoutes(app) {
  // API routes
  app.use('/api/events', eventsRouter);
  app.use('/api/calendars', calendarsRouter);
  app.use('/api', calendarsRouter); // For /api/refresh-caldav
  app.use('/api', clientRouter);
  
  // Health check routes
  app.use('/health', healthRouter);
  
  // Client routes (logged-out page)
  app.use('/', clientRouter);
}
