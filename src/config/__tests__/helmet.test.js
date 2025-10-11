import { describe, it, expect } from 'vitest';

describe('helmet config', () => {
  describe('helmet module', () => {
    it('should export helmetMiddleware', async () => {
      const helmet = await import('../helmet.js');
      expect(helmet).toBeDefined();
      expect(helmet).toHaveProperty('helmetMiddleware');
      expect(typeof helmet.helmetMiddleware).toBe('function');
    });
  });
});
