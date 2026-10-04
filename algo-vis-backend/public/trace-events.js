/**
 * 模組：事件正規化與啟用狀態
 *
 * 責任：建立穩定事件 key、補建迴圈邊界與自動固定事件，並依文件設定計算實際啟用狀態。
 * 資料流：原始 frame events 先重建衍生事件，再套用帳號／文件設定與可用性；播放器只消費此處產生的一致 enabled/controlState。
 * 重要不變條件：事件 key 必須跨重新分析維持穩定；衍生事件可重建但不可重複，邊界快照的值須對應事件發生前後的正確 frame。
 * 相容性：舊文件沒有 instructionStates 或設定欄位時採既有預設；明確關閉的事件必須保留。
 */
(function () {
  const definitions = [
    { type: 'declare', label: '宣告／物件入場', color: '#25824d', enabledByDefault: true, timelineByDefault: true },
    { type: 'visual-enter', label: '物件入場', color: '#25824d', enabledByDefault: true, timelineByDefault: true },
    { type: 'object-exit', label: '物件退場／手動退場', color: '#7b5b45', enabledByDefault: true, timelineByDefault: true },
    // Reads remain internal access metadata for automatic fixed markers. They
    // are not a user-facing event, animation, timeline entry or Studio item.
    { type: 'read', label: '讀取', color: '#3976b8', internal: true, enabledByDefault: false, timelineByDefault: false },
    { type: 'compare', label: '比較', color: '#c38a16', enabledByDefault: true, timelineByDefault: true },
    { type: 'assignment', label: '賦值', color: '#c8483f', enabledByDefault: true, timelineByDefault: true },
    { type: 'swap', label: '交換', color: '#1d8f83', enabledByDefault: true, timelineByDefault: true },
    { type: 'sequence-operation', label: '陣列操作', color: '#286bb0', enabledByDefault: true, timelineByDefault: true },
    { type: 'output', label: '輸出', color: '#2f7d72', enabledByDefault: true, timelineByDefault: false },
    { type: 'control-flow', label: '流程跳轉', color: '#a86524', enabledByDefault: true, timelineByDefault: false },
    { type: 'call', label: '呼叫函式', color: '#65737a', enabledByDefault: false, timelineByDefault: false },
    // Whole-condition results are internal playback metadata. Comparisons are
    // the user-controllable events; this record only resolves final true/false
    // code coloring and must not appear as another event or setting.
    { type: 'condition', label: '條件', color: '#7b61a8', internal: true, enabledByDefault: false, timelineByDefault: false },
    { type: 'fixed', label: '自動固定', color: '#4caf50', category: 'state', enabledByDefault: true, timelineByDefault: false },
    // Paired with a call occurrence so recursive code presentation can retain
    // caller/callee state without exposing a second editable timeline event.
    { type: 'call-return', label: '函式呼叫返回', color: '#65737a', internal: true, enabledByDefault: false, timelineByDefault: false },
    { type: 'return-complete', label: '完成回傳', color: '#a86524', internal: true, enabledByDefault: false, timelineByDefault: false },
    { type: 'branch-enter', label: '進入遞迴分支', color: '#65737a', internal: true, enabledByDefault: false, timelineByDefault: false },
    { type: 'branch-exit', label: '離開遞迴分支', color: '#65737a', internal: true, enabledByDefault: false, timelineByDefault: false },
    { type: 'function-enter', label: '進入函式', color: '#59656b', enabledByDefault: false, timelineByDefault: false },
    { type: 'function-exit', label: '離開函式', color: '#59656b', enabledByDefault: false, timelineByDefault: false }
  ];
  const eventTypeAliases = Object.freeze({
    'scope-exit': 'object-exit',
    'visual-exit': 'object-exit',
    write: 'assignment',
    assign: 'assignment',
    return: 'control-flow',
    break: 'control-flow',
    continue: 'control-flow'
  });
  const canonicalEventType = type => eventTypeAliases[type] || type;
  const aliasedEventLabels = Object.freeze({
    'scope-exit': '作用域結束／物件退場',
    'visual-exit': '物件退場',
    write: '數值更新／複合賦值',
    assign: '直接／初始化賦值',
    return: '流程跳轉',
    break: '流程跳轉',
    continue: '流程跳轉'
  });
  const byType = Object.fromEntries(definitions.map(definition => [definition.type, definition]));
  const animations = Object.freeze({
    // Declaration and scope exit form one controllable visual lifetime. When
    // their switches are disabled the frame jumps directly to the resulting
    // visible/absent state without an entrance/exit animation.
    declare: 'declare',
    'visual-enter': 'declare',
    'object-exit': 'exit',
    read: 'none',
    assignment: 'assign',
    'sequence-operation': 'sequence',
    compare: 'compare',
    condition: 'none',
    swap: 'swap',
    fixed: 'none',
    call: 'code',
    output: 'code',
    'call-return': 'none',
    'control-flow': 'code',
    'return-complete': 'none',
    'branch-enter': 'none',
    'branch-exit': 'none',
    // Function entry is a code-only event. It highlights the function header
    // in playback order without inventing a canvas target animation.
    'function-enter': 'code',
    'function-exit': 'none'
  });
  // Availability is frame-specific, while saved instruction switches may apply
  // to many frames. Keep explicit user intent out of the serialized event data
  // so an unavailable occurrence does not permanently disable its instruction.
  const explicitEnabledStates = new WeakSet();
  // ---------------------------------------------------------------------------
  // 區段：事件身分與排序
  // ---------------------------------------------------------------------------
  function cloneValue(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function baseEventKey(event = {}) {
    if (event.signature) return String(event.signature);
    const targets = (event.targets || []).map(target => (
      `${target.role || ''}:${target.variableId || ''}:${target.expression || ''}:${target.indexExpression || ''}`
    )).join('|');
    return [event.type || 'event', event.line || '', event.operation || '', targets].join(':');
  }

  function eventKey(events, index) {
    const list = Array.isArray(events) ? events : [];
    const event = list[index] || {};
    const base = baseEventKey(event);
    let occurrence = 0;
    for (let cursor = 0; cursor < index; cursor += 1) {
      if (baseEventKey(list[cursor]) === base) occurrence += 1;
    }
    return `${base}::${occurrence}`;
  }

  function canonicalInstructionKey(value = '') {
    const signature = String(value || '');
    // Fixed-cell events use the declaration offset inside their variable ID.
    // That offset changes when unrelated source text is inserted, so remove it.
    const fixed = signature.match(/^fixed:(.+@\d+):(.*)$/s);
    if (fixed) return `fixed:${fixed[1].replace(/@\d+$/, '')}:${fixed[2]}`;
    // Runtime signatures historically contained the source line. A slide RUN,
    // formatting pass, or added comment can move the instruction without
    // changing its meaning. Keep old saved keys readable while using a stable
    // key for all new choices.
    const traced = signature.match(/^([^:]+):([^:]+):\d+:(.*)$/s);
    if (traced) return `${traced[1]}:${traced[2]}:${traced[3]}`;
    return signature;
  }

  function instructionKey(event = {}) {
    return canonicalInstructionKey(baseEventKey(event));
  }

  function instructionState(instructionStates, event) {
    const sourceKey = instructionKey(event);
    if (Object.prototype.hasOwnProperty.call(instructionStates, sourceKey)) {
      return { found: true, value: instructionStates[sourceKey] !== false };
    }
    let found = false;
    let value = false;
    // Prefer the last matching legacy key. JSON property order follows the
    // user's edit history, so newer line-number variants win over older ones.
    Object.entries(instructionStates).forEach(([savedKey, savedValue]) => {
      if (canonicalInstructionKey(savedKey) !== sourceKey) return;
      found = true;
      value = savedValue !== false;
    });
    return { found, value };
  }

  function orderedEntries(events) {
    return (Array.isArray(events) ? events : []).map((event, index) => {
      const explicitOrder = Number(event?.order);
      const idOrder = String(event?.id || '').match(/^event-(\d+)$/);
      return {
        event,
        index,
        order: Number.isFinite(explicitOrder)
          ? explicitOrder
          : (idOrder ? Number(idOrder[1]) : Number.MAX_SAFE_INTEGER)
      };
    }).sort((left, right) => left.order - right.order || left.index - right.index);
  }

  function forContext(event = {}) {
    const source = event?.source;
    const from = Number(source?.from);
    const to = Number(source?.to);
    return (Array.isArray(source?.contexts) ? source.contexts : [])
      .filter(context => context?.type === 'ForStatement')
      .filter(context => !Number.isFinite(from) || !Number.isFinite(to)
        || (Number(context.from) <= from && Number(context.to) >= to))
      .sort((left, right) => (
        (Number(left.to) - Number(left.from)) - (Number(right.to) - Number(right.from))
      ))[0] || null;
  }

  function forContextKey(context = {}) {
    return [
      context.functionName || '',
      Number(context.from),
      Number(context.to),
      Number(context.headerFrom),
      Number(context.headerTo)
    ].join(':');
  }

  function eventForContextKey(event = {}) {
    const context = forContext(event);
    return context ? forContextKey(context) : '';
  }

  // A classic for loop evaluates its update expression once more before the
  // condition becomes false. Visually that final i++/j++ and the following
  // failed condition are one loop-boundary operation. Keep the captured
  // runtime metadata, but mark that entire operation so one setting can omit
  // its motion and code highlighting without affecting ordinary iterations.
  // ---------------------------------------------------------------------------
  // 區段：迴圈邊界衍生事件
  // ---------------------------------------------------------------------------
  function rebuildLoopBoundaryEvents(document) {
    const entries = (document?.frames || []).flatMap((frame, frameIndex) => (
      orderedEntries(frame?.events || []).map(entry => ({ ...entry, frame, frameIndex }))
    )).sort((left, right) => (
      left.order - right.order || left.frameIndex - right.frameIndex || left.index - right.index
    ));
    entries.forEach(({ event }) => {
      delete event.loopBoundary;
      delete event.loopBoundaryCondition;
      delete event.loopBoundaryConditionId;
      delete event.loopBoundarySuppressed;
    });
    entries.forEach((entry, terminalIndex) => {
      const condition = entry.event;
      if (condition?.type !== 'condition'
        || condition.conditionKind !== 'ForStatement'
        || condition.result !== false) return;
      const context = forContext(condition);
      if (!context) return;
      const contextKey = forContextKey(context);
      const conditionTo = Number(context.conditionTo);
      const conditionFrom = Number(context.conditionFrom);
      const headerTo = Number(context.headerTo);
      if (!Number.isFinite(conditionFrom)
        || !Number.isFinite(conditionTo)
        || !Number.isFinite(headerTo)) return;
      condition.loopBoundaryCondition = true;
      condition.loopBoundaryConditionId = String(condition.id || '');
      let previousConditionIndex = -1;
      for (let cursor = terminalIndex - 1; cursor >= 0; cursor -= 1) {
        const previous = entries[cursor].event;
        if (previous?.type !== 'condition' || previous.conditionKind !== 'ForStatement') continue;
        if (eventForContextKey(previous) !== contextKey) continue;
        previousConditionIndex = cursor;
        break;
      }
      entries.slice(previousConditionIndex + 1, terminalIndex).forEach(({ event }) => {
        if (!['assign', 'write'].includes(event?.type)) return;
        if (eventForContextKey(event) !== contextKey) return;
        const from = Number(event.source?.from);
        const to = Number(event.source?.to);
        if (!Number.isFinite(from) || !Number.isFinite(to)
          || from < conditionTo || to > headerTo) return;
        event.loopBoundary = true;
        event.loopBoundaryConditionId = String(condition.id || '');
      });
      // Reads and comparisons that build the final false result have their own
      // runtime records. They must be suppressed with the condition itself or
      // the code presenter can still reconstruct and color the boundary check.
      entries.slice(previousConditionIndex + 1, terminalIndex + 1).forEach(({ event }) => {
        if (eventForContextKey(event) !== contextKey) return;
        const from = Number(event.source?.from);
        const to = Number(event.source?.to);
        if (!Number.isFinite(from) || !Number.isFinite(to)
          || from < conditionFrom || to > conditionTo) return;
        event.loopBoundaryCondition = true;
        event.loopBoundaryConditionId = String(condition.id || '');
      });
    });
    return document;
  }

  function eventSettings(document) {
    return document?.studio?.eventSettings || {};
  }

  function migrateAliasedEventSettings(settings = {}) {
    ['defaultEnabled', 'timelineTypes'].forEach(group => {
      const values = settings[group] && typeof settings[group] === 'object'
        ? settings[group]
        : (settings[group] = {});
      [...new Set(Object.values(eventTypeAliases))].forEach(canonical => {
        const legacy = Object.entries(eventTypeAliases)
          .filter(([type, target]) => target === canonical && typeof values[type] === 'boolean')
          .map(([type]) => values[type]);
        if (typeof values[canonical] !== 'boolean' && legacy.length) {
          values[canonical] = !legacy.includes(false);
        }
      });
      Object.keys(eventTypeAliases).forEach(type => { delete values[type]; });
    });
    return settings;
  }

  function boundaryMutationTargets(event = {}) {
    const targets = (event.targets || []).filter(target => target?.variableId);
    const explicit = targets.filter(target => target.role === 'target');
    return explicit.length ? explicit : targets.slice(0, 1);
  }

  function applyBoundaryValue(frame, target, value) {
    const entry = frame?.state?.[target?.variableId];
    if (!entry || value == null) return;
    const captured = Array.isArray(target.resolvedIndices)
      ? target.resolvedIndices.map(Number) : [];
    const resolvedIndex = Number(target.resolvedIndex);
    const indices = captured.length && captured.every(Number.isInteger)
      ? captured : (Number.isInteger(resolvedIndex) ? [resolvedIndex] : []);
    if (indices.length) {
      let data = entry.data;
      for (let depth = 0; depth < indices.length - 1; depth += 1) {
        data = data?.items?.[indices[depth]];
      }
      const items = data?.items;
      const index = indices.at(-1);
      if (Array.isArray(items) && index >= 0 && index < items.length) items[index] = cloneValue(value);
      return;
    }
    entry.data = cloneValue(value);
  }

  // ---------------------------------------------------------------------------
  // 區段：邊界快照與值回填
  // ---------------------------------------------------------------------------
  function keepSnapshotFrame(document, snapshot) {
    if (snapshot?.kind !== 'frame' || !snapshot.frame) return snapshot?.frame || null;
    const framesById = new Map((document?.frames || []).map(frame => [frame.id, frame]));
    const sourceFrame = framesById.get(snapshot.sourceFrameId);
    const captureOrder = Number(snapshot.frame.captureOrder);
    const keepOrder = Number(snapshot.keepOrder);
    const boundaryEvents = orderedEntries(sourceFrame?.events || [])
      .filter(entry => (
        (!Number.isFinite(captureOrder) || entry.order > captureOrder)
        && (!Number.isFinite(keepOrder) || entry.order < keepOrder)
      ))
      .map(entry => entry.event)
      .filter(event => event?.type === 'scope-exit'
        || (event?.type === 'visual-exit' && event?.automaticVisibility !== true) || (
        event?.loopBoundary === true
        && event.enabled === true
        && event.loopBoundarySuppressed !== true
      ));
    if (!boundaryEvents.length) return snapshot.frame;
    const effectiveFrame = {
      ...snapshot.frame,
      state: Object.fromEntries(Object.entries(snapshot.frame.state || {}).map(([variableId, entry]) => [
        variableId,
        { ...entry, data: cloneValue(entry?.data) }
      ])),
      bindings: cloneValue(snapshot.frame.bindings || []),
      objectBindings: cloneValue(snapshot.frame.objectBindings || []),
      renderers: cloneValue(snapshot.frame.renderers || {}),
      rendererOptions: cloneValue(snapshot.frame.rendererOptions || {}),
      captureOnlyVariableIds: cloneValue(snapshot.frame.captureOnlyVariableIds || []),
      styles: cloneValue(snapshot.frame.styles || []),
      segments: cloneValue(snapshot.frame.segments || [])
    };
    boundaryEvents.forEach(event => {
      if (event?.type === 'scope-exit'
        || (event?.type === 'visual-exit' && event?.automaticVisibility !== true)) {
        (event.targets || []).forEach(target => {
          const variableId = String(target?.variableId || '');
          const lifetime = String(target?.lifetimeIdentity || event.lifetimeIdentity || '');
          const entry = effectiveFrame.state?.[variableId];
          if (!entry || (lifetime && String(entry.lifetime || '') !== lifetime)) return;
          delete effectiveFrame.state[variableId];
          delete effectiveFrame.renderers[variableId];
          delete effectiveFrame.rendererOptions[variableId];
          effectiveFrame.captureOnlyVariableIds = effectiveFrame.captureOnlyVariableIds
            .filter(id => id !== variableId);
          effectiveFrame.bindings = effectiveFrame.bindings.filter(binding => (
            binding?.targetVariableId !== variableId
            && binding?.sourceVariableId !== variableId
            && !(binding?.sourceVariableIds || []).includes(variableId)
          ));
          effectiveFrame.objectBindings = effectiveFrame.objectBindings.filter(binding => (
            binding?.targetVariableId !== variableId
            && binding?.sourceVariableId !== variableId
            && !(binding?.sourceVariableIds || []).includes(variableId)
          ));
          effectiveFrame.styles = effectiveFrame.styles
            .filter(style => style?.targetVariableId !== variableId);
          effectiveFrame.segments = effectiveFrame.segments
            .filter(segment => segment?.targetVariableId !== variableId);
        });
        return;
      }
      boundaryMutationTargets(event).forEach(target => (
        applyBoundaryValue(effectiveFrame, target, event.payload?.after)
      ));
    });
    return effectiveFrame;
  }

  // ---------------------------------------------------------------------------
  // 區段：事件預設與可用性
  // ---------------------------------------------------------------------------
  function defaultEnabled(event = {}, document = null) {
    if (event.animate === false) return false;
    const type = canonicalEventType(event.type);
    if (byType[type]?.internal === true) return false;
    if (event.loopBoundary === true) {
      return eventSettings(document).autoLoopBoundaryEnabled === true;
    }
    if (event.type === 'compare' && (event.targets || []).some(target => !target?.variableId)) return false;
    if (event.type === 'fixed') {
      const settings = eventSettings(document);
      if (typeof settings.autoFixedEnabled === 'boolean') return settings.autoFixedEnabled;
      if (typeof settings.defaultEnabled?.fixed === 'boolean') return settings.defaultEnabled.fixed;
      return true;
    }
    const configured = eventSettings(document).defaultEnabled?.[type];
    if (typeof configured === 'boolean') return configured;
    const legacyConfigured = eventSettings(document).defaultEnabled?.[event.type];
    if (typeof legacyConfigured === 'boolean') return legacyConfigured;
    return byType[type]?.enabledByDefault !== false;
  }

  const FIXED_KINDS = new Set(['sequence', 'stack', 'queue', 'set']);
  const FIXED_ACCESS_TYPES = new Set(['read', 'write', 'assign', 'swap']);

  function targetIndex(document, frame, target = {}) {
    if (target.resolvedIndex != null
      && target.resolvedIndex !== ''
      && Number.isInteger(Number(target.resolvedIndex))) return Number(target.resolvedIndex);
    const source = String(target.indexExpression ?? '').trim();
    if (!source) return null;
    const resolved = window.ASMTraceRules?.resolveExpression?.(
      document, frame, source
    );
    if (resolved != null && resolved !== '' && Number.isInteger(Number(resolved))) return Number(resolved);
    const numeric = Number(source);
    return Number.isInteger(numeric) ? numeric : null;
  }

  // Rebuild generated fixed state after normalization. This both upgrades old
  // saved traces and guarantees that the editor, Studio and slide runtime use
  // the same runtime-identity-aware result.
  // ---------------------------------------------------------------------------
  // 區段：自動固定事件
  // ---------------------------------------------------------------------------
  function rebuildAutoFixedEvents(document) {
    const frames = Array.isArray(document?.frames) ? document.frames : [];
    const variables = document?.variables || {};
    const accesses = new Map();
    Object.values(document?.studio?.eventStates || {}).forEach(states => {
      Object.keys(states || {}).forEach(key => {
        if (/^fixed:(?!auto:)/.test(key)) delete states[key];
      });
    });
    frames.forEach(frame => {
      frame.events = (frame.events || []).filter(event => event.type !== 'fixed');
    });
    frames.forEach((frame, frameIndex) => {
      (frame.events || []).filter(event => FIXED_ACCESS_TYPES.has(event.type)).forEach(event => {
        (event.targets || []).forEach(target => {
          const variableId = target?.variableId;
          const entry = frame.state?.[variableId];
          const data = entry?.data;
          const kind = variables?.[variableId]?.kind || data?.kind;
          if (!variableId || !FIXED_KINDS.has(kind) || !Array.isArray(data?.items)) return;
          const index = targetIndex(document, frame, target);
          if (index == null || index < 0 || index >= data.items.length) return;
          const runtimeIdentity = String(entry?.identity || '');
          const objectIdentity = runtimeIdentity || `variable:${variableId}`;
          const key = `${objectIdentity}#${index}`;
          const previous = accesses.get(key) || {};
          accesses.set(key, {
            ...previous,
            variableId,
            variableName: entry?.name || variables?.[variableId]?.name || variableId,
            runtimeIdentity,
            objectIdentity,
            index,
            lastAccessFrameIndex: frameIndex,
            lastEventId: event.id || previous.lastEventId || '',
            lastEventOrder: Number.isFinite(Number(event.order))
              ? Number(event.order)
              : (previous.lastEventOrder || 0)
          });
        });
      });
    });
    const groups = new Map();
    accesses.forEach(access => {
      const key = `${access.lastAccessFrameIndex}#${access.objectIdentity}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(access);
    });
    groups.forEach(group => {
      group.sort((left, right) => left.index - right.index);
      const frame = frames[group[0].lastAccessFrameIndex];
      const lastAccess = group.reduce((latest, access) => (
        access.lastEventOrder >= latest.lastEventOrder ? access : latest
      ), group[0]);
      const stableVariableId = String(lastAccess.variableId || '').replace(/@\d+$/, '');
      const signature = `fixed:auto:${stableVariableId}:${group.map(access => access.index).join(',')}`;
      frame.events.push({
        id: signature,
        type: 'fixed',
        sceneGeneration: Number(frame.sceneGeneration) || 0,
        signature,
        autoFixed: true,
        stateChange: true,
        persistent: true,
        runtimeIdentity: group[0].runtimeIdentity,
        line: Number(frame.source?.line) || 0,
        order: lastAccess.lastEventOrder + 0.001,
        phase: 'after',
        afterEventId: lastAccess.lastEventId,
        targets: group.map(access => ({
          role: 'target',
          sceneGeneration: Number(frame.sceneGeneration) || 0,
          variableId: access.variableId,
          runtimeIdentity: access.runtimeIdentity,
          expression: `${access.variableName}[${access.index}]`,
          indexExpression: String(access.index),
          resolvedIndex: access.index
        }))
      });
    });
    frames.forEach(frame => frame.events.sort((left, right) => (
      (Number(left?.order) || 0) - (Number(right?.order) || 0)
      || String(left?.signature || left?.id || '').localeCompare(String(right?.signature || right?.id || ''))
    )));
    return document;
  }

  // ---------------------------------------------------------------------------
  // 區段：畫面顯示生命週期事件
  // ---------------------------------------------------------------------------
  function rebuildVisualLifecycleEvents(document) {
    const frames = Array.isArray(document?.frames) ? document.frames : [];
    const variables = document?.variables || {};
    const sourceCode = String(document?.sourceCode || '');
    const lineStarts = [0];
    for (let offset = 0; offset < sourceCode.length; offset += 1) {
      if (sourceCode[offset] === '\n') lineStarts.push(offset + 1);
    }
    const sourceForFrame = frame => {
      const line = Math.max(1, Number(frame?.source?.line) || 1);
      const from = lineStarts[line - 1] ?? 0;
      const rawEnd = lineStarts[line] == null ? sourceCode.length : lineStarts[line] - 1;
      const to = rawEnd > from && sourceCode[rawEnd - 1] === '\r' ? rawEnd - 1 : rawEnd;
      return {
        functionName: String(frame?.source?.function || 'global'),
        from,
        to,
        line,
        column: 1,
        endLine: line,
        endColumn: Math.max(1, to - from + 1),
        text: sourceCode.slice(from, to).trim(),
        contexts: (document?.sourceStructure || []).filter(context => (
          Number(context?.from) <= from && from < Number(context?.to)
        ))
      };
    };
    const sourceForDeclaration = variableId => {
      const variable = variables?.[variableId] || {};
      const declaration = (document?.sourceDeclarations || []).find(candidate => (
        candidate?.name === variable.name
        && Number(candidate?.line) === Number(variable.line)
        && String(candidate?.functionName || '') === String(variable.functionName || '')
      ));
      const line = Math.max(1, Number(declaration?.line) || Number(variable.line) || 1);
      const fallbackFrom = lineStarts[line - 1] ?? 0;
      const fallbackRawEnd = lineStarts[line] == null ? sourceCode.length : lineStarts[line] - 1;
      const fallbackTo = fallbackRawEnd > fallbackFrom && sourceCode[fallbackRawEnd - 1] === '\r'
        ? fallbackRawEnd - 1
        : fallbackRawEnd;
      const from = declaration
        ? Math.max(0, Number(declaration.from) || 0)
        : fallbackFrom;
      const to = declaration
        ? Math.max(from, Number(declaration.to) || from)
        : fallbackTo;
      const endLine = line + (sourceCode.slice(from, to).match(/\n/g) || []).length;
      return {
        functionName: String(declaration?.functionName || variable.functionName || 'global'),
        from,
        to,
        line,
        column: 1,
        endLine,
        endColumn: Math.max(1, to - (lineStarts[endLine - 1] ?? from) + 1),
        text: sourceCode.slice(from, to).trim(),
        contexts: (document?.sourceStructure || []).filter(context => (
          Number(context?.from) <= from && from < Number(context?.to)
        ))
      };
    };
    frames.forEach(frame => {
      frame.events = (frame.events || []).filter(event => event?.automaticVisibility !== true);
    });
    const hiddenIds = frame => new Set(frame?.captureOnlyVariableIds || []);
    const stableTarget = (frame, variableId, entry) => ({
      role: 'target',
      sceneGeneration: Number(frame?.sceneGeneration) || 0,
      variableId,
      runtimeIdentity: String(entry?.identity || ''),
      lifetimeIdentity: String(entry?.lifetime || ''),
      expression: String(entry?.name || variables?.[variableId]?.name || variableId)
    });
    const sameRuntimeObject = (before, after) => {
      if (!before || !after) return false;
      const beforeLifetime = String(before.lifetime || '');
      const afterLifetime = String(after.lifetime || '');
      if (beforeLifetime || afterLifetime) return beforeLifetime === afterLifetime;
      const beforeIdentity = String(before.identity || '');
      const afterIdentity = String(after.identity || '');
      return !beforeIdentity || !afterIdentity || beforeIdentity === afterIdentity;
    };
    const lastOrder = frame => (frame?.events || []).reduce((result, event) => (
      Number.isFinite(Number(event?.order)) ? Math.max(result, Number(event.order)) : result
    ), -1);
    const firstOrder = frame => (frame?.events || []).reduce((result, event) => (
      Number.isFinite(Number(event?.order)) ? Math.min(result, Number(event.order)) : result
    ), Infinity);
    const lifetimeKey = target => {
      const identity = String(target?.lifetimeIdentity || target?.runtimeIdentity || '');
      return `${String(target?.variableId || '')}:${identity}`;
    };
    const visibleLifetimes = new Set();
    const declaredLifetimes = new Set();
    const rememberDeclarations = frame => {
      const current = new Set();
      (frame?.events || []).forEach(event => {
        if (event?.type !== 'declare' || event?.automaticVisibility === true) return;
        (event.targets || []).forEach(target => {
          const key = lifetimeKey(target);
          current.add(key);
          declaredLifetimes.add(key);
        });
      });
      return current;
    };
    const rememberVisible = frame => {
      const hidden = hiddenIds(frame);
      Object.entries(frame?.state || {}).forEach(([variableId, entry]) => {
        if (hidden.has(variableId)) return;
        visibleLifetimes.add(lifetimeKey(stableTarget(frame, variableId, entry)));
      });
    };
    rememberDeclarations(frames[0]);
    rememberVisible(frames[0]);
    for (let index = 1; index < frames.length; index += 1) {
      const previous = frames[index - 1];
      const frame = frames[index];
      const previousHidden = hiddenIds(previous);
      const currentHidden = hiddenIds(frame);
      const currentDeclarations = rememberDeclarations(frame);
      const manualExitIds = new Set((frame.events || []).filter(event => (
        event?.type === 'visual-exit' && event?.automaticVisibility !== true
      )).flatMap(event => (event.targets || []).map(target => String(target?.variableId || ''))));
      const declaring = [];
      const entering = [];
      const exiting = [];
      Object.entries(frame.state || {}).forEach(([variableId, entry]) => {
        const before = previous?.state?.[variableId];
        if (!sameRuntimeObject(before, entry)) return;
        if (previousHidden.has(variableId) && !currentHidden.has(variableId)) {
          const target = stableTarget(frame, variableId, entry);
          const key = lifetimeKey(target);
          if (!visibleLifetimes.has(key) && !declaredLifetimes.has(key)) declaring.push(target);
          else if (!currentDeclarations.has(key)) entering.push(target);
        } else if (!previousHidden.has(variableId) && currentHidden.has(variableId)
          && !manualExitIds.has(variableId)) {
          exiting.push(stableTarget(previous, variableId, before));
        }
      });
      if (!declaring.length && !entering.length && !exiting.length) {
        rememberVisible(frame);
        continue;
      }
      const currentFirst = firstOrder(frame);
      const previousLast = lastOrder(previous);
      const baseOrder = Number.isFinite(currentFirst)
        ? currentFirst - 0.002
        : previousLast + 0.001;
      const append = (type, targets, order, options = {}) => {
        if (!targets.length) return;
        const names = targets.map(target => target.expression).join(',');
        const functionName = String(frame.source?.function || 'global');
        const directiveKey = String(frame.source?.logicalDirectiveKey
          || frame.source?.directiveKey || frame.id || index);
        const signature = options.signature || `${type}:${functionName}:${directiveKey}:${names}`;
        frame.events.push({
          id: `${signature}:${index}`,
          type,
          signature,
          automaticVisibility: true,
          stateChange: true,
          sceneGeneration: Number(frame.sceneGeneration) || 0,
          line: Number(options.source?.line ?? frame.source?.line) || 0,
          order,
          phase: 'before',
          name: names,
          source: options.source || sourceForFrame(frame),
          targets
        });
      };
      append('visual-exit', exiting, baseOrder);
      let entranceOrder = baseOrder + (exiting.length ? 0.001 : 0);
      declaring.forEach(target => {
        const variable = variables?.[target.variableId] || {};
        const source = sourceForDeclaration(target.variableId);
        const functionName = String(variable.functionName || frame.source?.function || 'global');
        const line = Number(variable.line || source?.line || 0);
        const name = String(variable.name || target.expression || target.variableId);
        append('declare', [target], entranceOrder, {
          source,
          signature: `declare:${functionName}:${line}:${name}`
        });
        declaredLifetimes.add(lifetimeKey(target));
        entranceOrder += 0.0001;
      });
      append('visual-enter', entering, entranceOrder);
      frame.events.sort((left, right) => (
        Number(left?.order) - Number(right?.order)
        || String(left?.signature || left?.id || '').localeCompare(
          String(right?.signature || right?.id || '')
        )
      ));
      rememberVisible(frame);
    }
    return document;
  }

  // ---------------------------------------------------------------------------
  // 區段：啟用狀態套用
  // ---------------------------------------------------------------------------
  function applyEnabledStates(document) {
    rebuildLoopBoundaryEvents(document);
    const eventStates = document?.studio?.eventStates || {};
    const instructionStates = document?.studio?.eventInstructionStates || {};
    const settings = migrateAliasedEventSettings(eventSettings(document));
    if (settings.defaultEnabled) {
      delete settings.defaultEnabled.condition;
      delete settings.defaultEnabled.read;
    }
    if (settings.timelineTypes) {
      delete settings.timelineTypes.condition;
      delete settings.timelineTypes.read;
    }
    Object.keys(instructionStates).forEach(key => {
      const canonical = canonicalInstructionKey(key);
      if (canonical.startsWith('condition:') || canonical.startsWith('read:')) delete instructionStates[key];
    });
    Object.values(eventStates).forEach(states => {
      Object.keys(states || {}).forEach(key => {
        const canonical = canonicalInstructionKey(key);
        if (canonical.startsWith('condition:') || canonical.startsWith('read:')) delete states[key];
      });
    });
    (document?.frames || []).forEach(frame => {
      const frameStates = eventStates[frame.id] || {};
      const controls = (frame.eventControls || []).filter(control => {
        if (!control.when) return true;
        const value = window.ASMTraceRules.resolveExpression(document, frame, control.when.expression);
        if (value == null) throw new Error(`第 ${control.line || '?'} 行的 @events 條件無法解析：${control.when.expression}`);
        return Boolean(value);
      });
      // One pass preserves legacy occurrence keys without rescanning all prior
      // events for every occurrence (quadratic for a large initialization frame).
      const occurrences = new Map();
      (frame.events || []).forEach(event => {
        delete event.directiveAnimationControl;
        const base = baseEventKey(event);
        const occurrence = occurrences.get(base) || 0;
        occurrences.set(base, occurrence + 1);
        const key = `${base}::${occurrence}`;
        if (event.loopBoundaryCondition === true) {
          event.loopBoundarySuppressed = settings.autoLoopBoundaryEnabled !== true;
        } else {
          delete event.loopBoundarySuppressed;
        }
        if (event.loopBoundary === true) {
          explicitEnabledStates.delete(event);
          event.enabled = settings.autoLoopBoundaryEnabled === true;
          event.loopBoundarySuppressed = event.enabled !== true;
          return;
        }
        if (event.type === 'fixed') {
          const hasFrameState = Object.prototype.hasOwnProperty.call(frameStates, key);
          if (hasFrameState) explicitEnabledStates.add(event);
          else explicitEnabledStates.delete(event);
          event.enabled = hasFrameState
            ? frameStates[key] !== false
            : defaultEnabled(event, document);
          return;
        }
        const savedInstructionState = instructionState(instructionStates, event);
        const hasInstructionState = savedInstructionState.found;
        const hasFrameState = Object.prototype.hasOwnProperty.call(frameStates, key);
        if (hasInstructionState || hasFrameState) explicitEnabledStates.add(event);
        else explicitEnabledStates.delete(event);
        event.enabled = hasInstructionState
          ? savedInstructionState.value
          : hasFrameState
            ? frameStates[key] !== false
            : defaultEnabled(event, document);
      });
      // Source controls describe this frame, after saved Studio defaults. They
      // do not remove metadata or mutate captured values. Internal condition
      // records remain internal even under "all animate on".
      (frame.events || []).forEach(event => {
        if (byType[canonicalEventType(event.type)]?.internal) {
          if (event.loopBoundaryCondition === true) controls.forEach(control => {
            if (control.types.includes('all')) event.loopBoundarySuppressed = !control.animate;
          });
          return;
        }
        controls.forEach(control => {
          if (!control.types.includes('all')
            && !control.types.includes(event.type)
            && !control.types.includes(canonicalEventType(event.type))) return;
          // Fixed is persistent state with no timed animation. Broad animation
          // controls preserve its global/frame switch; explicit fixed rules
          // retain their existing meaning for saved sources.
          if (event.type === 'fixed' && !control.types.includes('fixed')) return;
          event.enabled = control.animate && event.animate !== false;
          event.directiveAnimationControl = control.animate;
          if (event.loopBoundary === true || event.loopBoundaryCondition === true) {
            event.loopBoundarySuppressed = !event.enabled;
          }
        });
      });
    });
    return document;
  }

  // ---------------------------------------------------------------------------
  // 區段：介面控制狀態
  // ---------------------------------------------------------------------------
  function controlState(event = {}) {
    const available = event.autoAnimationDisabled !== true;
    return {
      // Yellow/red events start visually off. An explicit saved choice remains
      // visible and editable even while this particular occurrence cannot run.
      checked: event.enabled !== false && (available || explicitEnabledStates.has(event)),
      available
    };
  }

  function availabilityKind(event = {}) {
    if (event.autoAnimationDisabled !== true) return 'available';
    return event.autoAnimationUnavailableReason === 'unrenderable'
      ? 'unrenderable'
      : 'missing-target';
  }

  function showTag(type, document = null) {
    type = canonicalEventType(type);
    if (type === 'fixed') return false;
    if (byType[type]?.internal === true) return false;
    const configured = eventSettings(document).timelineTypes?.[type];
    if (typeof configured === 'boolean') return configured;
    return byType[type]?.timelineByDefault === true;
  }

  function showTimelineEvent(event = {}, document = null) {
    if (event.declarationInitializer === true && event.parameterInitializer !== true) return false;
    return event.enabled !== false
      && event.autoAnimationDisabled !== true
      && showTag(event.type, document);
  }

  function isForHeaderEvent(event = {}) {
    if (!['declare', 'assign', 'compare'].includes(event.type)) return false;
    const source = event.source;
    if (!Number.isFinite(Number(source?.from)) || !Number.isFinite(Number(source?.to))) return false;
    return (source.contexts || []).some(context => (
      context?.type === 'ForStatement'
      && Number.isFinite(Number(context.headerFrom))
      && Number.isFinite(Number(context.headerTo))
      && Number(source.from) >= Number(context.headerFrom)
      && Number(source.to) <= Number(context.headerTo)
    ));
  }

  window.ASMTraceEvents = {
    definitions,
    labels: Object.fromEntries([
      ...definitions.map(definition => [definition.type, definition.label]),
      ...Object.entries(aliasedEventLabels)
    ]),
    colors: Object.fromEntries([
      ...definitions.map(definition => [definition.type, definition.color]),
      ...Object.entries(eventTypeAliases).map(([type, canonical]) => [type, byType[canonical].color])
    ]),
    animations,
    definition(type) {
      const canonical = canonicalEventType(type);
      return byType[canonical] || { type, label: type, color: '#65737a', showTag: true };
    },
    color(type) {
      return byType[canonicalEventType(type)]?.color || '#65737a';
    },
    animation(type) {
      return animations[canonicalEventType(type)] || 'none';
    },
    eventKey,
    instructionKey,
    canonicalInstructionKey,
    orderedEntries,
    ordered(events) {
      return orderedEntries(events).map(entry => entry.event);
    },
    defaultEnabled,
    rebuildAutoFixedEvents,
    rebuildVisualLifecycleEvents,
    rebuildLoopBoundaryEvents,
    keepSnapshotFrame,
    applyEnabledStates,
    controlState,
    availabilityKind,
    showTag,
    showTimelineEvent,
    showInspector(event = {}, document = null) {
      if (event.type === 'fixed') return false;
      // Source declarations with initializers are presented as one declaration
      // instruction. The raw assignment remains in the trace and replay model,
      // but does not create a second Studio row.
      if (event.declarationInitializer === true && event.parameterInitializer !== true) return false;
      if (event.loopBoundarySuppressed === true) return false;
      if (byType[canonicalEventType(event.type)]?.internal === true) return false;
      // The function definition is the root control in Trace Studio's event
      // outline. Keep its entry record selectable there even though it stays
      // hidden from the compact bottom timeline by default.
      if (['function-enter', 'call', 'output', 'control-flow'].includes(canonicalEventType(event.type))) return true;
      // Keep classic for controls editable in the right inspector even when
      // their broad event type is hidden from the compact bottom timeline.
      // Other hidden reads/conditions stay compact instead of flooding it.
      return showTag(event.type, document) || isForHeaderEvent(event);
    }
  };
})();
