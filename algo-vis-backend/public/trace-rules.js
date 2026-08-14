(function () {
  // Event colors belong to the frame/event menus. Objects only receive styles
  // from explicit user rules created in Trace Studio.
  const DEFAULT_RULES = [];

  function eventMatches(event, match = {}) {
    if (match.eventType && event.type !== match.eventType) return false;
    if (match.signature && event.signature !== match.signature) return false;
    if (match.line != null && Number(event.line) !== Number(match.line)) return false;
    if (match.function && event.function !== match.function) return false;
    if (match.result != null && event.result !== match.result) return false;
    if (match.variableId && !(event.targets || []).some(target => target.variableId === match.variableId)) return false;
    return true;
  }

  function stateValue(frame, variableId) {
    const data = frame?.state?.[variableId]?.data;
    return window.ASMTraceModel.scalarValue(data);
  }

  function variableEntry(document, frame, reference) {
    const wanted = String(reference || '').trim();
    if (!wanted) return null;
    if (frame?.state?.[wanted]) return { id: wanted, entry: frame.state[wanted] };
    const match = Object.entries(frame?.state || {}).find(([id, entry]) => (
      entry?.name === wanted || document?.variables?.[id]?.name === wanted
    ));
    return match ? { id: match[0], entry: match[1] } : null;
  }

  function itemAt(data, index) {
    if (!Number.isInteger(index)) return undefined;
    if (Array.isArray(data?.items)) return data.items[index];
    if (Array.isArray(data)) return data[index];
    return undefined;
  }

  function resolveExpression(document, frame, expression) {
    const source = String(expression ?? '').trim();
    if (!source) return null;
    const tokens = [];
    let cursor = 0;
    while (cursor < source.length) {
      if (/\s/.test(source[cursor])) {
        cursor += 1;
        continue;
      }
      const number = source.slice(cursor).match(/^\d+(?:\.\d+)?/);
      if (number) {
        tokens.push({ type: 'number', value: number[0] });
        cursor += number[0].length;
        continue;
      }
      const identifier = source.slice(cursor).match(/^[A-Za-z_]\w*/);
      if (identifier) {
        tokens.push({ type: 'identifier', value: identifier[0] });
        cursor += identifier[0].length;
        continue;
      }
      if ('+-*/%()[].'.includes(source[cursor])) {
        tokens.push({ type: 'operator', value: source[cursor] });
        cursor += 1;
        continue;
      }
      return null;
    }

    let position = 0;
    const invalid = Symbol('invalid-expression');
    const peek = value => tokens[position]?.value === value;
    const consume = value => {
      if (value && !peek(value)) return null;
      return tokens[position++] || null;
    };

    function parsePrimary() {
      if (peek('(')) {
        consume('(');
        const value = parseAdditive();
        if (value === invalid || !consume(')')) return invalid;
        return value;
      }
      const token = tokens[position];
      if (!token) return invalid;
      if (token.type === 'number') {
        position += 1;
        return Number(token.value);
      }
      if (token.type !== 'identifier') return invalid;
      position += 1;
      const found = variableEntry(document, frame, token.value);
      if (!found) return invalid;
      let data = found.entry?.data;
      while (peek('[')) {
        consume('[');
        const index = parseAdditive();
        if (index === invalid || !consume(']') || !Number.isInteger(Number(index))) return invalid;
        data = itemAt(data, Number(index));
        if (data == null) return invalid;
      }
      if (peek('.')) {
        consume('.');
        if (tokens[position]?.type !== 'identifier' || tokens[position]?.value !== 'length') return invalid;
        position += 1;
        if (Array.isArray(data?.items)) return data.items.length;
        if (Array.isArray(data)) return data.length;
        return invalid;
      }
      return window.ASMTraceModel.scalarValue(data);
    }

    function parseUnary() {
      if (peek('+')) {
        consume('+');
        return Number(parseUnary());
      }
      if (peek('-')) {
        consume('-');
        return -Number(parseUnary());
      }
      return parsePrimary();
    }

    function parseMultiplicative() {
      let value = parseUnary();
      while (peek('*') || peek('/') || peek('%')) {
        const operator = consume().value;
        const right = parseUnary();
        if (value === invalid || right === invalid) return invalid;
        if (operator === '*') value = Number(value) * Number(right);
        else if (operator === '/') value = Number(value) / Number(right);
        else value = Number(value) % Number(right);
      }
      return value;
    }

    function parseAdditive() {
      let value = parseMultiplicative();
      while (peek('+') || peek('-')) {
        const operator = consume().value;
        const right = parseMultiplicative();
        if (value === invalid || right === invalid) return invalid;
        value = operator === '+' ? Number(value) + Number(right) : Number(value) - Number(right);
      }
      return value;
    }

    const value = parseAdditive();
    if (value === invalid || position !== tokens.length || !Number.isFinite(Number(value))) return null;
    return value;
  }

  function conditionMatches(frame, condition) {
    if (!condition?.variableId) return true;
    const actual = stateValue(frame, condition.variableId);
    const expected = condition.value;
    const leftNumber = Number(actual);
    const rightNumber = Number(expected);
    const numeric = Number.isFinite(leftNumber) && Number.isFinite(rightNumber);
    const left = numeric ? leftNumber : String(actual ?? '');
    const right = numeric ? rightNumber : String(expected ?? '');
    if (condition.operator === 'neq') return left !== right;
    if (condition.operator === 'gt') return left > right;
    if (condition.operator === 'gte') return left >= right;
    if (condition.operator === 'lt') return left < right;
    if (condition.operator === 'lte') return left <= right;
    return left === right;
  }

  function frameMatches(frame, match = {}) {
    if (Array.isArray(match.frameIds) && match.frameIds.length && !match.frameIds.includes(frame?.id)) return false;
    return conditionMatches(frame, match.stateCondition);
  }

  function scalarStateByName(frame, expression) {
    const wanted = String(expression || '').trim();
    for (const entry of Object.values(frame?.state || {})) {
      if (entry?.name !== wanted) continue;
      const value = window.ASMTraceModel.scalarValue(entry.data);
      if (Number.isFinite(Number(value))) return Number(value);
    }
    return null;
  }

  function resolveIndex(target, frame) {
    const expression = String(target?.indexExpression || '').replace(/\s+/g, '');
    if (!expression) return null;
    if (/^-?\d+$/.test(expression)) return Number(expression);
    const match = expression.match(/^([A-Za-z_]\w*)([+-]\d+)?$/);
    if (!match) return null;
    const base = scalarStateByName(frame, match[1]);
    if (base == null) return null;
    return base + Number(match[2] || 0);
  }

  function resolveTargetIndex(document, frame, action) {
    const expression = action?.targetIndexExpression ?? action?.targetIndex;
    if (expression == null || String(expression).trim() === '') return null;
    const resolved = Number(resolveExpression(document, frame, expression));
    return Number.isInteger(resolved) ? resolved : null;
  }

  function evaluate(document, frame) {
    const highlights = {};
    const rules = [...DEFAULT_RULES, ...(Array.isArray(document?.rules) ? document.rules : [])];
    for (const event of frame?.events || []) {
      for (const rule of rules) {
        if (!frameMatches(frame, rule.match) || !eventMatches(event, rule.match)) continue;
        for (const action of rule.actions || []) {
          if (action.targetVariableId || action.type === 'repeat-cells') continue;
          const roles = action.target === 'participants' || !action.target
            ? null
            : new Set(Array.isArray(action.target) ? action.target : [String(action.target).replace(/^participant:/, '')]);
          for (const target of event.targets || []) {
            if (!target.variableId || (roles && !roles.has(target.role))) continue;
            const index = resolveIndex(target, frame);
            const key = index == null ? '$object' : String(index);
            highlights[target.variableId] ||= {};
            highlights[target.variableId][key] = {
              ...(highlights[target.variableId][key] || {}),
              ...(action.style || {}),
              animation: action.animation || highlights[target.variableId][key]?.animation || '',
              eventType: event.type,
              eventId: event.id
            };
          }
        }
      }
    }
    // Explicit Studio styles are applied after event highlights so the user's
    // cross-frame choices remain visible on read/write/compare frames.
    for (const rule of rules) {
      if (!frameMatches(frame, rule.match)) continue;
      for (const action of rule.actions || []) {
        if (!action.targetVariableId || action.type === 'repeat-cells') continue;
        const targetIndex = resolveTargetIndex(document, frame, action);
        const key = targetIndex != null
          ? String(targetIndex)
          : '$object';
        const variableHighlights = highlights[action.targetVariableId] ||= {};
        variableHighlights[key] = {
          ...(variableHighlights[key] || {}),
          ...(action.style || {}),
          animation: action.animation || variableHighlights[key]?.animation || ''
        };
        if (key === '$object') {
          Object.keys(variableHighlights).forEach(index => {
            if (index === '$object') return;
            variableHighlights[index] = {
              ...variableHighlights[index],
              ...(action.style || {}),
              animation: action.animation || variableHighlights[index]?.animation || ''
            };
          });
        }
      }
    }
    return highlights;
  }

  function decorations(document, frame) {
    const output = [];
    for (const rule of document?.rules || []) {
      if (!frameMatches(frame, rule.match)) continue;
      for (const action of rule.actions || []) {
        if (action.type !== 'repeat-cells') continue;
        const raw = action.countExpression
          ? resolveExpression(document, frame, action.countExpression)
          : stateValue(frame, action.sourceVariableId);
        const count = Math.max(0, Math.min(100, Math.floor(Number(raw) || 0)));
        output.push({ ...action, ruleId: rule.id, count });
      }
    }
    return output;
  }

  window.ASMTraceRules = {
    DEFAULT_RULES,
    eventMatches,
    frameMatches,
    conditionMatches,
    variableEntry,
    resolveExpression,
    resolveTargetIndex,
    resolveIndex,
    evaluate,
    decorations
  };
})();
