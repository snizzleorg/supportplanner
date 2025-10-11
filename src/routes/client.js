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

const router = Router();

// Client-side logging endpoint
router.post('/client-log', (req, res) => {
  const { level, message, extra } = req.body;
  const logMessage = `[CLIENT ${level.toUpperCase()}] ${message}${extra ? ' ' + JSON.stringify(extra) : ''}`;
  
  if (level === 'error') {
    console.error(logMessage);
  } else {
    console.log(logMessage);
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
