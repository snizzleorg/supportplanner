/**
 * Event Operations and Timeline Interactions
 * 
 * Handles timeline event interactions, event CRUD operations,
 * and event-related UI logic.
 * 
 * @module events
 */

import dayjs from 'https://cdn.jsdelivr.net/npm/dayjs@1.11.13/+esm';
import { 
  timeline, items, groups, groupReverseMap,
  isPanning, lastPanEnd
} from './state.js';
import { statusEl } from './dom.js';
import { isReader } from './auth.js';
import { TOUCH } from './constants.js';

/**
 * Sets the status message
 * @param {string} msg - The status message to display
 */
function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg || '';
}

/**
 * Extracts the UID from a timeline item ID
 * Item ID format: 'cal-X-https://.../calendars/.../UID'
 * @param {string} itemId - The timeline item ID
 * @returns {string|null} The extracted UID or null
 */
export function extractUidFromItemId(itemId) {
  if (!itemId) return null;
  const parts = itemId.split('/');
  return parts[parts.length - 1] || null;
}

/**
 * Checks if a click is from a mobile device
 * @returns {boolean} True if mobile tap detected
 */
function isMobileTap() {
  try {
    return document.body.classList.contains('mobile-device') || 
           (navigator.maxTouchPoints || 0) > 0;
  } catch (_) {
    return false;
  }
}

/**
 * Handles timeline item click (edit existing event)
 * @param {Object} properties - Timeline click properties
 * @param {Object} modalController - Modal controller instance
 */
async function handleItemClick(properties, modalController) {
  console.log('Item clicked, item ID:', properties.item);
  
  // Get the event data from the clicked item
  const item = items.get(properties.item);
  console.log('Item data:', item);
  
  // Extract UID from the item's ID
  const uid = extractUidFromItemId(properties.item);
  
  if (uid) {
    console.log('Extracted UID:', uid);
    
    // Readers are not allowed to edit
    if (isReader()) {
      setStatus('Read-only: editing disabled');
      return;
    }
    
    // On mobile phones, single tap should NOT open modal (tooltip handles tap)
    // Use long-press instead
    if (isMobileTap()) {
      return;
    }
    
    // Open edit modal
    modalController.openEditModal(uid);
  } else {
    console.error('Could not extract UID from item ID:', properties.item);
    setStatus('Error: Could not identify event. Please try again.');
  }
}

/**
 * Handles timeline empty space click (create new event)
 * @param {Object} properties - Timeline click properties
 * @param {Object} modalController - Modal controller instance
 */
async function handleEmptySpaceClick(properties, modalController) {
  console.log('Click was not on an item');
  
  // Quick-create all-day event when clicking on empty space within a person's row
  // Requirements:
  //  - must have a group (not the special "weeks" group)
  //  - must have a time
  const g = properties.group;
  const t = properties.time;
  
  if (!g || g === 'weeks' || !t) return;
  
  // Readers are not allowed to create
  if (isReader()) {
    setStatus('Read-only: creation disabled');
    return;
  }
  
  // Prefer the stored original URL on the group object
  const groupObj = groups.get(g);
  const calendarUrl = (groupObj && groupObj.calendarUrl) || groupReverseMap.get(g) || null;
  
  console.log('Quick-create click', { 
    groupId: g, 
    groupObj, 
    resolvedCalendarUrl: calendarUrl 
  });
  
  if (!calendarUrl) return;
  
  // Validate it's a proper CalDAV URL, not a client group id
  if (!/^https?:\/\//.test(calendarUrl)) {
    setStatus(`Cannot create: invalid calendar URL resolved for group ${g}`);
    return;
  }
  
  // Compute ISO week range (Mon..Sun) for clicked date
  const clicked = dayjs(t);
  // day(): 0=Sun..6=Sat, so shift to Monday-based
  const offsetToMonday = (clicked.day() + 6) % 7; // 0 if Monday
  const weekStart = clicked.subtract(offsetToMonday, 'day').startOf('day');
  // Set end date to Friday (4 days after Monday)
  const weekEnd = weekStart.add(4, 'day').startOf('day'); // Monday to Friday
  
  const startStr = weekStart.format('YYYY-MM-DD');
  const endStr = weekEnd.format('YYYY-MM-DD');
  
  // Open modal in create mode so we reuse the stable edit flow (no flicker)
  await modalController.openCreateWeekModal(calendarUrl, startStr, endStr, g);
}

/**
 * Initializes timeline click event handler
 * @param {Object} modalController - Modal controller instance
 */
export function initTimelineClickHandler(modalController) {
  if (!timeline) return;
  
  timeline.on('click', async (properties) => {
    // Ignore clicks right after a user drag/pan
    if (isPanning || (Date.now() - lastPanEnd) < TOUCH.PAN_DEBOUNCE) {
      return;
    }
    
    console.log('Timeline click event:', properties);
    
    if (properties.item) {
      await handleItemClick(properties, modalController);
    } else {
      await handleEmptySpaceClick(properties, modalController);
    }
  });
}

/**
 * Initializes all timeline event handlers
 * @param {Object} modalController - Modal controller instance
 */
export function initTimelineEvents(modalController) {
  if (!timeline) return;
  
  initTimelineClickHandler(modalController);
  
  // Additional event handlers can be added here
  // e.g., double-click, context menu, etc.
}
