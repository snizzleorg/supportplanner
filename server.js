import express from 'express';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Import configuration
import {
  corsMiddleware,
  helmetMiddleware,
  sessionMiddleware,
  apiLimiter,
  authLimiter,
  refreshLimiter,
  generateToken,
  doubleCsrfProtection,
  loadEventTypesConfig,
  NEXTCLOUD_URL,
  NEXTCLOUD_USERNAME,
  NEXTCLOUD_PASSWORD,
  PORT
} from './src/config/index.js';

// Import middleware
import { initializeAuth, deviceBasedStaticMiddleware } from './src/middleware/index.js';

// Import services
import { calendarCache } from './src/services/index.js';
import { auditHistory } from './src/services/audit-history.js';

// Import routes
import { registerRoutes } from './src/routes/index.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load event types configuration
loadEventTypesConfig();

const app = express();

// Apply middleware
app.use(corsMiddleware);
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(helmetMiddleware);
app.use(sessionMiddleware);

// Apply rate limiters
app.use('/api/', apiLimiter);
app.use('/auth/login', authLimiter);
app.use('/auth/callback', authLimiter);
app.use('/api/refresh-caldav', refreshLimiter);

// Trust proxy to ensure correct secure cookies/redirects when behind reverse proxy
app.set('trust proxy', 1);

// Initialize authentication (OIDC or disabled mode)
initializeAuth(app);

// CSRF token endpoint - must be after session/auth but before CSRF protection
app.get('/api/csrf-token', (req, res) => {
  const csrfToken = generateToken(req, res);
  res.json({ csrfToken });
});

// Apply CSRF protection to all state-changing API routes (except in test environment)
// This protects POST, PUT, DELETE (but not GET, HEAD, OPTIONS)
if (process.env.NODE_ENV !== 'test') {
  app.use('/api/', doubleCsrfProtection);
  console.log('[Security] CSRF protection enabled');
} else {
  console.log('[Security] CSRF protection disabled (test environment)');
}

// Serve mobile app for all devices (desktop and mobile)
// Mobile app now contains all required assets (favicons, manifest, etc.)
app.use(express.static(path.join(__dirname, 'mobile', 'public')));

// Serve event-types.json from root
app.get('/event-types.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'event-types.json'));
});

// Register all application routes
registerRoutes(app);

// Global error handler - must be after routes
// Catches unhandled errors and prevents stack trace leakage in production
app.use((err, req, res, _next) => {
  const isDev = process.env.NODE_ENV === 'development';
  console.error('[GlobalErrorHandler]', err.stack || err);
  
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: isDev ? err.message : 'Internal server error',
    ...(isDev && { stack: err.stack })
  });
});

// Initialize the calendar cache and audit history
Promise.all([
  calendarCache.initialize(NEXTCLOUD_URL, NEXTCLOUD_USERNAME, NEXTCLOUD_PASSWORD),
  auditHistory.initialize()
])
  .then(() => {
    console.log('Calendar cache initialized successfully');
    console.log('Audit history database initialized successfully');
  })
  .catch(err => console.error('Failed to initialize services:', err));

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await Promise.all([
    calendarCache.stop(),
    auditHistory.close()
  ]);
  console.log('Services closed successfully');
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`SupportPlanner server running at http://localhost:${PORT}`);
});
