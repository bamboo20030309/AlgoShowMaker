(function () {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const TRACE_ROOT_OFFSET = { x: 90, y: 80 };
  const renderers = new Map();
  let currentScene = null;

  function eventAnimation(type) {
    return window.ASMTraceEvents?.animation?.(type) || 'none';
  }

  function svg(name, attributes = {}, text = '') {
    const element = document.createElementNS(SVG_NS, name);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
    if (text !== '') element.textContent = text;
    return element;
  }

  function displayValue(data) {
    if (!data || typeof data !== 'object') return String(data ?? '');
    if (Object.prototype.hasOwnProperty.call(data, 'value')) return String(data.value ?? '');
    if (data.kind === 'reference') return data.address || 'null';
    if (data.kind === 'pair') return (data.items || []).map(displayValue).join(', ');
    return data.label || data.type || data.kind || '';
  }

  function applyHighlight(element, highlight = {}) {
    const color = highlight.color || highlight.fill || highlight.stroke;
    if (highlight.styleType === 'background' && color) element.setAttribute('fill', color);
    else if (highlight.styleType && color) element.setAttribute('stroke', color);
    if (highlight.fill) element.setAttribute('fill', highlight.fill);
    if (highlight.stroke) element.setAttribute('stroke', highlight.stroke);
    if (highlight.animation) element.classList.add(highlight.animation);
    if (highlight.eventType) element.dataset.eventType = highlight.eventType;
  }

  function originalStyles(highlights = {}, itemCount = 1) {
    const styles = [];
    Object.entries(highlights).forEach(([key, highlight]) => {
      const indices = key === '$object'
        ? Array.from({ length: itemCount }, (_, index) => index)
        : [Number(key)];
      const valid = indices.filter(index => Number.isInteger(index) && index >= 0 && index < itemCount);
      if (!valid.length) return;
      if (highlight.fixedMark) {
        styles.push({ type: 'mark', color: highlight.fixedMark, elements: valid });
      }
      if (highlight.styleType && highlight.color) {
        styles.push({ type: highlight.styleType, color: highlight.color, elements: valid });
        return;
      }
      if (highlight.fill) styles.push({ type: 'background', color: highlight.fill, elements: valid });
      if (highlight.stroke) styles.push({ type: 'highlight', color: highlight.stroke, elements: valid });
    });
    return styles;
  }

  function originalBoundsHeight(group, fallback = 78) {
    const top = Number(group.getAttribute('data-outerframe-top'));
    const bottom = Number(group.getAttribute('data-outerframe-bottom'));
    if (Number.isFinite(top) && Number.isFinite(bottom) && bottom > top) return bottom - top + 24;
    try {
      const box = group.getBBox();
      if (box.height > 0) return box.height + 24;
    } catch (error) {
      // The SVG may be detached while an embedded editor is initializing.
    }
    return fallback;
  }

  function measuredBox(element, fallback) {
    const left = Number(element?.getAttribute?.('data-outerframe-left'));
    const top = Number(element?.getAttribute?.('data-outerframe-top'));
    const right = Number(element?.getAttribute?.('data-outerframe-right'));
    const bottom = Number(element?.getAttribute?.('data-outerframe-bottom'));
    if ([left, top, right, bottom].every(Number.isFinite) && right > left && bottom > top) {
      return { x: left, y: top, width: right - left, height: bottom - top };
    }
    try {
      const box = element.getBBox();
      if (box.width > 0 && box.height > 0) return box;
    } catch (error) {
      // Use the renderer's deterministic estimate below.
    }
    return fallback;
  }

  function safeKey(value) {
    return String(value || 'object').replace(/[^A-Za-z0-9_-]/g, '-');
  }

  function markSelectable(element, key, context = {}, parentKey = '') {
    if (!element || !key) return element;
    element.classList.add('asm-trace-selectable');
    if (context.interactive !== false && context.movable === true) {
      element.classList.add('draggable-object');
      element.setAttribute('data-trace-movable', '1');
    }
    element.setAttribute('data-trace-object-key', key);
    if (parentKey) element.setAttribute('data-trace-parent-key', parentKey);
    if (!element.id) element.id = `${context.idPrefix || 'trace'}-part-${safeKey(key)}`;
    element.setAttribute('data-translate', '0,0');
    element.setAttribute('data-base-transform', element.getAttribute('transform') || '');
    return element;
  }

  function originalValues(entry) {
    if (entry.data?.kind === 'map') {
      return (entry.data.entries || []).map(item => `${displayValue(item.key)}: ${displayValue(item.value)}`);
    }
    if (Array.isArray(entry.data?.items)) return entry.data.items.map(displayValue);
    return [displayValue(entry.data)];
  }

  function renderOriginal(group, entry, context) {
    if (typeof window.draw_array_normal !== 'function') {
      return Array.isArray(entry.data?.items) ? renderSequence(group, entry, context) : renderScalar(group, entry, context);
    }
    const id = `${context.idPrefix || 'trace-original'}-${context.variableId.replace(/[^A-Za-z0-9_-]/g, '-')}`;
    const gap = Number.isFinite(Number(context.skin?.options?.gap)) ? Number(context.skin.options.gap) : 0;
    const indexMode = context.skin?.options?.showIndex === false ? 0 : 1;
    const requested = context.rendererName || 'original-array';
    const isMatrix = requested === 'original-matrix' || context.variable.kind === 'matrix';
    let values = originalValues(entry);
    let itemsPerRow = Infinity;
    if (isMatrix) {
      const rows = Array.isArray(entry.data?.items) ? entry.data.items : [];
      const columns = Math.max(1, ...rows.map(row => Array.isArray(row?.items) ? row.items.length : 0));
      values = rows.flatMap(row => Array.from({ length: columns }, (_, index) => displayValue(row?.items?.[index])));
      itemsPerRow = columns;
    }
    if (!values.length) values = [''];
    const range = [0, values.length - 1];
    const styles = originalStyles(context.highlights, values.length);
    const mode = requested.replace(/^original-/, '');
    if (mode === 'stack' && typeof window.draw_array_stack === 'function') {
      window.draw_array_stack(group, id, values, styles, range, indexMode, gap);
    } else if (mode === 'queue' && typeof window.draw_array_queue === 'function') {
      window.draw_array_queue(group, id, values, styles, range, indexMode, gap);
    } else {
      window.draw_array_normal(group, id, values, styles, range, itemsPerRow, indexMode, gap);
    }
    values.forEach((value, index) => {
      const cell = group.querySelector(`#${CSS.escape(`cell-${id}-${index}`)}`);
      const cellKey = isMatrix
        ? `${context.variableId}#${Math.floor(index / itemsPerRow)},${index % itemsPerRow}`
        : `${context.variableId}#${index}`;
      if (cell) {
        cell.setAttribute('data-trace-index', String(index));
        markSelectable(cell, cellKey, context, context.variableId);
      }
      ['highlight', 'point', 'mark'].forEach(kind => {
        const hint = group.querySelector(`#${CSS.escape(`${kind}-${id}-${index}`)}`);
        if (!hint) return;
        hint.setAttribute('data-trace-attached-to', cellKey);
        hint.setAttribute('data-trace-attachment-kind', kind);
      });
      const indexLabel = group.querySelector(`#${CSS.escape(`cell-${id}-${index}-index`)}`);
      if (indexLabel) {
        indexLabel.setAttribute('data-trace-index-label', String(index));
        markSelectable(indexLabel, `${cellKey}:index`, context, context.variableId);
      }
    });
    group.querySelectorAll(':scope > .outerframe-label').forEach(label => {
      label.textContent = context.variable?.name || '';
      label.setAttribute('font-family', 'Arial');
      label.setAttribute('font-size', '16');
      label.setAttribute('font-weight', 'bold');
      markSelectable(label, `${context.variableId}:label`, context, context.variableId);
    });
    return originalBoundsHeight(group, isMatrix ? Math.max(78, Math.ceil(values.length / itemsPerRow) * 52 + 24) : 78);
  }

  function renderSequence(group, entry, context) {
    const items = Array.isArray(entry.data?.items) ? entry.data.items : [];
    const cellSize = Math.max(32, Math.min(72, Number(context.skin?.options?.cellSize) || 52));
    const gap = Number.isFinite(Number(context.skin?.options?.gap)) ? Number(context.skin.options.gap) : 0;
    items.forEach((item, index) => {
      const x = index * (cellSize + gap);
      const logicalIndex = context.rowIndex == null ? String(index) : `${context.rowIndex},${index}`;
      const cellKey = `${context.variableId}#${logicalIndex}`;
      const cell = markSelectable(svg('g', {
        transform: `translate(${x}, 0)`,
        'data-trace-index': context.rowIndex == null ? index : logicalIndex
      }), cellKey, context, context.variableId);
      const rect = svg('rect', { x: 0, y: 0, width: cellSize, height: cellSize, fill: '#ffffff', stroke: '#59656b', 'stroke-width': 1 });
      applyHighlight(rect, context.highlights?.[String(index)] || context.highlights?.$object);
      cell.append(rect, svg('text', {
        x: cellSize / 2,
        y: cellSize / 2 + 6,
        'text-anchor': 'middle',
        'font-family': 'Arial',
        'font-size': Math.max(14, Math.min(24, cellSize * 0.36)),
        fill: '#1f282d'
      }, displayValue(item)));
      if (context.skin?.options?.showIndex !== false) {
        const indexLabel = markSelectable(svg('text', {
          x: cellSize / 2,
          y: cellSize + 18,
          'text-anchor': 'middle',
          'font-family': 'Arial',
          'font-size': 12,
          fill: '#7b858a'
        }, String(index)), `${cellKey}:index`, context, context.variableId);
        cell.append(indexLabel);
      }
      group.append(cell);
    });
    return Math.max(cellSize + 24, 78);
  }

  function renderMatrix(group, entry, context) {
    const rows = Array.isArray(entry.data?.items) ? entry.data.items : [];
    let height = 0;
    rows.forEach((row, rowIndex) => {
      const rowGroup = svg('g', { transform: `translate(0, ${rowIndex * 58})` });
      renderSequence(rowGroup, { data: { items: row?.items || [] } }, {
        ...context,
        rowIndex,
        skin: { ...context.skin, options: { ...context.skin?.options, showIndex: false } }
      });
      group.append(rowGroup);
      height = (rowIndex + 1) * 58;
    });
    return Math.max(70, height + 10);
  }

  function renderScalar(group, entry, context) {
    const rect = svg('rect', { x: 0, y: 0, width: 150, height: 52, fill: '#ffffff', stroke: '#59656b', 'stroke-width': 1 });
    applyHighlight(rect, context.highlights?.$object);
    group.append(rect, svg('text', {
      x: 75, y: 33, 'text-anchor': 'middle', 'font-family': 'Arial', 'font-size': 24, fill: '#1f282d'
    }, displayValue(entry.data)));
    return 68;
  }

  function renderObject(group, entry) {
    const fields = entry.data?.fields && typeof entry.data.fields === 'object' ? entry.data.fields : {};
    const lines = Object.entries(fields);
    const height = Math.max(58, 32 + lines.length * 26);
    group.append(svg('rect', { x: 0, y: 0, width: 260, height, fill: '#ffffff', stroke: '#59656b', 'stroke-width': 1 }));
    if (!lines.length) {
      group.append(svg('text', { x: 16, y: 34, 'font-family': 'Arial', 'font-size': 16, fill: '#667278' }, entry.data?.type || 'Object'));
    } else {
      lines.forEach(([key, value], index) => group.append(svg('text', {
        x: 16, y: 30 + index * 26, 'font-family': 'Arial', 'font-size': 16, fill: '#1f282d'
      }, `${key}: ${displayValue(value)}`)));
    }
    return height + 16;
  }

  function renderGraph(group, entry) {
    const nodes = Object.entries(entry.data?.nodes || {});
    const edges = Array.isArray(entry.data?.edges) ? entry.data.edges : [];
    const positions = {};
    nodes.forEach(([id, node], index) => {
      positions[id] = {
        x: Number(node.x) || 70 + (index % 6) * 110,
        y: Number(node.y) || 45 + Math.floor(index / 6) * 90
      };
    });
    edges.forEach(edge => {
      const from = positions[edge.from];
      const to = positions[edge.to];
      if (from && to) group.append(svg('line', { x1: from.x, y1: from.y, x2: to.x, y2: to.y, stroke: '#59656b', 'stroke-width': 2 }));
    });
    nodes.forEach(([id, node]) => {
      const position = positions[id];
      group.append(svg('circle', { cx: position.x, cy: position.y, r: 24, fill: '#ffffff', stroke: '#59656b', 'stroke-width': 1 }));
      group.append(svg('text', { x: position.x, y: position.y + 6, 'text-anchor': 'middle', 'font-family': 'Arial', 'font-size': 16 }, node.label ?? node.value ?? id));
    });
    return Math.max(110, 80 + Math.ceil(nodes.length / 6) * 90);
  }

  function renderCoordinateSystem(group, entry) {
    const width = 520;
    const height = 240;
    group.append(svg('line', { x1: 30, y1: height / 2, x2: width, y2: height / 2, stroke: '#59656b' }));
    group.append(svg('line', { x1: width / 2, y1: 10, x2: width / 2, y2: height - 10, stroke: '#59656b' }));
    const points = Array.isArray(entry.data?.points) ? entry.data.points : [];
    const xs = points.map(point => Number(point.x) || 0);
    const ys = points.map(point => Number(point.y) || 0);
    const maxX = Math.max(1, ...xs.map(Math.abs));
    const maxY = Math.max(1, ...ys.map(Math.abs));
    points.forEach(point => {
      const x = width / 2 + (Number(point.x) || 0) / maxX * (width / 2 - 40);
      const y = height / 2 - (Number(point.y) || 0) / maxY * (height / 2 - 24);
      group.append(svg('circle', { cx: x, cy: y, r: 6, fill: point.color || '#1d8f83' }));
      if (point.label) group.append(svg('text', { x: x + 9, y: y - 8, 'font-family': 'Arial', 'font-size': 13 }, point.label));
    });
    return height + 20;
  }

  function register(name, renderer) {
    if (typeof name === 'string' && typeof renderer === 'function') renderers.set(name, renderer);
  }

  function studioPosition(document, frame, key) {
    const position = document.studio?.positions?.[frame.id]?.[key];
    return {
      x: Number(position?.x) || 0,
      y: Number(position?.y) || 0,
      absolute: position?.absolute === true
    };
  }

  function objectKeyForVariable(frame, variableId) {
    const source = frame?.source || {};
    if (source.objectId && source.primaryVariableId === variableId) return source.objectId;
    return variableId;
  }

  function objectPositions(rootSvg) {
    const positions = new Map();
    rootSvg.querySelectorAll('#asm-trace-root [data-trace-object-key]').forEach(object => {
      const rendered = String(object.getAttribute('data-trace-render-position') || '').split(',').map(Number);
      const [x, y] = rendered.length === 2 && rendered.every(Number.isFinite)
        ? rendered
        : String(object.getAttribute('data-base-offset') || '0,0').split(',').map(Number);
      positions.set(object.dataset.traceObjectKey, { x: Number(x) || 0, y: Number(y) || 0 });
    });
    return positions;
  }

  function captureTopLevelObjects(rootSvg) {
    const root = rootSvg.querySelector('#asm-trace-root');
    const captured = new Map();
    if (!root) return captured;
    root.querySelectorAll('[data-trace-object-key]').forEach(element => {
      const parentObject = element.parentElement?.closest?.('[data-trace-object-key]');
      if (parentObject && root.contains(parentObject)) return;
      const key = element.dataset.traceObjectKey;
      if (!key || captured.has(key)) return;
      const clone = element.cloneNode(true);
      clone.querySelectorAll('animate, animateTransform, animateMotion').forEach(animation => animation.remove());
      [clone, ...clone.querySelectorAll('[id]')].forEach(node => node.removeAttribute?.('id'));
      clone.removeAttribute('data-trace-object-key');
      clone.classList.add('asm-trace-transition-ghost');
      clone.setAttribute('pointer-events', 'none');
      captured.set(key, clone);
    });
    return captured;
  }

  function transitionVisualSignature(element) {
    if (!element) return '';
    const visual = element.querySelector?.(':scope > .asm-trace-motion') || element;
    const clone = visual.cloneNode(true);
    clone.querySelectorAll('animate, animateTransform, animateMotion').forEach(animation => animation.remove());
    clone.querySelectorAll('[data-trace-binding-handle], [data-trace-anchor]').forEach(control => control.remove());
    [clone, ...clone.querySelectorAll('[id]')].forEach(node => node.removeAttribute?.('id'));
    return clone.innerHTML.replace(/\s+/g, ' ').trim();
  }

  function animationAttributes(plan) {
    const timing = window.ASMTraceTransitions?.timing?.(plan) || {
      dur: '520ms', calcMode: 'spline', keySplines: '0.22 1 0.36 1'
    };
    const attributes = {
      dur: timing.dur,
      begin: 'indefinite',
      fill: 'freeze',
      calcMode: timing.calcMode,
      keyTimes: '0;1'
    };
    if (timing.keySplines) attributes.keySplines = timing.keySplines;
    return attributes;
  }

  function startSvgAnimation(animation) {
    if (!animation) return;
    requestAnimationFrame(() => {
      if (!animation.isConnected || typeof animation.beginElement !== 'function') return;
      animation.beginElement();
    });
  }

  function animateOpacity(element, plan, from = 0, to = 1) {
    const animation = svg('animate', {
      attributeName: 'opacity',
      from, to,
      ...animationAttributes(plan)
    });
    element.prepend(animation);
    startSvgAnimation(animation);
  }

  function animatePosition(motion, previous, current, enabled, plan = null, additive = false) {
    if (!enabled || !plan || plan.mode === 'instant' || Number(plan.duration) <= 0) return;
    if (plan.mode === 'fade') {
      animateOpacity(motion, plan);
      return;
    }
    if (!previous || plan.mode === 'lift') {
      const attributes = {
        attributeName: 'transform',
        type: 'translate',
        from: '0 24',
        to: '0 0',
        ...animationAttributes(plan)
      };
      if (additive) attributes.additive = 'sum';
      const animation = svg('animateTransform', attributes);
      motion.prepend(animation);
      startSvgAnimation(animation);
      animateOpacity(motion, plan);
      return;
    }
    const dx = (Number(previous.x) || 0) - (Number(current.x) || 0);
    const dy = (Number(previous.y) || 0) - (Number(current.y) || 0);
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
    const attributes = {
      attributeName: 'transform',
      type: 'translate',
      ...animationAttributes(plan)
    };
    if (plan.mode === 'arc') {
      const arcHeight = Math.max(18, Math.min(90, Math.hypot(dx, dy) * 0.22));
      attributes.values = `${dx} ${dy};${dx / 2} ${dy / 2 - arcHeight};0 0`;
      attributes.keyTimes = '0;0.5;1';
      attributes.calcMode = 'spline';
      attributes.keySplines = '0.22 1 0.36 1;0.22 1 0.36 1';
    } else {
      attributes.from = `${dx} ${dy}`;
      attributes.to = '0 0';
    }
    if (additive) attributes.additive = 'sum';
    const animation = svg('animateTransform', attributes);
    motion.prepend(animation);
    startSvgAnimation(animation);
  }

  function transitionForKey(options, key) {
    return options.transitionForKey?.(key) || null;
  }

  function previousPositionForKey(options, key) {
    const plan = transitionForKey(options, key);
    return {
      plan,
      previous: options.previousPositions?.get(plan?.sourceKey || key)
    };
  }

  function animateObjectPosition(motion, options, key, current) {
    const { plan, previous } = previousPositionForKey(options, key);
    animatePosition(motion, previous, current, options.animatePositions !== false, plan);
  }

  function animateChangedObjects(captured, elements, options) {
    if (options.animatePositions === false || !captured?.size) return;
    elements.forEach((element, key) => {
      const plan = transitionForKey(options, key);
      if (plan?.requestedMode !== 'auto' || !plan.sourceExists || Number(plan.duration) <= 0) return;
      const hasDedicatedSwap = (options.frame?.events || []).some(event => (
        event.type === 'swap' && (event.targets || []).some(target => target.variableId === key)
      ));
      if (hasDedicatedSwap) return;
      const previous = captured.get(plan.sourceKey || key);
      if (!previous || transitionVisualSignature(previous) === transitionVisualSignature(element)) return;
      const motion = element.querySelector(':scope > .asm-trace-motion') || element;
      if (motion.querySelector(':scope > animate[attributeName="opacity"]')) return;
      animateOpacity(motion, plan, 0.35, 1);
    });
  }

  function animateRemovedObjects(root, captured, elements, document, options) {
    if (options.animatePositions === false || !captured?.size) return;
    const consumed = new Set();
    elements.forEach((element, key) => {
      const plan = transitionForKey(options, key);
      if (plan?.sourceKey) consumed.add(plan.sourceKey);
    });
    const defaults = window.ASMTraceTransitions?.defaults?.(document) || {
      duration: 360, easing: 'smooth'
    };
    captured.forEach((ghost, key) => {
      if (consumed.has(key)) return;
      const plan = { mode: 'fade', duration: defaults.duration, easing: defaults.easing };
      root.prepend(ghost);
      const animation = svg('animate', {
        attributeName: 'opacity', from: 1, to: 0,
        ...animationAttributes(plan)
      });
      const lift = svg('animateTransform', {
        attributeName: 'transform', type: 'translate', additive: 'sum',
        from: '0 0', to: '0 -15',
        ...animationAttributes(plan)
      });
      ghost.append(animation, lift);
      startSvgAnimation(animation);
      startSvgAnimation(lift);
      window.setTimeout(() => ghost.remove(), Number(plan.duration) + 80);
    });
  }

  function ensureArrowMarker(rootSvg, idPrefix = 'asm-trace') {
    const defsId = `${idPrefix}-studio-defs`;
    const markerId = `${idPrefix}-arrowhead`;
    let defs = rootSvg.querySelector(`#${defsId}`);
    if (defs) return markerId;
    defs = svg('defs', { id: defsId });
    const marker = svg('marker', {
      id: markerId, viewBox: '0 0 10 10', refX: 9, refY: 5,
      markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse'
    });
    marker.append(svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: 'context-stroke' }));
    defs.append(marker);
    rootSvg.prepend(defs);
    return markerId;
  }

  function ensureKeepArrowMarker(rootSvg, idPrefix, color) {
    const markerId = `${idPrefix}-keep-arrowhead`;
    let marker = rootSvg.querySelector(`#${markerId}`);
    if (marker) return markerId;
    let defs = rootSvg.querySelector('defs');
    if (!defs) {
      defs = svg('defs');
      rootSvg.prepend(defs);
    }
    marker = svg('marker', {
      id: markerId,
      viewBox: '0 0 10 10',
      refX: 0,
      refY: 5,
      markerWidth: 3,
      markerHeight: 3,
      markerUnits: 'strokeWidth',
      orient: 'auto-start-reverse'
    });
    marker.append(svg('path', { d: 'M 0 0 L 10 5 L 0 10 Z', fill: color }));
    defs.append(marker);
    return markerId;
  }

  function closestEdgePoints(from, to) {
    const fromCenter = anchorPoint(from, 'center');
    const toCenter = anchorPoint(to, 'center');
    const horizontal = Math.abs(toCenter.x - fromCenter.x) > Math.abs(toCenter.y - fromCenter.y);
    if (horizontal) {
      const movingRight = toCenter.x >= fromCenter.x;
      return {
        start: anchorPoint(from, movingRight ? 'right' : 'left'),
        end: anchorPoint(to, movingRight ? 'left' : 'right')
      };
    }
    const movingDown = toCenter.y >= fromCenter.y;
    return {
      start: anchorPoint(from, movingDown ? 'bottom' : 'top'),
      end: anchorPoint(to, movingDown ? 'top' : 'bottom')
    };
  }

  function renderKeepLastArrows(rootSvg, root, document, frame, placements, elements, keepNodes, options = {}) {
    if (!keepNodes.length) return;
    const color = 'rgba(255, 58, 58, 0.7)';
    const width = 4;
    const headShrink = 12;
    const markerId = ensureKeepArrowMarker(rootSvg, options.idPrefix || 'asm-trace', color);
    const layer = svg('g', {
      id: `${options.idPrefix || 'asm-trace'}-keep-arrows`,
      class: 'asm-trace-keep-arrows',
      'pointer-events': 'none'
    });
    const byVariable = new Map();
    keepNodes.forEach(node => {
      if (!byVariable.has(node.variableId)) byVariable.set(node.variableId, []);
      byVariable.get(node.variableId).push(node);
    });

    byVariable.forEach((nodes, variableId) => {
      const currentKey = objectKeyForVariable(frame, variableId);
      const current = placements.get(currentKey);
      if (!current || !elements.get(currentKey)) return;
      const stages = nodes.map(node => {
        const snapshotBox = placements.get(node.snapshotId);
        if (!snapshotBox) return null;
        return {
          key: node.snapshotId,
          placement: {
            x: snapshotBox.x + node.relative.x,
            y: snapshotBox.y + node.relative.y,
            width: node.relative.width,
            height: node.relative.height
          }
        };
      }).filter(Boolean);
      stages.push({ key: currentKey, placement: current });

      for (let index = 0; index < stages.length - 1; index += 1) {
        const fromStage = stages[index];
        const toStage = stages[index + 1];
        const points = closestEdgePoints(fromStage.placement, toStage.placement);
        const dx = points.end.x - points.start.x;
        const dy = points.end.y - points.start.y;
        const length = Math.hypot(dx, dy);
        if (length <= headShrink) continue;
        const end = {
          x: points.end.x - (dx / length) * headShrink,
          y: points.end.y - (dy / length) * headShrink
        };
        const key = `keep-arrow:${fromStage.key}:${variableId}`;
        const line = svg('line', {
          class: 'asm-trace-keep-arrow',
          x1: points.start.x,
          y1: points.start.y,
          x2: end.x,
          y2: end.y,
          stroke: color,
          'stroke-width': width,
          fill: 'none',
          'marker-end': `url(#${markerId})`,
          'data-trace-object-key': key,
          'data-trace-keep-source': fromStage.key,
          'data-trace-keep-target': toStage.key
        });
        layer.append(line);
        placements.set(key, {
          x: Math.min(points.start.x, points.end.x),
          y: Math.min(points.start.y, points.end.y),
          width: Math.max(1, Math.abs(points.end.x - points.start.x)),
          height: Math.max(1, Math.abs(points.end.y - points.start.y))
        });
        elements.set(key, line);
      }
    });
    if (layer.childElementCount) root.prepend(layer);
  }

  function arrowVisible(arrow, frame) {
    if (Array.isArray(arrow.frameIds) && arrow.frameIds.length && !arrow.frameIds.includes(frame.id)) return false;
    return window.ASMTraceRules.conditionMatches(frame, arrow.condition);
  }

  function studioObjectVisible(object, frame) {
    if (Array.isArray(object.frameIds) && object.frameIds.length && !object.frameIds.includes(frame.id)) return false;
    return window.ASMTraceRules.conditionMatches(frame, object.condition);
  }

  function targetPlacement(document, frame, placements, target = {}) {
    const objectKey = target.objectKey || target.key;
    if (objectKey && placements.has(objectKey)) return placements.get(objectKey);
    const variableId = target.variableId || target.targetVariableId;
    if (!variableId) return null;
    const targetObjectKey = objectKeyForVariable(frame, variableId);
    const expression = target.indexExpression;
    if (expression != null && String(expression).trim() !== '') {
      const parts = String(expression).split(',').map(part => part.trim()).filter(Boolean);
      const indices = parts.map(part => {
        const value = window.ASMTraceRules.resolveExpression(document, frame, part);
        return value == null ? NaN : Number(value);
      });
      if (!indices.length || indices.some(index => !Number.isInteger(index))) return null;
      if (target.axis === 'row' || target.axis === 'column') {
        const index = indices[0];
        const cell = placements.get(target.axis === 'row' ? `${targetObjectKey}#${index},0` : `${targetObjectKey}#0,${index}`);
        if (!cell) return null;
        if (target.axis === 'row') {
          return { x: cell.x - 22, y: cell.y, width: 16, height: cell.height };
        }
        return { x: cell.x, y: cell.y + cell.height + 3, width: cell.width, height: 16 };
      }
      const key = `${targetObjectKey}#${indices.join(',')}`;
      if (target.indexLabel === true) return placements.get(`${key}:index`) || placements.get(key) || null;
      return placements.get(key) || null;
    }
    return placements.get(targetObjectKey) || null;
  }

  function anchorPoint(placement, anchor = 'center') {
    if (!placement) return null;
    const normalized = String(anchor || 'center').toLowerCase();
    let x = placement.x + placement.width / 2;
    let y = placement.y + placement.height / 2;
    if (normalized.includes('left')) x = placement.x;
    if (normalized.includes('right')) x = placement.x + placement.width;
    if (normalized.includes('top')) y = placement.y;
    if (normalized.includes('bottom')) y = placement.y + placement.height;
    return { x, y };
  }

  function resolveAnchor(document, frame, target, placements = currentScene?.placements) {
    return anchorPoint(targetPlacement(document, frame, placements || new Map(), target), target?.anchor);
  }

  function resolvedTargetKey(document, frame, target) {
    const objectKey = target?.objectKey || target?.key;
    if (objectKey) return objectKey;
    const variableId = target?.variableId || target?.targetVariableId;
    if (!variableId) return '';
    const targetObjectKey = objectKeyForVariable(frame, variableId);
    const expression = String(target?.indexExpression ?? '').trim();
    if (!expression) return targetObjectKey;
    const indices = expression.split(',').map(part => Number(
      window.ASMTraceRules.resolveExpression(document, frame, part.trim())
    ));
    if (!indices.length || indices.some(index => !Number.isInteger(index))) return targetObjectKey;
    return `${targetObjectKey}#${indices.join(',')}`;
  }

  function translateWithin(element, stop) {
    let x = 0;
    let y = 0;
    let cursor = element;
    while (cursor && cursor !== stop) {
      const match = String(cursor.getAttribute?.('transform') || '').match(/translate\s*\(\s*([+\-\d.]+)(?:[\s,]+([+\-\d.]+))?/);
      if (match) {
        x += Number(match[1]) || 0;
        y += Number(match[2]) || 0;
      }
      cursor = cursor.parentElement;
    }
    return { x, y };
  }

  function collectElementPlacements(content, baseX, baseY, placements, elements) {
    content.querySelectorAll('[data-trace-object-key]').forEach(element => {
      const key = element.dataset.traceObjectKey;
      if (!key) return;
      const box = measuredBox(element, null);
      if (!box) return;
      const shift = translateWithin(element, content);
      placements.set(key, {
        x: baseX + box.x + shift.x,
        y: baseY + box.y + shift.y,
        width: box.width,
        height: box.height
      });
      elements.set(key, element);
      if (element.dataset.tracePositionX == null) {
        element.dataset.tracePositionSpace = 'bounds';
        element.dataset.tracePositionX = String(baseX + box.x + shift.x);
        element.dataset.tracePositionY = String(baseY + box.y + shift.y);
      }
    });
  }

  function translatedTransform(element, dx, dy) {
    const current = element.getAttribute('transform') || '';
    element.setAttribute('transform', `${current} translate(${dx}, ${dy})`.trim());
  }

  function shiftPlacementTree(source, dx, dy, placements, elements) {
    elements.forEach((element, key) => {
      if (element !== source && !source.contains(element)) return;
      const placement = placements.get(key);
      if (!placement) return;
      placements.set(key, { ...placement, x: placement.x + dx, y: placement.y + dy });
    });
  }

  function applyStoredPartPositions(document, frame, placements, elements) {
    const positions = document.studio?.positions?.[frame.id] || {};
    Object.entries(positions).forEach(([key, position]) => {
      const element = elements.get(key);
      const placement = placements.get(key);
      if (!element || !placement || element.dataset.tracePositionApplied === '1') return;
      const dx = position?.absolute === true ? (Number(position.x) || 0) - placement.x : Number(position?.x) || 0;
      const dy = position?.absolute === true ? (Number(position.y) || 0) - placement.y : Number(position?.y) || 0;
      if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
        translatedTransform(element, dx, dy);
        shiftPlacementTree(element, dx, dy, placements, elements);
      }
      const current = placements.get(key) || placement;
      element.dataset.tracePositionSpace = 'bounds';
      element.dataset.tracePositionX = String(current.x);
      element.dataset.tracePositionY = String(current.y);
    });
  }

  function applyVisibilityStates(document, frame, elements) {
    const states = document.studio?.visibility?.[frame.id] || {};
    const editing = window.document.body.classList.contains('asm-trace-studio-open');
    const hiddenElements = Object.entries(states)
      .filter(([, state]) => state === 'hidden')
      .map(([key]) => elements.get(key))
      .filter(Boolean);
    hiddenElements.forEach(element => {
      element.dataset.traceVisibility = 'hidden';
    });
    hiddenElements.forEach(element => {
      if (!editing) {
        element.setAttribute('display', 'none');
        return;
      }
      if (!element.parentElement?.closest('[data-trace-visibility="hidden"]')) {
        element.classList.add('trace-studio-hidden-object');
      }
    });
  }

  function applyObjectColorStyles(document, frame, elements) {
    const styles = document.studio?.objectStyles?.[frame.id] || {};
    Object.entries(styles).forEach(([key, style]) => {
      const element = elements.get(key);
      if (!element || !style) return;
      const fillTargets = element.matches?.('text, rect, circle, ellipse, polygon')
        ? [element]
        : [...element.querySelectorAll(':scope > rect, :scope > circle, :scope > ellipse, :scope > polygon, :scope > .asm-trace-motion > rect, :scope > .asm-trace-motion > circle, :scope > .asm-trace-motion > ellipse, :scope > .asm-trace-motion > polygon, :scope > .asm-trace-motion > g > rect, :scope > .asm-trace-motion > g > circle, :scope > .asm-trace-motion > g > polygon')];
      if (!fillTargets.length) fillTargets.push(...element.querySelectorAll('text'));
      const strokeTargets = element.matches?.('path, line, polyline, rect, circle, ellipse, polygon')
        ? [element]
        : [...element.querySelectorAll('path, line, polyline, rect, circle, ellipse, polygon')];
      if (style.fill) {
        fillTargets.forEach(target => {
          if (target.getAttribute('fill') !== 'none') target.setAttribute('fill', style.fill);
        });
        if (!fillTargets.length && element.matches?.('path, line, polyline')) {
          element.setAttribute('stroke', style.fill);
        }
      }
      if (style.stroke) {
        strokeTargets.forEach(target => {
          if (target.getAttribute('stroke') !== 'none') target.setAttribute('stroke', style.stroke);
        });
      }
    });
  }

  function applyBindings(document, frame, placements, elements) {
    const bindings = document.studio?.bindings?.[frame.id] || {};
    const applied = new Set();
    const applying = new Set();

    function applyOne(key) {
      if (applied.has(key) || applying.has(key)) return;
      const binding = bindings[key];
      const source = elements.get(key);
      if (!binding || !source) return;
      applying.add(key);
      applyOne(binding.targetKey);
      const sourcePlacement = placements.get(key);
      const targetPlacement = placements.get(binding.targetKey);
      if (sourcePlacement && targetPlacement && binding.targetKey !== key) {
        const sourcePoint = anchorPoint(sourcePlacement, binding.sourceAnchor || 'top');
        const targetPoint = anchorPoint(targetPlacement, binding.targetAnchor || 'center');
        const dx = targetPoint.x + (Number(binding.dx) || 0) - sourcePoint.x;
        const dy = targetPoint.y + (Number(binding.dy) || 0) - sourcePoint.y;
        if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
          translatedTransform(source, dx, dy);
          shiftPlacementTree(source, dx, dy, placements, elements);
        }
        source.dataset.traceBound = '1';
        source.dataset.traceBindingTarget = binding.targetKey;
        source.dataset.traceBindingSourceAnchor = binding.sourceAnchor || 'top';
        source.dataset.traceBindingTargetAnchor = binding.targetAnchor || 'center';
        source.dataset.studioOffset = `${Number(binding.dx) || 0},${Number(binding.dy) || 0}`;
      }
      applying.delete(key);
      applied.add(key);
    }

    Object.keys(bindings).forEach(applyOne);
  }

  function animatePartPositions(placements, elements, options = {}) {
    elements.forEach((element, key) => {
      const placement = placements.get(key);
      if (!placement) return;
      if (element.dataset.tracePositionApplied === '1') {
        element.setAttribute('data-trace-render-position', `${placement.x},${placement.y}`);
        return;
      }
      element.setAttribute('data-trace-render-position', `${placement.x},${placement.y}`);
      if (options.animatePositions === false) return;
      const { plan, previous } = previousPositionForKey(options, key);
      if (!previous && !plan?.explicit) return;
      animatePosition(element, previous, placement, true, plan, true);
    });
  }

  function animateSwapEvents(document, frame, placements, elements, enabled) {
    if (!enabled || eventAnimation('swap') !== 'swap') return;
    (frame.events || []).filter(event => event.type === 'swap').forEach(event => {
      const targets = (event.targets || []).filter(target => target.variableId && target.indexExpression);
      if (targets.length < 2 || targets[0].variableId !== targets[1].variableId) return;
      const indices = targets.slice(0, 2).map(target => {
        const value = window.ASMTraceRules.resolveExpression(document, frame, target.indexExpression);
        return value == null ? NaN : Number(value);
      });
      if (indices.some(index => !Number.isInteger(index)) || indices[0] === indices[1]) return;
      const keys = indices.map(index => `${targets[0].variableId}#${index}`);
      const cells = keys.map(key => elements.get(key));
      const boxes = keys.map(key => placements.get(key));
      if (cells.some(cell => !cell) || boxes.some(box => !box)) return;
      cells.forEach((cell, index) => {
        const other = boxes[1 - index];
        const current = boxes[index];
        const dx = other.x - current.x;
        const dy = other.y - current.y;
        const animation = svg('animateTransform', {
          attributeName: 'transform', type: 'translate', additive: 'sum',
          from: `${dx} ${dy}`, to: '0 0',
          begin: 'indefinite', keyTimes: '0;1', dur: '520ms', fill: 'freeze', calcMode: 'spline',
          keySplines: '0.22 1 0.36 1'
        });
        cell.prepend(animation);
        startSvgAnimation(animation);
      });
    });
  }

  function applyFixedEventStyles(document, frame, highlights) {
    // @keep last renders a cloned frame. Match by stable frame ID instead of
    // object identity so accumulated marks are retained inside the snapshot.
    const currentIndex = document.frames?.findIndex(item => item.id === frame?.id) ?? -1;
    if (currentIndex < 0) return;
    document.frames.slice(0, currentIndex + 1).forEach(sourceFrame => {
      (sourceFrame.events || []).filter(event => event.type === 'fixed').forEach(event => {
        (event.targets || []).forEach(target => {
          if (!target.variableId || target.indexExpression == null) return;
          const index = Number(window.ASMTraceRules.resolveExpression(document, frame, target.indexExpression));
          if (!Number.isInteger(index)) return;
          highlights[target.variableId] ||= {};
          highlights[target.variableId][String(index)] = {
            ...(highlights[target.variableId][String(index)] || {}),
            fixedMark: '#4caf50'
          };
        });
      });
    });
  }

  function delayedCurrentFixedMarks(root, document, frame, enabled) {
    if (!enabled) return [];
    const targetKeys = new Set();
    (frame.events || []).filter(event => event.type === 'fixed').forEach(event => {
      (event.targets || []).forEach(target => {
        if (!target.variableId || target.indexExpression == null) return;
        const index = Number(window.ASMTraceRules.resolveExpression(document, frame, target.indexExpression));
        if (Number.isInteger(index)) targetKeys.add(`${target.variableId}#${index}`);
      });
    });
    if (!targetKeys.size) return [];
    return [...root.querySelectorAll('[data-trace-attachment-kind="mark"]')]
      .filter(mark => targetKeys.has(mark.dataset.traceAttachedTo || ''))
      .map(mark => {
        const opacity = mark.getAttribute('opacity');
        mark.setAttribute('opacity', '0');
        return { mark, opacity };
      });
  }

  function revealDelayedFixedMarks(entries) {
    entries.forEach(({ mark, opacity }) => {
      if (!mark?.isConnected) return;
      if (opacity == null) mark.removeAttribute('opacity');
      else mark.setAttribute('opacity', opacity);
    });
  }

  function animateEventTargets(document, frame, placements, elements, enabled) {
    if (!enabled) return;
    const animationClasses = {
      lift: 'trace-lift',
      pulse: 'trace-pulse',
      fade: 'trace-fade'
    };
    (frame.events || []).forEach(event => {
      if (event.animate === false) return;
      const animation = eventAnimation(event.type);
      if (event.type === 'swap' && animation === 'swap') return;
      const className = animationClasses[animation];
      if (!className) return;
      (event.targets || []).forEach(target => {
        if (!target.variableId) return;
        const index = target.indexExpression
          ? window.ASMTraceRules.resolveExpression(document, frame, target.indexExpression)
          : null;
        const key = Number.isInteger(Number(index))
          ? `${target.variableId}#${Number(index)}`
          : target.variableId;
        const element = elements.get(key) || elements.get(target.variableId);
        element?.classList.add(className);
      });
    });
  }

  function renderStudioObjects(root, document, frame, placements, elements, options = {}, sourceObjects = null) {
    const objects = (sourceObjects || document.studio?.objects || []).filter(object => studioObjectVisible(object, frame));
    objects.forEach(studioObject => {
      const target = resolveAnchor(document, frame, studioObject.target, placements);
      if (!target) return;
      const pointerTarget = studioObject.pointerTarget
        ? resolveAnchor(document, frame, studioObject.pointerTarget, placements)
        : target;
      const key = `studio:${studioObject.id}`;
      const position = studioPosition(document, frame, key);
      const offsetX = (Number(studioObject.offsetX) || 0) + position.x;
      const offsetY = (Number(studioObject.offsetY) || 0) + position.y;
      const baseX = target.x + offsetX;
      const baseY = target.y + offsetY;
      const object = markSelectable(svg('g', {
        id: `${options.idPrefix || 'trace'}-studio-${String(studioObject.id).replace(/[^A-Za-z0-9_-]/g, '-')}`,
        class: 'asm-trace-object asm-trace-bound-object',
        transform: `translate(${baseX}, ${baseY})`,
        'data-base-offset': `${baseX},${baseY}`,
        'data-studio-offset': `${position.x},${position.y}`,
        'data-trace-bound': '1',
        'data-translate': '0,0',
        'data-trace-object-key': key
      }), key, { ...options, movable: true });
      object.dataset.tracePositionApplied = '1';
      object.dataset.tracePositionSpace = 'origin';
      object.dataset.tracePositionX = String(position.x);
      object.dataset.tracePositionY = String(position.y);
      if (studioObject.sourceVariableId) {
        object.dataset.traceSourceVariableId = studioObject.sourceVariableId;
      }
      const boundTargetKey = resolvedTargetKey(document, frame, studioObject.target);
      if (boundTargetKey) object.dataset.traceBindingTarget = boundTargetKey;
      const motion = svg('g', { class: 'asm-trace-motion' });
      object.append(motion);
      let box;
      if (studioObject.type === 'repeat-cells') {
        const raw = window.ASMTraceRules.resolveExpression(document, frame, studioObject.countExpression);
        const count = Math.max(0, Math.min(100, Math.floor(Number(raw) || 0)));
        if (!count) return;
        const width = Math.max(18, Math.min(52, Number(studioObject.cellWidth) || 28));
        const height = Math.max(18, Math.min(64, Number(studioObject.cellHeight) || 34));
        const gap = Number(studioObject.gap) || 0;
        const totalWidth = count * width + Math.max(0, count - 1) * gap;
        for (let index = 0; index < count; index += 1) {
          const cellKey = `${key}#${index}`;
          motion.append(markSelectable(svg('rect', {
            x: -totalWidth / 2 + index * (width + gap), y: -height / 2,
            width, height,
            fill: studioObject.color || '#dcecff',
            stroke: studioObject.stroke || '#3976b8',
            'stroke-width': 1,
            'data-trace-generated-index': index
          }), cellKey, options, key));
        }
        box = { x: -totalWidth / 2, y: -height / 2, width: totalWidth, height };
      } else if (studioObject.type === 'variable-marker') {
        const source = document.variables?.[studioObject.sourceVariableId];
        const sourceEntry = frame.state?.[studioObject.sourceVariableId];
        const label = studioObject.text || source?.name || 'index';
        const shape = studioObject.shape || 'array';
        if (shape === 'arrow') {
          const labelWidth = 18;
          const labelHeight = labelWidth;
          const labelLength = Math.max(1, Array.from(String(label)).length);
          const fontSize = Math.max(4, Math.min(8, (labelWidth - 4) / (labelLength * 0.62)));
          // Mirrors a normal draw_array cell: #333 with a 1px outline.
          const borderColor = '#333';
          const borderWidth = 1;
          const labelTop = -40;
          const labelBottom = labelTop + labelHeight;
          const arrowTop = labelBottom;
          const halfLabelWidth = labelWidth / 2;
          // Aim at the cell center while keeping every rendered arrow the same length.
          const aimX = (pointerTarget?.x ?? target.x) - target.x - offsetX;
          const aimY = (pointerTarget?.y ?? target.y) - target.y - offsetY;
          const directionX = aimX;
          const directionY = aimY - arrowTop;
          const directionLength = Math.max(0.001, Math.hypot(directionX, directionY));
          const unitX = directionX / directionLength;
          const unitY = directionY / directionLength;
          const perpendicularX = -unitY;
          const perpendicularY = unitX;
          const arrowLength = 20;
          const pointerX = unitX * arrowLength;
          const pointerY = arrowTop + unitY * arrowLength;
          const headLength = 6;
          const headHalfWidth = 3;
          const headBaseX = pointerX - unitX * headLength;
          const headBaseY = pointerY - unitY * headLength;
          const headLeftX = headBaseX + perpendicularX * headHalfWidth;
          const headLeftY = headBaseY + perpendicularY * headHalfWidth;
          const headRightX = headBaseX - perpendicularX * headHalfWidth;
          const headRightY = headBaseY - perpendicularY * headHalfWidth;
          motion.append(
            svg('rect', {
              x: -labelWidth / 2,
              y: labelTop,
              width: labelWidth,
              height: labelHeight,
              rx: 0,
              fill: '#bfe8f7',
              'fill-opacity': 0.58,
              stroke: borderColor,
              'stroke-width': borderWidth
            }),
            svg('text', {
              x: 0, y: labelTop + labelHeight / 2, 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'font-family': 'Arial', 'font-size': fontSize,
              'font-weight': 'bold', fill: studioObject.textColor || '#1f282d'
            }, label)
          );
          const point = svg('g', { class: 'trace-variable-marker-point' });
          point.append(svg('path', {
            d: `M 0 ${arrowTop} L ${pointerX} ${pointerY} M ${headLeftX} ${headLeftY} L ${pointerX} ${pointerY} L ${headRightX} ${headRightY}`,
            fill: 'none',
            stroke: borderColor,
            'stroke-width': borderWidth,
            'stroke-linecap': 'square',
            'stroke-linejoin': 'miter'
          }));
          motion.append(point);
          const boxLeft = Math.min(-halfLabelWidth, pointerX, headLeftX, headRightX);
          const boxTop = Math.min(labelTop, pointerY, headLeftY, headRightY);
          const boxRight = Math.max(halfLabelWidth, pointerX, headLeftX, headRightX);
          const boxBottom = Math.max(labelBottom, pointerY, headLeftY, headRightY);
          box = { x: boxLeft, y: boxTop, width: boxRight - boxLeft, height: boxBottom - boxTop };
        } else {
          const content = svg('g');
          motion.append(content);
          const sourceSkin = document.skins?.[studioObject.sourceVariableId] || {};
          const rendererName = sourceSkin.renderer || source?.kind || sourceEntry?.data?.kind || 'object';
          const renderer = renderers.get(rendererName) || renderers.get(sourceEntry?.data?.kind) || renderObject;
          const height = renderer(content, sourceEntry, {
            variable: { ...(source || {}), name: label },
            variableId: key,
            skin: sourceSkin,
            rendererName,
            highlights: {},
            diff: [],
            idPrefix: `${options.idPrefix || 'trace'}-marker-original`,
            interactive: options.interactive
          });
          const originalBox = measuredBox(content, { x: 0, y: 0, width: 56, height: Number(height) || 92 });
          const offsetX = -originalBox.x - originalBox.width / 2;
          const offsetY = -originalBox.y - originalBox.height - 8;
          content.setAttribute('transform', `translate(${offsetX}, ${offsetY})`);
          box = {
            x: -originalBox.width / 2,
            y: -originalBox.height - 8,
            width: originalBox.width,
            height: originalBox.height
          };
        }
      } else {
        const source = document.variables?.[studioObject.sourceVariableId];
        const label = studioObject.text || source?.name || '標記';
        const width = Math.max(28, Math.min(120, 18 + String(label).length * 10));
        motion.append(
          svg('rect', { x: -width / 2, y: -28, width, height: 24, rx: 4, fill: studioObject.color || '#1d8f83' }),
          svg('text', {
            x: 0, y: -11, 'text-anchor': 'middle', 'font-family': 'Arial', 'font-size': 16,
            'font-weight': 'bold', fill: studioObject.textColor || '#ffffff'
          }, label),
          svg('path', { d: 'M -5 -4 L 5 -4 L 0 3 Z', fill: studioObject.color || '#1d8f83' })
        );
        box = { x: -width / 2, y: -28, width, height: 31 };
      }
      root.append(object);
      animateObjectPosition(motion, options, key, { x: baseX, y: baseY });
      placements.set(key, { x: baseX + box.x, y: baseY + box.y, width: box.width, height: box.height });
      elements.set(key, object);
      collectElementPlacements(motion, baseX, baseY, placements, elements);
    });
  }

  function renderFrameBindings(root, document, frame, placements, elements, options = {}) {
    const bindings = Array.isArray(frame.bindings) ? frame.bindings : [];
    if (!bindings.length) return;
    const pending = [];

    bindings.forEach((binding, index) => {
      const sourceEntry = frame.state?.[binding.sourceVariableId];
      const targetEntry = frame.state?.[binding.targetVariableId];
      const targetItems = Array.isArray(targetEntry?.data?.items) ? targetEntry.data.items : [];
      const targetKind = targetEntry?.data?.kind;
      const indexExpression = binding.indexExpression || binding.sourceName;
      const indexValue = Number(window.ASMTraceRules.resolveExpression(document, frame, indexExpression));
      if (binding.mode !== 'index'
        || !targetEntry
        || targetKind === 'matrix'
        || !Number.isInteger(indexValue)
        || indexValue < 0
        || indexValue >= targetItems.length) return;

      const label = binding.indexExpression
        || binding.sourceName
        || document.variables?.[binding.sourceVariableId]?.name
        || 'index';
      pending.push({
        id: `auto-frame-binding-${binding.sourceVariableId}-${binding.targetVariableId}-${index}`,
        type: 'variable-marker',
        sourceVariableId: binding.sourceVariableId,
        targetVariableId: binding.targetVariableId,
        indexValue,
        label,
        labelWidth: 18,
        target: {
          variableId: binding.targetVariableId,
          indexExpression: String(indexValue),
          anchor: 'top'
        },
        pointerTarget: {
          variableId: binding.targetVariableId,
          indexExpression: String(indexValue),
          anchor: 'center'
        },
        text: label,
        shape: 'arrow',
        color: '#12a6df',
        stroke: '#0b7ead'
      });
    });

    const groups = new Map();
    pending.forEach(item => {
      const groupKey = `${item.targetVariableId}#${item.indexValue}`;
      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey).push(item);
    });

    const objects = [];
    groups.forEach(group => {
      const gap = 8;
      const totalWidth = group.reduce((total, item) => total + item.labelWidth, 0)
        + Math.max(0, group.length - 1) * gap;
      let cursor = -totalWidth / 2;
      group.forEach(item => {
        item.offsetX = cursor + item.labelWidth / 2;
        cursor += item.labelWidth + gap;
        const { targetVariableId, indexValue, labelWidth, label, ...object } = item;
        objects.push(object);
      });
    });

    if (objects.length) renderStudioObjects(root, document, frame, placements, elements, options, objects);
  }

  function renderStudioArrows(rootSvg, root, document, frame, placements, elements, options = {}) {
    const arrows = Array.isArray(document.studio?.arrows) ? document.studio.arrows : [];
    if (!arrows.length) return;
    const markerId = ensureArrowMarker(rootSvg, options.idPrefix || 'asm-trace');
    const layer = svg('g', { id: `${options.idPrefix || 'asm-trace'}-studio-arrows` });
    arrows.filter(arrow => arrowVisible(arrow, frame)).forEach(arrow => {
      const fromTarget = arrow.from || { variableId: arrow.fromVariableId, anchor: 'right' };
      const toTarget = arrow.to || { variableId: arrow.toVariableId, anchor: 'left' };
      const from = targetPlacement(document, frame, placements, fromTarget);
      const to = targetPlacement(document, frame, placements, toTarget);
      if (!from || !to) return;
      const color = arrow.color || '#e53935';
      const start = anchorPoint(from, fromTarget.anchor || 'right');
      const end = anchorPoint(to, toTarget.anchor || 'left');
      const key = `arrow:${arrow.id}`;
      const attributes = {
        id: `trace-arrow-${String(arrow.id).replace(/[^A-Za-z0-9_-]/g, '-')}`,
        stroke: color, 'stroke-width': arrow.width || 3, fill: 'none',
        'marker-end': `url(#${markerId})`, 'data-trace-arrow': arrow.id,
        'data-trace-object-key': key
      };
      const withinSameObject = fromTarget.variableId === toTarget.variableId
        && fromTarget.indexExpression && toTarget.indexExpression;
      if (withinSameObject) {
        const lift = Math.max(24, Math.min(70, Math.abs(end.x - start.x) * 0.45));
        layer.append(markSelectable(svg('path', {
          ...attributes,
          d: `M ${start.x} ${start.y} C ${start.x} ${start.y - lift}, ${end.x} ${end.y - lift}, ${end.x} ${end.y}`
        }), key, { ...options, movable: true }));
      } else {
        layer.append(markSelectable(svg('line', {
          ...attributes, x1: start.x, y1: start.y, x2: end.x, y2: end.y
        }), key, { ...options, movable: true }));
      }
      placements.set(key, {
        x: Math.min(start.x, end.x), y: Math.min(start.y, end.y) - (withinSameObject ? 28 : 0),
        width: Math.max(1, Math.abs(end.x - start.x)),
        height: Math.max(1, Math.abs(end.y - start.y) + (withinSameObject ? 28 : 0))
      });
      elements.set(key, layer.lastElementChild);
    });
    root.prepend(layer);
  }

  function renderDecorations(root, document, frame, startY, placements, elements, options = {}) {
    let y = startY;
    for (const decoration of window.ASMTraceRules.decorations(document, frame)) {
      if (decoration.count <= 0) continue;
      const key = `rule:${decoration.ruleId}`;
      const position = studioPosition(document, frame, key);
      const baseX = position.x;
      const baseY = position.absolute ? position.y : y + position.y;
      const object = markSelectable(svg('g', {
        id: `${options.idPrefix || 'trace'}-decoration-${String(decoration.ruleId).replace(/[^A-Za-z0-9_-]/g, '-')}`,
        class: 'asm-trace-object asm-trace-decoration',
        transform: `translate(${baseX}, ${baseY})`,
        'data-base-offset': `${baseX},${baseY}`,
        'data-translate': '0,0',
        'data-trace-object-key': key
      }), key, { ...options, movable: true });
      object.dataset.tracePositionApplied = '1';
      object.dataset.tracePositionSpace = 'origin';
      object.dataset.tracePositionX = String(baseX);
      object.dataset.tracePositionY = String(baseY);
      const motion = svg('g', { class: 'asm-trace-motion' });
      const content = svg('g');
      motion.append(content);
      object.append(motion);
      const items = Array.from({ length: decoration.count }, () => ({ kind: 'scalar', value: '' }));
      const decorationHighlights = Object.fromEntries(items.map((item, index) => [String(index), {
        fill: decoration.color || '#dcecff',
        stroke: decoration.stroke || '#3976b8'
      }]));
      const height = renderOriginal(content, { data: { kind: 'sequence', items } }, {
        variable: { kind: 'sequence', name: decoration.label || '條件產生物件' }, variableId: key,
        skin: { options: { showIndex: false, gap: Number(decoration.gap) || 0 } },
        rendererName: 'original-array', highlights: decorationHighlights, diff: [],
        idPrefix: `${options.idPrefix || 'trace'}-original`, interactive: options.interactive
      });
      root.append(object);
      animateObjectPosition(motion, options, key, { x: baseX, y: baseY });
      const box = measuredBox(content, { x: 0, y: 0, width: Math.max(40, decoration.count * 40), height });
      placements.set(key, { x: baseX + box.x, y: baseY + box.y, width: box.width, height: box.height });
      elements.set(key, object);
      collectElementPlacements(content, baseX, baseY, placements, elements);
      y += Math.max(76, Number(height) || 76) + 28;
    }
    return y;
  }

  function renderSnapshots(root, document, frame, startY, placements, elements, options = {}, keepNodes = []) {
    const snapshotsById = new Map((document.snapshots || []).map(snapshot => [snapshot.id, snapshot]));
    const visibilityStates = document.studio?.visibility?.[frame.id] || {};
    const editingVisibility = window.document.body.classList.contains('asm-trace-studio-open');
    let y = startY;
    (frame.snapshotIds || []).forEach(snapshotId => {
      const snapshot = snapshotsById.get(snapshotId);
      if (!snapshot || (!editingVisibility && visibilityStates[snapshotId] === 'hidden')) return;
      if (snapshot.kind === 'frame' && snapshot.frame) {
        const position = studioPosition(document, frame, snapshotId);
        const baseX = position.x;
        const baseY = position.absolute ? position.y : y + position.y;
        const object = markSelectable(svg('g', {
          id: `${options.idPrefix || 'trace'}-${safeKey(snapshotId)}`,
          class: 'asm-trace-object asm-trace-snapshot asm-trace-frame-snapshot',
          transform: `translate(${baseX}, ${baseY})`,
          'data-base-offset': `${baseX},${baseY}`,
          'data-translate': '0,0',
          'data-trace-snapshot': snapshotId,
          'data-trace-object-key': snapshotId
        }), snapshotId, { ...options, movable: true });
        object.dataset.tracePositionApplied = '1';
        object.dataset.tracePositionSpace = 'origin';
        object.dataset.tracePositionX = String(baseX);
        object.dataset.tracePositionY = String(baseY);
        const motion = svg('g', { class: 'asm-trace-motion' });
        const content = svg('g');
        motion.append(content);
        object.append(motion);
        root.append(object);
        const sourceIndex = document.frames?.findIndex(item => item.id === snapshot.sourceFrameId) ?? -1;
        const frozenFrame = { ...snapshot.frame, snapshotIds: [] };
        const frozenScene = renderScene(
          root.ownerSVGElement,
          content,
          document,
          frozenFrame,
          sourceIndex > 0 ? document.frames[sourceIndex - 1] : null,
          {
            idPrefix: `${options.idPrefix || 'trace'}-${safeKey(snapshotId)}`,
            interactive: false,
            animatePositions: false,
            transform: ''
          }
        );
        const contentBox = measuredBox(content, { x: 0, y: 0, width: 180, height: 100 });
        animateObjectPosition(motion, options, snapshotId, { x: baseX, y: baseY });
        placements.set(snapshotId, {
          x: baseX + contentBox.x,
          y: baseY + contentBox.y,
          width: contentBox.width,
          height: contentBox.height
        });
        elements.set(snapshotId, object);
        Object.keys(snapshot.frame.state || {}).forEach(variableId => {
          const sourceKey = objectKeyForVariable(snapshot.frame, variableId);
          const sourcePlacement = frozenScene.placements.get(sourceKey);
          const sourceElement = frozenScene.elements.get(sourceKey);
          if (!sourcePlacement || !sourceElement) return;
          keepNodes.push({
            snapshotId,
            variableId,
            relative: {
              x: sourcePlacement.x - contentBox.x,
              y: sourcePlacement.y - contentBox.y,
              width: sourcePlacement.width,
              height: sourcePlacement.height
            }
          });
        });
        y += Math.max(76, contentBox.height) + 28;
        return;
      }
      const sourceVariable = document.variables?.[snapshot.sourceVariableId] || {};
      const variable = { ...sourceVariable, id: snapshotId, name: snapshot.label || sourceVariable.name || 'Snapshot' };
      const entry = { name: variable.name, data: snapshot.data };
      const skin = document.skins?.[snapshot.sourceVariableId] || {};
      const rendererName = skin.renderer || variable.kind || entry.data?.kind || 'object';
      const renderer = renderers.get(rendererName) || renderers.get(entry.data?.kind) || renderObject;
      const position = studioPosition(document, frame, snapshotId);
      const baseX = position.x;
      const baseY = position.absolute ? position.y : y + position.y;
      const object = markSelectable(svg('g', {
        id: `${options.idPrefix || 'trace'}-${safeKey(snapshotId)}`,
        class: 'asm-trace-object asm-trace-snapshot',
        transform: `translate(${baseX}, ${baseY})`,
        'data-base-offset': `${baseX},${baseY}`,
        'data-translate': '0,0',
        'data-trace-variable': snapshotId,
        'data-trace-snapshot': snapshotId,
        'data-trace-object-key': snapshotId
      }), snapshotId, { ...options, movable: true });
      object.dataset.tracePositionApplied = '1';
      object.dataset.tracePositionSpace = 'origin';
      object.dataset.tracePositionX = String(baseX);
      object.dataset.tracePositionY = String(baseY);
      const motion = svg('g', { class: 'asm-trace-motion' });
      const content = svg('g');
      motion.append(content);
      object.append(motion);
      root.append(object);
      let height = renderer(content, entry, {
        variable, variableId: snapshotId, skin, rendererName,
        highlights: {}, diff: [],
        idPrefix: `${options.idPrefix || 'trace'}-snapshot`, interactive: options.interactive
      });
      const contentBox = measuredBox(content, { x: 0, y: 0, width: 180, height: Number(height) || 76 });
      if (!content.querySelector(':scope > .outerframe-label')) {
        const labelY = Math.max(Number(height) || 0, contentBox.y + contentBox.height) + 20;
        motion.append(markSelectable(svg('text', {
          x: contentBox.x + contentBox.width / 2,
          y: labelY,
          'text-anchor': 'middle',
          'font-family': 'Arial',
          'font-size': 16,
          'font-weight': 'bold',
          fill: '#384348'
        }, variable.name), `${snapshotId}:label`, options, snapshotId));
        height = Math.max(Number(height) || 0, labelY + 8);
      } else {
        height = Math.max(Number(height) || 0, contentBox.y + contentBox.height);
      }
      animateObjectPosition(motion, options, snapshotId, { x: baseX, y: baseY });
      const box = measuredBox(object, {
        x: contentBox.x,
        y: Math.min(-20, contentBox.y),
        width: contentBox.width,
        height: Math.max(76, Number(height) || 76, contentBox.height)
      });
      placements.set(snapshotId, { x: baseX + box.x, y: baseY + box.y, width: box.width, height: box.height });
      elements.set(snapshotId, object);
      collectElementPlacements(motion, baseX, baseY, placements, elements);
      y += Math.max(76, Number(height) || 76) + 28;
    });
    return y;
  }

  function renderScene(rootSvg, parent, document, frame, previousFrame = null, options = {}) {
    const idPrefix = options.idPrefix || 'trace';
    const rootAttributes = { transform: options.transform == null ? 'translate(90, 80)' : options.transform };
    if (options.rootId) rootAttributes.id = options.rootId;
    const root = svg('g', rootAttributes);
    parent.append(root);
    const highlights = window.ASMTraceRules.evaluate(document, frame);
    applyFixedEventStyles(document, frame, highlights);
    const diff = window.ASMTraceModel.diffFrame(previousFrame, frame);
    const placements = new Map();
    const elements = new Map();
    const editingVisibility = window.document.body.classList.contains('asm-trace-studio-open');
    const visibilityStates = document.studio?.visibility?.[frame.id] || {};
    const hiddenVariables = new Set((document.studio?.objects || [])
      .filter(object => object.hideSource && object.sourceVariableId && studioObjectVisible(object, frame))
      .map(object => object.sourceVariableId));
    (frame.bindings || []).forEach(binding => {
      if (binding.mode !== 'index') return;
      const sourceVariableIds = binding.sourceVariableIds || [binding.sourceVariableId];
      sourceVariableIds.filter(Boolean).forEach(variableId => hiddenVariables.add(variableId));
    });
    const keepNodes = [];
    let y = renderSnapshots(root, document, frame, 0, placements, elements, options, keepNodes);
    Object.entries(document.variables || {}).forEach(([variableId, variable]) => {
      const entry = frame.state?.[variableId];
      const objectKey = objectKeyForVariable(frame, variableId);
      if (!entry || hiddenVariables.has(variableId)
        || (!editingVisibility && visibilityStates[objectKey] === 'hidden')) return;
      const skin = document.skins?.[variableId] || {};
      const rendererName = skin.renderer || variable.kind || entry.data?.kind || 'object';
      const renderer = renderers.get(rendererName) || renderers.get(entry.data?.kind) || renderObject;
      const position = studioPosition(document, frame, objectKey);
      const baseX = position.x;
      const baseY = position.absolute ? position.y : y + position.y;
      const object = markSelectable(svg('g', {
        id: `${idPrefix}-${objectKey.replace(/[^A-Za-z0-9_-]/g, '-')}`,
        class: 'asm-trace-object',
        transform: `translate(${baseX}, ${baseY})`,
        'data-base-offset': `${baseX},${baseY}`,
        'data-translate': '0,0',
        'data-trace-variable': variableId,
        'data-trace-object-key': objectKey,
        'data-trace-object-id': objectKey
      }), objectKey, { ...options, movable: true });
      object.dataset.tracePositionApplied = '1';
      object.dataset.tracePositionSpace = 'origin';
      object.dataset.tracePositionX = String(baseX);
      object.dataset.tracePositionY = String(baseY);
      const motion = svg('g', { class: 'asm-trace-motion' });
      const content = svg('g');
      motion.append(content);
      object.append(motion);
      root.append(object);
      let height = renderer(content, entry, {
        variable, variableId: objectKey, skin, rendererName,
        highlights: highlights[variableId] || {}, diff,
        idPrefix: `${idPrefix}-original`, interactive: options.interactive
      });
      const contentBox = measuredBox(content, { x: 0, y: 0, width: 180, height: Number(height) || 76 });
      if (!content.querySelector(':scope > .outerframe-label')) {
        const labelY = Math.max(Number(height) || 0, contentBox.y + contentBox.height) + 20;
        motion.append(markSelectable(svg('text', {
          x: contentBox.x + contentBox.width / 2,
          y: labelY,
          'text-anchor': 'middle',
          'font-family': 'Arial',
          'font-size': 16,
          'font-weight': 'bold',
          fill: '#384348'
        }, variable.name), `${objectKey}:label`, options, variableId));
        height = Math.max(Number(height) || 0, labelY + 8);
      } else {
        height = Math.max(Number(height) || 0, contentBox.y + contentBox.height);
      }
      animateObjectPosition(motion, options, objectKey, { x: baseX, y: baseY });
      const box = measuredBox(object, {
        x: contentBox.x,
        y: Math.min(-20, contentBox.y),
        width: contentBox.width,
        height: Math.max(76, Number(height) || 76, contentBox.height)
      });
      placements.set(objectKey, { x: baseX + box.x, y: baseY + box.y, width: box.width, height: box.height });
      elements.set(objectKey, object);
      collectElementPlacements(motion, baseX, baseY, placements, elements);
      y += Math.max(76, Number(height) || 76) + 28;
    });
    y = renderDecorations(root, document, frame, y, placements, elements, options);
    renderStudioObjects(root, document, frame, placements, elements, options);
    renderFrameBindings(root, document, frame, placements, elements, options);
    renderStudioArrows(rootSvg, root, document, frame, placements, elements, options);
    applyStoredPartPositions(document, frame, placements, elements);
    applyBindings(document, frame, placements, elements);
    renderKeepLastArrows(rootSvg, root, document, frame, placements, elements, keepNodes, options);
    applyObjectColorStyles(document, frame, elements);
    applyVisibilityStates(document, frame, elements);
    const transitionEventFrame = Number(options.direction) < 0 && previousFrame ? previousFrame : frame;
    const eventAnimationsEnabled = options.interactive !== false && options.animateEvents !== false;
    animateSwapEvents(document, transitionEventFrame, placements, elements,
      eventAnimationsEnabled && options.animatePositions !== false);
    animateEventTargets(document, transitionEventFrame, placements, elements,
      eventAnimationsEnabled);
    animatePartPositions(placements, elements, options);
    return { root, placements, elements, height: y };
  }

  function renderFrame(document, frame, previousFrame = null, options = {}) {
    const rootSvg = document && window.document.getElementById('arraySvg');
    if (!rootSvg || !frame) return Promise.resolve();
    window.ASMTraceFrameTween?.cancel?.();
    const previousPositions = objectPositions(rootSvg);
    const previousObjects = captureTopLevelObjects(rootSvg);
    const sourceKeys = new Set(previousPositions.keys());
    const transitionForKey = key => previousFrame
      ? window.ASMTraceTransitions?.resolve?.(document, previousFrame, frame, key, sourceKeys)
      : null;
    const useFrameTween = Boolean(
      previousFrame
      && options.animatePositions !== false
      && window.ASMTraceFrameTween?.play
    );
    if (typeof window.clearCanvas === 'function') window.clearCanvas();
    rootSvg.querySelector('#asm-trace-root')?.remove();
    const viewport = window.getViewport?.() || rootSvg;
    const result = renderScene(rootSvg, viewport, document, frame, previousFrame, {
      rootId: 'asm-trace-root',
      idPrefix: 'trace',
      interactive: true,
      transform: `translate(${TRACE_ROOT_OFFSET.x}, ${TRACE_ROOT_OFFSET.y})`,
      previousPositions,
      transitionForKey,
      direction: options.direction,
      animatePositions: useFrameTween ? false : options.animatePositions !== false,
      animateEvents: options.animateEvents !== false
    });
    const delayedMarks = delayedCurrentFixedMarks(result.root, document, frame, useFrameTween);
    let transition = Promise.resolve();
    if (useFrameTween) {
      const defaults = window.ASMTraceTransitions?.defaults?.(document) || { duration: 520 };
      transition = window.ASMTraceFrameTween.play({
        root: result.root,
        document,
        frame,
        eventFrame: Number(options.direction) < 0 ? previousFrame : frame,
        direction: options.direction,
        previousFrame,
        previousPlacements: previousPositions,
        currentPlacements: result.placements,
        previousObjects,
        currentElements: result.elements,
        transitionForKey,
        duration: defaults.duration
      });
    } else if (previousFrame) {
      const transitionOptions = {
        frame,
        previousPositions,
        transitionForKey,
        animatePositions: options.animatePositions !== false
      };
      animateChangedObjects(previousObjects, result.elements, transitionOptions);
      animateRemovedObjects(result.root, previousObjects, result.elements, document, transitionOptions);
    }
    currentScene = { document, frame, placements: result.placements, elements: result.elements, rootOffset: TRACE_ROOT_OFFSET };
    transition = Promise.resolve(transition).then(() => {
      if (currentScene?.frame?.id === frame.id) revealDelayedFixedMarks(delayedMarks);
    });
    window.dispatchEvent(new CustomEvent('asm:trace-rendered', {
      detail: { document, frame, placements: result.placements, height: result.height }
    }));
    return transition;
  }

  function boundsFromPlacements(placements) {
    const boxes = [...(placements?.values?.() || [])].filter(box => (
      Number.isFinite(box?.x) && Number.isFinite(box?.y)
      && Number(box.width) > 0 && Number(box.height) > 0
    ));
    if (!boxes.length) return null;
    const left = Math.min(...boxes.map(box => box.x));
    const top = Math.min(...boxes.map(box => box.y));
    const right = Math.max(...boxes.map(box => box.x + box.width));
    const bottom = Math.max(...boxes.map(box => box.y + box.height));
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  }

  function cameraRuleForFrame(document, frame) {
    return (document?.studio?.cameraRules || []).filter(rule => {
      if (Array.isArray(rule.frameIds) && rule.frameIds.length && !rule.frameIds.includes(frame.id)) return false;
      return window.ASMTraceRules?.conditionMatches?.(frame, rule.condition) !== false;
    }).at(-1) || null;
  }

  function mainCameraSize() {
    const canvas = window.document.getElementById('arraySvg');
    const rect = canvas?.getBoundingClientRect?.();
    const width = Number(rect?.width) || canvas?.clientWidth || 800;
    const height = Number(rect?.height) || canvas?.clientHeight || 450;
    return { width, height, aspect: width / Math.max(1, height) };
  }

  function autoCameraView(bounds, zoom = 0.92, offsetX = 0, offsetY = 0) {
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return null;
    const canvas = mainCameraSize();
    const padding = Number(window.getAutoCameraPadding?.()) || 48;
    const availableWidth = Math.max(1, canvas.width - padding * 2);
    const availableHeight = Math.max(1, canvas.height - padding * 2);
    const physicalScale = Math.max(0.0001, Math.min(
      availableWidth / bounds.width,
      availableHeight / bounds.height
    ) * (Number(zoom) || 0.92));
    return {
      centerX: (bounds.left + bounds.right) / 2 + (Number(offsetX) || 0),
      centerY: (bounds.top + bounds.bottom) / 2 + (Number(offsetY) || 0),
      width: canvas.width / physicalScale,
      height: canvas.height / physicalScale
    };
  }

  function cameraViewForScene(document, frame, placements, boundsOverride = null) {
    const bounds = boundsOverride || boundsFromPlacements(placements);
    if (!bounds) return null;
    const rule = cameraRuleForFrame(document, frame);
    if (rule?.manualFrame && Number.isFinite(Number(rule.centerX)) && Number.isFinite(Number(rule.centerY))) {
      const cameraTargetKey = cameraObjectKey(rule.binding?.targetKey);
      const boundPoint = cameraTargetKey
        ? anchorPoint(placements?.get?.(cameraTargetKey), rule.binding.targetAnchor || 'center')
        : null;
      const viewport = window.getCameraViewport?.(Number(rule.zoom) || 0.92);
      const canvas = mainCameraSize();
      const zoom = Math.max(0.05, Number(rule.zoom) || 0.92);
      return {
        centerX: boundPoint
          ? boundPoint.x + (Number(rule.binding.dx) || 0)
          : Number(rule.centerX) - TRACE_ROOT_OFFSET.x,
        centerY: boundPoint
          ? boundPoint.y + (Number(rule.binding.dy) || 0)
          : Number(rule.centerY) - TRACE_ROOT_OFFSET.y,
        width: Number(viewport?.width) || canvas.width / zoom,
        height: Number(viewport?.height) || canvas.height / zoom
      };
    }
    const focus = rule?.target ? resolveAnchor(document, frame, rule.target, placements) : null;
    const followX = focus ? focus.x - (bounds.left + bounds.right) / 2 : 0;
    const followY = focus ? focus.y - (bounds.top + bounds.bottom) / 2 : 0;
    return autoCameraView(
      bounds,
      Number(rule?.zoom) || 0.92,
      (Number(rule?.offsetX) || 0) + followX,
      (Number(rule?.offsetY) || 0) + followY
    );
  }

  function setThumbnailCameraView(thumbnail, view) {
    if (!thumbnail || !view || !(view.width > 0) || !(view.height > 0)) return;
    thumbnail.setAttribute('viewBox', `${view.centerX - view.width / 2} ${view.centerY - view.height / 2} ${view.width} ${view.height}`);
  }

  function refreshThumbnailCamera(thumbnail, document, frame) {
    if (!thumbnail || !document || !frame) return;
    const rule = cameraRuleForFrame(document, frame);
    if (rule?.manualFrame) return;
    const root = thumbnail.querySelector('[data-trace-thumbnail-root]');
    let bounds = null;
    try {
      const box = root?.getBBox?.();
      if (box && box.width > 0 && box.height > 0) {
        bounds = {
          left: box.x, top: box.y,
          right: box.x + box.width, bottom: box.y + box.height,
          width: box.width, height: box.height
        };
      }
    } catch (error) {
      // A detached thumbnail will be refreshed on the next rail render.
    }
    setThumbnailCameraView(thumbnail, cameraViewForScene(document, frame, null, bounds));
  }

  function showMainCameraFrameInThumbnail(thumbnail, cameraFrame) {
    if (!thumbnail || !cameraFrame) return;
    setThumbnailCameraView(thumbnail, {
      centerX: cameraFrame.centerX - TRACE_ROOT_OFFSET.x,
      centerY: cameraFrame.centerY - TRACE_ROOT_OFFSET.y,
      width: cameraFrame.width,
      height: cameraFrame.height
    });
  }

  function createThumbnail(document, frame, previousFrame = null) {
    const frameKey = String(frame?.id || 'frame').replace(/[^A-Za-z0-9_-]/g, '-');
    const thumbnail = svg('svg', {
      class: 'trace-studio-frame-preview',
      role: 'img',
      'aria-label': `幀縮圖 ${frameKey}`,
      preserveAspectRatio: 'xMidYMid meet'
    });
    thumbnail.style.cssText = 'position:fixed;left:-10000px;top:-10000px;width:220px;height:112px;visibility:hidden;pointer-events:none;';
    window.document.body.append(thumbnail);
    let result;
    try {
      result = renderScene(thumbnail, thumbnail, document, frame, previousFrame, {
        idPrefix: `trace-thumb-${frameKey}`,
        interactive: false,
        animatePositions: false,
        transform: ''
      });
    } finally {
      thumbnail.remove();
      thumbnail.removeAttribute('style');
    }
    result.root.setAttribute('data-trace-thumbnail-root', '1');
    const placements = Array.from(result.placements.values());
    if (placements.length) {
      const left = Math.min(...placements.map(placement => placement.x));
      const top = Math.min(...placements.map(placement => placement.y));
      const right = Math.max(...placements.map(placement => placement.x + placement.width));
      const bottom = Math.max(...placements.map(placement => placement.y + placement.height));
      thumbnail.dataset.traceBounds = `${left},${top},${right},${bottom}`;
    }
    thumbnail.dataset.traceFrameId = frame.id;
    setThumbnailCameraView(thumbnail, cameraViewForScene(document, frame, result.placements));
    if (!thumbnail.hasAttribute('viewBox')) thumbnail.setAttribute('viewBox', `0 0 220 ${Math.max(100, result.height)}`);
    return thumbnail;
  }

  function frameAnchorForKey(document, frame, key, anchor = 'center', previousFrame = null) {
    if (!document || !frame || !key) return null;
    const host = svg('svg', { width: 1600, height: 1000, 'aria-hidden': 'true' });
    host.style.cssText = 'position:fixed;left:-10000px;top:-10000px;visibility:hidden;pointer-events:none;';
    window.document.body.append(host);
    try {
      const result = renderScene(host, host, document, frame, previousFrame, {
        idPrefix: `trace-measure-${safeKey(frame.id)}`,
        interactive: false,
        animatePositions: false,
        transform: ''
      });
      return anchorPoint(result.placements.get(key), anchor);
    } finally {
      host.remove();
    }
  }

  function fitThumbnails(thumbnails) {
    const boxes = (thumbnails || []).map(thumbnail => {
      const values = String(thumbnail?.dataset?.traceBounds || '').split(',').map(Number);
      if (values.length !== 4 || values.some(value => !Number.isFinite(value))) return null;
      return { x: values[0], y: values[1], width: values[2] - values[0], height: values[3] - values[1] };
    }).filter(box => box && box.width > 0 && box.height > 0);
    if (!boxes.length) return;
    const padding = 12;
    let left = Math.min(...boxes.map(box => box.x)) - padding;
    let top = Math.min(...boxes.map(box => box.y)) - padding;
    let width = Math.max(...boxes.map(box => box.x + box.width)) - left + padding;
    let height = Math.max(...boxes.map(box => box.y + box.height)) - top + padding;
    const aspect = 220 / 112;
    if (width / height > aspect) {
      const nextHeight = width / aspect;
      top -= (nextHeight - height) / 2;
      height = nextHeight;
    } else {
      const nextWidth = height * aspect;
      left -= (nextWidth - width) / 2;
      width = nextWidth;
    }
    const viewBox = `${left} ${top} ${Math.max(1, width)} ${Math.max(1, height)}`;
    thumbnails.forEach(thumbnail => thumbnail.setAttribute('viewBox', viewBox));
  }

  function fitThumbnail(thumbnail) {
    fitThumbnails([thumbnail]);
  }

  register('array', renderSequence);
  register('sequence', renderSequence);
  register('stack', renderSequence);
  register('queue', renderSequence);
  register('set', renderSequence);
  register('matrix', renderMatrix);
  register('scalar', renderScalar);
  register('string', renderScalar);
  register('object', renderObject);
  register('node-graph', renderGraph);
  register('graph', renderGraph);
  register('coordinate-system', renderCoordinateSystem);
  register('original-array', renderOriginal);
  register('original-matrix', renderOriginal);
  register('original-cell', renderOriginal);
  register('original-stack', renderOriginal);
  register('original-queue', renderOriginal);

  function currentAnchor(target) {
    if (!currentScene) return null;
    const point = resolveAnchor(currentScene.document, currentScene.frame, target, currentScene.placements);
    return point ? { x: point.x + currentScene.rootOffset.x, y: point.y + currentScene.rootOffset.y } : null;
  }

  function currentBounds(options = {}) {
    if (!currentScene?.placements?.size) return null;
    const snapshotIds = new Set(currentScene.frame?.snapshotIds || []);
    const boxes = [...currentScene.placements.entries()]
      .filter(([key]) => options.includeSnapshots !== false || !snapshotIds.has(key))
      .map(([, box]) => box);
    if (!boxes.length) return null;
    const left = Math.min(...boxes.map(box => box.x)) + currentScene.rootOffset.x;
    const top = Math.min(...boxes.map(box => box.y)) + currentScene.rootOffset.y;
    const right = Math.max(...boxes.map(box => box.x + box.width)) + currentScene.rootOffset.x;
    const bottom = Math.max(...boxes.map(box => box.y + box.height)) + currentScene.rootOffset.y;
    return {
      left, top, right, bottom,
      width: right - left,
      height: bottom - top,
      centerX: (left + right) / 2,
      centerY: (top + bottom) / 2
    };
  }

  function fitCurrentObjectsCamera(zoom = 0.92, animate = true, duration = 520, offsetX = 0, offsetY = 0) {
    const bounds = currentBounds({ includeSnapshots: false });
    const view = autoCameraView(bounds, zoom, offsetX, offsetY);
    if (!view) return null;
    const scale = window.cameraScaleForViewportWidth?.(view.width);
    if (!Number.isFinite(Number(scale))) return null;
    window.setCamera?.(view.centerX, view.centerY, Number(scale), animate, duration);
    return { ...view, scale: Number(scale) };
  }

  function currentPlacement(key, viewportCoordinates = true) {
    const placement = currentScene?.placements?.get(key);
    if (!placement) return null;
    const offset = viewportCoordinates ? currentScene.rootOffset : { x: 0, y: 0 };
    return {
      x: placement.x + offset.x,
      y: placement.y + offset.y,
      width: placement.width,
      height: placement.height
    };
  }

  function currentAnchorForKey(key, anchor = 'center', viewportCoordinates = true) {
    return anchorPoint(currentPlacement(key, viewportCoordinates), anchor);
  }

  function currentObjectKeys() {
    return currentScene?.placements ? [...currentScene.placements.keys()] : [];
  }

  function cameraObjectKey(key) {
    return String(key || '').split('#')[0].replace(/:(?:label|index)$/, '');
  }

  window.ASMTraceRenderers = {
    register, renderFrame, createThumbnail, fitThumbnail, fitThumbnails, displayValue,
    resolveAnchor, currentAnchor, currentBounds, fitCurrentObjectsCamera,
    currentPlacement, currentAnchorForKey, currentObjectKeys, cameraObjectKey, frameAnchorForKey, anchorPoint,
    refreshThumbnailCamera, showMainCameraFrameInThumbnail
  };
})();
