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

// Mock DOM module
vi.mock('../dom.js', () => ({
  fromEl: { value: '2025-01-01', min: '', max: '' },
  toEl: { value: '2025-01-31', min: '', max: '' },
  fromDateDisplay: { textContent: '' },
  toDateDisplay: { textContent: '' },
}));

// Mock state module
vi.mock('../state.js', () => ({
  timeline: {
    setWindow: vi.fn(),
    setOptions: vi.fn(),
  },
}));

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
    it('should set min and max attributes on date inputs', () => {
      const { fromEl, toEl } = require('../dom.js');
      setDateInputBounds();
      
      expect(fromEl.min).toBeDefined();
      expect(fromEl.max).toBeDefined();
      expect(toEl.min).toBeDefined();
      expect(toEl.max).toBeDefined();
    });

    it('should not throw on missing elements', () => {
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
    it('should update display elements', () => {
      const { fromDateDisplay, toDateDisplay } = require('../dom.js');
      updateDateDisplays();
      
      expect(fromDateDisplay.textContent).toBeDefined();
      expect(toDateDisplay.textContent).toBeDefined();
    });

    it('should not throw on missing elements', () => {
      expect(() => updateDateDisplays()).not.toThrow();
    });
  });

  describe('applyWindow', () => {
    it('should set timeline window', () => {
      const { timeline } = require('../state.js');
      applyWindow('2025-01-01', '2025-01-31');
      
      expect(timeline.setWindow).toHaveBeenCalled();
    });

    it('should handle null timeline', () => {
      const State = require('../state.js');
      State.timeline = null;
      expect(() => applyWindow('2025-01-01', '2025-01-31')).not.toThrow();
    });

    it('should handle invalid dates', () => {
      expect(() => applyWindow('invalid', 'invalid')).not.toThrow();
    });
  });

  describe('updateAxisDensity', () => {
    it('should update timeline axis options', () => {
      const { timeline } = require('../state.js');
      updateAxisDensity('2025-01-01', '2025-01-31');
      
      expect(timeline.setOptions).toHaveBeenCalled();
    });

    it('should handle null timeline', () => {
      const State = require('../state.js');
      State.timeline = null;
      expect(() => updateAxisDensity('2025-01-01', '2025-01-31')).not.toThrow();
    });

    it('should use condensed view for long ranges', () => {
      const { timeline } = require('../state.js');
      updateAxisDensity('2025-01-01', '2025-12-31');
      
      expect(timeline.setOptions).toHaveBeenCalled();
    });

    it('should use detailed view for short ranges', () => {
      const { timeline } = require('../state.js');
      updateAxisDensity('2025-01-01', '2025-01-15');
      
      expect(timeline.setOptions).toHaveBeenCalled();
    });
  });
});
