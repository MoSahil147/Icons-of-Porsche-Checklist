// Foldable phones: the cover screen, the open screen, and the two folded postures with a hinge.
// The hinge comes from CDP device metrics (displayFeature), which drives the Viewport Segments API.
// Emulation.setDisplayFeaturesOverride had no effect in Chrome 156, so this uses the older field.
import assert from 'node:assert/strict';
import { open, wait } from './helper.js';

const HINGE = 10;
const CONTENT = 'h1, h2, h3, p, a, button, input, label, legend, figcaption, .hero-car, .swatch';

async function fold(browser, url, width, height, orientation) {
  const page = await open(browser, url, { width, height });
  const offset = (orientation === 'vertical' ? width : height) / 2 - HINGE / 2;
  const cdp = await page.createCDPSession();
  await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: true, displayFeature: { orientation, offset, maskLength: HINGE } });
  await wait(300);
  return { page, from: offset, to: offset + HINGE };
}

// Visible content boxes, in page coordinates, that overlap the band [from, to] on one axis.
function onHinge(page, axis, from, to, scope = 'body') {
  return page.evaluate((sel, axis, from, to, scope) => [...document.querySelector(scope).querySelectorAll(sel)]
    .filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && !el.closest('.story-canvas, .visually-hidden'))
    .map(el => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ r }) => r.width && r.height)
    .filter(({ r }) => axis === 'x' ? r.left < to && r.right > from : r.top < to && r.bottom > from)
    .map(({ el }) => el.className?.baseVal ?? (el.className || el.tagName)), CONTENT, axis, from, to, scope);
}

export default async function ({ browser, url }) {
  // Folded cover screen: narrow and tall.
  let page = await open(browser, url, { width: 344, height: 882 });
  const cover = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, swatch: document.querySelector('.swatch').getBoundingClientRect().bottom }));
  assert.equal(cover.overflow, false, 'no sideways scroll on the 344 px cover screen');
  assert.ok(cover.swatch <= 882, `first swatch on the first cover screen (bottom ${Math.round(cover.swatch)})`);
  await page.done();

  // Open, one segment, near square: both lists side by side, no stretched phone tabs.
  page = await open(browser, url, { width: 712, height: 834 });
  const flat = await page.evaluate(() => {
    const [a, b] = [...document.querySelectorAll('.check-column')].map(el => el.getBoundingClientRect());
    return { overflow: document.documentElement.scrollWidth > innerWidth, tabs: getComputedStyle(document.querySelector('.list-switch')).display, sideBySide: Math.round(a.top) === Math.round(b.top) && a.right <= b.left };
  });
  assert.equal(flat.overflow, false, 'no sideways scroll on the open screen');
  assert.equal(flat.tabs, 'none', 'no list tabs on the open screen');
  assert.ok(flat.sideBySide, 'both lists side by side on the open screen');
  await page.done();

  // Book posture: the hinge runs top to bottom. Hero and paint on the left, the checklist on the right.
  let hinge = await fold(browser, url, 884, 1104, 'vertical');
  page = hinge.page;
  const book = await page.evaluate(() => ({
    segments: matchMedia('(horizontal-viewport-segments: 2)').matches,
    hero: document.querySelector('.hero').getBoundingClientRect().right,
    checklist: document.querySelector('.checklist').getBoundingClientRect().left,
    overflow: document.documentElement.scrollWidth > innerWidth
  }));
  assert.ok(book.segments, 'Chrome reports two side-by-side segments');
  assert.ok(book.hero <= hinge.from, `hero and paint stay left of the hinge (right ${book.hero})`);
  assert.ok(book.checklist >= hinge.to, `checklist starts right of the hinge (left ${book.checklist})`);
  assert.equal(book.overflow, false, 'no sideways scroll in the book posture');
  assert.deepEqual(await onHinge(page, 'x', hinge.from, hinge.to), [], 'no text, button or car on the vertical hinge');
  await page.done();

  // Laptop posture: the hinge runs side to side. The hero stays in the top pane, the page scrolls below.
  hinge = await fold(browser, url, 1104, 884, 'horizontal');
  page = hinge.page;
  for (const y of [0, 1500, 4000]) {
    await page.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), y);
    const laptop = await page.evaluate(() => {
      const hero = document.querySelector('.hero').getBoundingClientRect();
      const flow = [...document.querySelectorAll('.topbar, main > :not(.hero), .site-footer')].filter(el => el.getClientRects().length);
      return { segments: matchMedia('(vertical-viewport-segments: 2)').matches, top: hero.top, bottom: hero.bottom, firstFlow: Math.min(...flow.map(el => el.getBoundingClientRect().top + scrollY)) };
    });
    assert.ok(laptop.segments, 'Chrome reports two stacked segments');
    assert.ok(laptop.top === 0 && laptop.bottom >= hinge.to, `hero covers the top pane and the hinge at scroll ${y}`);
    assert.ok(laptop.firstFlow >= hinge.to, 'the scrolling page starts below the hinge');
  }
  assert.deepEqual(await onHinge(page, 'y', hinge.from, hinge.to, '.hero'), [], 'no hero content on the horizontal hinge');
  await page.done();

  // Fallback: the same size with no hinge keeps the normal layout.
  page = await open(browser, url, { width: 884, height: 1104 });
  assert.equal(await page.$eval('main', el => getComputedStyle(el).display), 'block', 'no fold layout without segments');
  await page.done();
}
