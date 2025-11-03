/**
 * Audit History Lifecycle Tests
 * 
 * Tests complete event lifecycle (CREATE -> UPDATE -> DELETE) with audit logging
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuditHistoryService } from '../audit-history.js';
import fs from 'fs/promises';
import path from 'path';

describe('Audit History - Event Lifecycle', () => {
  let auditService;
  let testDbPath;

  beforeEach(async () => {
    // Use a unique database file for each test
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    testDbPath = path.join(process.cwd(), 'data', `test-lifecycle-${timestamp}-${random}.db`);
    
    auditService = new AuditHistoryService();
    
    // Override initialize to use test database
    auditService.initialize = async function() {
      const sqlite3 = (await import('sqlite3')).default;
      const { open } = await import('sqlite');
      
      this.db = await open({
        filename: testDbPath,
        driver: sqlite3.Database
      });
      
      await this.db.exec('PRAGMA foreign_keys = ON');
      
      await this.db.exec(`
        CREATE TABLE IF NOT EXISTS audit_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event_uid TEXT NOT NULL,
          operation TEXT NOT NULL,
          user_email TEXT,
          user_name TEXT,
          timestamp TEXT NOT NULL,
          calendar_url TEXT NOT NULL,
          target_calendar_url TEXT,
          before_state TEXT,
          after_state TEXT,
          status TEXT NOT NULL DEFAULT 'SUCCESS',
          error_message TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
      
      await this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_event_uid ON audit_history(event_uid);
        CREATE INDEX IF NOT EXISTS idx_timestamp ON audit_history(timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_user_email ON audit_history(user_email);
        CREATE INDEX IF NOT EXISTS idx_operation ON audit_history(operation);
        CREATE INDEX IF NOT EXISTS idx_calendar_url ON audit_history(calendar_url);
      `);
      
      this.isInitialized = true;
    };
    
    await auditService.initialize();
    console.log('\n🔧 Test database initialized');
  });

  afterEach(async () => {
    if (auditService && auditService.db) {
      try {
        await auditService.close();
      } catch (error) {
        console.error('Error closing database:', error);
      }
    }
    
    // Remove all test database files
    if (testDbPath) {
      try {
        await fs.unlink(testDbPath);
      } catch (error) {}
      try {
        await fs.unlink(testDbPath + '-journal');
      } catch (error) {}
      try {
        await fs.unlink(testDbPath + '-shm');
      } catch (error) {}
      try {
        await fs.unlink(testDbPath + '-wal');
      } catch (error) {}
    }
  });

  it('should track complete event lifecycle: CREATE -> UPDATE -> DELETE', async () => {
    console.log('\n📝 Starting event lifecycle test...\n');

    const eventUid = 'lifecycle-test-event-123';
    const userEmail = 'test-user@example.com';
    const userName = 'Test User';
    const calendarUrl = 'https://example.com/calendar/test';

    // ========================================
    // STEP 1: CREATE EVENT
    // ========================================
    console.log('📌 STEP 1: Creating new event');
    const createState = {
      uid: eventUid,
      summary: 'Test Event',
      description: 'Initial description',
      location: 'Office',
      start: '2025-10-20',
      end: '2025-10-21',
      allDay: true,
      meta: { 
        ticketLink: 'https://example.com/tickets/TICKET-001',
        orderNumber: 'ORD-001'
      }
    };

    const createId = await auditService.logOperation({
      eventUid,
      operation: 'CREATE',
      userEmail,
      userName,
      calendarUrl,
      beforeState: null,
      afterState: createState,
      status: 'SUCCESS'
    });

    console.log(`   ✅ CREATE logged (audit ID: ${createId})`);
    console.log(`   📊 After state: summary="${createState.summary}", location="${createState.location}"`);
    expect(createId).toBeGreaterThan(0);

    // ========================================
    // STEP 2: UPDATE EVENT
    // ========================================
    console.log('\n📌 STEP 2: Updating event');
    const updateBeforeState = { ...createState };
    const updateAfterState = {
      ...createState,
      summary: 'Updated Test Event',
      description: 'Modified description',
      location: 'Remote',
      meta: { 
        ticketLink: 'https://example.com/tickets/TICKET-002',
        orderNumber: 'ORD-002'
      }
    };

    const updateId = await auditService.logOperation({
      eventUid,
      operation: 'UPDATE',
      userEmail,
      userName,
      calendarUrl,
      beforeState: updateBeforeState,
      afterState: updateAfterState,
      status: 'SUCCESS'
    });

    console.log(`   ✅ UPDATE logged (audit ID: ${updateId})`);
    console.log(`   📊 Before: summary="${updateBeforeState.summary}", location="${updateBeforeState.location}"`);
    console.log(`   📊 After:  summary="${updateAfterState.summary}", location="${updateAfterState.location}"`);
    expect(updateId).toBeGreaterThan(0);

    // ========================================
    // STEP 3: DELETE EVENT
    // ========================================
    console.log('\n📌 STEP 3: Deleting event');
    const deleteBeforeState = { ...updateAfterState };

    const deleteId = await auditService.logOperation({
      eventUid,
      operation: 'DELETE',
      userEmail,
      userName,
      calendarUrl,
      beforeState: deleteBeforeState,
      afterState: null,
      status: 'SUCCESS'
    });

    console.log(`   ✅ DELETE logged (audit ID: ${deleteId})`);
    console.log(`   📊 Deleted state: summary="${deleteBeforeState.summary}"`);
    expect(deleteId).toBeGreaterThan(0);

    // ========================================
    // VERIFICATION: Check Audit History
    // ========================================
    console.log('\n📌 VERIFICATION: Retrieving complete audit history');
    const history = await auditService.getEventHistory(eventUid);

    console.log(`   ℹ️  Total audit entries: ${history.length}`);
    expect(history).toHaveLength(3);

    // Verify order (newest first)
    console.log('\n   📋 Audit log entries (newest first):');
    history.forEach((entry, index) => {
      console.log(`\n   ${index + 1}. ${entry.operation} (${entry.timestamp})`);
      console.log(`      User: ${entry.user?.name} <${entry.user?.email}>`);
      console.log(`      Status: ${entry.status}`);
      
      if (entry.beforeState) {
        console.log(`      Before: ${JSON.stringify(entry.beforeState, null, 8).replace(/\n/g, '\n      ')}`);
      } else {
        console.log(`      Before: null`);
      }
      
      if (entry.afterState) {
        console.log(`      After:  ${JSON.stringify(entry.afterState, null, 8).replace(/\n/g, '\n      ')}`);
      } else {
        console.log(`      After:  null`);
      }
    });

    // Verify DELETE (most recent)
    expect(history[0].operation).toBe('DELETE');
    expect(history[0].user?.email).toBe(userEmail);
    expect(history[0].beforeState).toBeDefined();
    expect(history[0].beforeState.summary).toBe('Updated Test Event');
    expect(history[0].afterState).toBeNull();

    // Verify UPDATE (middle)
    expect(history[1].operation).toBe('UPDATE');
    expect(history[1].beforeState).toBeDefined();
    expect(history[1].beforeState.summary).toBe('Test Event');
    expect(history[1].afterState).toBeDefined();
    expect(history[1].afterState.summary).toBe('Updated Test Event');

    // Verify CREATE (oldest)
    expect(history[2].operation).toBe('CREATE');
    expect(history[2].beforeState).toBeNull();
    expect(history[2].afterState).toBeDefined();
    expect(history[2].afterState.summary).toBe('Test Event');

    // ========================================
    // UNDO TEST: Verify previous state
    // ========================================
    console.log('\n📌 UNDO TEST: Getting previous state for undo');
    const previousState = await auditService.getPreviousState(eventUid);

    expect(previousState).toBeDefined();
    expect(previousState.operation).toBe('DELETE');
    expect(previousState.state).toBeDefined();
    expect(previousState.state.summary).toBe('Updated Test Event');

    console.log(`   ✅ Previous state available for undo`);
    console.log(`   📊 Can restore to: summary="${previousState.state.summary}", location="${previousState.state.location}"`);

    console.log('\n✅ Event lifecycle test completed successfully!\n');
  });

  it('should track multiple events independently', async () => {
    console.log('\n📝 Testing multiple independent events...\n');

    const event1Uid = 'event-1';
    const event2Uid = 'event-2';

    // Create two different events
    console.log('📌 Creating Event 1');
    await auditService.logOperation({
      eventUid: event1Uid,
      operation: 'CREATE',
      userEmail: 'user1@example.com',
      userName: 'User One',
      calendarUrl: 'https://example.com/cal1',
      afterState: { summary: 'Event 1' },
      status: 'SUCCESS'
    });
    console.log('   ✅ Event 1 created\n');

    console.log('📌 Creating Event 2');
    await auditService.logOperation({
      eventUid: event2Uid,
      operation: 'CREATE',
      userEmail: 'user2@example.com',
      userName: 'User Two',
      calendarUrl: 'https://example.com/cal2',
      afterState: { summary: 'Event 2' },
      status: 'SUCCESS'
    });
    console.log('   ✅ Event 2 created\n');

    // Update event 1
    console.log('📌 Updating Event 1');
    await auditService.logOperation({
      eventUid: event1Uid,
      operation: 'UPDATE',
      userEmail: 'user1@example.com',
      userName: 'User One',
      calendarUrl: 'https://example.com/cal1',
      beforeState: { summary: 'Event 1' },
      afterState: { summary: 'Event 1 Updated' },
      status: 'SUCCESS'
    });
    console.log('   ✅ Event 1 updated\n');

    // Verify independent histories
    console.log('📌 Verifying independent audit histories');
    const history1 = await auditService.getEventHistory(event1Uid);
    const history2 = await auditService.getEventHistory(event2Uid);

    console.log(`   Event 1: ${history1.length} entries (${history1.map(h => h.operation).join(', ')})`);
    console.log(`   Event 2: ${history2.length} entries (${history2.map(h => h.operation).join(', ')})`);

    expect(history1).toHaveLength(2); // CREATE + UPDATE
    expect(history2).toHaveLength(1); // CREATE only

    console.log('\n✅ Multiple events tracked independently!\n');
  });

  it('should handle failed operations in audit log', async () => {
    console.log('\n📝 Testing failed operation logging...\n');

    const eventUid = 'failed-operation-event';

    console.log('📌 Attempting operation that fails');
    const failId = await auditService.logOperation({
      eventUid,
      operation: 'UPDATE',
      userEmail: 'user@example.com',
      userName: 'User',
      calendarUrl: 'https://example.com/cal',
      beforeState: { summary: 'Original' },
      afterState: null,
      status: 'FAILED',
      errorMessage: 'Permission denied'
    });

    console.log(`   ✅ FAILED operation logged (audit ID: ${failId})`);
    expect(failId).toBeGreaterThan(0);

    // Verify failed operation is recorded
    console.log('\n📌 Retrieving audit history');
    const history = await auditService.getEventHistory(eventUid);

    console.log(`   ℹ️  Found ${history.length} entry`);
    expect(history).toHaveLength(1);
    expect(history[0].status).toBe('FAILED');
    expect(history[0].error_message).toBe('Permission denied');

    console.log(`   ✅ Status: ${history[0].status}`);
    console.log(`   ✅ Error: ${history[0].error_message}`);

    console.log('\n✅ Failed operation correctly logged!\n');
  });
});
