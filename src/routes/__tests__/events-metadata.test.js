import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import eventsRouter from '../events.js';

// Mock auth middleware to bypass authentication in tests
vi.mock('../../middleware/auth.js', () => ({
  requireRole: () => (req, res, next) => next(),
  initializeAuth: () => (req, res, next) => next()
}));

// Mock the calendar cache to avoid needing real CalDAV connection
vi.mock('../../services/calendar.js', () => {
  const mockEvents = new Map();
  let eventCounter = 0;

  return {
    calendarCache: {
      createAllDayEvent: vi.fn(async ({ calendarUrl, summary, description, location, start, end, meta }) => {
        eventCounter++;
        const uid = `test-event-${eventCounter}`;
        const event = {
          uid,
          summary,
          description: description || '',
          location: location || '',
          start,
          end,
          meta: meta || null,
          calendarUrl,
          calendar: calendarUrl
        };
        mockEvents.set(uid, event);
        console.log('[MOCK] Created event:', event);
        return event;
      }),

      updateEvent: vi.fn(async (uid, updateData) => {
        const event = mockEvents.get(uid);
        if (!event) {
          throw new Error(`Event ${uid} not found`);
        }

        console.log('[MOCK] Updating event:', uid, 'with data:', updateData);

        // Simulate backend metadata extraction logic
        let cleanDescription = updateData.description;
        let metaToUse = updateData.meta;

        // If description contains YAML, extract it
        if (updateData.description) {
          const fenceRe = /```\s*yaml\s*\n([\s\S]*?)```\s*$/i;
          const match = updateData.description.match(fenceRe);
          if (match) {
            cleanDescription = updateData.description.replace(fenceRe, '').trimEnd();
            // In real code, this would parse YAML
            console.log('[MOCK] Found YAML in description (not parsing in mock)');
          }
        }

        // If no new metadata provided (undefined, not null), preserve existing
        // If explicitly set to null, clear it
        if (metaToUse === undefined && event.meta) {
          metaToUse = event.meta;
          console.log('[MOCK] Preserving existing metadata:', metaToUse);
        }

        const updatedEvent = {
          ...event,
          ...updateData,
          description: cleanDescription !== undefined ? cleanDescription : event.description,
          meta: metaToUse,
          updatedAt: new Date().toISOString()
        };

        mockEvents.set(uid, updatedEvent);
        console.log('[MOCK] Updated event:', updatedEvent);
        return updatedEvent;
      }),

      getEvent: vi.fn(async (uid) => {
        const event = mockEvents.get(uid);
        console.log('[MOCK] Getting event:', uid, 'found:', !!event);
        return event || null;
      }),

      deleteEvent: vi.fn(async (uid) => {
        const existed = mockEvents.has(uid);
        mockEvents.delete(uid);
        console.log('[MOCK] Deleted event:', uid, 'existed:', existed);
        return existed;
      }),

      refreshAllCalendars: vi.fn(async () => {
        console.log('[MOCK] Refresh calendars called');
        return Promise.resolve();
      })
    }
  };
});

describe('Events API - Metadata Handling', () => {
  let app;
  let createdEventUid;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/events', eventsRouter);
  });

  describe('POST /api/events/all-day - Create with metadata', () => {
    it('should create event with metadata and return it', async () => {
      const eventData = {
        calendarUrl: 'https://test.example.com/calendars/test',
        summary: 'Test Event with Metadata',
        description: 'This is a test event',
        location: 'Test Location',
        start: '2025-01-15',
        end: '2025-01-15',
        meta: {
          orderNumber: 'SO-12345',
          ticketLink: 'https://ticket.example.com/123',
          systemType: 'Laser Q-Switch'
        }
      };

      const response = await request(app)
        .post('/api/events/all-day')
        .send(eventData)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('event');
      
      const event = response.body.event;
      expect(event).toHaveProperty('uid');
      expect(event.summary).toBe(eventData.summary);
      expect(event.description).toBe(eventData.description);
      expect(event.location).toBe(eventData.location);
      expect(event.meta).toEqual(eventData.meta);

      // Save for later tests
      createdEventUid = event.uid;
    });

    it('should create event without metadata', async () => {
      const eventData = {
        calendarUrl: 'https://test.example.com/calendars/test',
        summary: 'Test Event without Metadata',
        description: 'No metadata here',
        start: '2025-01-16',
        end: '2025-01-16'
        // No meta field
      };

      const response = await request(app)
        .post('/api/events/all-day')
        .send(eventData)
        .expect(200);

      expect(response.body.success).toBe(true);
      const event = response.body.event;
      expect(event.meta).toBeNull();
    });
  });

  describe('PUT /api/events/:uid - Update metadata', () => {
    it('should update event metadata', async () => {
      // First create an event
      const createResponse = await request(app)
        .post('/api/events/all-day')
        .send({
          calendarUrl: 'https://test.example.com/calendars/test',
          summary: 'Event to Update',
          description: 'Original description',
          start: '2025-01-20',
          end: '2025-01-20',
          meta: {
            orderNumber: 'SO-111',
            ticketLink: 'https://old.link'
          }
        })
        .expect(200);

      const uid = createResponse.body.event.uid;

      // Update with new metadata
      const updateResponse = await request(app)
        .put(`/api/events/${uid}`)
        .send({
          summary: 'Updated Event',
          description: 'Updated description',
          start: '2025-01-20',
          end: '2025-01-20',
          meta: {
            orderNumber: 'SO-222',
            ticketLink: 'https://new.link',
            systemType: 'New System'
          }
        })
        .expect(200);

      expect(updateResponse.body.success).toBe(true);
      const updatedEvent = updateResponse.body.event;
      
      expect(updatedEvent.summary).toBe('Updated Event');
      expect(updatedEvent.description).toBe('Updated description');
      expect(updatedEvent.meta).toEqual({
        orderNumber: 'SO-222',
        ticketLink: 'https://new.link',
        systemType: 'New System'
      });
    });

    it('should preserve metadata when updating only description', async () => {
      // Create event with metadata
      const createResponse = await request(app)
        .post('/api/events/all-day')
        .send({
          calendarUrl: 'https://test.example.com/calendars/test',
          summary: 'Event with Metadata',
          description: 'Original',
          start: '2025-01-25',
          end: '2025-01-25',
          meta: {
            orderNumber: 'SO-999',
            ticketLink: 'https://preserve.me'
          }
        })
        .expect(200);

      const uid = createResponse.body.event.uid;

      // Update only description, no meta field sent
      const updateResponse = await request(app)
        .put(`/api/events/${uid}`)
        .send({
          summary: 'Event with Metadata',
          description: 'Updated description only',
          start: '2025-01-25',
          end: '2025-01-25'
          // No meta field - should preserve existing
        })
        .expect(200);

      expect(updateResponse.body.success).toBe(true);
      const updatedEvent = updateResponse.body.event;
      
      expect(updatedEvent.description).toBe('Updated description only');
      // Metadata should be preserved
      expect(updatedEvent.meta).toEqual({
        orderNumber: 'SO-999',
        ticketLink: 'https://preserve.me'
      });
    });

    it('should clear metadata when explicitly set to empty', async () => {
      // Create event with metadata
      const createResponse = await request(app)
        .post('/api/events/all-day')
        .send({
          calendarUrl: 'https://test.example.com/calendars/test',
          summary: 'Event to Clear',
          start: '2025-01-30',
          end: '2025-01-30',
          meta: {
            orderNumber: 'SO-CLEAR'
          }
        })
        .expect(200);

      const uid = createResponse.body.event.uid;

      // Update with explicit null/undefined meta
      const updateResponse = await request(app)
        .put(`/api/events/${uid}`)
        .send({
          summary: 'Event to Clear',
          start: '2025-01-30',
          end: '2025-01-30',
          meta: null
        })
        .expect(200);

      expect(updateResponse.body.success).toBe(true);
      expect(updateResponse.body.event.meta).toBeNull();
    });
  });

  describe('GET /api/events/:uid - Retrieve with metadata', () => {
    it('should retrieve event with metadata intact', async () => {
      // Create event
      const createResponse = await request(app)
        .post('/api/events/all-day')
        .send({
          calendarUrl: 'https://test.example.com/calendars/test',
          summary: 'Event to Retrieve',
          description: 'Test retrieval',
          start: '2025-02-01',
          end: '2025-02-01',
          meta: {
            orderNumber: 'SO-RETRIEVE',
            ticketLink: 'https://retrieve.test',
            systemType: 'Retrieval System'
          }
        })
        .expect(200);

      const uid = createResponse.body.event.uid;

      // Retrieve event
      const getResponse = await request(app)
        .get(`/api/events/${uid}`)
        .expect(200);

      expect(getResponse.body.success).toBe(true);
      const event = getResponse.body.event;
      expect(event.uid).toBe(uid);
      expect(event.meta).toEqual({
        orderNumber: 'SO-RETRIEVE',
        ticketLink: 'https://retrieve.test',
        systemType: 'Retrieval System'
      });
    });
  });

  describe('Complete round-trip test', () => {
    it('should maintain metadata through create → read → update → read cycle', async () => {
      // 1. Create
      const createData = {
        calendarUrl: 'https://test.example.com/calendars/test',
        summary: 'Round Trip Test',
        description: 'Initial description',
        start: '2025-03-01',
        end: '2025-03-01',
        meta: {
          orderNumber: 'SO-ROUND-TRIP',
          ticketLink: 'https://roundtrip.test'
        }
      };

      const createResponse = await request(app)
        .post('/api/events/all-day')
        .send(createData)
        .expect(200);

      const uid = createResponse.body.event.uid;
      expect(createResponse.body.event.meta).toEqual(createData.meta);

      // 2. Read
      const getResponse1 = await request(app)
        .get(`/api/events/${uid}`)
        .expect(200);

      expect(getResponse1.body.success).toBe(true);
      expect(getResponse1.body.event.meta).toEqual(createData.meta);

      // 3. Update (add field, modify field)
      const updateResponse = await request(app)
        .put(`/api/events/${uid}`)
        .send({
          summary: 'Round Trip Test - Updated',
          description: 'Updated description',
          start: '2025-03-01',
          end: '2025-03-01',
          meta: {
            orderNumber: 'SO-ROUND-TRIP-UPDATED',
            ticketLink: 'https://roundtrip.test',
            systemType: 'Added System'
          }
        })
        .expect(200);

      expect(updateResponse.body.event.meta).toEqual({
        orderNumber: 'SO-ROUND-TRIP-UPDATED',
        ticketLink: 'https://roundtrip.test',
        systemType: 'Added System'
      });

      // 4. Read again
      const getResponse2 = await request(app)
        .get(`/api/events/${uid}`)
        .expect(200);

      expect(getResponse2.body.success).toBe(true);
      expect(getResponse2.body.event.meta).toEqual({
        orderNumber: 'SO-ROUND-TRIP-UPDATED',
        ticketLink: 'https://roundtrip.test',
        systemType: 'Added System'
      });
    });
  });
});
