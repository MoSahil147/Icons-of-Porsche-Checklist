// A visitor names their car, gets the story image (or the save fallback), and copies the plan link.
// A friend opens that link, adds the ticks to their own list, and can undo it. A broken link is ignored.
import assert from 'node:assert/strict';
import { STORAGE_KEY, open, wait } from './helper.js';

export default async function ({ browser, url }) {
  let page = await open(browser, url, { setup: () => { window.__copied = []; Object.defineProperty(navigator, 'clipboard', { value: { writeText: text => { window.__copied.push(text); return Promise.resolve(); } } }); } });
  await page.evaluate(() => document.querySelectorAll('#pack-list input').forEach((input, i) => { if (i < 6) input.click(); }));
  await page.evaluate(() => document.querySelector('#your-911').scrollIntoView());
  await page.type('#builder-name', 'Aleksandra Wiśniewska-Kowalczyk');
  await page.waitForFunction(() => document.querySelector('#story-figure img')?.naturalWidth === 1080, { timeout: 8000 });
  assert.equal(JSON.parse(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).name.length, 24, 'name is cut to 24 characters');

  // Headless Chrome cannot share files, so the page offers the image to save.
  await page.click('#share-story');
  assert.deepEqual(await page.evaluate(() => [!document.querySelector('#save-story').hidden, !document.querySelector('#story-hint').hidden]), [true, true]);

  await page.click('#copy-plan');
  await wait(50);
  const link = await page.evaluate(() => window.__copied[0]);
  assert.match(link, /\?plan=1\.sat\.[0-9a-z]+&by=/);
  assert.match(await page.$eval('#share-status', el => el.textContent), /Link copied/);
  await page.done();

  page = await open(browser, link);
  assert.match(await page.$eval('#plan-banner-text', el => el.textContent), /ticked 6 of 23 items on Saturday/);
  assert.ok(await page.$eval('#plan-banner', el => !el.hidden && el.getBoundingClientRect().top < 200), 'banner near the top');
  await page.click('#plan-merge');
  assert.match(await page.$eval('#progress-label', el => el.textContent), /^6 \/ 23/);
  assert.equal(await page.evaluate(() => location.search), '');
  await page.click('#plan-undo');
  assert.match(await page.$eval('#progress-label', el => el.textContent), /^0 \/ 23/);
  await page.done();

  page = await open(browser, `${url}?plan=1.sat.12-x&by=%E2%80%AEx`);
  assert.deepEqual(await page.evaluate(() => [document.querySelector('#plan-banner').hidden, location.search]), [true, '']);
  await page.done();
}
