/**
 * Mobile SupportPlanner Application
 * Horizontal timeline view optimized for mobile devices
 */

// Configuration
// When running in Docker, containers communicate via service names
// When accessing from browser, use localhost
const API_BASE = window.location.hostname === 'localhost' 
  ? 'http://localhost:5175'  // Accessing from host machine
  : window.location.protocol + '//' + window.location.hostname.replace('mobile-planner', 'support-planner') + ':5175';

// State
const state = {
  calendars: [],
  events: [],
  filteredEvents: [],
  activeFilters: {
    eventTypes: new Set(),
    calendars: new Set()
  },
  zoomLevel: 'month', // 'week', 'month', 'quarter'
  dateRange: {
    from: null,
    to: null
  }
};

// DOM Elements
const elements = {
  timelineContainer: document.getElementById('timelineContainer'),
  timeGrid: document.getElementById('timeGrid'),
  calendarLanes: document.getElementById('calendarLanes'),
  todayMarker: document.getElementById('todayMarker'),
  loadingState: document.getElementById('loadingState'),
  dateRangeText: document.getElementById('dateRangeText'),
  searchOverlay: document.getElementById('searchOverlay'),
  searchInput: document.getElementById('searchInput'),
  filterPanel: document.getElementById('filterPanel'),
  eventModal: document.getElementById('eventModal'),
  modalBody: document.getElementById('modalBody'),
  modalTitle: document.getElementById('modalTitle'),
  legend: document.getElementById('legend'),
  statusBar: document.getElementById('statusBar')
};

// Initialize app
async function init() {
  setupEventListeners();
  setInitialDateRange();
  await loadData();
  renderTimeline();
  scrollToToday();
}

// Setup event listeners
function setupEventListeners() {
  // Search
  document.getElementById('searchBtn').addEventListener('click', () => {
    elements.searchOverlay.classList.add('active');
    elements.searchInput.focus();
  });
  
  document.getElementById('closeSearch').addEventListener('click', () => {
    elements.searchOverlay.classList.remove('active');
  });
  
  elements.searchInput.addEventListener('input', handleSearch);
  
  // Filter
  document.getElementById('filterBtn').addEventListener('click', () => {
    elements.filterPanel.classList.add('active');
  });
  
  document.getElementById('closeFilter').addEventListener('click', () => {
    elements.filterPanel.classList.remove('active');
  });
  
  // Refresh
  document.getElementById('refreshBtn').addEventListener('click', async () => {
    showStatus('Refreshing...');
    await loadData();
    renderTimeline();
    showStatus('Updated!');
  });
  
  // Date range navigation
  document.getElementById('prevRange').addEventListener('click', () => {
    adjustDateRange(-1);
  });
  
  document.getElementById('nextRange').addEventListener('click', () => {
    adjustDateRange(1);
  });
  
  // Zoom controls
  document.querySelectorAll('.zoom-controls .control-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const zoom = this.dataset.zoom;
      setZoomLevel(zoom);
    });
  });
  
  // Today button
  document.getElementById('todayBtn').addEventListener('click', () => {
    scrollToToday();
  });
  
  // Modal
  document.getElementById('closeModal').addEventListener('click', closeEventModal);
  document.getElementById('closeModalBtn').addEventListener('click', closeEventModal);
  
  // Close modal on backdrop click
  elements.eventModal.addEventListener('click', (e) => {
    if (e.target === elements.eventModal) {
      closeEventModal();
    }
  });
}

// Set initial date range (3 months from now)
function setInitialDateRange() {
  const today = new Date();
  const from = new Date(today);
  from.setDate(1); // Start of current month
  
  const to = new Date(from);
  to.setMonth(to.getMonth() + 3); // 3 months ahead
  
  state.dateRange = { from, to };
  updateDateRangeText();
}

// Adjust date range
function adjustDateRange(direction) {
  const months = state.zoomLevel === 'week' ? 1 : state.zoomLevel === 'month' ? 3 : 6;
  
  state.dateRange.from.setMonth(state.dateRange.from.getMonth() + (direction * months));
  state.dateRange.to.setMonth(state.dateRange.to.getMonth() + (direction * months));
  
  updateDateRangeText();
  loadData();
  renderTimeline();
}

// Update date range text
function updateDateRangeText() {
  const options = { month: 'short', year: 'numeric' };
  const fromStr = state.dateRange.from.toLocaleDateString('en-US', options);
  const toStr = state.dateRange.to.toLocaleDateString('en-US', options);
  elements.dateRangeText.textContent = `${fromStr} - ${toStr}`;
}

// Load data from API
async function loadData() {
  try {
    elements.loadingState.style.display = 'block';
    
    console.log('Loading data from:', API_BASE);
    
    // Fetch calendars
    const calendarsUrl = `${API_BASE}/api/calendars`;
    console.log('Fetching calendars from:', calendarsUrl);
    const calendarsRes = await fetch(calendarsUrl);
    console.log('Calendars response:', calendarsRes.status, calendarsRes.statusText);
    
    if (!calendarsRes.ok) {
      throw new Error(`Failed to fetch calendars: ${calendarsRes.status} ${calendarsRes.statusText}`);
    }
    
    const calendarsData = await calendarsRes.json();
    state.calendars = calendarsData.calendars || [];
    console.log('Loaded calendars:', state.calendars.length);
    
    // Fetch events
    const fromStr = state.dateRange.from.toISOString().split('T')[0];
    const toStr = state.dateRange.to.toISOString().split('T')[0];
    
    // Get all calendar URLs
    const calendarUrls = state.calendars.map(cal => cal.url);
    console.log('Calendar URLs:', calendarUrls);
    
    if (calendarUrls.length === 0) {
      console.warn('No calendars available, skipping events fetch');
      state.events = [];
      state.filteredEvents = [];
      renderFilters();
      renderLegend();
      return;
    }
    
    const eventsUrl = `${API_BASE}/api/events`;
    console.log('Fetching events from:', eventsUrl);
    const eventsRes = await fetch(eventsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ calendarUrls, from: fromStr, to: toStr })
    });
    console.log('Events response:', eventsRes.status, eventsRes.statusText);
    
    if (!eventsRes.ok) {
      const errorText = await eventsRes.text();
      throw new Error(`Failed to fetch events: ${eventsRes.status} ${eventsRes.statusText} - ${errorText}`);
    }
    
    const eventsData = await eventsRes.json();
    // The API returns { groups, items } where items are the events
    state.events = eventsData.items || [];
    state.filteredEvents = state.events;
    console.log('Loaded events:', state.events.length);
    
    renderFilters();
    renderLegend();
    
  } catch (error) {
    console.error('Error loading data:', error);
    showStatus(`Error: ${error.message}`);
  } finally {
    elements.loadingState.style.display = 'none';
  }
}

// Render filters
function renderFilters() {
  // Event types - extract from className (format: event-type-{type})
  const eventTypes = [...new Set(state.events.map(e => {
    const match = e.className?.match(/event-type-(\w+)/);
    return match ? match[1] : 'default';
  }))];
  const eventTypeFilters = document.getElementById('eventTypeFilters');
  eventTypeFilters.innerHTML = eventTypes.map(type => `
    <div class="filter-chip" data-type="${type}">
      ${type.charAt(0).toUpperCase() + type.slice(1)}
    </div>
  `).join('');
  
  eventTypeFilters.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', function() {
      const type = this.dataset.type;
      if (state.activeFilters.eventTypes.has(type)) {
        state.activeFilters.eventTypes.delete(type);
        this.classList.remove('active');
      } else {
        state.activeFilters.eventTypes.add(type);
        this.classList.add('active');
      }
      applyFilters();
    });
  });
  
  // Calendars
  const calendarFilters = document.getElementById('calendarFilters');
  calendarFilters.innerHTML = state.calendars.map(cal => `
    <label class="filter-item">
      <input type="checkbox" data-calendar="${cal.content || cal.displayName}" />
      <span>${cal.content || cal.displayName}</span>
    </label>
  `).join('');
  
  calendarFilters.querySelectorAll('input').forEach(checkbox => {
    checkbox.addEventListener('change', function() {
      const calendar = this.dataset.calendar;
      if (this.checked) {
        state.activeFilters.calendars.add(calendar);
      } else {
        state.activeFilters.calendars.delete(calendar);
      }
      applyFilters();
    });
  });
}

// Apply filters
function applyFilters() {
  state.filteredEvents = state.events.filter(event => {
    // Event type filter
    if (state.activeFilters.eventTypes.size > 0) {
      const match = event.className?.match(/event-type-(\w+)/);
      const eventType = match ? match[1] : 'default';
      if (!state.activeFilters.eventTypes.has(eventType)) {
        return false;
      }
    }
    
    // Calendar filter
    if (state.activeFilters.calendars.size > 0) {
      const calendar = state.calendars.find(cal => cal.id === event.group);
      const calendarName = calendar?.content || calendar?.displayName;
      if (!state.activeFilters.calendars.has(calendarName)) {
        return false;
      }
    }
    
    return true;
  });
  
  renderTimeline();
}

// Handle search
function handleSearch(e) {
  const query = e.target.value.toLowerCase();
  
  if (!query) {
    state.filteredEvents = state.events;
  } else {
    state.filteredEvents = state.events.filter(event => {
      return (
        event.content?.toLowerCase().includes(query) ||
        event.title?.toLowerCase().includes(query) ||
        event.location?.toLowerCase().includes(query) ||
        event.description?.toLowerCase().includes(query)
      );
    });
  }
  
  renderTimeline();
}

// Set zoom level
function setZoomLevel(zoom) {
  state.zoomLevel = zoom;
  
  // Update active button
  document.querySelectorAll('.zoom-controls .control-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.zoom === zoom);
  });
  
  // Adjust month column widths
  const widths = { week: 600, month: 300, quarter: 150 };
  document.querySelectorAll('.month-column').forEach(col => {
    col.style.minWidth = `${widths[zoom]}px`;
  });
}

// Render timeline
function renderTimeline() {
  renderTimeGrid();
  renderCalendarLanes();
  positionTodayMarker();
}

// Render time grid
function renderTimeGrid() {
  const months = getMonthsInRange(state.dateRange.from, state.dateRange.to);
  
  elements.timeGrid.innerHTML = months.map(month => {
    const weeks = getWeeksInMonth(month);
    return `
      <div class="month-column">
        <div class="month-header">${month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
        <div class="week-markers">
          ${weeks.map(week => `
            <div class="week-marker">
              <span class="week-label">W${getWeekNumber(week)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
}

// Render calendar lanes
function renderCalendarLanes() {
  // Group events by calendar (using group ID)
  const eventsByCalendar = {};
  state.filteredEvents.forEach(event => {
    const groupId = event.group;
    const calendar = state.calendars.find(cal => cal.id === groupId);
    const calendarName = calendar?.content || calendar?.displayName || 'Unknown';
    if (!eventsByCalendar[calendarName]) {
      eventsByCalendar[calendarName] = [];
    }
    eventsByCalendar[calendarName].push(event);
  });
  
  // Render lanes
  elements.calendarLanes.innerHTML = Object.entries(eventsByCalendar).map(([calendar, events]) => {
    return `
      <div class="calendar-lane">
        <div class="lane-header">${calendar}</div>
        <div class="lane-content">
          ${renderEventsForLane(events)}
        </div>
      </div>
    `;
  }).join('');
  
  // Add event listeners to event bars
  document.querySelectorAll('.event-bar').forEach(bar => {
    bar.addEventListener('click', function() {
      const eventId = this.dataset.eventId;
      const event = state.events.find(e => e.id === eventId);
      if (event) {
        showEventModal(event);
      }
    });
  });
}

// Render events for a lane
function renderEventsForLane(events) {
  return events.map(event => {
    const { left, width } = calculateEventPosition(event);
    const match = event.className?.match(/event-type-(\w+)/);
    const eventType = match ? match[1] : 'default';
    const top = Math.random() * 40; // Simple vertical positioning (can be improved)
    
    return `
      <div class="event-bar type-${eventType}" 
           style="left: ${left}px; width: ${width}px; top: ${top}px;"
           data-event-id="${event.id}">
        ${event.content || event.title}
      </div>
    `;
  }).join('');
}

// Calculate event position
function calculateEventPosition(event) {
  const startDate = new Date(event.start);
  const endDate = new Date(event.end);
  
  const rangeStart = state.dateRange.from.getTime();
  const rangeEnd = state.dateRange.to.getTime();
  const totalDuration = rangeEnd - rangeStart;
  
  const eventStart = startDate.getTime();
  const eventEnd = endDate.getTime();
  
  const widths = { week: 600, month: 300, quarter: 150 };
  const monthWidth = widths[state.zoomLevel];
  
  const totalMonths = (state.dateRange.to.getFullYear() - state.dateRange.from.getFullYear()) * 12 
    + (state.dateRange.to.getMonth() - state.dateRange.from.getMonth());
  const totalWidth = totalMonths * monthWidth;
  
  const left = ((eventStart - rangeStart) / totalDuration) * totalWidth;
  const width = Math.max(((eventEnd - eventStart) / totalDuration) * totalWidth, 30);
  
  return { left, width };
}

// Position today marker
function positionTodayMarker() {
  const today = new Date();
  const rangeStart = state.dateRange.from.getTime();
  const rangeEnd = state.dateRange.to.getTime();
  
  if (today >= state.dateRange.from && today <= state.dateRange.to) {
    const widths = { week: 600, month: 300, quarter: 150 };
    const monthWidth = widths[state.zoomLevel];
    
    const totalMonths = (state.dateRange.to.getFullYear() - state.dateRange.from.getFullYear()) * 12 
      + (state.dateRange.to.getMonth() - state.dateRange.from.getMonth());
    const totalWidth = totalMonths * monthWidth;
    
    const left = ((today.getTime() - rangeStart) / (rangeEnd - rangeStart)) * totalWidth + 100;
    
    elements.todayMarker.style.left = `${left}px`;
    elements.todayMarker.style.display = 'block';
  } else {
    elements.todayMarker.style.display = 'none';
  }
}

// Scroll to today
function scrollToToday() {
  const todayMarker = elements.todayMarker;
  if (todayMarker.style.display !== 'none') {
    const markerLeft = parseInt(todayMarker.style.left);
    elements.timelineContainer.scrollTo({
      left: markerLeft - 50,
      behavior: 'smooth'
    });
  }
}

// Show event modal
function showEventModal(event) {
  elements.modalTitle.textContent = event.content || event.title;
  
  const startDate = new Date(event.start).toLocaleDateString('en-US', { 
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' 
  });
  const endDate = new Date(event.end).toLocaleDateString('en-US', { 
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' 
  });
  
  const calendar = state.calendars.find(cal => cal.id === event.group);
  const calendarName = calendar?.content || calendar?.displayName || 'Unknown';
  
  elements.modalBody.innerHTML = `
    <div class="event-detail-row">
      <div class="event-detail-label">Calendar</div>
      <div class="event-detail-value">${calendarName}</div>
    </div>
    <div class="event-detail-row">
      <div class="event-detail-label">Start Date</div>
      <div class="event-detail-value">${startDate}</div>
    </div>
    <div class="event-detail-row">
      <div class="event-detail-label">End Date</div>
      <div class="event-detail-value">${endDate}</div>
    </div>
    ${event.location ? `
      <div class="event-detail-row">
        <div class="event-detail-label">Location</div>
        <div class="event-detail-value">${event.location}</div>
      </div>
    ` : ''}
    ${event.description ? `
      <div class="event-detail-row">
        <div class="event-detail-label">Description</div>
        <div class="event-detail-value">${event.description}</div>
      </div>
    ` : ''}
    ${event.meta?.orderNumber ? `
      <div class="event-detail-row">
        <div class="event-detail-label">Order Number</div>
        <div class="event-detail-value">${event.meta.orderNumber}</div>
      </div>
    ` : ''}
    ${event.meta?.ticketLink ? `
      <div class="event-detail-row">
        <div class="event-detail-label">Ticket Link</div>
        <div class="event-detail-value"><a href="${event.meta.ticketLink}" target="_blank">${event.meta.ticketLink}</a></div>
      </div>
    ` : ''}
  `;
  
  elements.eventModal.classList.add('active');
}

// Close event modal
function closeEventModal() {
  elements.eventModal.classList.remove('active');
}

// Show status message
function showStatus(message) {
  elements.statusBar.textContent = message;
  elements.statusBar.classList.add('active');
  setTimeout(() => {
    elements.statusBar.classList.remove('active');
  }, 2000);
}

// Render legend
function renderLegend() {
  const eventTypes = [...new Set(state.events.map(e => {
    const match = e.className?.match(/event-type-(\w+)/);
    return match ? match[1] : 'default';
  }))];
  const colors = {
    installation: 'var(--success-color)',
    training: 'var(--warning-color)',
    maintenance: 'var(--purple-color)',
    vacation: 'var(--danger-color)',
    default: 'var(--primary-color)'
  };
  
  elements.legend.innerHTML = eventTypes.map(type => `
    <div class="legend-item">
      <div class="legend-color" style="background: ${colors[type] || colors.default};"></div>
      <span>${type.charAt(0).toUpperCase() + type.slice(1)}</span>
    </div>
  `).join('');
}

// Utility: Get months in range
function getMonthsInRange(from, to) {
  const months = [];
  const current = new Date(from);
  current.setDate(1);
  
  while (current <= to) {
    months.push(new Date(current));
    current.setMonth(current.getMonth() + 1);
  }
  
  return months;
}

// Utility: Get weeks in month
function getWeeksInMonth(month) {
  const weeks = [];
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  
  let current = new Date(firstDay);
  while (current <= lastDay) {
    weeks.push(new Date(current));
    current.setDate(current.getDate() + 7);
  }
  
  return weeks;
}

// Utility: Get week number
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Start the app
init();
