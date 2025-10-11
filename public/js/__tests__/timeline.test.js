/**
 * Tests for timeline.js
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { initTimeline } from '../timeline.js';

describe('timeline', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="timeline"></div>';
  });

  describe('initTimeline', () => {
    it('should throw error if timelineEl is missing', () => {
      expect(() => initTimeline(null, {}, {})).toThrow('timelineEl is required');
    });

    it('should throw error if items is missing', () => {
      const el = document.getElementById('timeline');
      expect(() => initTimeline(el, null, {})).toThrow('items and groups DataSets are required');
    });

    it('should throw error if groups is missing', () => {
      const el = document.getElementById('timeline');
      expect(() => initTimeline(el, {}, null)).toThrow('items and groups DataSets are required');
    });

    it('should create timeline with valid parameters', () => {
      const el = document.getElementById('timeline');
      const items = { get: () => [] };
      const groups = { get: () => [] };
      
      const timeline = initTimeline(el, items, groups);
      expect(timeline).toBeDefined();
      expect(timeline.container).toBe(el);
    });

    it('should configure timeline options', () => {
      const el = document.getElementById('timeline');
      const items = { get: () => [] };
      const groups = { get: () => [] };
      
      const timeline = initTimeline(el, items, groups);
      expect(timeline.options).toBeDefined();
      expect(timeline.options.groupOrder).toBe('order');
      expect(timeline.options.stack).toBe(true);
    });

    it('should set min height option', () => {
      const el = document.getElementById('timeline');
      const items = { get: () => [] };
      const groups = { get: () => [] };
      
      const timeline = initTimeline(el, items, groups);
      expect(timeline.options.minHeight).toBeDefined();
    });

    it('should enable vertical scroll', () => {
      const el = document.getElementById('timeline');
      const items = { get: () => [] };
      const groups = { get: () => [] };
      
      const timeline = initTimeline(el, items, groups);
      expect(timeline.options.verticalScroll).toBe(true);
    });

    it('should enable zoomable', () => {
      const el = document.getElementById('timeline');
      const items = { get: () => [] };
      const groups = { get: () => [] };
      
      const timeline = initTimeline(el, items, groups);
      expect(timeline.options.zoomable).toBe(true);
    });
  });
});
