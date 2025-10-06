#!/usr/bin/env node
// Puppeteer runner: opens the browser harness pages to run tests and reads results
// Usage: APP_URL=http://app:3000 node run-tests.mjs

import puppeteer from 'puppeteer';
import { spawn } from 'node:child_process';

const APP_URL = process.env.APP_URL || process.argv[2] || '';
const BRIEF = process.env.RUNNER_BRIEF === '1' || process.argv.includes('--brief');
if (!APP_URL) {
  console.error('APP_URL env or first arg required, e.g. http://localhost:3000');
  process.exit(2);
}

function runNodeScript(cmd, args, env = {}) {
  return new Promise((resolve) => {
    const start = Date.now();
    const child = spawn(cmd, args, { env: { ...process.env, ...env } });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { err += d.toString(); });
    child.on('close', (code) => {
      resolve({ code, out, err, ms: Date.now() - start });
    });
  });
}

function url(path) {
  return new URL(path, APP_URL).toString();
}

async function runApiBrowserHarness(page) {
  await page.goto(url('/tests/api-tests.html'));
  await page.waitForSelector('#runNonMutating', { timeout: 10000 });
  await page.click('#runNonMutating');
  // Wait for summary to contain Passed
  await page.waitForFunction(() => {
    const s = document.querySelector('#summary');
    return s && /Passed\s+\d+\/\d+/.test(s.textContent || '');
  }, { timeout: 20000 });
  const summary = await page.$eval('#summary', el => el.textContent);
  return { name: 'api-browser-harness', ok: /Passed/.test(summary), summary };
}

async function runSearchBrowserHarness(page) {
  let triedAlt = false;
  try {
    await page.goto(url('/tests/search-tests.html'));
    await page.waitForSelector('#runSearchTests', { timeout: 20000 });
  } catch (e) {
    // Try alternate path (some servers mount public/ explicitly)
    triedAlt = true;
    await page.goto(url('/public/tests/search-tests.html'));
    await page.waitForSelector('#runSearchTests', { timeout: 20000 });
  }
  await page.click('#runSearchTests');
  await page.waitForFunction(() => {
    const s = document.querySelector('#summary');
    return s && /Passed search tests/.test(s.textContent || '');
  }, { timeout: 20000 });
  const summary = await page.$eval('#summary', el => el.textContent);
  return { name: 'search-browser-harness', ok: /Passed/.test(summary), summary, triedAlt };
}

async function runTimelineBrowserHarness(page) {
  let triedAlt = false;
  try {
    await page.goto(url('/tests/timeline-tests.html'));
    await page.waitForSelector('#runTimelineTests', { timeout: 20000 });
  } catch (e) {
    triedAlt = true;
    await page.goto(url('/public/tests/timeline-tests.html'));
    await page.waitForSelector('#runTimelineTests', { timeout: 20000 });
  }
  await page.click('#runTimelineTests');
  await page.waitForFunction(() => {
    const s = document.querySelector('#summary');
    return s && /Passed timeline tests/.test(s.textContent || '');
  }, { timeout: 20000 });
  const summary = await page.$eval('#summary', el => el.textContent);
  return { name: 'timeline-browser-harness', ok: /Passed/.test(summary), summary, triedAlt };
}

async function runModalBrowserHarness(page) {
  let triedAlt = false;
  const logs = [];
  const onConsole = (msg) => { try { logs.push(`[console] ${msg.type?.()} ${msg.text?.() || msg.text}`); } catch { logs.push(`[console] ${msg.type?.()} ${String(msg)}`); } };
  page.on('console', onConsole);
  try {
    await page.goto(url('/tests/modal-tests.html'));
    await page.waitForSelector('#runModalTests', { timeout: 20000 });
  } catch (e) {
    triedAlt = true;
    await page.goto(url('/public/tests/modal-tests.html'));
    await page.waitForSelector('#runModalTests', { timeout: 20000 });
  }
  await page.click('#runModalTests');
  try {
    await page.waitForFunction(() => {
      const s = document.querySelector('#summary');
      const txt = (s && s.textContent) ? s.textContent.trim() : '';
      return /^Passed modal tests$/.test(txt) || /^Failed: /.test(txt);
    }, { timeout: 30000 });
  } catch (e) {
    const html = await page.content();
    return { name: 'modal-browser-harness', ok: false, summary: 'Timed out', triedAlt, logs, htmlSnippet: html.slice(0, 1000) };
  } finally {
    page.off('console', onConsole);
  }
  const summary = await page.$eval('#summary', el => el.textContent || '');
  return { name: 'modal-browser-harness', ok: /Passed modal tests/.test(summary), summary, triedAlt, logs };
}

(async function main() {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  const outputs = [];
  try {
    outputs.push(await runApiBrowserHarness(page));
    outputs.push(await runSearchBrowserHarness(page));
    outputs.push(await runTimelineBrowserHarness(page));
    outputs.push(await runModalBrowserHarness(page));
    // Run headless Node tests as well
    const apiSmoke = await runNodeScript('node', ['public/tests/api-smoke.mjs', '--api', APP_URL]);
    outputs.push({ name: 'api-smoke', ok: apiSmoke.code === 0, ms: apiSmoke.ms, out: apiSmoke.out, err: apiSmoke.err });
    const geocodeSmoke = await runNodeScript('node', ['public/tests/geocode-smoke.mjs']);
    outputs.push({ name: 'geocode-smoke', ok: geocodeSmoke.code === 0, ms: geocodeSmoke.ms, out: geocodeSmoke.out, err: geocodeSmoke.err });

    // CSS audit (includes our CSS, vendor CSS, inline, dynamic)
    const cssAudit = await runNodeScript('node', ['css-audit.mjs', APP_URL]);
    let cssAuditOk = cssAudit.code === 0;
    let cssAuditSummary = '';
    try {
      const report = JSON.parse(cssAudit.out.trim());
      // Treat unused selectors as warnings only; fail only on missing CSS for used classes
      const unused = report.unusedSelectors || [];
      const missOur = report.usedClassesMissingInOurCss || [];
      const missAll = report.usedClassesMissingInAllCss || [];
      cssAuditOk = cssAuditOk && (missOur.length === 0) && (missAll.length === 0);
      cssAuditSummary = `unused=${unused.length}, missingInOur=${missOur.length}, missingInAll=${missAll.length}, vendorInfo=${(report.usedClassesVendorUnmatched||[]).length}`;
      outputs.push({ name: 'css-audit', ok: cssAuditOk, ms: cssAudit.ms, summary: cssAuditSummary, report });
    } catch (e) {
      cssAuditOk = false;
      cssAuditSummary = 'invalid JSON from css-audit';
      outputs.push({ name: 'css-audit', ok: false, ms: cssAudit.ms, summary: cssAuditSummary, out: cssAudit.out, err: cssAudit.err });
    }
  } finally {
    await browser.close();
  }
  const ok = outputs.every(o => o.ok);
  const passed = outputs.filter(o => o.ok).length;
  const total = outputs.length;
  // Human readable summary
  console.log(`RESULT: ${ok ? 'ALL OK' : 'FAIL'} - ${passed}/${total} passed`);
  if (!ok) {
     const failed = outputs.filter(o => !o.ok);
     failed.forEach(f => console.log(` - ${f.name}: ${f.summary || 'failed'}`));
  }
  // JSON report for machines (omit when brief)
  if (!BRIEF) {
    console.log(JSON.stringify({ ok, outputs }, null, 2));
  }
  process.exit(ok ? 0 : 1);
})();
