// axe WCAG 2.x A and AA on the whole page, at phone and desktop sizes, fresh and with a saved list,
// with one list done (the amber waiting option), with the share fallback and the plan banner open so their text is checked too.
import assert from 'node:assert/strict';
import { axe, open } from './helper.js';

const SAVED = { sat: { ticket: true, phone: true }, sun: { water: true }, activeDay: 'both', activeCategory: 'collect', paint: 6, name: 'Sam' };
// Before you go done, At the festival not: the phone list switch shows the amber waiting option.
const WAITING = { sat: { ticket: true, phone: true, power: true, shoes: true, travel: true, offline: true, 'young-icons': true, bag: true, water: true, payment: true, sun: true, layer: true, camera: true, referral: true, 'leave-home': true }, sun: {}, activeDay: 'sat', activeCategory: 'pack' };

export default async function ({ browser, url }) {
  const found = [];
  let sawWaiting = false;
  for (const state of [undefined, SAVED, WAITING]) {
    for (const width of [375, 1280]) {
      const page = await open(browser, url, { width, height: 812, state });
      if (state === WAITING && width < 900) sawWaiting = await page.$eval('#list-switch [data-category="collect"]', el => el.classList.contains('is-waiting'));
      await page.click('#share-story');
      await page.evaluate(() => { document.querySelector('#plan-banner').hidden = false; });
      for (const violation of await axe(page)) found.push(`${width}px ${state === WAITING ? 'waiting' : state ? 'saved' : 'fresh'}: ${violation}`);
      await page.done();
    }
  }
  assert.ok(sawWaiting, 'the waiting state was on screen for axe');
  assert.deepEqual(found, []);
}
