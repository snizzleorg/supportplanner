// API helper module for SupportPlanner front-end
// Provides functions to interact with the backend endpoints

let API_BASE = '';
export function setApiBase(base) { API_BASE = base || ''; }
function apiFetch(path, init) {
  const url = API_BASE ? new URL(path, API_BASE).toString() : path;
  return fetch(url, init);
}

export async function fetchCalendars() {
  try {
    const res = await apiFetch('/api/calendars');
    if (!res.ok) {
      const text = await res.text();
      console.error('Calendars fetch failed', res.status, res.statusText, text);
      return [];
    }
    const data = await res.json();
    const list = data.calendars || [];
    return list;
  } catch (e) {
    return [];
  }
}

export async function refreshCaldav() {
  const res = await apiFetch('/api/refresh-caldav', { method: 'POST' });
  return res.json();
}

export async function me() {
  const res = await apiFetch('/api/me');
  return res.json();
}

export async function logout() {
  const res = await apiFetch('/auth/logout', { method: 'POST' });
  return res.ok;
}

export async function clientLog(level, message, extra) {
  try {
    await apiFetch('/api/client-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level, message, extra, userAgent: navigator.userAgent, ts: new Date().toISOString() }),
    });
  } catch (_) {
    // ignore
  }
}

// Events API
export async function getEvent(uid) {
  const res = await apiFetch(`/api/events/${uid}`);
  if (!res.ok) throw new Error(`Failed to fetch event: ${res.status}`);
  return res.json();
}

export async function updateEvent(uid, data) {
  const res = await apiFetch(`/api/events/${uid}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to update event: ${res.status}`);
  return res.json();
}

export async function deleteEvent(uid) {
  const res = await apiFetch(`/api/events/${uid}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Failed to delete event: ${res.status}`);
  return res.json();
}

export async function createAllDayEvent(calendarUrl, payload) {
  const res = await apiFetch('/api/events/all-day', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      calendarUrl,
      summary: payload.summary,
      description: payload.description,
      location: payload.location,
      start: payload.start,
      end: payload.end,
      meta: payload.meta,
    }),
  });
  if (!res.ok) throw new Error(`Failed to create event: ${res.status}`);
  return res.json();
}
