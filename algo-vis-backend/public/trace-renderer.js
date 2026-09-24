(function () {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const TRACE_ROOT_OFFSET = { x: 90, y: 80 };
  // Automatic @keep rows use one explicit edge-to-edge gap. Manually placed
  // snapshots bypass this stack and keep their authored coordinates.
  const KEEP_SNAPSHOT_GAP = 50;
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

  function displayValue(data, separator = ',') {
    if (!data || typeof data !== 'object') return String(data ?? '');
    if (Object.prototype.hasOwnProperty.call(data, 'value')) return String(data.value ?? '');
    if (data.kind === 'reference') return data.address || 'null';
    if (data.kind === 'pair' || data.kind === 'tuple') {
      return (data.items || []).map(item => displayValue(item, separator)).join(separator);
    }
    return data.label || data.type || data.kind || '';
  }

  function hiddenValueToken(raw) {
    const source = String(raw ?? '').trim();
    const constants = { LM: 2147483647, INT_MAX: 2147483647, INT_MIN: -2147483648 };
    if (Object.prototype.hasOwnProperty.call(constants, source)) return String(constants[source]);
    if (/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(source)) return String(Number(source));
    if (/^(?:true|false)$/i.test(source)) return source.toLowerCase();
    try { return source.startsWith('"') ? String(JSON.parse(source)) : source.match(/^'([^']*)'$/s)?.[1] ?? source; }
    catch { return source; }
  }

  function hiddenField(options, field, data) {
    const entry = options?.hide?.entries?.find(item => item.field === field);
    return Boolean(entry && displayValue(data, options.separator ?? ',') === hiddenValueToken(entry.value));
  }

  function formatDisplayValue(data, options = {}, field = '', variableId = '') {
    const raw = displayValue(data, options.separator ?? ',');
    const entry = options?.format?.entries?.find(item => (
      (variableId && item.variableId === variableId) || (field && item.field === field)
    ));
    if (!entry || entry.type === 'raw') return raw;
    if (entry.type === 'assign') return `=${raw}`;
    const numeric = Number(raw);
    if (entry.type === 'bool') {
      if (/^(?:true|false)$/i.test(raw)) return raw.toLowerCase();
      return Number.isFinite(numeric) ? String(numeric !== 0) : raw;
    }
    if (!Number.isFinite(numeric)) return raw;
    if (entry.type === 'signed') return numeric > 0 ? `+${raw}` : raw;
    if (entry.type === 'binary' || entry.type === 'hex') {
      if (!Number.isInteger(numeric)) return raw;
      const prefix = entry.type === 'binary' ? '0b' : '0x';
      const digits = Math.abs(numeric).toString(entry.type === 'binary' ? 2 : 16);
      return `${numeric < 0 ? '-' : ''}${prefix}${entry.type === 'hex' ? digits.toUpperCase() : digits}`;
    }
    const precision = Math.max(0, Math.min(10, Number(entry.precision) || 0));
    if (entry.type === 'fixed') return numeric.toFixed(precision);
    if (entry.type === 'percent') return `${(numeric * 100).toFixed(precision)}%`;
    return raw;
  }

  function formattedItem(data, options = {}, field = '', variableId = '') {
    const separator = Object.prototype.hasOwnProperty.call(options, 'separator') ? options.separator : ',';
    if (data?.kind !== 'pair' && data?.kind !== 'tuple') {
      return formatDisplayValue(data, options, field, variableId);
    }
    const names = data.kind === 'pair'
      ? ['first', 'second']
      : (data.items || []).map((_, index) => String(index));
    return (data.items || []).flatMap((item, index) => (
      hiddenField(options, names[index], item)
        ? [] : [formatDisplayValue(item, options, names[index])]
    )).join(separator);
  }

  function mergeHighlights(target, source) {
    Object.entries(source || {}).forEach(([key, value]) => {
      const previous = target[key] || {};
      target[key] = {
        ...previous, ...value,
        styleTypes: { ...(previous.styleTypes || {}), ...(value?.styleTypes || {}) },
        sourceStyleIds: { ...(previous.sourceStyleIds || {}), ...(value?.sourceStyleIds || {}) }
      };
    });
    return target;
  }

  function applyHighlight(element, highlight = {}) {
    const color = highlight.color || highlight.fill || highlight.stroke;
    const typed = highlight.styleTypes || {};
    const background = typed.background || typed.segment
      || (Object.hasOwn(typed, 'background') ? 'rgb(231, 144, 255)' : '')
      || (highlight.styleType === 'background' ? color || 'rgb(231, 144, 255)' : '');
    const stroke = typed.highlight || (Object.hasOwn(typed, 'highlight') ? 'red' : '')
      || typed.focus || (Object.hasOwn(typed, 'focus') ? '#ccc' : '')
      || (highlight.styleType && !['background', 'segment'].includes(highlight.styleType) ? color : '');
    if (background) element.setAttribute('fill', background);
    if (stroke) element.setAttribute('stroke', stroke);
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
      const typedStyles = highlight.styleTypes || {};
      Object.entries(typedStyles).forEach(([type, color]) => {
        styles.push({ type: type === 'segment' ? 'background' : type, color, elements: valid });
      });
      if (!Object.keys(typedStyles).length && highlight.styleType && highlight.color !== undefined) {
        styles.push({ type: highlight.styleType, color: highlight.color, elements: valid });
      }
      if (highlight.fill && !typedStyles.background) {
        styles.push({ type: 'background', color: highlight.fill, elements: valid });
      }
      if (highlight.stroke && !typedStyles.highlight) {
        styles.push({ type: 'highlight', color: highlight.stroke, elements: valid });
      }
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

  function runtimeIdentityToken(identity, fallback = 'object') {
    const source = String(identity || fallback || 'object');
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `runtime-${(hash >>> 0).toString(36)}`;
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

  function markArrowTarget(element, descriptor = {}) {
    if (window.ASMArrowModel?.registerTarget) {
      window.ASMArrowModel.registerTarget(element, descriptor);
    }
    return element;
  }

  function originalValues(entry, options = {}, field = '', variableId = '') {
    if (entry.data?.kind === 'map') {
      return (entry.data.entries || []).map(item => `${displayValue(item.key)}: ${displayValue(item.value)}`);
    }
    if (Array.isArray(entry.data?.items)) {
      return entry.data.items.map(item => formattedItem(item, options, field, variableId));
    }
    return [formattedItem(entry.data, options, field, variableId)];
  }

  function isScalarRenderer(variable, rendererName) {
    return rendererName === 'original-cell'
      || ['scalar', 'string'].includes(variable?.kind);
  }

  function removeScalarIndexLabels(content, variable, rendererName) {
    if (!isScalarRenderer(variable, rendererName)) return;
    content.querySelectorAll('[id$="-index"], [data-trace-index-label]').forEach(label => label.remove());
  }

  function renderOriginal(group, entry, context) {
    if (typeof window.draw_array_normal !== 'function') {
      return Array.isArray(entry.data?.items) ? renderSequence(group, entry, context) : renderScalar(group, entry, context);
    }
    const id = `${context.idPrefix || 'trace-original'}-${context.variableId.replace(/[^A-Za-z0-9_-]/g, '-')}`;
    const rendererOptions = context.skin?.options || {};
    const gap = rendererOptions.gap ?? 0;
    const requested = context.rendererName || 'original-array';
    const isScalarCell = isScalarRenderer(context.variable, requested);
    const configuredShowIndex = rendererOptions.showIndex;
    const configuredIndexMode = Number(rendererOptions.indexMode);
    let indexMode = isScalarCell ? 0 : Number.isFinite(configuredIndexMode)
      ? Math.max(0, Math.min(4, Math.trunc(configuredIndexMode)))
      : (configuredShowIndex === false ? 0 : 1);
    if (!isScalarCell && rendererOptions.indexLabels?.mode === 'none') indexMode = 0;
    else if (!isScalarCell && ['index', 'custom'].includes(rendererOptions.indexLabels?.mode)) indexMode = 1;
    const isMatrix = requested === 'original-matrix' || context.variable.kind === 'matrix';
    const fieldSpec = rendererOptions.fields;
    const fieldSources = Array.isArray(fieldSpec?.variableIds) && context.frame
      ? fieldSpec.variableIds.map((variableId, index) => ({
        variableId,
        name: fieldSpec.names?.[index] || context.document?.variables?.[variableId]?.name || variableId,
        entry: context.frame.state?.[variableId]
      }))
      : [];
    const separator = Object.prototype.hasOwnProperty.call(rendererOptions, 'separator')
      ? rendererOptions.separator : ',';
    let fieldParts = [];
    let values;
    if (fieldSources.length) {
      const itemCount = Math.max(0, ...fieldSources.map(source => source.entry?.data?.items?.length || 0));
      fieldParts = Array.from({ length: itemCount }, (_, index) => fieldSources.flatMap(source => {
        const item = source.entry?.data?.items?.[index];
        if (item == null || hiddenField(rendererOptions, source.name, item)) return [];
        return [{
          variableId: source.variableId,
          text: formattedItem(item, rendererOptions, source.name, source.variableId)
        }];
      }));
      values = fieldParts.map(parts => parts.map(part => part.text).join(separator));
    } else {
      values = originalValues(
        entry, rendererOptions, context.variable?.name || '', context.variableId
      );
    }
    let itemsPerRow = Infinity;
    if (isMatrix) {
      const rows = Array.isArray(entry.data?.items) ? entry.data.items : [];
      const columns = Math.max(1, ...rows.map(row => Array.isArray(row?.items) ? row.items.length : 0));
      values = rows.flatMap(row => Array.from({ length: columns }, (_, index) => formatDisplayValue(
        row?.items?.[index], rendererOptions, context.variable?.name || '', context.variableId
      )));
      itemsPerRow = columns;
    }
    const configuredColumns = Number(rendererOptions.columns);
    if (Number.isFinite(configuredColumns) && configuredColumns > 0) {
      itemsPerRow = Math.max(1, Math.trunc(configuredColumns));
    }
    const configuredRange = Array.isArray(rendererOptions.range) ? rendererOptions.range : [];
    const intervalSegmentTree = requested === 'original-segment-tree'
      && configuredRange.length >= 2;
    const rangeStart = intervalSegmentTree ? 0 : Number.isFinite(Number(configuredRange[0]))
      ? Math.max(0, Math.min(values.length, Math.trunc(Number(configuredRange[0]))))
      : 0;
    const rangeEndExclusive = intervalSegmentTree ? values.length : Number.isFinite(Number(configuredRange[1]))
      ? Math.max(rangeStart, Math.min(values.length, Math.trunc(Number(configuredRange[1]))))
      : values.length;
    const range = [rangeStart, rangeEndExclusive - 1];
    const visibleCount = Math.max(0, rangeEndExclusive - rangeStart);
    const combinedHighlights = { ...(context.highlights || {}) };
    fieldSources.forEach(source => mergeHighlights(combinedHighlights, context.allHighlights?.[source.variableId]));
    const styles = originalStyles(combinedHighlights, values.length);
    const mode = requested.replace(/^original-/, '');
    // An empty sequence still has a one-cell-wide outerframe, but no cell.
    // Do not route it through layout renderers that assume a first element.
    if (Array.isArray(entry.data?.items) && !values.length) {
      window.draw_array_normal(group, id, values, styles, range, itemsPerRow, indexMode, gap);
    } else if (mode === 'heap' && typeof window.draw_array_heap === 'function') {
      window.draw_array_heap(group, id, values, styles, range, indexMode, gap);
    } else if (mode === 'segment-tree' && intervalSegmentTree
      && typeof window.draw_standard_segment_tree === 'function') {
      window.draw_standard_segment_tree(group, id, values, styles, {
        domainStart: Number(configuredRange[0]),
        domainEnd: Number(configuredRange[1]) - 1,
        root: Number(configuredRange[0]),
        indexMode,
        gap
      });
    } else if (mode === 'segment-tree' && typeof window.draw_array_segment_tree === 'function') {
      window.draw_array_segment_tree(group, id, values, styles, range, indexMode, gap, [], [], [], [], [], [], []);
    } else if (mode === 'bit' && typeof window.draw_array_BIT === 'function') {
      window.draw_array_BIT(group, id, values, styles, range, indexMode, gap);
    } else if (mode === 'disk' && typeof window.draw_array_disk === 'function') {
      window.draw_array_disk(group, id, values, styles, range, itemsPerRow, indexMode, gap);
    } else if (mode === 'stack' && typeof window.draw_array_stack === 'function') {
      window.draw_array_stack(group, id, values, styles, range, indexMode, gap);
    } else if (mode === 'queue' && typeof window.draw_array_queue === 'function') {
      window.draw_array_queue(group, id, values, styles, range, indexMode, gap);
    } else {
      window.draw_array_normal(group, id, values, styles, range, itemsPerRow, indexMode, gap);
    }
    group.setAttribute('data-trace-range-start', String(rangeStart));
    group.setAttribute('data-trace-range-end', String(rangeEndExclusive));
    removeScalarIndexLabels(group, context.variable, requested);
    Array.from({ length: visibleCount }, (_, localIndex) => rangeStart + localIndex).forEach((logicalIndex, localIndex) => {
      const cell = group.querySelector(`#${CSS.escape(`cell-${id}-${localIndex}`)}`);
      const cellKey = isMatrix
        ? `${context.variableId}#${Math.floor(logicalIndex / itemsPerRow)},${logicalIndex % itemsPerRow}`
        : `${context.variableId}#${logicalIndex}`;
      if (cell) {
        cell.setAttribute('data-trace-index', String(logicalIndex));
        // labels(index) renders the index in the cell's visible <text>.
        // Keep that label immutable while retaining the underlying data
        // value as a separate target for event replay and assignment effects.
        cell.setAttribute('data-trace-data-value', String(values[logicalIndex] ?? ''));
        const contentText = cell.querySelector(':scope > text');
        if (contentText) {
          contentText.setAttribute('data-trace-content-role', indexMode === 2 ? 'index' : 'value');
          if (fieldParts[logicalIndex]?.length && indexMode !== 2) {
            contentText.textContent = '';
            fieldParts[logicalIndex].forEach((part, partIndex) => {
              if (partIndex) contentText.append(svg('tspan', { 'data-trace-field-separator': '1' }, separator));
              const fieldKey = `${objectKeyForVariable(context.frame, part.variableId)}#${logicalIndex}`;
              const fieldText = svg('tspan', {
                'data-trace-field-variable': part.variableId,
                'data-trace-index': logicalIndex
              }, part.text);
              if (part.variableId !== fieldSources[0]?.variableId) {
                markSelectable(fieldText, fieldKey, context, context.variableId);
              }
              contentText.append(fieldText);
              if (part.variableId !== fieldSources[0]?.variableId) {
                markArrowTarget(fieldText, {
                  key: fieldKey,
                  objectKey: objectKeyForVariable(context.frame, part.variableId),
                  objectLabel: context.document?.variables?.[part.variableId]?.name || part.variableId,
                  indices: [logicalIndex], kind: 'array-cell-field'
                });
              }
            });
          }
        }
        markSelectable(cell, cellKey, context, context.variableId);
        const indices = isMatrix
          ? [Math.floor(logicalIndex / itemsPerRow), logicalIndex % itemsPerRow]
          : [logicalIndex];
        markArrowTarget(cell, {
          key: cellKey,
          objectKey: objectKeyForVariable(context.frame, context.variableId),
          objectLabel: context.variable?.name || context.variableId,
          indices,
          kind: isMatrix ? 'matrix-cell' : 'array-cell'
        });
        if (Object.prototype.hasOwnProperty.call(rendererOptions, 'gridlines')) {
          cell.querySelectorAll(':scope > rect').forEach(rect => {
            rect.setAttribute('stroke-width', String(Math.max(0, Number(rendererOptions.gridlines) || 0)));
            rect.setAttribute('pointer-events', 'all');
          });
        }
      }
      ['highlight', 'point', 'mark'].forEach(kind => {
        const hint = group.querySelector(`#${CSS.escape(`${kind}-${id}-${localIndex}`)}`);
        if (!hint) return;
        hint.setAttribute('data-trace-attached-to', cellKey);
        hint.setAttribute('data-trace-attachment-kind', kind);
        if (kind === 'highlight' || kind === 'point') {
          const highlight = context.highlights?.[String(logicalIndex)]
            || context.highlights?.$object
            || {};
          const sourceIdentity = String(
            highlight.sourceStyleIds?.[kind]
            || highlight.sourceStyleId
            || highlight.eventId
            || `${context.variableId}:${logicalIndex}`
          );
          window.HintWidgets?.continuePresentationLoop?.(
            hint,
            `${kind}:${sourceIdentity}`
          );
        }
      });
      const indexLabel = group.querySelector(`#${CSS.escape(`cell-${id}-${localIndex}-index`)}`);
      if (indexLabel) {
        indexLabel.setAttribute('data-trace-index-label', String(logicalIndex));
        markSelectable(indexLabel, `${cellKey}:index`, context, context.variableId);
        if (Object.prototype.hasOwnProperty.call(rendererOptions, 'gridlines')) {
          indexLabel.querySelectorAll(':scope > rect').forEach(rect => {
            rect.setAttribute('stroke-width', String(Math.max(0, Number(rendererOptions.gridlines) || 0)));
          });
        }
        if (rendererOptions.indexLabels?.mode === 'custom') {
          const text = indexLabel.querySelector('text');
          if (text) text.textContent = String(rendererOptions.indexLabels.values?.[logicalIndex] ?? '');
        }
      }
    });
    if (rendererOptions.outerframe === false) {
      group.querySelectorAll(':scope > .outerframe-bg, :scope > .outerframe-nb').forEach(node => node.remove());
    }
    group.querySelectorAll(':scope > .outerframe-label').forEach(label => {
      label.textContent = context.variable?.name || '';
      label.setAttribute('font-family', 'Arial');
      label.setAttribute('font-size', '16');
      label.setAttribute('font-weight', 'bold');
      markSelectable(label, `${context.variableId}:label`, context, context.variableId);
    });
    return originalBoundsHeight(group, isMatrix ? Math.max(78, Math.ceil(visibleCount / itemsPerRow) * 52 + 24) : 78);
  }

  function renderSequence(group, entry, context) {
    const items = Array.isArray(entry.data?.items) ? entry.data.items : [];
    const cellSize = Math.max(32, Math.min(72, Number(context.skin?.options?.cellSize) || 52));
    const rawGap = context.skin?.options?.gap ?? 0;
    const gap = window.resolveArrayGaps ? window.resolveArrayGaps(rawGap).horizontal : Math.max(0, Number(rawGap) || 0);
    items.forEach((item, index) => {
      const x = index * (cellSize + gap);
      const logicalIndex = context.rowIndex == null ? String(index) : `${context.rowIndex},${index}`;
      const cellKey = `${context.variableId}#${logicalIndex}`;
      const cell = markSelectable(svg('g', {
        transform: `translate(${x}, 0)`,
        'data-trace-index': context.rowIndex == null ? index : logicalIndex
      }), cellKey, context, context.variableId);
      const indices = context.rowIndex == null ? [index] : [context.rowIndex, index];
      markArrowTarget(cell, {
        key: cellKey,
        objectKey: objectKeyForVariable(context.frame, context.variableId),
        objectLabel: context.variable?.name || context.variableId,
        indices,
        kind: context.rowIndex == null ? 'array-cell' : 'matrix-cell'
      });
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

  function renderOriginalMatrixWithDraw2DArray(group, entry, context) {
    if (typeof window.draw_2Darray !== 'function') return null;
    const rows = Array.isArray(entry.data?.items) ? entry.data.items : [];
    const options = context.skin?.options || {};
    const indexMode = Number.isFinite(Number(options.indexMode)) ? Number(options.indexMode) : 1;
    const defaultIndices = indexMode !== 0 && options.showIndex !== false;
    const showValue = options.showValue !== false && indexMode !== 2;
    const rowSpec = options.rowLabels
      || (defaultIndices ? { mode: 'index', values: [] } : { mode: 'none', values: [] });
    const columnSpec = options.columnLabels
      || (defaultIndices ? { mode: 'index', values: [] } : { mode: 'none', values: [] });
    const innerSpec = options.innerLabels || { mode: 'none', values: [] };
    const labelValues = (spec, count) => spec.mode === 'none' ? null
      : Array.from({ length: count }, (_, index) => (
        spec.mode === 'index' ? index : spec.values?.[index] ?? ''
      ));
    const matrix = rows.map(row => (row?.items || []).map(item => (
      formatDisplayValue(item, options, context.variable?.name || '', context.variableId)
    )));
    const rowLabels = labelValues(rowSpec, rows.length);
    const maxColumns = Math.max(0, ...matrix.map(row => row.length));
    const columnLabels = labelValues(columnSpec, maxColumns);
    const innerLabels = innerSpec.mode === 'none' ? null : rows.map((row, rowIndex) => (
      row.items.map((item, columnIndex) => innerSpec.mode === 'index'
        ? columnIndex : innerSpec.values?.[rowIndex]?.[columnIndex] ?? '')
    ));
    const style = [];
    const addStyle = (type, color, elements) => {
      if (elements.length) style.push({ type, color, elements });
    };
    const entriesByType = new Map();
    Object.entries(context.highlights || {}).forEach(([key, highlight]) => {
      const elements = key === '$object'
        ? rows.flatMap((row, rowIndex) => row.items.map((item, columnIndex) => [rowIndex, columnIndex]))
        : [/^(-?\d+),(-?\d+)$/.exec(key)].filter(Boolean).map(match => [Number(match[1]), Number(match[2])]);
      if (!elements.length) return;
      const typed = highlight.styleTypes || {};
      Object.entries(typed).forEach(([type, color]) => {
        const normalized = type === 'segment' ? 'background' : type;
        const list = entriesByType.get(`${normalized}\0${color || ''}`) || [];
        list.push(...elements);
        entriesByType.set(`${normalized}\0${color || ''}`, list);
      });
      if (!Object.keys(typed).length && highlight.styleType) {
        const list = entriesByType.get(`${highlight.styleType}\0${highlight.color || ''}`) || [];
        list.push(...elements);
        entriesByType.set(`${highlight.styleType}\0${highlight.color || ''}`, list);
      }
      if (highlight.fill && !typed.background) addStyle('background', highlight.fill, elements);
      if (highlight.stroke && !typed.highlight) addStyle('highlight', highlight.stroke, elements);
      if (highlight.fixedMark) addStyle('mark', highlight.fixedMark, elements);
    });
    entriesByType.forEach((elements, key) => {
      const [type, color] = key.split('\0');
      addStyle(type, color, elements);
    });

    const drawId = `${context.idPrefix || 'trace-original'}-${safeKey(context.variableId)}`;
    window.draw_2Darray(drawId, { x: 0, y: 0 }, matrix, style, {}, 'normal', 0, -1, {
      targetGroup: group,
      objectLabel: context.variable?.name || '',
      rowLabels,
      columnLabels,
      innerLabels,
      showValue,
      gridlines: Object.prototype.hasOwnProperty.call(options, 'gridlines') ? options.gridlines : 1,
      outerframe: options.outerframe !== false
    });
    const objectKey = objectKeyForVariable(context.frame, context.variableId);
    const rowStride = 40 + (innerLabels ? 12 : 0);
    const originX = rowLabels ? 48 : 8;
    const originY = columnLabels ? 48 : 8;
    const setBounds = (element, x, y, width, height) => {
      element.setAttribute('data-outerframe-left', String(x));
      element.setAttribute('data-outerframe-top', String(y));
      element.setAttribute('data-outerframe-right', String(x + width));
      element.setAttribute('data-outerframe-bottom', String(y + height));
      return element;
    };
    const invisibleAxisTarget = (key, x, y, role) => {
      const target = markSelectable(setBounds(svg('g', {
        'data-trace-label-role': role, 'data-trace-axis-target': '1',
        opacity: 0, 'pointer-events': 'none'
      }), x, y, 40, 40), key, { ...context, interactive: false }, context.variableId);
      target.append(svg('rect', { x, y, width: 40, height: 40, fill: 'transparent' }));
      group.append(target);
      return target;
    };
    rows.forEach((row, rowIndex) => {
      (row?.items || []).forEach((item, columnIndex) => {
        const cellKey = `${objectKey}#${rowIndex},${columnIndex}`;
        const cell = group.querySelector(`#${CSS.escape(`block-${drawId}-${rowIndex}-${columnIndex}`)}`);
        if (cell) {
          cell.setAttribute('data-trace-index', `${rowIndex},${columnIndex}`);
          cell.querySelector(':scope > text')?.setAttribute('data-trace-content-role', 'value');
          markSelectable(cell, cellKey, context, context.variableId);
          markArrowTarget(cell, {
            key: cellKey, objectKey, objectLabel: context.variable?.name || context.variableId,
            indices: [rowIndex, columnIndex], kind: 'matrix-cell'
          });
        }
        const inner = group.querySelector(`#${CSS.escape(`block-${drawId}-${rowIndex}-${columnIndex}-inner`)}`);
        if (inner) {
          inner.setAttribute('data-trace-index-label', `${rowIndex},${columnIndex}`);
          inner.setAttribute('data-trace-label-role', 'inner');
          markSelectable(inner, `${cellKey}:index`, context, context.variableId);
        }
        ['highlight', 'point', 'mark'].forEach(kind => {
          const hint = group.querySelector(`#${CSS.escape(`${kind}-${drawId}-${rowIndex}-${columnIndex}`)}`);
          if (!hint) return;
          hint.setAttribute('data-trace-attached-to', cellKey);
          hint.setAttribute('data-trace-attachment-kind', kind);
          if (kind === 'highlight' || kind === 'point') {
            const highlight = context.highlights?.[`${rowIndex},${columnIndex}`]
              || context.highlights?.$object || {};
            const sourceIdentity = String(
              highlight.sourceStyleIds?.[kind]
              || highlight.sourceStyleId
              || highlight.eventId
              || `${context.variableId}:${rowIndex},${columnIndex}`
            );
            window.HintWidgets?.continuePresentationLoop?.(hint, `${kind}:${sourceIdentity}`);
          }
        });
      });
      const rowLabel = group.querySelector(`#${CSS.escape(`block-${drawId}-${rowIndex}-index`)}`);
      if (rowLabel) {
        rowLabel.setAttribute('data-trace-label-role', 'row');
        markSelectable(rowLabel, `${objectKey}:row-label:${rowIndex}`, context, context.variableId);
      } else {
        invisibleAxisTarget(`${objectKey}:row-label:${rowIndex}`,
          8, originY + rowIndex * rowStride, 'row');
      }
    });
    for (let columnIndex = 0; columnIndex < maxColumns; columnIndex += 1) {
      const columnLabel = group.querySelector(`#${CSS.escape(`block-${drawId}-index-${columnIndex}`)}`);
      if (columnLabel) {
        columnLabel.setAttribute('data-trace-label-role', 'column');
        markSelectable(columnLabel,
          `${objectKey}:column-label:${columnIndex}`, context, context.variableId);
      } else {
        invisibleAxisTarget(`${objectKey}:column-label:${columnIndex}`,
          originX + columnIndex * 40, 8, 'column');
      }
    }
    group.querySelectorAll(':scope > .outerframe-label').forEach(label => {
      markSelectable(label, `${context.variableId}:label`, context, context.variableId);
    });
    group.setAttribute('data-layout', 'matrix');
    group.setAttribute('data-box-size', '40');
    return originalBoundsHeight(group, 78);
  }

  function renderOriginalMatrix(group, entry, context) {
    const drawnHeight = renderOriginalMatrixWithDraw2DArray(group, entry, context);
    if (drawnHeight != null) return drawnHeight;
    const rows = Array.isArray(entry.data?.items) ? entry.data.items : [];
    const options = context.skin?.options || {};
    const cellSize = 40;
    const innerHeight = 12;
    const axisSize = 40;
    const gridlines = Math.max(0, Number.isFinite(Number(options.gridlines))
      ? Number(options.gridlines) : 1);
    const indexMode = Number.isFinite(Number(options.indexMode)) ? Number(options.indexMode) : 1;
    const showValue = options.showValue !== false && indexMode !== 2;
    const defaultIndices = indexMode !== 0 && options.showIndex !== false;
    const maxColumns = Math.max(0, ...rows.map(row => Array.isArray(row?.items) ? row.items.length : 0));
    const labelSpec = (name, fallback) => options[name] || fallback;
    const rowSpec = labelSpec('rowLabels', defaultIndices ? { mode: 'index', values: [] } : { mode: 'none', values: [] });
    const columnSpec = labelSpec('columnLabels', defaultIndices ? { mode: 'index', values: [] } : { mode: 'none', values: [] });
    const innerSpec = labelSpec('innerLabels', { mode: 'none', values: [] });
    const showRows = rowSpec.mode !== 'none';
    const showColumns = columnSpec.mode !== 'none';
    const showInner = innerSpec.mode !== 'none';
    const originX = showRows ? axisSize : 0;
    const originY = showColumns ? axisSize : 0;
    const rowStride = cellSize + (showInner ? innerHeight : 0);
    const contentWidth = Math.max(cellSize, maxColumns * cellSize);
    const contentHeight = Math.max(cellSize, rows.length * rowStride);
    const totalWidth = originX + contentWidth;
    const totalHeight = originY + contentHeight;
    const objectKey = objectKeyForVariable(context.frame, context.variableId);
    const setBounds = (element, x, y, width, height) => {
      element.setAttribute('data-outerframe-left', String(x));
      element.setAttribute('data-outerframe-top', String(y));
      element.setAttribute('data-outerframe-right', String(x + width));
      element.setAttribute('data-outerframe-bottom', String(y + height));
      return element;
    };
    const labelValue = (spec, first, second = null) => {
      if (spec.mode === 'index') return second == null ? first : second;
      if (spec.mode !== 'custom') return '';
      const value = second == null ? spec.values?.[first] : spec.values?.[first]?.[second];
      return value == null ? '' : displayValue(value);
    };
    const labelGroup = (key, x, y, width, height, text, role) => {
      const node = markSelectable(setBounds(svg('g', {
        transform: `translate(${x}, ${y})`, 'data-trace-label-role': role
      }), 0, 0, width, height), key, context, context.variableId);
      node.append(
        svg('rect', { x: 0, y: 0, width, height, fill: '#f5f7f8', stroke: '#59656b', 'stroke-width': gridlines }),
        svg('text', {
          x: width / 2, y: height / 2, 'text-anchor': 'middle', 'dominant-baseline': 'middle',
          'font-family': 'Arial', 'font-size': height <= innerHeight ? 9 : 12, fill: '#59656b'
        }, String(text))
      );
      return node;
    };
    const invisibleAxisTarget = (key, x, y, width, height, role) => {
      const node = markSelectable(setBounds(svg('g', {
        transform: `translate(${x}, ${y})`, 'data-trace-label-role': role,
        'data-trace-axis-target': '1', opacity: 0, 'pointer-events': 'none'
      }), 0, 0, width, height), key, { ...context, interactive: false }, context.variableId);
      node.append(svg('rect', { x: 0, y: 0, width, height, fill: 'transparent' }));
      return node;
    };

    if (options.outerframe !== false) {
      group.append(svg('rect', {
        class: 'trace-matrix-outerframe', x: -8, y: -8,
        width: totalWidth + 16, height: totalHeight + 36,
        rx: 3, fill: '#ffffff', stroke: '#8b979d', 'stroke-width': 1
      }));
    }
    if (showColumns) {
      for (let column = 0; column < maxColumns; column += 1) {
        group.append(labelGroup(`${objectKey}:column-label:${column}`,
          originX + column * cellSize, 0, cellSize, axisSize,
          labelValue(columnSpec, column), 'column'));
      }
    } else {
      for (let column = 0; column < maxColumns; column += 1) {
        group.append(invisibleAxisTarget(`${objectKey}:column-label:${column}`,
          originX + column * cellSize, 0, cellSize, cellSize, 'column'));
      }
    }
    rows.forEach((row, rowIndex) => {
      const items = Array.isArray(row?.items) ? row.items : [];
      const y = originY + rowIndex * rowStride;
      if (showRows) {
        group.append(labelGroup(`${objectKey}:row-label:${rowIndex}`,
          0, y, axisSize, cellSize, labelValue(rowSpec, rowIndex), 'row'));
      } else {
        group.append(invisibleAxisTarget(`${objectKey}:row-label:${rowIndex}`,
          0, y, cellSize, cellSize, 'row'));
      }
      items.forEach((item, columnIndex) => {
        const x = originX + columnIndex * cellSize;
        const cellKey = `${objectKey}#${rowIndex},${columnIndex}`;
        const highlight = context.highlights?.[`${rowIndex},${columnIndex}`]
          || context.highlights?.$object || {};
        const cell = markSelectable(setBounds(svg('g', {
          transform: `translate(${x}, ${y})`, 'data-trace-index': `${rowIndex},${columnIndex}`
        }), 0, 0, cellSize, cellSize), cellKey, context, context.variableId);
        markArrowTarget(cell, {
          key: cellKey, objectKey, objectLabel: context.variable?.name || context.variableId,
          indices: [rowIndex, columnIndex], kind: 'matrix-cell'
        });
        const rect = svg('rect', {
          x: 0, y: 0, width: cellSize, height: cellSize,
          fill: '#ffffff', stroke: '#59656b', 'stroke-width': gridlines, 'pointer-events': 'all'
        });
        applyHighlight(rect, highlight);
        cell.append(rect);
        if (showValue) {
          cell.append(svg('text', {
            x: cellSize / 2, y: cellSize / 2, 'text-anchor': 'middle', 'dominant-baseline': 'middle',
            'font-family': 'Arial', 'font-size': 16, fill: '#1f282d', 'data-trace-content-role': 'value'
          }, formatDisplayValue(item, options, context.variable?.name || '', context.variableId)));
        }
        group.append(cell);
        if (showInner) {
          const inner = labelGroup(`${cellKey}:index`, x, y + cellSize, cellSize, innerHeight,
            labelValue(innerSpec, rowIndex, columnIndex), 'inner');
          inner.setAttribute('data-trace-index-label', `${rowIndex},${columnIndex}`);
          applyHighlight(inner.querySelector('rect'), highlight);
          inner.querySelector('rect')?.setAttribute('fill', '#ffffff');
          group.append(inner);
        }
      });
    });
    group.append(markSelectable(svg('text', {
      class: 'outerframe-label', x: 0, y: totalHeight + 22,
      'font-family': 'Arial', 'font-size': 16, 'font-weight': 'bold', fill: '#1f282d'
    }, context.variable?.name || ''), `${context.variableId}:label`, context, context.variableId));
    group.setAttribute('data-layout', 'matrix');
    group.setAttribute('data-box-size', String(cellSize));
    group.setAttribute('data-matrix-origin-x', String(originX));
    group.setAttribute('data-matrix-origin-y', String(originY));
    group.setAttribute('data-matrix-row-stride', String(rowStride));
    group.setAttribute('data-outerframe-left', options.outerframe === false ? '0' : '-8');
    group.setAttribute('data-outerframe-top', options.outerframe === false ? '0' : '-8');
    group.setAttribute('data-outerframe-right', String(totalWidth + (options.outerframe === false ? 0 : 8)));
    group.setAttribute('data-outerframe-bottom', String(totalHeight + 28));
    return totalHeight + 36;
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

  function snapshotObjectKey(snapshot) {
    return String(snapshot?.objectId || snapshot?.id || '');
  }

  function keepSnapshotObjectKeys(document, frame, sourceObjectKey = '') {
    const snapshotsById = new Map((document?.snapshots || []).map(snapshot => [snapshot.id, snapshot]));
    const objectKeys = (frame?.snapshotIds || []).map(snapshotId => (
      snapshotObjectKey(snapshotsById.get(snapshotId))
    )).filter(Boolean);
    const sourceIndex = sourceObjectKey ? objectKeys.indexOf(sourceObjectKey) : -1;
    return sourceIndex >= 0 ? objectKeys.slice(0, sourceIndex) : objectKeys;
  }

  function keepUnionPlacement(document, frame, placements, sourceObjectKey = '') {
    const snapshotsById = new Map((document?.snapshots || []).map(snapshot => [snapshot.id, snapshot]));
    const visibilityStates = document?.studio?.visibility?.[frame?.id] || {};
    const snapshotIdsByObjectKey = new Map((frame?.snapshotIds || []).map(snapshotId => {
      const objectKey = snapshotObjectKey(snapshotsById.get(snapshotId));
      return [objectKey, snapshotId];
    }));
    const boxes = keepSnapshotObjectKeys(document, frame, sourceObjectKey).map(objectKey => {
      const snapshotId = snapshotIdsByObjectKey.get(objectKey);
      if (!objectKey || (visibilityStates[objectKey] || visibilityStates[snapshotId]) === 'hidden') return null;
      return placements.get(objectKey) || null;
    }).filter(box => box && [box.x, box.y, box.width, box.height].every(Number.isFinite));
    if (!boxes.length) return null;
    const left = Math.min(...boxes.map(box => box.x));
    const top = Math.min(...boxes.map(box => box.y));
    const right = Math.max(...boxes.map(box => box.x + box.width));
    const bottom = Math.max(...boxes.map(box => box.y + box.height));
    return { x: left, y: top, width: right - left, height: bottom - top };
  }

  function snapshotStudioPosition(document, frame, snapshot) {
    const positions = document.studio?.positions?.[frame.id] || {};
    const objectKey = snapshotObjectKey(snapshot);
    const hasObjectPosition = Object.prototype.hasOwnProperty.call(positions, objectKey);
    const hasSnapshotPosition = Object.prototype.hasOwnProperty.call(positions, snapshot.id);
    if (hasObjectPosition || hasSnapshotPosition) {
      return {
        ...studioPosition(document, frame, hasObjectPosition ? objectKey : snapshot.id),
        explicit: true
      };
    }

    const offsetX = Number(snapshot?.placementOffset?.x) || 0;
    const offsetY = Number(snapshot?.placementOffset?.y) || 0;
    if (snapshot?.kind !== 'frame' && snapshot?.sourceFrameId && snapshot?.sourceVariableId) {
      const sourceFrame = document.frames?.find(item => item.id === snapshot.sourceFrameId);
      const sourceKey = objectKeyForVariable(sourceFrame, snapshot.sourceVariableId);
      const sourcePositions = document.studio?.positions?.[sourceFrame?.id] || {};
      const inheritedKey = Object.prototype.hasOwnProperty.call(sourcePositions, sourceKey)
        ? sourceKey
        : snapshot.sourceVariableId;
      const inherited = studioPosition(document, sourceFrame || {}, inheritedKey);
      return {
        x: inherited.x + offsetX,
        y: inherited.y + offsetY,
        absolute: inherited.absolute,
        explicit: false
      };
    }
    return { x: offsetX, y: offsetY, absolute: false, explicit: false };
  }

  function objectKeyForVariable(frame, variableId) {
    const source = frame?.source || {};
    if (source.objectIds?.[variableId]) return source.objectIds[variableId];
    if (source.objectId && source.primaryVariableId === variableId) return source.objectId;
    return variableId;
  }

  function snapshotAutomaticBinding(document, snapshot) {
    if (!snapshot) return null;
    if (snapshot.kind !== 'frame' && snapshot.sourceFrameId && snapshot.sourceVariableId) {
      const sourceFrame = document.frames?.find(item => item.id === snapshot.sourceFrameId);
      const sourceKey = objectKeyForVariable(sourceFrame, snapshot.sourceVariableId);
      const inherited = document.studio?.bindings?.[sourceFrame?.id]?.[sourceKey]
        || document.studio?.bindings?.[sourceFrame?.id]?.[snapshot.sourceVariableId];
      if (inherited) return { ...inherited };
    }
    return snapshot.binding ? { ...snapshot.binding } : null;
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

  function objectMotionPositions(rootSvg, fallbackPositions) {
    const positions = new Map(fallbackPositions || objectPositions(rootSvg));
    rootSvg.querySelectorAll(
      '#asm-trace-root [data-trace-object-key][data-trace-position-space]'
    ).forEach(object => {
      const x = Number(object.getAttribute('data-trace-position-x'));
      const y = Number(object.getAttribute('data-trace-position-y'));
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      // Child cells use measured bounds while top-level objects use their
      // transform origin. Both are valid motion coordinates. Ignoring the
      // bounds form made a freshly reloaded first transition treat every cell
      // as (0, 0), so the array appeared to expand from its outerframe corner.
      positions.set(object.dataset.traceObjectKey, { x, y });
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
      // Capture the top-level @text object so it can fade out. Text segments
      // remain children of that object and must not become duplicate ghosts.
      if (element.closest?.('.asm-trace-text-layer')
        && !element.classList.contains('asm-trace-text-object')) return;
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

  function capturedKeysByRuntimeIdentity(captured) {
    const keys = new Map();
    captured?.forEach?.((element, key) => {
      const identity = element?.dataset?.traceRuntimeIdentity || '';
      if (identity && !keys.has(identity)) keys.set(identity, key);
    });
    return keys;
  }

  function capturedObjectFor(captured, element, requestedKey, identityKeys) {
    if (requestedKey && captured?.has?.(requestedKey)) {
      return { key: requestedKey, element: captured.get(requestedKey) };
    }
    const identity = element?.dataset?.traceRuntimeIdentity || '';
    const aliasKey = identity ? identityKeys.get(identity) : '';
    return {
      key: aliasKey || requestedKey || '',
      element: aliasKey ? captured.get(aliasKey) : null
    };
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

  function isArrayLifecycleElement(element) {
    return Boolean(element?.matches?.('[data-trace-lifecycle-kind="array"]')
      || element?.closest?.('[data-trace-lifecycle-kind="array"]'));
  }

  function animatePosition(motion, previous, current, enabled, plan = null, additive = false) {
    if (!enabled || !plan || plan.mode === 'instant' || Number(plan.duration) <= 0) return;
    if (plan.mode === 'fade') {
      animateOpacity(motion, plan);
      return;
    }
    if (!previous || plan.mode === 'lift') {
      if (isArrayLifecycleElement(motion)) {
        animateOpacity(motion, plan);
        return;
      }
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
    const identityKeys = capturedKeysByRuntimeIdentity(captured);
    elements.forEach((element, key) => {
      const plan = transitionForKey(options, key);
      if (plan?.requestedMode !== 'auto' || !plan.sourceExists || Number(plan.duration) <= 0) return;
      const hasDedicatedSwap = (options.frame?.events || []).some(event => (
        event.type === 'swap' && (event.targets || []).some(target => target.variableId === key)
      ));
      if (hasDedicatedSwap) return;
      const previousMatch = capturedObjectFor(
        captured, element, plan.sourceKey || key, identityKeys
      );
      const previous = previousMatch.element;
      if (!previous || transitionVisualSignature(previous) === transitionVisualSignature(element)) return;
      const currentIdentity = element.dataset.traceRuntimeIdentity || '';
      const previousIdentity = previous.dataset.traceRuntimeIdentity || '';
      if (currentIdentity && currentIdentity === previousIdentity) return;
      const motion = element.querySelector(':scope > .asm-trace-motion') || element;
      if (motion.querySelector(':scope > animate[attributeName="opacity"]')) return;
      animateOpacity(motion, plan, 0.35, 1);
    });
  }

  function animateRemovedObjects(root, captured, elements, document, options) {
    if (options.animatePositions === false || !captured?.size) return;
    const consumed = new Set();
    const identityKeys = capturedKeysByRuntimeIdentity(captured);
    elements.forEach((element, key) => {
      const plan = transitionForKey(options, key);
      if (plan?.sourceKey) consumed.add(plan.sourceKey);
      const identity = element?.dataset?.traceRuntimeIdentity || '';
      const aliasKey = identity ? identityKeys.get(identity) : '';
      if (aliasKey) consumed.add(aliasKey);
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
      ghost.append(animation);
      if (!isArrayLifecycleElement(ghost)) {
        ghost.append(svg('animateTransform', {
          attributeName: 'transform', type: 'translate', additive: 'sum',
          from: '0 0', to: '0 -15',
          ...animationAttributes(plan)
        }));
      }
      startSvgAnimation(animation);
      ghost.querySelectorAll(':scope > animateTransform').forEach(startSvgAnimation);
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
      id: markerId, viewBox: '0 0 10 10', refX: 0, refY: 5,
      markerWidth: 3, markerHeight: 3, markerUnits: 'strokeWidth',
      orient: 'auto-start-reverse'
    });
    marker.append(svg('path', { d: 'M 0 0 L 10 5 L 0 10 Z', fill: 'context-stroke' }));
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

  function recursionLayoutEdgePoints(from, to, direction = 'top-down') {
    const normalized = String(direction || 'top-down').toLowerCase();
    let startAnchor = 'bottom';
    let endAnchor = 'top';
    if (normalized === 'bottom-up') {
      startAnchor = 'top';
      endAnchor = 'bottom';
    } else if (normalized === 'left-right') {
      startAnchor = 'right';
      endAnchor = 'left';
    } else if (normalized === 'right-left') {
      startAnchor = 'left';
      endAnchor = 'right';
    }
    const start = anchorPoint(from, startAnchor);
    const end = anchorPoint(to, endAnchor);
    return { x1: start.x, y1: start.y, x2: end.x, y2: end.y };
  }

  function recursionOuterframePlacement(element, fallback, stop, preferredVariableId = '') {
    if (!element) return fallback;
    let owner = element;
    if (preferredVariableId) {
      owner = [...element.querySelectorAll('[data-trace-variable]')].find(candidate => (
        candidate.dataset.traceVariable === preferredVariableId
      )) || owner;
    }
    const candidate = owner.matches?.('[data-outerframe-left][data-outerframe-top][data-outerframe-right][data-outerframe-bottom]')
      ? owner
      : owner.querySelector?.('[data-outerframe-left][data-outerframe-top][data-outerframe-right][data-outerframe-bottom]');
    if (!candidate) return fallback;
    const left = Number(candidate.getAttribute('data-outerframe-left'));
    const top = Number(candidate.getAttribute('data-outerframe-top'));
    const right = Number(candidate.getAttribute('data-outerframe-right'));
    const bottom = Number(candidate.getAttribute('data-outerframe-bottom'));
    if (![left, top, right, bottom].every(Number.isFinite) || right <= left || bottom <= top) return fallback;
    const shift = translateWithin(candidate, stop);
    return {
      x: left + shift.x,
      y: top + shift.y,
      width: right - left,
      height: bottom - top
    };
  }

  function semanticTargetPlacement(targetKey, placements, elements) {
    const fallback = placements.get(targetKey) || null;
    const element = elements.get(targetKey);
    if (!fallback || !element) return fallback;
    // A semantic object anchor such as arr.right belongs to the object's
    // stable outerframe. Transient point/highlight/marker decorations may
    // extend the SVG bounding box, but must never move the anchor itself.
    return recursionOuterframePlacement(
      element,
      fallback,
      element.parentElement
    );
  }

  function keepAnchorPlacement(document, frame, placements, elements, sourceObjectKey = '') {
    const snapshotsById = new Map((document?.snapshots || []).map(snapshot => [snapshot.id, snapshot]));
    const visibilityStates = document?.studio?.visibility?.[frame?.id] || {};
    const snapshotIdsByObjectKey = new Map((frame?.snapshotIds || []).map(snapshotId => {
      const objectKey = snapshotObjectKey(snapshotsById.get(snapshotId));
      return [objectKey, snapshotId];
    }));
    const boxes = keepSnapshotObjectKeys(document, frame, sourceObjectKey).map(objectKey => {
      const snapshotId = snapshotIdsByObjectKey.get(objectKey);
      if (!objectKey || (visibilityStates[objectKey] || visibilityStates[snapshotId]) === 'hidden') return null;
      return semanticTargetPlacement(objectKey, placements, elements);
    }).filter(box => box && [box.x, box.y, box.width, box.height].every(Number.isFinite));
    if (!boxes.length) return null;
    const left = Math.min(...boxes.map(box => box.x));
    const top = Math.min(...boxes.map(box => box.y));
    const right = Math.max(...boxes.map(box => box.x + box.width));
    const bottom = Math.max(...boxes.map(box => box.y + box.height));
    return { x: left, y: top, width: right - left, height: bottom - top };
  }

  function keepArrowObjectKey(fromStageKey, runtimeIdentity, variableId) {
    const sourceKey = String(fromStageKey || 'snapshot');
    const continuityKey = runtimeIdentity
      ? `identity:${runtimeIdentity}`
      : `variable:${variableId || ''}`;
    return `keep-arrow:${sourceKey}:${continuityKey}`;
  }

  function renderKeepLastArrows(rootSvg, root, document, frame, placements, elements, keepNodes, options = {}) {
    if (!keepNodes.length) return;
    const color = 'rgba(255, 58, 58, 0.7)';
    const width = 4;
    const markerId = ensureKeepArrowMarker(rootSvg, options.idPrefix || 'asm-trace', color);
    const layer = svg('g', {
      id: `${options.idPrefix || 'asm-trace'}-keep-arrows`,
      class: 'asm-trace-keep-arrows',
      'pointer-events': 'none'
    });
    const byVariable = new Map();
    keepNodes.forEach(node => {
      const groupKey = node.runtimeIdentity
        ? `identity:${node.runtimeIdentity}`
        : `variable:${node.variableId}`;
      if (!byVariable.has(groupKey)) byVariable.set(groupKey, []);
      byVariable.get(groupKey).push(node);
    });

    byVariable.forEach(nodes => {
      const runtimeIdentity = nodes.find(node => node.runtimeIdentity)?.runtimeIdentity || '';
      const variableId = nodes.map(node => node.variableId).find(id => frame.state?.[id])
        || (runtimeIdentity
          ? Object.entries(frame.state || {}).find(([, entry]) => (
            String(entry?.identity || '') === String(runtimeIdentity)
          ))?.[0]
          : '')
        || nodes[0]?.variableId;
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
        const geometry = window.ASMArrowModel?.geometry?.(
          points.start,
          points.end,
          { outerframe: true },
          { outerframe: true },
          { color, width, headStart: 'none', headEnd: 'arrow' }
        ) || {
          x1: points.start.x, y1: points.start.y,
          x2: points.end.x, y2: points.end.y
        };
        // Recursive calls give reference parameters a new variableId even when
        // they still point at the same container.  Keep the arrow keyed to the
        // container identity so a continuous arr does not re-enter every frame.
        const key = keepArrowObjectKey(fromStage.key, runtimeIdentity, variableId);
        const line = svg('line', {
          class: 'asm-trace-keep-arrow',
          x1: geometry.x1,
          y1: geometry.y1,
          x2: geometry.x2,
          y2: geometry.y2,
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
    return window.ASMTraceRules.conditionMatches(frame, arrow.condition || arrow.when);
  }

  function normalizedArrow(arrow, defaults = {}) {
    if (window.ASMArrowModel?.normalize) return window.ASMArrowModel.normalize(arrow, defaults);
    return {
      ...arrow,
      id: String(arrow?.id || defaults.id || ''),
      source: String(arrow?.source || defaults.source || 'studio'),
      from: arrow?.from || {},
      to: arrow?.to || {},
      style: {
        color: arrow?.style?.color || arrow?.color || defaults.color || 'black',
        width: Number(arrow?.style?.width ?? arrow?.width ?? defaults.width) || 2,
        line: arrow?.style?.line || arrow?.line || defaults.line || 'straight',
        dash: arrow?.style?.dash || arrow?.dash || '',
        headStart: 'none', headEnd: 'arrow'
      },
      condition: arrow?.condition || arrow?.when || null,
      frameIds: Array.isArray(arrow?.frameIds) ? arrow.frameIds : []
    };
  }

  function arrowPlacement(document, frame, placements, elements, target, override = null) {
    if (override) return override;
    if (target?.canvas) return { x: 0, y: 0, width: 1100, height: 620 };
    const variableId = target?.variableId || target?.targetVariableId;
    return targetPlacement(document, frame, placements, {
      ...target,
      // A parsed C++ endpoint contains both its source name and resolved
      // runtime variable ID. The name is descriptive, not a canvas object ID.
      objectKey: target?.objectKey || target?.targetObjectKey || (!variableId ? target?.targetName : ''),
      variableId,
      indexExpression: target?.indexExpression
        || (Array.isArray(target?.indexExpressions) ? target.indexExpressions.join(',') : '')
    }, elements);
  }

  function renderArrowModels(rootSvg, root, document, frame, placements, elements,
    arrows, options = {}, layerName = 'shared') {
    if (!Array.isArray(arrows) || !arrows.length) return;
    let unresolvedCount = 0;
    const markerId = ensureArrowMarker(rootSvg, `${options.idPrefix || 'asm-trace'}-${safeKey(layerName)}`);
    const layer = svg('g', {
      id: `${options.idPrefix || 'asm-trace'}-${safeKey(layerName)}-arrows`,
      class: `asm-trace-arrow-layer asm-trace-${safeKey(layerName)}-arrows`,
      'pointer-events': 'none'
    });
    arrows.forEach((input, arrowIndex) => {
      const arrow = normalizedArrow(input, {
        id: `${layerName}-${arrowIndex}`,
        source: layerName,
        color: 'black', width: 2, head: 'end'
      });
      if (!arrowVisible(arrow, frame)) return;
      const fromPlacement = arrowPlacement(document, frame, placements, elements, arrow.from, input._fromPlacement);
      const toPlacement = arrowPlacement(document, frame, placements, elements, arrow.to, input._toPlacement);
      if (!fromPlacement || !toPlacement) {
        unresolvedCount += 1;
        return;
      }
      const fromAnchor = anchorPoint(fromPlacement, arrow.from.anchor || 'right');
      const toAnchor = anchorPoint(toPlacement, arrow.to.anchor || 'left');
      if (!fromAnchor || !toAnchor) return;
      const start = { x: fromAnchor.x + (Number(arrow.from.dx) || 0), y: fromAnchor.y + (Number(arrow.from.dy) || 0) };
      const end = { x: toAnchor.x + (Number(arrow.to.dx) || 0), y: toAnchor.y + (Number(arrow.to.dy) || 0) };
      const fromTarget = { ...arrow.from, outerframe: !arrow.from.indexExpression };
      const toTarget = { ...arrow.to, outerframe: !arrow.to.indexExpression };
      const geometry = window.ASMArrowModel?.geometry
        ? window.ASMArrowModel.geometry(start, end, fromTarget, toTarget, arrow.style)
        : { x1: start.x, y1: start.y, x2: end.x, y2: end.y };
      if (!geometry) return;
      const activation = String(frame.source?.recursionActivationId || frame.source?.function || '');
      const runtimeId = arrow.source === 'directive' && arrow.explicitId === false && activation
        ? `${arrow.id}@${activation}` : arrow.id;
      const key = arrow.source === 'studio'
        ? `arrow:${arrow.id}`
        : `arrow:${arrow.source}:${runtimeId}`;
      const attributes = {
        id: `trace-arrow-${safeKey(`${arrow.source}-${arrow.id}`)}`,
        class: input.className || 'asm-trace-arrow',
        stroke: arrow.style.color,
        'stroke-width': arrow.style.width,
        fill: 'none',
        'data-trace-arrow': arrow.id,
        'data-trace-arrow-runtime-id': runtimeId,
        'data-trace-arrow-name': arrow.displayName || arrow.id,
        'data-trace-arrow-identity': JSON.stringify({ id: arrow.id, source: arrow.source,
          explicitId: arrow.explicitId ?? (arrow.source === 'studio' ? true : undefined),
          scope: arrow.source === 'directive' ? activation : '',
          fromObject: arrow.from.variableId || arrow.from.objectKey || arrow.from.targetName,
          toObject: arrow.to.variableId || arrow.to.objectKey || arrow.to.targetName,
          line: arrow.style.line, headStart: arrow.style.headStart, headEnd: arrow.style.headEnd }),
        'data-trace-arrow-source': arrow.source,
        'data-trace-arrow-layer': arrow.layer,
        'data-trace-arrow-from-key': resolvedTargetKey(document, frame, arrow.from, placements),
        'data-trace-arrow-to-key': resolvedTargetKey(document, frame, arrow.to, placements),
        'data-trace-arrow-from-cell': String(Boolean(arrow.from.indexExpression)),
        'data-trace-arrow-to-cell': String(Boolean(arrow.to.indexExpression)),
        'data-trace-arrow-from-anchor': arrow.from.anchor || 'center',
        'data-trace-arrow-to-anchor': arrow.to.anchor || 'center',
        'data-trace-arrow-from-dx': arrow.from.dx || 0,
        'data-trace-arrow-from-dy': arrow.from.dy || 0,
        'data-trace-arrow-to-dx': arrow.to.dx || 0,
        'data-trace-arrow-to-dy': arrow.to.dy || 0,
        'data-trace-arrow-head-start': arrow.style.headStart,
        'data-trace-arrow-head-end': arrow.style.headEnd,
        'data-trace-object-key': key,
        'data-arrow-key': key
      };
      if (arrow.style.dash) attributes['stroke-dasharray'] = arrow.style.dash;
      if (arrow.style.headStart === 'arrow') attributes['marker-start'] = `url(#${markerId})`;
      if (arrow.style.headEnd === 'arrow') attributes['marker-end'] = `url(#${markerId})`;
      const curved = arrow.style.line === 'curve';
      let element;
      let lift = 0;
      if (curved) {
        lift = Math.max(24, Math.min(70, Math.abs(geometry.x2 - geometry.x1) * 0.45));
        element = svg('path', {
          ...attributes,
          d: `M ${geometry.x1} ${geometry.y1} C ${geometry.x1} ${geometry.y1 - lift}, ${geometry.x2} ${geometry.y2 - lift}, ${geometry.x2} ${geometry.y2}`
        });
      } else {
        element = svg('line', {
          ...attributes,
          x1: geometry.x1, y1: geometry.y1, x2: geometry.x2, y2: geometry.y2
        });
      }
      markSelectable(element, key, { ...options, movable: arrow.source === 'studio' });
      layer.append(element);
      placements.set(key, {
        x: Math.min(geometry.x1, geometry.x2),
        y: Math.min(geometry.y1, geometry.y2) - lift,
        width: Math.max(1, Math.abs(geometry.x2 - geometry.x1)),
        height: Math.max(1, Math.abs(geometry.y2 - geometry.y1) + lift)
      });
      elements.set(key, element);
      const arrowTargetKey = element.dataset.traceArrowTargetKey;
      if (element.dataset.traceArrowTarget === '1' && arrowTargetKey && arrowTargetKey !== key) {
        placements.set(arrowTargetKey, placements.get(key));
        elements.set(arrowTargetKey, element);
      }
    });
    root.setAttribute(`data-trace-${safeKey(layerName)}-arrow-count`, String(layer.childElementCount));
    root.setAttribute(`data-trace-${safeKey(layerName)}-arrow-unresolved`, String(unresolvedCount));
    if (layer.childElementCount) root.append(layer);
  }

  function refreshPresentedArrows(root, elements) {
    const model = window.ASMArrowModel;
    if (!root?.isConnected || !model?.presentedBounds) return;
    root.querySelectorAll('.asm-trace-arrow-layer [data-trace-arrow-from-key]').forEach(arrow => {
      const fromKey = arrow.dataset.traceArrowFromKey;
      const toKey = arrow.dataset.traceArrowToKey;
      const fromCell = arrow.dataset.traceArrowFromCell === 'true';
      const toCell = arrow.dataset.traceArrowToCell === 'true';
      const fromElement = elements.get(fromKey);
      const toElement = elements.get(toKey);
      const fromBox = model.presentedBounds(fromElement, root, !fromCell);
      const toBox = model.presentedBounds(toElement, root, !toCell);
      if (!fromBox || !toBox) {
        arrow.setAttribute('display', 'none');
        return;
      }
      const startAnchor = anchorPoint(fromBox, arrow.dataset.traceArrowFromAnchor);
      const endAnchor = anchorPoint(toBox, arrow.dataset.traceArrowToAnchor);
      let start = {
        x: startAnchor.x + Number(arrow.dataset.traceArrowFromDx || 0),
        y: startAnchor.y + Number(arrow.dataset.traceArrowFromDy || 0)
      };
      let end = {
        x: endAnchor.x + Number(arrow.dataset.traceArrowToDx || 0),
        y: endAnchor.y + Number(arrow.dataset.traceArrowToDy || 0)
      };
      const style = {
        width: Number(arrow.getAttribute('stroke-width')) || 2,
        headStart: arrow.dataset.traceArrowHeadStart,
        headEnd: arrow.dataset.traceArrowHeadEnd
      };
      const tween = arrow._asmArrowTween;
      if (tween) {
        const progress = tween.progress;
        const oldPoint = (role, fallback) => {
          const key = tween.previous.dataset[`traceArrow${role}Key`];
          const oldElement = elements.get(key);
          const oldBox = model.presentedBounds(oldElement, root,
            tween.previous.dataset[`traceArrow${role}Cell`] !== 'true');
          if (oldBox) {
            const point = anchorPoint(oldBox, tween.previous.dataset[`traceArrow${role}Anchor`]);
            return { x: point.x + Number(tween.previous.dataset[`traceArrow${role}Dx`] || 0),
              y: point.y + Number(tween.previous.dataset[`traceArrow${role}Dy`] || 0) };
          }
          const x = Number(tween.previous.dataset[`traceArrow${role}X`]);
          const y = Number(tween.previous.dataset[`traceArrow${role}Y`]);
          return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : fallback;
        };
        const sameBinding = role => ['Key', 'Anchor', 'Dx', 'Dy'].every(field =>
          tween.previous.dataset[`traceArrow${role}${field}`] === arrow.dataset[`traceArrow${role}${field}`]);
        const blend = (old, target) => ({ x: old.x + (target.x - old.x) * progress,
          y: old.y + (target.y - old.y) * progress });
        if (!sameBinding('From')) start = blend(oldPoint('From', start), start);
        if (!sameBinding('To')) end = blend(oldPoint('To', end), end);
        arrow.setAttribute('stroke', tween.color(tween.previous.getAttribute('stroke'), tween.targetColor, progress));
        style.width = Number(tween.previous.getAttribute('stroke-width'))
          + (tween.targetWidth - Number(tween.previous.getAttribute('stroke-width'))) * progress;
        arrow.setAttribute('stroke-width', style.width);
      }
      arrow.dataset.traceArrowFromX = String(start.x);
      arrow.dataset.traceArrowFromY = String(start.y);
      arrow.dataset.traceArrowToX = String(end.x);
      arrow.dataset.traceArrowToY = String(end.y);
      const geometry = model.geometry(start, end,
        { anchor: arrow.dataset.traceArrowFromAnchor, outerframe: !fromCell, indexExpression: fromCell ? 'cell' : '' },
        { anchor: arrow.dataset.traceArrowToAnchor, outerframe: !toCell, indexExpression: toCell ? 'cell' : '' }, style);
      if (!geometry) {
        arrow.setAttribute('display', 'none');
        return;
      }
      arrow.removeAttribute('display');
      if (arrow.tagName.toLowerCase() === 'path') {
        const lift = Math.max(24, Math.min(70, Math.abs(geometry.x2 - geometry.x1) * 0.45));
        arrow.setAttribute('d', `M ${geometry.x1} ${geometry.y1} C ${geometry.x1} ${geometry.y1 - lift}, ${geometry.x2} ${geometry.y2 - lift}, ${geometry.x2} ${geometry.y2}`);
      } else {
        arrow.setAttribute('x1', geometry.x1);
        arrow.setAttribute('y1', geometry.y1);
        arrow.setAttribute('x2', geometry.x2);
        arrow.setAttribute('y2', geometry.y2);
      }
    });
  }

  function settleArrowLayers(root) {
    let background = root.querySelector(':scope > .asm-trace-background-arrows');
    let foreground = root.querySelector(':scope > .asm-trace-foreground-arrows');
    if (!background) background = svg('g', { class: 'asm-trace-background-arrows', 'data-trace-arrow-layer': 'background' });
    if (!foreground) foreground = svg('g', { class: 'asm-trace-foreground-arrows', 'data-trace-arrow-layer': 'foreground' });
    [...root.children].filter(child => child.matches?.('.asm-trace-arrow-layer, .asm-trace-layout-edges, .asm-trace-keep-arrows'))
      .forEach(layer => {
        const foregroundLayer = layer.classList.contains('asm-trace-directive-arrows')
          || layer.classList.contains('asm-trace-studio-arrows');
        (foregroundLayer ? foreground : background).append(layer);
      });
    root.prepend(background);
    root.append(foreground);
  }

  // Decorations are painted above objects, but below foreground arrows. Keep
  // their authored draw-system geometry in cell-local coordinates; a cell's
  // presented matrix (including event lift/scale) is the only motion source.
  function attachStyleVisual(root, visual, cell, kind = '') {
    if (!root?.contains(visual) || !root.contains(cell) || !cell?.getScreenCTM) return false;
    const parent = visual.parentElement;
    const cellMatrix = cell.getScreenCTM();
    const parentMatrix = parent?.getScreenCTM?.();
    if (!cellMatrix || !parentMatrix) return false;
    let basis;
    try { basis = cellMatrix.inverse().multiply(parentMatrix); } catch { return false; }
    let layer = [...root.children].find(child => child.classList?.contains('asm-trace-style-layer'));
    if (!layer) {
      layer = svg('g', { class: 'asm-trace-style-layer', 'data-trace-style-layer': 'foreground', 'pointer-events': 'none' });
      root.insertBefore(layer, [...root.children].find(child => child.classList?.contains('asm-trace-foreground-arrows')) || null);
    }
    const wrapper = svg('g', {
      class: `asm-trace-style-decoration${kind ? ` asm-trace-style-${kind}` : ''}`,
      'pointer-events': 'none'
    });
    wrapper._asmStyleCell = cell;
    wrapper._asmStyleBasis = basis;
    if (['highlight', 'compare'].includes(kind) && visual.tagName?.toLowerCase() === 'rect') {
      const rect = [...cell.children].find(child => child.tagName?.toLowerCase() === 'rect');
      if (rect) {
        const number = (element, name) => Number(element.getAttribute(name)) || 0;
        wrapper._asmStyleRect = rect;
        const key = cell.getAttribute('data-trace-object-key');
        const index = cell.getAttribute('data-trace-index');
        const indexCell = kind !== 'highlight' ? null : currentScene?.elements?.get?.(`${key}:index`)
          || (index !== null ? [...(cell.parentElement?.children || [])]
            .find(child => child.getAttribute('data-trace-index-label') === index) : null);
        wrapper._asmStyleIndexRect = [...(indexCell?.children || [])]
          .find(child => child.tagName?.toLowerCase() === 'rect');
        wrapper._asmStyleUsesIndexHeight = kind === 'highlight';
        wrapper._asmStyleInsets = {
          left: number(visual, 'x') - number(rect, 'x'),
          top: number(visual, 'y') - number(rect, 'y'),
          right: number(visual, 'x') + number(visual, 'width') - number(rect, 'x') - number(rect, 'width'),
          bottom: number(visual, 'y') + number(visual, 'height') - number(rect, 'y') - number(rect, 'height')
        };
      }
    }
    wrapper.append(visual);
    layer.append(wrapper);
    return true;
  }

  function updatePresentedHints(cell, highlight, key) {
    const root = cell?.closest?.('#asm-trace-root');
    const rect = cell?.querySelector?.(':scope > rect');
    if (!root || !rect || !window.HintWidgets) return;
    const authoredHints = new Map();
    root.querySelectorAll('[data-trace-attached-to]').forEach(visual => {
      if (visual.getAttribute('data-trace-attached-to') !== key || visual._asmLiveHint) return;
      const kind = visual.getAttribute('data-trace-attachment-kind') || '';
      if (kind && !authoredHints.has(kind)) authoredHints.set(kind, visual);
      else visual.setAttribute('display', 'none');
    });
    const hints = cell._asmPresentedHints ||= new Map();
    const types = { ...(highlight?.fixedMark ? { mark: highlight.fixedMark } : {}), ...(highlight?.styleTypes || {}) };
    const number = name => Number(rect.getAttribute(name)) || 0;
    const x = number('x'), y = number('y'), width = number('width'), height = number('height');
    ['highlight', 'point', 'mark'].forEach(kind => {
      let visual = hints.get(kind) || authoredHints.get(kind);
      if (visual && !hints.has(kind)) {
        visual._asmLiveHint = true;
        hints.set(kind, visual);
      }
      if (!Object.hasOwn(types, kind)) {
        visual?.setAttribute('display', 'none');
        return;
      }
      const color = types[kind] || (kind === 'mark' ? 'limegreen' : 'red');
      if (!visual) {
        const group = svg('g');
        cell.append(group);
        const indexRect = currentScene?.elements?.get?.(`${key}:index`)?.querySelector?.(':scope > rect');
        const indexHeight = Number(indexRect?.getAttribute('height')) || 0;
        if (kind === 'highlight') window.HintWidgets.drawHighlightBox(group, x, y, width, height + indexHeight, color);
        if (kind === 'point') window.HintWidgets.drawArrow(group, x + width / 2, y, color);
        if (kind === 'mark') window.HintWidgets.drawMark(group, x + width - 10, y + height - 10, color);
        visual = group.firstElementChild;
        if (visual) {
          visual._asmLiveHint = true;
          visual.setAttribute('data-trace-attached-to', key);
          visual.setAttribute('data-trace-attachment-kind', kind);
          attachStyleVisual(root, visual, cell, kind);
          hints.set(kind, visual);
        }
        group.remove();
      }
      visual?.removeAttribute('display');
      visual?.setAttribute(kind === 'point' ? 'fill' : 'stroke', color);
      // Reuse the existing hint node and its shared-clock animation. Only
      // paint interpolates; positions always follow the actual cell geometry.
      visual?.classList.add('asm-trace-style-paint');
    });
  }

  function refreshPresentedStyles(root) {
    const layer = [...(root?.children || [])].find(child => child.classList?.contains('asm-trace-style-layer'));
    const rootMatrix = root?.getScreenCTM?.();
    if (!layer || !rootMatrix) return;
    let inverse;
    try { inverse = rootMatrix.inverse(); } catch { return; }
    [...layer.children].forEach(wrapper => {
      if (!wrapper.firstElementChild) { wrapper.remove(); return; }
      const sourceCell = wrapper._asmStyleCell;
      const cell = sourceCell?._asmStylePresentationCell || sourceCell;
      const basis = wrapper._asmStyleBasis;
      if (!cell?.isConnected || !root.contains(cell) || !basis) {
        wrapper.setAttribute('display', 'none');
        return;
      }
      const cellMatrix = cell.getScreenCTM?.();
      if (!cellMatrix) { wrapper.setAttribute('display', 'none'); return; }
      const matrix = inverse.multiply(cellMatrix).multiply(basis);
      wrapper.setAttribute('transform', `matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e} ${matrix.f})`);
      let opacity = 1;
      let hidden = false;
      for (let current = cell; current && current !== root; current = current.parentElement) {
        if (current.getAttribute?.('display') === 'none'
          || current.getAttribute?.('data-trace-visibility') === 'hidden') hidden = true;
        const value = Number(current.getAttribute?.('opacity'));
        if (current.hasAttribute?.('opacity') && Number.isFinite(value)) opacity *= value;
      }
      if (hidden) wrapper.setAttribute('display', 'none');
      else wrapper.removeAttribute('display');
      wrapper.setAttribute('opacity', String(opacity));
      const rect = cell !== sourceCell ? [...cell.children]
        .find(child => child.tagName?.toLowerCase() === 'rect') : wrapper._asmStyleRect;
      const insets = wrapper._asmStyleInsets;
      const visual = wrapper.firstElementChild;
      if (rect?.isConnected && insets && visual) {
        const number = name => Number(rect.getAttribute(name)) || 0;
        visual.setAttribute('x', String(number('x') + insets.left));
        visual.setAttribute('y', String(number('y') + insets.top));
        visual.setAttribute('width', String(Math.max(0, number('width') + insets.right - insets.left)));
        const indexHeight = wrapper._asmStyleUsesIndexHeight
          ? Number(wrapper._asmStyleIndexRect?.getAttribute('height')) || 0 : 0;
        const bottomInset = wrapper._asmStyleUsesIndexHeight ? indexHeight : insets.bottom;
        visual.setAttribute('height', String(Math.max(0, number('height')
          + bottomInset - insets.top)));
      }
    });
  }

  function settleStyleLayer(root, elements) {
    root.querySelectorAll('[data-trace-attached-to]').forEach(visual => {
      if (visual.closest('.asm-trace-style-layer')) return;
      const kind = visual.getAttribute('data-trace-attachment-kind') || '';
      const cell = elements.get(visual.getAttribute('data-trace-attached-to'));
      if (cell && ['highlight', 'point', 'mark'].includes(kind)) {
        attachStyleVisual(root, visual, cell, kind);
      }
    });
    const layer = [...root.children].find(child => child.classList?.contains('asm-trace-style-layer'));
    const foreground = root.querySelector(':scope > .asm-trace-foreground-arrows');
    if (layer && foreground) root.insertBefore(layer, foreground);
    refreshPresentedStyles(root);
  }

  function settleAnimationEffectLayer(root) {
    let layer = [...root.children].find(node => node.classList?.contains('asm-trace-animation-effect-layer'));
    if (!layer) {
      layer = svg('g', {
        class: 'asm-trace-animation-effect-layer',
        'data-trace-animation-effect-layer': '1'
      });
    }
    const style = [...root.children].find(node => node.classList?.contains('asm-trace-style-layer'));
    const arrows = [...root.children].find(node => node.classList?.contains('asm-trace-foreground-arrows'));
    root.insertBefore(layer, style || arrows || null);
    return layer;
  }

  function settlePointerLayer(root) {
    const layer = svg('g', { class: 'asm-trace-pointer-layer' });
    // Automatic pointer hosts already use root-space coordinates. Keep their
    // IDs and motion groups intact so event scheduling and drag stay unchanged.
    [...root.children].filter(node => node.classList?.contains('asm-trace-bound-object')
      && node.querySelector('.trace-variable-marker-point'))
      .forEach(node => layer.append(node));
    const arrows = [...root.children].find(node => node.classList?.contains('asm-trace-foreground-arrows'));
    root.insertBefore(layer, arrows || null);
  }

  function studioObjectVisible(object, frame) {
    if (Array.isArray(object.frameIds) && object.frameIds.length && !object.frameIds.includes(frame.id)) return false;
    return window.ASMTraceRules.conditionMatches(frame, object.condition);
  }

  function placedObjectKey(placements, requestedKey) {
    const key = String(requestedKey || '');
    if (!key) return '';
    // A keep alias is stored directly, while a Trace Studio object uses the
    // studio: namespace internally. Direct/keep keys intentionally win.
    if (placements.has(key)) return key;
    const studioKey = `studio:${key}`;
    if (placements.has(studioKey)) return studioKey;
    return key;
  }

  function targetPlacement(document, frame, placements, target = {}, elements = null) {
    const objectKey = target.objectKey || target.targetObjectKey || target.key;
    const variableId = target.variableId || target.targetVariableId;
    if (!objectKey && !variableId) return null;
    if (objectKey === 'keep' || objectKey === '$keep') {
      if (String(target.indexExpression ?? '').trim()) return null;
      return elements
        ? keepAnchorPlacement(document, frame, placements, elements)
        : keepUnionPlacement(document, frame, placements);
    }
    const targetObjectKey = objectKey
      ? placedObjectKey(placements, objectKey)
      : objectKeyForVariable(frame, variableId);
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
        const axisPlacement = placements.get(`${targetObjectKey}:${target.axis}-label:${index}`);
        if (axisPlacement) return axisPlacement;
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
    return elements
      ? semanticTargetPlacement(targetObjectKey, placements, elements)
      : placements.get(targetObjectKey) || null;
  }

  function bitVirtualIndexPlacement(frame, variableId, index, placements, elements) {
    const objectKey = objectKeyForVariable(frame, variableId);
    const prefix = `${objectKey}#`;
    const cells = [];
    placements.forEach((placement, key) => {
      if (!key.startsWith(prefix) || !/^-?\d+$/.test(key.slice(prefix.length))) return;
      if (!elements?.has?.(key)) return;
      cells.push({ key, index: Number(key.slice(prefix.length)), placement });
    });
    cells.sort((left, right) => left.index - right.index);
    const first = cells[0];
    const layout = first && elements.get(first.key)?.closest?.('[data-layout]');
    if (String(layout?.getAttribute?.('data-layout') || '').toLowerCase() !== 'bit') return null;

    const localIndex = index - first.index + 1;
    if (localIndex <= 0) return null;
    const rows = Number(layout.getAttribute('data-bit-rows'));
    const rowHeight = Number(layout.getAttribute('data-row-height'));
    const baseWidth = Number(layout.getAttribute('data-box-size'))
      || Number(first.placement.width) || 40;
    if (!Number.isFinite(rows) || !Number.isFinite(rowHeight) || rowHeight <= 0) return null;

    const widthUnits = localIndex & -localIndex;
    const layer = Math.log2(widthUnits);
    const width = baseWidth * widthUnits;
    const originX = Number(first.placement.x) || 0;
    const originY = (Number(first.placement.y) || 0) - rows * rowHeight;
    return {
      ...first.placement,
      x: originX + Math.floor((localIndex - 1) / widthUnits) * width,
      y: originY + (rows - layer) * rowHeight,
      width
    };
  }

  function ensureLinearIndexPlacement(frame, variableId, index, itemCount, placements, elements = null) {
    if (!Number.isInteger(index) || !Number.isInteger(itemCount) || itemCount < 1) return null;
    const objectKey = objectKeyForVariable(frame, variableId);
    const key = `${objectKey}#${index}`;
    if (placements.has(key)) return placements.get(key);

    const bitPlacement = bitVirtualIndexPlacement(frame, variableId, index, placements, elements);
    if (bitPlacement) {
      placements.set(key, bitPlacement);
      return bitPlacement;
    }

    const edgeIndex = index < 0 ? 0 : itemCount - 1;
    const neighbourIndex = index < 0 ? Math.min(1, itemCount - 1) : Math.max(0, itemCount - 2);
    const edge = placements.get(`${objectKey}#${edgeIndex}`);
    const neighbour = placements.get(`${objectKey}#${neighbourIndex}`);
    if (!edge) return null;

    let stepX = Number(edge.width) || 0;
    let stepY = 0;
    if (neighbour && neighbourIndex !== edgeIndex) {
      const indexDelta = edgeIndex - neighbourIndex;
      stepX = ((Number(edge.x) || 0) - (Number(neighbour.x) || 0)) / indexDelta;
      stepY = ((Number(edge.y) || 0) - (Number(neighbour.y) || 0)) / indexDelta;
    }
    const distance = index - edgeIndex;
    const virtualPlacement = {
      ...edge,
      x: (Number(edge.x) || 0) + stepX * distance,
      y: (Number(edge.y) || 0) + stepY * distance
    };
    placements.set(key, virtualPlacement);
    return virtualPlacement;
  }

  function leftmostVisibleIndexPlacement(frame, variableId, placements, elements) {
    const prefix = `${objectKeyForVariable(frame, variableId)}#`;
    const cells = [];
    placements.forEach((placement, key) => {
      if (!key.startsWith(prefix) || !/^\d+$/.test(key.slice(prefix.length))) return;
      // Linear out-of-range placements have no rendered element. Never use
      // those, labels, or decorations as the unknown marker's reference cell.
      if (!elements.has(key) || ![placement.x, placement.y, placement.width, placement.height].every(Number.isFinite)) return;
      cells.push({ key, placement, index: Number(key.slice(prefix.length)) });
    });
    cells.sort((a, b) => a.placement.x - b.placement.x
      || a.placement.y - b.placement.y || a.index - b.index);
    return cells[0] || null;
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

  function resolveAnchor(document, frame, target, placements = currentScene?.placements,
    elements = currentScene?.elements) {
    return anchorPoint(targetPlacement(
      document,
      frame,
      placements || new Map(),
      target,
      elements || null
    ), target?.anchor);
  }

  function resolvedTargetKey(document, frame, target, placements = currentScene?.placements || new Map()) {
    const objectKey = target?.objectKey || target?.targetObjectKey || target?.key;
    if (objectKey) {
      if ((objectKey === 'keep' || objectKey === '$keep')
        && !String(target?.indexExpression ?? '').trim()) return '$keep';
      const targetObjectKey = placedObjectKey(placements, objectKey);
      const expression = String(target?.indexExpression ?? '').trim();
      if (!expression) return targetObjectKey;
      const indices = expression.split(',').map(part => Number(
        window.ASMTraceRules.resolveExpression(document, frame, part.trim())
      ));
      if (!indices.length || indices.some(index => !Number.isInteger(index))) return targetObjectKey;
      return `${targetObjectKey}#${indices.join(',')}`;
    }
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
      const transform = String(cursor.getAttribute?.('transform') || '');
      for (const match of transform.matchAll(/translate\s*\(\s*([+\-\d.]+)(?:[\s,]+([+\-\d.]+))?\s*\)/g)) {
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

  function renderFrameSegments(root, document, frame, placements, elements, options = {}) {
    const segmentOrdinals = new Map();
    (frame.segments || []).forEach((descriptor, descriptorIndex) => {
      if (!window.ASMTraceRules?.expressionMatches?.(document, frame, descriptor?.when)) return;
      const variableId = descriptor?.targetVariableId;
      const entry = frame.state?.[variableId];
      const items = entry?.data?.items;
      if (!variableId || !Array.isArray(items)) return;

      const targetKey = objectKeyForVariable(frame, variableId);
      const rendererName = frame.renderers?.[variableId]
        || document.skins?.[variableId]?.renderer
        || document.variables?.[variableId]?.kind
        || entry.data?.kind;
      if (descriptor.cellRange) {
        const intervalSegmentTree = rendererName === 'original-segment-tree';
        if (rendererName !== 'original-heap' && !intervalSegmentTree) return;
        const rootNode = Number(window.ASMTraceRules.resolveExpression(
          document, frame, descriptor.cellExpression
        ));
        const rawStart = Number(window.ASMTraceRules.resolveExpression(
          document, frame, descriptor.startExpression
        ));
        const rawEnd = Number(window.ASMTraceRules.resolveExpression(
          document, frame, descriptor.endExpression
        ));
        if (![rootNode, rawStart, rawEnd].every(Number.isInteger) || rawStart > rawEnd) return;
        const targetKey = objectKeyForVariable(frame, variableId);
        const heap = elements.get(targetKey);
        const rangeStart = Number(heap?.querySelector?.('[data-trace-range-start]')?.dataset?.traceRangeStart
          ?? heap?.dataset?.traceRangeStart ?? 0);
        const levels = Number(heap?.querySelector?.('[data-heap-levels]')?.getAttribute?.('data-heap-levels')
          ?? heap?.getAttribute?.('data-heap-levels'));
        if (!intervalSegmentTree && (!Number.isInteger(levels) || levels < 1)) return;

        const sectionCountForNode = nodeIndex => {
          if (intervalSegmentTree) {
            const cell = elements.get(`${targetKey}#${nodeIndex}`);
            const left = Number(cell?.dataset?.segmentLeft);
            const right = Number(cell?.dataset?.segmentRight);
            return Number.isInteger(left) && Number.isInteger(right) && left <= right
              ? right - left + 1 : 0;
          }
          const localIndex = nodeIndex - rangeStart;
          if (localIndex < 0) return 0;
          const depth = Math.floor(Math.log2(localIndex + 1));
          return 2 ** Math.max(0, levels - depth - 1);
        };
        const rootSectionCount = sectionCountForNode(rootNode);
        if (!rootSectionCount) return;
        const ranges = [];
        const addRange = (nodeIndex, start, end, knownSectionCount = 0) => {
          const sectionCount = knownSectionCount || sectionCountForNode(nodeIndex);
          const clippedStart = Math.max(0, start);
          const clippedEnd = Math.min(sectionCount - 1, end);
          if (sectionCount && clippedStart <= clippedEnd) {
            ranges.push({ nodeIndex, start: clippedStart, end: clippedEnd, sectionCount });
          }
        };

        if (descriptor.split) {
          const cursor = Number(window.ASMTraceRules.resolveExpression(
            document, frame, descriptor.split.cursorExpression
          ));
          if (!Number.isInteger(cursor)) return;
          const path = [];
          let ancestor = cursor;
          const zeroBasedTree = intervalSegmentTree && rootNode === 0;
          const parentOf = node => zeroBasedTree ? Math.floor((node - 1) / 2) : Math.floor(node / 2);
          const leftChildOf = node => zeroBasedTree ? node * 2 + 1 : node * 2;
          const rightChildOf = node => leftChildOf(node) + 1;
          while (ancestor !== rootNode && ancestor >= 0) {
            path.unshift(ancestor);
            ancestor = parentOf(ancestor);
          }
          if (ancestor !== rootNode) return;
          const queryStart = Math.max(0, rawStart);
          const queryEnd = Math.min(rootSectionCount - 1, rawEnd);
          if (queryStart > queryEnd) return;
          let currentNode = rootNode;
          let intervalStart = 0;
          let intervalCount = rootSectionCount;
          for (const child of path) {
            const leftCount = intervalSegmentTree ? Math.ceil(intervalCount / 2) : intervalCount / 2;
            const rightCount = intervalCount - leftCount;
            if (!Number.isInteger(leftCount) || leftCount < 1 || rightCount < 1) return;
            const leftChild = leftChildOf(currentNode);
            const rightChild = rightChildOf(currentNode);
            if (child === leftChild) {
              const siblingStart = intervalStart + leftCount;
              const overlapStart = Math.max(queryStart, siblingStart);
              const overlapEnd = Math.min(queryEnd, siblingStart + rightCount - 1);
              addRange(rightChild, overlapStart - siblingStart,
                overlapEnd - siblingStart, rightCount);
              intervalCount = leftCount;
            } else if (child === rightChild) {
              intervalStart += leftCount;
              intervalCount = rightCount;
            } else return;
            currentNode = child;
          }
          if (descriptor.split.phase !== 'after') {
            const overlapStart = Math.max(queryStart, intervalStart);
            const overlapEnd = Math.min(queryEnd, intervalStart + intervalCount - 1);
            addRange(cursor, overlapStart - intervalStart, overlapEnd - intervalStart, intervalCount);
          }
        } else {
          addRange(rootNode, rawStart, rawEnd);
        }

        ranges.forEach(({ nodeIndex, start, end, sectionCount }) => {
          const cell = elements.get(`${targetKey}#${nodeIndex}`);
          const baseRect = cell?.querySelector?.(':scope > rect');
          const text = cell?.querySelector?.(':scope > text');
          if (!cell || !baseRect) return;
          const x = Number(baseRect.getAttribute('x')) || 0;
          const y = Number(baseRect.getAttribute('y')) || 0;
          const width = Number(baseRect.getAttribute('width')) || 0;
          const height = Number(baseRect.getAttribute('height')) || 0;
          if (!(width > 0 && height > 0)) return;
          const horizontalGap = Math.max(0, Number(
            heap?.querySelector?.('[data-horizontal-gap]')?.getAttribute?.('data-horizontal-gap')
              ?? heap?.getAttribute?.('data-horizontal-gap')
              ?? 0
          ) || 0);
          const sectionUnit = sectionCount > 0
            ? Math.max(0, (width - Math.max(0, sectionCount - 1) * horizontalGap) / sectionCount)
            : 0;
          const segmentCount = end - start + 1;
          const identity = descriptor.named ? descriptor.id : `${descriptor.id || descriptorIndex}`;
          const key = descriptor.split
            ? `heap-segment:${identity}:${nodeIndex}`
            : `heap-segment:${identity}`;
          const overlay = svg('rect', {
            class: 'asm-trace-heap-cell-segment asm-trace-style-paint',
            x: x + start * (sectionUnit + horizontalGap),
            y,
            width: segmentCount * sectionUnit + Math.max(0, segmentCount - 1) * horizontalGap,
            height,
            fill: traceTextColor(descriptor.color, 'rgba(165, 214, 167, 0.6)'),
            stroke: 'none',
            'pointer-events': 'none',
            'data-av-key': key,
            'data-trace-segment-id': descriptor.id || '',
            'data-trace-runtime-identity': descriptor.named
              ? `segment:named:${descriptor.id}:${nodeIndex}`
              : key,
            'data-trace-segment-node': nodeIndex,
            'data-trace-segment-start': start,
            'data-trace-segment-end': end,
            'data-trace-segment-count': sectionCount,
            'data-trace-segment-split': descriptor.split?.phase || ''
          });
          cell.insertBefore(overlay, text || null);
          overlay.setAttribute('data-trace-attached-to', `${targetKey}#${nodeIndex}`);
          overlay.setAttribute('data-trace-attachment-kind', 'segment');
          if (attachStyleVisual(root, overlay, cell, 'segment')) {
            const wrapper = overlay.parentElement;
            const segmentX = Number(overlay.getAttribute('x'));
            const segmentY = Number(overlay.getAttribute('y'));
            const segmentWidth = Number(overlay.getAttribute('width'));
            const segmentHeight = Number(overlay.getAttribute('height'));
            ['left', 'right'].forEach(side => {
              const boundaryX = side === 'right' ? segmentX + segmentWidth : segmentX;
              wrapper.append(svg('line', {
                class: `asm-trace-heap-segment-boundary asm-trace-heap-segment-boundary-${side}`,
                x1: boundaryX,
                x2: boundaryX,
                y1: segmentY,
                y2: segmentY + segmentHeight,
                stroke: '#6b7280',
                'stroke-width': 1,
                'stroke-dasharray': '3 3',
                'vector-effect': 'non-scaling-stroke',
                'pointer-events': 'none',
                'data-trace-segment-boundary': side
              }));
            });
            const styleKey = `style:${key}`;
            const cellPlacement = placements.get(`${targetKey}#${nodeIndex}`);
            wrapper.dataset.traceObjectKey = styleKey;
            wrapper.dataset.traceRuntimeIdentity = descriptor.named
              ? `segment:named:${descriptor.id}:${nodeIndex}`
              : key;
            wrapper.dataset.traceInternalStyle = 'segment';
            if (cellPlacement) {
              wrapper.dataset.traceRenderPosition = `${cellPlacement.x},${cellPlacement.y}`;
              placements.set(styleKey, { ...cellPlacement });
            }
            elements.set(styleKey, wrapper);
          }
        });
        return;
      }
      if (rendererName && rendererName !== 'original-array' && rendererName !== 'sequence') return;

      const start = Number(window.ASMTraceRules.resolveExpression(
        document, frame, descriptor.startExpression
      ));
      const end = Number(window.ASMTraceRules.resolveExpression(
        document, frame, descriptor.endExpression
      ));
      const endExclusive = end + (descriptor.endInclusive ? 1 : 0);
      if (!Number.isInteger(start) || !Number.isInteger(end)
        || start < 0 || endExclusive < start || endExclusive > items.length) return;

      const cells = items.map((_, index) => placements.get(`${targetKey}#${index}`) || null);
      const renderedCells = cells.filter(Boolean);
      if (!renderedCells.length) return;
      const targetPlacement = placements.get(targetKey);
      if (!targetPlacement) return;
      const targetElement = elements.get(targetKey);
      const outerframe = targetElement?.matches?.('[data-outerframe-top][data-outerframe-bottom]')
        ? targetElement
        : targetElement?.querySelector?.('[data-outerframe-top][data-outerframe-bottom]');
      const outerframeLocalTop = Number(outerframe?.getAttribute?.('data-outerframe-top'));
      const outerframeLocalBottom = Number(outerframe?.getAttribute?.('data-outerframe-bottom'));
      const targetOriginY = Number(targetElement?.dataset?.tracePositionY);
      const hasStableOuterframe = Number.isFinite(targetOriginY)
        && Number.isFinite(outerframeLocalTop)
        && Number.isFinite(outerframeLocalBottom)
        && outerframeLocalBottom > outerframeLocalTop;
      const boundaryX = index => {
        if (cells[index]) return Number(cells[index].x) || 0;
        if (index === items.length && cells[index - 1]) {
          return (Number(cells[index - 1].x) || 0) + (Number(cells[index - 1].width) || 0);
        }
        return null;
      };
      const left = boundaryX(start);
      const right = boundaryX(endExclusive);
      if (!Number.isFinite(left) || !Number.isFinite(right) || right < left) return;

      // Segment height follows the array frame only. Object bounds may include
      // transient marks, pointers, or highlights and therefore vary per frame.
      const outerframeTop = hasStableOuterframe
        ? targetOriginY + outerframeLocalTop
        : Number(targetPlacement.y) || 0;
      const outerframeBottom = hasStableOuterframe
        ? targetOriginY + outerframeLocalBottom
        : outerframeTop + (Number(targetPlacement.height) || 0);
      const top = outerframeTop - 60;
      const bottom = outerframeBottom + 20;
      const arrowY = top + 5;
      const width = right - left;
      const key = `segment:${descriptor.id || `${frame.id}-${descriptorIndex}`}`;
      const identityBase = runtimeIdentityToken(entry.identity, targetKey);
      const ordinal = segmentOrdinals.get(identityBase) || 0;
      segmentOrdinals.set(identityBase, ordinal + 1);
      const runtimeIdentity = descriptor.named
        ? `segment:named:${descriptor.id}`
        : `segment:${identityBase}:${ordinal}`;
      const stroke = '#000000';
      const strokeWidth = 2;
      const object = markSelectable(svg('g', {
        class: 'asm-trace-object asm-trace-segment',
        'data-trace-object-key': key,
        'data-trace-object-id': key,
        'data-trace-bound': '1',
        'data-trace-binding-target': targetKey,
        'data-trace-segment-target': targetKey,
        'data-trace-runtime-identity': runtimeIdentity,
        'data-trace-render-position': `${left},${top}`,
        'data-trace-segment-left': left,
        'data-trace-segment-right': right,
        'data-trace-segment-top': top,
        'data-trace-segment-bottom': bottom,
        'data-trace-segment-arrow-y': arrowY,
        'stroke-opacity': 0.5,
        'pointer-events': 'visiblePainted'
      }), key, { ...options, movable: false });
      object.append(
        svg('line', { 'data-trace-segment-role': 'left-boundary', x1: left, y1: top, x2: left, y2: bottom, stroke, 'stroke-width': strokeWidth }),
        svg('line', { 'data-trace-segment-role': 'right-boundary', x1: right, y1: top, x2: right, y2: bottom, stroke, 'stroke-width': strokeWidth })
      );
      if (width > 0) {
        const head = Math.min(6, Math.max(2, width / 3));
        const arrowLeft = Math.min(right, left + strokeWidth / 2);
        const arrowRight = Math.max(arrowLeft, right - strokeWidth / 2);
        object.append(
          svg('line', {
            'data-trace-segment-role': 'width-line',
            x1: arrowLeft, y1: arrowY, x2: arrowRight, y2: arrowY,
            stroke, 'stroke-width': strokeWidth, 'stroke-dasharray': '6 4'
          }),
          svg('path', {
            'data-trace-segment-role': 'left-head',
            d: `M ${arrowLeft + head} ${arrowY - 4} L ${arrowLeft} ${arrowY} L ${arrowLeft + head} ${arrowY + 4}`,
            fill: 'none', stroke, 'stroke-width': strokeWidth, 'stroke-linejoin': 'miter'
          }),
          svg('path', {
            'data-trace-segment-role': 'right-head',
            d: `M ${arrowRight - head} ${arrowY - 4} L ${arrowRight} ${arrowY} L ${arrowRight - head} ${arrowY + 4}`,
            fill: 'none', stroke, 'stroke-width': strokeWidth, 'stroke-linejoin': 'miter'
          })
        );
      }
      if (descriptor.showWidth) {
        object.append(svg('text', {
          'data-trace-segment-role': 'width-label',
          x: left + width / 2,
          y: arrowY - 7,
          'text-anchor': 'middle',
          'font-family': 'Arial',
          'font-size': 12,
          fill: '#000000'
        }, String(Math.max(0, endExclusive - start))));
      }
      root.append(object);
      placements.set(key, {
        x: left,
        y: descriptor.showWidth ? arrowY - 21 : top,
        width: Math.max(1, width),
        height: bottom - (descriptor.showWidth ? arrowY - 21 : top)
      });
      elements.set(key, object);
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
      const shifted = { ...placement, x: placement.x + dx, y: placement.y + dy };
      placements.set(key, shifted);
      // Layout/binding placement is applied after objects and child cells are
      // measured. Keep both coordinate spaces synchronized: bounds store the
      // shifted measured box, while origin stores the shifted group origin.
      // If the origin is left at its authored (0,0), the next tween moves only
      // the cells while the array outerframe jumps directly to its destination.
      if (element?.dataset?.tracePositionSpace === 'bounds') {
        element.dataset.tracePositionX = String(shifted.x);
        element.dataset.tracePositionY = String(shifted.y);
      } else if (element?.dataset?.tracePositionSpace === 'origin') {
        element.dataset.tracePositionX = String((Number(element.dataset.tracePositionX) || 0) + dx);
        element.dataset.tracePositionY = String((Number(element.dataset.tracePositionY) || 0) + dy);
      }
    });
  }

  const DEFAULT_LIVE_OBJECT_BINDING = Object.freeze({
    canvas: true,
    anchor: 'top',
    offsetX: 0,
    offsetY: 80
  });

  function defaultLiveObjectPlacementDelta(primaryPlacement) {
    if (!primaryPlacement) return null;
    const values = [
      primaryPlacement.x, primaryPlacement.y,
      primaryPlacement.width, primaryPlacement.height
    ].map(Number);
    if (!values.every(Number.isFinite)) return null;
    const [x, y, width, height] = values;
    // Match `at canvas.top offset(0,80)` exactly. Semantic top bindings
    // connect the object's bottom to canvas.top and retain the ordinary 8px
    // anchor gap, so the effective target is y = 80 - 8.
    return {
      x: 1100 / 2 - (x + width / 2),
      y: DEFAULT_LIVE_OBJECT_BINDING.offsetY - 8 - (y + height)
    };
  }

  function applyDefaultLiveObjectPlacement(document, frame, placements, elements, liveObjectKeys, initialY = 0) {
    const keys = [...new Set(liveObjectKeys || [])].filter(key => (
      placements.has(key) && elements.has(key)
    ));
    if (!keys.length || frame?.source?.layoutId) return null;
    const preferredKey = objectKeyForVariable(frame, frame?.source?.primaryVariableId || '');
    const primaryKey = keys.includes(preferredKey) ? preferredKey : keys[0];
    const framePositions = document?.studio?.positions?.[frame?.id] || {};
    const frameBindings = frame?.objectBindings || [];
    const studioBindings = document?.studio?.bindings?.[frame?.id] || {};
    const explicitlyPositioned = Object.prototype.hasOwnProperty.call(framePositions, primaryKey)
      || Object.prototype.hasOwnProperty.call(framePositions, frame?.source?.primaryVariableId || '');
    const explicitlyBound = frameBindings.some(binding => (
      binding?.sourceObjectKey === primaryKey
      || binding?.sourceVariableId === frame?.source?.primaryVariableId
    )) || Object.prototype.hasOwnProperty.call(studioBindings, primaryKey);
    if (explicitlyPositioned || explicitlyBound) return null;

    const delta = defaultLiveObjectPlacementDelta(placements.get(primaryKey));
    // Keep the horizontal default, but never reset an automatically stacked
    // live row to canvas.top. Frozen frame snapshots have no snapshotIds:
    // preserve their allocated row through initialY instead.
    if (delta) delta.y = frame?.snapshotIds?.length ? 0 : delta.y + (Number(initialY) || 0);
    if (!delta || (Math.abs(delta.x) < 0.01 && Math.abs(delta.y) < 0.01)) return delta;
    keys.forEach(key => {
      const element = elements.get(key);
      if (!element) return;
      const hasOwnPosition = Object.prototype.hasOwnProperty.call(framePositions, key);
      const hasOwnBinding = frameBindings.some(binding => (
        binding?.sourceObjectKey === key || binding?.sourceVariableId === element.dataset.traceVariable
      )) || Object.prototype.hasOwnProperty.call(studioBindings, key);
      if (hasOwnPosition || hasOwnBinding) return;
      translatedTransform(element, delta.x, delta.y);
      shiftPlacementTree(element, delta.x, delta.y, placements, elements);
      element.dataset.traceDefaultBinding = 'canvas.top offset(0,80)';
    });
    return delta;
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
      const fontSize = Number(style.fontSize);
      if (Number.isFinite(fontSize) && fontSize > 0) {
        // @text objects consume their object-level font size while calculating
        // layout, so the bubble, padding and pointer scale with the glyphs.
        // Rewriting only their <text> nodes here would distort that geometry.
        if (element.matches?.('.asm-trace-text-object')) return;
        const textTargets = element.matches?.('text')
          ? [element]
          : [...element.querySelectorAll('text')];
        textTargets.forEach(target => target.setAttribute('font-size', String(fontSize)));
      }
    });
  }

  function applyBindings(document, frame, placements, elements) {
    const directiveBindings = {};
    const snapshotsById = new Map((document.snapshots || []).map(snapshot => [snapshot.id, snapshot]));
    const snapshotObjectKeys = new Set((frame.snapshotIds || []).map(id => (
      snapshotObjectKey(snapshotsById.get(id))
    )).filter(Boolean));
    const automaticBindings = [
      ...(frame.objectBindings || []),
      ...(frame.snapshotIds || []).map(id => {
        const snapshot = snapshotsById.get(id);
        const binding = snapshotAutomaticBinding(document, snapshot);
        return binding
          ? { ...binding, sourceObjectKey: snapshotObjectKey(snapshot) }
          : null;
      }).filter(Boolean)
    ];
    automaticBindings.forEach(binding => {
      if (!binding?.sourceVariableId && !binding?.sourceObjectKey) return;
      if (binding.when && window.ASMTraceRules?.conditionMatches
        && !window.ASMTraceRules.conditionMatches(frame, binding.when)) return;
      const sourceKey = binding.sourceObjectKey
        || objectKeyForVariable(frame, binding.sourceVariableId);
      const targetKey = binding.canvas
        ? '$canvas'
        : resolvedTargetKey(document, frame, {
          objectKey: binding.targetObjectKey,
          variableId: binding.targetVariableId,
          indexExpression: (binding.indexExpressions || []).join(',')
        }, placements);
      if (!sourceKey || !targetKey) return;
      const anchor = String(binding.anchor || 'center').toLowerCase();
      const vertical = anchor.includes('top') ? 'bottom' : anchor.includes('bottom') ? 'top' : '';
      const horizontal = anchor.includes('left') ? 'right' : anchor.includes('right') ? 'left' : '';
      directiveBindings[sourceKey] = {
        targetKey,
        sourceAnchor: binding.sourceAnchor
          || [vertical, horizontal].filter(Boolean).join('-')
          || 'center',
        targetAnchor: anchor,
        // Explicit source anchors describe exact outerframe-to-outerframe
        // alignment; only inferred anchors retain the automatic edge gap.
        dx: (binding.sourceAnchor ? 0 : anchor.includes('left') ? -8 : anchor.includes('right') ? 8 : 0)
          + (Number(binding.offsetX) || 0),
        dy: (binding.sourceAnchor ? 0 : anchor.includes('top') ? -8 : anchor.includes('bottom') ? 8 : 0)
          + (Number(binding.offsetY) || 0),
        semanticDirective: true,
        targetExpression: binding.targetExpression || ''
      };
    });
    const bindings = {
      ...directiveBindings,
      ...(document.studio?.bindings?.[frame.id] || {})
    };
    const applied = new Set();
    const applying = new Set();

    function applyOne(key) {
      if (applied.has(key) || applying.has(key)) return;
      const binding = bindings[key];
      const source = elements.get(key);
      if (!binding || !source) return;
      applying.add(key);
      const targetKey = binding.targetKey === 'keep' ? '$keep' : binding.targetKey;
      if (targetKey === '$keep') {
        // A retained object keeps the placement it had when it was created.
        // Its historical `keep` target therefore contains only older keeps;
        // including future keeps here creates a circular layout that expands
        // the vertical gaps every time another retained object is added.
        keepSnapshotObjectKeys(document, frame,
          snapshotObjectKeys.has(key) ? key : '').forEach(applyOne);
      } else {
        applyOne(targetKey);
      }
      const sourcePlacement = binding.semanticDirective
        ? semanticTargetPlacement(key, placements, elements)
        : placements.get(key);
      const targetPlacement = targetKey === '$canvas'
        ? { x: 0, y: 0, width: 1100, height: 620 }
        : targetKey === '$keep'
          ? keepAnchorPlacement(document, frame, placements, elements,
            snapshotObjectKeys.has(key) ? key : '')
          : semanticTargetPlacement(targetKey, placements, elements);
      if (sourcePlacement && targetPlacement && targetKey !== key) {
        const sourcePoint = anchorPoint(sourcePlacement, binding.sourceAnchor || 'top');
        const targetPoint = anchorPoint(targetPlacement, binding.targetAnchor || 'center');
        const dx = targetPoint.x + (Number(binding.dx) || 0) - sourcePoint.x;
        const dy = targetPoint.y + (Number(binding.dy) || 0) - sourcePoint.y;
        if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
          translatedTransform(source, dx, dy);
          shiftPlacementTree(source, dx, dy, placements, elements);
        }
        source.dataset.traceBound = '1';
        source.dataset.traceBindingTarget = targetKey;
        source.dataset.traceBindingSourceAnchor = binding.sourceAnchor || 'top';
        source.dataset.traceBindingTargetAnchor = binding.targetAnchor || 'center';
        source.dataset.studioOffset = `${Number(binding.dx) || 0},${Number(binding.dy) || 0}`;
      }
      applying.delete(key);
      applied.add(key);
    }

    Object.keys(bindings).forEach(applyOne);
  }

  function recursionLayoutCoordinates(layout, sourceNodes, anchor = { x: 0, y: 0 }) {
    const nodes = (sourceNodes || []).map((source, index) => ({
      ...source,
      index,
      children: [],
      width: Math.max(1, Number(source.box?.width) || 1),
      height: Math.max(1, Number(source.box?.height) || 1)
    }));
    const byId = new Map(nodes.map(node => [node.id, node]));
    const roots = [];
    const ordered = items => items.sort((left, right) => (
      (Number(left.siblingIndex) || 0) - (Number(right.siblingIndex) || 0)
      || (Number(left.rootIndex) || 0) - (Number(right.rootIndex) || 0)
      || left.index - right.index
    ));
    nodes.forEach(node => {
      const parent = byId.get(node.parentId);
      if (parent && parent !== node) parent.children.push(node);
      else roots.push(node);
    });
    ordered(roots);
    nodes.forEach(node => ordered(node.children));

    const depthNodes = [];
    const visiting = new Set();
    function setDepth(node, depth) {
      if (visiting.has(node.id)) return;
      visiting.add(node.id);
      node.depth = depth;
      if (!depthNodes[depth]) depthNodes[depth] = [];
      depthNodes[depth].push(node);
      node.children.forEach(child => setDepth(child, depth + 1));
      visiting.delete(node.id);
    }
    roots.forEach(root => setDepth(root, 0));
    nodes.filter(node => node.depth == null).forEach(node => {
      roots.push(node);
      setDepth(node, 0);
    });
    if (!nodes.length) return new Map();

    const vertical = !['left-right', 'right-left'].includes(layout?.direction);
    const crossSize = node => vertical ? node.width : node.height;
    const mainSize = node => vertical ? node.height : node.width;
    const siblingGap = Math.max(0, Number(layout?.siblingGap) || 40);
    const levelGap = Math.max(0, Number(layout?.levelGap) || 100);
    const mode = String(layout?.mode || 'compact').toLowerCase();

    if (mode === 'compact') {
      function pack(node) {
        const own = crossSize(node);
        if (!node.children.length) {
          node.crossCenter = own / 2;
          return { span: own, center: own / 2 };
        }
        let cursor = 0;
        const packed = node.children.map(child => {
          const result = pack(child);
          const item = { child, result, start: cursor };
          cursor += result.span + siblingGap;
          return item;
        });
        const childSpan = Math.max(0, cursor - siblingGap);
        let parentCenter = packed.length === 1
          ? packed[0].start + packed[0].result.center
          : (packed[0].start + packed[0].result.center
            + packed.at(-1).start + packed.at(-1).result.center) / 2;
        let shift = Math.max(0, own / 2 - parentCenter);
        packed.forEach(item => shiftTree(item.child, item.start + shift));
        parentCenter += shift;
        const span = Math.max(childSpan + shift, parentCenter + own / 2);
        node.crossCenter = parentCenter;
        return { span, center: parentCenter };
      }
      function shiftTree(node, amount) {
        node.crossCenter = (Number(node.crossCenter) || 0) + amount;
        node.children.forEach(child => shiftTree(child, amount));
      }
      let rootCursor = 0;
      roots.forEach(root => {
        const packed = pack(root);
        shiftTree(root, rootCursor);
        rootCursor += packed.span + siblingGap;
      });
    } else if (mode === 'levelorder') {
      let cursor = 0;
      depthNodes.forEach(level => {
        ordered(level).forEach(node => {
          node.crossCenter = cursor + crossSize(node) / 2;
          cursor += crossSize(node) + siblingGap;
        });
      });
    } else if (mode === 'binary') {
      const degree = Math.max(1, Math.trunc(Number(layout?.degree) || 2));
      const pitch = Math.max(...nodes.map(crossSize)) + siblingGap;
      function assignSlots(node, slot, treeDepth, rootCenter, treeOffset) {
        const span = Math.pow(degree, Math.max(0, treeDepth - node.depth)) * pitch;
        node.crossCenter = treeOffset + slot * span + span / 2 - rootCenter;
        node.children.forEach(child => assignSlots(
          child,
          slot * degree + Math.max(0, Number(child.siblingIndex) || 0),
          treeDepth,
          rootCenter,
          treeOffset
        ));
      }
      let treeOffset = 0;
      roots.forEach(root => {
        const descendants = [];
        (function collect(node) {
          descendants.push(node);
          node.children.forEach(collect);
        })(root);
        const treeDepth = Math.max(...descendants.map(node => node.depth));
        const rootSpan = Math.pow(degree, Math.max(0, treeDepth - root.depth)) * pitch;
        assignSlots(root, 0, treeDepth, rootSpan / 2, treeOffset + rootSpan / 2);
        treeOffset += rootSpan + siblingGap;
      });
    } else {
      const traversal = [];
      function walk(node) {
        if (mode === 'preorder') traversal.push(node);
        if (mode === 'inorder') {
          const middle = Math.floor(node.children.length / 2);
          node.children.slice(0, middle).forEach(walk);
          traversal.push(node);
          node.children.slice(middle).forEach(walk);
        } else {
          node.children.forEach(walk);
        }
        if (mode === 'postorder') traversal.push(node);
      }
      roots.forEach(walk);
      let cursor = 0;
      traversal.forEach(node => {
        node.crossCenter = cursor + crossSize(node) / 2;
        cursor += crossSize(node) + siblingGap;
      });
    }

    const mainOffsets = [];
    let mainCursor = 0;
    depthNodes.forEach((level, depth) => {
      mainOffsets[depth] = mainCursor;
      mainCursor += Math.max(...level.map(mainSize)) + levelGap;
    });
    const logical = nodes.map(node => ({
      node,
      cross: node.crossCenter - crossSize(node) / 2,
      main: mainOffsets[node.depth] || 0
    }));
    const crossMin = Math.min(...logical.map(item => item.cross));
    const crossMax = Math.max(...logical.map(item => item.cross + crossSize(item.node)));
    const alignment = String(layout?.align || 'center').toLowerCase();
    const crossAnchor = vertical ? Number(anchor.x) || 0 : Number(anchor.y) || 0;
    const crossShift = alignment === 'start'
      ? crossAnchor - crossMin
      : alignment === 'end'
        ? crossAnchor - crossMax
        : crossAnchor - (crossMin + crossMax) / 2;
    const mainAnchor = vertical ? Number(anchor.y) || 0 : Number(anchor.x) || 0;
    const direction = String(layout?.direction || 'top-down').toLowerCase();
    const result = new Map();
    logical.forEach(item => {
      const cross = item.cross + crossShift;
      const main = item.main;
      let x;
      let y;
      if (direction === 'bottom-up') {
        x = cross;
        y = mainAnchor - main - item.node.height;
      } else if (direction === 'left-right') {
        x = mainAnchor + main;
        y = cross;
      } else if (direction === 'right-left') {
        x = mainAnchor - main - item.node.width;
        y = cross;
      } else {
        x = cross;
        y = mainAnchor + main;
      }
      result.set(item.node.id, { x, y, width: item.node.width, height: item.node.height });
    });
    return result;
  }

  function applyRecursionLayouts(rootSvg, root, document, frame, placements, elements, options = {}) {
    const snapshotsById = new Map((document.snapshots || []).map(snapshot => [snapshot.id, snapshot]));
    const visibleSnapshots = (frame.snapshotIds || []).map(id => snapshotsById.get(id)).filter(Boolean);
    (document.layouts || []).filter(layout => layout?.type === 'recursion').forEach(layout => {
      const snapshots = visibleSnapshots.filter(snapshot => snapshot.layoutId === layout.id);
      const liveLayout = frame.source?.layoutId === layout.id
        && frame.source?.recursionActivationId
        && frame.source?.primaryVariableId;
      if (!snapshots.length && !liveLayout) return;
      const binding = layout.binding || { canvas: true, anchor: 'top', offsetX: 0, offsetY: 80 };
      const targetKey = binding.canvas
        ? '$canvas'
        : resolvedTargetKey(document, frame, {
          objectKey: binding.targetObjectKey || binding.targetName,
          variableId: binding.targetVariableId,
          indexExpression: (binding.indexExpressions || []).join(',')
        }, placements);
      const target = targetKey === '$canvas'
        ? { x: 0, y: 0, width: 1100, height: 620 }
        : targetKey === '$keep'
          ? keepAnchorPlacement(
            document, frame, placements, elements, snapshotObjectKey(snapshots[0])
          )
        : semanticTargetPlacement(targetKey, placements, elements);
      if (!target) return;
      const targetAnchor = anchorPoint(target, binding.anchor || 'top');
      const anchor = {
        x: targetAnchor.x + (Number(binding.offsetX) || 0),
        y: targetAnchor.y + (Number(binding.offsetY) || 0)
      };
      const sourceNodes = snapshots.map(snapshot => {
        const objectKey = snapshotObjectKey(snapshot);
        const element = elements.get(objectKey);
        const fallbackBox = placements.get(objectKey);
        const preferredVariableId = snapshot.kind === 'frame'
          ? String(snapshot.frame?.source?.primaryVariableId || '')
          : String(snapshot.sourceVariableId || '');
        return {
          id: snapshot.id,
          objectKey,
          snapshot,
          preferredVariableId,
          parentId: snapshot.layoutNode?.parentSnapshotId || '',
          siblingIndex: snapshot.layoutNode?.siblingIndex,
          rootIndex: snapshot.layoutNode?.rootIndex,
          // A live @frame node and the @keep node that replaces it must use
          // the same visual object as their layout box. The snapshot wrapper
          // also contains its retained label (and can contain frame text), so
          // using that wrapper shifts the kept array away from the live slot.
          box: recursionOuterframePlacement(
            element,
            fallbackBox,
            root,
            preferredVariableId
          )
        };
      }).filter(node => node.objectKey && node.box && elements.has(node.objectKey));
      if (liveLayout) {
        const activationId = String(frame.source.recursionActivationId || '');
        const latestByActivation = new Map();
        snapshots.forEach(snapshot => {
          if (snapshot.recursionActivationId) latestByActivation.set(snapshot.recursionActivationId, snapshot);
        });
        const sameActivation = latestByActivation.get(activationId);
        if (!sameActivation) {
          const ancestors = Array.isArray(frame.source.recursionAncestorActivationIds)
            ? [...frame.source.recursionAncestorActivationIds].reverse()
            : [];
          const parentSnapshot = ancestors.map(id => latestByActivation.get(id)).find(Boolean) || null;
          const objectKey = objectKeyForVariable(frame, frame.source.primaryVariableId);
          const element = elements.get(objectKey);
          const fallbackBox = placements.get(objectKey);
          const box = recursionOuterframePlacement(
            element,
            fallbackBox,
            root,
            frame.source.primaryVariableId
          );
          if (box && element) {
            sourceNodes.push({
              id: `layout-live:${layout.id}:${activationId}`,
              objectKey,
              live: true,
              preferredVariableId: frame.source.primaryVariableId,
              parentId: parentSnapshot?.id || '',
              siblingIndex: Number(frame.source.recursionSiblingIndex) || 0,
              rootIndex: Number(frame.source.recursionRootIndex) || 0,
              box
            });
          }
        }
      }
      const coordinates = recursionLayoutCoordinates(layout, sourceNodes, anchor);
      const positions = document.studio?.positions?.[frame.id] || {};
      sourceNodes.forEach(node => {
        const snapshot = snapshotsById.get(node.id);
        const destination = coordinates.get(node.id);
        const element = elements.get(node.objectKey);
        // `node.box` is the primary outerframe in root coordinates. Move the
        // wrapper by the delta needed to put that exact box in the layout
        // slot; this keeps @frame ... in and @keep ... in pixel-aligned.
        const current = node.box;
        const explicitlyPlaced = Object.prototype.hasOwnProperty.call(positions, node.objectKey)
          || Object.prototype.hasOwnProperty.call(positions, node.id)
          || Boolean(snapshot?.binding)
          || Boolean(node.live && (frame.objectBindings || []).some(binding => (
            binding?.sourceVariableId === frame.source?.primaryVariableId
          )));
        if (!element || !current) return;
        element.dataset.traceLayoutId = layout.id;
        element.dataset.traceLayoutNode = node.id;
        element.dataset.traceLayoutParent = node.parentId || '';
        element.dataset.traceLayoutPreferredVariable = node.preferredVariableId || '';
        if (!destination || explicitlyPlaced) return;
        const dx = destination.x + (Number(snapshot?.placementOffset?.x) || 0) - current.x;
        const dy = destination.y + (Number(snapshot?.placementOffset?.y) || 0) - current.y;
        if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
          translatedTransform(element, dx, dy);
          shiftPlacementTree(element, dx, dy, placements, elements);
        }
      });
    });
  }

  function renderRecursionLayoutEdges(rootSvg, root, document, frame, placements, elements, options = {}) {
    root.querySelectorAll('.asm-trace-layout-edge').forEach(edge => {
      const key = edge.dataset.traceObjectKey || '';
      if (key) {
        placements.delete(key);
        elements.delete(key);
      }
      edge.remove();
    });
    (document.layouts || []).filter(layout => (
      layout?.type === 'recursion' && layout.showEdges !== false
    )).forEach(layout => {
      const sourceNodes = [...elements.entries()].map(([objectKey, element]) => ({
        id: element?.dataset?.traceLayoutNode || '',
        parentId: element?.dataset?.traceLayoutParent || '',
        preferredVariableId: element?.dataset?.traceLayoutPreferredVariable || '',
        objectKey,
        element
      })).filter(node => node.id
        && String(node.element?.dataset?.traceLayoutId || '') === String(layout.id || ''));
      const byId = new Map(sourceNodes.map(node => [node.id, node]));
      const models = [];
      sourceNodes.forEach(node => {
        if (!node.parentId) return;
        const parentNode = byId.get(node.parentId);
        const parentElement = parentNode?.element;
        const childElement = node.element;
        const from = parentNode ? recursionOuterframePlacement(
          parentElement,
          placements.get(parentNode.objectKey),
          root,
          parentNode.preferredVariableId
        ) : null;
        const to = recursionOuterframePlacement(
          childElement,
          placements.get(node.objectKey),
          root,
          node.preferredVariableId
        );
        if (!from || !to) return;
        const direction = String(layout.direction || 'top-down').toLowerCase();
        const anchors = direction === 'bottom-up'
          ? ['top', 'bottom']
          : direction === 'left-right' ? ['right', 'left']
            : direction === 'right-left' ? ['left', 'right']
              : ['bottom', 'top'];
        models.push({
          id: `${layout.id}:${node.parentId}:${node.id}`,
          source: 'layout',
          className: 'asm-trace-layout-edge',
          from: { objectKey: parentNode.objectKey, anchor: anchors[0] },
          to: { objectKey: node.objectKey, anchor: anchors[1] },
          style: {
            color: layout.edgeColor || 'black',
            width: Math.max(0.5, Number(layout.edgeWidth) || 2),
            head: 'end',
            line: 'straight'
          },
          _fromPlacement: from,
          _toPlacement: to
        });
      });
      renderArrowModels(rootSvg, root, document, frame, placements, elements,
        models, options, `layout-${layout.id}`);
    });
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
    (frame.events || []).filter(event => (
      event.type === 'swap'
      && event.enabled !== false
      && event.autoAnimationDisabled !== true
    )).forEach(event => {
      const targets = (event.targets || []).filter(target => target.variableId && target.indexExpression);
      if (targets.length < 2 || targets[0].variableId !== targets[1].variableId) return;
      const indices = targets.slice(0, 2).map(target => {
        const value = target.resolvedIndex != null && Number.isInteger(Number(target.resolvedIndex))
          ? target.resolvedIndex
          : window.ASMTraceRules.resolveExpression(document, frame, target.indexExpression);
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

  function fixedTargetIndex(document, sourceFrame, target) {
    if (target?.resolvedIndex != null
      && target.resolvedIndex !== ''
      && Number.isInteger(Number(target.resolvedIndex))) return Number(target.resolvedIndex);
    const index = Number(window.ASMTraceRules.resolveExpression(
      document, sourceFrame, target?.indexExpression
    ));
    return Number.isInteger(index) ? index : null;
  }

  function fixedTargetVariableIds(frame, sourceFrame, event, target) {
    const identity = String(
      target?.runtimeIdentity
      || event?.runtimeIdentity
      || sourceFrame?.state?.[target?.variableId]?.identity
      || ''
    );
    if (identity) {
      const aliases = Object.entries(frame?.state || {})
        .filter(([, entry]) => String(entry?.identity || '') === identity)
        .map(([variableId]) => variableId);
      if (aliases.length) return aliases;
    }
    return frame?.state?.[target?.variableId] ? [target.variableId] : [];
  }

  function autoMarkAllowedIds(frame) {
    if (!Array.isArray(frame?.autoMarkVariableIds)) return null;
    const allowedIds = new Set(frame.autoMarkVariableIds);
    const allowedIdentities = new Set((frame?.autoMarkVariableIds || [])
      .map(id => frame.state?.[id]?.identity).filter(Boolean));
    Object.entries(frame?.state || {}).forEach(([id, entry]) => {
      if (allowedIdentities.has(entry.identity)) allowedIds.add(id);
    });
    return allowedIds;
  }

  function applyFixedEventStyles(document, frame, highlights) {
    const allowedIds = autoMarkAllowedIds(frame);
    // @keep last renders a cloned frame. Match by stable frame ID instead of
    // object identity so accumulated marks are retained inside the snapshot.
    const currentIndex = document.frames?.findIndex(item => item.id === frame?.id) ?? -1;
    if (currentIndex < 0) return;
    document.frames.slice(0, currentIndex + 1).forEach(sourceFrame => {
      (sourceFrame.events || []).filter(event => (
        event.type === 'fixed'
        // Fixed marks are persistent renderer state, not a timed animation.
        // Their user switch is authoritative even if an older saved trace
        // still carries stale animation-availability metadata.
        && event.enabled !== false
      )).forEach(event => {
        (event.targets || []).forEach(target => {
          if (!target.variableId || target.indexExpression == null) return;
          const index = fixedTargetIndex(document, sourceFrame, target);
          if (index == null) return;
          fixedTargetVariableIds(frame, sourceFrame, event, target).forEach(variableId => {
            if (allowedIds && !allowedIds.has(variableId)) return;
            highlights[variableId] ||= {};
            highlights[variableId][String(index)] = {
              ...(highlights[variableId][String(index)] || {}),
              fixedMark: '#4caf50'
            };
          });
        });
      });
    });
  }

  function evaluateFrameHighlights(document, frame) {
    const highlights = window.ASMTraceRules.evaluate(document, frame);
    applyFixedEventStyles(document, frame, highlights);
    return highlights;
  }

  function delayedCurrentFixedMarks(root, document, frame, enabled) {
    if (!enabled) return [];
    const allowedIds = autoMarkAllowedIds(frame);
    const targetKeys = new Set();
    (frame.events || []).filter(event => (
      event.type === 'fixed'
      && event.enabled !== false
    )).forEach(event => {
      (event.targets || []).forEach(target => {
        if (!target.variableId || target.indexExpression == null) return;
        const index = fixedTargetIndex(document, frame, target);
        if (index == null) return;
        fixedTargetVariableIds(frame, frame, event, target).forEach(variableId => {
          if (allowedIds && !allowedIds.has(variableId)) return;
          targetKeys.add(`${objectKeyForVariable(frame, variableId)}#${index}`);
        });
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
      if (event.enabled === false || event.autoAnimationDisabled === true) return;
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

  const TRACE_TEXT_COLORS = Object.freeze({
    AV_green: 'rgba(165, 214, 167, 0.6)',
    AV_blue: 'rgba(144, 202, 249, 0.6)',
    AV_red: 'rgba(239, 154, 154, 0.6)',
    AV_yellow: 'rgba(252, 255, 64, 0.46)',
    AV_orange: 'rgba(255, 183, 77, 0.65)',
    AV_magenta: 'rgba(231, 144, 255, 0.65)',
    AV_node_green: '#e8f5e9',
    AV_node_red: '#ef9a9a',
    AV_grey: '#cccccc',
    AV_node_grey: '#cccccc',
    AV_black: '#111827',
    AV_white: '#ffffff'
  });

  function traceTextColor(value, fallback = '') {
    return TRACE_TEXT_COLORS[value] || value || fallback;
  }

  function traceTextMarkup(value) {
    return window.parseTTSMarkup?.(value) || { display: String(value ?? ''), speech: String(value ?? '') };
  }

  function styledTextPieces(document, frame, objectKey, segment, segmentIndex, resolvedText) {
    const baseKey = `${objectKey}:segment:${segment?.segmentId || segmentIndex}`;
    const styles = document.studio?.objectStyles?.[frame.id] || {};
    const baseStyle = styles[baseKey] || {};
    if (segment?.kind === 'expression' || /[{}]/.test(resolvedText)) {
      return [{ text: resolvedText, segmentKey: baseKey, baseKey, sourceStart: 0, sourceEnd: resolvedText.length, storedStyle: baseStyle }];
    }
    const escaped = baseKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`^${escaped}:range:(\\d+)-(\\d+)$`);
    const ranges = Object.entries(styles).map(([key, style]) => {
      const match = key.match(pattern);
      if (!match) return null;
      return {
        key,
        start: Math.max(0, Math.min(resolvedText.length, Number(match[1]) || 0)),
        end: Math.max(0, Math.min(resolvedText.length, Number(match[2]) || 0)),
        style
      };
    }).filter(range => range && range.end > range.start);
    if (!ranges.length) {
      return [{ text: resolvedText, segmentKey: baseKey, baseKey, sourceStart: 0, sourceEnd: resolvedText.length, storedStyle: baseStyle }];
    }
    const boundaries = [...new Set([0, resolvedText.length, ...ranges.flatMap(range => [range.start, range.end])])]
      .sort((left, right) => left - right);
    return boundaries.slice(0, -1).map((start, index) => {
      const end = boundaries[index + 1];
      const covering = ranges.filter(range => range.start <= start && end <= range.end).at(-1);
      return {
        text: resolvedText.slice(start, end),
        segmentKey: covering?.key || baseKey,
        baseKey,
        sourceStart: start,
        sourceEnd: end,
        storedStyle: { ...baseStyle, ...(covering?.style || {}) }
      };
    });
  }

  function renderFrameTexts(root, document, frame, startY, placements, elements, options = {}) {
    let y = startY;
    const textLayer = svg('g', { class: 'asm-trace-text-layer' });
    root.append(textLayer);
    (window.ASMTraceModel?.drawingDirectives?.(document, frame, 'texts') || frame.texts || []).forEach((descriptor, descriptorIndex) => {
      if (!window.ASMTraceRules?.textExpressionMatches?.(document, frame, descriptor?.when, descriptor.drawLocals)) return;
      const key = `text:${descriptor.id || `${frame.id}-${descriptorIndex}`}`;
      const rawSegments = Array.isArray(descriptor.segments) ? descriptor.segments : [];
      const authoredBaseFontSize = Math.max(8,
        Number(rawSegments.find(segment => Number(segment?.fontSize) > 0)?.fontSize) || 14);
      const lines = [[]];
      rawSegments.forEach((segment, segmentIndex) => {
        const expressionValue = segment?.kind === 'expression'
          ? window.ASMTraceRules.resolveTextExpression(document, frame, segment.expression, descriptor.drawLocals)
          : segment?.kind === 'template'
            ? String(segment.text || '').replace(/\$\{([^{}]+)\}/g, (_, expression) => {
              return window.ASMTraceRules.resolveTextExpression(document, frame, expression.trim(), descriptor.drawLocals);
            })
            : segment?.text;
        const resolvedText = expressionValue == null ? '' : String(expressionValue);
        styledTextPieces(document, frame, key, segment, segmentIndex, resolvedText).forEach(piece => {
          piece.text.split('\n').forEach((part, partIndex, parts) => {
            const parsed = traceTextMarkup(part);
            const storedStyle = piece.storedStyle;
            lines.at(-1).push({
              ...segment,
              ...piece,
              segmentIndex,
              display: parsed.display,
              speech: parsed.speech,
              textColor: storedStyle.textColor || traceTextColor(segment?.color, '#111827'),
              background: Object.hasOwn(storedStyle, 'background')
                ? storedStyle.background
                : traceTextColor(segment?.background, 'none'),
              fontSize: Math.max(8, Number(storedStyle.fontSize) || Number(segment?.fontSize) || 14),
              bold: Object.hasOwn(storedStyle, 'bold') ? storedStyle.bold === true : segment?.bold === true
            });
            if (partIndex < parts.length - 1) lines.push([]);
          });
        });
      });
      const objectTextStyle = document.studio?.objectStyles?.[frame.id]?.[key] || {};
      const renderedBaseFontSize = Math.max(
        authoredBaseFontSize,
        ...lines.flat().map(segment => Number(segment.fontSize) || 0)
      );
      const requestedFontSize = Number(objectTextStyle.fontSize);
      const hasObjectFontSize = Number.isFinite(requestedFontSize) && requestedFontSize > 0;
      const targetBaseFontSize = hasObjectFontSize ? requestedFontSize : renderedBaseFontSize;
      const glyphScale = hasObjectFontSize ? requestedFontSize / renderedBaseFontSize : 1;
      const objectScale = targetBaseFontSize / authoredBaseFontSize;
      if (Math.abs(glyphScale - 1) > 0.0001) {
        lines.forEach(line => line.forEach(segment => {
          segment.fontSize *= glyphScale;
        }));
      }
      const lineHeight = lines.map(line => Math.max(
        12 * objectScale,
        ...line.map(segment => segment.fontSize * 1.25)
      ));
      const measureText = (value, fontSize, bold) => {
        const canvas = renderFrameTexts.measureCanvas ||= window.document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) return Array.from(value).length * fontSize * 0.58;
        context.font = `${bold ? 'bold ' : ''}${fontSize}px Arial`;
        return context.measureText(value).width;
      };
      const widths = lines.map(line => line.reduce((sum, segment) => (
        sum + measureText(segment.display, segment.fontSize, segment.bold)
      ), 0));
      const padX = 6 * objectScale;
      const padY = 4 * objectScale;
      const lineGap = 2 * objectScale;
      const cornerRadius = 6 * objectScale;
      const borderWidth = 1.2 * objectScale;
      const pointerHalfWidth = 4 * objectScale;
      const pointerHeight = 5 * objectScale;
      const boxWidth = Math.max(28 * objectScale, ...widths) + padX * 2;
      const boxHeight = lineHeight.reduce((sum, height) => sum + height, 0)
        + Math.max(0, lines.length - 1) * lineGap + padY * 2;
      const position = studioPosition(document, frame, key);
      const baseX = position.x;
      const baseY = position.absolute ? position.y : y + position.y;
      const object = markSelectable(svg('g', {
        id: `msg-${options.idPrefix || 'trace'}-text-${String(descriptor.id || descriptorIndex).replace(/[^A-Za-z0-9_-]/g, '-')}`,
        class: 'asm-trace-object draggable-object asm-trace-text-object',
        transform: `translate(${baseX}, ${baseY})`,
        'data-base-offset': `${baseX},${baseY}`,
        'data-translate': '0,0',
        'data-trace-object-key': key,
        'data-trace-object-id': key,
        'data-trace-text-id': descriptor.id || '',
        'data-trace-text-scale': objectScale,
        'data-tts-lines': JSON.stringify(lines.map(line => line.map(segment => segment.speech).join('').trim()))
      }), key, { ...options, movable: true });
      object.dataset.tracePositionApplied = '1';
      object.dataset.tracePositionSpace = 'origin';
      object.dataset.tracePositionX = String(baseX);
      object.dataset.tracePositionY = String(baseY);
      const motion = svg('g', { class: 'asm-trace-motion' });
      const background = svg('rect', {
        x: 0, y: 0, width: boxWidth, height: boxHeight, rx: cornerRadius,
        fill: '#ffffff', stroke: '#4b5563', 'stroke-width': borderWidth
      });
      motion.append(background);
      let lineTop = padY;
      lines.forEach((line, lineIndex) => {
        const lineGroup = svg('g', {
          transform: `translate(0, ${lineTop})`,
          'data-line-index': lineIndex,
          'data-trace-text-line': '1'
        });
        let cursorX = padX;
        const segmentLayouts = line.flatMap(segment => {
          const segmentWidth = measureText(segment.display, segment.fontSize, segment.bold);
          if (!segment.display) return [];
          const layout = { segment, segmentWidth, cursorX };
          cursorX += segmentWidth;
          return [layout];
        });
        const backgroundRuns = [];
        segmentLayouts.forEach(layout => {
          const fill = layout.segment.background;
          if (!fill || fill === 'none' || fill === 'rgba(0,0,0,0)') return;
          const previous = backgroundRuns.at(-1);
          if (previous && previous.fill === fill
            && Math.abs(previous.x + previous.width - layout.cursorX) < 0.001) {
            previous.width += layout.segmentWidth;
            return;
          }
          backgroundRuns.push({ fill, x: layout.cursorX, width: layout.segmentWidth });
        });
        backgroundRuns.forEach(run => {
          lineGroup.append(svg('rect', {
            class: 'asm-trace-text-segment-background',
            x: run.x - 2 * objectScale,
            y: 0,
            width: Math.max(4 * objectScale, run.width + 4 * objectScale),
            height: lineHeight[lineIndex],
            rx: 2 * objectScale,
            fill: run.fill,
            stroke: 'none',
            'pointer-events': 'none',
            'data-trace-text-background-run': '1'
          }));
        });
        segmentLayouts.forEach(({ segment, segmentWidth, cursorX: segmentX }) => {
          const segmentGroup = svg('g', {
            transform: `translate(${segmentX}, 0)`,
            'data-trace-object-key': segment.segmentKey,
            'data-trace-parent-key': key,
            'data-trace-movable': '0',
            'data-trace-text-segment': segment.kind || 'literal',
            'data-trace-text-expression': segment.kind === 'expression' ? segment.source || `\${${segment.expression}}` : '',
            'data-trace-text-segment-id': segment.segmentId || String(segment.segmentIndex),
            'data-trace-text-base-key': segment.baseKey || segment.segmentKey,
            'data-trace-text-source-start': segment.sourceStart ?? 0,
            'data-trace-text-source-end': segment.sourceEnd ?? segment.display.length,
            'data-trace-text-background': segment.background || 'none'
          });
          segmentGroup.append(svg('rect', {
            class: 'asm-trace-text-segment-hitbox',
            x: -2 * objectScale,
            y: 0,
            width: Math.max(4 * objectScale, segmentWidth + 4 * objectScale),
            height: lineHeight[lineIndex],
            rx: 2 * objectScale,
            fill: 'rgba(0,0,0,0)',
            stroke: 'none',
            'pointer-events': 'all'
          }));
          segmentGroup.append(svg('text', {
            class: 'asm-trace-text-segment-value',
            x: 0,
            y: lineHeight[lineIndex] * 0.78,
            'font-size': segment.fontSize,
            'font-weight': segment.bold ? 'bold' : 'normal',
            'font-style': segment.storedStyle?.italic === true ? 'italic' : 'normal',
            'text-decoration': [
              segment.storedStyle?.underline === true ? 'underline' : '',
              segment.storedStyle?.strike === true ? 'line-through' : ''
            ].filter(Boolean).join(' ') || 'none',
            'font-family': 'Arial',
            fill: segment.textColor,
            'xml:space': 'preserve',
            style: 'white-space:pre'
          }, segment.display));
          lineGroup.append(segmentGroup);
          placements.set(segment.segmentKey, {
            x: baseX + segmentX - 2 * objectScale,
            y: baseY + lineTop,
            width: Math.max(4 * objectScale, segmentWidth + 4 * objectScale),
            height: lineHeight[lineIndex]
          });
          elements.set(segment.segmentKey, segmentGroup);
        });
        motion.append(lineGroup);
        lineTop += lineHeight[lineIndex] + lineGap;
      });
      const pointerX = boxWidth / 2;
      motion.append(svg('path', {
        d: `M ${pointerX - pointerHalfWidth} ${boxHeight} L ${pointerX} ${boxHeight + pointerHeight} L ${pointerX + pointerHalfWidth} ${boxHeight} Z`,
        fill: '#ffffff', stroke: '#4b5563', 'stroke-width': borderWidth
      }));
      object.append(motion);
      textLayer.append(object);
      animateObjectPosition(motion, options, key, { x: baseX, y: baseY });
      placements.set(key, { x: baseX, y: baseY, width: boxWidth, height: boxHeight + pointerHeight });
      elements.set(key, object);
      y += boxHeight + 28;
    });
    if (!textLayer.childElementCount) textLayer.remove();
    return y;
  }

  function applySemanticTextBindings(document, frame, placements, elements) {
    const canvas = { x: 0, y: 0, width: 1100, height: 620 };
    (window.ASMTraceModel?.drawingDirectives?.(document, frame, 'texts') || frame.texts || []).forEach((descriptor, descriptorIndex) => {
      if (!window.ASMTraceRules?.textExpressionMatches?.(document, frame, descriptor?.when, descriptor.drawLocals)) return;
      const binding = descriptor?.binding;
      if (!binding) return;
      const key = `text:${descriptor.id || `${frame.id}-${descriptorIndex}`}`;
      const source = elements.get(key);
      const sourcePlacement = placements.get(key);
      if (!source || !sourcePlacement) return;
      const indexExpression = (binding.indexExpressions || []).join(',');
      const target = binding.canvas
        ? canvas
        : targetPlacement(document, frame, placements, {
          objectKey: binding.targetObjectKey,
          variableId: binding.targetVariableId,
          indexExpression
        }, elements);
      if (!target) {
        source.setAttribute('display', 'none');
        source.dataset.traceBindingUnavailable = '1';
        return;
      }
      const anchor = String(binding.anchor || 'center').toLowerCase();
      const point = anchorPoint(target, anchor);
      const gap = 8;
      let desiredX = point.x - sourcePlacement.width / 2;
      let desiredY = point.y - sourcePlacement.height / 2;
      if (anchor.includes('left')) desiredX = point.x - sourcePlacement.width - gap;
      if (anchor.includes('right')) desiredX = point.x + gap;
      if (anchor.includes('top')) desiredY = point.y - sourcePlacement.height - gap;
      if (anchor.includes('bottom')) desiredY = point.y + gap;
      desiredX += Number(binding.offsetX) || 0;
      desiredY += Number(binding.offsetY) || 0;
      const dx = desiredX - sourcePlacement.x;
      const dy = desiredY - sourcePlacement.y;
      translatedTransform(source, dx, dy);
      shiftPlacementTree(source, dx, dy, placements, elements);
      source.parentElement?.append(source);
      source.dataset.traceBound = '1';
      source.dataset.traceBindingTarget = binding.canvas
        ? 'canvas'
        : resolvedTargetKey(document, frame, {
          objectKey: binding.targetObjectKey,
          variableId: binding.targetVariableId,
          indexExpression
        }, placements);
      source.dataset.traceSemanticBinding = '1';
      source.dataset.traceBindingAnchor = binding.anchor || 'center';
      source.dataset.traceBindingLine = String(descriptor.line || '');
    });
  }

  function renderStudioObjects(root, document, frame, placements, elements, options = {}, sourceObjects = null) {
    const objects = (sourceObjects || document.studio?.objects || []).filter(object => studioObjectVisible(object, frame));
    objects.forEach(studioObject => {
      // Auto bindings may supply a transient placement without inventing a
      // real array index. It is not persisted in the Trace Studio document.
      const markerPlacement = studioObject.markerUnresolved ? studioObject.markerPlacement : null;
      const target = markerPlacement
        ? anchorPoint(markerPlacement, 'top')
        : resolveAnchor(document, frame, studioObject.target, placements, elements);
      if (!target) return;
      const pointerTarget = markerPlacement ? anchorPoint(markerPlacement, 'center') : studioObject.pointerTarget
        ? resolveAnchor(document, frame, studioObject.pointerTarget, placements, elements)
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
      // A bound marker's motion origin is its rendered position, not its
      // persisted Studio drag offset. Keeping the offset in tracePosition made
      // every automatic marker look as though it lived at (0, 0), so recursive
      // heap markers could not tween between their actual cells.
      object.dataset.tracePositionX = String(
        studioObject.type === 'variable-marker' ? baseX : position.x
      );
      object.dataset.tracePositionY = String(
        studioObject.type === 'variable-marker' ? baseY : position.y
      );
      if (studioObject.sourceVariableId) {
        object.dataset.traceSourceVariableId = studioObject.sourceVariableId;
      }
      if (studioObject.sourceRuntimeIdentity) {
        object.dataset.traceRuntimeIdentity = studioObject.sourceRuntimeIdentity;
      }
      if (studioObject.sourceVisualContinuityKey) {
        object.dataset.traceVisualContinuityKey = studioObject.sourceVisualContinuityKey;
      }
      if (studioObject.sourceAliasContinuityKey) {
        object.dataset.traceMarkerAliasContinuityKey = studioObject.sourceAliasContinuityKey;
      }
      if (studioObject.sourceReferenceAlias) {
        object.dataset.traceMarkerReferenceAlias = '1';
      }
      if (studioObject.sourceSnapshotOwner) {
        object.dataset.traceSnapshotOwner = studioObject.sourceSnapshotOwner;
      }
      const sourceVariableIds = Array.isArray(studioObject.sourceVariableIds)
        ? studioObject.sourceVariableIds.filter(Boolean)
        : studioObject.sourceVariableId ? [studioObject.sourceVariableId] : [];
      if (sourceVariableIds.length) {
        object.dataset.traceSourceVariableIds = JSON.stringify([...new Set(sourceVariableIds)]);
      }
      if (studioObject.indexExpression) {
        object.dataset.traceMarkerIndexExpression = studioObject.indexExpression;
      }
      const boundTargetKey = markerPlacement ? '' : resolvedTargetKey(document, frame, studioObject.target, placements);
      if (boundTargetKey) object.dataset.traceBindingTarget = boundTargetKey;
      if (markerPlacement) {
        object.dataset.traceMarkerUnresolved = '1';
        object.dataset.traceMarkerTargetX = String(pointerTarget.x + (Number(studioObject.pointerTargetOffsetX) || 0));
        object.dataset.traceMarkerTargetY = String(pointerTarget.y);
      }
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
        if (shape === 'arrow-left') {
          const labelSize = 18;
          const labelLeft = -40;
          const labelTop = -labelSize / 2;
          const labelLength = Math.max(1, Array.from(String(label)).length);
          const fontSize = Math.max(4, Math.min(8, (labelSize - 4) / (labelLength * 0.62)));
          const borderColor = '#333';
          const point = svg('g', { class: 'trace-variable-marker-point' });
          point.append(
            svg('path', {
              d: 'M -22 0 L -2 0 M -8 -5 L -2 0 L -8 5', fill: 'none',
              stroke: borderColor, 'stroke-width': 1, 'stroke-linecap': 'square', 'stroke-linejoin': 'miter'
            }),
            svg('polygon', {
              class: 'trace-variable-marker-arrow-head',
              points: '-8,-5 -2,0 -8,5',
              fill: borderColor,
              stroke: borderColor,
              'stroke-width': 1,
              'data-trace-marker-direction': 'right'
            })
          );
          motion.append(
            svg('rect', {
              class: 'trace-variable-marker-label-box', x: labelLeft, y: labelTop,
              width: labelSize, height: labelSize, fill: '#bfe8f7', 'fill-opacity': 0.58,
              stroke: borderColor, 'stroke-width': 1
            }),
            svg('text', {
              class: 'trace-variable-marker-label-text', x: labelLeft + labelSize / 2, y: 0,
              'text-anchor': 'middle', 'dominant-baseline': 'middle', 'font-family': 'Arial',
              'font-size': fontSize, 'font-weight': 'bold', fill: studioObject.textColor || '#1f282d'
            }, label),
            point
          );
          object.dataset.traceMarkerBaseCellWidth = String(Math.max(1, Number(studioObject.baseCellWidth) || 40));
          box = { x: labelLeft, y: labelTop, width: 38, height: labelSize };
        } else if (shape === 'arrow') {
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
          const aimX = (pointerTarget?.x ?? target.x)
            + (Number(studioObject.pointerTargetOffsetX) || 0)
            - target.x - offsetX;
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
              class: 'trace-variable-marker-label-box',
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
              class: 'trace-variable-marker-label-text',
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
          object.dataset.traceMarkerBaseCellWidth = String(
            Math.max(1, Number(studioObject.baseCellWidth) || 40)
          );
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
      if (studioObject.type === 'variable-marker') {
        object.dataset.traceMarkerPopupX = String(baseX);
        object.dataset.traceMarkerPopupY = String(baseY + box.y);
        object.dataset.traceMarkerSortKey = String(studioObject.markerSortKey || studioObject.text || '');
        object.dataset.traceMarkerSortOrder = String(
          Number.isFinite(Number(studioObject.markerSortOrder))
            ? Number(studioObject.markerSortOrder) : 0
        );
      }
      root.append(object);
      animateObjectPosition(motion, options, key, { x: baseX, y: baseY });
      placements.set(key, { x: baseX + box.x, y: baseY + box.y, width: box.width, height: box.height });
      elements.set(key, object);
      collectElementPlacements(motion, baseX, baseY, placements, elements);
    });
  }

  function relativeMarkerOffset(expression, baseName) {
    const base = String(baseName || '').trim();
    let source = String(expression || '').replace(/\s+/g, '');
    if (!base || !source) return null;
    while (source.startsWith('(') && source.endsWith(')')) {
      let depth = 0;
      let wraps = true;
      for (let index = 0; index < source.length; index += 1) {
        if (source[index] === '(') depth += 1;
        else if (source[index] === ')') depth -= 1;
        if (depth === 0 && index < source.length - 1) {
          wraps = false;
          break;
        }
      }
      if (!wraps || depth !== 0) break;
      source = source.slice(1, -1);
    }
    if (source === base) return 0;
    if (!source.startsWith(base)) return null;
    const suffix = source.slice(base.length);
    if (!suffix || !/^(?:[+-]\d+)+$/.test(suffix)) return null;
    return [...suffix.matchAll(/([+-])(\d+)/g)].reduce((total, match) => (
      total + (match[1] === '-' ? -1 : 1) * Number(match[2])
    ), 0);
  }

  function unresolvedRelativeLayout(group, targetPlacement, baseCellWidth, gap) {
    if (group.length < 2 || !targetPlacement) return null;
    const relative = group.map(item => ({
      item,
      base: String(item.relativeMarkerBase || ''),
      offset: Number(item.relativeMarkerOffset)
    }));
    const base = relative[0]?.base;
    if (!base || relative.some(entry => (
      entry.base !== base || !Number.isInteger(entry.offset)
    ))) return null;

    const slots = new Map();
    relative.forEach(entry => {
      if (!slots.has(entry.offset)) slots.set(entry.offset, []);
      slots.get(entry.offset).push(entry.item);
    });
    const centers = new Map();
    slots.forEach((items, offset) => {
      const ordered = [...items].sort((left, right) => (
        Number(left.markerSortOrder) - Number(right.markerSortOrder)
        || String(left.id).localeCompare(String(right.id))
      ));
      const slotWidth = ordered.reduce((total, item) => total + item.labelWidth, 0)
        + Math.max(0, ordered.length - 1) * gap;
      let cursor = offset * baseCellWidth - slotWidth / 2;
      ordered.forEach(item => {
        centers.set(item, cursor + item.labelWidth / 2);
        cursor += item.labelWidth + gap;
      });
    });
    const rightEdge = Math.max(...relative.map(({ item }) => (
      centers.get(item) + item.labelWidth / 2
    )));
    const targetCenter = targetPlacement.x + targetPlacement.width / 2;
    const shift = targetPlacement.x - gap - rightEdge;
    return {
      markerPlacement: targetPlacement,
      offsets: new Map(relative.map(({ item }) => [
        item,
        centers.get(item) + shift - targetCenter
      ]))
    };
  }

  function renderFrameBindings(root, document, frame, placements, elements, options = {}) {
    const authoredBindings = Array.isArray(frame.bindings) ? frame.bindings : [];
    if (!authoredBindings.length) return;
    const bindings = [];
    const authoredSourceIds = new Set(authoredBindings.map(binding => binding.sourceVariableId));
    authoredBindings.forEach(binding => {
      const sourceVariable = document.variables?.[binding.sourceVariableId] || {};
      const sourceEntry = frame.state?.[binding.sourceVariableId];
      const referenceAlias = /&/.test(String(sourceVariable.cppType || ''));
      const globalAliases = referenceAlias && sourceEntry?.identity
        ? Object.entries(frame.state || {}).filter(([variableId, entry]) => (
          variableId !== binding.sourceVariableId
          && entry?.identity === sourceEntry.identity
          && document.variables?.[variableId]?.functionName === 'global'
          && document.variables?.[variableId]?.kind === 'scalar'
        ))
        : [];
      const sourceVariableIds = [...new Set([
        ...(binding.sourceVariableIds || [binding.sourceVariableId]),
        ...globalAliases.map(([variableId]) => variableId)
      ].filter(Boolean))];
      globalAliases.forEach(([variableId]) => {
        if (authoredSourceIds.has(variableId)) return;
        const variable = document.variables[variableId];
        bindings.push({
          ...binding,
          sourceVariableId: variableId,
          sourceVariableIds,
          sourceName: variable.name,
          indexExpression: variable.name
        });
      });
      bindings.push({ ...binding, sourceVariableIds });
    });
    const pending = [];
    const visualContinuityOrdinals = new Map();

    bindings.forEach((binding, index) => {
      const targetEntry = frame.state?.[binding.targetVariableId];
      const targetItems = Array.isArray(targetEntry?.data?.items) ? targetEntry.data.items : [];
      const targetKind = document.variables?.[binding.targetVariableId]?.kind
        || targetEntry?.data?.kind;
      const indexExpression = binding.indexExpression || binding.sourceName;
      const relativeIndexOffset = relativeMarkerOffset(indexExpression, binding.sourceName);
      const rawIndexValue = window.ASMTraceRules.resolveExpression(document, frame, indexExpression);
      const resolvedIndexValue = rawIndexValue == null ? NaN : Number(rawIndexValue);
      const hasIndexValue = Number.isInteger(resolvedIndexValue);
      const indexValue = hasIndexValue ? resolvedIndexValue : null;
      if (targetKind === 'matrix') {
        if (binding.mode !== 'index' || !targetEntry || !hasIndexValue) return;
        const targetObjectKey = objectKeyForVariable(frame, binding.targetVariableId);
        const dimension = Number(binding.indexDimension) || 0;
        const rendererOptions = frame.rendererOptions?.[binding.targetVariableId] || {};
        if (rendererOptions.markerLayout === 'none') return;
        let targetKey = `${targetObjectKey}:${dimension === 0 ? 'row' : 'column'}-label:${indexValue}`;
        let targetExpression = String(indexValue);
        let targetAxis = dimension === 0 ? 'row' : 'column';
        if (dimension === 1 && rendererOptions.markerLayout === 'inner') {
          const rowBinding = bindings.find(candidate => (
            candidate.targetVariableId === binding.targetVariableId
            && Number(candidate.indexDimension) === 0
          ));
          const rowValue = Number(window.ASMTraceRules.resolveExpression(
            document, frame, rowBinding?.indexExpression || ''
          ));
          if (!Number.isInteger(rowValue)) return;
          targetKey = `${targetObjectKey}#${rowValue},${indexValue}`;
          targetExpression = `${rowValue},${indexValue}`;
          targetAxis = '';
        }
        const targetPlacement = placements.get(targetKey);
        if (!targetPlacement) return;
        const label = binding.indexExpression || binding.sourceName || 'index';
        const sourceVariable = document.variables?.[binding.sourceVariableId] || {};
        const snapshotOwner = String(options.snapshotOwner || '');
        pending.push({
          id: `${snapshotOwner ? `${snapshotOwner}:` : ''}auto-frame-binding-${binding.sourceVariableId}-${binding.targetVariableId}-${index}`,
          type: 'variable-marker', sourceVariableId: binding.sourceVariableId,
          sourceVariableIds: binding.sourceVariableIds || [binding.sourceVariableId],
          sourceSnapshotOwner: snapshotOwner,
          sourceRuntimeIdentity: frame.state?.[binding.sourceVariableId]?.lifetime
            || frame.state?.[binding.sourceVariableId]?.identity || '',
          sourceVisualContinuityKey: `${snapshotOwner ? `snapshot:${snapshotOwner}:` : ''}auto-matrix-marker:${binding.sourceVariableId}:${binding.targetVariableId}:${dimension}`,
          sourceAliasContinuityKey: '', sourceReferenceAlias: /&/.test(String(sourceVariable.cppType || '')),
          targetVariableId: binding.targetVariableId, targetObjectKey,
          targetRuntimeIdentity: targetEntry?.identity || '', targetPlacement,
          baseCellWidth: 40, indexValue, unresolvedIndex: false, label,
          markerSortOrder: index, markerSortKey: binding.sourceName || label,
          markerSortExpression: indexExpression, relativeMarkerBase: '', relativeMarkerOffset: null,
          indexExpression, labelWidth: 18,
          target: {
            variableId: binding.targetVariableId,
            indexExpression: targetExpression,
            ...(targetAxis ? { axis: targetAxis } : {}),
            anchor: dimension === 0 ? 'left' : 'top'
          },
          pointerTarget: {
            variableId: binding.targetVariableId,
            indexExpression: targetExpression,
            ...(targetAxis ? { axis: targetAxis } : {}),
            anchor: 'center'
          },
          text: label, shape: dimension === 0 ? 'arrow-left' : 'arrow',
          color: '#12a6df', stroke: '#0b7ead'
        });
        return;
      }
      if (binding.mode !== 'index'
        || !targetEntry
        || !targetItems.length) return;
      const markerSourceIds = new Set(binding.sourceVariableIds || [binding.sourceVariableId]);
      (frame.events || []).forEach(event => {
        if (!['assign', 'write'].includes(event?.type)) return;
        const eventTarget = (event.targets || []).find(target => target?.role !== 'source'
          && markerSourceIds.has(target?.variableId));
        if (!eventTarget) return;
        ['before', 'after'].forEach(phase => {
          const eventIndex = Number(displayValue(event.payload?.[phase]));
          if (!Number.isInteger(eventIndex)) return;
          ensureLinearIndexPlacement(
            frame, binding.targetVariableId, eventIndex,
            targetItems.length, placements, elements
          );
        });
      });
      const unresolvedReference = hasIndexValue ? null : leftmostVisibleIndexPlacement(
        frame, binding.targetVariableId, placements, elements
      );
      if (hasIndexValue ? !ensureLinearIndexPlacement(
        frame,
        binding.targetVariableId,
        indexValue,
        targetItems.length,
        placements,
        elements
      ) : !unresolvedReference) return;

      const label = binding.indexExpression
        || binding.sourceName
        || document.variables?.[binding.sourceVariableId]?.name
        || 'index';
      const targetObjectKey = objectKeyForVariable(frame, binding.targetVariableId);
      const targetKey = unresolvedReference?.key || `${targetObjectKey}#${indexValue}`;
      const targetPlacement = unresolvedReference?.placement || placements.get(targetKey);
      const targetElement = elements.get(targetKey);
      const baseCellWidth = Number(
        targetElement?.closest?.('[data-layout]')?.getAttribute?.('data-box-size')
      ) || 40;
      const snapshotOwner = String(options.snapshotOwner || '');
      const visualContinuityBase = [
        ...(snapshotOwner ? ['snapshot', snapshotOwner] : []),
        'auto-marker',
        binding.sourceVariableId,
        binding.targetVariableId,
        binding.sourceName || binding.indexExpression || ''
      ].join(':');
      const visualContinuityOrdinal = visualContinuityOrdinals.get(visualContinuityBase) || 0;
      visualContinuityOrdinals.set(visualContinuityBase, visualContinuityOrdinal + 1);
      const sourceVariable = document.variables?.[binding.sourceVariableId] || {};
      const sourceIdentity = String(frame.state?.[binding.sourceVariableId]?.identity || '');
      const targetIdentity = String(targetEntry?.identity || '');
      const escapedSourceName = String(binding.sourceName || '')
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const normalizedExpression = escapedSourceName
        ? String(indexExpression).replace(new RegExp(`\\b${escapedSourceName}\\b`, 'g'), '$source')
        : String(indexExpression);
      const aliasContinuityBase = sourceIdentity && targetIdentity
        ? [
          ...(snapshotOwner ? ['snapshot', snapshotOwner] : []),
          'auto-marker-alias', sourceIdentity, targetIdentity, normalizedExpression
        ].join(':')
        : '';
      pending.push({
        id: `${snapshotOwner ? `${snapshotOwner}:` : ''}auto-frame-binding-${binding.sourceVariableId}-${binding.targetVariableId}-${index}`,
        type: 'variable-marker',
        sourceVariableId: binding.sourceVariableId,
        sourceVariableIds: binding.sourceVariableIds || [binding.sourceVariableId],
        sourceSnapshotOwner: snapshotOwner,
        sourceRuntimeIdentity: frame.state?.[binding.sourceVariableId]?.lifetime
          || frame.state?.[binding.sourceVariableId]?.identity || '',
        // Runtime identity still distinguishes recursive stack activations for
        // event snapshots. This stable role key is only for visual continuity,
        // so the same automatic marker moves instead of re-entering on every call.
        sourceVisualContinuityKey: `${visualContinuityBase}:${visualContinuityOrdinal}`,
        sourceAliasContinuityKey: aliasContinuityBase,
        sourceReferenceAlias: /&/.test(String(sourceVariable.cppType || '')),
        targetVariableId: binding.targetVariableId,
        targetObjectKey,
        targetRuntimeIdentity: targetEntry?.identity || '',
        targetPlacement,
        baseCellWidth,
        indexValue,
        unresolvedIndex: !hasIndexValue,
        label,
        markerSortOrder: index,
        markerSortKey: binding.sourceName
          || document.variables?.[binding.sourceVariableId]?.name
          || label,
        markerSortExpression: indexExpression,
        relativeMarkerBase: relativeIndexOffset == null ? '' : binding.sourceName,
        relativeMarkerOffset: relativeIndexOffset,
        indexExpression,
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

    const aliasCounts = new Map();
    pending.forEach(item => {
      if (!item.sourceAliasContinuityKey) return;
      aliasCounts.set(item.sourceAliasContinuityKey,
        (aliasCounts.get(item.sourceAliasContinuityKey) || 0) + 1);
    });
    pending.forEach(item => {
      // A global and a reference parameter intentionally remain two markers
      // when both are present in the same frame.
      if ((aliasCounts.get(item.sourceAliasContinuityKey) || 0) > 1) {
        item.sourceAliasContinuityKey = '';
      }
    });

    const groups = new Map();
    pending.forEach(item => {
      const target = item.targetPlacement;
      const groupKey = item.unresolvedIndex
        ? `unresolved:${item.targetObjectKey}`
        : target
        ? [target.x, target.y, target.width, target.height]
          .map(value => Math.round((Number(value) || 0) * 10) / 10)
          .join(':')
        : `${item.targetRuntimeIdentity || item.targetObjectKey || item.targetVariableId}#${item.indexValue}`;
      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey).push(item);
    });

    const objects = [];
    groups.forEach(group => {
      const orderedGroup = [...group].sort((left, right) => {
        const byDeclaration = Number(left.markerSortOrder) - Number(right.markerSortOrder);
        return byDeclaration || String(left.id).localeCompare(String(right.id));
      });
      const gap = 8;
      const totalWidth = orderedGroup.reduce((total, item) => total + item.labelWidth, 0)
        + Math.max(0, orderedGroup.length - 1) * gap;
      const targetPlacement = orderedGroup[0].targetPlacement || placements.get(
        `${orderedGroup[0].targetObjectKey}#${orderedGroup[0].indexValue}`
      );
      const targetWidth = Math.max(0, Number(targetPlacement?.width) || 0);
      const baseCellWidth = Math.max(1, Number(orderedGroup[0].baseCellWidth) || 40);
      const unresolved = orderedGroup[0].unresolvedIndex;
      const relativeLayout = unresolved
        ? unresolvedRelativeLayout(orderedGroup, targetPlacement, baseCellWidth, gap)
        : null;
      // Move the entire group horizontally, preserving the reference cell's
      // top/center anchors. The rightmost label ends 8px before its left edge.
      const markerPlacement = relativeLayout?.markerPlacement || (unresolved ? {
        ...targetPlacement,
        x: targetPlacement.x - gap - totalWidth / 2 - targetPlacement.width / 2
      } : null);
      const keepArrowsVertical = targetWidth > baseCellWidth + 0.5;
      let cursor = -totalWidth / 2;
      orderedGroup.forEach(item => {
        item.offsetX = relativeLayout?.offsets.get(item) ?? (cursor + item.labelWidth / 2);
        item.pointerTargetOffsetX = relativeLayout ? item.offsetX
          : keepArrowsVertical ? item.offsetX : 0;
        cursor += item.labelWidth + gap;
        const {
          targetVariableId, targetObjectKey, targetRuntimeIdentity,
          targetPlacement: ignoredTargetPlacement,
          indexValue, unresolvedIndex, labelWidth, label, markerSortExpression,
          relativeMarkerBase, relativeMarkerOffset, ...object
        } = item;
        if (unresolvedIndex) {
          object.markerUnresolved = true;
          object.markerPlacement = markerPlacement;
          delete object.target;
          delete object.pointerTarget;
        }
        objects.push(object);
      });
    });

    if (objects.length) renderStudioObjects(root, document, frame, placements, elements, options, objects);
  }

  function applyCompletedScopeExits(frame, elements, deferLifecycleEvents = false) {
    if (deferLifecycleEvents) return;
    (frame?.events || []).filter(event => (
      (event?.type === 'scope-exit' || event?.type === 'visual-exit')
      && event.enabled !== false
      && event.autoAnimationDisabled !== true
    )).forEach(event => {
      (event.targets || []).forEach(target => {
        const variableId = String(target?.variableId || '');
        const lifetime = String(target?.lifetimeIdentity || event.lifetimeIdentity || '');
        const targetGeneration = Number(target?.sceneGeneration ?? event?.sceneGeneration);
        elements?.forEach?.(element => {
          if (element?.dataset?.traceSnapshotOwner
            || element?.closest?.('[data-trace-snapshot]')) return;
          let matches = String(element?.dataset?.traceVariable || '') === variableId;
          if (element?.dataset?.traceSourceVariableId) {
            let sourceIds = [];
            try {
              sourceIds = JSON.parse(element.dataset.traceSourceVariableIds || '[]');
            } catch {
              sourceIds = [element.dataset.traceSourceVariableId];
            }
            matches = sourceIds.includes(variableId);
            if (matches && lifetime) {
              matches = String(element.dataset.traceRuntimeIdentity || '') === lifetime;
            }
          } else if (matches && lifetime) {
            matches = String(element?.dataset?.traceRuntimeLifetime || '') === lifetime;
          }
          const visualGeneration = Number(element?.dataset?.traceSceneGeneration);
          if (matches && Number.isFinite(targetGeneration) && Number.isFinite(visualGeneration)) {
            matches = targetGeneration === visualGeneration;
          }
          if (matches) element.setAttribute?.('display', 'none');
        });
      });
    });
  }

  function renderStudioArrows(rootSvg, root, document, frame, placements, elements, options = {}) {
    const arrows = Array.isArray(document.studio?.arrows) ? document.studio.arrows : [];
    if (!arrows.length) return;
    const models = arrows.map(arrow => {
      const fromTarget = arrow.from || { variableId: arrow.fromVariableId, anchor: 'right' };
      const toTarget = arrow.to || { variableId: arrow.toVariableId, anchor: 'left' };
      const withinSameObject = fromTarget.variableId === toTarget.variableId
        && fromTarget.indexExpression && toTarget.indexExpression;
      return {
        ...arrow,
        source: 'studio',
        from: fromTarget,
        to: toTarget,
        style: {
          ...(arrow.style || {}),
          color: arrow.style?.color || arrow.color || '#e53935',
          width: arrow.style?.width || arrow.width || 3,
          line: arrow.style?.line || arrow.line || (withinSameObject ? 'curve' : 'straight'),
          head: arrow.style?.head || arrow.head || 'end',
          dash: arrow.style?.dash || arrow.dash || ''
        }
      };
    });
    renderArrowModels(rootSvg, root, document, frame, placements, elements,
      models, options, 'studio');
  }

  function renderDirectiveArrows(rootSvg, root, document, frame, placements, elements, options = {}) {
    const arrows = window.ASMTraceModel?.drawingDirectives?.(document, frame, 'arrows') || frame.arrows || [];
    const expanded = arrows.flatMap(arrow => !arrow.batch ? [arrow] : window.ASMArrowModel.expandBatch(arrow,
      (expression, locals) => window.ASMTraceRules.resolveExpression(document, frame, expression, { ...arrow.drawLocals, ...locals }),
      (condition, locals) => window.ASMTraceRules.expressionMatches(document, frame, condition, { ...arrow.drawLocals, ...locals }),
      batch => window.ASMTraceModel.loopSamples(document, frame, batch)));
    const ids = new Set();
    expanded.forEach(arrow => {
      if (ids.has(arrow.id)) throw new Error(`本幀 @arrow 展開後 ID 重複：${arrow.id}`);
      ids.add(arrow.id);
    });
    renderArrowModels(rootSvg, root, document, frame, placements, elements,
      expanded.map(arrow => ({ ...arrow, source: 'directive' })), options, 'directive');
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

  function snapshotRuntimeIdentity(document, snapshot) {
    if (snapshot.sourceIdentity) return snapshot.sourceIdentity;
    const frames = document.frames || [];
    const createdIndex = frames.findIndex(item => item.id === snapshot.createdFrameId);
    for (let index = createdIndex >= 0 ? createdIndex : frames.length - 1; index >= 0; index -= 1) {
      const identity = frames[index]?.state?.[snapshot.sourceVariableId]?.identity;
      if (identity) return identity;
    }
    return '';
  }

  function renderSnapshots(root, document, frame, startY, placements, elements, options = {}, keepNodes = []) {
    const snapshotsById = new Map((document.snapshots || []).map(snapshot => [snapshot.id, snapshot]));
    const visibilityStates = document.studio?.visibility?.[frame.id] || {};
    const editingVisibility = window.document.body.classList.contains('asm-trace-studio-open');
    let y = startY;
    (frame.snapshotIds || []).forEach(snapshotId => {
      const snapshot = snapshotsById.get(snapshotId);
      const objectKey = snapshotObjectKey(snapshot);
      const visibility = visibilityStates[objectKey] || visibilityStates[snapshotId];
      if (!snapshot || !objectKey || (!editingVisibility && visibility === 'hidden')) return;
      if (snapshot.kind === 'frame' && snapshot.frame) {
        const position = snapshotStudioPosition(document, frame, snapshot);
        const baseX = position.x;
        // Keep the live portion of the source frame in the same layout row it
        // occupied before @keep. An explicitly dragged snapshot remains a
        // standalone group and therefore keeps the legacy absolute behavior.
        const sourceLayoutY = position.explicit ? 0 : y;
        const baseY = position.y;
        const object = markSelectable(svg('g', {
          id: `${options.idPrefix || 'trace'}-${safeKey(objectKey)}`,
          class: 'asm-trace-object asm-trace-snapshot asm-trace-frame-snapshot',
          transform: `translate(${baseX}, ${baseY})`,
          'data-base-offset': `${baseX},${baseY}`,
          'data-translate': '0,0',
          'data-trace-snapshot': snapshotId,
          'data-trace-scene-generation': String(snapshot.sceneGeneration ?? snapshot.frame.sceneGeneration ?? 0),
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
        const sourceIndex = document.frames?.findIndex(item => item.id === snapshot.sourceFrameId) ?? -1;
        const effectiveSnapshotFrame = window.ASMTraceEvents?.keepSnapshotFrame?.(document, snapshot)
          || snapshot.frame;
        const frozenFrame = { ...effectiveSnapshotFrame, snapshotIds: [] };
        const frozenScene = renderScene(
          root.ownerSVGElement,
          content,
          document,
          frozenFrame,
          sourceIndex > 0 ? document.frames[sourceIndex - 1] : null,
          {
            idPrefix: `${options.idPrefix || 'trace'}-${safeKey(objectKey)}`,
            interactive: false,
            animatePositions: false,
            transform: '',
            snapshotOwner: objectKey,
            initialY: sourceLayoutY
          }
        );
        const contentBox = measuredBox(content, { x: 0, y: 0, width: 180, height: 100 });
        animateObjectPosition(motion, options, objectKey, { x: baseX, y: baseY });
        placements.set(objectKey, {
          x: baseX + contentBox.x,
          y: baseY + contentBox.y,
          width: contentBox.width,
          height: contentBox.height
        });
        elements.set(objectKey, object);
        Object.keys(snapshot.frame.state || {}).forEach(variableId => {
          const sourceKey = objectKeyForVariable(snapshot.frame, variableId);
          const sourcePlacement = frozenScene.placements.get(sourceKey);
          const sourceElement = frozenScene.elements.get(sourceKey);
          if (!sourcePlacement || !sourceElement) return;
          if (!snapshot.layoutId) {
            keepNodes.push({
              snapshotId: objectKey,
              variableId,
              runtimeIdentity: snapshot.frame.state?.[variableId]?.identity || '',
              relative: {
                x: sourcePlacement.x - contentBox.x,
                y: sourcePlacement.y - contentBox.y,
                width: sourcePlacement.width,
                height: sourcePlacement.height
              }
            });
          }
        });
        if (!snapshot.layoutId) y += Math.max(76, contentBox.height) + KEEP_SNAPSHOT_GAP;
        return;
      }
      const sourceVariable = document.variables?.[snapshot.sourceVariableId] || {};
      const variable = { ...sourceVariable, id: objectKey, name: snapshot.label || sourceVariable.name || 'Snapshot' };
      const entry = { name: variable.name, data: snapshot.data };
      const baseSkin = document.skins?.[snapshot.sourceVariableId] || {};
      const skin = {
        ...baseSkin,
        options: { ...(baseSkin.options || {}), ...(snapshot.rendererOptions || {}) }
      };
      const rendererName = snapshot.renderer
        || skin.renderer || variable.kind || entry.data?.kind || 'object';
      const renderer = renderers.get(rendererName) || renderers.get(entry.data?.kind) || renderObject;
      const sourceFrame = snapshot.sourceFrameId
        ? document.frames?.find(item => item.id === snapshot.sourceFrameId)
        : null;
      const snapshotStyleFrame = sourceFrame && Array.isArray(snapshot.styles)
        ? { ...sourceFrame, events: [], styles: snapshot.styles }
        : null;
      const snapshotAllHighlights = snapshotStyleFrame
        ? window.ASMTraceRules.evaluate({ ...document, rules: [] }, snapshotStyleFrame)
        : {};
      const snapshotHighlights = snapshotAllHighlights[snapshot.sourceVariableId] || {};
      const snapshotRenderFrame = snapshotStyleFrame || sourceFrame || frame;
      const position = snapshotStudioPosition(document, frame, snapshot);
      const baseX = position.x;
      const baseY = position.absolute ? position.y : y + position.y;
      const object = markSelectable(svg('g', {
        id: `${options.idPrefix || 'trace'}-${safeKey(objectKey)}`,
        class: 'asm-trace-object asm-trace-snapshot',
        transform: `translate(${baseX}, ${baseY})`,
        'data-base-offset': `${baseX},${baseY}`,
        'data-translate': '0,0',
        'data-trace-variable': objectKey,
        'data-trace-snapshot': snapshotId,
        'data-trace-scene-generation': String(snapshot.sceneGeneration ?? 0),
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
        highlights: snapshotHighlights, diff: [],
        document, frame: snapshotRenderFrame, allHighlights: snapshotAllHighlights,
        idPrefix: `${options.idPrefix || 'trace'}-${safeKey(objectKey)}`, interactive: options.interactive
      });
      removeScalarIndexLabels(content, variable, rendererName);
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
        }, variable.name), `${objectKey}:label`, options, objectKey));
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
      if (!snapshot.layoutId) {
        keepNodes.push({
          snapshotId: objectKey,
          variableId: snapshot.sourceVariableId,
          runtimeIdentity: snapshotRuntimeIdentity(document, snapshot),
          relative: {
            x: contentBox.x - box.x,
            y: contentBox.y - box.y,
            width: contentBox.width,
            height: contentBox.height
          }
        });
        y += Math.max(76, Number(height) || 76) + KEEP_SNAPSHOT_GAP;
      }
    });
    return y;
  }

  function renderScene(rootSvg, parent, document, frame, previousFrame = null, options = {}) {
    const idPrefix = options.idPrefix || 'trace';
    const rootAttributes = { transform: options.transform == null ? 'translate(90, 80)' : options.transform };
    if (options.rootId) rootAttributes.id = options.rootId;
    const root = svg('g', rootAttributes);
    parent.append(root);
    const highlights = evaluateFrameHighlights(document, frame);
    const diff = window.ASMTraceModel.diffFrame(previousFrame, frame);
    const placements = new Map();
    const elements = new Map();
    const liveObjectKeys = [];
    const editingVisibility = window.document.body.classList.contains('asm-trace-studio-open');
    const visibilityStates = document.studio?.visibility?.[frame.id] || {};
    const hiddenVariables = new Set((document.studio?.objects || [])
      .filter(object => object.hideSource && object.sourceVariableId && studioObjectVisible(object, frame))
      .map(object => object.sourceVariableId));
    (frame.captureOnlyVariableIds || []).forEach(variableId => hiddenVariables.add(variableId));
    (frame.bindings || []).forEach(binding => {
      if (binding.mode !== 'index') return;
      const sourceVariableIds = binding.sourceVariableIds || [binding.sourceVariableId];
      sourceVariableIds.filter(Boolean).forEach(variableId => hiddenVariables.add(variableId));
    });
    const keepNodes = [];
    let y = renderSnapshots(
      root,
      document,
      frame,
      Number(options.initialY) || 0,
      placements,
      elements,
      options,
      keepNodes
    );
    Object.entries(document.variables || {}).forEach(([variableId, variable]) => {
      const entry = frame.state?.[variableId];
      const objectKey = objectKeyForVariable(frame, variableId);
      if (!entry || hiddenVariables.has(variableId)
        || (!editingVisibility && visibilityStates[objectKey] === 'hidden')) return;
      const baseSkin = document.skins?.[variableId] || {};
      const frameOptions = frame.rendererOptions?.[variableId] || {};
      const skin = {
        ...baseSkin,
        options: { ...(baseSkin.options || {}), ...frameOptions }
      };
      const rendererName = frame.renderers?.[variableId]
        || skin.renderer || variable.kind || entry.data?.kind || 'object';
      const renderer = renderers.get(rendererName) || renderers.get(entry.data?.kind) || renderObject;
      const lifecycleKind = ['sequence', 'matrix', 'stack', 'queue'].includes(
        String(variable.kind || entry.data?.kind || '')
      ) ? 'array' : 'object';
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
        'data-trace-object-id': objectKey,
        'data-trace-lifecycle-kind': lifecycleKind,
        'data-trace-runtime-lifetime': entry.lifetime || '',
        'data-trace-runtime-identity': ['sequence', 'matrix', 'map', 'set', 'object'].includes(entry.data?.kind)
          ? runtimeIdentityToken(entry.identity, objectKey)
          : ['scalar', 'string'].includes(entry.data?.kind) && (entry.lifetime || entry.identity)
            ? runtimeIdentityToken(entry.lifetime || entry.identity, objectKey)
            : ''
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
        document, frame, allHighlights: highlights,
        idPrefix: `${idPrefix}-original`, interactive: options.interactive
      });
      removeScalarIndexLabels(content, variable, rendererName);
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
      liveObjectKeys.push(objectKey);
      collectElementPlacements(motion, baseX, baseY, placements, elements);
      y += Math.max(76, Number(height) || 76) + 28;
    });
    applyDefaultLiveObjectPlacement(document, frame, placements, elements, liveObjectKeys, options.initialY);
    // Resolve frame/keep/Studio object placement before drawing anything that
    // is anchored to those objects. Otherwise @text, segments, arrows, and
    // automatic markers read the pre-offset coordinates from placements.
    applyBindings(document, frame, placements, elements);
    applyRecursionLayouts(rootSvg, root, document, frame, placements, elements, options);
    renderFrameSegments(root, document, frame, placements, elements, options);
    y = renderFrameTexts(root, document, frame, y, placements, elements, options);
    y = renderDecorations(root, document, frame, y, placements, elements, options);
    renderStudioObjects(root, document, frame, placements, elements, options);
    applySemanticTextBindings(document, frame, placements, elements);
    renderFrameBindings(root, document, frame, placements, elements, options);
    renderStudioArrows(rootSvg, root, document, frame, placements, elements, options);
    renderDirectiveArrows(rootSvg, root, document, frame, placements, elements, options);
    applyStoredPartPositions(document, frame, placements, elements);
    applyBindings(document, frame, placements, elements);
    // Studio positions and semantic bindings may move recursion nodes after
    // their automatic layout. Resolve the parent/child edges only now so the
    // arrowhead lands on the child's final outerframe top/side anchor.
    renderRecursionLayoutEdges(rootSvg, root, document, frame, placements, elements, options);
    renderKeepLastArrows(rootSvg, root, document, frame, placements, elements, keepNodes, options);
    const sceneGeneration = String(Number(frame.sceneGeneration) || 0);
    root.dataset.traceSceneGeneration = sceneGeneration;
    elements.forEach(element => {
      if (!element?.dataset) return;
      const retained = Boolean(element.dataset.traceSnapshot
        || element.dataset.traceSnapshotOwner
        || element.closest?.('[data-trace-snapshot]'));
      if (retained && !options.snapshotOwner) return;
      element.dataset.traceSceneGeneration = sceneGeneration;
    });
    applyObjectColorStyles(document, frame, elements);
    applyVisibilityStates(document, frame, elements);
    if (options.interactive !== false) {
      window.ASMTraceFrameTween?.updateEventAvailability?.(
        document, frame, placements, elements, options.availabilityPreviousObjects ?? null
      );
    }
    applyCompletedScopeExits(frame, elements, options.deferLifecycleEvents === true);
    const textLayer = root.querySelector(':scope > .asm-trace-text-layer');
    if (textLayer) root.append(textLayer);
    const transitionEventFrame = Number(options.direction) < 0 && previousFrame ? previousFrame : frame;
    const eventAnimationsEnabled = options.interactive !== false && options.animateEvents !== false;
    animateSwapEvents(document, transitionEventFrame, placements, elements,
      eventAnimationsEnabled && options.animatePositions !== false);
    animateEventTargets(document, transitionEventFrame, placements, elements,
      eventAnimationsEnabled);
    animatePartPositions(placements, elements, options);
    settleArrowLayers(root);
    settleStyleLayer(root, elements);
    settleAnimationEffectLayer(root);
    settlePointerLayer(root);
    refreshPresentedArrows(root, elements);
    return { root, placements, elements, height: y };
  }

  function renderFrame(document, frame, previousFrame = null, options = {}) {
    const rootSvg = document && window.document.getElementById('arraySvg');
    if (!rootSvg || !frame) return Promise.resolve();
    window.ASMTraceFrameTween?.cancel?.();
    const previousPositions = objectPositions(rootSvg);
    const previousMotionPositions = objectMotionPositions(rootSvg, previousPositions);
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
      animateEvents: useFrameTween ? false : options.animateEvents !== false,
      deferLifecycleEvents: useFrameTween,
      // Use the same current/previous visual pair for the initial inspector
      // status and the playback timeline so diagnostic colors do not flicker.
      availabilityPreviousObjects: previousFrame ? previousObjects : null
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
        previousPlacements: previousMotionPositions,
        currentPlacements: result.placements,
        previousObjects,
        currentElements: result.elements,
        transitionForKey,
        duration: defaults.duration,
        initialDelayMs: options.initialDelayMs,
        cameraTransitionDurationMs: options.cameraTransitionDurationMs
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
    refreshPresentedArrows(result.root, result.elements);
    const playbackPlan = transition?.playbackPlan || null;
    transition = Promise.resolve(transition).then(() => {
      if (currentScene?.frame?.id === frame.id) revealDelayedFixedMarks(delayedMarks);
    });
    if (playbackPlan) transition.playbackPlan = playbackPlan;
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
    return window.ASMTraceCamera.ruleForFrame(document, frame);
  }

  function mainCameraSize(includeCodeInset = true) {
    const canvas = window.document.getElementById('arraySvg');
    const rect = canvas?.getBoundingClientRect?.();
    const width = Number(rect?.width) || canvas?.clientWidth || 800;
    const height = Number(rect?.height) || canvas?.clientHeight || 450;
    return {
      width,
      height,
      aspect: width / Math.max(1, height),
      asmSafeInsetLeft: includeCodeInset
        ? Number(window.ASMTraceCodePresenter?.safeInsetLeft?.()) || 0
        : 0
    };
  }

  function autoCameraView(bounds, zoom = 0.92, offsetX = 0, offsetY = 0, includeCodeInset = true) {
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return null;
    const canvas = mainCameraSize(includeCodeInset);
    const sharedTarget = window.resolveAutoCameraTarget?.(bounds, zoom, offsetX, offsetY, canvas);
    if (sharedTarget) return sharedTarget;
    const padding = window.getAutoCameraPadding?.() || { horizontal: 30, vertical: 20 };
    const paddingX = Number(padding.horizontal) || 30;
    const paddingY = Number(padding.vertical) || 20;
    const availableWidth = Math.max(1, canvas.width - paddingX * 2);
    const availableHeight = Math.max(1, canvas.height - paddingY * 2);
    const maximumFitScale = Math.min(
      availableWidth / bounds.width,
      availableHeight / bounds.height
    );
    const preferredScale = Math.max(0.05, Number(zoom) || 0.92);
    const targetScale = preferredScale <= maximumFitScale + 0.0001
      ? preferredScale
      : Math.max(0.05, Math.min(4, maximumFitScale));
    return {
      centerX: (bounds.left + bounds.right) / 2 + (Number(offsetX) || 0),
      centerY: (bounds.top + bounds.bottom) / 2 + (Number(offsetY) || 0),
      width: canvas.width / targetScale,
      height: canvas.height / targetScale,
      scale: targetScale,
      paddingX,
      paddingY
    };
  }

  function cameraViewForScene(document, frame, placements, boundsOverride = null, elements = null) {
    const bounds = boundsOverride || boundsFromPlacements(placements);
    if (!bounds) return null;
    const rule = cameraRuleForFrame(document, frame);
    if (rule?.manualFrame && Number.isFinite(Number(rule.centerX)) && Number.isFinite(Number(rule.centerY))) {
      const cameraTargetKey = cameraObjectKey(rule.binding?.targetKey);
      const boundPoint = cameraTargetKey
        ? anchorPoint(cameraTargetKey === 'keep'
          ? (elements
            ? keepAnchorPlacement(document, frame, placements, elements)
            : keepUnionPlacement(document, frame, placements))
          : elements
            ? semanticTargetPlacement(cameraTargetKey, placements, elements)
            : placements?.get?.(cameraTargetKey), rule.binding.targetAnchor || 'center')
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
    const focus = rule?.target
      ? resolveAnchor(document, frame, rule.target, placements, elements)
      : null;
    if (rule?.autoCapture === false && focus) {
      const zoom = Math.max(0.05, Number(rule.zoom) || 0.92);
      const canvas = mainCameraSize(false);
      return {
        centerX: focus.x + (Number(rule.offsetX) || 0),
        centerY: focus.y + (Number(rule.offsetY) || 0),
        width: canvas.width / zoom,
        height: canvas.height / zoom
      };
    }
    const followX = focus ? focus.x - (bounds.left + bounds.right) / 2 : 0;
    const followY = focus ? focus.y - (bounds.top + bounds.bottom) / 2 : 0;
    return autoCameraView(
      bounds,
      Number(rule?.zoom) || 0.92,
      (Number(rule?.offsetX) || 0) + followX,
      (Number(rule?.offsetY) || 0) + followY,
      false
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
    setThumbnailCameraView(thumbnail, cameraViewForScene(
      document, frame, result.placements, null, result.elements
    ));
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
      return anchorPoint(
        semanticTargetPlacement(key, result.placements, result.elements),
        anchor
      );
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
  register('original-matrix', renderOriginalMatrix);
  register('original-cell', renderOriginal);
  register('original-heap', renderOriginal);
  register('original-segment-tree', renderOriginal);
  register('original-bit', renderOriginal);
  register('original-disk', renderOriginal);
  register('original-stack', renderOriginal);
  register('original-queue', renderOriginal);

  function currentAnchor(target) {
    if (!currentScene) return null;
    const point = resolveAnchor(
      currentScene.document,
      currentScene.frame,
      target,
      currentScene.placements,
      currentScene.elements
    );
    return point ? { x: point.x + currentScene.rootOffset.x, y: point.y + currentScene.rootOffset.y } : null;
  }

  function currentBounds(options = {}) {
    if (!currentScene?.placements?.size) return null;
    const snapshotsById = new Map((currentScene.document?.snapshots || []).map(snapshot => [snapshot.id, snapshot]));
    const snapshotIds = new Set((currentScene.frame?.snapshotIds || []).map(id => (
      snapshotObjectKey(snapshotsById.get(id)) || id
    )));
    const boxes = [...currentScene.placements.entries()]
      .filter(([key]) => currentScene.elements.has(key))
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

  function fitCurrentObjectsCamera(
    zoom = 0.92,
    animate = true,
    duration = 520,
    offsetX = 0,
    offsetY = 0,
    includeSnapshots = true
  ) {
    const bounds = currentBounds({ includeSnapshots });
    // Code belongs to a separate presentation layer; object auto capture must
    // not reserve a large blank inset for the HTML code panel.
    const view = autoCameraView(bounds, zoom, offsetX, offsetY, false);
    if (!view) return null;
    const scale = Number(view.scale) || window.cameraScaleForViewportWidth?.(view.width);
    if (!Number.isFinite(Number(scale))) return null;
    window.setCamera?.(view.centerX, view.centerY, Number(scale), animate, duration);
    return { ...view, scale: Number(scale) };
  }

  function currentPlacement(key, viewportCoordinates = true) {
    const placement = key === 'keep' || key === '$keep'
      ? keepUnionPlacement(currentScene?.document, currentScene?.frame, currentScene?.placements || new Map())
      : currentScene?.placements?.get(key);
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
    if (!currentScene) return null;
    const placement = key === 'keep' || key === '$keep'
      ? keepAnchorPlacement(
        currentScene.document,
        currentScene.frame,
        currentScene.placements,
        currentScene.elements
      )
      : semanticTargetPlacement(key, currentScene.placements, currentScene.elements);
    if (!placement) return null;
    const offset = viewportCoordinates ? currentScene.rootOffset : { x: 0, y: 0 };
    return anchorPoint({
      ...placement,
      x: placement.x + offset.x,
      y: placement.y + offset.y
    }, anchor);
  }

  function currentObjectKeys() {
    return currentScene?.placements
      ? [...currentScene.placements.keys()].filter(key => (
        !currentScene.elements?.get?.(key)?.dataset?.traceInternalStyle
      ))
      : [];
  }

  function currentArrowTargets() {
    if (!currentScene?.elements) return [];
    const targets = [];
    const seen = new Set();
    currentScene.elements.forEach((element, fallbackKey) => {
      if (element?.dataset?.traceArrowTarget !== '1') return;
      const key = element.dataset.traceArrowTargetKey || fallbackKey;
      if (!key || seen.has(key) || !currentScene.placements.has(fallbackKey)) return;
      seen.add(key);
      targets.push({
        key,
        label: element.dataset.traceArrowTargetLabel || key,
        kind: element.dataset.traceArrowTargetKind || 'object',
        objectKey: element.dataset.traceArrowTargetObject || '',
        indices: String(element.dataset.traceArrowTargetIndices || '')
          .split(',').filter(Boolean).map(Number),
        anchors: ['top-left', 'top', 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom', 'bottom-right']
      });
    });
    return targets.sort((left, right) => left.label.localeCompare(right.label, undefined, { numeric: true }));
  }

  function cameraObjectKey(key) {
    return String(key || '').split('#')[0].replace(/:(?:label|index)$/, '');
  }

  document.documentElement.dataset.asmTraceRendererBuild = 'trace-212';
  window.ASMTraceRenderers = {
    build: 'trace-212', updatePresentedHints, evaluateFrameHighlights, applyFixedEventStyles,
    register, renderFrame, createThumbnail, fitThumbnail, fitThumbnails,
    displayValue, formatDisplayValue, settlePointerLayer,
    resolveAnchor, currentAnchor, currentBounds, fitCurrentObjectsCamera,
    currentPlacement, currentAnchorForKey, currentObjectKeys, currentArrowTargets, cameraObjectKey, frameAnchorForKey, anchorPoint,
    refreshThumbnailCamera, showMainCameraFrameInThumbnail, keepUnionPlacement,
    runtimeIdentityToken, recursionLayoutCoordinates, recursionLayoutEdgePoints,
    defaultLiveObjectPlacementDelta, shiftPlacementTree, semanticTargetPlacement,
    keepAnchorPlacement,
    recursionOuterframePlacement,
    attachStyleVisual: (visual, cell, kind) => {
      const root = cell?.closest?.('#asm-trace-root');
      const attached = attachStyleVisual(root, visual, cell, kind);
      if (attached) refreshPresentedStyles(root);
      return attached;
    },
    refreshArrows: () => {
      const root = window.document.getElementById('asm-trace-root');
      refreshPresentedStyles(root);
      refreshPresentedArrows(root, currentScene?.elements || new Map());
    }
  };
})();
