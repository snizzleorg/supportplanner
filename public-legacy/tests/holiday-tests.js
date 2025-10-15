import dayjs from 'https://cdn.jsdelivr.net/npm/dayjs@1.11.13/+esm';
import { upsertHolidayBackgrounds } from '../js/holidays-ui.js';

function assert(name, cond, details='') {
  const ok = !!cond;
  console.log(JSON.stringify({ name, ok, details }));
  if (!ok) throw new Error(name + ' failed: ' + (details || ''));
}

// Minimal DataSet-like shim for testing
class MiniDataSet {
  constructor() { this._items = []; }
  get(query) { return this._items.slice(); }
  getIds({ filter } = {}) {
    if (!filter) return this._items.map(it => it.id);
    return this._items.filter(filter).map(it => it.id);
  }
  add(arr) { this._items.push(...(Array.isArray(arr) ? arr : [arr])); }
  remove(ids) { const set = new Set(Array.isArray(ids) ? ids : [ids]); this._items = this._items.filter(it => !set.has(it.id)); }
}

async function run() {
  try {
    const items = new MiniDataSet();
    const from = '2025-01-01';
    const to = '2025-01-31';

    // Mock getHolidaysInRange
    async function getHolidaysInRangeMock(f, t) {
      return [
        { date: '2025-01-01', name: 'New Year' },
        { date: '2025-01-06', name: 'Holiday X' },
      ];
    }

    // First upsert
    await upsertHolidayBackgrounds(items, from, to, getHolidaysInRangeMock, dayjs);
    const firstIds = items.getIds({ filter: it => String(it.id).startsWith('holiday-') });
    assert('first insert created holiday items', firstIds.length === 2, firstIds);

    // Second upsert for same range; should not grow duplicates
    await upsertHolidayBackgrounds(items, from, to, getHolidaysInRangeMock, dayjs);
    const secondIds = items.getIds({ filter: it => String(it.id).startsWith('holiday-') });
    assert('second insert did not duplicate holidays', secondIds.length === 2, secondIds);

    document.getElementById('summary').textContent = 'Passed holiday tests';
  } catch (e) {
    document.getElementById('summary').textContent = 'Failed: ' + (e && e.message ? e.message : String(e));
  }
}

document.getElementById('runHolidayTests')?.addEventListener('click', run);
