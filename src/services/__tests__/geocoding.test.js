/**
 * Tests for geocoding service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { geocodeLocation, geocodeLocations, getCacheStats, clearCache } from '../geocoding.js';
import fs from 'fs/promises';

// Mock fetch globally
global.fetch = vi.fn();

// Mock fs module
vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
  }
}));

describe('geocoding service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock successful mkdir
    fs.mkdir.mockResolvedValue();
    fs.writeFile.mockResolvedValue();
    fs.readFile.mockRejectedValue({ code: 'ENOENT' }); // No cache file initially
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('geocodeLocation', () => {
    it('should parse coordinate strings', async () => {
      const result = await geocodeLocation('52.52, 13.405');
      expect(result).toEqual({ lat: 52.52, lon: 13.405 });
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should handle various coordinate formats', async () => {
      const result1 = await geocodeLocation('52.52,13.405');
      expect(result1).toEqual({ lat: 52.52, lon: 13.405 });

      const result2 = await geocodeLocation('  52.52  ,  13.405  ');
      expect(result2).toEqual({ lat: 52.52, lon: 13.405 });

      const result3 = await geocodeLocation('-33.8688, 151.2093');
      expect(result3).toEqual({ lat: -33.8688, lon: 151.2093 });
    });

    it('should reject invalid coordinates', async () => {
      const result1 = await geocodeLocation('invalid');
      expect(result1).toBeNull();

      const result2 = await geocodeLocation('100, 200'); // Out of range
      expect(result2).toBeNull();

      const result3 = await geocodeLocation('');
      expect(result3).toBeNull();

      const result4 = await geocodeLocation(null);
      expect(result4).toBeNull();
    });

    it('should geocode addresses using Nominatim', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{
          lat: '52.5200',
          lon: '13.4050',
          display_name: 'Berlin, Germany'
        }]
      });

      const result = await geocodeLocation('Berlin, Germany');
      expect(result).toEqual({ lat: 52.52, lon: 13.405 });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('Berlin%2C%20Germany'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': 'SupportPlanner/0.4.0'
          })
        })
      );
    });

    it('should return null for addresses with no results', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      });

      const result = await geocodeLocation('NonexistentPlace12345');
      expect(result).toBeNull();
    });

    it('should handle Nominatim errors', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      const result = await geocodeLocation('Some Address');
      expect(result).toBeNull();
    });

    it('should handle network errors', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await geocodeLocation('Some Address');
      expect(result).toBeNull();
    });
  });

  describe('geocodeLocations', () => {
    it('should geocode multiple locations in batch', async () => {
      // Clear cache first to ensure clean state
      await clearCache();
      
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ lat: '40.7128', lon: '-74.0060' }]
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [{ lat: '34.0522', lon: '-118.2437' }]
        });

      const locations = ['New York, USA', 'Los Angeles, USA'];
      const results = await geocodeLocations(locations);

      expect(results.size).toBe(2);
      expect(results.get('New York, USA')).toEqual({ lat: 40.7128, lon: -74.006 });
      expect(results.get('Los Angeles, USA')).toEqual({ lat: 34.0522, lon: -118.2437 });
    });

    it('should handle mixed coordinates and addresses', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ lat: '52.5200', lon: '13.4050' }]
      });

      const locations = ['48.8566, 2.3522', 'Berlin, Germany'];
      const results = await geocodeLocations(locations);

      expect(results.size).toBe(2);
      expect(results.get('48.8566, 2.3522')).toEqual({ lat: 48.8566, lon: 2.3522 });
      expect(results.get('Berlin, Germany')).toEqual({ lat: 52.52, lon: 13.405 });
    });

    it('should skip null/empty locations', async () => {
      const locations = [null, '', 'Berlin, Germany'];
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ lat: '52.5200', lon: '13.4050' }]
      });

      const results = await geocodeLocations(locations);
      expect(results.size).toBe(1);
    });
  });

  describe('cache management', () => {
    it('should provide cache statistics', async () => {
      const stats = await getCacheStats();
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('locations');
      expect(Array.isArray(stats.locations)).toBe(true);
    });

    it('should clear cache', async () => {
      await clearCache();
      expect(fs.writeFile).toHaveBeenCalled();
    });
  });
});
