import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { calendarCache } from './services/calendarCache.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load event types configuration
const BASE_EVENT_TYPES = {
  _default: {
    color: '#e0e0e0',  // Light gray
    borderColor: '#bdbdbd',
    textColor: '#000000'
  },
  vacation: {
    color: '#a5d6a7',  // Light green
    borderColor: '#81c784',
    textColor: '#000000',
    patterns: ['vacation', 'holiday', 'urlaub', 'ferien']
  },
  support: {
    color: '#ffcdd2',  // Light red
    borderColor: '#ef9a9a',
    textColor: '#000000',
    patterns: ['support', 'on-call', 'on call', 'standby']
  },
  meeting: {
    color: '#bbdefb',  // Light blue
    borderColor: '#90caf9',
    textColor: '#000000',
    patterns: ['meeting', 'conference', 'call', 'standup']
  },
  dr: {
    color: '#e1bee7',  // Light purple
    borderColor: '#ce93d8',
    textColor: '#000000',
    patterns: ['dr', 'disaster recovery', 'disaster-recovery']
  },
  sick: {
    color: '#ffcc80',  // Light orange
    borderColor: '#ffb74d',
    textColor: '#000000',
    patterns: ['sick', 'krank', 'illness']
  },
  training: {
    color: '#b2dfdb',  // Light teal
    borderColor: '#80cbc4',
    textColor: '#000000',
    patterns: ['training', 'workshop', 'seminar']
  },
  business: {
    color: '#cfd8dc',  // Light blue-gray
    borderColor: '#b0bec5',
    textColor: '#000000',
    patterns: ['business', 'travel', 'dienstreise']
  }
};
let eventTypes = { ...BASE_EVENT_TYPES };

function loadEventTypesConfig() {
  try {
    const p = path.join(__dirname, 'event-types.json');
    const raw = fs.readFileSync(p, 'utf8');
    const cfg = JSON.parse(raw);
    // Rebuild from immutable base defaults on each load
    eventTypes = { ...BASE_EVENT_TYPES, ...(cfg && cfg.eventTypes ? cfg.eventTypes : {}) };
    console.log('Loaded event types configuration');
  } catch (err) {
    console.error('Failed to load event-types.json, using default colors', err.message);
  }
}

// Initial load at startup
loadEventTypesConfig();

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Initialize calendar cache
const { NEXTCLOUD_URL, NEXTCLOUD_USERNAME, NEXTCLOUD_PASSWORD, PORT = 5173 } = process.env;

// Initialize the calendar cache
calendarCache.initialize(NEXTCLOUD_URL, NEXTCLOUD_USERNAME, NEXTCLOUD_PASSWORD)
  .then(() => console.log('Calendar cache initialized successfully'))
  .catch(err => console.error('Failed to initialize calendar cache:', err));

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  calendarCache.stop();
  process.exit(0);
});

// Create a new all-day event (inclusive start/end dates)
app.post('/api/events/all-day', async (req, res) => {
  try {
    const { calendarUrl, summary, description, location, start, end, meta } = req.body || {};
    if (!calendarUrl || !summary || !start || !end) {
      return res.status(400).json({
        success: false,
        error: 'calendarUrl, summary, start, and end are required'
      });
    }

    const result = await calendarCache.createAllDayEvent({
      calendarUrl,
      summary,
      description: description || '',
      location: location || '',
      start,
      end,
      meta
    });

    // Kick off a background refresh so subsequent reads include the new event
    calendarCache.refreshAllCalendars().catch(err => {
      console.error('Background refresh after create failed:', err);
    });

    res.json({ success: true, event: result });
  } catch (error) {
    console.error('Error creating all-day event:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to create event' });
  }
});

// Delete an event by UID
app.delete('/api/events/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    if (!uid) {
      return res.status(400).json({ success: false, error: 'Event UID is required' });
    }

    const deleted = await calendarCache.deleteEvent(uid);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Event not found or could not be deleted' });
    }

    // Success
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to delete event' });
  }
});

// API endpoint to get all available calendars
app.get('/api/calendars', async (req, res) => {
  try {
    const calendars = calendarCache.getAllCalendars();
    res.json({
      calendars,
      _cachedAt: new Date().toISOString(),
      _cacheStatus: calendarCache.getStatus()
    });
  } catch (err) {
    console.error('Error fetching calendars:', err);
    res.status(500).json({ 
      error: err.message || 'Failed to fetch calendars',
      cacheStatus: calendarCache.getStatus()
    });
  }
});

// API endpoint to// Search for events by summary
app.get('/api/events/search', async (req, res) => {
  try {
    const { summary, from, to } = req.query;
    
    if (!summary) {
      return res.status(400).json({ error: 'Summary parameter is required' });
    }
    
    // Default to a wide date range if not specified
    const startDate = from || '2020-01-01';
    const endDate = to || '2030-12-31';
    
    // Get all events in the date range
    const events = await calendarCache.getEvents([], startDate, endDate);
    
    // Filter events by summary (case insensitive)
    const matchingEvents = events.events.filter(event => 
      event.summary && event.summary.toLowerCase().includes(summary.toLowerCase())
    );
    
    res.json({
      success: true,
      count: matchingEvents.length,
      events: matchingEvents
    });
    
  } catch (error) {
    console.error('Error searching events:', error);
    res.status(500).json({ 
      error: 'Failed to search events',
      details: error.message 
    });
  }
});

// API endpoint to get events for selected calendars
app.post('/api/events', async (req, res) => {
  try {
    // Hot-reload event types so edits in event-types.json are reflected without restart
    loadEventTypesConfig();
    const { calendarUrls, from, to } = req.body || {};
    console.log('[events] request', { from, to, count: Array.isArray(calendarUrls) ? calendarUrls.length : 0 });
    
    if (!Array.isArray(calendarUrls) || calendarUrls.length === 0) {
      return res.status(400).json({ error: 'calendarUrls must be a non-empty array' });
    }

    // Validate date range (max 6 months)
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const sixMonthsFromNow = new Date();
    sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
    
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return res.status(400).json({ 
        error: 'Invalid date range',
        details: `From: ${from}, To: ${to}`
      });
    }
    
    // Ensure the date range is not too large
    const maxDays = 180; // 6 months
    const diffTime = Math.abs(toDate - fromDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > maxDays) {
      return res.status(400).json({ 
        error: `Date range too large. Maximum ${maxDays} days allowed.`,
        details: `Requested range: ${diffDays} days`
      });
    }

    // Get events from cache
    const { calendars: groups, events: cachedEvents } = calendarCache.getEvents(calendarUrls, from, to);
    
    if (!cachedEvents || cachedEvents.length === 0) {
      return res.json({ 
        groups: [],
        items: [],
        _metadata: {
          from,
          to,
          calendarCount: 0,
          eventCount: 0,
          occurrenceCount: 0,
          isEmpty: true,
          source: 'cache',
          cacheStatus: calendarCache.getStatus()
        }
      });
    }

    // Format events for the frontend
    const items = [];
    const groupMap = new Map();
    
    // First, create a map of calendar URLs to group IDs
    groups.forEach((g, index) => {
      groupMap.set(g.url, `cal-${index + 1}`);
    });
    
    // Then process each event
    cachedEvents.forEach(event => {
      try {
        const eventType = getEventType(event.summary || '');
        const isRecurring = event.type === 'occurrence';
        const eventId = isRecurring 
          ? `${event.calendar}-${event.uid}-${event.start}`
          : `${event.calendar}-${event.uid}`;
        
        const groupId = groupMap.get(event.calendar);
        if (!groupId) {
          console.warn(`No group found for calendar URL: ${event.calendar}`);
          return;
        }
        
        // Get the event type configuration
        const typeConfig = eventTypes[eventType] || eventTypes._default;
        
        // Debug log to check event data
        if (event.description) {
          console.log(`Event ${event.summary} has description:`, event.description);
        }

        // Helper function to escape HTML
        const escapeHtml = (unsafe) => {
          if (!unsafe) return '';
          return unsafe
            .toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
        };

        // Format the date and time
        const formatDate = (dateString) => {
          if (!dateString) return '';
          const date = new Date(dateString);
          return date.toLocaleString(undefined, { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
        };

        // Format the time only
        const formatTime = (dateString) => {
          if (!dateString) return '';
          return new Date(dateString).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        };

        // Create tooltip content
        const tooltipContent = [];
        
        // Add title
        tooltipContent.push(`<div style="font-weight: bold; margin-bottom: 8px; font-size: 1.1em;">${escapeHtml(event.summary || 'No title')}</div>`);
        
        // Add date and time
        if (event.start && event.end) {
          tooltipContent.push(`
            <div style="margin-bottom: 8px;">
              <div>📅 ${formatDate(event.start)}</div>
              <div>⏱️ ${formatTime(event.start)} - ${formatTime(event.end)}</div>
            </div>
          `);
        }
        
        // Add location if available
        if (event.location) {
          tooltipContent.push(`<div style="margin-bottom: 8px;">📍 ${escapeHtml(event.location)}</div>`);
        }
        
        // Add description if available
        if (event.description) {
          const description = escapeHtml(event.description)
            .replace(/\n/g, '<br>');
          tooltipContent.push(`
            <div style="margin-top: 8px; padding: 8px; background: #f8f9fa; border-radius: 4px; max-width: 300px; max-height: 200px; overflow: auto;">
              ${description}
            </div>
          `);
        }
        
        const eventDetails = tooltipContent.join('');

        // Create the item in vis-timeline format
        const item = {
          id: eventId,
          group: groupId,
          content: event.summary || 'No title',
          start: event.start,
          end: event.end,
          className: `event-type-${eventType}${isRecurring ? ' recurring' : ''}`,
          title: event.summary || 'No title', // Simple title for the native tooltip
          description: event.description || '', // Plain text description (YAML removed)
          descriptionRaw: event.descriptionRaw || event.description || '', // Full description as stored in CalDAV
          meta: event.meta || null,
          location: event.location || '', // Store location separately
          // Store all the data we need for the custom tooltip
          dataAttributes: {
            'data-summary': event.summary || 'No title',
            'data-start': event.start,
            'data-end': event.end,
            'data-location': event.location || '',
            'data-description': event.description || '',
            'data-meta': event.meta ? JSON.stringify(event.meta) : ''
          },
          type: 'range',
          style: [
            `background-color: ${typeConfig.color};`,
            `border-color: ${typeConfig.borderColor || typeConfig.color};`,
            'color: #000000;',  // Black text for better readability
            'border-width: 1px;',
            'border-style: solid;',
            'border-radius: 4px;',
            'font-weight: 500;',
            'padding: 2px 6px;',
            'box-sizing: border-box;',
            'font-size: 12px;',
            'line-height: 1.4;',
            'overflow: hidden;',
            'text-overflow: ellipsis;',
            'white-space: nowrap;',
            'text-align: left;',
            'letter-spacing: 0.3px;',
            'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;',
            isRecurring ? 'background-image: repeating-linear-gradient(-45deg, rgba(0,0,0,0.1), rgba(0,0,0,0.1) 5px, transparent 5px, transparent 10px);' : ''
          ].filter(Boolean).join(' '),
          ...(isRecurring && {
            isRecurring: true,
            recurringEventId: event.uid
          })
        };
        
        items.push(item);
      } catch (error) {
        console.error('Error formatting event:', error, event);
      }
    });

    const eventCount = items.filter(i => i.type === 'event').length;
    const occurrenceCount = items.filter(i => i.type === 'occurrence').length;

    // Deterministic palette for calendar group backgrounds (more saturated)
    const CAL_GROUP_COLORS = ['#3b82f6','#f97316','#22c55e','#ef4444','#a855f7','#14b8a6','#eab308','#fb7185','#06b6d4','#84cc16'];
    const pickGroupColor = (_url, idx) => CAL_GROUP_COLORS[idx % CAL_GROUP_COLORS.length];

    // Format groups for vis-timeline
    const formattedGroups = groups.map((g, i) => {
      const groupId = `cal-${i + 1}`;
      const bg = pickGroupColor(g.url, i);
      return {
        id: groupId,
        content: g.content,
        title: g.content,
        // Inline style so vis applies it directly to the label element
        style: `background-color: ${bg};`,
        // Unique class for targeting from the client
        className: `calendar-group-cal-${i + 1}`,
        // Expose background color for client features (e.g., map pin colors)
        bg,
        // Add any additional group properties here
        url: g.url
      };
    });
    
    res.json({
      groups: formattedGroups,
      items,
      _metadata: {
        from,
        to,
        calendarCount: groups.length,
        eventCount,
        occurrenceCount,
        isEmpty: items.length === 0,
        source: 'cache',
        generatedAt: new Date().toISOString(),
        cacheStatus: calendarCache.getStatus()
      }
    });
  } catch (err) {
    console.error('Error in /api/events:', err);
    res.status(500).json({ 
      error: err.message || 'Failed to fetch events',
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      cacheStatus: calendarCache.getStatus()
    });
  }
});

// Helper function to get event type based on summary
function getEventType(summary) {
  if (!summary) return 'default';
  
  const lowerSummary = summary.toLowerCase();
  
  // Check for event types in the configuration
  for (const [type, config] of Object.entries(eventTypes)) {
    if (type === '_default') continue;
    
    const patterns = Array.isArray(config.patterns) 
      ? config.patterns 
      : [config.patterns];
      
    if (patterns.some(pattern => 
      pattern && new RegExp(pattern, 'i').test(lowerSummary)
    )) {
      return type;
    }
  }
  
  return 'default';
}

// Force refresh CalDAV data
app.post('/api/refresh-caldav', async (req, res) => {
  try {
    console.log('Forcing CalDAV data refresh...');
    await calendarCache.refreshAllCalendars();
    res.json({ 
      success: true, 
      message: 'CalDAV data refresh initiated',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error refreshing CalDAV data:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to refresh CalDAV data',
      details: error.message 
    });
  }
});

// Update event endpoint
app.put('/api/events/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const updateData = req.body;

    console.log(`[updateEvent] Request to update event ${uid} with data:`, updateData);

    // Basic validation
    if (!uid) {
      return res.status(400).json({ error: 'Event UID is required' });
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No update data provided' });
    }

    // Validate date formats if provided
    if (updateData.start && !isValidDate(updateData.start)) {
      return res.status(400).json({ error: 'Invalid start date' });
    }

    if (updateData.end && !isValidDate(updateData.end)) {
      return res.status(400).json({ error: 'Invalid end date' });
    }

    try {
      // Update the event using the server's credentials
      const updatedEvent = await calendarCache.updateEvent(uid, updateData);
      
      res.json({
        success: true,
        message: 'Event updated successfully',
        event: updatedEvent
      });
    } catch (error) {
      console.error('Error in calendarCache.updateEvent:', error);
      res.status(500).json({ 
        error: 'Failed to update event',
        details: error.message 
      });
    }

  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({ 
      error: 'Failed to update event',
      details: error.message 
    });
  }
});

// Helper function to validate date strings
function isValidDate(dateString) {
  return !isNaN(Date.parse(dateString));
}

// Get a single event by UID
app.get('/api/events/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    console.log(`[getEvent] Fetching event with UID: ${uid}`);
    
    if (!uid) {
      return res.status(400).json({ success: false, error: 'Event UID is required' });
    }
    
    // Get the authorization header for the calendar cache
    const authHeader = req.headers.authorization || '';
    
    // Get all calendar URLs
    const calendars = calendarCache.getAllCalendars();
    const calendarUrls = calendars.map(c => c.url);
    
    if (!calendarUrls.length) {
      console.log('[getEvent] No calendars available');
      return res.status(404).json({ success: false, error: 'No calendars available' });
    }
    
    console.log(`[getEvent] Searching in ${calendarUrls.length} calendars`);
    
    // Get the event directly using the getEvent method
    const event = await calendarCache.getEvent(uid);
    
    if (!event) {
      console.log(`[getEvent] Event not found with UID: ${uid}`);
      return res.status(404).json({ success: false, error: 'Event not found' });
    }
    
    console.log(`[getEvent] Found event:`, event);
    res.json({
      success: true,
      event
    });
    
  } catch (error) {
    console.error('Error fetching event:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch event',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Update an event by UID
app.put('/api/events/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    const updateData = req.body;
    
    console.log(`[updateEvent] Updating event ${uid} with data:`, updateData);
    
    if (!uid) {
      return res.status(400).json({ success: false, error: 'Event UID is required' });
    }
    
    // Get the authorization header for the calendar cache
    const authHeader = req.headers.authorization || '';
    
    // Update the event in the calendar cache
    const updatedEvent = await calendarCache.updateEvent(uid, updateData, authHeader);
    
    if (!updatedEvent) {
      return res.status(404).json({ success: false, error: 'Event not found or update failed' });
    }
    
    console.log(`[updateEvent] Successfully updated event ${uid}`);
    
    // Get the complete updated event data
    const completeEvent = await calendarCache.getEvent(uid);
    
    if (!completeEvent) {
      console.warn(`[updateEvent] Could not fetch complete event data for ${uid} after update`);
      return res.json({
        success: true,
        message: 'Event updated but could not fetch complete data',
        event: updatedEvent
      });
    }
    
    res.json({
      success: true,
      message: 'Event updated successfully',
      event: completeEvent
    });
    
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update event',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get event by UID
app.get('/api/events/:uid', async (req, res) => {
  try {
    const { uid } = req.params;
    
    if (!uid) {
      return res.status(400).json({ error: 'Event UID is required' });
    }

    const event = await calendarCache.getEvent(uid);
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    res.json({
      success: true,
      event
    });
    
  } catch (error) {
    console.error('Error fetching event:', error);
    res.status(500).json({ 
      error: 'Failed to fetch event',
      details: error.message 
    });
  }
});

// Move event to a different calendar
app.post('/api/events/:uid/move', async (req, res) => {
  try {
    const { uid } = req.params;
    const { targetCalendarUrl } = req.body;

    console.log(`[moveEvent] Request to move event ${uid} to calendar ${targetCalendarUrl}`);

    // Basic validation
    if (!uid) {
      return res.status(400).json({ error: 'Event UID is required' });
    }

    if (!targetCalendarUrl) {
      return res.status(400).json({ error: 'Target calendar URL is required' });
    }

    // Move the event
    const movedEvent = await calendarCache.moveEvent(uid, targetCalendarUrl);
    
    // In a real implementation, we would handle the actual move operation here
    // For now, we'll just return the simulated result
    
    res.json({
      success: true,
      message: 'Event move simulated successfully',
      event: movedEvent
    });

  } catch (error) {
    console.error('Error moving event:', error);
    res.status(500).json({ 
      error: 'Failed to move event',
      details: error.message 
    });
  }
});

// Client-side logging endpoint
app.post('/api/client-log', (req, res) => {
  const { level, message, extra } = req.body;
  const logMessage = `[CLIENT ${level.toUpperCase()}] ${message}${extra ? ' ' + JSON.stringify(extra) : ''}`;
  
  switch (level) {
    case 'error':
      console.error(logMessage);
      break;
    case 'warn':
      console.warn(logMessage);
      break;
    case 'info':
    default:
      console.log(logMessage);
  }
  
  res.status(200).json({ status: 'ok' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`SupportPlanner server running at http://localhost:${PORT}`);
});
