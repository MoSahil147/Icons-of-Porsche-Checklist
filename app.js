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
const engineDetail = document.querySelector('#engine-detail');
const engineFeature = document.querySelector('.engine-feature');
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

  const resetLabel = activeDay === 'both' ? 'Reset both days ' : 'Reset this day ';
  resetButton.firstChild.textContent = resetLabel;
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

  progressLabel.textContent = activeDay === 'both'
    ? `${done} / ${total} ready across both days`
    : `${done} / ${total} ready`;
  progressMeter.max = total;
  progressMeter.value = done;
  progressMeter.setAttribute('aria-valuetext', `${done} of ${total} items ready`);
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
  renderChecklist();
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

engineToggle.addEventListener('click', () => {
  const expanded = engineToggle.getAttribute('aria-expanded') === 'true';
  const running = !expanded;
  engineToggle.setAttribute('aria-expanded', String(running));
  engineDetail.hidden = !running;
  engineFeature.classList.toggle('is-running', running);
  engineToggle.firstChild.textContent = running ? 'Stop the flat-six ' : 'Start the flat-six ';
  engineToggle.querySelector('span').textContent = running ? '−' : '+';
});

window.addEventListener('resize', renderCategoryView);

readSavedState();
renderDayButtons();
renderCategoryButtons();
renderCategoryView();
renderChecklist();
updateStorageStatus();
