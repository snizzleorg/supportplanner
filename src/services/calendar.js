/**
 * Calendar cache service
 * 
 * Manages CalDAV calendar data with caching, event CRUD operations,
 * and recurring event expansion.
 * 
 * Features:
 * - CalDAV client for Nextcloud integration
 * - 30-minute cache with automatic refresh
 * - Recurring event expansion using ical-expander
 * - Event CRUD operations (create, read, update, delete, move)
 * - YAML metadata extraction from event descriptions
 * - Calendar ordering and color management
 * 
 * @module services/calendar
 */

import { DAVClient } from 'tsdav';
import NodeCache from 'node-cache';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore.js';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter.js';
import { randomUUID } from 'crypto';
import { logOperation } from '../utils/operation-log.js';
import { auditHistory } from './audit-history.js';
import IcalExpander from 'ical-expander';
import YAML from 'yaml';
import { calendarOrder, calendarExclude } from '../config/calendar-order.js';
import { calendarColorOverrides } from '../config/calendar-colors.js';

// Enable required Dayjs plugins for comparison helpers used below
dayjs.extend(utc);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

/**
 * Calendar cache class
 * 
 * Provides caching layer for CalDAV calendar data with automatic refresh.
 * Handles event CRUD operations and recurring event expansion.
 * Includes race condition protection via operation locking.
 * 
 * @class CalendarCache
 */
export class CalendarCache {
  constructor() {
    // Cache with 5 minute TTL and check for expired items every minute
    // Shorter TTL for multi-user environments to reduce stale data
    this.cache = new NodeCache({
      stdTTL: 300, // 5 minutes (reduced from 30 for multi-user sync)
      checkperiod: 60, // 1 minute (check more frequently)
      useClones: false // Better performance with direct references
    });
    
    this.calendars = [];
    this.client = null;
    this.calendarClients = {}; // Store individual calendar clients for updates
    this.isInitialized = false;
    this.refreshInterval = null;
    this.refreshInProgress = false;
    
    // Track ongoing update operations to prevent race conditions
    this.updateLocks = new Map(); // Map<eventUid, Promise>
  }

  /**
   * Extract YAML metadata from event description
   * 
   * Looks for fenced YAML blocks (```yaml ... ```) at the end of descriptions.
   * Parses the YAML and returns both the cleaned text and parsed metadata.
   * 
   * @param {string} description - Event description that may contain YAML
   * @returns {{text: string, meta: Object|null, rawYaml: string}} Parsed result
   * @private
   */
  extractYaml(description) {
    const result = { text: description || '', meta: null, rawYaml: '' };
    if (!description) return result;
    
    // Security: Limit description length to prevent ReDoS attacks
    const MAX_DESCRIPTION_LENGTH = 50000; // 50KB limit
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      console.warn('[extractYaml] Description exceeds max length, truncating');
      description = description.substring(0, MAX_DESCRIPTION_LENGTH);
    }
    
    // Look for fenced yaml block ```yaml ... ```
    // Use indexOf for safer parsing instead of complex regex
    const yamlStart = description.indexOf('```yaml\n');
    const yamlAltStart = description.indexOf('```YAML\n');
    const startIndex = yamlStart !== -1 ? yamlStart : yamlAltStart;
    
    if (startIndex !== -1) {
      const contentStart = startIndex + 8; // Length of '```yaml\n'
      const endMarker = description.indexOf('```', contentStart);
      
      if (endMarker !== -1) {
        const yamlSrc = description.substring(contentStart, endMarker);
        result.rawYaml = yamlSrc;
        try {
          result.meta = YAML.parse(yamlSrc) || null;
        } catch (e) {
          // Keep meta null on parse error; preserve raw text
          result.meta = null;
        }
        // Remove the fenced block from the visible text
        result.text = (description.substring(0, startIndex) + description.substring(endMarker + 3)).trimEnd();
      } else {
        result.text = description;
      }
    } else {
      result.text = description;
    }
    
    return result;
  }

  /**
   * Build event description with YAML metadata
   * 
   * Combines text description with YAML metadata block.
   * Appends YAML as fenced code block at the end.
   * 
   * @param {string} text - Plain text description
   * @param {Object} meta - Metadata object to serialize as YAML
   * @returns {string} Combined description with YAML block
   * @private
   */
  buildDescription(text, meta) {
    const base = (text || '').trimEnd();
    if (meta && Object.keys(meta).length > 0) {
      const yamlStr = YAML.stringify(meta).trimEnd();
      return base + (base ? '\n\n' : '') + '\n```yaml\n' + yamlStr + '\n```\n';
    }
    return base;
  }

  /**
   * Extract firstname from calendar display name
   * Converts "Travel (firstname lastname)" to "firstname"
   * @param {string} displayName - The original calendar display name
   * @returns {string} - The extracted firstname or original name if pattern doesn't match
   */
  extractFirstname(displayName) {
    if (!displayName) return displayName;
    
    // Match pattern: "Calendar Name (firstname lastname)"
    const match = displayName.match(/^.*\(([^)\s]+)\s+[^)]+\)$/);
    if (match) {
      return match[1]; // Return just the firstname
    }
    
    // If pattern doesn't match, return original name
    return displayName;
  }

  /**
   * Create a new all-day event in the given calendar.
   * Expects start and end as inclusive DATE strings (YYYY-MM-DD).
   * In iCal, DTEND for all-day is exclusive, so we will send end + 1 day.
   * @param {Object} payload
   * @param {string} payload.calendarUrl - CalDAV calendar URL
   * @param {string} payload.summary - Event title/summary
   * @param {string} [payload.description] - Event description (plain text)
   * @param {string} [payload.location] - Event location
   * @param {string} payload.start - YYYY-MM-DD inclusive start date
   * @param {string} payload.end - YYYY-MM-DD inclusive end date
   * @param {Object} [payload.meta] - Metadata object (orderNumber, ticketLink, systemType)
   * @param {Object} [payload.user] - User info from session (email, name)
   * @returns {Promise<Object>} Created event object
   * @throws {Error} If CalDAV creation fails or validation fails
   */
  async createAllDayEvent({ calendarUrl, summary, description = '', location = '', start, end, meta, user }) {
    if (!calendarUrl || !summary || !start || !end) {
      throw new Error('calendarUrl, summary, start, and end are required');
    }

    // Validate date-only format
    const isDateOnly = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
    if (!isDateOnly(start) || !isDateOnly(end)) {
      throw new Error('start and end must be in YYYY-MM-DD format for all-day events');
    }

    // Validate date range
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (endDate < startDate) {
      throw new Error('End date cannot be before start date');
    }

    const calendarInfo = this.calendarClients[calendarUrl];
    if (!calendarInfo || !calendarInfo.client) {
      throw new Error(`No client found for calendar: ${calendarUrl}`);
    }

    // Compute exclusive DTEND (end + 1 day UTC date)
    // We've already validated that end >= start, so just use end
    const inclusiveEnd = dayjs(end, 'YYYY-MM-DD');
    const exclusiveEnd = inclusiveEnd.add(1, 'day');

    const formatDate = (dateStr) => {
      // Expecting YYYY-MM-DD. Convert to YYYYMMDD for VALUE=DATE
      return dateStr.replace(/-/g, '');
    };

    const uid = randomUUID();
    const dtStamp = this.formatDateForIcal(new Date());

    // Combine description + meta as fenced YAML (if provided)
    const combinedDescription = this.buildDescription(description, meta);

    const icalLines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Support Planner//NONSGML v1.0//EN',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART;VALUE=DATE:${formatDate(start)}`,
      `DTEND;VALUE=DATE:${formatDate(exclusiveEnd.format('YYYY-MM-DD'))}`,
      `SUMMARY:${summary.replace(/\n/g, '\\n')}`,
      combinedDescription ? `DESCRIPTION:${combinedDescription.replace(/\n/g, '\\n')}` : 'DESCRIPTION:',
      location ? `LOCATION:${location.replace(/\n/g, '\\n')}` : 'LOCATION:',
      'TRANSP:OPAQUE',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\n');

    const client = calendarInfo.client;
    
    // CRITICAL: Wrap in try-catch to prevent retries on partial failures
    try {
      const result = await client.createCalendarObject({
        calendar: calendarInfo.calendar || { url: calendarUrl },
        iCalString: icalLines,
        filename: `${uid}.ics`
      });

      // Invalidate cache for that calendar so subsequent fetch reflects the new event
      // If this fails, we log but don't throw (event was created successfully)
      try {
        this.cache.del(`calendar:${calendarUrl}`);
      } catch (cacheError) {
        console.error('[createAllDayEvent] Cache invalidation failed (non-critical):', cacheError);
      }

      // Build the event state for audit log
      const eventState = {
        uid,
        summary,
        description,
        location,
        start,
        end,
        allDay: true,
        meta,
        calendar: calendarUrl
      };

      // Log to audit history (non-critical)
      try {
        await auditHistory.logOperation({
          eventUid: uid,
          operation: 'CREATE',
          userEmail: user?.email,
          userName: user?.name,
          calendarUrl,
          beforeState: null, // No previous state for CREATE
          afterState: eventState,
          status: 'SUCCESS'
        });
      } catch (auditError) {
        console.error('[createAllDayEvent] Audit logging failed (non-critical):', auditError);
      }

      // Log the operation to file (legacy, non-critical)
      try {
        await logOperation('CREATE', {
          uid,
          summary,
          calendarUrl,
          status: 'SUCCESS',
          metadata: { start, end, location, allDay: true }
        });
      } catch (logError) {
        console.error('[createAllDayEvent] Operation logging failed (non-critical):', logError);
      }

      return {
        success: true,
        uid,
        summary,
        description: description,
        descriptionRaw: combinedDescription,
        meta,
        location,
        start,
        end,
        allDay: true,
        calendar: calendarUrl,
      };
    } catch (error) {
      // CalDAV creation failed - log and rethrow
      console.error(`[createAllDayEvent] Failed to create event in CalDAV:`, error);
      
      // Log failure to audit history (best effort)
      try {
        await auditHistory.logOperation({
          eventUid: uid,
          operation: 'CREATE',
          userEmail: user?.email,
          userName: user?.name,
          calendarUrl,
          beforeState: null,
          afterState: null,
          status: 'FAILED',
          errorMessage: error.message
        });
      } catch (auditError) {
        console.error('[createAllDayEvent] Audit logging failed (non-critical):', auditError);
      }

      // Try to log the failure to file (legacy, best effort)
      try {
        await logOperation('CREATE', {
          uid,
          summary,
          calendarUrl,
          status: 'FAILED',
          error: error.message
        });
      } catch (logError) {
        console.error('[createAllDayEvent] Failed to log error (non-critical):', logError);
      }
      
      throw new Error(`Failed to create event: ${error.message}`);
    }
  }

  /**
   * Initialize the calendar cache
   * 
   * Connects to CalDAV server, discovers calendars, and starts automatic refresh.
   * Sets up individual clients for each calendar and begins periodic refresh cycle.
   * 
   * @param {string} serverUrl - Nextcloud server URL
   * @param {string} username - Nextcloud username
   * @param {string} password - Nextcloud password
   * @returns {Promise<void>}
   */
  async initialize(serverUrl, username, password) {
    if (this.isInitialized) return;
    
    try {
      this.client = new DAVClient({
        serverUrl,
        credentials: { username, password },
        authMethod: 'Basic',
        defaultAccountType: 'caldav',
      });
      
      await this.client.login();
      this.calendars = await this.client.fetchCalendars();
      this.isInitialized = true;
      
      // Initial data load
      await this.refreshAllCalendars();
      
      // Set up periodic refresh (every 3 minutes)
      // More frequent refresh for multi-user environments
      this.refreshInterval = setInterval(
        () => this.refreshAllCalendars(),
        3 * 60 * 1000 // 3 minutes
      );
      
      console.log('Calendar cache initialized');
    } catch (error) {
      console.error('Failed to initialize calendar cache:', error);
      throw error;
    }
  }

  /**
   * Refresh all calendars from CalDAV server
   * 
   * Fetches latest calendar data for all discovered calendars.
   * Expands recurring events and updates cache.
   * Prevents concurrent refreshes.
   * 
   * @returns {Promise<void>}
   */
  async refreshAllCalendars() {
    if (this.refreshInProgress) {
      console.log('Refresh already in progress, skipping');
      return;
    }
    
    this.refreshInProgress = true;
    const startTime = Date.now();
    
    try {
      console.log('Starting calendar refresh...');
      
      // Get calendars again in case they've changed
      this.calendars = await this.client.fetchCalendars();
      
      // Refresh each calendar in parallel
      const refreshPromises = this.calendars.map(calendar => 
        this.refreshCalendar(calendar)
      );
      
      await Promise.all(refreshPromises);
      
      const duration = (Date.now() - startTime) / 1000;
      console.log(`Calendar refresh completed in ${duration.toFixed(2)}s`);
    } catch (error) {
      console.error('Error refreshing calendars:', error);
    } finally {
      this.refreshInProgress = false;
    }
  }

  /**
   * Refresh a single calendar
   * 
   * Fetches calendar objects from CalDAV, parses iCal data,
   * expands recurring events, and caches the results.
   * 
   * @param {Object} calendar - Calendar object with url and displayName
   * @returns {Promise<void>}
   * @private
   */
  async refreshCalendar(calendar) {
    const cacheKey = `calendar:${calendar.url}`;
    const now = dayjs();
    const threeMonthsAgo = now.subtract(3, 'month');
    const threeMonthsFromNow = now.add(12, 'month'); // Cache 12 months ahead
    
    // Convert to JavaScript Date objects for ical-expander
    const threeMonthsAgoDate = threeMonthsAgo.toDate();
    const threeMonthsFromNowDate = threeMonthsFromNow.toDate();
    
    const displayName = this.extractFirstname(calendar.displayName) || calendar.url;
    console.log(`[${displayName}] Fetching events from ${threeMonthsAgo.format('YYYY-MM-DD')} to ${threeMonthsFromNow.format('YYYY-MM-DD')}`);
    
    // Store the calendar client for later use in updates
    if (!this.calendarClients[calendar.url]) {
      this.calendarClients[calendar.url] = {
        client: this.client,
        calendar: calendar
      };
      console.log(`[${displayName}] Stored calendar client for updates`);
    }
    
    try {
      const objects = await this.client.fetchCalendarObjects({
        calendar,
        timeRange: { 
          start: threeMonthsAgo.format('YYYY-MM-DDTHH:mm:ss[Z]'), 
          end: threeMonthsFromNow.format('YYYY-MM-DDTHH:mm:ss[Z]') 
        },
      });
      
      console.log(`[${displayName}] Found ${objects.length} calendar objects`);
      
      const events = [];
      let eventCount = 0;
      let occurrenceCount = 0;
      
      // Process all calendar objects in parallel
      await Promise.all(objects.map(async (obj, index) => {
        try {
          console.log(`[${displayName}] Processing object ${index + 1}/${objects.length}`);
          const icalExpander = new IcalExpander({ ics: obj.data, maxIterations: 1000 });
          const expanded = icalExpander.between(threeMonthsAgoDate, threeMonthsFromNowDate);
          
          // Process events
          expanded.events.forEach(event => {
            const isAllDay = !event.startDate.hour && !event.startDate.minute;
            const startIso = event.startDate.toJSDate();
            const endIso = event.endDate.toJSDate();
            // For all-day events, DTEND is exclusive. Convert to inclusive by subtracting 1 day for display.
            const endDisplayDate = isAllDay ? dayjs(endIso).subtract(1, 'day').format('YYYY-MM-DD') : endIso.toISOString();
            const rawDesc = event.description || '';
            const parsed = this.extractYaml(rawDesc);
            // For all-day events, send date-only strings to avoid timezone shifts in UI
            const eventData = {
              type: 'event',
              uid: event.uid,
              summary: event.summary,
              description: parsed.text, // plain text only, YAML removed
              descriptionRaw: rawDesc,
              meta: parsed.meta,
              location: event.location,
              start: isAllDay ? dayjs(startIso).format('YYYY-MM-DD') : startIso.toISOString(),
              end: isAllDay ? endDisplayDate : endIso.toISOString(),
              allDay: isAllDay,
              calendar: calendar.url,
              calendarName: this.extractFirstname(calendar.displayName) || 'Unnamed Calendar'
            };
            
            // Log details of event for debugging
            console.log(`[${displayName}] Processing event: ${eventData.uid} - ${eventData.summary} (${eventData.start} - ${eventData.end})`);
            
            events.push(eventData);
            eventCount++;
            
            if (eventCount <= 3) { // Log first few events for debugging
              console.log(`[${displayName}] Event: ${eventData.summary} (${eventData.start} - ${eventData.end})`);
            }
          });
          
          // Process recurring event instances
          expanded.occurrences.forEach(occurrence => {
            const isAllDayOcc = !occurrence.startDate.hour && !occurrence.startDate.minute;
            const occStartIso = occurrence.startDate.toJSDate();
            const occEndIso = occurrence.endDate.toJSDate();
            const occEndDisplayDate = isAllDayOcc ? dayjs(occEndIso).subtract(1, 'day').format('YYYY-MM-DD') : occEndIso.toISOString();
            const rawDesc = occurrence.item.description || '';
            const parsed = this.extractYaml(rawDesc);
            const occurrenceData = {
              type: 'occurrence',
              uid: occurrence.item.uid,
              summary: occurrence.item.summary,
              description: parsed.text,
              descriptionRaw: rawDesc,
              meta: parsed.meta,
              location: occurrence.item.location,
              start: isAllDayOcc ? dayjs(occStartIso).format('YYYY-MM-DD') : occStartIso.toISOString(),
              end: isAllDayOcc ? occEndDisplayDate : occEndIso.toISOString(),
              allDay: isAllDayOcc,
              calendar: calendar.url,
              calendarName: this.extractFirstname(calendar.displayName) || 'Unnamed Calendar',
              isRecurring: true,
              recurringEventId: occurrence.item.uid
            };
            events.push(occurrenceData);
            occurrenceCount++;
            
            if (occurrenceCount <= 3) { // Log first few occurrences for debugging
              console.log(`[${calendar.displayName || calendar.url}] Occurrence: ${occurrenceData.summary} (${occurrenceData.start} - ${occurrenceData.end})`);
            }
          });
          
          console.log(`[${calendar.displayName || calendar.url}] Processed object ${index + 1}/${objects.length}: ${expanded.events.length} events, ${expanded.occurrences.length} occurrences`);
          
        } catch (error) {
          console.error(`[${calendar.displayName || calendar.url}] Error processing calendar object:`, error);
        }
      }));
      
      // Update cache
      this.cache.set(cacheKey, {
        events,
        lastUpdated: new Date().toISOString(),
        calendar: {
          url: calendar.url,
          displayName: calendar.displayName,
          description: calendar.description,
          color: calendar.color
        }
      });
      
      console.log(`[${calendar.displayName || calendar.url}] Cache updated with ${events.length} events (${eventCount} regular, ${occurrenceCount} occurrences)`);
      return events;
    } catch (error) {
      console.error(`Failed to refresh calendar ${calendar.displayName || calendar.url}:`, error);
      throw error;
    }
  }

  /**
   * Get calendar data from cache
   * 
   * @param {string} calendarUrl - Calendar URL
   * @returns {Object|undefined} Cached calendar data or undefined
   */
  getCalendar(calendarUrl) {
    const cacheKey = `calendar:${calendarUrl}`;
    return this.cache.get(cacheKey);
  }

  /**
   * Generate a consistent color based on display name
   * 
   * Uses string hashing to generate deterministic HSL colors.
   * Ensures same calendar always gets same color.
   * 
   * @param {string} displayName - Calendar display name
   * @returns {string} Hex color code
   * @private
   */
  getCalendarColor(displayName) {
    if (!displayName) return '#3b82f6'; // Default blue if no name

    // Hash to a stable integer
    const hash = displayName.split('').reduce((acc, ch) => ((acc << 5) - acc) + ch.charCodeAt(0), 0);

    // Golden-angle step over the hue wheel for maximal distinction
    const golden = 137.508; // degrees
    const hue = ((Math.abs(hash) * golden) % 360);
    const sat = 85; // vibrant
    const light = 55; // mid-lightness for readability

    const hslToHex = (h, s, l) => {
      s /= 100; l /= 100;
      const k = n => (n + h / 30) % 12;
      const a = s * Math.min(l, 1 - l);
      const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
      const toHex = x => Math.round(255 * x).toString(16).padStart(2, '0');
      return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
    };

    return hslToHex(hue, sat, light);
  }

  /**
   * Get all calendars with ordering and exclusions applied
   * 
   * Returns calendars sorted by configured order, with exclusions filtered out.
   * Applies color overrides and generates colors for calendars.
   * 
   * @returns {Array<Object>} Array of calendar objects with id, content, url, color
   */
  getAllCalendars() {
    // Apply exclusion rules first (by exact display name, extracted firstname, or URL; case-insensitive)
    const excluded = new Set((calendarExclude || []).map(x => String(x || '').toLowerCase()));
    const sourceCalendars = this.calendars.filter(c => {
      const url = (c.url || '').toLowerCase();
      const disp = String(c.displayName || '').toLowerCase();
      const first = String(this.extractFirstname(c.displayName || '') || '').toLowerCase();
      return !(excluded.has(url) || excluded.has(disp) || excluded.has(first));
    });

    // Create a map of calendar URLs to their configured order
    const orderMap = new Map();
    calendarOrder.forEach((url, index) => {
      orderMap.set(url, index);
    });

    // Sort calendars: first by configured order, then alphabetically by display name
    const sortedCalendars = [...sourceCalendars].sort((a, b) => {
      const orderA = orderMap.has(a.url) ? orderMap.get(a.url) : Number.MAX_SAFE_INTEGER;
      const orderB = orderMap.has(b.url) ? orderMap.get(b.url) : Number.MAX_SAFE_INTEGER;
      
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      
      // If not in the order config or same order, sort alphabetically by display name
      const nameA = this.extractFirstname(a.displayName) || '';
      const nameB = this.extractFirstname(b.displayName) || '';
      return nameA.localeCompare(nameB);
    });

    return sortedCalendars.map(calendar => {
      const displayName = this.extractFirstname(calendar.displayName);
      const override = calendarColorOverrides[displayName] || calendarColorOverrides[calendar.url];
      return {
        url: calendar.url,
        displayName: displayName,
        description: calendar.description,
        color: override || this.getCalendarColor(displayName),
        components: calendar.components || []
      };
    });
  }

  /**
   * Get events from specified calendars within date range
   * 
   * Retrieves cached events for given calendars and date range.
   * Returns both calendar metadata and filtered events.
   * 
   * @param {string[]} calendarUrls - Array of calendar URLs to fetch events from
   * @param {string} start - Start date (ISO format)
   * @param {string} end - End date (ISO format)
   * @returns {{calendars: Array<Object>, events: Array<Object>}} Calendars and events
   */
  getEvents(calendarUrls, start, end) {
    const startDate = dayjs(start).startOf('day');
    const endDate = dayjs(end).endOf('day');
    
    console.log(`[getEvents] Requested calendars: ${calendarUrls.length}, from ${start} to ${end}`);

    const allEvents = [];
    const calendarData = [];
    const cacheKeys = this.cache.keys();
    
    console.log(`[getEvents] Available cache keys: ${cacheKeys.length}`);
    cacheKeys.forEach(key => console.log(` - ${key}`));

    // Process each requested calendar URL
    calendarUrls.forEach(calendarUrl => {
      // Find matching cache key (case-insensitive and URL-normalized comparison)
      const normalizedUrl = calendarUrl.replace(/\/$/, '').toLowerCase();
      const cacheKey = cacheKeys.find(key => {
        const normalizedKey = key.replace(/^calendar:/, '').replace(/\/$/, '').toLowerCase();
        return normalizedKey === normalizedUrl || 
               normalizedKey.endsWith(normalizedUrl) ||
               normalizedUrl.endsWith(normalizedKey);
      });
      
      if (!cacheKey) {
        console.log(`[getEvents] No cache entry found for: ${calendarUrl}`);
        return;
      }
      
      const data = this.cache.get(cacheKey);
      
      if (!data) {
        console.log(`[getEvents] No data in cache for key: ${cacheKey}`);
        return;
      }
      
      // Add calendar info if not already added
      const dispName = this.extractFirstname(data.calendar.displayName) || data.calendar.displayName || 'Unnamed Calendar';
      const override = calendarColorOverrides[dispName] || calendarColorOverrides[data.calendar.url];
      // Pick a distinct color for this calendar based on its order among the requested set
      const DISTINCT12 = ['#1f77b4','#ff7f0e','#2ca02c','#d62728','#9467bd','#8c564b','#e377c2','#7f7f7f','#bcbd22','#17becf','#fb9a99','#a6cee3'];
      const paletteIdx = calendarData.length % DISTINCT12.length;
      const calendarInfo = {
        id: `cal-${calendarData.length + 1}`,
        content: dispName,
        url: data.calendar.url,
        // Prefer override, then native server color, otherwise distinct palette by index
        color: override || data.calendar.color || DISTINCT12[paletteIdx]
      };
      
      if (!calendarData.some(c => c.url === calendarInfo.url)) {
        calendarData.push(calendarInfo);
      }
      
      // Filter events by date range
      const calendarEvents = data.events.filter(event => {
        if (!event.start || !event.end) return false;
        
        const eventStart = dayjs(event.start);
        const eventEnd = dayjs(event.end);
        
        // Check if event overlaps with the requested date range
        return (
          (eventStart.isAfter(startDate) && eventStart.isBefore(endDate)) ||
          (eventEnd.isAfter(startDate) && eventEnd.isBefore(endDate)) ||
          (eventStart.isSameOrBefore(startDate) && eventEnd.isSameOrAfter(endDate)) ||
          (eventStart.isSameOrBefore(endDate) && eventEnd.isSameOrAfter(startDate))
        );
      });
      
      console.log(`[getEvents] Found ${calendarEvents.length} events for ${data.calendar.displayName || 'unnamed calendar'}`);
      allEvents.push(...calendarEvents);
    });

    return {
      calendars: calendarData,
      events: allEvents,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Get cache status information
   * 
   * Returns metadata about cache state for monitoring and debugging.
   * 
   * @returns {{isInitialized: boolean, lastRefresh: string|null, calendars: number, cacheKeys: number}} Status object
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      lastRefresh: this.cache.stats.hits > 0 ? new Date().toISOString() : null,
      cacheStats: this.cache.getStats(),
      calendarCount: this.calendars.length,
      refreshInProgress: this.refreshInProgress
    };
  }

  /**
   * Stop the calendar cache
   * 
   * Clears refresh interval and marks as uninitialized.
   * Call this during graceful shutdown.
   * 
   * @returns {Promise<void>}
   */
  async stop() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    this.isInitialized = false;
  }

  /**
   * Get an event by UID
   * @param {string} uid - The UID of the event to find
   * @returns {Promise<Object|null>} The event or null if not found
   */
  async getEvent(uid) {
    if (!uid) {
      throw new Error('Event UID is required');
    }

    console.log(`[getEvent] Looking for event with UID: ${uid}`);
    
    // Get all calendar cache keys
    const cacheKeys = this.cache.keys();
    console.log(`[getEvent] Found ${cacheKeys.length} cache keys`);
    
    // Find the event in any calendar
    for (const key of cacheKeys) {
      if (key.startsWith('calendar:')) {
        console.log(`[getEvent] Checking cache key: ${key}`);
        const cacheData = this.cache.get(key);
        
        if (!cacheData) {
          console.log(`[getEvent] No data in cache for key: ${key}`);
          continue;
        }
        
        if (!cacheData.events) {
          console.log(`[getEvent] No events in cache data for key: ${key}`);
          continue;
        }
        
        console.log(`[getEvent] Found ${cacheData.events.length} events in cache`);
        
        // Log first few events for debugging with more details
        const sampleEvents = cacheData.events.slice(0, 5);
        console.log(`[${key.replace('calendar:', '')}] Events in cache:`, sampleEvents.map(e => ({
          id: e.id,
          uid: e.uid,
          summary: e.summary || e.title,
          start: e.start,
          end: e.end,
          allDay: e.allDay,
          calendar: key.replace('calendar:', '')
        })));
        
        // Extract just the UID part if it's a full URL or has a prefix
        const extractUid = (id) => {
          if (!id) return null;
          
          // If it's a URL, try to extract the UID from the end
          if (id.includes('/')) {
            const parts = id.split('/');
            id = parts[parts.length - 1];
          }
          
          // Remove any file extension
          id = id.replace(/\.ics$/, '');
          
          // Remove any prefix that might be before the UID (like a hyphen)
          const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
          const match = id.match(uuidRegex);
          
          return match ? match[0] : id;
        };
        
        const searchUid = extractUid(uid);
        console.log(`[getEvent] Searching for UID: '${searchUid}' in calendar ${key}`);
        
        // Try to find the event by UID or ID
        const event = cacheData.events.find(e => {
          const eventUid = extractUid(e.uid || '');
          const eventId = extractUid(e.id || '');
          
          console.log(`[getEvent] Checking event:`, {
            eventUid,
            eventId,
            searchUid,
            matches: eventUid === searchUid || eventId === searchUid
          });
          
          // Check if either UID or ID matches
          return eventUid === searchUid || eventId === searchUid;
        });
        
        if (event) {
          console.log(`[getEvent] Found matching event:`, {
            id: event.id,
            uid: event.uid,
            summary: event.summary || event.title,
            start: event.start,
            end: event.end
          });
          
          return {
            ...event,
            calendarUrl: key.replace('calendar:', '')
          };
        }
      }
    }
    
    return null;
  }

  /**
   * Delete an event by UID
   * @param {string} uid - The UID of the event to delete
   * @param {Object} [user] - User info from session (email, name)
   * @returns {Promise<boolean>} True if the event was deleted, false otherwise
   */
  async deleteEvent(uid, user) {
    if (!uid) {
      throw new Error('Event UID is required');
    }

    // 1) Find the event and its calendar
    const event = await this.getEvent(uid);
    if (!event) {
      throw new Error(`Event ${uid} not found`);
    }

    const calendarUrl = event.calendarUrl || event.calendar;
    if (!calendarUrl) {
      throw new Error('No calendar URL found for event');
    }

    const calendarInfo = this.calendarClients[calendarUrl];
    if (!calendarInfo || !calendarInfo.client) {
      throw new Error(`No client found for calendar: ${calendarUrl}`);
    }

    const client = calendarInfo.client;

    // 2) Fetch calendar objects and find the specific event object by UID
    const calendarObjects = await client.fetchCalendarObjects({
      calendar: calendarInfo.calendar || { url: calendarUrl },
      expand: true
    });

    const eventObject = calendarObjects.find(obj => obj.data && obj.data.includes(`UID:${uid}`));
    if (!eventObject) {
      throw new Error(`Event with UID ${uid} not found in calendar objects`);
    }

    // 3) Delete the calendar object
    console.log(`[deleteEvent] Attempting to delete calendar object:`, {
      url: eventObject.url,
      etag: eventObject.etag,
      uid: uid
    });
    
    try {
      await client.deleteCalendarObject({
        calendarObject: eventObject,
        etag: eventObject.etag
      });
      console.log(`[deleteEvent] Successfully deleted calendar object from Nextcloud`);
    } catch (deleteError) {
      console.error(`[deleteEvent] Failed to delete from Nextcloud:`, deleteError);
      throw new Error(`Failed to delete event from Nextcloud: ${deleteError.message}`);
    }

    // 4) Invalidate cache for that calendar (non-critical)
    try {
      this.cache.del(`calendar:${calendarUrl}`);
    } catch (cacheError) {
      console.error('[deleteEvent] Cache invalidation failed (non-critical):', cacheError);
    }
    
    // Log to audit history (non-critical)
    try {
      // Ensure event state has all required fields for restoration
      const eventState = {
        uid: event.uid || uid,
        summary: event.summary || event.content || event.title,
        description: event.description || event.descriptionRaw || '',
        location: event.location || '',
        start: event.start,
        end: event.end,
        allDay: event.allDay,
        calendar: calendarUrl,
        calendarUrl: calendarUrl,
        meta: event.meta
      };
      
      console.log('[deleteEvent] Captured event state for audit:', eventState);
      
      await auditHistory.logOperation({
        eventUid: uid,
        operation: 'DELETE',
        userEmail: user?.email,
        userName: user?.name,
        calendarUrl,
        beforeState: eventState, // Capture complete state before deletion
        afterState: null, // No state after deletion
        status: 'SUCCESS'
      });
    } catch (auditError) {
      console.error('[deleteEvent] Audit logging failed (non-critical):', auditError);
    }

    // Log the operation to file (legacy, non-critical)
    try {
      await logOperation('DELETE', {
        uid,
        summary: event.summary || event.content,
        calendarUrl,
        status: 'SUCCESS'
      });
    } catch (logError) {
      console.error('[deleteEvent] Operation logging failed (non-critical):', logError);
    }
    
    return true;
  }
  
  /**
   * Update an existing event with race condition protection
   * 
   * Uses operation locking to serialize concurrent updates to the same event.
   * If another update is in progress, this call waits for it to complete.
   * 
   * @param {string} uid - The UID of the event to update
   * @param {Object} updateData - The data to update (summary, start, end, description, location, meta, targetCalendarUrl)
   * @param {string} [authHeader] - Optional authorization header from the client (currently unused)
   * @param {Object} [user] - User info from session (email, name)
   * @returns {Promise<Object>} The updated event object
   * @throws {Error} If event not found or CalDAV update fails
   */
  async updateEvent(uid, updateData, authHeader, user) {
    if (!uid) {
      throw new Error('Event UID is required');
    }

    // RACE CONDITION PROTECTION: Wait for any in-flight updates to complete
    if (this.updateLocks.has(uid)) {
      console.log(`[updateEvent] Waiting for in-flight update to ${uid} to complete...`);
      try {
        await this.updateLocks.get(uid);
        console.log(`[updateEvent] Previous update completed, proceeding with new update`);
      } catch (error) {
        console.log(`[updateEvent] Previous update failed, proceeding with new update`);
      }
    }

    console.log(`[updateEvent] Starting update for event ${uid}`);
    console.log(`[updateEvent] Update data:`, JSON.stringify(updateData, null, 2));

    // Create a promise for this update operation
    const updatePromise = this._performUpdate(uid, updateData, authHeader, user);
    
    // Register the lock
    this.updateLocks.set(uid, updatePromise);

    try {
      const result = await updatePromise;
      return result;
    } finally {
      // Always clean up the lock
      this.updateLocks.delete(uid);
      console.log(`[updateEvent] Released lock for ${uid}`);
    }
  }

  /**
   * Internal method that performs the actual update operation
   * 
   * Separated from updateEvent() to enable the locking mechanism.
   * Handles metadata extraction, preservation, and CalDAV synchronization.
   * 
   * @private
   * @param {string} uid - The UID of the event to update
   * @param {Object} updateData - The data to update
   * @param {string} [authHeader] - Optional authorization header (currently unused)
   * @param {Object} [user] - User info from session (email, name)
   * @returns {Promise<Object>} The updated event object
   * @throws {Error} If event not found or update fails
   */
  async _performUpdate(uid, updateData, authHeader, user) {
    // 1. Get the current event data
    let event = await this.getEvent(uid);
    if (!event) {
      console.error(`[updateEvent] Event ${uid} not found in any calendar`);
      throw new Error(`Event ${uid} not found`);
    }
    
    console.log(`[updateEvent] Found existing event:`, {
      uid: event.uid,
      summary: event.summary,
      start: event.start,
      end: event.end,
      calendarUrl: event.calendarUrl || event.calendar,
      allDay: event.allDay
    });
    
    // Handle moving to a different calendar if requested (single-pass, no recursion)
    if (updateData.targetCalendarUrl && updateData.targetCalendarUrl !== (event.calendarUrl || event.calendar)) {
      console.log(`[updateEvent] Moving event ${uid} to calendar ${updateData.targetCalendarUrl}`);
      const movedEvent = await this.moveEvent(uid, updateData.targetCalendarUrl, user);

      // Adopt moved event as the current base event and strip targetCalendarUrl from updates
      const { targetCalendarUrl, ...remainingUpdates } = updateData;
      event = movedEvent;
      updateData = remainingUpdates;

      // If there are no further updates, return immediately
      if (Object.keys(updateData).length === 0) {
        return movedEvent;
      }
    }

    console.log(`[updateEvent] Found event:`, {
      uid: event.uid,
      summary: event.summary,
      start: event.start,
      end: event.end,
      calendar: event.calendarUrl
    });

    // 2. Handle metadata properly
    // If updateData contains description, check if it has embedded YAML
    // If it does, extract it to meta field. Otherwise, use provided meta.
    let cleanDescription = updateData.description;
    let metaToUse = updateData.meta;
    
    if (updateData.description) {
      const parsed = this.extractYaml(updateData.description);
      cleanDescription = parsed.text;
      
      // If YAML was found in description, use it (unless explicit meta provided)
      if (parsed.meta && !updateData.meta) {
        metaToUse = parsed.meta;
        console.log(`[updateEvent] Extracted metadata from description:`, metaToUse);
      }
    }
    
    // If no new metadata provided (and meta wasn't explicitly set to null), preserve existing metadata
    if (metaToUse === undefined && event.meta) {
      metaToUse = event.meta;
      console.log(`[updateEvent] Preserving existing metadata:`, metaToUse);
    } else if (updateData.meta !== undefined) {
      // Meta was explicitly provided (even if null), so use it
      console.log(`[updateEvent] Using provided metadata:`, metaToUse);
    }

    // 3. Update the event data
    const updatedEvent = {
      ...event,
      ...updateData,
      description: cleanDescription !== undefined ? cleanDescription : event.description,
      meta: metaToUse,
      updatedAt: new Date().toISOString()
    };

    console.log(`[updateEvent] Updated event data:`, {
      summary: updatedEvent.summary,
      description: updatedEvent.description,
      meta: updatedEvent.meta,
      location: updatedEvent.location
    });

    // 3. Get the calendar client for this event's calendar
    const calendarUrl = event.calendarUrl || event.calendar;
    if (!calendarUrl) {
      throw new Error('No calendar URL found for event');
    }

    const calendarInfo = this.calendarClients[calendarUrl];
    if (!calendarInfo || !calendarInfo.client) {
      console.error(`[updateEvent] No calendar client found for URL:`, {
        calendarUrl,
        availableClients: Object.keys(this.calendarClients)
      });
      throw new Error(`No calendar client found for URL: ${calendarUrl}`);
    }
    
    const { client } = calendarInfo;
    const calendar = { url: calendarUrl }; // Create a simple calendar object with just the URL

    try {
      // 4. Fetch all calendar objects to find our event
      console.log(`[updateEvent] Fetching all calendar objects from ${calendarUrl}`);
      
      // Log the calendar object structure
      console.log('[updateEvent] Calendar object structure:', {
        calendarUrl,
        calendarInfo: calendarInfo,
        hasClient: !!calendarInfo.client,
        calendarProps: Object.keys(calendarInfo.calendar || {})
      });
      
      // First, get the calendar object to find the event URL
      const calendarObjects = await client.fetchCalendarObjects({
        calendar: calendarInfo.calendar || { url: calendarUrl },
        expand: true
      });
      
      console.log(`[updateEvent] Found ${calendarObjects.length} calendar objects`);
      
      // Find the specific event by UID
      const eventObject = calendarObjects.find(obj => {
        return obj.data && obj.data.includes(`UID:${uid}`);
      });
      
      if (!eventObject) {
        throw new Error(`Event with UID ${uid} not found in calendar`);
      }
      
      console.log('[updateEvent] Found event object:', {
        url: eventObject.url,
        etag: eventObject.etag || 'no etag',
        hasData: !!eventObject.data
      });
      
      const eventUrl = eventObject.url;
      const currentEtag = eventObject.etag; // only send If-Match when present

      // 6. Create iCal data for the updated event
      // Preserve the original event's all-day status if it exists, otherwise determine from the time
      const isAllDay = event.allDay !== undefined ? event.allDay : 
                     (updatedEvent.start && updatedEvent.start.endsWith('T00:00:00.000Z') && 
                      updatedEvent.end && updatedEvent.end.endsWith('T00:00:00.000Z'));
      
      console.log(`[updateEvent] Generating iCal data for ${isAllDay ? 'all-day' : 'timed'} event (preserved from original: ${event.allDay !== undefined ? 'yes' : 'no'})`);
      
      // Format dates for iCal
      const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        if (isAllDay) {
          // For all-day events, use DATE format (YYYYMMDD)
          return date.toISOString().replace(/[-:T.]/g, '').substring(0, 8);
        } else {
          // For timed events, use UTC format
          return date.toISOString().replace(/[-:.]/g, '').replace('Z', 'Z');
        }
      };
      
      const icalLines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Support Planner//NONSGML v1.0//EN',
        'BEGIN:VEVENT',
        `UID:${updatedEvent.uid}`, // Keep the same UID
        `DTSTAMP:${this.formatDateForIcal(new Date())}`
      ];
      
      // Add DTSTART and DTEND with proper format for all-day vs timed events
      if (isAllDay) {
        // For all-day events, client sends inclusive end date.
        // In iCal, DTEND (DATE) must be exclusive, so add 1 day to the inclusive end.
        const inclusiveEnd = new Date(updatedEvent.end);
        const exclusiveEnd = new Date(Date.UTC(inclusiveEnd.getUTCFullYear(), inclusiveEnd.getUTCMonth(), inclusiveEnd.getUTCDate() + 1));
        icalLines.push(
          `DTSTART;VALUE=DATE:${formatDate(updatedEvent.start)}`,
          `DTEND;VALUE=DATE:${formatDate(exclusiveEnd.toISOString())}`,
          'X-MICROSOFT-CDO-ALLDAYEVENT:TRUE',
          'X-MICROSOFT-CDO-INTENDEDSTATUS:BUSY',
          'TRANSP:OPAQUE'  // Blocks time on calendar
        );
      } else {
        icalLines.push(
          `DTSTART:${formatDate(updatedEvent.start)}`,
          `DTEND:${formatDate(updatedEvent.end)}`,
          'X-MICROSOFT-CDO-INTENDEDSTATUS:BUSY',
          'TRANSP:OPAQUE'  // Blocks time on calendar
        );
      }
      
      // Add other event properties
      const combinedDescription = this.buildDescription(updatedEvent.description, updatedEvent.meta);
      icalLines.push(
        `SUMMARY:${updatedEvent.summary || ''}`,
        combinedDescription ? `DESCRIPTION:${combinedDescription.replace(/\n/g, '\\n')}` : '',
        updatedEvent.location ? `LOCATION:${updatedEvent.location}` : '',
        'STATUS:CONFIRMED',
        'END:VEVENT',
        'END:VCALENDAR'
      );
      
      const icalData = icalLines.filter(Boolean).join('\r\n');
      console.log('[updateEvent] Generated iCal data:', icalData);

      // 7. Update the event on the CalDAV server
      console.log(`[updateEvent] Updating event with UID: ${uid}`);
      
      // Make sure the URL is a full URL (not relative)
      const fullEventUrl = eventUrl.startsWith('http') ? eventUrl : `${calendar.url}${eventUrl}`;
      
      console.log(`[updateEvent] Updating event at URL: ${fullEventUrl} with ETag: ${currentEtag}`);
      
      try {
        // Get the account object from the client
        const account = client.account;
        if (!account) {
          throw new Error('No account object found in client');
        }
        
        // Get the credentials from the account
        const credentials = account.credentials;
        if (!credentials) {
          throw new Error('No credentials found in account');
        }
        
        // Create basic auth header
        const authHeader = `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64')}`;
        
        // Make a direct PUT request to update the event
        const headers = {
          'Content-Type': 'text/calendar; charset=utf-8',
          'Authorization': authHeader,
          'Depth': '1',
          'Prefer': 'return-minimal'
        };
        if (currentEtag) {
          headers['If-Match'] = currentEtag;
        }

        const response = await fetch(fullEventUrl, {
          method: 'PUT',
          headers,
          body: icalData
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[updateEvent] PUT failed', {
            status: response.status,
            statusText: response.statusText,
            errorText
          });
          throw new Error(`Failed to update event: ${response.status} ${response.statusText}: ${errorText}`);
        }
        
        console.log(`[updateEvent] Successfully updated event at ${fullEventUrl}`);
        console.log(`[updateEvent] Successfully updated event ${uid} in calendar ${event.calendar}`);
        
        // 8. Invalidate the cache for this calendar (non-critical)
        try {
          const cacheKey = `calendar:${event.calendar}`;
          this.cache.del(cacheKey);
          console.log(`[updateEvent] Invalidated cache for ${cacheKey}`);
        } catch (cacheError) {
          console.error('[updateEvent] Cache invalidation failed (non-critical):', cacheError);
        }
        
        // Log to audit history (non-critical)
        try {
          await auditHistory.logOperation({
            eventUid: uid,
            operation: 'UPDATE',
            userEmail: user?.email,
            userName: user?.name,
            calendarUrl: event.calendar,
            beforeState: event, // Original state before update
            afterState: updatedEvent, // New state after update
            status: 'SUCCESS'
          });
        } catch (auditError) {
          console.error('[updateEvent] Audit logging failed (non-critical):', auditError);
        }

        // Log the operation to file (legacy, non-critical)
        try {
          await logOperation('UPDATE', {
            uid,
            summary: updatedEvent.summary,
            calendarUrl: event.calendar,
            status: 'SUCCESS',
            metadata: { 
              start: updatedEvent.start, 
              end: updatedEvent.end,
              location: updatedEvent.location
            }
          });
        } catch (logError) {
          console.error('[updateEvent] Operation logging failed (non-critical):', logError);
        }
        
        // 9. Return the updated event
        return updatedEvent;
      } catch (error) {
        console.error(`[updateEvent] Error updating event:`, error);
        throw new Error(`Failed to update event: ${error.message}`);
      }
    } catch (error) {
      console.error(`[updateEvent] Error updating event ${uid}:`, error);
      throw new Error(`Failed to update event: ${error.message}`);
    }
  }

  /**
   * Format a Date object for iCal format
   * @private
   */
  formatDateForIcal(date) {
    return date.toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '')
      .replace('Z', 'Z')
      .replace('T', 'T');
  }

  /**
   * Move an event to a different calendar
   * @param {string} uid - The UID of the event to move
   * @param {string} targetCalendarUrl - The URL of the target calendar
   * @param {Object} [user] - User info from session (email, name)
   * @returns {Promise<Object>} The moved event
   */
  async moveEvent(uid, targetCalendarUrl, user) {
    console.log(`[moveEvent] Starting to move event ${uid} to ${targetCalendarUrl}`);

    if (!uid || !targetCalendarUrl) {
      throw new Error('Event UID and target calendar URL are required');
    }

    // 1. Get the current event data
    console.log(`[moveEvent] Getting event data for ${uid}`);
    const event = await this.getEvent(uid);
    if (!event) {
      console.error(`[moveEvent] Event ${uid} not found in any calendar`);
      throw new Error(`Event ${uid} not found`);
    }
    
    console.log(`[moveEvent] Found event in source calendar:`, {
      uid: event.uid,
      summary: event.summary,
      start: event.start,
      end: event.end,
      calendarUrl: event.calendarUrl || event.calendar
    });
    
    const sourceCalendarUrl = event.calendarUrl || event.calendar;
    if (!sourceCalendarUrl) {
      throw new Error('No source calendar URL found for event');
    }
    
    if (sourceCalendarUrl === targetCalendarUrl) {
      console.log(`[moveEvent] Event ${uid} is already in the target calendar`);
      return event;
    }
    
    // 2. Get the source and target calendar info
    const sourceCalendarInfo = this.calendarClients[sourceCalendarUrl];
    const targetCalendarInfo = this.calendarClients[targetCalendarUrl];
    
    if (!sourceCalendarInfo || !sourceCalendarInfo.client) {
      throw new Error(`No client found for source calendar: ${sourceCalendarUrl}`);
    }
    
    if (!targetCalendarInfo || !targetCalendarInfo.client) {
      throw new Error(`No client found for target calendar: ${targetCalendarUrl}`);
    }
    
    const sourceClient = sourceCalendarInfo.client;
    const targetClient = targetCalendarInfo.client;
    
    // 3. Fetch the event data from source calendar
    let eventObject;
    try {
      const calendarObjects = await sourceClient.fetchCalendarObjects({
        calendar: sourceCalendarInfo.calendar || { url: sourceCalendarUrl },
        expand: true
      });
      
      eventObject = calendarObjects.find(obj => 
        obj.data && obj.data.includes(`UID:${uid}`)
      );
      
      if (!eventObject) {
        throw new Error(`Event with UID ${uid} not found in source calendar`);
      }
    } catch (error) {
      console.error(`[moveEvent] Error fetching event from source calendar:`, error);
      throw new Error(`Failed to fetch event from source calendar: ${error.message}`);
    }
    
    // 4. Create the event in the target calendar
    let filename;
    let createdInTarget = false;
    
    try {
      console.log(`[moveEvent] Creating event in target calendar ${targetCalendarUrl}`);
      
      // Always use UID for filename to avoid path corruption issues
      // Using the source filename can cause issues when moving between calendars
      filename = `${uid}.ics`;
      console.log(`[moveEvent] Using filename: ${filename}`);
      
      // Add the new event to the target calendar
      await targetClient.createCalendarObject({
        calendar: targetCalendarInfo.calendar || { url: targetCalendarUrl },
        filename: filename,
        iCalString: eventObject.data
      });
      
      createdInTarget = true;
      console.log(`[moveEvent] Successfully created event in target calendar`);
      
      // 4.5. Verify the event was created by fetching it
      console.log(`[moveEvent] Verifying event was created in target...`);
      const targetObjects = await targetClient.fetchCalendarObjects({
        calendar: targetCalendarInfo.calendar || { url: targetCalendarUrl },
        expand: true
      });
      
      const verifyCreated = targetObjects.find(obj => 
        obj.data && obj.data.includes(`UID:${uid}`)
      );
      
      if (!verifyCreated) {
        throw new Error('Event creation verification failed - event not found in target calendar');
      }
      
      console.log(`[moveEvent] Verified event exists in target calendar`);
      
      // 5. Delete the event from the source calendar
      try {
        console.log(`[moveEvent] Deleting event from source calendar...`);
        await sourceClient.deleteCalendarObject({
          calendarObject: eventObject,
          etag: eventObject.etag
        });
        console.log(`[moveEvent] Successfully deleted event from source calendar`);
      } catch (deleteError) {
        // If deletion fails, we have a duplicate - try to clean up
        console.error(`[moveEvent] CRITICAL: Failed to delete event from source calendar:`, deleteError);
        console.error(`[moveEvent] Event now exists in both calendars - attempting cleanup...`);
        
        // Try to delete from target to restore original state
        try {
          console.log(`[moveEvent] Attempting to rollback - deleting from target...`);
          await targetClient.deleteCalendarObject({
            calendarObject: verifyCreated,
            etag: verifyCreated.etag
          });
          console.log(`[moveEvent] Successfully rolled back - deleted from target`);
          
          // Log the failed operation
          await auditHistory.logOperation({
            eventUid: uid,
            operation: 'MOVE',
            userEmail: user?.email,
            userName: user?.name,
            calendarUrl: sourceCalendarUrl,
            targetCalendarUrl,
            beforeState: event,
            afterState: null,
            status: 'FAILED',
            errorMessage: `Could not delete from source: ${deleteError.message}`
          });

          await logOperation('MOVE', {
            uid,
            summary: event.summary || event.content,
            calendarUrl: sourceCalendarUrl,
            targetCalendarUrl,
            status: 'FAILED',
            error: `Could not delete from source: ${deleteError.message}`
          });
          
          throw new Error(`Move failed: Could not delete from source calendar. Operation rolled back.`);
        } catch (cleanupError) {
          console.error(`[moveEvent] CRITICAL: Rollback failed:`, cleanupError);
          console.error(`[moveEvent] Event is now duplicated in both calendars!`);
          
          // Log the partial failure
          await auditHistory.logOperation({
            eventUid: uid,
            operation: 'MOVE',
            userEmail: user?.email,
            userName: user?.name,
            calendarUrl: sourceCalendarUrl,
            targetCalendarUrl,
            beforeState: event,
            afterState: event,
            status: 'PARTIAL',
            errorMessage: `Event duplicated in both calendars. Delete failed: ${deleteError.message}, Rollback failed: ${cleanupError.message}`
          });

          await logOperation('MOVE', {
            uid,
            summary: event.summary || event.content,
            calendarUrl: sourceCalendarUrl,
            targetCalendarUrl,
            status: 'PARTIAL',
            error: `Event duplicated in both calendars. Delete failed: ${deleteError.message}, Rollback failed: ${cleanupError.message}`
          });
          
          throw new Error(
            `CRITICAL: Move partially completed. Event exists in both source (${sourceCalendarUrl}) and target (${targetCalendarUrl}). ` +
            `Manual cleanup required. Original error: ${deleteError.message}`
          );
        }
      }
      
      // 6. Update the cache (invalidate both involved calendars)
      this.cache.del(`calendar:${sourceCalendarUrl}`);
      this.cache.del(`calendar:${targetCalendarUrl}`);

      // Build before and after states for audit log
      const beforeState = { ...event, calendar: sourceCalendarUrl };
      const afterState = { ...event, calendar: targetCalendarUrl };

      // Log to audit history
      await auditHistory.logOperation({
        eventUid: uid,
        operation: 'MOVE',
        userEmail: user?.email,
        userName: user?.name,
        calendarUrl: sourceCalendarUrl,
        targetCalendarUrl,
        beforeState,
        afterState,
        status: 'SUCCESS'
      });

      // Log the operation to file (legacy)
      await logOperation('MOVE', {
        uid,
        summary: event.summary || event.content,
        calendarUrl: sourceCalendarUrl,
        targetCalendarUrl,
        status: 'SUCCESS'
      });

      // 7. Return the moved event without relying on cache fetch
      // We already have the original event data; only the calendar changed.
      return {
        ...event,
        calendar: targetCalendarUrl,
        calendarUrl: targetCalendarUrl,
        updatedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`[moveEvent] Error moving event:`, error);
      throw new Error(`Failed to move event: ${error.message}`);
    }
  }
}

// Export a singleton instance
export const calendarCache = new CalendarCache();
