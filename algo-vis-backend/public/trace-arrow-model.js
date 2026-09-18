(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ASMArrowModel = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const HEAD_SHRINK = 12;
  const COLORS = Object.freeze({
    AV_green: 'rgba(165, 214, 167, 0.6)',
    AV_blue: 'rgba(144, 202, 249, 0.6)',
    AV_red: 'rgba(239, 154, 154, 0.6)',
    AV_yellow: 'rgba(252, 255, 64, 0.46)',
    AV_orange: 'orange',
    AV_node_green: '#e8f5e9',
    AV_node_red: '#ef9a9a',
    AV_grey: '#cccccc',
    AV_node_grey: '#cccccc',
    AV_black: '#111827',
    AV_white: '#ffffff'
  });

  function color(value, fallback = 'black') {
    return COLORS[value] || value || fallback;
  }

  function normalizeTarget(target = {}, fallbackAnchor = 'center') {
    const indexExpressions = Array.isArray(target.indexExpressions)
      ? target.indexExpressions.map(String)
      : String(target.indexExpression || '').trim()
        ? [String(target.indexExpression).trim()]
        : target.row !== undefined && target.row !== -1
          ? [String(target.row), String(target.column ?? target.col ?? 0)]
          : target.index !== undefined && target.index !== -1 ? [String(target.index)] : [];
    return {
      variableId: String(target.variableId || target.targetVariableId || ''),
      objectKey: String(target.objectKey || target.targetObjectKey || target.ref || target.group || ''),
      targetName: String(target.targetName || ''),
      indexExpressions,
      indexExpression: indexExpressions.join(','),
      index: target.index === undefined ? undefined : Number(target.index),
      row: target.row === undefined ? undefined : Number(target.row),
      column: target.column === undefined && target.col === undefined
        ? undefined : Number(target.column ?? target.col),
      anchor: String(target.anchor || fallbackAnchor).toLowerCase(),
      dx: Number(target.dx ?? target.offsetX) || 0,
      dy: Number(target.dy ?? target.offsetY) || 0,
      canvas: target.canvas === true
    };
  }

  function targetKey(objectKey, indices = []) {
    const base = String(objectKey || '').trim();
    const values = Array.isArray(indices) ? indices : [indices];
    const normalized = values.map(value => Number(value));
    if (!base || normalized.some(value => !Number.isInteger(value))) return '';
    return normalized.length ? `${base}#${normalized.join(',')}` : base;
  }

  function targetLabel(objectLabel, indices = []) {
    const base = String(objectLabel || '').trim();
    const values = Array.isArray(indices) ? indices : [indices];
    if (!base) return '';
    return `${base}${values.map(value => `[${value}]`).join('')}`;
  }

  function registerTarget(element, descriptor = {}) {
    if (!element?.setAttribute) return element;
    const indices = Array.isArray(descriptor.indices) ? descriptor.indices : [];
    const key = String(descriptor.key || targetKey(descriptor.objectKey, indices));
    const label = String(descriptor.label || targetLabel(descriptor.objectLabel, indices) || key);
    if (!key) return element;
    element.setAttribute('data-trace-arrow-target', '1');
    element.setAttribute('data-trace-arrow-target-key', key);
    element.setAttribute('data-trace-arrow-target-label', label);
    element.setAttribute('data-trace-arrow-target-kind', String(descriptor.kind || 'object'));
    element.setAttribute('aria-label', `箭頭目標：${label}`);
    if (descriptor.objectKey) element.setAttribute('data-trace-arrow-target-object', String(descriptor.objectKey));
    if (indices.length) element.setAttribute('data-trace-arrow-target-indices', indices.join(','));
    return element;
  }

  function normalize(arrow = {}, defaults = {}) {
    const style = arrow.style && typeof arrow.style === 'object' ? arrow.style : {};
    const head = String(style.head || arrow.head || defaults.head || 'end').toLowerCase();
    return {
      ...arrow,
      id: String(arrow.id || defaults.id || ''),
      source: String(arrow.source || defaults.source || 'studio'),
      layer: String(arrow.layer || defaults.layer || (
        ['directive', 'studio', 'draw'].includes(arrow.source || defaults.source) ? 'foreground' : 'background'
      )).toLowerCase(),
      from: normalizeTarget(arrow.from || {
        variableId: arrow.fromVariableId,
        objectKey: arrow.fromObjectKey,
        anchor: arrow.fromAnchor
      }, 'right'),
      to: normalizeTarget(arrow.to || {
        variableId: arrow.toVariableId,
        objectKey: arrow.toObjectKey,
        anchor: arrow.toAnchor
      }, 'left'),
      style: {
        color: color(style.color || arrow.color || defaults.color, 'black'),
        width: Math.max(0.5, Number(style.width ?? arrow.width ?? defaults.width) || 2),
        line: String(style.line || arrow.line || defaults.line || 'straight').toLowerCase(),
        dash: String(style.dash || arrow.dash || defaults.dash || ''),
        headStart: String(style.headStart || (['start', 'both'].includes(head) ? 'arrow' : 'none')).toLowerCase(),
        headEnd: String(style.headEnd || (['end', 'both'].includes(head) ? 'arrow' : 'none')).toLowerCase(),
        tweenDuration: Math.max(0, Number(style.tweenDuration ?? arrow.tweenDuration ?? defaults.tweenDuration) || 300)
      },
      condition: arrow.condition || arrow.when || null,
      frameIds: Array.isArray(arrow.frameIds) ? [...arrow.frameIds] : []
    };
  }

  function isOuterframeTarget(target) {
    return Boolean(target?.direction || target?.outerframe === true);
  }

  function isCellTarget(target) {
    return Boolean(target && (target.index !== undefined
      || target.row !== undefined
      || target.indexExpression
      || (Array.isArray(target.indexExpressions) && target.indexExpressions.length)));
  }

  function presentedBounds(element, root, outerframe = false) {
    if (!element?.getScreenCTM || !root?.getScreenCTM || !element.isConnected) return null;
    if (element.closest?.('[display="none"], [data-trace-visibility="hidden"]')) return null;
    for (let parent = element; parent && parent !== root; parent = parent.parentElement) {
      if (parent.getAttribute?.('opacity') === '0' || parent.style?.opacity === '0') return null;
    }
    let bounds = null;
    if (outerframe) {
      const frame = element.matches?.('[data-outerframe-left][data-outerframe-top][data-outerframe-right][data-outerframe-bottom]')
        ? element : element.querySelector?.('[data-outerframe-left][data-outerframe-top][data-outerframe-right][data-outerframe-bottom]');
      if (frame) {
        const left = Number(frame.getAttribute('data-outerframe-left'));
        const top = Number(frame.getAttribute('data-outerframe-top'));
        const right = Number(frame.getAttribute('data-outerframe-right'));
        const bottom = Number(frame.getAttribute('data-outerframe-bottom'));
        if ([left, top, right, bottom].every(Number.isFinite) && right > left && bottom > top) {
          element = frame;
          bounds = { x: left, y: top, width: right - left, height: bottom - top };
        }
      }
    }
    if (!bounds) {
      const rect = element.querySelector?.(':scope > rect');
      if (rect && !outerframe) element = rect;
      try { bounds = element.getBBox(); } catch { return null; }
    }
    if (!bounds || !(bounds.width > 0) || !(bounds.height > 0)) return null;
    const elementMatrix = element.getScreenCTM();
    const rootMatrix = root.getScreenCTM();
    if (!elementMatrix || !rootMatrix) return null;
    let matrix;
    try { matrix = rootMatrix.inverse().multiply(elementMatrix); } catch { return null; }
    const corners = [
      [bounds.x, bounds.y], [bounds.x + bounds.width, bounds.y],
      [bounds.x, bounds.y + bounds.height], [bounds.x + bounds.width, bounds.y + bounds.height]
    ].map(([x, y]) => ({ x: matrix.a * x + matrix.c * y + matrix.e,
      y: matrix.b * x + matrix.d * y + matrix.f }));
    if (corners.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))) return null;
    const left = Math.min(...corners.map(point => point.x));
    const top = Math.min(...corners.map(point => point.y));
    return { x: left, y: top,
      width: Math.max(...corners.map(point => point.x)) - left,
      height: Math.max(...corners.map(point => point.y)) - top };
  }

  // This is the geometry contract used by the original drawArrow(): cell
  // centers receive a small margin and arrow/dot heads reserve 12px plus the
  // line-width adjustment. Renderers may therefore use different DOM layers
  // without changing the visible arrow proportions.
  function geometry(start, end, startTarget = {}, endTarget = {}, inputStyle = {}) {
    const style = normalize({ style: inputStyle }).style;
    const dx = Number(end?.x) - Number(start?.x);
    const dy = Number(end?.y) - Number(start?.y);
    const length = Math.hypot(dx, dy);
    if (!(length > 0)) return null;
    const ux = dx / length;
    const uy = dy / length;
    const centered = target => !target?.anchor || target.anchor === 'center';
    const baseStart = inputStyle.marginStart != null
      ? Number(inputStyle.marginStart) || 0
      : isOuterframeTarget(startTarget) ? 0
        : isCellTarget(startTarget) && centered(startTarget) ? 8 + style.width : 0;
    const baseEnd = inputStyle.marginEnd != null
      ? Number(inputStyle.marginEnd) || 0
      : isOuterframeTarget(endTarget) ? 0
        : isCellTarget(endTarget) && centered(endTarget) ? 8 + style.width : 0;
    const headAdjustment = (style.width - 4) * 3;
    const marginStart = baseStart + (style.headStart !== 'none' ? HEAD_SHRINK + headAdjustment : 0);
    const marginEnd = baseEnd + (style.headEnd !== 'none' ? HEAD_SHRINK + headAdjustment : 0);
    if (marginStart + marginEnd >= length) return null;
    return {
      x1: Number(start.x) + ux * marginStart,
      y1: Number(start.y) + uy * marginStart,
      x2: Number(end.x) - ux * marginEnd,
      y2: Number(end.y) - uy * marginEnd,
      marginStart,
      marginEnd,
      length
    };
  }

  // IDs describe a visual role; endpoints describe its binding on this frame.
  // Legacy documents without identity metadata are matched by exact ID only.
  function pair(previous = [], current = []) {
    const matches = new Map(), used = new Set();
    const compatible = (a, b) => a.source === b.source
      && (a.explicitId && b.explicitId || a.scope === b.scope);
    current.forEach(b => {
      const candidates = previous.filter(a => !used.has(a) && a.id === b.id && compatible(a, b));
      if (candidates.length === 1) { matches.set(b, candidates[0]); used.add(candidates[0]); }
    });
    const family = a => JSON.stringify([a.source, a.scope,
      a.fromObject, a.toObject, a.line, a.headStart, a.headEnd]);
    current.filter(b => !matches.has(b) && b.explicitId === false).forEach(b => {
      const candidates = previous.filter(a => !used.has(a) && a.explicitId === false && family(a) === family(b));
      const peers = current.filter(a => !matches.has(a) && a.explicitId === false && family(a) === family(b));
      if (candidates.length === 1 && peers.length === 1) {
        matches.set(b, candidates[0]); used.add(candidates[0]);
      }
    });
    return matches;
  }

  // Expand only presentation descriptions. The caller supplies the existing
  // safe trace expression resolver; no C++ loop or runtime event is generated.
  function expandBatch(arrow, resolve, matches = () => true, loopSamples = null) {
    if (!arrow.batch) return [arrow];
    const batch = arrow.batch;
    const condition = arrow.when || arrow.condition;
    const identifiers = typeof condition === 'string' ? condition.match(/[A-Za-z_]\w*/g) || []
      : condition?.identifiers || String(condition?.expression || '').match(/[A-Za-z_]\w*/g) || [];
    if (condition && !identifiers.includes(batch.variable) && !matches(condition, {})) return [];
    const fail = message => { throw new Error(`第 ${arrow.line || '?'} 行的 @arrow for ${message}`); };
    const limit = Math.floor(2048 / (arrow.drawCandidateCount || 1));
    let samples;
    if (batch.kind === 'loop') {
      if (!loopSamples) fail('缺少迴圈執行資料');
      samples = loopSamples(batch);
    } else {
      const values = [batch.startExpression, batch.endExpression, batch.stepExpression || '1']
        .map(expression => resolve(expression, {}));
      if (values.some(value => value == null || !Number.isSafeInteger(value))) {
        fail('範圍與步長必須能解析為安全整數');
      }
      const [start, end, step] = values;
      if (!step) fail('step 必須是非零整數');
      if ((step > 0 && start > end) || (step < 0 && start < end)) return [];
      const count = Math.floor((end - start) / step) + 1;
      if (!Number.isSafeInteger(count) || count > limit) fail('組合展開數量超過 2048 支，請縮小範圍');
      samples = Array.from({ length: count }, (_, offset) => ({ value: start + offset * step }));
    }
    if (samples.length > limit) fail('組合展開數量超過 2048 支，請縮小範圍');
    const result = [];
    for (const sample of samples) {
      const value = sample.value;
      const locals = { [batch.variable]: value };
      if (!matches(condition, locals)) continue;
      const target = endpoint => {
        const indices = endpoint.indexExpressions?.length
          ? endpoint.indexExpressions : endpoint.indexExpression ? [endpoint.indexExpression] : [];
        const resolved = indices.map(expression => resolve(expression, locals));
        if (resolved.some(index => index == null || !Number.isSafeInteger(index))) fail(`索引無法解析（${batch.variable}=${value}）`);
        return { ...endpoint, indexExpressions: resolved.map(String), indexExpression: resolved.join(',') };
      };
      result.push({ ...arrow, id: sample.instanceId ? `${arrow.id}@${sample.instanceId}[${sample.ordinal}]` : `${arrow.id}[${value}]`,
        displayName: `${arrow.displayName || arrow.id}[${value}]`,
        from: target(arrow.from), to: target(arrow.to),
        batch: null, when: null, condition: null });
    }
    return result;
  }

  return {
    expandBatch,
    pair,
    HEAD_SHRINK,
    COLORS,
    color,
    targetKey,
    targetLabel,
    registerTarget,
    normalizeTarget,
    normalize,
    presentedBounds,
    geometry,
    isCellTarget,
    isOuterframeTarget
  };
});
