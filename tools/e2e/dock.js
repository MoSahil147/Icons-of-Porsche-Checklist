// Phone view: the car and the list switch stay docked at the top, each list option is a gauge for its list,
// a finished list points to the other one, and the car revs once when both are done. Desktop keeps its layout.
import assert from 'node:assert/strict';
import { open, wait } from './helper.js';

const read = page => page.evaluate(() => {
  const dock = document.querySelector('#build-dock').getBoundingClientRect();
  return {
    dockTop: Math.round(dock.top), dockH: Math.round(dock.height), ratio: dock.height / innerHeight,
    counts: [...document.querySelectorAll('#list-switch .list-count')].map(e => e.textContent),
    fills: [...document.querySelectorAll('#list-switch .category-button')].map(e => Number(e.style.getPropertyValue('--fill'))),
    waiting: document.querySelector('#list-switch .is-waiting')?.dataset.category ?? null,
    signal: Boolean(document.querySelector('#list-switch .is-signal')),
    nudge: document.querySelector('#list-nudge').textContent,
    label: document.querySelector('#progress-label').textContent,
    rev: document.querySelector('.build-model').getAnimations().some(a => a.animationName === 'rev'),
    gridTop: Math.round(document.querySelector('.checklist-grid').getBoundingClientRect().top)
  };
});
const tick = (page, list, count) => page.evaluate((list, count) => [...document.querySelectorAll(`${list} input:not(:checked)`)].slice(0, count).forEach(input => input.click()), list, count);

export default async function ({ browser, url }) {
  for (const [width, height] of [[390, 844], [360, 660]]) {
    const page = await open(browser, url, { width, height });
    await tick(page, '#pack-list', 14);
    await page.evaluate(() => document.querySelector('#pack-list li:last-child').scrollIntoView({ block: 'end', behavior: 'instant' }));
    await wait(200);
    let s = await read(page);
    assert.ok(s.dockTop <= 0 && s.dockTop > -s.dockH, `${width}: the dock stays at the top deep in the list`);
    assert.ok(s.ratio <= 0.3, `${width}: the dock uses at most 30% of the screen (${s.dockH} px)`);
    assert.deepEqual(s.counts, ['14 of 15', '0 of 8'], 'each option counts its own list');
    assert.ok(Math.abs(s.fills[0] - 14 / 15) < 1e-6 && s.fills[1] === 0, 'each gauge fills with its list');
    assert.equal(s.waiting, null, 'no nudge before a list is done');

    await page.click('#pack-list li:last-child .check-row');
    s = await read(page);
    assert.equal(s.waiting, 'collect', 'the other list waits when this one is done');
    assert.ok(s.signal, 'the other list blinks');
    assert.equal(s.nudge, 'Before you go is done. 8 left at the festival.');
    assert.equal(s.rev, false, 'no rev while a list is open');

    await page.click('#list-switch [data-category="collect"]');
    await page.waitForFunction(() => Math.abs(document.querySelector('.checklist-grid').getBoundingClientRect().top - document.querySelector('#build-dock').offsetHeight) < 2, { timeout: 3000 }).catch(() => {});
    s = await read(page);
    assert.ok(Math.abs(s.gridTop - s.dockH) <= 2, `${width}: the other list starts just under the dock (${s.gridTop}, ${s.dockH})`);
    assert.equal(s.waiting, null, 'visiting the list clears the wait');
    assert.equal(s.nudge, '', 'and the message');
    assert.equal(s.signal, false, 'and the blink');

    await tick(page, '#collect-list', 8);
    s = await read(page);
    assert.match(s.label, /^23 \/ 23\. Ready to\sgo\./);
    assert.ok(s.rev, 'the car revs when both lists are done');
    assert.deepEqual(s.counts, ['15 of 15', '8 of 8']);
    await page.close();
  }

  // Reduced motion: the wait still shows, with no blink and no rev.
  const still = await open(browser, url, { width: 390, height: 844, reduce: true });
  await tick(still, '#pack-list', 15);
  let s = await read(still);
  assert.equal(s.waiting, 'collect');
  assert.equal(await still.$eval('#list-switch .is-waiting', el => getComputedStyle(el).animationName), 'none', 'no blink with reduced motion');
  await still.click('#list-switch [data-category="collect"]');
  await tick(still, '#collect-list', 8);
  assert.equal((await read(still)).rev, false, 'no rev with reduced motion');
  await still.close();

  // Desktop: both lists show, so there is no switch and no message; the car still revs.
  const desk = await open(browser, url, { width: 1280, height: 900 });
  await tick(desk, '#pack-list', 15);
  s = await read(desk);
  assert.equal(await desk.$eval('#list-switch', el => getComputedStyle(el).display), 'none');
  assert.equal(s.nudge, '', 'no message on a wide screen');
  await tick(desk, '#collect-list', 8);
  assert.ok((await read(desk)).rev, 'the car revs on a desktop');
  await desk.close();
  console.log('dock checks passed');
}
