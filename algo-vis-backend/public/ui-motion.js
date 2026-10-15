/* Shared UI chrome motion. No canvas, Trace or persisted deck state is changed. */
(() => {
  'use strict';
  // Native Escape must dismiss the top-layer dialog rather than reach the
  // slide editor's overview shortcut. Do not prevent the browser's default
  // cancel action: validation, focus restoration and close events stay native.
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !event.isComposing && document.querySelector('dialog.t-modal[open]')) {
      event.stopPropagation();
    }
  }, true);
  const bar = document.querySelector('.auth-tabs');
  if (!bar) return;
  const tabs = [...bar.querySelectorAll('.auth-tab')];
  const pill = document.createElement('span');
  pill.className = 't-tabs-pill';
  pill.setAttribute('aria-hidden', 'true');
  bar.prepend(pill);
  bar.classList.add('t-tabs');
  tabs.forEach(tab => tab.classList.add('t-tab'));
  let pending = 0;
  let snap = true;

  function position() {
    pending = 0;
    if (!bar.getClientRects().length) { snap = true; return; }
    const active = tabs.find(tab => tab.classList.contains('is-active'));
    if (!active) return;
    tabs.forEach(tab => tab.setAttribute('aria-selected', String(tab === active)));
    // First paint, reappearance and resize must not sweep in from zero width.
    const previous = pill.style.transition;
    if (snap) pill.style.transition = 'none';
    pill.style.transform = `translateX(${active.offsetLeft}px)`;
    pill.style.width = `${active.offsetWidth}px`;
    if (snap) { void pill.offsetWidth; pill.style.transition = previous; }
    snap = false;
  }
  function schedule() { if (!pending) pending = requestAnimationFrame(position); }
  const observer = new MutationObserver(schedule);
  observer.observe(bar, { subtree: true, attributes: true, attributeFilter: ['class', 'hidden'] });
  const resize = new ResizeObserver(() => { snap = true; schedule(); });
  resize.observe(bar);
  tabs.forEach(tab => resize.observe(tab));
  schedule();
})();
