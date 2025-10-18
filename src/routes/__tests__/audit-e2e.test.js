/**
 * End-to-End Audit History Tests
 * 
 * Real integration tests that:
 * - Use actual CalDAV server (Nextcloud)
 * - Make real HTTP requests
 * - Create/update/delete real events
 * - Verify audit logging of real operations
 * 
 * These tests are SLOW but comprehensive.
 * 
 * REQUIREMENTS:
 * - Server must be running with AUTH_ENABLED=false for E2E tests
 * - Or implement proper OIDC authentication flow in tests
 * 
 * Current limitation: Tests fail with 403 if auth is enabled
 * TODO: Add authentication support or test-only bypass
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Test configuration
// When running in Docker, use service name; otherwise localhost
const API_BASE_URL = process.env.API_BASE_URL || 
                     (process.env.NODE_ENV === 'test' ? 'http://support-planner:5173' : 'http://localhost:5175');
const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'test-editor@example.com',
  name: process.env.TEST_USER_NAME || 'E2E Test User',
  role: 'editor'
};
// Track created events for cleanup
const createdEventUids = [];

// Will be populated from API
let availableCalendars = [];
let testCalendarUrl = null;

/**
 * Helper to make authenticated fetch requests with session cookie
 */
async function authenticatedFetch(url, options = {}) {
  const headers = {
    ...options.headers,
    'Cookie': sessionCookie || ''
  };
  
  if (options.method && options.method !== 'GET' && csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }
  
  return fetch(url, {
    ...options,
    headers
  });
}

let csrfToken;
let sessionCookie;

describe('Audit History E2E - Real CalDAV Operations', () => {

  beforeAll(async () => {
    console.log('\n🚀 Starting E2E Audit History Tests');
    console.log('   ⚠️  These tests use REAL CalDAV operations');
    console.log(`   🌐 API: ${API_BASE_URL}`);

    // Get CSRF token and session cookie (use regular fetch here, before we have the cookie)
    try {
      const response = await fetch(`${API_BASE_URL}/api/csrf-token`);
      const data = await response.json();
      csrfToken = data.csrfToken;
      
      // Extract session cookie from response
      const cookies = response.headers.get('set-cookie');
      if (cookies) {
        sessionCookie = cookies.split(';')[0]; // Get just the cookie value
        console.log('   ✅ CSRF token and session cookie obtained');
      } else {
        console.log('   ✅ CSRF token obtained (no session cookie)');
      }
    } catch (error) {
      console.log('   ⚠️  Could not get CSRF token:', error.message);
      console.log('   Tests may fail if CSRF protection is enabled');
    }

    // Get available calendars from API
    try {
      const calendarsResponse = await authenticatedFetch(`${API_BASE_URL}/api/calendars`);
      const calendarsData = await calendarsResponse.json();
      
      if (calendarsData.calendars && calendarsData.calendars.length > 0) {
        availableCalendars = calendarsData.calendars;
        // Use the first calendar for testing
        testCalendarUrl = availableCalendars[0].url;
        console.log(`   ✅ Found ${availableCalendars.length} calendar(s)`);
        console.log(`   📅 Using calendar: ${availableCalendars[0].displayName || availableCalendars[0].name}`);
      } else {
        console.log('   ⚠️  No calendars found - tests will fail');
      }
    } catch (error) {
      console.log('   ⚠️  Could not fetch calendars:', error.message);
    }

    console.log('\n');
  });

  afterAll(async () => {
    console.log('\n🧹 Cleaning up E2E test data...');
    
    // Wait for cache to refresh before attempting cleanup
    console.log('   ⏳ Waiting 25 seconds for final cache refresh...');
    await new Promise(resolve => setTimeout(resolve, 25000));
    
    // First, try to find all E2E test events by searching
    console.log('   🔍 Searching for E2E test events...');
    try {
      const searchResponse = await authenticatedFetch(
        `${API_BASE_URL}/api/events/search?summary=E2E&from=2025-01-01&to=2026-12-31`
      );
      
      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        const e2eEvents = searchData.events || [];
        console.log(`   📋 Found ${e2eEvents.length} E2E test events via search`);
        
        // Add any found UIDs to the cleanup list
        for (const event of e2eEvents) {
          if (event.uid && !createdEventUids.includes(event.uid)) {
            createdEventUids.push(event.uid);
          }
        }
      }
    } catch (error) {
      console.log(`   ⚠️  Search failed: ${error.message}`);
    }
    
    console.log(`   🗑️  Deleting ${createdEventUids.length} test event(s)...`);
    
    // Delete all tracked events
    let successCount = 0;
    let failCount = 0;
    
    for (const uid of createdEventUids) {
      try {
        console.log(`      Deleting: ${uid}`);
        const response = await authenticatedFetch(`${API_BASE_URL}/api/events/${uid}`, {
          method: 'DELETE',
          headers: {
            'X-CSRF-Token': csrfToken || '',
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          successCount++;
        } else {
          failCount++;
          console.log(`        ⚠️  Failed: ${response.status}`);
        }
      } catch (error) {
        failCount++;
        console.log(`        ⚠️  Error: ${error.message}`);
      }
    }

    console.log(`\n   ✅ Cleanup complete: ${successCount} deleted, ${failCount} failed\n`);
    
    if (failCount > 0) {
      console.log('   ⚠️  Some events could not be deleted.');
      console.log('   Run: node scripts/cleanup-e2e-events.js\n');
    }
  }, 60000); // 60 second timeout for cleanup with 25s wait

  it('should audit real CalDAV CREATE operation', async () => {
    console.log('\n📝 E2E TEST 1: Real CREATE operation\n');

    const eventData = {
      calendarUrl: testCalendarUrl,
      summary: `E2E Test Event ${Date.now()}`,
      description: 'Created by E2E test suite',
      location: 'E2E Test Location',
      start: '2025-11-01',
      end: '2025-11-02',
      meta: {
        ticketLink: 'https://example.com/test-ticket',
        orderNumber: `E2E-${Date.now()}`,
        systemType: 'E2E Testing'
      }
    };

    console.log('   📌 Step 1: Creating event via API');
    console.log(`      Summary: "${eventData.summary}"`);

    const createResponse = await authenticatedFetch(`${API_BASE_URL}/api/events/all-day`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(eventData)
    });

    console.log(`      Response: ${createResponse.status} ${createResponse.statusText}`);
    
    expect(createResponse.ok).toBe(true);
    
    const createResult = await createResponse.json();
    expect(createResult.success).toBe(true);
    expect(createResult.event).toBeDefined();
    expect(createResult.event.uid).toBeDefined();

    const eventUid = createResult.event.uid;
    createdEventUids.push(eventUid);

    console.log(`      ✅ Event created: ${eventUid}`);
    console.log(`      📊 Event data: ${JSON.stringify(createResult.event, null, 2).substring(0, 200)}...`);

    // Wait a bit for audit to be written
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('\n   📌 Step 2: Verifying audit history');
    const auditHistory = await getAuditHistory(eventUid);

    console.log(`      ℹ️  Found ${auditHistory.length} audit entries`);
    expect(auditHistory.length).toBeGreaterThanOrEqual(1);

    const createEntry = auditHistory.find(h => h.operation === 'CREATE');
    expect(createEntry).toBeDefined();

    console.log('\n   📋 Audit entry details:');
    console.log(`      Operation: ${createEntry.operation}`);
    console.log(`      User: ${createEntry.user_name || 'Unknown'} <${createEntry.user_email || 'Unknown'}>`);
    console.log(`      Timestamp: ${createEntry.timestamp}`);
    console.log(`      Status: ${createEntry.status}`);
    
    if (createEntry.afterState) {
      console.log(`      Summary: "${createEntry.afterState.summary}"`);
      console.log(`      Location: "${createEntry.afterState.location}"`);
      console.log(`      Start: ${createEntry.afterState.start}`);
      console.log(`      End: ${createEntry.afterState.end}`);
    }

    // Verify state snapshot
    expect(createEntry.beforeState).toBeNull();
    expect(createEntry.afterState).toBeDefined();
    expect(createEntry.afterState.summary).toBe(eventData.summary);
    expect(createEntry.afterState.location).toBe(eventData.location);

    console.log('\n   ✅ Real CalDAV CREATE operation audited correctly!\n');
  }, 35000); // 35 second timeout for real network operations

  it('should audit real CalDAV UPDATE operation', async () => {
    console.log('\n📝 E2E TEST 2: Real UPDATE operation\n');

    // First, create an event to update
    console.log('   📌 Setup: Creating initial event');
    const initialData = {
      calendarUrl: testCalendarUrl,
      summary: `E2E Update Test ${Date.now()}`,
      description: 'Initial description',
      location: 'Initial Location',
      start: '2025-11-10',
      end: '2025-11-11'
    };

    const createResponse = await authenticatedFetch(`${API_BASE_URL}/api/events/all-day`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken || ''
      },
      body: JSON.stringify(initialData)
    });

    const createResult = await createResponse.json();
    const eventUid = createResult.event.uid;
    createdEventUids.push(eventUid);

    console.log(`      ✅ Initial event created: ${eventUid}`);
    console.log(`      📊 Original: "${initialData.summary}" at ${initialData.location}`);

    // Wait for event to appear in cache
    console.log('      ⏳ Waiting for event to appear in cache (polling up to 40s)...');
    const eventInCache = await waitForEventInCache(eventUid, 40);
    if (!eventInCache) {
      throw new Error(`Event ${eventUid} did not appear in cache after 40 seconds`);
    }
    console.log('      ✅ Event found in cache!');

    // Now update it
    console.log('\n   📌 Step 1: Updating event via API');
    const updateData = {
      summary: `E2E Updated ${Date.now()}`,
      description: 'Modified description',
      location: 'Updated Location'
    };

    console.log(`      New summary: "${updateData.summary}"`);
    console.log(`      New location: "${updateData.location}"`);

    const updateResponse = await authenticatedFetch(`${API_BASE_URL}/api/events/${eventUid}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken || ''
      },
      body: JSON.stringify(updateData)
    });

    console.log(`      Response: ${updateResponse.status} ${updateResponse.statusText}`);
    expect(updateResponse.ok).toBe(true);

    const updateResult = await updateResponse.json();
    expect(updateResult.success).toBe(true);

    console.log('      ✅ Event updated successfully');

    // Wait for audit
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('\n   📌 Step 2: Verifying audit history');
    const auditHistory = await getAuditHistory(eventUid);

    console.log(`      ℹ️  Found ${auditHistory.length} audit entries`);
    expect(auditHistory.length).toBeGreaterThanOrEqual(2);

    // Find CREATE and UPDATE entries
    const createEntry = auditHistory.find(h => h.operation === 'CREATE');
    const updateEntry = auditHistory.find(h => h.operation === 'UPDATE');

    expect(createEntry).toBeDefined();
    expect(updateEntry).toBeDefined();

    console.log('\n   📋 UPDATE audit entry:');
    console.log(`      Operation: ${updateEntry.operation}`);
    console.log(`      Timestamp: ${updateEntry.timestamp}`);
    console.log(`      Status: ${updateEntry.status}`);

    if (updateEntry.beforeState && updateEntry.afterState) {
      console.log('\n   📊 State changes:');
      console.log(`      Summary: "${updateEntry.beforeState.summary}" → "${updateEntry.afterState.summary}"`);
      console.log(`      Location: "${updateEntry.beforeState.location}" → "${updateEntry.afterState.location}"`);

      // Verify before state matches original
      expect(updateEntry.beforeState.summary).toBe(initialData.summary);
      
      // Verify after state matches update
      expect(updateEntry.afterState.summary).toBe(updateData.summary);
      expect(updateEntry.afterState.location).toBe(updateData.location);
    }

    console.log('\n   ✅ Real CalDAV UPDATE operation audited correctly!\n');
  }, 50000); // 50 second timeout for real network operations with 20s cache wait

  it('should audit real CalDAV DELETE operation', async () => {
    console.log('\n📝 E2E TEST 3: Real DELETE operation\n');

    // Create an event to delete
    console.log('   📌 Setup: Creating event to delete');
    const eventData = {
      calendarUrl: testCalendarUrl,
      summary: `E2E Delete Test ${Date.now()}`,
      description: 'Will be deleted',
      location: 'Temporary Location',
      start: '2025-11-20',
      end: '2025-11-21'
    };

    const createResponse = await authenticatedFetch(`${API_BASE_URL}/api/events/all-day`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken || ''
      },
      body: JSON.stringify(eventData)
    });

    const createResult = await createResponse.json();
    const eventUid = createResult.event.uid;

    console.log(`      ✅ Event created: ${eventUid}`);
    console.log(`      📊 Event: "${eventData.summary}"`);

    // Wait for event to appear in cache
    console.log('      ⏳ Waiting for event to appear in cache (polling up to 40s)...');
    const eventInCache = await waitForEventInCache(eventUid, 40);
    if (!eventInCache) {
      throw new Error(`Event ${eventUid} did not appear in cache after 40 seconds`);
    }
    console.log('      ✅ Event found in cache!');

    // Now delete it
    console.log('\n   📌 Step 1: Deleting event via API');
    const deleteResponse = await authenticatedFetch(`${API_BASE_URL}/api/events/${eventUid}`, {
      method: 'DELETE',
      headers: {
        'X-CSRF-Token': csrfToken || ''
      }
    });

    console.log(`      Response: ${deleteResponse.status} ${deleteResponse.statusText}`);
    expect(deleteResponse.ok).toBe(true);

    const deleteResult = await deleteResponse.json();
    expect(deleteResult.success).toBe(true);

    console.log('      ✅ Event deleted successfully');

    // Wait for audit
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('\n   📌 Step 2: Verifying audit history');
    const auditHistory = await getAuditHistory(eventUid);

    console.log(`      ℹ️  Found ${auditHistory.length} audit entries`);
    expect(auditHistory.length).toBeGreaterThanOrEqual(2);

    // Find CREATE and DELETE entries
    const createEntry = auditHistory.find(h => h.operation === 'CREATE');
    const deleteEntry = auditHistory.find(h => h.operation === 'DELETE');

    expect(createEntry).toBeDefined();
    expect(deleteEntry).toBeDefined();

    console.log('\n   📋 DELETE audit entry:');
    console.log(`      Operation: ${deleteEntry.operation}`);
    console.log(`      Timestamp: ${deleteEntry.timestamp}`);
    console.log(`      Status: ${deleteEntry.status}`);

    if (deleteEntry.beforeState) {
      console.log(`      Deleted event: "${deleteEntry.beforeState.summary}"`);
      
      // Verify before state captured the event
      expect(deleteEntry.beforeState.summary).toBe(eventData.summary);
    }

    // After state should be null for DELETE
    expect(deleteEntry.afterState).toBeNull();

    console.log('\n   ✅ Real CalDAV DELETE operation audited correctly!\n');
  }, 50000); // 50 second timeout for real network operations with polling

  it('should track complete lifecycle: CREATE → UPDATE → MOVE → DELETE', async () => {
    console.log('\n📝 E2E TEST 4: Complete lifecycle with real CalDAV\n');

    const baseTimestamp = Date.now();
    const eventData = {
      calendarUrl: testCalendarUrl,
      summary: `E2E Lifecycle Test ${baseTimestamp}`,
      description: 'Lifecycle test event',
      location: 'Test Location A',
      start: '2025-12-01',
      end: '2025-12-02',
      meta: {
        orderNumber: `LIFECYCLE-${baseTimestamp}`
      }
    };

    // Step 1: CREATE
    console.log('   📌 Step 1: Creating event');
    const createResponse = await authenticatedFetch(`${API_BASE_URL}/api/events/all-day`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken || ''
      },
      body: JSON.stringify(eventData)
    });

    const createResult = await createResponse.json();
    let eventUid = createResult.event.uid;

    console.log(`      ✅ Created: ${eventUid}`);
    console.log('      ⏳ Waiting for event to appear in cache (polling up to 40s)...');
    const eventInCache = await waitForEventInCache(eventUid, 40);
    if (!eventInCache) {
      throw new Error(`Event ${eventUid} did not appear in cache after 40 seconds`);
    }
    console.log('      ✅ Event found in cache!');

    // Step 2: UPDATE
    console.log('\n   📌 Step 2: Updating event');
    const updateResponse = await authenticatedFetch(`${API_BASE_URL}/api/events/${eventUid}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken || ''
      },
      body: JSON.stringify({
        summary: `E2E Updated Lifecycle ${baseTimestamp}`,
        location: 'Test Location B'
      })
    });

    console.log(`      Response: ${updateResponse.status} ${updateResponse.statusText}`);
    expect(updateResponse.ok).toBe(true);
    
    const updateResult = await updateResponse.json();
    if (updateResult.event && updateResult.event.uid) {
      console.log(`      ✅ Updated: ${updateResult.event.uid}`);
      eventUid = updateResult.event.uid;
    } else {
      console.log('      ✅ Updated (no UID in response)');
    }
    
    console.log('      ⏳ Waiting for calendar cache refresh (20 seconds)...');
    await new Promise(resolve => setTimeout(resolve, 20000));

    // Step 3: MOVE (if we have multiple calendars)
    if (availableCalendars.length > 1) {
      console.log('\n   📌 Step 3: Moving event to different calendar');
      const targetCalendar = availableCalendars[1];
      
      const moveResponse = await authenticatedFetch(`${API_BASE_URL}/api/events/${eventUid}/move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || ''
        },
        body: JSON.stringify({
          targetCalendarUrl: targetCalendar.url
        })
      });

      console.log(`      Response: ${moveResponse.status} ${moveResponse.statusText}`);
      
      if (moveResponse.ok) {
        console.log(`      ✅ Moved to: ${targetCalendar.displayName || targetCalendar.name}`);
      } else {
        console.log('      ⚠️  Move failed, skipping MOVE wait');
      }
    } else {
      console.log('\n   ⚠️  Step 3 (MOVE): Skipped - only one calendar available');
    }

    // Wait before DELETE regardless of MOVE outcome
    console.log('      ⏳ Waiting for calendar cache refresh (20 seconds)...');
    await new Promise(resolve => setTimeout(resolve, 20000));

    // Step 4: DELETE
    console.log('\n   📌 Step 4: Deleting event');
    const deleteResponse = await authenticatedFetch(`${API_BASE_URL}/api/events/${eventUid}`, {
      method: 'DELETE',
      headers: {
        'X-CSRF-Token': csrfToken || ''
      }
    });

    console.log(`      Response: ${deleteResponse.status} ${deleteResponse.statusText}`);
    
    if (!deleteResponse.ok) {
      const errorText = await deleteResponse.text();
      console.log(`      Error: ${errorText}`);
    }
    
    expect(deleteResponse.ok).toBe(true);
    console.log('      ✅ Deleted');
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify complete audit trail
    console.log('\n   📌 Step 5: Verifying complete audit trail');
    const auditHistory = await getAuditHistory(eventUid);

    console.log(`\n      ℹ️  Found ${auditHistory.length} audit entries`);
    
    // Should have at least CREATE, UPDATE, DELETE (and possibly MOVE)
    const minExpected = availableCalendars.length > 1 ? 4 : 3;
    expect(auditHistory.length).toBeGreaterThanOrEqual(minExpected);

    const operations = auditHistory.map(h => h.operation);
    expect(operations).toContain('CREATE');
    expect(operations).toContain('UPDATE');
    expect(operations).toContain('DELETE');
    
    if (availableCalendars.length > 1) {
      // MOVE might be logged, depending on implementation
      console.log(`      📊 Operations: ${operations.join(', ')}`);
    }

    console.log('\n   📋 Complete audit trail (newest first):');
    auditHistory.forEach((entry, index) => {
      console.log(`      ${index + 1}. ${entry.operation} at ${entry.timestamp}`);
      console.log(`         Status: ${entry.status}`);
    });

    console.log('\n   ✅ Complete real CalDAV lifecycle audited correctly!\n');
  }, 240000); // 240 seconds (4 min) for complete lifecycle

  // Helper function to get audit history for an event
  async function getAuditHistory(eventUid) {
    const response = await authenticatedFetch(
      `${API_BASE_URL}/api/audit/event/${eventUid}`
    );
    const data = await response.json();
    return data.history || [];
  }

  // Helper function to wait for event to appear in cache
  async function waitForEventInCache(eventUid, maxWaitSeconds = 40) {
    const startTime = Date.now();
    const maxWaitMs = maxWaitSeconds * 1000;
    
    while (Date.now() - startTime < maxWaitMs) {
      try {
        const response = await authenticatedFetch(`${API_BASE_URL}/api/events/${eventUid}`);
        if (response.ok) {
          return true; // Event found in cache
        }
      } catch (error) {
        // Ignore errors and keep trying
      }
      // Wait 2 seconds before next attempt
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    return false; // Timeout - event not found
  }

});
