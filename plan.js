// Pure helpers for the plan link and the paint swap. The page loads this before app.js; `bun test` loads it too.

// Plan link: ?plan=1.<day>.<mask>[.<mask>] with one base-36 mask per day over this item order.
// Append new items to the end only. Never rename, remove or reorder an id, or older links decode wrongly.
const PLAN_ITEMS = ['ticket', 'phone', 'power', 'shoes', 'travel', 'offline', 'young-icons', 'bag', 'water', 'payment', 'sun', 'layer', 'camera',
  'book', 'pin', 'postcard', 'catalogue', 'stickers', 'guide', 'programme', 'car-moment', 'art-moment', 'festival-treat', 'stage-moment', 'live-set', 'referral', 'leave-home', 'merch'];
// Ids no longer on the page. They keep their bit so older links still decode; decodePlan drops them.
const RETIRED_ITEMS = new Set(['book', 'pin', 'postcard', 'catalogue', 'guide']);
const PLAN_DAYS = { sat: ['sat'], sun: ['sun'], both: ['sat', 'sun'] };
const NAME_LIMIT = 24;

// Names come from a URL or an input: drop bidi control characters so they cannot flip the text around them.
function cleanName(value) {
  return value.replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '').trim().slice(0, NAME_LIMIT);
}

function encodeMask(dayProgress) {
  return PLAN_ITEMS.reduce((mask, item, index) => dayProgress[item] === true ? mask + 2 ** index : mask, 0).toString(36);
}

// Returns { day, days: { sat: [ids] }, by } or null. A malformed link is ignored as a whole.
function decodePlan(search) {
  const params = new URLSearchParams(search);
  const [version, day, ...masks] = (params.get('plan') || '').split('.');
  const targetDays = PLAN_DAYS[day];
  if (version !== '1' || !Object.hasOwn(PLAN_DAYS, day) || masks.length !== targetDays.length) return null;
  const days = {};
  for (const [index, text] of masks.entries()) {
    if (!/^[0-9a-z]{1,6}$/.test(text)) return null;
    const mask = parseInt(text, 36);
    if (mask >= 2 ** PLAN_ITEMS.length) return null;
    days[targetDays[index]] = PLAN_ITEMS.filter((item, bit) => Math.floor(mask / 2 ** bit) % 2 === 1 && !RETIRED_ITEMS.has(item));
  }
  return { day, days, by: cleanName(params.get('by') || '') };
}

// Mix a #rrggbb colour toward black (amount < 0) or white (amount > 0).
function shade(hex, amount) {
  const target = amount < 0 ? 0 : 255;
  return '#' + [1, 3, 5].map(i => {
    const value = parseInt(hex.slice(i, i + 2), 16);
    return Math.round(value + (target - value) * Math.abs(amount)).toString(16).padStart(2, '0');
  }).join('');
}

// Repaints sports-car.svg: the body red and the reds derived from it. The taillight keeps its own red.
function paintedSVG(source, hex) {
  const swaps = { c8102e: hex, '5a0613': shade(hex, -0.55), '7d0a1c': shade(hex, -0.4), e8435a: shade(hex, 0.25), a50c24: shade(hex, -0.18), '6e0818': shade(hex, -0.45) };
  return source.replace(/#(c8102e|5a0613|7d0a1c|e8435a|a50c24|6e0818)\b/gi, (_, code) => swaps[code.toLowerCase()]);
}

if (typeof module !== 'undefined') module.exports = { RETIRED_ITEMS, PLAN_ITEMS, NAME_LIMIT, cleanName, encodeMask, decodePlan, shade, paintedSVG };
