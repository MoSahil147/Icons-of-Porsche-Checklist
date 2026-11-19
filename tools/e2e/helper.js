import puppeteer from 'puppeteer-core';
import { existsSync, readFileSync } from 'node:fs';

export const ROOT = new URL('../..', import.meta.url).pathname;
export const STORAGE_KEY = 'brick-by-brick-iop26-v1';
export const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Set E2E_COVERAGE=1 to collect JS and CSS coverage from every page the flows open (see run.js).
export const coverage = process.env.E2E_COVERAGE ? { js: [], css: [] } : null;

const CHROMES = [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/snap/bin/chromium', '/usr/bin/chromium'];

export function serve() {
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      let path = decodeURIComponent(new URL(request.url).pathname);
      if (path.endsWith('/')) path += 'index.html';
      const file = Bun.file(ROOT + path.slice(1));
      if (path.includes('..') || !(await file.exists())) return new Response('Not found', { status: 404 });
      return new Response(file);
    }
  });
  return { url: `http://localhost:${server.port}/`, stop: () => server.stop(true) };
}

export function launch() {
  const executablePath = CHROMES.find(path => path && existsSync(path));
  if (!executablePath) throw new Error('No Chrome found. Set CHROME_PATH.');
  // Headless Chrome has no mouse, so it reports (hover: none). Give it a fine hovering pointer like a desktop;
  // pages opened with touch emulation still report coarse.
  return puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox', '--blink-settings=primaryHoverType=2,primaryPointerType=4,availableHoverTypes=2,availablePointerTypes=4'] });
}

// A page at one size, with a clean store unless `state` is given. Page errors fail the flow at close().
export async function open(browser, url, { width = 390, height = 844, touch = width < 900, reduce = false, state, setup } = {}) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewport({ width, height, isMobile: touch, hasTouch: touch });
  if (reduce) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.evaluateOnNewDocument((key, saved) => {
    if (sessionStorage.getItem('e2e-ready')) return;
    sessionStorage.setItem('e2e-ready', '1');
    localStorage.clear();
    if (saved) localStorage.setItem(key, JSON.stringify(saved));
  }, STORAGE_KEY, state ?? null);
  if (setup) await page.evaluateOnNewDocument(setup);
  if (coverage) await Promise.all([page.coverage.startJSCoverage({ resetOnNavigation: false }), page.coverage.startCSSCoverage({ resetOnNavigation: false })]);
  await page.goto(url, { waitUntil: 'networkidle0' });
  page.done = async () => {
    if (coverage) {
      const [js, css] = await Promise.all([page.coverage.stopJSCoverage(), page.coverage.stopCSSCoverage()]);
      coverage.js.push(...js); coverage.css.push(...css);
    }
    await page.close();
    if (errors.length) throw new Error(`page errors: ${errors.join('; ')}`);
  };
  return page;
}

export async function axe(page) {
  await page.addScriptTag({ content: readFileSync(ROOT + 'node_modules/axe-core/axe.min.js', 'utf8') });
  return page.evaluate(async () => {
    const result = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } });
    return result.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`);
  });
}
