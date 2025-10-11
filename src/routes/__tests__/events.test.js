import { describe, it, expect } from 'vitest';

describe('events routes', () => {
  describe('events module', () => {
    it('should export router', async () => {
      const events = await import('../events.js');
      expect(events).toHaveProperty('default');
      expect(typeof events.default).toBe('function'); // Router is a function
    });

    it('should be an Express router', async () => {
      const { default: router } = await import('../events.js');
      // Express routers have specific properties
      expect(router).toHaveProperty('stack');
      expect(Array.isArray(router.stack)).toBe(true);
    });

    it('should have multiple routes registered', async () => {
      const { default: router } = await import('../events.js');
      // The router should have routes for events operations
      expect(router.stack.length).toBeGreaterThan(0);
    });
  });
});
