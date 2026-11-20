// Run with: bun test
import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { PLAN_ITEMS, RETIRED_ITEMS, NAME_LIMIT, cleanName, encodeMask, decodePlan, paintedSVG, progressPhase } from '../plan.js';
import { findProblems } from './check-text.js';

const root = new URL('..', import.meta.url).pathname;
const read = path => readFileSync(root + path, 'utf8');
const html = read('index.html');

describe('plan link', () => {
  test('the item order matches the checklist, with no gaps or extras', () => {
    const ids = [...html.matchAll(/data-item="([a-z-]+)"/g)].map(match => match[1]);
    const live = PLAN_ITEMS.filter(id => !RETIRED_ITEMS.has(id));
    expect(new Set(live)).toEqual(new Set(ids));
    expect(live.length).toBe(ids.length);
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
    expect(plan.days.sat.length).toBe(PLAN_ITEMS.length - RETIRED_ITEMS.size);
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

describe('scroll rail', () => {
  test('the rail car finds the hero clip paths it reuses', () => {
    for (const id of ['hc-body', 'hc-glass']) expect(html).toContain(`<clipPath id="${id}">`);
  });

  test('eight paint layers in Porsche order, one per eighth of the page', () => {
    const rail = html.slice(html.indexOf('class="rail-car"'));
    expect([...rail.matchAll(/<span class="rail-coat" data-paint="([a-z-]+)" style="--n:(\d)"/g)].map(match => `${match[2]}${match[1]}`)).toEqual(
      ['guards-red', 'racing-yellow', 'irish-green', 'miami-blue', 'lava-orange', 'chalk', 'carrara-white', 'carmine-red'].map((paint, i) => `${i}${paint}`));
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

  // A deploy must bump the cache name and every ?v= together, or a phone can mix old and new modules.
  test('every asset version matches the cache name', () => {
    const cache = read('sw.js').match(/const CACHE = 'iop26-v(\d+)'/)[1];
    const sources = ['index.html', ...readdirSync(root + 'js').map(file => `js/${file}`)];
    const versions = sources.flatMap(path => [...read(path).matchAll(/\?v=(\d+)/g)].map(match => `${path} v${match[1]}`));
    expect(versions.length).toBeGreaterThan(10);
    expect(versions.filter(entry => !entry.endsWith(` v${cache}`))).toEqual([]);
  });

  test('every module is precached', () => {
    for (const file of readdirSync(root + 'js')) expect(precache).toContain(`js/${file}`);
  });

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
    const png = readFileSync(root + 'og-v3.png');
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

describe('text check', () => {
  test('finds em dashes, en dashes and emoji, and passes plain text and legal marks', () => {
    const names = text => findProblems(text).map(problem => problem.name);
    expect(names('one \u2014 two \u2013 three \u{1F697}')).toEqual(['em dash', 'en dash', 'emoji']);
    expect(names('Porsche\u00ae 911, 9 - 11, \u00a9 2026')).toEqual([]);
    expect(findProblems('a\nb \u2014')[0]).toEqual({ line: 2, column: 3, name: 'em dash' });
  });
});

// The state table: the car is the packing gauge, and festival moments only add. Before the event only the pack list
// can be done, so a card shared then must look finished at 15 of 15, not two-thirds built.
describe('progress phase', () => {
  const n = (done, total) => ({ done, total });
  const at = (p, f, day = 'Saturday') => progressPhase(n(p, 15), n(f, 8), day);

  test('packing: the car builds from the pack list only', () => {
    expect(at(0, 0)).toMatchObject({ phase: 'packing', carShare: 0, carComplete: false, count: '0/15', line: 'packed for Saturday.', label: '0 / 15 packed' });
    expect(at(9, 0)).toMatchObject({ phase: 'packing', carShare: 9 / 15, carComplete: false, count: '9/15' });
  });

  test('ready: 15 of 15 finishes the car before any festival item', () => {
    expect(at(15, 0)).toMatchObject({ phase: 'ready', packed: true, carShare: 1, carComplete: true, count: '15/15', line: 'packed. Ready for Saturday.' });
    expect(at(15, 0).label).toBe('15 / 15 packed. Ready to go.');
  });

  test('there: one festival moment shows the whole car and leads the card', () => {
    expect(at(15, 3)).toMatchObject({ phase: 'there', carComplete: true, count: '3/8', line: 'festival moments found on Saturday.', label: 'Ready to go. 3 / 8 found.' });
    // At the event without the pack list: the card still looks finished; the in-page car stays the pack gauge.
    expect(at(4, 2)).toMatchObject({ phase: 'there', carComplete: true, carShare: 4 / 15, count: '2/8', label: '4 / 15 packed. 2 / 8 found.' });
  });

  test('found: all moments, with or without the pack list', () => {
    expect(at(15, 8)).toMatchObject({ phase: 'found', carComplete: true, count: '8/8', line: 'festival moments found. Saturday done.', label: 'All 23 done.' });
    expect(at(9, 8)).toMatchObject({ phase: 'found', carComplete: true, label: '9 / 15 packed. 8 / 8 found.' });
  });

  test('both days double each list', () => {
    const both = progressPhase(n(30, 30), n(5, 16), 'Saturday and Sunday');
    expect(both).toMatchObject({ phase: 'there', count: '5/16', line: 'festival moments found on Saturday and Sunday.', label: 'Ready to go. 5 / 16 found.' });
    expect(progressPhase(n(30, 30), n(16, 16), 'Saturday and Sunday').label).toBe('All 46 done.');
  });

  test('no state shows a part-built car once the pack list is done or a moment is found', () => {
    for (let p = 0; p <= 15; p++) for (let f = 0; f <= 8; f++) {
      const s = at(p, f);
      expect(s.carComplete).toBe(p === 15 || f > 0);
      expect(s.count.endsWith('/15') || s.count.endsWith('/8')).toBe(true);
    }
  });
});
