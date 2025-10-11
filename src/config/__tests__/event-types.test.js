import { describe, it, expect, beforeEach } from 'vitest';
import { loadEventTypesConfig, getEventTypes, BASE_EVENT_TYPES } from '../event-types.js';

describe('event-types config', () => {
  describe('BASE_EVENT_TYPES', () => {
    it('should have default event types defined', () => {
      expect(BASE_EVENT_TYPES).toBeDefined();
      expect(typeof BASE_EVENT_TYPES).toBe('object');
    });

    it('should have vacation type', () => {
      expect(BASE_EVENT_TYPES.vacation).toBeDefined();
      expect(BASE_EVENT_TYPES.vacation).toHaveProperty('color');
      expect(BASE_EVENT_TYPES.vacation).toHaveProperty('patterns');
      expect(Array.isArray(BASE_EVENT_TYPES.vacation.patterns)).toBe(true);
    });

    it('should have sick type', () => {
      expect(BASE_EVENT_TYPES.sick).toBeDefined();
      expect(BASE_EVENT_TYPES.sick).toHaveProperty('color');
      expect(BASE_EVENT_TYPES.sick).toHaveProperty('patterns');
    });

    it('should have support type', () => {
      expect(BASE_EVENT_TYPES.support).toBeDefined();
      expect(BASE_EVENT_TYPES.support).toHaveProperty('color');
    });

    it('should have meeting type', () => {
      expect(BASE_EVENT_TYPES.meeting).toBeDefined();
      expect(BASE_EVENT_TYPES.meeting).toHaveProperty('color');
    });

    it('should have training type', () => {
      expect(BASE_EVENT_TYPES.training).toBeDefined();
      expect(BASE_EVENT_TYPES.training).toHaveProperty('color');
    });

    it('should have business type', () => {
      expect(BASE_EVENT_TYPES.business).toBeDefined();
      expect(BASE_EVENT_TYPES.business).toHaveProperty('color');
    });

    it('should have valid color codes', () => {
      Object.values(BASE_EVENT_TYPES).forEach(type => {
        expect(type.color).toMatch(/^#[0-9a-f]{6}$/i);
      });
    });
  });

  describe('loadEventTypesConfig', () => {
    it('should be a function', () => {
      expect(typeof loadEventTypesConfig).toBe('function');
    });

    it('should not throw when called', () => {
      expect(() => loadEventTypesConfig()).not.toThrow();
    });
  });

  describe('getEventTypes', () => {
    beforeEach(() => {
      loadEventTypesConfig();
    });

    it('should return event types object', () => {
      const types = getEventTypes();
      expect(types).toBeDefined();
      expect(typeof types).toBe('object');
    });

    it('should include base event types', () => {
      const types = getEventTypes();
      expect(types).toHaveProperty('vacation');
      expect(types).toHaveProperty('sick');
      expect(types).toHaveProperty('support');
      expect(types).toHaveProperty('meeting');
    });

    it('should return consistent results', () => {
      const types1 = getEventTypes();
      const types2 = getEventTypes();
      expect(types1).toEqual(types2);
    });
  });
});
