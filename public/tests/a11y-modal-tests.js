import dayjs from 'https://cdn.jsdelivr.net/npm/dayjs@1.11.13/+esm';
import { createModalController } from '../js/modal.js';

function assert(name, cond, details='') {
  const ok = !!cond;
  console.log(JSON.stringify({ name, ok, details }));
  if (!ok) throw new Error(name + ' failed: ' + (details || ''));
}

// Minimal fetch mocks used by modal controller (calendars + getEvent)
(function installFetchMock(){
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (url, init) => {
    const u = typeof url === 'string' ? url : url.url || String(url);
    // Calendars
    if (u.endsWith('/api/calendars')) {
      return new Response(JSON.stringify({ calendars: [
        { url: 'https://example.com/cals/a/', displayName: 'Travel (Alice Smith)' },
        { url: 'https://example.com/cals/b/', displayName: 'Travel (Bob Jones)' },
      ] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    // Get event
    const m = u.match(/\/api\/events\/([^\/?#]+)/);
    if (m) {
      const uid = decodeURIComponent(m[1]);
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
    const ctl = createModalController({
      setStatus: () => {},
      refresh: () => {},
      isoWeekNumber,
      items: { add(){} },
      urlToGroupId: () => null,
      forceRefreshCache: async () => ({ success: true }),
      dayjs,
    });
    ctl.initModal();

    // Open modal for a known event
    await ctl.openEditModal('uid-all-day');

    // Assert focus on title input
    const activeId = document.activeElement && document.activeElement.id;
    assert('focus on title', activeId === 'eventTitle', activeId);

    // Press Escape to close
    const evt = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    window.dispatchEvent(evt);

    // Wait a moment for close to apply
    await new Promise(r => setTimeout(r, 50));

    // Assert modal hidden
    const modal = document.getElementById('eventModal');
    const isOpen = modal && modal.classList && modal.classList.contains('show');
    assert('escape closes modal', !isOpen, isOpen);

    document.getElementById('summary').textContent = 'Passed a11y modal tests';
  } catch (e) {
    document.getElementById('summary').textContent = 'Failed: ' + (e && e.message ? e.message : String(e));
  }
}

document.getElementById('runA11yModalTests')?.addEventListener('click', run);
// Expose and auto-run after full window load
window.__runA11yModalTests = run;
window.addEventListener('load', () => setTimeout(() => { try { run(); } catch (_) {} }, 50));
