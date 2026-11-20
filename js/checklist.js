import { dayName, paintHex, progressNumbers, reducedMotion, saveState, selectedDays, state } from './state.js?v=21';
import { scheduleStory } from './story.js?v=21';

const dayButtons = [...document.querySelectorAll('.day-button')];
const categoryButtons = [...document.querySelectorAll('.category-button')];
const checkboxes = [...document.querySelectorAll('.check-row input[type="checkbox"]')];
const checklistLists = [...document.querySelectorAll('.check-list')];
const checklistGrid = document.querySelector('.checklist-grid');
const progressLabel = document.querySelector('#progress-label');
const progressMeter = document.querySelector('#progress-meter');
const resetButton = document.querySelector('#reset-button');
const clearAllButton = document.querySelector('#clear-all-button');
const confirmDialog = document.querySelector('#confirm-dialog');
const dialogCopy = document.querySelector('#dialog-copy');
const dialogConfirm = document.querySelector('#dialog-confirm');
const dialogCancel = document.querySelector('#dialog-cancel');
const buildModel = document.querySelector('.build-model');
const modelParts = buildModel ? [...buildModel.querySelectorAll('.pm-solid .pm-part')] : [];
const makeItYours = document.querySelector('#make-it-yours');
let wasComplete = null;
let pendingResetDays = [];
let flightSource = null;
let lastBuilt = 0;
const flights = new Set();
const inView = rect => rect.width > 0 && rect.bottom > 0 && rect.top < innerHeight;

function addDayControls(input) {
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
      const progress = state.progress[day];
      progress[input.dataset.item] = !progress[input.dataset.item];
      flightSource = progress[input.dataset.item] ? button : null;
      saveState();
      renderChecklist();
    });
    controls.append(button);
  }
  input.closest('li').append(controls);
}

export function renderDayButtons() {
  dayButtons.forEach(button => {
    const active = button.dataset.day === state.activeDay;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

export function renderCategories() {
  categoryButtons.forEach(button => {
    const active = button.dataset.category === state.activeCategory;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  // The tabs only show on narrow screens; CSS decides that width (53.75rem), so it follows the text size too.
  checklistGrid.classList.toggle('show-pack', state.activeCategory === 'pack');
  checklistGrid.classList.toggle('show-collect', state.activeCategory === 'collect');
}

export function renderChecklist() {
  const bothDays = state.activeDay === 'both';
  const { sat, sun } = state.progress;
  checklistLists.forEach(list => list.classList.toggle('is-both', bothDays));
  checkboxes.forEach(input => {
    const item = input.dataset.item;
    const controls = input.closest('li').querySelector('.day-item-controls');
    controls.hidden = !bothDays;
    input.disabled = bothDays;
    input.checked = bothDays ? Boolean(sat[item] && sun[item]) : Boolean(state.progress[state.activeDay][item]);
    controls.querySelectorAll('.day-item-button').forEach(button => button.setAttribute('aria-pressed', String(Boolean(state.progress[button.dataset.day][item]))));
  });
  resetButton.textContent = bothDays ? 'Reset both days' : 'Reset this day';
  renderProgress();
}

function renderProgress() {
  const { done, total } = progressNumbers();
  const complete = done === total;
  const suffix = complete ? '. The 911 is complete.' : state.activeDay === 'both' ? ' ready across both days' : ' ready';
  progressLabel.textContent = `${done} / ${total}${suffix}`;
  makeItYours.hidden = done === 0;
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

function renderModel(done, total) {
  const built = total ? Math.round(done / total * modelParts.length) : 0;
  modelParts.forEach((part, index) => part.classList.toggle('is-built', index < built));
  if (built < lastBuilt || buildModel?.classList.contains('no-anim')) cancelFlights();
  // Only plate rows fly: they are bricks. Wheels and glass just fade in.
  else if (flightSource && built > lastBuilt) modelParts.slice(lastBuilt, built).filter(part => part.querySelector('.pm-plate')).forEach(part => flyPart(part, flightSource));
  flightSource = null;
  lastBuilt = built;
}

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

export function withoutModelMotion(render) {
  if (!buildModel) return render();
  buildModel.classList.add('no-anim');
  render();
  requestAnimationFrame(() => requestAnimationFrame(() => buildModel.classList.remove('no-anim')));
}

function openResetDialog(days) {
  pendingResetDays = days;
  const scope = dayName(days.length === 2 ? 'both' : days[0]);
  dialogCopy.textContent = `Your saved ticks for ${scope} will be cleared.`;
  dialogConfirm.textContent = days.length === 2 ? 'Reset both days' : 'Reset this day';
  confirmDialog.showModal();
}

function closeResetDialog() {
  pendingResetDays = [];
  confirmDialog.close();
}

checkboxes.forEach(addDayControls);
dayButtons.forEach(button => button.addEventListener('click', () => {
  state.activeDay = button.dataset.day;
  renderDayButtons();
  withoutModelMotion(renderChecklist);
  saveState();
}));
categoryButtons.forEach(button => button.addEventListener('click', () => {
  state.activeCategory = button.dataset.category;
  renderCategories();
  saveState();
}));
checkboxes.forEach(input => input.addEventListener('change', () => {
  if (state.activeDay === 'both') return;
  state.progress[state.activeDay][input.dataset.item] = input.checked;
  flightSource = input.checked ? input.nextElementSibling : null;
  saveState();
  renderChecklist();
}));
resetButton.addEventListener('click', () => openResetDialog(selectedDays()));
clearAllButton.addEventListener('click', () => openResetDialog(['sat', 'sun']));
dialogConfirm.addEventListener('click', () => {
  pendingResetDays.forEach(day => { state.progress[day] = {}; });
  saveState();
  renderChecklist();
  closeResetDialog();
});
dialogCancel.addEventListener('click', closeResetDialog);
confirmDialog.addEventListener('click', event => { if (event.target === confirmDialog) closeResetDialog(); });
