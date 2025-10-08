import { initSearch, setSearchQuery, applySearchFilter } from '../js/search.js';

function text(el) { return (el.textContent || '').toLowerCase(); }

function assert(name, cond, details='') {
  const summary = document.getElementById('summary');
  const prev = summary.textContent || '';
  const ok = !!cond;
  summary.textContent = ok ? `OK: ${name}` : `FAIL: ${name} ${details}`;
  console.log(JSON.stringify({ name, ok, details }));
  if (!ok) throw new Error(name + ' failed');
}

function buildItemsAdapter() {
  const map = new Map([
    ['1', { id: '1', content: 'Install Laser Berlin', title: 'Install Laser Berlin', location: 'Berlin' }],
    ['2', { id: '2', content: 'Maintenance Munich', title: 'Maintenance Munich', location: 'Munich' }],
    ['3', { id: '3', content: 'Training Hamburg ???', title: 'Training Hamburg ???', location: 'Hamburg' }],
  ]);
  return { get: (id) => map.get(String(id)) };
}

async function run() {
  try {
    const itemsAdapter = buildItemsAdapter();
    initSearch(itemsAdapter);

    const items = Array.from(document.querySelectorAll('.vis-item'));

    // Search for 'berlin'
    setSearchQuery('berlin');
    applySearchFilter();
    const states1 = items.map(el => ({ dimmed: el.classList.contains('dimmed'), match: el.classList.contains('search-match'), t: text(el) }));
    assert('berlin filters correctly', states1[0].match && !states1[0].dimmed && states1.slice(1).every(s => s.dimmed && !s.match), JSON.stringify(states1));

    // Clear search
    setSearchQuery('');
    applySearchFilter();
    const states2 = items.map(el => ({ dimmed: el.classList.contains('dimmed'), match: el.classList.contains('search-match') }));
    assert('clear removes filters', states2.every(s => !s.dimmed), JSON.stringify(states2));

    // Search for '???' should match unconfirmed item 3
    setSearchQuery('???');
    applySearchFilter();
    const states3 = items.map(el => ({ id: el.getAttribute('data-id'), dimmed: el.classList.contains('dimmed'), match: el.classList.contains('search-match') }));
    const matched3 = states3.find(s => s.id === '3');
    assert('??? matches item 3', matched3 && matched3.match && !matched3.dimmed, JSON.stringify(states3));

    document.getElementById('summary').textContent = 'Passed search tests';
  } catch (e) {
    document.getElementById('summary').textContent = 'Failed: ' + e.message;
  }
}

document.getElementById('runSearchTests')?.addEventListener('click', run);
