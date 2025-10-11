/**
 * Tests for events.js
 */

import { describe, it, expect, vi } from 'vitest';
import { extractUidFromItemId } from '../events.js';

describe('events', () => {
  describe('extractUidFromItemId', () => {
    it('should extract UID from item ID', () => {
      const itemId = 'cal-1-https://example.com/calendars/user/cal1/event123';
      const uid = extractUidFromItemId(itemId);
      expect(uid).toBe('event123');
    });

    it('should extract UID with special characters', () => {
      const itemId = 'cal-2-https://example.com/calendars/user/cal2/event-with-dashes-123';
      const uid = extractUidFromItemId(itemId);
      expect(uid).toBe('event-with-dashes-123');
    });

    it('should handle simple UIDs', () => {
      const itemId = 'cal-1-simple-uid';
      const uid = extractUidFromItemId(itemId);
      expect(uid).toBe('simple-uid');
    });

    it('should return null for null input', () => {
      const uid = extractUidFromItemId(null);
      expect(uid).toBeNull();
    });

    it('should return null for undefined input', () => {
      const uid = extractUidFromItemId(undefined);
      expect(uid).toBeNull();
    });

    it('should return empty string for empty input', () => {
      const uid = extractUidFromItemId('');
      expect(uid).toBe('');
    });

    it('should handle single segment', () => {
      const uid = extractUidFromItemId('single');
      expect(uid).toBe('single');
    });
  });

  describe('initTimelineClickHandler', () => {
    it('should be a function', async () => {
      const { initTimelineClickHandler } = await import('../events.js');
      expect(typeof initTimelineClickHandler).toBe('function');
    });
  });

  describe('initTimelineEvents', () => {
    it('should be a function', async () => {
      const { initTimelineEvents } = await import('../events.js');
      expect(typeof initTimelineEvents).toBe('function');
    });
  });
});
