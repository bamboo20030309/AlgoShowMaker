/**
 * 模組：Studio 設定來源碼編解碼
 *
 * 責任：在原始碼中的專用設定區塊與 trace.studio 文件模型之間進行精簡、可逆的轉換。
 * 資料流：儲存時壓縮 renderer、scope、binding、camera 與 transition；載入時解析 JSON、還原 frame/variable 參照，再套入已正規化 trace。
 * 重要不變條件：只改寫受管理的設定區塊，其他使用者原始碼須逐字保留；encode/decode 的 scope 對應必須在 frame id 改變時仍可解析。
 * 相容性：支援舊 variable key、renderer 別名與未壓縮設定；不認得的安全資料保留或忽略，不讓整份來源無法載入。
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ASMTraceViewSource = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const BLOCK_PATTERN = /\/\*\s*@asm-view\s*\r?\n([\s\S]*?)\r?\n\s*@asm-view\s*\*\//m;

  // ---------------------------------------------------------------------------
  // 區段：設定值與 renderer 壓縮
  // ---------------------------------------------------------------------------
  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  // 動畫完全由指令驅動（2026-11-14）：Studio 的手動調整一律捨棄，其他設定（事件、程式碼片段…）照常保留。
  // 清單須與 trace-model.js 的 MANUAL_STUDIO_KEYS 相同（tests/directive-only-studio.test.js 檢查）。
  const MANUAL_STUDIO_KEYS = new Set([
    'positions', 'bindings', 'objects', 'arrows', 'objectStyles', 'visibility',
    'cameraRules', 'transitions', 'transitionDefaults'
  ]);
  function directiveStudio(studio) {
    if (!isObject(studio)) return {};
    const kept = {};
    Object.entries(studio).forEach(([key, value]) => {
      if (!MANUAL_STUDIO_KEYS.has(key) && key !== 'frameMaps') kept[key] = clone(value);
    });
    if (isObject(studio.frameMaps)) {
      const frameMaps = Object.fromEntries(Object.entries(studio.frameMaps)
        .filter(([key]) => !MANUAL_STUDIO_KEYS.has(key)).map(([key, value]) => [key, clone(value)]));
      if (Object.keys(frameMaps).length) kept.frameMaps = frameMaps;
    }
    return kept;
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
      array: 'original-array', sequence: 'original-array', matrix: 'original-matrix',
      scalar: 'original-cell', string: 'original-cell', stack: 'original-stack',
      queue: 'original-queue'
    };
    return legacy[renderer] || renderer || defaultRenderer(variable);
  }

  function activeVariableIds(trace) {
    const ids = new Set(Object.keys(trace?.variables || {}));
    (trace?.frames || []).forEach(frame => Object.keys(frame?.state || {}).forEach(id => ids.add(id)));
    return ids;
  }

  function compactSkins(trace) {
    const variables = trace?.variables || {};
    const activeIds = activeVariableIds(trace);
    const result = {};
    Object.entries(trace?.skins || {}).forEach(([variableId, source]) => {
      if (activeIds.size && !activeIds.has(variableId)) return;
      const variable = variables[variableId] || {};
      const skin = isObject(source) ? clone(source) : {};
      const renderer = canonicalRenderer(skin.renderer, variable);
      if (renderer === defaultRenderer(variable)) delete skin.renderer;
      else skin.renderer = renderer;
      const options = isObject(skin.options) ? { ...skin.options } : {};
      const defaultShowIndex = !['scalar', 'string'].includes(variable.kind);
      if (options.showIndex === defaultShowIndex) delete options.showIndex;
      if (Number(options.gap) === 0) delete options.gap;
      if (Array.isArray(options.range) && !options.range.length) delete options.range;
      if (Object.keys(options).length) skin.options = options;
      else delete skin.options;
      if (Object.keys(skin).length) result[variableId] = skin;
    });
    return result;
  }

  function canonicalInstructionKey(value = '') {
    const signature = String(value || '');
    const fixed = signature.match(/^fixed:(.+@\d+):(.*)$/s);
    if (fixed) return `fixed:${fixed[1].replace(/@\d+$/, '')}:${fixed[2]}`;
    const traced = signature.match(/^([^:]+):([^:]+):\d+:(.*)$/s);
    return traced ? `${traced[1]}:${traced[2]}:${traced[3]}` : signature;
  }

  function compactInstructionStates(states) {
    const result = {};
    Object.entries(isObject(states) ? states : {}).forEach(([key, value]) => {
      const canonical = canonicalInstructionKey(key);
      if (/^fixed:/.test(canonical)) return;
      if (canonical) result[canonical] = value !== false;
    });
    return result;
  }

  function variableReference(variable) {
    if (!variable?.name) return null;
    return {
      name: variable.name,
      functionName: variable.functionName || 'global'
    };
  }

  function legacyVariableReference(key) {
    const match = String(key || '').match(/^(.+):([^:@]+)@\d+$/);
    return match ? { functionName: match[1], name: match[2] } : null;
  }

  // ---------------------------------------------------------------------------
  // 區段：變數參照映射
  // ---------------------------------------------------------------------------
  function variableReferenceTable(trace, value) {
    const serialized = JSON.stringify(value || {});
    const result = {};
    Object.entries(trace?.variables || {}).forEach(([variableId, variable]) => {
      if (!legacyVariableReference(variableId)) return;
      if (!serialized.includes(variableId)) return;
      const reference = variableReference(variable) || legacyVariableReference(variableId);
      if (reference) result[variableId] = reference;
    });
    return result;
  }

  function remapVariableToken(value, replacements, candidates) {
    if (typeof value !== 'string') return value;
    if (replacements.has(value)) return replacements.get(value);
    const prefix = candidates.find(variableId => value.startsWith(`${variableId}#`)
      || value.startsWith(`${variableId}:label`)
      || value.startsWith(`${variableId}:index`));
    return prefix ? `${replacements.get(prefix)}${value.slice(prefix.length)}` : value;
  }

  function remapVariableReferences(value, replacements, candidates = null) {
    const ordered = candidates || [...replacements.keys()].sort((left, right) => right.length - left.length);
    if (Array.isArray(value)) return value.map(item => remapVariableReferences(item, replacements, ordered));
    if (!value || typeof value !== 'object') return remapVariableToken(value, replacements, ordered);
    const result = {};
    Object.entries(value).forEach(([key, item]) => {
      result[remapVariableToken(key, replacements, ordered)] = remapVariableReferences(item, replacements, ordered);
    });
    return result;
  }

  function resolvedVariableReplacements(settings, trace) {
    const references = isObject(settings?.variableReferences) ? clone(settings.variableReferences) : {};
    const legacyIds = new Set();
    const visit = value => {
      if (Array.isArray(value)) {
        value.forEach(visit);
        return;
      }
      if (!value || typeof value !== 'object') {
        const match = String(value || '').match(/^(.+:[^:@]+@\d+)(?:#.*|:(?:label|index).*)?$/);
        if (match) legacyIds.add(match[1]);
        return;
      }
      Object.entries(value).forEach(([key, item]) => {
        const match = key.match(/^(.+:[^:@]+@\d+)(?:#.*|:(?:label|index).*)?$/);
        if (match) legacyIds.add(match[1]);
        visit(item);
      });
    };
    visit(settings);
    legacyIds.forEach(variableId => {
      references[variableId] ||= legacyVariableReference(variableId);
    });
    const replacements = new Map();
    Object.entries(references).forEach(([oldId, reference]) => {
      const variable = trace?.variables?.[oldId]
        || resolveVariableReference(reference, trace?.variables, trace?.frames);
      if (variable?.id && variable.id !== oldId) replacements.set(oldId, variable.id);
    });
    return replacements;
  }

  // ---------------------------------------------------------------------------
  // 區段：鏡頭規則壓縮與還原
  // ---------------------------------------------------------------------------
  function resolveVariableReference(reference, variables, frames, frameIds) {
    if (!reference?.name) return null;
    const candidates = Object.values(variables || {}).filter(variable => (
      variable?.name === reference.name
      && (!reference.functionName || variable.functionName === reference.functionName)
    ));
    if (candidates.length <= 1) return candidates[0] || null;
    const scopedFrames = (frames || []).filter(frame => !frameIds?.length || frameIds.includes(frame.id));
    return candidates
      .map((variable, index) => ({
        variable,
        index,
        score: scopedFrames.filter(frame => Object.prototype.hasOwnProperty.call(frame?.state || {}, variable.id)).length
      }))
      .sort((left, right) => right.score - left.score || left.index - right.index)[0]?.variable || null;
  }

  function removeEmptyStudioCollections(studio) {
    ['codeSnippetSourceOverrides'].forEach(key => {
      if (Array.isArray(studio[key]) && !studio[key].length) delete studio[key];
    });
    ['eventInstructionStates', 'frameMaps', 'eventStates', 'codeSnippetOverrides'].forEach(key => {
      if (isObject(studio[key]) && !Object.keys(studio[key]).length) delete studio[key];
    });
    return studio;
  }

  function documentEventSettings(value) {
    if (!isObject(value)) return null;
    const result = {};
    if (typeof value.autoFixedEnabled === 'boolean') {
      result.autoFixedEnabled = value.autoFixedEnabled;
    }
    if (typeof value.autoLoopBoundaryEnabled === 'boolean') {
      result.autoLoopBoundaryEnabled = value.autoLoopBoundaryEnabled;
    }
    if (typeof value.readHighlightEnabled === 'boolean') result.readHighlightEnabled = value.readHighlightEnabled;
    if (typeof value.readHighlightColor === 'string' && value.readHighlightColor.trim()) {
      result.readHighlightColor = value.readHighlightColor;
    }
    return Object.keys(result).length ? result : null;
  }

  // ---------------------------------------------------------------------------
  // 區段：來源管理區塊讀寫
  // ---------------------------------------------------------------------------
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

  function frameFunctionName(frame) {
    const direct = String(frame?.source?.functionName || frame?.source?.function || '').trim();
    if (direct) return direct;
    const manual = /^manual-frame:(.*):\d+:\d+$/.exec(String(frame?.source?.statementId || ''));
    return manual?.[1] || 'global';
  }

  // ---------------------------------------------------------------------------
  // 區段：frame scope 編解碼
  // ---------------------------------------------------------------------------
  function sourceSelector(frame) {
    const directiveKey = String(frame?.source?.directiveKey || '').trim();
    if (directiveKey) {
      const selector = {
        kind: 'manual-frame',
        functionName: frameFunctionName(frame),
        directiveKey
      };
      const logicalDirectiveKey = String(frame?.source?.logicalDirectiveKey || '').trim();
      if (logicalDirectiveKey) selector.logicalDirectiveKey = logicalDirectiveKey;
      return selector;
    }
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
    if (selector.directiveKey) {
      const keys = [frame?.source?.directiveKey, ...(frame?.source?.directiveKeyAliases || [])]
        .map(value => String(value || ''));
      const exact = keys.includes(String(selector.directiveKey));
      const logical = selector.logicalDirectiveKey
        && String(frame?.source?.logicalDirectiveKey || '') === String(selector.logicalDirectiveKey);
      return (exact || logical)
        && (!selector.functionName
          || frameFunctionName(frame) === String(selector.functionName));
    }
    if (selector.kind === 'manual-frame' && Number.isFinite(Number(selector.directiveIndex))) {
      const manual = /^manual-frame:(.*):(\d+):(\d+)$/.exec(String(frame?.source?.statementId || ''));
      return Boolean(manual)
        && (!selector.functionName || manual[1] === String(selector.functionName))
        && Number(manual[3]) === Number(selector.directiveIndex);
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
    const validIds = new Set(list.map(frame => frame.id));
    const selected = new Set((Array.isArray(frameIds) ? frameIds : [])
      .filter(id => id && validIds.has(id)));
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
    return {
      ...(frameSelectors.length ? { frameSelectors } : {}),
      ...(sourceFrameSelectors.length ? { sourceFrameSelectors } : {}),
      ...(fallbackIds.length ? { frameIds: [...new Set(fallbackIds)] } : {})
    };
  }

  // ---------------------------------------------------------------------------
  // 區段：集合與 frame map 序列化
  // ---------------------------------------------------------------------------
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
    const validIds = new Set((Array.isArray(frames) ? frames : []).map(frame => frame.id));
    Object.entries(map || {}).forEach(([frameId, value]) => {
      if (!validIds.has(frameId) || (isObject(value) && !Object.keys(value).length)) return;
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

  // ---------------------------------------------------------------------------
  // 區段：由 trace 產生設定
  // ---------------------------------------------------------------------------
  function fromTrace(trace) {
    const frames = trace?.frames || [];
    const studio = directiveStudio(trace?.studio);
    const savedEventSettings = documentEventSettings(studio.eventSettings);
    ['eventColors', 'eventSignatureColors', 'eventAnimations', 'transitionDefaults', 'eventSettings'].forEach(key => {
      delete studio[key];
    });
    if (savedEventSettings) studio.eventSettings = savedEventSettings;
    studio.eventInstructionStates = compactInstructionStates(studio.eventInstructionStates);
    const frameMaps = {};
    ['eventStates', 'codeSnippetOverrides'].forEach(key => {
      if (studio[key] && Object.keys(studio[key]).length) frameMaps[key] = encodeFrameMap(studio[key], frames);
      delete studio[key];
    });
    if (Object.keys(frameMaps).length) studio.frameMaps = frameMaps;
    removeEmptyStudioCollections(studio);
    const settings = {
      version: 1,
      rules: [],
      skins: compactSkins(trace),
      studio: encodeScopes(studio, frames)
    };
    const variableReferences = variableReferenceTable(trace, settings);
    if (Object.keys(variableReferences).length) settings.variableReferences = variableReferences;
    return settings;
  }

  function compactTraceForSave(trace) {
    if (!trace || typeof trace !== 'object') return trace;
    const next = clone(trace);
    const validFrameIds = new Set((next.frames || []).map(frame => frame.id));
    next.skins = compactSkins(trace);
    next.rules = [];
    next.studio = directiveStudio(next.studio);
    next.studio.eventInstructionStates = compactInstructionStates(next.studio.eventInstructionStates);
    ['eventStates', 'codeSnippetOverrides'].forEach(key => {
      if (!isObject(next.studio[key])) return;
      next.studio[key] = Object.fromEntries(Object.entries(next.studio[key])
        .filter(([frameId, value]) => validFrameIds.has(frameId)
          && (!isObject(value) || Object.keys(value).length)));
    });
    removeEmptyStudioCollections(next.studio);
    delete next.asmView;
    next.viewSettingsApplied = true;
    return next;
  }

  // ---------------------------------------------------------------------------
  // 區段：設定套回 trace
  // ---------------------------------------------------------------------------
  function applyToTrace(trace, settings) {
    if (!trace || !settings || typeof settings !== 'object') return trace;
    const replacements = resolvedVariableReplacements(settings, trace);
    settings = remapVariableReferences(clone(settings), replacements);
    delete settings.variableReferences;
    const frames = trace.frames || [];
    // 跨幀規則只來自 Studio 手動設定，不再套用。
    trace.rules = [];
    if (settings.skins && typeof settings.skins === 'object') {
      trace.skins = { ...(trace.skins || {}), ...clone(settings.skins) };
    }
    if (settings.studio && typeof settings.studio === 'object') {
      const studio = decodeScopes(directiveStudio(settings.studio), frames);
      const savedEventSettings = documentEventSettings(studio.eventSettings);
      ['eventColors', 'eventSignatureColors', 'eventAnimations', 'transitionDefaults', 'eventSettings'].forEach(key => {
        delete studio[key];
      });
      if (savedEventSettings) studio.eventSettings = savedEventSettings;
      const frameMaps = studio.frameMaps || {};
      delete studio.frameMaps;
      ['eventStates', 'codeSnippetOverrides'].forEach(key => {
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
    compactTraceForSave,
    applyToTrace,
    directiveStudio,
    MANUAL_STUDIO_KEYS
  };
});
