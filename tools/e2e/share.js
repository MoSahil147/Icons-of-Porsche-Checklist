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
  await page.reload({ waitUntil: 'networkidle0' });
  assert.equal(await page.$eval('#builder-name', el => el.value), 'Aleksandra Wiśniewska-Ko', 'the saved name is back in the field');
  // The clear button shows only with text, empties the field and the saved name, and keeps focus in the field.
  assert.equal(await page.$eval('#name-clear', el => el.hidden), false, 'clear button shows with a name');
  const fit = await page.$eval('#builder-name', el => [el.scrollWidth <= el.clientWidth, el.getBoundingClientRect().width]);
  assert.ok(fit[0] && fit[1] <= 320, `a 24-character name fits a field sized for it (${Math.round(fit[1])} px)`);
  await page.click('#name-clear');
  assert.deepEqual(await page.evaluate(key => [document.querySelector('#builder-name').value, JSON.parse(localStorage.getItem(key)).name, document.activeElement.id, document.querySelector('#name-clear').hidden], STORAGE_KEY), ['', '', 'builder-name', true]);
  await page.type('#builder-name', 'Aleksandra Wiśniewska-Kowalczyk');
  await page.evaluate(() => document.querySelector('#your-911').scrollIntoView());
  await page.waitForFunction(() => document.querySelector('#story-figure img')?.naturalWidth === 1080, { timeout: 8000 });

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

  page = await open(browser, link);
  await page.click('#plan-dismiss');
  assert.deepEqual(await page.evaluate(() => [document.querySelector('#plan-banner').hidden, location.search]), [true, '']);
  await page.done();

  page = await open(browser, `${url}?plan=1.sat.12-x&by=%E2%80%AEx`);
  assert.deepEqual(await page.evaluate(() => [document.querySelector('#plan-banner').hidden, location.search]), [true, '']);
  await page.done();
}
