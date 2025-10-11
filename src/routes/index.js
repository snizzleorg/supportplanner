import eventsRouter from './events.js';
import calendarsRouter from './calendars.js';
import healthRouter from './health.js';
import clientRouter from './client.js';

/**
 * Register all application routes
 * @param {Express} app - Express application instance
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
