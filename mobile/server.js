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

// Enable CORS for API calls to main backend
app.use(cors());

// Serve static files from public directory
app.use(express.static(join(__dirname, 'public')));

// Serve index.html for all routes (SPA behavior)
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Mobile SupportPlanner running on http://0.0.0.0:${PORT}`);
  console.log(`📱 Access from your device at http://<your-ip>:${PORT}`);
});
