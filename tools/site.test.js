// Run with: bun test
import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
const { PLAN_ITEMS, NAME_LIMIT, cleanName, encodeMask, decodePlan, paintedSVG } = require('../plan.js');

const root = new URL('..', import.meta.url).pathname;
const read = path => readFileSync(root + path, 'utf8');
const html = read('index.html');

describe('plan link', () => {
  test('the item order matches the checklist, with no gaps or extras', () => {
    const ids = [...html.matchAll(/data-item="([a-z-]+)"/g)].map(match => match[1]);
    expect(new Set(PLAN_ITEMS)).toEqual(new Set(ids));
    expect(PLAN_ITEMS.length).toBe(ids.length);
    // Shared links depend on this order. Append new items only.
    expect(PLAN_ITEMS.slice(0, 3)).toEqual(['ticket', 'phone', 'power']);
  });

  test('a list survives the round trip', () => {
    const progress = { ticket: true, water: true, 'stage-moment': true, phone: false };
    const plan = decodePlan(`?plan=1.sat.${encodeMask(progress)}&by=Sam`);
    expect(plan.day).toBe('sat');
    expect(plan.days.sat.sort()).toEqual(['stage-moment', 'ticket', 'water']);
    expect(plan.by).toBe('Sam');
  });

  test('both days carry two masks', () => {
    const all = Object.fromEntries(PLAN_ITEMS.map(id => [id, true]));
    const plan = decodePlan(`?plan=1.both.${encodeMask(all)}.${encodeMask({})}`);
    expect(plan.days.sat.length).toBe(PLAN_ITEMS.length);
    expect(plan.days.sun).toEqual([]);
  });

  test.each([
    '', '?plan=', '?plan=2.sat.a', '?plan=1.mon.a', '?plan=1.sat', '?plan=1.sat.a.b', '?plan=1.both.a',
    '?plan=1.sat.12-x', '?plan=1.sat.zzzzzz', '?plan=1.sat.%20', '?plan=1.__proto__.a', '?plan=1.sat.A'
  ])('rejects %p', search => {
    expect(decodePlan(search)).toBeNull();
  });

  test('names lose bidi controls and stay short', () => {
    expect(cleanName('‮evil‬')).toBe('evil');
    expect(cleanName('x'.repeat(40)).length).toBe(NAME_LIMIT);
    expect(decodePlan('?plan=1.sat.0&by=%E2%80%AESam').by).toBe('Sam');
  });
});

describe('paint', () => {
  test('repaints every body red and keeps the taillight', () => {
    const svg = read('sports-car.svg');
    expect(svg).toContain('#c8102e');
    const blue = paintedSVG(svg, '#1aa0d8');
    expect(blue).not.toMatch(/#(c8102e|5a0613|7d0a1c|e8435a|a50c24|6e0818)\b/i);
    expect(blue).toContain('#1aa0d8');
    expect(blue).toContain('#8e0d1d');
  });
});

describe('paint picker', () => {
  test('eight paint radios sit on the hero, before the checklist', () => {
    const hero = html.slice(html.indexOf('class="hero-paint"'), html.indexOf('id="checklist"'));
    expect([...hero.matchAll(/name="paint" value="(\d)"/g)].map(match => match[1])).toEqual(['0', '1', '2', '3', '4', '5', '6', '7']);
    expect([...html.matchAll(/name="paint"/g)].length).toBe(8);
  });

  test('the picker hides when scripts do not run', () => {
    expect(read('styles.css')).toContain('html:not(.js) .hero-paint { display: none; }');
  });
});

describe('site files', () => {
  const precache = [...read('sw.js').matchAll(/'([^']+\.[a-z0-9]+|\.\/)'/g)].map(match => match[1]).filter(path => path !== './');

  test('every precached file exists', () => {
    for (const path of precache) expect(existsSync(root + path), path).toBe(true);
  });

  test('CI deploys every precached file', () => {
    const workflow = read('.github/workflows/site.yml');
    for (const path of precache) {
      const top = path.split('/')[0];
      expect(workflow.includes(` ${top}`) || workflow.includes(` ${path}`), path).toBe(true);
    }
  });

  test('link preview image fits WhatsApp limits', () => {
    const png = readFileSync(root + 'og.png');
    expect(png.length).toBeLessThan(300 * 1024);
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
  });

  test('preview tags use absolute HTTPS addresses', () => {
    for (const tag of ['og:image', 'og:url', 'twitter:image']) {
      const match = html.match(new RegExp(`(?:property|name)="${tag}" content="([^"]+)"`));
      expect(match?.[1], tag).toStartWith('https://');
    }
  });
});
