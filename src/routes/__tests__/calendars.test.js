import { describe, it, expect } from 'vitest';

describe('calendars routes', () => {
  describe('calendars module', () => {
    it('should export router', async () => {
      const calendars = await import('../calendars.js');
      expect(calendars).toHaveProperty('default');
      expect(typeof calendars.default).toBe('function'); // Router is a function
    });

    it('should be an Express router', async () => {
      const { default: router } = await import('../calendars.js');
      // Express routers have specific properties
      expect(router).toHaveProperty('stack');
      expect(Array.isArray(router.stack)).toBe(true);
    });

    it('should have routes registered', async () => {
      const { default: router } = await import('../calendars.js');
      // The router should have routes for calendar operations
      expect(router.stack.length).toBeGreaterThan(0);
    });
  });
});
