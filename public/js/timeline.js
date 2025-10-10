// Timeline initialization module
// Creates a vis-timeline instance with provided datasets and wires UI behaviors

import { Timeline } from 'https://cdn.jsdelivr.net/npm/vis-timeline@7.7.3/standalone/esm/vis-timeline-graph2d.min.js';
import { setupTooltipHandlers } from '../custom-tooltip.js';
import { applyGroupLabelColors, renderWeekBar } from './timeline-ui.js';
import { TIMELINE, TOUCH } from './constants.js';

export function initTimeline(timelineEl, items, groups) {
  if (!timelineEl) throw new Error('timelineEl is required');
  if (!items || !groups) throw new Error('items and groups DataSets are required');

  const isTouch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  const options = {
    groupOrder: 'order',
    stack: true,
    stackSubgroups: false,
    height: 'auto',
    minHeight: `${TIMELINE.MIN_HEIGHT}px`,
    verticalScroll: true,
    horizontalScroll: isTouch, // allow native scroll on touch devices
    zoomable: true,
    zoomKey: isTouch ? undefined : 'ctrlKey', // pinch-zoom on touch; Ctrl+wheel on desktop
    zoomMin: 1000 * 60 * 60 * 24,
    zoomMax: 1000 * 60 * 60 * 24 * 365 * 2,
    orientation: 'both',
    selectable: false,
    autoResize: true,
    margin: { item: 0, axis: 10 },
    timeAxis: { scale: 'day', step: 1 },
    showTooltips: false,
    template: function(item, element) {
      if (!item) return '';
      const div = document.createElement('div');
      div.className = 'vis-item-content';
      div.textContent = item.content || '';
      try {
        const text = `${item.title || ''} ${item.content || ''}`;
        if (/\?\?\?/.test(text)) {
          div.style.opacity = '0.5';
          if (element && element.classList) element.classList.add('unconfirmed');
          const baseTitle = item.title || item.content || '';
          element && element.setAttribute && element.setAttribute('title', `${baseTitle} (unconfirmed)`);
        }
      } catch (_) {}
      if (item.dataAttributes) {
        Object.entries(item.dataAttributes).forEach(([key, value]) => {
          div.setAttribute(key, value);
        });
      }
      return div;
    },
    tooltip: { followMouse: true, overflowMethod: 'cap' },
  };

  const timeline = new Timeline(timelineEl, items, groups, options);
  try { window.timeline = timeline; } catch (_) {}
  try { renderWeekBar(timeline); } catch (_) {}

  setupTooltipHandlers(timeline);

  // Prevent native page pinch/double-tap zoom from conflicting with vis pinch-zoom inside the timeline area
  if (isTouch) {
    try {
      // Ensure JS receives all touch gestures
      timelineEl.style.touchAction = 'none';
      const root = timelineEl.closest('.vis-timeline') || timelineEl;
      if (root && root.style) root.style.touchAction = 'none';

      const cancelIfMultiTouch = (e) => {
        try { if ((e.touches && e.touches.length > 1) || (e.scale && e.scale !== 1)) e.preventDefault(); } catch (_) {}
      };
      const cancelIfDoubleTap = (() => {
        let last = 0;
        return (e) => {
          try {
            const now = Date.now();
            if (now - last < TOUCH.DOUBLE_TAP_THRESHOLD) { e.preventDefault(); }
            last = now;
          } catch (_) {}
        };
      })();

      // iOS Safari older gesture events (safe to ignore if unsupported)
      timelineEl.addEventListener('gesturestart', (e) => { try { e.preventDefault(); } catch (_) {} }, { passive: false });
      timelineEl.addEventListener('gesturechange', (e) => { try { e.preventDefault(); } catch (_) {} }, { passive: false });
      timelineEl.addEventListener('gestureend', (e) => { try { e.preventDefault(); } catch (_) {} }, { passive: false });

      // Standard touch events
      timelineEl.addEventListener('touchstart', cancelIfMultiTouch, { passive: false });
      timelineEl.addEventListener('touchmove', cancelIfMultiTouch, { passive: false });
      timelineEl.addEventListener('touchend', cancelIfDoubleTap, { passive: false });
    } catch (_) {}
  }

  ['changed','rangechanged','rangechange','redraw'].forEach(evt => {
    try {
      timeline.on(evt, () => {
        requestAnimationFrame(() => applyGroupLabelColors(groups));
        try { renderWeekBar(timeline); } catch (_) {}
      });
    } catch (_) {}
  });

  try {
    const labelSet = document.querySelector('.vis-timeline .vis-labelset');
    if (labelSet) {
      const observer = new MutationObserver(() => applyGroupLabelColors(groups));
      observer.observe(labelSet, { childList: true, subtree: true });
    }
  } catch (_) {}

  // Track user panning and repaint week bar
  try {
    timeline.on('rangechanged', () => { try { renderWeekBar(timeline); } catch (_) {} });
    timeline.on('redraw', () => { try { renderWeekBar(timeline); } catch (_) {} });
  } catch (_) {}

  return timeline;
}
