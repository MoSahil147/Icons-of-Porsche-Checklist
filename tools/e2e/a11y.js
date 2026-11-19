// axe WCAG 2.x A and AA on the whole page, at phone and desktop sizes, fresh and with a saved list,
// with the share fallback and the plan banner open so their text is checked too.
import assert from 'node:assert/strict';
import { axe, open } from './helper.js';

const SAVED = { sat: { ticket: true, phone: true }, sun: { water: true }, activeDay: 'both', activeCategory: 'collect', paint: 6, name: 'Sam' };

export default async function ({ browser, url }) {
  const found = [];
  for (const state of [undefined, SAVED]) {
    for (const width of [375, 1280]) {
      const page = await open(browser, url, { width, height: 812, state });
      await page.click('#share-story');
      await page.evaluate(() => { document.querySelector('#plan-banner').hidden = false; });
      for (const violation of await axe(page)) found.push(`${width}px ${state ? 'saved' : 'fresh'}: ${violation}`);
      await page.done();
    }
  }
  assert.deepEqual(found, []);
}
