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
  }

  show(event, item) {
    if (!item) {
      this.hide();
      return;
    }

    // Parse dates safely: treat YYYY-MM-DD as local date to avoid TZ shifts
    const safeParse = (value) => {
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [y, m, d] = value.split('-').map(Number);
        return new Date(y, m - 1, d);
        
      }
      return new Date(value);
    };

    const start = safeParse(item.start);
    const end = safeParse(item.end);
    
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

    // Meta badges (order number, system type) and details (ticket link, customer address)
    const meta = item.meta || null;
    if (meta && (meta.orderNumber || meta.systemType || meta.ticketLink)) {
      content += '<div class="tooltip-meta">';
      if (meta.orderNumber) {
        content += `<span class="meta-badge">Order: ${escapeHtml(String(meta.orderNumber))}</span>`;
      }
      if (meta.systemType) {
        content += `<span class="meta-badge">System: ${escapeHtml(String(meta.systemType))}</span>`;
      }
      content += '</div>';

      if (meta.ticketLink) {
        const url = escapeHtml(String(meta.ticketLink));
        content += `
          <div class="tooltip-link">
            <span class="icon">🔗</span>
            <a href="${url}" target="_blank" rel="noopener">Ticket</a>
          </div>
        `;
      }
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
}

export { setupTooltipHandlers };
