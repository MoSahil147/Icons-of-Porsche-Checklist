// Pinned (19 November): the exported story PNG was blank or transparent in a browser whose drawElementImage
// reports a paint but draws nothing. Both paths must give an opaque card with content.
import assert from 'node:assert/strict';
import { open, wait } from './helper.js';

const stubEmptyHtmlCanvas = () => {
  HTMLCanvasElement.prototype.requestPaint = function () { setTimeout(() => this.onpaint?.(), 50); };
  CanvasRenderingContext2D.prototype.drawElementImage = function () {};
};

export default async function ({ browser, url }) {
  for (const setup of [undefined, stubEmptyHtmlCanvas]) {
    const page = await open(browser, url, { width: 1280, height: 900, setup });
    await page.evaluate(() => document.querySelector('#story-figure').scrollIntoView());
    await page.waitForFunction(() => document.querySelector('#story-figure img')?.naturalWidth === 1080, { timeout: 10000 });
    await wait(300);
    const pixels = await page.evaluate(async () => {
      const img = document.querySelector('#story-figure img');
      await img.decode();
      const context = new OffscreenCanvas(108, 192).getContext('2d');
      context.drawImage(img, 0, 0, 108, 192);
      const data = context.getImageData(0, 0, 108, 192).data;
      let clear = 0, dark = 0;
      for (let i = 0; i < data.length; i += 4) { if (data[i + 3] < 250) clear++; if (data[i + 3] > 200 && data[i] + data[i + 1] + data[i + 2] < 300) dark++; }
      return { clear, dark };
    });
    assert.equal(pixels.clear, 0, `${setup ? 'empty drawElementImage' : 'drawn'}: no transparent pixels`);
    assert.ok(pixels.dark > 20, `${setup ? 'empty drawElementImage' : 'drawn'}: the card has content`);
    await page.done();
  }
}
