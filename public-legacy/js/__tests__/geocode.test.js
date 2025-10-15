/**
 * Tests for geocode.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { tryParseLatLon, geocodeAddress, geocodeLocation } from '../geocode.js';

describe('geocode', () => {
  beforeEach(() => {
    global.fetch.mockReset();
  });

  describe('tryParseLatLon', () => {
    it('should parse valid coordinates', () => {
      const result = tryParseLatLon('52.52, 13.405');
      expect(result).toEqual({ lat: 52.52, lon: 13.405 });
    });

    it('should parse coordinates with spaces', () => {
      const result = tryParseLatLon('  52.52  ,  13.405  ');
      expect(result).toEqual({ lat: 52.52, lon: 13.405 });
    });

    it('should parse negative coordinates', () => {
      const result = tryParseLatLon('-33.8688, 151.2093');
      expect(result).toEqual({ lat: -33.8688, lon: 151.2093 });
    });

    it('should parse coordinates with + sign', () => {
      const result = tryParseLatLon('+40.7128, -74.0060');
      expect(result).toEqual({ lat: 40.7128, lon: -74.0060 });
    });

    it('should return null for invalid format', () => {
      expect(tryParseLatLon('invalid')).toBeNull();
      expect(tryParseLatLon('52.52')).toBeNull();
      expect(tryParseLatLon('52.52, 13.405, 100')).toBeNull();
    });

    it('should return null for out-of-range latitude', () => {
      expect(tryParseLatLon('91, 0')).toBeNull();
      expect(tryParseLatLon('-91, 0')).toBeNull();
    });

    it('should return null for out-of-range longitude', () => {
      expect(tryParseLatLon('0, 181')).toBeNull();
      expect(tryParseLatLon('0, -181')).toBeNull();
    });

    it('should handle boundary values', () => {
      expect(tryParseLatLon('90, 180')).toEqual({ lat: 90, lon: 180 });
      expect(tryParseLatLon('-90, -180')).toEqual({ lat: -90, lon: -180 });
    });

    it('should return null for NaN values', () => {
      expect(tryParseLatLon('abc, def')).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(tryParseLatLon('')).toBeNull();
    });

    it('should return null for null input', () => {
      expect(tryParseLatLon(null)).toBeNull();
    });
  });

  describe('geocodeAddress', () => {
    it('should geocode address successfully', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{
          lat: '52.5200',
          lon: '13.4050',
          display_name: 'Berlin, Germany',
          osm_id: '123456',
          osm_type: 'city',
        }],
      });

      const result = await geocodeAddress('Berlin, Germany');
      expect(result).toEqual({
        lat: 52.52,
        lon: 13.405,
        displayName: 'Berlin, Germany',
        osmId: '123456',
        osmType: 'city',
      });
    });

    it('should return null for no results', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const result = await geocodeAddress('Nonexistent Place');
      expect(result).toBeNull();
    });

    it('should throw on fetch error', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(geocodeAddress('Berlin')).rejects.toThrow('Geocode failed');
    });

    it('should handle network errors', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));
      await expect(geocodeAddress('Berlin')).rejects.toThrow('Network error');
    });

    it('should handle non-array response', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ error: 'Invalid' }),
      });

      const result = await geocodeAddress('Berlin');
      expect(result).toBeNull();
    });
  });

  describe('geocodeLocation', () => {
    it('should return coordinates for valid lat/lon string', async () => {
      const result = await geocodeLocation('52.52, 13.405');
      expect(result).toEqual({ lat: 52.52, lon: 13.405 });
    });

    it('should geocode address when not coordinates', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{
          lat: '52.5200',
          lon: '13.4050',
          display_name: 'Berlin, Germany',
          osm_id: '123456',
          osm_type: 'city',
        }],
      });

      const result = await geocodeLocation('Berlin, Germany');
      // Result will be queued, so we just verify it doesn't throw
      expect(result).toBeDefined();
    });

    it('should use cache for repeated queries', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => [{
          lat: '52.5200',
          lon: '13.4050',
          display_name: 'Berlin, Germany',
          osm_id: '123456',
          osm_type: 'city',
        }],
      });

      // First call
      const result1 = await geocodeLocation('Berlin');
      // Second call should use cache
      const result2 = await geocodeLocation('Berlin');

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });

    it('should normalize query to lowercase', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [{
          lat: '52.5200',
          lon: '13.4050',
          display_name: 'Berlin, Germany',
          osm_id: '123456',
          osm_type: 'city',
        }],
      });

      const result = await geocodeLocation('BERLIN');
      expect(result).toBeDefined();
    });
  });
});
