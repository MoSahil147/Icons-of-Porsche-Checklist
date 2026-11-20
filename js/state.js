import { cleanName } from '../plan.js?v=21';

export const STORAGE_KEY = 'brick-by-brick-iop26-v1';
// The order matches the head script in index.html and the paint value saved in older lists.
export const PAINTS = [
  ['guards-red', 'Guards Red'], ['racing-yellow', 'Racing Yellow'], ['irish-green', 'Irish Green'], ['miami-blue', 'Miami Blue'],
  ['lava-orange', 'Lava Orange'], ['chalk', 'Chalk'], ['carrara-white', 'Carrara White Metallic'], ['carmine-red', 'Carmine Red']
];
const DAY_NAMES = { sat: 'Saturday', sun: 'Sunday', both: 'Saturday and Sunday' };
export const dayName = (day = state.activeDay) => DAY_NAMES[day];
export const itemIds = new Set([...document.querySelectorAll('.check-row input[type="checkbox"]')].map(input => input.dataset.item));
export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

export const state = {
  paintIndex: 0,
  builderName: '',
  storageAvailable: true,
  offlineReady: false,
  activeDay: 'sat',
  activeCategory: 'pack',
  progress: { sat: {}, sun: {} }
};

const storageStatus = document.querySelector('#storage-status');
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const cleanDay = value => isRecord(value) ? Object.fromEntries(Object.entries(value).filter(([item, checked]) => itemIds.has(item) && checked === true)) : {};

function readSavedState() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    state.storageAvailable = false;
    return;
  }
  if (!raw) return;
  try {
    const saved = JSON.parse(raw);
    if (!isRecord(saved)) return;
    // Lists saved by every earlier version use this key and these fields, so old ticks survive.
    state.progress = { sat: cleanDay(saved.sat), sun: cleanDay(saved.sun) };
    if (['sat', 'sun', 'both'].includes(saved.activeDay)) state.activeDay = saved.activeDay;
    if (['pack', 'collect'].includes(saved.activeCategory)) state.activeCategory = saved.activeCategory;
    if (Number.isInteger(saved.paint) && saved.paint >= 0 && saved.paint < PAINTS.length) state.paintIndex = saved.paint;
    if (typeof saved.name === 'string') state.builderName = cleanName(saved.name);
  } catch {
    state.progress = { sat: {}, sun: {} };
  }
}

export function updateStorageStatus() {
  storageStatus.textContent = state.storageAvailable
    ? `Your progress stays on this device and comes back after a refresh. No account needed.${state.offlineReady ? ' This page also opens with no signal now.' : ''}`
    : 'Browser storage is unavailable. Your ticks stay until you close or refresh this page.';
}

export function saveState() {
  if (state.storageAvailable) {
    try {
      const { progress, activeDay, activeCategory, paintIndex: paint, builderName: name } = state;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...progress, activeDay, activeCategory, paint, name }));
    } catch {
      state.storageAvailable = false;
    }
  }
  updateStorageStatus();
}

export const selectedDays = () => state.activeDay === 'both' ? ['sat', 'sun'] : [state.activeDay];

export function progressNumbers() {
  const days = selectedDays();
  const done = days.reduce((count, day) => count + [...itemIds].filter(item => state.progress[day][item]).length, 0);
  return { done, total: days.length * itemIds.size };
}

export const paintHex = (index = state.paintIndex) =>
  getComputedStyle(document.documentElement).getPropertyValue(`--paint-${PAINTS[index][0]}`).trim() || '#c8102e';

readSavedState();
