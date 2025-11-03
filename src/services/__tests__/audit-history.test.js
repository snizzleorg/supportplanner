/**
 * Tests for audit history service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuditHistoryService } from '../audit-history.js';
import fs from 'fs/promises';
import path from 'path';

describe('AuditHistoryService', () => {
  let auditService;
  let testDbPath;

  beforeEach(async () => {
    // Use a unique database file for each test run
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    testDbPath = path.join(process.cwd(), 'data', `test-audit-${timestamp}-${random}.db`);
    
    // Create a new instance with test-specific path
    auditService = new AuditHistoryService();
    
    // Mock the DB_PATH in the module - we need to initialize with custom path
    const originalInitialize = auditService.initialize.bind(auditService);
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
  });

  afterEach(async () => {
    // Clean up: close database and remove test file
    if (auditService && auditService.db) {
      try {
        await auditService.close();
      } catch (error) {
        console.error('Error closing database:', error);
      }
    }
    
    // Remove test database files
    if (testDbPath) {
      try {
        await fs.unlink(testDbPath);
      } catch (error) {
        // Ignore if file doesn't exist
      }
      
      // Also try to remove journal and wal files
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

  describe('initialization', () => {
    it('should initialize the database successfully', async () => {
      await auditService.initialize();
      expect(auditService.isInitialized).toBe(true);
      expect(auditService.db).toBeDefined();
    });

    it('should be idempotent (safe to call multiple times)', async () => {
      await auditService.initialize();
      await auditService.initialize();
      expect(auditService.isInitialized).toBe(true);
    });
  });

  describe('logOperation', () => {
    beforeEach(async () => {
      await auditService.initialize();
    });

    it('should log a CREATE operation', async () => {
      const result = await auditService.logOperation({
        eventUid: 'test-uid-123',
        operation: 'CREATE',
        userEmail: 'test@example.com',
        userName: 'Test User',
        calendarUrl: 'https://example.com/calendar',
        beforeState: null,
        afterState: {
          uid: 'test-uid-123',
          summary: 'Test Event',
          start: '2025-01-01',
          end: '2025-01-02'
        },
        status: 'SUCCESS'
      });

      expect(result).toBeTypeOf('number');
      expect(result).toBeGreaterThan(0);
    });

    it('should log an UPDATE operation with before/after states', async () => {
      const beforeState = {
        uid: 'test-uid-456',
        summary: 'Old Title',
        start: '2025-01-01'
      };

      const afterState = {
        uid: 'test-uid-456',
        summary: 'New Title',
        start: '2025-01-02'
      };

      const result = await auditService.logOperation({
        eventUid: 'test-uid-456',
        operation: 'UPDATE',
        userEmail: 'editor@example.com',
        userName: 'Editor User',
        calendarUrl: 'https://example.com/calendar',
        beforeState,
        afterState,
        status: 'SUCCESS'
      });

      expect(result).toBeGreaterThan(0);
    });

    it('should log a MOVE operation with different calendars', async () => {
      const result = await auditService.logOperation({
        eventUid: 'test-uid-789',
        operation: 'MOVE',
        userEmail: 'admin@example.com',
        userName: 'Admin User',
        calendarUrl: 'https://example.com/calendar1',
        targetCalendarUrl: 'https://example.com/calendar2',
        beforeState: { uid: 'test-uid-789', calendar: 'calendar1' },
        afterState: { uid: 'test-uid-789', calendar: 'calendar2' },
        status: 'SUCCESS'
      });

      expect(result).toBeGreaterThan(0);
    });

    it('should log a failed operation', async () => {
      const result = await auditService.logOperation({
        eventUid: 'test-uid-fail',
        operation: 'DELETE',
        userEmail: 'user@example.com',
        userName: 'User',
        calendarUrl: 'https://example.com/calendar',
        beforeState: { uid: 'test-uid-fail', summary: 'Event' },
        afterState: null,
        status: 'FAILED',
        errorMessage: 'Permission denied'
      });

      expect(result).toBeGreaterThan(0);
    });
  });

  describe('getEventHistory', () => {
    beforeEach(async () => {
      await auditService.initialize();
      
      // Create some test history
      await auditService.logOperation({
        eventUid: 'event-123',
        operation: 'CREATE',
        userEmail: 'user1@example.com',
        userName: 'User One',
        calendarUrl: 'https://example.com/cal',
        afterState: { summary: 'Created' },
        status: 'SUCCESS'
      });

      await auditService.logOperation({
        eventUid: 'event-123',
        operation: 'UPDATE',
        userEmail: 'user2@example.com',
        userName: 'User Two',
        calendarUrl: 'https://example.com/cal',
        beforeState: { summary: 'Created' },
        afterState: { summary: 'Updated' },
        status: 'SUCCESS'
      });
    });

    it('should retrieve history for a specific event', async () => {
      const history = await auditService.getEventHistory('event-123');
      
      expect(history).toHaveLength(2);
      expect(history[0].operation).toBe('UPDATE'); // Most recent first
      expect(history[1].operation).toBe('CREATE');
    });

    it('should respect the limit parameter', async () => {
      const history = await auditService.getEventHistory('event-123', 1);
      
      expect(history).toHaveLength(1);
      expect(history[0].operation).toBe('UPDATE');
    });

    it('should return empty array for non-existent event', async () => {
      const history = await auditService.getEventHistory('non-existent');
      expect(history).toEqual([]);
    });
  });

  describe('getRecentHistory', () => {
    beforeEach(async () => {
      await auditService.initialize();
      
      // Create test data
      await auditService.logOperation({
        eventUid: 'event-1',
        operation: 'CREATE',
        userEmail: 'alice@example.com',
        userName: 'Alice',
        calendarUrl: 'https://example.com/cal1',
        afterState: {},
        status: 'SUCCESS'
      });

      await auditService.logOperation({
        eventUid: 'event-2',
        operation: 'UPDATE',
        userEmail: 'bob@example.com',
        userName: 'Bob',
        calendarUrl: 'https://example.com/cal2',
        beforeState: {},
        afterState: {},
        status: 'SUCCESS'
      });
    });

    it('should retrieve recent history across all events', async () => {
      const history = await auditService.getRecentHistory();
      
      expect(history.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter by operation type', async () => {
      const history = await auditService.getRecentHistory({ operation: 'CREATE' });
      
      expect(history.every(h => h.operation === 'CREATE')).toBe(true);
    });

    it('should filter by user email', async () => {
      const history = await auditService.getRecentHistory({ userEmail: 'alice@example.com' });
      
      expect(history.every(h => h.user?.email === 'alice@example.com')).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const history = await auditService.getRecentHistory({ limit: 1 });
      
      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(history.length).toBeLessThanOrEqual(1);
    });
  });

  describe('getPreviousState', () => {
    beforeEach(async () => {
      await auditService.initialize();
      
      // Create an event history with multiple operations
      await auditService.logOperation({
        eventUid: 'event-xyz',
        operation: 'CREATE',
        userEmail: 'user@example.com',
        userName: 'User',
        calendarUrl: 'https://example.com/cal',
        beforeState: null,
        afterState: { summary: 'Version 1' },
        status: 'SUCCESS'
      });

      await auditService.logOperation({
        eventUid: 'event-xyz',
        operation: 'UPDATE',
        userEmail: 'user@example.com',
        userName: 'User',
        calendarUrl: 'https://example.com/cal',
        beforeState: { summary: 'Version 1' },
        afterState: { summary: 'Version 2' },
        status: 'SUCCESS'
      });
    });

    it('should retrieve the previous state for undo', async () => {
      const previousState = await auditService.getPreviousState('event-xyz');
      
      expect(previousState).toBeDefined();
      expect(previousState.state).toEqual({ summary: 'Version 1' });
      expect(previousState.operation).toBe('UPDATE');
    });

    it('should return null if no previous state exists', async () => {
      const previousState = await auditService.getPreviousState('non-existent');
      
      expect(previousState).toBeNull();
    });
  });

  describe('getStatistics', () => {
    beforeEach(async () => {
      await auditService.initialize();
      
      // Create test data
      await auditService.logOperation({
        eventUid: 'e1',
        operation: 'CREATE',
        userEmail: 'user1@example.com',
        userName: 'User 1',
        calendarUrl: 'https://example.com/cal',
        afterState: {},
        status: 'SUCCESS'
      });

      await auditService.logOperation({
        eventUid: 'e2',
        operation: 'CREATE',
        userEmail: 'user2@example.com',
        userName: 'User 2',
        calendarUrl: 'https://example.com/cal',
        afterState: {},
        status: 'SUCCESS'
      });

      await auditService.logOperation({
        eventUid: 'e3',
        operation: 'UPDATE',
        userEmail: 'user1@example.com',
        userName: 'User 1',
        calendarUrl: 'https://example.com/cal',
        beforeState: {},
        afterState: {},
        status: 'SUCCESS'
      });
    });

    it('should return statistics about audit history', async () => {
      const stats = await auditService.getStatistics();
      
      expect(stats).toBeDefined();
      expect(stats.totalOperations).toBeGreaterThanOrEqual(3);
      expect(stats.operationsByType).toBeDefined();
      expect(stats.operationsByType.CREATE).toBeGreaterThanOrEqual(2);
      expect(stats.operationsByType.UPDATE).toBeGreaterThanOrEqual(1);
      expect(stats.topUsers).toBeInstanceOf(Array);
      expect(stats.last24Hours).toBeGreaterThanOrEqual(0);
    });
  });
});
