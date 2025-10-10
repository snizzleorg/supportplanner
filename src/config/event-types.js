import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base event types with default colors
const BASE_EVENT_TYPES = {
  vacation: {
    color: '#ffccbc',  // Light coral
    borderColor: '#ff8a65',
    textColor: '#000000',
    patterns: ['vacation', 'urlaub', 'holiday', 'pto']
  },
  sick: {
    color: '#f8bbd0',  // Light pink
    borderColor: '#f48fb1',
    textColor: '#000000',
    patterns: ['sick', 'krank', 'illness']
  },
  support: {
    color: '#c5e1a5',  // Light green
    borderColor: '#aed581',
    textColor: '#000000',
    patterns: ['support', 'on-call', 'bereitschaft']
  },
  meeting: {
    color: '#bbdefb',  // Light blue
    borderColor: '#90caf9',
    textColor: '#000000',
    patterns: ['meeting', 'besprechung', 'conference']
  },
  training: {
    color: '#b2dfdb',  // Light teal
    borderColor: '#80cbc4',
    textColor: '#000000',
    patterns: ['training', 'workshop', 'seminar']
  },
  business: {
    color: '#cfd8dc',  // Light blue-gray
    borderColor: '#b0bec5',
    textColor: '#000000',
    patterns: ['business', 'travel', 'dienstreise']
  }
};

let eventTypes = { ...BASE_EVENT_TYPES };

export function loadEventTypesConfig() {
  try {
    // Go up two levels from src/config/ to project root
    const projectRoot = path.join(__dirname, '..', '..');
    const configPath = path.join(projectRoot, 'event-types.json');
    const raw = fs.readFileSync(configPath, 'utf8');
    const cfg = JSON.parse(raw);
    // Rebuild from immutable base defaults on each load
    eventTypes = { ...BASE_EVENT_TYPES, ...(cfg && cfg.eventTypes ? cfg.eventTypes : {}) };
    console.log('Loaded event types configuration');
  } catch (err) {
    console.error('Failed to load event-types.json, using default colors', err.message);
  }
}

export function getEventTypes() {
  return eventTypes;
}

export { BASE_EVENT_TYPES };
