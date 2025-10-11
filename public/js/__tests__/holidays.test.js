/**
 * Tests for holidays.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getHolidaysInRange } from '../holidays.js';

describe('holidays', () => {
  beforeEach(() => {
    global.fetch.mockReset();
  });

  describe('getHolidaysInRange', () => {
    it('should fetch holidays for single year', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            date: '2025-01-01',
            localName: 'New Year',
            counties: null,
          },
          {
            date: '2025-12-25',
            localName: 'Christmas',
            counties: null,
          },
        ],
      });

      const holidays = await getHolidaysInRange('2025-01-01', '2025-12-31');
      expect(holidays).toHaveLength(2);
      expect(holidays[0].name).toBe('New Year');
    });

    it('should filter Berlin-specific holidays', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            date: '2025-01-01',
            localName: 'New Year',
            counties: null,
          },
          {
            date: '2025-03-08',
            localName: 'Women\'s Day',
            counties: ['DE-BE'],
          },
          {
            date: '2025-10-03',
            localName: 'Unity Day',
            counties: ['DE-BY'],
          },
        ],
      });

      const holidays = await getHolidaysInRange('2025-01-01', '2025-12-31');
      expect(holidays).toHaveLength(2);
      expect(holidays.some(h => h.name === 'Women\'s Day')).toBe(true);
      expect(holidays.some(h => h.name === 'Unity Day')).toBe(false);
    });

    it('should handle multiple years', async () => {
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ date: '2024-12-25', localName: 'Christmas', counties: null }],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ date: '2025-01-01', localName: 'New Year', counties: null }],
        });

      const holidays = await getHolidaysInRange('2024-12-01', '2025-01-31');
      expect(holidays).toHaveLength(2);
    });

    it('should filter by date range', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { date: '2025-01-01', localName: 'New Year', counties: null },
          { date: '2025-06-15', localName: 'Mid Year', counties: null },
          { date: '2025-12-25', localName: 'Christmas', counties: null },
        ],
      });

      const holidays = await getHolidaysInRange('2025-06-01', '2025-06-30');
      expect(holidays).toHaveLength(1);
      expect(holidays[0].name).toBe('Mid Year');
    });

    it('should return empty array on fetch error', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));
      const holidays = await getHolidaysInRange('2025-01-01', '2025-12-31');
      expect(holidays).toEqual([]);
    });

    it('should mark global holidays', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { date: '2025-01-01', localName: 'New Year', counties: null },
          { date: '2025-03-08', localName: 'Women\'s Day', counties: ['DE-BE'] },
        ],
      });

      const holidays = await getHolidaysInRange('2025-01-01', '2025-12-31');
      expect(holidays[0].global).toBe(true);
      expect(holidays[1].global).toBe(false);
    });

    it('should handle multiple calls', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => [{ date: '2025-01-01', localName: 'New Year', counties: null }],
      });

      const result1 = await getHolidaysInRange('2025-01-01', '2025-01-31');
      const result2 = await getHolidaysInRange('2025-02-01', '2025-02-28');

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });
  });
});
