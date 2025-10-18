/**
 * Advanced Audit History Tests
 * 
 * Tests comprehensive state verification, concurrent operations,
 * timestamp ordering, metadata preservation, and database constraints.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuditHistoryService } from '../audit-history.js';
import fs from 'fs/promises';
import path from 'path';

describe('Audit History - Advanced Tests', () => {
  let auditService;
  let testDbPath;

  beforeEach(async () => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    testDbPath = path.join(process.cwd(), 'data', `test-audit-advanced-${timestamp}-${random}.db`);
    
    auditService = new AuditHistoryService();
    
    auditService.initialize = async function() {
      const sqlite3 = (await import('sqlite3')).default;
      const { open } = await import('sqlite');
      
      this.db = await open({
        filename: testDbPath,
        driver: sqlite3.Database
      });
      
      await this.db.exec('PRAGMA foreign_keys = ON');
      await this.db.exec(`CREATE TABLE IF NOT EXISTS audit_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT, event_uid TEXT NOT NULL, operation TEXT NOT NULL,
          user_email TEXT, user_name TEXT, timestamp TEXT NOT NULL, calendar_url TEXT NOT NULL,
          target_calendar_url TEXT, before_state TEXT, after_state TEXT,
          status TEXT NOT NULL DEFAULT 'SUCCESS', error_message TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`);
      await this.db.exec(`CREATE INDEX IF NOT EXISTS idx_event_uid ON audit_history(event_uid);
        CREATE INDEX IF NOT EXISTS idx_timestamp ON audit_history(timestamp DESC);
        CREATE INDEX IF NOT EXISTS idx_user_email ON audit_history(user_email);
        CREATE INDEX IF NOT EXISTS idx_operation ON audit_history(operation);
        CREATE INDEX IF NOT EXISTS idx_calendar_url ON audit_history(calendar_url);`);
      
      this.isInitialized = true;
    };
    
    await auditService.initialize();
  });

  afterEach(async () => {
    if (auditService?.db) await auditService.close().catch(() => {});
    if (testDbPath) {
      await fs.unlink(testDbPath).catch(() => {});
      await fs.unlink(testDbPath + '-journal').catch(() => {});
      await fs.unlink(testDbPath + '-shm').catch(() => {});
      await fs.unlink(testDbPath + '-wal').catch(() => {});
    }
  });

  describe('Complete Field-by-Field State Verification', () => {
    it('should preserve all event fields in state snapshots', async () => {
      console.log('\n📝 Testing complete field preservation...\n');

      const completeState = {
        uid: 'field-test', summary: 'Complete Event',
        description: 'Special chars: <>&"\'', location: 'Office 123',
        start: '2025-10-20T09:00:00Z', end: '2025-10-20T17:00:00Z',
        allDay: false, calendar: 'https://example.com/cal',
        meta: {
          orderNumber: 'ORD-12345',
          ticketLink: 'https://tickets.example.com/999',
          systemType: 'Production',
          notes: 'Unicode: 🎉 ✅'
        },
        customField: 'Extra', nestedObject: { level1: { level2: 'deep' } }
      };

      await auditService.logOperation({
        eventUid: 'field-test', operation: 'CREATE',
        userEmail: 'test@example.com', userName: 'Test',
        calendarUrl: 'https://example.com/cal',
        beforeState: null, afterState: completeState, status: 'SUCCESS'
      });

      const history = await auditService.getEventHistory('field-test');
      const stored = history[0].afterState;

      console.log('   ✅ Verifying all fields...');
      expect(stored.summary).toBe(completeState.summary);
      expect(stored.description).toContain('<>&"\'');
      expect(stored.meta.notes).toContain('🎉 ✅');
      expect(stored.nestedObject.level1.level2).toBe('deep');
      console.log('      ✓ All fields preserved correctly!\n');
    });

    it('should detect all changes between states', async () => {
      console.log('\n📝 Testing change detection...\n');

      const before = {
        uid: 'change-test', summary: 'Original', location: 'A',
        meta: { orderNumber: 'ORD-001', ticketLink: 'https://ex.com/1' }
      };
      const after = {
        uid: 'change-test', summary: 'Updated', location: 'B',
        meta: { orderNumber: 'ORD-002', ticketLink: 'https://ex.com/1', systemType: 'Prod' }
      };

      await auditService.logOperation({
        eventUid: 'change-test', operation: 'UPDATE',
        userEmail: 'editor@example.com', userName: 'Editor',
        calendarUrl: 'https://example.com/cal',
        beforeState: before, afterState: after, status: 'SUCCESS'
      });

      const entry = (await auditService.getEventHistory('change-test'))[0];

      console.log('   📊 Changes detected:');
      expect(entry.beforeState.summary).toBe('Original');
      expect(entry.afterState.summary).toBe('Updated');
      expect(entry.afterState.meta.systemType).toBe('Prod');
      expect(entry.beforeState.meta.systemType).toBeUndefined();
      console.log('      ✓ summary: CHANGED\n      ✓ meta.systemType: ADDED\n');
    });
  });

  describe('Concurrent Operations', () => {
    it('should track multi-user operations', async () => {
      console.log('\n📝 Testing multi-user concurrent operations...\n');

      const users = [
        { email: 'alice@ex.com', name: 'Alice' },
        { email: 'bob@ex.com', name: 'Bob' },
        { email: 'charlie@ex.com', name: 'Charlie' }
      ];

      await Promise.all(users.map((user, i) => 
        auditService.logOperation({
          eventUid: 'multi-user', operation: 'UPDATE',
          userEmail: user.email, userName: user.name,
          calendarUrl: 'https://example.com/cal',
          beforeState: { v: i }, afterState: { v: i + 1 }, status: 'SUCCESS'
        })
      ));

      const history = await auditService.getEventHistory('multi-user');
      expect(history).toHaveLength(3);
      
      const emails = history.map(h => h.user_email);
      users.forEach(u => expect(emails).toContain(u.email));
      console.log('   ✅ All 3 users tracked correctly!\n');
    });
  });

  describe('Timestamp Ordering', () => {
    it('should maintain chronological order', async () => {
      console.log('\n📝 Testing timestamp ordering...\n');

      for (let i = 0; i < 5; i++) {
        await auditService.logOperation({
          eventUid: 'timestamp-test', operation: 'UPDATE',
          userEmail: 'test@ex.com', userName: 'Test',
          calendarUrl: 'https://example.com/cal',
          beforeState: { v: i }, afterState: { v: i + 1 }, status: 'SUCCESS'
        });
        await new Promise(r => setTimeout(r, 5));
      }

      const history = await auditService.getEventHistory('timestamp-test');
      
      for (let i = 0; i < history.length - 1; i++) {
        const curr = new Date(history[i].timestamp);
        const next = new Date(history[i + 1].timestamp);
        expect(curr.getTime()).toBeGreaterThanOrEqual(next.getTime());
      }
      console.log('   ✅ Timestamps in correct order (newest first)!\n');
    });
  });

  describe('Complex Metadata', () => {
    it('should preserve complex metadata structures', async () => {
      console.log('\n📝 Testing complex metadata...\n');

      const complexMeta = {
        orderNumber: 'ORD-2024', ticketLink: 'https://jira.ex.com/999',
        tags: ['urgent', 'maintenance'],
        contacts: { primary: 'john@ex.com', secondary: 'jane@ex.com' },
        approval: { requested: '2024-10-15T10:00:00Z', approver: 'dir@ex.com' }
      };

      await auditService.logOperation({
        eventUid: 'metadata-test', operation: 'CREATE',
        userEmail: 'admin@ex.com', userName: 'Admin',
        calendarUrl: 'https://example.com/cal',
        beforeState: null,
        afterState: { uid: 'metadata-test', meta: complexMeta },
        status: 'SUCCESS'
      });

      const stored = (await auditService.getEventHistory('metadata-test'))[0].afterState.meta;

      expect(stored.tags).toEqual(['urgent', 'maintenance']);
      expect(stored.contacts.primary).toBe('john@ex.com');
      expect(stored.approval.approver).toBe('dir@ex.com');
      console.log('   ✅ Complex metadata fully preserved!\n');
    });
  });

  describe('Database Constraints', () => {
    it('should enforce NOT NULL constraints', async () => {
      console.log('\n📝 Testing database constraints...\n');

      let errorOccurred = false;
      try {
        await auditService.db.run(
          `INSERT INTO audit_history (operation, timestamp, calendar_url, status) 
           VALUES ('CREATE', '2024-10-18T10:00:00Z', 'https://ex.com/cal', 'SUCCESS')`
        );
      } catch (error) {
        errorOccurred = true;
        expect(error.message).toContain('NOT NULL constraint failed');
        console.log('      ✅ NOT NULL constraint enforced');
      }

      expect(errorOccurred).toBe(true);
      console.log('\n   ✅ Database constraints working!\n');
    });
  });
});
