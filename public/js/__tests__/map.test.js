/**
 * Tests for map.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderMapMarkers } from '../map.js';

describe('map', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="map"></div>';
    vi.clearAllMocks();
  });

  describe('renderMapMarkers', () => {
    it('should initialize map on first call', async () => {
      const items = [];
      const groups = {
        get: vi.fn(() => ({ bg: '#ff0000' })),
      };

      await renderMapMarkers(items, groups);

      expect(global.L.map).toHaveBeenCalledWith('map');
    });

    it('should handle empty items', async () => {
      const items = [];
      const groups = { get: vi.fn() };

      await expect(renderMapMarkers(items, groups)).resolves.not.toThrow();
    });

    it('should skip items without location', async () => {
      const items = [
        { id: 1, summary: 'Event 1' },
        { id: 2, summary: 'Event 2' },
      ];
      const groups = { get: vi.fn() };

      await renderMapMarkers(items, groups);

      expect(global.L.marker).not.toHaveBeenCalled();
    });

    it('should handle null items', async () => {
      const groups = { get: vi.fn() };
      await expect(renderMapMarkers(null, groups)).resolves.not.toThrow();
    });

    it('should handle undefined items', async () => {
      const groups = { get: vi.fn() };
      await expect(renderMapMarkers(undefined, groups)).resolves.not.toThrow();
    });

    it('should handle multiple calls', async () => {
      const items = [];
      const groups = { get: vi.fn() };

      await renderMapMarkers(items, groups);
      await expect(renderMapMarkers(items, groups)).resolves.not.toThrow();
    });

    it('should accept groups parameter', async () => {
      const items = [];
      const groups = {
        get: vi.fn(() => ({ bg: '#00ff00' })),
      };

      await expect(renderMapMarkers(items, groups)).resolves.not.toThrow();
    });
  });
});
