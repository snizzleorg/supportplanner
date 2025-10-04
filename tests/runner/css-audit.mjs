#!/usr/bin/env node
// CSS usage audit: loads the running app and checks which selectors from styles.css match in the DOM.
// Additionally scans JS files for class name mentions to avoid false positives for dynamically-added nodes.

import fs from 'node:fs/promises';
import path from 'node:path';
import puppeteer from 'puppeteer';

const APP_URL = process.env.APP_URL || process.argv[2] || '';
if (!APP_URL) {
  console.error('Usage: node css-audit.mjs <APP_URL>');
  process.exit(2);
}

const cssPathInImage = path.resolve('./public/styles.css');

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function removeAtKeyframesBlocks(css) {
  // Remove @keyframes blocks (simple non-greedy approximation)
  return css.replace(/@keyframes[\s\S]*?\{[\s\S]*?\}[\s\S]*?\}/g, '');
}

function extractSelectors(cssRaw) {
  const css = removeAtKeyframesBlocks(stripComments(cssRaw));
  // Very naive CSS parser: split by '}' and extract selector part before '{'
  // Ignore @rules (e.g., @media)
  const selectors = [];
  const blocks = css.split('}');
  for (const block of blocks) {
    const idx = block.indexOf('{');
    if (idx === -1) continue;
    const head = block.slice(0, idx).trim();
    if (!head || head.startsWith('@')) continue;
    // Split comma-separated selectors
    head.split(',').forEach(sel => {
      const s = sel.trim();
      if (!s) return;
      selectors.push(s);
    });
  }
  return selectors;
}

function selectorLikelySafe(sel) {
  // Skip complex pseudo-elements/pseudo-classes that querySelector may not accept reliably
  if (sel.includes('::')) return false;
  // Allow :hover/:focus/etc by stripping them for match test
  return true;
}

function normalizeSelector(sel) {
  // Remove common pseudo-classes to allow querying
  return sel.replace(/:(hover|focus|active|visited|disabled|first-child|last-child|nth-child\([^)]*\)|not\([^)]*\))/g, '');
}

async function main() {
  const out = { ok: true, totalSelectors: 0, testedSelectors: 0, matchedSelectors: 0, unusedSelectors: [], errors: [], note: '' };
  try {
    const css = await fs.readFile(cssPathInImage, 'utf-8');
    const selectors = extractSelectors(css);
    out.totalSelectors = selectors.length;

    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.goto(APP_URL, { waitUntil: 'networkidle2' });

    // Simulate dynamic states so selectors become present
    await page.evaluate(() => {
      try {
        // Condensed axis state
        document.body.classList.add('axis-condensed');
        // Ensure modal is in DOM and open
        const modal = document.getElementById('eventModal') || (function(){
          const m = document.createElement('div'); m.id = 'eventModal'; m.className = 'modal'; document.body.appendChild(m); return m;
        })();
        modal.classList.add('show');
        const mc = document.querySelector('.modal-content') || (function(){
          const c = document.createElement('div'); c.className = 'modal-content'; modal.appendChild(c); return c; })();
        // Tooltip container
        let tt = document.querySelector('.vis-tooltip');
        if (!tt) {
          tt = document.createElement('div');
          tt.className = 'vis-tooltip';
          tt.innerHTML = '<h3>Title</h3><span class="date-range">Range</span><span class="location">Loc</span><div class="description">Desc</div>';
          document.body.appendChild(tt);
        }
        // Week chip item content
        let chip = document.querySelector('.week-chip-item');
        if (!chip) {
          chip = document.createElement('div'); chip.className = 'week-chip-item';
          const ic = document.createElement('div'); ic.className = 'vis-item-content'; chip.appendChild(ic);
          document.body.appendChild(chip);
        }
        // Week label
        let wlbl = document.querySelector('.week-label');
        if (!wlbl) { wlbl = document.createElement('div'); wlbl.className = 'week-label'; document.body.appendChild(wlbl); }
      } catch (_) {}
    });

    // Collect classnames referenced in JS to avoid flagging dynamically-added nodes
    // Recursively scan public/ for JS to find dynamic classes
    async function readAllJs(dir) {
      let acc = '';
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const ent of entries) {
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) acc += await readAllJs(p);
        else if (ent.isFile() && ent.name.endsWith('.js')) acc += '\n' + await fs.readFile(p, 'utf-8');
      }
      return acc;
    }
    let jsContent = '';
    try { jsContent = await readAllJs(path.resolve('./public')); } catch (_) {}

    const dynamicClasses = new Set((jsContent.match(/\.[a-zA-Z0-9_-]+/g) || []).map(s => s.slice(1)));

    for (const rawSel of selectors) {
      if (!selectorLikelySafe(rawSel)) continue;
      const sel = normalizeSelector(rawSel).trim();
      if (!sel) continue;
      out.testedSelectors++;
      try {
        // Try in DOM
        const count = await page.$$eval(sel, nodes => nodes.length).catch(() => 0);
        if (count > 0) {
          out.matchedSelectors++;
          continue;
        }
        // If class-based selector, check if class is referenced in JS (dynamic)
        const classMatch = sel.match(/\.([a-zA-Z0-9_-]+)/);
        if (classMatch && dynamicClasses.has(classMatch[1])) {
          // Consider as used dynamically
          out.matchedSelectors++;
          continue;
        }
        out.unusedSelectors.push(sel);
      } catch (e) {
        out.errors.push({ selector: rawSel, error: String(e) });
      }
    }

    await browser.close();
  } catch (e) {
    out.ok = false;
    out.error = String(e);
  }
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}

main();
