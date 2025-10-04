// Modal helpers module: handles modal UI state and location validation UI

import { tryParseLatLon, geocodeAddress } from './geocode.js';

// DOM references
const modal = document.getElementById('eventModal');
const modalContent = document.querySelector('#eventModal .modal-content');
const eventForm = document.getElementById('eventForm');
const closeBtn = document.querySelector('.close-btn');
const cancelBtn = document.getElementById('cancelEdit');
const saveBtn = document.getElementById('saveEvent');
const deleteBtn = document.getElementById('deleteEvent');
const eventLocationHelp = document.getElementById('eventLocationHelp');
const eventLocationInput = document.getElementById('eventLocation');

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

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

let lastGeocode = null;
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

export function closeModal() {
  if (!modal) return;
  modal.classList.remove('show');
  if (modalContent) modalContent.classList.remove('loading');
  setTimeout(() => { modal.style.display = 'none'; }, 300);
  document.body.style.overflow = '';
  if (eventForm) eventForm.reset();
  renderLocationHelp(null);
}
