// After one visit the guide opens with no signal, a shared plan link included.
// Pinned (19 November): one missing precache file makes the service worker install fail, so nothing works offline.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ROOT, open, wait } from './helper.js';

export default async function ({ browser, url }) {
  const sw = readFileSync(ROOT + 'sw.js', 'utf8');
  const precache = JSON.parse(sw.match(/const PRECACHE = (\[[^\]]+\])/)[1].replace(/'/g, '"'));
  for (const path of precache) {
    const status = (await fetch(new URL(path, url))).status;
    assert.equal(status, 200, `precache ${path} returns ${status}`);
  }

  const page = await open(browser, url);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => /opens with no signal/.test(document.querySelector('#storage-status').textContent));
  await page.reload({ waitUntil: 'networkidle0' });
  await page.setOfflineMode(true);
  await page.goto(`${url}?plan=1.sat.3`, { waitUntil: 'domcontentloaded' });
  await wait(300);
  const offline = await page.evaluate(() => ({ title: document.title, banner: !document.querySelector('#plan-banner').hidden, font: document.fonts.check('800 20px "League Spartan"') }));
  assert.match(offline.title, /Icons of Porsche/);
  assert.equal(offline.banner, true, 'the plan link works offline');
  assert.equal(offline.font, true, 'the self-hosted font is cached');
  await page.setOfflineMode(false);
  await page.done();
}
