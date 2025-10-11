import { describe, it, expect } from 'vitest';

describe('rate-limit config', () => {
  describe('rate-limit module', () => {
    it('should export rate limiters', async () => {
      const rateLimit = await import('../rate-limit.js');
      expect(rateLimit).toBeDefined();
      expect(rateLimit).toHaveProperty('apiLimiter');
      expect(rateLimit).toHaveProperty('authLimiter');
      expect(rateLimit).toHaveProperty('refreshLimiter');
    });
  });
});
