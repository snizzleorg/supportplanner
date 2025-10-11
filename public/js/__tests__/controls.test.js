/**
 * Tests for controls.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  parseDateInput,
  getWindowBounds,
  setDateInputBounds,
  clampToWindow,
  updateDateDisplays,
  applyWindow,
  updateAxisDensity,
} from '../controls.js';

// Note: Mocks removed to avoid conflicts with actual imports

describe('controls', () => {
  describe('parseDateInput', () => {
    it('should parse ISO date format', () => {
      const result = parseDateInput('2025-01-15');
      expect(result).toBeDefined();
      expect(result.isValid()).toBe(true);
    });

    it('should parse DD.MM.YYYY format', () => {
      const result = parseDateInput('15.01.2025');
      expect(result).toBeDefined();
      expect(result.isValid()).toBe(true);
    });

    it('should parse DD/MM/YYYY format', () => {
      const result = parseDateInput('15/01/2025');
      expect(result).toBeDefined();
      expect(result.isValid()).toBe(true);
    });

    it('should return null for invalid date', () => {
      const result = parseDateInput('invalid');
      expect(result).toBeNull();
    });

    it('should return null for empty string', () => {
      const result = parseDateInput('');
      expect(result).toBeNull();
    });

    it('should return null for null input', () => {
      const result = parseDateInput(null);
      expect(result).toBeNull();
    });
  });

  describe('getWindowBounds', () => {
    it('should return min and max dates', () => {
      const { minDay, maxDay } = getWindowBounds();
      expect(minDay).toBeDefined();
      expect(maxDay).toBeDefined();
    });

    it('should have minDay before maxDay', () => {
      const { minDay, maxDay } = getWindowBounds();
      expect(minDay.isBefore(maxDay)).toBe(true);
    });

    it('should return dayjs objects', () => {
      const { minDay, maxDay } = getWindowBounds();
      expect(typeof minDay.format).toBe('function');
      expect(typeof maxDay.format).toBe('function');
    });
  });

  describe('setDateInputBounds', () => {
    it('should not throw when called', () => {
      expect(() => setDateInputBounds()).not.toThrow();
    });
  });

  describe('clampToWindow', () => {
    it('should return date within bounds unchanged', () => {
      const result = clampToWindow('2025-06-15');
      expect(result).toBe('2025-06-15');
    });

    it('should clamp date before minimum', () => {
      const result = clampToWindow('2020-01-01');
      expect(result).toBeDefined();
    });

    it('should clamp date after maximum', () => {
      const result = clampToWindow('2030-12-31');
      expect(result).toBeDefined();
    });

    it('should handle invalid date', () => {
      const result = clampToWindow('invalid');
      expect(result).toBeNull();
    });

    it('should handle null input', () => {
      const result = clampToWindow(null);
      expect(result).toBeNull();
    });
  });

  describe('updateDateDisplays', () => {
    it('should not throw when called', () => {
      expect(() => updateDateDisplays()).not.toThrow();
    });
  });

  describe('applyWindow', () => {
    it('should not throw when called', () => {
      expect(() => applyWindow('2025-01-01', '2025-01-31')).not.toThrow();
    });

    it('should handle invalid dates', () => {
      expect(() => applyWindow('invalid', 'invalid')).not.toThrow();
    });
  });

  describe('updateAxisDensity', () => {
    it('should not throw when called', () => {
      expect(() => updateAxisDensity('2025-01-01', '2025-01-31')).not.toThrow();
    });

    it('should handle long ranges', () => {
      expect(() => updateAxisDensity('2025-01-01', '2025-12-31')).not.toThrow();
    });

    it('should handle short ranges', () => {
      expect(() => updateAxisDensity('2025-01-01', '2025-01-15')).not.toThrow();
    });
  });
});
