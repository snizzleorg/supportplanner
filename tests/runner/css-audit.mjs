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

const cssRoot = path.resolve('./public');

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
  const out = { ok: true, totalSelectors: 0, testedSelectors: 0, matchedSelectors: 0, unusedSelectors: [], errors: [], note: '', usedClassesWithoutCss: [], usedIdsWithoutCss: [], usedClassesMissingInOurCss: [], usedClassesMissingInAllCss: [], usedClassesVendorUnmatched: [] };
  try {
    // Read all CSS files under public/
    async function readAllCss(dir) {
      let acc = '';
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const ent of entries) {
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) acc += await readAllCss(p);
        else if (ent.isFile() && ent.name.endsWith('.css')) acc += '\n' + await fs.readFile(p, 'utf-8');
      }
      return acc;
    }
    // Read our local CSS first so we can compute our own selector set
    const ourCss = await readAllCss(cssRoot);
    const ourSelectors = extractSelectors(ourCss);
    let allCss = ourCss;

    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.goto(APP_URL, { waitUntil: 'networkidle2' });

    // Collect stylesheet hrefs and inline <style> contents from the page
    const { stylesheetHrefs, inlineStyles } = await page.evaluate(() => {
      const hrefs = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .map(l => l.href)
        .filter(Boolean);
      const inline = Array.from(document.querySelectorAll('style'))
        .map(s => s.textContent || '')
        .filter(Boolean);
      return { stylesheetHrefs: hrefs, inlineStyles: inline };
    });

    // Give the app a moment to inject any dynamic <style> (e.g., computed palettes)
    await new Promise(r => setTimeout(r, 800));
    // Sweep inline styles again post-initialization
    try {
      const inlineAfter = await page.evaluate(() => Array.from(document.querySelectorAll('style')).map(s => s.textContent || ''));
      for (const cssText of inlineAfter) {
        if (cssText) allCss += '\n' + cssText;
      }
    } catch (_) {}

    // Now extract selectors from the full CSS corpus (local + vendor + dynamic inline)
    const allSelectors = extractSelectors(allCss);
    // Dedupe selectors to avoid repeated work
    const selectors = Array.from(new Set(allSelectors));
    out.totalSelectors = selectors.length;

    // Try to fetch external vendor CSS (CDNs) and append
    for (const href of stylesheetHrefs) {
      try {
        // Skip same-origin relative paths already covered by reading ./public
        // We still fetch absolute http(s) to include vendor CSS
        if (/^https?:\/\//.test(href)) {
          const res = await fetch(href);
          if (res.ok) {
            const text = await res.text();
            allCss += '\n' + text;
          }
        }
      } catch (_) { /* ignore fetch failures */ }
    }
    // Add inline <style> contents
    for (const cssText of inlineStyles) {
      allCss += '\n' + cssText;
    }

    // Attempt to fetch dynamic runtime CSS from the app (e.g., /dynamic-styles.css)
    try {
      const base = APP_URL.replace(/\/$/, '');
      const dynUrl = base + '/dynamic-styles.css';
      const resDyn = await fetch(dynUrl);
      if (resDyn.ok) {
        const dynCss = await resDyn.text();
        allCss += '\n' + dynCss;
      }
    } catch (_) { /* ignore if not present */ }

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

        // Modal help-text states (dynamic): create nodes to match .help-text.ok and .help-text.error
        if (!document.querySelector('.help-text.ok')) {
          const ok = document.createElement('div'); ok.className = 'help-text ok'; ok.textContent = 'OK'; document.body.appendChild(ok);
        }
        if (!document.querySelector('.help-text.error')) {
          const err = document.createElement('div'); err.className = 'help-text error'; err.textContent = 'Error'; document.body.appendChild(err);
        }
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

    // Build sets of class and id names that appear in CSS selectors
    const cssClassNamesAll = new Set((selectors.join(' ') .match(/\.[a-zA-Z0-9_-]+/g) || []).map(s => s.slice(1)));
    const cssIdNamesAll = new Set((selectors.join(' ') .match(/#[a-zA-Z0-9_-]+/g) || []).map(s => s.slice(1)));
    const cssClassNamesOur = new Set((ourSelectors.join(' ') .match(/\.[a-zA-Z0-9_-]+/g) || []).map(s => s.slice(1)));
    const cssIdNamesOur = new Set((ourSelectors.join(' ') .match(/#[a-zA-Z0-9_-]+/g) || []).map(s => s.slice(1)));

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

    // Collect classes and ids actually used in DOM after dynamic setup
    const { domClasses, domIds } = await page.evaluate(() => {
      const classes = new Set();
      const ids = new Set();
      document.querySelectorAll('*').forEach(node => {
        if (node.classList) node.classList.forEach(c => classes.add(c));
        if (node.id) ids.add(node.id);
      });
      return { domClasses: Array.from(classes), domIds: Array.from(ids) };
    });

    await browser.close();

    // Merge DOM classes only for reverse audit (JS tokens are noisy)
    // Filter to class-like names: must start with a letter and contain only [-_a-zA-Z0-9]
    const usedClasses = new Set(domClasses.filter(c => /^[A-Za-z][A-Za-z0-9_-]*$/.test(c)));
    // Exclude our own placeholder class used for simulation
    usedClasses.delete('week-chip-item');
    const usedIds = new Set(domIds);

    // Determine used items without CSS definitions
    // Overall missing (ours + vendor) — apply allowlist first
    const allowPrefixes = ['calendar-group-cal-','event-type-'];
    const isAllowed = cls => allowPrefixes.some(p => cls.startsWith(p));
    out.usedClassesWithoutCss = Array.from(usedClasses)
      .filter(c => !cssClassNamesAll.has(c))
      .filter(c => !isAllowed(c))
      .sort();
    out.usedIdsWithoutCss = Array.from(usedIds).filter(id => !cssIdNamesAll.has(id)).sort();

    // Split into buckets
    const vendorPrefixes = ['leaflet-','vis-'];
    const isVendor = cls => vendorPrefixes.some(p => cls.startsWith(p));

    out.usedClassesVendorUnmatched = out.usedClassesWithoutCss.filter(isVendor);
    out.usedClassesMissingInAllCss = out.usedClassesWithoutCss.filter(c => !isVendor(c));
    out.usedClassesMissingInOurCss = Array.from(usedClasses)
      .filter(c => !isVendor(c) && !isAllowed(c) && !cssClassNamesOur.has(c))
      .sort();
  } catch (e) {
    out.ok = false;
    out.error = String(e);
  }
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}

main();
