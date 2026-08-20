(function () {
  const definitions = [
    { type: 'declare', label: '宣告', color: '#25824d', enabledByDefault: false },
    { type: 'read', label: '讀取', color: '#3976b8', enabledByDefault: false },
    { type: 'write', label: '賦值', color: '#c8483f', enabledByDefault: true },
    { type: 'assign', label: '賦值', color: '#c8483f', enabledByDefault: true },
    { type: 'compare', label: '比較', color: '#c38a16', enabledByDefault: true },
    { type: 'condition', label: '條件', color: '#7b61a8', enabledByDefault: false },
    { type: 'swap', label: '交換', color: '#1d8f83', enabledByDefault: true },
    { type: 'fixed', label: '固定', color: '#4caf50', enabledByDefault: true },
    { type: 'call', label: '呼叫', color: '#65737a', enabledByDefault: false },
    { type: 'function-enter', label: '進入函式', color: '#59656b', enabledByDefault: false },
    { type: 'function-exit', label: '離開函式', color: '#59656b', enabledByDefault: false }
  ];
  const byType = Object.fromEntries(definitions.map(definition => [definition.type, definition]));
  const animations = Object.freeze({
    declare: 'none',
    read: 'none',
    write: 'assign',
    assign: 'assign',
    compare: 'compare',
    condition: 'pulse',
    swap: 'swap',
    fixed: 'none',
    call: 'none',
    'function-enter': 'none',
    'function-exit': 'none'
  });

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

  function instructionKey(event = {}) {
    return baseEventKey(event);
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

  function eventSettings(document) {
    return document?.studio?.eventSettings || {};
  }

  function defaultEnabled(event = {}, document = null) {
    if (event.animate === false) return false;
    if (event.type === 'compare' && (event.targets || []).some(target => !target?.variableId)) return false;
    const configured = eventSettings(document).defaultEnabled?.[event.type];
    if (typeof configured === 'boolean') return configured;
    return byType[event.type]?.enabledByDefault !== false;
  }

  function applyEnabledStates(document) {
    const eventStates = document?.studio?.eventStates || {};
    const instructionStates = document?.studio?.eventInstructionStates || {};
    (document?.frames || []).forEach(frame => {
      const frameStates = eventStates[frame.id] || {};
      (frame.events || []).forEach((event, index) => {
        const key = eventKey(frame.events, index);
        const sourceKey = instructionKey(event);
        event.enabled = Object.prototype.hasOwnProperty.call(instructionStates, sourceKey)
          ? instructionStates[sourceKey] !== false
          : Object.prototype.hasOwnProperty.call(frameStates, key)
          ? frameStates[key] !== false
          : defaultEnabled(event, document);
      });
    });
    return document;
  }

  window.ASMTraceEvents = {
    definitions,
    labels: Object.fromEntries(definitions.map(definition => [definition.type, definition.label])),
    colors: Object.fromEntries(definitions.map(definition => [definition.type, definition.color])),
    animations,
    definition(type) {
      return byType[type] || { type, label: type, color: '#65737a', showTag: true };
    },
    color(type) {
      return byType[type]?.color || '#65737a';
    },
    animation(type) {
      return animations[type] || 'none';
    },
    eventKey,
    instructionKey,
    orderedEntries,
    ordered(events) {
      return orderedEntries(events).map(entry => entry.event);
    },
    defaultEnabled,
    applyEnabledStates,
    showTag(type, document = null) {
      const configured = eventSettings(document).timelineTypes?.[type];
      if (typeof configured === 'boolean') return configured;
      return (animations[type] || 'none') !== 'none';
    },
    showInspector() {
      return true;
    }
  };
})();
