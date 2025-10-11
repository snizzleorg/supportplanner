import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import healthRouter from '../health.js';

// Mock the services and config
vi.mock('../../services/index.js', () => ({
  calendarCache: {
    isInitialized: true,
    getAllCalendars: vi.fn(() => [{ url: 'test', displayName: 'Test' }])
  }
}));

vi.mock('../../config/index.js', () => ({
  authEnabled: false
}));

describe('health routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use('/health', healthRouter);
  });

  describe('GET /health', () => {
    it('should return 200 with health status', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('checks');
    });

    it('should include calendar cache status', async () => {
      const response = await request(app).get('/health');
      
      expect(response.body.checks).toHaveProperty('calendarCache');
      expect(response.body.checks.calendarCache).toBe('initialized');
    });

    it('should include auth status', async () => {
      const response = await request(app).get('/health');
      
      expect(response.body.checks).toHaveProperty('auth');
      expect(['enabled', 'disabled']).toContain(response.body.checks.auth);
    });
  });

  describe('GET /health/ready', () => {
    it('should return 200 when ready', async () => {
      const response = await request(app).get('/health/ready');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ready');
      expect(response.body).toHaveProperty('calendars');
    });

    it('should return calendar count', async () => {
      const response = await request(app).get('/health/ready');
      
      expect(response.body.calendars).toBeGreaterThanOrEqual(0);
    });
  });
});
