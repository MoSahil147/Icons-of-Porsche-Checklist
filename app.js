document.documentElement.classList.add('js'); // also set in <head>, before first paint
const STORAGE_KEY = 'brick-by-brick-iop26-v1';
const dayButtons = [...document.querySelectorAll('.day-button')];
const categoryButtons = [...document.querySelectorAll('.category-button')];
const checkboxes = [...document.querySelectorAll('.check-row input[type="checkbox"]')];
const checklistLists = [...document.querySelectorAll('.check-list')];
const checklistGrid = document.querySelector('.checklist-grid');
const progressLabel = document.querySelector('#progress-label');
const progressMeter = document.querySelector('#progress-meter');
const resetButton = document.querySelector('#reset-button');
const clearAllButton = document.querySelector('#clear-all-button');
const storageStatus = document.querySelector('#storage-status');
const confirmDialog = document.querySelector('#confirm-dialog');
const dialogCopy = document.querySelector('#dialog-copy');
const dialogConfirm = document.querySelector('#dialog-confirm');
const dialogCancel = document.querySelector('#dialog-cancel');
const engineToggle = document.querySelector('#engine-toggle');
const buildModel = document.querySelector('.build-model');
const modelParts = buildModel ? [...buildModel.querySelectorAll('.pm-solid .pm-part')] : [];
const makeItYours = document.querySelector('#make-it-yours');
let wasComplete = null;
const itemIds = new Set(checkboxes.map(input => input.dataset.item));
const dayNames = { sat: 'Saturday', sun: 'Sunday' };
const PAINTS = [
  ['guards-red', 'Guards Red'], ['racing-yellow', 'Racing Yellow'], ['irish-green', 'Irish Green'], ['miami-blue', 'Miami Blue'],
  ['lava-orange', 'Lava Orange'], ['chalk', 'Chalk'], ['carrara-white', 'Carrara White Metallic'], ['carmine-red', 'Carmine Red']
];
let paintIndex = 0;
let builderName = '';
let storageAvailable = true;
let offlineReady = false;
let activeDay = 'sat';
let activeCategory = 'pack';
let progress = emptyProgress();
let pendingResetDays = [];

function emptyProgress() {
  return { sat: {}, sun: {} };
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function cleanDayProgress(value) {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([item, checked]) => itemIds.has(item) && checked === true)
  );
}

function readSavedState() {
  let rawState;
  try {
    rawState = localStorage.getItem(STORAGE_KEY);
  } catch {
    storageAvailable = false;
    return;
  }

  if (!rawState) return;

  try {
    const saved = JSON.parse(rawState);
    if (!isRecord(saved)) return;

    // Retain the original storage key and per-day fields so existing ticks survive this redesign.
    progress = { sat: cleanDayProgress(saved.sat), sun: cleanDayProgress(saved.sun) };
    if (saved.activeDay === 'sat' || saved.activeDay === 'sun' || saved.activeDay === 'both') {
      activeDay = saved.activeDay;
    }
    if (saved.activeCategory === 'pack' || saved.activeCategory === 'collect') {
      activeCategory = saved.activeCategory;
    }
    if (Number.isInteger(saved.paint) && saved.paint >= 0 && saved.paint < PAINTS.length) paintIndex = saved.paint;
    if (typeof saved.name === 'string') builderName = cleanName(saved.name);
  } catch {
    progress = emptyProgress();
  }
}

function updateStorageStatus() {
  storageStatus.textContent = storageAvailable
    ? `Your progress stays on this device and comes back after a refresh. No account needed.${offlineReady ? ' This page also opens with no signal now.' : ''}`
    : 'Browser storage is unavailable. Your ticks stay until you close or refresh this page.';
}

function saveState() {
  if (storageAvailable) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...progress,
        activeDay,
        activeCategory,
        paint: paintIndex,
        name: builderName
      }));
    } catch {
      storageAvailable = false;
    }
  }
  updateStorageStatus();
}

function selectedDays() {
  return activeDay === 'both' ? ['sat', 'sun'] : [activeDay];
}

function addDayControls(input) {
  const listItem = input.closest('li');
  const itemName = input.closest('.check-row').querySelector('.item-copy b').textContent.trim();
  const controls = document.createElement('span');
  controls.className = 'day-item-controls';
  controls.id = `day-controls-${input.dataset.item}`;
  controls.hidden = true;
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', `Choose days for ${itemName}`);

  for (const [day, shortName] of [['sat', 'Sat'], ['sun', 'Sun']]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'day-item-button';
    button.dataset.day = day;
    button.textContent = shortName;
    // The name starts with the visible text (WCAG 2.5.3), so voice control can say "Sat".
    button.setAttribute('aria-label', `${shortName}, ${itemName}`);
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => {
      progress[day][input.dataset.item] = !progress[day][input.dataset.item];
      flightSource = progress[day][input.dataset.item] ? button : null;
      saveState();
      renderChecklist();
    });
    controls.append(button);
  }

  listItem.append(controls);
}

checkboxes.forEach(addDayControls);

function renderDayButtons() {
  dayButtons.forEach(button => {
    const active = button.dataset.day === activeDay;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function renderCategoryButtons() {
  categoryButtons.forEach(button => {
    const active = button.dataset.category === activeCategory;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function renderChecklist() {
  const bothDays = activeDay === 'both';
  checklistLists.forEach(list => list.classList.toggle('is-both', bothDays));

  checkboxes.forEach(input => {
    const controls = input.closest('li').querySelector('.day-item-controls');
    controls.hidden = !bothDays;
    input.disabled = bothDays;
    input.checked = bothDays
      ? Boolean(progress.sat[input.dataset.item] && progress.sun[input.dataset.item])
      : Boolean(progress[activeDay][input.dataset.item]);

    controls.querySelectorAll('.day-item-button').forEach(button => {
      const checked = Boolean(progress[button.dataset.day][input.dataset.item]);
      button.setAttribute('aria-pressed', String(checked));
    });
  });

  resetButton.textContent = activeDay === 'both' ? 'Reset both days' : 'Reset this day';
  renderProgress();
}

// The tabs only show on narrow screens; CSS decides that width (53.75rem), so it follows the text size too.
function renderCategoryView() {
  checklistGrid.classList.toggle('show-pack', activeCategory === 'pack');
  checklistGrid.classList.toggle('show-collect', activeCategory === 'collect');
}

function renderProgress() {
  const days = selectedDays();
  const itemList = [...itemIds];
  const total = days.length * itemList.length;
  const done = days.reduce(
    (count, day) => count + itemList.filter(item => progress[day][item]).length,
    0
  );

  const complete = done === total;
  const suffix = complete ? '. The 911 is complete.' : activeDay === 'both' ? ' ready across both days' : ' ready';
  progressLabel.textContent = `${done} / ${total}${suffix}`;
  makeItYours.hidden = done === 0;
  // The last tick of a day earns one short pop. Loads and day switches do not.
  if (complete && wasComplete === false && buildModel && !buildModel.classList.contains('no-anim')) {
    buildModel.classList.remove('is-done');
    void buildModel.getBoundingClientRect();
    buildModel.classList.add('is-done');
  }
  wasComplete = complete;
  scheduleStory();
  progressMeter.max = total;
  progressMeter.value = done;
  progressMeter.setAttribute('aria-valuetext', `${done} of ${total} items ready`);
  renderModel(done, total);
}

// Each tick adds one part to the model: the wheels first, then each row from the bottom up, then the glass.
function renderModel(done, total) {
  const built = total ? Math.round(done / total * modelParts.length) : 0;
  modelParts.forEach((part, index) => part.classList.toggle('is-built', index < built));
  if (built < lastBuilt || buildModel?.classList.contains('no-anim')) cancelFlights();
  // Only plate rows fly: they are bricks. Wheels and glass just fade in.
  else if (flightSource && built > lastBuilt) modelParts.slice(lastBuilt, built).filter(part => part.querySelector('.pm-plate')).forEach(part => flyPart(part, flightSource));
  flightSource = null;
  lastBuilt = built;
}

// Part flight: a tick sends one plate from the tapped box to its slot in the model.
// The count updates at once; only the part waits for the landing. Untick or a day switch cancels it.
let flightSource = null;
let lastBuilt = 0;
const flights = new Set();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const inView = rect => rect.width > 0 && rect.bottom > 0 && rect.top < innerHeight;

function cancelFlights() {
  for (const flight of flights) flight.cancel();
  flights.clear();
}

function flyPart(part, source) {
  const from = source.getBoundingClientRect();
  const to = part.getBoundingClientRect();
  if (reducedMotion.matches || !inView(from) || !inView(to)) return; // the 150 ms fade covers it
  part.classList.add('is-landing');
  const flyer = document.createElement('span');
  flyer.className = 'flyer';
  flyer.style.setProperty('--paint', paintHex());
  Object.assign(flyer.style, { left: `${to.left}px`, top: `${to.top}px`, width: `${to.width}px`, height: `${to.height}px` });
  document.body.append(flyer);
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  const animation = flyer.animate(
    [{ transform: `translate(${dx}px, ${dy}px) scale(${from.width / to.width}, ${from.height / to.height})` }, { transform: 'none' }],
    { duration: 340, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' }
  );
  const flight = { cancel() { animation.cancel(); flyer.remove(); part.classList.remove('is-landing'); } };
  flights.add(flight);
  animation.finished.then(() => {
    flights.delete(flight);
    flyer.remove();
    part.classList.remove('is-landing');
    part.classList.add('is-seating');
    setTimeout(() => part.classList.remove('is-seating'), 120);
  }, () => {});
}

// Day switches and page load show the new state at once. Only a tick animates.
function withoutModelMotion(render) {
  if (!buildModel) return render();
  buildModel.classList.add('no-anim');
  render();
  requestAnimationFrame(() => requestAnimationFrame(() => buildModel.classList.remove('no-anim')));
}

function openResetDialog(days) {
  pendingResetDays = days;
  const scope = days.length === 2 ? 'Saturday and Sunday' : dayNames[days[0]];
  dialogCopy.textContent = `Your saved ticks for ${scope} will be cleared.`;
  dialogConfirm.textContent = days.length === 2 ? 'Reset both days' : 'Reset this day';
  confirmDialog.showModal();
}

function closeResetDialog() {
  pendingResetDays = [];
  confirmDialog.close();
}

function applyReset() {
  pendingResetDays.forEach(day => { progress[day] = {}; });
  saveState();
  renderChecklist();
  closeResetDialog();
}

dayButtons.forEach(button => button.addEventListener('click', () => {
  activeDay = button.dataset.day;
  renderDayButtons();
  withoutModelMotion(renderChecklist);
  saveState();
}));

categoryButtons.forEach(button => button.addEventListener('click', () => {
  activeCategory = button.dataset.category;
  renderCategoryButtons();
  renderCategoryView();
  saveState();
}));

checkboxes.forEach(input => input.addEventListener('change', () => {
  if (activeDay === 'both') return;
  progress[activeDay][input.dataset.item] = input.checked;
  flightSource = input.checked ? input.nextElementSibling : null;
  saveState();
  renderChecklist();
}));

resetButton.addEventListener('click', () => openResetDialog(selectedDays()));
clearAllButton.addEventListener('click', () => openResetDialog(['sat', 'sun']));
dialogConfirm.addEventListener('click', applyReset);
dialogCancel.addEventListener('click', closeResetDialog);
confirmDialog.addEventListener('click', event => {
  if (event.target === confirmDialog) closeResetDialog();
});

// Flat-six. One crank angle (0 to 720 degrees, one full four-stroke cycle) drives every part.
// Firing order 1-6-2-4-3-5: each cylinder fires 120 degrees after the one before.
// Opposed pairs 1/4, 2/5 and 3/6 reach their outer dead centre together.
const ENGINE = { crank: 38, rod: 128, axis: 250, headInner: 206, crown: 30, rpm: 30, glowDegrees: 100 };
const FIRE_AT = { 1: 0, 6: 120, 2: 240, 4: 360, 3: 480, 5: 600 };
const engineArt = document.querySelector('.engine-art');
const crankInput = document.querySelector('#crank-angle');
const crankReadout = document.querySelector('#crank-readout');
const firingItems = [...document.querySelectorAll('.firing-order li')];
const cylinders = [...document.querySelectorAll('.engine-art .cyl')].map(group => ({
  group,
  number: Number(group.dataset.cyl),
  bank: Number(group.dataset.bank),
  piston: group.querySelector('.e-piston'),
  rod: group.querySelector('.e-rod'),
  pin: group.querySelector('.e-pin'),
  crankThrow: group.querySelector('.e-throw'),
  glow: group.querySelector('.e-glow')
}));
let crankAngle = Number(crankInput.value);
let engineRunning = false;
let engineVisible = true;
let lastFrameTime = 0;
let engineFrame = 0;

// Distance from the crank axis to the piston pin, for a crank angle measured from top dead centre.
function pistonDistance(degrees) {
  const a = degrees * Math.PI / 180;
  return ENGINE.crank * Math.cos(a) + Math.sqrt(ENGINE.rod ** 2 - (ENGINE.crank * Math.sin(a)) ** 2);
}

function phaseOf(number) {
  return ((crankAngle - FIRE_AT[number]) % 720 + 720) % 720;
}

function drawEngine() {
  const { axis, crank, crown, headInner, glowDegrees } = ENGINE;
  let lastFired = 1;
  for (const cylinder of cylinders) {
    const phase = phaseOf(cylinder.number);
    const distance = pistonDistance(phase);
    const pinY = axis - cylinder.bank * distance;
    const crankPinY = axis - cylinder.bank * crank * Math.cos(phase * Math.PI / 180);
    cylinder.piston.setAttribute('transform', `translate(0 ${pinY.toFixed(1)})`);
    cylinder.rod.setAttribute('y', Math.min(pinY, crankPinY).toFixed(1));
    cylinder.rod.setAttribute('height', Math.abs(pinY - crankPinY).toFixed(1));
    cylinder.pin.setAttribute('cy', crankPinY.toFixed(1));
    cylinder.crankThrow.setAttribute('y', Math.min(axis, crankPinY).toFixed(1));
    cylinder.crankThrow.setAttribute('height', Math.abs(crankPinY - axis).toFixed(1));
    // The glow fills the space between the piston crown and the head, then fades as the piston moves in.
    const crownDistance = distance + crown;
    cylinder.glow.setAttribute('y', (cylinder.bank > 0 ? axis - headInner : axis + crownDistance).toFixed(1));
    cylinder.glow.setAttribute('height', Math.max(0, headInner - crownDistance).toFixed(1));
    cylinder.glow.setAttribute('opacity', phase < glowDegrees ? ((1 - phase / glowDegrees) ** 0.7).toFixed(2) : '0');
    if (phase < phaseOf(lastFired)) lastFired = cylinder.number;
  }
  const glowing = phaseOf(lastFired) < glowDegrees;
  cylinders.forEach(cylinder => cylinder.group.classList.toggle('is-firing', glowing && cylinder.number === lastFired));
  firingItems.forEach(item => item.classList.toggle('is-firing', Number(item.dataset.cyl) === lastFired));
  return lastFired;
}

function showCrankAngle(lastFired) {
  const degrees = Math.floor(crankAngle);
  crankInput.value = degrees;
  crankReadout.textContent = `${degrees} degrees`;
  crankInput.setAttribute('aria-valuetext', `${degrees} degrees. Cylinder ${lastFired} fired last.`);
}

function engineTick(now) {
  engineFrame = 0;
  if (!engineRunning || !engineVisible) return;
  // Time-based, so low-power devices that drop frames keep the right speed.
  if (lastFrameTime) crankAngle = (crankAngle + (now - lastFrameTime) * ENGINE.rpm * 360 / 60000) % 720;
  lastFrameTime = now;
  showCrankAngle(drawEngine());
  engineFrame = requestAnimationFrame(engineTick);
}

function setEngineRunning(next) {
  engineRunning = next;
  lastFrameTime = 0;
  engineToggle.setAttribute('aria-pressed', String(next));
  engineToggle.textContent = next ? 'Pause the engine' : 'Run the engine';
  if (next && !engineFrame) engineFrame = requestAnimationFrame(engineTick);
}

engineToggle.addEventListener('click', () => setEngineRunning(!engineRunning));
crankInput.addEventListener('input', () => {
  setEngineRunning(false);
  crankAngle = Number(crankInput.value);
  showCrankAngle(drawEngine());
});
if ('IntersectionObserver' in window) {
  new IntersectionObserver(([entry]) => {
    engineVisible = entry.isIntersecting;
    lastFrameTime = 0;
    if (engineVisible && engineRunning && !engineFrame) engineFrame = requestAnimationFrame(engineTick);
  }).observe(engineArt);
}

// Your 911: paint, name, story image and the plan link.
const root = document.documentElement;
// Rows and the parts fixed to them (.hd) share a row index (--i), so they lift together.
const heroLifts = [...document.querySelectorAll('.hero-car .hr, .hero-car .hd')];
const heroBody = document.querySelector('.hero-car .hc-body');
const heroWheels = [...document.querySelectorAll('.hero-car .hc-wheel')];
const SWAY = 36; // SVG units, which are mm on the real car: under 1% of its length
const paintedCars = [...document.querySelectorAll('.hero-car, .build-model')];
const heroDesc = document.querySelector('#hc-d');
const heroDescText = heroDesc?.textContent || '';
let rowLifts = [];
const paintInputs = [...document.querySelectorAll('input[name="paint"]')];
const paintNames = [...document.querySelectorAll('#paint-name, #paint-summary-name')];
const nameInput = document.querySelector('#builder-name');
const storyFigure = document.querySelector('#story-figure');
const storyHint = document.querySelector('#story-hint');
const shareStoryButton = document.querySelector('#share-story');
const saveStoryLink = document.querySelector('#save-story');
const copyPlanButton = document.querySelector('#copy-plan');
const shareStatus = document.querySelector('#share-status');
const planBanner = document.querySelector('#plan-banner');
const planBannerText = document.querySelector('#plan-banner-text');
const planMerge = document.querySelector('#plan-merge');
const planDismiss = document.querySelector('#plan-dismiss');
const planUndo = document.querySelector('#plan-undo');
const storyImage = new Image();
storyImage.width = 1080;
storyImage.height = 1920;
storyImage.alt = 'Your story image: your 911 in the paint you chose, with your progress and the event details.';
let storyFile = null;
let storyUrl = '';
let heroSource = null;
let storyTimer = 0;
let storyVisible = false;
let copyTimer = 0;

function paintHex(index = paintIndex) {
  return getComputedStyle(root).getPropertyValue(`--paint-${PAINTS[index][0]}`).trim() || '#c8102e';
}

async function heroSVGText() {
  // A failed download is not kept, so the next tap tries again when the signal comes back.
  heroSource ??= fetch('sports-car.svg')
    .then(response => response.ok ? response.text() : Promise.reject(new Error(String(response.status))))
    .catch(error => { heroSource = null; throw error; });
  return heroSource;
}

// One variable paints the hero, the build model and the ghost tint. It is set on those two only (see styles.css).
function applyPaint(animate = false) {
  for (const car of paintedCars) car.style.setProperty('--car-paint', `var(--paint-${PAINTS[paintIndex][0]})`);
  paintInputs.forEach(input => { input.checked = Number(input.value) === paintIndex; });
  paintNames.forEach(name => { name.textContent = PAINTS[paintIndex][1]; });
  if (heroDesc) heroDesc.textContent = heroDescText.replace('A red 911', `A ${PAINTS[paintIndex][1]} 911`);
  if (animate) liftRows();
}

// Each plate row lifts and settles as its colour changes, from the base up: a staggered cascade.
// A new tap cancels the old lift; the colour transitions retarget on their own.
function liftRows() {
  if (reducedMotion.matches) return;
  rowLifts.forEach(lift => lift.cancel());
  const lift = [
    { transform: 'none', easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
    { transform: 'translateY(-36px)', offset: 0.35, easing: 'cubic-bezier(0.77, 0, 0.175, 1)' },
    { transform: 'none' }
  ];
  rowLifts = heroLifts.map(part => part.animate(lift, { duration: 300, delay: Number(part.style.getPropertyValue('--i')) * 16 }));
  // One animation each, never nested: the body rocks forward and back (weight shift) while it dips and settles
  // on its springs. The wheels move with the rock and turn by distance / radius, so they roll and never slide.
  const keys = [[0, 0, 0], [0.28, SWAY, 14], [0.62, -SWAY * 0.4, -6], [1, 0, 0]];
  const timing = { duration: 600, easing: 'cubic-bezier(0.37, 0, 0.63, 1)' };
  rowLifts.push(heroBody.animate(keys.map(([offset, x, y]) => ({ offset, transform: `translate(${x}px, ${y}px)` })), timing));
  for (const wheel of heroWheels) {
    const radius = Number(wheel.dataset.r);
    rowLifts.push(wheel.animate(keys.map(([offset, x]) => ({ offset, transform: `translateX(${x}px) rotate(${(x / radius) * 180 / Math.PI}deg)` })), timing));
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

// The build model with plain fill attributes, because CSS classes do not apply to an SVG drawn as an image.
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

function progressNumbers() {
  const days = selectedDays();
  const total = days.length * itemIds.size;
  const done = days.reduce((count, day) => count + [...itemIds].filter(item => progress[day][item]).length, 0);
  return { done, total };
}

function fitText(context, text, font, maxWidth, size) {
  let next = size;
  do {
    context.font = `${font} ${next}px ${font.startsWith('800') ? '"League Spartan"' : '"Onest"'}, system-ui, sans-serif`;
    next -= 4;
  } while (context.measureText(text).width > maxWidth && next > 24);
}

// One page of the visitor's own building instructions, 1080 x 1920.
// Key content stays between y 270 and y 1536 so Instagram and WhatsApp controls do not cover it.
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
  if ('content' in HTMLCanvasElement.prototype) {
    try { return await renderStoryHTML(svg, done, total, complete, hex); } catch { /* fall back to the drawn version */ }
  }
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const car = await loadImage(url).finally(() => setTimeout(() => URL.revokeObjectURL(url), 1000));
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const c = canvas.getContext('2d');
  const ink = '#162232', muted = '#4b5a6c', left = 90, width = 900;
  c.fillStyle = '#dbebf5';
  c.fillRect(0, 0, 1080, 1920);
  c.fillStyle = ink;
  c.textBaseline = 'alphabetic';
  // Layout bands, all inside y 270 to 1536 (Instagram covers the top and bottom).
  fitText(c, `${done} / ${total}`, '800', width, 230);
  c.fillText(`${done} / ${total}`, left, 470);
  const dayText = activeDay === 'both' ? 'Saturday and Sunday' : dayNames[activeDay];
  const countLine = complete ? `items ready. ${dayText}'s 911 is complete.` : `items ready for ${dayText}.`;
  fitText(c, countLine, '600', width, 52);
  c.fillText(countLine, left, 545);
  const carWidth = 1000, carHeight = carWidth * car.naturalHeight / car.naturalWidth;
  c.drawImage(car, 40, 740 - carHeight / 2, carWidth, carHeight);
  // The parts call-out: the paint as a 1x2 plate, like the box in a building step.
  const boxY = 900;
  c.lineWidth = 6;
  c.strokeStyle = ink;
  c.beginPath();
  c.roundRect(left, boxY, width, 180, 18);
  c.stroke();
  c.fillStyle = hex;
  c.strokeStyle = shade(hex, -0.45);
  c.lineWidth = 4;
  c.beginPath(); c.roundRect(left + 40, boxY + 78, 150, 70, 8); c.fill(); c.stroke();
  for (const x of [left + 77, left + 152]) { c.beginPath(); c.roundRect(x - 26, boxY + 52, 52, 28, 6); c.fill(); c.stroke(); }
  c.fillStyle = ink;
  fitText(c, `1x ${PAINTS[paintIndex][1]}`, '800', width - 260, 60);
  c.fillText(`1x ${PAINTS[paintIndex][1]}`, left + 230, boxY + 95);
  c.fillStyle = muted;
  fitText(c, '911 Carrera (992), 1:12, brick-built', '400', width - 260, 34);
  c.fillText('911 Carrera (992), 1:12, brick-built', left + 230, boxY + 145);
  if (builderName) {
    c.fillStyle = ink;
    fitText(c, `Built by ${builderName}`, '800', width, 64);
    c.fillText(`Built by ${builderName}`, left, 1160);
  }
  // Link slot: room for the Instagram link sticker. Without a sticker, the address still reads as the link.
  const slotY = 1200;
  c.setLineDash([18, 12]);
  c.lineWidth = 4;
  c.strokeStyle = muted;
  c.beginPath();
  c.roundRect(left, slotY, 720, 130, 65);
  c.stroke();
  c.setLineDash([]);
  c.fillStyle = ink;
  const address = (location.host + location.pathname).replace(/index\.html$/, '').replace(/\/$/, '');
  fitText(c, address, '600', 620, 34);
  c.fillText(address, left + 50, slotY + 77);
  c.fillStyle = ink;
  fitText(c, 'Icons of Porsche, Dubai, 21 to 22 November 2026', '600', width, 38);
  c.fillText('Icons of Porsche, Dubai, 21 to 22 November 2026', left, 1415);
  c.fillStyle = muted;
  fitText(c, 'A fan-made guide, not an official Porsche page.', '400', width, 30);
  c.fillText('A fan-made guide, not an official Porsche page.', left, 1470);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('The story image could not be exported.');
  return blob;
}

// The same card laid out in HTML and CSS, drawn with drawElementImage (HTML-in-Canvas, Chrome and Edge 157+).
// Real text layout: wrapping, any script and the page fonts. Times out to the drawn fallback.
async function renderStoryHTML(svg, done, total, complete, hex) {
  const dayText = activeDay === 'both' ? 'Saturday and Sunday' : dayNames[activeDay];
  const carUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const canvas = document.createElement('canvas');
  canvas.setAttribute('content', 'drawable');
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
  callout.append(line('span', 'story-plate', ''), line('b', '', `1x ${PAINTS[paintIndex][1]}`), line('small', '', '911 Carrera (992), 1:12, brick-built'));
  const address = (location.host + location.pathname).replace(/index\.html$/, '').replace(/\/$/, '');
  card.append(
    line('div', 'story-count', `${done} / ${total}`),
    line('p', 'story-line', complete ? `items ready. ${dayText}'s 911 is complete.` : `items ready for ${dayText}.`),
    img, callout,
    ...(builderName ? [line('p', 'story-name', `Built by ${builderName}`)] : []),
    line('p', 'story-link', address),
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
        const context = canvas.getContext('2d');
        context.reset();
        context.drawElementImage(card, 0, 0);
        resolve();
      };
      canvas.requestPaint?.();
    });
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('no blob');
    return blob;
  } finally {
    canvas.remove();
    URL.revokeObjectURL(carUrl);
  }
}

let storyRun = 0;
function scheduleStory() {
  // Drop the old image at once, so a fast tap never shares a card that no longer matches the list.
  storyFile = null;
  if (!storyVisible) return;
  clearTimeout(storyTimer);
  const run = ++storyRun;
  storyTimer = setTimeout(async () => {
    try {
      const blob = await renderStory();
      if (run !== storyRun) return; // a newer render is on its way
      storyFile = new File([blob], 'my-911-icons-of-porsche.png', { type: 'image/png' });
      const previous = storyUrl;
      storyUrl = URL.createObjectURL(blob);
      storyImage.src = storyUrl;
      if (!storyImage.isConnected) storyFigure.prepend(storyImage);
      saveStoryLink.href = storyUrl;
      if (previous) setTimeout(() => URL.revokeObjectURL(previous), 1000);
    } catch {
      if (run !== storyRun) return; // a newer render is on its way
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

function planUrl() {
  const url = new URL(location.pathname, location.origin);
  const masks = selectedDays().map(day => encodeMask(progress[day]));
  url.searchParams.set('plan', ['1', activeDay, ...masks].join('.'));
  if (builderName) url.searchParams.set('by', builderName);
  return url.href;
}

function clearPlanParams() {
  history.replaceState(history.state, '', location.pathname + location.hash);
}

function showPlanBanner(plan) {
  const count = Object.values(plan.days).reduce((sum, ids) => sum + ids.length, 0);
  const total = Object.keys(plan.days).length * itemIds.size;
  const dayText = plan.day === 'both' ? 'Saturday and Sunday' : dayNames[plan.day];
  // The name sits in <bdi>, so an Arabic or Hebrew name cannot reorder the sentence around it.
  const who = document.createElement('bdi');
  who.textContent = plan.by || 'A friend';
  planBannerText.replaceChildren(who, ` ticked ${count} of ${total} items on ${dayText}.`);
  planBanner.hidden = false;
  planMerge.hidden = count === 0;
  let added = [];
  planMerge.onclick = () => {
    added = [];
    for (const [day, ids] of Object.entries(plan.days)) {
      for (const id of ids) if (itemIds.has(id) && !progress[day][id]) { progress[day][id] = true; added.push([day, id]); }
    }
    activeDay = plan.day;
    saveState();
    renderDayButtons();
    renderChecklist();
    planBannerText.textContent = added.length ? `Ticked ${added.length} more ${added.length === 1 ? 'item' : 'items'} on your ${dayText} list. Nothing was unticked.` : `Your ${dayText} list already had every item.`;
    planMerge.hidden = true;
    planUndo.hidden = added.length === 0;
    clearPlanParams();
  };
  planUndo.onclick = () => {
    for (const [day, id] of added) delete progress[day][id];
    saveState();
    renderChecklist();
    planBannerText.textContent = 'Undone. Your list is as it was.';
    planUndo.hidden = true;
  };
  planDismiss.onclick = () => {
    planBanner.hidden = true;
    clearPlanParams();
  };
}

function showCopied() {
  copyPlanButton.classList.add('is-copied');
  shareStatus.textContent = 'Link copied.';
  clearTimeout(copyTimer);
  copyTimer = setTimeout(() => copyPlanButton.classList.remove('is-copied'), 2000);
}

copyPlanButton.addEventListener('click', () => {
  const url = planUrl();
  const dayText = activeDay === 'both' ? 'Saturday and Sunday' : dayNames[activeDay];
  const text = `${builderName ? `${builderName}'s` : 'My'} ${dayText} list for Icons of Porsche. Open it to add it to yours.`;
  if (navigator.share && matchMedia('(pointer: coarse)').matches) {
    navigator.share({ title: '911 Field Guide', text, url }).catch(() => {});
    return;
  }
  navigator.clipboard?.writeText(url).then(showCopied, () => { shareStatus.textContent = `Copy this link: ${url}`; })
    ?? (shareStatus.textContent = `Copy this link: ${url}`);
});

// Paint detail tooltip: mouse or pen hover, long press on touch, keyboard focus, and a short note after a tap.
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
    const name = swatch.querySelector('.visually-hidden').textContent;
    const bold = document.createElement('b');
    bold.textContent = name;
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
  // A long press only shows the details. The tap that ends it must not change the paint.
  swatch.addEventListener('click', event => {
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
// A scroll closes an open hover tooltip, but not one that keyboard focus opened (focus itself can scroll the page).
window.addEventListener('scroll', () => { if (tipOpen && !paintTip.parentElement.contains(document.activeElement)) hideTip(); }, { passive: true });

// Exhaust on the scroll rail: puffs only on a hard fling. CSS hides the rail on small screens and with reduced motion.
const scrollRail = document.getElementById('scroll-rail');
const FLING_SPEED = 6; // px per ms, sustained over FLING_SPAN; a normal wheel scroll peaks near 2.
const FLING_SPAN = 120; // ms
let railY = window.scrollY, railT = performance.now(), flingFrom = 0;
window.addEventListener('scroll', () => {
  const now = performance.now(), y = window.scrollY;
  const fast = now - railT < 100 && Math.abs(y - railY) / (now - railT) > FLING_SPEED;
  if (!fast) flingFrom = 0;
  else if (!flingFrom) flingFrom = now;
  else if (now - flingFrom >= FLING_SPAN && !scrollRail.classList.contains('is-fling') && scrollRail.checkVisibility()) scrollRail.classList.add('is-fling');
  railY = y; railT = now;
}, { passive: true });
scrollRail.addEventListener('animationend', event => { if (event.target.matches('.rail-puff:last-child')) scrollRail.classList.remove('is-fling'); });

paintInputs.forEach(input => input.addEventListener('change', () => {
  paintIndex = Number(input.value);
  saveState();
  applyPaint(true);
  scheduleStory();
}));

nameInput.value = builderName;
nameInput.addEventListener('input', () => {
  builderName = cleanName(nameInput.value);
  saveState();
  scheduleStory();
});

if ('IntersectionObserver' in window) {
  new IntersectionObserver(entries => {
    // Render only while the preview is near the screen; ticks elsewhere no longer re-encode the PNG.
    storyVisible = entries.some(entry => entry.isIntersecting);
    if (storyVisible) scheduleStory();
  }, { rootMargin: '200px' }).observe(storyFigure);
} else {
  storyVisible = true;
}

const sharedPlan = decodePlan(location.search);
if (sharedPlan) showPlanBanner(sharedPlan);
else if (location.search.includes('plan=')) clearPlanParams();

// Offline after one visit, where the browser allows a service worker (not in every in-app browser).
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js')
    .then(() => navigator.serviceWorker.ready)
    .then(() => { offlineReady = true; updateStorageStatus(); })
    .catch(() => {}));
}


readSavedState();
renderDayButtons();
renderCategoryButtons();
renderCategoryView();
withoutModelMotion(renderChecklist);
updateStorageStatus();
applyPaint();
showCrankAngle(drawEngine());
