// One sliding thumb per segmented switch (day and list). A tap selects a segment as before. A drag that starts on
// the selected segment moves the thumb with the finger, 1:1, and the release snaps to the nearest segment.
// While pressed, the thumb lifts and turns to glass (HIG: glass only on a transient control in the content layer).
// The buttons keep their click handlers and aria-pressed, so keyboard and screen reader use do not change.

const DRAG_START = 4; // px of sideways travel before a press becomes a drag

for (const group of document.querySelectorAll('.day-switch, .list-switch')) {
  const buttons = [...group.querySelectorAll('button')];
  const thumb = document.createElement('span');
  thumb.className = 'seg-thumb';
  thumb.setAttribute('aria-hidden', 'true');
  group.prepend(thumb);
  group.classList.add('has-thumb', 'is-settling');

  const active = () => Math.max(0, buttons.findIndex(button => button.getAttribute('aria-pressed') === 'true'));
  const place = (x, width) => {
    thumb.style.setProperty('--x', `${x}px`);
    thumb.style.setProperty('--w', `${width}px`);
  };
  const sync = () => {
    const button = buttons[active()];
    if (!button.offsetWidth) return; // the list switch is hidden on wide screens
    thumb.style.setProperty('--y', `${button.offsetTop}px`);
    thumb.style.setProperty('--h', `${button.offsetHeight}px`);
    place(button.offsetLeft, button.offsetWidth);
  };
  // Thumb left edge to width, read between neighbours, so the thumb grows or shrinks as it crosses wide and narrow segments.
  const widthAt = x => {
    for (let i = 0; i < buttons.length - 1; i++) {
      const a = buttons[i], b = buttons[i + 1];
      if (x <= b.offsetLeft) return a.offsetWidth + (b.offsetWidth - a.offsetWidth) * (x - a.offsetLeft) / (b.offsetLeft - a.offsetLeft);
    }
    return buttons.at(-1).offsetWidth;
  };
  const nearest = centre => buttons.reduce((best, button, i) =>
    Math.abs(button.offsetLeft + button.offsetWidth / 2 - centre) < Math.abs(buttons[best].offsetLeft + buttons[best].offsetWidth / 2 - centre) ? i : best, 0);

  sync();
  requestAnimationFrame(() => requestAnimationFrame(() => group.classList.remove('is-settling')));
  new ResizeObserver(() => {
    group.classList.add('is-settling');
    sync();
    requestAnimationFrame(() => group.classList.remove('is-settling'));
  }).observe(group);
  new MutationObserver(sync).observe(group, { subtree: true, attributeFilter: ['aria-pressed'] });

  let press = null; // { id, startX, fromX, x, under, dragging }
  let swallowClick = false;

  group.addEventListener('pointerdown', event => {
    swallowClick = false;
    const button = event.target.closest('button');
    if (!event.isPrimary || event.button !== 0 || buttons.indexOf(button) !== active()) return;
    const from = button.offsetLeft;
    press = { id: event.pointerId, startX: event.clientX, fromX: from, x: from, under: active(), dragging: false };
    group.classList.add('is-pressed');
  });
  group.addEventListener('pointermove', event => {
    if (!press || event.pointerId !== press.id) return;
    const dx = event.clientX - press.startX;
    if (!press.dragging) {
      if (Math.abs(dx) < DRAG_START) return;
      press.dragging = true;
      group.setPointerCapture(event.pointerId);
      group.classList.add('is-dragging');
    }
    const min = buttons[0].offsetLeft, max = buttons.at(-1).offsetLeft;
    press.x = Math.min(max, Math.max(min, press.fromX + dx));
    const width = widthAt(press.x);
    place(press.x, width);
    const under = nearest(press.x + width / 2);
    if (under !== press.under) {
      press.under = under;
      navigator.vibrate?.(4); // a light tick on Android; iOS Safari has no vibrate, so nothing happens there
    }
  });
  const release = event => {
    if (!press || event.pointerId !== press.id) return;
    const { dragging, under } = press;
    press = null;
    group.classList.remove('is-pressed', 'is-dragging');
    if (!dragging) return; // a plain tap: the button's own click does the work
    if (event.type === 'pointerup') {
      swallowClick = true; // the browser still sends a click after the drag
      setTimeout(() => { swallowClick = false; }, 300);
    }
    if (event.type === 'pointerup' && under !== active()) buttons[under].click();
    sync(); // no change, or a cancelled drag: glide back to the selected segment
  };
  group.addEventListener('pointerup', release);
  group.addEventListener('pointercancel', release);
  group.addEventListener('click', event => {
    if (!swallowClick || !event.isTrusted) return;
    swallowClick = false;
    event.stopImmediatePropagation();
    event.preventDefault();
  }, true);
}
