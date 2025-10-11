import { describe, it, expect } from 'vitest';

describe('session config', () => {
  describe('session module', () => {
    it('should export sessionMiddleware', async () => {
      const session = await import('../session.js');
      expect(session).toBeDefined();
      expect(session).toHaveProperty('sessionMiddleware');
      expect(typeof session.sessionMiddleware).toBe('function');
    });
  });
});
