(function () {
  const NON_CODE_EVENT_TYPES = new Set(['fixed', 'keep']);
  const CONTROL_CONTEXT_TYPES = new Set([
    'ForStatement', 'IfStatement', 'WhileStatement', 'DoStatement', 'SwitchStatement'
  ]);
  const LOOP_CONTEXT_TYPES = new Set(['ForStatement', 'WhileStatement', 'DoStatement']);
  const CONDITION_BODY_MAX_LINES = 3;

  function sourceLines(source = '') {
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

  function commentMaskedLines(lines) {
    const masked = new Map();
    let blockComment = false;
    lines.forEach(line => {
      const output = [...line.text];
      let quote = '';
      let escaped = false;
      for (let cursor = 0; cursor < line.text.length; cursor += 1) {
        const char = line.text[cursor];
        const next = line.text[cursor + 1];
        if (blockComment) {
          output[cursor] = ' ';
          if (char === '*' && next === '/') {
            output[cursor + 1] = ' ';
            blockComment = false;
            cursor += 1;
          }
          continue;
        }
        if (quote) {
          if (escaped) escaped = false;
          else if (char === '\\') escaped = true;
          else if (char === quote) quote = '';
          continue;
        }
        if (char === '"' || char === "'") {
          quote = char;
          continue;
        }
        if (char === '/' && next === '/') {
          for (let rest = cursor; rest < output.length; rest += 1) output[rest] = ' ';
          break;
        }
        if (char === '/' && next === '*') {
          output[cursor] = ' ';
          output[cursor + 1] = ' ';
          blockComment = true;
          cursor += 1;
        }
      }
      masked.set(line.number, output.join('').replace(/\s+$/, ''));
    });
    return masked;
  }

  function mainWrapperLines(lines) {
    const hidden = new Set();
    let signatureStart = -1;
    let braceDepth = 0;
    let opened = false;
    let blockComment = false;
    let quote = '';
    let escaped = false;
    for (let index = 0; index < lines.length; index += 1) {
      const text = lines[index].text;
      if (signatureStart < 0 && /\bmain\s*\(/.test(text)) signatureStart = index;
      if (signatureStart < 0) continue;
      if (!opened) hidden.add(lines[index].number);
      for (let cursor = 0; cursor < text.length; cursor += 1) {
        const char = text[cursor];
        const next = text[cursor + 1];
        if (blockComment) {
          if (char === '*' && next === '/') {
            blockComment = false;
            cursor += 1;
          }
          continue;
        }
        if (quote) {
          if (escaped) escaped = false;
          else if (char === '\\') escaped = true;
          else if (char === quote) quote = '';
          continue;
        }
        if (char === '/' && next === '/') break;
        if (char === '/' && next === '*') {
          blockComment = true;
          cursor += 1;
          continue;
        }
        if (char === '"' || char === "'") {
          quote = char;
          continue;
        }
        if (char === '{') {
          braceDepth += 1;
          opened = true;
        } else if (char === '}' && opened) {
          braceDepth -= 1;
          if (braceDepth === 0) {
            hidden.add(lines[index].number);
            return hidden;
          }
        }
      }
    }
    return hidden;
  }

  function presentationLineNumbers(lines, displayLines = commentMaskedLines(lines)) {
    const hidden = mainWrapperLines(lines);
    let asmView = false;
    lines.forEach(line => {
      const text = line.text;
      if (/\/\*\s*@asm-view\b/i.test(text)) asmView = true;
      if (asmView) hidden.add(line.number);
      if (/@asm-view\s*\*\//i.test(text)) asmView = false;
      if (/^\s*\/\/.*@(?:frame|keep|text|style|segment|layout|asm(?:[-\w]*)?)\b/i.test(text)) {
        hidden.add(line.number);
      }
      if (!String(displayLines.get(line.number) || '').trim()) hidden.add(line.number);
      if (/^\s*#\s*include\b/i.test(text)
        || /^\s*using\s+namespace\b/i.test(text)
        || /^\s*return\s+0\s*;\s*(?:\/\/.*)?$/i.test(text)
        || /^\s*AV\s+[A-Za-z_]\w*\s*;/i.test(text)
        || /\bav\s*\.\s*(?:start_draw|start_frame_draw|frame_draw|end_draw)\s*\(/i.test(text)) {
        hidden.add(line.number);
      }
    });
    return hidden;
  }

  function compactLookup(text) {
    const compact = [];
    const offsets = [];
    for (let index = 0; index < text.length; index += 1) {
      if (/\s/.test(text[index])) continue;
      compact.push(text[index]);
      offsets.push(index);
    }
    return { text: compact.join(''), offsets };
  }

  function signatureExpression(event = {}) {
    const signature = String(event.signature || '');
    const match = signature.match(/^[^:]+:[^:]+:\d+:(.*)$/s);
    return String(event.expression || match?.[1] || '').trim();
  }

  function fallbackEventSource(event, lines, source) {
    const lineNumber = Number(event?.line);
    const line = lines[lineNumber - 1];
    if (!line) return null;
    const expression = signatureExpression(event);
    if (expression) {
      const haystack = compactLookup(line.text);
      const needle = compactLookup(expression).text;
      const compactStart = needle ? haystack.text.indexOf(needle) : -1;
      if (compactStart >= 0) {
        const localStart = haystack.offsets[compactStart];
        const compactEnd = compactStart + needle.length - 1;
        const localEnd = (haystack.offsets[compactEnd] ?? localStart) + 1;
        return {
          functionName: String(event.source?.functionName || ''),
          from: line.start + localStart,
          to: line.start + localEnd,
          line: line.number,
          column: localStart + 1,
          endLine: line.number,
          endColumn: localEnd + 1,
          text: source.slice(line.start + localStart, line.start + localEnd),
          contexts: []
        };
      }
    }
    const first = line.text.search(/\S/);
    const localStart = first >= 0 ? first : 0;
    return {
      functionName: String(event.source?.functionName || ''),
      from: line.start + localStart,
      to: line.end,
      line: line.number,
      column: localStart + 1,
      endLine: line.number,
      endColumn: line.text.length + 1,
      text: source.slice(line.start + localStart, line.end),
      contexts: []
    };
  }

  function eventSourceFor(event, lines, source, hidden) {
    if (!event || event.loopBoundarySuppressed === true || NON_CODE_EVENT_TYPES.has(event.type)) return null;
    const recorded = event.source;
    const from = Number(recorded?.from);
    const to = Number(recorded?.to);
    const candidate = Number.isFinite(from) && Number.isFinite(to) && to > from
      ? {
        ...recorded,
        from: Math.max(0, Math.min(source.length, from)),
        to: Math.max(0, Math.min(source.length, to)),
        contexts: Array.isArray(recorded.contexts) ? recorded.contexts : []
      }
      : fallbackEventSource(event, lines, source);
    if (!candidate || candidate.to <= candidate.from) return null;
    const lineNumber = Number(candidate.line) || Number(event.line) || 0;
    if (!lineNumber || hidden.has(lineNumber)) return null;
    return { event, ...candidate, line: lineNumber };
  }

  function presentationEvents(frame) {
    const events = Array.isArray(frame?.events) ? frame.events : [];
    return events.filter(event => event && event.loopBoundarySuppressed !== true);
  }

  function contextsAt(structure, from, to) {
    const start = Number(from);
    const end = Number(to);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return [];
    return (Array.isArray(structure) ? structure : [])
      .filter(context => Number(context?.from) <= start && Number(context?.to) >= end)
      .sort((left, right) => (
        (Number(right.to) - Number(right.from)) - (Number(left.to) - Number(left.from))
      ));
  }

  function structuralMask(source = '') {
    const output = [...source];
    let blockComment = false;
    let lineComment = false;
    let quote = '';
    let escaped = false;
    for (let cursor = 0; cursor < source.length; cursor += 1) {
      const char = source[cursor];
      const next = source[cursor + 1];
      if (lineComment) {
        if (char === '\n') lineComment = false;
        else output[cursor] = ' ';
        continue;
      }
      if (blockComment) {
        if (char === '*' && next === '/') {
          output[cursor] = ' ';
          output[cursor + 1] = ' ';
          blockComment = false;
          cursor += 1;
        } else if (char !== '\n' && char !== '\r') output[cursor] = ' ';
        continue;
      }
      if (quote) {
        if (char !== '\n' && char !== '\r') output[cursor] = ' ';
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === quote) quote = '';
        continue;
      }
      if (char === '/' && next === '/') {
        output[cursor] = ' ';
        output[cursor + 1] = ' ';
        lineComment = true;
        cursor += 1;
      } else if (char === '/' && next === '*') {
        output[cursor] = ' ';
        output[cursor + 1] = ' ';
        blockComment = true;
        cursor += 1;
      } else if (char === '"' || char === "'") {
        output[cursor] = ' ';
        quote = char;
      }
    }
    return output.join('');
  }

  function matchingDelimiter(source, openAt, open, close) {
    let depth = 0;
    for (let cursor = openAt; cursor < source.length; cursor += 1) {
      if (source[cursor] === open) depth += 1;
      else if (source[cursor] === close) {
        depth -= 1;
        if (!depth) return cursor;
      }
    }
    return -1;
  }

  function sourceLineAt(lines, offset) {
    const found = lines.find(line => line.start <= offset && offset <= line.end);
    return Number(found?.number) || 1;
  }

  // Older saved traces do not contain Lezer sourceStructure metadata. Rebuild the
  // brace-based control ancestry locally so their snippets still retain outer
  // loops and short false branches. New traces continue to use the exact AST data.
  function inferredControlStructure(source, lines) {
    const masked = structuralMask(source);
    const contexts = [];
    const kinds = {
      for: 'ForStatement', if: 'IfStatement', while: 'WhileStatement', switch: 'SwitchStatement'
    };
    const pattern = /\b(for|if|while|switch)\s*\(/g;
    let match;
    while ((match = pattern.exec(masked))) {
      const openParen = masked.indexOf('(', match.index + match[1].length);
      const closeParen = matchingDelimiter(masked, openParen, '(', ')');
      if (closeParen < 0) continue;
      let bodyOpen = closeParen + 1;
      while (/\s/.test(masked[bodyOpen] || '')) bodyOpen += 1;
      if (masked[bodyOpen] !== '{') continue;
      const bodyClose = matchingDelimiter(masked, bodyOpen, '{', '}');
      if (bodyClose < 0) continue;
      contexts.push({
        type: kinds[match[1]],
        from: match.index,
        to: bodyClose + 1,
        headerFrom: match.index,
        headerTo: bodyOpen,
        conditionFrom: openParen + 1,
        conditionTo: closeParen,
        structuralLines: [sourceLineAt(lines, match.index), sourceLineAt(lines, bodyClose)],
        openLine: sourceLineAt(lines, match.index),
        closeLine: sourceLineAt(lines, bodyClose)
      });
      pattern.lastIndex = closeParen + 1;
    }
    return contexts;
  }

  function contextKey(context) {
    return context
      ? `${context.type}:${Number(context.from) || 0}:${Number(context.to) || 0}`
      : '';
  }

  function orderedContexts(source) {
    return [...(source?.contexts || [])].sort((left, right) => {
      const leftSize = Number(left?.to) - Number(left?.from);
      const rightSize = Number(right?.to) - Number(right?.from);
      return rightSize - leftSize || Number(left?.from) - Number(right?.from);
    });
  }

  function outerSourceContext(source) {
    const contexts = orderedContexts(source);
    return contexts.find(context => CONTROL_CONTEXT_TYPES.has(context.type))
      || contexts.find(context => context.type === 'FunctionDefinition')
      || null;
  }

  function contextsOverlap(left, right) {
    if (!left || !right) return false;
    return Number(left.from) < Number(right.to) && Number(right.from) < Number(left.to);
  }

  function sourceFunctionName(source, root = null) {
    return String(root?.functionName || source?.functionName || '');
  }

  function sourceInsideContext(source, context) {
    if (!source || !context) return false;
    return Number(context.from) <= Number(source.from) && Number(context.to) >= Number(source.to);
  }

  function clusterSources(sources) {
    const sorted = [...sources].sort((left, right) => (
      Number(left.event?.order) - Number(right.event?.order)
      || Number(left.from) - Number(right.from)
    ));
    const clusters = [];
    sorted.forEach(source => {
      const root = outerSourceContext(source);
      const functionName = sourceFunctionName(source, root);
      const rootKey = contextKey(root) || `function:${functionName || 'global'}`;
      const existing = clusters.find(cluster => {
        if (cluster.rootKey === rootKey) return true;
        const clusterFunction = sourceFunctionName(cluster.sources[0], cluster.root);
        if (functionName !== clusterFunction) return false;
        if (root && cluster.root) return contextsOverlap(root, cluster.root);
        if (!root && !cluster.root) return true;
        if (!root) return sourceInsideContext(source, cluster.root);
        return cluster.sources.some(candidate => sourceInsideContext(candidate, root));
      });
      if (existing) {
        existing.sources.push(source);
        if (root && Number(root.to) - Number(root.from)
          > Number(existing.root?.to) - Number(existing.root?.from)) {
          existing.root = root;
          existing.rootKey = contextKey(root);
        }
      } else {
        clusters.push({ root, rootKey, sources: [source] });
      }
    });
    return clusters.map(cluster => cluster.sources);
  }

  function uniqueContexts(cluster) {
    const unique = new Map();
    cluster.flatMap(source => source.contexts || []).forEach(context => {
      const key = `${context.type}:${context.from}:${context.to}`;
      if (!unique.has(key)) unique.set(key, context);
    });
    return [...unique.values()];
  }

  function subtreeContext(cluster) {
    const start = Math.min(...cluster.map(source => Number(source.from) || 0));
    const end = Math.max(...cluster.map(source => Number(source.to) || Number(source.from) || 0));
    const containing = uniqueContexts(cluster).filter(context => {
      const from = Number(context.from);
      const to = Number(context.to);
      return Number.isFinite(from) && Number.isFinite(to) && from <= start && to >= end;
    });
    const controls = containing.filter(context => CONTROL_CONTEXT_TYPES.has(context.type));
    const candidates = controls.length
      ? controls
      : containing.filter(context => context.type === 'FunctionDefinition');
    return candidates.sort((left, right) => (
      (Number(right.to) - Number(right.from)) - (Number(left.to) - Number(left.from))
    )).at(0) || null;
  }

  function sourceLimit(cluster, lines, preferredContext = null) {
    const context = preferredContext || subtreeContext(cluster);
    return {
      start: Math.max(1, Number(context?.openLine) || 1),
      end: Math.min(lines.length, Number(context?.closeLine) || lines.length),
      context
    };
  }

  function addRangeLines(selected, lines, hidden, from, to) {
    const start = Number(from);
    const end = Number(to);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return;
    lines.forEach(line => {
      if (line.end < start || line.start > end || hidden.has(line.number)) return;
      if (line.text.trim()) selected.add(line.number);
    });
  }

  function addContextLines(selected, cluster, lines, hidden) {
    const contexts = uniqueContexts(cluster).sort((left, right) => (
      (Number(right.to) - Number(right.from)) - (Number(left.to) - Number(left.from))
    ));
    const controls = contexts.filter(context => CONTROL_CONTEXT_TYPES.has(context.type));
    const chosen = controls.length
      ? controls
      : contexts.filter(context => context.type === 'FunctionDefinition').slice(0, 1);
    chosen.forEach(context => {
      addRangeLines(
        selected, lines, hidden,
        Number(context.headerFrom) || Number(context.from),
        Number.isFinite(Number(context.headerTo)) ? Number(context.headerTo) : Number(context.from)
      );
      (context.structuralLines || []).forEach(number => {
        const line = Number(number);
        if (line > 0 && !hidden.has(line) && lines[line - 1]?.text.trim()) selected.add(line);
      });
      const open = Number(context.openLine);
      const close = Number(context.closeLine);
      if (open > 0 && !hidden.has(open)) selected.add(open);
      if (close > 0 && !hidden.has(close)) selected.add(close);
    });
  }

  function addLoopBodyLines(selected, cluster, lines, hidden) {
    uniqueContexts(cluster)
      .filter(context => LOOP_CONTEXT_TYPES.has(context.type))
      .forEach(context => addRangeLines(
        selected,
        lines,
        hidden,
        Number(context.from),
        Number(context.to)
      ));
  }

  function completeFunctionContext(cluster) {
    const functionName = String(cluster.find(source => source.functionName)?.functionName || '');
    if (!functionName || functionName === 'main') return null;
    return uniqueContexts(cluster).find(candidate => (
      candidate.type === 'FunctionDefinition'
      && (!candidate.functionName || candidate.functionName === functionName)
    )) || null;
  }

  function addCompleteFunctionLines(selected, cluster, lines, hidden) {
    const context = completeFunctionContext(cluster);
    if (!context) return null;
    addRangeLines(selected, lines, hidden, Number(context.from), Number(context.to));
    return context;
  }

  function directConditionContext(source) {
    const controls = orderedContexts(source).filter(context => CONTROL_CONTEXT_TYPES.has(context.type));
    const exact = controls.filter(context => {
      const from = Number(context?.conditionFrom);
      const to = Number(context?.conditionTo);
      return Number.isFinite(from) && Number.isFinite(to)
        && from <= Number(source?.from) && to >= Number(source?.to);
    });
    const conditionKind = String(source?.event?.conditionKind || '');
    const candidates = exact.length
      ? exact
      : controls.filter(context => !conditionKind || context.type === conditionKind);
    return candidates.sort((left, right) => (
      (Number(left.to) - Number(left.from)) - (Number(right.to) - Number(right.from))
    )).at(0) || null;
  }

  function addConditionBodyLines(selected, cluster, lines, hidden) {
    cluster.filter(source => source?.event?.type === 'condition').forEach(source => {
      const context = directConditionContext(source);
      if (!context) return;
      const bodyFrom = Number(context.headerTo);
      const bodyTo = Number(context.to);
      if (!Number.isFinite(bodyFrom) || !Number.isFinite(bodyTo) || bodyTo <= bodyFrom) return;
      const openLine = Number(context.openLine);
      const closeLine = Number(context.closeLine);
      const bodyLines = openLine === closeLine
        ? lines.filter(line => line.start <= bodyTo && line.end >= bodyFrom && !hidden.has(line.number))
        : lines.filter(line => line.number > openLine && line.number < closeLine
          && !hidden.has(line.number)
          && !/^(?:else)?$/.test(line.text.replace(/[{}]/g, '').trim()));
      if (bodyLines.length > CONDITION_BODY_MAX_LINES) return;
      addRangeLines(selected, lines, hidden, bodyFrom, bodyTo);
    });
  }

  function sourceBraceDeltas(lines) {
    const deltas = new Map();
    let blockComment = false;
    let quote = '';
    let escaped = false;
    lines.forEach(line => {
      let delta = 0;
      for (let cursor = 0; cursor < line.text.length; cursor += 1) {
        const char = line.text[cursor];
        const next = line.text[cursor + 1];
        if (blockComment) {
          if (char === '*' && next === '/') {
            blockComment = false;
            cursor += 1;
          }
          continue;
        }
        if (quote) {
          if (escaped) escaped = false;
          else if (char === '\\') escaped = true;
          else if (char === quote) quote = '';
          continue;
        }
        if (char === '/' && next === '/') break;
        if (char === '/' && next === '*') {
          blockComment = true;
          cursor += 1;
          continue;
        }
        if (char === '"' || char === "'") {
          quote = char;
          continue;
        }
        if (char === '{') delta += 1;
        else if (char === '}') delta -= 1;
      }
      deltas.set(line.number, delta);
    });
    return deltas;
  }

  function addStructuralClosingLines(selected, lines, hidden) {
    if (!selected.size) return;
    const deltas = sourceBraceDeltas(lines);
    let balance = [...selected].reduce((sum, number) => sum + (deltas.get(number) || 0), 0);
    if (balance <= 0) return;
    let cursor = Math.max(...selected) + 1;
    let scannedBalance = balance;
    while (cursor <= lines.length && balance > 0) {
      const nextBalance = scannedBalance + (deltas.get(cursor) || 0);
      if (nextBalance < balance) {
        if (!hidden.has(cursor) && lines[cursor - 1]?.text.trim()) selected.add(cursor);
        balance = Math.max(0, nextBalance);
      }
      scannedBalance = nextBalance;
      cursor += 1;
    }
  }

  function segmentsForLine(line, cluster) {
    const ranges = cluster.map(source => ({
      eventId: String(source.event?.id || ''),
      start: Math.max(line.start, source.from) - line.start,
      end: Math.min(line.end, source.to) - line.start
    })).filter(range => range.eventId && range.end > range.start);
    const boundaries = new Set([0, line.text.length]);
    ranges.forEach(range => {
      boundaries.add(Math.max(0, Math.min(line.text.length, range.start)));
      boundaries.add(Math.max(0, Math.min(line.text.length, range.end)));
    });
    const points = [...boundaries].sort((left, right) => left - right);
    return points.slice(0, -1).map((start, index) => {
      const end = points[index + 1];
      return {
        text: line.text.slice(start, end),
        from: line.start + start,
        to: line.start + end,
        eventIds: ranges.filter(range => start >= range.start && end <= range.end)
          .map(range => range.eventId)
      };
    }).filter(segment => segment.text);
  }

  function tokenizeSource(source = '', tokenizer = null) {
    const byLine = new Map();
    if (!tokenizer?.getLineTokens) return byLine;
    let state = 'start';
    sourceLines(source).forEach(line => {
      let result;
      try {
        result = tokenizer.getLineTokens(line.text, state);
      } catch (_) {
        result = null;
      }
      const tokens = [];
      let cursor = 0;
      (result?.tokens || []).forEach(token => {
        const value = String(token?.value || '');
        if (!value) return;
        tokens.push({
          type: String(token?.type || 'text'),
          text: value,
          from: line.start + cursor,
          to: line.start + cursor + value.length
        });
        cursor += value.length;
      });
      if (cursor < line.text.length) {
        tokens.push({
          type: 'text',
          text: line.text.slice(cursor),
          from: line.start + cursor,
          to: line.end
        });
      }
      byLine.set(line.number, tokens);
      if (result?.state != null) state = result.state;
    });
    return byLine;
  }

  function mergeSyntaxSegments(item, syntaxTokens = []) {
    const sourceSegments = Array.isArray(item?.segments) ? item.segments : [];
    if (!sourceSegments.length || !syntaxTokens.length) return sourceSegments;
    const merged = [];
    sourceSegments.forEach(segment => {
      const boundaries = new Set([segment.from, segment.to]);
      syntaxTokens.forEach(token => {
        if (token.to <= segment.from || token.from >= segment.to) return;
        boundaries.add(Math.max(segment.from, token.from));
        boundaries.add(Math.min(segment.to, token.to));
      });
      const points = [...boundaries].sort((left, right) => left - right);
      points.slice(0, -1).forEach((from, index) => {
        const to = points[index + 1];
        if (to <= from) return;
        const token = syntaxTokens.find(candidate => candidate.from <= from && candidate.to >= to);
        merged.push({
          text: item.text.slice(from - item.sourceStart, to - item.sourceStart),
          from,
          to,
          eventIds: [...(segment.eventIds || [])],
          tokenType: String(token?.type || 'text')
        });
      });
    });
    return merged.filter(segment => segment.text);
  }

  function referencedIdentifiers(cluster, lines, limit) {
    const identifiers = new Set();
    const collect = text => {
      String(text || '').match(/[A-Za-z_]\w*/g)?.forEach(identifier => identifiers.add(identifier));
    };
    // A control operand such as n in `i < n` is already explained by the
    // condition line. Pulling in its declaration/input setup is indirect
    // context that obscures the algorithm. Only state-changing and call
    // events may bring earlier declarations into the current fragment.
    cluster.filter(source => !['read', 'compare', 'condition'].includes(source.event?.type))
      .forEach(source => collect(source.text || source.event?.expression || source.event?.signature));
    return identifiers;
  }

  function declarationLinesForCluster(
    cluster, declarations, lines, hidden, limit, excludedNames = new Set()
  ) {
    const identifiers = referencedIdentifiers(cluster, lines, limit);
    if (!identifiers.size) return [];
    const firstSource = Math.min(...cluster.map(source => Number(source.from) || 0));
    const functionName = String(cluster.find(source => source.functionName)?.functionName || '');
    return (Array.isArray(declarations) ? declarations : [])
      .filter(declaration => declaration?.declarationKind !== 'parameter'
        && identifiers.has(String(declaration?.name || ''))
        && !excludedNames.has(String(declaration?.name || ''))
        && (!functionName || String(declaration?.functionName || '') === functionName)
        && Number(declaration?.to) <= firstSource
        && Number(declaration?.line) > 0
        && Number(declaration?.line) < limit.start
        && !hidden.has(Number(declaration.line)))
      .sort((left, right) => Number(left.line) - Number(right.line))
      .slice(-3)
      .map(declaration => Number(declaration.line));
  }

  function lineItem(number, cluster, lines, displayLines) {
    const line = lines[number - 1];
    const displayText = String(displayLines.get(number) ?? line.text);
    const displayLine = { ...line, end: line.start + displayText.length, text: displayText };
    return {
      kind: 'line',
      number,
      sourceStart: displayLine.start,
      sourceEnd: displayLine.end,
      text: displayLine.text,
      segments: segmentsForLine(displayLine, cluster)
    };
  }

  function lineIndent(item) {
    return item?.kind === 'line' ? String(item.text || '').match(/^\s*/)?.[0].length || 0 : Infinity;
  }

  function trimLineIndent(item, columns) {
    if (item?.kind !== 'line' || !(columns > 0)) return item;
    const trim = Math.min(columns, lineIndent(item));
    if (!trim) return item;
    const sourceStart = Number(item.sourceStart) + trim;
    return {
      ...item,
      sourceStart,
      text: String(item.text || '').slice(trim),
      segments: (item.segments || []).map(segment => {
        if (Number(segment.to) <= sourceStart) return null;
        const from = Math.max(Number(segment.from), sourceStart);
        return {
          ...segment,
          from,
          text: String(segment.text || '').slice(Math.max(0, from - Number(segment.from)))
        };
      }).filter(segment => segment?.text)
    };
  }

  function normalizeFragmentIndent(fragment) {
    const lines = [...(fragment.items || []), ...(fragment.expandedItems || [])]
      .filter(item => item?.kind === 'line' && String(item.text || '').trim());
    const columns = lines.length ? Math.min(...lines.map(lineIndent)) : 0;
    if (!(columns > 0) || !Number.isFinite(columns)) return fragment;
    return {
      ...fragment,
      indentColumns: columns,
      items: (fragment.items || []).map(item => trimLineIndent(item, columns)),
      expandedItems: (fragment.expandedItems || []).map(item => trimLineIndent(item, columns))
    };
  }

  function itemsForNumbers(numbers, cluster, lines, hidden, displayLines, limit) {
    const items = [];
    const omittedAlgorithmLines = (from, to) => from <= to
      ? lines.slice(from - 1, to).filter(line => !hidden.has(line.number) && line.text.trim())
      : [];
    const appendGap = (from, to) => {
      const omitted = omittedAlgorithmLines(from, to);
      const insideSubtree = from >= limit.start && to <= limit.end;
      if (omitted.length === 1 && insideSubtree) {
        items.push(lineItem(omitted[0].number, cluster, lines, displayLines));
      } else if (omitted.length > 1 && items.at(-1)?.kind !== 'ellipsis') {
        items.push({ kind: 'ellipsis' });
      } else if (omitted.length === 1 && items.at(-1)?.kind !== 'ellipsis') {
        items.push({ kind: 'ellipsis' });
      }
    };
    if (numbers.length) appendGap(limit.start, numbers[0] - 1);
    numbers.forEach((number, index) => {
      const previous = numbers[index - 1];
      if (previous && number > previous + 1) appendGap(previous + 1, number - 1);
      items.push(lineItem(number, cluster, lines, displayLines));
    });
    if (numbers.length) appendGap(numbers.at(-1) + 1, limit.end);
    return items;
  }

  function fragmentForCluster(
    cluster, lines, hidden, displayLines, declarations, excludedDeclarationNames = new Set()
  ) {
    const selected = new Set();
    cluster.forEach(source => {
      const endLine = Number(source.endLine) || source.line;
      for (let line = source.line; line <= endLine; line += 1) {
        if (!hidden.has(line)) selected.add(line);
      }
    });
    addContextLines(selected, cluster, lines, hidden);
    // A loop is the unit readers use to understand repeated execution. Keep
    // its complete body visible instead of turning individual loop lines into
    // a changing collection of ellipses on every iteration.
    addLoopBodyLines(selected, cluster, lines, hidden);
    addConditionBodyLines(selected, cluster, lines, hidden);
    const functionContext = addCompleteFunctionLines(selected, cluster, lines, hidden);
    const activeLimit = sourceLimit(cluster, lines, functionContext);
    addStructuralClosingLines(selected, lines, hidden);
    const limit = sourceLimit(cluster, lines, functionContext);
    declarationLinesForCluster(
      cluster, declarations, lines, hidden, activeLimit, excludedDeclarationNames
    )
      .forEach(number => selected.add(number));
    const numbers = [...selected].filter(number => lines[number - 1] && !hidden.has(number))
      .sort((left, right) => left - right);
    const expandedNumbers = [...new Set([
      ...declarationLinesForCluster(
        cluster, declarations, lines, hidden, activeLimit, excludedDeclarationNames
      ),
      ...lines.slice(limit.start - 1, limit.end)
        .filter(line => !hidden.has(line.number) && line.text.trim())
        .map(line => line.number)
    ])].sort((left, right) => left - right);
    const context = limit.context;
    return normalizeFragmentIndent({
      functionName: String(cluster.find(source => source.functionName)?.functionName || ''),
      eventIds: [...new Set(cluster.map(source => String(source.event?.id || '')).filter(Boolean))],
      focusLine: Math.min(...cluster.map(source => Number(source.line) || 1)),
      subtreeKey: context
        ? `${context.type}:${context.from}:${context.to}`
        : `lines:${limit.start}:${limit.end}`,
      items: itemsForNumbers(numbers, cluster, lines, hidden, displayLines, limit),
      expandedItems: itemsForNumbers(expandedNumbers, cluster, lines, hidden, displayLines, limit)
    });
  }

  const SETUP_KEYWORDS = new Set([
    'alignas', 'alignof', 'and', 'auto', 'bool', 'break', 'case', 'catch', 'char',
    'class', 'const', 'constexpr', 'continue', 'default', 'delete', 'do', 'double',
    'else', 'enum', 'false', 'float', 'for', 'if', 'int', 'long', 'namespace', 'new',
    'not', 'nullptr', 'or', 'private', 'protected', 'public', 'return', 'short',
    'signed', 'sizeof', 'static', 'std', 'string', 'struct', 'switch', 'template',
    'this', 'throw', 'true', 'try', 'typename', 'unsigned', 'using', 'vector', 'void',
    'volatile', 'while'
  ]);

  function identifiersIn(text) {
    return [...new Set(String(text || '').match(/[A-Za-z_]\w*/g) || [])]
      .filter(identifier => !SETUP_KEYWORDS.has(identifier));
  }

  function escapeRegExp(text) {
    return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function displayedFrameNames(document, frame) {
    const captureOnly = new Set(frame?.captureOnlyVariableIds || []);
    return [...new Set(Object.entries(frame?.state || {})
      .filter(([id]) => !captureOnly.has(id))
      .map(([id, state]) => String(state?.name || document?.variables?.[id]?.name || ''))
      .filter(Boolean))];
  }

  function displayedContainerNames(document, frame) {
    const captureOnly = new Set(frame?.captureOnlyVariableIds || []);
    return new Set(Object.entries(frame?.state || {}).filter(([id, state]) => {
      if (captureOnly.has(id)) return false;
      const kind = String(state?.data?.kind || document?.variables?.[id]?.kind || '');
      return !['', 'scalar', 'string'].includes(kind);
    }).map(([id, state]) => (
      String(state?.name || document?.variables?.[id]?.name || '')
    )).filter(Boolean));
  }

  function sourceForLine(line, functionName, structure) {
    const first = Math.max(0, line.text.search(/\S/));
    const last = line.text.search(/\s*$/);
    const from = line.start + first;
    const to = line.start + Math.max(first + 1, last);
    return {
      event: null,
      functionName,
      from,
      to,
      line: line.number,
      endLine: line.number,
      text: line.text,
      contexts: contextsAt(structure, from, to)
    };
  }

  function setupSources(document, frame, lines, hidden, displayLines) {
    const names = new Set(displayedFrameNames(document, frame));
    if (!names.size) return [];
    const frameLine = Math.max(1, Number(frame?.source?.line) || lines.length);
    const functionName = String(frame?.source?.function || frame?.source?.functionName || 'main');
    const declarations = (document?.sourceDeclarations || []).filter(declaration => (
      Number(declaration?.line) > 0
      && Number(declaration.line) <= frameLine
      && (!functionName || String(declaration?.functionName || '') === functionName)
    ));
    const selected = new Set();
    let changed = true;
    while (changed) {
      changed = false;
      declarations.forEach(declaration => {
        if (!names.has(String(declaration?.name || ''))) return;
        const number = Number(declaration.line);
        if (!selected.has(number)) {
          selected.add(number);
          changed = true;
        }
        identifiersIn(displayLines.get(number) ?? lines[number - 1]?.text).forEach(identifier => {
          if (!names.has(identifier) && declarations.some(item => item.name === identifier)) {
            names.add(identifier);
            changed = true;
          }
        });
      });
    }
    lines.slice(0, frameLine).forEach(line => {
      if (hidden.has(line.number)) return;
      const text = String(displayLines.get(line.number) ?? line.text);
      const isInput = /(?:\bcin\s*>>|\bgetline\s*\(|\bscanf\s*\()/i.test(text);
      if (!isInput) return;
      const referencesShownValue = [...names].some(name => (
        new RegExp(`\\b${escapeRegExp(name)}\\b`).test(text)
      ));
      if (referencesShownValue) selected.add(line.number);
    });
    return [...selected]
      .sort((left, right) => left - right)
      .map(number => lines[number - 1])
      .filter(line => line && !hidden.has(line.number) && line.text.trim())
      .map(line => sourceForLine(line, functionName, document?.sourceStructure));
  }

  function planLayoutKey(fragments) {
    return fragments.map(fragment => (fragment.items || []).map(item => (
      item.kind === 'line' ? `L${item.number}` : 'E'
    )).join(',')).join('|');
  }

  function planFrame(document, frame) {
    const source = String(document?.sourceCode || '');
    if (!source || !frame) return { frameId: frame?.id || '', sourceCode: source, fragments: [] };
    const lines = sourceLines(source);
    const displayLines = commentMaskedLines(lines);
    const hidden = presentationLineNumbers(lines, displayLines);
    const sourceStructure = Array.isArray(document?.sourceStructure)
      && document.sourceStructure.length
      ? document.sourceStructure
      : inferredControlStructure(source, lines);
    const frameEvents = Array.isArray(frame.events) ? frame.events : [];
    let sources = presentationEvents(frame)
      .map(event => eventSourceFor(event, lines, source, hidden))
      .filter(Boolean)
      .map(item => item.contexts?.length ? item : {
        ...item,
        contexts: contextsAt(sourceStructure, item.from, item.to)
      });
    const hasRuntimeCodeEvents = frameEvents.some(event => (
      event && !NON_CODE_EVENT_TYPES.has(event.type)
    ));
    if (!sources.length && !hasRuntimeCodeEvents) {
      sources = setupSources({ ...document, sourceStructure }, frame, lines, hidden, displayLines);
    }
    const fragments = clusterSources(sources)
      .map(cluster => fragmentForCluster(
        cluster,
        lines,
        hidden,
        displayLines,
        document.sourceDeclarations,
        displayedContainerNames(document, frame)
      ))
      .filter(fragment => fragment.items.length);
    return {
      frameId: frame.id || '',
      sourceCode: source,
      hiddenLines: [...hidden],
      focusLine: fragments.length
        ? Math.min(...fragments.map(fragment => Number(fragment.focusLine) || 1))
        : 0,
      layoutKey: planLayoutKey(fragments),
      subtreeKey: fragments.map(fragment => fragment.subtreeKey).join('|'),
      fragments
    };
  }

  window.ASMTraceCodeModel = {
    sourceLines,
    commentMaskedLines,
    presentationLineNumbers,
    eventSourceFor,
    tokenizeSource,
    mergeSyntaxSegments,
    presentationEvents,
    planFrame
  };
})();
