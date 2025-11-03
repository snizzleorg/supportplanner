/**
 * Audit History routes
 * 
 * Provides endpoints for viewing audit history and performing undo operations.
 * 
 * Features:
 * - Get audit history for specific event
 * - Get recent audit history across all events
 * - Undo last operation on an event
 * - Get audit statistics
 * 
 * @module routes/audit
 */

import { Router } from 'express';
import { param, query, validationResult } from 'express-validator';
import { auditHistory } from '../services/audit-history.js';
import { calendarCache } from '../services/calendar.js';
import { requireRole, validate, uidValidation } from '../middleware/index.js';
import { formatErrorResponse, createLogger } from '../utils/index.js';

const logger = createLogger('AuditRoutes');

const router = Router();

/**
 * Get audit history for a specific event
 * GET /api/audit/event/:uid
 */
router.get('/event/:uid', requireRole('reader'), uidValidation, validate, async (req, res) => {
  try {
    const { uid } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const history = await auditHistory.getEventHistory(uid, limit);

    res.json({
      success: true,
      eventUid: uid,
      count: history.length,
      history
    });
  } catch (error) {
    logger.error('Error getting event history', error);
    const { status, body } = formatErrorResponse(error, 500);
    res.status(status).json(body);
  }
});

/**
 * Get recent audit history across all events
 * GET /api/audit/recent
 */
router.get('/recent', requireRole('reader'), [
  query('operation').optional().isIn(['CREATE', 'UPDATE', 'DELETE', 'MOVE']).withMessage('Invalid operation type'),
  query('limit').optional().isInt({ min: 1, max: 500 }).withMessage('Limit must be between 1 and 500')
], validate, async (req, res) => {
  try {
    const {
      operation,
      userEmail,
      calendarUrl,
      since,
      until,
      limit
    } = req.query;

    const filters = {
      operation,
      userEmail,
      calendarUrl,
      since: since ? new Date(since) : undefined,
      until: until ? new Date(until) : undefined,
      limit: limit ? parseInt(limit) : 100
    };

    const history = await auditHistory.getRecentHistory(filters);

    res.json({
      success: true,
      count: history.length,
      filters,
      history
    });
  } catch (error) {
    logger.error('Error getting recent history', error);
    const { status, body } = formatErrorResponse(error, 500);
    res.status(status).json(body);
  }
});

/**
 * Undo the last operation on an event
 * POST /api/audit/undo/:uid
 */
router.post('/undo/:uid', requireRole('editor'), uidValidation, validate, async (req, res) => {
  try {
    const { uid } = req.params;

    logger.info('Undo requested for event', { uid });

    // Get the previous state from audit history
    const previousState = await auditHistory.getPreviousState(uid);

    if (!previousState) {
      return res.status(404).json({
        success: false,
        error: 'No previous state found for this event. Cannot undo.'
      });
    }

    logger.info('Found previous state', { operation: previousState.operation, timestamp: previousState.timestamp });

    // Extract user info from session
    const user = req.session?.user ? {
      email: req.session.user.email,
      name: req.session.user.name
    } : undefined;

    const state = previousState.state;

    // Handle different undo scenarios based on the last operation
    let result;
    switch (previousState.operation) {
      case 'DELETE':
        // Restore deleted event by recreating it
        logger.info('Restoring deleted event', { uid, state });
        
        // Validate required fields
        const calUrl = state.calendar || state.calendarUrl;
        if (!calUrl) {
          throw new Error('Calendar URL missing in audit state');
        }
        if (!state.start || !state.end) {
          throw new Error(`Event dates missing in audit state. State: ${JSON.stringify(state)}`);
        }
        
        result = await calendarCache.createAllDayEvent({
          calendarUrl: calUrl,
          summary: state.summary || 'Restored Event',
          description: state.description || '',
          location: state.location || '',
          start: state.start,
          end: state.end,
          meta: state.meta,
          user
        });
        break;

      case 'UPDATE':
      case 'MOVE':
        // Restore previous state by updating to it
        logger.info('Restoring previous state for event', { uid });
        result = await calendarCache.updateEvent(
          uid,
          {
            summary: state.summary,
            description: state.description,
            location: state.location,
            start: state.start,
            end: state.end,
            meta: state.meta,
            targetCalendarUrl: state.calendar || state.calendarUrl
          },
          '', // authHeader
          user
        );
        break;

      case 'CREATE':
        // Undo create by deleting the event
        logger.info('Deleting created event', { uid });
        await calendarCache.deleteEvent(uid, user);
        result = { success: true, message: 'Event deleted (undo CREATE)' };
        break;

      default:
        return res.status(400).json({
          success: false,
          error: `Cannot undo operation type: ${previousState.operation}`
        });
    }

    // Refresh calendars to reflect the change
    calendarCache.refreshAllCalendars().catch(err => {
      logger.error('Background refresh after undo failed', err);
    });

    res.json({
      success: true,
      message: 'Undo successful',
      operation: previousState.operation,
      timestamp: previousState.timestamp,
      result
    });
  } catch (error) {
    logger.error('Error performing undo', error);
    const { status, body } = formatErrorResponse(error, 500);
    res.status(status).json(body);
  }
});

/**
 * Get audit statistics
 * GET /api/audit/stats
 */
router.get('/stats', requireRole('admin'), async (req, res) => {
  try {
    const stats = await auditHistory.getStatistics();

    if (!stats) {
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve statistics'
      });
    }

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('Error getting statistics', error);
    const { status, body } = formatErrorResponse(error, 500);
    res.status(status).json(body);
  }
});

export default router;
