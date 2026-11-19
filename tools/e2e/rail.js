// Wide screens: the rail car drives down the page and wipes on each paint in turn; a firm flick puffs exhaust,
// reading and keys do not. The car cursor shows over the hero car and swatches with a mouse only.
// Anchor links glide, except with reduced motion.
import assert from 'node:assert/strict';
import { open, wait } from './helper.js';

const PAINTS = ['guards-red', 'racing-yellow', 'irish-green', 'miami-blue', 'lava-orange', 'chalk', 'carrara-white', 'carmine-red'];

export default async function ({ browser, url }) {
  for (const [width, reduce, display] of [[859, false, 'none'], [861, false, 'block'], [1280, true, 'none']]) {
    const page = await open(browser, url, { width, height: 900, touch: false, reduce });
    assert.equal(await page.$eval('#scroll-rail', el => getComputedStyle(el).display), display, `rail at ${width}px, reduce ${reduce}`);
    await page.done();
  }

  const page = await open(browser, url, { width: 1280, height: 900 });
  const top = () => page.$$eval('.rail-coat', coats => coats.filter(c => ['none', 'matrix(1, 0, 0, 1, 0, 0)'].includes(getComputedStyle(c).transform)).at(-1).dataset.paint);
  // The story preview renders when it nears the screen and makes the page taller, so let it render before measuring.
  await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; document.querySelector('#story-figure').scrollIntoView(); });
  await page.waitForFunction(() => document.querySelector('#story-figure img')?.naturalWidth === 1080, { timeout: 8000 });
  const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  for (const [i, paint] of PAINTS.entries()) {
    await page.evaluate(y => scrollTo(0, y), Math.round(max * (i + 0.5) / 8));
    await wait(100);
    assert.equal(await top(), paint, `eighth ${i} at scroll ${await page.evaluate(() => scrollY)} of ${max}`);
  }
  assert.equal(await page.evaluate(() => document.elementFromPoint(innerWidth - 12, 100).closest('#scroll-rail')), null, 'the rail lets the pointer through');

  // Trackpad-like wheel trains on a 16 ms clock. A flick starts at 80 px a frame; reading moves 6 px a frame.
  const cdp = await page.createCDPSession();
  const puffs = async (start, decay, frames) => {
    await page.evaluate(() => { scrollTo(0, 300); window.__puffs = 0; new MutationObserver(() => { if (document.querySelector('#scroll-rail.is-fling')) window.__puffs++; }).observe(document.querySelector('#scroll-rail'), { attributes: true }); });
    await wait(400);
    let delta = start;
    const sent = [];
    for (let f = 0; f < frames && delta >= 1; f++, delta *= decay) { sent.push(cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 640, y: 450, deltaX: 0, deltaY: Math.round(delta) })); await wait(16); }
    await Promise.all(sent);
    await wait(400);
    return page.evaluate(() => window.__puffs);
  };
  assert.ok(await puffs(80, 0.92, 45) > 0, 'a firm flick puffs');
  assert.equal(await puffs(6, 1, 60), 0, 'reading does not puff');
  await page.evaluate(() => { scrollTo(0, 0); window.__puffs = 0; document.body.focus(); });
  for (const key of ['End', 'Home', 'PageDown']) { await page.keyboard.press(key); await wait(500); }
  assert.equal(await page.evaluate(() => window.__puffs), 0, 'keys do not puff');

  // Car cursor: hotspot on the nose pixel; text keeps its own cursor.
  const cursor = sel => page.$eval(sel, el => getComputedStyle(el).cursor.replace(/url\("[^"]*\/icons\/([^"]+)"\)/, '$1'));
  assert.equal(await cursor('.hero-car'), 'cursor-911.png 31 18, auto');
  assert.equal(await cursor('.swatch'), 'cursor-911-go.png 30 12, pointer');
  assert.equal(await cursor('.hero-lede'), 'auto');
  await page.done();
  const touch = await open(browser, url, { width: 1280, height: 900, touch: true });
  assert.equal(await touch.$eval('.hero-car', el => getComputedStyle(el).cursor), 'auto', 'no car cursor on touch');
  await touch.done();

  // Anchor links glide to the section and land below the header.
  for (const reduce of [false, true]) {
    const p = await open(browser, url, { reduce });
    await p.click('.hero .button');
    await wait(60);
    const midway = await p.evaluate(() => scrollY);
    await wait(1500);
    const end = await p.evaluate(() => ({ y: scrollY, top: Math.round(document.querySelector('#checklist').getBoundingClientRect().top) }));
    if (!reduce) assert.ok(midway < end.y, 'glides, not jumps');
    else assert.equal(midway, end.y, 'reduced motion jumps');
    assert.ok(Math.abs(end.top - 96) <= 2, 'lands at the scroll padding');
    await p.done();
  }
}
