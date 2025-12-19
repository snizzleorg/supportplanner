/**
 * Tests for /api/events/search-events endpoint
 * 
 * Tests comprehensive search functionality across:
 * - Event titles (summary)
 * - Event descriptions
 * - All metadata fields (orderNumber, ticketLink, systemType, etc.)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import session from 'express-session';

// Mock modules BEFORE importing the router
vi.mock('../../services/calendar.js', () => ({
  calendarCache: {
    cache: {
      keys: vi.fn()
    },
    getEvents: vi.fn()
  }
}));

vi.mock('../../services/event-type.js', () => ({
  getEventType: vi.fn()
}));

vi.mock('../../services/geocoding.js', () => ({
  geocodeLocations: vi.fn()
}));

vi.mock('../../config/index.js', () => ({
  loadEventTypesConfig: vi.fn(),
  getEventTypes: vi.fn(() => ({}))
}));

// Now import the router and mocked services
import eventsRouter from '../events.js';
import { calendarCache } from '../../services/calendar.js';

// Create test app
function createTestApp() {
  const app = express();
  app.use(express.json());
  
  // Mock authentication middleware (before session)
  app.use((req, res, next) => {
    req.session = {
      user: {
        email: 'test@example.com',
        name: 'Test User',
        role: 'reader'
      },
      // Mock session methods
      touch: vi.fn(),
      save: vi.fn((cb) => cb && cb()),
      regenerate: vi.fn((cb) => cb && cb()),
      destroy: vi.fn((cb) => cb && cb()),
      reload: vi.fn((cb) => cb && cb())
    };
    next();
  });
  
  app.use('/api/events', eventsRouter);
  return app;
}

describe('GET /api/events/search-events', () => {
  let app;
  
  beforeEach(() => {
    app = createTestApp();
    vi.clearAllMocks();
    
    // Default mock setup
    calendarCache.cache.keys.mockReturnValue([
      'calendar:https://example.com/cal1',
      'calendar:https://example.com/cal2'
    ]);
  });
  
  describe('Parameter validation', () => {
    it('should return 400 if no search parameter provided', async () => {
      const response = await request(app)
        .get('/api/events/search-events')
        .expect(400);
      
      expect(response.body).toEqual({
        success: false,
        error: 'Search parameter required (orderNumber or query)'
      });
    });
    
    it('should accept orderNumber parameter', async () => {
      calendarCache.getEvents.mockResolvedValue({
        events: []
      });
      
      const response = await request(app)
        .get('/api/events/search-events?orderNumber=12345')
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
    it('should accept query parameter', async () => {
      calendarCache.getEvents.mockResolvedValue({
        events: []
      });
      
      const response = await request(app)
        .get('/api/events/search-events?query=test')
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
    it('should prefer orderNumber over query if both provided', async () => {
      calendarCache.getEvents.mockResolvedValue({
        events: [{
          uid: 'test-uid',
          summary: 'Order 12345',
          start: '2025-01-01',
          end: '2025-01-02',
          meta: { orderNumber: '12345' }
        }]
      });
      
      const response = await request(app)
        .get('/api/events/search-events?orderNumber=12345&query=test')
        .expect(200);
      
      expect(response.body.found).toBe(true);
      expect(response.body.events[0].meta.orderNumber).toBe('12345');
    });
  });
  
  describe('Search in title (summary)', () => {
    it('should find events by title', async () => {
      calendarCache.getEvents.mockResolvedValue({
        events: [
          {
            uid: 'event-1',
            summary: 'MT100 Installation',
            start: '2025-01-01',
            end: '2025-01-02',
            description: 'Test description',
            meta: {}
          },
          {
            uid: 'event-2',
            summary: 'FT300 Installation',
            start: '2025-01-03',
            end: '2025-01-04',
            description: 'Another description',
            meta: {}
          }
        ]
      });
      
      const response = await request(app)
        .get('/api/events/search-events?query=MT100')
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.found).toBe(true);
      expect(response.body.count).toBe(1);
      expect(response.body.events[0].summary).toBe('MT100 Installation');
    });
    
    it('should be case-insensitive', async () => {
      calendarCache.getEvents.mockResolvedValue({
        events: [{
          uid: 'event-1',
          summary: 'MT100 Installation',
          start: '2025-01-01',
          end: '2025-01-02',
          meta: {}
        }]
      });
      
      const response = await request(app)
        .get('/api/events/search-events?query=mt100')
        .expect(200);
      
      expect(response.body.found).toBe(true);
      expect(response.body.count).toBe(1);
    });
    
    it('should support partial matches', async () => {
      calendarCache.getEvents.mockResolvedValue({
        events: [{
          uid: 'event-1',
          summary: 'MT100 Installation Washington',
          start: '2025-01-01',
          end: '2025-01-02',
          meta: {}
        }]
      });
      
      const response = await request(app)
        .get('/api/events/search-events?query=Wash')
        .expect(200);
      
      expect(response.body.found).toBe(true);
      expect(response.body.count).toBe(1);
    });
  });
  
  describe('Search in description', () => {
    it('should find events by description', async () => {
      calendarCache.getEvents.mockResolvedValue({
        events: [{
          uid: 'event-1',
          summary: 'Installation',
          start: '2025-01-01',
          end: '2025-01-02',
          description: 'Install MT100 in Washington',
          meta: {}
        }]
      });
      
      const response = await request(app)
        .get('/api/events/search-events?query=Washington')
        .expect(200);
      
      expect(response.body.found).toBe(true);
      expect(response.body.count).toBe(1);
    });
  });
  
  describe('Search in location', () => {
    it('should find events by city name', async () => {
      calendarCache.getEvents.mockResolvedValue({
        events: [{
          uid: 'event-1',
          summary: 'Installation',
          start: '2025-01-01',
          end: '2025-01-02',
          location: '123 High Street, London, UK',
          meta: {}
        }]
      });
      
      const response = await request(app)
        .get('/api/events/search-events?query=London')
        .expect(200);
      
      expect(response.body.found).toBe(true);
      expect(response.body.count).toBe(1);
      expect(response.body.events[0].location).toBe('123 High Street, London, UK');
    });
    
    it('should find events by country', async () => {
      calendarCache.getEvents.mockResolvedValue({
        events: [
          {
            uid: 'event-1',
            summary: 'Installation UK',
            start: '2025-01-01',
            end: '2025-01-02',
            location: 'Manchester, United Kingdom',
            meta: {}
          },
          {
            uid: 'event-2',
            summary: 'Installation Germany',
            start: '2025-01-03',
            end: '2025-01-04',
            location: 'Berlin, Germany',
            meta: {}
          }
        ]
      });
      
      const response = await request(app)
        .get('/api/events/search-events?query=Germany')
        .expect(200);
      
      expect(response.body.found).toBe(true);
      expect(response.body.count).toBe(1);
      expect(response.body.events[0].uid).toBe('event-2');
    });
    
    it('should find events by country code in location', async () => {
      calendarCache.getEvents.mockResolvedValue({
        events: [{
          uid: 'event-1',
          summary: 'Service Visit',
          start: '2025-01-01',
          end: '2025-01-02',
          location: 'New York, USA',
          meta: {}
        }]
      });
      
      const response = await request(app)
        .get('/api/events/search-events?query=USA')
        .expect(200);
      
      expect(response.body.found).toBe(true);
      expect(response.body.count).toBe(1);
    });
    
    it('should be case-insensitive for location search', async () => {
      calendarCache.getEvents.mockResolvedValue({
        events: [{
          uid: 'event-1',
          summary: 'Installation',
          start: '2025-01-01',
          end: '2025-01-02',
          location: 'BERLIN, GERMANY',
          meta: {}
        }]
      });
      
      const response = await request(app)
        .get('/api/events/search-events?query=berlin')
        .expect(200);
      
      expect(response.body.found).toBe(true);
      expect(response.body.count).toBe(1);
    });
  });
  
  describe('Search in metadata', () => {
    it('should find events by order number', async () => {
      calendarCache.getEvents.mockResolvedValue({
        events: [{
          uid: 'event-1',
          summary: 'Installation',
          start: '2025-01-01',
          end: '2025-01-02',
          meta: { orderNumber: '215648' }
        }]
      });
      
      const response = await request(app)
        .get('/api/events/search-events?orderNumber=215648')
        .expect(200);
      
      expect(response.body.found).toBe(true);
      expect(response.body.count).toBe(1);
      expect(response.body.events[0].meta.orderNumber).toBe('215648');
    });
    
    it('should find events by system type', async () => {
      calendarCache.getEvents.mockResolvedValue({
        events: [{
          uid: 'event-1',
          summary: 'Installation',
          start: '2025-01-01',
          end: '2025-01-02',
          meta: { systemType: 'MT100' }
        }]
      });
      
      const response = await request(app)
        .get('/api/events/search-events?query=MT100')
        .expect(200);
      
      expect(response.body.found).toBe(true);
      expect(response.body.events[0].meta.systemType).toBe('MT100');
    });
    
    it('should find events by ticket link', async () => {
      calendarCache.getEvents.mockResolvedValue({
        events: [{
          uid: 'event-1',
          summary: 'Installation',
          start: '2025-01-01',
          end: '2025-01-02',
          meta: { ticketLink: 'https://helpdesk.example.com/ticket/12345' }
        }]
      });
      
      const response = await request(app)
        .get('/api/events/search-events?query=12345')
        .expect(200);
      
      expect(response.body.found).toBe(true);
    });
    
    it('should handle numeric order numbers', async () => {
      calendarCache.getEvents.mockResolvedValue({
        events: [{
          uid: 'event-1',
          summary: 'Installation',
          start: '2025-01-01',
          end: '2025-01-02',
          meta: { orderNumber: 215648 } // Number instead of string
        }]
      });
      
      const response = await request(app)
        .get('/api/events/search-events?orderNumber=215648')
        .expect(200);
      
      expect(response.body.found).toBe(true);
    });
  });
  
  describe('Multiple results', () => {
    it('should return all matching events', async () => {
      calendarCache.getEvents.mockResolvedValue({
        events: [
          {
            uid: 'event-1',
            summary: 'MT100 Installation',
            start: '2025-01-01',
            end: '2025-01-02',
            meta: { systemType: 'MT100' }
          },
          {
            uid: 'event-2',
            summary: 'MT200 Installation',
            start: '2025-01-03',
            end: '2025-01-04',
            meta: { systemType: 'MT200' }
          },
          {
            uid: 'event-3',
            summary: 'Service Visit',
            start: '2025-01-05',
            end: '2025-01-06',
            description: 'MT100 service',
            meta: {}
          }
        ]
      });
      
      const response = await request(app)
        .get('/api/events/search-events?query=MT')
        .expect(200);
      
      expect(response.body.found).toBe(true);
      expect(response.body.count).toBe(3);
      expect(response.body.events).toHaveLength(3);
    });
    
    it('should include event links for all results', async () => {
      calendarCache.getEvents.mockResolvedValue({
        events: [
          {
            uid: 'event-1',
            summary: 'MT100 Installation',
            start: '2025-01-01',
            end: '2025-01-02',
            meta: {}
          },
          {
            uid: 'event-2',
            summary: 'MT200 Installation',
            start: '2025-01-03',
            end: '2025-01-04',
            meta: {}
          }
        ]
      });
      
      const response = await request(app)
        .get('/api/events/search-events?query=MT')
        .expect(200);
      
      expect(response.body.events[0].link).toContain('#event=event-1');
      expect(response.body.events[1].link).toContain('#event=event-2');
    });
  });
  
  describe('No results', () => {
    it('should return not found message when no matches', async () => {
      calendarCache.getEvents.mockResolvedValue({
        events: [{
          uid: 'event-1',
          summary: 'Installation',
          start: '2025-01-01',
          end: '2025-01-02',
          meta: {}
        }]
      });
      
      const response = await request(app)
        .get('/api/events/search-events?query=nonexistent')
        .expect(200);
      
      expect(response.body).toEqual({
        success: true,
        found: false,
        message: 'No events found matching: nonexistent'
      });
    });
  });
  
  describe('Date range filtering', () => {
    it('should use default date range if not specified', async () => {
      calendarCache.getEvents.mockResolvedValue({
        events: []
      });
      
      await request(app)
        .get('/api/events/search-events?query=test')
        .expect(200);
      
      // Default is ±5 years from today
      const now = new Date();
      const expectedFrom = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate()).toISOString().split('T')[0];
      const expectedTo = new Date(now.getFullYear() + 5, now.getMonth(), now.getDate()).toISOString().split('T')[0];
      
      expect(calendarCache.getEvents).toHaveBeenCalledWith(
        expect.any(Array),
        expectedFrom,
        expectedTo
      );
    });
    
    it('should accept custom date range', async () => {
      calendarCache.getEvents.mockResolvedValue({
        events: []
      });
      
      await request(app)
        .get('/api/events/search-events?query=test&from=2025-01-01&to=2025-12-31')
        .expect(200);
      
      expect(calendarCache.getEvents).toHaveBeenCalledWith(
        expect.any(Array),
        '2025-01-01',
        '2025-12-31'
      );
    });
  });
  
  describe('Error handling', () => {
    it('should handle calendar cache errors', async () => {
      calendarCache.getEvents.mockRejectedValue(new Error('Cache error'));
      
      const response = await request(app)
        .get('/api/events/search-events?query=test')
        .expect(500);
      
      expect(response.body).toEqual({
        success: false,
        error: 'Failed to search events',
        details: 'Cache error'
      });
    });
    
    it('should handle events without metadata gracefully', async () => {
      calendarCache.getEvents.mockResolvedValue({
        events: [{
          uid: 'event-1',
          summary: 'Installation',
          start: '2025-01-01',
          end: '2025-01-02',
          meta: null // No metadata
        }]
      });
      
      const response = await request(app)
        .get('/api/events/search-events?query=Installation')
        .expect(200);
      
      expect(response.body.found).toBe(true);
    });
  });
  
  describe('Response format', () => {
    it('should include all required fields in response', async () => {
      calendarCache.getEvents.mockResolvedValue({
        events: [{
          uid: 'event-1',
          summary: 'Test Event',
          start: '2025-01-01',
          end: '2025-01-02',
          description: 'Test description',
          meta: { orderNumber: '12345' }
        }]
      });
      
      const response = await request(app)
        .get('/api/events/search-events?query=Test')
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('found', true);
      expect(response.body).toHaveProperty('events');
      expect(response.body).toHaveProperty('count', 1);
      
      const event = response.body.events[0];
      expect(event).toHaveProperty('uid');
      expect(event).toHaveProperty('summary');
      expect(event).toHaveProperty('start');
      expect(event).toHaveProperty('end');
      expect(event).toHaveProperty('description');
      expect(event).toHaveProperty('meta');
      expect(event).toHaveProperty('link');
    });
  });
});
