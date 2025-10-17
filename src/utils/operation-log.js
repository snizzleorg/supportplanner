/**
 * Operation logging utility for audit trail
 * 
 * Logs all calendar mutations (CREATE, UPDATE, DELETE, MOVE) with timestamp,
 * user information, and operation details. Includes automatic log rotation
 * when file size exceeds 10MB.
 * 
 * @module utils/operation-log
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Log file path - store in logs directory
const LOG_DIR = path.join(__dirname, '../../logs');
const LOG_FILE = path.join(LOG_DIR, 'operations.log');

// Maximum log file size (10MB)
const MAX_LOG_SIZE = 10 * 1024 * 1024;

/**
 * Ensure log directory exists
 * 
 * Creates the logs directory if it doesn't exist.
 * Non-blocking - logs error but doesn't throw.
 * 
 * @private
 * @async
 * @returns {Promise<void>}
 */
async function ensureLogDir() {
  try {
    await fs.mkdir(LOG_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create log directory:', error);
  }
}

/**
 * Rotate log file if it exceeds max size
 * 
 * Renames current log file with timestamp if it exceeds MAX_LOG_SIZE (10MB).
 * Non-blocking - logs error but doesn't throw.
 * 
 * @private
 * @async
 * @returns {Promise<void>}
 */
async function rotateLogIfNeeded() {
  try {
    const stats = await fs.stat(LOG_FILE);
    if (stats.size > MAX_LOG_SIZE) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const archivePath = path.join(LOG_DIR, `operations-${timestamp}.log`);
      await fs.rename(LOG_FILE, archivePath);
      console.log(`Rotated log file to ${archivePath}`);
    }
  } catch (error) {
    // File doesn't exist yet, that's fine
    if (error.code !== 'ENOENT') {
      console.error('Failed to rotate log file:', error);
    }
  }
}

/**
 * Log an operation
 * @param {string} operation - Operation type (CREATE, UPDATE, DELETE, MOVE)
 * @param {Object} details - Operation details
 * @param {string} details.uid - Event UID
 * @param {string} details.summary - Event summary/title
 * @param {string} details.calendarUrl - Calendar URL
 * @param {string} [details.targetCalendarUrl] - Target calendar URL (for MOVE)
 * @param {string} [details.user] - Username (from request)
 * @param {string} [details.status] - Operation status (SUCCESS, FAILED, PARTIAL)
 * @param {string} [details.error] - Error message if failed
 * @param {Object} [details.metadata] - Additional metadata
 */
export async function logOperation(operation, details) {
  try {
    await ensureLogDir();
    await rotateLogIfNeeded();
    
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      operation,
      ...details
    };
    
    const logLine = JSON.stringify(logEntry) + '\n';
    
    await fs.appendFile(LOG_FILE, logLine, 'utf8');
    
    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[OperationLog] ${operation}:`, details);
    }
  } catch (error) {
    // Don't throw - logging should never break the application
    console.error('Failed to write operation log:', error);
  }
}

/**
 * Read recent operations from log
 * @param {number} limit - Maximum number of entries to return
 * @returns {Promise<Array>} Array of log entries
 */
export async function getRecentOperations(limit = 100) {
  try {
    const content = await fs.readFile(LOG_FILE, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    
    // Get last N lines
    const recentLines = lines.slice(-limit);
    
    return recentLines.map(line => {
      try {
        return JSON.parse(line);
      } catch (error) {
        console.error('Failed to parse log line:', line);
        return null;
      }
    }).filter(Boolean);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return []; // No log file yet
    }
    console.error('Failed to read operation log:', error);
    return [];
  }
}

/**
 * Search operations by criteria
 * @param {Object} criteria - Search criteria
 * @param {string} [criteria.operation] - Operation type
 * @param {string} [criteria.uid] - Event UID
 * @param {string} [criteria.user] - Username
 * @param {Date} [criteria.since] - Start date
 * @param {Date} [criteria.until] - End date
 * @returns {Promise<Array>} Matching log entries
 */
export async function searchOperations(criteria) {
  try {
    const content = await fs.readFile(LOG_FILE, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    
    return lines.map(line => {
      try {
        return JSON.parse(line);
      } catch (error) {
        return null;
      }
    }).filter(entry => {
      if (!entry) return false;
      
      // Apply filters
      if (criteria.operation && entry.operation !== criteria.operation) {
        return false;
      }
      
      if (criteria.uid && entry.uid !== criteria.uid) {
        return false;
      }
      
      if (criteria.user && entry.user !== criteria.user) {
        return false;
      }
      
      if (criteria.since && new Date(entry.timestamp) < criteria.since) {
        return false;
      }
      
      if (criteria.until && new Date(entry.timestamp) > criteria.until) {
        return false;
      }
      
      return true;
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    console.error('Failed to search operation log:', error);
    return [];
  }
}
