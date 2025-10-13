/**
 * Mobile app development server
 * Serves the mobile-optimized SupportPlanner interface
 */

import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5174;

console.log('Server __dirname:', __dirname);
console.log('node_modules path:', join(__dirname, 'node_modules'));

// Enable CORS for API calls to main backend
app.use(cors());

// Debug: log all requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Serve node_modules for Ionic (must be BEFORE catch-all and BEFORE public static)
app.use('/node_modules', express.static(join(__dirname, 'node_modules'), {
  setHeaders: (res, path) => {
    console.log('Serving from node_modules:', path);
    if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
    } else if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=UTF-8');
    }
  }
}));

// Serve static files from public directory
app.use(express.static(join(__dirname, 'public')));

// ONLY serve index.html for HTML navigation routes (not for /node_modules)
app.get('*', (req, res) => {
  // Skip if it's a node_modules request - shouldn't get here
  if (req.path.startsWith('/node_modules/')) {
    console.warn('Unexpected: node_modules request reached catch-all:', req.path);
    return res.status(404).send('Not found');
  }
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Mobile SupportPlanner running on http://0.0.0.0:${PORT}`);
  console.log(`📱 Access from your device at http://<your-ip>:${PORT}`);
});
