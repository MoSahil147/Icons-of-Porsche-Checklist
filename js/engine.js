const engineToggle = document.querySelector('#engine-toggle');
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

showCrankAngle(drawEngine());
