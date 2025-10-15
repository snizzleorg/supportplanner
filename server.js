import express from 'express';
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

// Serve mobile app for all devices (desktop and mobile)
// Using horizontal timeline for better lane visibility
app.use(express.static(path.join(__dirname, 'mobile', 'public')));

// Serve legacy desktop app folder for shared resources (favicons, etc.)
app.use(express.static(path.join(__dirname, 'public-legacy')));

// Serve event-types.json from root
app.get('/event-types.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'event-types.json'));
});

// Register all application routes
registerRoutes(app);

// Initialize the calendar cache
calendarCache.initialize(NEXTCLOUD_URL, NEXTCLOUD_USERNAME, NEXTCLOUD_PASSWORD)
  .then(() => console.log('Calendar cache initialized successfully'))
  .catch(err => console.error('Failed to initialize calendar cache:', err));

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  calendarCache.stop();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`SupportPlanner server running at http://localhost:${PORT}`);
});
