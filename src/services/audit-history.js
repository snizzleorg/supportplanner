/**
 * Audit History Service
 * 
 * Provides comprehensive audit trail with undo capabilities for all event operations.
 * 
 * Features:
 * - SQLite database for persistent storage
 * - Full event state snapshots (before/after)
 * - Multi-user tracking
 * - Undo support by restoring previous state
 * - Efficient querying with indexes
 * 
 * @module services/audit-history
 */

import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database file path - store in data directory
const DB_PATH = path.join(__dirname, '../../data/audit-history.db');

/**
 * Audit History Service Class
 * 
 * Manages event audit trail with full state snapshots and undo capabilities.
 * Uses SQLite for persistent, queryable storage.
 */
export class AuditHistoryService {
  constructor() {
    this.db = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the audit history database
   * 
   * Creates tables and indexes if they don't exist.
   * Safe to call multiple times (idempotent).
   * 
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      // Open database connection
      this.db = await open({
        filename: DB_PATH,
        driver: sqlite3.Database
      });

      // Enable foreign keys
      await this.db.exec('PRAGMA foreign_keys = ON');

      // Create audit_history table
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

      // Create indexes for efficient queries
      await this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_event_uid 
        ON audit_history(event_uid);
        
        CREATE INDEX IF NOT EXISTS idx_timestamp 
        ON audit_history(timestamp DESC);
        
        CREATE INDEX IF NOT EXISTS idx_user_email 
        ON audit_history(user_email);
        
        CREATE INDEX IF NOT EXISTS idx_operation 
        ON audit_history(operation);
        
        CREATE INDEX IF NOT EXISTS idx_calendar_url 
        ON audit_history(calendar_url);
      `);

      this.isInitialized = true;
      console.log('[AuditHistory] Database initialized:', DB_PATH);
    } catch (error) {
      console.error('[AuditHistory] Failed to initialize database:', error);
      throw error;
    }
  }

  /**
   * Log an operation to audit history
   * 
   * @param {Object} params - Operation parameters
   * @param {string} params.eventUid - Event UID
   * @param {string} params.operation - Operation type (CREATE/UPDATE/DELETE/MOVE)
   * @param {string} [params.userEmail] - User email from session
   * @param {string} [params.userName] - User display name
   * @param {string} params.calendarUrl - Source calendar URL
   * @param {string} [params.targetCalendarUrl] - Target calendar URL (for MOVE)
   * @param {Object} [params.beforeState] - Event state before operation
   * @param {Object} [params.afterState] - Event state after operation
   * @param {string} [params.status='SUCCESS'] - Operation status
   * @param {string} [params.errorMessage] - Error message if failed
   * @returns {Promise<number>} Audit entry ID
   */
  async logOperation({
    eventUid,
    operation,
    userEmail,
    userName,
    calendarUrl,
    targetCalendarUrl,
    beforeState,
    afterState,
    status = 'SUCCESS',
    errorMessage
  }) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const timestamp = new Date().toISOString();

      const result = await this.db.run(
        `INSERT INTO audit_history (
          event_uid, operation, user_email, user_name, timestamp,
          calendar_url, target_calendar_url, before_state, after_state,
          status, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          eventUid,
          operation,
          userEmail || null,
          userName || null,
          timestamp,
          calendarUrl,
          targetCalendarUrl || null,
          beforeState ? JSON.stringify(beforeState) : null,
          afterState ? JSON.stringify(afterState) : null,
          status,
          errorMessage || null
        ]
      );

      console.log(`[AuditHistory] Logged ${operation} for event ${eventUid} by ${userEmail || 'system'}`);
      return result.lastID;
    } catch (error) {
      console.error('[AuditHistory] Failed to log operation:', error);
      // Don't throw - audit logging should never break the application
      return null;
    }
  }

  /**
   * Get audit history for a specific event
   * 
   * Returns all operations performed on an event, ordered by timestamp (newest first).
   * 
   * @param {string} eventUid - Event UID
   * @param {number} [limit=50] - Maximum number of entries to return
   * @returns {Promise<Array<Object>>} Audit history entries
   */
  async getEventHistory(eventUid, limit = 50) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const entries = await this.db.all(
        `SELECT 
          id, event_uid, operation, user_email, user_name, timestamp,
          calendar_url, target_calendar_url, before_state, after_state,
          status, error_message, created_at
        FROM audit_history
        WHERE event_uid = ?
        ORDER BY timestamp DESC
        LIMIT ?`,
        [eventUid, limit]
      );

      // Parse JSON fields
      return entries.map(entry => ({
        ...entry,
        beforeState: entry.before_state ? JSON.parse(entry.before_state) : null,
        afterState: entry.after_state ? JSON.parse(entry.after_state) : null,
        before_state: undefined, // Remove snake_case
        after_state: undefined
      }));
    } catch (error) {
      console.error('[AuditHistory] Failed to get event history:', error);
      return [];
    }
  }

  /**
   * Get recent audit history across all events
   * 
   * @param {Object} [filters] - Optional filters
   * @param {string} [filters.operation] - Filter by operation type
   * @param {string} [filters.userEmail] - Filter by user email
   * @param {string} [filters.calendarUrl] - Filter by calendar URL
   * @param {Date} [filters.since] - Filter by start date
   * @param {Date} [filters.until] - Filter by end date
   * @param {number} [filters.limit=100] - Maximum entries to return
   * @returns {Promise<Array<Object>>} Audit history entries
   */
  async getRecentHistory(filters = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const {
        operation,
        userEmail,
        calendarUrl,
        since,
        until,
        limit = 100
      } = filters;

      // Build WHERE clause dynamically
      const conditions = [];
      const params = [];

      if (operation) {
        conditions.push('operation = ?');
        params.push(operation);
      }

      if (userEmail) {
        conditions.push('user_email = ?');
        params.push(userEmail);
      }

      if (calendarUrl) {
        conditions.push('calendar_url = ?');
        params.push(calendarUrl);
      }

      if (since) {
        conditions.push('timestamp >= ?');
        params.push(since.toISOString());
      }

      if (until) {
        conditions.push('timestamp <= ?');
        params.push(until.toISOString());
      }

      const whereClause = conditions.length > 0
        ? 'WHERE ' + conditions.join(' AND ')
        : '';

      params.push(limit);

      const entries = await this.db.all(
        `SELECT 
          id, event_uid, operation, user_email, user_name, timestamp,
          calendar_url, target_calendar_url, before_state, after_state,
          status, error_message, created_at
        FROM audit_history
        ${whereClause}
        ORDER BY timestamp DESC
        LIMIT ?`,
        params
      );

      // Parse JSON fields
      return entries.map(entry => ({
        ...entry,
        beforeState: entry.before_state ? JSON.parse(entry.before_state) : null,
        afterState: entry.after_state ? JSON.parse(entry.after_state) : null,
        before_state: undefined,
        after_state: undefined
      }));
    } catch (error) {
      console.error('[AuditHistory] Failed to get recent history:', error);
      return [];
    }
  }

  /**
   * Get the previous state of an event for undo
   * 
   * Finds the most recent successful operation with a before_state.
   * Useful for implementing undo functionality.
   * 
   * @param {string} eventUid - Event UID
   * @returns {Promise<Object|null>} Previous event state or null
   */
  async getPreviousState(eventUid) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const entry = await this.db.get(
        `SELECT before_state, operation, timestamp
        FROM audit_history
        WHERE event_uid = ? 
          AND status = 'SUCCESS'
          AND before_state IS NOT NULL
        ORDER BY timestamp DESC
        LIMIT 1`,
        [eventUid]
      );

      if (!entry || !entry.before_state) {
        return null;
      }

      return {
        state: JSON.parse(entry.before_state),
        operation: entry.operation,
        timestamp: entry.timestamp
      };
    } catch (error) {
      console.error('[AuditHistory] Failed to get previous state:', error);
      return null;
    }
  }

  /**
   * Get statistics about audit history
   * 
   * Returns summary statistics for monitoring and reporting.
   * 
   * @returns {Promise<Object>} Statistics object
   */
  async getStatistics() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const [totalOps, byOperation, byUser, recentCount] = await Promise.all([
        // Total operations
        this.db.get('SELECT COUNT(*) as count FROM audit_history'),
        
        // Operations by type
        this.db.all(`
          SELECT operation, COUNT(*) as count
          FROM audit_history
          GROUP BY operation
        `),
        
        // Operations by user
        this.db.all(`
          SELECT user_email, COUNT(*) as count
          FROM audit_history
          WHERE user_email IS NOT NULL
          GROUP BY user_email
          ORDER BY count DESC
          LIMIT 10
        `),
        
        // Recent operations (last 24 hours)
        this.db.get(`
          SELECT COUNT(*) as count
          FROM audit_history
          WHERE timestamp >= datetime('now', '-1 day')
        `)
      ]);

      return {
        totalOperations: totalOps.count,
        operationsByType: byOperation.reduce((acc, row) => {
          acc[row.operation] = row.count;
          return acc;
        }, {}),
        topUsers: byUser,
        last24Hours: recentCount.count
      };
    } catch (error) {
      console.error('[AuditHistory] Failed to get statistics:', error);
      return null;
    }
  }

  /**
   * Close database connection
   * 
   * Call during graceful shutdown.
   * 
   * @returns {Promise<void>}
   */
  async close() {
    if (this.db) {
      await this.db.close();
      this.db = null;
      this.isInitialized = false;
      console.log('[AuditHistory] Database connection closed');
    }
  }
}

// Export singleton instance
export const auditHistory = new AuditHistoryService();
