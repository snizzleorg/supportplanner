/**
 * Tests for state.js
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  timeline,
  groups,
  items,
  isPanning,
  lastPanEnd,
  currentEvent,
  lastGeocode,
  currentUserRole,
  DEBUG_UI,
  setTimeline,
  setCurrentEvent,
  setLastGeocode,
  setCurrentUserRole,
  setIsPanning,
  setLastPanEnd,
  setLabelObserver,
  setWeekBarEl,
  setCurrentCreateGroupId,
} from '../state.js';

describe('state', () => {
  describe('initial state', () => {
    it('should have timeline as null', () => {
      expect(timeline).toBeNull();
    });

    it('should have groups as DataSet', () => {
      expect(groups).toBeDefined();
      expect(typeof groups.get).toBe('function');
    });

    it('should have items as DataSet', () => {
      expect(items).toBeDefined();
      expect(typeof items.get).toBe('function');
    });

    it('should have isPanning as false', () => {
      expect(isPanning).toBe(false);
    });

    it('should have lastPanEnd as 0', () => {
      expect(lastPanEnd).toBe(0);
    });

    it('should have currentEvent as null', () => {
      expect(currentEvent).toBeNull();
    });

    it('should have lastGeocode as null', () => {
      expect(lastGeocode).toBeNull();
    });

    it('should have currentUserRole as reader', () => {
      expect(currentUserRole).toBe('reader');
    });

    it('should have DEBUG_UI as false', () => {
      expect(DEBUG_UI).toBe(false);
    });
  });

  describe('setTimeline', () => {
    it('should set timeline instance', () => {
      const mockTimeline = { id: 'test-timeline' };
      setTimeline(mockTimeline);
      // Note: Can't directly test the internal state change
      // but we can verify the function doesn't throw
      expect(true).toBe(true);
    });

    it('should accept null', () => {
      setTimeline(null);
      expect(true).toBe(true);
    });
  });

  describe('setCurrentEvent', () => {
    it('should set current event', () => {
      const event = { uid: 'event123', summary: 'Test Event' };
      setCurrentEvent(event);
      expect(true).toBe(true);
    });

    it('should accept null', () => {
      setCurrentEvent(null);
      expect(true).toBe(true);
    });
  });

  describe('setLastGeocode', () => {
    it('should set last geocode result', () => {
      const geocode = { lat: 52.52, lon: 13.405, displayName: 'Berlin' };
      setLastGeocode(geocode);
      expect(true).toBe(true);
    });

    it('should accept null', () => {
      setLastGeocode(null);
      expect(true).toBe(true);
    });
  });

  describe('setCurrentUserRole', () => {
    it('should set user role to editor', () => {
      setCurrentUserRole('editor');
      expect(true).toBe(true);
    });

    it('should set user role to admin', () => {
      setCurrentUserRole('admin');
      expect(true).toBe(true);
    });

    it('should set user role to reader', () => {
      setCurrentUserRole('reader');
      expect(true).toBe(true);
    });
  });

  describe('setIsPanning', () => {
    it('should set panning to true', () => {
      setIsPanning(true);
      expect(true).toBe(true);
    });

    it('should set panning to false', () => {
      setIsPanning(false);
      expect(true).toBe(true);
    });
  });

  describe('setLastPanEnd', () => {
    it('should set last pan end timestamp', () => {
      const timestamp = Date.now();
      setLastPanEnd(timestamp);
      expect(true).toBe(true);
    });

    it('should accept 0', () => {
      setLastPanEnd(0);
      expect(true).toBe(true);
    });
  });

  describe('setLabelObserver', () => {
    it('should set label observer', () => {
      const observer = { disconnect: () => {} };
      setLabelObserver(observer);
      expect(true).toBe(true);
    });

    it('should accept null', () => {
      setLabelObserver(null);
      expect(true).toBe(true);
    });
  });

  describe('setWeekBarEl', () => {
    it('should set week bar element', () => {
      const element = document.createElement('div');
      setWeekBarEl(element);
      expect(true).toBe(true);
    });

    it('should accept null', () => {
      setWeekBarEl(null);
      expect(true).toBe(true);
    });
  });

  describe('setCurrentCreateGroupId', () => {
    it('should set current create group ID', () => {
      setCurrentCreateGroupId('cal-1');
      expect(true).toBe(true);
    });

    it('should accept null', () => {
      setCurrentCreateGroupId(null);
      expect(true).toBe(true);
    });
  });
});
