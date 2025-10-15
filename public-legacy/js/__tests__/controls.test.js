/**
 * Tests for controls.js
 */

import { describe, it, expect } from 'vitest';

describe('controls', () => {
  describe('module exports', () => {
    it('should be importable', async () => {
      const module = await import('../controls.js');
      expect(module.parseDateInput).toBeDefined();
      expect(module.getWindowBounds).toBeDefined();
      expect(module.setDateInputBounds).toBeDefined();
      expect(module.clampToWindow).toBeDefined();
      expect(module.updateDateDisplays).toBeDefined();
      expect(module.applyWindow).toBeDefined();
      expect(module.updateAxisDensity).toBeDefined();
      expect(module.initTimelineControls).toBeDefined();
      expect(module.initDateInputs).toBeDefined();
      expect(module.initTimelinePanEvents).toBeDefined();
      expect(module.initResizeHandler).toBeDefined();
    });

    it('should export functions', async () => {
      const module = await import('../controls.js');
      expect(typeof module.parseDateInput).toBe('function');
      expect(typeof module.getWindowBounds).toBe('function');
      expect(typeof module.clampToWindow).toBe('function');
    });
  });
});
