(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ASMTraceViewSource = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const BLOCK_PATTERN = /\/\*\s*@asm-view\s*\r?\n([\s\S]*?)\r?\n\s*@asm-view\s*\*\//m;

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function findBlock(source) {
    const text = String(source || '');
    const match = BLOCK_PATTERN.exec(text);
    if (!match) return null;
    return {
      start: match.index,
      end: match.index + match[0].length,
      text: match[0],
      json: match[1]
    };
  }

  function parse(source) {
    const block = findBlock(source);
    if (!block) return null;
    try {
      const value = JSON.parse(block.json);
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('設定內容必須是 JSON 物件');
      }
      return value;
    } catch (error) {
      throw new Error(`@asm-view 格式錯誤：${error.message}`);
    }
  }

  function format(settings) {
    return `/* @asm-view\n${JSON.stringify(settings || {}, null, 2)}\n@asm-view */`;
  }

  function upsert(source, settings) {
    const text = String(source || '');
    const block = findBlock(text);
    const nextBlock = format(settings);
    if (block) return `${text.slice(0, block.start)}${nextBlock}${text.slice(block.end)}`;
    const body = text.replace(/\s+$/, '');
    return `${body}${body ? '\n\n' : ''}${nextBlock}\n`;
  }

  function directiveName(frame) {
    return String(frame?.source?.directiveName || '').trim();
  }

  function sourceSelector(frame) {
    const statementId = String(frame?.source?.statementId || '');
    const manual = /^manual-frame:(.*):(\d+):(\d+)$/.exec(statementId);
    if (manual) {
      return {
        kind: 'manual-frame',
        functionName: manual[1],
        directiveIndex: Number(manual[3])
      };
    }
    return statementId ? { statementId } : null;
  }

  function sourceMatches(frame, selector) {
    if (!selector || typeof selector !== 'object') return false;
    if (selector.statementId) {
      return String(frame?.source?.statementId || '') === String(selector.statementId);
    }
    const candidate = sourceSelector(frame);
    return candidate?.kind === selector.kind
      && candidate?.functionName === selector.functionName
      && Number(candidate?.directiveIndex) === Number(selector.directiveIndex);
  }

  function selectorKey(selector) {
    return JSON.stringify(selector || null);
  }

  function frameIdsForDescriptor(descriptor, frames) {
    const list = Array.isArray(frames) ? frames : [];
    const ids = new Set(Array.isArray(descriptor?.frameIds) ? descriptor.frameIds : []);
    if (descriptor?.allFrames === true) list.forEach(frame => ids.add(frame.id));
    const names = new Set(Array.isArray(descriptor?.directiveNames) ? descriptor.directiveNames : []);
    if (names.size) list.forEach(frame => {
      if (names.has(directiveName(frame))) ids.add(frame.id);
    });
    (Array.isArray(descriptor?.frameSelectors) ? descriptor.frameSelectors : []).forEach(selector => {
      const matches = list.filter(frame => directiveName(frame) === selector?.directiveName);
      const frame = matches[Number(selector?.occurrence) || 0];
      if (frame) ids.add(frame.id);
    });
    (Array.isArray(descriptor?.sourceSelectors) ? descriptor.sourceSelectors : []).forEach(selector => {
      list.filter(frame => sourceMatches(frame, selector)).forEach(frame => ids.add(frame.id));
    });
    (Array.isArray(descriptor?.sourceFrameSelectors) ? descriptor.sourceFrameSelectors : []).forEach(record => {
      const matches = list.filter(frame => sourceMatches(frame, record?.selector));
      const frame = matches[Number(record?.occurrence) || 0];
      if (frame) ids.add(frame.id);
    });
    return [...ids].filter(id => list.some(frame => frame.id === id));
  }

  function describeFrameIds(frameIds, frames) {
    const list = Array.isArray(frames) ? frames : [];
    const selected = new Set((Array.isArray(frameIds) ? frameIds : []).filter(Boolean));
    const selectedFrames = list.filter(frame => selected.has(frame.id));
    if (list.length && selected.size === list.length && list.every(frame => selected.has(frame.id))) {
      return { allFrames: true };
    }
    const names = [...new Set(selectedFrames.map(directiveName).filter(Boolean))];
    const completeNamedScope = selectedFrames.length === selected.size
      && selectedFrames.length > 0
      && selectedFrames.every(frame => Boolean(directiveName(frame)))
      && names.every(name => list
        .filter(frame => directiveName(frame) === name)
        .every(frame => selected.has(frame.id)));
    if (completeNamedScope) return { directiveNames: names };

    const unnamedSelectors = [...new Map(selectedFrames
      .filter(frame => !directiveName(frame))
      .map(frame => sourceSelector(frame))
      .filter(Boolean)
      .map(selector => [selectorKey(selector), selector])).values()];
    const completeSourceScope = selectedFrames.length === selected.size
      && selectedFrames.length > 0
      && selectedFrames.every(frame => !directiveName(frame) && sourceSelector(frame))
      && unnamedSelectors.every(selector => list
        .filter(frame => sourceMatches(frame, selector))
        .every(frame => selected.has(frame.id)));
    if (completeSourceScope) {
      return { sourceSelectors: unnamedSelectors };
    }

    const frameSelectors = [];
    const sourceFrameSelectors = [];
    const fallbackIds = [];
    selectedFrames.forEach(frame => {
      const name = directiveName(frame);
      if (!name) {
        const selector = sourceSelector(frame);
        if (!selector) {
          fallbackIds.push(frame.id);
          return;
        }
        const occurrence = list.filter(candidate => sourceMatches(candidate, selector)).indexOf(frame);
        sourceFrameSelectors.push({ selector, occurrence: Math.max(0, occurrence) });
        return;
      }
      const occurrence = list.filter(candidate => directiveName(candidate) === name).indexOf(frame);
      frameSelectors.push({ directiveName: name, occurrence: Math.max(0, occurrence) });
    });
    selected.forEach(id => {
      if (!list.some(frame => frame.id === id)) fallbackIds.push(id);
    });
    return {
      ...(frameSelectors.length ? { frameSelectors } : {}),
      ...(sourceFrameSelectors.length ? { sourceFrameSelectors } : {}),
      ...(fallbackIds.length ? { frameIds: [...new Set(fallbackIds)] } : {})
    };
  }

  function encodeScopes(value, frames) {
    if (Array.isArray(value)) return value.map(item => encodeScopes(item, frames));
    if (!value || typeof value !== 'object') return value;
    const next = {};
    Object.entries(value).forEach(([key, item]) => {
      if (key === 'frameIds' && Array.isArray(item)) return;
      next[key] = encodeScopes(item, frames);
    });
    if (Array.isArray(value.frameIds)) Object.assign(next, describeFrameIds(value.frameIds, frames));
    return next;
  }

  function decodeScopes(value, frames) {
    if (Array.isArray(value)) return value.map(item => decodeScopes(item, frames));
    if (!value || typeof value !== 'object') return value;
    const next = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decodeScopes(item, frames)]));
    if (value.allFrames || value.directiveNames || value.frameSelectors
      || value.sourceSelectors || value.sourceFrameSelectors) {
      next.frameIds = frameIdsForDescriptor(value, frames);
    }
    return next;
  }

  function encodeFrameMap(map, frames) {
    const groups = new Map();
    Object.entries(map || {}).forEach(([frameId, value]) => {
      const signature = JSON.stringify(value);
      if (!groups.has(signature)) groups.set(signature, { frameIds: [], value: clone(value) });
      groups.get(signature).frameIds.push(frameId);
    });
    return [...groups.values()].map(group => ({
      ...describeFrameIds(group.frameIds, frames),
      value: encodeScopes(group.value, frames)
    }));
  }

  function decodeFrameMap(records, frames) {
    const result = {};
    (Array.isArray(records) ? records : []).forEach(record => {
      frameIdsForDescriptor(record, frames).forEach(frameId => {
        result[frameId] = decodeScopes(clone(record.value || {}), frames);
      });
    });
    return result;
  }

  function sanitizeTransitions(transitions) {
    return (Array.isArray(transitions) ? transitions : []).map(rule => {
      const next = { ...rule, mode: rule?.mode === 'instant' ? 'instant' : 'auto' };
      delete next.duration;
      delete next.easing;
      return next;
    });
  }

  function fromTrace(trace) {
    const frames = trace?.frames || [];
    const studio = clone(trace?.studio || {});
    ['eventColors', 'eventSignatureColors', 'eventAnimations', 'transitionDefaults'].forEach(key => {
      delete studio[key];
    });
    studio.transitions = sanitizeTransitions(studio.transitions);
    const frameMaps = {};
    ['positions', 'bindings', 'visibility', 'objectStyles'].forEach(key => {
      if (studio[key] && Object.keys(studio[key]).length) frameMaps[key] = encodeFrameMap(studio[key], frames);
      delete studio[key];
    });
    if (Object.keys(frameMaps).length) studio.frameMaps = frameMaps;
    return {
      version: 1,
      rules: encodeScopes(clone(trace?.rules || []), frames),
      skins: clone(trace?.skins || {}),
      studio: encodeScopes(studio, frames)
    };
  }

  function applyToTrace(trace, settings) {
    if (!trace || !settings || typeof settings !== 'object') return trace;
    const frames = trace.frames || [];
    if (Array.isArray(settings.rules)) trace.rules = decodeScopes(clone(settings.rules), frames);
    if (settings.skins && typeof settings.skins === 'object') {
      trace.skins = { ...(trace.skins || {}), ...clone(settings.skins) };
    }
    if (settings.studio && typeof settings.studio === 'object') {
      const studio = decodeScopes(clone(settings.studio), frames);
      ['eventColors', 'eventSignatureColors', 'eventAnimations', 'transitionDefaults'].forEach(key => {
        delete studio[key];
      });
      studio.transitions = sanitizeTransitions(studio.transitions);
      const frameMaps = studio.frameMaps || {};
      delete studio.frameMaps;
      ['positions', 'bindings', 'visibility', 'objectStyles'].forEach(key => {
        if (frameMaps[key]) studio[key] = decodeFrameMap(frameMaps[key], frames);
      });
      trace.studio = studio;
    }
    return trace;
  }

  return {
    findBlock,
    parse,
    format,
    upsert,
    directiveName,
    sourceSelector,
    sourceMatches,
    describeFrameIds,
    frameIdsForDescriptor,
    fromTrace,
    applyToTrace
  };
});
