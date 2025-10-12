/**
 * Simple Mobile Timeline - Clean Implementation
 * Version: 1760265400
 */

console.log('📱 Mobile Timeline v1760269700 loaded');

// Configuration
const API_BASE = window.location.hostname === 'localhost' 
  ? 'http://localhost:5175'
  : window.location.origin.replace(':5174', ':5175');

// Calculate date range: 6 months from today
function getDefaultDateRange() {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth(), 1); // Start of current month
  const to = new Date(today.getFullYear(), today.getMonth() + 6, 1); // 6 months ahead
  return { from, to };
}

// State
const state = {
  calendars: [],
  events: [],
  holidays: [],
  dateRange: getDefaultDateRange(),
  zoom: 'month', // week, month, quarter
  searchQuery: '' // search filter
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
  
  // Load data
  await loadData();
  
  // Hide loading overlay
  if (loadingOverlay) loadingOverlay.classList.add('hidden');
  
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
    html += '<div style="display: flex; height: 50px; border-bottom: 1px solid #eee;">';
    
    const bgColor = calendar.bg || '#f5f5f5';
    const textColor = getContrastColor(bgColor);
    const name = calendar.content || calendar.displayName;
    const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    
    // Full name label (visible at start, scrolls away)
    html += `<div style="width: 100px; padding: 8px; font-size: 12px; font-weight: 600; border-right: 2px solid #ccc; flex-shrink: 0; background: ${bgColor}; color: ${textColor}; display: flex; align-items: center; z-index: 20;">${name}</div>`;
    
    // Lane indicator - narrow colored bar (sticky, appears when scrolling)
    html += `<div style="width: 30px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; border-right: 2px solid #ccc; flex-shrink: 0; background: ${bgColor}; color: ${textColor}; z-index: 10; position: sticky; left: 0; margin-left: -30px;">${initials}</div>`;
    
    // Lane content (with overflow hidden to prevent events from piercing through)
    html += '<div style="position: relative; flex: 1; overflow: hidden;">';
    html += renderEventsForCalendar(calendar.id, pixelsPerDay);
    html += '</div>';
    
    html += '</div>';
  });
  
  // Close calendar lanes container
  html += '</div>';
  
  // Close main timeline container
  html += '</div>';
  
  container.innerHTML = html;
}

// Render weekend and holiday backgrounds
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

// Get ISO week number
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
    
    html += `<div style="position: absolute; left: ${pos.left}px; width: ${pos.width}px; top: ${top}px; height: ${eventHeight}px; background: ${color}; color: white; border-radius: 3px; padding: 2px 4px; font-size: ${fontSize}px; line-height: 1.2; overflow: hidden; display: -webkit-box; -webkit-line-clamp: ${lineClamp}; -webkit-box-orient: vertical; box-shadow: 0 1px 2px rgba(0,0,0,0.2);">${event.content}</div>`;
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
  let duration = Math.round((eventEnd - eventStart) / msPerDay);
  
  // For all-day events, the end date is exclusive in the API
  // but we want to display it inclusively (e.g., Oct 20-24 should show 5 days, not 4)
  // Add 1 day to make the visual representation inclusive
  if (duration > 0) {
    duration += 1;
  }
  
  return {
    left: daysFromStart * pixelsPerDay,
    width: Math.max(duration * pixelsPerDay, 30)
  };
}

// Get contrast color (white or black) based on background
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
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

// Get event color
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

// Start
init();
