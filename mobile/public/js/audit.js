/**
 * Audit History Module
 * 
 * Handles displaying audit history and undo operations
 */

import { escapeHtml } from './security.js';
import { API_BASE } from './config.js';
import { getCsrfToken } from './api.js';

let currentFilters = {
  operation: '',
  time: '24h'
};

let currentUndoTarget = null;

/**
 * Initialize audit history modal
 */
export function initAuditModal() {
  const historyBtn = document.getElementById('historyBtn');
  const auditModal = document.getElementById('auditModal');
  const closeAuditModal = document.getElementById('closeAuditModal');
  const operationFilter = document.getElementById('auditOperationFilter');
  const timeFilter = document.getElementById('auditTimeFilter');

  // Open modal with slide-in transition
  historyBtn?.addEventListener('click', () => {
    showAuditView();
  });

  // Close modal with slide-out transition
  closeAuditModal?.addEventListener('click', () => {
    hideAuditView();
  });

  // Close on background click (disabled for fullscreen view)
  // auditModal?.addEventListener('click', (e) => {
  //   if (e.target === auditModal) {
  //     hideAuditView();
  //   }
  // });

  // Filter changes
  operationFilter?.addEventListener('change', (e) => {
    currentFilters.operation = e.target.value;
    loadAuditHistory();
  });

  timeFilter?.addEventListener('change', (e) => {
    currentFilters.time = e.target.value;
    loadAuditHistory();
  });

  // Init undo modal
  initUndoModal();
  
  // Listen for ESC key to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const auditModal = document.getElementById('auditModal');
      if (auditModal?.classList.contains('view-active')) {
        hideAuditView();
      }
    }
  });
}

/**
 * Show audit view with slide-in transition
 */
export function showAuditView() {
  const auditModal = document.getElementById('auditModal');
  const appBar = document.querySelector('.app-bar');
  const timelineWrapper = document.getElementById('timelineWrapper');
  const menuOverlay = document.getElementById('menuOverlay');
  const menuBackdrop = document.getElementById('menuBackdrop');
  
  if (!auditModal) return;
  
  // Close menu if open
  menuOverlay?.classList.remove('active');
  menuBackdrop?.classList.remove('active');
  
  // Hide timeline and app bar
  if (appBar) appBar.style.display = 'none';
  if (timelineWrapper) timelineWrapper.style.display = 'none';
  
  // Show with slide-in animation
  auditModal.style.display = 'flex';
  auditModal.classList.add('view-entering');
  
  // Trigger reflow
  auditModal.offsetHeight;
  
  // Start slide-in
  auditModal.classList.remove('view-entering');
  auditModal.classList.add('view-active');
  
  // Load data
  loadAuditHistory();
}

/**
 * Hide audit view with slide-out transition
 */
export function hideAuditView() {
  const auditModal = document.getElementById('auditModal');
  const appBar = document.querySelector('.app-bar');
  const timelineWrapper = document.getElementById('timelineWrapper');
  
  if (!auditModal) return;
  
  // Start slide-out animation
  auditModal.classList.remove('view-active');
  auditModal.classList.add('view-exiting');
  
  setTimeout(() => {
    auditModal.style.display = 'none';
    auditModal.classList.remove('view-exiting');
  }, 300);
  
  // Restore timeline and app bar
  if (appBar) appBar.style.display = '';
  if (timelineWrapper) timelineWrapper.style.display = '';
}

/**
 * Load and display audit history
 */
async function loadAuditHistory() {
  const loading = document.getElementById('auditLoading');
  const empty = document.getElementById('auditEmpty');
  const entries = document.getElementById('auditEntries');

  // Show loading
  loading.style.display = 'block';
  empty.style.display = 'none';
  entries.innerHTML = '';

  try {
    // Build query parameters
    const params = new URLSearchParams();
    if (currentFilters.operation) {
      params.append('operation', currentFilters.operation);
    }

    // Calculate time filter
    if (currentFilters.time !== 'all') {
      const since = calculateTimeFilter(currentFilters.time);
      if (since) {
        params.append('since', since);
      }
    }

    params.append('limit', '100');

    // Fetch audit history
    const response = await fetch(`${API_BASE}/api/audit/recent?${params}`);
    if (!response.ok) {
      throw new Error(`Failed to load audit history: ${response.status}`);
    }

    const data = await response.json();
    console.log('[Audit] Loaded history:', data.count, 'entries');

    // Hide loading
    loading.style.display = 'none';

    // Show empty state or entries
    if (data.count === 0) {
      empty.style.display = 'block';
    } else {
      renderAuditEntries(data.history);
    }
  } catch (error) {
    console.error('[Audit] Error loading history:', error);
    loading.style.display = 'none';
    empty.style.display = 'block';
  }
}

/**
 * Calculate timestamp for time filter
 */
function calculateTimeFilter(timeFilter) {
  const now = new Date();
  
  switch (timeFilter) {
    case '1h':
      now.setHours(now.getHours() - 1);
      break;
    case '24h':
      now.setHours(now.getHours() - 24);
      break;
    case 'today':
      now.setHours(0, 0, 0, 0);
      break;
    case 'week':
      now.setDate(now.getDate() - 7);
      break;
    case 'all':
    default:
      return null;
  }
  
  return now.toISOString();
}

/**
 * Render audit entries
 */
function renderAuditEntries(history) {
  const container = document.getElementById('auditEntries');
  container.innerHTML = '';

  history.forEach((entry, index) => {
    const entryEl = createAuditEntry(entry, index);
    container.appendChild(entryEl);
  });
}

/**
 * Create a single audit entry element
 */
function createAuditEntry(entry, index) {
  const div = document.createElement('div');
  div.className = 'audit-entry';
  div.dataset.index = index;

  const operation = entry.operation.toLowerCase();
  const timeAgo = formatTimeAgo(entry.timestamp);
  
  // Entry header
  const header = document.createElement('div');
  header.className = 'entry-header';
  
  const operationDiv = document.createElement('div');
  operationDiv.className = 'entry-operation';
  operationDiv.innerHTML = `
    <span class="op-badge ${operation}">${escapeHtml(entry.operation)}</span>
    <span class="entry-time">${escapeHtml(timeAgo)}</span>
  `;
  
  // Check if entry has complete data for undo (especially for old DELETE entries)
  const isIncomplete = entry.operation === 'DELETE' && entry.beforeState && 
    ((!entry.beforeState.calendar && !entry.beforeState.calendarUrl) || 
     !entry.beforeState.start || !entry.beforeState.end);
  
  const undoBtn = document.createElement('button');
  undoBtn.className = 'undo-btn';
  undoBtn.textContent = isIncomplete ? '⚠️ Incomplete' : '↩️ Undo';
  undoBtn.disabled = isIncomplete;
  undoBtn.title = isIncomplete ? 'Cannot undo: incomplete audit data (old entry)' : 'Undo this change';
  if (!isIncomplete) {
    undoBtn.onclick = (e) => {
      e.stopPropagation();
      showUndoConfirmation(entry);
    };
  }
  
  header.appendChild(operationDiv);
  header.appendChild(undoBtn);
  
  // Entry summary
  const summary = document.createElement('div');
  summary.className = 'entry-summary';
  summary.innerHTML = formatEntrySummary(entry);
  
  // Entry user
  const user = document.createElement('div');
  user.className = 'entry-user';
  const userName = entry.user?.email || 'Unknown';
  user.textContent = `By: ${userName}`;
  
  // Entry details (expandable)
  const details = createEntryDetails(entry);
  
  div.appendChild(header);
  div.appendChild(summary);
  div.appendChild(user);
  div.appendChild(details);
  
  // Toggle expansion on click
  div.addEventListener('click', (e) => {
    if (!e.target.closest('.undo-btn')) {
      div.classList.toggle('expanded');
      details.classList.toggle('visible');
    }
  });
  
  return div;
}

/**
 * Format entry summary based on operation type
 */
function formatEntrySummary(entry) {
  const arrow = '<span class="change-arrow">→</span>';
  
  switch (entry.operation) {
    case 'UPDATE':
      const beforeSummary = escapeHtml(entry.beforeState?.summary || 'Unnamed');
      const afterSummary = escapeHtml(entry.afterState?.summary || 'Unnamed');
      if (beforeSummary !== afterSummary) {
        return `"${beforeSummary}" ${arrow} "${afterSummary}"`;
      }
      return `"${afterSummary}" updated`;
      
    case 'CREATE':
      return `"${escapeHtml(entry.afterState?.summary || 'Unnamed')}" created`;
      
    case 'DELETE':
      return `"${escapeHtml(entry.beforeState?.summary || 'Unnamed')}" (deleted)`;
      
    case 'MOVE':
      const fromCal = extractCalendarName(entry.beforeState?.calendarUrl || entry.beforeState?.calendar);
      const toCal = extractCalendarName(entry.afterState?.calendarUrl || entry.afterState?.calendar);
      return `"${escapeHtml(entry.afterState?.summary || 'Unnamed')}" moved: ${escapeHtml(fromCal)} ${arrow} ${escapeHtml(toCal)}`;
      
    default:
      return escapeHtml(entry.afterState?.summary || entry.beforeState?.summary || 'Event');
  }
}

/**
 * Create detailed changes view
 */
function createEntryDetails(entry) {
  const details = document.createElement('div');
  details.className = 'entry-details';
  
  const changesList = document.createElement('ul');
  changesList.className = 'changes-list';
  
  // Compare before and after states
  const changes = detectChanges(entry);
  
  changes.forEach(change => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="change-icon">${change.icon}</span>
      <div class="change-content">
        <span class="change-label">${escapeHtml(change.label)}</span>
        <div class="change-values">${change.value}</div>
      </div>
    `;
    changesList.appendChild(li);
  });
  
  details.appendChild(changesList);
  
  return details;
}

/**
 * Detect changes between before and after states
 */
function detectChanges(entry) {
  const changes = [];
  const before = entry.beforeState || {};
  const after = entry.afterState || {};
  const arrow = '<span class="change-arrow">→</span>';
  
  // Summary
  if (before.summary !== after.summary) {
    changes.push({
      icon: '✏️',
      label: 'Summary',
      value: entry.operation === 'CREATE' 
        ? escapeHtml(after.summary || '')
        : entry.operation === 'DELETE'
        ? escapeHtml(before.summary || '')
        : `${escapeHtml(before.summary || '')} ${arrow} ${escapeHtml(after.summary || '')}`
    });
  }
  
  // Location
  if (before.location !== after.location && (before.location || after.location)) {
    changes.push({
      icon: '📍',
      label: 'Location',
      value: entry.operation === 'CREATE'
        ? escapeHtml(after.location || '')
        : entry.operation === 'DELETE'
        ? escapeHtml(before.location || '')
        : `${escapeHtml(before.location || '(none)')} ${arrow} ${escapeHtml(after.location || '(none)')}`
    });
  }
  
  // Start time
  if (before.start !== after.start && (before.start || after.start)) {
    changes.push({
      icon: '🕐',
      label: 'Start Time',
      value: entry.operation === 'CREATE'
        ? formatDateTime(after.start)
        : entry.operation === 'DELETE'
        ? formatDateTime(before.start)
        : `${formatDateTime(before.start)} ${arrow} ${formatDateTime(after.start)}`
    });
  }
  
  // End time
  if (before.end !== after.end && (before.end || after.end)) {
    changes.push({
      icon: '🕐',
      label: 'End Time',
      value: entry.operation === 'CREATE'
        ? formatDateTime(after.end)
        : entry.operation === 'DELETE'
        ? formatDateTime(before.end)
        : `${formatDateTime(before.end)} ${arrow} ${formatDateTime(after.end)}`
    });
  }
  
  // Calendar
  const beforeCal = before.calendarUrl || before.calendar;
  const afterCal = after.calendarUrl || after.calendar;
  
  // Always show calendar for DELETE (or when calendars differ for other operations)
  if (entry.operation === 'DELETE' || (beforeCal !== afterCal && (beforeCal || afterCal))) {
    changes.push({
      icon: '🔄',
      label: 'Calendar',
      value: entry.operation === 'CREATE'
        ? escapeHtml(extractCalendarName(afterCal) || '(not recorded)')
        : entry.operation === 'DELETE'
        ? escapeHtml(extractCalendarName(beforeCal) || '(not recorded)')
        : `${escapeHtml(extractCalendarName(beforeCal) || '(not recorded)')} ${arrow} ${escapeHtml(extractCalendarName(afterCal) || '(not recorded)')}`
    });
  }
  
  // Description (use clean description without embedded YAML)
  const beforeCleanDesc = extractCleanDescription(before.description || '');
  const afterCleanDesc = extractCleanDescription(after.description || '');
  if (beforeCleanDesc !== afterCleanDesc && (beforeCleanDesc || afterCleanDesc)) {
    const beforeDesc = truncateText(beforeCleanDesc, 100);
    const afterDesc = truncateText(afterCleanDesc, 100);
    changes.push({
      icon: '📝',
      label: 'Description',
      value: entry.operation === 'CREATE'
        ? escapeHtml(afterDesc)
        : entry.operation === 'DELETE'
        ? escapeHtml(beforeDesc)
        : `${escapeHtml(beforeDesc)} ${arrow} ${escapeHtml(afterDesc)}`
    });
  }
  
  // Metadata
  const beforeMeta = JSON.stringify(before.meta || {});
  const afterMeta = JSON.stringify(after.meta || {});
  if (beforeMeta !== afterMeta && (before.meta || after.meta)) {
    changes.push({
      icon: '🏷️',
      label: 'Metadata',
      value: entry.operation === 'CREATE'
        ? formatMetadata(after.meta)
        : entry.operation === 'DELETE'
        ? formatMetadata(before.meta)
        : `${formatMetadata(before.meta)} ${arrow} ${formatMetadata(after.meta)}`
    });
  }
  
  // If no specific changes detected, show generic info
  if (changes.length === 0) {
    changes.push({
      icon: entry.operation === 'CREATE' ? '➕' : entry.operation === 'DELETE' ? '🗑️' : '✏️',
      label: entry.operation,
      value: escapeHtml(after.summary || before.summary || 'Event')
    });
  }
  
  return changes;
}

/**
 * Extract calendar name from URL
 */
function extractCalendarName(url) {
  if (!url) return 'Unknown';
  // Split and filter out empty parts (from trailing slashes)
  const parts = url.split('/').filter(p => p);
  const lastPart = parts[parts.length - 1];
  if (!lastPart) return 'Unknown';
  return decodeURIComponent(lastPart);
}

/**
 * Extract clean description without embedded YAML metadata
 */
function extractCleanDescription(description) {
  if (!description) return '';
  
  // Remove YAML fenced blocks (```yaml ... ```)
  const yamlPattern = /```yaml\s*[\s\S]*?\s*```/g;
  const cleaned = description.replace(yamlPattern, '').trim();
  
  return cleaned;
}

/**
 * Truncate text to specified length
 */
function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Format metadata for display
 */
function formatMetadata(meta) {
  if (!meta || Object.keys(meta).length === 0) return '(none)';
  
  // Show key fields in a readable format
  const fields = [];
  if (meta.orderNumber) fields.push(`Order: ${meta.orderNumber}`);
  if (meta.ticketLink) fields.push(`Ticket: ${meta.ticketLink}`);
  if (meta.systemType) fields.push(`System: ${meta.systemType}`);
  
  if (fields.length > 0) {
    return escapeHtml(fields.join(', '));
  }
  
  // Fallback: show all keys
  const keys = Object.keys(meta).filter(k => meta[k]);
  if (keys.length === 0) return '(empty)';
  return escapeHtml(keys.join(', ') + ' (set)');
}

/**
 * Format date/time for display
 */
function formatDateTime(dateStr) {
  if (!dateStr) return '(none)';
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Format timestamp as relative time
 */
function formatTimeAgo(timestamp) {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  
  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
  
  return then.toLocaleDateString();
}

/**
 * Initialize undo modal
 */
function initUndoModal() {
  const undoModal = document.getElementById('undoModal');
  const closeUndoModal = document.getElementById('closeUndoModal');
  const cancelUndo = document.getElementById('cancelUndo');
  const confirmUndo = document.getElementById('confirmUndo');
  
  closeUndoModal?.addEventListener('click', () => {
    undoModal?.classList.remove('active');
  });
  
  cancelUndo?.addEventListener('click', () => {
    undoModal?.classList.remove('active');
  });
  
  confirmUndo?.addEventListener('click', () => {
    if (currentUndoTarget) {
      performUndo(currentUndoTarget);
    }
  });
  
  // Close on background click
  undoModal?.addEventListener('click', (e) => {
    if (e.target === undoModal) {
      undoModal.classList.remove('active');
    }
  });
}

/**
 * Show undo confirmation modal
 */
function showUndoConfirmation(entry) {
  currentUndoTarget = entry;
  
  const modal = document.getElementById('undoModal');
  const title = document.getElementById('undoModalTitle');
  const body = document.getElementById('undoModalBody');
  
  // Set title based on operation
  switch (entry.operation) {
    case 'CREATE':
      title.textContent = '⚠️ Undo Create Operation';
      break;
    case 'DELETE':
      title.textContent = '↩️ Restore Deleted Event';
      break;
    case 'UPDATE':
    case 'MOVE':
      title.textContent = '↩️ Undo Changes';
      break;
    default:
      title.textContent = '⚠️ Confirm Undo';
  }
  
  // Build confirmation content
  body.innerHTML = buildUndoConfirmation(entry);
  
  modal?.classList.add('active');
}

/**
 * Build undo confirmation content
 */
function buildUndoConfirmation(entry) {
  const userName = entry.user?.email || 'Unknown';
  const timeAgo = formatTimeAgo(entry.timestamp);
  const summary = escapeHtml(entry.afterState?.summary || entry.beforeState?.summary || 'Event');
  
  let content = `<p style="margin-bottom: 16px;">You are about to undo this change:</p>`;
  
  content += `
    <div class="confirm-details">
      <h4>Operation: ${escapeHtml(entry.operation)}</h4>
      <ul>
        <li>Made by: ${escapeHtml(userName)}</li>
        <li>Time: ${escapeHtml(timeAgo)}</li>
      </ul>
    </div>
  `;
  
  switch (entry.operation) {
    case 'CREATE':
      content += `
        <p style="margin-bottom: 12px;"><strong>This will DELETE the event:</strong></p>
        <div class="confirm-details">
          <ul>
            <li>"${summary}"</li>
          </ul>
        </div>
        <div class="confirm-warning">
          ⚠️ The event will be permanently deleted.
        </div>
      `;
      break;
      
    case 'DELETE':
      content += `
        <p style="margin-bottom: 12px;"><strong>This will RESTORE the deleted event:</strong></p>
        <div class="confirm-details">
          <ul>
            <li>"${summary}"</li>
            <li>Location: ${escapeHtml(entry.beforeState?.location || '(none)')}</li>
            <li>Time: ${formatDateTime(entry.beforeState?.start)} - ${formatDateTime(entry.beforeState?.end)}</li>
          </ul>
        </div>
      `;
      break;
      
    case 'UPDATE':
    case 'MOVE':
      const changes = detectChanges(entry);
      content += `
        <p style="margin-bottom: 12px;"><strong>This will restore the previous version:</strong></p>
        <div class="confirm-details">
          <ul>
            ${changes.map(c => `<li>• ${c.label}: ${c.value}</li>`).join('')}
          </ul>
        </div>
      `;
      break;
  }
  
  content += `
    <div class="confirm-warning" style="margin-top: 16px;">
      ⚠️ This action cannot be undone.
    </div>
  `;
  
  return content;
}

/**
 * Perform the undo operation
 */
async function performUndo(entry) {
  const modal = document.getElementById('undoModal');
  const statusBar = document.getElementById('statusBar');
  
  try {
    // Get event UID
    const uid = entry.afterState?.uid || entry.beforeState?.uid;
    if (!uid) {
      throw new Error('Event UID not found');
    }
    
    // Get CSRF token
    const csrfToken = await getCsrfToken();
    
    // Call undo API
    const response = await fetch(`${API_BASE}/api/audit/undo/${uid}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken
      },
      credentials: 'include'
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Undo failed');
    }
    
    const result = await response.json();
    console.log('[Audit] Undo successful:', result);
    
    // Close modals
    modal?.classList.remove('active');
    hideAuditView();
    
    // Show success message
    if (statusBar) {
      statusBar.textContent = '✅ Change undone successfully - refreshing...';
      statusBar.style.display = 'block';
    }
    
    // Force CalDAV cache refresh before reloading
    try {
      console.log('[Audit] Refreshing CalDAV cache...');
      const refreshCsrfToken = await getCsrfToken();
      await fetch(`${API_BASE}/api/refresh-caldav`, {
        method: 'POST',
        headers: {
          'X-CSRF-Token': refreshCsrfToken
        },
        credentials: 'include'
      });
    } catch (refreshError) {
      console.error('[Audit] Cache refresh failed:', refreshError);
      // Continue anyway - the change was made
    }
    
    // Reload the timeline
    if (window.loadData) {
      await window.loadData();
    }
    
    // Update badge
    if (window.updateHistoryBadge) {
      await window.updateHistoryBadge();
    }
    
    // Update success message
    if (statusBar) {
      statusBar.textContent = '✅ Change undone successfully';
      setTimeout(() => {
        statusBar.style.display = 'none';
      }, 3000);
    }
    
  } catch (error) {
    console.error('[Audit] Undo failed:', error);
    
    // Show error message
    if (statusBar) {
      statusBar.textContent = `❌ Undo failed: ${error.message}`;
      statusBar.style.display = 'block';
      setTimeout(() => {
        statusBar.style.display = 'none';
      }, 5000);
    }
  }
}
