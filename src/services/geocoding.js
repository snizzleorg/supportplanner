/**
 * Geocoding Service
 * 
 * Provides server-side geocoding with persistent caching.
 * Geocodes event locations using OpenStreetMap Nominatim API.
 * 
 * @module services/geocoding
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
// Note: Using Node.js 20+ built-in fetch (no import needed)

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Path to geocoding cache file
 * @type {string}
 */
const CACHE_FILE = path.join(__dirname, '../../data/geocode-cache.json');

/**
 * In-memory cache for geocoded locations
 * @type {Map<string, {lat: number, lon: number, timestamp: number}>}
 */
let geocodeCache = new Map();

/**
 * Whether cache has been loaded from disk
 * @type {boolean}
 */
let cacheLoaded = false;

/**
 * Rate limiting: last request timestamp
 * @type {number}
 */
let lastRequestTime = 0;

/**
 * Rate limiting: minimum delay between requests (ms)
 * @type {number}
 */
const MIN_REQUEST_DELAY = 1500; // ~0.66 req/sec for Nominatim (conservative)

/**
 * Cache TTL: 90 days in milliseconds
 * @type {number}
 */
const CACHE_TTL = 90 * 24 * 60 * 60 * 1000; // 90 days

/**
 * Loads geocoding cache from disk
 * @returns {Promise<void>}
 */
async function loadCache() {
  if (cacheLoaded) return;
  
  try {
    const data = await fs.readFile(CACHE_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    const now = Date.now();
    let expiredCount = 0;
    
    // Load cache and filter out expired entries
    geocodeCache = new Map();
    for (const [key, value] of Object.entries(parsed)) {
      const age = now - (value.timestamp || 0);
      if (age < CACHE_TTL) {
        geocodeCache.set(key, value);
      } else {
        expiredCount++;
      }
    }
    
    console.log(`[Geocoding] Loaded ${geocodeCache.size} cached locations (${expiredCount} expired entries removed)`);
    
    // Save cleaned cache if we removed expired entries
    if (expiredCount > 0) {
      await saveCache();
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('[Geocoding] Error loading cache:', err.message);
    }
    // File doesn't exist or error - start with empty cache
    geocodeCache = new Map();
  }
  
  cacheLoaded = true;
}

/**
 * Saves geocoding cache to disk
 * @returns {Promise<void>}
 */
async function saveCache() {
  try {
    // Ensure data directory exists
    const dataDir = path.dirname(CACHE_FILE);
    await fs.mkdir(dataDir, { recursive: true });
    
    // Convert Map to object for JSON serialization
    const obj = Object.fromEntries(geocodeCache);
    await fs.writeFile(CACHE_FILE, JSON.stringify(obj, null, 2), 'utf-8');
    console.log(`[Geocoding] Saved ${geocodeCache.size} locations to cache`);
  } catch (err) {
    console.error('[Geocoding] Error saving cache:', err.message);
  }
}

/**
 * Attempts to parse latitude/longitude coordinates from text
 * Supports format: "lat, lon" (e.g., "52.52, 13.405")
 * 
 * @param {string} text - Text to parse for coordinates
 * @returns {{lat: number, lon: number}|null} Parsed coordinates or null if invalid
 */
function tryParseLatLon(text) {
  if (!text) return null;
  const m = String(text).trim().match(/^\s*([+-]?\d{1,2}(?:\.\d+)?)\s*,\s*([+-]?\d{1,3}(?:\.\d+)?)\s*$/);
  if (!m) return null;
  const lat = parseFloat(m[1]);
  const lon = parseFloat(m[2]);
  if (isNaN(lat) || isNaN(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

/**
 * Geocodes an address using Nominatim API with rate limiting
 * 
 * @param {string} address - Address to geocode
 * @returns {Promise<{lat: number, lon: number}|null>} Geocoded coordinates or null
 */
async function geocodeWithNominatim(address) {
  // Rate limiting
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_DELAY) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_DELAY - timeSinceLastRequest));
  }
  
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'SupportPlanner/0.4.0' // Nominatim requires User-Agent
      }
    });
    
    lastRequestTime = Date.now();
    
    if (!response.ok) {
      console.error(`[Geocoding] Nominatim error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      console.log(`[Geocoding] No results for: ${address}`);
      return null;
    }
    
    const result = data[0];
    return {
      lat: parseFloat(result.lat),
      lon: parseFloat(result.lon)
    };
  } catch (err) {
    console.error(`[Geocoding] Error geocoding "${address}":`, err.message);
    return null;
  }
}

/**
 * Geocodes a location string (coordinates or address)
 * Uses cache and only geocodes if not cached
 * 
 * @param {string} locationStr - Location string (coordinates or address)
 * @returns {Promise<{lat: number, lon: number}|null>} Geocoded coordinates or null
 */
export async function geocodeLocation(locationStr) {
  if (!locationStr) return null;
  
  // Ensure cache is loaded
  await loadCache();
  
  // Try parsing as coordinates first
  const coords = tryParseLatLon(locationStr);
  if (coords) return coords;
  
  // Normalize location string for cache key
  const cacheKey = String(locationStr).trim().toLowerCase();
  
  // Check cache and validate TTL
  if (geocodeCache.has(cacheKey)) {
    const cached = geocodeCache.get(cacheKey);
    const age = Date.now() - (cached.timestamp || 0);
    
    if (age < CACHE_TTL) {
      // Cache hit and not expired
      return { lat: cached.lat, lon: cached.lon };
    } else {
      // Cache expired - remove it
      console.log(`[Geocoding] Cache expired for "${locationStr}" (age: ${Math.round(age / (24 * 60 * 60 * 1000))} days)`);
      geocodeCache.delete(cacheKey);
    }
  }
  
  // Geocode with Nominatim
  console.log(`[Geocoding] Geocoding new location: ${locationStr}`);
  const result = await geocodeWithNominatim(locationStr);
  
  if (result) {
    // Cache the result
    geocodeCache.set(cacheKey, {
      lat: result.lat,
      lon: result.lon,
      timestamp: Date.now()
    });
    
    // Save cache asynchronously (don't wait)
    saveCache().catch(err => console.error('[Geocoding] Error saving cache:', err));
  }
  
  return result;
}

/**
 * Geocodes multiple locations in batch
 * Returns a map of location strings to coordinates
 * 
 * @param {string[]} locations - Array of location strings
 * @returns {Promise<Map<string, {lat: number, lon: number}>>} Map of locations to coordinates
 */
export async function geocodeLocations(locations) {
  await loadCache();
  
  const results = new Map();
  const toGeocode = [];
  
  // First pass: check cache and parse coordinates
  for (const loc of locations) {
    if (!loc) continue;
    
    // Try parsing as coordinates
    const coords = tryParseLatLon(loc);
    if (coords) {
      results.set(loc, coords);
      continue;
    }
    
    // Check cache
    const cacheKey = String(loc).trim().toLowerCase();
    if (geocodeCache.has(cacheKey)) {
      const cached = geocodeCache.get(cacheKey);
      results.set(loc, { lat: cached.lat, lon: cached.lon });
      continue;
    }
    
    // Need to geocode
    toGeocode.push(loc);
  }
  
  // Second pass: geocode uncached locations
  if (toGeocode.length > 0) {
    console.log(`[Geocoding] Geocoding ${toGeocode.length} new locations`);
    
    for (const loc of toGeocode) {
      const result = await geocodeLocation(loc);
      if (result) {
        results.set(loc, result);
      }
    }
  }
  
  return results;
}

/**
 * Gets cache statistics
 * 
 * @returns {Promise<{size: number, locations: string[]}>} Cache statistics
 */
export async function getCacheStats() {
  await loadCache();
  
  return {
    size: geocodeCache.size,
    locations: Array.from(geocodeCache.keys())
  };
}

/**
 * Clears the geocoding cache
 * 
 * @returns {Promise<void>}
 */
export async function clearCache() {
  geocodeCache.clear();
  await saveCache();
  console.log('[Geocoding] Cache cleared');
}
