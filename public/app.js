// (moved: location helpers are declared after imports)

import dayjs from 'https://cdn.jsdelivr.net/npm/dayjs@1.11.13/+esm';
import { DataSet, Timeline } from 'https://cdn.jsdelivr.net/npm/vis-timeline@7.7.3/standalone/esm/vis-timeline-graph2d.min.js';
import { setupTooltipHandlers } from './custom-tooltip.js';

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
const refreshBtn = document.getElementById('refreshBtn');
const fitBtn = document.getElementById('fitBtn');
const todayBtn = document.getElementById('todayBtn');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const showRangeBtn = document.getElementById('showRangeBtn');
const timelineEl = document.getElementById('timeline');
let timeline;
let groups = new DataSet([]);
let items = new DataSet([]);
let labelObserver = null;
let refreshGen = 0; // generation guard for in-flight refreshes
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
  const base = strengthenColor(color || '#2563eb');
  const stroke = '#1f2937'; // dark outline for contrast
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="30" height="44" viewBox="0 0 30 44">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="1" stdDeviation="1" flood-opacity="0.3"/>
    </filter>
  </defs>
  <g filter="url(#shadow)">
    <path d="M15 1 C8 1 2.5 6.6 2.5 13.5 c0 9.6 10.7 18.4 11.5 19.0a1.6 1.6 0 0 0 2.0 0C16.8 31.9 27.5 23.1 27.5 13.5 27.5 6.6 22 1 15 1z" fill="${base}" stroke="${stroke}" stroke-width="1.7"/>
    <circle cx="15" cy="13.5" r="5.2" fill="#ffffff" fill-opacity="0.98" stroke="${stroke}" stroke-width="1"/>
  </g>
</svg>`;
  const url = 'data:image/svg+xml;base64,' + btoa(svg);
  return L.icon({ iconUrl: url, iconSize: [30, 44], iconAnchor: [15, 43], popupAnchor: [0, -34]});
}

// Apply distinct background colors to calendar label rows (left column)
const LABEL_PALETTE = ['#e0f2fe','#fce7f3','#dcfce7','#fff7ed','#ede9fe','#f1f5f9','#fef9c3','#fee2e2','#e9d5ff','#cffafe'];
function applyGroupLabelColors() {
  try {
    const labelNodes = document.querySelectorAll('.vis-timeline .vis-labelset .vis-label');
    if (!labelNodes || labelNodes.length === 0) return;
    labelNodes.forEach((node, idx) => {
      const color = LABEL_PALETTE[idx % LABEL_PALETTE.length];
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
  const uniqueLocations = new Map(); // location string -> array of items
  // Build group color map from vis groups (prefer bg, fallback to inline style, then palette)
  const groupColorMap = new Map();
  try {
    const gs = groups.get();
    gs.forEach((g, idx) => {
      let color = g.bg || '';
      if (!color && g.style) {
        const m = String(g.style).match(/background-color:\s*([^;]+);?/i);
        if (m) color = m[1].trim();
      }
      if (!color) color = LABEL_PALETTE[idx % LABEL_PALETTE.length];
      groupColorMap.set(g.id, color);
    });
  } catch (_) {}
  allServerItems.forEach(it => {
    const loc = (it.location || '').trim();
    if (!loc) return;
    if (!uniqueLocations.has(loc)) uniqueLocations.set(loc, []);
    uniqueLocations.get(loc).push(it);
  });
  for (const [loc, linked] of uniqueLocations.entries()) {
    const coords = await geocodeLocation(loc);
    if (!coords) continue;
    // Choose a color: if multiple groups share this location, pick the first group's color
    let color = '#2563eb';
    for (const e of linked) {
      if (e.group && groupColorMap.has(e.group)) { color = groupColorMap.get(e.group); break; }
    }
    const marker = L.marker([coords.lat, coords.lon], { icon: makePinIcon(color) }).addTo(markersLayer);
    bounds.push([coords.lat, coords.lon]);
    const list = linked.slice(0, 5).map(e => `<li>${escapeHtml(e.content || e.summary || 'Untitled')} (${escapeHtml(e.start)} → ${escapeHtml(e.end)})</li>`).join('');
    const more = linked.length > 5 ? `<div>…and ${linked.length - 5} more</div>` : '';
    marker.bindPopup(`<div><strong>${escapeHtml(loc)}</strong><ul>${list}</ul>${more}</div>`);
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

  // Configuration for the Timeline
  const options = {
    groupOrder: 'order',
    stack: false,
    stackSubgroups: false,
    verticalScroll: false,
    horizontalScroll: false,
    zoomable: true,
    zoomKey: 'ctrlKey', // Use Ctrl+wheel to zoom
    zoomMin: 1000 * 60 * 60 * 24, // 1 day
    zoomMax: 1000 * 60 * 60 * 24 * 365 * 2, // 2 years
    orientation: 'both',
    selectable: false,
    autoResize: true,
    margin: { item: 6, axis: 12 },
    timeAxis: { scale: 'day', step: 1 },
    showTooltips: false, // We'll handle tooltips manually
    template: function(item, element) {
      if (!item) return '';
      
      // Create a simple div for the item content
      const div = document.createElement('div');
      div.className = 'vis-item-content';
      div.textContent = item.content || '';
      
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
  
  // Set up custom tooltip handlers
  setupTooltipHandlers(timeline);

  // Re-apply group label colors whenever timeline updates
  ['changed','rangechanged','rangechange','redraw'].forEach(evt => {
    try { timeline.on(evt, () => requestAnimationFrame(applyGroupLabelColors)); } catch (_) {}
  });

  // Observe label DOM for changes and recolor
  try {
    const labelSet = document.querySelector('.vis-timeline .vis-labelset');
    if (labelSet && !labelObserver) {
      labelObserver = new MutationObserver(() => applyGroupLabelColors());
      labelObserver.observe(labelSet, { childList: true, subtree: true });
    }
  } catch (_) {}
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

function applyWindow(from, to) {
  if (!timeline) return;
  const fromDay = parseDateInput(from);
  const toDay = parseDateInput(to);
  if (!fromDay.isValid() || !toDay.isValid()) {
    setStatus('Invalid date input. Please use YYYY-MM-DD');
    return;
  }
  const fromDate = fromDay.startOf('day').toDate();
  const toDate = toDay.endOf('day').toDate();
  const minDate = dayjs(fromDate).subtract(7, 'day').toDate();
  const maxDate = dayjs(toDate).add(7, 'day').toDate();
  timeline.setOptions({ start: fromDate, end: toDate, min: minDate, max: maxDate });
  timeline.setWindow(fromDate, toDate, { animation: false });
  timeline.redraw();
  updateAxisDensity(from, to);
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

  const from = fromEl.value || dayjs().startOf('month').format('YYYY-MM-DD');
  const to = toEl.value || dayjs().add(3, 'month').endOf('month').format('YYYY-MM-DD');
  
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
    
    // Generate week numbers and dividers
    if (spanDays > 45) {
      // Stage week numbers group (added later after clearing)
      const weeksGroup = { id: 'weeks', content: 'Weeks', className: 'weeks-group' };
      stagedGroups.push(weeksGroup);
      
      // Generate week numbers in a single batch
      const weekItems = [];
      let ws = dayjs(from).startOf('day');
      while (ws.day() !== 1) ws = ws.add(1, 'day');
      
      while (ws.isBefore(toBound)) {
        const we = ws.add(7, 'day');
        const y = ws.year();
        const iso = isoWeekNumber(ws.toDate());
        weekItems.push({
          id: `weeks-${y}-W${String(iso).padStart(2, '0')}`,
          group: 'weeks',
          content: `W${String(iso).padStart(2, '0')}`,
          start: ws.toDate(),
          end: we.toDate(),
          className: 'week-chip-item',
          editable: false,
          selectable: false
        });
        
        // Add week divider
        dividerItems.push({
          id: `weekline-${ws.format('YYYY-MM-DD')}`,
          start: ws.toDate(),
          end: ws.add(1, 'millisecond').toDate(),
          type: 'background',
          className: 'week-divider',
          editable: false,
          selectable: false
        });
        
        ws = we;
      }
      
      // Stage all week items to add later
      if (weekItems.length > 0) {
        stagedItems.push(...weekItems);
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

    if (gen !== refreshGen) return; // aborted
    const w = timeline.getWindow();
    clientLog('info', 'window-after-set', { start: w.start, end: w.end });
    setStatus(`Loaded ${allItems.length} items in ${allGroups.length} calendars | Window: ${w.start.toISOString().slice(0,10)} → ${w.end.toISOString().slice(0,10)}`);
  } catch (e) {
    if (gen !== refreshGen) return;
    console.error('Events fetch error', e);
    setStatus(`Error loading events: ${e.message}`);
  }
}

function setDefaults() {
  const start = dayjs().startOf('month').format('YYYY-MM-DD');
  const end = dayjs().add(5, 'month').endOf('month').format('YYYY-MM-DD'); // default 6-month span
  fromEl.value = start;
  toEl.value = end;
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
  });
  
  fromEl.addEventListener('change', refresh);
  toEl.addEventListener('change', refresh);
}

// Initialize timeline event handlers after the timeline is created
function initTimelineEvents() {
  if (!timeline) return;
  
  // Timeline event click handler
  timeline.on('click', async (properties) => {
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
