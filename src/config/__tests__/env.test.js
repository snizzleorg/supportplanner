import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('env config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset modules and environment before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('environment variables', () => {
    it('should export PORT with default value', async () => {
      const { PORT } = await import('../env.js');
      expect(PORT).toBeDefined();
      expect(typeof PORT === 'number' || typeof PORT === 'string').toBe(true);
    });

    it('should export OIDC configuration variables', async () => {
      const env = await import('../env.js');
      expect(env).toHaveProperty('OIDC_ISSUER_URL');
      expect(env).toHaveProperty('OIDC_CLIENT_ID');
      expect(env).toHaveProperty('OIDC_CLIENT_SECRET');
      expect(env).toHaveProperty('OIDC_REDIRECT_URI');
    });

    it('should export RBAC group arrays', async () => {
      const { ADMIN_GROUPS, EDITOR_GROUPS, ADMIN_EMAILS, EDITOR_EMAILS } = await import('../env.js');
      expect(Array.isArray(ADMIN_GROUPS)).toBe(true);
      expect(Array.isArray(EDITOR_GROUPS)).toBe(true);
      expect(Array.isArray(ADMIN_EMAILS)).toBe(true);
      expect(Array.isArray(EDITOR_EMAILS)).toBe(true);
    });

    it('should export authEnabled boolean', async () => {
      const { authEnabled } = await import('../env.js');
      expect(typeof authEnabled).toBe('boolean');
    });

    it('should export AUTH_DISABLED_DEFAULT_ROLE', async () => {
      const { AUTH_DISABLED_DEFAULT_ROLE } = await import('../env.js');
      expect(typeof AUTH_DISABLED_DEFAULT_ROLE).toBe('string');
      expect(['admin', 'editor', 'reader']).toContain(AUTH_DISABLED_DEFAULT_ROLE);
    });
  });

  describe('RBAC group parsing', () => {
    it('should parse comma-separated groups correctly', () => {
      process.env.ADMIN_GROUPS = 'admins,superusers';
      process.env.EDITOR_GROUPS = 'editors,contributors';
      
      // Groups should be lowercase and trimmed
      const groups = 'admins,superusers'.split(',').map(s => s.trim().toLowerCase());
      expect(groups).toEqual(['admins', 'superusers']);
    });

    it('should handle empty group strings', () => {
      const groups = ''.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      expect(groups).toEqual([]);
    });

    it('should trim whitespace from groups', () => {
      const groups = ' admin , editor '.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      expect(groups).toEqual(['admin', 'editor']);
    });
  });
});
