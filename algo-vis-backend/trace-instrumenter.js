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

function descendantCount(node, name) {
  if (!node) return 0;
  let count = node.name === name ? 1 : 0;
  for (let child = node.firstChild; child; child = child.nextSibling) {
    count += descendantCount(child, name);
  }
  return count;
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

function stableSourceHash(value) {
  let hash = 2166136261;
  for (const character of String(value || '')) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function canonicalFrameIdentity(directive) {
  const name = String(directive?.name || '').trim();
  if (name) return `name:${name}`;
  const frameSpec = String(directive?.frameSpec || '')
    .replace(/\s+/g, '')
    .toLowerCase();
  const renderer = String(directive?.renderer || '');
  const rendererOptions = JSON.stringify(directive?.rendererOptions || {}).replace(/\s+/g, '');
  const when = String(directive?.when?.expression || '').replace(/\s+/g, '');
  return `frame:${frameSpec}|render:${renderer}|with:${rendererOptions}|when:${when}`;
}

function logicalFrameIdentity(directive) {
  const name = String(directive?.name || '').trim();
  if (name) return `name:${name}`;
  return `frame:${String(directive?.frameSpec || '').replace(/\s+/g, '').toLowerCase()}`;
}

function legacyFrameTextVariants(value) {
  const text = compactExpression(value);
  const match = text.match(/^(\/\/\s*(?:[A-Za-z_][A-Za-z0-9_.-]*\s*:\s*)?@frame\b)\s*(.*?)\s*$/i);
  if (!match) return [text];
  const payload = match[2] || '';
  const positions = topLevelModifierPositions(payload);
  if (!positions.length) return [text];
  const base = payload.slice(0, positions[0].index).trim();
  const modifiers = positions.map((position, index) => (
    payload.slice(position.index, positions[index + 1]?.index ?? payload.length).trim()
  ));
  const variants = new Set();
  const prefix = [match[1], base].filter(Boolean).join(' ');
  const count = 1 << modifiers.length;
  for (let mask = 0; mask < count; mask += 1) {
    const selected = modifiers.filter((_, index) => mask & (1 << index));
    variants.add(compactExpression([prefix, ...selected].filter(Boolean).join(' ')));
  }
  variants.add(text);
  return [...variants];
}

function syntaxNodeEventType(node, source) {
  const name = String(node?.name || '');
  if (name === 'FunctionDefinition') return 'function-enter';
  if (name === 'ReturnStatement') return 'function-exit';
  if (/^(?:Declaration|ParameterDeclaration|TypeDefinition|NamespaceDefinition)$/.test(name)
    || /(?:Declarator|Type|Specifier)$/.test(name)) return 'declare';
  if (/^(?:IfStatement|ForStatement|WhileStatement|DoStatement|SwitchStatement|ConditionClause)$/.test(name)) {
    return 'condition';
  }
  if (name === 'CompareOp' || (name === 'BinaryExpression' && descendantCount(node, 'CompareOp') > 0)) {
    return 'compare';
  }
  if (/^(?:AssignmentExpression|UpdateExpression|UpdateOp)$/.test(name)) return 'write';
  if (name === 'CallExpression') {
    return /(?:^|::)swap\s*\(/.test(compactExpression(source.slice(node.from, node.to))) ? 'swap' : 'call';
  }
  if (/^(?:Identifier|FieldIdentifier|Number|String|Char|Bool|Null|This)$/.test(name)) return 'read';
  if (name === 'Program' || name === 'CompoundStatement') return 'call';
  return 'fixed';
}

function buildSyntaxTree(source) {
  const tree = parser.parse(source);
  const lineAt = lineMap(source);
  let nextId = 0;

  function serialize(node, depth = 0) {
    const children = childrenOf(node).map(child => serialize(child, depth + 1));
    const rawText = children.length ? '' : compactExpression(source.slice(node.from, node.to));
    return {
      id: `syntax-${nextId++}`,
      type: node.name === '⚠' ? 'Error' : node.name,
      text: rawText.slice(0, 48),
      line: lineAt(node.from),
      from: node.from,
      to: node.to,
      depth,
      eventType: syntaxNodeEventType(node, source),
      children
    };
  }

  const root = serialize(tree.topNode);
  return { root, nodeCount: nextId, length: source.length };
}

function inferKind(type, declaratorText = '', arrayDimensions = 0) {
  const normalized = `${type} ${declaratorText}`.replace(/\s+/g, ' ');
  if (arrayDimensions >= 2 || /vector\s*<\s*vector\s*</.test(normalized)) return 'matrix';
  if (arrayDimensions === 1 || /vector\s*</.test(normalized) || /deque\s*</.test(normalized) || /list\s*</.test(normalized)
    || /array\s*</.test(normalized)) return 'sequence';
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
      arrayDimensions: descendantCount(declarator, 'ArrayDeclarator'),
      type
    };
  });
}

function parameterVariables(node, source) {
  const declarator = childrenOf(node).find(child => DECLARATOR_NODES.has(child.name))
    || firstDescendant(node, DECLARATOR_NODES);
  const identifier = declaratorIdentifier(declarator);
  if (!identifier) return [];
  return [{
    name: source.slice(identifier.from, identifier.to),
    nameFrom: identifier.from,
    nameTo: identifier.to,
    declarationFrom: node.from,
    declarationTo: node.to,
    declaratorText: source.slice(identifier.from, node.to),
    arrayDimensions: descendantCount(declarator, 'ArrayDeclarator'),
    type: compactExpression(source.slice(node.from, identifier.from))
  }];
}

function rangeLoopVariables(node, source) {
  const children = childrenOf(node);
  const openParen = children.find(child => child.name === '(');
  const body = children.find(child => child.name === 'CompoundStatement')
    || children.find(child => child.name.endsWith('Statement'));
  if (!openParen || !body) return [];
  const declarator = children.find(child => child.from >= openParen.to
    && child.to <= body.from
    && (DECLARATOR_NODES.has(child.name) || child.name === 'StructuredBindingDeclarator'));
  if (!declarator) return [];
  const binding = firstDescendant(declarator, new Set(['StructuredBindingDeclarator']));
  const identifiers = binding
    ? childrenOf(binding).filter(child => child.name === 'Identifier')
    : [declaratorIdentifier(declarator)].filter(Boolean);
  return identifiers.map(identifier => ({
    name: source.slice(identifier.from, identifier.to),
    nameFrom: identifier.from,
    nameTo: identifier.to,
    declarationFrom: openParen.to,
    declarationTo: declarator.to,
    declaratorText: source.slice(declarator.from, declarator.to),
    arrayDimensions: 0,
    type: compactExpression(source.slice(openParen.to, declarator.from))
  }));
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
    } else if (node.name === 'ForStatement' || node.name === 'ForRangeLoop') {
      nextContext = { ...context, scope: node };
    }

    let found = [];
    if (node.name === 'Declaration') found = declarationVariables(node, source, variables);
    if (node.name === 'ParameterDeclaration') found = parameterVariables(node, source);
    if (node.name === 'ForRangeLoop') found = rangeLoopVariables(node, source);
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
        kind: inferKind(variable.type, variable.declaratorText, variable.arrayDimensions),
        supported: true
      });
    }

    for (let child = node.firstChild; child; child = child.nextSibling) visit(child, nextContext);
  }

  visit(tree.topNode, { functionName: 'global', functionBody: null, scope: tree.topNode });
  return { tree, variables, lineAt };
}

function presetContains(analysis, position) {
  return (analysis.presetRanges || []).some(range => range.from <= position && position < range.to);
}

function framePresetNames(frame, analysis) {
  return [
    ...(analysis.presetDefinitions?.has('@defaults') ? ['@defaults'] : []),
    ...(frame.presetNames || (frame.presetName ? [frame.presetName] : []))
  ];
}

function findPresetDirectives(source, analysis) {
  const definitions = new Map();
  const ranges = [];
  let open = null;
  let continuationEnd = -1;

  function visit(node) {
    if (node.name === 'LineComment') {
      const text = source.slice(node.from, node.to);
      const line = analysis.lineAt(node.from);
      const defaultsStart = text.match(/^\/\/\s*@defaults\b\s*(.*?)\s*$/i);
      const defaultsEnd = text.match(/^\/\/\s*@enddefaults\b\s*(.*?)\s*$/i);
      const start = defaultsStart || text.match(/^\/\/\s*@preset\b\s*(.*?)\s*$/i);
      const end = defaultsEnd || text.match(/^\/\/\s*@endpreset\b\s*(.*?)\s*$/i);
      if (start) {
        if (open) throw new Error(`第 ${line} 行的 @preset 不可巢狀`);
        if (defaultsStart && start[1]) throw new Error(`第 ${line} 行的 @defaults 不接受參數`);
        const name = defaultsStart ? '@defaults' : start[1];
        if (!defaultsStart && !/^[A-Za-z_]\w*$/.test(name)) throw new Error(`第 ${line} 行的 @preset 名稱無效：${name}`);
        if (definitions.has(name)) throw new Error(`第 ${line} 行的 @preset 名稱重複：${name}`);
        open = { name, from: node.from, line, directives: [] };
        continuationEnd = node.to;
      } else if (end) {
        if (end[1]) throw new Error(`第 ${line} 行的 @endpreset 不接受參數`);
        if (!open) throw new Error(`第 ${line} 行的 @endpreset 前面沒有 @preset`);
        if (Boolean(defaultsEnd) !== (open.name === '@defaults')) {
          throw new Error(`第 ${line} 行的預設區塊結束指令不相符`);
        }
        if (!/^\s*$/.test(source.slice(continuationEnd, node.from))) {
          throw new Error(`第 ${line} 行的 @preset 只能包含連續的指令`);
        }
        if (!open.directives.length) {
          throw new Error(`第 ${open.line} 行的 @preset 至少需要一個指令`);
        }
        definitions.set(open.name, open);
        ranges.push({ from: open.from, to: node.to });
        open = null;
      } else if (open) {
        if (!/^\s*$/.test(source.slice(continuationEnd, node.from))) {
          throw new Error(`第 ${line} 行的 @preset 只能包含連續的指令`);
        }
        const directive = text.match(/^\/\/\s*@([A-Za-z_-]+)\b\s*(.*?)\s*$/);
        if (!directive) throw new Error(`第 ${line} 行的 @preset 內容必須是 @ 指令`);
        if (open.name === '@defaults' && !['camera', 'place', 'style', 'object', 'text', 'segment', 'arrow'].includes(directive[1].toLowerCase())) {
          throw new Error(`第 ${line} 行的 @defaults 只支援呈現指令，不支援 @${directive[1]}`);
        }
        open.directives.push({ name: directive[1].toLowerCase(), payload: directive[2], line });
        continuationEnd = node.to;
      }
    }
    for (let child = node.firstChild; child; child = child.nextSibling) visit(child);
  }

  visit(analysis.tree.topNode);
  if (open) throw new Error(`第 ${open.line} 行的 @preset 缺少 @endpreset`);
  analysis.presetDefinitions = definitions;
  analysis.presetRanges = ranges;
  return definitions;
}

function cppString(value) {
  return JSON.stringify(String(value == null ? '' : value));
}

const TEMPORAL_TRACE_FUNCTIONS = new Set(['before', 'prev', 'changed', 'assigned']);

function parseTraceExpression(expression, allowCondition = false) {
  const source = String(expression || '').trim();
  const tokens = [];
  const temporalFunctions = [];
  const iterationIdentifiers = [];
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
      const logicalOperator = allowCondition
        ? ({ and: '&&', or: '||' }[identifier[0]] || '')
        : '';
      tokens.push(logicalOperator
        ? { type: 'operator', value: logicalOperator }
        : { type: 'identifier', value: identifier[0] });
      cursor += identifier[0].length;
      continue;
    }
    const compoundOperator = source.slice(cursor).match(/^(?:&&|\|\||==|!=|<=|>=)/);
    if (compoundOperator) {
      tokens.push({ type: 'operator', value: compoundOperator[0] });
      cursor += compoundOperator[0].length;
      continue;
    }
    if ('+-*/%()[].<>!'.includes(source[cursor])) {
      tokens.push({ type: 'operator', value: source[cursor] });
      cursor += 1;
      continue;
    }
    return { valid: false, identifiers: [], temporalFunctions: [] };
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
      if (!(allowCondition ? parseLogicalOr() : parseAdditive()) || !consume(')')) return false;
      return true;
    }
    const token = tokens[position];
    if (!token) return false;
    if (token.type === 'number') {
      position += 1;
      return true;
    }
    if (token.type !== 'identifier') return false;
    if (token.value === 'true' || token.value === 'false') {
      position += 1;
      return true;
    }
    if (token.value === 'iteration'
      && tokens[position + 1]?.value === '.'
      && tokens[position + 2]?.value === 'last'
      && tokens[position + 3]?.value === '('
      && tokens[position + 4]?.type === 'identifier'
      && tokens[position + 5]?.value === ')') {
      iterationIdentifiers.push(tokens[position + 4].value);
      position += 6;
      return true;
    }
    if (TEMPORAL_TRACE_FUNCTIONS.has(token.value) && tokens[position + 1]?.value === '(') {
      temporalFunctions.push(token.value);
      position += 2;
      if (!(allowCondition ? parseLogicalOr() : parseAdditive()) || !consume(')')) return false;
      return true;
    }
    identifiers.push(token.value);
    position += 1;
    while (peek('[')) {
      consume('[');
      if (!parseAdditive() || !consume(']')) return false;
    }
    if (peek('.')) {
      consume('.');
      if (tokens[position]?.type !== 'identifier'
        || !['length', 'size'].includes(tokens[position]?.value)) return false;
      position += 1;
      if (peek('(')) {
        consume('(');
        if (!consume(')')) return false;
      }
    }
    return true;
  }

  function parseUnary() {
    if (peek('+') || peek('-') || (allowCondition && peek('!'))) {
      consume();
      return parseUnary();
    }
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

  function parseRelational() {
    if (!parseAdditive()) return false;
    while (peek('<') || peek('<=') || peek('>') || peek('>=')) {
      consume();
      if (!parseAdditive()) return false;
    }
    return true;
  }

  function parseEquality() {
    if (!parseRelational()) return false;
    while (peek('==') || peek('!=')) {
      consume();
      if (!parseRelational()) return false;
    }
    return true;
  }

  function parseLogicalAnd() {
    if (!parseEquality()) return false;
    while (peek('&&')) {
      consume();
      if (!parseEquality()) return false;
    }
    return true;
  }

  function parseLogicalOr() {
    if (!parseLogicalAnd()) return false;
    while (peek('||')) {
      consume();
      if (!parseLogicalAnd()) return false;
    }
    return true;
  }

  const valid = tokens.length > 0
    && (allowCondition ? parseLogicalOr() : parseAdditive())
    && position === tokens.length;
  return {
    valid,
    identifiers: [...new Set(identifiers)],
    temporalFunctions: [...new Set(temporalFunctions)],
    iterationIdentifiers: [...new Set(iterationIdentifiers)]
  };
}

function parseFrameExpression(expression) {
  return parseTraceExpression(expression, false);
}

function parseConditionExpression(expression) {
  return parseTraceExpression(expression, true);
}

function splitTopLevel(value, delimiter = ',') {
  const source = String(value || '');
  const parts = [];
  const stack = [];
  const pairs = { '(': ')', '[': ']' };
  let start = 0;

  for (let index = 0; index < source.length; index += 1) {
    const token = source[index];
    if (pairs[token]) {
      stack.push(pairs[token]);
      continue;
    }
    if (token === ')' || token === ']') {
      if (stack.pop() !== token) return { parts: [], valid: false };
      continue;
    }
    if (token === delimiter && !stack.length) {
      parts.push(source.slice(start, index).trim());
      start = index + 1;
    }
  }

  if (stack.length) return { parts: [], valid: false };
  parts.push(source.slice(start).trim());
  return { parts, valid: true };
}

const DIRECTIVE_MODIFIERS = new Set(['as', 'at', 'when', 'offset', 'render', 'with', 'without']);
const FRAME_DIRECTIVE_MODIFIERS = new Set([...DIRECTIVE_MODIFIERS, 'in']);
const KEEP_DIRECTIVE_MODIFIERS = new Set([...DIRECTIVE_MODIFIERS, 'in']);
const PLACE_DIRECTIVE_MODIFIERS = new Set(['at', 'offset', 'when']);
const DIRECTIVE_ANCHORS = new Set([
  'top-left', 'top', 'top-right', 'left', 'center', 'right',
  'bottom-left', 'bottom', 'bottom-right'
]);
const FRAME_RENDERERS = new Map([
  ['normal', 'original-array'],
  ['array', 'original-array'],
  ['sequence', 'original-array'],
  ['heap', 'original-heap'],
  ['segment-tree', 'original-segment-tree'],
  ['segment_tree', 'original-segment-tree'],
  ['segmenttree', 'original-segment-tree'],
  ['bit', 'original-bit'],
  ['fenwick', 'original-bit'],
  ['disk', 'original-disk'],
  ['stack', 'original-stack'],
  ['queue', 'original-queue'],
  ['matrix', 'original-matrix'],
  ['2d-array', 'original-matrix'],
  ['cell', 'original-cell'],
  ['scalar', 'original-cell']
]);

function parseRendererOptions(value, line, directiveName) {
  const split = splitTopLevel(value);
  if (!split.valid || split.parts.some(part => !part)) {
    throw new Error(`第 ${line} 行的 ${directiveName} with 格式無效`);
  }

  const options = {};
  for (const part of split.parts) {
    const match = part.match(/^([A-Za-z_][A-Za-z0-9_-]*)\s*\((.*)\)$/s);
    if (!match) throw new Error(`第 ${line} 行的 ${directiveName} with 選項格式無效：${part}`);
    const name = match[1].toLowerCase();
    if (Object.prototype.hasOwnProperty.call(options, name)) {
      throw new Error(`第 ${line} 行的 ${directiveName} 重複使用 with ${name}`);
    }
    const args = splitTopLevel(match[2]);
    if (!args.valid || args.parts.some(argument => !argument)) {
      throw new Error(`第 ${line} 行的 ${directiveName} with ${name} 參數格式無效`);
    }

    if (name === 'range') {
      if (args.parts.length !== 2) {
        throw new Error(`第 ${line} 行的 ${directiveName} range 必須是 range(start,end)`);
      }
      const parsed = args.parts.map(expression => ({ expression, parsed: parseFrameExpression(expression) }));
      const invalid = parsed.find(item => !item.parsed.valid);
      if (invalid) throw new Error(`第 ${line} 行的 ${directiveName} range 運算式無效：${invalid.expression}`);
      options.range = {
        startExpression: parsed[0].expression,
        endExpression: parsed[1].expression,
        endInclusive: true,
        identifiers: [...new Set(parsed.flatMap(item => item.parsed.identifiers || []))]
      };
      continue;
    }

    if (name === 'columns') {
      if (args.parts.length !== 1 || !parseFrameExpression(args.parts[0]).valid) {
        throw new Error(`第 ${line} 行的 ${directiveName} columns 必須是 columns(count)`);
      }
      const parsed = parseFrameExpression(args.parts[0]);
      options.columns = {
        expression: args.parts[0],
        identifiers: parsed.identifiers || []
      };
      continue;
    }

    if (name === 'labels') {
      const labels = args.parts.map(label => label.trim().toLowerCase());
      const allowed = new Set(['value', 'index', 'binary-index', 'binary-index-padded']);
      const invalid = labels.find(label => !allowed.has(label));
      if (invalid || new Set(labels).size !== labels.length) {
        throw new Error(`第 ${line} 行的 ${directiveName} labels 只支援 value、index、binary-index、binary-index-padded`);
      }
      const indexLabels = labels.filter(label => label !== 'value');
      if (indexLabels.length > 1 || (!labels.includes('value') && !labels.includes('index'))) {
        throw new Error(`第 ${line} 行的 ${directiveName} labels 組合無效：${match[2]}`);
      }
      options.labels = {
        showValue: labels.includes('value'),
        indexFormat: labels.includes('binary-index-padded')
          ? 'binary-padded'
          : labels.includes('binary-index') ? 'binary' : labels.includes('index') ? 'decimal' : 'none'
      };
      continue;
    }

    if (name === 'showwidth') {
      if (args.parts.length !== 1 || !/^(?:true|false)$/i.test(args.parts[0])) {
        throw new Error(`第 ${line} 行的 ${directiveName} showWidth 必須是 showWidth(true) 或 showWidth(false)`);
      }
      options.showWidth = args.parts[0].toLowerCase() === 'true';
      continue;
    }

    throw new Error(`第 ${line} 行的 ${directiveName} 不支援 with ${name}`);
  }
  return options;
}

function topLevelModifierPositions(value, acceptedModifiers = DIRECTIVE_MODIFIERS) {
  const source = String(value || '');
  const positions = [];
  const stack = [];
  const pairs = { '(': ')', '[': ']', '{': '}' };
  let quote = '';
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const token = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (token === '\\') escaped = true;
      else if (token === quote) quote = '';
      continue;
    }
    if (token === '"' || token === "'") {
      quote = token;
      continue;
    }
    if (pairs[token]) {
      stack.push(pairs[token]);
      continue;
    }
    if (token === ')' || token === ']' || token === '}') {
      if (stack.at(-1) === token || (token === ')' && stack.at(-1) === ']')) stack.pop();
      continue;
    }
    if (stack.length || (index > 0 && /[A-Za-z0-9_]/.test(source[index - 1]))) continue;
    const word = source.slice(index).match(/^[A-Za-z_][A-Za-z0-9_]*/)?.[0] || '';
    if (!acceptedModifiers.has(word.toLowerCase())) continue;
    const after = source[index + word.length] || '';
    if (after && /[A-Za-z0-9_]/.test(after)) continue;
    positions.push({ index, name: word.toLowerCase(), length: word.length });
    index += word.length - 1;
  }
  return positions;
}

function parseAtBinding(value, line, directiveName, offsetX = 0, offsetY = 0) {
  const raw = String(value || '').trim();
  const anchorMatch = raw.match(/^(.+?)\.(top-left|top|top-right|left|center|right|bottom-left|bottom|bottom-right)$/i);
  if (!anchorMatch) {
    throw new Error(`第 ${line} 行的 ${directiveName} 定位格式無效：${raw}`);
  }
  const targetExpression = anchorMatch[1].trim();
  const anchor = anchorMatch[2].toLowerCase();
  if (!DIRECTIVE_ANCHORS.has(anchor)) {
    throw new Error(`第 ${line} 行的 ${directiveName} 定位錨點無效：${anchor}`);
  }
  const canvasTarget = targetExpression.toLowerCase() === 'canvas';
  const target = canvasTarget ? null : targetExpression.match(/^([A-Za-z_][A-Za-z0-9_.-]*)/);
  if (!canvasTarget && !target) {
    throw new Error(`第 ${line} 行的 ${directiveName} 定位目標無效：${targetExpression}`);
  }

  const indexExpressions = [];
  if (target) {
    let cursor = target[0].length;
    while (cursor < targetExpression.length) {
      while (cursor < targetExpression.length && /\s/.test(targetExpression[cursor])) cursor += 1;
      if (cursor >= targetExpression.length) break;
      if (targetExpression[cursor] !== '[') {
        throw new Error(`第 ${line} 行的 ${directiveName} 定位目標無效：${targetExpression}`);
      }
      const start = ++cursor;
      let depth = 1;
      while (cursor < targetExpression.length && depth > 0) {
        if (targetExpression[cursor] === '[') depth += 1;
        else if (targetExpression[cursor] === ']') depth -= 1;
        cursor += 1;
      }
      if (depth !== 0) {
        throw new Error(`第 ${line} 行的 ${directiveName} 定位目標無效：${targetExpression}`);
      }
      const expression = targetExpression.slice(start, cursor - 1).trim();
      const parsedIndex = parseFrameExpression(expression);
      if (!parsedIndex.valid) {
        throw new Error(`第 ${line} 行的 ${directiveName} 索引運算式無效：${expression}`);
      }
      indexExpressions.push(expression);
    }
  }
  return {
    type: 'semantic',
    targetExpression,
    targetName: target?.[1] || '',
    indexExpressions,
    anchor,
    offsetX,
    offsetY,
    canvas: canvasTarget
  };
}

function parseDirectiveModifiers(payload, line, directiveName, acceptedModifiers = DIRECTIVE_MODIFIERS) {
  const source = String(payload || '').trim();
  const positions = topLevelModifierPositions(source, acceptedModifiers);
  if (!positions.length) return {
    payload: source, objectId: '', layoutId: '', binding: null, when: null, renderer: '', rendererOptions: {}
  };

  const base = source.slice(0, positions[0].index).trim();
  const values = new Map();
  positions.forEach((position, index) => {
    if (values.has(position.name)) {
      throw new Error(`第 ${line} 行的 ${directiveName} 重複使用 ${position.name}`);
    }
    const end = positions[index + 1]?.index ?? source.length;
    const value = source.slice(position.index + position.length, end).trim();
    if (!value) throw new Error(`第 ${line} 行的 ${directiveName} 缺少 ${position.name} 內容`);
    values.set(position.name, value);
  });

  let objectId = '';
  if (values.has('as')) {
    objectId = values.get('as');
    if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(objectId)) {
      throw new Error(`第 ${line} 行的 ${directiveName} 名稱無效：${objectId}`);
    }
  }

  let layoutId = '';
  if (values.has('in')) {
    layoutId = parseQuotedDirectiveId(values.get('in'), line, `${directiveName} in`);
  }

  let offsetX = 0;
  let offsetY = 0;
  if (values.has('offset')) {
    const offset = values.get('offset').match(/^\(\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*,\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*\)$/);
    if (!offset) throw new Error(`第 ${line} 行的 ${directiveName} offset 格式無效`);
    offsetX = Number(offset[1]) || 0;
    offsetY = Number(offset[2]) || 0;
  }

  const binding = values.has('at')
    ? parseAtBinding(values.get('at'), line, directiveName, offsetX, offsetY)
    : null;
  if (layoutId && binding) {
    throw new Error(`第 ${line} 行的 ${directiveName} 不可同時使用 in 與 at`);
  }
  if (values.has('offset') && !binding) {
    throw new Error(`第 ${line} 行的 ${directiveName} 使用 offset 時必須同時指定 at`);
  }

  let when = null;
  if (values.has('when')) {
    const expression = values.get('when');
    const parsed = parseConditionExpression(expression);
    if (!parsed.valid) throw new Error(`第 ${line} 行的 ${directiveName} 條件無效：${expression}`);
    when = {
      expression,
      identifiers: parsed.identifiers,
      iterationIdentifiers: parsed.iterationIdentifiers || [],
      temporalFunctions: parsed.temporalFunctions || []
    };
  }
  let renderer = '';
  if (values.has('render')) {
    const requested = values.get('render').trim().toLowerCase();
    renderer = FRAME_RENDERERS.get(requested) || '';
    if (!renderer) {
      throw new Error(`第 ${line} 行的 ${directiveName} render 類型無效：${values.get('render')}`);
    }
  }
  const rendererOptions = values.has('with')
    ? parseRendererOptions(values.get('with'), line, directiveName)
    : {};
  return { payload: base, objectId, layoutId, binding, when, renderer, rendererOptions };
}

function parseKeepModifiers(payload, line) {
  const source = String(payload || '').trim();
  const positions = topLevelModifierPositions(source, KEEP_DIRECTIVE_MODIFIERS);
  if (!positions.length) {
    return {
      payload: source,
      label: '',
      layoutId: '',
      binding: null,
      placementOffset: null,
      preserveStyle: true,
      when: null
    };
  }

  const allowed = new Set(['as', 'at', 'offset', 'without', 'when', 'in']);
  const unsupported = positions.find(position => !allowed.has(position.name));
  if (unsupported) {
    throw new Error(`第 ${line} 行的 @keep 不支援 ${unsupported.name}`);
  }
  const base = source.slice(0, positions[0].index).trim();
  const values = new Map();
  positions.forEach((position, index) => {
    if (values.has(position.name)) {
      throw new Error(`第 ${line} 行的 @keep 重複使用 ${position.name}`);
    }
    const end = positions[index + 1]?.index ?? source.length;
    const value = source.slice(position.index + position.length, end).trim();
    if (!value) throw new Error(`第 ${line} 行的 @keep 缺少 ${position.name} 內容`);
    values.set(position.name, value);
  });

  let label = '';
  if (values.has('as')) {
    const raw = values.get('as');
    if (raw.startsWith('"')) {
      try {
        label = JSON.parse(raw);
      } catch {
        throw new Error(`第 ${line} 行的 @keep as 名稱格式無效：${raw}`);
      }
    } else {
      const singleQuoted = raw.match(/^'([^']*)'$/s);
      if (singleQuoted) label = singleQuoted[1];
      else if (/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(raw)) label = raw;
      else throw new Error(`第 ${line} 行的 @keep as 名稱格式無效：${raw}`);
    }
    label = String(label).trim();
    if (!label) throw new Error(`第 ${line} 行的 @keep as 名稱不可為空白`);
  }

  let layoutId = '';
  if (values.has('in')) {
    const raw = values.get('in').trim();
    const quoted = raw.match(/^(["'])([^"']+)\1$/s);
    layoutId = String(quoted ? quoted[2] : raw).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(layoutId)) {
      throw new Error(`第 ${line} 行的 @keep in 排版 ID 無效：${raw}`);
    }
  }

  let offsetX = 0;
  let offsetY = 0;
  if (values.has('offset')) {
    const offset = values.get('offset').match(/^\(\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*,\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*\)$/);
    if (!offset) throw new Error(`第 ${line} 行的 @keep offset 格式無效`);
    offsetX = Number(offset[1]) || 0;
    offsetY = Number(offset[2]) || 0;
  }
  const binding = values.has('at')
    ? parseAtBinding(values.get('at'), line, '@keep', offsetX, offsetY)
    : null;
  // Without `at`, offset moves the retained object from the position it had
  // immediately before @keep instead of replacing that source placement.
  const placementOffset = values.has('offset') && !binding
    ? { x: offsetX, y: offsetY }
    : null;
  let preserveStyle = true;
  if (values.has('without')) {
    const feature = values.get('without').trim().toLowerCase();
    if (feature !== 'style') {
      throw new Error(`第 ${line} 行的 @keep without 只支援 style`);
    }
    preserveStyle = false;
  }
  let when = null;
  if (values.has('when')) {
    const expression = values.get('when');
    const parsed = parseConditionExpression(expression);
    if (!parsed.valid) throw new Error(`第 ${line} 行的 @keep 條件無效：${expression}`);
    if ((parsed.temporalFunctions || []).length) {
      throw new Error(`第 ${line} 行的 @keep when 暫不支援跨幀函式：${parsed.temporalFunctions.join(', ')}`);
    }
    when = {
      expression,
      identifiers: parsed.identifiers,
      temporalFunctions: []
    };
  }
  return { payload: base, label, layoutId, binding, placementOffset, preserveStyle, when };
}

const RECURSION_LAYOUT_DEFAULTS = Object.freeze({
  direction: 'top-down',
  mode: 'compact',
  align: 'center',
  siblingGap: 40,
  levelGap: 100,
  degree: 2,
  showEdges: true,
  edgeColor: 'black',
  edgeWidth: 2
});

function parseQuotedDirectiveId(raw, line, directiveName) {
  const value = String(raw || '').trim();
  const quoted = value.match(/^(["'])([^"']+)\1$/s);
  const id = String(quoted ? quoted[2] : value).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(id)) {
    throw new Error(`第 ${line} 行的 ${directiveName} ID 無效：${value}`);
  }
  return id;
}

function findLayoutDirectives(source, suppliedAnalysis = null) {
  const analysis = suppliedAnalysis || analyzeSource(source);
  const entries = [];
  const declarationModifiers = new Set(['as', 'at', 'offset']);

  function visit(node) {
    if (node.name === 'LineComment') {
      const text = source.slice(node.from, node.to);
      if (/^\/\/\s*@layout\b/i.test(text)) {
        entries.push({
          node,
          line: analysis.lineAt(node.from),
          payload: text.replace(/^\/\/\s*@layout\b/i, '').trim()
        });
      }
    }
    for (let child = node.firstChild; child; child = child.nextSibling) visit(child);
  }
  visit(analysis.tree.topNode);

  const layouts = new Map();
  entries.forEach(entry => {
    const { line, payload } = entry;
    if (/^recursion(?:\s|$)/i.test(payload)) {
      const positions = topLevelModifierPositions(payload, declarationModifiers);
      const base = positions.length ? payload.slice(0, positions[0].index).trim() : payload;
      if (base.toLowerCase() !== 'recursion') {
        throw new Error(`第 ${line} 行的 @layout recursion 語法無效`);
      }
      const values = new Map();
      positions.forEach((position, index) => {
        if (values.has(position.name)) {
          throw new Error(`第 ${line} 行的 @layout recursion 重複使用 ${position.name}`);
        }
        const end = positions[index + 1]?.index ?? payload.length;
        const value = payload.slice(position.index + position.length, end).trim();
        if (!value) throw new Error(`第 ${line} 行的 @layout recursion 缺少 ${position.name} 內容`);
        values.set(position.name, value);
      });
      if (!values.has('as')) {
        throw new Error(`第 ${line} 行的 @layout recursion 必須使用 as 指定排版 ID`);
      }
      const id = parseQuotedDirectiveId(values.get('as'), line, '@layout recursion as');
      if (layouts.has(id)) throw new Error(`第 ${line} 行的 @layout ID 重複：${id}`);
      let offsetX = 0;
      let offsetY = values.has('at') ? 0 : 80;
      if (values.has('offset')) {
        const offset = values.get('offset').match(/^\(\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*,\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*\)$/);
        if (!offset) throw new Error(`第 ${line} 行的 @layout offset 格式無效`);
        offsetX = Number(offset[1]) || 0;
        offsetY = Number(offset[2]) || 0;
      }
      const binding = parseAtBinding(values.get('at') || 'canvas.top', line, '@layout', offsetX, offsetY);
      layouts.set(id, {
        id,
        type: 'recursion',
        line,
        binding,
        ...RECURSION_LAYOUT_DEFAULTS
      });
      return;
    }

    const targetMatch = payload.match(/^([A-Za-z_][A-Za-z0-9_.-]*)\s+(.+)$/s);
    if (!targetMatch) throw new Error(`第 ${line} 行的 @layout 設定必須指定排版 ID`);
    const id = targetMatch[1];
    if (/^(?:direction|mode|order|align|sibling-gap|level-gap|degree|edges|reset)$/i.test(id)) {
      throw new Error(`第 ${line} 行的 @layout 設定必須指定排版 ID 在設定名稱前，例如：@layout quick_tree ${payload}`);
    }
    const layout = layouts.get(id);
    if (!layout) throw new Error(`第 ${line} 行的 @layout 找不到先前宣告的 ID：${id}`);
    const setting = targetMatch[2].trim();
    if (setting.toLowerCase() === 'reset') {
      Object.assign(layout, RECURSION_LAYOUT_DEFAULTS);
      return;
    }
    const settingMatch = setting.match(/^(direction|mode|order|align|sibling-gap|level-gap|degree|edges)\s+(.+)$/i);
    if (!settingMatch) throw new Error(`第 ${line} 行的 @layout ${id} 設定無效：${setting}`);
    const name = settingMatch[1].toLowerCase();
    const value = settingMatch[2].trim().toLowerCase();
    if (name === 'direction') {
      if (!['top-down', 'bottom-up', 'left-right', 'right-left'].includes(value)) {
        throw new Error(`第 ${line} 行的 @layout direction 只支援 top-down、bottom-up、left-right、right-left`);
      }
      layout.direction = value;
    } else if (name === 'mode' || name === 'order') {
      const aliases = { 'level-order': 'levelorder', level: 'levelorder' };
      const mode = aliases[value] || value;
      if (!['compact', 'levelorder', 'binary', 'inorder', 'preorder', 'postorder'].includes(mode)) {
        throw new Error(`第 ${line} 行的 @layout mode 無效：${value}`);
      }
      layout.mode = mode;
    } else if (name === 'align') {
      if (!['start', 'center', 'end'].includes(value)) {
        throw new Error(`第 ${line} 行的 @layout align 只支援 start、center、end`);
      }
      layout.align = value;
    } else if (name === 'edges') {
      if (!['on', 'off'].includes(value)) throw new Error(`第 ${line} 行的 @layout edges 必須是 on 或 off`);
      layout.showEdges = value === 'on';
    } else {
      const number = Number(value);
      if (!Number.isFinite(number) || number <= 0) {
        throw new Error(`第 ${line} 行的 @layout ${name} 必須是正數`);
      }
      if (name === 'degree') layout.degree = Math.max(1, Math.trunc(number));
      else if (name === 'sibling-gap') layout.siblingGap = number;
      else layout.levelGap = number;
    }
  });
  return [...layouts.values()];
}

function parseFrameSpec(raw) {
  const text = String(raw || '').trim();
  if (!text) return { names: [], displayNames: [], bindings: [] };
  const split = splitTopLevel(text);
  if (!split.valid || split.parts.some(part => !part)) {
    return { names: [], bindings: [], invalidExpression: text };
  }

  const names = [];
  const displayNames = [];
  const bindings = [];
  const addName = name => {
    if (name && !names.includes(name)) names.push(name);
  };
  const addDisplayName = name => {
    addName(name);
    if (name && !displayNames.includes(name)) displayNames.push(name);
  };

  for (const part of split.parts) {
    const indexed = part.match(/^([A-Za-z_]\w*)\s*\[\s*(.*?)\s*\]$/);
    if (!indexed) {
      part.split(/\s+/).filter(Boolean).forEach(addDisplayName);
      continue;
    }

    const targetName = indexed[1];
    const expressions = splitTopLevel(indexed[2]);
    if (!expressions.valid || expressions.parts.some(expression => !expression)) {
      return { names: [targetName], bindings: [], invalidExpression: indexed[2] };
    }
    const parsedExpressions = expressions.parts.map(expression => ({
      expression,
      parsed: parseFrameExpression(expression)
    }));
    const invalidExpression = parsedExpressions.find(item => !item.parsed.valid)?.expression || '';
    if (invalidExpression) {
      return { names: [targetName], bindings: [], invalidExpression };
    }

    addDisplayName(targetName);
    parsedExpressions.flatMap(item => item.parsed.identifiers).forEach(addName);
    bindings.push(...parsedExpressions.map(item => ({
      targetName,
      sourceName: item.parsed.identifiers[0] || '',
      sourceNames: item.parsed.identifiers,
      indexExpression: item.expression,
      mode: 'index'
    })));
  }

  return { names, displayNames, bindings };
}

function normalizeTextSegments(value, line) {
  const items = Array.isArray(value) ? value : [value];
  return items.flatMap((item, sourceIndex) => {
    let segment;
    if (typeof item === 'string' || typeof item === 'number') {
      segment = { text: String(item) };
    } else if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`第 ${line} 行的 @text 內容必須是文字或文字樣式物件`);
    } else {
      segment = {
        text: String(item.text ?? ''),
        color: String(item.color ?? item.font_color ?? ''),
        background: String(item.background ?? item.bg_color ?? ''),
        fontSize: Number(item.fontSize ?? item.font_size) || 14,
        bold: item.bold === true
      };
    }

    const templateMatches = [...segment.text.matchAll(/\$\{([^{}]+)\}/g)];
    const hasTtsMarkup = /(^|[^$])\{/.test(segment.text);
    if (hasTtsMarkup && templateMatches.length) {
      const expressions = templateMatches.map(match => {
        const expression = match[1].trim();
        const parsed = parseFrameExpression(expression);
        if (!expression || !parsed.valid) {
          throw new Error(`第 ${line} 行的 @text 變數運算式無效：${match[0]}`);
        }
        return {
          source: match[0],
          expression,
          identifiers: parsed.identifiers || []
        };
      });
      return [{
        ...segment,
        kind: 'template',
        segmentId: `s${sourceIndex}-t0`,
        expressions,
        identifiers: [...new Set(expressions.flatMap(expression => expression.identifiers))]
      }];
    }

    const parts = [];
    const pattern = /\$\{([^{}]+)\}/g;
    let cursor = 0;
    let tokenIndex = 0;
    let match;
    while ((match = pattern.exec(segment.text))) {
      if (match.index > cursor) {
        parts.push({
          ...segment,
          kind: 'literal',
          segmentId: `s${sourceIndex}-l${tokenIndex++}`,
          text: segment.text.slice(cursor, match.index)
        });
      }
      const expression = match[1].trim();
      const parsed = parseFrameExpression(expression);
      if (!expression || !parsed.valid) {
        throw new Error(`第 ${line} 行的 @text 變數運算式無效：${match[0]}`);
      }
      parts.push({
        ...segment,
        kind: 'expression',
        segmentId: `s${sourceIndex}-e${tokenIndex++}`,
        text: '',
        source: match[0],
        expression,
        identifiers: parsed.identifiers
      });
      cursor = pattern.lastIndex;
    }
    if (cursor < segment.text.length || !parts.length) {
      parts.push({
        ...segment,
        kind: 'literal',
        segmentId: `s${sourceIndex}-l${tokenIndex}`,
        text: segment.text.slice(cursor)
      });
    }
    return parts;
  });
}

function parseTextPlacement(payload, line) {
  return parseDirectiveModifiers(payload, line, '@text');
}

function textDirectivesForSource(source, analysis) {
  if (!analysis.presetDefinitions) findPresetDirectives(source, analysis);
  const directives = [];

  function visit(node) {
    if (node.name === 'LineComment' && !presetContains(analysis, node.from)) {
      const text = source.slice(node.from, node.to);
      const match = text.match(/^\/\/\s*@text\b\s*(.*?)\s*$/i);
      if (match) {
        const line = analysis.lineAt(node.from);
        const placement = parseTextPlacement(match[1], line);
        if (placement.renderer) throw new Error(`第 ${line} 行的 @text 不支援 render`);
        if (Object.keys(placement.rendererOptions || {}).length) throw new Error(`第 ${line} 行的 @text 不支援 with`);
        const payload = placement.payload;
        if (!payload) throw new Error(`第 ${line} 行的 @text 缺少文字內容`);
        let value = payload;
        if (/^["\[{]/.test(payload)) {
          try {
            value = JSON.parse(payload);
          } catch (error) {
            throw new Error(`第 ${line} 行的 @text 格式錯誤：${error.message}`);
          }
        }
        directives.push({
          from: node.from,
          to: node.to,
          line,
          id: placement.objectId || `line-${line}`,
          segments: normalizeTextSegments(value, line),
          binding: placement.binding,
          when: placement.when
        });
      }
    }
    for (let child = node.firstChild; child; child = child.nextSibling) visit(child);
  }

  visit(analysis.tree.topNode);
  return directives;
}

function attachTextDirectives(source, analysis, frameDirectives) {
  const frames = [...frameDirectives].sort((left, right) => left.from - right.from);
  frames.forEach(frame => {
    frame.texts = [];
    frame.captureOnlyVariableIds = [...new Set(frame.captureOnlyVariableIds || [])];
  });

  function resolveVariable(name, position) {
    return analysis.variables
      .filter(variable => variable.name === name
        && variable.declarationTo <= position
        && variable.scopeFrom <= position
        && position < variable.scopeTo)
      .sort((left, right) => (left.scopeTo - left.scopeFrom) - (right.scopeTo - right.scopeFrom))[0] || null;
  }

  const texts = textDirectivesForSource(source, analysis);
  frames.forEach(frame => {
    const presetTexts = framePresetNames(frame, analysis)
      .flatMap(name => analysis.presetDefinitions?.get(name)?.directives
        .filter(item => item.name === 'text').map(item => ({ ...item, presetName: name })) || []);
    presetTexts.forEach((item, index) => {
      const sourceText = `// @text ${item.payload}`;
      const parsed = textDirectivesForSource(sourceText, {
        tree: parser.parse(sourceText), lineAt: () => item.line,
        presetDefinitions: new Map(), presetRanges: []
      })[0];
      const position = frame.from + (index + 1) / (presetTexts.length + 1);
      const generatedId = parsed.id === `line-${item.line}`;
      texts.push({
        ...parsed,
        from: position,
        to: position,
        presetName: item.presetName,
        id: generatedId ? `preset-${item.presetName}-text-${item.line}` : parsed.id
      });
    });
  });
  texts.sort((left, right) => left.from - right.from).forEach(text => {
    const previous = frames.filter(frame => frame.from < text.from).at(-1) || null;
    const target = previous;
    if (!target) throw new Error(`第 ${text.line} 行的 @text 前面找不到可套用的 @frame`);
    let bindingTargetVariable = null;
    if (text.binding && !text.binding.canvas) {
      bindingTargetVariable = resolveVariable(text.binding.targetName, text.from);
      if (bindingTargetVariable) {
        text.binding.targetVariableId = bindingTargetVariable.id;
      } else {
        // @keep aliases and Trace Studio object IDs are canvas object keys,
        // not C++ variables. They are resolved against rendered placements.
        text.binding.targetObjectKey = text.binding.targetName;
      }
    }
    const bindingIdentifiers = text.binding?.canvas
      ? []
      : (text.binding?.indexExpressions || []).flatMap(expression => (
        parseFrameExpression(expression).identifiers || []
      ));
    const identifiers = [...new Set([
      ...text.segments.flatMap(segment => segment.identifiers || []),
      ...bindingIdentifiers,
      ...(text.when?.identifiers || [])
    ])];
    identifiers.forEach(name => {
      const variable = resolveVariable(name, text.from);
      if (!variable) throw new Error(`第 ${text.line} 行的 @text 找不到可見變數：${name}`);
      const alreadyCaptured = target.variables.some(existing => existing.id === variable.id);
      if (!alreadyCaptured) target.variables.push(variable);
      if (!alreadyCaptured && !target.names.includes(name)) target.captureOnlyVariableIds.push(variable.id);
    });
    if (bindingTargetVariable) {
      const alreadyCaptured = target.variables.some(existing => existing.id === bindingTargetVariable.id);
      if (!alreadyCaptured) target.variables.push(bindingTargetVariable);
      if (!alreadyCaptured && !target.names.includes(bindingTargetVariable.name)) {
        target.captureOnlyVariableIds.push(bindingTargetVariable.id);
      }
    }
    target.texts = target.texts.filter(existing => !existing.presetName || existing.id !== text.id);
    target.texts.push(text);
  });
}

const TRACE_STYLE_TYPES = new Set(['highlight', 'focus', 'mark', 'point', 'background']);
const TRACE_STYLE_LOCALS = new Set(['value', 'index']);

function parseStyleTarget(raw, line) {
  const source = String(raw || '').trim();
  const indexed = source.match(/^([A-Za-z_]\w*)\[\s*(.*?)\s*(\)|\])$/);
  if (indexed) {
    const split = splitTopLevel(indexed[2]);
    if (!split.valid || split.parts.some(part => !part)) {
      throw new Error(`第 ${line} 行的 @style 索引分段無效：${indexed[2].trim()}`);
    }
    const segments = split.parts.map(part => {
      const range = splitTopLevel(part, ':');
      if (!range.valid || range.parts.length > 2 || range.parts.some((value, index) => index > 0 && !value)) {
        throw new Error(`第 ${line} 行的 @style 範圍無效：${part}`);
      }
      if (range.parts.length === 2) {
        const startExpression = range.parts[0].trim() || '0';
        const endExpression = range.parts[1].trim();
        for (const expression of [startExpression, endExpression]) {
          if (!parseFrameExpression(expression).valid) {
            throw new Error(`第 ${line} 行的 @style 範圍運算式無效：${expression}`);
          }
        }
        return {
          type: 'range',
          startExpression,
          endExpression,
          endInclusive: indexed[3] === ']'
        };
      }
      const indexExpression = part.trim();
      if (!parseFrameExpression(indexExpression).valid) {
        throw new Error(`第 ${line} 行的 @style 索引運算式無效：${indexExpression}`);
      }
      return { type: 'index', indexExpression };
    });
    return {
      targetName: indexed[1],
      selector: segments.length === 1
        ? segments[0]
        : { type: 'segments', segments }
    };
  }
  if (!/^[A-Za-z_]\w*$/.test(source)) {
    throw new Error(`第 ${line} 行的 @style 目標無效：${source}`);
  }
  return { targetName: source, selector: { type: 'all' } };
}

function styleDirectivesForSource(source, analysis) {
  if (!analysis.presetDefinitions) findPresetDirectives(source, analysis);
  const directives = [];

  function visit(node) {
    if (node.name === 'LineComment' && !presetContains(analysis, node.from)) {
      const text = source.slice(node.from, node.to);
      const match = text.match(/^\/\/\s*@style\b\s*(.*?)\s*$/i);
      if (match) {
        const line = analysis.lineAt(node.from);
        const modifiers = parseDirectiveModifiers(match[1], line, '@style');
        if (modifiers.binding) throw new Error(`第 ${line} 行的 @style 不支援 at，請把 at 寫在物件指令上`);
        if (modifiers.renderer) throw new Error(`第 ${line} 行的 @style 不支援 render`);
        if (Object.keys(modifiers.rendererOptions || {}).length) throw new Error(`第 ${line} 行的 @style 不支援 with`);
        const styleMatch = modifiers.payload.match(/^(.*?)\s+(highlight|focus|mark|point|background)(?:\s+(.+))?$/i);
        if (!styleMatch) {
          throw new Error(`第 ${line} 行的 @style 格式應為：目標 樣式 [顏色]`);
        }
        const styleType = styleMatch[2].toLowerCase();
        const specifiedColor = String(styleMatch[3] || '').trim();
        const color = specifiedColor || (styleType === 'focus' ? 'AV_grey' : '');
        if (!TRACE_STYLE_TYPES.has(styleType)) {
          throw new Error(`第 ${line} 行的 @style 樣式無效：${styleType}`);
        }
        if (color && !/^(?:AV_[A-Za-z0-9_]+|#[0-9A-Fa-f]{3,8}|(?:rgb|rgba|hsl|hsla)\([^)]*\)|[A-Za-z]+)$/.test(color)) {
          throw new Error(`第 ${line} 行的 @style 顏色無效：${color}`);
        }
        directives.push({
          from: node.from,
          to: node.to,
          line,
          id: modifiers.objectId || `style-line-${line}`,
          ...parseStyleTarget(styleMatch[1], line),
          styleType,
          color,
          when: modifiers.when
        });
      }
    }
    for (let child = node.firstChild; child; child = child.nextSibling) visit(child);
  }

  visit(analysis.tree.topNode);
  return directives;
}

function attachStyleDirectives(source, analysis, frameDirectives) {
  const frames = [...frameDirectives].sort((left, right) => left.from - right.from);
  frames.forEach(frame => {
    frame.styles = [];
    frame.captureOnlyVariableIds = [...new Set(frame.captureOnlyVariableIds || [])];
  });

  function resolveVariable(name, position) {
    return analysis.variables
      .filter(variable => variable.name === name
        && variable.declarationTo <= position
        && variable.scopeFrom <= position
        && position < variable.scopeTo)
      .sort((left, right) => (left.scopeTo - left.scopeFrom) - (right.scopeTo - right.scopeFrom))[0] || null;
  }

  const styles = styleDirectivesForSource(source, analysis);
  frames.forEach(frame => {
    const presetStyles = framePresetNames(frame, analysis)
      .flatMap(name => analysis.presetDefinitions?.get(name)?.directives
        .filter(item => item.name === 'style').map(item => ({ ...item, presetName: name })) || []);
    presetStyles.forEach((item, index) => {
      const text = `// @style ${item.payload}`;
      const parsed = styleDirectivesForSource(text, {
        tree: parser.parse(text), lineAt: () => item.line
      })[0];
      const position = frame.from + (index + 1) / (presetStyles.length + 1);
      styles.push({ ...parsed, from: position, to: position, presetName: item.presetName,
        id: `preset-${item.presetName}-${item.line}` });
    });
  });
  styles.sort((left, right) => left.from - right.from).forEach(style => {
    const target = frames.filter(frame => frame.from < style.from).at(-1) || null;
    if (!target) throw new Error(`第 ${style.line} 行的 @style 前面找不到可套用的 @frame`);
    const targetVariable = resolveVariable(style.targetName, style.from);
    if (!targetVariable) throw new Error(`第 ${style.line} 行的 @style 找不到目標變數：${style.targetName}`);

    const ensureCaptured = (name, visible = false) => {
      if (!name || TRACE_STYLE_LOCALS.has(name)) return;
      const variable = resolveVariable(name, style.from);
      if (!variable) throw new Error(`第 ${style.line} 行的 @style 找不到可見變數：${name}`);
      const alreadyCaptured = target.variables.some(existing => existing.id === variable.id);
      if (!alreadyCaptured) target.variables.push(variable);
      if (!target.names.includes(name)) target.names.push(name);
      if (visible) {
        target.captureOnlyVariableIds = target.captureOnlyVariableIds.filter(id => id !== variable.id);
      } else if (!alreadyCaptured && !target.captureOnlyVariableIds.includes(variable.id)) {
        target.captureOnlyVariableIds.push(variable.id);
      }
    };

    ensureCaptured(style.targetName, true);
    const selectors = style.selector.type === 'segments'
      ? style.selector.segments || []
      : [style.selector];
    const selectorExpressions = selectors.flatMap(selector => selector?.type === 'range'
      ? [selector.startExpression, selector.endExpression]
      : selector?.type === 'index' ? [selector.indexExpression] : []);
    selectorExpressions.forEach(expression => {
      const parsed = parseFrameExpression(expression);
      (parsed.identifiers || []).forEach(name => ensureCaptured(name));
      // iteration.last(name) is allowed immediately before the loop-local
      // variable enters scope. Capture it when it is already visible; frames
      // before the declaration resolve it from the completed trace summary.
      (parsed.iterationIdentifiers || []).forEach(name => {
        if (resolveVariable(name, style.from)) ensureCaptured(name);
      });
    });
    (style.when?.identifiers || []).forEach(name => ensureCaptured(name));
    (style.when?.iterationIdentifiers || []).forEach(name => {
      if (resolveVariable(name, style.from)) ensureCaptured(name);
    });
    style.targetVariableId = targetVariable.id;
    target.styles = target.styles.filter(existing => !existing.presetName
        || existing.targetVariableId !== style.targetVariableId
        || existing.styleType !== style.styleType
        || JSON.stringify(existing.selector) !== JSON.stringify(style.selector));
    target.styles.push(style);
  });
}

function segmentDirectivesForSource(source, analysis) {
  if (!analysis.presetDefinitions) findPresetDirectives(source, analysis);
  const directives = [];

  function visit(node) {
    if (node.name === 'LineComment' && !presetContains(analysis, node.from)) {
      const text = source.slice(node.from, node.to);
      const match = text.match(/^\/\/\s*@segment\b\s*(.*?)\s*$/i);
      if (match) {
        const line = analysis.lineAt(node.from);
        const modifiers = parseDirectiveModifiers(match[1], line, '@segment');
        if (modifiers.binding) throw new Error(`第 ${line} 行的 @segment 會自動綁定陣列，不支援 at`);
        if (modifiers.renderer) throw new Error(`第 ${line} 行的 @segment 不支援 render`);
        const unsupportedOptions = Object.keys(modifiers.rendererOptions || {})
          .filter(name => name !== 'showWidth');
        if (unsupportedOptions.length) {
          throw new Error(`第 ${line} 行的 @segment 不支援 with ${unsupportedOptions[0]}`);
        }
        const range = modifiers.payload.match(/^([A-Za-z_]\w*)\[\s*(.*?)\s*:\s*(.*?)\s*(\)|\])$/);
        if (!range) {
          throw new Error(`第 ${line} 行的 @segment 格式應為：arr[start:end) 或 arr[start:end]`);
        }
        const startExpression = range[2].trim() || '0';
        const endExpression = range[3].trim();
        if (!endExpression) throw new Error(`第 ${line} 行的 @segment 缺少結束位置`);
        for (const expression of [startExpression, endExpression]) {
          if (!parseFrameExpression(expression).valid) {
            throw new Error(`第 ${line} 行的 @segment 範圍運算式無效：${expression}`);
          }
        }
        directives.push({
          from: node.from,
          to: node.to,
          line,
          id: modifiers.objectId || `segment-line-${line}`,
          named: Boolean(modifiers.objectId),
          targetName: range[1],
          startExpression,
          endExpression,
          endInclusive: range[4] === ']',
          showWidth: modifiers.rendererOptions?.showWidth === true,
          when: modifiers.when
        });
      }
    }
    for (let child = node.firstChild; child; child = child.nextSibling) visit(child);
  }

  visit(analysis.tree.topNode);
  return directives;
}

function attachSegmentDirectives(source, analysis, frameDirectives) {
  const frames = [...frameDirectives].sort((left, right) => left.from - right.from);
  frames.forEach(frame => {
    frame.segments = [];
    frame.captureOnlyVariableIds = [...new Set(frame.captureOnlyVariableIds || [])];
  });

  function resolveVariable(name, position) {
    return analysis.variables
      .filter(variable => variable.name === name
        && variable.declarationTo <= position
        && variable.scopeFrom <= position
        && position < variable.scopeTo)
      .sort((left, right) => (left.scopeTo - left.scopeFrom) - (right.scopeTo - right.scopeFrom))[0] || null;
  }

  const segments = segmentDirectivesForSource(source, analysis);
  frames.forEach(frame => {
    const presetSegments = framePresetNames(frame, analysis)
      .flatMap(name => analysis.presetDefinitions?.get(name)?.directives
        .filter(item => item.name === 'segment').map(item => ({ ...item, presetName: name })) || []);
    presetSegments.forEach((item, index) => {
      const sourceText = `// @segment ${item.payload}`;
      const parsed = segmentDirectivesForSource(sourceText, {
        tree: parser.parse(sourceText), lineAt: () => item.line,
        presetDefinitions: new Map(), presetRanges: []
      })[0];
      const position = frame.from + (index + 1) / (presetSegments.length + 1);
      const generatedId = parsed.id === `segment-line-${item.line}`;
      segments.push({
        ...parsed,
        from: position,
        to: position,
        presetName: item.presetName,
        id: generatedId ? `preset-${item.presetName}-segment-${item.line}` : parsed.id
      });
    });
  });
  segments.sort((left, right) => left.from - right.from).forEach(segment => {
    const target = frames.filter(frame => frame.from < segment.from).at(-1) || null;
    if (!target) throw new Error(`第 ${segment.line} 行的 @segment 前面找不到可套用的 @frame`);
    const targetVariable = resolveVariable(segment.targetName, segment.from);
    if (!targetVariable) {
      throw new Error(`第 ${segment.line} 行的 @segment 找不到目標變數：${segment.targetName}`);
    }

    const ensureCaptured = (name, visible = false) => {
      if (!name) return;
      const variable = resolveVariable(name, segment.from);
      if (!variable) throw new Error(`第 ${segment.line} 行的 @segment 找不到可見變數：${name}`);
      const alreadyCaptured = target.variables.some(existing => existing.id === variable.id);
      if (!alreadyCaptured) target.variables.push(variable);
      if (!target.names.includes(name)) target.names.push(name);
      if (visible) {
        target.captureOnlyVariableIds = target.captureOnlyVariableIds.filter(id => id !== variable.id);
      } else if (!alreadyCaptured && !target.captureOnlyVariableIds.includes(variable.id)) {
        target.captureOnlyVariableIds.push(variable.id);
      }
    };

    ensureCaptured(segment.targetName, true);
    [segment.startExpression, segment.endExpression].forEach(expression => {
      (parseFrameExpression(expression).identifiers || []).forEach(name => ensureCaptured(name));
    });
    (segment.when?.identifiers || []).forEach(name => ensureCaptured(name));
    segment.targetVariableId = targetVariable.id;
    target.segments = target.segments.filter(existing => !existing.presetName || existing.id !== segment.id);
    target.segments.push(segment);
  });
}

const ARROW_MODIFIERS = new Set([
  'from', 'to', 'as', 'color', 'width', 'head', 'line', 'dash', 'when'
]);
const ARROW_HEADS = new Set(['start', 'end', 'both', 'none']);
const ARROW_LINES = new Set(['straight', 'curve']);

function parseArrowTarget(raw, line, role) {
  let value = String(raw || '').trim();
  let offsetX = 0;
  let offsetY = 0;
  const offset = value.match(/\s+offset\s*\(\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*,\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*\)\s*$/i);
  if (offset) {
    offsetX = Number(offset[1]) || 0;
    offsetY = Number(offset[2]) || 0;
    value = value.slice(0, offset.index).trim();
  }
  if (value && !/\.(?:top-left|top|top-right|left|center|right|bottom-left|bottom|bottom-right)$/i.test(value)) {
    value = `${value}.center`;
  }
  try {
    return parseAtBinding(value, line, `@arrow ${role}`, offsetX, offsetY);
  } catch (error) {
    throw new Error(`第 ${line} 行的 @arrow ${role} 端點無效：${error.message.replace(/^第 \d+ 行的 @arrow \w+\s*/, '')}`);
  }
}

function findArrowDirectives(source, suppliedAnalysis = null) {
  const analysis = suppliedAnalysis || analyzeSource(source);
  if (!analysis.presetDefinitions) findPresetDirectives(source, analysis);
  const directives = [];

  function visit(node) {
    if (node.name === 'LineComment' && !presetContains(analysis, node.from)) {
      const text = source.slice(node.from, node.to);
      const match = text.match(/^\/\/\s*@arrow\b\s*(.*?)\s*$/i);
      if (match) {
        const line = analysis.lineAt(node.from);
        const payload = match[1].trim();
        const detectedPositions = topLevelModifierPositions(payload, ARROW_MODIFIERS);
        // `when` owns the rest of the line.  A condition may legitimately use
        // identifiers such as `width` or `color`; do not reinterpret those as
        // later @arrow modifiers.
        const whenPosition = detectedPositions.find(position => position.name === 'when');
        const positions = whenPosition
          ? detectedPositions.filter(position => position.index <= whenPosition.index)
          : detectedPositions;
        if (!positions.length || positions[0].index !== 0 || positions[0].name !== 'from') {
          throw new Error(`第 ${line} 行的 @arrow 格式應從 from 開始`);
        }
        const values = new Map();
        positions.forEach((position, index) => {
          if (values.has(position.name)) {
            throw new Error(`第 ${line} 行的 @arrow 重複使用 ${position.name}`);
          }
          const end = positions[index + 1]?.index ?? payload.length;
          const value = payload.slice(position.index + position.length, end).trim();
          if (!value) throw new Error(`第 ${line} 行的 @arrow 缺少 ${position.name} 內容`);
          values.set(position.name, value);
        });
        if (!values.has('to')) throw new Error(`第 ${line} 行的 @arrow 缺少 to 端點`);

        let owner = node.parent;
        while (owner && owner.name !== 'FunctionDefinition') owner = owner.parent;
        const ownerName = owner ? functionInfo(owner, source).name : 'global';
        const signature = stableSourceHash(`${ownerName}:${payload}`);
        const occurrence = directives.filter(item => item.signature === signature).length;
        const id = values.has('as')
          ? parseQuotedDirectiveId(values.get('as'), line, '@arrow as')
          : `arrow-${signature}-${occurrence}`;
        const color = String(values.get('color') || 'black').trim();
        if (!/^(?:AV_[A-Za-z0-9_]+|#[0-9A-Fa-f]{3,8}|(?:rgb|rgba|hsl|hsla)\([^)]*\)|[A-Za-z]+)$/.test(color)) {
          throw new Error(`第 ${line} 行的 @arrow 顏色無效：${color}`);
        }
        const width = Number(values.get('width') || 2);
        if (!Number.isFinite(width) || width <= 0) {
          throw new Error(`第 ${line} 行的 @arrow width 必須是正數`);
        }
        const head = String(values.get('head') || 'end').toLowerCase();
        if (!ARROW_HEADS.has(head)) {
          throw new Error(`第 ${line} 行的 @arrow head 只支援 start、end、both、none`);
        }
        const lineStyle = String(values.get('line') || 'straight').toLowerCase();
        if (!ARROW_LINES.has(lineStyle)) {
          throw new Error(`第 ${line} 行的 @arrow line 只支援 straight、curve`);
        }
        const dash = String(values.get('dash') || '').trim();
        if (dash && !/^\d+(?:\.\d+)?(?:\s*,\s*\d+(?:\.\d+)?)*$/.test(dash)) {
          throw new Error(`第 ${line} 行的 @arrow dash 格式無效：${dash}`);
        }
        let when = null;
        if (values.has('when')) {
          const expression = values.get('when');
          const parsed = parseConditionExpression(expression);
          if (!parsed.valid) throw new Error(`第 ${line} 行的 @arrow 條件無效：${expression}`);
          when = {
            expression,
            identifiers: parsed.identifiers,
            temporalFunctions: parsed.temporalFunctions || []
          };
        }
        directives.push({
          from: node.from,
          to: node.to,
          line,
          id,
          signature,
          explicitId: values.has('as'),
          displayName: values.has('as') ? id : `arrow_${directives.length + 1}`,
          source: 'directive',
          fromTarget: parseArrowTarget(values.get('from'), line, 'from'),
          toTarget: parseArrowTarget(values.get('to'), line, 'to'),
          style: { color, width, head, line: lineStyle, dash },
          when
        });
      }
    }
    for (let child = node.firstChild; child; child = child.nextSibling) visit(child);
  }

  visit(analysis.tree.topNode);
  return directives;
}

function attachArrowDirectives(source, analysis, frameDirectives) {
  const frames = [...frameDirectives].sort((left, right) => left.from - right.from);
  frames.forEach(frame => {
    frame.arrows = [];
    frame.captureOnlyVariableIds = [...new Set(frame.captureOnlyVariableIds || [])];
  });

  function resolveVariable(name, position) {
    return analysis.variables
      .filter(variable => variable.name === name
        && variable.declarationTo <= position
        && variable.scopeFrom <= position
        && position < variable.scopeTo)
      .sort((left, right) => (left.scopeTo - left.scopeFrom) - (right.scopeTo - right.scopeFrom))[0] || null;
  }

  const arrows = findArrowDirectives(source, analysis);
  frames.forEach(frame => {
    const presetArrows = framePresetNames(frame, analysis)
      .flatMap(name => analysis.presetDefinitions?.get(name)?.directives
        .filter(item => item.name === 'arrow').map(item => ({ ...item, presetName: name })) || []);
    presetArrows.forEach((item, index) => {
      const sourceText = `// @arrow ${item.payload}`;
      const parsed = findArrowDirectives(sourceText, {
        tree: parser.parse(sourceText), lineAt: () => item.line,
        presetDefinitions: new Map(), presetRanges: []
      })[0];
      const position = frame.from + (index + 1) / (presetArrows.length + 1);
      const generatedId = !parsed.explicitId;
      arrows.push({
        ...parsed,
        from: position,
        to: position,
        presetName: item.presetName,
        id: generatedId ? `preset-${item.presetName}-${parsed.id}-${presetArrows.slice(0, index).filter(previous => previous.presetName === item.presetName && previous.payload === item.payload).length}` : parsed.id
      });
    });
  });
  arrows.sort((left, right) => left.from - right.from).forEach(arrow => {
    const targetFrame = frames.filter(frame => frame.from < arrow.from).at(-1) || null;
    if (!targetFrame) throw new Error(`第 ${arrow.line} 行的 @arrow 前面找不到可套用的 @frame`);
    const captureIdentifier = (name, endpointTarget = null) => {
      if (!name) return null;
      const variable = resolveVariable(name, arrow.from);
      if (!variable) return null;
      const alreadyCaptured = targetFrame.variables.some(existing => existing.id === variable.id);
      if (!alreadyCaptured) targetFrame.variables.push(variable);
      if (!alreadyCaptured && !targetFrame.captureOnlyVariableIds.includes(variable.id)) {
        targetFrame.captureOnlyVariableIds.push(variable.id);
      }
      if (endpointTarget) endpointTarget.targetVariableId = variable.id;
      return variable;
    };

    for (const endpoint of [arrow.fromTarget, arrow.toTarget]) {
      if (!endpoint.canvas) {
        const variable = captureIdentifier(endpoint.targetName, endpoint);
        if (!variable) endpoint.targetObjectKey = endpoint.targetName;
      }
      (endpoint.indexExpressions || []).forEach(expression => {
        (parseFrameExpression(expression).identifiers || []).forEach(name => captureIdentifier(name));
      });
    }
    (arrow.when?.identifiers || []).forEach(name => {
      if (!captureIdentifier(name)) {
        throw new Error(`第 ${arrow.line} 行的 @arrow 找不到條件變數：${name}`);
      }
    });
    // Preset/default entries are presentation defaults, not a second arrow.
    // Resolve their established priority before checking actual duplicates.
    targetFrame.arrows = targetFrame.arrows.filter(existing => !existing.presetName || existing.id !== arrow.id);
    if (targetFrame.arrows.some(existing => existing.id === arrow.id)) {
      throw new Error(`第 ${arrow.line} 行的 @arrow ID 重複：${arrow.id}；同一幀不能使用相同 ID`);
    }
    targetFrame.arrows.push({
      id: arrow.id,
      explicitId: arrow.explicitId,
      displayName: arrow.displayName,
      source: arrow.source,
      from: arrow.fromTarget,
      to: arrow.toTarget,
      style: arrow.style,
      when: arrow.when,
      line: arrow.line,
      presetName: arrow.presetName || ''
    });
  });
}

function parsePlaceSource(value, line) {
  const raw = String(value || '').trim();
  const match = raw.match(/^([A-Za-z_][A-Za-z0-9_.-]*?)(?:\.(top-left|top|top-right|left|center|right|bottom-left|bottom|bottom-right))?$/i);
  if (!match) throw new Error(`第 ${line} 行的 @place 來源格式無效：${raw}`);
  return {
    sourceName: match[1],
    sourceAnchor: match[2]?.toLowerCase() || ''
  };
}

function findPlaceDirectives(source, suppliedAnalysis = null) {
  const analysis = suppliedAnalysis || analyzeSource(source);
  if (!analysis.presetDefinitions) findPresetDirectives(source, analysis);
  const directives = [];

  function visit(node) {
    if (node.name === 'LineComment' && !presetContains(analysis, node.from)) {
      const text = source.slice(node.from, node.to);
      const match = text.match(/^\/\/\s*@place\b\s*(.*?)\s*$/i);
      if (match) {
        const line = analysis.lineAt(node.from);
        const payload = match[1].trim();
        const detected = topLevelModifierPositions(payload, PLACE_DIRECTIVE_MODIFIERS);
        const whenPosition = detected.find(position => position.name === 'when');
        const positions = whenPosition
          ? detected.filter(position => position.index <= whenPosition.index)
          : detected;
        if (!positions.length || positions[0].name !== 'at') {
          throw new Error(`第 ${line} 行的 @place 格式應為：@place source at target.anchor`);
        }
        const sourceTarget = parsePlaceSource(payload.slice(0, positions[0].index), line);
        const values = new Map();
        positions.forEach((position, index) => {
          if (values.has(position.name)) {
            throw new Error(`第 ${line} 行的 @place 重複使用 ${position.name}`);
          }
          const end = positions[index + 1]?.index ?? payload.length;
          const value = payload.slice(position.index + position.length, end).trim();
          if (!value) throw new Error(`第 ${line} 行的 @place 缺少 ${position.name} 內容`);
          values.set(position.name, value);
        });
        let offsetX = 0;
        let offsetY = 0;
        if (values.has('offset')) {
          const offset = values.get('offset').match(/^\(\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*,\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*\)$/);
          if (!offset) throw new Error(`第 ${line} 行的 @place offset 格式無效`);
          offsetX = Number(offset[1]) || 0;
          offsetY = Number(offset[2]) || 0;
        }
        let when = null;
        if (values.has('when')) {
          const expression = values.get('when');
          const parsed = parseConditionExpression(expression);
          if (!parsed.valid) throw new Error(`第 ${line} 行的 @place 條件無效：${expression}`);
          when = {
            expression,
            identifiers: parsed.identifiers,
            temporalFunctions: parsed.temporalFunctions || []
          };
        }
        directives.push({
          from: node.from,
          to: node.to,
          line,
          ...sourceTarget,
          binding: {
            ...parseAtBinding(values.get('at'), line, '@place', offsetX, offsetY),
            sourceName: sourceTarget.sourceName,
            sourceAnchor: sourceTarget.sourceAnchor,
            when
          },
          when
        });
      }
    }
    for (let child = node.firstChild; child; child = child.nextSibling) visit(child);
  }

  visit(analysis.tree.topNode);
  return directives;
}

function attachPlaceDirectives(source, analysis, frameDirectives) {
  const frames = [...frameDirectives].sort((left, right) => left.from - right.from);
  frames.forEach(frame => {
    frame.placeBindings = [];
    frame.captureOnlyVariableIds = [...new Set(frame.captureOnlyVariableIds || [])];
  });

  function resolveVariable(name, position) {
    return analysis.variables
      .filter(variable => variable.name === name
        && variable.declarationTo <= position
        && variable.scopeFrom <= position
        && position < variable.scopeTo)
      .sort((left, right) => (left.scopeTo - left.scopeFrom) - (right.scopeTo - right.scopeFrom))[0] || null;
  }

  const places = findPlaceDirectives(source, analysis);
  frames.forEach(frame => {
    const presetPlaces = framePresetNames(frame, analysis)
      .flatMap(name => analysis.presetDefinitions?.get(name)?.directives
        .filter(item => item.name === 'place').map(item => ({ ...item, presetName: name })) || []);
    presetPlaces.forEach((item, index) => {
      const text = `// @place ${item.payload}`;
      const parsed = findPlaceDirectives(text, {
        tree: parser.parse(text), lineAt: () => item.line
      })[0];
      const position = frame.from + (index + 1) / (presetPlaces.length + 1);
      places.push({ ...parsed, from: position, to: position, presetName: item.presetName });
    });
  });
  places.sort((left, right) => left.from - right.from).forEach(place => {
    const targetFrame = frames.filter(frame => frame.from < place.from).at(-1) || null;
    if (!targetFrame) throw new Error(`第 ${place.line} 行的 @place 前面找不到可套用的 @frame`);
    const binding = { ...place.binding };
    const sourceVariable = resolveVariable(place.sourceName, place.from);
    if (sourceVariable) {
      const displayed = targetFrame.variables.some(variable => variable.id === sourceVariable.id)
        && !targetFrame.captureOnlyVariableIds.includes(sourceVariable.id);
      if (!displayed) {
        throw new Error(`第 ${place.line} 行的 @place 來源變數未由前一個 @frame 顯示：${place.sourceName}`);
      }
      binding.sourceVariableId = sourceVariable.id;
    } else {
      binding.sourceObjectKey = place.sourceName;
    }

    const captureDependency = (name, role) => {
      if (!name) return null;
      const variable = resolveVariable(name, place.from);
      if (!variable) {
        if (role === 'condition') throw new Error(`第 ${place.line} 行的 @place 找不到條件變數：${name}`);
        return null;
      }
      const alreadyCaptured = targetFrame.variables.some(existing => existing.id === variable.id);
      if (!alreadyCaptured) targetFrame.variables.push(variable);
      if (!alreadyCaptured && !targetFrame.captureOnlyVariableIds.includes(variable.id)) {
        targetFrame.captureOnlyVariableIds.push(variable.id);
      }
      return variable;
    };
    if (!binding.canvas) {
      const targetVariable = captureDependency(binding.targetName, 'target');
      if (targetVariable) binding.targetVariableId = targetVariable.id;
      else binding.targetObjectKey = binding.targetName;
    }
    (binding.indexExpressions || []).forEach(expression => {
      (parseFrameExpression(expression).identifiers || []).forEach(name => captureDependency(name, 'index'));
    });
    (place.when?.identifiers || []).forEach(name => captureDependency(name, 'condition'));
    if (place.presetName) binding.presetName = place.presetName;
    targetFrame.placeBindings = targetFrame.placeBindings.filter(existing =>
      !existing.presetName || existing.sourceVariableId !== binding.sourceVariableId
        || existing.sourceObjectKey !== binding.sourceObjectKey
        || existing.sourceAnchor !== binding.sourceAnchor);
    targetFrame.placeBindings.push(binding);
  });
}

function parseCameraDirective(payload, line) {
  const source = String(payload || '').trim();
  const whenPositions = topLevelModifierPositions(source, new Set(['when']));
  if (whenPositions.length > 1) throw new Error(`第 ${line} 行的 @camera 重複使用 when`);
  const whenPosition = whenPositions[0];
  const cameraSource = (whenPosition ? source.slice(0, whenPosition.index) : source).trim();
  const conditionSource = whenPosition
    ? source.slice(whenPosition.index + whenPosition.length).trim()
    : '';
  if (whenPosition && !conditionSource) throw new Error(`第 ${line} 行的 @camera 缺少 when 內容`);

  let zoom = 0.92;
  let offsetX = 0;
  let offsetY = 0;
  const seenOptions = new Set();
  const optionPattern = /\b(zoom|offset)\s*\(([^()]*)\)/gi;
  const base = cameraSource.replace(optionPattern, (match, rawName, rawValue) => {
    const name = rawName.toLowerCase();
    if (seenOptions.has(name)) throw new Error(`第 ${line} 行的 @camera 重複使用 ${name}`);
    seenOptions.add(name);
    if (name === 'zoom') {
      if (!/^\s*(?:\d+(?:\.\d+)?|\.\d+)\s*$/.test(rawValue)) {
        throw new Error(`第 ${line} 行的 @camera zoom 格式無效`);
      }
      zoom = Number(rawValue);
      if (!(zoom >= 0.05 && zoom <= 4)) {
        throw new Error(`第 ${line} 行的 @camera zoom 必須介於 0.05 到 4`);
      }
    } else {
      const offset = rawValue.match(/^\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*,\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*$/);
      if (!offset) throw new Error(`第 ${line} 行的 @camera offset 格式無效`);
      offsetX = Number(offset[1]) || 0;
      offsetY = Number(offset[2]) || 0;
    }
    return ' ';
  }).replace(/\s+/g, ' ').trim();
  if (/\b(?:zoom|offset)\s*\(/i.test(base)) {
    throw new Error(`第 ${line} 行的 @camera 選項格式無效：${cameraSource}`);
  }

  const modeMatch = base.match(/^(auto|focus)\b\s*(.*)$/i);
  if (!modeMatch) {
    throw new Error(`第 ${line} 行的 @camera 格式應為：@camera auto，或 @camera focus target`);
  }
  const mode = modeMatch[1].toLowerCase();
  const targetSource = modeMatch[2].trim();
  if (mode === 'auto' && targetSource) throw new Error(`第 ${line} 行的 @camera auto 不接受定位目標`);
  if (mode === 'focus' && !targetSource) throw new Error(`第 ${line} 行的 @camera focus 缺少定位目標`);
  const hasAnchor = /\.(?:top-left|top|top-right|left|center|right|bottom-left|bottom|bottom-right)$/i
    .test(targetSource);
  const binding = mode === 'focus'
    ? parseAtBinding(hasAnchor ? targetSource : `${targetSource}.center`, line, '@camera')
    : null;
  let condition = null;
  if (conditionSource) {
    const parsed = parseConditionExpression(conditionSource);
    if (!parsed.valid) throw new Error(`第 ${line} 行的 @camera 條件無效：${conditionSource}`);
    condition = {
      expression: conditionSource,
      identifiers: parsed.identifiers,
      temporalFunctions: parsed.temporalFunctions || []
    };
  }
  return {
    mode,
    autoCapture: mode === 'auto',
    zoom,
    offsetX,
    offsetY,
    binding,
    condition,
    line
  };
}

function findCameraDirectives(source, suppliedAnalysis = null) {
  const analysis = suppliedAnalysis || analyzeSource(source);
  if (!analysis.presetDefinitions) findPresetDirectives(source, analysis);
  const directives = [];
  function visit(node) {
    if (node.name === 'LineComment' && !presetContains(analysis, node.from)) {
      const text = source.slice(node.from, node.to);
      const match = text.match(/^\/\/\s*@camera\b\s*(.*?)\s*$/i);
      if (match) directives.push({
        ...parseCameraDirective(match[1], analysis.lineAt(node.from)),
        from: node.from,
        to: node.to
      });
    }
    for (let child = node.firstChild; child; child = child.nextSibling) visit(child);
  }
  visit(analysis.tree.topNode);
  return directives;
}

function attachCameraDirectives(source, analysis, frameDirectives) {
  const frames = [...frameDirectives].sort((left, right) => left.from - right.from);
  frames.forEach(frame => {
    frame.camera = null;
    frame.presetDirectives = framePresetNames(frame, analysis)
      .flatMap(name => (analysis.presetDefinitions?.get(name)?.directives || []).map(item => ({
        presetName: name,
        name: item.name,
        payload: item.payload,
        line: item.line
      })));
  });
  function resolveVariable(name, position) {
    return analysis.variables
      .filter(variable => variable.name === name
        && variable.declarationTo <= position
        && variable.scopeFrom <= position
        && position < variable.scopeTo)
      .sort((left, right) => (left.scopeTo - left.scopeFrom) - (right.scopeTo - right.scopeFrom))[0] || null;
  }
  const cameras = findCameraDirectives(source, analysis);
  frames.forEach(frame => {
    const presetCameras = frame.presetDirectives
      .filter(item => item.name === 'camera');
    presetCameras.forEach((item, index) => {
      const parsed = parseCameraDirective(item.payload, item.line);
      const position = frame.from + (index + 1) / (presetCameras.length + 1);
      cameras.push({ ...parsed, from: position, to: position, presetName: item.presetName });
    });
  });
  cameras.sort((left, right) => left.from - right.from).forEach(camera => {
    const targetFrame = frames.filter(frame => frame.from < camera.from).at(-1) || null;
    if (!targetFrame) throw new Error(`第 ${camera.line} 行的 @camera 前面找不到可套用的 @frame`);
    let target = null;
    if (camera.binding && !camera.binding.canvas) {
      const variable = resolveVariable(camera.binding.targetName, camera.from);
      target = {
        ...(variable
          ? { variableId: variable.id }
          : { objectKey: camera.binding.targetName }),
        indexExpression: (camera.binding.indexExpressions || []).join(','),
        anchor: camera.binding.anchor || 'center'
      };
      const dependencies = (camera.binding.indexExpressions || []).flatMap(expression => (
        parseFrameExpression(expression).identifiers || []
      ));
      if (variable) dependencies.push(variable.name);
      [...new Set(dependencies)].forEach(name => {
        const dependency = resolveVariable(name, camera.from);
        if (!dependency) return;
        if (!targetFrame.variables.some(existing => existing.id === dependency.id)) {
          targetFrame.variables.push(dependency);
          targetFrame.captureOnlyVariableIds.push(dependency.id);
        }
      });
    }
    (camera.condition?.identifiers || []).forEach(name => {
      const dependency = resolveVariable(name, camera.from);
      if (!dependency) throw new Error(`第 ${camera.line} 行的 @camera 找不到條件變數：${name}`);
      if (!targetFrame.variables.some(existing => existing.id === dependency.id)) {
        targetFrame.variables.push(dependency);
        targetFrame.captureOnlyVariableIds.push(dependency.id);
      }
    });
    targetFrame.camera = {
      source: 'directive',
      autoCapture: camera.autoCapture,
      zoom: camera.zoom,
      offsetX: camera.offsetX,
      offsetY: camera.offsetY,
      condition: camera.condition,
      target,
      presetName: camera.presetName || ''
    };
  });
}

function findFrameDirectives(source, suppliedAnalysis = null) {
  const analysis = suppliedAnalysis || analyzeSource(source);
  if (!analysis.presetDefinitions) findPresetDirectives(source, analysis);
  const directives = [];
  let openFrame = null;
  let continuationEnd = -1;

  function resolveVariable(name, position) {
    return analysis.variables
      .filter(variable => variable.name === name
        && variable.declarationTo <= position
        && variable.scopeFrom <= position
        && position < variable.scopeTo)
      .sort((left, right) => (left.scopeTo - left.scopeFrom) - (right.scopeTo - right.scopeFrom))[0] || null;
  }

  function parseFrameObject(node, payload, directiveName) {
    const line = analysis.lineAt(node.from);
    const modifiers = parseDirectiveModifiers(payload, line, directiveName, FRAME_DIRECTIVE_MODIFIERS);
    const frameSpec = modifiers.payload;
    const parsed = parseFrameSpec(frameSpec);
    if (!frameSpec) throw new Error(`第 ${line} 行的 ${directiveName} 缺少物件`);
    if (parsed.invalidExpression) {
      throw new Error(`第 ${line} 行的 ${directiveName} 索引運算式無效：${parsed.invalidExpression}`);
    }
    const names = [...parsed.names];
    const invalid = names.find(name => !/^[A-Za-z_]\w*$/.test(name));
    if (invalid) throw new Error(`第 ${line} 行的 ${directiveName} 變數名稱無效：${invalid}`);
    const variables = names.map(name => {
      const variable = resolveVariable(name, node.from);
      if (!variable) throw new Error(`第 ${line} 行的 ${directiveName} 找不到可見變數：${name}`);
      return variable;
    });
    const captureOnlyVariableIds = [];
    const includeDependency = name => {
      if (!name) return null;
      let variable = variables.find(item => item.name === name);
      if (!variable) {
        variable = resolveVariable(name, node.from);
        if (!variable) throw new Error(`第 ${line} 行的 ${directiveName} 找不到可見變數：${name}`);
        names.push(name);
        variables.push(variable);
      }
      if (!parsed.displayNames.includes(name) && !captureOnlyVariableIds.includes(variable.id)) {
        captureOnlyVariableIds.push(variable.id);
      }
      return variable;
    };
    (modifiers.when?.identifiers || []).forEach(includeDependency);
    Object.values(modifiers.rendererOptions || {}).forEach(option => {
      (option.identifiers || []).forEach(includeDependency);
    });
    if (modifiers.binding && !modifiers.binding.canvas) {
      const targetVariable = resolveVariable(modifiers.binding.targetName, node.from);
      if (targetVariable) {
        includeDependency(modifiers.binding.targetName);
        modifiers.binding.targetVariableId = targetVariable.id;
      } else {
        modifiers.binding.targetObjectKey = modifiers.binding.targetName;
      }
      (modifiers.binding.indexExpressions || []).forEach(expression => {
        (parseFrameExpression(expression).identifiers || []).forEach(includeDependency);
      });
    }
    const sourceVariable = variables.find(variable => variable.name === parsed.displayNames[0]);
    if (!sourceVariable) throw new Error(`第 ${line} 行的 ${directiveName} 缺少主要物件`);
    const bindings = parsed.bindings.map(binding => {
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
    });
    return {
      from: node.from,
      to: node.to,
      line,
      frameSpec,
      objectId: modifiers.objectId,
      layoutId: modifiers.layoutId,
      names,
      displayVariableIds: parsed.displayNames
        .map(name => variables.find(variable => variable.name === name)?.id)
        .filter(Boolean),
      variables,
      captureOnlyVariableIds,
      renderer: modifiers.renderer,
      rendererOptions: modifiers.rendererOptions,
      when: modifiers.when,
      objectBinding: modifiers.binding ? {
        ...modifiers.binding,
        sourceVariableId: sourceVariable.id,
        sourceName: sourceVariable.name
      } : null,
      bindings,
      primaryVariableId: sourceVariable.id,
      primaryName: sourceVariable.name
    };
  }

  function appendFrameObject(frame, object, replacePreset = false) {
    const repeated = frame.objects.findIndex(existing => existing.primaryVariableId === object.primaryVariableId);
    if (repeated >= 0 && !(replacePreset && frame.objects[repeated].presetName)) {
      throw new Error(`第 ${object.line} 行的 @object 重複顯示同一個主要物件：${object.primaryName}`);
    }
    const descriptor = {
      from: object.from,
      to: object.to,
      line: object.line,
      frameSpec: object.frameSpec,
      objectId: object.objectId,
      layoutId: object.layoutId,
      primaryVariableId: object.primaryVariableId,
      primaryName: object.primaryName,
      displayVariableIds: [...object.displayVariableIds],
      renderer: object.renderer,
      rendererOptions: object.rendererOptions,
      objectBinding: object.objectBinding,
      presetName: object.presetName || ''
    };
    if (repeated >= 0) frame.objects.splice(repeated, 1, descriptor);
    else frame.objects.push(descriptor);
    object.names.forEach(name => {
      if (!frame.names.includes(name)) frame.names.push(name);
    });
    object.variables.forEach(variable => {
      if (!frame.variables.some(existing => existing.id === variable.id)) frame.variables.push(variable);
    });
    object.captureOnlyVariableIds.forEach(id => {
      if (!frame.captureOnlyVariableIds.includes(id)) frame.captureOnlyVariableIds.push(id);
    });
    const displayedIds = new Set(frame.objects.flatMap(item => item.displayVariableIds || []));
    frame.captureOnlyVariableIds = frame.captureOnlyVariableIds.filter(id => !displayedIds.has(id));
    if (repeated >= 0) frame.bindings = frame.bindings.filter(binding => binding.targetVariableId !== object.primaryVariableId);
    frame.bindings.push(...object.bindings);
    frame.frameSpec = frame.objects.map(item => item.frameSpec).join(' | ');
    if (frame.objects.length === 1) {
      frame.objectId = object.objectId;
      frame.layoutId = object.layoutId;
      frame.renderer = object.renderer;
      frame.rendererOptions = object.rendererOptions;
      frame.when = frame.when || object.when;
      frame.objectBinding = object.objectBinding;
    }
  }

  function visit(node) {
    if (node.name === 'LineComment') {
      const text = source.slice(node.from, node.to);
      const match = text.match(/^\/\/\s*(?:([A-Za-z_][A-Za-z0-9_.-]*)\s*:\s*)?@frame\b\s*(.*?)\s*$/i);
      if (match) {
        const line = analysis.lineAt(node.from);
        const modifiers = parseDirectiveModifiers(match[2], line, '@frame', FRAME_DIRECTIVE_MODIFIERS);
        const use = modifiers.payload.match(/^use\s+(.+)$/i);
        const presetNames = use ? use[1].split(',').map(name => name.trim()) : [];
        if (/^use\b/i.test(modifiers.payload)
          && (!use || presetNames.some(name => !/^[A-Za-z_]\w*$/.test(name)))) {
          throw new Error(`第 ${line} 行的 @frame use 格式應為：@frame use preset_name[,preset_name] [when 條件]`);
        }
        if (new Set(presetNames).size !== presetNames.length) {
          throw new Error(`第 ${line} 行的 @frame use 不可重複套用同一預設`);
        }
        if (use && (modifiers.objectId || modifiers.layoutId || modifiers.binding
          || modifiers.renderer || Object.keys(modifiers.rendererOptions || {}).length)) {
          throw new Error(`第 ${line} 行的 @frame use 只支援 when；物件設定請寫在 @object`);
        }
        if (!modifiers.payload && (modifiers.objectId || modifiers.layoutId || modifiers.binding
          || modifiers.renderer || Object.keys(modifiers.rendererOptions || {}).length)) {
          throw new Error(`第 ${line} 行的空白 @frame 不支援物件設定，請將設定寫在 @object`);
        }
        const directive = {
          from: node.from,
          to: node.to,
          line,
          name: match[1] || '',
          objectId: '', layoutId: '', frameSpec: '', names: [], variables: [],
          captureOnlyVariableIds: [], when: modifiers.when, renderer: '', rendererOptions: {},
          objectBinding: null, bindings: [], objects: [],
          presetName: presetNames[0] || '', presetNames
        };
        {
          framePresetNames(directive, analysis).forEach(name => {
            const preset = analysis.presetDefinitions.get(name);
            if (!preset) throw new Error(`第 ${line} 行的 @frame use 找不到預設：${name}`);
            preset.directives.filter(item => item.name === 'object').forEach(item => {
              const object = parseFrameObject(node, item.payload, '@preset @object');
              object.presetName = name;
              appendFrameObject(directive, object, true);
            });
          });
        }
        if (!use && modifiers.payload) appendFrameObject(directive, parseFrameObject(node, match[2], '@frame'), true);
        directives.push(directive);
        openFrame = directive;
        continuationEnd = node.to;
      } else if (!presetContains(analysis, node.from)) {
        const objectMatch = text.match(/^\/\/\s*@object\b\s*(.*?)\s*$/i);
        if (objectMatch) {
          const line = analysis.lineAt(node.from);
          if (!openFrame || !/^\s*$/.test(source.slice(continuationEnd, node.from))) {
            throw new Error(`第 ${line} 行的 @object 必須緊接在 @frame 或另一個 @object 後面`);
          }
          const object = parseFrameObject(node, objectMatch[1], '@object');
          if (object.when) throw new Error(`第 ${line} 行的 @object 暫不支援 when，請將條件寫在 @frame`);
          if (object.layoutId) throw new Error(`第 ${line} 行的 @object 暫不支援 in，請將遞迴排版寫在主要 @frame 物件`);
          appendFrameObject(openFrame, object, true);
          continuationEnd = node.to;
        }
      }
    }
    for (let child = node.firstChild; child; child = child.nextSibling) visit(child);
  }

  visit(analysis.tree.topNode);
  const usedNames = new Set();
  directives.forEach(directive => {
    if (!directive.objects.length) {
      throw new Error(`第 ${directive.line} 行的 @frame 至少需要一個緊接的 @object`);
    }
    const displayedIds = new Set(directive.objects.flatMap(object => object.displayVariableIds || []));
    (directive.when?.identifiers || []).forEach(name => {
      const variable = resolveVariable(name, directive.from);
      if (!variable) throw new Error(`第 ${directive.line} 行的 @frame 找不到條件變數：${name}`);
      if (!directive.variables.some(existing => existing.id === variable.id)) directive.variables.push(variable);
      if (!directive.names.includes(name)) directive.names.push(name);
      if (!displayedIds.has(variable.id) && !directive.captureOnlyVariableIds.includes(variable.id)) {
        directive.captureOnlyVariableIds.push(variable.id);
      }
    });
    if (!directive.name) return;
    if (usedNames.has(directive.name)) {
      throw new Error(`第 ${directive.line} 行的 @frame 名稱重複：${directive.name}`);
    }
    usedNames.add(directive.name);
  });
  attachTextDirectives(source, analysis, directives);
  attachStyleDirectives(source, analysis, directives);
  attachSegmentDirectives(source, analysis, directives);
  attachPlaceDirectives(source, analysis, directives);
  attachArrowDirectives(source, analysis, directives);
  attachCameraDirectives(source, analysis, directives);
  return directives;
}

function findKeepDirectives(source, suppliedAnalysis = null, suppliedLayouts = null) {
  const analysis = suppliedAnalysis || analyzeSource(source);
  const directives = [];
  const layouts = suppliedLayouts || findLayoutDirectives(source, analysis);
  const layoutIds = new Set(layouts.map(layout => layout.id));

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
        const line = analysis.lineAt(node.from);
        const modifiers = parseKeepModifiers(text.replace(/^\/\/\s*@keep\b/i, ''), line);
        if (modifiers.layoutId && !layoutIds.has(modifiers.layoutId)) {
          throw new Error(`第 ${line} 行的 @keep in 找不到排版 ID：${modifiers.layoutId}`);
        }
        if (modifiers.payload === 'last') {
          const enclosing = analysis.variables
            .filter(variable => variable.scopeFrom <= node.from && node.from < variable.scopeTo)
            .sort((left, right) => (left.scopeTo - left.scopeFrom) - (right.scopeTo - right.scopeFrom))[0];
          if (modifiers.binding && !modifiers.binding.canvas) {
            const targetVariable = resolveVariable(modifiers.binding.targetName, node.from);
            if (targetVariable) modifiers.binding.targetVariableId = targetVariable.id;
            else modifiers.binding.targetObjectKey = modifiers.binding.targetName;
          }
          directives.push({
            from: node.from,
            to: node.to,
            line,
            mode: 'last',
            label: modifiers.label,
            layoutId: modifiers.layoutId,
            binding: modifiers.binding,
            placementOffset: modifiers.placementOffset,
            preserveStyle: modifiers.preserveStyle,
            when: modifiers.when,
            functionName: enclosing?.functionName || 'global',
            variable: null
          });
          return;
        }
        const match = modifiers.payload.match(/^([A-Za-z_]\w*)$/);
        if (!match) throw new Error(`第 ${line} 行的 @keep 語法無效`);
        const name = match[1];
        const variable = resolveVariable(name, node.from);
        if (!variable) throw new Error(`第 ${line} 行的 @keep 找不到可見變數：${name}`);
        if (modifiers.binding && !modifiers.binding.canvas) {
          const targetVariable = resolveVariable(modifiers.binding.targetName, node.from);
          if (targetVariable) modifiers.binding.targetVariableId = targetVariable.id;
          else modifiers.binding.targetObjectKey = modifiers.binding.targetName;
        }
        directives.push({
          from: node.from,
          to: node.to,
          line,
          mode: 'variable',
          name,
          label: modifiers.label,
          layoutId: modifiers.layoutId,
          binding: modifiers.binding,
          placementOffset: modifiers.placementOffset,
          preserveStyle: modifiers.preserveStyle,
          when: modifiers.when,
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

function findExitDirectives(source, suppliedAnalysis = null) {
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
      if (/^\/\/\s*@exit\b/i.test(text)) {
        const line = analysis.lineAt(node.from);
        const payload = text.replace(/^\/\/\s*@exit\b/i, '').trim();
        const split = splitTopLevel(payload);
        if (!split.valid || !split.parts.length || split.parts.some(part => !part)) {
          throw new Error(`第 ${line} 行的 @exit 語法無效`);
        }
        const variables = split.parts.map(name => {
          if (!/^[A-Za-z_]\w*$/.test(name)) {
            throw new Error(`第 ${line} 行的 @exit 目標格式無效：${name}`);
          }
          const variable = resolveVariable(name, node.from);
          if (!variable) throw new Error(`第 ${line} 行的 @exit 找不到可見變數：${name}`);
          return variable;
        });
        directives.push({
          from: node.from,
          to: node.to,
          line,
          functionName: variables[0]?.functionName || 'global',
          variables
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
  const layoutDirectives = findLayoutDirectives(source, analysis);
  const layoutIds = new Set(layoutDirectives.map(layout => layout.id));
  frameDirectives.forEach(directive => {
    if (directive.layoutId && !layoutIds.has(directive.layoutId)) {
      throw new Error(`第 ${directive.line} 行的 @frame in 找不到排版 ID：${directive.layoutId}`);
    }
  });
  const keepDirectives = findKeepDirectives(source, analysis, layoutDirectives);
  const exitDirectives = findExitDirectives(source, analysis);
  const manualFrames = frameDirectives.length > 0;
  const selectedIds = new Set((watchIds || []).map(item => typeof item === 'string' ? item : item.id));
  frameDirectives.forEach(directive => directive.variables.forEach(variable => selectedIds.add(variable.id)));
  keepDirectives.forEach(directive => {
    if (directive.variable?.id) selectedIds.add(directive.variable.id);
    if (directive.binding?.targetVariableId) selectedIds.add(directive.binding.targetVariableId);
    (directive.binding?.indexExpressions || []).forEach(expression => {
      (parseFrameExpression(expression).identifiers || []).forEach(name => {
        const variable = analysis.variables
          .filter(item => item.name === name
            && item.declarationTo <= directive.from
            && item.scopeFrom <= directive.from
            && directive.from < item.scopeTo)
          .sort((left, right) => (left.scopeTo - left.scopeFrom) - (right.scopeTo - right.scopeFrom))[0];
        if (variable?.id) selectedIds.add(variable.id);
      });
    });
  });
  exitDirectives.forEach(directive => {
    directive.variables.forEach(variable => selectedIds.add(variable.id));
  });
  // Manual frames control what is drawn, not what can be resolved by events.
  // Keep every visible variable in the captured state and hide the extras.
  if (manualFrames) {
    analysis.variables.forEach(variable => selectedIds.add(variable.id));
  }
  // Without explicit @frame selections, trace every variable the parser can
  // resolve so RUN can build an animation without a separate setup step.
  if (!selectedIds.size && !manualFrames) {
    analysis.variables.forEach(variable => selectedIds.add(variable.id));
  }
  const selected = analysis.variables.filter(variable => selectedIds.has(variable.id));
  const declarationPositions = new Set(analysis.variables.map(variable => variable.nameFrom));
  const sourceKeyOccurrences = new Map();
  const logicalSourceKeyOccurrences = new Map();
  const legacySourceKeyOccurrences = new Map();
  const indexedFrameDirectives = frameDirectives.map((directive, index) => {
    // A frame directive belongs to the lexical function containing the
    // comment, not to the function scope of its primary variable. This is
    // especially important for a global array displayed from main(): the
    // runtime statement ID is emitted as main, so registering it as global
    // would drop every directive option when the trace is assembled.
    const functionName = functionNameAt(analysis.tree.resolve(directive.from, 1));
    const sourceKeyBase = `${functionName}\u0000${canonicalFrameIdentity(directive)}`;
    const sourceKeyOccurrence = sourceKeyOccurrences.get(sourceKeyBase) || 0;
    sourceKeyOccurrences.set(sourceKeyBase, sourceKeyOccurrence + 1);
    const logicalSourceKeyBase = `${functionName}\u0000${logicalFrameIdentity(directive)}`;
    const logicalSourceKeyOccurrence = logicalSourceKeyOccurrences.get(logicalSourceKeyBase) || 0;
    logicalSourceKeyOccurrences.set(logicalSourceKeyBase, logicalSourceKeyOccurrence + 1);
    const sourceKeyAliases = legacyFrameTextVariants(source.slice(directive.from, directive.to)).map(directiveText => {
      const legacyBase = `${functionName}\u0000${directiveText}`;
      const occurrence = legacySourceKeyOccurrences.get(legacyBase) || 0;
      legacySourceKeyOccurrences.set(legacyBase, occurrence + 1);
      return `manual-frame:${stableSourceHash(legacyBase)}:${occurrence}`;
    });
    const explicitIds = new Set(directive.variables.map(variable => variable.id));
    const visible = selected.filter(variable => variable.functionName === functionName
      && variable.declarationTo <= directive.from
      && variable.scopeFrom <= directive.from
      && directive.from < variable.scopeTo);
    const captureOnlyVariableIds = new Set(directive.captureOnlyVariableIds || []);
    visible.forEach(variable => {
      if (!explicitIds.has(variable.id)) captureOnlyVariableIds.add(variable.id);
    });
    return {
      ...directive,
      variables: [...directive.variables, ...visible.filter(variable => !explicitIds.has(variable.id))],
      captureOnlyVariableIds: [...captureOnlyVariableIds],
      index,
      functionName,
      sourceKey: `manual-frame:${stableSourceHash(sourceKeyBase)}:${sourceKeyOccurrence}`,
      logicalSourceKey: `manual-frame-logical:${stableSourceHash(logicalSourceKeyBase)}:${logicalSourceKeyOccurrence}`,
      sourceKeyAliases: [...new Set(sourceKeyAliases)]
    };
  });
  const directiveByPosition = new Map(indexedFrameDirectives.map(directive => [directive.from, directive]));
  const indexedKeepDirectives = keepDirectives.map((directive, index) => ({
    ...directive,
    index,
    functionName: directive.functionName || directive.variable?.functionName || 'global'
  }));
  const keepDirectiveByPosition = new Map(indexedKeepDirectives.map(directive => [directive.from, directive]));
  const indexedExitDirectives = exitDirectives.map((directive, index) => ({
    ...directive,
    index,
    functionName: directive.functionName || directive.variables[0]?.functionName || 'global'
  }));
  const exitDirectiveByPosition = new Map(indexedExitDirectives.map(directive => [directive.from, directive]));
  const eventSources = {};

  function sourcePoint(offset) {
    const safeOffset = Math.max(0, Math.min(source.length, Number(offset) || 0));
    const line = analysis.lineAt(safeOffset);
    const lineStart = source.lastIndexOf('\n', Math.max(0, safeOffset - 1)) + 1;
    return { line, column: safeOffset - lineStart + 1 };
  }

  const sourceContextTypes = new Set([
    'FunctionDefinition', 'ForStatement', 'IfStatement', 'WhileStatement',
    'DoStatement', 'SwitchStatement'
  ]);

  function topLevelForSeparators(node) {
    if (node?.name !== 'ForStatement') return [];
    const children = childrenOf(node);
    const open = children.find(child => child.name === '(');
    const close = [...children].reverse().find(child => child.name === ')');
    if (!open || !close || close.from <= open.to) return [];
    const separators = [];
    let round = 0;
    let square = 0;
    let curly = 0;
    let quote = '';
    let escaped = false;
    for (let cursor = open.to; cursor < close.from; cursor += 1) {
      const character = source[cursor];
      if (quote) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === quote) quote = '';
        continue;
      }
      if (character === '"' || character === "'") {
        quote = character;
        continue;
      }
      if (character === '(') round += 1;
      else if (character === ')') round = Math.max(0, round - 1);
      else if (character === '[') square += 1;
      else if (character === ']') square = Math.max(0, square - 1);
      else if (character === '{') curly += 1;
      else if (character === '}') curly = Math.max(0, curly - 1);
      else if (character === ';' && !round && !square && !curly) separators.push(cursor);
    }
    return separators;
  }

  function forCondition(node) {
    const separators = topLevelForSeparators(node);
    if (separators.length < 2) return null;
    let from = separators[0] + 1;
    let to = separators[1];
    while (from < to && /\s/.test(source[from])) from += 1;
    while (to > from && /\s/.test(source[to - 1])) to -= 1;
    if (to <= from) return null;
    const expressionNode = childrenOf(node).find(child => child.from <= from && child.to >= to)
      || childrenOf(node).find(child => child.from >= from && child.to <= to);
    return { from, to, node: expressionNode || null };
  }

  function directCondition(node) {
    if (node?.name === 'ForStatement') return forCondition(node);
    const clause = childrenOf(node).find(child => child.name === 'ConditionClause');
    if (!clause) return null;
    const expressionNode = childrenOf(clause).find(child => !['(', ')'].includes(child.name));
    return expressionNode
      ? { from: expressionNode.from, to: expressionNode.to, node: expressionNode }
      : null;
  }

  function describeSourceContext(node) {
    const children = childrenOf(node);
    const body = children.find(child => child.name === 'CompoundStatement')
      || [...children].reverse().find(child => child.name.endsWith('Statement') && child !== node);
    const headerTo = body ? body.from : node.to;
    const condition = directCondition(node);
    const structuralLines = new Set();
    const addLine = offset => structuralLines.add(analysis.lineAt(Math.max(node.from, offset)));
    addLine(node.from);
    children.forEach(child => {
      if (child.name === 'else') addLine(child.from);
      if (child.name !== 'CompoundStatement') return;
      addLine(child.from);
      addLine(Math.max(child.from, child.to - 1));
    });
    return {
      type: node.name,
      functionName: functionNameAt(node),
      from: node.from,
      to: node.to,
      headerFrom: node.from,
      headerTo: Math.max(node.from, headerTo),
      conditionFrom: condition?.from ?? null,
      conditionTo: condition?.to ?? null,
      structuralLines: [...structuralLines].sort((left, right) => left - right),
      openLine: analysis.lineAt(node.from),
      closeLine: analysis.lineAt(Math.max(node.from, node.to - 1))
    };
  }

  function sourceContexts(node) {
    const contexts = [];
    for (let current = node?.parent; current; current = current.parent) {
      if (!sourceContextTypes.has(current.name)) continue;
      contexts.push(describeSourceContext(current));
    }
    return contexts.reverse();
  }

  const sourceStructure = [];
  (function collectSourceStructure(node) {
    if (sourceContextTypes.has(node.name)) sourceStructure.push(describeSourceContext(node));
    for (let child = node.firstChild; child; child = child.nextSibling) collectSourceStructure(child);
  })(analysis.tree.topNode);

  function recordEventSource(eventSignature, node, from = node?.from, to = node?.to, force = false) {
    const signatureText = String(eventSignature || '');
    const start = Math.max(0, Math.min(source.length, Number(from) || 0));
    const end = Math.max(start, Math.min(source.length, Number(to) || start));
    if (!signatureText || end <= start || (!force && eventSources[signatureText])) return eventSignature;
    const startPoint = sourcePoint(start);
    const endPoint = sourcePoint(end);
    eventSources[signatureText] = {
      functionName: functionNameAt(node),
      from: start,
      to: end,
      line: startPoint.line,
      column: startPoint.column,
      endLine: endPoint.line,
      endColumn: endPoint.column,
      text: source.slice(start, end),
      contexts: sourceContexts(node)
    };
    return eventSignature;
  }

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
    const value = `${type}:${functionNameAt(node)}:${analysis.lineAt(node.from)}:${compactExpression(source.slice(node.from, node.to))}`;
    return recordEventSource(value, node);
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
    const capture = `::asm_trace::capture(${directive.line}, ${cppString(functionName)}, ${cppString(statementId)}, "manual-frame"${named.length ? `, ${named.join(', ')}` : ''});`;
    return directive.when?.expression && !(directive.when.temporalFunctions || []).length
      ? `if (static_cast<bool>(${directive.when.expression})) { ${capture} }`
      : capture;
  }

  function keepOperationCall(node, directive) {
    const functionName = functionNameAt(node);
    const statementId = `manual-keep:${functionName}:${directive.line}:${directive.index}`;
    let operation;
    if (directive.mode === 'last') {
      operation = `::asm_trace::event_keep_last(${directive.line}, ${cppString(statementId)}, ${cppString(directive.label)}, ${directive.preserveStyle !== false ? 'true' : 'false'}, ${cppString(directive.layoutId || '')});`;
    } else {
      const variable = directive.variable;
      operation = `::asm_trace::event_keep(${directive.line}, ${cppString(statementId)}, ${cppString(variable.id)}, ${cppString(variable.name)}, ${cppString(directive.label)}, (${variable.name}), ${directive.preserveStyle !== false ? 'true' : 'false'}, ${cppString(directive.layoutId || '')});`;
    }
    return directive.when?.expression
      ? `if (static_cast<bool>(${directive.when.expression})) { ${operation} }`
      : operation;
  }

  function exitOperationCall(node, directive) {
    const functionName = functionNameAt(node);
    return directive.variables.map(variable => {
      const eventSignature = `visual-exit:${functionName}:${directive.line}:${variable.name}`;
      recordEventSource(eventSignature, node, node.from, node.to, true);
      return `::asm_trace::event_visual_exit(${directive.line}, ${cppString(eventSignature)}, ${cppString(variable.id)}, ${cppString(variable.name)}, ${cppString(variable.kind)}, (${variable.name}));`;
    }).join('\n');
  }

  function targetArgs(target) {
    return `${cppString(target.variableId)}, ${cppString(target.expression)}, ${cppString(target.indexExpression)}`;
  }

  function indexedTargetArgs(target) {
    const indexExpression = String(target.indexExpression || '').trim();
    const canCaptureIndex = indexExpression
      && /^[A-Za-z0-9_+\-*/%()\s]+$/.test(indexExpression)
      && !/(?:\+\+|--)/.test(indexExpression)
      && !/[A-Za-z0-9_)]\s*\(/.test(indexExpression);
    const resolvedIndex = canCaptureIndex
      ? `static_cast<long long>(${indexExpression})`
      : '0LL';
    return `${targetArgs(target)}, ${canCaptureIndex ? 'true' : 'false'}, ${resolvedIndex}`;
  }

  function comparisonEvent(leftNode, rightNode, operator, context, signatureNode) {
    const left = rebuild(leftNode, context);
    const right = rebuild(rightNode, context);
    const leftTarget = targetDescriptor(leftNode);
    const rightTarget = targetDescriptor(rightNode);
    const line = analysis.lineAt(leftNode.from);
    const expression = compactExpression(
      `${source.slice(leftNode.from, leftNode.to)} ${operator} ${source.slice(rightNode.from, rightNode.to)}`
    );
    const eventSignature = `compare:${functionNameAt(signatureNode)}:${line}:${expression}`;
    recordEventSource(eventSignature, signatureNode, leftNode.from, rightNode.to);
    return `::asm_trace::event_compare(${line}, ${cppString(eventSignature)}, ${indexedTargetArgs(leftTarget)}, ${indexedTargetArgs(rightTarget)}, ${cppString(operator)}, [&]()->decltype(auto){ return (${left}); }, [&]()->decltype(auto){ return (${right}); }, [](const auto& __asm_l, const auto& __asm_r){ return __asm_l ${operator} __asm_r; })`;
  }

  function trailingLogicalOperand(node) {
    const children = childrenOf(node);
    for (let index = children.length - 2; index >= 0; index -= 1) {
      if (children[index].name === 'LogicOp') {
        return { children, operand: children[index + 1] };
      }
    }
    return null;
  }

  function rebuildPrefix(node, end, context) {
    const parts = [];
    let cursor = node.from;
    for (const child of childrenOf(node)) {
      if (child.from >= end) break;
      parts.push(source.slice(cursor, child.from));
      parts.push(rebuild(child, context));
      cursor = child.to;
    }
    parts.push(source.slice(cursor, end));
    return parts.join('');
  }

  function declarationEvents(node) {
    return selected
      .filter(variable => variable.declarationKind === 'local' && variable.declarationFrom === node.from)
      .flatMap(variable => {
        const scopeExitSignature = `scope-exit:${variable.functionName}:${analysis.lineAt(Math.max(variable.scopeFrom, variable.scopeTo - 1))}:${variable.name}`;
        recordEventSource(
          scopeExitSignature,
          node,
          Math.max(variable.scopeFrom, variable.scopeTo - 1),
          variable.scopeTo,
          true
        );
        const lifetimeGuard = `::asm_trace::VariableScopeExit __asm_scope_exit_${variable.nameFrom}(${analysis.lineAt(Math.max(variable.scopeFrom, variable.scopeTo - 1))}, ${cppString(scopeExitSignature)}, ${cppString(variable.id)}, ${cppString(variable.name)}, ${cppString(variable.kind)}, (${variable.name}));`;
        const declarator = childrenOf(node).find(child => child.name === 'InitDeclarator'
          && variable.nameFrom >= child.from && variable.nameFrom < child.to);
        if (!declarator) {
          const eventSignature = `declare:${variable.functionName}:${variable.line}:${variable.name}`;
          recordEventSource(eventSignature, node, variable.declarationFrom, variable.declarationTo);
          return [
            lifetimeGuard,
            `::asm_trace::event_declare_uninitialized(${variable.line}, ${cppString(eventSignature)}, ${cppString(variable.id)}, ${cppString(variable.name)}, ${cppString(variable.kind)}, (${variable.name}));`
          ];
        }
        const declareSignature = `declare:${variable.functionName}:${variable.line}:${variable.name}`;
        // A declaration with an initializer represents two separate runtime
        // facts. Keep the declaration source limited to its type and name so
        // `int i = 0` is presented as `declare: int i`, followed by the
        // initialized assignment source `i = 0` below.
        recordEventSource(declareSignature, declarator, node.from, variable.nameTo);
        const events = [
          lifetimeGuard,
          `::asm_trace::event_declare(${variable.line}, ${cppString(declareSignature)}, ${cppString(variable.id)}, ${cppString(variable.name)}, ${cppString(variable.kind)}, (${variable.name}));`
        ];
        const declaratorChildren = childrenOf(declarator);
        const initializer = declaratorChildren.length > 1
          ? declaratorChildren[declaratorChildren.length - 1]
          : null;
        if (!initializer) return events;
        const sourceTarget = targetDescriptor(initializer);
        const assignment = `${variable.name} = ${compactExpression(source.slice(initializer.from, initializer.to))}`;
        const assignSignature = `assign:${variable.functionName}:${variable.line}:${assignment}`;
        recordEventSource(assignSignature, declarator, variable.nameFrom, initializer.to);
        const target = { variableId: variable.id, expression: variable.name, indexExpression: '' };
        events.push(
          `::asm_trace::event_initialized_assign(${variable.line}, ${cppString(assignSignature)}, ${indexedTargetArgs(target)}, ${indexedTargetArgs(sourceTarget)}, ${cppString(assignment)}, (${variable.name}), ${node.parent?.name === 'ForStatement' ? 'true' : 'false'});`
        );
        return events;
      })
      .join('\n');
  }

  function parameterEvents(bodyNode, functionName) {
    return selected
      .filter(variable => variable.declarationKind === 'parameter'
        && variable.functionName === functionName
        && variable.scopeFrom === bodyNode.from)
      .map(variable => {
        const declareSignature = `declare:${variable.functionName}:${variable.line}:${variable.name}`;
        const scopeExitLine = analysis.lineAt(Math.max(variable.scopeFrom, variable.scopeTo - 1));
        const scopeExitSignature = `scope-exit:${variable.functionName}:${scopeExitLine}:${variable.name}`;
        // A function parameter already exists when the activation begins. It
        // is one declaration/entrance event carrying the passed value, not a
        // source-level initialized declaration. Only an actual declaration
        // such as `int n = 0` is split into declaration plus assignment.
        recordEventSource(
          declareSignature, bodyNode, variable.declarationFrom, variable.nameTo
        );
        recordEventSource(
          scopeExitSignature,
          bodyNode,
          Math.max(variable.scopeFrom, variable.scopeTo - 1),
          variable.scopeTo,
          true
        );
        return `::asm_trace::VariableScopeExit __asm_scope_exit_${variable.nameFrom}(${scopeExitLine}, ${cppString(scopeExitSignature)}, ${cppString(variable.id)}, ${cppString(variable.name)}, ${cppString(variable.kind)}, (${variable.name}));\n::asm_trace::event_declare(${variable.line}, ${cppString(declareSignature)}, ${cppString(variable.id)}, ${cppString(variable.name)}, ${cppString(variable.kind)}, (${variable.name}), true);`;
      })
      .join('\n');
  }

  function inputInitializationMarks(node) {
    const text = source.slice(node.from, node.to);
    if (!/(?:^|\W)(?:std\s*::\s*)?cin\s*>>/.test(text)) return '';
    const calls = [];
    const seen = new Set();
    for (const match of text.matchAll(/>>\s*([A-Za-z_]\w*)/g)) {
      const name = match[1];
      const relative = Number(match.index) + match[0].lastIndexOf(name);
      const watch = watchAt(name, node.from + Math.max(0, relative));
      if (!watch || seen.has(watch.id)) continue;
      seen.add(watch.id);
      calls.push(`::asm_trace::mark_initialized(${cppString(watch.id)}, (${name}));`);
    }
    return calls.join('\n');
  }

  function rebuild(node, context = {}) {
    const children = childrenOf(node);
    const forInitializer = node.name === 'ForStatement'
      ? children.find(child => child.name === 'Declaration' && isForHeaderExpression(child))
      : null;
    const forInitializationEvents = forInitializer
      && context.rewrittenForInitializerFrom !== node.from
      ? declarationEvents(forInitializer)
      : '';
    const forHeaderExpression = isForHeaderExpression(node);
    const enclosingForCondition = node.parent?.name === 'ForStatement'
      ? forCondition(node.parent)
      : null;
    const forHeaderCondition = Boolean(enclosingForCondition
      && enclosingForCondition.from === node.from
      && enclosingForCondition.to === node.to
      && (!enclosingForCondition.node || enclosingForCondition.node.name === node.name));
    const forHeaderWrite = forHeaderExpression
      && (node.name === 'AssignmentExpression' || node.name === 'UpdateExpression');
    const inheritedSuppression = context.suppressEvents === true
      && !(forHeaderWrite && context.suppressForHeaderEvents === true);
    const suppressEvents = inheritedSuppression || (forHeaderExpression
      && !forHeaderWrite
      && !forHeaderCondition
      && context.allowForConditionEvents !== true);
    const nestedContext = forHeaderCondition
      ? { ...context, suppressEvents: false, allowForConditionEvents: true }
      : (suppressEvents || forHeaderWrite
      ? {
        ...context,
        suppressEvents: true,
        suppressForHeaderEvents: context.suppressForHeaderEvents === true || forHeaderExpression
      }
      : context);
    let rendered;

    if (node.name === 'ForStatement' && forInitializer && forInitializationEvents
      && context.rewrittenForInitializerFrom !== node.from) {
      // A declaration cannot be followed by trace statements inside a C++ for
      // header. Move it into an equivalent surrounding scope, emit its normal
      // declaration/initialized-assignment events, then leave an empty for
      // initializer. This preserves loop scope and continue/break behavior.
      const initializer = source.slice(forInitializer.from, forInitializer.to);
      const loop = rebuild(node, {
        ...context,
        rewrittenForInitializerFrom: node.from,
        omittedForInitializerFrom: forInitializer.from,
        omittedForInitializerTo: forInitializer.to
      });
      rendered = `{
${initializer}
${forInitializationEvents}
${loop}
}`;
    } else if (node.name === 'Declaration'
      && context.omittedForInitializerFrom === node.from
      && context.omittedForInitializerTo === node.to) {
      rendered = ';';
    } else if (node.name === 'LineComment' && directiveByPosition.has(node.from)) {
      const directive = directiveByPosition.get(node.from);
      rendered = `${source.slice(node.from, node.to)}\n${directiveCaptureCall(node, directive)}`;
    } else if (node.name === 'LineComment' && keepDirectiveByPosition.has(node.from)) {
      const directive = keepDirectiveByPosition.get(node.from);
      rendered = `${source.slice(node.from, node.to)}\n${keepOperationCall(node, directive)}`;
    } else if (node.name === 'LineComment' && exitDirectiveByPosition.has(node.from)) {
      const directive = exitDirectiveByPosition.get(node.from);
      rendered = `${source.slice(node.from, node.to)}\n${exitOperationCall(node, directive)}`;
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
        const eventSignature = signature('condition', node);
        recordEventSource(eventSignature, expressionNode, expressionNode.from, expressionNode.to, true);
        const truthyTarget = conditionKind === 'IfStatement'
          && ['Identifier', 'SubscriptExpression'].includes(expressionNode.name)
          ? targetDescriptor(expressionNode) : null;
        const truthySignature = truthyTarget?.variableId
          ? signature('compare', expressionNode) : '';
        const evaluatedExpression = truthySignature && !suppressEvents
          ? `::asm_trace::event_truthy_compare(${analysis.lineAt(expressionNode.from)}, ${cppString(truthySignature)}, ${indexedTargetArgs(truthyTarget)}, [&]()->decltype(auto){ return (${expression}); })`
          : expression;
        rendered = suppressEvents
          ? expression
          : `(::asm_trace::event_condition(${analysis.lineAt(node.from)}, ${cppString(eventSignature)}, ${cppString(conditionKind)}, [&](){ return static_cast<bool>(${evaluatedExpression}); }))`;
      }
    } else if (node.name === 'AssignmentExpression' || node.name === 'UpdateExpression') {
      const targetNode = node.name === 'AssignmentExpression' ? children[0] : children.find(child => containsSelectedReference(child));
      const target = targetDescriptor(targetNode);
      const sourceNode = node.name === 'AssignmentExpression' ? children[children.length - 1] : null;
      const sourceTarget = targetDescriptor(sourceNode);
      const assignmentOperator = targetNode && sourceNode
        ? source.slice(targetNode.to, sourceNode.from).trim()
        : '';
      let chainRoot = node;
      while (chainRoot.parent?.name === 'AssignmentExpression'
        && childrenOf(chainRoot.parent).at(-1)?.from === chainRoot.from
        && childrenOf(chainRoot.parent).at(-1)?.to === chainRoot.to) {
        chainRoot = chainRoot.parent;
      }
      // `a=b=c` contains two executed assignments. The inner `b=c` is an
      // expression, not an ExpressionStatement, but it still needs its own
      // event before the outer assignment commits.
      const chainedAssignment = node.name === 'AssignmentExpression'
        && chainRoot !== node
        && chainRoot.parent?.name === 'ExpressionStatement';
      const standalone = node.parent?.name === 'ExpressionStatement'
        || forHeaderWrite || chainedAssignment;
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
          && (node.parent?.name === 'ExpressionStatement' || chainedAssignment);
        if (animatedAssignment || (forHeaderWrite && node.name === 'AssignmentExpression' && assignmentOperator === '=')) {
          const forInitializerAssignment = Boolean(forHeaderWrite
            && enclosingForCondition
            && node.to <= enclosingForCondition.from);
          const action = chainedAssignment
            ? `[&]()->decltype(auto){ return (${expression}); }`
            : `[&](){ ${expression}; }`;
          rendered = `::asm_trace::${chainedAssignment ? 'event_assign_expr' : 'event_assign'}(${analysis.lineAt(node.from)}, ${cppString(signature('assign', node))}, ${indexedTargetArgs(target)}, ${indexedTargetArgs(sourceTarget)}, ${cppString(sourceExpression)}, [&]()->decltype(auto){ return (${targetAccess}); }, ${action}, [&]()->decltype(auto){ return (${targetAccess}); }, true, ${forInitializerAssignment ? 'true' : 'false'})`;
        } else if (node.name === 'UpdateExpression') {
          const update = `::asm_trace::event_update(${analysis.lineAt(node.from)}, ${cppString(signature('write', node))}, ${indexedTargetArgs(target)}, ${cppString(sourceExpression)}, [&]()->decltype(auto){ return (${targetAccess}); }, [&](){ ${expression}; }, [&]()->decltype(auto){ return (${targetAccess}); })`;
          rendered = forHeaderWrite
            ? update
            : `(::asm_trace::event_read(${analysis.lineAt(node.from)}, ${cppString(signature('read', node))}, ${targetArgs(target)}), ${update})`;
        } else {
          rendered = `::asm_trace::event_write(${analysis.lineAt(node.from)}, ${cppString(signature('write', node))}, ${indexedTargetArgs(target)}, ${cppString(sourceExpression)}, [&](){ ${expression}; }, true)`;
        }
      } else {
        rendered = expression;
      }
    } else if (node.name === 'BinaryExpression') {
      const comparisonContext = forHeaderCondition ? nestedContext : context;
      const operatorNode = children.find(child => child.name === 'CompareOp'
        && COMPARISON_OPERATORS.has(source.slice(child.from, child.to)));
      if (!suppressEvents && operatorNode && containsSelectedReference(node)) {
        const operatorIndex = children.indexOf(operatorNode);
        const leftNode = children[operatorIndex - 1];
        const rightNode = children[operatorIndex + 1];
        const operator = source.slice(operatorNode.from, operatorNode.to);
        const logicalTail = trailingLogicalOperand(leftNode);
        if (logicalTail) {
          // Lezer groups `a && b > c` as `(a && b) > c`. Keep the original
          // C++ precedence by attaching the comparison event only to `b > c`.
          const prefix = rebuildPrefix(leftNode, logicalTail.operand.from, comparisonContext);
          rendered = `${prefix}${comparisonEvent(logicalTail.operand, rightNode, operator, comparisonContext, node)}`;
        } else {
          rendered = comparisonEvent(leftNode, rightNode, operator, comparisonContext, node);
        }
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
      const mutationVariable = analysis.variables.find(variable => (
        variable.id === mutationTarget?.variableId
      ));
      if (suppressEvents) {
        rendered = expression;
      } else if (/(?:^|::)swap$/.test(callee) && node.parent?.name === 'ExpressionStatement' && args.length >= 2) {
        const leftTarget = targetDescriptor(args[0]);
        const rightTarget = targetDescriptor(args[1]);
        rendered = `::asm_trace::event_swap(${analysis.lineAt(node.from)}, ${cppString(signature('swap', node))}, ${indexedTargetArgs(leftTarget)}, ${indexedTargetArgs(rightTarget)}, [&]()->decltype(auto){ return (${source.slice(args[0].from, args[0].to)}); }, [&]()->decltype(auto){ return (${source.slice(args[1].from, args[1].to)}); }, [&](){ ${expression}; })`;
      } else if (mutationTarget?.variableId && MUTATING_METHODS.has(method)
        && node.parent?.name === 'ExpressionStatement') {
        rendered = mutationVariable?.kind === 'sequence' && !mutationTarget.indexExpression
          ? `::asm_trace::event_sequence_operation(${analysis.lineAt(node.from)}, ${cppString(signature('sequence-operation', node))}, ${cppString(mutationTarget.variableId)}, ${cppString(mutationTarget.expression)}, ${cppString(method)}, (${source.slice(mutationBase.from, mutationBase.to)}), [&](){ ${expression}; })`
          : `::asm_trace::event_write(${analysis.lineAt(node.from)}, ${cppString(signature('write', node))}, ${indexedTargetArgs(mutationTarget)}, ${cppString(method)}, [&](){ ${expression}; })`;
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

    if (forHeaderCondition && !inheritedSuppression) {
      const eventSignature = signature('condition', node);
      recordEventSource(eventSignature, node, node.from, node.to, true);
      rendered = `(::asm_trace::event_condition(${analysis.lineAt(node.from)}, ${cppString(eventSignature)}, "ForStatement", [&](){ return static_cast<bool>(${rendered}); }))`;
    }

    if (node.name === 'CompoundStatement' && node.parent?.name === 'FunctionDefinition') {
      const info = functionInfo(node.parent, source);
      const openOffset = rendered.indexOf('{');
      const closeOffset = rendered.lastIndexOf('}');
      if (openOffset >= 0 && closeOffset > openOffset) {
        const parameters = parameterEvents(node, info.name);
        const enterCapture = manualFrames ? '' : captureCall(node, 'function-enter');
        const exitCapture = manualFrames ? '' : captureCall(node, 'function-exit');
        const enterSignature = signature('function-enter', node.parent);
        const exitSignature = signature('function-exit', node.parent);
        recordEventSource(enterSignature, node.parent, node.parent.from, node.from + 1, true);
        recordEventSource(exitSignature, node.parent, Math.max(node.from, node.to - 1), node.to, true);
        const activation = `::asm_trace::FunctionActivation __asm_function_activation_${node.from}(${cppString(info.name)});`;
        const enter = `\n${activation}\n::asm_trace::event_function(${analysis.lineAt(node.parent.from)}, ${cppString(enterSignature)}, ${cppString(info.name)}, true);\n${parameters ? `${parameters}\n` : ''}${enterCapture}\n`;
        const exit = `\n::asm_trace::event_function(${analysis.lineAt(node.to - 1)}, ${cppString(exitSignature)}, ${cppString(info.name)}, false);\n${exitCapture}\n`;
        rendered = `${rendered.slice(0, openOffset + 1)}${enter}${rendered.slice(openOffset + 1, closeOffset)}${exit}${rendered.slice(closeOffset)}`;
      }
    }

    if (node.name === 'ReturnStatement') {
      const fn = functionNameAt(node);
      const returnCapture = manualFrames ? '' : `${captureCall(node, 'return')}\n`;
      rendered = `{\n::asm_trace::event_function(${analysis.lineAt(node.from)}, ${cppString(signature('function-return', node))}, ${cppString(fn)}, false);\n${returnCapture}${rendered}\n}`;
    } else if (CHECKPOINT_NODES.has(node.name) && node.parent?.name === 'CompoundStatement') {
      const declarations = node.name === 'Declaration' ? declarationEvents(node) : '';
      const inputInitializations = node.name === 'ExpressionStatement'
        ? inputInitializationMarks(node)
        : '';
      const checkpoint = manualFrames ? '' : captureCall(node);
      rendered = `${rendered}\n${inputInitializations ? `${inputInitializations}\n` : ''}${declarations ? `${declarations}\n` : ''}${checkpoint}`;
    }

    return rendered;
  }

  const instrumented = `#include "ASMTrace.hpp"\n${rebuild(analysis.tree.topNode)}`;
  return {
    code: instrumented,
    variables: selected,
    allVariables: analysis.variables,
    sourceDeclarations: analysis.variables.map(variable => ({
      name: variable.name,
      from: variable.declarationFrom,
      to: variable.declarationTo,
      line: variable.line,
      functionName: variable.functionName,
      declarationKind: variable.declarationKind,
      scopeFrom: variable.scopeFrom,
      scopeTo: variable.scopeTo
    })),
    sourceStructure,
    frameDirectives: indexedFrameDirectives,
    keepDirectives: indexedKeepDirectives,
    layoutDirectives,
    exitDirectives: indexedExitDirectives,
    eventSources
  };
}

module.exports = {
  analyzeSource,
  buildSyntaxTree,
  findFrameDirectives,
  findKeepDirectives,
  findLayoutDirectives,
  findArrowDirectives,
  findPlaceDirectives,
  findExitDirectives,
  instrumentSource,
  inferKind
};
