// Custom tooltip implementation for vis-timeline
function escapeHtml(unsafe) {
  if (unsafe === undefined || unsafe === null) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
class CustomTooltip {
  constructor() {
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'vis-custom-tooltip';
    document.body.appendChild(this.tooltip);
    this.hide();
    this.isOverTooltip = false;
    this.hideTimer = null;
    this.lastItem = null;

    // Keep tooltip open when mouse is over it
    this.tooltip.addEventListener('mouseenter', () => {
      this.isOverTooltip = true;
      if (this.hideTimer) {
        clearTimeout(this.hideTimer);
        this.hideTimer = null;
      }
    });
    this.tooltip.addEventListener('mouseleave', () => {
      this.isOverTooltip = false;
      // Delay hide slightly to allow moving back to the item
      this.scheduleHide(150);
    });

    // On mobile, tapping the tooltip should open the edit modal (delegated via custom event)
    this.tooltip.addEventListener('click', () => {
      try {
        if (!this.lastItem) return;
        const uid = this.extractUid(this.lastItem);
        if (!uid) return;
        window.dispatchEvent(new CustomEvent('timeline:openEdit', { detail: { uid } }));
        this.hide();
      } catch (_) {}
    });
  }

  extractUid(item) {
    if (!item) return null;
    // Prefer explicit fields if present
    if (item.uid) return item.uid;
    if (item.eventUid) return item.eventUid;
    // Fallback: parse from id (assumes UID is after the final '/')
    try {
      const id = String(item.id || '');
      const idx = id.lastIndexOf('/');
      if (idx >= 0 && idx < id.length - 1) return id.slice(idx + 1);
    } catch (_) {}
    return null;
  }

  show(event, item) {
    if (!item) {
      this.hide();
      return;
    }

    this.lastItem = item;

    // Parse dates safely: treat YYYY-MM-DD as local date to avoid TZ shifts
    const safeParse = (value) => {
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [y, m, d] = value.split('-').map(Number);
        return new Date(y, m - 1, d);
      }
      return new Date(value);
    };

    const start = safeParse(item.start);
    let end = safeParse(item.end);
    
    // For all-day events, the end date in the timeline is already adjusted to be exclusive
    // So we need to subtract one day for display in the tooltip
    const isDateOnly = (date) => {
      const d = new Date(date);
      return d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0 && d.getMilliseconds() === 0;
    };
    
    if (isDateOnly(start) && isDateOnly(end)) {
      // Create a new date object to avoid modifying the original
      end = new Date(end);
      end.setDate(end.getDate() - 1);
    }
    
    const pad2 = (n) => String(n).padStart(2, '0');
    const formatDMY = (date) => `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${date.getFullYear()}`;
    const formatDOW = (date) => date.toLocaleDateString(undefined, { weekday: 'short' });

    const startDateStr = formatDMY(start);
    const endDateStr = formatDMY(end);
    const startDow = formatDOW(start);
    const endDow = formatDOW(end);
    const rangeStr = `${startDateStr} (${startDow})${endDateStr && endDateStr !== startDateStr ? ` – ${endDateStr} (${endDow})` : ''}`;

    // Build tooltip content with date range only
    let content = `
      <div class="tooltip-header">
        <div class="tooltip-title">${item.content || 'No title'}</div>
      </div>
      <div class="tooltip-body">
        <div class="tooltip-date">
          <span class="icon">📅</span>
          ${rangeStr}
        </div>
    `;

    // Meta badges (order number, system type, unconfirmed) and details (ticket link)
    const meta = item.meta || null;
    const badges = [];
    if (meta && meta.orderNumber) {
      badges.push(`<span class="meta-badge">Order: ${escapeHtml(String(meta.orderNumber))}</span>`);
    }
    if (meta && meta.systemType) {
      badges.push(`<span class="meta-badge">System: ${escapeHtml(String(meta.systemType))}</span>`);
    }
    // Unconfirmed badge when title/content contains '???'
    try {
      const txt = `${item.content || ''} ${item.title || ''}`;
      if (/\?\?\?/.test(txt)) {
        badges.push('<span class="meta-badge unconfirmed">Unconfirmed</span>');
      }
    } catch (_) {}

    if (badges.length > 0) {
      content += `<div class="tooltip-meta">${badges.join('')}</div>`;
    }

    if (meta && meta.ticketLink) {
      const url = escapeHtml(String(meta.ticketLink));
      content += `
        <div class="tooltip-link">
          <span class="icon">🔗</span>
          <a href="${url}" target="_blank" rel="noopener">Ticket</a>
        </div>
      `;
    }

    if (item.location) {
      const locText = escapeHtml(String(item.location));
      const gmaps = `https://maps.google.com/?q=${encodeURIComponent(String(item.location))}`;
      content += `
        <div class="tooltip-location">
          <span class="icon">📍</span>
          <a href="${gmaps}" target="_blank" rel="noopener">${locText}</a>
        </div>
      `;
    }

    if (item.description) {
      content += `
        <div class="tooltip-description">
          ${item.description.replace(/\n/g, '<br>')}
        </div>
      `;
    }

    content += '</div>'; // Close tooltip-body

    this.tooltip.innerHTML = content;
    this.tooltip.style.display = 'block';
    this.position(event);
  }

  hide() {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    this.tooltip.style.display = 'none';
  }

  scheduleHide(delay = 0) {
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => {
      if (!this.isOverTooltip) {
        this.hide();
      }
    }, delay);
  }

  position(event) {
    const x = event.clientX + 10;
    const y = event.clientY + 10;
    
    // Adjust position to keep tooltip in viewport
    const rect = this.tooltip.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    const left = x + rect.width > windowWidth ? windowWidth - rect.width - 10 : x;
    const top = y + rect.height > windowHeight ? windowHeight - rect.height - 10 : y;
    
    this.tooltip.style.left = `${left}px`;
    this.tooltip.style.top = `${top}px`;
  }
}

// Initialize and export the tooltip
const tooltip = new CustomTooltip();

// Add event listeners for showing/hiding tooltips
function setupTooltipHandlers(timeline) {
  // Show tooltip on mouse move over an item
  timeline.on('itemover', (properties) => {
    const item = timeline.itemsData.get(properties.item);
    if (item) {
      tooltip.show(properties.event, item);
    }
  });

  // Hide tooltip when mouse leaves an item
  timeline.on('itemout', () => {
    tooltip.scheduleHide(150);
  });

  // Update tooltip position on mouse move
  timeline.on('mousemove', (event) => {
    if (tooltip.tooltip.style.display === 'block') {
      tooltip.position(event);
    }
  });

  // Mobile: tap an item to show tooltip, tap tooltip to open edit modal
  try {
    const isMobile = document.body.classList.contains('mobile-device') || (navigator.maxTouchPoints || 0) > 0;
    if (isMobile) {
      timeline.on('click', (properties) => {
        try {
          if (!properties || !properties.item) return;
          const item = timeline.itemsData.get(properties.item);
          if (!item) return;
          const evt = properties.event || { clientX: (properties.pageX||0), clientY: (properties.pageY||0) };
          tooltip.show(evt, item);
          // Auto-hide after a short delay if not tapped
          tooltip.scheduleHide(2500);
        } catch (_) {}
      });

      // Long-press on an item opens edit modal directly
      let lpTimer = null;
      let startX = 0, startY = 0;
      const LONG_MS = 550;
      const MOVE_TOL = 10; // px

      const clearLp = () => { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } };
      document.addEventListener('touchstart', (e) => {
        try {
          const t = e.touches && e.touches[0];
          if (!t) return;
          // Only start if touch begins over the timeline
          const inTimeline = e.target && e.target.closest && e.target.closest('.vis-timeline');
          if (!inTimeline) return;
          startX = t.clientX; startY = t.clientY;
          clearLp();
          lpTimer = setTimeout(() => {
            try {
              // Find the vis item under the original touch point
              const el = document.elementFromPoint(startX, startY);
              const itemEl = el && el.closest && el.closest('.vis-item');
              let uid = null;
              if (itemEl) {
                const id = itemEl.getAttribute('data-id') || itemEl.getAttribute('data-itemid') || itemEl.id || '';
                let item = null;
                try { if (id) item = timeline.itemsData.get(id); } catch (_) {}
                uid = tooltip.extractUid(item || tooltip.lastItem || null);
              }
              if (uid) {
                window.dispatchEvent(new CustomEvent('timeline:openEdit', { detail: { uid } }));
                tooltip.hide();
              }
            } catch (_) {}
          }, LONG_MS);
        } catch (_) {}
      }, { passive: true });
      document.addEventListener('touchmove', (e) => {
        try {
          if (!lpTimer) return;
          const t = e.touches && e.touches[0];
          if (!t) return clearLp();
          if (Math.abs(t.clientX - startX) > MOVE_TOL || Math.abs(t.clientY - startY) > MOVE_TOL) clearLp();
        } catch (_) { clearLp(); }
      }, { passive: true });
      document.addEventListener('touchend', clearLp, { passive: true });
      document.addEventListener('touchcancel', clearLp, { passive: true });
    }
  } catch (_) {}
}

export { setupTooltipHandlers };
