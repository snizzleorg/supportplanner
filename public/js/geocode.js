/**
 * Geocoding Module
 * 
 * Provides geocoding services using OpenStreetMap Nominatim API.
 * Implements rate limiting, caching, and coordinate parsing.
 * 
 * @module geocode
 */

/**
 * Cache for geocoded locations
 * @type {Map<string, {lat: number, lon: number}>}
 */
const geocodeCache = new Map();

/**
 * Queue for pending geocode requests
 * @type {Array<{query: string, resolve: Function}>}
 */
let geocodeQueue = [];

/**
 * Timer for processing geocode queue
 * @type {number|null}
 */
let geocodeTimer = null;

/**
 * Adds a geocode request to the queue
 * @private
 * @param {string} query - Location query string
 * @param {Function} resolve - Promise resolve function
 */
function enqueueGeocode(query, resolve) {
  geocodeQueue.push({ query, resolve });
  if (!geocodeTimer) {
    geocodeTimer = setInterval(processGeocodeQueue, 350); // ~3 req/sec rate limit
  }
}

/**
 * Processes queued geocode requests in batches
 * @private
 * @returns {Promise<void>}
 */
async function processGeocodeQueue() {
  if (geocodeQueue.length === 0) {
    clearInterval(geocodeTimer);
    geocodeTimer = null;
    return;
  }
  const batch = geocodeQueue.splice(0, 3);
  await Promise.all(batch.map(async ({ query, resolve }) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) throw new Error('geocode http');
      const data = await res.json();
      if (data && data[0]) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        geocodeCache.set(query, { lat, lon });
        resolve({ lat, lon });
      } else {
        resolve(null);
      }
    } catch (_) {
      resolve(null);
    }
  }));
}

/**
 * Attempts to parse latitude/longitude coordinates from text
 * Supports format: "lat, lon" (e.g., "52.52, 13.405")
 * 
 * @param {string} text - Text to parse for coordinates
 * @returns {{lat: number, lon: number}|null} Parsed coordinates or null if invalid
 */
export function tryParseLatLon(text) {
  const m = String(text).trim().match(/^\s*([+-]?\d{1,2}(?:\.\d+)?)\s*,\s*([+-]?\d{1,3}(?:\.\d+)?)\s*$/);
  if (!m) return null;
  const lat = parseFloat(m[1]);
  const lon = parseFloat(m[2]);
  if (isNaN(lat) || isNaN(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

/**
 * Geocodes an address using Nominatim API (direct, not queued)
 * 
 * @param {string} q - Address query string
 * @returns {Promise<{lat: number, lon: number, displayName: string, osmId: string, osmType: string}|null>} Geocode result or null
 * @throws {Error} If the geocode request fails
 */
export async function geocodeAddress(q) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error(`Geocode failed: ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  const hit = data[0];
  return { lat: parseFloat(hit.lat), lon: parseFloat(hit.lon), displayName: hit.display_name, osmId: hit.osm_id, osmType: hit.osm_type };
}

/**
 * Geocodes a location string (coordinates or address)
 * First tries to parse as coordinates, then geocodes as address with caching and rate limiting
 * 
 * @param {string} locationStr - Location string (coordinates or address)
 * @returns {Promise<{lat: number, lon: number}|null>} Geocoded coordinates or null
 */
export async function geocodeLocation(locationStr) {
  const coords = tryParseLatLon(locationStr);
  if (coords) return coords;
  const key = String(locationStr).trim().toLowerCase();
  if (geocodeCache.has(key)) return geocodeCache.get(key);
  return new Promise((resolve) => enqueueGeocode(key, resolve));
}
