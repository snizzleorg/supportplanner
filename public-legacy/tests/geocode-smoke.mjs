#!/usr/bin/env node
// Headless tests for geocode helpers (with mocked fetch)
// Usage: node public/tests/geocode-smoke.mjs

// Minimal mock Response
class MockResponse {
  constructor(body, ok=true, status=200) { this._body = body; this.ok = ok; this.status = status; }
  async json() { return this._body; }
}

// Install fetch mock before importing module under test
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes('nominatim.openstreetmap.org')) {
    // Return a single Berlin coordinate
    return new MockResponse([{ lat: '52.5200', lon: '13.4050', display_name: 'Berlin, Germany', osm_id: 123, osm_type: 'R' }]);
  }
  return new MockResponse({}, false, 404);
};

const { tryParseLatLon, geocodeAddress, geocodeLocation } = await import('../js/geocode.js');

function assert(name, cond, details='') {
  const ok = !!cond;
  console.log(JSON.stringify({ name, ok, details }));
  if (!ok) process.exitCode = 1;
}

// Tests
const p1 = tryParseLatLon('52.5, 13.4');
assert('tryParseLatLon basic', p1 && Math.abs(p1.lat-52.5)<1e-6 && Math.abs(p1.lon-13.4)<1e-6, p1);

const p2 = tryParseLatLon('invalid');
assert('tryParseLatLon invalid', p2 === null);

const a1 = await geocodeAddress('Berlin');
assert('geocodeAddress mocked', a1 && a1.lat && a1.lon, a1);

const l1 = await geocodeLocation('52.5200,13.4050');
assert('geocodeLocation coords passthrough', l1 && Math.abs(l1.lat-52.52)<1e-6 && Math.abs(l1.lon-13.405)<1e-6, l1);

const l2 = await geocodeLocation('Berlin');
assert('geocodeLocation mocked', l2 && l2.lat && l2.lon, l2);

process.exit(process.exitCode || 0);
