// A visitor repaints the car: the wave climbs from the base, the paint sticks after reload, and the
// tooltip explains each paint on hover, keyboard focus and Escape. Reduced motion repaints at once.
import assert from 'node:assert/strict';
import { open, wait } from './helper.js';

const BLUE = 'rgb(26, 160, 216)', RED = 'rgb(200, 16, 46)', YELLOW = 'rgb(241, 194, 27)';
const rowFills = page => page.$$eval('.hero-car .hr-body', rows => rows.map(row => getComputedStyle(row).fill));

export default async function ({ browser, url }) {
  let page = await open(browser, url);
  assert.ok(await page.$eval('.hero-paint', el => el.getBoundingClientRect().top < innerHeight), 'picker on the first screen');
  await page.click('.swatch input[value="3"]');
  await wait(230);
  const mid = await rowFills(page);
  assert.equal(mid[0], BLUE, 'the base row repaints first');
  assert.equal(mid.at(-1), RED, 'the roof is still red mid-wave');
  await wait(700);
  assert.ok((await rowFills(page)).every(fill => fill === BLUE));
  assert.equal(await page.$eval('.pm-solid .pm-plate', el => getComputedStyle(el).fill), BLUE, 'build model follows');
  assert.match(await page.$eval('#paint-name', el => el.textContent), /Miami Blue/);

  // Eight fast taps end on the last paint.
  for (const value of [1, 2, 4, 5, 6, 7, 0, 3]) { await page.click(`.swatch input[value="${value}"]`); await wait(60); }
  await wait(900);
  assert.ok((await rowFills(page)).every(fill => fill === BLUE));
  await page.reload({ waitUntil: 'networkidle0' });
  assert.equal((await rowFills(page)).at(-1), BLUE, 'paint survives reload');
  await page.done();

  page = await open(browser, url, { reduce: true });
  await page.click('.swatch input[value="1"]');
  await wait(40);
  assert.equal((await rowFills(page)).at(-1), YELLOW, 'reduced motion repaints at once');
  assert.equal(await page.evaluate(() => document.getAnimations().filter(a => a.effect?.target?.classList?.contains('hr')).length), 0);
  await page.done();

  // Tooltip: a hover waits, then names the paint; Escape closes it; keyboard focus opens it at once.
  page = await open(browser, url, { width: 1280, height: 900 });
  const tip = () => page.$eval('#paint-tip', el => ({ shown: !el.hidden && !el.classList.contains('is-hidden'), text: el.textContent }));
  await page.hover('.swatch[data-paint="irish-green"]');
  await wait(100);
  assert.equal((await tip()).shown, false, 'hover waits before showing');
  await wait(350);
  assert.match((await tip()).text, /^Irish Green.*1964/);
  await page.keyboard.press('Escape');
  await wait(200);
  assert.equal((await tip()).shown, false);
  await page.mouse.move(5, 5);
  await page.focus('.swatch input[value="0"]');
  await page.keyboard.press('ArrowRight');
  await wait(50);
  const keyed = await tip();
  assert.ok(keyed.shown && keyed.text.startsWith('Racing Yellow'), 'keyboard focus shows the tooltip');
  await page.done();
}
