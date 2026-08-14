const { parser } = require('@lezer/cpp');

const DECLARATOR_NODES = new Set([
  'Identifier', 'InitDeclarator', 'ArrayDeclarator', 'PointerDeclarator', 'ReferenceDeclarator'
]);
const CHECKPOINT_NODES = new Set([
  'Declaration', 'ExpressionStatement', 'IfStatement', 'ForStatement', 'WhileStatement',
  'DoStatement', 'SwitchStatement', 'TryStatement'
]);
const COMPARISON_OPERATORS = new Set(['<', '<=', '>', '>=', '==', '!=']);
const MUTATING_METHODS = new Set([
  'assign', 'clear', 'emplace', 'emplace_back', 'emplace_front', 'erase', 'insert',
  'pop', 'pop_back', 'pop_front', 'push', 'push_back', 'push_front', 'resize'
]);

function childrenOf(node) {
  const children = [];
  for (let child = node.firstChild; child; child = child.nextSibling) children.push(child);
  return children;
}

function firstDescendant(node, names) {
  if (!node) return null;
  if (names.has(node.name)) return node;
  for (let child = node.firstChild; child; child = child.nextSibling) {
    const found = firstDescendant(child, names);
    if (found) return found;
  }
  return null;
}

function isForHeaderExpression(node) {
  for (let current = node?.parent; current; current = current.parent) {
    if (current.name === 'ForStatement') {
      const body = [...childrenOf(current)].reverse().find(child => (
        child.name === 'CompoundStatement'
        || (child.name.endsWith('Statement') && child.name !== 'ForStatement')
      ));
      return !body || node.to <= body.from;
    }
    if (current.name === 'CompoundStatement') return false;
  }
  return false;
}

function lineMap(source) {
  const starts = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === '\n') starts.push(index + 1);
  }
  return position => {
    let low = 0;
    let high = starts.length - 1;
    while (low <= high) {
      const middle = (low + high) >> 1;
      if (starts[middle] <= position) low = middle + 1;
      else high = middle - 1;
    }
    return high + 1;
  };
}

function compactExpression(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 240);
}

function inferKind(type, declaratorText = '') {
  const normalized = `${type} ${declaratorText}`.replace(/\s+/g, ' ');
  if (/vector\s*<\s*vector\s*</.test(normalized) || /\[[^\]]*\]\s*\[[^\]]*\]/.test(normalized)) return 'matrix';
  if (/vector\s*</.test(normalized) || /deque\s*</.test(normalized) || /list\s*</.test(normalized)
    || /array\s*</.test(normalized) || /\[[^\]]*\]/.test(normalized)) return 'sequence';
  if (/map\s*</.test(normalized) || /unordered_map\s*</.test(normalized)) return 'map';
  if (/set\s*</.test(normalized) || /unordered_set\s*</.test(normalized)) return 'set';
  if (/stack\s*</.test(normalized)) return 'stack';
  if (/queue\s*</.test(normalized) || /priority_queue\s*</.test(normalized)) return 'queue';
  if (/string\b/.test(normalized)) return 'string';
  if (/\b(?:bool|char|short|int|long|float|double|size_t|auto)\b/.test(normalized)) return 'scalar';
  return 'object';
}

function functionInfo(node, source) {
  const declarator = childrenOf(node).find(child => child.name === 'FunctionDeclarator')
    || firstDescendant(node, new Set(['FunctionDeclarator']));
  const identifier = firstDescendant(declarator, new Set(['Identifier', 'OperatorName']));
  const body = childrenOf(node).find(child => child.name === 'CompoundStatement');
  return {
    name: identifier ? source.slice(identifier.from, identifier.to) : 'anonymous',
    body
  };
}

function declaratorIdentifier(node) {
  if (!node) return null;
  if (node.name === 'Identifier') return node;
  if (!DECLARATOR_NODES.has(node.name)) return null;
  return firstDescendant(node, new Set(['Identifier']));
}

function ambiguousDirectInitializer(node, source, knownVariables) {
  if (node.name !== 'FunctionDeclarator') return false;
  const parameterList = childrenOf(node).find(child => child.name === 'ParameterList');
  if (!parameterList) return false;
  const parameters = childrenOf(parameterList).filter(child => child.name === 'ParameterDeclaration');
  if (parameters.length !== 1) return false;
  const parameterParts = childrenOf(parameters[0]);
  if (parameterParts.length !== 1 || parameterParts[0].name !== 'TypeIdentifier') return false;

  const argumentName = source.slice(parameterParts[0].from, parameterParts[0].to);
  return knownVariables.some(variable => variable.name === argumentName
    && variable.declarationTo <= node.from
    && variable.scopeFrom <= node.from
    && node.from < variable.scopeTo);
}

function declarationVariables(node, source, knownVariables = []) {
  const children = childrenOf(node);
  const declarators = children.filter(child => (DECLARATOR_NODES.has(child.name)
    || ambiguousDirectInitializer(child, source, knownVariables))
    && firstDescendant(child, new Set(['Identifier'])));
  if (!declarators.length) return [];
  const firstId = firstDescendant(declarators[0], new Set(['Identifier']));
  const type = compactExpression(source.slice(node.from, firstId.from));
  return declarators.map(declarator => {
    const identifier = firstDescendant(declarator, new Set(['Identifier']));
    return {
      name: source.slice(identifier.from, identifier.to),
      nameFrom: identifier.from,
      nameTo: identifier.to,
      declarationFrom: node.from,
      declarationTo: node.to,
      declaratorText: source.slice(declarator.from, declarator.to),
      type
    };
  });
}

function parameterVariables(node, source) {
  const identifier = declaratorIdentifier(childrenOf(node).find(child => DECLARATOR_NODES.has(child.name))
    || firstDescendant(node, DECLARATOR_NODES));
  if (!identifier) return [];
  return [{
    name: source.slice(identifier.from, identifier.to),
    nameFrom: identifier.from,
    nameTo: identifier.to,
    declarationFrom: node.from,
    declarationTo: node.to,
    declaratorText: source.slice(identifier.from, node.to),
    type: compactExpression(source.slice(node.from, identifier.from))
  }];
}

function analyzeSource(source) {
  const tree = parser.parse(source);
  const lineAt = lineMap(source);
  const variables = [];

  function visit(node, context) {
    let nextContext = context;
    if (node.name === 'FunctionDefinition') {
      const info = functionInfo(node, source);
      nextContext = {
        functionName: info.name,
        functionBody: info.body,
        scope: info.body || context.scope
      };
    } else if (node.name === 'CompoundStatement') {
      nextContext = { ...context, scope: node };
    } else if (node.name === 'ForStatement') {
      nextContext = { ...context, scope: node };
    }

    let found = [];
    if (node.name === 'Declaration') found = declarationVariables(node, source, variables);
    if (node.name === 'ParameterDeclaration') found = parameterVariables(node, source);
    for (const variable of found) {
      const scope = nextContext.scope || tree.topNode;
      const functionName = nextContext.functionName || 'global';
      const line = lineAt(variable.nameFrom);
      const id = `${functionName}:${variable.name}@${variable.nameFrom}`;
      variables.push({
        ...variable,
        id,
        line,
        functionName,
        declarationKind: node.name === 'ParameterDeclaration' ? 'parameter' : 'local',
        scopeFrom: scope.from,
        scopeTo: scope.to,
        kind: inferKind(variable.type, variable.declaratorText),
        supported: true
      });
    }

    for (let child = node.firstChild; child; child = child.nextSibling) visit(child, nextContext);
  }

  visit(tree.topNode, { functionName: 'global', functionBody: null, scope: tree.topNode });
  return { tree, variables, lineAt };
}

function cppString(value) {
  return JSON.stringify(String(value == null ? '' : value));
}

function parseFrameExpression(expression) {
  const source = String(expression || '').trim();
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
    return { valid: false, identifiers: [] };
  }

  let position = 0;
  const identifiers = [];
  const peek = value => tokens[position]?.value === value;
  const consume = value => {
    if (value && !peek(value)) return null;
    return tokens[position++] || null;
  };

  function parsePrimary() {
    if (peek('(')) {
      consume('(');
      if (!parseAdditive() || !consume(')')) return false;
      return true;
    }
    const token = tokens[position];
    if (!token) return false;
    if (token.type === 'number') {
      position += 1;
      return true;
    }
    if (token.type !== 'identifier') return false;
    identifiers.push(token.value);
    position += 1;
    while (peek('[')) {
      consume('[');
      if (!parseAdditive() || !consume(']')) return false;
    }
    if (peek('.')) {
      consume('.');
      if (tokens[position]?.type !== 'identifier' || tokens[position]?.value !== 'length') return false;
      position += 1;
    }
    return true;
  }

  function parseUnary() {
    if (peek('+') || peek('-')) consume();
    return parsePrimary();
  }

  function parseMultiplicative() {
    if (!parseUnary()) return false;
    while (peek('*') || peek('/') || peek('%')) {
      consume();
      if (!parseUnary()) return false;
    }
    return true;
  }

  function parseAdditive() {
    if (!parseMultiplicative()) return false;
    while (peek('+') || peek('-')) {
      consume();
      if (!parseMultiplicative()) return false;
    }
    return true;
  }

  const valid = tokens.length > 0 && parseAdditive() && position === tokens.length;
  return { valid, identifiers: [...new Set(identifiers)] };
}

function parseFrameSpec(raw) {
  const text = String(raw || '').trim();
  if (!text) return { names: [], bindings: [] };

  const indexed = text.match(/^([A-Za-z_]\w*)\s*\[\s*(.*?)\s*\]$/);
  if (indexed) {
    const targetName = indexed[1];
    const indexExpressions = indexed[2].split(',').map(expression => expression.trim());
    const parsedExpressions = indexExpressions.map(expression => ({
      expression,
      parsed: parseFrameExpression(expression)
    }));
    const invalidExpression = parsedExpressions.find(item => !item.parsed.valid)?.expression || '';
    if (invalidExpression) {
      return { names: [targetName], bindings: [], invalidExpression };
    }
    const sourceNames = [...new Set(parsedExpressions.flatMap(item => item.parsed.identifiers))];
    return {
      names: [targetName, ...sourceNames],
      bindings: parsedExpressions.map(item => ({
        targetName,
        sourceName: item.parsed.identifiers[0] || '',
        sourceNames: item.parsed.identifiers,
        indexExpression: item.expression,
        mode: 'index'
      }))
    };
  }

  return { names: text.split(/[\s,]+/).filter(Boolean), bindings: [] };
}

function findFrameDirectives(source, suppliedAnalysis = null) {
  const analysis = suppliedAnalysis || analyzeSource(source);
  const directives = [];

  function resolveVariable(name, position) {
    return analysis.variables
      .filter(variable => variable.name === name
        && variable.declarationTo <= position
        && variable.scopeFrom <= position
        && position < variable.scopeTo)
      .sort((left, right) => (left.scopeTo - left.scopeFrom) - (right.scopeTo - right.scopeFrom))[0] || null;
  }

  function visit(node) {
    if (node.name === 'LineComment') {
      const text = source.slice(node.from, node.to);
      const match = text.match(/^\/\/\s*(?:([A-Za-z_][A-Za-z0-9_.-]*)\s*:\s*)?@frame(?:\s+([^\r\n]*?))?(?:\s+as\s+([A-Za-z_]\w*))?\s*$/);
      if (match) {
        let frameSpec = String(match[2] || '').trim();
        let objectId = match[3] || '';
        if (!objectId) {
          const aliasMatch = frameSpec.match(/^(.*?)\s+as\s+([A-Za-z_]\w*)$/);
          if (aliasMatch) {
            frameSpec = aliasMatch[1].trim();
            objectId = aliasMatch[2];
          }
        }
        const parsed = parseFrameSpec(frameSpec);
        if (parsed.invalidExpression) {
          throw new Error(`蝚?${analysis.lineAt(node.from)} 銵? @frame ?曆??賂?蝣?${parsed.invalidExpression}`);
        }
        const names = parsed.names;
        const invalid = names.find(name => !/^[A-Za-z_]\w*$/.test(name));
        if (invalid) throw new Error(`第 ${analysis.lineAt(node.from)} 行的 @frame 變數名稱無效：${invalid}`);
        const variables = names.map(name => {
          const variable = resolveVariable(name, node.from);
          if (!variable) throw new Error(`第 ${analysis.lineAt(node.from)} 行的 @frame 找不到可見變數：${name}`);
          return variable;
        });
        directives.push({
          from: node.from,
          to: node.to,
          line: analysis.lineAt(node.from),
          name: match[1] || '',
          objectId,
          names,
          variables,
          bindings: parsed.bindings.map(binding => {
            const target = variables.find(variable => variable.name === binding.targetName);
            const sourceVariables = (binding.sourceNames || [binding.sourceName])
              .filter(Boolean)
              .map(name => variables.find(variable => variable.name === name))
              .filter(Boolean);
            return {
              mode: binding.mode,
              targetName: binding.targetName,
              targetVariableId: target?.id || '',
              sourceName: binding.sourceName,
              sourceVariableId: sourceVariables[0]?.id || '',
              sourceVariableIds: sourceVariables.map(variable => variable.id),
              indexExpression: binding.indexExpression || binding.sourceName
            };
          })
        });
      }
    }
    for (let child = node.firstChild; child; child = child.nextSibling) visit(child);
  }

  visit(analysis.tree.topNode);
  const usedNames = new Set();
  directives.forEach(directive => {
    if (!directive.name) return;
    if (usedNames.has(directive.name)) {
      throw new Error(`第 ${directive.line} 行的 @frame 名稱重複：${directive.name}`);
    }
    usedNames.add(directive.name);
  });
  return directives;
}

function findKeepDirectives(source, suppliedAnalysis = null) {
  const analysis = suppliedAnalysis || analyzeSource(source);
  const directives = [];

  function resolveVariable(name, position) {
    return analysis.variables
      .filter(variable => variable.name === name
        && variable.declarationTo <= position
        && variable.scopeFrom <= position
        && position < variable.scopeTo)
      .sort((left, right) => (left.scopeTo - left.scopeFrom) - (right.scopeTo - right.scopeFrom))[0] || null;
  }

  function visit(node) {
    if (node.name === 'LineComment') {
      const text = source.slice(node.from, node.to);
      if (/^\/\/\s*@keep\b/.test(text)) {
        const lastMatch = text.match(/^\/\/\s*@keep\s+last(?:\s+as\s+(?:"([^"]*)"|'([^']*)'|([A-Za-z_]\w*)))?\s*$/);
        if (lastMatch) {
          const enclosing = analysis.variables
            .filter(variable => variable.scopeFrom <= node.from && node.from < variable.scopeTo)
            .sort((left, right) => (left.scopeTo - left.scopeFrom) - (right.scopeTo - right.scopeFrom))[0];
          directives.push({
            from: node.from,
            to: node.to,
            line: analysis.lineAt(node.from),
            mode: 'last',
            label: lastMatch[1] ?? lastMatch[2] ?? lastMatch[3] ?? '',
            functionName: enclosing?.functionName || 'global',
            variable: null
          });
          return;
        }
        const match = text.match(/^\/\/\s*@keep\s+([A-Za-z_]\w*)(?:\s+as\s+(?:"([^"]*)"|'([^']*)'|([A-Za-z_]\w*)))?\s*$/);
        if (!match) throw new Error(`第 ${analysis.lineAt(node.from)} 行的 @keep 語法無效`);
        const name = match[1];
        const variable = resolveVariable(name, node.from);
        if (!variable) throw new Error(`第 ${analysis.lineAt(node.from)} 行的 @keep 找不到可見變數：${name}`);
        directives.push({
          from: node.from,
          to: node.to,
          line: analysis.lineAt(node.from),
          mode: 'variable',
          name,
          label: match[2] ?? match[3] ?? match[4] ?? '',
          functionName: variable.functionName || 'global',
          variable
        });
      }
    }
    for (let child = node.firstChild; child; child = child.nextSibling) visit(child);
  }

  visit(analysis.tree.topNode);
  return directives;
}

function instrumentSource(source, watchIds = []) {
  const analysis = analyzeSource(source);
  const frameDirectives = findFrameDirectives(source, analysis);
  const keepDirectives = findKeepDirectives(source, analysis);
  const manualFrames = frameDirectives.length > 0;
  const selectedIds = new Set((watchIds || []).map(item => typeof item === 'string' ? item : item.id));
  frameDirectives.forEach(directive => directive.variables.forEach(variable => selectedIds.add(variable.id)));
  keepDirectives.forEach(directive => {
    if (directive.variable?.id) selectedIds.add(directive.variable.id);
  });
  // Without explicit @frame selections, trace every variable the parser can
  // resolve so RUN can build an animation without a separate setup step.
  if (!selectedIds.size && !manualFrames) {
    analysis.variables.forEach(variable => selectedIds.add(variable.id));
  }
  const selected = analysis.variables.filter(variable => selectedIds.has(variable.id));
  const declarationPositions = new Set(analysis.variables.map(variable => variable.nameFrom));
  const indexedFrameDirectives = frameDirectives.map((directive, index) => ({
    ...directive,
    index,
    functionName: directive.variables[0]?.functionName || 'global'
  }));
  const directiveByPosition = new Map(indexedFrameDirectives.map(directive => [directive.from, directive]));
  const indexedKeepDirectives = keepDirectives.map((directive, index) => ({
    ...directive,
    index,
    functionName: directive.functionName || directive.variable?.functionName || 'global'
  }));
  const keepDirectiveByPosition = new Map(indexedKeepDirectives.map(directive => [directive.from, directive]));

  function watchAt(name, position) {
    return selected
      .filter(variable => variable.name === name
        && variable.declarationTo <= position
        && variable.scopeFrom <= position
        && position < variable.scopeTo)
      .sort((left, right) => (left.scopeTo - left.scopeFrom) - (right.scopeTo - right.scopeFrom))[0] || null;
  }

  function visibleWatches(position, functionName) {
    return selected.filter(variable => variable.functionName === functionName
      && variable.declarationTo <= position
      && variable.scopeFrom <= position
      && position < variable.scopeTo);
  }

  function functionNameAt(node) {
    for (let current = node; current; current = current.parent) {
      if (current.name === 'FunctionDefinition') return functionInfo(current, source).name;
    }
    return 'global';
  }

  function signature(type, node) {
    return `${type}:${functionNameAt(node)}:${analysis.lineAt(node.from)}:${compactExpression(source.slice(node.from, node.to))}`;
  }

  function targetDescriptor(node) {
    if (!node) return { variableId: '', expression: '', indexExpression: '' };
    const expression = compactExpression(source.slice(node.from, node.to));
    if (node.name === 'Identifier') {
      const watch = watchAt(expression, node.from);
      return { variableId: watch?.id || '', expression, indexExpression: '' };
    }
    if (node.name === 'SubscriptExpression') {
      const children = childrenOf(node);
      const base = children[0];
      const index = children.find(child => !['[', ']'].includes(child.name) && child !== base);
      const baseIdentifier = firstDescendant(base, new Set(['Identifier']));
      const baseName = baseIdentifier ? source.slice(baseIdentifier.from, baseIdentifier.to) : '';
      const watch = watchAt(baseName, node.from);
      return {
        variableId: watch?.id || '',
        expression,
        indexExpression: index ? compactExpression(source.slice(index.from, index.to)) : ''
      };
    }
    const identifier = firstDescendant(node, new Set(['Identifier']));
    const name = identifier ? source.slice(identifier.from, identifier.to) : '';
    const watch = watchAt(name, node.from);
    return { variableId: watch?.id || '', expression, indexExpression: '' };
  }

  function containsSelectedReference(node) {
    if (!node) return false;
    if (node.name === 'Identifier') {
      return !!watchAt(source.slice(node.from, node.to), node.from);
    }
    for (let child = node.firstChild; child; child = child.nextSibling) {
      if (containsSelectedReference(child)) return true;
    }
    return false;
  }

  function captureCall(node, kind = node.name) {
    const functionName = functionNameAt(node);
    const watches = visibleWatches(node.to, functionName);
    const named = watches.map(variable => `::asm_trace::named(${cppString(variable.id)}, ${cppString(variable.name)}, (${variable.name}))`);
    const statementId = signature('statement', node);
    return `::asm_trace::capture(${analysis.lineAt(node.from)}, ${cppString(functionName)}, ${cppString(statementId)}, ${cppString(kind)}${named.length ? `, ${named.join(', ')}` : ''});`;
  }

  function directiveCaptureCall(node, directive) {
    const functionName = functionNameAt(node);
    const named = directive.variables.map(variable =>
      `::asm_trace::named(${cppString(variable.id)}, ${cppString(variable.name)}, (${variable.name}))`);
    const statementId = `manual-frame:${functionName}:${directive.line}:${directive.index}`;
    return `::asm_trace::capture(${directive.line}, ${cppString(functionName)}, ${cppString(statementId)}, "manual-frame"${named.length ? `, ${named.join(', ')}` : ''});`;
  }

  function keepOperationCall(node, directive) {
    const functionName = functionNameAt(node);
    const statementId = `manual-keep:${functionName}:${directive.line}:${directive.index}`;
    if (directive.mode === 'last') {
      return `::asm_trace::event_keep_last(${directive.line}, ${cppString(statementId)}, ${cppString(directive.label)});`;
    }
    const variable = directive.variable;
    return `::asm_trace::event_keep(${directive.line}, ${cppString(statementId)}, ${cppString(variable.id)}, ${cppString(variable.name)}, ${cppString(directive.label)}, (${variable.name}));`;
  }

  function targetArgs(target) {
    return `${cppString(target.variableId)}, ${cppString(target.expression)}, ${cppString(target.indexExpression)}`;
  }

  function declarationEvents(node) {
    return selected
      .filter(variable => variable.declarationKind === 'local' && variable.declarationFrom === node.from)
      .map(variable => `::asm_trace::event_declare(${variable.line}, ${cppString(`declare:${variable.functionName}:${variable.line}:${variable.name}`)}, ${cppString(variable.id)}, ${cppString(variable.name)}, ${cppString(variable.kind)}, (${variable.name}));`)
      .join('\n');
  }

  function parameterEvents(bodyNode, functionName) {
    return selected
      .filter(variable => variable.declarationKind === 'parameter'
        && variable.functionName === functionName
        && variable.scopeFrom === bodyNode.from)
      .map(variable => `::asm_trace::event_declare(${variable.line}, ${cppString(`declare:${variable.functionName}:${variable.line}:${variable.name}`)}, ${cppString(variable.id)}, ${cppString(variable.name)}, ${cppString(variable.kind)}, (${variable.name}));`)
      .join('\n');
  }

  function rebuild(node, context = {}) {
    const children = childrenOf(node);
    const suppressEvents = context.suppressEvents === true || isForHeaderExpression(node);
    const nestedContext = suppressEvents ? { ...context, suppressEvents: true } : context;
    let rendered;

    if (node.name === 'LineComment' && directiveByPosition.has(node.from)) {
      const directive = directiveByPosition.get(node.from);
      rendered = `${source.slice(node.from, node.to)}\n${directiveCaptureCall(node, directive)}`;
    } else if (node.name === 'LineComment' && keepDirectiveByPosition.has(node.from)) {
      const directive = keepDirectiveByPosition.get(node.from);
      rendered = `${source.slice(node.from, node.to)}\n${keepOperationCall(node, directive)}`;
    } else if (node.name === 'Identifier') {
      const text = source.slice(node.from, node.to);
      const watch = watchAt(text, node.from);
      const parent = node.parent;
      const isCallee = parent?.name === 'CallExpression' && parent.firstChild?.from === node.from;
      const ignored = suppressEvents || context.suppressRead || declarationPositions.has(node.from) || isCallee
        || ['FunctionDeclarator', 'TypeIdentifier', 'FieldIdentifier', 'NamespaceIdentifier'].includes(parent?.name);
      if (watch && !ignored) {
        const target = targetDescriptor(node);
        rendered = `(::asm_trace::event_read(${analysis.lineAt(node.from)}, ${cppString(signature('read', node))}, ${targetArgs(target)}), (${text}))`;
      } else {
        rendered = text;
      }
    } else if (node.name === 'SubscriptExpression') {
      const target = targetDescriptor(node);
      const parts = [];
      let cursor = node.from;
      for (const child of children) {
        parts.push(source.slice(cursor, child.from));
        parts.push(rebuild(child, { ...nestedContext, suppressRead: child === children[0] }));
        cursor = child.to;
      }
      parts.push(source.slice(cursor, node.to));
      const expression = parts.join('');
      if (target.variableId && !suppressEvents && !context.suppressRead) {
        rendered = `(::asm_trace::event_read(${analysis.lineAt(node.from)}, ${cppString(signature('read', node))}, ${targetArgs(target)}), (${expression}))`;
      } else {
        rendered = expression;
      }
    } else if (node.name === 'ConditionClause') {
      const expressionNode = children.find(child => !['(', ')'].includes(child.name));
      if (expressionNode) {
        const expression = rebuild(expressionNode, nestedContext);
        const conditionKind = node.parent?.name || 'Condition';
        rendered = suppressEvents
          ? expression
          : `(::asm_trace::event_condition(${analysis.lineAt(node.from)}, ${cppString(signature('condition', node))}, ${cppString(conditionKind)}, [&](){ return static_cast<bool>(${expression}); }))`;
      }
    } else if (node.name === 'AssignmentExpression' || node.name === 'UpdateExpression') {
      const targetNode = node.name === 'AssignmentExpression' ? children[0] : children.find(child => containsSelectedReference(child));
      const target = targetDescriptor(targetNode);
      const sourceNode = node.name === 'AssignmentExpression' ? children[children.length - 1] : null;
      const sourceTarget = targetDescriptor(sourceNode);
      const assignmentOperator = targetNode && sourceNode
        ? source.slice(targetNode.to, sourceNode.from).trim()
        : '';
      const forHeaderWrite = isForHeaderExpression(node);
      const standalone = node.parent?.name === 'ExpressionStatement' || forHeaderWrite;
      const parts = [];
      let cursor = node.from;
      for (const child of children) {
        parts.push(source.slice(cursor, child.from));
        parts.push(rebuild(child, { ...nestedContext, suppressRead: child === targetNode }));
        cursor = child.to;
      }
      parts.push(source.slice(cursor, node.to));
      const expression = parts.join('');
      if (target.variableId && standalone && !suppressEvents) {
        const sourceExpression = compactExpression(source.slice(node.from, node.to));
        const targetAccess = compactExpression(source.slice(targetNode.from, targetNode.to));
        const animatedAssignment = node.name === 'AssignmentExpression'
          && assignmentOperator === '='
          && node.parent?.name === 'ExpressionStatement';
        if (forHeaderWrite) {
          rendered = expression;
        } else if (animatedAssignment) {
          rendered = `::asm_trace::event_assign(${analysis.lineAt(node.from)}, ${cppString(signature('assign', node))}, ${targetArgs(target)}, ${targetArgs(sourceTarget)}, ${cppString(sourceExpression)}, [&]()->decltype(auto){ return (${targetAccess}); }, [&](){ ${expression}; }, [&]()->decltype(auto){ return (${targetAccess}); })`;
        } else {
        const readsOldValue = node.name === 'UpdateExpression'
          || children.some(child => child.name === 'UpdateOp');
        const beforeWrite = readsOldValue
          ? `::asm_trace::event_read(${analysis.lineAt(node.from)}, ${cppString(signature('read', node))}, ${targetArgs(target)}), `
          : '';
          rendered = `(${beforeWrite}::asm_trace::event_write(${analysis.lineAt(node.from)}, ${cppString(signature('write', node))}, ${targetArgs(target)}, ${cppString(sourceExpression)}, [&](){ ${expression}; }))`;
        }
      } else {
        rendered = expression;
      }
    } else if (node.name === 'BinaryExpression') {
      const operatorNode = children.find(child => child.name === 'CompareOp'
        && COMPARISON_OPERATORS.has(source.slice(child.from, child.to)));
      if (!suppressEvents && operatorNode && containsSelectedReference(node)) {
        const operatorIndex = children.indexOf(operatorNode);
        const leftNode = children[operatorIndex - 1];
        const rightNode = children[operatorIndex + 1];
        const operator = source.slice(operatorNode.from, operatorNode.to);
        const left = rebuild(leftNode, context);
        const right = rebuild(rightNode, context);
        const leftTarget = targetDescriptor(leftNode);
        const rightTarget = targetDescriptor(rightNode);
        rendered = `::asm_trace::event_compare(${analysis.lineAt(node.from)}, ${cppString(signature('compare', node))}, ${targetArgs(leftTarget)}, ${targetArgs(rightTarget)}, ${cppString(operator)}, [&]()->decltype(auto){ return (${left}); }, [&]()->decltype(auto){ return (${right}); }, [](const auto& __asm_l, const auto& __asm_r){ return __asm_l ${operator} __asm_r; })`;
      }
    } else if (node.name === 'CallExpression') {
      const calleeNode = children[0];
      const callee = compactExpression(source.slice(calleeNode.from, calleeNode.to));
      const parts = [];
      let cursor = node.from;
      for (const child of children) {
        parts.push(source.slice(cursor, child.from));
        parts.push(rebuild(child, { ...nestedContext, suppressRead: child === calleeNode }));
        cursor = child.to;
      }
      parts.push(source.slice(cursor, node.to));
      const expression = parts.join('');
      const argumentList = children.find(child => child.name === 'ArgumentList');
      const args = argumentList ? childrenOf(argumentList).filter(child => !['(', ')', ','].includes(child.name)) : [];
      const calleeChildren = calleeNode?.name === 'FieldExpression' ? childrenOf(calleeNode) : [];
      const methodNode = calleeChildren.find(child => child.name === 'FieldIdentifier');
      const method = methodNode ? source.slice(methodNode.from, methodNode.to) : '';
      const mutationBase = calleeChildren.find(child => child !== methodNode && !['.', '->'].includes(child.name));
      const mutationTarget = mutationBase ? targetDescriptor(mutationBase) : null;
      if (suppressEvents) {
        rendered = expression;
      } else if (/(?:^|::)swap$/.test(callee) && node.parent?.name === 'ExpressionStatement' && args.length >= 2) {
        const leftTarget = targetDescriptor(args[0]);
        const rightTarget = targetDescriptor(args[1]);
        rendered = `::asm_trace::event_swap(${analysis.lineAt(node.from)}, ${cppString(signature('swap', node))}, ${targetArgs(leftTarget)}, ${targetArgs(rightTarget)}, [&](){ ${expression}; })`;
      } else if (mutationTarget?.variableId && MUTATING_METHODS.has(method)
        && node.parent?.name === 'ExpressionStatement') {
        rendered = `::asm_trace::event_write(${analysis.lineAt(node.from)}, ${cppString(signature('write', node))}, ${targetArgs(mutationTarget)}, ${cppString(method)}, [&](){ ${expression}; })`;
      } else {
        rendered = `(::asm_trace::event_call(${analysis.lineAt(node.from)}, ${cppString(signature('call', node))}, ${cppString(callee)}, ${cppString(compactExpression(source.slice(node.from, node.to)))}), (${expression}))`;
      }
    }

    if (rendered == null) {
      const parts = [];
      let cursor = node.from;
      for (const child of children) {
        parts.push(source.slice(cursor, child.from));
        parts.push(rebuild(child, nestedContext));
        cursor = child.to;
      }
      parts.push(source.slice(cursor, node.to));
      rendered = parts.join('');
    }

    if (node.name === 'CompoundStatement' && node.parent?.name === 'FunctionDefinition') {
      const info = functionInfo(node.parent, source);
      const openOffset = rendered.indexOf('{');
      const closeOffset = rendered.lastIndexOf('}');
      if (openOffset >= 0 && closeOffset > openOffset) {
        const parameters = parameterEvents(node, info.name);
        const enterCapture = manualFrames ? '' : captureCall(node, 'function-enter');
        const exitCapture = manualFrames ? '' : captureCall(node, 'function-exit');
        const enter = `\n::asm_trace::event_function(${analysis.lineAt(node.parent.from)}, ${cppString(signature('function-enter', node.parent))}, ${cppString(info.name)}, true);\n${parameters ? `${parameters}\n` : ''}${enterCapture}\n`;
        const exit = `\n::asm_trace::event_function(${analysis.lineAt(node.to - 1)}, ${cppString(signature('function-exit', node.parent))}, ${cppString(info.name)}, false);\n${exitCapture}\n`;
        rendered = `${rendered.slice(0, openOffset + 1)}${enter}${rendered.slice(openOffset + 1, closeOffset)}${exit}${rendered.slice(closeOffset)}`;
      }
    }

    if (node.name === 'ReturnStatement') {
      const fn = functionNameAt(node);
      const returnCapture = manualFrames ? '' : `${captureCall(node, 'return')}\n`;
      rendered = `::asm_trace::event_function(${analysis.lineAt(node.from)}, ${cppString(signature('function-return', node))}, ${cppString(fn)}, false);\n${returnCapture}${rendered}`;
    } else if (CHECKPOINT_NODES.has(node.name) && node.parent?.name === 'CompoundStatement') {
      const declarations = node.name === 'Declaration' ? declarationEvents(node) : '';
      const checkpoint = manualFrames ? '' : captureCall(node);
      rendered = `${rendered}\n${declarations ? `${declarations}\n` : ''}${checkpoint}`;
    }

    return rendered;
  }

  const instrumented = `#include "ASMTrace.hpp"\n${rebuild(analysis.tree.topNode)}`;
  return {
    code: instrumented,
    variables: selected,
    allVariables: analysis.variables,
    frameDirectives: indexedFrameDirectives,
    keepDirectives: indexedKeepDirectives
  };
}

module.exports = {
  analyzeSource,
  findFrameDirectives,
  findKeepDirectives,
  instrumentSource,
  inferKind
};
