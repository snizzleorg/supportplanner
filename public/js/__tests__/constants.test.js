/**
 * Tests for constants.js
 */

import { describe, it, expect } from 'vitest';
import {
  MOBILE_BREAKPOINT,
  MOBILE_VIEWPORT,
  TOUCH,
  TIMELINE,
  RATE_LIMITS,
  Z_INDEX,
  ANIMATION,
} from '../constants.js';

describe('constants', () => {
  describe('MOBILE_BREAKPOINT', () => {
    it('should be a number', () => {
      expect(typeof MOBILE_BREAKPOINT).toBe('number');
    });

    it('should be 640', () => {
      expect(MOBILE_BREAKPOINT).toBe(640);
    });
  });

  describe('MOBILE_VIEWPORT', () => {
    it('should have iPhone landscape dimensions', () => {
      expect(MOBILE_VIEWPORT.IPHONE_LANDSCAPE).toEqual({ width: 844, height: 390 });
    });

    it('should have iPhone portrait dimensions', () => {
      expect(MOBILE_VIEWPORT.IPHONE_PORTRAIT).toEqual({ width: 390, height: 844 });
    });
  });

  describe('TOUCH', () => {
    it('should have all required touch timing properties', () => {
      expect(TOUCH).toHaveProperty('LONG_PRESS_DURATION');
      expect(TOUCH).toHaveProperty('MOVEMENT_TOLERANCE');
      expect(TOUCH).toHaveProperty('DOUBLE_TAP_THRESHOLD');
      expect(TOUCH).toHaveProperty('PAN_DEBOUNCE');
      expect(TOUCH).toHaveProperty('TOOLTIP_AUTO_HIDE');
    });

    it('should have reasonable timing values', () => {
      expect(TOUCH.LONG_PRESS_DURATION).toBeGreaterThan(0);
      expect(TOUCH.MOVEMENT_TOLERANCE).toBeGreaterThan(0);
      expect(TOUCH.DOUBLE_TAP_THRESHOLD).toBeGreaterThan(0);
      expect(TOUCH.PAN_DEBOUNCE).toBeGreaterThan(0);
      expect(TOUCH.TOOLTIP_AUTO_HIDE).toBeGreaterThan(0);
    });
  });

  describe('TIMELINE', () => {
    it('should have all required timeline properties', () => {
      expect(TIMELINE).toHaveProperty('MIN_HEIGHT');
      expect(TIMELINE).toHaveProperty('AXIS_HEIGHT_TOP');
      expect(TIMELINE).toHaveProperty('AXIS_HEIGHT_BOTTOM');
      expect(TIMELINE).toHaveProperty('CONDENSED_THRESHOLD');
    });

    it('should have positive values', () => {
      expect(TIMELINE.MIN_HEIGHT).toBeGreaterThan(0);
      expect(TIMELINE.AXIS_HEIGHT_TOP).toBeGreaterThan(0);
      expect(TIMELINE.AXIS_HEIGHT_BOTTOM).toBeGreaterThan(0);
      expect(TIMELINE.CONDENSED_THRESHOLD).toBeGreaterThan(0);
    });
  });

  describe('RATE_LIMITS', () => {
    it('should have all required rate limit properties', () => {
      expect(RATE_LIMITS).toHaveProperty('API_WINDOW');
      expect(RATE_LIMITS).toHaveProperty('API_MAX');
      expect(RATE_LIMITS).toHaveProperty('AUTH_WINDOW');
      expect(RATE_LIMITS).toHaveProperty('AUTH_MAX');
      expect(RATE_LIMITS).toHaveProperty('REFRESH_WINDOW');
      expect(RATE_LIMITS).toHaveProperty('REFRESH_MAX');
    });

    it('should have reasonable limits', () => {
      expect(RATE_LIMITS.API_MAX).toBeGreaterThan(0);
      expect(RATE_LIMITS.AUTH_MAX).toBeGreaterThan(0);
      expect(RATE_LIMITS.REFRESH_MAX).toBeGreaterThan(0);
    });
  });

  describe('Z_INDEX', () => {
    it('should have all required z-index layers', () => {
      expect(Z_INDEX).toHaveProperty('BACKDROP');
      expect(Z_INDEX).toHaveProperty('PANELS');
      expect(Z_INDEX).toHaveProperty('SIDE_TABS');
      expect(Z_INDEX).toHaveProperty('ROTATE_OVERLAY');
      expect(Z_INDEX).toHaveProperty('MODAL');
    });

    it('should have increasing z-index values', () => {
      expect(Z_INDEX.BACKDROP).toBeLessThan(Z_INDEX.PANELS);
      expect(Z_INDEX.PANELS).toBeLessThan(Z_INDEX.SIDE_TABS);
      expect(Z_INDEX.SIDE_TABS).toBeLessThan(Z_INDEX.ROTATE_OVERLAY);
      expect(Z_INDEX.ROTATE_OVERLAY).toBeLessThan(Z_INDEX.MODAL);
    });
  });

  describe('ANIMATION', () => {
    it('should have all required animation properties', () => {
      expect(ANIMATION).toHaveProperty('PANEL_SLIDE');
      expect(ANIMATION).toHaveProperty('BACKDROP_FADE');
      expect(ANIMATION).toHaveProperty('MODAL_FADE');
    });

    it('should have positive duration values', () => {
      expect(ANIMATION.PANEL_SLIDE).toBeGreaterThan(0);
      expect(ANIMATION.BACKDROP_FADE).toBeGreaterThan(0);
      expect(ANIMATION.MODAL_FADE).toBeGreaterThan(0);
    });
  });
});
