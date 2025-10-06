// Map rendering module using Leaflet
// Exports renderMapMarkers(allServerItems, groups) which initializes the map once and renders clustered pins per location/calendar

import { geocodeLocation } from './geocode.js';

let map; // Leaflet map instance
let markersLayer; // Layer group for markers

function escapeHtml(unsafe) {
  if (unsafe === undefined || unsafe === null) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function initMapOnce() {
  if (map) return;
  const mapEl = document.getElementById('map');
  if (!mapEl) return;
  // L is provided globally by Leaflet script in index.html
  map = L.map('map');
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
  markersLayer = L.layerGroup().addTo(map);
  map.setView([51.1657, 10.4515], 5); // default: Germany
  try {
    if (window.__MAP_TESTING) {
      console.log('[map] initMapOnce called, markersLayer ready');
    }
  } catch (_) {}
}

function parseHex(color) {
  const m = String(color).trim().match(/^#?([a-fA-F0-9]{6})$/);
  if (!m) return null;
  const h = m[1];
  return {
    r: parseInt(h.slice(0,2), 16),
    g: parseInt(h.slice(2,4), 16),
    b: parseInt(h.slice(4,6), 16)
  };
}
function clamp(v, min=0, max=255) { return Math.max(min, Math.min(max, v)); }
function toHex({r,g,b}) {
  const h = (n)=> clamp(Math.round(n)).toString(16).padStart(2,'0');
  return `#${h(r)}${h(g)}${h(b)}`;
}
function strengthenColor(color) {
  const rgb = parseHex(color);
  if (!rgb) return color;
  const boost = (c)=> clamp((c - 128) * 1.6 + 128);
  const darken = (c)=> clamp(c * 0.85);
  return toHex({ r: darken(boost(rgb.r)), g: darken(boost(rgb.g)), b: darken(boost(rgb.b)) });
}
function makePinIcon(color) {
  const base = color || '#3b82f6';
  const stroke = '#1f2937';
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="30" height="44" viewBox="0 0 30 44">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="1" stdDeviation="1" flood-opacity="0.3"/>
    </filter>
  </defs>
  <g filter="url(#shadow)">
    <path d="M15 1 C8 1 2.5 6.6 2.5 13.5 c0 9.6 10.7 18.4 11.5 19.0a1.6 1.6 0 0 0 2.0 0C16.8 31.9 27.5 23.1 27.5 13.5 27.5 6.6 22 1 15 1z" 
          fill="${base}" 
          stroke="${stroke}" 
          stroke-width="1.7" 
          fill-opacity="0.9"/>
    <circle cx="15" cy="13.5" r="5.2" 
            fill="#ffffff" 
            fill-opacity="0.98" 
            stroke="${stroke}" 
            stroke-width="1"/>
  </g>
</svg>`;
  const url = 'data:image/svg+xml;base64,' + btoa(svg);
  return L.icon({ iconUrl: url, iconSize: [30, 44], iconAnchor: [15, 43], popupAnchor: [0, -34]});
}

export async function renderMapMarkers(allServerItems, groups) {
  initMapOnce();
  if (!map || !markersLayer) return;
  try { if (window.__MAP_TESTING) console.log('[map] renderMapMarkers start', (allServerItems||[]).length); } catch (_) {}
  markersLayer.clearLayers();
  const bounds = [];

  const getGroupColor = (groupId) => {
    const g = groups.get(groupId);
    if (!g) return '#3b82f6';
    if (g.bg) return g.bg;
    if (g.style) {
      const m = String(g.style).match(/background-color:\s*([^;]+)/i);
      if (m && m[1]) return m[1].trim();
    }
    return '#3b82f6';
  };

  const byLocThenGroup = new Map();
  for (const it of allServerItems) {
    const loc = (it.location || '').trim();
    if (!loc) continue;
    if (!byLocThenGroup.has(loc)) byLocThenGroup.set(loc, new Map());
    const inner = byLocThenGroup.get(loc);
    const gid = it.group || '__nogroup__';
    if (!inner.has(gid)) inner.set(gid, []);
    inner.get(gid).push(it);
  }

  const addOffset = (lat, lon, index, total) => {
    if (total <= 1) return { lat, lon };
    const radiusMeters = 12;
    const angle = (2 * Math.PI * index) / total;
    const dLat = (radiusMeters * Math.sin(angle)) / 111111;
    const dLon = (radiusMeters * Math.cos(angle)) / (111111 * Math.max(0.1, Math.cos(lat * Math.PI / 180)));
    return { lat: lat + dLat, lon: lon + dLon };
  };

  for (const [loc, inner] of byLocThenGroup.entries()) {
    // Geocode the location string
    let latlon = await geocodeLocation(loc);
    if (!latlon) continue;
    const entries = Array.from(inner.entries());
    const total = entries.length;
    entries.forEach(([gid, evs], idx) => {
      const color = getGroupColor(gid);
      const { lat, lon } = addOffset(latlon.lat, latlon.lon, idx, total);
      const marker = L.marker([lat, lon], { icon: makePinIcon(color) }).addTo(markersLayer);
      try {
        if (window.__MAP_TESTING) {
          window.__mapMarkerAddedCount = (window.__mapMarkerAddedCount||0) + 1;
          console.log('[map] marker added', loc, gid, lat, lon);
        }
      } catch (_) {}
      bounds.push([lat, lon]);
      const list = evs.slice(0, 5)
        .map(e => `<li>${escapeHtml(e.content || e.summary || 'Untitled')} (${escapeHtml(e.start)} → ${escapeHtml(e.end)})</li>`)
        .join('');
      const more = evs.length > 5 ? `<div>…and ${evs.length - 5} more</div>` : '';
      const who = (groups.get(gid)?.content) || '';
      marker.bindPopup(`<div><strong>${escapeHtml(loc)}</strong><div>${escapeHtml(who)}</div><ul>${list}</ul>${more}</div>`);
    });
  }

  if (bounds.length) {
    map.fitBounds(bounds, { padding: [20, 20] });
  }
}
