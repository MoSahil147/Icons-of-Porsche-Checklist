// Exhaust puffs on a firm flick only. Speed is viewport heights per second over the last 100 ms. Measured with
// real gesture scrolls at 600 and 1000 px windows: reading peaks at 2.05, firm flicks start at 3.07. Keys and
// anchor glides never count: only a scroll within 300 ms of wheel or touch input does.
// CSS hides the rail on narrow screens and with reduced motion.
const scrollRail = document.getElementById('scroll-rail');
const FLING_VH_PER_S = 2.5;
let samples = [];
let inputAt = -Infinity;

for (const type of ['wheel', 'touchmove']) window.addEventListener(type, () => { inputAt = performance.now(); }, { passive: true });
window.addEventListener('scroll', () => {
  const now = performance.now();
  if (now - inputAt > 300) { samples = []; return; }
  samples.push([now, scrollY]);
  while (now - samples[0][0] > 100) samples.shift();
  const [t0, y0] = samples[0];
  const speed = Math.abs(scrollY - y0) / (now - t0) * 1000 / innerHeight;
  if (now - t0 >= 40 && speed > FLING_VH_PER_S && !scrollRail.classList.contains('is-fling') && scrollRail.checkVisibility()) scrollRail.classList.add('is-fling');
}, { passive: true });
scrollRail.addEventListener('animationend', event => { if (event.target.matches('.rail-puff:last-child')) scrollRail.classList.remove('is-fling'); });
