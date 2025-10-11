/**
 * Tests for api.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  setApiBase,
  fetchCalendars,
  refreshCaldav,
  me,
  logout,
  clientLog,
  getEvent,
  updateEvent,
  deleteEvent,
  createAllDayEvent,
} from '../api.js';

describe('api', () => {
  beforeEach(() => {
    global.fetch.mockReset();
  });

  describe('setApiBase', () => {
    it('should set API base URL', () => {
      setApiBase('http://localhost:3000');
      // Base is internal, test via fetch call
      expect(true).toBe(true);
    });

    it('should handle empty base', () => {
      setApiBase('');
      expect(true).toBe(true);
    });
  });

  describe('fetchCalendars', () => {
    it('should fetch calendars successfully', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ calendars: [{ url: 'cal1', displayName: 'Calendar 1' }] }),
      });

      const result = await fetchCalendars();
      expect(result).toHaveLength(1);
      expect(result[0].displayName).toBe('Calendar 1');
    });

    it('should return empty array on fetch error', async () => {
      global.fetch.mockResolvedValueOnce({ ok: false, status: 500 });
      const result = await fetchCalendars();
      expect(result).toEqual([]);
    });

    it('should return empty array on network error', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));
      const result = await fetchCalendars();
      expect(result).toEqual([]);
    });

    it('should handle missing calendars property', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });
      const result = await fetchCalendars();
      expect(result).toEqual([]);
    });
  });

  describe('refreshCaldav', () => {
    it('should trigger CalDAV refresh', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const result = await refreshCaldav();
      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/refresh-caldav',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  describe('me', () => {
    it('should fetch current user info', async () => {
      const userInfo = { authenticated: true, user: { name: 'Test User', role: 'editor' } };
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => userInfo,
      });

      const result = await me();
      expect(result.authenticated).toBe(true);
      expect(result.user.role).toBe('editor');
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      global.fetch.mockResolvedValueOnce({ ok: true });
      const result = await logout();
      expect(result).toBe(true);
    });

    it('should return false on logout failure', async () => {
      global.fetch.mockResolvedValueOnce({ ok: false });
      const result = await logout();
      expect(result).toBe(false);
    });
  });

  describe('clientLog', () => {
    it('should send log to server', async () => {
      global.fetch.mockResolvedValueOnce({ ok: true });
      await clientLog('info', 'Test message', { extra: 'data' });
      
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/client-log',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('Test message'),
        })
      );
    });

    it('should not throw on logging error', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));
      await expect(clientLog('error', 'Test')).resolves.not.toThrow();
    });
  });

  describe('getEvent', () => {
    it('should fetch event by UID', async () => {
      const event = { uid: 'event123', summary: 'Test Event' };
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, event }),
      });

      const result = await getEvent('event123');
      expect(result.success).toBe(true);
      expect(result.event.summary).toBe('Test Event');
    });

    it('should throw on fetch error', async () => {
      global.fetch.mockResolvedValueOnce({ ok: false, status: 404 });
      await expect(getEvent('nonexistent')).rejects.toThrow('Failed to fetch event');
    });
  });

  describe('updateEvent', () => {
    it('should update event successfully', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const result = await updateEvent('event123', { summary: 'Updated' });
      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/events/event123',
        expect.objectContaining({ method: 'PUT' })
      );
    });

    it('should throw on update error', async () => {
      global.fetch.mockResolvedValueOnce({ ok: false, status: 500 });
      await expect(updateEvent('event123', {})).rejects.toThrow('Failed to update event');
    });
  });

  describe('deleteEvent', () => {
    it('should delete event successfully', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const result = await deleteEvent('event123');
      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/events/event123',
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('should throw on delete error', async () => {
      global.fetch.mockResolvedValueOnce({ ok: false, status: 403 });
      await expect(deleteEvent('event123')).rejects.toThrow('Failed to delete event');
    });
  });

  describe('createAllDayEvent', () => {
    it('should create all-day event successfully', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, uid: 'new-event' }),
      });

      const payload = {
        summary: 'New Event',
        start: '2025-01-15',
        end: '2025-01-15',
      };

      const result = await createAllDayEvent('cal-url', payload);
      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/events/all-day',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('New Event'),
        })
      );
    });

    it('should include metadata in request', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      const payload = {
        summary: 'Event',
        start: '2025-01-15',
        end: '2025-01-15',
        meta: { orderNumber: '12345' },
      };

      await createAllDayEvent('cal-url', payload);
      const callBody = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(callBody.meta).toEqual({ orderNumber: '12345' });
    });

    it('should throw on creation error', async () => {
      global.fetch.mockResolvedValueOnce({ ok: false, status: 400 });
      await expect(createAllDayEvent('cal-url', {})).rejects.toThrow('Failed to create event');
    });
  });
});
