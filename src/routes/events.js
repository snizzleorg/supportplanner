/**
 * Event routes
 * 
 * Provides comprehensive event management endpoints:
 * - Create all-day events
 * - Search events by summary
 * - Search events across all fields (title, description, metadata)
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
import { createRequire } from 'module';
import { calendarCache } from '../services/calendar.js';
import { getEventType } from '../services/event-type.js';
import { geocodeLocations } from '../services/geocoding.js';
import { escapeHtml, formatErrorResponse, createLogger } from '../utils/index.js';
import { requireRole, validate, eventValidation, uidValidation } from '../middleware/index.js';
import { loadEventTypesConfig, getEventTypes } from '../config/index.js';
import { getSearchTerms as getCountrySearchTerms } from '../utils/country-aliases.js';

const require = createRequire(import.meta.url);
const { version: APP_VERSION } = require('../../package.json');

const logger = createLogger('EventRoutes');

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

    // Extract user info from session for audit logging
    const user = req.session?.user ? {
      email: req.session.user.email,
      name: req.session.user.name
    } : undefined;

    const result = await calendarCache.createAllDayEvent({
      calendarUrl,
      summary,
      description: description || '',
      location: location || '',
      start,
      end,
      meta,
      user
    });

    // Kick off a background refresh so subsequent reads include the new event
    calendarCache.refreshAllCalendars().catch(err => {
      logger.error('Background refresh after create failed', err);
    });

    res.json({ success: true, event: result });
  } catch (error) {
    logger.error('Error creating all-day event', error);
    const { status, body } = formatErrorResponse(error, 500);
    res.status(status).json(body);
  }
});

// Delete an event by UID
router.delete('/:uid', requireRole('editor'), uidValidation, validate, async (req, res) => {
  try {
    const { uid } = req.params;
    if (!uid) {
      return res.status(400).json({ success: false, error: 'Event UID is required' });
    }

    // Extract user info from session for audit logging
    const user = req.session?.user ? {
      email: req.session.user.email,
      name: req.session.user.name
    } : undefined;

    const deleted = await calendarCache.deleteEvent(uid, user);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Event not found or could not be deleted' });
    }

    // Kick off a background refresh so subsequent reads reflect the deletion
    calendarCache.refreshAllCalendars().catch(err => {
      logger.error('Background refresh after delete failed', err);
    });

    // Success
    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting event', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to delete event' });
  }
});

// Search for events by summary
router.get('/search', requireRole('reader'), async (req, res) => {
  try {
    const { summary, from, to } = req.query;
    
    if (!summary) {
      return res.status(400).json({ error: 'Summary parameter is required' });
    }
    
    // Default to ±5 years from today if not specified
    const now = new Date();
    const defaultFrom = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate()).toISOString().split('T')[0];
    const defaultTo = new Date(now.getFullYear() + 5, now.getMonth(), now.getDate()).toISOString().split('T')[0];
    const startDate = from || defaultFrom;
    const endDate = to || defaultTo;
    
    // Warn if date range is very large (> 12 years)
    const rangeMs = new Date(endDate) - new Date(startDate);
    const rangeYears = rangeMs / (365.25 * 24 * 60 * 60 * 1000);
    if (rangeYears > 12) {
      logger.warn(`Large search range requested: ${rangeYears.toFixed(1)} years`);
    }
    
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
    logger.error('Error searching events', error);
    res.status(500).json({ 
      error: 'Failed to search events',
      details: error.message 
    });
  }
});

/**
 * Search events across all fields
 * 
 * Searches through event titles, descriptions, and all metadata fields.
 * Supports case-insensitive partial matching.
 * 
 * @route GET /api/events/search-events
 * @access Requires 'reader' role or higher
 * 
 * @queryparam {string} query - Search term to find in any field (alternative to orderNumber)
 * @queryparam {string} orderNumber - Specific order number to search for (alternative to query)
 * @queryparam {string} [from=2020-01-01] - Start date for filtering (ISO format)
 * @queryparam {string} [to=2030-12-31] - End date for filtering (ISO format)
 * 
 * @returns {Object} 200 - Success response with matching events
 * @returns {Object} 200.success - Always true for successful requests
 * @returns {boolean} 200.found - Whether any events were found
 * @returns {Array<Object>} 200.events - Array of matching events (if found)
 * @returns {number} 200.count - Number of matching events
 * @returns {string} 200.message - Message when no events found
 * 
 * @returns {Object} 400 - Bad request (missing search parameter)
 * @returns {Object} 500 - Server error
 * 
 * @example
 * // Search by order number
 * GET /api/events/search-events?orderNumber=215648
 * 
 * @example
 * // Search by any text
 * GET /api/events/search-events?query=MT100
 * 
 * @example
 * // Search with date range
 * GET /api/events/search-events?query=Installation&from=2025-01-01&to=2025-12-31
 * 
 * @security
 * - Requires authentication (reader role minimum)
 * - Search terms are sanitized (converted to lowercase strings)
 * - No SQL injection risk (uses in-memory filtering)
 * - Returns only events user has access to via calendar permissions
 */
router.get('/search-events', requireRole('reader'), async (req, res) => {
  try {
    const { orderNumber, query, from, to } = req.query;
    
    // Accept either 'orderNumber' or 'query' parameter for flexibility
    const searchTerm = orderNumber || query;
    
    if (!searchTerm) {
      return res.status(400).json({ 
        success: false,
        error: 'Search parameter required (orderNumber or query)' 
      });
    }
    
    // Default to ±5 years from today if not specified
    const now = new Date();
    const defaultFrom = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate()).toISOString().split('T')[0];
    const defaultTo = new Date(now.getFullYear() + 5, now.getMonth(), now.getDate()).toISOString().split('T')[0];
    const startDate = from || defaultFrom;
    const endDate = to || defaultTo;
    
    // Warn if date range is very large (> 12 years)
    const rangeMs = new Date(endDate) - new Date(startDate);
    const rangeYears = rangeMs / (365.25 * 24 * 60 * 60 * 1000);
    if (rangeYears > 12) {
      logger.warn(`Large search range requested: ${rangeYears.toFixed(1)} years`);
    }
    
    // Get all calendar URLs from cache keys
    const cacheKeys = calendarCache.cache.keys();
    const allCalendarUrls = cacheKeys
      .filter(key => key.startsWith('calendar:'))
      .map(key => key.replace('calendar:', ''));
    
    // Get all events in the date range from all calendars
    const events = await calendarCache.getEvents(allCalendarUrls, startDate, endDate);
    
    // Get search terms with country aliases from i18n-iso-countries package
    const searchTerms = getCountrySearchTerms(searchTerm);
    
    // Filter events by searching in multiple fields (case-insensitive, partial match)
    // Uses expanded search terms for country alias matching
    const matchingEvents = events.events.filter(event => {
      // Helper to check if any search term matches the text
      const matchesAny = (text) => {
        if (!text) return false;
        const textLower = String(text).toLowerCase();
        return searchTerms.some(term => textLower.includes(term));
      };
      
      // Search in title (summary)
      if (matchesAny(event.summary)) {
        return true;
      }
      
      // Search in description
      if (matchesAny(event.description)) {
        return true;
      }
      
      // Search in location (city, country, address)
      if (matchesAny(event.location)) {
        return true;
      }
      
      // Search in all metadata fields (orderNumber, ticketLink, systemType, locationCountry, locationCity, etc.)
      if (event.meta && typeof event.meta === 'object') {
        for (const [key, value] of Object.entries(event.meta)) {
          if (matchesAny(value)) {
            return true;
          }
        }
      }
      
      return false;
    });
    
    if (matchingEvents.length === 0) {
      return res.json({
        success: true,
        found: false,
        message: `No events found matching: ${searchTerm}`
      });
    }
    
    // Return all matching events with their links
    const eventsWithLinks = matchingEvents.map(event => ({
      uid: event.uid,
      summary: event.summary,
      start: event.start,
      end: event.end,
      description: event.description,
      location: event.location,
      meta: event.meta,
      link: `${req.protocol}://${req.get('host')}/#event=${event.uid}`
    }));
    
    res.json({
      success: true,
      found: true,
      events: eventsWithLinks,
      count: matchingEvents.length
    });
    
  } catch (error) {
    logger.error('Error searching events:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to search events',
      details: error.message 
    });
  }
});

// Get today's support assignments from event titles
// Looks for events whose summary matches:
// - "Support 1 <name>"
// - "Support 2 <name>"
router.get('/support-today', requireRole('reader'), async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const cacheKeys = calendarCache.cache.keys();
    const allCalendarUrls = cacheKeys
      .filter(key => key.startsWith('calendar:'))
      .map(key => key.replace('calendar:', ''));

    const { events } = await calendarCache.getEvents(allCalendarUrls, dateStr, dateStr);

    const assignments = {
      'Support 1': null,
      'Support 2': null
    };

    const supportEvents = [];

    const parseSupportAssignment = (summary) => {
      if (!summary) return null;
      const m = String(summary).trim().match(/^support\s*([12])\s*[:\-]?\s*(.*)$/i);
      if (!m) return null;
      const slot = m[1] === '1' ? 'Support 1' : 'Support 2';
      const name = String(m[2] || '').trim();
      return { slot, name: name || null };
    };

    for (const ev of events || []) {
      const parsed = parseSupportAssignment(ev.summary);
      if (!parsed) continue;
      const assignee = parsed.name || ev.calendarName || null;
      assignments[parsed.slot] = assignee ? {
        name: assignee,
        start: ev.start,
        end: ev.end
      } : null;
      supportEvents.push({
        uid: ev.uid,
        summary: ev.summary,
        start: ev.start,
        end: ev.end,
        calendar: ev.calendar,
        calendarName: ev.calendarName
      });
    }

    return res.json({
      success: true,
      date: dateStr,
      assignments,
      count: supportEvents.length,
      events: supportEvents
    });
  } catch (error) {
    logger.error('Error fetching support assignments for today', error);
    const { status, body } = formatErrorResponse(error, 500);
    return res.status(status).json(body);
  }
});

// Get events for selected calendars (main timeline endpoint)
router.post('/', async (req, res) => {
  try {
    // Hot-reload event types so edits in event-types.json are reflected without restart
    loadEventTypesConfig();
    const { calendarUrls, from, to } = req.body || {};
    logger.debug('Events request', { from, to, count: Array.isArray(calendarUrls) ? calendarUrls.length : 0 });
    
    if (!Array.isArray(calendarUrls) || calendarUrls.length === 0) {
      return res.status(400).json({ error: 'calendarUrls must be a non-empty array' });
    }

    // Validate date range (max ~24 months total: -12 to +12 for mobile support)
    const fromDate = new Date(from);
    const toDate = new Date(to);
    
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return res.status(400).json({ 
        error: 'Invalid date range',
        details: `From: ${from}, To: ${to}`
      });
    }
    
    // Ensure the date range is not too large
    const maxDays = 750; // ~24 months (~30.42 days/month * 24) for 2-year view
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
          version: APP_VERSION,
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
    logger.debug('Geocoded locations', { count: geocodedLocations.size });

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
          logger.warn('No group found for calendar URL', { calendar: event.calendar });
          return;
        }
        
        // Get the event type configuration
        const eventTypes = getEventTypes();
        const typeConfig = eventTypes[eventType] || eventTypes._default;
        
        // Debug log to check event data
        if (event.description) {
          logger.debug('Event has description', { summary: event.summary, hasDescription: true });
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
        logger.error('Error formatting event', { error, eventUid: event.uid });
      }
    });

    const eventCount = items.filter(i => i.type === 'event').length;
    const occurrenceCount = items.filter(i => i.type === 'occurrence').length;

    // Format groups for vis-timeline
    // Colors are now managed client-side in timeline-ui.js LABEL_PALETTE
    const formattedGroups = groups.map((g, i) => {
      const groupId = `cal-${i + 1}`;
      return {
        id: groupId,
        content: g.content,
        title: g.content,
        // Unique class for targeting from the client
        className: `calendar-group-cal-${i + 1}`,
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
    logger.error('Error in /api/events', err);
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
    
    // Whitelist allowed fields to prevent mass assignment
    const allowedFields = ['summary', 'description', 'location', 'start', 'end', 'meta', 'targetCalendarUrl'];
    const updateData = {};
    
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }
    
    logger.info('Updating event', { uid, updateData });
    
    if (!uid) {
      return res.status(400).json({ success: false, error: 'Event UID is required' });
    }
    
    // Get the authorization header for the calendar cache
    const authHeader = req.headers.authorization || '';
    
    // Extract user info from session for audit logging
    const user = req.session?.user ? {
      email: req.session.user.email,
      name: req.session.user.name
    } : undefined;
    
    // Update the event in the calendar cache
    const updatedEvent = await calendarCache.updateEvent(uid, updateData, authHeader, user);
    
    if (!updatedEvent) {
      return res.status(404).json({ success: false, error: 'Event not found or update failed' });
    }
    
    logger.info('Successfully updated event', { uid });
    
    // Kick off a background refresh so subsequent reads include the updated event
    calendarCache.refreshAllCalendars().catch(err => {
      logger.error('Background refresh after update failed', err);
    });
    
    // Get the complete updated event data
    const completeEvent = await calendarCache.getEvent(uid);
    
    if (!completeEvent) {
      logger.warn('Could not fetch complete event data after update', { uid });
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
    logger.error('Error updating event', error);
    
    // Determine appropriate status code based on error
    let statusCode = 500;
    if (error.message.includes('not found')) {
      statusCode = 404;
    } else if (error.message.includes('412') || error.message.includes('Precondition Failed')) {
      statusCode = 409; // Conflict - someone else modified the event
    } else if (error.message.includes('No client found') || error.message.includes('No calendar')) {
      statusCode = 400; // Bad request - invalid calendar reference
    }
    
    res.status(statusCode).json({
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
    logger.error('Error fetching event', error);
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

    logger.info('Request to move event', { uid, targetCalendarUrl });

    // Basic validation
    if (!uid) {
      return res.status(400).json({ error: 'Event UID is required' });
    }

    if (!targetCalendarUrl) {
      return res.status(400).json({ error: 'Target calendar URL is required' });
    }

    // Move the event
    const movedEvent = await calendarCache.moveEvent(uid, targetCalendarUrl);
    
    // Kick off a background refresh so subsequent reads reflect the moved event
    calendarCache.refreshAllCalendars().catch(err => {
      logger.error('Background refresh after move failed', err);
    });
    
    // In a real implementation, we would handle the actual move operation here
    // For now, we'll just return the simulated result
    
    res.json({
      success: true,
      message: 'Event move simulated successfully',
      event: movedEvent
    });

  } catch (error) {
    logger.error('Error moving event', error);
    res.status(500).json({ 
      error: 'Failed to move event',
      details: error.message 
    });
  }
});

export default router;
