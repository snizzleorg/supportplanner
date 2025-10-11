import { describe, it, expect } from 'vitest';

describe('cors config', () => {
  describe('cors module', () => {
    it('should export corsMiddleware', async () => {
      const cors = await import('../cors.js');
      expect(cors).toBeDefined();
      expect(cors).toHaveProperty('corsMiddleware');
      expect(typeof cors.corsMiddleware).toBe('function');
    });
  });
});
