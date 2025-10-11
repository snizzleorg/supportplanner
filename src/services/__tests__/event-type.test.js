import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getEventType } from '../event-type.js';

// Mock the config module
vi.mock('../../config/index.js', () => ({
  getEventTypes: () => ({
    vacation: {
      color: '#ffccbc',
      patterns: ['vacation', 'urlaub', 'holiday', 'pto']
    },
    sick: {
      color: '#f8bbd0',
      patterns: ['sick', 'krank', 'illness']
    },
    support: {
      color: '#c5e1a5',
      patterns: ['support', 'on-call', 'bereitschaft']
    },
    meeting: {
      color: '#bbdefb',
      patterns: ['meeting', 'besprechung', 'conference']
    },
    _default: {
      color: '#e0e0e0'
    }
  })
}));

describe('event-type service', () => {
  describe('getEventType', () => {
    it('should return "vacation" for vacation-related summaries', () => {
      expect(getEventType('Vacation in Hawaii')).toBe('vacation');
      expect(getEventType('PTO Day')).toBe('vacation');
      expect(getEventType('Holiday')).toBe('vacation');
      expect(getEventType('Urlaub')).toBe('vacation');
    });

    it('should return "sick" for sick-related summaries', () => {
      expect(getEventType('Sick Day')).toBe('sick');
      expect(getEventType('Illness')).toBe('sick');
      expect(getEventType('Krank')).toBe('sick');
    });

    it('should return "support" for support-related summaries', () => {
      expect(getEventType('Support Call')).toBe('support');
      expect(getEventType('On-Call Duty')).toBe('support');
      expect(getEventType('Bereitschaft')).toBe('support');
    });

    it('should return "meeting" for meeting-related summaries', () => {
      expect(getEventType('Team Meeting')).toBe('meeting');
      expect(getEventType('Conference Call')).toBe('meeting');
      expect(getEventType('Besprechung')).toBe('meeting');
    });

    it('should be case-insensitive', () => {
      expect(getEventType('VACATION')).toBe('vacation');
      expect(getEventType('VaCaTiOn')).toBe('vacation');
      expect(getEventType('MEETING')).toBe('meeting');
    });

    it('should return "default" for unmatched summaries', () => {
      expect(getEventType('Random Event')).toBe('default');
      expect(getEventType('Some Other Thing')).toBe('default');
      expect(getEventType('Unclassified')).toBe('default');
    });

    it('should return "default" for empty or null summaries', () => {
      expect(getEventType('')).toBe('default');
      expect(getEventType(null)).toBe('default');
      expect(getEventType(undefined)).toBe('default');
    });

    it('should match patterns within longer strings', () => {
      expect(getEventType('Annual vacation trip to Spain')).toBe('vacation');
      expect(getEventType('Quarterly team meeting with stakeholders')).toBe('meeting');
    });
  });
});
