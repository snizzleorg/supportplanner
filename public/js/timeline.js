// Timeline initialization module
// Creates a vis-timeline instance with provided datasets and wires UI behaviors

import { Timeline } from 'https://cdn.jsdelivr.net/npm/vis-timeline@7.7.3/standalone/esm/vis-timeline-graph2d.min.js';
import { setupTooltipHandlers } from '../custom-tooltip.js';
import { applyGroupLabelColors, renderWeekBar } from './timeline-ui.js';

export function initTimeline(timelineEl, items, groups) {
  if (!timelineEl) throw new Error('timelineEl is required');
  if (!items || !groups) throw new Error('items and groups DataSets are required');

  const options = {
    groupOrder: 'order',
    stack: true,
    stackSubgroups: false,
    height: 'auto',
    minHeight: '500px',
    verticalScroll: true,
    horizontalScroll: false,
    zoomable: true,
    zoomKey: 'ctrlKey',
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
