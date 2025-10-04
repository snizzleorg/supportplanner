#!/usr/bin/env node
// Puppeteer runner: opens the browser harness pages to run tests and reads results
// Usage: APP_URL=http://app:3000 node run-tests.mjs

import puppeteer from 'puppeteer';
import { spawn } from 'node:child_process';

const APP_URL = process.env.APP_URL || process.argv[2] || '';
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

(async function main() {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  const outputs = [];
  try {
    outputs.push(await runApiBrowserHarness(page));
    outputs.push(await runSearchBrowserHarness(page));
    // Run headless Node tests as well
    const apiSmoke = await runNodeScript('node', ['public/tests/api-smoke.mjs', '--api', APP_URL]);
    outputs.push({ name: 'api-smoke', ok: apiSmoke.code === 0, ms: apiSmoke.ms, out: apiSmoke.out, err: apiSmoke.err });
    const geocodeSmoke = await runNodeScript('node', ['public/tests/geocode-smoke.mjs']);
    outputs.push({ name: 'geocode-smoke', ok: geocodeSmoke.code === 0, ms: geocodeSmoke.ms, out: geocodeSmoke.out, err: geocodeSmoke.err });
  } finally {
    await browser.close();
  }
  const ok = outputs.every(o => o.ok);
  console.log(JSON.stringify({ ok, outputs }, null, 2));
  process.exit(ok ? 0 : 1);
})();
