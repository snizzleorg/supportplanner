/**
 * Simple Mobile Timeline - Clean Implementation
 * Version: 1760265400
 * 
 * A mobile-optimized timeline view for support planning.
 * Features: View, create, edit, delete events across multiple calendars.
 */

import { LABEL_PALETTE, LANE_OPACITY, UNCONFIRMED_EVENT_OPACITY } from '/js/ui-config.js';

console.log('📱 Mobile Timeline v1760277100 loaded');

// ============================================
// RETRY UTILITIES (Inlined)
// ============================================

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Default retry logic - retry on network errors and 5xx server errors
 */
function defaultShouldRetry(error, attempt) {
  if (error.message.includes('fetch') || error.message.includes('network')) {
    return true;
  }
  if (error.status) {
    if (error.status >= 500 && error.status < 600) return true;
    if (error.status === 408 || error.status === 429) return true;
    if (error.status >= 400 && error.status < 500) return false;
  }
  return true;
}

/**
 * Retry a function with exponential backoff
 */
async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    shouldRetry = defaultShouldRetry,
    onRetry = null
  } = options;

  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries) break;
      if (!shouldRetry(error, attempt)) throw error;
      
      const exponentialDelay = initialDelay * Math.pow(2, attempt);
      const jitter = Math.random() * 0.3 * exponentialDelay;
      const delay = Math.min(exponentialDelay + jitter, maxDelay);
      
      console.log(`[Retry] Attempt ${attempt + 1}/${maxRetries} failed, retrying in ${Math.round(delay)}ms...`, error.message);
      if (onRetry) onRetry(error, attempt + 1);
      await sleep(delay);
    }
  }
  throw lastError;
}

/**
 * Create a retry-enabled fetch wrapper
 */
async function fetchWithRetry(url, options = {}, retryOptions = {}) {
  return retryWithBackoff(async () => {
    const response = await fetch(url, options);
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
      error.status = response.status;
      error.response = response;
      throw error;
    }
    return response;
  }, retryOptions);
}

/**
 * Timeout wrapper for promises
 */
async function withTimeout(promise, timeoutMs, timeoutMessage = 'Operation timed out') {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      const error = new Error(timeoutMessage);
      error.isTimeout = true;
      reject(error);
    }, timeoutMs);
  });
  
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// ============================================
// CONFIGURATION & CONSTANTS
// ============================================

/**
 * API base URL - automatically detects localhost vs production
 * @constant {string}
 */
const API_BASE = window.location.hostname === 'localhost' 
  ? 'http://localhost:5175'
  : window.location.origin.replace(':5174', ':5175');

/**
 * Layout constants for timeline rendering
 * @constant {Object}
 */
const LAYOUT = {
  LABEL_WIDTH: 100,           // Width of calendar name labels
  MONTH_HEADER_HEIGHT: 40,    // Height of month header row
  WEEK_HEADER_HEIGHT: 20,     // Height of week number row
  DAY_HEADER_HEIGHT: 25,      // Height of day number row
  LANE_HEIGHT: 60,            // Height of each calendar lane
  EVENT_HEIGHT: 24,           // Height of event bars
  EVENT_GAP: 2                // Gap between stacked events
};

/**
 * Z-index layers for stacking elements
 * @constant {Object}
 */
const Z_INDEX = {
  BACKGROUND: 1,
  EVENTS: 2,
  DAY_HEADER: 100,
  WEEK_HEADER: 101,
  MONTH_HEADER: 102,
  MONTH_LINES: 103,
  TODAY_INDICATOR: 104
};

/**
 * Zoom settings: pixels per day for each zoom level
 * @constant {Object}
 */
const ZOOM_SETTINGS = {
  week: 20,    // 20px per day = 140px per week
  month: 10,   // 10px per day = 300px per month
  quarter: 5   // 5px per day = 150px per month
};

/**
 * Timing constants for async operations
 * @constant {Object}
 */
const TIMING = {
  SAVE_DELAY_MS: 2000,    // Wait time before reload after create
  DELETE_DELAY_MS: 2000   // Wait time before reload after delete
};

/**
 * Application state object
 * @type {Object}
 * @property {Array} calendars - List of calendars from API
 * @property {Array} events - List of events from API
 * @property {Array} holidays - Berlin holidays for shading
 * @property {Object} dateRange - Display date range {from, to}
 * @property {string} zoom - Current zoom level (week|month|quarter)
 * @property {string} searchQuery - Current search filter text
 * @property {Set} selectedCalendars - Set of selected calendar IDs
 * @property {Object} eventTypes - Event type configuration with colors
 */
const state = {
  calendars: [],
  events: [],
  holidays: [],
  dateRange: getDefaultDateRange(),
  zoom: 'month',
  searchQuery: '',
  selectedCalendars: new Set(),
  eventTypes: null
};

// ============================================
// CORE APPLICATION FUNCTIONS
// ============================================

/**
 * Calculate default date range for timeline display
 * Returns range from 12 months before today to 12 months after today (2 years total)
 * @returns {{from: Date, to: Date}} Date range object
 */
function getDefaultDateRange() {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth() - 12, 1);
  const to = new Date(today.getFullYear(), today.getMonth() + 12, 1);
  return { from, to };
}

/**
 * Initialize the application
 * Sets up event listeners, loads data, and renders the timeline
 * @async
 * @returns {Promise<void>}
 */
async function init() {
  console.log('Initializing simple timeline...');
  
  // Load event types configuration
  try {
    const response = await fetch('/event-types.json');
    const data = await response.json();
    state.eventTypes = data.eventTypes;
    console.log('Event types loaded:', Object.keys(state.eventTypes).length);
  } catch (err) {
    console.error('Failed to load event types:', err);
    state.eventTypes = {};
  }
  
  // Hide loading state
  const loadingState = document.getElementById('loadingState');
  if (loadingState) loadingState.style.display = 'none';
  
  // Setup zoom buttons
  document.querySelectorAll('.zoom-controls .control-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const container = document.querySelector('.timeline-container');
      if (!container) return;
      
      // Calculate which date is currently at the left edge of the viewport
      const oldPixelsPerDay = ZOOM_SETTINGS[state.zoom];
      const currentScrollLeft = container.scrollLeft;
      const daysFromStart = Math.floor((currentScrollLeft - 100) / oldPixelsPerDay);
      
      // Change zoom and re-render
      state.zoom = btn.dataset.zoom;
      document.querySelectorAll('.zoom-controls .control-btn').forEach(b => 
        b.classList.toggle('active', b.dataset.zoom === state.zoom)
      );
      
      // Update slider to match preset
      const newPixelsPerDay = ZOOM_SETTINGS[state.zoom];
      const zoomSlider = document.getElementById('zoomSlider');
      if (zoomSlider) {
        zoomSlider.value = newPixelsPerDay;
      }
      
      render();
      
      // Scroll to maintain the same date position
      const newScrollLeft = 100 + (daysFromStart * newPixelsPerDay);
      container.scrollLeft = Math.max(0, newScrollLeft);
    });
  });
  
  // Setup zoom slider for continuous zoom control
  const zoomSlider = document.getElementById('zoomSlider');
  zoomSlider?.addEventListener('input', (e) => {
    const container = document.querySelector('.timeline-container');
    if (!container) return;
    
    // Calculate which date is currently at the left edge of the viewport
    const oldPixelsPerDay = ZOOM_SETTINGS[state.zoom];
    const currentScrollLeft = container.scrollLeft;
    const daysFromStart = Math.floor((currentScrollLeft - 100) / oldPixelsPerDay);
    
    // Update zoom settings with slider value (pixels per day)
    const newPixelsPerDay = parseInt(e.target.value);
    ZOOM_SETTINGS.custom = newPixelsPerDay;
    state.zoom = 'custom';
    
    // Deactivate preset buttons when using custom zoom
    document.querySelectorAll('.zoom-controls .control-btn').forEach(b => 
      b.classList.remove('active')
    );
    
    render();
    
    // Scroll to maintain the same date position
    const newScrollLeft = 100 + (daysFromStart * newPixelsPerDay);
    container.scrollLeft = Math.max(0, newScrollLeft);
  });
  
  // Setup search - toggle inline search input
  const searchBtn = document.getElementById('searchBtn');
  const searchInput = document.getElementById('searchInput');
  
  searchBtn?.addEventListener('click', () => {
    if (searchInput.style.display === 'none') {
      searchInput.style.display = 'flex';
      searchInput.focus();
    } else {
      searchInput.style.display = 'none';
      searchInput.value = '';
      state.searchQuery = '';
      render();
    }
  });
  
  searchInput?.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.toLowerCase();
    render();
  });
  
  // Show loading overlay
  const loadingOverlay = document.getElementById('loadingOverlay');
  if (loadingOverlay) loadingOverlay.classList.remove('hidden');
  
  // Force backend to refresh cache from CalDAV on page load
  try {
    console.log('Refreshing CalDAV cache...');
    const refreshResponse = await fetch(`${API_BASE}/api/refresh-caldav`, { 
      method: 'POST',
      credentials: 'include'
    });
    console.log('Initial refresh response:', refreshResponse.status);
  } catch (e) {
    console.warn('Initial cache refresh failed:', e);
  }
  
  // Load data
  await loadData();
  
  // Hide loading overlay
  if (loadingOverlay) loadingOverlay.classList.add('hidden');
  
  // Render
  render();
  
  // Scroll to today's position
  scrollToToday();
}

/**
 * Scroll the timeline to show one week before today
 * Positions the view to start one week in the past
 * @returns {void}
 */
function scrollToToday() {
  // Small delay to ensure DOM is fully rendered
  setTimeout(() => {
    // Scroll the timeline-container, not the wrapper
    const container = document.querySelector('.timeline-container');
    if (!container) {
      console.warn('Timeline container not found for scrolling');
      return;
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Go back one week (7 days)
    const oneWeekAgo = new Date(today);
    oneWeekAgo.setDate(today.getDate() - 7);
    
    // Calculate days from start of date range to one week ago
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysFromStart = Math.floor((oneWeekAgo - state.dateRange.from) / msPerDay);
    
    // Calculate pixel position (100px label width + days * pixels per day)
    const pixelsPerDay = ZOOM_SETTINGS[state.zoom];
    const scrollPosition = 100 + (daysFromStart * pixelsPerDay);
    
    console.log('Scrolling to one week before today:', {
      daysFromStart,
      scrollPosition: Math.max(0, scrollPosition)
    });
    
    container.scrollLeft = Math.max(0, scrollPosition);
  }, 100);
}

// ============================================
// DATA LOADING
// ============================================

/**
 * Load calendar and event data from the API
 * Fetches calendars, events for date range, and Berlin holidays
 * Updates application state with loaded data
 * @async
 * @returns {Promise<void>}
 * @throws {Error} If calendar or event fetch fails
 */
async function loadData() {
  try {
    console.log('Loading calendars...');
    
    // Fetch calendars
    const calRes = await fetch(`${API_BASE}/api/calendars`);
    if (!calRes.ok) throw new Error(`Calendar fetch failed: ${calRes.status}`);
    
    const calData = await calRes.json();
    state.calendars = calData.calendars || [];
    console.log(`Got ${state.calendars.length} calendars`);
    
    // Fetch events
    const calendarUrls = state.calendars.map(c => c.url);
    // Format dates as local YYYY-MM-DD to avoid timezone issues
    const formatLocalDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    const fromStr = formatLocalDate(state.dateRange.from);
    const toStr = formatLocalDate(state.dateRange.to);
    
    console.log('Loading events...');
    console.log('Date range:', fromStr, 'to', toStr);
    console.log('Calendar URLs count:', calendarUrls.length);
    const evtRes = await fetch(`${API_BASE}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ calendarUrls, from: fromStr, to: toStr })
    });
    
    if (!evtRes.ok) throw new Error(`Events fetch failed: ${evtRes.status}`);
    
    const evtData = await evtRes.json();
    // Process events to extract UID from the id field
    state.events = (evtData.items || []).map(event => ({
      ...event,
      // Extract UID: if id is a URL, get last segment and remove leading hyphen
      uid: event.id.includes('/') 
        ? event.id.split('/').pop().replace(/^-/, '') 
        : event.id.split('-').slice(1).join('-')
    }));
    
    // Use groups for calendar display names
    if (evtData.groups) {
      state.calendars = evtData.groups;
    }
    
    console.log(`Loaded: ${state.calendars.length} calendars, ${state.events.length} events`);
    
    // Fetch holidays for Berlin (optional, don't fail if it errors)
    try {
      const startYear = state.dateRange.from.getFullYear();
      const endYear = state.dateRange.to.getFullYear();
      const allHolidays = [];
      
      // Fetch holidays for all years in range
      for (let year = startYear; year <= endYear; year++) {
        const holidayRes = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/DE`);
        if (holidayRes.ok) {
          const yearHolidays = await holidayRes.json();
          // Filter for Berlin-specific holidays (Germany + Berlin state holidays)
          const berlinHolidays = yearHolidays.filter(h => !h.counties || h.counties.includes('DE-BE'));
          allHolidays.push(...berlinHolidays);
        }
      }
      
      state.holidays = allHolidays;
      console.log(`Loaded ${state.holidays.length} Berlin holidays for ${startYear}-${endYear}`);
    } catch (err) {
      console.warn('Could not load holidays:', err);
    }
    
  } catch (error) {
    console.error('Load error:', error);
    console.error('Error stack:', error.stack);
    
    // Show error on screen
    const container = document.getElementById('timelineContainer');
    if (container) {
      container.innerHTML = `
        <div style="padding: 20px; color: red;">
          <h3>Error Loading Data</h3>
          <p>${error.message}</p>
          <button onclick="location.reload()">Retry</button>
        </div>
      `;
    }
  }
}

// ============================================
// RENDERING
// ============================================

/**
 * Render the complete timeline view
 * Builds HTML for headers, calendar lanes, and events
 * Applies search and calendar filters
 * @returns {void}
 */
function render() {
  const container = document.getElementById('timelineContainer');
  const pixelsPerDay = ZOOM_SETTINGS[state.zoom];
  
  // Calculate total days and width
  const totalDays = Math.ceil((state.dateRange.to - state.dateRange.from) / (1000 * 60 * 60 * 24));
  const totalWidth = totalDays * pixelsPerDay;
  
  console.log(`Rendering: ${totalDays} days, ${totalWidth}px wide, ${pixelsPerDay}px/day`);
  
  // Build HTML - Main container
  let html = '<div style="position: relative; display: flex; flex-direction: column; min-width: ' + totalWidth + 'px;">';
  
  // Month vertical lines - spans entire height including headers
  html += '<div style="position: absolute; top: 0; bottom: 0; left: 100px; pointer-events: none; z-index: 103;">';
  html += renderMonthLines(pixelsPerDay);
  html += '</div>';
  
  // Today indicator line
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (today >= state.dateRange.from && today < state.dateRange.to) {
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysFromStart = Math.round((today - state.dateRange.from) / msPerDay);
    const todayLeft = 100 + (daysFromStart * pixelsPerDay);
    html += `<div style="position: absolute; top: 0; bottom: 0; left: ${todayLeft}px; width: 2px; background: #ff3b30; pointer-events: none; z-index: 104;"></div>`;
    html += `<div style="position: absolute; top: 0; left: ${todayLeft - 20}px; width: 40px; height: 20px; background: #ff3b30; color: white; font-size: 9px; font-weight: 600; display: flex; align-items: center; justify-content: center; border-radius: 0 0 4px 4px; pointer-events: none; z-index: 104;">TODAY</div>`;
  }
  
  // === HEADER SECTION (STICKY) ===
  // Header row with months - sticky at top
  html += '<div style="position: sticky; top: 0; z-index: 102; display: flex; height: 40px; border-bottom: 1px solid #ddd; background: #fff; flex-shrink: 0;">';
  html += '<div style="width: 100px; flex-shrink: 0; border-right: 2px solid #ccc; background: #fff;"></div>'; // Label spacer
  html += '<div style="display: flex; flex: 1; min-width: ' + totalWidth + 'px; background: #fff;">';
  html += renderMonthHeaders(pixelsPerDay);
  html += '</div>';
  html += '</div>';
  
  // Week numbers row - sticky below months
  html += '<div style="position: sticky; top: 40px; z-index: 101; display: flex; height: 20px; border-bottom: 1px solid #ddd; background: #f9f9f9; flex-shrink: 0;">';
  html += '<div style="width: 100px; flex-shrink: 0; border-right: 2px solid #ccc; background: #f9f9f9;"></div>'; // Label spacer
  html += '<div style="position: relative; flex: 1; min-width: ' + totalWidth + 'px; background: #f9f9f9;">';
  html += renderWeekNumbers(pixelsPerDay);
  html += '</div>';
  html += '</div>';
  
  // Day numbers row - sticky below week numbers
  html += '<div style="position: sticky; top: 60px; z-index: 100; display: flex; height: 25px; border-bottom: 2px solid #ccc; background: #fafafa; flex-shrink: 0;">';
  html += '<div style="width: 100px; flex-shrink: 0; border-right: 2px solid #ccc; background: #fafafa;"></div>'; // Label spacer
  html += '<div style="position: relative; flex: 1; min-width: ' + totalWidth + 'px; background: #fafafa;">';
  html += renderDayNumbers(pixelsPerDay);
  html += '</div>';
  html += '</div>';
  
  // === CALENDAR LANES SECTION ===
  // Container for calendar lanes with background overlays
  html += '<div style="position: relative; flex: 1; display: flex; flex-direction: column; min-height: 0;">';
  
  // Weekend and holiday backgrounds - absolute positioned, offset to align with timeline content
  html += '<div style="position: absolute; top: 0; bottom: 0; left: 0; pointer-events: none; z-index: 0; margin-left: 100px;">';
  html += renderWeekendAndHolidayBackgrounds(pixelsPerDay);
  html += '</div>';
  
  // Calendar lanes (in normal flow)
  state.calendars.forEach((calendar, index) => {
    const isSelected = state.selectedCalendars.size === 0 || state.selectedCalendars.has(calendar.id);
    const opacity = isSelected ? '1' : '0.3';
    
    html += `<div style="display: flex; height: 50px; border-bottom: 1px solid #eee; opacity: ${opacity};">`;
    
    // Use LABEL_PALETTE based on calendar index
    const bgColor = LABEL_PALETTE[index % LABEL_PALETTE.length];
    const textColor = getContrastColor(bgColor);
    const name = calendar.content || calendar.displayName;
    const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    const isDesktop = window.innerWidth >= 768;
    
    // Full name label - on desktop it's sticky, on mobile it scrolls away
    const labelStyle = isDesktop 
      ? `width: 100px; padding: 8px; font-size: 12px; font-weight: 600; border-right: 2px solid #ccc; flex-shrink: 0; background: ${bgColor}; color: ${textColor}; display: flex; align-items: center; z-index: 20; cursor: pointer; position: sticky; left: 0;`
      : `width: 100px; padding: 8px; font-size: 12px; font-weight: 600; border-right: 2px solid #ccc; flex-shrink: 0; background: ${bgColor}; color: ${textColor}; display: flex; align-items: center; z-index: 20; cursor: pointer;`;
    html += `<div data-calendar-id="${calendar.id}" class="calendar-label" style="${labelStyle}">${name}</div>`;
    
    // Lane indicator - narrow colored bar (sticky, appears when scrolling) - only on mobile
    if (!isDesktop) {
      html += `<div data-calendar-id="${calendar.id}" class="calendar-label" style="width: 30px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; border-right: 2px solid #ccc; flex-shrink: 0; background: ${bgColor}; color: ${textColor}; z-index: 10; position: sticky; left: 0; margin-left: -30px; cursor: pointer;">${initials}</div>`;
    }
    
    // Lane content (with overflow hidden to prevent events from piercing through)
    // Apply dimmed background color using LANE_OPACITY
    const laneBgColor = hexToRgba(bgColor, LANE_OPACITY);
    html += `<div class="calendar-lane-area" data-calendar-id="${calendar.id}" style="position: relative; flex: 1; overflow: hidden; background: ${laneBgColor}; padding-left: 0;">`;
    html += renderEventsForCalendar(calendar.id, pixelsPerDay);
    html += '</div>';
    
    html += '</div>';
  });
  
  // Close calendar lanes container
  html += '</div>';
  
  // Close main timeline container
  html += '</div>';
  
  container.innerHTML = html;
  
  // Add click handlers for calendar labels
  document.querySelectorAll('.calendar-label').forEach(label => {
    label.addEventListener('click', (e) => {
      const calendarId = e.target.dataset.calendarId;
      
      if (state.selectedCalendars.has(calendarId)) {
        // If already selected, deselect it (show all)
        state.selectedCalendars.clear();
      } else {
        // If not selected, select only this one
        state.selectedCalendars.clear();
        state.selectedCalendars.add(calendarId);
      }
      
      render();
    });
  });
  
  // Add click handlers for events
  document.querySelectorAll('.timeline-event').forEach(eventEl => {
    eventEl.addEventListener('click', (e) => {
      e.stopPropagation();
      const eventId = e.target.dataset.eventId;
      const event = state.events.find(ev => ev.id === eventId);
      if (event) {
        showEventModal(event);
      }
    });
  });
  
  // Add click handlers for lane areas (create new event)
  document.querySelectorAll('.calendar-lane-area').forEach(laneEl => {
    laneEl.addEventListener('click', (e) => {
      if (e.target.classList.contains('timeline-event')) return;
      
      const calendarId = laneEl.dataset.calendarId;
      const calendar = state.calendars.find(c => c.id === calendarId);
      if (!calendar) return;
      
      // Calculate which date was clicked
      const rect = laneEl.getBoundingClientRect();
      const clickX = e.clientX - rect.left + laneEl.scrollLeft;
      const pixelsPerDay = ZOOM_SETTINGS[state.zoom];
      const daysFromStart = Math.floor(clickX / pixelsPerDay);
      const clickedDate = new Date(state.dateRange.from);
      clickedDate.setDate(clickedDate.getDate() + daysFromStart);
      
      showCreateEventModal(calendar, clickedDate);
    });
  });
}

// ============================================
// EVENT HANDLERS - MODALS (WILL BE REPLACED WITH IONIC)
// ============================================

// TODO: These functions will be replaced with Ionic modal components during migration

/**
 * Show modal to create a new event
 * Pre-fills with week number and Mon-Fri dates based on clicked position
 * @param {Object} calendar - Calendar object to create event in
 * @param {Date} clickedDate - Date that was clicked
 * @returns {void}
 */
async function showCreateEventModal(calendar, clickedDate) {
  const modal = document.getElementById('eventModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  
  if (!modal || !modalTitle || !modalBody) return;
  
  modalTitle.textContent = 'Create New Event';
  
  // Helper functions
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const getWeekNumber = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  };
  
  // Find Monday and Friday of clicked week
  const dayOfWeek = clickedDate.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(clickedDate);
  monday.setDate(clickedDate.getDate() + diff);
  
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  
  const weekNumber = getWeekNumber(clickedDate);
  const defaultTitle = `Week ${weekNumber}`;
  
  const startDateStr = formatDate(monday);
  const endDateStr = formatDate(friday);
  
  // Check if desktop (wider than 768px)
  const isDesktop = window.innerWidth >= 768;
  
  if (isDesktop) {
    // Desktop layout with two columns and map preview
    modalBody.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <!-- Left column: Form fields -->
        <div>
          <div style="margin-bottom: 12px;">
            <label style="display: block; font-weight: 600; margin-bottom: 4px; font-size: 13px;">Title</label>
            <input type="text" id="eventTitle" value="${defaultTitle}" style="width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
            <div>
              <label style="display: block; font-weight: 600; margin-bottom: 4px; font-size: 13px;">Start</label>
              <input type="date" id="eventStart" value="${startDateStr}" style="width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
            </div>
            <div>
              <label style="display: block; font-weight: 600; margin-bottom: 4px; font-size: 13px;">End</label>
              <input type="date" id="eventEnd" value="${endDateStr}" style="width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
            </div>
          </div>
          <div style="margin-bottom: 12px;">
            <label style="display: block; font-weight: 600; margin-bottom: 4px; font-size: 13px;">Description</label>
            <textarea id="eventDescription" rows="3" style="width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; font-family: inherit; resize: vertical;"></textarea>
          </div>
          <div style="margin-bottom: 12px;">
            <label style="display: block; font-weight: 600; margin-bottom: 4px; font-size: 13px;">Location</label>
            <input type="text" id="eventLocation" value="" style="width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
          </div>
          <div style="margin-bottom: 12px;">
            <label style="display: block; font-weight: 600; margin-bottom: 4px; font-size: 13px;">Calendar</label>
            <select id="eventCalendar" style="width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
              ${state.calendars.map(cal => 
                `<option value="${cal.url}" ${cal.id === calendar.id ? 'selected' : ''}>${cal.content || cal.displayName}</option>`
              ).join('')}
            </select>
          </div>
        </div>
        
        <!-- Right column: Metadata and map -->
        <div>
          <div style="margin-bottom: 12px;">
            <label style="display: block; font-weight: 600; margin-bottom: 4px; font-size: 13px;">Order Number</label>
            <input type="text" id="eventOrderNumber" value="" placeholder="e.g., SO-12345" style="width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
          </div>
          <div style="margin-bottom: 12px;">
            <label style="display: block; font-weight: 600; margin-bottom: 4px; font-size: 13px;">Ticket Link</label>
            <input type="url" id="eventTicketLink" value="" placeholder="https://..." style="width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
          </div>
          <div style="margin-bottom: 12px;">
            <label style="display: block; font-weight: 600; margin-bottom: 4px; font-size: 13px;">System Type</label>
            <input type="text" id="eventSystemType" value="" placeholder="e.g., Laser Q-Switch" style="width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
          </div>
          
          <!-- Map preview placeholder -->
          <div style="margin-top: 16px;">
            <label style="display: block; font-weight: 600; margin-bottom: 4px; font-size: 13px;">Location Map</label>
            <div id="createMapPreview" style="width: 100%; height: 200px; border: 1px solid #ddd; border-radius: 4px; background: #f5f5f5; display: flex; align-items: center; justify-content: center; color: #999; font-size: 12px;">
              Enter a location to see map preview
            </div>
          </div>
        </div>
      </div>
    `;
  } else {
    // Mobile layout (original)
    modalBody.innerHTML = `
      <div style="margin-bottom: 15px;">
        <label style="display: block; font-weight: 600; margin-bottom: 5px;">Title:</label>
        <input type="text" id="eventTitle" value="${defaultTitle}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
        <div>
          <label style="display: block; font-weight: 600; margin-bottom: 5px;">Start:</label>
          <input type="date" id="eventStart" value="${startDateStr}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box;">
        </div>
        <div>
          <label style="display: block; font-weight: 600; margin-bottom: 5px;">End:</label>
          <input type="date" id="eventEnd" value="${endDateStr}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box;">
        </div>
      </div>
      <div style="margin-bottom: 15px;">
        <label style="display: block; font-weight: 600; margin-bottom: 5px;">Description:</label>
        <textarea id="eventDescription" rows="3" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; font-family: inherit;"></textarea>
      </div>
      <div style="margin-bottom: 15px;">
        <label style="display: block; font-weight: 600; margin-bottom: 5px;">Location:</label>
        <input type="text" id="eventLocation" value="" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
      </div>
      <div style="margin-bottom: 15px;">
        <label style="display: block; font-weight: 600; margin-bottom: 5px;">Order Number:</label>
        <input type="text" id="eventOrderNumber" value="" placeholder="e.g., SO-12345" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
      </div>
      <div style="margin-bottom: 15px;">
        <label style="display: block; font-weight: 600; margin-bottom: 5px;">Ticket Link:</label>
        <input type="url" id="eventTicketLink" value="" placeholder="https://..." style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
      </div>
      <div style="margin-bottom: 15px;">
        <label style="display: block; font-weight: 600; margin-bottom: 5px;">System Type:</label>
        <input type="text" id="eventSystemType" value="" placeholder="e.g., Laser Q-Switch" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
      </div>
      <div style="margin-bottom: 15px;">
        <label style="display: block; font-weight: 600; margin-bottom: 5px;">Calendar:</label>
        <select id="eventCalendar" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
          ${state.calendars.map(cal => 
            `<option value="${cal.url}" ${cal.id === calendar.id ? 'selected' : ''}>${cal.content || cal.displayName}</option>`
          ).join('')}
        </select>
      </div>
    `;
  }
  
  // Hide delete button in create mode
  const deleteEventBtn = document.getElementById('deleteEventBtn');
  if (deleteEventBtn) deleteEventBtn.style.display = 'none';
  
  // Show modal
  modal.classList.add('active');
  
  const closeModal = document.getElementById('closeModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const saveEventBtn = document.getElementById('saveEventBtn');
  
  const closeHandler = () => modal.classList.remove('active');
  
  const newSaveBtn = saveEventBtn.cloneNode(true);
  saveEventBtn.parentNode.replaceChild(newSaveBtn, saveEventBtn);
  
  closeModal?.addEventListener('click', closeHandler);
  closeModalBtn?.addEventListener('click', closeHandler);
  
  newSaveBtn.addEventListener('click', async () => {
    try {
      const title = document.getElementById('eventTitle').value;
      const calendarUrl = document.getElementById('eventCalendar').value;
      const start = document.getElementById('eventStart').value;
      const end = document.getElementById('eventEnd').value;
      const description = document.getElementById('eventDescription').value;
      const location = document.getElementById('eventLocation').value;
      const orderNumber = document.getElementById('eventOrderNumber').value;
      const ticketLink = document.getElementById('eventTicketLink').value;
      const systemType = document.getElementById('eventSystemType').value;
      
      if (!title || !start || !end) {
        alert('Please fill in title, start date, and end date');
        return;
      }
      
      // Validate date range
      if (new Date(end) < new Date(start)) {
        alert('End date cannot be before start date. Please check your dates.');
        return;
      }
      
      // Build meta object (only include non-empty fields)
      const meta = {};
      if (orderNumber) meta.orderNumber = orderNumber;
      if (ticketLink) meta.ticketLink = ticketLink;
      if (systemType) meta.systemType = systemType;
      
      console.log('Creating event with description:', description, 'and meta:', meta);
      
      // Use retry logic with timeout
      const response = await withTimeout(
        fetchWithRetry(
          `${API_BASE}/api/events/all-day`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              calendarUrl: calendarUrl,
              summary: title,
              start: start,
              end: end,
              description: description || '',
              location: location || '',
              meta: Object.keys(meta).length > 0 ? meta : undefined
            })
          },
          {
            maxRetries: 2,
            onRetry: (error, attempt) => {
              console.log(`Retrying create (attempt ${attempt})...`);
            }
          }
        ),
        30000, // 30 second timeout
        'Create operation timed out'
      );
      
      console.log('Create response status:', response.status);
      console.log('Create response ok:', response.ok);
      
      const responseData = await response.json();
      console.log('Create response data:', responseData);
      
      // Success - close modal and show loading
      modal.classList.remove('active');
      const loadingOverlay = document.getElementById('loadingOverlay');
      const loadingText = loadingOverlay?.querySelector('p');
      if (loadingText) loadingText.textContent = 'Saving event...';
      loadingOverlay?.classList.remove('hidden');
      
      console.log('Event created successfully, triggering CalDAV refresh...');
      
      // Wait a moment for the event to be saved
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Trigger CalDAV cache refresh
      if (loadingText) loadingText.textContent = 'Updating calendar...';
      console.log('Calling refresh-caldav endpoint...');
      try {
        const refreshResponse = await fetch(`${API_BASE}/api/refresh-caldav`, {
          method: 'POST',
          credentials: 'include'
        });
        console.log('Refresh response:', refreshResponse.status);
      } catch (refreshError) {
        console.error('Refresh failed (non-fatal):', refreshError);
      }
      
      // Wait another moment for refresh to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('Reloading page...');
      window.location.reload();
      
    } catch (error) {
      console.error('Unexpected error creating event:', error);
      
      // User-friendly error messages
      let userMessage;
      if (error.isTimeout) {
        userMessage = 'Create timed out. Please check your connection and try again.';
      } else if (error.message.includes('fetch') || error.message.includes('network')) {
        userMessage = 'Network error. Please check your connection and try again.';
      } else if (error.status === 400) {
        userMessage = 'Invalid request. Please check your input.';
      } else {
        userMessage = `Error creating event: ${error.message}`;
      }
      
      alert(userMessage);
      
      // Make sure loading overlay is hidden
      const loadingOverlay = document.getElementById('loadingOverlay');
      if (loadingOverlay) loadingOverlay.classList.add('hidden');
    }
  });
}

/**
 * Handle conflict resolution when a 409 error occurs
 * Shows a comparison modal and lets user choose which version to keep
 * @param {string} eventUid - UID of the conflicting event
 * @param {Object} localChanges - User's local changes
 * @returns {Promise<void>}
 */
async function handleConflict(eventUid, localChanges) {
  try {
    // Fetch the current server version
    console.log('Fetching current server version...');
    const response = await fetch(`${API_BASE}/api/events/${encodeURIComponent(eventUid)}`);
    if (!response.ok) {
      throw new Error('Failed to fetch current event version');
    }
    
    const serverEvent = await response.json();
    console.log('Server version:', serverEvent);
    
    // Show conflict modal
    const conflictModal = document.getElementById('conflictModal');
    const conflictComparison = document.getElementById('conflictComparison');
    
    // Build comparison HTML
    const fields = [
      { key: 'summary', label: 'Title' },
      { key: 'start', label: 'Start Date' },
      { key: 'end', label: 'End Date' },
      { key: 'description', label: 'Description' },
      { key: 'location', label: 'Location' }
    ];
    
    let comparisonHTML = '';
    fields.forEach(field => {
      const serverValue = serverEvent[field.key] || '';
      const localValue = localChanges[field.key] || '';
      const isDifferent = serverValue !== localValue;
      
      comparisonHTML += `
        <div style="border: 1px solid ${isDifferent ? '#ff9800' : '#ddd'}; border-radius: 4px; padding: 12px; background: ${isDifferent ? '#fff3e0' : '#f9f9f9'};">
          <h4 style="margin: 0 0 8px 0; font-size: 13px; color: #666;">Your Version</h4>
          <div style="font-weight: 600; margin-bottom: 4px;">${field.label}</div>
          <div style="font-size: 13px; word-break: break-word;">${localValue || '<em>empty</em>'}</div>
        </div>
        <div style="border: 1px solid ${isDifferent ? '#ff9800' : '#ddd'}; border-radius: 4px; padding: 12px; background: ${isDifferent ? '#fff3e0' : '#f9f9f9'};">
          <h4 style="margin: 0 0 8px 0; font-size: 13px; color: #666;">Server Version</h4>
          <div style="font-weight: 600; margin-bottom: 4px;">${field.label}</div>
          <div style="font-size: 13px; word-break: break-word;">${serverValue || '<em>empty</em>'}</div>
        </div>
      `;
    });
    
    conflictComparison.innerHTML = comparisonHTML;
    conflictModal.classList.add('active');
    
    // Handle button clicks
    return new Promise((resolve) => {
      const closeBtn = document.getElementById('closeConflictModal');
      const cancelBtn = document.getElementById('conflictCancelBtn');
      const useServerBtn = document.getElementById('conflictUseServerBtn');
      const keepMineBtn = document.getElementById('conflictKeepMineBtn');
      
      const cleanup = () => {
        conflictModal.classList.remove('active');
        closeBtn.removeEventListener('click', handleCancel);
        cancelBtn.removeEventListener('click', handleCancel);
        useServerBtn.removeEventListener('click', handleUseServer);
        keepMineBtn.removeEventListener('click', handleKeepMine);
      };
      
      const handleCancel = () => {
        cleanup();
        resolve('cancel');
      };
      
      const handleUseServer = () => {
        cleanup();
        console.log('User chose to use server version');
        window.location.reload(); // Reload to show server version
        resolve('server');
      };
      
      const handleKeepMine = async () => {
        cleanup();
        console.log('User chose to keep their changes - forcing update');
        
        // Show loading
        const loadingOverlay = document.getElementById('loadingOverlay');
        const loadingText = loadingOverlay?.querySelector('p');
        if (loadingText) loadingText.textContent = 'Force updating event...';
        loadingOverlay?.classList.remove('hidden');
        
        // TODO: Implement force update (would need backend support for If-Match: *)
        // For now, just alert the user
        alert('Force update not yet implemented. Please refresh and try again, or use the server version.');
        window.location.reload();
        
        resolve('mine');
      };
      
      closeBtn.addEventListener('click', handleCancel);
      cancelBtn.addEventListener('click', handleCancel);
      useServerBtn.addEventListener('click', handleUseServer);
      keepMineBtn.addEventListener('click', handleKeepMine);
    });
    
  } catch (error) {
    console.error('Error handling conflict:', error);
    alert('Failed to resolve conflict. Please refresh and try again.');
  }
}

/**
 * Show modal to edit an existing event
 * Loads event data into form fields for editing
 * @param {Object} event - Event object to edit
 * @returns {Promise<void>}
 */
async function showEventModal(event) {
  const modal = document.getElementById('eventModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  
  console.log('=== Full Event Object ===');
  console.log(JSON.stringify(event, null, 2));
  console.log('=== End Full Event ===');
  
  if (!modal || !modalTitle || !modalBody) return;
  
  const calendar = state.calendars.find(c => c.id === event.group);
  const calendarName = calendar?.content || calendar?.displayName || 'Unknown';
  
  // Check if event is unconfirmed
  const isUnconfirmed = event.content.includes('???');
  const systemType = (event.meta || {}).systemType || '';
  
  // Strip ??? from title for display
  const displayTitle = event.content.replace(/\s*\?\?\?\s*/g, '').trim();
  
  // Build modal title with pills
  const pillsHtml = `
    ${systemType ? `<span style="display: inline-flex; align-items: center; padding: 2px 8px; background: #e5e7eb; color: #374151; border-radius: 12px; font-size: 11px; font-weight: 500; margin-left: 8px;">${systemType}</span>` : ''}
    ${isUnconfirmed ? `<span style="display: inline-flex; align-items: center; padding: 2px 8px; background: #fef3c7; color: #92400e; border-radius: 12px; font-size: 11px; font-weight: 500; margin-left: 8px;">⚠️ Unconfirmed</span>` : ''}
  `;
  modalTitle.innerHTML = `${displayTitle}${pillsHtml}`;
  
  // Format dates
  const startDate = parseLocalDate(event.start);
  const endDate = parseLocalDate(event.end);
  const formatDate = (date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  
  // Use clean description (without YAML) and pre-parsed metadata
  const description = event.description || '';
  const metadata = event.meta || {};
  
  console.log('=== Event Modal Debug ===');
  console.log('Event title:', event.content);
  console.log('Clean description:', description);
  console.log('Metadata object:', metadata);
  console.log('Event location:', event.location);
  
  const location = event.location || '';
  const orderNumber = metadata.orderNumber || '';
  const ticketLink = metadata.ticketLink || '';
  
  console.log('Form values - orderNumber:', orderNumber, 'ticketLink:', ticketLink, 'systemType:', systemType);
  console.log('=== End Debug ===');
  
  // Check if desktop (wider than 768px)
  const isDesktop = window.innerWidth >= 768;
  
  if (isDesktop) {
    // Desktop layout with map and compact styling
    modalBody.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <!-- Left column: Form fields -->
        <div>
          <div style="margin-bottom: 12px;">
            <label style="display: block; font-weight: 600; margin-bottom: 4px; font-size: 13px;">Title</label>
            <input type="text" id="eventTitle" value="${event.content}" style="width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
            <div>
              <label style="display: block; font-weight: 600; margin-bottom: 4px; font-size: 13px;">Start</label>
              <input type="date" id="eventStart" value="${event.start}" style="width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
            </div>
            <div>
              <label style="display: block; font-weight: 600; margin-bottom: 4px; font-size: 13px;">End</label>
              <input type="date" id="eventEnd" value="${event.end}" style="width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
            </div>
          </div>
          <div style="margin-bottom: 12px;">
            <label style="display: block; font-weight: 600; margin-bottom: 4px; font-size: 13px;">Description</label>
            <textarea id="eventDescription" rows="2" style="width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; font-family: inherit; resize: vertical;">${description}</textarea>
          </div>
          <div style="margin-bottom: 12px;">
            <label style="display: block; font-weight: 600; margin-bottom: 4px; font-size: 13px;">Location</label>
            <input type="text" id="eventLocation" value="${location}" style="width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
          </div>
          <div style="margin-bottom: 12px;">
            <label style="display: block; font-weight: 600; margin-bottom: 4px; font-size: 13px;">Calendar</label>
            <select id="eventCalendar" style="width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
              ${state.calendars.map(cal => 
                `<option value="${cal.id}" ${cal.id === event.group ? 'selected' : ''}>${cal.content || cal.displayName}</option>`
              ).join('')}
            </select>
          </div>
        </div>
        
        <!-- Right column: Metadata and map -->
        <div>
          <div style="margin-bottom: 12px;">
            <label style="display: block; font-weight: 600; margin-bottom: 4px; font-size: 13px;">Order Number</label>
            <input type="text" id="eventOrderNumber" value="${orderNumber}" placeholder="e.g., SO-12345" style="width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
          </div>
          <div style="margin-bottom: 12px;">
            <label style="display: block; font-weight: 600; margin-bottom: 4px; font-size: 13px;">Ticket Link</label>
            <div style="display: flex; gap: 6px; align-items: center;">
              <input type="url" id="eventTicketLink" value="${ticketLink}" placeholder="https://..." style="flex: 1; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
              ${ticketLink ? `<a href="${ticketLink}" target="_blank" rel="noopener noreferrer" style="padding: 6px 10px; background: #007aff; color: white; border-radius: 4px; text-decoration: none; font-size: 13px; white-space: nowrap;" title="Open ticket">🔗 Open</a>` : ''}
            </div>
          </div>
          <div style="margin-bottom: 12px;">
            <label style="display: block; font-weight: 600; margin-bottom: 4px; font-size: 13px;">System Type</label>
            <input type="text" id="eventSystemType" value="${systemType}" placeholder="e.g., Laser Q-Switch" style="width: 100%; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
          </div>
          
          <!-- Map preview -->
          <div style="margin-top: 16px;">
            <label style="display: block; font-weight: 600; margin-bottom: 4px; font-size: 13px;">Location Map</label>
            <div id="eventMapPreview" style="width: 100%; height: 200px; border: 1px solid #ddd; border-radius: 4px; background: #f5f5f5; display: flex; align-items: center; justify-content: center; color: #999; font-size: 12px;">
              ${location ? 'Loading map...' : 'No location specified'}
            </div>
            ${location ? `
              <div style="display: flex; gap: 8px; margin-top: 8px; font-size: 12px;">
                <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}" target="_blank" rel="noopener noreferrer" style="padding: 4px 8px; background: #4285f4; color: white; border-radius: 4px; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="white"/>
                  </svg>
                  Google Maps
                </a>
                <a href="https://maps.apple.com/?q=${encodeURIComponent(location)}" target="_blank" rel="noopener noreferrer" style="padding: 4px 8px; background: #000; color: white; border-radius: 4px; text-decoration: none; display: inline-flex; align-items: center; gap: 4px;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" fill="white"/>
                  </svg>
                  Apple Maps
                </a>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  } else {
    // Mobile layout (original)
    modalBody.innerHTML = `
      <div style="margin-bottom: 15px;">
        <label style="display: block; font-weight: 600; margin-bottom: 5px;">Title:</label>
        <input type="text" id="eventTitle" value="${event.content}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
        <div>
          <label style="display: block; font-weight: 600; margin-bottom: 5px;">Start:</label>
          <input type="date" id="eventStart" value="${event.start}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box;">
        </div>
        <div>
          <label style="display: block; font-weight: 600; margin-bottom: 5px;">End:</label>
          <input type="date" id="eventEnd" value="${event.end}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box;">
        </div>
      </div>
      <div style="margin-bottom: 15px;">
        <label style="display: block; font-weight: 600; margin-bottom: 5px;">Description:</label>
        <textarea id="eventDescription" rows="3" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; font-family: inherit;">${description}</textarea>
      </div>
      <div style="margin-bottom: 15px;">
        <label style="display: block; font-weight: 600; margin-bottom: 5px;">Location:</label>
        <input type="text" id="eventLocation" value="${location}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
      </div>
      <div style="margin-bottom: 15px;">
        <label style="display: block; font-weight: 600; margin-bottom: 5px;">Order Number:</label>
        <input type="text" id="eventOrderNumber" value="${orderNumber}" placeholder="e.g., SO-12345" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
      </div>
      <div style="margin-bottom: 15px;">
        <label style="display: block; font-weight: 600; margin-bottom: 5px;">Ticket Link:</label>
        <input type="url" id="eventTicketLink" value="${ticketLink}" placeholder="https://..." style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
      </div>
      <div style="margin-bottom: 15px;">
        <label style="display: block; font-weight: 600; margin-bottom: 5px;">System Type:</label>
        <input type="text" id="eventSystemType" value="${systemType}" placeholder="e.g., Laser Q-Switch" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
      </div>
      <div style="margin-bottom: 15px;">
        <label style="display: block; font-weight: 600; margin-bottom: 5px;">Calendar:</label>
        <select id="eventCalendar" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
          ${state.calendars.map(cal => 
            `<option value="${cal.id}" ${cal.id === event.group ? 'selected' : ''}>${cal.content || cal.displayName}</option>`
          ).join('')}
        </select>
      </div>
    `;
  }
  
  // Initialize map if desktop and location exists
  if (isDesktop && location) {
    initEventMap(location);
  }
  
  // Setup modal buttons
  const closeModal = document.getElementById('closeModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const saveEventBtn = document.getElementById('saveEventBtn');
  const deleteEventBtn = document.getElementById('deleteEventBtn');
  
  // Show delete button in edit mode
  if (deleteEventBtn) deleteEventBtn.style.display = '';
  
  // Show modal
  modal.classList.add('active');
  
  const closeHandler = () => {
    modal.classList.remove('active');
  };
  
  closeModal?.addEventListener('click', closeHandler);
  closeModalBtn?.addEventListener('click', closeHandler);
  
  // Delete event handler
  deleteEventBtn?.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to delete this event?')) {
      return;
    }
    
    // Use event.uid if available, otherwise extract from id and remove leading hyphen
    const eventUid = event.uid || event.id.split('/').pop().replace(/^-/, '');
    console.log('Deleting event with UID:', eventUid, 'Original event.id:', event.id, 'event.uid:', event.uid);
    
    try {
      // First fetch the full event (like desktop does) to ensure backend can find it
      console.log('Step 1: Fetching event with GET...');
      const getResponse = await withTimeout(
        fetchWithRetry(
          `${API_BASE}/api/events/${encodeURIComponent(eventUid)}`,
          {},
          { maxRetries: 1 }
        ),
        15000,
        'Failed to fetch event'
      );
      console.log('GET response status:', getResponse.status);
      
      const eventData = await getResponse.json();
      console.log('Step 2: GET succeeded, fetched event:', eventData);
      
      // Now delete it
      console.log('Step 3: Attempting DELETE...');
      // NOTE: Only 1 retry for DELETE to prevent duplicate delete attempts
      const response = await withTimeout(
        fetchWithRetry(
          `${API_BASE}/api/events/${encodeURIComponent(eventUid)}`,
          { method: 'DELETE' },
          {
            maxRetries: 1, // Reduced from 2 to prevent duplicate deletes
            onRetry: (error, attempt) => {
              console.log(`Retrying delete (attempt ${attempt})...`);
            }
          }
        ),
        30000,
        'Delete operation timed out'
      );
      console.log('DELETE response status:', response.status);
      
      if (response.ok) {
        modal.classList.remove('active');
        const loadingOverlay = document.getElementById('loadingOverlay');
        const loadingText = loadingOverlay?.querySelector('p');
        if (loadingText) loadingText.textContent = 'Deleting event...';
        loadingOverlay?.classList.remove('hidden');
        
        console.log('Event deleted successfully, triggering CalDAV refresh...');
        
        // Wait for backend to save
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Trigger CalDAV cache refresh
        if (loadingText) loadingText.textContent = 'Refreshing calendar...';
        try {
          const refreshResponse = await fetch(`${API_BASE}/api/refresh-caldav`, {
            method: 'POST',
            credentials: 'include'
          });
          console.log('Refresh response:', refreshResponse.status);
        } catch (refreshError) {
          console.error('Refresh failed (non-fatal):', refreshError);
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('Reloading page after delete...');
        window.location.reload();
      } else {
        const errorText = await response.text();
        console.error('Failed to delete event:', response.status, errorText);
        
        // User-friendly error messages
        let userMessage;
        if (response.status === 404) {
          userMessage = 'Event not found. It may have already been deleted.';
        } else if (response.status === 400) {
          userMessage = 'Invalid request. Please try again.';
        } else {
          userMessage = `Failed to delete event: ${response.status}`;
        }
        
        alert(userMessage);
      }
    } catch (error) {
      console.error('Error deleting event:', error);
      
      // User-friendly error messages
      let userMessage;
      if (error.isTimeout) {
        userMessage = 'Delete timed out. Please check your connection and try again.';
      } else if (error.message.includes('fetch') || error.message.includes('network')) {
        userMessage = 'Network error. Please check your connection and try again.';
      } else if (error.status === 404) {
        userMessage = 'Event not found. It may have already been deleted.';
      } else {
        userMessage = `Error deleting event: ${error.message}`;
      }
      
      alert(userMessage);
    }
  });
  
  // Save event handler
  saveEventBtn?.addEventListener('click', async () => {
    const title = document.getElementById('eventTitle').value;
    const calendarId = document.getElementById('eventCalendar').value;
    const start = document.getElementById('eventStart').value;
    const end = document.getElementById('eventEnd').value;
    const description = document.getElementById('eventDescription').value;
    const location = document.getElementById('eventLocation').value;
    const orderNumber = document.getElementById('eventOrderNumber').value;
    const ticketLink = document.getElementById('eventTicketLink').value;
    const systemType = document.getElementById('eventSystemType').value;
    
    if (!title || !start || !end) {
      alert('Please fill in title, start date, and end date');
      return;
    }
    
    // Validate date range
    if (new Date(end) < new Date(start)) {
      alert('End date cannot be before start date. Please check your dates.');
      return;
    }
    
    // Build metadata YAML block (matching desktop format)
    const meta = {};
    if (orderNumber) meta.orderNumber = orderNumber;
    if (ticketLink) meta.ticketLink = ticketLink;
    if (systemType) meta.systemType = systemType;
    
    // Build description with YAML fence (if there's metadata)
    let fullDescription = description || '';
    if (Object.keys(meta).length > 0) {
      const yamlLines = Object.entries(meta).map(([key, value]) => `${key}: ${value}`).join('\n');
      fullDescription = (fullDescription ? fullDescription + '\n\n' : '') + '\n```yaml\n' + yamlLines + '\n```\n';
    }
    
    // Check if calendar changed - if so, we need to trigger a MOVE operation
    const originalCalendarId = event.group;
    const calendarChanged = calendarId !== originalCalendarId;
    
    // Find the target calendar URL if calendar changed
    let targetCalendarUrl = null;
    if (calendarChanged) {
      const targetCalendar = state.calendars.find(cal => cal.id === calendarId);
      if (targetCalendar) {
        targetCalendarUrl = targetCalendar.url;
        console.log(`Calendar changed from ${originalCalendarId} to ${calendarId}, will move to ${targetCalendarUrl}`);
      }
    }
    
    // Use event.uid if available, otherwise extract from id and remove leading hyphen
    const eventUid = event.uid || event.id.split('/').pop().replace(/^-/, '');
    console.log('Updating event with UID:', eventUid, 'description:', fullDescription);
    
    try {
      // Build request body
      const requestBody = {
        summary: title,
        start: start,
        end: end,
        description: fullDescription,
        location: location || ''
      };
      
      // Add targetCalendarUrl if calendar changed (triggers MOVE operation)
      if (targetCalendarUrl) {
        requestBody.targetCalendarUrl = targetCalendarUrl;
      }
      
      // Use retry logic with timeout
      // NOTE: Only 1 retry for UPDATE to prevent duplicates (not idempotent)
      const response = await withTimeout(
        fetchWithRetry(
          `${API_BASE}/api/events/${encodeURIComponent(eventUid)}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
          },
          {
            maxRetries: 1, // Reduced from 2 to prevent duplicates
            onRetry: (error, attempt) => {
              console.log(`Retrying update (attempt ${attempt})...`);
              const loadingText = document.getElementById('loadingOverlay')?.querySelector('p');
              if (loadingText) loadingText.textContent = `Retrying update (${attempt}/1)...`;
            }
          }
        ),
        30000, // 30 second timeout
        'Update operation timed out'
      );
      
      if (response.ok) {
        // Close modal and show loading
        modal.classList.remove('active');
        const loadingOverlay = document.getElementById('loadingOverlay');
        const loadingText = loadingOverlay?.querySelector('p');
        if (loadingText) loadingText.textContent = 'Updating event...';
        loadingOverlay?.classList.remove('hidden');
        
        console.log('Event updated successfully, triggering CalDAV refresh...');
        
        // Wait for backend to save
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Trigger CalDAV cache refresh
        if (loadingText) loadingText.textContent = 'Refreshing calendar...';
        try {
          const refreshResponse = await fetch(`${API_BASE}/api/refresh-caldav`, {
            method: 'POST',
            credentials: 'include'
          });
          console.log('Refresh response:', refreshResponse.status);
        } catch (refreshError) {
          console.error('Refresh failed (non-fatal):', refreshError);
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        window.location.reload();
      } else {
        const errorText = await response.text();
        console.error('Failed to update event:', response.status, errorText);
        
        // Handle 409 conflict with conflict resolution UI
        if (response.status === 409) {
          console.log('Conflict detected, showing resolution UI...');
          await handleConflict(eventUid, {
            summary: title,
            start: start,
            end: end,
            description: fullDescription,
            location: location || ''
          });
          return; // Don't show alert, conflict UI handles it
        }
        
        // Provide user-friendly error messages for other errors
        let userMessage;
        if (response.status === 404) {
          userMessage = 'Event not found. It may have been deleted.';
        } else if (response.status === 400) {
          userMessage = 'Invalid request. Please check your input.';
        } else {
          userMessage = `Failed to update event: ${response.status}`;
        }
        
        alert(userMessage);
      }
    } catch (error) {
      console.error('Error updating event:', error);
      
      // User-friendly error messages
      let userMessage;
      if (error.isTimeout) {
        userMessage = 'Update timed out. Please check your connection and try again.';
      } else if (error.message.includes('fetch') || error.message.includes('network')) {
        userMessage = 'Network error. Please check your connection and try again.';
      } else {
        userMessage = `Error updating event: ${error.message}`;
      }
      
      alert(userMessage);
    }
  });
}

// ============================================
// RENDERING HELPERS
// ============================================

/**
 * Render background shading for weekends and holidays
 * @param {number} pixelsPerDay - Current zoom level pixels per day
 * @returns {string} HTML string for background overlays
 */
function renderWeekendAndHolidayBackgrounds(pixelsPerDay) {
  let html = '';
  const holidayDates = new Set(state.holidays.map(h => h.date));
  
  // Iterate through each day in the range using local dates
  let current = new Date(state.dateRange.from);
  current.setHours(0, 0, 0, 0); // Normalize to local midnight
  let dayIndex = 0;
  
  while (current < state.dateRange.to) {
    const dayOfWeek = current.getDay(); // 0 = Sunday, 6 = Saturday
    // Format as YYYY-MM-DD in local timezone
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const day = String(current.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = holidayDates.has(dateStr);
    
    // Debug Oct 11-12
    if (current.getDate() >= 11 && current.getDate() <= 12) {
      console.log(`Weekend BG: Day ${dayIndex} = ${current.toDateString()}, dayOfWeek=${dayOfWeek}, isWeekend=${isWeekend}, left=${dayIndex * pixelsPerDay}px`);
    }
    
    if (isWeekend || isHoliday) {
      const left = dayIndex * pixelsPerDay;
      const color = isHoliday ? 'rgba(255, 200, 200, 0.3)' : 'rgba(200, 200, 200, 0.2)';
      html += `<div style="position: absolute; left: ${left}px; width: ${pixelsPerDay}px; top: 0; bottom: 0; background: ${color};"></div>`;
    }
    
    current.setDate(current.getDate() + 1);
    dayIndex++;
  }
  
  return html;
}

/**
 * Render vertical lines marking month boundaries
 * @param {number} pixelsPerDay - Current zoom level pixels per day
 * @returns {string} HTML string for month boundary lines
 */
function renderMonthLines(pixelsPerDay) {
  let html = '';
  let current = new Date(state.dateRange.from);
  current.setDate(1);
  let position = 0;
  
  while (current < state.dateRange.to) {
    const daysInMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
    const width = daysInMonth * pixelsPerDay;
    
    position += width;
    const nextMonth = new Date(current);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    
    // Add vertical line at the end of each month (but not at the very end)
    if (nextMonth < state.dateRange.to) {
      html += `<div style="position: absolute; left: ${position}px; top: 0; bottom: 0; width: 2px; background: #999;"></div>`;
    }
    
    current.setMonth(current.getMonth() + 1);
  }
  
  return html;
}

/**
 * Render month name headers at the top of the timeline
 * @param {number} pixelsPerDay - Current zoom level pixels per day
 * @returns {string} HTML string for month headers
 */
function renderMonthHeaders(pixelsPerDay) {
  let html = '';
  let current = new Date(state.dateRange.from);
  current.setDate(1);
  
  while (current < state.dateRange.to) {
    const daysInMonth = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
    const width = daysInMonth * pixelsPerDay;
    const monthName = current.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    
    html += `<div style="width: ${width}px; padding: 8px; font-size: 11px; font-weight: 600; text-align: center; background: #f5f5f5;">${monthName}</div>`;
    
    current.setMonth(current.getMonth() + 1);
  }
  
  return html;
}

/**
 * Calculate ISO week number for a given date
 * @param {Date} date - Date to calculate week number for
 * @returns {number} ISO week number (1-53)
 */
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Render ISO week numbers along the timeline
 * @param {number} pixelsPerDay - Current zoom level pixels per day
 * @returns {string} HTML string for week number labels
 */
function renderWeekNumbers(pixelsPerDay) {
  let html = '';
  let current = new Date(state.dateRange.from);
  current.setHours(0, 0, 0, 0);
  
  let dayIndex = 0;
  let lastWeekNum = -1;
  
  while (current < state.dateRange.to) {
    const weekNum = getWeekNumber(current);
    const dayOfWeek = current.getDay();
    
    // Show week number on Monday (or first day if week starts mid-range)
    if (weekNum !== lastWeekNum && (dayOfWeek === 1 || dayIndex === 0)) {
      const left = dayIndex * pixelsPerDay;
      const weekWidth = pixelsPerDay * 7;
      
      // Week number label (centered)
      html += `<div style="position: absolute; left: ${left}px; width: ${weekWidth}px; font-size: 8px; color: #888; text-align: center; padding-top: 2px; font-weight: 600;">W${weekNum}</div>`;
      
      // Vertical line at start of week
      html += `<div style="position: absolute; left: ${left}px; top: 0; bottom: 0; width: 1px; background: #ddd;"></div>`;
      
      lastWeekNum = weekNum;
    }
    
    current.setDate(current.getDate() + 1);
    dayIndex++;
  }
  
  return html;
}

/**
 * Render day numbers (1-31) along the timeline
 * @param {number} pixelsPerDay - Current zoom level pixels per day
 * @returns {string} HTML string for day number labels
 */
function renderDayNumbers(pixelsPerDay) {
  let html = '';
  let current = new Date(state.dateRange.from);
  current.setHours(0, 0, 0, 0); // Normalize to local midnight
  
  let dayIndex = 0;
  while (current < state.dateRange.to) {
    const dayNum = current.getDate();
    const dayOfWeek = current.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const color = isWeekend ? '#999' : '#666';
    const fontWeight = dayNum === 1 ? '600' : '400';
    
    // Use absolute positioning like events and weekend backgrounds
    const left = dayIndex * pixelsPerDay;
    html += `<div style="position: absolute; left: ${left}px; width: ${pixelsPerDay}px; font-size: 9px; color: ${color}; text-align: center; padding-top: 4px; font-weight: ${fontWeight};">${dayNum}</div>`;
    
    current.setDate(current.getDate() + 1);
    dayIndex++;
  }
  
  return html;
}

/**
 * Render all events for a specific calendar lane
 * Handles event positioning, stacking, and styling
 * @param {string} calendarId - ID of the calendar to render events for
 * @param {number} pixelsPerDay - Current zoom level pixels per day
 * @returns {string} HTML string for calendar's events
 */
function renderEventsForCalendar(calendarId, pixelsPerDay) {
  const calendar = state.calendars.find(c => c.id === calendarId);
  let events = state.events.filter(e => e.group === calendarId);
  
  // Apply calendar selection filter
  if (state.selectedCalendars.size > 0 && !state.selectedCalendars.has(calendarId)) {
    // If calendars are selected and this one isn't selected, show no events
    return '';
  }
  
  // Apply search filter (search in event content OR calendar name)
  if (state.searchQuery) {
    const calendarName = (calendar?.content || calendar?.displayName || '').toLowerCase();
    const matchesCalendar = calendarName.includes(state.searchQuery);
    
    if (!matchesCalendar) {
      // If calendar doesn't match, filter events by content
      events = events.filter(e => 
        e.content.toLowerCase().includes(state.searchQuery)
      );
    }
    // If calendar matches, show all events from that calendar
  }
  
  let html = '';
  
  // Calculate positions
  const eventData = events.map(event => ({
    event,
    pos: calculateEventPosition(event, pixelsPerDay),
    color: getEventColor(event, calendar),
    lane: 0,
    maxLanesInGroup: 1
  }));
  
  // Sort by start position
  eventData.sort((a, b) => a.pos.left - b.pos.left);
  
  // Assign lanes to avoid overlaps
  eventData.forEach((current, i) => {
    const currentEnd = current.pos.left + current.pos.width;
    
    // Find occupied lanes by checking overlapping events
    const occupiedLanes = new Set();
    const overlappingEvents = [];
    
    for (let j = 0; j < i; j++) {
      const prev = eventData[j];
      const prevEnd = prev.pos.left + prev.pos.width;
      
      // Check if events overlap
      if (current.pos.left < prevEnd && currentEnd > prev.pos.left) {
        occupiedLanes.add(prev.lane);
        overlappingEvents.push(prev);
      }
    }
    
    // Find first available lane
    let lane = 0;
    while (occupiedLanes.has(lane)) {
      lane++;
    }
    current.lane = lane;
    
    // Calculate max lanes for this overlapping group
    const maxLanesInGroup = Math.max(lane + 1, ...overlappingEvents.map(e => e.maxLanesInGroup));
    current.maxLanesInGroup = maxLanesInGroup;
    
    // Update all overlapping events with the new max
    overlappingEvents.forEach(e => {
      e.maxLanesInGroup = maxLanesInGroup;
    });
  });
  
  // Render events with individual heights based on their overlap group
  eventData.forEach(({ event, pos, color, lane, maxLanesInGroup }) => {
    const eventHeight = maxLanesInGroup > 1 ? Math.floor(40 / maxLanesInGroup) : 40;
    const top = 5 + (lane * eventHeight);
    const fontSize = eventHeight < 25 ? 9 : 10;
    const lineClamp = eventHeight < 25 ? 1 : 2;
    
    // Check if event is unconfirmed (contains ???)
    const isUnconfirmed = (event.content || event.summary || '').includes('???');
    const opacity = isUnconfirmed ? UNCONFIRMED_EVENT_OPACITY : 1;
    
    html += `<div class="timeline-event" data-event-id="${event.id}" style="position: absolute; left: ${pos.left}px; width: ${pos.width}px; top: ${top}px; height: ${eventHeight}px; background: ${color}; color: white; border-radius: 3px; padding: 2px 4px; font-size: ${fontSize}px; line-height: 1.2; overflow: hidden; display: -webkit-box; -webkit-line-clamp: ${lineClamp}; -webkit-box-orient: vertical; box-shadow: 0 1px 2px rgba(0,0,0,0.2); cursor: pointer; opacity: ${opacity};">${event.content}</div>`;
  });
  
  return html;
}

// ============================================
// UTILITIES
// ============================================

/**
 * Parse date string as local date (not UTC)
 * Prevents timezone issues by parsing as local midnight
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {Date} Local date object
 */
function parseLocalDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Calculate event position and width in pixels
 * @param {Object} event - Event object with start and end dates
 * @param {number} pixelsPerDay - Current zoom level pixels per day
 * @returns {{left: number, width: number}} Position object
 */
function calculateEventPosition(event, pixelsPerDay) {
  // Parse as local dates to avoid timezone issues
  const eventStart = parseLocalDate(event.start);
  const eventEnd = parseLocalDate(event.end);
  const rangeStart = new Date(state.dateRange.from);
  rangeStart.setHours(0, 0, 0, 0);
  
  // Debug logging for events starting on Oct 13
  if (event.start === '2025-10-13') {
    console.log('=== Event Position Debug (Oct 13) ===');
    console.log('Event:', event.content);
    console.log('event.start string:', event.start);
    console.log('Parsed eventStart:', eventStart, eventStart.toDateString());
    console.log('rangeStart:', rangeStart, rangeStart.toDateString());
    console.log('Difference in ms:', eventStart - rangeStart);
    console.log('Days from start:', Math.round((eventStart - rangeStart) / (1000 * 60 * 60 * 24)));
    console.log('Calculated left position:', Math.round((eventStart - rangeStart) / (1000 * 60 * 60 * 24)) * pixelsPerDay);
  }
  
  // Calculate days from start (should be whole days)
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysFromStart = Math.round((eventStart - rangeStart) / msPerDay);
  let duration = Math.round((eventEnd - eventStart) / msPerDay);
  
  // For all-day events, the end date is exclusive in the API
  // but we want to display it inclusively (e.g., Oct 20-24 should show 5 days, not 4)
  // Add 1 day to make the visual representation inclusive
  if (duration > 0) {
    duration += 1;
  }
  
  const left = daysFromStart * pixelsPerDay;
  const width = Math.max(duration * pixelsPerDay, 30);
  return { left, width };
}

/**
 * Get contrast color (white or black) based on background brightness
 * Uses luminance calculation to determine readable text color
 * @param {string} color - Background color (hex, rgb, or named color)
 * @returns {string} 'white' or 'black' for best contrast
 */
function getContrastColor(color) {
  let r, g, b;
  
  // Handle rgb() format
  if (color.startsWith('rgb')) {
    const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      r = parseInt(match[1]);
      g = parseInt(match[2]);
      b = parseInt(match[3]);
    }
  } else {
    // Handle hex format
    const hex = color.replace('#', '');
    r = parseInt(hex.substr(0, 2), 16);
    g = parseInt(hex.substr(2, 2), 16);
    b = parseInt(hex.substr(4, 2), 16);
  }
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return black for light backgrounds, white for dark
  return luminance > 0.5 ? 'black' : 'white';
}

/**
 * Convert hex color to rgba with opacity
 * @param {string} hex - Hex color (e.g., '#FF8A95')
 * @param {number} opacity - Opacity value (0-1)
 * @returns {string} RGBA color string
 */
function hexToRgba(hex, opacity) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Get color for an event (event color or fallback to calendar color)
 * @param {Object} event - Event object
 * @param {Object} calendar - Calendar object
 * @returns {string} Color string (hex or rgb)
 */
function getEventColor(event, calendar) {
  // First check if event has its own color
  if (event.color) {
    return event.color;
  }
  
  // Use event types from configuration
  if (state.eventTypes) {
    const eventTitle = (event.content || event.summary || '').toLowerCase();
    
    // Check each event type's patterns
    for (const [typeName, typeConfig] of Object.entries(state.eventTypes)) {
      if (typeName === '_default') continue;
      
      const patterns = typeConfig.patterns || [];
      for (const pattern of patterns) {
        if (eventTitle.includes(pattern.toLowerCase())) {
          return typeConfig.color;
        }
      }
    }
    
    // Use default color if configured
    if (state.eventTypes._default) {
      return state.eventTypes._default.color;
    }
  }
  
  // Finally use calendar color
  if (calendar?.bg) {
    return calendar.bg;
  }
  
  // Default fallback
  return '#64748B';
}

/**
 * Initialize map for event location preview
 * @param {string} location - Location string to geocode and display
 */
async function initEventMap(location) {
  const mapContainer = document.getElementById('eventMapPreview');
  if (!mapContainer || !location) return;
  
  try {
    // Geocode the location using Nominatim
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`);
    const results = await response.json();
    
    if (results && results.length > 0) {
      const { lat, lon, display_name } = results[0];
      
      // Clear loading message
      mapContainer.innerHTML = '';
      
      // Initialize Leaflet map
      const map = L.map(mapContainer, {
        center: [lat, lon],
        zoom: 13,
        zoomControl: false,
        attributionControl: false
      });
      
      // Add tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(map);
      
      // Add marker
      L.marker([lat, lon]).addTo(map)
        .bindPopup(display_name);
      
      // Invalidate size after a short delay to ensure proper rendering
      setTimeout(() => map.invalidateSize(), 100);
    } else {
      mapContainer.innerHTML = '<div style="color: #999; font-size: 12px;">Location not found</div>';
    }
  } catch (error) {
    console.error('Failed to load map:', error);
    mapContainer.innerHTML = '<div style="color: #999; font-size: 12px;">Failed to load map</div>';
  }
}

// ============================================
// AUTO-REFRESH FOR MULTI-USER SYNC
// ============================================

/**
 * Auto-refresh data periodically to sync with other users' changes
 * Runs every 60 seconds to keep data fresh in multi-user environment
 */
let autoRefreshInterval = null;
let lastRefreshTime = Date.now();

function startAutoRefresh() {
  // Clear any existing interval
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
  }
  
  // Refresh every 60 seconds
  autoRefreshInterval = setInterval(async () => {
    try {
      console.log('[AutoRefresh] Checking for updates...');
      const timeSinceLastRefresh = Date.now() - lastRefreshTime;
      
      // Only refresh if no modal is open (don't interrupt user)
      const modal = document.getElementById('eventModal');
      const conflictModal = document.getElementById('conflictModal');
      const isModalOpen = modal?.classList.contains('active') || conflictModal?.classList.contains('active');
      
      if (isModalOpen) {
        console.log('[AutoRefresh] Modal open, skipping refresh');
        return;
      }
      
      // Silently reload data in background
      await loadData();
      render();
      lastRefreshTime = Date.now();
      console.log('[AutoRefresh] Data refreshed successfully');
      
      // Show subtle notification
      showRefreshNotification();
    } catch (error) {
      console.error('[AutoRefresh] Failed to refresh:', error);
    }
  }, 60 * 1000); // 60 seconds
  
  console.log('[AutoRefresh] Started (interval: 60s)');
}

/**
 * Show a subtle notification that data was refreshed
 */
function showRefreshNotification() {
  const statusBar = document.getElementById('statusBar');
  if (!statusBar) return;
  
  statusBar.textContent = '✓ Updated';
  statusBar.style.opacity = '1';
  
  // Fade out after 2 seconds
  setTimeout(() => {
    statusBar.style.opacity = '0';
  }, 2000);
}

/**
 * Stop auto-refresh (e.g., when user is editing)
 */
function stopAutoRefresh() {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
    autoRefreshInterval = null;
    console.log('[AutoRefresh] Stopped');
  }
}

// ============================================
// KEYBOARD SHORTCUTS
// ============================================

/**
 * Setup keyboard shortcuts for navigation and zoom
 * - Plus/Minus OR Arrow Up/Down: Control zoom slider (10 increments)
 * - Arrow Left/Right: Scroll timeline horizontally
 * - Home: Jump to today
 * - End: Jump to end of timeline
 */
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Don't trigger shortcuts when typing in input fields
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return;
    }
    
    const container = document.querySelector('.timeline-container');
    const zoomSlider = document.getElementById('zoomSlider');
    if (!container) return;
    
    const scrollAmount = 200; // pixels to scroll horizontally
    const zoomStep = 10; // zoom slider increments (larger steps for keyboard)
    
    switch(e.key) {
      // Zoom in with +/= or arrow up
      case '+':
      case '=': // Also handle = key (same key as + without shift)
      case 'ArrowUp':
        e.preventDefault();
        if (zoomSlider) {
          const currentValue = parseInt(zoomSlider.value);
          const newValue = Math.min(parseInt(zoomSlider.max), currentValue + zoomStep);
          if (newValue !== currentValue) {
            zoomSlider.value = newValue;
            zoomSlider.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
        break;
        
      // Zoom out with -/_ or arrow down
      case '-':
      case '_': // Also handle _ key (same key as - with shift)
      case 'ArrowDown':
        e.preventDefault();
        if (zoomSlider) {
          const currentValue = parseInt(zoomSlider.value);
          const newValue = Math.max(parseInt(zoomSlider.min), currentValue - zoomStep);
          if (newValue !== currentValue) {
            zoomSlider.value = newValue;
            zoomSlider.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
        break;
      
      // Scroll controls with arrow left/right
      case 'ArrowLeft':
        e.preventDefault();
        container.scrollLeft -= scrollAmount;
        break;
        
      case 'ArrowRight':
        e.preventDefault();
        container.scrollLeft += scrollAmount;
        break;
        
      // Home/End for quick navigation
      case 'Home':
        e.preventDefault();
        // Jump to today
        const today = new Date();
        const startDate = state.dateRange.from;
        const daysFromStart = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
        const pixelsPerDay = ZOOM_SETTINGS[state.zoom] || parseInt(zoomSlider?.value || 10);
        const todayScrollLeft = 100 + (daysFromStart * pixelsPerDay);
        container.scrollLeft = Math.max(0, todayScrollLeft);
        break;
        
      case 'End':
        e.preventDefault();
        container.scrollLeft = container.scrollWidth;
        break;
    }
  });
  
  console.log('[Keyboard] Shortcuts enabled: +/- or ↑/↓ (zoom ±10), ←/→ (scroll), Home (today), End (end)');
}

// Start
init().then(() => {
  // Start auto-refresh after initial load
  startAutoRefresh();
  
  // Setup keyboard shortcuts
  setupKeyboardShortcuts();
});
