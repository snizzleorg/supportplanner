/**
 * Tests for holidays-ui.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { upsertHolidayBackgrounds } from '../holidays-ui.js';

describe('holidays-ui', () => {
  describe('upsertHolidayBackgrounds', () => {
    let mockItems;
    let mockGetHolidays;
    let mockDayjs;

    beforeEach(() => {
      mockItems = {
        get: vi.fn(() => []),
        getIds: vi.fn(() => []),
        add: vi.fn(),
        remove: vi.fn(),
      };

      mockGetHolidays = vi.fn();
      
      mockDayjs = vi.fn((date) => ({
        startOf: vi.fn(() => ({
          toDate: () => new Date(date),
          add: vi.fn(() => ({
            toDate: () => new Date(new Date(date).getTime() + 86400000),
          })),
          format: vi.fn(() => '2025-01-01'),
        })),
        format: vi.fn(() => '2025-01-01'),
      }));
    });

    it('should remove existing holiday items', async () => {
      mockItems.getIds.mockReturnValueOnce(['holiday-2025-01-01', 'holiday-2025-12-25']);
      mockGetHolidays.mockResolvedValueOnce([]);

      await upsertHolidayBackgrounds(mockItems, '2025-01-01', '2025-12-31', mockGetHolidays, mockDayjs);

      expect(mockItems.remove).toHaveBeenCalledWith(['holiday-2025-01-01', 'holiday-2025-12-25']);
    });

    it('should add holiday background items', async () => {
      mockGetHolidays.mockResolvedValueOnce([
        { date: new Date('2025-01-01'), name: 'New Year' },
        { date: new Date('2025-12-25'), name: 'Christmas' },
      ]);

      await upsertHolidayBackgrounds(mockItems, '2025-01-01', '2025-12-31', mockGetHolidays, mockDayjs);

      expect(mockItems.add).toHaveBeenCalled();
      const addedItems = mockItems.add.mock.calls[0][0];
      expect(addedItems).toHaveLength(2);
    });

    it('should create background items with correct properties', async () => {
      mockGetHolidays.mockResolvedValueOnce([
        { date: new Date('2025-01-01'), name: 'New Year' },
      ]);

      await upsertHolidayBackgrounds(mockItems, '2025-01-01', '2025-12-31', mockGetHolidays, mockDayjs);

      const addedItems = mockItems.add.mock.calls[0][0];
      expect(addedItems[0].type).toBe('background');
      expect(addedItems[0].className).toBe('holiday-bg');
      expect(addedItems[0].editable).toBe(false);
      expect(addedItems[0].selectable).toBe(false);
    });

    it('should handle empty holidays', async () => {
      mockGetHolidays.mockResolvedValueOnce([]);

      await upsertHolidayBackgrounds(mockItems, '2025-01-01', '2025-12-31', mockGetHolidays, mockDayjs);

      expect(mockItems.add).not.toHaveBeenCalled();
    });

    it('should handle null items', async () => {
      await expect(
        upsertHolidayBackgrounds(null, '2025-01-01', '2025-12-31', mockGetHolidays, mockDayjs)
      ).resolves.not.toThrow();
    });

    it('should handle null getHolidaysInRange', async () => {
      await expect(
        upsertHolidayBackgrounds(mockItems, '2025-01-01', '2025-12-31', null, mockDayjs)
      ).resolves.not.toThrow();
    });

    it('should handle null dayjs', async () => {
      await expect(
        upsertHolidayBackgrounds(mockItems, '2025-01-01', '2025-12-31', mockGetHolidays, null)
      ).resolves.not.toThrow();
    });

    it('should set holiday title', async () => {
      mockGetHolidays.mockResolvedValueOnce([
        { date: new Date('2025-01-01'), name: 'New Year' },
      ]);

      await upsertHolidayBackgrounds(mockItems, '2025-01-01', '2025-12-31', mockGetHolidays, mockDayjs);

      const addedItems = mockItems.add.mock.calls[0][0];
      expect(addedItems[0].title).toBe('New Year');
    });
  });
});
