/**
 * Timeline UI Helpers Module
 * 
 * Provides UI enhancements for the timeline including label coloring and week number overlay.
 * 
 * @module timeline-ui
 */

import { LABEL_PALETTE, LANE_OPACITY } from './ui-config.js';

/**
 * Converts a hex color to rgba with specified opacity
 * @param {string} hex - Hex color code (e.g., '#e0f2fe')
 * @param {number} alpha - Opacity value between 0 and 1
 * @returns {string} RGBA color string
 * @private
 */
function hexToRgba(hex, alpha) {
  try {
    // Remove # if present
    hex = hex.replace('#', '');
    
    // Parse hex values
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  } catch (_) {
    return `rgba(255, 255, 255, ${alpha})`;
  }
}

/**
 * Applies background colors to timeline group labels and lane backgrounds
 * @param {Object} groups - vis-timeline groups DataSet
 * @returns {void}
 */
export function applyGroupLabelColors(groups) {
  try {
    const labelNodes = document.querySelectorAll('.vis-timeline .vis-labelset .vis-label');
    
    if (!labelNodes || labelNodes.length === 0) return;
    
    labelNodes.forEach((labelNode, idx) => {
      // Use LABEL_PALETTE as the single source of truth for colors
      const color = LABEL_PALETTE[idx % LABEL_PALETTE.length];
      
      // Apply color to label
      labelNode.style.backgroundColor = color;
      const inner = labelNode.querySelector('.vis-inner');
      if (inner) inner.style.backgroundColor = color;
      
      // Find the corresponding lane by matching the vertical position
      // Labels and lanes are rendered in the same order by vis-timeline
      const itemSet = document.querySelector('.vis-timeline .vis-itemset');
      if (itemSet) {
        // Get all lane background elements (they're in .vis-background)
        const allBackgroundLanes = itemSet.querySelectorAll('.vis-background .vis-group');
        if (allBackgroundLanes[idx]) {
          allBackgroundLanes[idx].style.backgroundColor = hexToRgba(color, LANE_OPACITY);
        }
        
        // Also apply to foreground lanes for full coverage
        const allForegroundLanes = itemSet.querySelectorAll('.vis-foreground .vis-group');
        if (allForegroundLanes[idx]) {
          allForegroundLanes[idx].style.backgroundColor = hexToRgba(color, LANE_OPACITY);
        }
      }
    });
  } catch (_) {}
}

/**
 * Week bar element reference
 * @type {HTMLElement|null}
 */
let weekBarEl = null;

/**
 * Ensures the week bar element exists in the DOM
 * @private
 * @returns {HTMLElement|null} The week bar element
 */
function ensureWeekBar() {
  if (weekBarEl && weekBarEl.parentElement) return weekBarEl;
  weekBarEl = document.createElement('div');
  weekBarEl.className = 'week-bar';
  const bottomPanel = document.querySelector('.vis-timeline .vis-panel.vis-bottom');
  if (bottomPanel && bottomPanel.appendChild) {
    bottomPanel.style.position = bottomPanel.style.position || 'relative';
    weekBarEl.style.zIndex = '3000';
    bottomPanel.appendChild(weekBarEl);
  }
  return weekBarEl;
}

/**
 * Renders week numbers at the bottom of the timeline
 * @param {Timeline} timeline - vis-timeline instance
 * @returns {void}
 */
export function renderWeekBar(timeline) {
  try {
    if (!timeline) return;
    const w = timeline.getWindow();
    const from = w.start;
    const to = w.end;
    const bar = ensureWeekBar();
    if (!bar) return;
    while (bar.firstChild) bar.removeChild(bar.firstChild);

    const start = new Date(from);
    const end = new Date(to);
    // Compute ms values
    const startMs = +start;
    const endMs = +end;
    const spanMs = Math.max(1, endMs - startMs);

    const bottomPanel = document.querySelector('.vis-timeline .vis-panel.vis-bottom');
    const panelRect = bottomPanel ? bottomPanel.getBoundingClientRect() : null;
    const centerContent = document.querySelector('.vis-timeline .vis-center .vis-content');
    const centerRect = centerContent ? centerContent.getBoundingClientRect() : null;
    const contentWidth = centerContent ? centerContent.clientWidth : 1;

    bar.style.top = '0px';
    bar.style.bottom = '0px';
    bar.style.height = '100%';

    // Draw weekly ticks (every Monday)
    const tickCursor = new Date(start);
    // Move to next Monday
    while (tickCursor.getDay() !== 1) tickCursor.setDate(tickCursor.getDate() + 1);
    while (tickCursor < end) {
      const tTick = +tickCursor;
      const fracTick = (tTick - startMs) / spanMs;
      const xTickAbs = (centerRect ? centerRect.left : 0) + (Math.max(0, Math.min(1, fracTick)) * contentWidth);
      if (isFinite(xTickAbs)) {
        const line = document.createElement('div');
        line.className = 'week-tick';
        const leftTick = (panelRect) ? (xTickAbs - panelRect.left) : xTickAbs;
        line.style.left = `${leftTick}px`;
        bar.appendChild(line);
      }
      tickCursor.setDate(tickCursor.getDate() + 7);
    }

    // Week chips roughly at mid-week (Mon + 3.5 days)
    const labelCursor = new Date(start);
    while (labelCursor.getDay() !== 1) labelCursor.setDate(labelCursor.getDate() + 1);
    let count = 0;
    while (labelCursor < end) {
      const mid = new Date(labelCursor);
      mid.setDate(mid.getDate() + 3);
      mid.setHours(mid.getHours() + 12);
      const t = +mid;
      const frac = (t - startMs) / spanMs;
      const x = (centerRect ? centerRect.left : 0) + (Math.max(0, Math.min(1, frac)) * contentWidth);
      if (isFinite(x)) {
        const chip = document.createElement('div');
        chip.className = 'week-chip';
        chip.textContent = `W${getIsoWeekNumber(mid).toString().padStart(2, '0')}`;
        chip.style.position = 'absolute';
        const left = (panelRect) ? (x - panelRect.left) : x;
        chip.style.left = `${left}px`;
        chip.style.bottom = '2px';
        bar.appendChild(chip);
        count++;
      }
      labelCursor.setDate(labelCursor.getDate() + 7);
    }
  } catch (e) {
    try { console.warn('[weekbar] render failed', e); } catch (_) {}
  }
}

function getIsoWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
}
