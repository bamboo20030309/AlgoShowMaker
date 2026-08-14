(function () {
  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function normalizeData(data) {
    if (!data || typeof data !== 'object') return { kind: 'scalar', value: data ?? null };
    const kind = typeof data.kind === 'string' ? data.kind : 'object';
    if (['sequence', 'matrix', 'stack', 'queue', 'set'].includes(kind)) {
      return { ...data, kind, items: Array.isArray(data.items) ? data.items.map(normalizeData) : [] };
    }
    if (kind === 'map') {
      return {
        ...data,
        entries: Array.isArray(data.entries)
          ? data.entries.map(entry => ({ key: normalizeData(entry.key), value: normalizeData(entry.value) }))
          : []
      };
    }
    if (kind === 'node-graph') {
      return {
        ...data,
        nodes: data.nodes && typeof data.nodes === 'object' ? clone(data.nodes) : {},
        edges: Array.isArray(data.edges) ? clone(data.edges) : []
      };
    }
    if (kind === 'coordinate-system') {
      return { ...data, points: Array.isArray(data.points) ? clone(data.points) : [] };
    }
    return clone(data);
  }

  function normalizeTraceDocument(source = {}) {
    const variables = source.variables && typeof source.variables === 'object' ? clone(source.variables) : {};
    const frames = Array.isArray(source.frames) ? source.frames.map((frame, index) => ({
      id: frame.id || `frame-${index}`,
      source: frame.source && typeof frame.source === 'object' ? clone(frame.source) : {},
      state: Object.fromEntries(Object.entries(frame.state || {}).map(([id, entry]) => [id, {
        name: entry?.name || variables[id]?.name || id,
        data: normalizeData(entry?.data)
      }])),
      events: Array.isArray(frame.events) ? clone(frame.events) : [],
      bindings: Array.isArray(frame.bindings) ? clone(frame.bindings) : [],
      snapshotIds: Array.isArray(frame.snapshotIds) ? clone(frame.snapshotIds) : [],
      keepLastFocus: frame.keepLastFocus === true
    })) : [];
    const normalized = {
      schemaVersion: source.schemaVersion || '1.0',
      generatedAt: source.generatedAt || '',
      sliceMode: source.sliceMode === 'manual' ? 'manual' : source.sliceMode === 'full' ? 'full' : 'auto',
      variables,
      frames,
      snapshots: Array.isArray(source.snapshots) ? source.snapshots.map(snapshot => ({
        ...clone(snapshot),
        data: normalizeData(snapshot?.data)
      })) : [],
      skins: source.skins && typeof source.skins === 'object' ? clone(source.skins) : {},
      rules: Array.isArray(source.rules) ? clone(source.rules) : [],
      frameDirectives: Array.isArray(source.frameDirectives) ? clone(source.frameDirectives) : [],
      studio: source.studio && typeof source.studio === 'object' ? clone(source.studio) : {},
      asmView: source.asmView && typeof source.asmView === 'object' ? clone(source.asmView) : null
    };
    if (normalized.asmView && window.ASMTraceViewSource?.applyToTrace) {
      window.ASMTraceViewSource.applyToTrace(normalized, normalized.asmView);
    }
    return normalized;
  }

  function scalarValue(data) {
    if (!data || typeof data !== 'object') return data;
    if (Object.prototype.hasOwnProperty.call(data, 'value')) return data.value;
    return data;
  }

  function comparable(data) {
    return JSON.stringify(normalizeData(data));
  }

  function diffFrame(previous, current) {
    const changes = [];
    const ids = new Set([...Object.keys(previous?.state || {}), ...Object.keys(current?.state || {})]);
    ids.forEach(variableId => {
      const before = previous?.state?.[variableId]?.data;
      const after = current?.state?.[variableId]?.data;
      if (!before && after) {
        changes.push({ type: 'variable-add', variableId, after });
        return;
      }
      if (before && !after) {
        changes.push({ type: 'variable-remove', variableId, before });
        return;
      }
      if (comparable(before) === comparable(after)) return;
      const beforeItems = Array.isArray(before?.items) ? before.items : null;
      const afterItems = Array.isArray(after?.items) ? after.items : null;
      if (beforeItems && afterItems) {
        const count = Math.max(beforeItems.length, afterItems.length);
        for (let index = 0; index < count; index += 1) {
          if (index >= beforeItems.length) changes.push({ type: 'insert', variableId, index, after: afterItems[index] });
          else if (index >= afterItems.length) changes.push({ type: 'remove', variableId, index, before: beforeItems[index] });
          else if (comparable(beforeItems[index]) !== comparable(afterItems[index])) {
            changes.push({ type: 'update', variableId, index, before: beforeItems[index], after: afterItems[index] });
          }
        }
        return;
      }
      changes.push({ type: 'update', variableId, before, after });
    });
    return changes;
  }

  window.ASMTraceModel = {
    clone,
    normalizeData,
    normalizeTraceDocument,
    scalarValue,
    diffFrame
  };
})();
