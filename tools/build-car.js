// Builds the brick-built 911 from the traced 992 side elevation.
// Writes sports-car.svg (hero model) and the inline build model in index.html.
// Run: bun tools/build-car.js
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('..', import.meta.url).pathname;
const prof = JSON.parse(readFileSync(root + 'tools/car-profile.json', 'utf8'));

// Porsche 911 Carrera (992.2) coupe, mm. Sources are listed in README.md.
const CAR = {
  length: 4542, height: 1302, wheelbase: 2450, rearOverhang: 1077,
  rear: { tyreR: 714.5 / 2, rimR: 254, archR: 440 },   // 295/35 ZR20
  front: { tyreR: 670.6 / 2, rimR: 241.3, archR: 435 } // 235/40 ZR19
};
// Model scale 1:12. A stud pitch is 8 mm and a plate is 3.2 mm on the model.
const SCALE = 12, STUD = 8 * SCALE, PLATE = 3.2 * SCALE;

// Drawing frame of the traced profile (drawing units, y down).
const D = { x0: 62.5, x1: 640.5, ground: 234.5, roof: 68.5 };
const kx = CAR.length / (D.x1 - D.x0);
const ky = CAR.height / (D.ground - D.roof);
const X = sx => (sx - D.x0) * kx;
const Y = sy => (D.ground - sy) * ky;

function sampler(obj, f) {
  const pts = Object.entries(obj).map(([k, v]) => [X(+k), f(v)]).sort((a, b) => a[0] - b[0]);
  return x => {
    if (x < pts[0][0] || x > pts.at(-1)[0]) return NaN;
    let lo = 0, hi = pts.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pts[m][0] <= x) lo = m; else hi = m; }
    const [xa, a] = pts[lo], [xb, b] = pts[hi];
    return xb === xa ? a : a + (b - a) * (x - xa) / (xb - xa);
  };
}

const topAt = sampler(prof.top, Y);
const rawBot = sampler(prof.bot, Y);
const wheels = [
  { ...CAR.rear, cx: CAR.rearOverhang },
  { ...CAR.front, cx: CAR.rearOverhang + CAR.wheelbase }
].map(w => ({ ...w, cy: w.tyreR }));

// Body bottom: the traced underside, with the wheel arches cut out.
function botAt(x) {
  let b = rawBot(x);
  for (const w of wheels) {
    const dx = x - w.cx;
    if (Math.abs(dx) < w.archR) b = Math.max(b, w.cy + Math.sqrt(w.archR ** 2 - dx ** 2));
  }
  return b;
}

// SVG frame: 1 unit = 1 mm on the real car, y down.
const PAD = { left: 300, right: 300, top: 40, bottom: 70 };
const BASE = 36; // baseplate thickness below the ground line
const VB = { w: CAR.length + PAD.left + PAD.right, h: CAR.height + PAD.top + BASE + PAD.bottom };
const sx = x => Math.round(x + PAD.left);
const sy = y => Math.round(CAR.height + PAD.top - y);

function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const [ax, ay] = pts[0], [bx, by] = pts.at(-1);
  const len = Math.hypot(bx - ax, by - ay) || 1;
  let max = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs((by - ay) * pts[i][0] - (bx - ax) * pts[i][1] + bx * ay - by * ax) / len;
    if (d > max) { max = d; idx = i; }
  }
  if (max <= tol) return [pts[0], pts.at(-1)];
  return [...simplify(pts.slice(0, idx + 1), tol).slice(0, -1), ...simplify(pts.slice(idx), tol)];
}
const path = pts => 'M' + pts.map(([x, y]) => `${sx(x)} ${sy(y)}`).join('L') + 'Z';
const line = pts => 'M' + pts.map(([x, y]) => `${sx(x)} ${sy(y)}`).join('L');

// Bricks (3 plates) carry the lower body up to the belt line. Plates shape the curved top.
// Each run ends on the true outline, like a slope or a curved part.
const BRICK = 3 * PLATE, BELT = 7 * BRICK;
const bounds = [];
for (let y = 0; y < BELT; y += BRICK) bounds.push([y, y + BRICK]);
for (let y = BELT; y < CAR.height; y += PLATE) bounds.push([y, y + PLATE]);
const STEP = 4;
const rows = [];
for (const [i, [y0, y1]] of bounds.entries()) {
  const runs = [];
  let cur = null;
  for (let x = 0; x <= CAR.length; x += STEP) {
    const t = Math.min(y1, topAt(x)), b = Math.max(y0, botAt(x));
    if (t - b > 0.5) (cur ??= []).push([x, t, b]);
    else if (cur) { runs.push(cur); cur = null; }
  }
  if (cur) runs.push(cur);
  rows.push({ i, y0, y1, runs });
}

const full = (x, row) => topAt(x) >= row.y1 - 0.5 && botAt(x) <= row.y0 + 0.5;
const BOND = [6, 4, 8, 3, 6, 10, 4, 8];
function seams(row, run) {
  const xs = new Set();
  const first = run.find(([x]) => full(x, row)), last = run.findLast(([x]) => full(x, row));
  if (!first) return [];
  // Close each slope part on the next stud line, then lay bricks in a running bond.
  const a = Math.ceil(first[0] / STUD) * STUD, b = Math.floor(last[0] / STUD) * STUD;
  if (a < b) { xs.add(a); xs.add(b); }
  let x = ((row.i * 3) % 5) * STUD - 8 * STUD, k = row.i;
  while (x < b) { x += BOND[k++ % BOND.length] * STUD; if (x > a + STUD / 2 && x < b - STUD / 2 && full(x, row)) xs.add(x); }
  return [...xs].filter(v => full(v, row));
}

const runPath = (run, tol) => path(simplify([...run.map(([x, t]) => [x, t]), ...run.toReversed().map(([x, , b]) => [x, b])], tol));

// Windows and details, traced from the same drawing.
const spanPoly = spans => {
  const cols = Object.entries(spans).map(([k, [t, b]]) => [X(+k), Y(t), Y(b)]).sort((p, q) => p[0] - q[0]);
  return simplify([...cols.map(([x, t]) => [x, t]), ...cols.toReversed().map(([x, , b]) => [x, b])], 2);
};
const glass = [spanPoly(prof.windows.quarter), spanPoly(prof.windows.door)];
const P = list => list.map(([x, y]) => [X(x), Y(y)]);
const DETAIL = {
  tail: P([[66, 133.3], [117.5, 134.2], [144.6, 137.5], [130, 142.9], [80, 143.75], [66, 140]]),
  head: P([[548.75, 131.25], [571.7, 139.6], [590.4, 160.4], [584.2, 162.5], [561.25, 147.9]]),
  intakeFront: P([[596.7, 181.25], [634.2, 181.25], [632, 204.2], [598.75, 204.2]]),
  intakeRear: P([[67.5, 179.2], [117.5, 180], [130, 200], [71.7, 202]]),
  handle: P([[286.25, 140.4], [315.4, 141.7], [313.3, 147.9], [288.3, 147.9]]),
  mirror: P([[377.9, 109.2], [405, 111.7], [411.25, 120.8], [405, 125], [384.2, 125.8], [377.9, 120.8]]),
  mirrorArm: P([[394, 125], [404, 124.5], [409, 133.3], [398, 133.3]])
};

function wheelSVG(w, detailed) {
  const cx = sx(w.cx), cy = sy(w.cy), r = n => Math.round(n);
  if (!detailed) return `<circle class="pm-tyre" cx="${cx}" cy="${cy}" r="${r(w.tyreR)}"/><circle class="pm-rim" cx="${cx}" cy="${cy}" r="${r(w.rimR)}"/>`;
  const spokes = Array.from({ length: 10 }, (_, k) => `<rect x="${cx - 16}" y="${r(cy - w.rimR * 0.86)}" width="32" height="${r(w.rimR * 0.62)}" rx="10" transform="rotate(${k * 36} ${cx} ${cy})"/>`).join('');
  return `<g>
<circle cx="${cx}" cy="${cy}" r="${r(w.tyreR)}" fill="#1c1d20"/>
<circle cx="${cx}" cy="${cy}" r="${r((w.tyreR + w.rimR) / 2)}" fill="none" stroke="#2f3135" stroke-width="10"/>
<circle cx="${cx}" cy="${cy}" r="${r(w.rimR)}" fill="#c6ccd1" stroke="#7f878f" stroke-width="8"/>
<circle cx="${cx}" cy="${cy}" r="${r(w.rimR * 0.86)}" fill="#353b42"/>
<g fill="#c6ccd1">${spokes}</g>
<circle cx="${cx}" cy="${cy}" r="${r(w.rimR * 0.3)}" fill="#d9dee2" stroke="#7f878f" stroke-width="6"/>
<path d="M${cx - 9} ${cy - 27}h18v18h18v18h-18v18h-18v-18h-18v-18h18Z" fill="#353b42"/>
</g>`;
}

function heroSVG() {
  const out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB.w} ${VB.h}" role="img" aria-labelledby="t d">`);
  out.push(`<title id="t">Brick-built Porsche 911 Carrera (992), side view, scale 1:12</title>`);
  out.push(`<desc id="d">Original fan art. A red 911 coupe built from plates, about 47 studs long and 34 plates high, on a grey studded baseplate. Each plate row ends on the real outline of the car, traced from a scaled side elevation.</desc>`);
  // Baseplate and studs.
  const bx0 = -240, bx1 = CAR.length + 240;
  out.push(`<rect x="${sx(bx0)}" y="${sy(0)}" width="${bx1 - bx0}" height="${BASE}" fill="#9ea3a8"/><rect x="${sx(bx0)}" y="${sy(0)}" width="${bx1 - bx0}" height="6" fill="#c3c7cb"/><rect x="${sx(bx0)}" y="${sy(0) + BASE - 6}" width="${bx1 - bx0}" height="6" fill="#7c8186"/>`);
  const studs = [];
  for (let x = bx0 + (STUD - 57.6) / 2; x + 57.6 <= bx1; x += STUD) studs.push(`<rect x="${sx(x)}" y="${sy(20)}" width="58" height="20"/>`);
  out.push(`<g fill="#a7acb1">${studs.join('')}</g><g fill="#c9cdd1">${studs.map(s => s.replace(/width="58"/, 'width="14"')).join('')}</g>`);
  out.push(`<ellipse cx="${sx(CAR.length / 2)}" cy="${sy(0) + 2}" rx="${Math.round(CAR.length * 0.47)}" ry="26" fill="#0d1620" opacity=".28"/>`);
  // Wheel wells, clipped to the space above the sills.
  for (const w of wheels) {
    const sill = Math.min(botAt(w.cx - w.archR - 8), botAt(w.cx + w.archR + 8));
    out.push(`<clipPath id="well${w.cx}"><rect x="${sx(w.cx - w.archR)}" y="${sy(w.cy + w.archR)}" width="${Math.round(w.archR * 2)}" height="${Math.round(w.cy + w.archR - sill)}"/></clipPath><circle cx="${sx(w.cx)}" cy="${sy(w.cy)}" r="${Math.round(w.archR)}" fill="#14171b" clip-path="url(#well${w.cx})"/>`);
  }
  // Plate rows, seams and top highlights.
  const bodies = [], seamPaths = [], highs = [];
  for (const row of rows) for (const run of row.runs) {
    bodies.push(runPath(run, 1.5));
    for (const x of seams(row, run)) seamPaths.push(`M${sx(x)} ${sy(row.y1)}V${sy(row.y0)}`);
    highs.push(line(simplify(run.map(([x, t]) => [x, t - 6]), 1.5)));
  }
  out.push(`<g fill="#c8102e" stroke="#5a0613" stroke-width="6" stroke-linejoin="round"><path d="${bodies.join('')}"/></g>`);
  out.push(`<path d="${highs.join('')}" fill="none" stroke="#e8435a" stroke-width="5" stroke-linecap="round" opacity=".85"/>`);
  out.push(`<path d="${seamPaths.join('')}" stroke="#5a0613" stroke-width="7"/>`);
  // Glass as single transparent parts.
  out.push(`<clipPath id="glass">${glass.map(g => `<path d="${path(g)}"/>`).join('')}</clipPath>`);
  out.push(`<g fill="#1e2a35" stroke="#0e151c" stroke-width="6">${glass.map(g => `<path d="${path(g)}"/>`).join('')}</g>`);
  out.push(`<path d="M${sx(1500)} ${sy(1300)}L${sx(1900)} ${sy(1300)}L${sx(1500)} ${sy(800)}L${sx(1100)} ${sy(800)}ZM${sx(2150)} ${sy(1300)}L${sx(2300)} ${sy(1300)}L${sx(1900)} ${sy(800)}L${sx(1750)} ${sy(800)}Z" fill="#9fb3c4" opacity=".22" clip-path="url(#glass)"/>`);
  // Lights, intakes and handle sit inside the body outline. The mirror stands proud of it.
  out.push(`<clipPath id="body"><path d="${bodies.join('')}"/></clipPath><g clip-path="url(#body)">`);
  out.push(`<path d="${path(DETAIL.tail)}" fill="#8e0d1d" stroke="#5a0611" stroke-width="5"/><path d="${line(DETAIL.tail.slice(0, 3))}" fill="none" stroke="#ff6b78" stroke-width="6" stroke-linecap="round"/>`);
  out.push(`<path d="${path(DETAIL.head)}" fill="#dde6ec" stroke="#8796a2" stroke-width="5"/>`);
  for (const k of ['intakeFront', 'intakeRear']) {
    const pts = DETAIL[k], ys = pts.map(p => p[1]), xs = pts.map(p => p[0]);
    const slats = [1, 2, 3].map(n => { const y = Math.min(...ys) + (Math.max(...ys) - Math.min(...ys)) * n / 4; return `M${sx(Math.min(...xs) + 20)} ${sy(y)}H${sx(Math.max(...xs) - 20)}`; }).join('');
    out.push(`<path d="${path(pts)}" fill="#24292f" stroke="#111418" stroke-width="5"/><path d="${slats}" stroke="#4a525b" stroke-width="7"/>`);
  }
  out.push(`<path d="${path(DETAIL.handle)}" fill="#a50c24" stroke="#6e0818" stroke-width="4"/></g>`);
  out.push(`<path d="${path(DETAIL.mirrorArm)}" fill="#24292f"/><path d="${path(DETAIL.mirror)}" fill="#c8102e" stroke="#7d0a1c" stroke-width="5"/>`);
  for (const w of wheels) out.push(wheelSVG(w, true));
  out.push('</svg>');
  return out.join('\n');
}

// The build model: same rows, no seams. Part 0 is the wheels, then each plate row, then the glass.
function buildSVG() {
  const parts = [wheels.map(w => wheelSVG(w, false)).join('')];
  for (const row of rows) for (const run of row.runs) parts.push(`<path class="pm-plate" d="${runPath(run, 5)}"/>`);
  parts.push(glass.map(g => `<path class="pm-glass" d="${path(simplify(g, 4))}"/>`).join(''));
  const layer = cls => parts.map((p, k) => `<g class="${cls}" data-part="${k}">${p}</g>`).join('');
  return `<svg class="build-model" viewBox="${PAD.left - 60} ${PAD.top - 10} ${CAR.length + 120} ${CAR.height + 30}" aria-hidden="true" focusable="false"><g class="pm-ghost">${layer('pm-part')}</g><g class="pm-solid">${layer('pm-part')}</g></svg>`;
}

writeFileSync(root + 'sports-car.svg', heroSVG() + '\n');
const html = readFileSync(root + 'index.html', 'utf8');
const marked = /(<!-- build-model:start -->)[\s\S]*?(<!-- build-model:end -->)/;
if (marked.test(html)) writeFileSync(root + 'index.html', html.replace(marked, `$1${buildSVG()}$2`));

// Facts the page states, so the copy and the drawing agree.
const pct = x => +(sx(x) / VB.w * 100).toFixed(2);
console.log(JSON.stringify({
  viewBox: [VB.w, VB.h], rows: rows.length, parts: 2 + rows.reduce((n, r) => n + r.runs.length, 0),
  studsLong: +(CAR.length / STUD).toFixed(1), platesHigh: +(CAR.height / PLATE).toFixed(1),
  wheelbaseStuds: +(CAR.wheelbase / STUD).toFixed(1),
  axlesPct: wheels.map(w => pct(w.cx)), groundPct: +(sy(0) / VB.h * 100).toFixed(2)
}));
