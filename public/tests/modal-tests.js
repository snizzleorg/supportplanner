import dayjs from 'https://cdn.jsdelivr.net/npm/dayjs@1.11.13/+esm';
import { createModalController } from '../js/modal.js';

function assert(name, cond, details='') {
  const ok = !!cond;
  console.log(JSON.stringify({ name, ok, details }));
  if (!ok) throw new Error(name + ' failed: ' + (details || ''));
}

// Simple status hook
function setStatus(msg) {
  const el = document.getElementById('summary');
  if (el) el.textContent = msg || '';
}

// Mock fetch for API endpoints used by modal controller
(function installFetchMock(){
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (url, init) => {
    const u = typeof url === 'string' ? url : url.url || String(url);
    // Geocoding: mock Nominatim responses
    if (/nominatim\.openstreetmap\.org/.test(u)) {
      return new Response(JSON.stringify([
        { lat: '52.5200', lon: '13.4050', display_name: 'Berlin, Germany' }
      ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    // Calendars
    if (u.endsWith('/api/calendars')) {
      return new Response(JSON.stringify({ calendars: [
        { url: 'https://example.com/cals/a/', displayName: 'Travel (Alice Smith)' },
        { url: 'https://example.com/cals/b/', displayName: 'Travel (Bob Jones)' },
      ] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    // Get event
    const m = u.match(/\/api\/events\/([^/?#]+)/);
    if (m) {
      const uid = decodeURIComponent(m[1]);
      if (uid === 'uid-all-day') {
        return new Response(JSON.stringify({ success: true, event: {
          uid,
          summary: 'All Day Event',
          description: 'Desc',
          location: 'Berlin',
          start: '2025-10-10',
          end: '2025-10-15',
          allDay: true,
          calendarUrl: 'https://example.com/cals/a/',
          meta: { orderNumber: 'ORD-1', ticketLink: '', systemType: '' },
        }}), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (uid === 'uid-timed') {
        return new Response(JSON.stringify({ success: true, event: {
          uid,
          summary: 'Timed Event',
          description: 'Desc',
          location: 'Munich',
          start: '2025-10-10T08:30:00Z',
          end: '2025-10-10T12:45:00Z',
          allDay: false,
          calendarUrl: 'https://example.com/cals/b/',
          meta: { orderNumber: 'ORD-2', ticketLink: '', systemType: '' },
        }}), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ success: false, error: 'not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }
    // Default passthrough
    return originalFetch(url, init);
  };
})();

function isoWeekNumber(jsDate) {
  const d = new Date(Date.UTC(jsDate.getFullYear(), jsDate.getMonth(), jsDate.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

async function run() {
  try {
    // Build controller with stubs
    // Provide a shim so instance.local() is available in tests
    const dayjsShim = (v) => {
      const inst = dayjs(v);
      // no-op local() to satisfy controller logic
      inst.local = () => inst;
      return inst;
    };
    Object.assign(dayjsShim, dayjs);

    const ctl = createModalController({
      setStatus,
      refresh: () => {},
      isoWeekNumber,
      items: { add(){} },
      urlToGroupId: () => null,
      forceRefreshCache: async () => ({ success: true }),
      dayjs: dayjsShim,
    });
    // Ensure event listeners are wired as in app
    ctl.initModal();

    // Test: openEditModal all-day
    await ctl.openEditModal('uid-all-day');
    const allDayChecked = document.getElementById('eventAllDay').checked;
    const startVal1 = document.getElementById('eventStartDate').value;
    const endVal1 = document.getElementById('eventEndDate').value;
    assert('all-day checkbox set', allDayChecked === true, { allDayChecked });
    assert('all-day dates set', startVal1 === '2025-10-10' && endVal1 === '2025-10-15', { startVal1, endVal1 });

    // Test: openEditModal timed
    await ctl.openEditModal('uid-timed');
    const allDay2 = document.getElementById('eventAllDay').checked;
    const startVal2 = document.getElementById('eventStartDate').value;
    const endVal2 = document.getElementById('eventEndDate').value;
    assert('timed checkbox unset', allDay2 === false, { allDay2 });
    // Value will be local TZ formatted YYYY-MM-DDTHH:mm; accept any valid local date/time
    assert('timed start is datetime-local', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(startVal2), startVal2);
    assert('timed end is datetime-local', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(endVal2), endVal2);

    // Calendars loaded and preselected
    const cal = document.getElementById('eventCalendar');
    assert('calendars exist', cal.options.length >= 2, cal.options.length);

    console.log(JSON.stringify({ name: 'modal tests complete', ok: true }));
    document.getElementById('summary').textContent = 'Passed modal tests';
  } catch (e) {
    document.getElementById('summary').textContent = 'Failed: ' + (e && e.message ? e.message : String(e));
  }
}

document.getElementById('runModalTests')?.addEventListener('click', run);
