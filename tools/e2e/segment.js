// The day and list switches: a finger drag from the selected segment moves the thumb 1:1 and the release picks the
// nearest segment; a short drag glides back; a tap and the keyboard still work; a mouse drag works on a desktop.
import assert from 'node:assert/strict';
import { open, wait } from './helper.js';

const pressed = (page, sel) => page.$$eval(sel, bs => bs.find(b => b.getAttribute('aria-pressed') === 'true')?.dataset.day ?? bs.find(b => b.getAttribute('aria-pressed') === 'true')?.dataset.category);
// Wait for the expected segment, not a fixed time: a slow CI runner can send the click late. A real fault still times out.
const expectPressed = async (page, sel, want, message) => {
  await page.waitForFunction((sel, want) => [...document.querySelectorAll(sel)].some(b => b.getAttribute('aria-pressed') === 'true' && (b.dataset.day ?? b.dataset.category) === want), { timeout: 3000 }, sel, want).catch(() => {});
  assert.equal(await pressed(page, sel), want, message);
};
const centre = (page, sel) => page.$eval(sel, el => { el.scrollIntoView({ block: 'center', behavior: 'instant' }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width }; });

export default async function ({ browser, url }) {
  const page = await open(browser, url, { width: 390, height: 844 });
  const cdp = await page.createCDPSession();
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const drag = async (from, dx, steps = 12) => {
    await touch('touchStart', from.x, from.y);
    for (let i = 1; i <= steps; i++) { await touch('touchMove', from.x + dx * i / steps, from.y); await wait(16); }
  };

  let sat = await centre(page, '.day-button[data-day="sat"]');
  await drag(sat, sat.w * 0.6);
  const mid = await page.$eval('.seg-thumb', el => parseFloat(el.style.getPropertyValue('--x')));
  assert.ok(mid > sat.w * 0.4, `thumb follows the finger (x ${mid})`);
  assert.ok(await page.$eval('.day-switch', el => el.classList.contains('is-pressed')), 'thumb lifts while held');
  await touch('touchEnd'); await expectPressed(page, '.day-button', 'sun', 'release picks the nearest segment');
  assert.equal(await page.$eval('.day-switch', el => el.classList.contains('is-pressed')), false, 'thumb settles on release');

  const sun = await centre(page, '.day-button[data-day="sun"]');
  await drag(sun, sun.w * 0.2, 4); await touch('touchEnd'); await wait(500); await expectPressed(page, '.day-button', 'sun', 'a short drag keeps the segment');
  const [thumbX, sunX] = await page.evaluate(() => [parseFloat(document.querySelector('.day-switch .seg-thumb').style.getPropertyValue('--x')), document.querySelector('.day-button[data-day="sun"]').offsetLeft]);
  assert.equal(thumbX, sunX, 'the thumb glides back under the selected segment');

  // A drag from a segment that is not selected does nothing; a tap selects it.
  const both = await centre(page, '.day-button[data-day="both"]');
  await drag(both, -both.w, 6); await touch('touchEnd'); await wait(300); await expectPressed(page, '.day-button', 'sun', 'only the selected segment drags');
  await page.touchscreen.tap(both.x, both.y); await expectPressed(page, '.day-button', 'both', 'a tap still selects');

  const pack = await centre(page, '.category-button[data-category="pack"]');
  await drag(pack, pack.w); await touch('touchEnd'); await expectPressed(page, '.category-button', 'collect', 'the list switch drags too');
  assert.ok(await page.$eval('.checklist-grid', el => el.classList.contains('show-collect')), 'the drag shows the festival list');

  await page.focus('.day-button[data-day="sat"]'); await page.keyboard.press('Enter'); await expectPressed(page, '.day-button', 'sat', 'Enter still selects');
  await page.close();

  const desk = await open(browser, url, { width: 1280, height: 900 });
  sat = await centre(desk, '.day-button[data-day="sat"]');
  await desk.mouse.move(sat.x, sat.y); await desk.mouse.down();
  const sunDesk = await centre(desk, '.day-button[data-day="sun"]');
  await desk.mouse.move(sunDesk.x, sunDesk.y, { steps: 10 }); await desk.mouse.up(); await expectPressed(desk, '.day-button', 'sun', 'a mouse drag selects on a desktop');
  assert.equal(await desk.$eval('.list-switch', el => getComputedStyle(el).display), 'none', 'no list switch on a wide screen');
  await desk.close();
  console.log('segment checks passed');
}
