import { cleanName, paintedSVG, shade } from '../plan.js?v=21';
import { PAINTS, dayName, paintHex, progressNumbers, saveState, state } from './state.js?v=21';

const buildModel = document.querySelector('.build-model');
const modelParts = buildModel ? [...buildModel.querySelectorAll('.pm-solid .pm-part')] : [];
const nameInput = document.querySelector('#builder-name');
const storyFigure = document.querySelector('#story-figure');
const storyHint = document.querySelector('#story-hint');
const shareStoryButton = document.querySelector('#share-story');
const saveStoryLink = document.querySelector('#save-story');
const shareStatus = document.querySelector('#share-status');
const storyImage = new Image();
storyImage.width = 1080;
storyImage.height = 1920;
storyImage.alt = 'Your story image: your 911 in the paint you chose, with your progress and the event details.';
let storyFile = null;
let storyUrl = '';
let heroSource = null;
let storyTimer = 0;
let storyVisible = false;
let storyRun = 0;

function heroSVGText() {
  // A failed download is not kept, so the next tap tries again when the signal comes back.
  heroSource ??= fetch('sports-car.svg')
    .then(response => response.ok ? response.text() : Promise.reject(new Error(String(response.status))))
    .catch(error => { heroSource = null; throw error; });
  return heroSource;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

// Plain fill attributes, because CSS classes do not apply to an SVG drawn as an image.
function buildModelSVG(builtCount, hex) {
  const clone = buildModel.cloneNode(true);
  clone.querySelector('.pm-ghost')?.remove();
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  // An SVG drawn to a canvas needs a size of its own; the viewBox alone gives it none in some browsers.
  const [, , viewWidth, viewHeight] = clone.getAttribute('viewBox').split(' ');
  clone.setAttribute('width', viewWidth);
  clone.setAttribute('height', viewHeight);
  const colours = { 'pm-plate': hex, 'pm-glass': '#1e2a35', 'pm-tyre': '#1c1d20', 'pm-rim': '#c6ccd1' };
  clone.querySelectorAll('.pm-part').forEach((part, index) => {
    const built = index < builtCount;
    part.removeAttribute('class');
    part.querySelectorAll('[class]').forEach(shape => {
      const kind = shape.getAttribute('class');
      shape.removeAttribute('class');
      shape.setAttribute('fill', built ? colours[kind] : '#c8dde9');
      shape.setAttribute('stroke', built && kind === 'pm-plate' ? shade(hex, -0.45) : built ? 'none' : '#a7becf');
      shape.setAttribute('stroke-width', '10');
    });
  });
  return new XMLSerializer().serializeToString(clone);
}

function fitText(context, text, font, maxWidth, size) {
  let next = size;
  do {
    context.font = `${font} ${next}px ${font.startsWith('800') ? '"League Spartan"' : '"Onest"'}, system-ui, sans-serif`;
    next -= 4;
  } while (context.measureText(text).width > maxWidth && next > 24);
}

const siteAddress = () => (location.host + location.pathname).replace(/index\.html$/, '').replace(/\/$/, '');
const countLine = complete => complete ? `items ready. ${dayName()}'s 911 is complete.` : `items ready for ${dayName()}.`;

// 1080 x 1920. Key content stays between y 270 and y 1536 so Instagram and WhatsApp controls do not cover it.
async function renderStory() {
  const { done, total } = progressNumbers();
  const hex = paintHex();
  const complete = done === total;
  const built = total ? Math.round(done / total * modelParts.length) : 0;
  const svg = complete ? paintedSVG(await heroSVGText(), hex) : buildModelSVG(built, hex);
  await Promise.race([
    Promise.all(['800 120px "League Spartan"', '600 40px "Onest"', '400 34px "Onest"'].map(font => document.fonts.load(font))),
    new Promise(resolve => setTimeout(resolve, 1500))
  ]);
  if ('drawElementImage' in CanvasRenderingContext2D.prototype) {
    // Experimental path: if it fails, draws a blank card, or never finishes, use the drawn version.
    try {
      return await Promise.race([
        renderStoryHTML(svg, done, total, complete, hex),
        new Promise((_, reject) => setTimeout(() => reject(new Error('html story timed out')), 2500))
      ]);
    } catch { /* fall back to the drawn version */ }
  }
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const car = await loadImage(url).finally(() => setTimeout(() => URL.revokeObjectURL(url), 1000));
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const c = canvas.getContext('2d');
  const ink = '#162232', muted = '#4b5a6c', left = 90, width = 900;
  const { builderName } = state;
  c.fillStyle = '#dbebf5';
  c.fillRect(0, 0, 1080, 1920);
  c.fillStyle = ink;
  c.textBaseline = 'alphabetic';
  fitText(c, `${done}/${total}`, '800', width, 210);
  c.fillText(`${done}/${total}`, left, 435);
  fitText(c, countLine(complete), '600', width, 52);
  c.fillText(countLine(complete), left, 510);
  const carWidth = 940, carHeight = carWidth * car.naturalHeight / car.naturalWidth;
  c.drawImage(car, 70, 740 - carHeight / 2, carWidth, carHeight);
  const boxY = 955;
  const lower = builderName ? 0 : -55;
  const foot = builderName ? 0 : -45;
  c.lineWidth = 6;
  c.strokeStyle = ink;
  c.beginPath();
  c.roundRect(left, boxY, width, 165, 18);
  c.stroke();
  c.fillStyle = hex;
  c.strokeStyle = shade(hex, -0.45);
  c.lineWidth = 4;
  c.beginPath(); c.roundRect(left + 40, boxY + 61, 150, 70, 8); c.fill(); c.stroke();
  for (const x of [left + 77, left + 152]) { c.beginPath(); c.roundRect(x - 26, boxY + 35, 52, 28, 6); c.fill(); c.stroke(); }
  c.fillStyle = ink;
  fitText(c, `1x ${PAINTS[state.paintIndex][1]}`, '800', width - 260, 60);
  c.fillText(`1x ${PAINTS[state.paintIndex][1]}`, left + 230, boxY + 78);
  c.fillStyle = muted;
  fitText(c, '911 Carrera (992), 1:12, brick-built', '400', width - 260, 34);
  c.fillText('911 Carrera (992), 1:12, brick-built', left + 230, boxY + 128);
  if (builderName) {
    c.fillStyle = ink;
    fitText(c, `Built by ${builderName}`, '800', width, 64);
    c.fillText(`Built by ${builderName}`, left, 1225);
  }
  // Room for the Instagram link sticker. Without a sticker, the address still reads as the link.
  const slotY = 1275 + lower;
  c.setLineDash([18, 12]);
  c.lineWidth = 4;
  c.strokeStyle = muted;
  c.beginPath();
  c.roundRect(left, slotY, 720, 116, 58);
  c.stroke();
  c.setLineDash([]);
  c.fillStyle = ink;
  fitText(c, siteAddress(), '600', 620, 34);
  c.fillText(siteAddress(), left + 50, slotY + 70);
  fitText(c, 'Icons of Porsche, Dubai, 21 to 22 November 2026', '600', width, 38);
  c.fillText('Icons of Porsche, Dubai, 21 to 22 November 2026', left, 1490 + foot);
  c.fillStyle = muted;
  fitText(c, 'A fan-made guide, not an official Porsche page.', '400', width, 30);
  c.fillText('A fan-made guide, not an official Porsche page.', left, 1536 + foot);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('The story image could not be exported.');
  return blob;
}

// The same card in HTML and CSS, drawn with drawElementImage (HTML-in-Canvas: Chromium behind a flag or an
// origin trial; WICG explainer, github.com/WICG/html-in-canvas). Real text layout for any script.
async function renderStoryHTML(svg, done, total, complete, hex) {
  const carUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const canvas = document.createElement('canvas');
  // Shipping Chrome requires content=drawable (it throws without it); the WICG explainer names layoutsubtree.
  // Set both, so either form lays out the children instead of treating them as fallback content.
  canvas.setAttribute('content', 'drawable');
  canvas.setAttribute('layoutsubtree', '');
  canvas.width = 1080;
  canvas.height = 1920;
  canvas.className = 'story-canvas';
  const card = document.createElement('div');
  card.className = 'story-card';
  card.setAttribute('drawable', '');
  card.style.setProperty('--paint', hex);
  card.style.setProperty('--paint-edge', shade(hex, -0.45));
  const line = (tag, cls, text) => { const el = document.createElement(tag); el.className = cls; el.textContent = text; return el; };
  const img = new Image();
  img.src = carUrl;
  img.alt = '';
  const callout = line('div', 'story-callout', '');
  callout.append(line('span', 'story-plate', ''), line('b', '', `1x ${PAINTS[state.paintIndex][1]}`), line('small', '', '911 Carrera (992), 1:12, brick-built'));
  card.append(
    line('div', 'story-count', `${done}/${total}`),
    line('p', 'story-line', countLine(complete)),
    img, callout,
    ...(state.builderName ? [line('p', 'story-name', `Built by ${state.builderName}`)] : []),
    line('p', 'story-link', siteAddress()),
    line('p', 'story-event', 'Icons of Porsche, Dubai, 21 to 22 November 2026'),
    line('p', 'story-small', 'A fan-made guide, not an official Porsche page.')
  );
  canvas.append(card);
  document.body.append(canvas);
  try {
    await img.decode();
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('no paint')), 2000);
      canvas.onpaint = () => {
        clearTimeout(timer);
        try {
          const context = canvas.getContext('2d');
          context.reset();
          // Paper first: a share target shows transparent pixels as black.
          context.fillStyle = '#dbebf5';
          context.fillRect(0, 0, 1080, 1920);
          context.drawElementImage(card, 0, 0);
          resolve();
        } catch (error) {
          reject(error); // a throw inside the paint event must reach the fallback, not the console
        }
      };
      canvas.requestPaint?.();
    });
    // Some browsers report a paint but draw nothing or only the background: then use the drawn version.
    const pixels = canvas.getContext('2d').getImageData(0, 0, 1080, 1920).data;
    let opaque = 0, inked = 0;
    for (let i = 0; i < pixels.length; i += 4 * 97) {
      if (pixels[i + 3] < 250) continue;
      opaque++;
      if (pixels[i] + pixels[i + 1] + pixels[i + 2] < 300) inked++;
    }
    if (opaque < pixels.length / (4 * 97) * 0.9 || inked < 20) throw new Error('blank paint');
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('no blob');
    return blob;
  } finally {
    canvas.remove();
    URL.revokeObjectURL(carUrl);
  }
}

export function scheduleStory() {
  // Drop the old image at once, so a fast tap never shares a card that no longer matches the list.
  storyFile = null;
  if (!storyVisible) return;
  clearTimeout(storyTimer);
  const run = ++storyRun;
  storyTimer = setTimeout(async () => {
    try {
      const blob = await renderStory();
      if (run !== storyRun) return;
      storyFile = new File([blob], 'my-911-icons-of-porsche.png', { type: 'image/png' });
      const previous = storyUrl;
      storyUrl = URL.createObjectURL(blob);
      storyImage.src = storyUrl;
      if (!storyImage.isConnected) storyFigure.prepend(storyImage);
      saveStoryLink.href = storyUrl;
      if (previous) setTimeout(() => URL.revokeObjectURL(previous), 1000);
    } catch {
      if (run !== storyRun) return;
      storyFile = null;
      shareStatus.textContent = 'The story image could not be made in this browser.';
    }
  }, 300);
}

const canShareFiles = file => Boolean(navigator.canShare && file && navigator.canShare({ files: [file] }));

shareStoryButton.addEventListener('click', () => {
  // share() runs first in the handler, with the file made in advance, so the tap still counts as a user gesture.
  if (canShareFiles(storyFile)) {
    navigator.share({ files: [storyFile], title: 'My 911 for Icons of Porsche' }).catch(() => {});
    return;
  }
  saveStoryLink.hidden = !storyUrl;
  storyHint.hidden = false;
  shareStatus.textContent = storyUrl ? 'Sharing is not available here. Save the image instead.' : 'The image is still being made. Try again in a moment.';
});

const nameClear = document.querySelector('#name-clear');
const syncClear = () => { nameClear.hidden = !nameInput.value; };
nameInput.value = state.builderName;
syncClear();
nameClear.addEventListener('click', () => {
  nameInput.value = '';
  nameInput.dispatchEvent(new Event('input'));
  nameInput.focus();
});
nameInput.addEventListener('input', () => {
  syncClear();
  state.builderName = cleanName(nameInput.value);
  saveState();
  scheduleStory();
});

if ('IntersectionObserver' in window) {
  // Render only while the preview is near the screen, so ticks elsewhere do not re-encode the PNG.
  new IntersectionObserver(entries => {
    storyVisible = entries.some(entry => entry.isIntersecting);
    if (storyVisible) scheduleStory();
  }, { rootMargin: '200px' }).observe(storyFigure);
} else {
  storyVisible = true;
}
