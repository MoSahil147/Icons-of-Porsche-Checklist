import { PAINTS, reducedMotion, saveState, state } from './state.js?v=20';
import { scheduleStory } from './story.js?v=20';

// Rows and the parts fixed to them (.hd) share a row index (--i), so they lift together.
const heroLifts = [...document.querySelectorAll('.hero-car .hr, .hero-car .hd')];
const heroBody = document.querySelector('.hero-car .hc-body');
const heroWheels = [...document.querySelectorAll('.hero-car .hc-wheel')];
const SWAY = 36; // SVG units, which are mm on the real car: under 1% of its length
const paintedCars = [...document.querySelectorAll('.hero-car, .build-model')];
const heroDesc = document.querySelector('#hc-d');
const heroDescText = heroDesc?.textContent || '';
const paintInputs = [...document.querySelectorAll('input[name="paint"]')];
const paintNames = [...document.querySelectorAll('#paint-name, #paint-summary-name')];
let rowLifts = [];

// The variable is set on the two cars only, so a repaint restyles those subtrees and not the page (see styles.css).
export function applyPaint(animate = false) {
  const [id, name] = PAINTS[state.paintIndex];
  for (const car of paintedCars) car.style.setProperty('--car-paint', `var(--paint-${id})`);
  paintInputs.forEach(input => { input.checked = Number(input.value) === state.paintIndex; });
  paintNames.forEach(el => { el.textContent = name; });
  if (heroDesc) heroDesc.textContent = heroDescText.replace('A red 911', `A ${name} 911`);
  if (animate) liftRows();
}

// Each plate row lifts and settles as its colour changes, from the base up. A new tap cancels the old lift;
// the colour transitions retarget on their own.
function liftRows() {
  if (reducedMotion.matches) return;
  rowLifts.forEach(lift => lift.cancel());
  const lift = [
    { transform: 'none', easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
    { transform: 'translateY(-36px)', offset: 0.35, easing: 'cubic-bezier(0.77, 0, 0.175, 1)' },
    { transform: 'none' }
  ];
  rowLifts = heroLifts.map(part => part.animate(lift, { duration: 300, delay: Number(part.style.getPropertyValue('--i')) * 16 }));
  // One animation each, never nested: the body rocks forward and back while it dips and settles on its springs.
  // The wheels move with the rock and turn by distance / radius, so they roll and never slide.
  const keys = [[0, 0, 0], [0.28, SWAY, 14], [0.62, -SWAY * 0.4, -6], [1, 0, 0]];
  const timing = { duration: 600, easing: 'cubic-bezier(0.37, 0, 0.63, 1)' };
  rowLifts.push(heroBody.animate(keys.map(([offset, x, y]) => ({ offset, transform: `translate(${x}px, ${y}px)` })), timing));
  for (const wheel of heroWheels) {
    const radius = Number(wheel.dataset.r);
    rowLifts.push(wheel.animate(keys.map(([offset, x]) => ({ offset, transform: `translateX(${x}px) rotate(${(x / radius) * 180 / Math.PI}deg)` })), timing));
  }
}

paintInputs.forEach(input => input.addEventListener('change', () => {
  state.paintIndex = Number(input.value);
  saveState();
  applyPaint(true);
  scheduleStory();
}));

// Tooltip: mouse or pen hover, long press on touch, keyboard focus, and a short note after a tap.
const paintTip = document.querySelector('#paint-tip');
const paintSwatches = [...document.querySelectorAll('.swatch')];
let tipTimer = 0;
let tipHideTimer = 0;
let tipOpen = false;
let pressTimer = 0;
let longPressed = null;
let lastPointer = '';

function showTip(swatch, delay = 0) {
  clearTimeout(tipTimer);
  clearTimeout(tipHideTimer);
  const open = () => {
    const bold = document.createElement('b');
    bold.textContent = swatch.querySelector('.visually-hidden').textContent;
    paintTip.replaceChildren(bold, swatch.dataset.detail);
    // After the first tooltip, the next one opens at once (no delay, no animation).
    paintTip.classList.toggle('is-instant', tipOpen);
    paintTip.hidden = false;
    const row = paintTip.parentElement.getBoundingClientRect();
    const box = swatch.getBoundingClientRect();
    const width = paintTip.offsetWidth;
    const left = Math.min(Math.max(0, box.left - row.left + box.width / 2 - width / 2), row.width - width);
    paintTip.style.left = `${left}px`;
    paintTip.style.bottom = `${row.bottom - box.top + 8}px`;
    paintTip.style.setProperty('--tip-origin', `${box.left - row.left + box.width / 2 - left}px`);
    if (!tipOpen) { paintTip.classList.add('is-hidden'); void paintTip.offsetWidth; }
    paintTip.classList.remove('is-hidden');
    swatch.querySelector('input').setAttribute('aria-describedby', 'paint-tip');
    tipOpen = true;
  };
  // Only the first hover waits. Taps, focus and moves between swatches open at once.
  if (delay && !tipOpen) tipTimer = setTimeout(open, delay);
  else open();
}

function hideTip(after = 0) {
  clearTimeout(tipTimer);
  clearTimeout(tipHideTimer);
  tipHideTimer = setTimeout(() => {
    paintTip.classList.add('is-hidden');
    paintSwatches.forEach(swatch => swatch.querySelector('input').removeAttribute('aria-describedby'));
    tipOpen = false;
    setTimeout(() => { if (!tipOpen) paintTip.hidden = true; }, 150);
  }, after);
}

paintSwatches.forEach(swatch => {
  swatch.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') showTip(swatch, 300); });
  swatch.addEventListener('pointerleave', event => { if (event.pointerType !== 'touch') hideTip(80); });
  swatch.addEventListener('pointerdown', event => {
    lastPointer = event.pointerType;
    if (event.pointerType !== 'touch') return;
    longPressed = null;
    pressTimer = setTimeout(() => { showTip(swatch); longPressed = swatch; }, 450);
  });
  for (const type of ['pointerup', 'pointercancel', 'pointermove']) {
    swatch.addEventListener(type, event => {
      if (event.pointerType !== 'touch') return;
      if (type === 'pointermove' && Math.hypot(event.movementX, event.movementY) < 4) return;
      clearTimeout(pressTimer);
    });
  }
  swatch.addEventListener('click', event => {
    // A long press only shows the details. The tap that ends it must not change the paint.
    if (longPressed === swatch) {
      event.preventDefault();
      longPressed = null;
      hideTip(1500);
      return;
    }
    // On touch there is no hover, so a tap shows the details of the paint for a moment.
    if (lastPointer === 'touch') { showTip(swatch); hideTip(2500); }
  });
  const input = swatch.querySelector('input');
  input.addEventListener('focus', () => { if (input.matches(':focus-visible')) showTip(swatch); });
  input.addEventListener('blur', () => hideTip());
});
document.addEventListener('keydown', event => { if (event.key === 'Escape' && tipOpen) hideTip(); });
// A scroll closes a hover tooltip, but not one that keyboard focus opened (focus itself can scroll the page).
window.addEventListener('scroll', () => { if (tipOpen && !paintTip.parentElement.contains(document.activeElement)) hideTip(); }, { passive: true });
