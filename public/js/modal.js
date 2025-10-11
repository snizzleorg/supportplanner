/**
 * Modal Management Module
 * 
 * Handles modal UI state, event editing, location validation, and form management.
 * Provides a controller pattern for modal operations.
 * 
 * @module modal
 */

import { tryParseLatLon, geocodeAddress } from './geocode.js';
import { fetchCalendars as apiFetchCalendars, getEvent, updateEvent as apiUpdateEvent, deleteEvent as apiDeleteEvent, createAllDayEvent } from './api.js';

/**
 * DOM element references for modal
 * @private
 */
const modal = document.getElementById('eventModal');
const modalContent = document.querySelector('#eventModal .modal-content');
const eventForm = document.getElementById('eventForm');
const closeBtn = document.querySelector('.close-btn');
const cancelBtn = document.getElementById('cancelEdit');
const saveBtn = document.getElementById('saveEvent');
const deleteBtn = document.getElementById('deleteEvent');
const eventLocationHelp = document.getElementById('eventLocationHelp');
const eventLocationInput = document.getElementById('eventLocation');
// Additional modal inputs
const eventIdInput = document.getElementById('eventId');
const eventTitleInput = document.getElementById('eventTitle');
const eventDescriptionInput = document.getElementById('eventDescription');
const eventOrderNumberInput = document.getElementById('eventOrderNumber');
const eventTicketLinkInput = document.getElementById('eventTicketLink');
const eventSystemTypeInput = document.getElementById('eventSystemType');
const eventAllDayInput = document.getElementById('eventAllDay');
const eventStartDateInput = document.getElementById('eventStartDate');
const eventEndDateInput = document.getElementById('eventEndDate');
const eventCalendarSelect = document.getElementById('eventCalendar');

/**
 * Renders location validation help text in the modal
 * @param {Object|null} state - Validation state object
 * @param {string} [state.status] - Status: 'searching', 'ok', 'coords', 'error'
 * @param {Object} [state.result] - Geocode result with lat, lon, displayName
 * @param {string} [state.message] - Error message
 * @returns {void}
 */
export function renderLocationHelp(state) {
  if (!eventLocationHelp) return;
  if (!state || !state.status) { eventLocationHelp.textContent = ''; eventLocationHelp.className = 'help-text'; return; }
  if (state.status === 'searching') { eventLocationHelp.textContent = 'Validating address…'; eventLocationHelp.className = 'help-text'; return; }
  if (state.status === 'ok' && state.result) {
    const { displayName, lat, lon } = state.result;
    const osm = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=15/${lat}/${lon}`;
    const gmaps = `https://maps.google.com/?q=${lat},${lon}`;
    eventLocationHelp.innerHTML = `<div>✔ Found: ${displayName}</div><div style="margin-top:4px; display:flex; gap:8px;"><a href="${osm}" target="_blank" rel="noopener">OpenStreetMap</a><a href="${gmaps}" target="_blank" rel="noopener">Google Maps</a></div>`;
    eventLocationHelp.className = 'help-text ok';
    return;
  }
  if (state.status === 'coords' && state.result) {
    const { lat, lon } = state.result;
    const osm = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=15/${lat}/${lon}`;
    const gmaps = `https://maps.google.com/?q=${lat},${lon}`;
    eventLocationHelp.innerHTML = `<div>✔ Coordinates detected (${lat.toFixed(5)}, ${lon.toFixed(5)})</div><div style="margin-top:4px; display:flex; gap:8px;"><a href="${osm}" target="_blank" rel="noopener">OpenStreetMap</a><a href="${gmaps}" target="_blank" rel="noopener">Google Maps</a></div>`;
    eventLocationHelp.className = 'help-text ok';
    return;
  }
  if (state.status === 'error') { eventLocationHelp.textContent = state.message || 'Could not validate address'; eventLocationHelp.className = 'help-text error'; }
}

/**
 * Creates a debounced version of a function
 * @private
 * @param {Function} fn - Function to debounce
 * @param {number} ms - Debounce delay in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Last geocode result
 * @type {Object|null}
 */
let lastGeocode = null;

/**
 * Debounced location validation function
 * Validates location input and updates help text
 * @type {Function}
 */
export const debouncedLocationValidate = debounce(async () => {
  lastGeocode = null;
  const q = (eventLocationInput?.value || '').trim();
  if (!q) { renderLocationHelp(null); return; }
  const coords = tryParseLatLon(q);
  if (coords) { lastGeocode = { ...coords, displayName: `${coords.lat}, ${coords.lon}`, source: 'coords' }; renderLocationHelp({ status: 'coords', result: lastGeocode }); return; }
  if (q.length < 3) { renderLocationHelp(null); return; }
  renderLocationHelp({ status: 'searching' });
  try { const found = await geocodeAddress(q); if (found) { lastGeocode = { ...found, source: 'geocode' }; renderLocationHelp({ status: 'ok', result: lastGeocode }); } else { renderLocationHelp({ status: 'error', message: 'No match found' }); } }
  catch (e) { renderLocationHelp({ status: 'error', message: 'Validation error' }); }
}, 450);

/**
 * Sets the modal loading state
 * @param {boolean} isLoading - Whether modal is loading
 * @param {string} [action='save'] - Action type: 'save' or 'delete'
 * @returns {void}
 */
export function setModalLoading(isLoading, action = 'save') {
  if (!modalContent) return;
  if (isLoading) {
    modalContent.classList.add('loading');
    if (action === 'save') {
      if (saveBtn) { saveBtn.dataset.originalText = saveBtn.textContent; saveBtn.textContent = 'Saving...'; }
    } else if (action === 'delete') {
      if (deleteBtn) { deleteBtn.dataset.originalText = deleteBtn.textContent; deleteBtn.textContent = 'Deleting...'; }
    }
    if (saveBtn) saveBtn.disabled = true;
    if (deleteBtn) deleteBtn.disabled = true;
    if (cancelBtn) cancelBtn.disabled = true;
    if (closeBtn) { closeBtn.style.pointerEvents = 'none'; closeBtn.style.opacity = '0.5'; }
  } else {
    modalContent.classList.remove('loading');
    if (saveBtn?.dataset.originalText) { saveBtn.textContent = saveBtn.dataset.originalText; delete saveBtn.dataset.originalText; }
    if (deleteBtn?.dataset.originalText) { deleteBtn.textContent = deleteBtn.dataset.originalText; delete deleteBtn.dataset.originalText; }
    if (cancelBtn) cancelBtn.disabled = false;
    if (closeBtn) { closeBtn.style.pointerEvents = ''; closeBtn.style.opacity = ''; }
  }
}

/**
 * Closes the event modal
 * @returns {void}
 */
export function closeModal() {
  if (!modal) return;
  modal.classList.remove('show');
  if (modalContent) modalContent.classList.remove('loading');
  setTimeout(() => { modal.style.display = 'none'; }, 300);
  document.body.style.overflow = '';
  if (eventForm) eventForm.reset();
  renderLocationHelp(null);
  // Restore pointer-events to underlying layers after modal closes
  try {
    const mapEl = document.getElementById('map');
    const timelineEl = document.getElementById('timeline');
    if (mapEl) mapEl.style.pointerEvents = '';
    if (timelineEl) timelineEl.style.pointerEvents = '';
  } catch (_) {}
}

// Controller factory to encapsulate modal flows and dependencies
/**
 * Creates a modal controller with dependency injection
 * @param {Object} deps - Dependencies object
 * @param {Function} deps.setStatus - Status message function
 * @param {Function} deps.refresh - Refresh data function
 * @param {Function} deps.isoWeekNumber - ISO week number function
 * @param {Object} deps.items - Timeline items DataSet
 * @param {Map} deps.urlToGroupId - URL to group ID mapping
 * @param {Function} deps.forceRefreshCache - Force cache refresh function
 * @param {Object} deps.dayjs - Day.js instance
 * @returns {Object} Modal controller with methods
 */
export function createModalController({ setStatus, refresh, isoWeekNumber, items, urlToGroupId, forceRefreshCache, dayjs }) {
  let currentEvent = null;
  let currentCreateGroupId = null;

  /**
   * Loads calendars into the calendar select dropdown
   * @private
   * @param {string} [selectedCalendarUrl=''] - Calendar URL to pre-select
   * @returns {Promise<void>}
   */
  async function loadCalendars(selectedCalendarUrl = '') {
    const calendars = await apiFetchCalendars();
    eventCalendarSelect.innerHTML = '';
    calendars.forEach(calendar => {
      const option = document.createElement('option');
      option.value = calendar.url;
      option.textContent = calendar.displayName;
      option.selected = calendar.url === selectedCalendarUrl;
      eventCalendarSelect.appendChild(option);
    });
  }

  /**
   * Opens the modal for creating a new week event
   * @private
   * @param {string} calendarUrl - Calendar URL to create event in
   * @param {string} startDateStr - Start date (YYYY-MM-DD)
   * @param {string} endDateStr - End date (YYYY-MM-DD)
   * @param {string} groupId - Timeline group ID
   * @returns {Promise<void>}
   */
  async function openCreateWeekModal(calendarUrl, startDateStr, endDateStr, groupId) {
    setStatus('Creating new event…');
    if (!modal) throw new Error('Modal element not found');
    currentEvent = {
      uid: null,
      summary: '',
      description: '',
      location: '',
      start: startDateStr,
      end: endDateStr,
      allDay: true,
      calendarUrl
    };
    currentCreateGroupId = groupId || null;
    eventIdInput.value = '';
    const defaultTitle = `Week ${isoWeekNumber(new Date(startDateStr))}`;
    eventTitleInput.value = defaultTitle;
    eventDescriptionInput.value = '';
    eventLocationInput.value = '';
    if (eventOrderNumberInput) eventOrderNumberInput.value = '';
    if (eventTicketLinkInput) eventTicketLinkInput.value = '';
    if (eventSystemTypeInput) eventSystemTypeInput.value = '';
    // Force full-day mode for this app: all events are all-day
    if (eventAllDayInput) {
      try {
        eventAllDayInput.checked = true;
        eventAllDayInput.disabled = true;
      } catch (_) {}
    }
    eventStartDateInput.value = startDateStr;
    eventEndDateInput.value = endDateStr;
    debouncedLocationValidate();
    await loadCalendars(calendarUrl);
    if (!eventCalendarSelect.value) eventCalendarSelect.value = calendarUrl;
    modal.style.display = 'flex';
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
    // Reset any stale loading UI to ensure buttons are interactive
    try { modalContent?.classList.remove('loading'); } catch (_) {}
    // Note: we no longer disable pointer-events on background to avoid unintended side-effects
    setTimeout(() => eventTitleInput.focus(), 0);
    setStatus('');
  }

  // A11y state
  let lastActiveElement = null;
  let trapHandler = null;

  /**
   * Gets all focusable elements within the modal
   * @private
   * @returns {Array<HTMLElement>} Array of focusable elements
   */
  function getFocusableInModal() {
    const root = modal;
    if (!root) return [];
    const nodes = Array.from(root.querySelectorAll('a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])'));
    return nodes.filter(el => {
      if (!el || el.disabled || el.tabIndex === -1) return false;
      // Visible check compatible with fixed/flex layouts in headless
      const hasRects = typeof el.getClientRects === 'function' && el.getClientRects().length > 0;
      return el.offsetParent !== null || hasRects;
    });
  }

  /**
   * Enables keyboard focus trap for modal accessibility
   * @private
   * @returns {void}
   */
  function enableFocusTrap() {
    if (trapHandler) return;
    trapHandler = (e) => {
      if (e.key !== 'Tab') return;
      const isOpen = modal && modal.classList && modal.classList.contains('show');
      if (!isOpen) return;
      const focusables = getFocusableInModal();
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !modal.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !modal.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', trapHandler, true);
  }

  /**
   * Disables keyboard focus trap
   * @private
   * @returns {void}
   */
  function disableFocusTrap() {
    if (trapHandler) {
      window.removeEventListener('keydown', trapHandler, true);
      trapHandler = null;
    }
  }

  /**
   * Opens the modal for editing an existing event
   * @private
   * @param {string} eventId - Event UID to edit
   * @returns {Promise<void>}
   */
  async function openEditModal(eventId) {
    setStatus('Loading event details...');
    if (!modal) throw new Error('Modal element not found');
    modal.style.display = 'flex';
    const eventData = await getEvent(eventId);
    if (!eventData.success) throw new Error(eventData.error || 'Failed to load event');
    currentEvent = eventData.event;
    eventIdInput.value = currentEvent.uid;
    eventTitleInput.value = currentEvent.summary || '';
    eventDescriptionInput.value = currentEvent.description || '';
    eventLocationInput.value = currentEvent.location || '';
    debouncedLocationValidate();
    const meta = currentEvent.meta || {};
    if (eventOrderNumberInput) eventOrderNumberInput.value = meta.orderNumber || '';
    if (eventTicketLinkInput) eventTicketLinkInput.value = meta.ticketLink || '';
    if (eventSystemTypeInput) eventSystemTypeInput.value = meta.systemType || '';
    // Force full-day mode for this app: all events are all-day
    const isAllDay = true;
    if (eventAllDayInput) {
      try {
        eventAllDayInput.checked = true;
        eventAllDayInput.disabled = true;
      } catch (_) {}
    }
    if (isAllDay) {
      const startDate = dayjs(currentEvent.start).format('YYYY-MM-DD');
      const endDate = dayjs(currentEvent.end).format('YYYY-MM-DD');
      eventStartDateInput.value = startDate;
      eventEndDateInput.value = endDate;
    } else {
      const startDate = dayjs(currentEvent.start).local();
      const endDate = dayjs(currentEvent.end).local();
      eventStartDateInput.value = startDate.format('YYYY-MM-DDTHH:mm');
      eventEndDateInput.value = endDate.format('YYYY-MM-DDTHH:mm');
    }
    await loadCalendars(currentEvent.calendarUrl);
    // A11y attributes
    try {
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      if (!modal.getAttribute('aria-label')) {
        modal.setAttribute('aria-label', 'Edit Event');
      }
    } catch (_) {}
    lastActiveElement = document.activeElement;
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
    // Ensure Save button is enabled when opening
    try { if (saveBtn) saveBtn.disabled = false; } catch (_) {}
    // Reset any stale loading UI to ensure buttons are interactive
    try { modalContent?.classList.remove('loading'); } catch (_) {}
    // Note: we no longer disable pointer-events on background to avoid unintended side-effects
    setStatus('');
    enableFocusTrap();
    // Focus the title field for accessibility
    try { setTimeout(() => { const el = document.getElementById('eventTitle'); if (el) el.focus(); }, 0); } catch (_) {}
  }

  /**
   * Handles form submission (create or update event)
   * @private
   * @param {Event} e - Form submit event
   * @returns {Promise<void>}
   */
  async function handleSubmit(e) {
    e.preventDefault();
    try { console.debug('[modal] handleSubmit start'); } catch (_) {}
    if (!currentEvent) return;
    try {
      setStatus('Saving changes...');
      setModalLoading(true, 'save');
      const title = eventTitleInput.value.trim();
      if (!title) { setStatus('Please enter a title'); setModalLoading(false, 'save'); return; }
      if (eventTicketLinkInput && eventTicketLinkInput.value.trim()) {
        let urlVal = eventTicketLinkInput.value.trim();
        if (!/^https?:\/\//i.test(urlVal)) { urlVal = 'https://' + urlVal; eventTicketLinkInput.value = urlVal; }
        new URL(urlVal);
      }
      if (eventOrderNumberInput && eventOrderNumberInput.value.length > 64) { setStatus('Order Number is too long (max 64 characters).'); setModalLoading(false, 'save'); return; }
      const startDate = new Date(eventStartDateInput.value);
      const endDate = new Date(eventEndDateInput.value);
      // Force full-day mode for this app
    const isAllDay = true;
      const payload = {
        summary: eventTitleInput.value.trim(),
        description: eventDescriptionInput.value.trim(),
        location: eventLocationInput.value.trim(),
        start: `${startDate.getFullYear()}-${String(startDate.getMonth()+1).padStart(2,'0')}-${String(startDate.getDate()).padStart(2,'0')}`,
        end: `${endDate.getFullYear()}-${String(endDate.getMonth()+1).padStart(2,'0')}-${String(endDate.getDate()).padStart(2,'0')}`,
        allDay: isAllDay,
        meta: {
          ...(eventOrderNumberInput?.value ? { orderNumber: eventOrderNumberInput.value.trim() } : {}),
          ...(eventTicketLinkInput?.value ? { ticketLink: eventTicketLinkInput.value.trim() } : {}),
          ...(eventSystemTypeInput?.value ? { systemType: eventSystemTypeInput.value.trim() } : {}),
        }
      };

      // If the calendar selection changed, instruct backend to move the event
      const selectedCalUrl = eventCalendarSelect?.value;
      const currentCalUrl = currentEvent.calendarUrl || currentEvent.calendar;
      if (currentEvent.uid && selectedCalUrl && currentCalUrl && selectedCalUrl !== currentCalUrl) {
        payload.targetCalendarUrl = selectedCalUrl;
        // Optional: log for debugging
        console.log('[modal] Moving event to different calendar:', { uid: currentEvent.uid, from: currentCalUrl, to: selectedCalUrl });
      }

      let result;
      if (!currentEvent.uid) {
        const createCalendarUrl = eventCalendarSelect.value || currentEvent.calendarUrl;
        if (!createCalendarUrl) throw new Error('No calendar selected for new event');
        result = await createAllDayEvent(createCalendarUrl, payload);
      } else {
        result = await apiUpdateEvent(currentEvent.uid, payload);
      }

      if (result.success) {
        setStatus('Event updated successfully, refreshing data...');
        try {
          if (!currentEvent.uid) {
            const created = result.event || {};
            const createdUid = created.uid || `temp-${Date.now()}`;
            const resolvedGroupId = urlToGroupId.get(eventCalendarSelect.value || currentEvent.calendarUrl) || currentCreateGroupId;
            if (resolvedGroupId) {
              const startIsDateOnly = typeof payload.start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(payload.start);
              const endIsDateOnly = typeof payload.end === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(payload.end);
              const startVal = startIsDateOnly ? dayjs(payload.start).toDate() : new Date(payload.start);
              const endVal = (startIsDateOnly && endIsDateOnly) ? dayjs(payload.end).add(1, 'day').toDate() : new Date(payload.end);
              items.add({ id: `${resolvedGroupId}-${(eventCalendarSelect.value || currentEvent.calendarUrl)}/${createdUid}`, group: resolvedGroupId, content: payload.summary, start: startVal, end: endVal, allDay: isAllDay });
            }
          } else {
            await forceRefreshCache();
          }
          setStatus('Cache refreshed, updating display...');
        } catch (_) {}
        closeModal();
      } else {
        throw new Error(result.error || 'Failed to update event');
      }
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    } finally {
      setModalLoading(false, 'save');
    }
  }

  /**
   * Handles event deletion
   * @private
   * @returns {Promise<void>}
   */
  async function handleDelete() {
    if (!currentEvent || !confirm('Are you sure you want to delete this event?')) return;
    try {
      setStatus('Deleting event...');
      setModalLoading(true, 'delete');
      const result = await apiDeleteEvent(currentEvent.uid);
      if (result.success) {
        try { await forceRefreshCache(); } catch (_) {}
        setStatus('Cache refreshed, updating display...');
        closeModal();
      } else {
        throw new Error(result.error || 'Failed to delete event');
      }
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    } finally {
      setModalLoading(false, 'delete');
    }
  }

  /**
   * Initializes modal event listeners
   * @private
   * @returns {void}
   */
  function initModal() {
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    if (eventForm) {
      // Avoid native validation blocking submit in some browsers
      try { eventForm.setAttribute('novalidate', 'novalidate'); } catch (_) {}
      eventForm.addEventListener('submit', handleSubmit);
      // Submit on Enter key as an additional fallback
      eventForm.addEventListener('keydown', (e) => {
        try {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (typeof eventForm.requestSubmit === 'function') eventForm.requestSubmit();
            else handleSubmit(new Event('submit'));
          }
        } catch (_) {}
      });
    }
    // Ensure Save click always submits the form (guards against environments preventing default submit)
    if (saveBtn && eventForm) {
      // Use capture to ensure we get the click even if bubbling handlers interfere
      saveBtn.addEventListener('click', (e) => {
        try {
          console.debug('[modal] save click (button handler)');
          if (typeof eventForm.requestSubmit === 'function') {
            eventForm.requestSubmit();
          } else {
            eventForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
          }
        } catch (_) {}
      }, { capture: true });
      // Also handle mousedown early to directly invoke submit logic if click is swallowed later
      saveBtn.addEventListener('mousedown', (e) => {
        try {
          e.preventDefault();
          e.stopPropagation();
          // Minimal guard to avoid double-submit; rely on loading state
          if (!modal.classList.contains('show')) return;
          if (modalContent && modalContent.classList.contains('loading')) return;
          console.debug('[modal] save mousedown (button handler) -> direct submit');
          if (typeof handleSubmit === 'function') handleSubmit(new Event('submit'));
        } catch (_) {}
      }, { capture: true });
      // Pointerup capture as another fallback on some platforms
      saveBtn.addEventListener('pointerup', (e) => {
        try {
          if (!modal.classList.contains('show')) return;
          if (modalContent && modalContent.classList.contains('loading')) return;
          // If modal-body had pointer-events:none accidentally, clear it
          const mb = document.querySelector('#eventModal .modal-body');
          if (mb && getComputedStyle(mb).pointerEvents === 'none') {
            console.debug('[modal] clearing accidental pointer-events:none on modal-body');
            mb.style.pointerEvents = 'auto';
          }
          console.debug('[modal] save pointerup (button handler)');
          if (typeof eventForm?.requestSubmit === 'function') eventForm.requestSubmit();
          else if (typeof handleSubmit === 'function') handleSubmit(new Event('submit'));
        } catch (_) {}
      }, { capture: true });
    }
    // Global capture fallback: if Save is clicked while modal is open, trigger submit
    document.addEventListener('click', (e) => {
      try {
        const isOpen = modal && modal.classList && modal.classList.contains('show');
        if (!isOpen) return;
        const target = e.target;
        // Consider clicks on the primary action area as Save
        const isSave = target && (target.closest && (
          target.closest('#saveEvent') ||
          target.closest('#eventForm .form-actions .btn-primary')
        ));
        if (!isSave) return;
        // If already loading, ignore
        if (modalContent && modalContent.classList.contains('loading')) return;
        console.debug('[modal] save click (document capture)');
        if (typeof eventForm?.requestSubmit === 'function') {
          eventForm.requestSubmit();
        } else if (typeof handleSubmit === 'function') {
          handleSubmit(new Event('submit'));
        }
      } catch (_) {}
    }, true);
    if (deleteBtn) deleteBtn.addEventListener('click', handleDelete);
    // Close on Escape key when modal is open
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const m = document.getElementById('eventModal');
        if (m && m.classList && m.classList.contains('show')) {
          e.preventDefault();
          closeModal();
        }
      }
    });
    if (eventLocationInput) {
      eventLocationInput.addEventListener('input', () => debouncedLocationValidate());
      eventLocationInput.addEventListener('blur', () => debouncedLocationValidate());
    }
  }

  return { initModal, openCreateWeekModal, openEditModal };
}
