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
    if (kind === 'pair' || kind === 'tuple') {
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

  function defaultRenderer(variable = {}) {
    if (variable.kind === 'matrix') return 'original-matrix';
    if (variable.kind === 'stack') return 'original-stack';
    if (variable.kind === 'queue') return 'original-queue';
    if (['sequence', 'set', 'map'].includes(variable.kind)) return 'original-array';
    if (['scalar', 'string'].includes(variable.kind)) return 'original-cell';
    if (variable.kind === 'node-graph') return 'graph';
    if (variable.kind === 'coordinate-system') return 'coordinate-system';
    return 'object';
  }

  function canonicalRenderer(renderer, variable = {}) {
    const legacy = {
      array: 'original-array',
      sequence: 'original-array',
      matrix: 'original-matrix',
      scalar: 'original-cell',
      string: 'original-cell',
      stack: 'original-stack',
      queue: 'original-queue'
    };
    return legacy[renderer] || renderer || defaultRenderer(variable);
  }

  function normalizeSkins(variables, sourceSkins) {
    const skins = sourceSkins && typeof sourceSkins === 'object' ? clone(sourceSkins) : {};
    Object.entries(variables || {}).forEach(([variableId, variable]) => {
      const skin = skins[variableId] && typeof skins[variableId] === 'object'
        ? skins[variableId]
        : {};
      skins[variableId] = {
        ...skin,
        renderer: canonicalRenderer(skin.renderer, variable),
        options: skin.options && typeof skin.options === 'object' ? skin.options : {}
      };
    });
    return skins;
  }

  function applyFrameConditions(document) {
    if (!window.ASMTraceRules?.expressionMatches) return document;
    const accepted = [];
    let pendingEvents = [];
    (document.frames || []).forEach(frame => {
      const events = [...pendingEvents, ...(frame.events || [])]
        .sort((left, right) => Number(left?.order) - Number(right?.order));
      const candidate = { ...frame, events };
      const evaluationDocument = {
        ...document,
        iterationSummaries: document.iterationSummaries,
        frames: [...accepted, candidate]
      };
      if (window.ASMTraceRules.expressionMatches(
        evaluationDocument,
        candidate,
        candidate.source?.when
      )) {
        accepted.push(candidate);
        pendingEvents = [];
      } else {
        pendingEvents = events;
      }
    });
    document.frames = accepted;
    return document;
  }

  function iterationActivationKey(frame) {
    const source = frame?.source || {};
    return String(source.recursionActivationId
      || `${source.function || ''}:${source.recursionParentActivationId || ''}`);
  }

  function buildIterationSummaries(document) {
    const frames = document?.frames || [];
    const summaries = Object.fromEntries(frames.map(frame => [String(frame.id || ''), {
      last: {},
      details: {}
    }]));
    const contextFrames = new Map();
    const groups = new Map();

    frames.forEach((frame, frameIndex) => {
      const activation = iterationActivationKey(frame);
      if (!contextFrames.has(activation)) contextFrames.set(activation, []);
      contextFrames.get(activation).push(frameIndex);
      Object.entries(frame.state || {}).forEach(([variableId, entry]) => {
        const name = String(entry?.name || document?.variables?.[variableId]?.name || '');
        if (!name) return;
        const value = scalarValue(entry?.data);
        if (value != null && typeof value === 'object') return;
        const lifetime = String(entry?.lifetime || '');
        const contextName = `${activation}\u0000${name}`;
        const groupKey = `${contextName}\u0000${variableId}\u0000${lifetime || variableId}`;
        if (!groups.has(groupKey)) {
          groups.set(groupKey, {
            activation, name, variableId, lifetime,
            declarationLine: Number(document?.variables?.[variableId]?.line) || 0,
            first: frameIndex, last: frameIndex, lastValue: value
          });
        } else {
          const group = groups.get(groupKey);
          group.first = Math.min(group.first, frameIndex);
          group.last = Math.max(group.last, frameIndex);
          group.lastValue = value;
        }
      });
    });

    // A conditional @frame may capture no state inside a later loop lifetime.
    // Recover just those uncaptured lifetimes from existing scalar events.
    // Keep snapshot-based values for captured lifetimes (including "last body
    // index" rather than the terminal i++ value).
    const activeEventGroups = new Map();
    frames.forEach((frame, frameIndex) => {
      const activation = iterationActivationKey(frame);
      [...(frame.events || [])].sort((a,b) => Number(a.order)-Number(b.order)).forEach(event => {
        const target = (event.targets || []).find(target => target.role === 'target');
        const variableId = target?.variableId;
        const variable = document.variables?.[variableId];
        if (!variableId || !variable || !['scalar', 'string'].includes(variable.kind)
          || target.indexExpression) return;
        if (variable.functionName && frame.source?.function
          && variable.functionName !== frame.source.function) return;
        const activeKey = `${activation}\u0000${variableId}`;
        if (event.type === 'declare') {
          const lifetime = String(target.lifetimeIdentity || '');
          const key = `${activation}\u0000${variable.name}\u0000${variableId}\u0000${lifetime || variableId}`;
          if (!groups.has(key)) {
            groups.set(key, { activation, name: variable.name, variableId, lifetime,
              declarationLine: Number(variable.line) || 0,
              first: frameIndex, last: frameIndex,
              lastValue: scalarValue(event.payload?.value), eventOnly: true });
          }
          activeEventGroups.set(activeKey, groups.get(key));
        }
        const group = activeEventGroups.get(activeKey);
        if (!group?.eventOnly) return;
        group.last = frameIndex;
        if (['assign','write'].includes(event.type) && event.payload?.after) {
          const value = scalarValue(event.loopBoundary ? event.payload.before : event.payload.after);
          if (value != null && typeof value !== 'object') group.lastValue = value;
        }
        if (event.type === 'scope-exit') activeEventGroups.delete(activeKey);
      });
    });

    const groupsByContextName = new Map();
    groups.forEach(group => {
      const key = `${group.activation}\u0000${group.name}`;
      if (!groupsByContextName.has(key)) groupsByContextName.set(key, []);
      groupsByContextName.get(key).push(group);
    });
    groupsByContextName.forEach((candidates, contextName) => {
      candidates.sort((left, right) => left.first - right.first || left.last - right.last);
      const separator = contextName.indexOf('\u0000');
      const activation = contextName.slice(0, separator);
      const name = contextName.slice(separator + 1);
      (contextFrames.get(activation) || []).forEach(frameIndex => {
        const frame = frames[frameIndex];
        const active = candidates.find(group => {
          const entry = frame.state?.[group.variableId];
          if (!entry) return false;
          return !group.lifetime || String(entry.lifetime || '') === group.lifetime;
        });
        const upcoming = candidates.find(group => group.first >= frameIndex);
        const previous = [...candidates].reverse().find(group => group.last <= frameIndex);
        const frameLine = Number(frame?.source?.line) || 0;
        const declarationLine = Number((upcoming || previous)?.declarationLine) || 0;
        // A frame located before the declaration belongs to the upcoming loop
        // lifetime. A frame located after the loop belongs to the lifetime that
        // just completed, even if another iteration will declare the same name.
        const selected = active
          || ((frameLine && declarationLine && frameLine < declarationLine)
            ? (upcoming || previous)
            : (previous || upcoming));
        if (!selected) return;
        const summary = summaries[String(frame.id || '')];
        summary.last[name] = selected.lastValue;
        summary.details[name] = {
          variableId: selected.variableId,
          lifetime: selected.lifetime,
          firstFrameId: String(frames[selected.first]?.id || ''),
          lastFrameId: String(frames[selected.last]?.id || '')
        };
      });
    });
    return summaries;
  }

  function normalizeTraceDocument(source = {}) {
    const variables = source.variables && typeof source.variables === 'object' ? clone(source.variables) : {};
    const frames = Array.isArray(source.frames) ? source.frames.map((frame, index) => ({
      id: frame.id || `frame-${index}`,
      sceneGeneration: Number.isFinite(Number(frame.sceneGeneration))
        ? Number(frame.sceneGeneration)
        : 0,
      source: frame.source && typeof frame.source === 'object' ? clone(frame.source) : {},
      state: Object.fromEntries(Object.entries(frame.state || {}).map(([id, entry]) => [id, {
        name: entry?.name || variables[id]?.name || id,
        identity: String(entry?.identity || ''),
        lifetime: String(entry?.lifetime || ''),
        data: normalizeData(entry?.data)
      }])),
      events: Array.isArray(frame.events) ? clone(frame.events) : [],
      bindings: Array.isArray(frame.bindings) ? clone(frame.bindings) : [],
      objectBindings: Array.isArray(frame.objectBindings) ? clone(frame.objectBindings) : [],
      renderers: frame.renderers && typeof frame.renderers === 'object' ? clone(frame.renderers) : {},
      rendererOptions: frame.rendererOptions && typeof frame.rendererOptions === 'object'
        ? clone(frame.rendererOptions)
        : {},
      captureOnlyVariableIds: Array.isArray(frame.captureOnlyVariableIds)
        ? clone(frame.captureOnlyVariableIds)
        : [],
      texts: Array.isArray(frame.texts) ? clone(frame.texts) : [],
      styles: Array.isArray(frame.styles) ? clone(frame.styles) : [],
      segments: Array.isArray(frame.segments) ? clone(frame.segments) : [],
      arrows: Array.isArray(frame.arrows) ? clone(frame.arrows) : [],
      eventControls: Array.isArray(frame.eventControls) ? clone(frame.eventControls) : [],
      autoMarkVariableIds: Array.isArray(frame.autoMarkVariableIds) ? clone(frame.autoMarkVariableIds) : null,
      camera: frame.camera && typeof frame.camera === 'object' ? clone(frame.camera) : null,
      snapshotIds: Array.isArray(frame.snapshotIds) ? clone(frame.snapshotIds) : [],
      keepLastFocus: frame.keepLastFocus === true
    })) : [];
    const normalized = {
      schemaVersion: source.schemaVersion || '1.0',
      generatedAt: source.generatedAt || '',
      loopRecords: Array.isArray(source.loopRecords) ? clone(source.loopRecords) : [],
      sourceCode: typeof source.sourceCode === 'string' ? source.sourceCode : '',
      sourceDeclarations: Array.isArray(source.sourceDeclarations) ? clone(source.sourceDeclarations) : [],
      sourceStructure: Array.isArray(source.sourceStructure) ? clone(source.sourceStructure) : [],
      provenance: source.provenance && typeof source.provenance === 'object' ? clone(source.provenance) : null,
      sliceMode: source.sliceMode === 'manual' ? 'manual' : source.sliceMode === 'full' ? 'full' : 'auto',
      variables,
      frames,
      snapshots: Array.isArray(source.snapshots) ? source.snapshots.map(snapshot => ({
        ...clone(snapshot),
        data: normalizeData(snapshot?.data)
      })) : [],
      layouts: Array.isArray(source.layouts) ? clone(source.layouts) : [],
      skins: source.skins && typeof source.skins === 'object' ? clone(source.skins) : {},
      rules: Array.isArray(source.rules) ? clone(source.rules) : [],
      frameDirectives: Array.isArray(source.frameDirectives) ? clone(source.frameDirectives) : [],
      studio: source.studio && typeof source.studio === 'object' ? clone(source.studio) : {},
      asmView: source.asmView && typeof source.asmView === 'object' ? clone(source.asmView) : null
    };
    window.ASMTraceEvents?.rebuildLoopBoundaryEvents?.(normalized);
    Object.defineProperty(normalized, 'iterationSummaries', {
      value: buildIterationSummaries(normalized),
      writable: true,
      configurable: true,
      enumerable: false
    });
    if (!source.viewSettingsApplied && normalized.asmView && window.ASMTraceViewSource?.applyToTrace) {
      window.ASMTraceViewSource.applyToTrace(normalized, normalized.asmView);
    }
    // Saved slide animations intentionally omit default skins. Rehydrate them
    // in the shared model so editor, Studio, and slide runtime select the same
    // original renderer instead of falling back to the raw data kind.
    normalized.skins = normalizeSkins(normalized.variables, normalized.skins);
    normalized.viewSettingsApplied = Boolean(source.viewSettingsApplied
      || (normalized.asmView && window.ASMTraceViewSource?.applyToTrace));
    applyFrameConditions(normalized);
    window.ASMTraceEvents?.rebuildAutoFixedEvents?.(normalized);
    window.ASMTraceEvents?.applyEnabledStates?.(normalized);
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

  function loopSamples(document, frame, batch) {
    const records = document.loopRecords || [];
    const context = frame.source?.loopContext || [];
    const active = context.find(item => item.loopId === batch.loopId);
    const parents = batch.parentLoopIds || [];
    const activation = frame.source?.recursionActivationId || '';
    const candidates = records.filter(record => record.phase === 'start' && record.loopId === batch.loopId
      && (record.recursionActivationId || '') === activation
      && parents.every(id => {
        const left = context.find(item => item.loopId === id);
        const right = record.loopContext?.find(item => item.loopId === id);
        return left && right && left.instanceId === right.instanceId && left.ordinal === right.ordinal;
      }));
    const position = frame.source?.tracePosition;
    const selected = active ? candidates.find(record => record.instanceId === active.instanceId)
      : batch.position === 'before' ? candidates.find(record => record.position > position)
      : candidates.filter(record => record.position < position).at(-1);
    if (!selected) throw new Error(`第 ${batch.line || '?'} 行的 @arrow for 無法對應目前回合的迴圈；請將幀放在該迴圈所在的外層回合內`);
    return records.filter(record => record.phase === 'entry' && record.instanceId === selected.instanceId).map(record => {
      const value = scalarValue(record.values?.[batch.variable]);
      if (!Number.isSafeInteger(value)) throw new Error(`@arrow for ${batch.variable} 的本體入口值必須是安全整數`);
      return { value, ordinal: record.ordinal, instanceId: selected.instanceId };
    });
  }

  function drawingDirectives(document, frame, field) {
    const output = [];
    for (const item of frame?.[field] || []) {
      if (!item.drawLoops?.length) { output.push(item); continue; }
      const fail = message => { throw new Error(`第 ${item.line || '?'} 行的 @for ${message}`); };
      let contexts = [{ locals: {}, path: '', rolePath: '' }];
      for (const scope of item.drawLoops) {
        const next = [];
        for (const context of contexts) {
          let samples;
          if (scope.kind === 'loop') samples = loopSamples(document, frame, scope);
          else {
            const values = [scope.startExpression, scope.endExpression, scope.stepExpression || '1']
              .map(expression => window.ASMTraceRules.resolveExpression(document, frame, expression, context.locals));
            if (values.some(value => !Number.isSafeInteger(value)) || !values[2]) fail('範圍與步長必須為安全整數，且 step 不可為零');
            const [start, end, step] = values;
            const count = step > 0 && start > end || step < 0 && start < end ? 0 : Math.floor((end - start) / step) + 1;
            if (!Number.isSafeInteger(count) || count > 2048) fail('展開數量超過 2048 次');
            samples = Array.from({ length: count }, (_, ordinal) => ({ value: start + ordinal * step }));
          }
          if (samples.length + next.length > 2048) fail('展開數量超過 2048 次');
          for (const sample of samples) next.push({ locals: { ...context.locals, [scope.variable]: sample.value },
            path: context.path + `/${scope.id}~${sample.instanceId || ''}[${sample.instanceId ? sample.ordinal : sample.value}]`,
            // An arrow's visual slot persists across invocations of the same
            // source loop. Runtime instance IDs identify data, not arrow roles.
            rolePath: context.rolePath + `/${scope.id}~${scope.loopId || ''}[${sample.instanceId ? sample.ordinal : sample.value}]` });
        }
        contexts = next;
      }
      for (const { locals, path, rolePath } of contexts) {
        const resolveIndices = endpoint => {
          if (!endpoint) return endpoint;
          const expressions = endpoint.indexExpressions || (endpoint.indexExpression ? [endpoint.indexExpression] : []);
          const values = expressions.map(expression => window.ASMTraceRules.resolveExpression(document, frame, expression, locals));
          if (values.some(value => !Number.isSafeInteger(value))) fail('端點索引無法解析為安全整數');
          return { ...endpoint, indexExpressions: values.map(String), indexExpression: values.join(',') };
        };
        const expanded = { ...item, id: `${item.id}@${field === 'arrows' ? rolePath : path}`, drawLoops: [], drawLocals: locals,
          drawCandidateCount: contexts.length, drawSourceId: item.id };
        if (field === 'texts') {
          if (!window.ASMTraceRules.textExpressionMatches(document, frame, item.when, locals)) continue;
          expanded.binding = resolveIndices(item.binding);
        }
        if (field === 'arrows' && !item.batch) {
          if (!window.ASMTraceRules.expressionMatches(document, frame, item.when, locals)) continue;
          expanded.from = resolveIndices(item.from); expanded.to = resolveIndices(item.to); expanded.when = null;
        }
        output.push(expanded);
      }
    }
    return output;
  }

  window.ASMTraceModel = {
    drawingDirectives,
    loopSamples,
    clone,
    normalizeData,
    defaultRenderer,
    canonicalRenderer,
    normalizeSkins,
    applyFrameConditions,
    buildIterationSummaries,
    normalizeTraceDocument,
    scalarValue,
    diffFrame
  };
})();
