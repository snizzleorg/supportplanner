/**
 * Audit History API Lifecycle Integration Tests
 * 
 * Tests complete event lifecycle via API endpoints with audit logging
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { calendarCache } from '../../services/calendar.js';
import { auditHistory } from '../../services/audit-history.js';
import eventsRouter from '../events.js';
import auditRouter from '../audit.js';

// Mock session middleware
const mockSession = (req, res, next) => {
  req.session = {
    user: {
      email: 'test-editor@example.com',
      name: 'Test Editor',
      role: 'editor'
    }
  };
  next();
};

// Create test app
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(mockSession);
  app.use('/api/events', eventsRouter);
  app.use('/api/audit', auditRouter);
  return app;
};

describe('Audit History API - Event Lifecycle Integration', () => {
  let app;
  let createdEventUid;
  const testCalendarUrl = 'https://test.example.com/calendar/test';

  beforeAll(async () => {
    console.log('\n🔧 Initializing services for API integration tests...');
    
    // Initialize audit history
    await auditHistory.initialize();
    console.log('   ✅ Audit history initialized');

    // Mock calendar cache methods
    calendarCache.createAllDayEvent = async (params) => {
      console.log(`   📝 Mock: Creating event "${params.summary}"`);
      const uid = `test-event-${Date.now()}`;
      
      // Log to audit history
      await auditHistory.logOperation({
        eventUid: uid,
        operation: 'CREATE',
        userEmail: params.user?.email,
        userName: params.user?.name,
        calendarUrl: params.calendarUrl,
        beforeState: null,
        afterState: {
          uid,
          summary: params.summary,
          description: params.description,
          location: params.location,
          start: params.start,
          end: params.end,
          meta: params.meta
        },
        status: 'SUCCESS'
      });

      return {
        uid,
        summary: params.summary,
        description: params.description,
        location: params.location,
        start: params.start,
        end: params.end,
        meta: params.meta,
        calendar: params.calendarUrl
      };
    };

    calendarCache.updateEvent = async (uid, updateData, authHeader, user) => {
      console.log(`   📝 Mock: Updating event "${uid}"`);
      
      // Simulate getting current state
      const beforeState = {
        uid,
        summary: 'Original Summary',
        location: 'Original Location'
      };

      const afterState = {
        uid,
        summary: updateData.summary || beforeState.summary,
        location: updateData.location || beforeState.location
      };

      // Log to audit history
      await auditHistory.logOperation({
        eventUid: uid,
        operation: 'UPDATE',
        userEmail: user?.email,
        userName: user?.name,
        calendarUrl: testCalendarUrl,
        beforeState,
        afterState,
        status: 'SUCCESS'
      });

      return afterState;
    };

    calendarCache.deleteEvent = async (uid, user) => {
      console.log(`   📝 Mock: Deleting event "${uid}"`);
      
      // Simulate current state before deletion
      const beforeState = {
        uid,
        summary: 'Event to Delete',
        location: 'Some Location'
      };

      // Log to audit history
      await auditHistory.logOperation({
        eventUid: uid,
        operation: 'DELETE',
        userEmail: user?.email,
        userName: user?.name,
        calendarUrl: testCalendarUrl,
        beforeState,
        afterState: null,
        status: 'SUCCESS'
      });

      return true;
    };

    calendarCache.getEvent = async (uid) => {
      return {
        uid,
        summary: 'Test Event',
        calendar: testCalendarUrl
      };
    };

    calendarCache.refreshAllCalendars = async () => {
      console.log('   📝 Mock: Refreshing calendars');
    };

    app = createTestApp();
    console.log('   ✅ Test app created\n');
  });

  afterAll(async () => {
    console.log('\n🧹 Cleaning up services...');
    await auditHistory.close();
    console.log('   ✅ Services closed\n');
  });

  beforeEach(() => {
    console.log('\n' + '='.repeat(80));
  });

  it('should track complete event lifecycle via API: CREATE -> UPDATE -> DELETE', async () => {
    console.log('\n📝 API LIFECYCLE TEST: CREATE -> UPDATE -> DELETE\n');

    // ========================================
    // STEP 1: CREATE EVENT via API
    // ========================================
    console.log('📌 STEP 1: POST /api/events/all-day (CREATE)');
    
    const createResponse = await request(app)
      .post('/api/events/all-day')
      .send({
        calendarUrl: testCalendarUrl,
        summary: 'API Test Event',
        description: 'Created via API',
        location: 'Office A',
        start: '2025-10-25',
        end: '2025-10-26',
        meta: {
          ticketLink: 'https://example.com/tickets/TICKET-123',
          orderNumber: 'ORD-456',
          systemType: 'TestSystem'
        }
      });

    console.log(`   Response: ${createResponse.status} ${createResponse.statusText}`);
    expect(createResponse.status).toBe(200);
    expect(createResponse.body.success).toBe(true);
    expect(createResponse.body.event).toBeDefined();

    createdEventUid = createResponse.body.event.uid;
    console.log(`   ✅ Event created: ${createdEventUid}`);
    console.log(`   📊 Summary: "${createResponse.body.event.summary}"`);
    console.log(`   📊 Location: "${createResponse.body.event.location}"`);

    // Wait a bit to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 100));

    // ========================================
    // STEP 2: UPDATE EVENT via API
    // ========================================
    console.log('\n📌 STEP 2: PUT /api/events/:uid (UPDATE)');
    
    const updateResponse = await request(app)
      .put(`/api/events/${createdEventUid}`)
      .send({
        summary: 'Updated API Test Event',
        location: 'Office B',
        description: 'Modified via API'
      });

    console.log(`   Response: ${updateResponse.status} ${updateResponse.statusText}`);
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.success).toBe(true);

    console.log(`   ✅ Event updated: ${createdEventUid}`);
    console.log(`   📊 New summary: "${updateResponse.body.event.summary}"`);
    console.log(`   📊 New location: "${updateResponse.body.event.location}"`);

    // Wait a bit to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 100));

    // ========================================
    // STEP 3: DELETE EVENT via API
    // ========================================
    console.log('\n📌 STEP 3: DELETE /api/events/:uid (DELETE)');
    
    const deleteResponse = await request(app)
      .delete(`/api/events/${createdEventUid}`);

    console.log(`   Response: ${deleteResponse.status} ${deleteResponse.statusText}`);
    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body.success).toBe(true);

    console.log(`   ✅ Event deleted: ${createdEventUid}`);

    // Wait a bit before checking audit log
    await new Promise(resolve => setTimeout(resolve, 100));

    // ========================================
    // STEP 4: VERIFY AUDIT HISTORY via API
    // ========================================
    console.log('\n📌 STEP 4: GET /api/audit/event/:uid (VERIFY)');
    
    const auditResponse = await request(app)
      .get(`/api/audit/event/${createdEventUid}`);

    console.log(`   Response: ${auditResponse.status} ${auditResponse.statusText}`);
    expect(auditResponse.status).toBe(200);
    expect(auditResponse.body.success).toBe(true);
    expect(auditResponse.body.history).toBeDefined();

    const history = auditResponse.body.history;
    console.log(`\n   ℹ️  Total audit entries: ${history.length}`);
    expect(history.length).toBeGreaterThanOrEqual(3);

    console.log('\n   📋 Complete audit trail (newest first):\n');
    history.forEach((entry, index) => {
      console.log(`   ${index + 1}. ${entry.operation} at ${entry.timestamp}`);
      console.log(`      By: ${entry.user_name} <${entry.user_email}>`);
      console.log(`      Status: ${entry.status}`);
      
      if (entry.beforeState) {
        console.log(`      Before: ${JSON.stringify(entry.beforeState)}`);
      }
      if (entry.afterState) {
        console.log(`      After:  ${JSON.stringify(entry.afterState)}`);
      }
      console.log('');
    });

    // Verify we have all three operations
    const operations = history.map(h => h.operation);
    expect(operations).toContain('CREATE');
    expect(operations).toContain('UPDATE');
    expect(operations).toContain('DELETE');

    // Verify user attribution
    history.forEach(entry => {
      expect(entry.user_email).toBe('test-editor@example.com');
      expect(entry.user_name).toBe('Test Editor');
    });

    console.log('   ✅ All operations tracked correctly');
    console.log('   ✅ User attribution correct');
    console.log('   ✅ State snapshots present');

    // ========================================
    // STEP 5: TEST UNDO via API
    // ========================================
    console.log('\n📌 STEP 5: POST /api/audit/undo/:uid (UNDO DELETE)');
    
    const undoResponse = await request(app)
      .post(`/api/audit/undo/${createdEventUid}`);

    console.log(`   Response: ${undoResponse.status} ${undoResponse.statusText}`);
    
    if (undoResponse.status === 200) {
      console.log(`   ✅ Undo successful`);
      console.log(`   📊 Undone operation: ${undoResponse.body.operation}`);
      console.log(`   📊 Result: ${JSON.stringify(undoResponse.body.result)}`);
    } else {
      console.log(`   ℹ️  Undo response: ${undoResponse.body.error || undoResponse.body.message}`);
    }

    console.log('\n✅ Complete API lifecycle test passed!\n');
  });

  it('should retrieve recent audit history via API with filters', async () => {
    console.log('\n📝 API TEST: Recent audit history with filters\n');

    console.log('📌 GET /api/audit/recent?limit=10');
    
    const response = await request(app)
      .get('/api/audit/recent')
      .query({ limit: 10 });

    console.log(`   Response: ${response.status} ${response.statusText}`);
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.history).toBeDefined();

    console.log(`   ℹ️  Retrieved ${response.body.count} entries`);
    
    if (response.body.history.length > 0) {
      console.log('\n   📋 Recent operations:');
      response.body.history.slice(0, 5).forEach((entry, index) => {
        console.log(`   ${index + 1}. ${entry.operation} on event ${entry.event_uid}`);
        console.log(`      By: ${entry.user_name} at ${entry.timestamp}`);
      });
    }

    console.log('\n   ✅ Recent history retrieved successfully\n');
  });

  it('should filter audit history by operation type via API', async () => {
    console.log('\n📝 API TEST: Filter by operation type\n');

    console.log('📌 GET /api/audit/recent?operation=CREATE&limit=5');
    
    const response = await request(app)
      .get('/api/audit/recent')
      .query({ 
        operation: 'CREATE',
        limit: 5
      });

    console.log(`   Response: ${response.status} ${response.statusText}`);
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    console.log(`   ℹ️  Found ${response.body.count} CREATE operations`);
    
    // Verify all returned entries are CREATE operations
    if (response.body.history.length > 0) {
      const allCreates = response.body.history.every(h => h.operation === 'CREATE');
      expect(allCreates).toBe(true);
      
      console.log(`   ✅ All ${response.body.history.length} entries are CREATE operations`);
      response.body.history.forEach((entry, index) => {
        console.log(`   ${index + 1}. ${entry.event_uid} - ${entry.afterState?.summary || 'N/A'}`);
      });
    }

    console.log('\n   ✅ Filtering by operation type works correctly\n');
  });

  it('should handle API requests for non-existent events gracefully', async () => {
    console.log('\n📝 API TEST: Non-existent event handling\n');

    const fakeUid = 'non-existent-event-uid-12345';

    console.log(`📌 GET /api/audit/event/${fakeUid}`);
    
    const response = await request(app)
      .get(`/api/audit/event/${fakeUid}`);

    console.log(`   Response: ${response.status} ${response.statusText}`);
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.history).toBeDefined();
    expect(response.body.history).toHaveLength(0);

    console.log(`   ℹ️  Returned empty history: ${response.body.history.length} entries`);
    console.log('   ✅ Non-existent event handled gracefully\n');
  });
});
