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
    // Update event mock (PUT)
    if (/\/api\/events\//.test(u) && init && /PUT/i.test(init.method || '')) {
      try {
        const body = init && init.body ? JSON.parse(init.body) : {};
        window.__lastUpdateRequest = { url: u, method: init.method, body };
      } catch (_) {
        window.__lastUpdateRequest = { url: u, method: init.method, body: null };
      }
      return new Response(JSON.stringify({ success: true, event: { uid: 'updated' } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
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
    const runBtn = document.getElementById('runA11yModalTests');
    runBtn?.focus();
    await ctl.openEditModal('uid-all-day');

    // Assert focus on title input
    const activeId = document.activeElement && document.activeElement.id;
    assert('focus on title', activeId === 'eventTitle', activeId);

    // ARIA attributes present
    const modal = document.getElementById('eventModal');
    assert('role=dialog', modal.getAttribute('role') === 'dialog', modal.getAttribute('role'));
    assert('aria-modal=true', modal.getAttribute('aria-modal') === 'true', modal.getAttribute('aria-modal'));

    // Focus trap: determine focusable elements in modal
    const focusables = Array.from(modal.querySelectorAll('a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])'))
      .filter(el => !el.disabled && el.tabIndex !== -1 && el.offsetParent !== null);
    assert('has focusables', focusables.length >= 2, focusables.length);
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    // Wrap backwards: first + Shift+Tab -> last
    first.focus();
    const evtBack = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true });
    window.dispatchEvent(evtBack);
    await new Promise(r => setTimeout(r, 10));
    assert('focus wrapped to last on Shift+Tab', document.activeElement === last, document.activeElement && document.activeElement.id);

    // Wrap forwards: last + Tab -> first
    last.focus();
    const evtFwd = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    window.dispatchEvent(evtFwd);
    await new Promise(r => setTimeout(r, 10));
    assert('focus wrapped to first on Tab', document.activeElement === first || document.activeElement === document.getElementById('eventTitle'), document.activeElement && document.activeElement.id);

    // Press Escape to close
    const evt = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    window.dispatchEvent(evt);

    // Wait a moment for close to apply
    await new Promise(r => setTimeout(r, 50));

    // Assert modal hidden
    const isOpen = modal && modal.classList && modal.classList.contains('show');
    assert('escape closes modal', !isOpen, isOpen);

    // Focus restoration: back to run button
    assert('focus restored to trigger', document.activeElement === runBtn, document.activeElement && document.activeElement.id);

    // Re-open for keyboard activation checks
    await ctl.openEditModal('uid-all-day');

    // Verify key controls are focusable
    const saveBtn = document.getElementById('saveEvent');
    const cancelBtn = document.getElementById('cancelEdit');
    const deleteBtn = document.getElementById('deleteEvent');
    const isFocusable = (el) => !!(el && el.tabIndex !== -1 && el.offsetParent !== null && !el.disabled);
    assert('save focusable', isFocusable(saveBtn));
    assert('cancel focusable', isFocusable(cancelBtn));
    assert('delete focusable', isFocusable(deleteBtn));

    // Spy on submit to confirm activation
    window.__submitted = false;
    const form = document.getElementById('eventForm');
    const onSubmitSpy = () => { window.__submitted = true; };
    form.addEventListener('submit', onSubmitSpy, { once: true });
    // Focus save and simulate keyboard activation via click event
    saveBtn.focus();
    saveBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    // Wait for submit and mocked PUT capture
    const t0 = Date.now();
    while (!window.__submitted && (Date.now() - t0) < 1000) {
      await new Promise(r => setTimeout(r, 25));
    }
    assert('save activation submits form', window.__submitted === true);
    assert('update request captured', !!window.__lastUpdateRequest);

    // Re-open and test Cancel activation
    await ctl.openEditModal('uid-all-day');
    cancelBtn.focus();
    cancelBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise(r => setTimeout(r, 50));
    const isOpen2 = document.getElementById('eventModal').classList.contains('show');
    assert('cancel activation closes modal', !isOpen2, isOpen2);

    document.getElementById('summary').textContent = 'Passed a11y modal tests';
  } catch (e) {
    document.getElementById('summary').textContent = 'Failed: ' + (e && e.message ? e.message : String(e));
  }
}

document.getElementById('runA11yModalTests')?.addEventListener('click', run);
// Expose and auto-run after full window load
window.__runA11yModalTests = run;
window.addEventListener('load', () => setTimeout(() => { try { run(); } catch (_) {} }, 50));
