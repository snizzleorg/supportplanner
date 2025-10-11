/**
 * Tests for timeline-ui.js
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { applyGroupLabelColors, renderWeekBar } from '../timeline-ui.js';

describe('timeline-ui', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div class="vis-timeline">
        <div class="vis-labelset">
          <div class="vis-label"><div class="vis-inner">Group 1</div></div>
          <div class="vis-label"><div class="vis-inner">Group 2</div></div>
        </div>
        <div class="vis-panel vis-bottom"></div>
      </div>
    `;
  });

  describe('applyGroupLabelColors', () => {
    it('should apply colors to labels', () => {
      const groups = {
        get: () => [
          { id: 1, bg: '#ff0000' },
          { id: 2, bg: '#00ff00' },
        ],
      };

      applyGroupLabelColors(groups);

      const labels = document.querySelectorAll('.vis-label');
      expect(labels[0].style.backgroundColor).toBe('rgb(255, 0, 0)');
      expect(labels[1].style.backgroundColor).toBe('rgb(0, 255, 0)');
    });

    it('should use fallback palette when no color specified', () => {
      const groups = {
        get: () => [
          { id: 1 },
          { id: 2 },
        ],
      };

      applyGroupLabelColors(groups);

      const labels = document.querySelectorAll('.vis-label');
      expect(labels[0].style.backgroundColor).toBeTruthy();
      expect(labels[1].style.backgroundColor).toBeTruthy();
    });

    it('should handle empty groups', () => {
      const groups = { get: () => [] };
      expect(() => applyGroupLabelColors(groups)).not.toThrow();
    });

    it('should handle null groups', () => {
      expect(() => applyGroupLabelColors(null)).not.toThrow();
    });

    it('should apply color to inner element', () => {
      const groups = {
        get: () => [{ id: 1, bg: '#ff0000' }],
      };

      applyGroupLabelColors(groups);

      const inner = document.querySelector('.vis-inner');
      expect(inner.style.backgroundColor).toBe('rgb(255, 0, 0)');
    });
  });

  describe('renderWeekBar', () => {
    it('should render week bar', () => {
      const timeline = {
        getWindow: () => ({
          start: new Date('2025-01-01'),
          end: new Date('2025-01-31'),
        }),
      };

      renderWeekBar(timeline);

      const weekBar = document.querySelector('.week-bar');
      expect(weekBar).toBeDefined();
    });

    it('should handle null timeline', () => {
      expect(() => renderWeekBar(null)).not.toThrow();
    });

    it('should handle undefined timeline', () => {
      expect(() => renderWeekBar(undefined)).not.toThrow();
    });

    it('should not throw when rendering week bar', () => {
      const timeline = {
        getWindow: () => ({
          start: new Date('2025-01-01'),
          end: new Date('2025-01-31'),
        }),
      };

      expect(() => renderWeekBar(timeline)).not.toThrow();
    });
  });
});
