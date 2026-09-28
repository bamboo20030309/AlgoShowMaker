// Transient presentation detail. Model values, cell anchors and styles stay intact.
(function () {
  const groups = new Set();
  let queued = 0;
  let jobs = [];
  let worker = 0;
  let revision = 0;
  let observer;
  let observedViewport;
  const NS = 'http://www.w3.org/2000/svg';
  function level(pixels, previous) {
    if (pixels >= 24) return 'full';
    if (previous === 'overview' && pixels < 10) return 'overview';
    return pixels < 8 ? 'overview' : 'simple';
  }
  function begin(group, scale, enabled) {
    if (!enabled) return;
    group._asmLod = {level: level(40 * scale), records: [], paths: [], visible: new Set(), pool: []};
    group.dataset.asmLod = group._asmLod.level;
    groups.add(group);
  }
  function record(group, cell, value, x, y, width, height) {
    const state = group._asmLod;
    if (!state) return false;
    const item = {cell, value: String(value), x, y, width, height, text: null};
    state.records.push(item);
    // Geometry is explicit even when glyphs have not been created.
    cell.setAttribute('data-outerframe-left', x);
    cell.setAttribute('data-outerframe-top', y);
    cell.setAttribute('data-outerframe-right', x + width);
    cell.setAttribute('data-outerframe-bottom', y + height);
    return true; // Text is populated only for visible cells after final camera placement.
  }
  function textFor(group, item) {
    let text = item.text;
    if (!text) {
      text = group._asmLod.pool.pop() || document.createElementNS(NS, 'text');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('x', item.x + item.width / 2);
      text.setAttribute('y', item.y + item.height / 2);
      if (item.cell.hasAttribute('data-trace-index')) text.setAttribute('data-trace-content-role', 'value');
      else text.removeAttribute('data-trace-content-role');
      item.cell.append(text);
      item.text = text;
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
  function release(state, item) {
    if (!item.text) return;
    item.text.remove();
    if (state.pool.length < 256) state.pool.push(item.text);
    item.text = null;
  }
  function finish(group) {
    if (!group._asmLod) return;
    paint(group);
    schedule();
  }
  function pump() {
    worker = 0;
    const started = performance.now();
    let count = 0;
    while (jobs.length && performance.now() - started < 4 && count < 128) {
      const group = jobs[0].group;
      window.withSvgTextFitStyle(group, () => {
        while (jobs.length && jobs[0].group === group && performance.now() - started < 4 && count < 128) {
          const job = jobs.shift();
          if (job.revision !== revision || !group.isConnected || !group._asmLod.visible.has(job.item)) continue;
          textFor(group,job.item);
          count++;
        }
      });
    }
    if (jobs.length) worker = requestAnimationFrame(pump);
    else for (const group of groups) group.removeAttribute('data-asm-lod-pending');
  }
  function refresh() {
    queued = 0;
    revision++;
    jobs = [];
    const viewport = window.getViewport?.();
    if (viewport && viewport !== observedViewport) {
      observer?.disconnect(); observedViewport = viewport;
      observer = new MutationObserver(schedule);
      observer.observe(viewport, {attributes:true, attributeFilter:['transform']});
    }
    for (const group of groups) {
      if (!group.isConnected) { groups.delete(group); continue; }
      const matrix = group.getScreenCTM();
      const canvas = group.ownerSVGElement;
      if (!matrix || !canvas) continue;
      const bounds = canvas.getBoundingClientRect();
      const state = group._asmLod;
      const scale = Math.hypot(matrix.a, matrix.b);
      const content = state.records.find(item => item.cell.hasAttribute('data-trace-index')) || state.records[0];
      const next = level((content?.width || 40) * scale, state.level);
      if (next !== state.level) { state.level = next; paint(group); }
      const wanted = new Set();
      // Geometry comes from the draw records: no per-cell DOM measurement.
      for (const item of state.records) {
        if (item.width * scale + 1e-6 < 24) continue;
        const x = matrix.a * item.x + matrix.c * item.y + matrix.e;
        const y = matrix.b * item.x + matrix.d * item.y + matrix.f;
        const dx = matrix.a * item.width, dy = matrix.b * item.width;
        const ex = matrix.c * item.height, ey = matrix.d * item.height;
        const left = Math.min(x,x+dx,x+ex,x+dx+ex), right = Math.max(x,x+dx,x+ex,x+dx+ex);
        const top = Math.min(y,y+dy,y+ey,y+dy+ey), bottom = Math.max(y,y+dy,y+ey,y+dy+ey);
        if (right < bounds.left-48 || left > bounds.right+48 || bottom < bounds.top-48 || top > bounds.bottom+48) continue;
        wanted.add(item);
      }
      for (const item of state.visible) if (!wanted.has(item)) release(state,item);
      state.visible = wanted;
      for (const item of wanted) if (!item.text) jobs.push({group,item,revision});
      group.toggleAttribute('data-asm-lod-pending', [...wanted].some(item=>!item.text));
    }
    if (jobs.length && !worker) worker = requestAnimationFrame(pump);
  }
  function schedule() {
    if (!queued) queued = requestAnimationFrame(refresh);
  }
  function adopt(source, clone) {
    const sourceNodes = [source, ...source.querySelectorAll('*')];
    const cloneNodes = [clone, ...clone.querySelectorAll('*')];
    const mapping = new Map(sourceNodes.map((node, i) => [node, cloneNodes[i]]));
    for (const node of sourceNodes) {
      if (!node._asmLod) continue;
      const target = mapping.get(node), state = node._asmLod;
      target._asmLod = {level:state.level,
        records:state.records.map(item=>({...item,cell:mapping.get(item.cell),text:mapping.get(item.text)||null})),
        visible:new Set(),pool:[],
        paths:state.paths.map(path=>mapping.get(path)).filter(Boolean)};
      target._asmLod.visible = new Set(target._asmLod.records.filter(item=>item.text));
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
