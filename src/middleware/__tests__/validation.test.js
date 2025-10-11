import { describe, it, expect } from 'vitest';

describe('validation middleware', () => {
  describe('validation module', () => {
    it('should export validation functions', async () => {
      const validation = await import('../validation.js');
      expect(validation).toHaveProperty('validate');
      expect(validation).toHaveProperty('eventValidation');
      expect(validation).toHaveProperty('uidValidation');
      expect(typeof validation.validate).toBe('function');
    });

    it('should export eventValidation as array', async () => {
      const { eventValidation } = await import('../validation.js');
      expect(Array.isArray(eventValidation)).toBe(true);
      expect(eventValidation.length).toBeGreaterThan(0);
    });

    it('should export uidValidation as array', async () => {
      const { uidValidation } = await import('../validation.js');
      expect(Array.isArray(uidValidation)).toBe(true);
      expect(uidValidation.length).toBeGreaterThan(0);
    });
  });
});
