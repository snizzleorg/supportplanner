#!/usr/bin/env node
// Headless API smoke tests for SupportPlanner
// Usage:
//   node public/tests/api-smoke.mjs --api http://localhost:3000 [--calendar <CAL_URL>]
// or set env:
//   API_BASE=http://localhost:3000 CALENDAR_URL=https://... node public/tests/api-smoke.mjs

import { setApiBase, fetchCalendars, refreshCaldav, createAllDayEvent, updateEvent, deleteEvent } from '../js/api.js';

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--api') out.api = args[++i];
    else if (a === '--calendar') out.calendar = args[++i];
  }
  out.api = process.env.API_BASE || out.api || '';
  out.calendar = process.env.CALENDAR_URL || out.calendar || '';
  return out;
}

function logJson(obj) { return JSON.stringify(obj, null, 2); }

async function nonMutating() {
  const start = Date.now();
  const res = { name: 'nonMutating', ok: true, steps: [] };
  try {
    let t = Date.now();
    const calendars = await fetchCalendars();
    res.steps.push({ name: 'fetchCalendars', ok: Array.isArray(calendars), ms: Date.now() - t, details: { count: calendars?.length } });

    t = Date.now();
    const ref = await refreshCaldav();
    res.steps.push({ name: 'refreshCaldav', ok: !!ref && typeof ref.success === 'boolean', ms: Date.now() - t, details: ref });
  } catch (e) {
    res.ok = false;
    res.error = e.message;
  }
  res.ms = Date.now() - start;
  res.ok = res.ok && res.steps.every(s => s.ok);
  return res;
}

async function mutating(calendarUrl) {
  const start = Date.now();
  const res = { name: 'mutating', ok: true, steps: [] };
  let createdUid = null;
  try {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24*3600*1000);
    const payload = {
      summary: `SMOKE ${now.toISOString()}`,
      description: 'Smoke test event',
      location: 'Berlin',
      start: `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`,
      end: `${tomorrow.getFullYear()}-${String(tomorrow.getMonth()+1).padStart(2,'0')}-${String(tomorrow.getDate()).padStart(2,'0')}`,
      meta: { orderNumber: 'SMOKE-1' },
    };

    let t = Date.now();
    const c = await createAllDayEvent(calendarUrl, payload);
    createdUid = c?.event?.uid;
    res.steps.push({ name: 'createAllDayEvent', ok: !!c?.success && !!createdUid, ms: Date.now() - t, details: c });

    t = Date.now();
    const u = await updateEvent(createdUid, { ...payload, description: 'Updated by smoke' });
    res.steps.push({ name: 'updateEvent', ok: !!u?.success, ms: Date.now() - t, details: u });

    t = Date.now();
    const d = await deleteEvent(createdUid);
    res.steps.push({ name: 'deleteEvent', ok: !!d?.success, ms: Date.now() - t, details: d });
  } catch (e) {
    res.ok = false;
    res.error = e.message;
  }
  res.ms = Date.now() - start;
  res.ok = res.ok && res.steps.every(s => s.ok);
  return res;
}

(async function main() {
  const { api, calendar } = parseArgs();
  if (api) setApiBase(api);

  const outputs = [];
  const nm = await nonMutating();
  outputs.push(nm);

  if (calendar) {
    const m = await mutating(calendar);
    outputs.push(m);
  }

  const ok = outputs.every(o => o.ok);
  console.log(logJson({ ok, outputs }));
  process.exit(ok ? 0 : 1);
})();
