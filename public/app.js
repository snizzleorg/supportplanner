// (moved: location helpers are declared after imports)

import dayjs from 'https://cdn.jsdelivr.net/npm/dayjs@1.11.13/+esm';
import { DataSet, Timeline } from 'https://cdn.jsdelivr.net/npm/vis-timeline@7.7.3/standalone/esm/vis-timeline-graph2d.min.js';
import { setupTooltipHandlers } from './custom-tooltip.js';
import { getHolidaysInRange } from './js/holidays.js';
import { upsertHolidayBackgrounds } from './js/holidays-ui.js';
import { geocodeLocation, tryParseLatLon, geocodeAddress } from './js/geocode.js';
import { renderMapMarkers } from './js/map.js';
import { initTimeline as initTimelineCore } from './js/timeline.js';
import { renderWeekBar, applyGroupLabelColors } from './js/timeline-ui.js';
import { initSearch, applySearchFilter } from './js/search.js';
import { fetchCalendars as apiFetchCalendars, refreshCaldav, clientLog as apiClientLog, getEvent, updateEvent as apiUpdateEvent, deleteEvent as apiDeleteEvent, createAllDayEvent, me as apiMe, logout as apiLogout } from './js/api.js';
import { renderLocationHelp, debouncedLocationValidate, setModalLoading, closeModal, createModalController } from './js/modal.js';

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
const monthViewBtn = document.getElementById('monthViewBtn');
const quarterViewBtn = document.getElementById('quarterViewBtn');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const showRangeBtn = document.getElementById('showRangeBtn');
const searchBox = document.getElementById('searchBox');
const clearSearchBtn = document.getElementById('clearSearch');
const timelineEl = document.getElementById('timeline');
const userInfoEl = document.getElementById('userInfo');
const logoutBtn = document.getElementById('logoutBtn');
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

async function hydrateAuthBox() {
  try {
    const info = await apiMe();
    const show = info && info.authEnabled && info.authenticated;
    if (userInfoEl) {
      if (show) {
        const name = info.user?.name || info.user?.preferred_username || info.user?.email || 'Signed in';
        const role = info.user?.role ? ` (${info.user.role})` : '';
        userInfoEl.textContent = name + role;
        userInfoEl.style.display = '';
      } else {
        userInfoEl.style.display = 'none';
      }
    }
    if (logoutBtn) {
      logoutBtn.style.display = show ? '' : 'none';
      if (!logoutBtn._bound) {
        logoutBtn.addEventListener('click', () => {
          // Let the server initiate RP logout with the IdP and redirect back
          location.href = '/auth/logout';
        });
        logoutBtn._bound = true;
      }
    }
  } catch (err) {
    // ignore auth box errors
  }
}

// --- Search wiring moved to './js/search.js' ---

// Week bar helpers moved to './js/timeline-ui.js'

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

// Group label color helpers moved to './js/timeline-ui.js'

// --- Map: Leaflet rendering moved to './js/map.js' ---
function escapeHtml(unsafe) {
  if (unsafe === undefined || unsafe === null) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Location validation helpers moved to './js/modal.js'

// openCreateWeekModal moved to modal controller

// Modal loading helper moved to './js/modal.js'

// Force refresh CalDAV cache using API helper
async function forceRefreshCache() {
  try {
    setStatus('Refreshing calendar data...');
    const result = await refreshCaldav();
    if (result.success) {
      setStatus('Calendar data refreshed. Updating view...');
      await refresh();
      setStatus('Calendar data updated successfully');
    } else {
      throw new Error(result.error || 'Failed to refresh calendar data');
    }
  } catch (error) {
    console.error('Error refreshing calendar data:', error);
    setStatus(`Error: ${error.message}`);
    apiClientLog('error', 'Cache refresh failed', { error: error.message });
  }
}

window.addEventListener('error', (e) => {
  apiClientLog('error', e.message || 'window.error', { filename: e.filename, lineno: e.lineno, colno: e.colno, error: String(e.error) });
});
window.addEventListener('unhandledrejection', (e) => {
  apiClientLog('error', 'unhandledrejection', { reason: String(e.reason) });
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
  // Create datasets
  groups = new DataSet();
  items = new DataSet({ type: { start: 'ISODate', end: 'ISODate' } });
  try { window.groups = groups; window.items = items; } catch (_) {}
  // Create timeline via module
  timeline = initTimelineCore(timelineEl, items, groups);
  // Initialize search module with items dataset
  try { initSearch(items); } catch (_) {}
}

// Build modal controller with dependencies
const modalCtl = createModalController({ setStatus, refresh, isoWeekNumber, items, urlToGroupId, forceRefreshCache, dayjs });

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
    const list = await apiFetchCalendars();
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
    if (!modal) throw new Error('Modal element not found');
    modal.style.display = 'flex';
    modal.style.backgroundColor = 'rgba(0,0,0,0.8)';
    if (DEBUG_UI) {
      const debugDiv = document.createElement('div');
      debugDiv.id = 'debug-overlay';
      debugDiv.style.position = 'fixed';
      debugDiv.style.top = '10px';
      debugDiv.style.left = '10px';
      debugDiv.style.background = 'white';
      debugDiv.style.padding = '10px';
      debugDiv.style.zIndex = '99999';
      debugDiv.textContent = `Click detected for event: ${eventId}`;
      document.body.appendChild(debugDiv);
    }
    const eventData = await getEvent(eventId);
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

// loadCalendars moved to modal controller

// Close the modal
// closeModal moved to './js/modal.js'

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
      const createCalendarUrl = eventCalendarSelect.value || currentEvent.calendarUrl;
      if (!createCalendarUrl) throw new Error('No calendar selected for new event');
      var result = await createAllDayEvent(createCalendarUrl, eventData);
    } else {
      var result = await apiUpdateEvent(currentEvent.uid, eventData);
    }
    
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
    const result = await apiDeleteEvent(currentEvent.uid);
    
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
  // Ensure save click always submits, even if other handlers interfere
  if (saveBtn) {
    saveBtn.addEventListener('click', (e) => {
      try {
        if (typeof eventForm.requestSubmit === 'function') {
          eventForm.requestSubmit();
        } else {
          eventForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        }
      } catch (_) {}
    });
  }
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
  // Update auth box first
  await hydrateAuthBox();
  // Always fetch all calendars
  const allCalendars = await fetchCalendars();
  const allCalendarUrls = allCalendars.map(c => c.url);
  const total = allCalendarUrls.length;
  // If no calendars are available, avoid posting an empty list (server returns 400)
  if (total === 0) {
    initTimeline();
    setStatus('No calendars available. Check Nextcloud connection or permissions, then use Refresh.');
    try { items.clear(); groups.clear(); } catch (_) {}
    return;
  }
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
      await renderMapMarkers(locItems, groups);
    } catch (e) {
      console.warn('Map marker render failed', e);
    }

    // Add holiday highlights via helper (de-duplicates IDs across refreshes)
    try {
      console.log('Fetching holidays...');
      await upsertHolidayBackgrounds(items, from, to, getHolidaysInRange, dayjs);
    } catch (e) {
      console.error('Failed to add holiday highlights:', e);
    }

    if (gen !== refreshGen) return; // aborted
    const w = timeline.getWindow();
    apiClientLog('info', 'window-after-set', { start: w.start, end: w.end });
    setStatus(`Loaded ${allItems.length} items in ${allGroups.length} calendars | Window: ${w.start.toISOString().slice(0,10)} → ${w.end.toISOString().slice(0,10)}`);
    // Repaint week bar after data load
    try { renderWeekBar(timeline); } catch (_) {}
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
  // Initialize modal event listeners via controller
  modalCtl.initModal();
  
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
    try { requestAnimationFrame(() => renderWeekBar(timeline)); } catch (_) {}
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
  
  // Track user panning/zooming to suppress accidental click after drag
  timeline.on('rangechange', (props) => {
    try {
      if (props && props.byUser) {
        isPanning = true;
      }
    } catch (_) {}
  });
  timeline.on('rangechanged', (props) => {
    try {
      if (props && props.byUser) {
        isPanning = false;
        lastPanEnd = Date.now();
      }
    } catch (_) {}
  });

  // Timeline event click handler
  timeline.on('click', async (properties) => {
    // Ignore clicks right after a user drag/pan
    if (isPanning || (Date.now() - lastPanEnd) < 350) {
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
        modalCtl.openEditModal(uid);
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
      await modalCtl.openCreateWeekModal(calendarUrl, startStr, endStr, g);
    }
  });
  
  // Timeline control buttons
  fitBtn.addEventListener('click', () => timeline.fit());
  todayBtn.addEventListener('click', () => {
    timeline.moveTo(dayjs().valueOf());
  });
  // Quick zoom: today-1w .. today+4w
  monthViewBtn?.addEventListener('click', () => {
    const now = dayjs();
    const start = now.subtract(1, 'week').startOf('day').toDate();
    const end = now.add(4, 'week').endOf('day').toDate();
    timeline.setWindow(start, end, { animation: false });
    updateAxisDensity(dayjs(start), dayjs(end));
  });
  // Quick zoom: today-1w .. today+3m
  quarterViewBtn?.addEventListener('click', () => {
    const now = dayjs();
    const start = now.subtract(1, 'week').startOf('day').toDate();
    const end = now.add(3, 'month').endOf('day').toDate();
    timeline.setWindow(start, end, { animation: false });
    updateAxisDensity(dayjs(start), dayjs(end));
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
