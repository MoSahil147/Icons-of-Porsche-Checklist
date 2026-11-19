// The page fits every screen from 320 px to 1920 px with no sideways scroll, and the header and first paint
// swatch stay on the first screen of a small phone.
// Pinned (19 November): at 360 x 660 the header grew to three rows and pushed the first swatch below the fold.
// Pinned (19 November): the ticket link drew a plain underline under its tyre mark, a doubled line.
import assert from 'node:assert/strict';
import { open } from './helper.js';

export default async function ({ browser, url }) {
  for (const [width, height] of [[320, 640], [360, 660], [390, 844], [768, 1024], [1280, 800], [1920, 1080]]) {
    const page = await open(browser, url, { width, height });
    const m = await page.evaluate(() => {
      const nav = document.querySelector('.main-nav a').getBoundingClientRect();
      const brand = document.querySelector('.brand').getBoundingClientRect();
      const ticket = document.querySelector('.ticket-link').getBoundingClientRect();
      const rows = new Set([brand, ticket, nav].map(r => Math.round(r.top / 10))).size;
      return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        swatchBottom: document.querySelector('.swatch').getBoundingClientRect().bottom,
        headerRows: rows,
        treads: [...document.querySelectorAll('.track')].filter(el => el.getClientRects().length).every(el => getComputedStyle(el).backgroundImage.includes('url(')),
        doubled: [...document.querySelectorAll('.track')].flatMap(t => [t, t.closest('a')]).filter(e => e && getComputedStyle(e).textDecorationLine.includes('underline')).map(e => e.className || e.tagName)
      };
    });
    assert.equal(m.overflow, false, `no sideways scroll at ${width}px`);
    assert.ok(m.treads, `every visible tyre-mark link draws its tread at ${width}px`);
    assert.deepEqual(m.doubled, [], `no plain underline under a tyre mark at ${width}px`);
    if (width === 360) {
      assert.ok(m.headerRows <= 2, `header stays two rows at 360 x 660 (got ${m.headerRows})`);
      assert.ok(m.swatchBottom <= height, `first paint swatch above the fold at 360 x 660 (bottom ${Math.round(m.swatchBottom)})`);
    }
    await page.done();
  }

  // The console greeting: one log on load, at most 8 lines, plain ASCII, with the source link.
  const page = await open(browser, url, { setup: () => { window.__logs = []; const log = console.log; console.log = (...args) => { window.__logs.push(args.join(' ')); log(...args); }; } });
  const logs = await page.evaluate(() => window.__logs);
  assert.equal(logs.length, 1);
  assert.ok(logs[0].trim().split('\n').length <= 8 && /^[\x20-\x7e\n]*$/.test(logs[0]), 'short plain ASCII');
  assert.match(logs[0], /github\.com\/MoSahil147\/Icons-of-Porsche-Checklist/);
  await page.done();
}
