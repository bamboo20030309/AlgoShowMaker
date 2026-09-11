(function () {
  const CONTROL_TYPES = new Set([
    'ForStatement', 'IfStatement', 'WhileStatement', 'DoStatement', 'SwitchStatement'
  ]);
  const OUTLINE_CONTEXT_TYPES = new Set(['FunctionDefinition', ...CONTROL_TYPES]);

  function finiteRange(source = {}) {
    const from = Number(source.from);
    const to = Number(source.to);
    return Number.isFinite(from) && Number.isFinite(to) && to > from
      ? { from, to }
      : null;
  }

  function eventGroupId(event = {}) {
    const range = finiteRange(event.source) || { from: -1, to: -1 };
    const key = window.ASMTraceEvents?.instructionKey?.(event)
      || event.signature || event.type || 'event';
    return `${key}@${range.from}:${range.to}`;
  }

  function sourceLines(source = '') {
    if (window.ASMTraceCodeModel?.sourceLines) {
      return window.ASMTraceCodeModel.sourceLines(source);
    }
    const lines = [];
    let start = 0;
    let number = 1;
    for (let cursor = 0; cursor <= source.length; cursor += 1) {
      if (cursor < source.length && source[cursor] !== '\n') continue;
      let end = cursor;
      if (end > start && source[end - 1] === '\r') end -= 1;
      lines.push({ number, start, end, text: source.slice(start, end) });
      start = cursor + 1;
      number += 1;
    }
    return lines;
  }

  function lineNumbersForRange(lines, from, to) {
    return lines
      .filter(line => line.end >= from && line.start < to)
      .map(line => line.number);
  }

  function contextDepth(event = {}) {
    return Array.isArray(event.source?.contexts) ? event.source.contexts.length : 0;
  }

  function availability(events = []) {
    const kinds = events.map(event => (
      window.ASMTraceEvents?.availabilityKind?.(event)
      || (event.autoAnimationDisabled === true
        ? (event.autoAnimationUnavailableReason === 'unrenderable'
          ? 'unrenderable'
          : 'missing-target')
        : 'available')
    ));
    // One source instruction can execute multiple times in the same frame.
    // The button describes every one of those occurrences, so it must not turn
    // green merely because one occurrence found a target. A missing target is
    // actionable and remains yellow until all occurrences can find their live
    // visual object; an unsupported animation remains red otherwise.
    if (kinds.includes('missing-target')) return 'missing-target';
    if (kinds.includes('unrenderable')) return 'unrenderable';
    return 'available';
  }

  function checked(events = []) {
    return events.some(event => {
      const control = window.ASMTraceEvents?.controlState?.(event);
      return control ? control.checked : event.enabled !== false;
    });
  }

  function checkedForAvailability(events = [], kind = 'available') {
    if (kind === 'available') return checked(events);
    // A source instruction may be available in another frame while its current
    // occurrence is missing a canvas target or has no supported animation.
    // Do not let that green occurrence turn the current yellow/red button on.
    // controlState still returns true for an explicitly saved user choice, so
    // manual overrides remain visible and editable.
    return checked(events.filter(event => availability([event]) === kind));
  }

  function collectGroups(document, frame) {
    const currentEvents = new Set(frame?.events || []);
    const groups = new Map();
    (document?.frames || []).forEach(item => {
      (item.events || []).forEach(event => {
        if (!event || event.type === 'fixed') return;
        if (window.ASMTraceEvents?.showInspector?.(event, document) === false) return;
        const range = finiteRange(event.source);
        if (!range) return;
        const id = eventGroupId(event);
        if (!groups.has(id)) {
          groups.set(id, {
            id,
            key: window.ASMTraceEvents?.instructionKey?.(event) || event.signature || event.type,
            event,
            events: [],
            currentEvents: [],
            from: range.from,
            to: range.to,
            depth: contextDepth(event),
            type: event.type,
            label: window.ASMTraceEvents?.labels?.[event.type] || event.type || '事件'
          });
        }
        const group = groups.get(id);
        group.events.push(event);
        if (currentEvents.has(event)) group.currentEvents.push(event);
      });
    });
    return [...groups.values()].map(group => {
      const statusEvents = group.currentEvents.length ? group.currentEvents : group.events;
      const statusAvailability = availability(statusEvents);
      return {
        ...group,
        enabled: checkedForAvailability(
          statusAvailability === 'available' ? group.events : statusEvents,
          statusAvailability
        ),
        availability: statusAvailability,
        current: group.currentEvents.length > 0
      };
    }).sort((left, right) => (
      left.from - right.from
      || left.to - right.to
      || left.key.localeCompare(right.key)
    ));
  }

  function contextId(context = {}) {
    return `${context.type || 'Context'}@${Number(context.from) || -1}:${Number(context.to) || -1}`;
  }

  function contextLabel(context = {}, source = '') {
    const from = Number(context.headerFrom ?? context.from);
    const to = Number(context.headerTo ?? context.to);
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
      return context.type === 'FunctionDefinition'
        ? `${context.functionName || 'function'}()`
        : String(context.type || '區塊');
    }
    return source.slice(from, to)
      .replace(/\s*\{\s*$/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function functionContextForGroup(document, group = {}) {
    if (group.type !== 'function-enter') return null;
    const source = group.event?.source || {};
    const functionName = String(source.functionName || group.event?.function || '');
    return (document?.sourceStructure || []).find(context => (
      context?.type === 'FunctionDefinition'
      && (!functionName || String(context.functionName || '') === functionName)
      && Number(group.from) >= Number(context.from)
      && Number(group.from) <= Number(context.headerTo)
    )) || null;
  }

  function outlineContextPath(document, group = {}) {
    const contexts = (group.event?.source?.contexts || [])
      .filter(context => OUTLINE_CONTEXT_TYPES.has(context?.type));
    const functionContext = functionContextForGroup(document, group);
    if (!functionContext || contexts.some(context => contextId(context) === contextId(functionContext))) {
      return contexts;
    }
    return [functionContext, ...contexts];
  }

  function sortOutlineItems(items = []) {
    const eventPriority = { declare: 0, assign: 1, compare: 2, write: 3 };
    items.sort((left, right) => (
      left.from - right.from
      || (left.kind === right.kind ? 0 : (left.kind === 'context' ? -1 : 1))
      || left.to - right.to
      || (eventPriority[left.group?.type] ?? 20) - (eventPriority[right.group?.type] ?? 20)
      || String(left.id).localeCompare(String(right.id))
    ));
    items.forEach(item => {
      if (item.kind === 'context') sortOutlineItems(item.children);
    });
    return items;
  }

  function buildOutline(document, frame) {
    const source = String(document?.sourceCode || '');
    const groups = collectGroups(document, frame);
    const root = { kind: 'root', id: 'root', children: [] };
    const contexts = new Map();

    groups.forEach(group => {
      let parent = root;
      const contextPath = outlineContextPath(document, group);
      contextPath.forEach((context, depth) => {
        const id = contextId(context);
        let node = contexts.get(id);
        if (!node) {
          node = {
            kind: 'context',
            id,
            type: context.type,
            label: contextLabel(context, source),
            functionName: context.functionName || '',
            from: Number(context.from) || 0,
            to: Number(context.to) || 0,
            depth,
            children: []
          };
          contexts.set(id, node);
          parent.children.push(node);
        } else if (!parent.children.includes(node)) {
          // A context is identified by its immutable source range. If an older
          // trace omitted an outer context, attach it only once at the deepest
          // known parent instead of duplicating the whole subtree.
          parent.children.push(node);
        }
        parent = node;
      });
      if (group.type === 'function-enter' && parent.type === 'FunctionDefinition') {
        parent.headerGroup = group;
        return;
      }
      parent.children.push({
        kind: 'event',
        id: group.id,
        from: group.from,
        to: group.to,
        depth: contextPath.length,
        group
      });
    });

    sortOutlineItems(root.children);
    return { source, groups, items: root.children };
  }

  function addContextLines(selected, context, lines) {
    if (!context) return;
    const isMain = context.type === 'FunctionDefinition' && context.functionName === 'main';
    if (CONTROL_TYPES.has(context.type) || (context.type === 'FunctionDefinition' && !isMain)) {
      const headerFrom = Number(context.headerFrom);
      const headerTo = Number(context.headerTo);
      if (Number.isFinite(headerFrom) && Number.isFinite(headerTo) && headerTo > headerFrom) {
        lineNumbersForRange(lines, headerFrom, headerTo).forEach(number => selected.add(number));
      } else if (Number.isFinite(Number(context.openLine))) {
        selected.add(Number(context.openLine));
      }
      if (Number.isFinite(Number(context.closeLine))) selected.add(Number(context.closeLine));
    }
    if (CONTROL_TYPES.has(context.type)) {
      (context.structuralLines || []).forEach(number => selected.add(Number(number)));
    }
  }

  function primaryGroup(groups = []) {
    const semanticLength = group => String(group.event?.source?.text || '')
      .replace(/\s+/g, '').length || (group.to - group.from);
    return [...groups].sort((left, right) => (
      semanticLength(left) - semanticLength(right)
      || (left.to - left.from) - (right.to - right.from)
      || right.depth - left.depth
      || left.from - right.from
      || left.key.localeCompare(right.key)
    ))[0] || null;
  }

  function segmentsForLine(line, groups) {
    const ranges = groups.filter(group => group.from < line.end && group.to > line.start);
    const boundaries = new Set([line.start, line.end]);
    ranges.forEach(group => {
      boundaries.add(Math.max(line.start, group.from));
      boundaries.add(Math.min(line.end, group.to));
    });
    const points = [...boundaries].sort((left, right) => left - right);
    return points.slice(0, -1).map((from, index) => {
      const to = points[index + 1];
      const candidates = ranges.filter(group => group.from <= from && group.to >= to);
      return {
        text: line.text.slice(from - line.start, to - line.start),
        from,
        to,
        groups: candidates,
        primary: primaryGroup(candidates)
      };
    }).filter(segment => segment.text);
  }

  function build(document, frame) {
    const source = String(document?.sourceCode || '');
    if (!source) return { source, groups: [], items: [] };
    const lines = sourceLines(source);
    const groups = collectGroups(document, frame);
    const selected = new Set();
    groups.forEach(group => {
      lineNumbersForRange(lines, group.from, group.to).forEach(number => selected.add(number));
      (group.event.source?.contexts || []).forEach(context => addContextLines(selected, context, lines));
    });
    const hidden = window.ASMTraceCodeModel?.presentationLineNumbers
      ? window.ASMTraceCodeModel.presentationLineNumbers(
        lines,
        window.ASMTraceCodeModel.commentMaskedLines?.(lines) || new Map()
      )
      : new Set();
    const visible = [...selected]
      .filter(number => Number.isFinite(number) && number > 0 && !hidden.has(number))
      .sort((left, right) => left - right)
      .map(number => lines[number - 1])
      .filter(line => line && line.text.trim());
    const items = [];
    visible.forEach((line, index) => {
      const previous = visible[index - 1];
      if (previous && line.number > previous.number + 1) {
        items.push({ kind: 'ellipsis', fromLine: previous.number + 1, toLine: line.number - 1 });
      }
      items.push({
        kind: 'line',
        ...line,
        segments: segmentsForLine(line, groups)
      });
    });
    return { source, groups, items };
  }

  window.ASMTraceEventCodeTree = {
    build,
    buildOutline,
    collectGroups,
    contextId,
    contextLabel,
    functionContextForGroup,
    eventGroupId,
    primaryGroup,
    segmentsForLine
  };
})();
