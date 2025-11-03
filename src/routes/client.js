/**
 * Client utility routes
 * 
 * Provides client-side utilities:
 * - Client-side logging endpoint
 * - Logged-out confirmation page
 * 
 * @module routes/client
 */

import { Router } from 'express';
import { createLogger } from '../utils/index.js';

const logger = createLogger('ClientRoutes');
const router = Router();

// Client-side logging endpoint
router.post('/client-log', (req, res) => {
  const { level, message, extra } = req.body;
  
  // Log client-side messages with appropriate server-side level
  // Client errors are logged as warnings (not errors) since they're expected
  if (level === 'error') {
    logger.warn('Client error', { message, extra });
  } else if (level === 'warn') {
    logger.warn('Client warning', { message, extra });
  } else {
    logger.debug('Client log', { level, message, extra });
  }
  
  res.json({ success: true });
});

// Simple logged-out page (public)
router.get('/logged-out', (req, res) => {
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Logged out</title>
<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,sans-serif;margin:2rem;color:#222} .card{max-width:720px;padding:1.25rem;border:1px solid #eee;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.06)} a.button{display:inline-block;margin-top:1rem;padding:.5rem .9rem;background:#0d6efd;color:#fff;border-radius:6px;text-decoration:none}</style>
</head><body>
<div class="card">
  <h2>You are signed out</h2>
  <p>You have been signed out of SupportPlanner.</p>
  <a class="button" href="/auth/login">Sign in again</a>
</div>
</body></html>`;
  res.status(200).send(html);
});

export default router;
