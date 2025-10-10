// Timeline initialization module
// Creates a vis-timeline instance with provided datasets and wires UI behaviors

import { Timeline } from 'https://cdn.jsdelivr.net/npm/vis-timeline@7.7.3/standalone/esm/vis-timeline-graph2d.min.js';
import { setupTooltipHandlers } from '../custom-tooltip.js';
import { applyGroupLabelColors, renderWeekBar } from './timeline-ui.js';

export function initTimeline(timelineEl, items, groups) {
  if (!timelineEl) throw new Error('timelineEl is required');
  if (!items || !groups) throw new Error('items and groups DataSets are required');

  const isTouch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

  const options = {
    groupOrder: 'order',
    stack: true,
    stackSubgroups: false,
    height: 'auto',
    minHeight: '600px',
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
      // Ensure JS receives all touch gestures on the actual vis DOM (child), not ancestors
      const visRoot = timelineEl.querySelector('.vis-timeline') || timelineEl;
      [timelineEl, visRoot].forEach(el => { try { if (el && el.style) el.style.touchAction = 'none'; } catch (_) {} });

      const cancelIfMultiTouch = (e) => {
        try { if ((e.touches && e.touches.length > 1) || (e.scale && e.scale !== 1)) e.preventDefault(); } catch (_) {}
      };
      const cancelIfDoubleTap = (() => {
        let last = 0; const TH = 300;
        return (e) => {
          try {
            const now = Date.now();
            if (now - last < TH) { e.preventDefault(); }
            last = now;
          } catch (_) {}
        };
      })();

      // Bind helpers on both container and vis root to reliably intercept inside timeline
      const bind = (el) => {
        if (!el) return;
        // iOS Safari older gesture events (safe to ignore if unsupported)
        el.addEventListener('gesturestart', (e) => { try { e.preventDefault(); } catch (_) {} }, { passive: false });
        el.addEventListener('gesturechange', (e) => { try { e.preventDefault(); } catch (_) {} }, { passive: false });
        el.addEventListener('gestureend', (e) => { try { e.preventDefault(); } catch (_) {} }, { passive: false });
        // Standard touch events
        el.addEventListener('touchstart', cancelIfMultiTouch, { passive: false });
        el.addEventListener('touchmove', cancelIfMultiTouch, { passive: false });
        el.addEventListener('touchend', cancelIfDoubleTap, { passive: false });
      };
      bind(timelineEl);
      bind(visRoot);
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
