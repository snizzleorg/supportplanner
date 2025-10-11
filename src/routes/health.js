/**
 * Health check routes
 * 
 * Provides health and readiness endpoints for monitoring and orchestration.
 * Used by Docker, Kubernetes, and monitoring systems.
 * 
 * @module routes/health
 */

import { Router } from 'express';
import { calendarCache } from '../services/index.js';
import { authEnabled } from '../config/index.js';

const router = Router();

// Health check endpoint for Docker/K8s
router.get('/', (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '0.3.0',
    environment: process.env.NODE_ENV || 'development',
    checks: {
      calendarCache: calendarCache.isInitialized ? 'initialized' : 'pending',
      auth: authEnabled ? 'enabled' : 'disabled'
    }
  };
  
  // Return 503 if critical services aren't ready
  if (!calendarCache.isInitialized) {
    return res.status(503).json({ ...health, status: 'unavailable' });
  }
  
  res.json(health);
});

// Readiness probe (stricter than health)
router.get('/ready', (req, res) => {
  if (calendarCache.isInitialized && calendarCache.getAllCalendars().length > 0) {
    res.json({ status: 'ready', calendars: calendarCache.getAllCalendars().length });
  } else {
    res.status(503).json({ status: 'not ready', reason: 'Calendar cache not initialized or no calendars loaded' });
  }
});

export default router;
