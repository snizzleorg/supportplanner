/**
 * Event routes
 * 
 * Provides comprehensive event management endpoints:
 * - Create all-day events
 * - Search events by summary
 * - Get events for timeline (main endpoint)
 * - Update events
 * - Delete events
 * - Move events between calendars
 * - Get individual events by UID
 * 
 * @module routes/events
 */

import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { calendarCache } from '../services/calendar.js';
import { getEventType } from '../services/event-type.js';
import { geocodeLocations } from '../services/geocoding.js';
import { escapeHtml } from '../utils/html.js';
import { requireRole, validate, eventValidation, uidValidation } from '../middleware/index.js';
import { loadEventTypesConfig, getEventTypes } from '../config/index.js';

const requireEditor = requireRole('editor');

const router = Router();

// Create a new all-day event (inclusive start/end dates)
router.post('/all-day', requireEditor, [
  body('calendarUrl').trim().isURL().withMessage('Valid calendar URL required'),
  body('summary').trim().isLength({ min: 1, max: 500 }).withMessage('Summary required (1-500 chars)'),
  body('start').isISO8601().withMessage('Valid start date required'),
  body('end').isISO8601().withMessage('Valid end date required'),
  ...eventValidation,
], validate, async (req, res) => {
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
router.delete('/:uid', requireRole('editor'), uidValidation, validate, async (req, res) => {
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

// Search for events by summary
router.get('/search', async (req, res) => {
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

// Get events for selected calendars (main timeline endpoint)
router.post('/', async (req, res) => {
  try {
    // Hot-reload event types so edits in event-types.json are reflected without restart
    loadEventTypesConfig();
    const { calendarUrls, from, to } = req.body || {};
    console.log('[events] request', { from, to, count: Array.isArray(calendarUrls) ? calendarUrls.length : 0 });
    
    if (!Array.isArray(calendarUrls) || calendarUrls.length === 0) {
      return res.status(400).json({ error: 'calendarUrls must be a non-empty array' });
    }

    // Validate date range (max ~15 months total: -3 to +12)
    const fromDate = new Date(from);
    const toDate = new Date(to);
    // Note: not used below, but keep for potential sanity checks/logging if needed
    const twelveMonthsFromNow = new Date();
    twelveMonthsFromNow.setMonth(twelveMonthsFromNow.getMonth() + 12);
    
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return res.status(400).json({ 
        error: 'Invalid date range',
        details: `From: ${from}, To: ${to}`
      });
    }
    
    // Ensure the date range is not too large
    const maxDays = 460; // ~15 months (~30.67 days/month * 15)
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
          version: '0.3.0',
          occurrenceCount: 0,
          isEmpty: true,
          source: 'cache',
          cacheStatus: calendarCache.getStatus()
        }
      });
    }

    // Geocode all unique locations in batch
    const uniqueLocations = [...new Set(cachedEvents.map(e => e.location).filter(Boolean))];
    const geocodedLocations = await geocodeLocations(uniqueLocations);
    console.log(`[Events] Geocoded ${geocodedLocations.size} locations`);

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
        const eventTypes = getEventTypes();
        const typeConfig = eventTypes[eventType] || eventTypes._default;
        
        // Debug log to check event data
        if (event.description) {
          console.log(`Event ${event.summary} has description:`, event.description);
        }

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
        // Get geocoded coordinates if location exists
        const geocoded = event.location ? geocodedLocations.get(event.location) : null;

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
          geocoded: geocoded || null, // Add geocoded coordinates {lat, lon}
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
            'font-weight: 300;',
            'padding: 2px 6px;',
            'box-sizing: border-box;',
            'font-size: 11px;',
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

    // Deterministic palette for calendar group backgrounds (fallback only)
    const CAL_GROUP_COLORS = ['#3b82f6','#f97316','#22c55e','#ef4444','#a855f7','#14b8a6','#eab308','#fb7185','#06b6d4','#84cc16'];
    const pickGroupColor = (g, idx) => {
      // Prefer the per-calendar color computed in calendarCache (e.g., based on displayName)
      if (g && g.color) return g.color;
      return CAL_GROUP_COLORS[idx % CAL_GROUP_COLORS.length];
    };

    // Format groups for vis-timeline
    const formattedGroups = groups.map((g, i) => {
      const groupId = `cal-${i + 1}`;
      const bg = pickGroupColor(g, i);
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

// Update an event by UID
router.put('/:uid', requireRole('editor'), uidValidation, eventValidation, validate, async (req, res) => {
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
    res.json({
      success: false,
      error: error.message || 'Failed to update event',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get event by UID
router.get('/:uid', uidValidation, validate, async (req, res) => {
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
router.post('/:uid/move', requireRole('editor'), async (req, res) => {
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

export default router;
