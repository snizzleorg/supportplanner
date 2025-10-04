// API helper module for SupportPlanner front-end
// Provides functions to interact with the backend endpoints

export async function fetchCalendars() {
  try {
    const res = await fetch('/api/calendars');
    if (!res.ok) {
      const text = await res.text();
      console.error('Calendars fetch failed', res.status, res.statusText, text);
      return [];
    }
    const data = await res.json();
    const list = data.calendars || [];
    return list;
  } catch (e) {
    console.error('Calendars fetch error', e);
    return [];
  }
}

export async function refreshCaldav() {
  try {
    const response = await fetch('/api/refresh-caldav', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error refreshing calendar data:', error);
    return { success: false, error: error.message };
  }
}

export async function clientLog(level, message, extra) {
  try {
    await fetch('/api/client-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level, message, extra, userAgent: navigator.userAgent, ts: new Date().toISOString() }),
    });
  } catch (_) {
    // ignore
  }
}
