import { getEventTypes } from '../config/index.js';

/**
 * Determine the event type based on the summary text
 * @param {string} summary - The event summary/title
 * @returns {string} The event type key (e.g., 'vacation', 'support', 'meeting')
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
