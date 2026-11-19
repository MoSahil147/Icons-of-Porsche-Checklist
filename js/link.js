import { decodePlan, encodeMask } from '../plan.js?v=20';
import { dayName, itemIds, saveState, selectedDays, state } from './state.js?v=20';
import { renderChecklist, renderDayButtons } from './checklist.js?v=20';

const copyPlanButton = document.querySelector('#copy-plan');
const shareStatus = document.querySelector('#share-status');
const planBanner = document.querySelector('#plan-banner');
const planBannerText = document.querySelector('#plan-banner-text');
const planMerge = document.querySelector('#plan-merge');
const planDismiss = document.querySelector('#plan-dismiss');
const planUndo = document.querySelector('#plan-undo');
let copyTimer = 0;

function planUrl() {
  const url = new URL(location.pathname, location.origin);
  url.searchParams.set('plan', ['1', state.activeDay, ...selectedDays().map(day => encodeMask(state.progress[day]))].join('.'));
  if (state.builderName) url.searchParams.set('by', state.builderName);
  return url.href;
}

const clearPlanParams = () => history.replaceState(history.state, '', location.pathname + location.hash);

function showPlanBanner(plan) {
  const { progress } = state;
  const count = Object.values(plan.days).reduce((sum, ids) => sum + ids.length, 0);
  const total = Object.keys(plan.days).length * itemIds.size;
  const dayText = dayName(plan.day);
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
    state.activeDay = plan.day;
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
  const text = `${state.builderName ? `${state.builderName}'s` : 'My'} ${dayName()} list for Icons of Porsche. Open it to add it to yours.`;
  if (navigator.share && matchMedia('(pointer: coarse)').matches) {
    navigator.share({ title: '911 Field Guide', text, url }).catch(() => {});
    return;
  }
  navigator.clipboard?.writeText(url).then(showCopied, () => { shareStatus.textContent = `Copy this link: ${url}`; })
    ?? (shareStatus.textContent = `Copy this link: ${url}`);
});

export function openSharedPlan() {
  const plan = decodePlan(location.search);
  if (plan) showPlanBanner(plan);
  else if (location.search.includes('plan=')) clearPlanParams();
}
