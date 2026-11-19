document.documentElement.classList.add('js');
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
const itemIds = new Set(checkboxes.map(input => input.dataset.item));
const dayNames = { sat: 'Saturday', sun: 'Sunday' };
let storageAvailable = true;
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
  } catch {
    progress = emptyProgress();
  }
}

function updateStorageStatus() {
  storageStatus.textContent = storageAvailable
    ? 'Your progress stays on this device and comes back after a refresh. No account needed.'
    : 'Browser storage is unavailable. Your ticks stay until you close or refresh this page.';
}

function saveState() {
  if (storageAvailable) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...progress,
        activeDay,
        activeCategory
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
    button.setAttribute('aria-label', `${dayNames[day]}: ${itemName}`);
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => {
      progress[day][input.dataset.item] = !progress[day][input.dataset.item];
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

function renderCategoryView() {
  const mobile = window.matchMedia('(max-width: 860px)').matches;
  checklistGrid.classList.toggle('is-category-mobile', mobile);
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

  const suffix = done === total ? '. The 911 is complete.' : activeDay === 'both' ? ' ready across both days' : ' ready';
  progressLabel.textContent = `${done} / ${total}${suffix}`;
  progressMeter.max = total;
  progressMeter.value = done;
  progressMeter.setAttribute('aria-valuetext', `${done} of ${total} items ready`);
  renderModel(done, total);
}

// Each tick adds one part to the model: the wheels first, then each row from the bottom up, then the glass.
function renderModel(done, total) {
  const built = total ? Math.round(done / total * modelParts.length) : 0;
  modelParts.forEach((part, index) => part.classList.toggle('is-built', index < built));
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

window.addEventListener('resize', renderCategoryView);

readSavedState();
renderDayButtons();
renderCategoryButtons();
renderCategoryView();
withoutModelMotion(renderChecklist);
updateStorageStatus();
showCrankAngle(drawEngine());
