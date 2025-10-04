// (moved: location helpers are declared after imports)

import dayjs from 'https://cdn.jsdelivr.net/npm/dayjs@1.11.13/+esm';
import { DataSet, Timeline } from 'https://cdn.jsdelivr.net/npm/vis-timeline@7.7.3/standalone/esm/vis-timeline-graph2d.min.js';
import { setupTooltipHandlers } from './custom-tooltip.js';
import { getHolidaysInRange } from './js/holidays.js';

// DOM Elements
const modal = document.getElementById('eventModal');
const modalContent = document.querySelector('#eventModal .modal-content');
const eventForm = document.getElementById('eventForm');
const closeBtn = document.querySelector('.close-btn');
const cancelBtn = document.getElementById('cancelEdit');
const saveBtn = document.getElementById('saveEvent');
const deleteBtn = document.getElementById('deleteEvent');
const eventIdInput = document.getElementById('eventId');
const eventTitleInput = document.getElementById('eventTitle');
const eventStartDateInput = document.getElementById('eventStartDate');
const eventEndDateInput = document.getElementById('eventEndDate');
const eventAllDayInput = document.getElementById('eventAllDay');
const eventDescriptionInput = document.getElementById('eventDescription');
const eventLocationInput = document.getElementById('eventLocation');
const eventCalendarSelect = document.getElementById('eventCalendar');
// Structured metadata inputs
const eventOrderNumberInput = document.getElementById('eventOrderNumber');
const eventTicketLinkInput = document.getElementById('eventTicketLink');
const eventSystemTypeInput = document.getElementById('eventSystemType');
const eventLocationHelp = document.getElementById('eventLocationHelp');
let lastGeocode = null;
let currentEvent = null;

const statusEl = document.getElementById('status');
const fromEl = document.getElementById('fromDate');
const toEl = document.getElementById('toDate');
const fromDateDisplay = document.getElementById('fromDateDisplay');
const toDateDisplay = document.getElementById('toDateDisplay');
const refreshBtn = document.getElementById('refreshBtn');
const fitBtn = document.getElementById('fitBtn');
const todayBtn = document.getElementById('todayBtn');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const showRangeBtn = document.getElementById('showRangeBtn');
const searchBox = document.getElementById('searchBox');
const clearSearchBtn = document.getElementById('clearSearch');
const timelineEl = document.getElementById('timeline');
let timeline;
let groups = new DataSet([]);
let items = new DataSet([]);
// Suppress click-after-drag: track user panning state
let isPanning = false;
let lastPanEnd = 0;
let labelObserver = null;
let refreshGen = 0; // generation guard for in-flight refreshes
let weekBarEl = null; // overlay container for week numbers at bottom
// Map timeline group IDs (cal-1, cal-2, ...) back to original server group IDs (calendar URLs)
const groupReverseMap = new Map();
// Map calendar URL -> timeline group id for quick lookup when adding items
const urlToGroupId = new Map();
// Track the group id used for the current create flow (for optimistic insert)
let currentCreateGroupId = null;
// Toggle to show/hide extra UI debug messages
const DEBUG_UI = false;

function setStatus(msg) {
  statusEl.textContent = msg || '';
}

// --- Search input wiring ---
if (searchBox) {
  searchBox.addEventListener('input', () => {
    currentSearch = searchBox.value || '';
    applySearchFilter();
  });
}
if (clearSearchBtn) {
  clearSearchBtn.addEventListener('click', () => {
    if (searchBox) searchBox.value = '';
    currentSearch = '';
    applySearchFilter();
  });
}

// --- Search / filter ---
let currentSearch = '';
function itemMatchesQuery(item, q) {
  if (!q) return true;
  const hay = [item.content, item.title, item.description, item.location];
  const meta = item.meta || {};
  hay.push(meta.orderNumber, meta.systemType, meta.ticketLink);
  return hay.filter(Boolean).some(v => String(v).toLowerCase().includes(q));
}
function applySearchFilter() {
  const q = (currentSearch || '').trim().toLowerCase();
  try {
    const els = document.querySelectorAll('.vis-timeline .vis-item');
    els.forEach(el => {
      const id = el.getAttribute('data-id');
      let it = null;
      if (id && items) {
        it = items.get(id);
        if (!it && !Number.isNaN(Number(id))) {
          it = items.get(Number(id));
        }
      }
      let match = false;
      if (it) {
        match = itemMatchesQuery(it, q);
      } else {
        // Fallback: use DOM text when item not found (e.g., id type mismatch during redraw)
        const txt = (el.textContent || '').toLowerCase();
        match = txt.includes(q);
      }
      el.classList.toggle('dimmed', !!q && !match);
      el.classList.toggle('search-match', !!q && match);
    });
  } catch (_) {}
}

// --- Week bar overlay (bottom) ---
function ensureWeekBar() {
  if (weekBarEl && weekBarEl.parentElement) return weekBarEl;
  weekBarEl = document.createElement('div');
  weekBarEl.className = 'week-bar';
  // Attach to the bottom panel so it overlays above the entire bottom axis
  const bottomPanel = document.querySelector('.vis-timeline .vis-panel.vis-bottom');
  if (bottomPanel && bottomPanel.appendChild) {
    bottomPanel.style.position = bottomPanel.style.position || 'relative';
    weekBarEl.style.zIndex = '3000';
    bottomPanel.appendChild(weekBarEl);
  } else if (timelineEl && timelineEl.appendChild) {
    timelineEl.appendChild(weekBarEl);
  }
  return weekBarEl;
}

function renderWeekBar(from, to) {
  try {
    if (!timeline) return;
    const bar = ensureWeekBar();
    if (!bar) return;
    // Clear existing chips
    while (bar.firstChild) bar.removeChild(bar.firstChild);
    const start = dayjs(from).startOf('day');
    const end = dayjs(to).endOf('day');
    // Find first Monday on/after start
    let ws = start;
    while (ws.day() !== 1) ws = ws.add(1, 'day');
    // Compute left offsets relative to bottom panel
    const bottomPanel = document.querySelector('.vis-timeline .vis-panel.vis-bottom');
    const panelRect = bottomPanel ? bottomPanel.getBoundingClientRect() : null;
    const centerContent = document.querySelector('.vis-timeline .vis-center .vis-content');
    const centerRect = centerContent ? centerContent.getBoundingClientRect() : null;
    // Map time -> X using current window and center content width
    const win = timeline.getWindow ? timeline.getWindow() : { start: from, end: to };
    const startMs = +new Date(win.start);
    const endMs = +new Date(win.end);
    const spanMs = Math.max(1, endMs - startMs);
    const contentWidth = centerContent ? centerContent.clientWidth : (timelineEl ? timelineEl.clientWidth : 1);
    // Span full width of axis panel
    bar.style.top = '0px';
    bar.style.bottom = '0px';
    bar.style.height = '100%';
    let count = 0;
    // Draw vertical week boundary lines at each Monday boundary
    let tickCursor = start.clone();
    while (tickCursor.day() !== 1) tickCursor = tickCursor.add(1, 'day');
    while (tickCursor.isBefore(end)) {
      const tTick = +tickCursor.toDate();
      const fracTick = (tTick - startMs) / spanMs;
      const xTickAbs = (centerRect ? centerRect.left : 0) + (Math.max(0, Math.min(1, fracTick)) * contentWidth);
      if (isFinite(xTickAbs)) {
        const line = document.createElement('div');
        line.className = 'week-tick';
        const leftTick = (panelRect) ? (xTickAbs - panelRect.left) : xTickAbs;
        line.style.left = `${leftTick}px`;
        bar.appendChild(line);
      }
      tickCursor = tickCursor.add(7, 'day');
    }
    while (ws.isBefore(end)) {
      const iso = isoWeekNumber(ws.toDate());
      // place label roughly at week center (Mon + 3.5 days)
      const mid = ws.add(3, 'day').add(12, 'hour').toDate();
      const t = +mid;
      const frac = (t - startMs) / spanMs;
      const x = (centerRect ? centerRect.left : 0) + (Math.max(0, Math.min(1, frac)) * contentWidth);
      if (isFinite(x)) {
        const chip = document.createElement('div');
        chip.className = 'week-chip';
        chip.textContent = `W${String(iso).padStart(2, '0')}`;
        chip.style.position = 'absolute';
        const left = (panelRect) ? (x - panelRect.left) : x;
        chip.style.left = `${left}px`;
        chip.style.bottom = '2px';
        bar.appendChild(chip);
        count++;
      }
      ws = ws.add(7, 'day');
    }
    // Fallback: if none created (DOM differences), create labels stepping weekly from window start
    if (count === 0) {
      let cur = dayjs(win.start).startOf('day');
      while (cur.isBefore(win.end)) {
        const iso = isoWeekNumber(cur.toDate());
        const mid = cur.add(3, 'day').add(12, 'hour').toDate();
        const t = +mid;
        const frac = (t - startMs) / spanMs;
        const x = (centerRect ? centerRect.left : 0) + (Math.max(0, Math.min(1, frac)) * contentWidth);
        if (isFinite(x)) {
          const chip = document.createElement('div');
          chip.className = 'week-chip';
          chip.textContent = `W${String(iso).padStart(2, '0')}`;
          chip.style.position = 'absolute';
          const left = (panelRect) ? (x - panelRect.left) : x;
          chip.style.left = `${left}px`;
          chip.style.bottom = '2px';
          bar.appendChild(chip);
          count++;
        }
        cur = cur.add(7, 'day');
      }
      // Add a center debug chip to verify visibility
      const centerT = new Date((startMs + endMs) / 2);
      const fracC = (centerT - startMs) / spanMs;
      const xC = (centerRect ? centerRect.left : 0) + (Math.max(0, Math.min(1, fracC)) * contentWidth);
      if (isFinite(xC)) {
        const chip = document.createElement('div');
        chip.className = 'week-chip';
        chip.textContent = 'W?';
        chip.style.position = 'absolute';
        const left = (panelRect) ? (xC - panelRect.left) : xC;
        chip.style.left = `${left}px`;
        chip.style.bottom = '2px';
        bar.appendChild(chip);
      }
    }
    try { console.debug('[weekbar] rendered chips:', count); } catch (_) {}
  } catch (e) {
    try { console.warn('[weekbar] render failed', e); } catch (_) {}
  }
}

// --- Holidays and Special Dates ---
// getHolidaysInRange is now imported from './js/holidays.js'

// --- Map marker icon helpers ---
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
  // If hex, increase saturation/contrast by pushing away from mid gray and darkening slightly more
  const rgb = parseHex(color);
  if (!rgb) return color;
  // Stronger contrast boost and darken ~15%
  const boost = (c)=> clamp((c - 128) * 1.6 + 128);
  const darken = (c)=> clamp(c * 0.85);
  return toHex({ r: darken(boost(rgb.r)), g: darken(boost(rgb.g)), b: darken(boost(rgb.b)) });
}
function makePinIcon(color) {
  // Use the color directly for the pin body
  const base = color || '#3b82f6'; // Default blue to match the server's default
  const stroke = '#1f2937'; // dark outline for contrast
  
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="30" height="44" viewBox="0 0 30 44">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="1" stdDeviation="1" flood-opacity="0.3"/>
    </filter>
  </defs>
  <g filter="url(#shadow)">
    <!-- Pin body with the exact calendar color -->
    <path d="M15 1 C8 1 2.5 6.6 2.5 13.5 c0 9.6 10.7 18.4 11.5 19.0a1.6 1.6 0 0 0 2.0 0C16.8 31.9 27.5 23.1 27.5 13.5 27.5 6.6 22 1 15 1z" 
          fill="${base}" 
          stroke="${stroke}" 
          stroke-width="1.7" 
          fill-opacity="0.9"/>
    <!-- White center circle -->
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

// Generate a consistent color based on a string (matching backend logic)
function getColorForString(str) {
  if (!str) return '#2563eb';
  
  // Simple hash function to match the backend
  const hash = str.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0);
  }, 0);
  
  // More vibrant color palette for better visibility
  const colors = [
    '#3b82f6', // blue
    '#ec4899', // pink
    '#10b981', // green
    '#f59e0b', // amber
    '#8b5cf6', // violet
    '#06b6d4', // cyan
    '#f97316', // orange
    '#ef4444', // red
    '#a855f7', // purple
    '#14b8a6'  // teal
  ];
  
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

// Apply calendar group color to label rows so labels match map pin colors
const LABEL_PALETTE = ['#e0f2fe','#fce7f3','#dcfce7','#fff7ed','#ede9fe','#f1f5f9','#fef9c3','#fee2e2','#e9d5ff','#cffafe'];
function applyGroupLabelColors() {
  try {
    const labelNodes = document.querySelectorAll('.vis-timeline .vis-labelset .vis-label');
    if (!labelNodes || labelNodes.length === 0) return;
    // Get groups in current visual order as a fallback mapping
    const gs = (typeof groups?.get === 'function') ? groups.get() : [];
    labelNodes.forEach((node, idx) => {
      let color = '';
      const g = gs[idx];
      if (g) {
        color = g.bg || '';
        if (!color && g.style) {
          const m = String(g.style).match(/background-color:\s*([^;]+)/i);
          if (m && m[1]) color = m[1].trim();
        }
      }
      if (!color) color = LABEL_PALETTE[idx % LABEL_PALETTE.length];
      node.style.backgroundColor = color;
      const inner = node.querySelector('.vis-inner');
      if (inner) inner.style.backgroundColor = color;
    });
  } catch (e) {
    // ignore
  }
}

// --- Map: Leaflet setup and marker rendering ---
let map; // Leaflet map instance
let markersLayer; // Layer group for markers
const geocodeCache = new Map(); // location string -> {lat, lon}
let geocodeQueue = [];
let geocodeTimer = null;

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
  map = L.map('map');
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
  markersLayer = L.layerGroup().addTo(map);
  map.setView([51.1657, 10.4515], 5); // default: Germany
}

function enqueueGeocode(query, resolve) {
  geocodeQueue.push({ query, resolve });
  if (!geocodeTimer) {
    geocodeTimer = setInterval(processGeocodeQueue, 350); // ~3 req/sec
  }
}

async function processGeocodeQueue() {
  if (geocodeQueue.length === 0) {
    clearInterval(geocodeTimer);
    geocodeTimer = null;
    return;
  }
  // Process up to 3 per tick
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

async function geocodeLocation(locationStr) {
  // If coordinates, parse directly
  const coords = tryParseLatLon(locationStr);
  if (coords) return coords;
  const key = String(locationStr).trim().toLowerCase();
  if (geocodeCache.has(key)) return geocodeCache.get(key);
  return new Promise((resolve) => enqueueGeocode(key, resolve));
}

async function renderMapMarkers(allServerItems) {
  initMapOnce();
  if (!map || !markersLayer) return;
  markersLayer.clearLayers();
  const bounds = [];

  // Helper: resolve exact calendar color from the event's group
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

  // Group by location, then by group id, so we can render one pin per calendar per location
  const byLocThenGroup = new Map(); // loc -> Map(groupId -> items[])
  for (const it of allServerItems) {
    const loc = (it.location || '').trim();
    if (!loc) continue;
    if (!byLocThenGroup.has(loc)) byLocThenGroup.set(loc, new Map());
    const inner = byLocThenGroup.get(loc);
    const gid = it.group || '__nogroup__';
    if (!inner.has(gid)) inner.set(gid, []);
    inner.get(gid).push(it);
  }

  // Utility: compute a small offset in degrees for separating markers around a location
  const addOffset = (lat, lon, index, total) => {
    // Arrange in a circle around the center
    if (total <= 1) return { lat, lon };
    const radiusMeters = 12; // ~12m spread
    const angle = (2 * Math.PI * index) / total;
    const dLat = (radiusMeters * Math.sin(angle)) / 111111; // meters -> degrees
    const dLon = (radiusMeters * Math.cos(angle)) / (111111 * Math.max(0.1, Math.cos(lat * Math.PI / 180)));
    return { lat: lat + dLat, lon: lon + dLon };
  };

  // For each location, render one pin per calendar group with slight offsets
  for (const [loc, inner] of byLocThenGroup.entries()) {
    const coords = await geocodeLocation(loc);
    if (!coords) continue;
    const entries = Array.from(inner.entries()); // [groupId, items[]]
    const total = entries.length;
    entries.forEach(([gid, evs], idx) => {
      const color = getGroupColor(gid);
      const { lat, lon } = addOffset(coords.lat, coords.lon, idx, total);
      const marker = L.marker([lat, lon], { icon: makePinIcon(color) }).addTo(markersLayer);
      bounds.push([lat, lon]);
      // Build a compact popup listing up to 5 events for this calendar at this location
      const list = evs.slice(0, 5)
        .map(e => `<li>${escapeHtml(e.content || e.summary || 'Untitled')} (${escapeHtml(e.start)} → ${escapeHtml(e.end)})</li>`)
        .join('');
      const more = evs.length > 5 ? `<div>…and ${evs.length - 5} more</div>` : '';
      const groupObj = groups.get(gid);
      const who = groupObj ? (groupObj.content || groupObj.title || '') : '';
      marker.bindPopup(`<div><strong>${escapeHtml(loc)}</strong><div>${escapeHtml(who)}</div><ul>${list}</ul>${more}</div>`);
    });
  }

  if (bounds.length) {
    map.fitBounds(bounds, { padding: [20, 20] });
  }
}

// Location validation and map preview helpers
function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function tryParseLatLon(text) {
  const m = String(text).trim().match(/^\s*([+-]?\d{1,2}(?:\.\d+)?)\s*,\s*([+-]?\d{1,3}(?:\.\d+)?)\s*$/);
  if (!m) return null;
  const lat = parseFloat(m[1]);
  const lon = parseFloat(m[2]);
  if (isNaN(lat) || isNaN(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

async function geocodeAddress(q) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error(`Geocode failed: ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  const hit = data[0];
  return { lat: parseFloat(hit.lat), lon: parseFloat(hit.lon), displayName: hit.display_name, osmId: hit.osm_id, osmType: hit.osm_type };
}

function renderLocationHelp(state) {
  if (!eventLocationHelp) return;
  if (!state || !state.status) { eventLocationHelp.textContent = ''; eventLocationHelp.className = 'help-text'; return; }
  if (state.status === 'searching') { eventLocationHelp.textContent = 'Validating address…'; eventLocationHelp.className = 'help-text'; return; }
  if (state.status === 'ok' && state.result) {
    const { displayName, lat, lon } = state.result;
    const osm = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=15/${lat}/${lon}`;
    const gmaps = `https://maps.google.com/?q=${lat},${lon}`;
    eventLocationHelp.innerHTML = `<div>✔ Found: ${displayName}</div><div style="margin-top:4px; display:flex; gap:8px;"><a href="${osm}" target="_blank" rel="noopener">OpenStreetMap</a><a href="${gmaps}" target="_blank" rel="noopener">Google Maps</a></div>`;
    eventLocationHelp.className = 'help-text ok';
    return;
  }
  if (state.status === 'coords' && state.result) {
    const { lat, lon } = state.result;
    const osm = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=15/${lat}/${lon}`;
    const gmaps = `https://maps.google.com/?q=${lat},${lon}`;
    eventLocationHelp.innerHTML = `<div>✔ Coordinates detected (${lat.toFixed(5)}, ${lon.toFixed(5)})</div><div style=\"margin-top:4px; display:flex; gap:8px;\"><a href=\"${osm}\" target=\"_blank\" rel=\"noopener\">OpenStreetMap</a><a href=\"${gmaps}\" target=\"_blank\" rel=\"noopener\">Google Maps</a></div>`;
    eventLocationHelp.className = 'help-text ok';
    return;
  }
  if (state.status === 'error') { eventLocationHelp.textContent = state.message || 'Could not validate address'; eventLocationHelp.className = 'help-text error'; }
}

const debouncedLocationValidate = debounce(async () => {
  lastGeocode = null;
  const q = (eventLocationInput?.value || '').trim();
  if (!q) { renderLocationHelp(null); return; }
  const coords = tryParseLatLon(q);
  if (coords) { lastGeocode = { ...coords, displayName: `${coords.lat}, ${coords.lon}`, source: 'coords' }; renderLocationHelp({ status: 'coords', result: lastGeocode }); return; }
  if (q.length < 3) { renderLocationHelp(null); return; }
  renderLocationHelp({ status: 'searching' });
  try { const found = await geocodeAddress(q); if (found) { lastGeocode = { ...found, source: 'geocode' }; renderLocationHelp({ status: 'ok', result: lastGeocode }); } else { renderLocationHelp({ status: 'error', message: 'No match found' }); } }
  catch (e) { renderLocationHelp({ status: 'error', message: 'Validation error' }); }
}, 450);

// Open the modal pre-filled to create an all-day event for a week
async function openCreateWeekModal(calendarUrl, startDateStr, endDateStr, groupId) {
  try {
    setStatus('Creating new event…');
    if (!modal) throw new Error('Modal element not found');

    // Initialize a pseudo currentEvent without uid to signal create mode
    currentEvent = {
      uid: null,
      summary: '',
      description: '',
      location: '',
      start: startDateStr,
      end: endDateStr,
      allDay: true,
      calendarUrl
    };

    // Remember which timeline group was clicked for optimistic insert fallback
    currentCreateGroupId = groupId || null;

    // Populate fields
    eventIdInput.value = '';
    const defaultTitle = `Week ${isoWeekNumber(new Date(startDateStr))}`;
    eventTitleInput.value = defaultTitle;
    eventDescriptionInput.value = '';
    eventLocationInput.value = '';
    // Clear structured meta fields for new create
    if (eventOrderNumberInput) eventOrderNumberInput.value = '';
    if (eventTicketLinkInput) eventTicketLinkInput.value = '';
    if (eventSystemTypeInput) eventSystemTypeInput.value = '';
    eventAllDayInput.checked = true;
    eventStartDateInput.value = startDateStr;
    eventEndDateInput.value = endDateStr;
    // Kick off location validation UI
    debouncedLocationValidate();

    // Load calendars and preselect
    await loadCalendars(calendarUrl);
    // Ensure selection is set (fallback to provided calendarUrl)
    if (!eventCalendarSelect.value) {
      eventCalendarSelect.value = calendarUrl;
    }

    // Show modal
    modal.style.display = 'flex';
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
    // Focus title to allow quick overwrite
    setTimeout(() => eventTitleInput.focus(), 0);
    setStatus('');
  } catch (e) {
    console.error('Error opening create modal:', e);
    setStatus(`Error: ${e.message}`);
  }
}

// Toggle modal loading state and button labels
function setModalLoading(isLoading, action = 'save') {
  if (!modalContent) return;
  if (isLoading) {
    modalContent.classList.add('loading');
    // Update buttons
    if (action === 'save') {
      saveBtn.dataset.originalText = saveBtn.textContent;
      saveBtn.textContent = 'Saving...';
    } else if (action === 'delete') {
      deleteBtn.dataset.originalText = deleteBtn.textContent;
      deleteBtn.textContent = 'Deleting...';
    }
    // Disable all modal controls
    saveBtn.disabled = true;
    deleteBtn.disabled = true;
    cancelBtn.disabled = true;
    closeBtn.style.pointerEvents = 'none';
    closeBtn.style.opacity = '0.5';
  } else {
    modalContent.classList.remove('loading');
    // Restore button labels
    if (saveBtn.dataset.originalText) {
      saveBtn.textContent = saveBtn.dataset.originalText;
      delete saveBtn.dataset.originalText;
    }
    if (deleteBtn.dataset.originalText) {
      deleteBtn.textContent = deleteBtn.dataset.originalText;
      delete deleteBtn.dataset.originalText;
    }
    // Re-enable controls (specific buttons will still be toggled by caller)
    cancelBtn.disabled = false;
    closeBtn.style.pointerEvents = '';
    closeBtn.style.opacity = '';
  }
}

// Force refresh CalDAV cache
async function forceRefreshCache() {
  try {
    setStatus('Refreshing calendar data...');
    const response = await fetch('/api/refresh-caldav', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    
    const result = await response.json();
    if (result.success) {
      setStatus('Calendar data refreshed. Updating view...');
      await refresh(); // Refresh the timeline with new data
      setStatus('Calendar data updated successfully');
    } else {
      throw new Error(result.error || 'Failed to refresh calendar data');
    }
  } catch (error) {
    console.error('Error refreshing calendar data:', error);
    setStatus(`Error: ${error.message}`);
    clientLog('error', 'Cache refresh failed', { error: error.message });
  }
}

// Client logging to backend
async function clientLog(level, message, extra) {
  try {
    await fetch('/api/client-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level, message, extra, userAgent: navigator.userAgent, ts: new Date().toISOString() }),
    });
  } catch (e) {
    // ignore
  }
}
window.addEventListener('error', (e) => {
  clientLog('error', e.message || 'window.error', { filename: e.filename, lineno: e.lineno, colno: e.colno, error: String(e.error) });
});
window.addEventListener('unhandledrejection', (e) => {
  clientLog('error', 'unhandledrejection', { reason: String(e.reason) });
});

// Add passive event listeners helper
function addPassiveEventListener(element, event, handler) {
  const options = {
    capture: true,
    passive: true
  };
  
  if (element.addEventListener) {
    element.addEventListener(event, handler, options);
  } else {
    element.addEventListener(event, handler, options.capture);
  }
  
  return () => {
    if (element.removeEventListener) {
      element.removeEventListener(event, handler, options);
    } else {
      element.removeEventListener(event, handler, options.capture);
    }
  };
}

function initTimeline() {
  if (timeline) return;
  
  // Create groups and items DataSets
  groups = new DataSet();
  items = new DataSet({
    type: { start: 'ISODate', end: 'ISODate' }
  });
  // Expose for console debugging
  try { window.groups = groups; window.items = items; } catch (_) {}

  // Configuration for the Timeline
  const options = {
    groupOrder: 'order',
    stack: true,
    stackSubgroups: false,
    height: 'auto',
    minHeight: '500px',
    //maxHeight: '600px',
    verticalScroll: true,
    horizontalScroll: false,
    zoomable: true,
    zoomKey: 'ctrlKey', // Use Ctrl+wheel to zoom
    zoomMin: 1000 * 60 * 60 * 24, // 1 day
    zoomMax: 1000 * 60 * 60 * 24 * 365 * 2, // 2 years
    orientation: 'both',
    selectable: false,
    autoResize: true,
    // Tighter vertical spacing between stacked items
    margin: { item: 0, axis: 10 },
    timeAxis: { scale: 'day', step: 1 },
    showTooltips: false, // We'll handle tooltips manually
    template: function(item, element) {
      if (!item) return '';
      
      // Create a simple div for the item content
      const div = document.createElement('div');
      div.className = 'vis-item-content';
      div.textContent = item.content || '';
      // If the title/content contains '???', render more transparent to indicate unconfirmed
      try {
        const text = `${item.title || ''} ${item.content || ''}`;
        if (/\?\?\?/.test(text)) {
          div.style.opacity = '0.5';
          // Optional enhancements: mark item element and tooltip
          if (element && element.classList) {
            element.classList.add('unconfirmed');
          }
          // If native title tooltip is used anywhere, append an indicator
          const baseTitle = item.title || item.content || '';
          element && element.setAttribute && element.setAttribute('title', `${baseTitle} (unconfirmed)`);
        }
      } catch (_) {}
      
      // Add data attributes for tooltip
      if (item.dataAttributes) {
        Object.entries(item.dataAttributes).forEach(([key, value]) => {
          div.setAttribute(key, value);
        });
      }
      
      return div;
    },
    tooltip: {
      followMouse: true,
      overflowMethod: 'cap'
    },
  };
  
  // Initialize the Timeline
  timeline = new Timeline(timelineEl, items, groups, options);
  // Expose timeline for console debugging
  try { window.timeline = timeline; } catch (_) {}
  // Initial week bar render
  try { const w = timeline.getWindow(); renderWeekBar(w.start, w.end); } catch (_) {}
  // Let vis size to content (capped by maxHeight) to avoid stretching groups
  
  // Set up custom tooltip handlers
  setupTooltipHandlers(timeline);

  // Re-apply group label colors whenever timeline updates
  ['changed','rangechanged','rangechange','redraw'].forEach(evt => {
    try {
      timeline.on(evt, () => {
        requestAnimationFrame(applyGroupLabelColors);
        try { const w = timeline.getWindow(); renderWeekBar(w.start, w.end); } catch (_) {}
        // Re-apply search filter to DOM on redraws
        requestAnimationFrame(applySearchFilter);
      });
    } catch (_) {}
  });

  // Observe label DOM for changes and recolor
  try {
    const labelSet = document.querySelector('.vis-timeline .vis-labelset');
    if (labelSet && !labelObserver) {
      labelObserver = new MutationObserver(() => applyGroupLabelColors());
      labelObserver.observe(labelSet, { childList: true, subtree: true });
    }
  } catch (_) {}

  // Track user-initiated panning to suppress subsequent click
  try {
    timeline.on('rangechange', (props) => {
      if (props && props.byUser) {
        isPanning = true;
      }
    });
    timeline.on('rangechanged', (props) => {
      if (props && props.byUser) {
        isPanning = false;
        lastPanEnd = Date.now();
      }
      // Repaint week bar on any range change
      try { const w = timeline.getWindow(); renderWeekBar(w.start, w.end); } catch (_) {}
    });
    timeline.on('redraw', () => {
      try { const w = timeline.getWindow(); renderWeekBar(w.start, w.end); } catch (_) {}
    });
    // No dynamic resize; fixed height
  } catch (_) {}
}

// Dynamically size the timeline to its content while leaving room for the map
function adjustTimelineHeight() {
  try {
    if (!timelineEl) return;
    // measure items area height + axes; then cap at 600px
    const centerContent = document.querySelector('.vis-timeline .vis-center .vis-content');
    const topAxis = document.querySelector('.vis-timeline .vis-panel.vis-top .vis-time-axis');
    const bottomAxis = document.querySelector('.vis-timeline .vis-panel.vis-bottom .vis-time-axis');
    const centerH = centerContent ? centerContent.scrollHeight : 0;
    const topH = topAxis ? topAxis.offsetHeight : 56;
    const bottomH = bottomAxis ? bottomAxis.offsetHeight : 22;
    const padding = 4;
    const needed = Math.max(0, centerH) + topH + bottomH + padding;
    const finalHeight = Math.min(600, Math.max(needed, topH + bottomH + 100));
    if (timelineEl.style.height !== `${finalHeight}px`) {
      timelineEl.style.height = `${finalHeight}px`;
    }
    try { timeline.setOptions({ height: `${finalHeight}px` }); } catch (_) {}

    // Resize map to new space
    try { if (map && map.invalidateSize) setTimeout(() => map.invalidateSize(false), 0); } catch (_) {}
  } catch (_) { /* ignore */ }
}

function parseDateInput(value) {
  // Try strict ISO first
  let d = dayjs(value, 'YYYY-MM-DD', true);
  if (d.isValid()) return d;
  // Fallbacks for common locales (e.g., 1.9.2025 or 01.09.2025)
  d = dayjs(value, 'D.M.YYYY', true);
  if (d.isValid()) return d;
  d = dayjs(value, 'DD.MM.YYYY', true);
  if (d.isValid()) return d;
  // Last resort: native parse
  d = dayjs(value);
  return d;
}

// --- Date window constraints: -3 months .. +12 months relative to now ---
const WINDOW_PAST_MONTHS = 3;
const WINDOW_FUTURE_MONTHS = 12;
function getWindowBounds() {
  const minDay = dayjs().subtract(WINDOW_PAST_MONTHS, 'month').startOf('day');
  const maxDay = dayjs().add(WINDOW_FUTURE_MONTHS, 'month').endOf('day');
  return { minDay, maxDay };
}
function setDateInputBounds() {
  const { minDay, maxDay } = getWindowBounds();
  const min = minDay.format('YYYY-MM-DD');
  const max = maxDay.format('YYYY-MM-DD');
  if (fromEl) { fromEl.min = min; fromEl.max = max; }
  if (toEl) { toEl.min = min; toEl.max = max; }
}
function clampToWindow(dateStr) {
  const d = parseDateInput(dateStr);
  if (!d || !d.isValid()) return null;
  const { minDay, maxDay } = getWindowBounds();
  let x = d;
  if (x.isBefore(minDay)) x = minDay;
  if (x.isAfter(maxDay)) x = maxDay;
  return x.format('YYYY-MM-DD');
}

function formatForDisplay(value) {
  // Accept YYYY-MM-DD or DD.MM.YYYY inputs; output fixed dd.mm.yyyy
  const d = parseDateInput(value);
  if (!d || !d.isValid()) return value || '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.date())}.${pad(d.month() + 1)}.${d.year()}`;
}

function updateDateDisplays() {
  if (fromDateDisplay) fromDateDisplay.textContent = formatForDisplay(fromEl.value);
  if (toDateDisplay) toDateDisplay.textContent = formatForDisplay(toEl.value);
}

function applyWindow(from, to) {
  if (!timeline) return;
  const fromDay = parseDateInput(from);
  const toDay = parseDateInput(to);
  if (!fromDay.isValid() || !toDay.isValid()) {
    setStatus('Invalid date input. Please use YYYY-MM-DD or DD.MM.YYYY');
    return;
  }
  // Clamp to allowed window
  const { minDay, maxDay } = getWindowBounds();
  let f = fromDay;
  let t = toDay;
  if (f.isBefore(minDay)) f = minDay;
  if (t.isAfter(maxDay)) t = maxDay;
  // Ensure ordering
  if (t.isBefore(f)) t = f;
  // Reflect any clamping back to inputs
  const fStr = f.format('YYYY-MM-DD');
  const tStr = t.format('YYYY-MM-DD');
  if (fromEl && fromEl.value !== fStr) fromEl.value = fStr;
  if (toEl && toEl.value !== tStr) toEl.value = tStr;

  const fromDate = f.startOf('day').toDate();
  const toDate = t.endOf('day').toDate();
  const minDate = dayjs(fromDate).subtract(7, 'day').toDate();
  const maxDate = dayjs(toDate).add(7, 'day').toDate();
  timeline.setOptions({ start: fromDate, end: toDate, min: minDate, max: maxDate });
  timeline.setWindow(fromDate, toDate, { animation: false });
  timeline.redraw();
  updateAxisDensity(fStr, tStr);
}

async function fetchCalendars() {
  try {
    setStatus('Loading calendars...');
    const res = await fetch('/api/calendars');
    if (!res.ok) {
      const text = await res.text();
      setStatus(`Failed to load calendars: ${res.status} ${res.statusText}`);
      console.error('Calendars fetch failed', res.status, res.statusText, text);
      return [];
    }
    const data = await res.json();
    const list = data.calendars || [];
    setStatus(`Loaded ${list.length} calendars`);
    console.debug('Calendars:', list);
    return list;
  } catch (e) {
    console.error('Calendars fetch error', e);
    setStatus(`Error loading calendars: ${e.message}`);
    return [];
  }
}

async function getSelectedCalendars() {
  return []; // Return empty array to indicate all calendars should be used
}

// Batch process items for better performance
function batchProcessItems(items, batchSize = 1000) {
  const batches = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
}

// Open the edit modal with event data
async function openEditModal(eventId) {
  try {
    console.log('openEditModal called with eventId:', eventId);
    setStatus('Loading event details...');
    
    // Debug: Check if modal element exists
    console.log('Modal element exists:', !!modal);
    console.log('Modal display style before:', modal.style.display);
    
    if (!modal) {
      throw new Error('Modal element not found');
    }
    
    // Ensure modal is visible for debugging
    modal.style.display = 'flex';
    modal.style.backgroundColor = 'rgba(0,0,0,0.8)';
    console.log('Modal display style set to flex, should be visible now');
    
    // Add a temporary debug element
    const debugDiv = document.createElement('div');
    debugDiv.id = 'debug-overlay';
    debugDiv.style.position = 'fixed';
    debugDiv.style.top = '10px';
    debugDiv.style.left = '10px';
    debugDiv.style.background = 'white';
    debugDiv.style.padding = '10px';
    debugDiv.style.zIndex = '99999';
    if (DEBUG_UI) {
      debugDiv.textContent = `Click detected for event: ${eventId}`;
      document.body.appendChild(debugDiv);
    }
    
    console.log(`Fetching event details for UID: ${eventId}`);
    const response = await fetch(`/api/events/${eventId}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to fetch event details:', response.status, errorText);
      throw new Error(`Failed to fetch event details: ${response.status} ${response.statusText}`);
    }
    
    const eventData = await response.json();
    console.log('Event data response:', eventData);
    console.log('Event data received:', eventData);
    
    if (!eventData.success) throw new Error(eventData.error || 'Failed to load event');
    
    currentEvent = eventData.event;
    console.log('Current event set:', currentEvent);
    
    // Populate form fields
    eventIdInput.value = currentEvent.uid;
    eventTitleInput.value = currentEvent.summary || '';
    eventDescriptionInput.value = currentEvent.description || '';
    eventLocationInput.value = currentEvent.location || '';
    // Kick off location validation UI for existing
    debouncedLocationValidate();
    // Populate structured meta
    const meta = currentEvent.meta || {};
    if (eventOrderNumberInput) eventOrderNumberInput.value = meta.orderNumber || '';
    if (eventTicketLinkInput) eventTicketLinkInput.value = meta.ticketLink || '';
    if (eventSystemTypeInput) eventSystemTypeInput.value = meta.systemType || '';
    
    // Handle dates with proper timezone handling
    const isAllDay = currentEvent.allDay || false;
    eventAllDayInput.checked = isAllDay;
    
    // For all-day events, we need to ensure we don't apply timezone conversion
    if (isAllDay) {
      // For all-day events, use the date as-is without timezone conversion
      const startDate = dayjs(currentEvent.start).format('YYYY-MM-DD');
      const endDate = dayjs(currentEvent.end).format('YYYY-MM-DD');
      
      console.log('Setting all-day dates - start:', startDate, 'end:', endDate);
      eventStartDateInput.value = startDate;
      eventEndDateInput.value = endDate;
    } else {
      // For timed events, convert to local timezone for display
      const startDate = dayjs(currentEvent.start).local();
      const endDate = dayjs(currentEvent.end).local();
      
      // Format as YYYY-MM-DDTHH:mm for datetime-local input
      const startStr = startDate.format('YYYY-MM-DDTHH:mm');
      const endStr = endDate.format('YYYY-MM-DDTHH:mm');
      
      console.log('Setting timed dates - start:', startStr, 'end:', endStr);
      eventStartDateInput.value = startStr;
      eventEndDateInput.value = endStr;
    }
    
    // Load calendars for the dropdown
    console.log('Loading calendars...');
    await loadCalendars(currentEvent.calendarUrl);
    
    // Show the modal with animation
    console.log('Showing modal...');
    modal.classList.add('show');
    document.body.style.overflow = 'hidden'; // Prevent scrolling when modal is open
    console.log('Modal show class added');
    
    // Force a reflow/repaint
    void modal.offsetHeight;
    
    setStatus('');
  } catch (error) {
    console.error('Error opening edit modal:', error);
    setStatus(`Error: ${error.message}`);
  }
}

// Load available calendars into the dropdown
async function loadCalendars(selectedCalendarUrl = '') {
  try {
    const response = await fetch('/api/calendars');
    const data = await response.json();
    
    // Clear existing options
    eventCalendarSelect.innerHTML = '';
    
    // Add each calendar as an option
    data.calendars.forEach(calendar => {
      const option = document.createElement('option');
      option.value = calendar.url;
      option.textContent = calendar.displayName;
      option.selected = calendar.url === selectedCalendarUrl;
      eventCalendarSelect.appendChild(option);
    });
  } catch (error) {
    console.error('Error loading calendars:', error);
  }
}

// Close the modal
function closeModal() {
  console.log('closeModal called');
  if (modal) {
    console.log('Hiding modal');
    modal.classList.remove('show');
    if (modalContent) modalContent.classList.remove('loading');
    // Wait for the animation to complete before hiding
    setTimeout(() => {
      modal.style.display = 'none';
    }, 300); // Match this with the CSS transition duration
    document.body.style.overflow = ''; // Re-enable scrolling
  } else {
    console.error('Modal element not found when trying to close');
  }
  
  if (eventForm) {
    eventForm.reset();
  } else {
    console.error('Event form not found');
  }
  
  currentEvent = null;
  console.log('Modal closed and form reset');
  // Clear location helper UI
  renderLocationHelp(null);
}

// Handle form submission
async function handleSubmit(e) {
  e.preventDefault();
  
  if (!currentEvent) return;
  
  try {
    setStatus('Saving changes...');
    saveBtn.disabled = true;
    setModalLoading(true, 'save');
    
    // Validate required title explicitly so users get feedback in create mode
    const title = eventTitleInput.value.trim();
    if (!title) {
      setStatus('Please enter a title');
      if (eventTitleInput.reportValidity) eventTitleInput.reportValidity();
      setModalLoading(false, 'save');
      saveBtn.disabled = false;
      return;
    }

    // Validate structured meta fields
    // Normalize ticket link: add https:// if missing scheme
    if (eventTicketLinkInput && eventTicketLinkInput.value.trim()) {
      let urlVal = eventTicketLinkInput.value.trim();
      if (!/^https?:\/\//i.test(urlVal)) {
        urlVal = 'https://' + urlVal;
        eventTicketLinkInput.value = urlVal;
      }
      try {
        // Throws if invalid
        new URL(urlVal);
      } catch (e) {
        setStatus('Please enter a valid URL for Ticket Link');
        eventTicketLinkInput.focus();
        setModalLoading(false, 'save');
        saveBtn.disabled = false;
        return;
      }
    }
    if (eventOrderNumberInput && eventOrderNumberInput.value.length > 64) {
      setStatus('Order Number is too long (max 64 characters).');
      eventOrderNumberInput.focus();
      setModalLoading(false, 'save');
      saveBtn.disabled = false;
      return;
    }

    // Convert local date strings to ISO strings to preserve the local date
    const startDate = new Date(eventStartDateInput.value);
    const endDate = new Date(eventEndDateInput.value);
    
    // For all-day events, we want to keep just the date part without timezone conversion
    const isAllDay = eventAllDayInput.checked;
    
    const eventData = {
      summary: eventTitleInput.value.trim(),
      description: eventDescriptionInput.value.trim(),
      location: eventLocationInput.value.trim(),
      start: isAllDay ? 
        // For all-day events, format as YYYY-MM-DD without time
        `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}` :
        // For timed events, use ISO string
        startDate.toISOString(),
      end: isAllDay ?
        // For all-day events, format as YYYY-MM-DD without time
        `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}` :
        // For timed events, use ISO string
        endDate.toISOString(),
      allDay: isAllDay,
      meta: {
        ...(eventOrderNumberInput?.value ? { orderNumber: eventOrderNumberInput.value.trim() } : {}),
        ...(eventTicketLinkInput?.value ? { ticketLink: eventTicketLinkInput.value.trim() } : {}),
        ...(eventSystemTypeInput?.value ? { systemType: eventSystemTypeInput.value.trim() } : {}),
      }
    };
    
    console.log('Sending event data:', eventData);
    
    // If calendar was changed, include the target calendar URL
    if (eventCalendarSelect.value !== currentEvent.calendarUrl) {
      eventData.targetCalendarUrl = eventCalendarSelect.value;
    }
    
    let response;
    if (!currentEvent.uid) {
      // Create flow for all-day events
      console.log('Create mode detected; posting to /api/events/all-day with calendar', eventCalendarSelect.value);
      const createCalendarUrl = eventCalendarSelect.value || currentEvent.calendarUrl;
      if (!createCalendarUrl) {
        throw new Error('No calendar selected for new event');
      }
      response = await fetch('/api/events/all-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calendarUrl: createCalendarUrl,
          summary: eventData.summary,
          description: eventData.description,
          location: eventData.location,
          start: eventData.start,
          end: eventData.end,
          meta: eventData.meta
        })
      });
    } else {
      // Update flow
      response = await fetch(`/api/events/${currentEvent.uid}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      });
    }
    
    const result = await response.json();
    
    if (result.success) {
      setStatus('Event updated successfully, refreshing data...');
      
      // Force a refresh of the CalDAV cache first (this also calls refresh())
      try {
        // If this was a creation (no uid), optimistically add the item now and schedule a delayed refresh
        if (!currentEvent.uid) {
          try {
            const created = result.event || {};
            const createdUid = created.uid || `temp-${Date.now()}`;
            const resolvedGroupId = urlToGroupId.get(eventCalendarSelect.value || currentEvent.calendarUrl) || currentCreateGroupId;
            if (resolvedGroupId) {
              const startIsDateOnly = typeof eventData.start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(eventData.start);
              const endIsDateOnly = typeof eventData.end === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(eventData.end);
              const startVal = startIsDateOnly ? dayjs(eventData.start).toDate() : new Date(eventData.start);
              const endVal = (startIsDateOnly && endIsDateOnly) ? dayjs(eventData.end).add(1, 'day').toDate() : new Date(eventData.end);
              items.add({
                id: `${resolvedGroupId}-${(eventCalendarSelect.value || currentEvent.calendarUrl)}/${createdUid}`,
                group: resolvedGroupId,
                content: eventData.summary,
                start: startVal,
                end: endVal,
                allDay: isAllDay
              });
            }
          } catch (optErr) {
            console.warn('Optimistic add failed', optErr);
          }
          // Do not trigger refresh automatically for creates to avoid flicker.
          // The optimistic item will remain; user can press Refresh when convenient.
          setStatus('Event created (not yet synced). Click Refresh to load from server.');
        } else {
          // For edits, keep the strong consistency path
          await forceRefreshCache();
        }
        setStatus('Cache refreshed, updating display...');
      } catch (error) {
        console.error('Error refreshing cache:', error);
        // Continue even if cache refresh fails
      }
      
      closeModal();
    } else {
      throw new Error(result.error || 'Failed to update event');
    }
  } catch (error) {
    console.error('Error updating event:', error);
    setStatus(`Error: ${error.message}`);
  } finally {
    setModalLoading(false, 'save');
    saveBtn.disabled = false;
  }
}

// Handle event deletion
async function handleDelete() {
  if (!currentEvent || !confirm('Are you sure you want to delete this event?')) {
    return;
  }
  
  try {
    setStatus('Deleting event...');
    deleteBtn.disabled = true;
    setModalLoading(true, 'delete');
    
    // Note: You'll need to implement the delete endpoint on the server
    const response = await fetch(`/api/events/${currentEvent.uid}`, {
      method: 'DELETE',
    });
    
    const result = await response.json();
    
    if (result.success) {
      setStatus('Event deleted, refreshing data...');
      
      // Force a refresh of the CalDAV cache first (this also calls refresh())
      try {
        await forceRefreshCache();
        setStatus('Cache refreshed, updating display...');
      } catch (error) {
        console.error('Error refreshing cache:', error);
        // Continue even if cache refresh fails
      }
      
      closeModal();
    } else {
      throw new Error(result.error || 'Failed to delete event');
    }
  } catch (error) {
    console.error('Error deleting event:', error);
    setStatus(`Error: ${error.message}`);
  } finally {
    setModalLoading(false, 'delete');
    deleteBtn.disabled = false;
  }
}

// Initialize event listeners for the modal
function initModal() {
  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  eventForm.addEventListener('submit', handleSubmit);
  deleteBtn.addEventListener('click', handleDelete);
  // Location live validation
  if (eventLocationInput) {
    eventLocationInput.addEventListener('input', () => debouncedLocationValidate());
    eventLocationInput.addEventListener('blur', () => debouncedLocationValidate());
  }
  
  // Close modal when clicking outside the content
  window.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  // Gentle zoom using Ctrl+wheel to reduce overly aggressive touchpad zoom
  // We intercept the wheel event, prevent the default vis zoom, and apply a smaller zoom step.
  const wheelHandler = (e) => {
    try {
      if (!e || !e.ctrlKey) return; // only intercept Ctrl+scroll zooms
      // Prevent the default zoom handling by the library
      e.preventDefault();
      e.stopPropagation();
      // Compute a gentle zoom factor; smaller multiplier => slower zoom
      // Positive deltaY should zoom out, negative zoom in.
      const sensitivity = 0.0006; // adjust to taste (smaller = slower zoom)
      const factor = Math.exp(e.deltaY * sensitivity);
      const w = timeline.getWindow();
      const startMs = (w.start instanceof Date) ? w.start.getTime() : new Date(w.start).getTime();
      const endMs = (w.end instanceof Date) ? w.end.getTime() : new Date(w.end).getTime();
      const center = (startMs + endMs) / 2;
      const currentRange = endMs - startMs;
      const newRange = Math.max(24*60*60*1000, Math.min(currentRange * factor, 2*365*24*60*60*1000)); // clamp between 1 day and ~2 years
      const newStart = center - newRange / 2;
      const newEnd = center + newRange / 2;
      timeline.setWindow(newStart, newEnd, { animation: false });
    } catch (_) {
      // ignore
    }
  };
  // Add non-passive to allow preventDefault on wheel
  timelineEl.addEventListener('wheel', wheelHandler, { passive: false });

  // Gentle pinch-to-zoom (two-finger) without requiring CTRL
  // We compute touch distance changes and translate them to a reduced zoom factor.
  let pinchActive = false;
  let pinchInitialDist = 0;
  let pinchStartCenter = 0;
  let pinchStartRange = 0;
  function getTouchDistance(t1, t2) {
    const dx = t2.clientX - t1.clientX;
    const dy = t2.clientY - t1.clientY;
    return Math.hypot(dx, dy);
  }
  function getWindowMs() {
    const w = timeline.getWindow();
    const startMs = (w.start instanceof Date) ? w.start.getTime() : new Date(w.start).getTime();
    const endMs = (w.end instanceof Date) ? w.end.getTime() : new Date(w.end).getTime();
    return { startMs, endMs };
  }
  timelineEl.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches.length === 2) {
      pinchActive = true;
      pinchInitialDist = getTouchDistance(e.touches[0], e.touches[1]);
      const { startMs, endMs } = getWindowMs();
      pinchStartCenter = (startMs + endMs) / 2;
      pinchStartRange = endMs - startMs;
      // Prevent native page pinch
      e.preventDefault();
    }
  }, { passive: false });
  timelineEl.addEventListener('touchmove', (e) => {
    if (!pinchActive || !timeline) return;
    if (!(e.touches && e.touches.length === 2)) return;
    e.preventDefault();
    const dist = getTouchDistance(e.touches[0], e.touches[1]);
    if (pinchInitialDist <= 0) return;
    let scale = dist / pinchInitialDist;
    // Reduce sensitivity: map scale via exponent < 1
    const sensitivityExponent = 0.4; // smaller -> slower zoom
    scale = Math.pow(scale, sensitivityExponent);
    // Compute new range with clamps
    const minRange = 24*60*60*1000; // 1 day
    const maxRange = 2*365*24*60*60*1000; // ~2 years
    const newRange = Math.max(minRange, Math.min(pinchStartRange / scale, maxRange));
    const newStart = pinchStartCenter - newRange / 2;
    const newEnd = pinchStartCenter + newRange / 2;
    timeline.setWindow(newStart, newEnd, { animation: false });
  }, { passive: false });
  const endPinch = () => { pinchActive = false; pinchInitialDist = 0; };
  timelineEl.addEventListener('touchend', endPinch);
  timelineEl.addEventListener('touchcancel', endPinch);
}

async function refresh() {
  // Always fetch all calendars
  const allCalendars = await fetchCalendars();
  const allCalendarUrls = allCalendars.map(c => c.url);
  const total = allCalendarUrls.length;
  const gen = ++refreshGen;
  
  // Initialize arrays to hold all items and groups
  const allItems = [];
  const allGroups = [];

  // Fallbacks within allowed window
  let from = fromEl.value || dayjs().startOf('month').format('YYYY-MM-DD');
  let to = toEl.value || dayjs().add(3, 'month').endOf('month').format('YYYY-MM-DD');
  const fClamped = clampToWindow(from);
  const tClamped = clampToWindow(to);
  from = fClamped || from;
  to = tClamped || to;
  // Ensure ordering
  if (dayjs(to).isBefore(dayjs(from))) to = from;
  
  try {
    // Prepare timeline window immediately
    initTimeline();
    applyWindow(from, to);
    setStatus(`Loading ${total} calendars...`);

    // Note: Do not clear datasets yet to avoid flicker. We'll clear right before we apply new data.

    // Reset reverse map for this refresh to avoid stale mappings
    groupReverseMap.clear();
    urlToGroupId.clear();

    // Stage extra groups/items (week band, dividers, weekend backgrounds) to add later
    const dividerItems = [];
    const stagedGroups = [];
    const stagedItems = [];
    const spanDays = dayjs(to).diff(dayjs(from), 'day') + 1;
    const toBound = dayjs(to).endOf('day');
    
    // Generate week (or day) dividers only; week labels are rendered by overlay
    if (spanDays > 45) {
      let ws = dayjs(from).startOf('day');
      while (ws.day() !== 1) ws = ws.add(1, 'day');
      while (ws.isBefore(toBound)) {
        dividerItems.push({
          id: `weekline-${ws.format('YYYY-MM-DD')}`,
          start: ws.toDate(),
          end: ws.add(1, 'millisecond').toDate(),
          type: 'background',
          className: 'week-divider',
          editable: false,
          selectable: false
        });
        ws = ws.add(7, 'day');
      }
    } else {
      // Daily lines
      let d = dayjs(from).startOf('day');
      while (d.isBefore(toBound)) {
        dividerItems.push({
          id: `dayline-${d.format('YYYY-MM-DD')}`,
          start: d.toDate(),
          end: d.add(1, 'millisecond').toDate(),
          type: 'background',
          className: 'day-divider',
          editable: false,
          selectable: false
        });
        d = d.add(1, 'day');
      }
    }
    
    // Stage all dividers to add later
    if (dividerItems.length > 0) {
      stagedItems.push(...dividerItems);
    }

    // Add weekend background bands as a single block from Saturday to Monday
    {
      // Find the first Saturday on/after from
      let sat = dayjs(from).startOf('day');
      while (sat.day() !== 6) sat = sat.add(1, 'day');
      while (sat.isBefore(toBound)) {
        const mon = sat.add(2, 'day'); // Saturday + 2 days => Monday start
        stagedItems.push({
          id: `weekend-${sat.format('YYYY-MM-DD')}`,
          start: sat.toDate(),
          end: mon.toDate(),
          type: 'background',
          className: 'weekend-bg',
          editable: false,
          selectable: false
        });
        sat = mon.add(5, 'day'); // jump to next Saturday (Mon + 5 days)
      }
    }

    // Get all events in a single request
    setStatus(`Loading all calendars...`);
    
    try {
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendarUrls: allCalendarUrls, from, to }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const serverGroups = data.groups || [];
      const serverItems = data.items || [];
      
      // Clear existing items and groups
      allItems.length = 0;
      allGroups.length = 0;
      
      // Process groups
      const groupIdMap = new Map();
      serverGroups.forEach((g, i) => {
        const newId = `cal-${i + 1}`;
        groupIdMap.set(g.id, newId);
        // Preserve original calendar URL (prefer explicit g.url if provided by server)
        const originalUrl = g.url || g.id;
        allGroups.push({ ...g, id: newId, calendarUrl: originalUrl });
        groupReverseMap.set(newId, originalUrl);
        urlToGroupId.set(originalUrl, newId);
      });
      
      // Process items
      serverItems.forEach(item => {
        const oldGroup = item.group;
        const newGroup = groupIdMap.get(oldGroup) || oldGroup;

        // For date-only events (YYYY-MM-DD), vis-timeline treats `end` as exclusive.
        // Our server sends an inclusive end date, so add +1 day so the final day is visible.
        let adjustedEnd = item.end;
        const isDateOnly = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
        if (isDateOnly(item.start) && isDateOnly(item.end)) {
          adjustedEnd = dayjs(item.end).add(1, 'day').format('YYYY-MM-DD');
        }

        allItems.push({
          ...item,
          end: adjustedEnd,
          group: newGroup,
          id: `${newGroup}-${item.id}`
        });
      });
      
      setStatus(`Loaded ${allItems.length} items from ${allGroups.length} calendars`);
    } catch (error) {
      console.error('Failed to fetch events:', error);
      setStatus(`Error loading events: ${error.message}`);
      return;
    }
    
    if (gen !== refreshGen) return; // aborted
    
    // Clear datasets now that new data is ready, then add all groups/items
    groups.clear({ removeFromGroups: false });
    items.clear({ removeFromGroups: false });

    // Add all groups (fetched + staged) and items in batches to prevent UI freeze
    if (allGroups.length > 0) {
      groups.add(allGroups);
    }
    if (stagedGroups.length > 0) {
      groups.add(stagedGroups);
    }
    
    // Add staged items first (dividers, week chips), then event items
    if (stagedItems.length > 0) {
      items.add(stagedItems);
    }
    if (allItems.length > 0) {
      const itemBatches = batchProcessItems(allItems, 1000);
      for (const batch of itemBatches) {
        items.add(batch);
        // Small delay to keep UI responsive
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    // Color calendar label rows (left column). Some vis builds don't expose data-groupid.
    // As a fallback, assign colors by visible order using a soft palette.
    try {
      const palette = ['#e0f2fe','#fce7f3','#dcfce7','#fff7ed','#ede9fe','#f1f5f9','#fef9c3','#fee2e2','#e9d5ff','#cffafe'];
      const labelNodes = document.querySelectorAll('.vis-timeline .vis-labelset .vis-label');
      labelNodes.forEach((node, idx) => {
        const color = palette[idx % palette.length];
        node.style.backgroundColor = color;
      });
      // Ensure re-application after layout paint
      requestAnimationFrame(applyGroupLabelColors);
    } catch (e) {
      console.warn('Label color fallback failed', e);
    }

    // After items/groups added, render map markers from current DataSet items with locations
    try {
      const source = (typeof serverItems !== 'undefined' && Array.isArray(serverItems) && serverItems.length)
        ? serverItems
        : items.get();
      const locItems = source
        .map(it => ({
          content: it.content,
          summary: it.title || it.content,
          start: typeof it.start === 'object' && it.start?.toISOString ? it.start.toISOString() : it.start,
          end: typeof it.end === 'object' && it.end?.toISOString ? it.end.toISOString() : it.end,
          location: it.location,
          group: it.group
        }))
        .filter(it => it.location && String(it.location).trim().length > 0);
      console.debug('[map] unique input locations:', new Set(locItems.map(x => x.location.trim().toLowerCase())).size);
      await renderMapMarkers(locItems);
    } catch (e) {
      console.warn('Map marker render failed', e);
    }

    // Add holiday highlights
    try {
      console.log('Fetching holidays...');
      const holidays = await getHolidaysInRange(from, to);
      console.log('Holidays found:', holidays);
      
      const holidayItems = [];
      
      holidays.forEach(holiday => {
        const startDate = dayjs(holiday.date).startOf('day');
        const endDate = startDate.add(1, 'day');
        
        holidayItems.push({
          id: `holiday-${startDate.format('YYYY-MM-DD')}`,
          start: startDate.toDate(),
          end: endDate.toDate(),
          type: 'background',
          className: 'holiday-bg',
          title: holiday.name,
          editable: false,
          selectable: false
        });
      });
      
      if (holidayItems.length > 0) {
        console.log('Adding holiday items:', holidayItems);
        items.add(holidayItems);
      } else {
        console.log('No holiday items to add');
      }
    } catch (e) {
      console.error('Failed to add holiday highlights:', e);
    }

    if (gen !== refreshGen) return; // aborted
    const w = timeline.getWindow();
    clientLog('info', 'window-after-set', { start: w.start, end: w.end });
    setStatus(`Loaded ${allItems.length} items in ${allGroups.length} calendars | Window: ${w.start.toISOString().slice(0,10)} → ${w.end.toISOString().slice(0,10)}`);
    // Repaint week bar after data load
    try { renderWeekBar(w.start, w.end); } catch (_) {}
    // Fixed height; nothing to adjust
  } catch (e) {
    if (gen !== refreshGen) return;
    console.error('Events fetch error', e);
    setStatus(`Error loading events: ${e.message}`);
  }
}

function setDefaults() {
  setDateInputBounds();
  const { minDay, maxDay } = getWindowBounds();
  // Use current month window but clamp to allowed bounds
  let start = dayjs().startOf('month');
  let end = dayjs().add(5, 'month').endOf('month'); // default ~6-month span
  if (start.isBefore(minDay)) start = minDay;
  if (end.isAfter(maxDay)) end = maxDay;
  const startStr = start.format('YYYY-MM-DD');
  const endStr = end.format('YYYY-MM-DD');
  fromEl.value = startStr;
  toEl.value = endStr;
  updateDateDisplays();
}

function wireEvents() {
  // Initialize modal event listeners
  initModal();
  
  // Initialize button event listeners that don't depend on the timeline
  // Refresh button should force a server-side cache refresh to fetch latest data
  refreshBtn.addEventListener('click', async () => {
    refreshBtn.disabled = true;
    try {
      await forceRefreshCache(); // This will also call refresh() on success
    } finally {
      refreshBtn.disabled = false;
    }
  });
  
  // Make events appear clickable
  document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('events-clickable');
  });
  
  window.addEventListener('resize', () => {
    if (!timeline) return;
    // Re-apply window after resize to prevent drift
    requestAnimationFrame(() => applyWindow(fromEl.value, toEl.value));
    requestAnimationFrame(() => updateAxisDensity(fromEl.value, toEl.value));
    // Repaint week labels to current positions
    try { const w = timeline.getWindow(); requestAnimationFrame(() => renderWeekBar(w.start, w.end)); } catch (_) {}
    // Ensure Leaflet map resizes to new container dimensions
    try {
      if (typeof map !== 'undefined' && map && map.invalidateSize) {
        setTimeout(() => map.invalidateSize(false), 0);
      }
    } catch (_) {}
  });
  
  // Only apply/clamp and refresh when input loses focus or Enter is pressed
  function applyDateInputs() {
    const fromClamped = clampToWindow(fromEl.value);
    if (fromClamped) fromEl.value = fromClamped;
    const toClamped = clampToWindow(toEl.value);
    if (toClamped) toEl.value = toClamped;
    // keep ordering
    if (dayjs(toEl.value).isBefore(dayjs(fromEl.value))) toEl.value = fromEl.value;
    refresh();
  }
  fromEl.addEventListener('blur', applyDateInputs);
  toEl.addEventListener('blur', applyDateInputs);
  [fromEl, toEl].forEach(el => {
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        // Trigger apply when user confirms with Enter
        applyDateInputs();
        el.blur();
      }
    });
  });
  // While typing, only update the human-friendly display text, do not refresh
  fromEl.addEventListener('input', updateDateDisplays);
  toEl.addEventListener('input', updateDateDisplays);
}

// Initialize timeline event handlers after the timeline is created
function initTimelineEvents() {
  if (!timeline) return;
  
  // Timeline event click handler
  timeline.on('click', async (properties) => {
    // Ignore clicks right after a user drag/pan
    if (isPanning || (Date.now() - lastPanEnd) < 250) {
      return;
    }
    console.log('Timeline click event:', properties);
    if (properties.item) {
      console.log('Item clicked, item ID:', properties.item);
      // Get the event data from the clicked item
      const item = items.get(properties.item);
      console.log('Item data:', item);
      
      // Extract UID from the item's ID (format: 'cal-X-https://.../calendars/.../UID')
      // The UID is everything after the last '/' in the item ID
      const parts = properties.item.split('/');
      const uid = parts[parts.length - 1];
      
      if (uid) {
        console.log('Extracted UID:', uid);
        openEditModal(uid);
      } else {
        console.error('Could not extract UID from item ID:', properties.item);
        setStatus('Error: Could not identify event. Please try again.');
      }
    } else {
      console.log('Click was not on an item');
      // Quick-create all-day event when clicking on empty space within a person's row
      // Requirements:
      //  - must have a group (not the special "weeks" group)
      //  - must have a time
      const g = properties.group;
      const t = properties.time;
      if (!g || g === 'weeks' || !t) return;

      // Prefer the stored original URL on the group object
      const groupObj = groups.get(g);
      const calendarUrl = (groupObj && groupObj.calendarUrl) || groupReverseMap.get(g) || null;
      console.log('Quick-create click', { groupId: g, groupObj, resolvedCalendarUrl: calendarUrl });
      if (!calendarUrl) return;
      // Validate it's a proper CalDAV URL, not a client group id
      if (!/^https?:\/\//.test(calendarUrl)) {
        setStatus(`Cannot create: invalid calendar URL resolved for group ${g}`);
        return;
      }

      // Compute ISO week range (Mon..Sun) for clicked date
      const clicked = dayjs(t);
      // day(): 0=Sun..6=Sat, so shift to Monday-based
      const offsetToMonday = (clicked.day() + 6) % 7; // 0 if Monday
      const weekStart = clicked.subtract(offsetToMonday, 'day').startOf('day');
      // Set end date to Friday (4 days after Monday)
      const weekEnd = weekStart.add(4, 'day').startOf('day'); // Monday to Friday

      const startStr = weekStart.format('YYYY-MM-DD');
      const endStr = weekEnd.format('YYYY-MM-DD');

      // Open modal in create mode so we reuse the stable edit flow (no flicker)
      await openCreateWeekModal(calendarUrl, startStr, endStr, g);
    }
  });
  
  // Timeline control buttons
  fitBtn.addEventListener('click', () => timeline.fit());
  todayBtn.addEventListener('click', () => {
    timeline.moveTo(dayjs().valueOf());
  });
}

(async function main() {
  setDefaults();
  wireEvents();
  await initTimeline();
  // Initialize timeline events after timeline is created
  initTimelineEvents();
  // Auto-refresh once on load
  await refresh();
  // Ensure displays are in sync after initial refresh
  updateDateDisplays();
})();

function updateAxisDensity(from, to) {
  if (!timeline) return;
  const spanDays = dayjs(to).diff(dayjs(from), 'day') + 1;
  const condensed = spanDays > 45;
  if (condensed) {
    document.body.classList.add('axis-condensed');
  } else {
    document.body.classList.remove('axis-condensed');
  }
}

function isoWeekNumber(jsDate) {
  const d = new Date(Date.UTC(jsDate.getFullYear(), jsDate.getMonth(), jsDate.getDate()));
  const dayNum = d.getUTCDay() || 7; // Monday=1..Sunday=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}
