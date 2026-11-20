import { state, updateStorageStatus } from './state.js?v=21';
import { renderCategories, renderChecklist, renderDayButtons, withoutModelMotion } from './checklist.js?v=21';
import { applyPaint } from './paint.js?v=21';
import { openSharedPlan } from './link.js?v=21';
import './engine.js?v=21';
import './rail.js?v=21';

renderDayButtons();
renderCategories();
withoutModelMotion(renderChecklist);
updateStorageStatus();
applyPaint();
openSharedPlan();

// Offline after one visit, where the browser allows a service worker (not in every in-app browser).
if ('serviceWorker' in navigator && window.isSecureContext) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js')
    .then(() => navigator.serviceWorker.ready)
    .then(() => { state.offlineReady = true; updateStorageStatus(); })
    .catch(() => {}));
}

console.log(String.raw`
            _________
       __.-'   |     '-.____
     /'  ___   |   911  ___ '-.
    |___/   \__|_______/   \__]
        \___/          \___/
Built brick by brick. Source: https://github.com/MoSahil147/Icons-of-Porsche-Checklist`);
