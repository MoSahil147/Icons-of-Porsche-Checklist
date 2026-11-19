// The flat-six: each cylinder reaches top dead centre and glows at its firing angle, opposed pairs mirror,
// the firing strip walks 1-6-2-4-3-5, and the run button starts and pauses it.
import assert from 'node:assert/strict';
import { open, wait } from './helper.js';

const FIRE = { 1: 0, 6: 120, 2: 240, 4: 360, 3: 480, 5: 600 };
const TDC = 38 + 128, BDC = 128 - 38;

export default async function ({ browser, url }) {
  const page = await open(browser, url, { width: 1280, height: 900 });
  const read = angle => page.evaluate(a => {
    const input = document.querySelector('#crank-angle');
    input.value = a;
    input.dispatchEvent(new Event('input'));
    const out = {};
    for (const g of document.querySelectorAll('.engine-art .cyl')) {
      const y = Number(g.querySelector('.e-piston').getAttribute('transform').match(/translate\(0 ([-\d.]+)\)/)[1]);
      out[g.dataset.cyl] = { dist: Math.abs(y - 250), firing: g.classList.contains('is-firing') };
    }
    out.strip = document.querySelector('.firing-order li.is-firing')?.dataset.cyl;
    return out;
  }, angle);
  for (const [cyl, at] of Object.entries(FIRE)) {
    const s = await read(at);
    assert.ok(Math.abs(s[cyl].dist - TDC) < 0.2, `cylinder ${cyl} at top dead centre when it fires`);
    assert.equal(s[cyl].firing, true);
    assert.equal(s.strip, cyl);
  }
  for (let a = 0; a < 720; a += 7) {
    const s = await read(a);
    for (const [p, q] of [[1, 4], [2, 5], [3, 6]]) assert.ok(Math.abs(s[p].dist - s[q].dist) < 0.2, `pair ${p}/${q} mirrors at ${a}`);
    for (const c of [1, 2, 3, 4, 5, 6]) assert.ok(s[c].dist <= TDC + 0.1 && s[c].dist >= BDC - 0.1, `cylinder ${c} in stroke at ${a}`);
  }
  await page.evaluate(() => document.querySelector('#engine').scrollIntoView());
  await page.click('#engine-toggle');
  const before = await page.$eval('#crank-angle', el => Number(el.value));
  await wait(400);
  assert.notEqual(await page.$eval('#crank-angle', el => Number(el.value)), before, 'the engine runs');
  assert.equal(await page.$eval('#engine-toggle', el => el.getAttribute('aria-pressed')), 'true');
  await page.click('#engine-toggle');
  assert.equal(await page.$eval('#engine-toggle', el => el.textContent), 'Run the engine');
  await page.done();
}
