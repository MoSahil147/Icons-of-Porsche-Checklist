// A visitor ticks items, sees the count and the model grow, switches days, reloads, and resets.
import assert from 'node:assert/strict';
import { STORAGE_KEY, open, wait } from './helper.js';

const label = page => page.$eval('#progress-label', el => el.textContent);
const tick = (page, index) => page.evaluate(i => document.querySelectorAll('#pack-list input')[i].click(), index);

export default async function ({ browser, url }) {
  let page = await open(browser, url);

  // Pinned: 23 items, after the list update of 19 November.
  assert.equal(await page.$$eval('.check-row input[data-item]', inputs => inputs.length), 23);
  assert.match(await label(page), /^0 \/ 23 ready/);

  // A tick flies one plate to the model; the count updates at once and the part lands.
  await page.evaluate(() => { const row = document.querySelectorAll('#pack-list li')[3]; scrollTo(0, row.getBoundingClientRect().top + scrollY - 400); });
  await wait(200);
  await tick(page, 0);
  await wait(300);
  await tick(page, 3);
  await wait(140);
  const mid = await page.evaluate(() => ({ flyers: document.querySelectorAll('.flyer').length, label: document.querySelector('#progress-label').textContent }));
  assert.ok(mid.flyers >= 1, 'a plate is in flight');
  assert.match(mid.label, /^2 \/ 23/);
  await wait(500);
  assert.deepEqual(await page.evaluate(() => ({ flyers: document.querySelectorAll('.flyer').length, built: document.querySelectorAll('.pm-solid .is-built').length })), { flyers: 0, built: 3 });
  assert.equal(await page.$eval('#make-it-yours', el => el.hidden), false);

  // Days are separate lists; "Both" shows per-day buttons.
  await page.click('.day-button[data-day="sun"]');
  assert.match(await label(page), /^0 \/ 23/);
  await page.click('.day-button[data-day="both"]');
  assert.match(await label(page), /^2 \/ 46 ready across both days/);
  assert.equal(await page.$eval('.day-item-controls', el => el.hidden), false);
  await page.click('#day-controls-water .day-item-button[data-day="sun"]');
  assert.match(await label(page), /^3 \/ 46/);
  await page.click('#day-controls-water .day-item-button[data-day="sun"]');
  await page.click('.day-button[data-day="sat"]');

  // On a phone the two lists are tabs.
  assert.equal(await page.$eval('.collect-column', el => getComputedStyle(el).display), 'none');
  await page.click('.category-button[data-category="collect"]');
  assert.notEqual(await page.$eval('.collect-column', el => getComputedStyle(el).display), 'none');
  await page.click('.category-button[data-category="pack"]');

  // Ticks survive a reload.
  await page.reload({ waitUntil: 'networkidle0' });
  assert.match(await label(page), /^2 \/ 23/);
  assert.equal(JSON.parse(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).sat.ticket, true);

  // The last tick completes the 911.
  await page.evaluate(() => document.querySelectorAll('.check-row input').forEach(input => { if (!input.checked) input.click(); }));
  assert.match(await label(page), /^23 \/ 23\. The 911 is complete\./);
  assert.equal(await page.$eval('.build-model', el => el.classList.contains('is-done')), true);

  // Reset asks first, then clears this day.
  await page.click('#reset-button');
  assert.equal(await page.$eval('#confirm-dialog', el => el.open), true);
  await page.click('#dialog-confirm');
  assert.match(await label(page), /^0 \/ 23/);
  await page.done();

  // Reduced motion: the part fades in, no plate flies.
  page = await open(browser, url, { reduce: true });
  await page.evaluate(() => { const row = document.querySelectorAll('#pack-list li')[3]; scrollTo(0, row.getBoundingClientRect().top + scrollY - 400); });
  await tick(page, 0);
  await wait(300);
  await tick(page, 3);
  await wait(60);
  assert.equal(await page.$$eval('.pm-solid .is-built', parts => parts.length), 3, 'the plate is built');
  assert.equal(await page.$$eval('.flyer', flyers => flyers.length), 0);
  await page.done();

  // A corrupt store is ignored; blocked storage still lets the visitor tick.
  page = await open(browser, url, { setup: () => { if (!sessionStorage.getItem('corrupt')) { sessionStorage.setItem('corrupt', '1'); localStorage.setItem('brick-by-brick-iop26-v1', '{"sat":{"ticket":"yes","phone":true},"sun":[1],"activeDay":"mars"}'); } } });
  await page.reload({ waitUntil: 'networkidle0' });
  assert.match(await label(page), /^1 \/ 23/);
  await page.done();
  page = await open(browser, url, { setup: () => { Storage.prototype.getItem = () => { throw new Error('blocked'); }; Storage.prototype.setItem = () => { throw new Error('blocked'); }; } });
  assert.match(await page.$eval('#storage-status', el => el.textContent), /storage is unavailable/);
  await tick(page, 0);
  assert.match(await label(page), /^1 \/ 23/);
  await page.done();
}
