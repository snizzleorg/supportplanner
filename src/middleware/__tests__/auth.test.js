import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

async function importAuthWithMocks({ authEnabled = true } = {}) {
  vi.resetModules();
  vi.doMock('../../config/index.js', () => ({
    OIDC_ISSUER_URL: 'https://issuer.example',
    OIDC_CLIENT_ID: 'client',
    OIDC_CLIENT_SECRET: 'secret',
    OIDC_REDIRECT_URI: 'http://localhost/auth/callback',
    OIDC_SCOPES: 'openid profile email',
    OIDC_TOKEN_AUTH_METHOD: 'client_secret_basic',
    OIDC_POST_LOGOUT_REDIRECT_URI: 'http://localhost/logged-out',
    ADMIN_GROUPS: [],
    EDITOR_GROUPS: [],
    ADMIN_EMAILS: [],
    EDITOR_EMAILS: [],
    authEnabled,
    AUTH_DISABLED_DEFAULT_ROLE: 'admin'
  }));

  vi.doMock('csrf-csrf', () => ({
    doubleCsrf: () => ({
      doubleCsrfProtection: (_req, _res, next) => next(),
      generateToken: () => 'test-csrf-token'
    })
  }));

  vi.doMock('openid-client', () => ({
    Issuer: {
      discover: vi.fn(async () => ({
        issuer: 'mock-issuer',
        metadata: {},
        Client: class MockClient {}
      }))
    },
    generators: {
      codeVerifier: () => 'verifier',
      codeChallenge: () => 'challenge',
      state: () => 'state'
    }
  }));

  return import('../auth.js');
}

describe('auth middleware', () => {
  describe('requireRole', () => {
    it('should export requireRole function', async () => {
      const { requireRole } = await importAuthWithMocks({ authEnabled: false });
      expect(typeof requireRole).toBe('function');
    });

    it('should return middleware function', async () => {
      const { requireRole } = await importAuthWithMocks({ authEnabled: false });
      const middleware = requireRole('reader');
      expect(typeof middleware).toBe('function');
      expect(middleware.length).toBe(3); // req, res, next
    });

    it('should allow reader role for reader requirement', async () => {
      const { requireRole } = await importAuthWithMocks({ authEnabled: false });
      const middleware = requireRole('reader');
      
      const req = { session: { user: { role: 'reader' } } };
      const res = {};
      const next = vi.fn();
      
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should deny reader role for editor requirement', async () => {
      const { requireRole } = await importAuthWithMocks({ authEnabled: false });
      const middleware = requireRole('editor');
      
      const req = { session: { user: { role: 'reader' } } };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };
      const next = vi.fn();
      
      middleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Forbidden',
        required: 'editor',
        role: 'reader'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('initializeAuth', () => {
    it('should export initializeAuth function', async () => {
      const { initializeAuth } = await importAuthWithMocks({ authEnabled: true });
      expect(typeof initializeAuth).toBe('function');
    });

    it('should return 401 JSON for unauthenticated /api/* requests (no redirect)', async () => {
      const prevBotTokens = process.env.BOT_TOKENS;
      process.env.BOT_TOKENS = '';

      const { initializeAuth, requireRole } = await importAuthWithMocks({ authEnabled: true });

      const app = express();
      app.use((req, _res, next) => {
        req.session = {};
        next();
      });
      initializeAuth(app);

      app.get('/api/protected', requireRole('reader'), (_req, res) => {
        res.json({ ok: true });
      });

      const res = await request(app).get('/api/protected');
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Unauthorized' });

      process.env.BOT_TOKENS = prevBotTokens;
    });

    it('should accept BOT_TOKENS bearer token and allow access to reader-protected route', async () => {
      const prevBotTokens = process.env.BOT_TOKENS;
      process.env.BOT_TOKENS = 'abc124:reader';

      const { initializeAuth, requireRole } = await importAuthWithMocks({ authEnabled: true });

      const app = express();
      app.use((req, _res, next) => {
        req.session = {};
        next();
      });
      initializeAuth(app);

      app.get('/api/protected', requireRole('reader'), (_req, res) => {
        res.json({ ok: true });
      });

      const res = await request(app)
        .get('/api/protected')
        .set('Authorization', 'Bearer abc124');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });

      process.env.BOT_TOKENS = prevBotTokens;
    });
  });
});
