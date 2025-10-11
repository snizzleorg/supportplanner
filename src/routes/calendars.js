/**
 * Calendar routes
 * 
 * Provides endpoints for calendar operations:
 * - List all calendars
 * - Force refresh CalDAV data
 * 
 * @module routes/calendars
 */

import { Router } from 'express';
import { requireRole } from '../middleware/index.js';
import { calendarCache } from '../services/index.js';

const router = Router();

// Get all available calendars
router.get('/', async (req, res) => {
  try {
    const calendars = calendarCache.getAllCalendars();
    res.json({
      calendars,
      _cachedAt: new Date().toISOString(),
      _cacheStatus: calendarCache.getStatus()
    });
  } catch (err) {
    console.error('Error fetching calendars:', err);
    res.status(500).json({ 
      error: err.message || 'Failed to fetch calendars',
      cacheStatus: calendarCache.getStatus()
    });
  }
});

// Force refresh CalDAV data
router.post('/refresh-caldav', requireRole('reader'), async (req, res) => {
  try {
    console.log('Forcing CalDAV data refresh...');
    await calendarCache.refreshAllCalendars();
    res.json({ 
      success: true, 
      message: 'CalDAV data refresh initiated',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error refreshing CalDAV data:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to refresh CalDAV data',
      details: error.message 
    });
  }
});

export default router;
