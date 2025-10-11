/**
 * Event type service
 * 
 * Determines event types based on summary text patterns.
 * Uses configurable patterns from event-types.json to classify events.
 * 
 * @module services/event-type
 */

import { getEventTypes } from '../config/index.js';

/**
 * Determine the event type based on the summary text
 * 
 * Matches the event summary against configured patterns to determine
 * the event type (e.g., 'vacation', 'support', 'meeting').
 * Returns 'default' if no pattern matches.
 * 
 * Pattern matching is case-insensitive and uses regular expressions.
 * 
 * @param {string} summary - The event summary/title
 * @returns {string} The event type key (e.g., 'vacation', 'support', 'meeting', 'default')
 * 
 * @example
 * getEventType('Vacation in Hawaii') // 'vacation'
 * getEventType('Support Call') // 'support'
 * getEventType('Random Event') // 'default'
 */
export function getEventType(summary) {
  if (!summary) return 'default';
  
  const lowerSummary = summary.toLowerCase();
  const eventTypes = getEventTypes();
  
  // Check for event types in the configuration
  for (const [type, config] of Object.entries(eventTypes)) {
    if (type === '_default') continue;
    
    const patterns = Array.isArray(config.patterns) 
      ? config.patterns 
      : [config.patterns];
      
    if (patterns.some(pattern => 
      pattern && new RegExp(pattern, 'i').test(lowerSummary)
    )) {
      return type;
    }
  }
  
  return 'default';
}
