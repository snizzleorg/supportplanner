import { describe, it, expect } from 'vitest';
import { isValidDate } from '../date.js';

describe('date utils', () => {
  describe('isValidDate', () => {
    it('should return true for valid ISO date strings', () => {
      expect(isValidDate('2025-10-11')).toBe(true);
      expect(isValidDate('2025-01-01')).toBe(true);
      expect(isValidDate('2025-12-31')).toBe(true);
    });

    it('should return true for valid ISO datetime strings', () => {
      expect(isValidDate('2025-10-11T12:00:00Z')).toBe(true);
      expect(isValidDate('2025-10-11T12:00:00.000Z')).toBe(true);
    });

    it('should return true for valid date formats', () => {
      expect(isValidDate('October 11, 2025')).toBe(true);
      expect(isValidDate('10/11/2025')).toBe(true);
    });

    it('should return false for invalid date strings', () => {
      expect(isValidDate('invalid')).toBe(false);
      expect(isValidDate('not-a-date')).toBe(false);
      expect(isValidDate('2025-13-01')).toBe(false); // Invalid month
    });

    it('should return false for null, undefined, or empty strings', () => {
      expect(isValidDate(null)).toBe(false);
      expect(isValidDate(undefined)).toBe(false);
      expect(isValidDate('')).toBe(false);
    });

    it('should return false for non-date values', () => {
      expect(isValidDate('abc123')).toBe(false);
      expect(isValidDate('not-a-real-date')).toBe(false);
      expect(isValidDate('xyz')).toBe(false);
    });
  });
});
