// Presentation-only culling: preserve SVG geometry, trace state and animation time.
(function () {
  const targets = new Set();
  let observer = null;
  let viewport = null;
  let queued = 0;
  const attribute = 'data-asm-viewport-culled';

  function refresh() {
    queued = 0;
    const nextViewport = document.getElementById('arraySvg');
    if (!nextViewport || typeof IntersectionObserver !== 'function') return;
    if (viewport !== nextViewport) {
      observer?.disconnect();
      targets.forEach(target => target.removeAttribute(attribute));
      targets.clear();
      viewport = nextViewport;
      observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (!targets.has(entry.target) || !entry.target.isConnected) continue;
          // Zero-sized content can be growing/entering; keep it available.
          const hasBounds = entry.boundingClientRect.width > 0 && entry.boundingClientRect.height > 0;
          entry.target.toggleAttribute(attribute, hasBounds && !entry.isIntersecting);
        }
      }, { root: viewport, rootMargin: '160px', threshold: 0 });
    }
    const scene = viewport.querySelector('#asm-trace-root');
    const next = new Set([...(scene?.querySelectorAll('[data-trace-object-key]') || [])]
      .filter(target => !target.parentElement?.closest('[data-trace-object-key]')));
    // Observe cells and detached style/label layers independently. A large
    // structure may intersect the viewport while almost all its cells do not.
    // Retain every node: arrow geometry and event replay depend on these nodes.
    scene?.querySelectorAll('g[data-trace-index], [data-trace-index-label], [data-trace-attached-to]')
      .forEach(target => next.add(target));
    targets.forEach(target => {
      if (next.has(target)) return;
      observer.unobserve(target);
      target.removeAttribute(attribute);
      targets.delete(target);
    });
    next.forEach(target => {
      if (targets.has(target)) return;
      target.removeAttribute(attribute);
      targets.add(target);
      observer.observe(target);
    });
  }

  function schedule() {
    if (!queued) queued = requestAnimationFrame(refresh);
  }

  const style = document.createElement('style');
  // Scope to the live canvas. Detached thumbnails/measurement SVGs must retain
  // geometry and their own visibility even if a renderer cloned a live node.
  style.textContent = `
    #arraySvg #asm-trace-root [${attribute}],
    #arraySvg #asm-trace-root [${attribute}] * {
      visibility: hidden !important;
      pointer-events: none !important;
    }`;
  document.head.append(style);
  window.addEventListener('asm:trace-rendered', schedule);
  window.addEventListener('asm:trace-playback-plan-complete', schedule);
  window.addEventListener('resize', schedule);
  window.ASMTraceViewportCulling = {
    refresh,
    stats: () => ({
      observed: targets.size,
      culled: [...targets].filter(target => target.hasAttribute(attribute)).length
    })
  };
  schedule();
})();
