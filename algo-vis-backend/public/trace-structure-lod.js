// Transient presentation detail. Model values, cell anchors and styles stay intact.
(function () {
  const groups = new Set();
  let queued = 0;
  let settleTimer = 0;
  let observer;
  let observedViewport;
  const NS = 'http://www.w3.org/2000/svg';
  function level(pixels, previous) {
    if (previous === 'full' && pixels >= 24) return 'full';
    if (previous === 'overview' && pixels < 10) return 'overview';
    return pixels >= 28 ? 'full' : pixels < 8 ? 'overview' : 'simple';
  }
  function begin(group, scale, enabled) {
    if (!enabled) return;
    group._asmLod = {level: level(40 * scale), records: [], paths: []};
    group.dataset.asmLod = group._asmLod.level;
    groups.add(group);
  }
  function record(group, cell, value, x, y, width, height) {
    const state = group._asmLod;
    if (!state) return false;
    const item = {cell, value: String(value), x, y, width, height};
    state.records.push(item);
    // Geometry is explicit even when glyphs have not been created.
    cell.setAttribute('data-outerframe-left', x);
    cell.setAttribute('data-outerframe-top', y);
    cell.setAttribute('data-outerframe-right', x + width);
    cell.setAttribute('data-outerframe-bottom', y + height);
    return state.level !== 'full';
  }
  function textFor(group, item) {
    let text = item.cell.querySelector(':scope > text');
    if (!text) {
      text = document.createElementNS(NS, 'text');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('x', item.x + item.width / 2);
      text.setAttribute('y', item.y + item.height / 2);
      if (item.cell.hasAttribute('data-trace-index')) text.setAttribute('data-trace-content-role', 'value');
      item.cell.append(text);
    }
    text.textContent = item.value;
    text.setAttribute('font-size', window.fitSvgText(group, item.value, item.width, item.height));
    return text;
  }
  function paint(group) {
    const state = group._asmLod;
    if (!state) return;
    state.paths.forEach(path => path.remove());
    state.paths = [];
    const batches = new Map();
    for (const item of state.records) {
      const rect = item.cell.querySelector(':scope > rect');
      if (!rect) continue;
      rect.removeAttribute('data-asm-lod-rect');
      const text = item.cell.querySelector(':scope > text');
      if (state.level === 'full') {
        textFor(group, item);
      } else {
        text?.remove();
      }
      if (state.level === 'overview') {
        // Merge only base cells. Independent highlight/point/mark layers remain.
        const color = rect.getAttribute('fill') || '#fff';
        const key = color;
        const d = `M${item.x} ${item.y}h${item.width}v${item.height}h${-item.width}Z`;
        batches.set(key, (batches.get(key) || '') + d);
        rect.setAttribute('data-asm-lod-rect', '1');
      }
    }
    for (const [fill, d] of batches) {
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', d); path.setAttribute('fill', fill);
      path.setAttribute('pointer-events', 'none');
      path.dataset.asmLodBatch = '1';
      // Base fills behind all cell styles, but above the outerframe background.
      const firstCell = state.records[0]?.cell;
      group.insertBefore(path, firstCell || null);
      state.paths.push(path);
    }
    group.dataset.asmLod = state.level;
  }
  function finish(group) {
    if (!group._asmLod) return;
    // Full-detail text was already fitted by draw_block.
    if (group._asmLod.level !== 'full') paint(group);
  }
  function refresh() {
    queued = 0;
    const viewport = window.getViewport?.();
    if (viewport && viewport !== observedViewport) {
      observer?.disconnect(); observedViewport = viewport;
      observer = new MutationObserver(schedule);
      observer.observe(viewport, {attributes:true, attributeFilter:['transform']});
    }
    for (const group of groups) {
      if (!group.isConnected) { groups.delete(group); continue; }
      const matrix = group.getScreenCTM();
      if (!matrix) continue;
      const state = group._asmLod;
      const next = level(40 * Math.hypot(matrix.a, matrix.b), state.level);
      if (next === state.level) continue;
      state.level = next;
      window.withSvgTextFitStyle(group, () => paint(group));
    }
  }
  function schedule() {
    // Camera fitting may animate through high zoom on its way to overview.
    // Wait for the transform to settle instead of building text mid-flight.
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => { if (!queued) queued = requestAnimationFrame(refresh); }, 80);
  }
  function adopt(source, clone) {
    const sourceNodes = [source, ...source.querySelectorAll('*')];
    const cloneNodes = [clone, ...clone.querySelectorAll('*')];
    const mapping = new Map(sourceNodes.map((node, i) => [node, cloneNodes[i]]));
    for (const node of sourceNodes) {
      if (!node._asmLod) continue;
      const target = mapping.get(node), state = node._asmLod;
      target._asmLod = {level:state.level,
        records:state.records.map(item=>({...item,cell:mapping.get(item.cell)})),
        paths:state.paths.map(path=>mapping.get(path)).filter(Boolean)};
      groups.add(target);
    }
    schedule();
  }
  const style = document.createElement('style');
  // Keep rect geometry and hit targets without painting individual grid lines.
  style.textContent = '[data-asm-lod-rect] {fill-opacity:0 !important;stroke-opacity:0 !important;pointer-events:all;}';
  document.head.append(style);
  window.addEventListener('asm:trace-rendered', () => {
    const viewport = window.getViewport?.();
    if (viewport && viewport !== observedViewport) {
      observer?.disconnect(); observedViewport = viewport;
      observer = new MutationObserver(schedule);
      observer.observe(viewport, {attributes:true,attributeFilter:['transform']});
    }
    schedule();
  });
  window.addEventListener('resize', schedule);
  window.addEventListener('asm:camera-user-change', schedule);
  window.ASMStructureLOD = {begin,record,finish,refresh,level,adopt};
})();
