import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import clientRouter from '../client.js';

describe('client routes', () => {
  let app;
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/', clientRouter);
    
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('POST /client-log', () => {
    it('should accept client log messages', async () => {
      const response = await request(app)
        .post('/client-log')
        .send({
          level: 'info',
          message: 'Test log message',
          extra: { foo: 'bar' }
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true });
    });

    it('should log info messages to console.log', async () => {
      await request(app)
        .post('/client-log')
        .send({
          level: 'info',
          message: 'Info message'
        });
      
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('should log error messages to console.error', async () => {
      await request(app)
        .post('/client-log')
        .send({
          level: 'error',
          message: 'Error message'
        });
      
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should handle messages without extra data', async () => {
      const response = await request(app)
        .post('/client-log')
        .send({
          level: 'warn',
          message: 'Warning message'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /logged-out', () => {
    it('should return logged out page', async () => {
      const response = await request(app).get('/logged-out');
      
      expect(response.status).toBe(200);
      expect(response.type).toBe('text/html');
      expect(response.text).toContain('signed out');
      expect(response.text).toContain('SupportPlanner');
    });

    it('should include login link', async () => {
      const response = await request(app).get('/logged-out');
      
      expect(response.text).toContain('/auth/login');
      expect(response.text).toContain('Sign in again');
    });
  });
});
