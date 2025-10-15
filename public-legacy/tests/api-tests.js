import { fetchCalendars, refreshCaldav, getEvent, createAllDayEvent, updateEvent, deleteEvent } from '../js/api.js';

const results = [];
const addResult = (name, ok, ms, details='') => {
  results.push({ name, ok, ms, details });
  const row = document.createElement('tr');
  row.innerHTML = `<td>${name}</td><td class="${ok?'ok':'err'}">${ok?'OK':'FAIL'}</td><td>${ms}</td><td><code>${(details||'').toString().slice(0,500)}</code></td>`;
  document.getElementById('resultsBody').appendChild(row);
  document.getElementById('resultsTable').style.display = '';
};
const log = (...args) => {
  const el = document.getElementById('log');
  el.textContent += args.map(String).join(' ') + '\n';
};

async function runNonMutating() {
  document.getElementById('nmStatus').textContent = 'Running...';
  try {
    let t = performance.now();
    const calendars = await fetchCalendars();
    addResult('fetchCalendars', Array.isArray(calendars), Math.round(performance.now()-t), `count=${calendars?.length}`);

    t = performance.now();
    const refresh = await refreshCaldav();
    addResult('refreshCaldav', !!refresh && typeof refresh.success === 'boolean', Math.round(performance.now()-t), JSON.stringify(refresh));

    document.getElementById('nmStatus').textContent = 'Done';
    summarize();
  } catch (e) {
    addResult('nonMutatingSuite', false, 0, e.stack || e.message);
    document.getElementById('nmStatus').textContent = 'Failed';
  }
}

async function runMutating() {
  document.getElementById('mStatus').textContent = 'Running...';
  const calendarUrl = document.getElementById('calendarUrl').value.trim();
  if (!/^https?:\/\//.test(calendarUrl)) {
    document.getElementById('mStatus').textContent = 'Invalid calendar URL';
    return;
  }
  try {
    const start = new Date();
    const end = new Date(start.getTime() + 24*3600*1000);
    const payload = {
      summary: `TEST ${Date.now()}`,
      description: 'Automated test event',
      location: 'Berlin',
      start: `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,'0')}-${String(start.getDate()).padStart(2,'0')}`,
      end: `${end.getFullYear()}-${String(end.getMonth()+1).padStart(2,'0')}-${String(end.getDate()).padStart(2,'0')}`,
      meta: { orderNumber: 'TEST-123' }
    };

    let t = performance.now();
    const createRes = await createAllDayEvent(calendarUrl, payload);
    addResult('createAllDayEvent', !!createRes?.success, Math.round(performance.now()-t), JSON.stringify(createRes));

    const uid = createRes?.event?.uid;
    if (!uid) throw new Error('No uid from createAllDayEvent');

    t = performance.now();
    const updRes = await updateEvent(uid, { ...payload, description: 'Updated by test' });
    addResult('updateEvent', !!updRes?.success, Math.round(performance.now()-t), JSON.stringify(updRes));

    t = performance.now();
    const delRes = await deleteEvent(uid);
    addResult('deleteEvent', !!delRes?.success, Math.round(performance.now()-t), JSON.stringify(delRes));

    document.getElementById('mStatus').textContent = 'Done';
    summarize();
  } catch (e) {
    addResult('mutatingSuite', false, 0, e.stack || e.message);
    document.getElementById('mStatus').textContent = 'Failed';
  }
}

function summarize() {
  const total = results.length;
  const pass = results.filter(r => r.ok).length;
  document.getElementById('summary').textContent = `Passed ${pass}/${total} tests`;
}

// Wire buttons
const nonMutBtn = document.getElementById('runNonMutating');
const mutBtn = document.getElementById('runMutating');
nonMutBtn?.addEventListener('click', runNonMutating);
mutBtn?.addEventListener('click', runMutating);
