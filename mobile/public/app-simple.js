/**
 * Simple Mobile Timeline - Clean Implementation
 * Version: 1760265400
 */

console.log('📱 Mobile Timeline v1760265400 loaded');

// Configuration
const API_BASE = window.location.hostname === 'localhost' 
  ? 'http://localhost:5175'
  : window.location.origin.replace(':5174', ':5175');

// State
const state = {
  calendars: [],
  events: [],
  holidays: [],
  dateRange: {
    from: new Date('2025-10-01'),
    to: new Date('2026-01-01')
  },
  zoom: 'month' // week, month, quarter
};

// Zoom settings: pixels per day
const ZOOM_SETTINGS = {
  week: 20,    // 20px per day = 140px per week
  month: 10,   // 10px per day = 300px per month
  quarter: 5   // 5px per day = 150px per month
};

// Initialize
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
  
  // Load data
  await loadData();
  
  // Render
  render();
}

// Load data from API
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
    state.events = evtData.items || [];
    
    // Use groups for calendar display names
    if (evtData.groups) {
      state.calendars = evtData.groups;
    }
    
    console.log(`Loaded: ${state.calendars.length} calendars, ${state.events.length} events`);
    
    // Fetch holidays for Berlin (optional, don't fail if it errors)
    try {
      const year = state.dateRange.from.getFullYear();
      const holidayRes = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/DE`);
      if (holidayRes.ok) {
        const allHolidays = await holidayRes.json();
        // Filter for Berlin-specific holidays (Germany + Berlin state holidays)
        state.holidays = allHolidays.filter(h => !h.counties || h.counties.includes('DE-BE'));
        console.log(`Loaded ${state.holidays.length} Berlin holidays`);
      }
    } catch (err) {
      console.warn('Could not load holidays:', err);
    }
    
  } catch (error) {
    console.error('Load error:', error);
    console.error('Error stack:', error.stack);
    
    // Show error on screen
    const container = document.getElementById('timelineContainer');
    container.innerHTML = `
      <div style="padding: 20px; color: red;">
        <h3>Error Loading Data</h3>
        <p>${error.message}</p>
        <button onclick="location.reload()">Retry</button>
      </div>
    `;
  }
}

// Render everything
function render() {
  const container = document.getElementById('timelineContainer');
  const pixelsPerDay = ZOOM_SETTINGS[state.zoom];
  
  // Calculate total days and width
  const totalDays = Math.ceil((state.dateRange.to - state.dateRange.from) / (1000 * 60 * 60 * 24));
  const totalWidth = totalDays * pixelsPerDay;
  
  console.log(`Rendering: ${totalDays} days, ${totalWidth}px wide, ${pixelsPerDay}px/day`);
  
  // Build HTML
  let html = '<div style="position: relative; display: flex; flex-direction: column; min-width: ' + totalWidth + 'px;">';
  
  // Weekend and holiday backgrounds
  html += '<div style="position: absolute; top: 65px; bottom: 0; left: 100px; pointer-events: none;">';
  html += renderWeekendAndHolidayBackgrounds(pixelsPerDay);
  html += '</div>';
  
  // Month vertical lines (background)
  html += '<div style="position: absolute; top: 0; bottom: 0; left: 100px; pointer-events: none;">';
  html += renderMonthLines(pixelsPerDay);
  html += '</div>';
  
  // Header row with months
  html += '<div style="display: flex; height: 40px; border-bottom: 1px solid #ddd; margin-left: 100px;">';
  html += renderMonthHeaders(pixelsPerDay);
  html += '</div>';
  
  // Day numbers row
  html += '<div style="display: flex; height: 25px; border-bottom: 2px solid #ccc; margin-left: 100px; background: #fafafa;">';
  html += renderDayNumbers(pixelsPerDay);
  html += '</div>';
  
  // Calendar lanes
  state.calendars.forEach(calendar => {
    html += '<div style="display: flex; height: 80px; border-bottom: 1px solid #eee;">';
    
    // Lane label
    html += `<div style="width: 100px; padding: 8px; font-size: 12px; font-weight: 600; border-right: 2px solid #ccc; flex-shrink: 0; background: white; z-index: 10; position: relative;">${calendar.content || calendar.displayName}</div>`;
    
    // Lane content
    html += '<div style="position: relative; flex: 1;">';
    html += renderEventsForCalendar(calendar.id, pixelsPerDay);
    html += '</div>';
    
    html += '</div>';
  });
  
  html += '</div>';
  
  container.innerHTML = html;
}

// Render weekend and holiday backgrounds
function renderWeekendAndHolidayBackgrounds(pixelsPerDay) {
  let html = '';
  const holidayDates = new Set(state.holidays.map(h => h.date));
  
  // Iterate through each day in the range
  let current = new Date(state.dateRange.from);
  let dayIndex = 0;
  
  while (current < state.dateRange.to) {
    const dayOfWeek = current.getDay(); // 0 = Sunday, 6 = Saturday
    const dateStr = current.toISOString().split('T')[0];
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = holidayDates.has(dateStr);
    
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
    
    // Add vertical line at the end of each month
    html += `<div style="position: absolute; left: ${position + width}px; top: 0; bottom: 0; width: 2px; background: #999;"></div>`;
    
    position += width;
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

// Render day numbers
function renderDayNumbers(pixelsPerDay) {
  let html = '';
  let current = new Date(state.dateRange.from);
  
  while (current < state.dateRange.to) {
    const dayNum = current.getDate();
    const dayOfWeek = current.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const color = isWeekend ? '#999' : '#666';
    const fontWeight = dayNum === 1 ? '600' : '400';
    
    html += `<div style="width: ${pixelsPerDay}px; font-size: 9px; color: ${color}; text-align: center; padding-top: 4px; font-weight: ${fontWeight};">${dayNum}</div>`;
    
    current.setDate(current.getDate() + 1);
  }
  
  return html;
}

// Render events for a calendar
function renderEventsForCalendar(calendarId, pixelsPerDay) {
  const events = state.events.filter(e => e.group === calendarId);
  let html = '';
  
  events.forEach(event => {
    const pos = calculateEventPosition(event, pixelsPerDay);
    const color = getEventColor(event);
    
    html += `<div style="position: absolute; left: ${pos.left}px; width: ${pos.width}px; top: 10px; height: 30px; background: ${color}; color: white; border-radius: 4px; padding: 4px 8px; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; box-shadow: 0 1px 3px rgba(0,0,0,0.2);">${event.content}</div>`;
  });
  
  return html;
}

// Parse date string as local date (not UTC)
function parseLocalDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Calculate event position
function calculateEventPosition(event, pixelsPerDay) {
  // Parse as local dates to avoid timezone issues
  const eventStart = parseLocalDate(event.start);
  const eventEnd = parseLocalDate(event.end);
  const rangeStart = new Date(state.dateRange.from);
  rangeStart.setHours(0, 0, 0, 0);
  
  // Calculate days from start (should be whole days)
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysFromStart = Math.round((eventStart - rangeStart) / msPerDay);
  const duration = Math.round((eventEnd - eventStart) / msPerDay);
  
  return {
    left: daysFromStart * pixelsPerDay,
    width: Math.max(duration * pixelsPerDay, 30)
  };
}

// Get event color
function getEventColor(event) {
  const match = event.className?.match(/event-type-(\w+)/);
  const type = match ? match[1] : 'default';
  
  const colors = {
    installation: '#34c759',
    training: '#ff9500',
    maintenance: '#5856d6',
    vacation: '#ff3b30',
    default: '#007aff'
  };
  
  return colors[type] || colors.default;
}

// Start
init();
