import { setupTooltipHandlers } from '../custom-tooltip.js';

function assert(name, cond, details='') {
  const ok = !!cond;
  console.log(JSON.stringify({ name, ok, details }));
  if (!ok) throw new Error(name + ' failed: ' + (details || ''));
}

function makeMouseEvent(x, y) {
  return { clientX: x, clientY: y };
}

async function run() {
  try {
    console.log('[tooltip-tests] run() start');
    // Fake timeline with event registry and items store
    const handlers = {};
    const testItem = {
      id: '1',
      content: 'Install FT300',
      start: '2025-01-05', // date-only => all-day
      end: '2025-01-09',   // date-only => all-day
      location: 'Berlin, Germany',
      description: 'Line1\nLine2',
      meta: { orderNumber: 'ORD-123', systemType: 'FT300', ticketLink: 'https://tickets.example.com/T-1' },
      title: 'Install FT300'
    };
    const timeline = {
      on: (name, cb) => { handlers[name] = cb; },
      itemsData: { get: (id) => testItem }
    };

    // Wire tooltip handlers
    setupTooltipHandlers(timeline);

    // Trigger itemover to show tooltip
    handlers['itemover']?.({ event: makeMouseEvent(20, 30), item: '1' });

    // Allow layout
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    const tip = document.querySelector('.vis-custom-tooltip');
    assert('tooltip exists', !!tip);
    assert('tooltip visible', tip.style.display === 'block', tip.style.display);

    const html = tip.innerHTML;
    // Check title
    assert('title present', /Install FT300/.test(html));
    // Check date range format dd.mm.yyyy (Mon) – dd.mm.yyyy (Fri) like content
    assert('date range present', /\d{2}\.\d{2}\.\d{4}.*\u2013|\-/.test(html) || /\d{2}\.\d{2}\.\d{4}/.test(html), html);
    // Check meta badges
    assert('order badge present', /Order:\s*ORD-123/.test(html));
    assert('system badge present', /System:\s*FT300/.test(html));
    // Ticket link
    assert('ticket link present', /href=\"https:\/\/tickets\.example\.com\/T-1\"/.test(html));
    // Location link
    assert('location present', /Berlin, Germany/.test(html));
    assert('location gmaps link present', /https:\/\/maps\.google\.com\/?q=Berlin/.test(html));
    // Description line breaks converted
    assert('description line breaks', /Line1<br>Line2/.test(html));

    // Trigger itemout and ensure it eventually hides
    handlers['itemout']?.();
    await new Promise(r => setTimeout(r, 200));
    assert('tooltip hidden after itemout', tip.style.display === 'none', tip.style.display);

    document.getElementById('summary').textContent = 'Passed tooltip tests';
  } catch (e) {
    document.getElementById('summary').textContent = 'Failed: ' + (e && e.message ? e.message : String(e));
  }
}

document.getElementById('runTooltipTests')?.addEventListener('click', run);

// Expose and auto-run after full window load
window.__runTooltipTests = run;
window.addEventListener('load', () => setTimeout(() => { try { run(); } catch (_) {} }, 50));
