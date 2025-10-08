import { initTimeline } from '../js/timeline.js';

function assert(name, cond, details='') {
  const ok = !!cond;
  console.log(JSON.stringify({ name, ok, details }));
  if (!ok) throw new Error(name + ' failed: ' + (details || ''));
}

function buildData() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
  const items = [
    { id: 'g1-i1', group: 'g1', content: 'Alpha', start: new Date(start), end: new Date(start.getTime() + 3*86400000) },
    { id: 'g2-i1', group: 'g2', content: 'Beta', start: new Date(start.getTime() + 4*86400000), end: new Date(start.getTime() + 8*86400000) },
  ];
  const groupsArr = [
    { id: 'g1', content: 'Group 1', bg: '#fef9c3' },
    { id: 'g2', content: 'Group 2', bg: '#e0f2fe' },
  ];
  return { items, groupsArr };
}

async function run() {
  try {
    const el = document.getElementById('timeline');
    const { items, groupsArr } = buildData();

    // Initialize timeline
    const timeline = initTimeline(el, items, groupsArr);

    // Ensure a reasonable window
    const w = timeline.getWindow();
    assert('timeline window present', !!w && w.start && w.end);

    // Allow render pass
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    // Verify week bar painted
    const ticks = document.querySelectorAll('.week-bar .week-tick');
    const chips = document.querySelectorAll('.week-bar .week-chip');
    assert('week ticks rendered', ticks.length > 0, `ticks=${ticks.length}`);
    assert('week chips rendered', chips.length > 0, `chips=${chips.length}`);

    document.getElementById('summary').textContent = 'Passed timeline tests';
  } catch (e) {
    document.getElementById('summary').textContent = 'Failed: ' + (e && e.message ? e.message : String(e));
  }
}

document.getElementById('runTimelineTests')?.addEventListener('click', run);
