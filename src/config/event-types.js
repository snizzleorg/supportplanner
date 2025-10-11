/**
 * Event types configuration
 * 
 * Manages event type definitions with colors and patterns.
 * Loads custom configuration from event-types.json if available,
 * otherwise uses base defaults.
 * 
 * Event types are used to classify and style events in the timeline.
 * 
 * @module config/event-types
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Base event types with default colors and patterns
 * 
 * Each event type has:
 * - color: Background color for the event
 * - borderColor: Border color for the event
 * - textColor: Text color for the event
 * - patterns: Array of regex patterns to match event summaries
 * 
 * @type {Object.<string, {color: string, borderColor: string, textColor: string, patterns: string[]}>}
 */
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

/**
 * Current event types (loaded from config or defaults)
 * @type {Object}
 */
let eventTypes = { ...BASE_EVENT_TYPES };

/**
 * Load event types configuration from event-types.json
 * 
 * Attempts to load custom event types from config/event-types.json.
 * Falls back to BASE_EVENT_TYPES if file doesn't exist or is invalid.
 * Merges custom types with base types, adding _default fallback.
 * 
 * @returns {void}
 */
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

/**
 * Get current event types configuration
 * 
 * Returns the currently loaded event types (either from config file or defaults).
 * 
 * @returns {Object} Event types configuration object
 */
export function getEventTypes() {
  return eventTypes;
}

export { BASE_EVENT_TYPES };
