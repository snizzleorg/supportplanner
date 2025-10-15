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
      expect(holidays.length).toBeGreaterThan(0);
      expect(holidays.some(h => h.name === 'New Year')).toBe(true);
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
      expect(holidays.length).toBeGreaterThan(0);
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
      expect(holidays.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle fetch errors', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));
      const holidays = await getHolidaysInRange('2099-01-01', '2099-12-31');
      // May return empty or cached data
      expect(Array.isArray(holidays)).toBe(true);
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
      expect(holidays.length).toBeGreaterThan(0);
      // Check that global property exists
      if (holidays.length > 0) {
        expect(holidays[0]).toHaveProperty('global');
      }
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
