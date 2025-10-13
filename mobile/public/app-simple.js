/**
 * Simple Mobile Timeline - Clean Implementation
 * Version: 1760265400
 * 
 * A mobile-optimized timeline view for support planning.
 * Features: View, create, edit, delete events across multiple calendars.
 */

console.log('📱 Mobile Timeline v1760274500 loaded');

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
 */
const state = {
  calendars: [],
  events: [],
  holidays: [],
  dateRange: getDefaultDateRange(),
  zoom: 'month',
  searchQuery: '',
  selectedCalendars: new Set()
};

// ============================================
// CORE APPLICATION FUNCTIONS
// ============================================

/**
 * Calculate default date range for timeline display
 * Returns range from start of current month to 6 months ahead
 * @returns {{from: Date, to: Date}} Date range object
 */
function getDefaultDateRange() {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth(), 1);
  const to = new Date(today.getFullYear(), today.getMonth() + 6, 1);
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
  
  // Hide loading state
  const loadingState = document.getElementById('loadingState');
  if (loadingState) loadingState.style.display = 'none';
  
  // Setup zoom buttons
  document.querySelectorAll('.zoom-controls .control-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.zoom = btn.dataset.zoom;
      document.querySelectorAll('.zoom-controls .control-btn').forEach(b => 
        b.classList.toggle('active', b.dataset.zoom === state.zoom)
      );
      render();
    });
  });
  
  // Setup search
  const searchBtn = document.getElementById('searchBtn');
  const searchOverlay = document.getElementById('searchOverlay');
  const searchInput = document.getElementById('searchInput');
  const closeSearch = document.getElementById('closeSearch');
  
  searchBtn?.addEventListener('click', () => {
    searchOverlay?.classList.add('active');
    searchInput?.focus();
  });
  
  closeSearch?.addEventListener('click', () => {
    searchOverlay?.classList.remove('active');
    searchInput.value = '';
    state.searchQuery = '';
    render();
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
    const fromStr = state.dateRange.from.toISOString().split('T')[0];
    const toStr = state.dateRange.to.toISOString().split('T')[0];
    
    console.log('Loading events...');
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
  state.calendars.forEach(calendar => {
    const isSelected = state.selectedCalendars.size === 0 || state.selectedCalendars.has(calendar.id);
    const opacity = isSelected ? '1' : '0.3';
    
    html += `<div style="display: flex; height: 50px; border-bottom: 1px solid #eee; opacity: ${opacity};">`;
    
    const bgColor = calendar.bg || '#f5f5f5';
    const textColor = getContrastColor(bgColor);
    const name = calendar.content || calendar.displayName;
    const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    
    // Full name label (visible at start, scrolls away) - clickable
    html += `<div data-calendar-id="${calendar.id}" class="calendar-label" style="width: 100px; padding: 8px; font-size: 12px; font-weight: 600; border-right: 2px solid #ccc; flex-shrink: 0; background: ${bgColor}; color: ${textColor}; display: flex; align-items: center; z-index: 20; cursor: pointer;">${name}</div>`;
    
    // Lane indicator - narrow colored bar (sticky, appears when scrolling) - clickable
    html += `<div data-calendar-id="${calendar.id}" class="calendar-label" style="width: 30px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; border-right: 2px solid #ccc; flex-shrink: 0; background: ${bgColor}; color: ${textColor}; z-index: 10; position: sticky; left: 0; margin-left: -30px; cursor: pointer;">${initials}</div>`;
    
    // Lane content (with overflow hidden to prevent events from piercing through)
    html += `<div class="calendar-lane-area" data-calendar-id="${calendar.id}" style="position: relative; flex: 1; overflow: hidden;">`;
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
  
  modalBody.innerHTML = `
    <ion-list lines="full">
      <ion-item>
        <ion-label position="stacked">Title</ion-label>
        <ion-input id="eventTitle" value="${defaultTitle}" placeholder="Event title"></ion-input>
      </ion-item>
      
      <ion-item>
        <ion-label position="stacked">Start Date</ion-label>
        <ion-input type="date" id="eventStart" value="${startDateStr}"></ion-input>
      </ion-item>
      
      <ion-item>
        <ion-label position="stacked">End Date</ion-label>
        <ion-input type="date" id="eventEnd" value="${endDateStr}"></ion-input>
      </ion-item>
      
      <ion-item>
        <ion-label position="stacked">Description</ion-label>
        <ion-textarea id="eventDescription" rows="3" placeholder="Description"></ion-textarea>
      </ion-item>
      
      <ion-item>
        <ion-label position="stacked">Location</ion-label>
        <ion-input id="eventLocation" placeholder="Location"></ion-input>
      </ion-item>
      
      <ion-item>
        <ion-label position="stacked">Order Number</ion-label>
        <ion-input id="eventOrderNumber" placeholder="e.g., SO-12345"></ion-input>
      </ion-item>
      
      <ion-item>
        <ion-label position="stacked">Ticket Link</ion-label>
        <ion-input type="url" id="eventTicketLink" placeholder="https://..."></ion-input>
      </ion-item>
      
      <ion-item>
        <ion-label position="stacked">System Type</ion-label>
        <ion-input id="eventSystemType" placeholder="e.g., Laser Q-Switch"></ion-input>
      </ion-item>
      
      <ion-item>
        <ion-label position="stacked">Calendar</ion-label>
        <ion-select id="eventCalendar" value="${calendar.url}">
          ${state.calendars.map(cal => 
            `<ion-select-option value="${cal.url}">${cal.content || cal.displayName}</ion-select-option>`
          ).join('')}
        </ion-select>
      </ion-item>
    </ion-list>
  `;
  
  // Wait for Ionic components in innerHTML to be registered
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // Show modal (Ionic)
  await modal.present();
  
  // Wait for modal to be fully rendered
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Access buttons inside modal's shadow DOM
  const closeModal = document.getElementById('closeModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const saveEventBtn = document.getElementById('saveEventBtn');
  const deleteEventBtn = document.getElementById('deleteEventBtn');
  
  // Hide delete button in create mode
  if (deleteEventBtn) deleteEventBtn.style.display = 'none';
  
  console.log('Buttons found:', { closeModal, closeModalBtn, saveEventBtn, deleteEventBtn });
  
  const closeHandler = () => {
    console.log('Close clicked');
    modal.dismiss();
  };
  
  // Remove old event listeners by cloning
  const newSaveBtn = saveEventBtn.cloneNode(true);
  saveEventBtn.parentNode.replaceChild(newSaveBtn, saveEventBtn);
  
  closeModal?.addEventListener('click', closeHandler);
  closeModalBtn?.addEventListener('click', closeHandler);
  
  newSaveBtn.addEventListener('click', async () => {
    console.log('Save button clicked!');
    try {
      // Get Ionic input values - need to wait for component to be ready
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const titleEl = document.getElementById('eventTitle');
      const title = await titleEl.getInputElement().then(el => el.value);
      console.log('Creating event with title:', title);
      
      const calendarEl = document.getElementById('eventCalendar');
      const calendarUrl = calendarEl.value;
      
      const startEl = document.getElementById('eventStart');
      const start = await startEl.getInputElement().then(el => el.value);
      
      const endEl = document.getElementById('eventEnd');
      const end = await endEl.getInputElement().then(el => el.value);
      
      const descEl = document.getElementById('eventDescription');
      const description = descEl.value || '';
      
      const locEl = document.getElementById('eventLocation');
      const location = await locEl.getInputElement().then(el => el.value).catch(() => '');
      
      const orderEl = document.getElementById('eventOrderNumber');
      const orderNumber = await orderEl.getInputElement().then(el => el.value).catch(() => '');
      
      const ticketEl = document.getElementById('eventTicketLink');
      const ticketLink = await ticketEl.getInputElement().then(el => el.value).catch(() => '');
      
      const systemEl = document.getElementById('eventSystemType');
      const systemType = await systemEl.getInputElement().then(el => el.value).catch(() => '');
      
      if (!title || !start || !end) {
        alert('Please fill in title, start date, and end date');
        return;
      }
      
      const metadata = {
        description: description || '',
        location: location || '',
        orderNumber: orderNumber || '',
        ticketLink: ticketLink || '',
        systemType: systemType || ''
      };
      
      console.log('Creating event...', {
        calendarUrl,
        title,
        start,
        end
      });
      
      const response = await fetch(`${API_BASE}/api/events/all-day`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calendarUrl: calendarUrl,
          summary: title,
          start: start,
          end: end,
          description: JSON.stringify(metadata),
          location: location,
          meta: {
            orderNumber: orderNumber || undefined,
            ticketLink: ticketLink || undefined,
            systemType: systemType || undefined
          }
        })
      });
      
      console.log('Create response status:', response.status);
      console.log('Create response ok:', response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to create event:', response.status, errorText);
        alert(`Failed to create event: ${response.status} - ${errorText.substring(0, 200)}`);
        return;
      }
      
      const responseData = await response.json();
      console.log('Create response data:', responseData);
      
      // Success - close modal
      await modal.dismiss();
      console.log('Event created successfully, waiting before reload...');
      
      // Wait 2 seconds for backend to finish saving to CalDAV
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('Calling window.location.reload()');
      window.location.reload();
      
    } catch (error) {
      console.error('Unexpected error creating event:', error);
      alert(`Unexpected error: ${error.message}`);
      
      // Make sure loading overlay is hidden
      const loadingOverlay = document.getElementById('loadingOverlay');
      if (loadingOverlay) loadingOverlay.classList.add('hidden');
    }
  });
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
  
  if (!modal || !modalTitle || !modalBody) return;
  
  const calendar = state.calendars.find(c => c.id === event.group);
  const calendarName = calendar?.content || calendar?.displayName || 'Unknown';
  
  modalTitle.textContent = event.content;
  
  // Format dates
  const startDate = parseLocalDate(event.start);
  const endDate = parseLocalDate(event.end);
  const formatDate = (date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  
  // Parse metadata if it exists
  let metadata = {};
  try {
    if (event.description) {
      const parsed = JSON.parse(event.description);
      if (typeof parsed === 'object' && parsed !== null) {
        metadata = parsed;
      }
    }
  } catch (e) {
    // Not JSON, treat as plain text description
  }
  
  const description = typeof metadata === 'object' && metadata !== null ? (metadata.description || '') : (event.description || '');
  const location = metadata.location || '';
  const orderNumber = metadata.orderNumber || '';
  const ticketLink = metadata.ticketLink || '';
  const systemType = metadata.systemType || '';
  
  modalBody.innerHTML = `
    <ion-list lines="full">
      <ion-item>
        <ion-label position="stacked">Title</ion-label>
        <ion-input id="eventTitle" value="${event.content}" placeholder="Event title"></ion-input>
      </ion-item>
      
      <ion-item>
        <ion-label position="stacked">Start Date</ion-label>
        <ion-input type="date" id="eventStart" value="${event.start}"></ion-input>
      </ion-item>
      
      <ion-item>
        <ion-label position="stacked">End Date</ion-label>
        <ion-input type="date" id="eventEnd" value="${event.end}"></ion-input>
      </ion-item>
      
      <ion-item>
        <ion-label position="stacked">Description</ion-label>
        <ion-textarea id="eventDescription" rows="3" placeholder="Description">${description}</ion-textarea>
      </ion-item>
      
      <ion-item>
        <ion-label position="stacked">Location</ion-label>
        <ion-input id="eventLocation" value="${location}" placeholder="Location"></ion-input>
      </ion-item>
      
      <ion-item>
        <ion-label position="stacked">Order Number</ion-label>
        <ion-input id="eventOrderNumber" value="${orderNumber}" placeholder="e.g., SO-12345"></ion-input>
      </ion-item>
      
      <ion-item>
        <ion-label position="stacked">Ticket Link</ion-label>
        <ion-input type="url" id="eventTicketLink" value="${ticketLink}" placeholder="https://..."></ion-input>
      </ion-item>
      
      <ion-item>
        <ion-label position="stacked">System Type</ion-label>
        <ion-input id="eventSystemType" value="${systemType}" placeholder="e.g., Laser Q-Switch"></ion-input>
      </ion-item>
      
      <ion-item>
        <ion-label position="stacked">Calendar</ion-label>
        <ion-select id="eventCalendar" value="${event.group}">
          ${state.calendars.map(cal => 
            `<ion-select-option value="${cal.id}">${cal.content || cal.displayName}</ion-select-option>`
          ).join('')}
        </ion-select>
      </ion-item>
    </ion-list>
  `;
  
  // Wait for Ionic components in innerHTML to be registered
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // Show modal (Ionic)
  await modal.present();
  
  // Wait for modal to be fully rendered
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Setup modal buttons
  const closeModal = document.getElementById('closeModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const saveEventBtn = document.getElementById('saveEventBtn');
  const deleteEventBtn = document.getElementById('deleteEventBtn');
  
  // Show delete button in edit mode
  if (deleteEventBtn) deleteEventBtn.style.display = '';
  
  const closeHandler = () => {
    modal.dismiss();
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
      const getResponse = await fetch(`${API_BASE}/api/events/${encodeURIComponent(eventUid)}`);
      console.log('GET response status:', getResponse.status);
      
      if (!getResponse.ok) {
        const errorText = await getResponse.text();
        console.error('Failed to fetch event before delete:', getResponse.status, errorText);
        alert(`Cannot find event: ${getResponse.status}`);
        return;
      }
      
      const eventData = await getResponse.json();
      console.log('Step 2: GET succeeded, fetched event:', eventData);
      
      // Now delete it
      console.log('Step 3: Attempting DELETE...');
      const response = await fetch(`${API_BASE}/api/events/${encodeURIComponent(eventUid)}`, {
        method: 'DELETE'
      });
      console.log('DELETE response status:', response.status);
      
      if (response.ok) {
        await modal.dismiss();
        console.log('Event deleted successfully, waiting before reload...');
        
        // Wait 2 seconds for backend to finish saving to CalDAV
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('Reloading page after delete...');
        window.location.reload();
      } else {
        const errorText = await response.text();
        console.error('Failed to delete event:', response.status, errorText);
        alert(`Failed to delete event: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error('Error deleting event:', error);
      alert(`Error deleting event: ${error.message}`);
    }
  });
  
  // Save event handler
  saveEventBtn?.addEventListener('click', async () => {
    console.log('Edit save button clicked!');
    try {
      // Get Ionic input values
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const titleEl = document.getElementById('eventTitle');
      const title = await titleEl.getInputElement().then(el => el.value);
      
      const calendarEl = document.getElementById('eventCalendar');
      const calendarId = calendarEl.value;
      
      const startEl = document.getElementById('eventStart');
      const start = await startEl.getInputElement().then(el => el.value);
      
      const endEl = document.getElementById('eventEnd');
      const end = await endEl.getInputElement().then(el => el.value);
      
      const descEl = document.getElementById('eventDescription');
      const description = descEl.value || '';
      
      const locEl = document.getElementById('eventLocation');
      const location = await locEl.getInputElement().then(el => el.value).catch(() => '');
      
      const orderEl = document.getElementById('eventOrderNumber');
      const orderNumber = await orderEl.getInputElement().then(el => el.value).catch(() => '');
      
      const ticketEl = document.getElementById('eventTicketLink');
      const ticketLink = await ticketEl.getInputElement().then(el => el.value).catch(() => '');
      
      const systemEl = document.getElementById('eventSystemType');
      const systemType = await systemEl.getInputElement().then(el => el.value).catch(() => '');
      
      if (!title || !start || !end) {
        alert('Please fill in title, start date, and end date');
        return;
      }
      
      // Build metadata object
      const metadata = {
        description: description || '',
        location: location || '',
        orderNumber: orderNumber || '',
        ticketLink: ticketLink || '',
        systemType: systemType || ''
      };
      
      // Use event.uid if available, otherwise extract from id and remove leading hyphen
      const eventUid = event.uid || event.id.split('/').pop().replace(/^-/, '');
      console.log('Updating event with UID:', eventUid, 'Original event.id:', event.id, 'event.uid:', event.uid);
      
      const response = await fetch(`${API_BASE}/api/events/${encodeURIComponent(eventUid)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: title,
          group: calendarId,
          start: start,
          end: end,
          description: JSON.stringify(metadata)
        })
      });
      
      if (response.ok) {
        // Update local state
        event.content = title;
        event.group = calendarId;
        event.start = start;
        event.end = end;
        event.description = JSON.stringify(metadata);
        
        await modal.dismiss();
        
        // Wait for backend to save
        await new Promise(resolve => setTimeout(resolve, 2000));
        window.location.reload();
      } else {
        const errorText = await response.text();
        console.error('Failed to update event:', response.status, errorText);
        alert(`Failed to update event: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error('Error updating event:', error);
      alert(`Error updating event: ${error.message}`);
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

// Render month vertical lines
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

// Render month headers
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

// Render week numbers
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

// Render day numbers
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

// Render events for a calendar
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
    
    html += `<div class="timeline-event" data-event-id="${event.id}" style="position: absolute; left: ${pos.left}px; width: ${pos.width}px; top: ${top}px; height: ${eventHeight}px; background: ${color}; color: white; border-radius: 3px; padding: 2px 4px; font-size: ${fontSize}px; line-height: 1.2; overflow: hidden; display: -webkit-box; -webkit-line-clamp: ${lineClamp}; -webkit-box-orient: vertical; box-shadow: 0 1px 2px rgba(0,0,0,0.2); cursor: pointer;">${event.content}</div>`;
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
  
  // Then check event type from className
  const match = event.className?.match(/event-type-(\w+)/i);
  const type = match ? match[1].toLowerCase() : null;
  
  const typeColors = {
    install: '#34c759',        // Green - installations
    installation: '#34c759',   // Green - installations
    training: '#ff9500',       // Orange - training
    maintenance: '#5856d6',    // Purple - maintenance
    vacation: '#ff3b30',       // Red - vacation
    sick: '#ff3b30',           // Red - sick leave
    support: '#007aff',        // Blue - support
    default: null              // Use calendar color for default
  };
  
  if (type && typeColors[type]) {
    return typeColors[type];
  }
  
  // Finally use calendar color
  if (calendar?.bg) {
    return calendar.bg;
  }
  
  // Default fallback
  return '#007aff';
}

// ============================================
// APP INITIALIZATION
// ============================================

/**
 * Wait for Ionic components to be ready before starting the app
 * Times out after 5 seconds if Ionic doesn't load
 */
async function waitForIonic() {
  if (window.ionicReady) {
    console.log('Ionic already ready');
    return Promise.resolve();
  }
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      console.warn('⚠️ Ionic loading timeout - continuing without Ionic');
      resolve(); // Continue anyway
    }, 5000);
    
    window.addEventListener('ionicReady', () => {
      clearTimeout(timeout);
      resolve();
    }, { once: true });
  });
}

// Start app after DOM and Ionic are ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded, waiting for Ionic...');
    await waitForIonic();
    console.log('Ionic ready, starting init...');
    init().catch(err => {
      console.error('Init failed:', err);
      const loadingOverlay = document.getElementById('loadingOverlay');
      if (loadingOverlay) loadingOverlay.classList.add('hidden');
    });
  });
} else {
  console.log('DOM already loaded, waiting for Ionic...');
  waitForIonic().then(() => {
    console.log('Ionic ready, starting init...');
    init().catch(err => {
      console.error('Init failed:', err);
      const loadingOverlay = document.getElementById('loadingOverlay');
      if (loadingOverlay) loadingOverlay.classList.add('hidden');
    });
  });
}
