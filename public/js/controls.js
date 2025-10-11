/**
 * UI Controls and Timeline Management
 * 
 * Handles all UI control interactions including date pickers, zoom controls,
 * view buttons, and timeline window management.
 * 
 * @module controls
 */

import dayjs from 'https://cdn.jsdelivr.net/npm/dayjs@1.11.13/+esm';
import { timeline, setIsPanning, setLastPanEnd } from './state.js';
import { 
  fromEl, toEl, fromDateDisplay, toDateDisplay,
  refreshBtn, fitBtn, todayBtn, monthViewBtn, quarterViewBtn
} from './dom.js';
import { renderWeekBar } from './timeline-ui.js';
import { TOUCH } from './constants.js';

// Configuration constants
const WINDOW_PAST_MONTHS = 6;
const WINDOW_FUTURE_MONTHS = 12;

/**
 * Parses a date input string into a dayjs object
 * @param {string} value - The date string to parse
 * @returns {dayjs.Dayjs|null} Parsed dayjs object or null if invalid
 */
export function parseDateInput(value) {
  // Try strict ISO first
  let d = dayjs(value, 'YYYY-MM-DD', true);
  if (d.isValid()) return d;
  
  // Try flexible parse
  d = dayjs(value);
  return d.isValid() ? d : null;
}

/**
 * Gets the allowed window bounds for date selection
 * @returns {{minDay: dayjs.Dayjs, maxDay: dayjs.Dayjs}} Min and max allowed dates
 */
export function getWindowBounds() {
  const minDay = dayjs().subtract(WINDOW_PAST_MONTHS, 'month').startOf('day');
  const maxDay = dayjs().add(WINDOW_FUTURE_MONTHS, 'month').endOf('day');
  return { minDay, maxDay };
}

/**
 * Sets the min/max bounds on date input elements
 */
export function setDateInputBounds() {
  const { minDay, maxDay } = getWindowBounds();
  const min = minDay.format('YYYY-MM-DD');
  const max = maxDay.format('YYYY-MM-DD');
  if (fromEl) { fromEl.min = min; fromEl.max = max; }
  if (toEl) { toEl.min = min; toEl.max = max; }
}

/**
 * Clamps a date string to the allowed window bounds
 * @param {string} dateStr - The date string to clamp
 * @returns {string|null} Clamped date string or null if invalid
 */
export function clampToWindow(dateStr) {
  const d = parseDateInput(dateStr);
  if (!d || !d.isValid()) return null;
  const { minDay, maxDay } = getWindowBounds();
  if (d.isBefore(minDay)) return minDay.format('YYYY-MM-DD');
  if (d.isAfter(maxDay)) return maxDay.format('YYYY-MM-DD');
  return d.format('YYYY-MM-DD');
}

/**
 * Formats a date string for display (DD.MM.YYYY)
 * @param {string} dateStr - The date string to format
 * @returns {string} Formatted date string
 */
function formatForDisplay(dateStr) {
  const d = parseDateInput(dateStr);
  if (!d || !d.isValid()) return dateStr;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.date())}.${pad(d.month() + 1)}.${d.year()}`;
}

/**
 * Updates the date display elements with formatted dates
 */
export function updateDateDisplays() {
  if (fromDateDisplay) fromDateDisplay.textContent = formatForDisplay(fromEl.value);
  if (toDateDisplay) toDateDisplay.textContent = formatForDisplay(toEl.value);
}

/**
 * Applies a date window to the timeline
 * @param {string} from - Start date (YYYY-MM-DD)
 * @param {string} to - End date (YYYY-MM-DD)
 */
export function applyWindow(from, to) {
  if (!timeline) return;
  const fromDay = parseDateInput(from);
  const toDay = parseDateInput(to);
  if (!fromDay || !toDay) return;
  
  const fStr = fromDay.format('YYYY-MM-DD');
  const tStr = toDay.format('YYYY-MM-DD');
  
  // Compute absolute bounds
  const { minDay, maxDay } = getWindowBounds();
  const minDate = minDay.toDate();
  const maxDate = maxDay.toDate();
  
  // Compute visible window
  const fromDate = fromDay.toDate();
  const toDate = toDay.toDate();
  
  // Apply to timeline
  timeline.setOptions({ start: fromDate, end: toDate, min: minDate, max: maxDate });
  timeline.setWindow(fromDate, toDate, { animation: false });
  timeline.redraw();
  updateAxisDensity(fStr, tStr);
}

/**
 * Updates the timeline axis density based on the date range
 * @param {string|dayjs.Dayjs} from - Start date
 * @param {string|dayjs.Dayjs} to - End date
 */
export function updateAxisDensity(from, to) {
  if (!timeline) return;
  const spanDays = dayjs(to).diff(dayjs(from), 'day') + 1;
  const condensed = spanDays > 45;
  
  if (condensed) {
    timeline.setOptions({ showMinorLabels: false });
  } else {
    timeline.setOptions({ showMinorLabels: true });
  }
}

/**
 * Initializes timeline control button event listeners
 * @param {Function} forceRefreshCache - Callback to refresh cache
 */
export function initTimelineControls(forceRefreshCache) {
  if (!timeline) return;
  
  // Fit button - fit timeline to all items
  fitBtn?.addEventListener('click', () => timeline.fit());
  
  // Today button - center timeline on current date
  todayBtn?.addEventListener('click', () => {
    timeline.moveTo(dayjs().valueOf());
  });
  
  // Month view button - show today-1w to today+4w
  monthViewBtn?.addEventListener('click', () => {
    const now = dayjs();
    const start = now.subtract(1, 'week').startOf('day').toDate();
    const end = now.add(4, 'week').endOf('day').toDate();
    timeline.setWindow(start, end, { animation: false });
    updateAxisDensity(dayjs(start), dayjs(end));
  });
  
  // Quarter view button - show today-1w to today+3m
  quarterViewBtn?.addEventListener('click', () => {
    const now = dayjs();
    const start = now.subtract(1, 'week').startOf('day').toDate();
    const end = now.add(3, 'month').endOf('day').toDate();
    timeline.setWindow(start, end, { animation: false });
    updateAxisDensity(dayjs(start), dayjs(end));
  });
  
  // Refresh button - force server-side cache refresh
  refreshBtn?.addEventListener('click', async () => {
    refreshBtn.disabled = true;
    try {
      await forceRefreshCache();
    } finally {
      refreshBtn.disabled = false;
    }
  });
}

/**
 * Initializes date input event listeners
 * @param {Function} refresh - Callback to refresh data
 */
export function initDateInputs(refresh) {
  /**
   * Applies and validates date inputs
   */
  function applyDateInputs() {
    const fromClamped = clampToWindow(fromEl.value);
    if (fromClamped) fromEl.value = fromClamped;
    const toClamped = clampToWindow(toEl.value);
    if (toClamped) toEl.value = toClamped;
    // Keep ordering
    if (dayjs(toEl.value).isBefore(dayjs(fromEl.value))) {
      toEl.value = fromEl.value;
    }
    refresh();
  }
  
  // Apply on blur
  fromEl?.addEventListener('blur', applyDateInputs);
  toEl?.addEventListener('blur', applyDateInputs);
  
  // Apply on Enter key
  [fromEl, toEl].forEach(el => {
    el?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        applyDateInputs();
        el.blur();
      }
    });
  });
  
  // Update display while typing (don't refresh)
  fromEl?.addEventListener('input', updateDateDisplays);
  toEl?.addEventListener('input', updateDateDisplays);
}

/**
 * Initializes timeline panning/zooming event listeners
 */
export function initTimelinePanEvents() {
  if (!timeline) return;
  
  // Track user panning/zooming to suppress accidental click after drag
  timeline.on('rangechange', (props) => {
    try {
      if (props && props.byUser) {
        setIsPanning(true);
      }
    } catch (_) {}
  });
  
  timeline.on('rangechanged', (props) => {
    try {
      if (props && props.byUser) {
        setIsPanning(false);
        setLastPanEnd(Date.now());
      }
    } catch (_) {}
  });
}

/**
 * Initializes window resize handler
 */
export function initResizeHandler() {
  window.addEventListener('resize', () => {
    if (!timeline) return;
    // Re-apply window after resize to prevent drift
    requestAnimationFrame(() => applyWindow(fromEl.value, toEl.value));
    requestAnimationFrame(() => updateAxisDensity(fromEl.value, toEl.value));
    // Repaint week labels to current positions
    try { 
      requestAnimationFrame(() => renderWeekBar(timeline)); 
    } catch (_) {}
    // Ensure Leaflet map resizes to new container dimensions
    try {
      if (typeof map !== 'undefined' && map && map.invalidateSize) {
        setTimeout(() => map.invalidateSize(false), 0);
      }
    } catch (_) {}
  });
}
