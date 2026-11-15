/**
 * 模組：程式碼頁左側「程式碼框」「事件動畫」標籤（原 Trace Studio）
 *
 * 責任：在左側面板提供三個標籤（原始碼／程式碼框／事件動畫）的切換，並在後兩個標籤中提供
 *       程式碼框片段、程式碼框外觀、事件程式碼、自動固定與整份動畫的事件設定。
 * 資料流：所有調整先寫入 trace.studio 的可序列化資料，立即以穩定渲染重畫播放器目前幀；
 *         每次調整都記入復原歷史並經 view-source 寫回程式碼的 @asm-view 區塊。
 * 重要不變條件：沒有獨立的編輯模式，畫布永遠是一般播放器；「這一幀」永遠跟著播放器目前幀。
 * 相容性：載入舊文件時缺少集合視為空集合，明確關閉或自訂值必須在復原與儲存往返後保留。
 *         window.ASMTraceStudio 名稱沿用，open/close 保留為相容 API。
 */
(function () {
  const DEFAULT_EVENT_COLORS = window.ASMTraceEvents?.colors || {};
  const EVENT_LABELS = window.ASMTraceEvents?.labels || {};
  const SIDE_TAB_STORAGE_KEY = 'asm_algorithm_side_tab_v1';
  const SIDE_TABS = ['source', 'code-frame', 'events'];

  let trace = null;
  let currentIndex = 0;
  let sideTab = 'source';
  let settingsDirty = true;
  let availabilityRefreshFrame = 0;
  const pendingAvailabilityFrames = new Set();
  let panelsBuilt = false;
  let codeFramePanel;
  let eventAnimationPanel;
  let frameLabels = [];
  let undoButtons = [];
  let redoButtons = [];
  let frameEventsEditor;
  let frameEventsList;
  let frameFixedEditor;
  let frameFixedList;
  let frameCodeSnippetEditor;
  let frameCodeSnippetList;
  let frameCodeSnippetMeta;
  let resetCodeSnippetButton;
  let activeEventCodeGroupId = '';
  let codePanelSettingsSection;
  let codePanelFontSize;
  let codePanelFontSizeValue;
  const codePanelRanges = new Map();
  let history = [];
  let historyIndex = -1;
  let historyTrace = null;
  let restoringHistory = false;
  let studioRenderDepth = 0;

  // ---------------------------------------------------------------------------
  // 區段：保留的事件與程式碼框邏輯（自 Trace Studio 原樣搬入）
  // ---------------------------------------------------------------------------
  function snippetActionIcon() {
    const icon = traceSvg('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
      'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' });
    icon.append(traceSvg('path', { d: 'M20 7v5h-5 M19.2 12a7.2 7.2 0 1 0-1.7 4.7' }));
    return icon;
  }

  function el(name, className, text) {
    const node = document.createElement(name);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function runStudioRender(callback) {
    studioRenderDepth += 1;
    try {
      return callback();
    } finally {
      studioRenderDepth -= 1;
    }
  }

  function renderPlayerFrame(index, options) {
    return runStudioRender(() => window.ASMTracePlayer.render(index, options));
  }

  function ensureStudioData() {
    trace.studio ||= {};
    // 動畫完全由指令驅動：手動調整欄位與跨幀規則一律移除，事件與程式碼片段設定保留。
    const manual = window.ASMTraceModel?.MANUAL_STUDIO_KEYS;
    if (manual) Object.keys(trace.studio).forEach(key => { if (manual.has(key)) delete trace.studio[key]; });
    trace.rules = [];
    trace.studio.eventStates ||= {};
    trace.studio.eventInstructionStates ||= {};
    if (!trace.studio.codeSnippetOverrides || typeof trace.studio.codeSnippetOverrides !== 'object'
      || Array.isArray(trace.studio.codeSnippetOverrides)) trace.studio.codeSnippetOverrides = {};
    trace.studio.codeSnippetSourceOverrides = Array.isArray(trace.studio.codeSnippetSourceOverrides)
      ? trace.studio.codeSnippetSourceOverrides.filter(record => (
        record?.sourceSelector
        && record.lineStates && typeof record.lineStates === 'object' && !Array.isArray(record.lineStates)
      ))
      : [];
    trace.studio.eventSettings ||= { gapMs: 500, autoFixedEnabled: true, defaultEnabled: {}, timelineTypes: {} };
    trace.studio.eventSettings.defaultEnabled ||= {};
    trace.studio.eventSettings.timelineTypes ||= {};
    if (typeof trace.studio.eventSettings.autoFixedEnabled !== 'boolean') {
      trace.studio.eventSettings.autoFixedEnabled =
        typeof trace.studio.eventSettings.defaultEnabled.fixed === 'boolean'
          ? trace.studio.eventSettings.defaultEnabled.fixed
          : true;
    }
    if (typeof trace.studio.eventSettings.autoLoopBoundaryEnabled !== 'boolean') {
      trace.studio.eventSettings.autoLoopBoundaryEnabled = false;
    }
    delete trace.studio.eventSettings.defaultEnabled.fixed;
    delete trace.studio.eventSettings.timelineTypes.fixed;
    Object.keys(trace.studio.eventInstructionStates).forEach(key => {
      if (/^fixed:/.test(key)) delete trace.studio.eventInstructionStates[key];
    });
    delete trace.studio.eventColors;
    delete trace.studio.eventSignatureColors;
    delete trace.studio.eventAnimations;
    window.ASMTraceEvents?.applyEnabledStates?.(trace);
  }

  function editableSnapshot() {
    return JSON.stringify({ studio: trace?.studio || {} });
  }

  function resetHistory() {
    history = [editableSnapshot()];
    historyIndex = 0;
    historyTrace = trace;
    updateHistoryButtons();
  }

  function eventColorFor(event) {
    if (event?.loopBoundary === true) return '#d0a01a';
    return window.ASMTraceEvents?.color?.(event.type)
      || DEFAULT_EVENT_COLORS[event.type]
      || '#65737a';
  }

  function eventLabel(event) {
    if (event?.type === 'visual-exit' && event?.automaticVisibility === true) return '物件退場';
    return event?.loopBoundary === true
      ? '迴圈邊界'
      : event?.type === 'sequence-operation'
        ? String(event.operation || '陣列操作')
      : (EVENT_LABELS[event?.type] || event?.type || '事件');
  }

  function eventSummary(event) {
    const targets = event?.targets || [];
    const expression = target => target?.expression
      || (target?.variableId && target?.indexExpression
        ? `${variableName(target.variableId)}[${target.indexExpression}]`
        : variableName(target?.variableId));
    if (event?.type === 'compare') {
      if (event.comparisonKind === 'truthy') return expression(targets[0]);
      return `${expression(targets[0])} ${event.operation || '?'} ${expression(targets[1])}`.trim();
    }
    if (event?.type === 'swap') return `${expression(targets[0])} ↔ ${expression(targets[1])}`.trim();
    if (['assign', 'input-assign'].includes(event?.type)) {
      if (event.expression) return String(event.expression).trim();
      return `${expression(targets.find(target => target.role === 'target') || targets[0])} = ${expression(targets.find(target => target.role === 'source') || targets[1])}`.trim();
    }
    if (event?.type === 'write') {
      const target = expression(targets[0]);
      const operation = String(event.operation || '').trim();
      const compactTarget = String(target || '').replace(/\s+/g, '');
      const compactOperation = operation.replace(/\s+/g, '');
      if (operation && compactTarget && compactOperation.includes(compactTarget)) return operation;
      return `${target} ${operation}`.trim();
    }
    if (event?.type === 'sequence-operation') {
      return `${expression(targets[0])}.${event.operation || 'operation'}()`;
    }
    if (event?.type === 'fixed') return targets.map(expression).filter(Boolean).join('、');
    if (event?.type === 'condition') {
      return String(event.source?.text || event.expression || event.conditionKind || '條件判斷').trim();
    }
    if (event?.type === 'scope-exit' || event?.type === 'visual-exit') {
      const name = String(event.name || expression(targets[0]) || event.expression || '').trim();
      if (event?.type === 'visual-exit' && event?.automaticVisibility === true) {
        return name || '物件';
      }
      return name ? `${name} 退場` : '物件退場';
    }
    if (event?.type === 'declare') {
      return String(event.source?.text || expression(targets[0]) || event.expression || '').trim();
    }
    if (event?.type === 'call') return event.expression || event.callee || '';
    if (event?.type === 'function-enter' || event?.type === 'function-exit') return event.function || '';
    return expression(targets[0]) || event?.expression || '';
  }

  function eventDisplayText(event, sourceText = '') {
    if (event?.type === 'visual-enter'
      || event?.type === 'scope-exit'
      || event?.type === 'visual-exit') return eventSummary(event);
    const text = String(sourceText || event?.source?.text || eventSummary(event) || '').trim();
    if (event?.type === 'declare' && event?.parameterDeclaration === true && text) {
      return /;\s*$/.test(text) ? text : `${text};`;
    }
    return text;
  }

  function eventCodeStatusTitle(group) {
    if (typeof group?.event?.directiveAnimationControl === 'boolean') {
      return `本幀由 @events 指令${group.event.directiveAnimationControl ? '開啟' : '關閉'}；請修改來源指令`;
    }
    const state = group?.enabled ? '已開啟' : '已關閉';
    const action = group?.enabled ? '點擊可關閉' : '點擊可開啟';
    if (group.availability === 'missing-target') return `${state}；目標未顯示，${action}`;
    if (group.availability === 'unrenderable') return `${state}；無可呈現動畫，${action}`;
    if (!group?.enabled) return '已關閉；點擊後開啟這個指令的所有事件動畫';
    return '已開啟；點擊後關閉這個指令的所有事件動畫';
  }

  function setEventCodeHover(groupToken, active) {
    if (!frameEventsList || !groupToken) return;
    frameEventsList.querySelectorAll('.trace-studio-event-code-button').forEach(node => {
      const candidates = String(node.dataset.eventCandidates || '').split(' ');
      node.classList.toggle('is-hovered', active && candidates.includes(groupToken));
    });
  }

  function syncActiveEventCode(groupId = activeEventCodeGroupId, reveal = false) {
    if (!frameEventsList) return;
    frameEventsList.querySelectorAll('.trace-studio-event-code-button').forEach(node => {
      node.classList.toggle('is-playing', Boolean(groupId) && node.dataset.eventGroupId === groupId);
    });
    if (!reveal || !groupId) return;
    const active = [...frameEventsList.querySelectorAll('.trace-studio-event-code-button')]
      .find(node => node.dataset.eventGroupId === groupId);
    active?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }

  function configureEventCodeButton(node, primary, candidates, groupTokens) {
    const groupToken = groupTokens.get(primary.id);
    node.classList.add('trace-studio-event-code-button');
    node.classList.toggle('is-enabled', primary.enabled);
    node.classList.toggle('is-current', primary.current);
    node.classList.toggle('is-available', primary.availability === 'available');
    node.classList.toggle('is-missing-target', primary.availability === 'missing-target');
    node.classList.toggle('is-unrenderable', primary.availability === 'unrenderable');
    node.dataset.eventGroupId = primary.id;
    node.dataset.eventGroupToken = groupToken;
    node.dataset.eventCandidates = candidates.map(group => groupTokens.get(group.id)).filter(Boolean).join(' ');
    node.setAttribute('role', 'button');
    node.setAttribute('tabindex', '0');
    node.setAttribute('aria-pressed', String(primary.enabled));
    node.setAttribute('aria-disabled', String(typeof primary.event.directiveAnimationControl === 'boolean'));
    node.setAttribute('aria-label', `${eventLabel(primary.event)}：${eventDisplayText(primary.event)}`);
    node.title = eventCodeStatusTitle(primary);
    const toggle = event => {
      event.preventDefault();
      event.stopPropagation();
      if (typeof primary.event.directiveAnimationControl === 'boolean') return;
      setInstructionEventEnabled(primary.event, !primary.enabled);
    };
    node.addEventListener('click', toggle);
    node.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') toggle(event);
    });
    node.addEventListener('pointerenter', () => setEventCodeHover(groupToken, true));
    node.addEventListener('pointerleave', () => setEventCodeHover(groupToken, false));
  }

  function eventOutlineContextKind(item) {
    if (item.type === 'FunctionDefinition') return '函式';
    if (item.type === 'ForStatement') return 'for';
    if (item.type === 'IfStatement') return 'if';
    if (item.type === 'WhileStatement') return 'while';
    if (item.type === 'DoStatement') return 'do';
    if (item.type === 'SwitchStatement') return 'switch';
    return '區塊';
  }

  function renderEventOutlineButton(group, groupTokens, sourceText = '') {
    const button = el('button', 'trace-studio-event-code-button');
    button.type = 'button';
    const marker = el('span', 'trace-studio-event-code-marker');
    marker.style.background = eventColorFor(group.event);
    const label = el('span', 'trace-studio-event-code-type', eventLabel(group.event));
    const text = eventDisplayText(group.event, sourceText) || group.label;
    button.append(marker, label, el('code', 'trace-studio-event-code-text', text));
    configureEventCodeButton(button, group, [group], groupTokens);
    return button;
  }

  function renderEventOutlineItem(item, groupTokens) {
    if (item.kind === 'context') {
      const context = el('div', 'trace-studio-event-context');
      context.dataset.contextType = item.type || '';
      const header = el('div', 'trace-studio-event-context-header');
      if (item.type === 'FunctionDefinition' && item.headerGroup) {
        header.classList.add('has-event');
        const functionButton = renderEventOutlineButton(
          item.headerGroup, groupTokens, item.label || item.headerGroup.event?.source?.text
        );
        functionButton.classList.add('trace-studio-event-function-button');
        header.append(functionButton);
      } else {
        header.append(
          el('span', 'trace-studio-event-context-kind', eventOutlineContextKind(item)),
          el('code', 'trace-studio-event-context-code', item.label || eventOutlineContextKind(item))
        );
      }
      const children = el('div', 'trace-studio-event-context-children');
      item.children.forEach(child => children.append(renderEventOutlineItem(child, groupTokens)));
      const close = el('div', 'trace-studio-event-context-close', '}');
      context.append(header, children, close);
      return context;
    }

    return renderEventOutlineButton(item.group, groupTokens);
  }

  function renderEventCodeEditor(frame) {
    const previousScrollTop = frameEventsList.scrollTop;
    frameEventsList.replaceChildren();
    const plan = window.ASMTraceEventCodeTree?.buildOutline?.(trace, frame);
    if (!plan?.items?.length) {
      frameEventsList.append(el('div', 'trace-studio-empty', '目前沒有可設定的程式碼事件'));
      return;
    }
    const groupTokens = new Map(plan.groups.map((group, index) => [group.id, `g${index}`]));
    const outline = el('div', 'trace-studio-event-outline');
    plan.items.forEach(item => outline.append(renderEventOutlineItem(item, groupTokens)));
    frameEventsList.append(outline);
    frameEventsList.scrollTop = previousScrollTop;
    syncActiveEventCode(activeEventCodeGroupId, false);
  }

  function setInstructionEventEnabled(event, enabled) {
    if (!trace || !event) return;
    if (event.loopBoundary === true) {
      trace.studio.eventSettings ||= {};
      trace.studio.eventSettings.autoLoopBoundaryEnabled = Boolean(enabled);
      window.ASMTraceEvents?.applyEnabledStates?.(trace);
      recordHistory();
      renderFrameEventsEditor();
      renderCodeSnippetEditor();
      renderPlayerFrame(currentIndex, { animateEvents: false, animatePositions: false });
      window.dispatchEvent(new CustomEvent('asm:trace-event-settings-changed', {
        detail: { document: trace }
      }));
      return;
    }
    const key = window.ASMTraceEvents?.instructionKey?.(event) || event.signature || event.type;
    const canonical = window.ASMTraceEvents?.canonicalInstructionKey;
    if (canonical) {
      Object.keys(trace.studio.eventInstructionStates).forEach(savedKey => {
        if (savedKey !== key && canonical(savedKey) === key) {
          delete trace.studio.eventInstructionStates[savedKey];
        }
      });
    }
    trace.studio.eventInstructionStates[key] = Boolean(enabled);
    window.ASMTraceEvents?.applyEnabledStates?.(trace);
    recordHistory();
    renderFrameEventsEditor();
    renderCodeSnippetEditor();
    renderPlayerFrame(currentIndex, { animateEvents: false, animatePositions: false });
  }

  function setFrameFixedEnabled(frame, event, index, enabled) {
    if (!trace || !frame || !event) return;
    ensureStudioData();
    const key = window.ASMTraceEvents?.eventKey?.(frame.events || [], index)
      || event.signature || event.id;
    trace.studio.eventStates[frame.id] ||= {};
    trace.studio.eventStates[frame.id][key] = Boolean(enabled);
    window.ASMTraceEvents?.applyEnabledStates?.(trace);
    recordHistory();
    renderFrameEventsEditor();
    renderCodeSnippetEditor();
    renderPlayerFrame(currentIndex, { animateEvents: false, animatePositions: false });
  }

  function renderFrameEventsEditor() {
    if (!frameEventsEditor || !frameEventsList || !frameFixedEditor || !frameFixedList) return;
    const frame = trace?.frames?.[currentIndex];
    frameEventsEditor.hidden = false;
    frameFixedList.replaceChildren();
    renderEventCodeEditor(frame);
    const fixedEvents = fixedEventsForFrame(frame);
    if (!fixedEvents.length) {
      frameFixedList.append(el('div', 'trace-studio-empty', '本幀沒有新增固定格子'));
    }
    fixedEvents.forEach(({ event, index }) => {
      const row = el('div', 'trace-studio-fixed-batch');
      row.classList.toggle('is-disabled', event.enabled === false);
      const icon = el('span', 'trace-studio-fixed-batch-icon', '✓');
      const copy = el('span', 'trace-studio-frame-event-copy');
      copy.append(el('strong', '', '完成格子'));
      const summary = eventSummary(event);
      if (summary) copy.append(el('small', '', summary));
      const toggle = el('label', 'trace-studio-event-switch');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = event.enabled !== false;
      input.disabled = typeof event.directiveAnimationControl === 'boolean';
      input.setAttribute('aria-label', '本幀自動固定格子');
      input.title = input.checked ? '隱藏本幀固定標記' : '顯示本幀固定標記';
      if (input.disabled) input.title = '本幀由 @events 指令控制；請修改來源指令';
      input.addEventListener('change', () => setFrameFixedEnabled(frame, event, index, input.checked));
      toggle.append(input, el('span'));
      row.append(icon, copy, toggle);
      frameFixedList.append(row);
    });
  }

  function snippetOverrideForFrame(frameId, create = false) {
    ensureStudioData();
    let saved = trace.studio.codeSnippetOverrides[frameId];
    if (!saved && create) {
      saved = { lineStates: {} };
      trace.studio.codeSnippetOverrides[frameId] = saved;
    }
    if (saved && (!saved.lineStates || typeof saved.lineStates !== 'object')) saved.lineStates = {};
    return saved || null;
  }

  function snippetSourceOverrideForFrame(frame, create = false) {
    ensureStudioData();
    const sourceSelector = window.ASMTraceViewSource?.sourceSelector?.(frame);
    const sourceMatches = window.ASMTraceViewSource?.sourceMatches;
    if (!sourceSelector || typeof sourceMatches !== 'function') return null;
    let saved = trace.studio.codeSnippetSourceOverrides.find(record => (
      record?.sourceSelector && sourceMatches(frame, record.sourceSelector)
    ));
    if (!saved && create) {
      saved = { sourceSelector, lineStates: {} };
      trace.studio.codeSnippetSourceOverrides.push(saved);
    }
    if (saved && (!saved.lineStates || typeof saved.lineStates !== 'object')) saved.lineStates = {};
    return saved || null;
  }

  function snippetFramesForSource(frame) {
    const selector = window.ASMTraceViewSource?.sourceSelector?.(frame);
    const sourceMatches = window.ASMTraceViewSource?.sourceMatches;
    if (!selector || typeof sourceMatches !== 'function') return frame ? [frame] : [];
    const matches = trace.frames.filter(candidate => sourceMatches(candidate, selector));
    return matches.length ? matches : [frame];
  }

  function clearLegacySnippetLineStates(frames, sourceAnchor) {
    frames.forEach(frame => {
      const saved = trace.studio.codeSnippetOverrides?.[frame.id];
      if (!saved?.lineStates) return;
      const row = window.ASMTraceCodeModel?.snippetEditorPlan?.(trace, frame)
        ?.fragments?.flatMap(fragment => fragment.rows || [])
        .find(candidate => candidate.sourceAnchor === sourceAnchor);
      if (row?.anchor) delete saved.lineStates[row.anchor];
      if (!Object.keys(saved.lineStates).length) delete trace.studio.codeSnippetOverrides[frame.id];
    });
  }

  function saveSnippetLineState(row, included) {
    const frame = trace?.frames?.[currentIndex];
    if (!frame || !row?.anchor || !row?.sourceAnchor) return;
    const sourceSaved = snippetSourceOverrideForFrame(frame, true);
    if (sourceSaved) {
      const frames = snippetFramesForSource(frame);
      clearLegacySnippetLineStates(frames, row.sourceAnchor);
      sourceSaved.lineStates[row.sourceAnchor] = Boolean(included);
    } else {
      const saved = snippetOverrideForFrame(frame.id, true);
      saved.lineStates[row.anchor] = Boolean(included);
    }
    recordHistory();
    renderCodeSnippetEditor();
    renderPlayerFrame(currentIndex, { animateEvents: false, animatePositions: false });
  }

  function resetCurrentCodeSnippet() {
    const frame = trace?.frames?.[currentIndex];
    if (!frame) return;
    const frames = snippetFramesForSource(frame);
    const sourceMatches = window.ASMTraceViewSource?.sourceMatches;
    trace.studio.codeSnippetSourceOverrides = trace.studio.codeSnippetSourceOverrides.filter(record => (
      !record?.sourceSelector || typeof sourceMatches !== 'function' || !sourceMatches(frame, record.sourceSelector)
    ));
    frames.forEach(candidate => delete trace.studio.codeSnippetOverrides[candidate.id]);
    recordHistory();
    renderCodeSnippetEditor();
    renderPlayerFrame(currentIndex, { animateEvents: false, animatePositions: false });
  }

  function appendSnippetCode(row, code) {
    const segments = row.segments?.length
      ? row.segments
      : [{ text: row.text, eventIds: [] }];
    const animatedIds = new Set(row.eventIds || []);
    const runs = [];
    segments.forEach(segment => {
      const eventIds = (segment.eventIds || []).map(String).filter(id => animatedIds.has(id));
      const highlighted = eventIds.length > 0;
      const previous = runs.at(-1);
      if (previous && previous.highlighted === highlighted) {
        previous.text += segment.text;
        eventIds.forEach(id => previous.eventIds.add(id));
      } else {
        runs.push({ text: segment.text, highlighted, eventIds: new Set(eventIds) });
      }
    });
    runs.forEach(run => {
      if (!run.highlighted) {
        code.append(document.createTextNode(run.text));
        return;
      }
      const highlight = el('mark', 'trace-studio-snippet-event-source', run.text);
      highlight.dataset.traceEventIds = [...run.eventIds].join(' ');
      code.append(highlight);
    });
  }

  function syncActiveSnippetEvent(eventId = '', reveal = false) {
    if (!frameCodeSnippetList) return;
    frameCodeSnippetList.querySelectorAll('.trace-studio-snippet-line-button').forEach(button => {
      const ids = String(button.dataset.eventIds || '').split(' ').filter(Boolean);
      const active = Boolean(eventId) && ids.includes(String(eventId));
      button.classList.toggle('is-playing', active);
      if (active && reveal) button.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    });
  }

  function renderSnippetLine(row, fragment) {
    const wrapper = el('div', 'trace-studio-snippet-line');
    const button = el('button', 'trace-studio-event-code-button trace-studio-snippet-line-button');
    button.type = 'button';
    button.classList.toggle('is-enabled', row.included);
    button.classList.add('is-available');
    button.dataset.snippetAnchor = row.anchor;
    button.dataset.snippetSourceAnchor = row.sourceAnchor;
    button.dataset.sourceLine = String(row.number);
    button.dataset.eventIds = row.eventIds.join(' ');
    button.setAttribute('aria-pressed', String(row.included));
    button.setAttribute('aria-label', `第 ${row.number} 行：${row.included ? '已收錄' : '未收錄'}`);
    button.title = row.included ? '點擊後不收錄此行' : '點擊後收錄此行';
    const marker = el('span', 'trace-studio-event-code-marker');
    marker.style.background = row.included ? '#42c77a' : 'transparent';
    const lineNumber = el('span', 'trace-studio-snippet-line-number', String(row.number));
    const code = el('code', 'trace-studio-event-code-text trace-studio-snippet-code');
    appendSnippetCode(row, code);
    const gutter = el('span', 'trace-studio-snippet-gutter');
    gutter.append(marker, lineNumber);
    button.append(gutter, code);
    button.addEventListener('click', () => saveSnippetLineState(row, !row.included));
    wrapper.append(button);
    return wrapper;
  }

  function renderCodeSnippetEditor() {
    if (!frameCodeSnippetList || !trace) return;
    const frame = trace.frames[currentIndex];
    const plan = window.ASMTraceCodeModel?.snippetEditorPlan?.(trace, frame);
    frameCodeSnippetList.replaceChildren();
    const fragments = plan?.fragments || [];
    const rows = fragments.flatMap(fragment => fragment.rows || []);
    const eventRows = rows.filter(row => row.eventIds.length);
    const hiddenEventRows = eventRows.filter(row => !row.included);
    const sourceFrameCount = snippetFramesForSource(frame).length;
    const functionNames = [...new Set(fragments.map(fragment => fragment.functionName).filter(Boolean))];
    if (frameCodeSnippetMeta) {
      const location = `${frame?.source?.function || frame?.source?.functionName || functionNames[0] || 'global'}:${frame?.source?.line || '-'}`;
      frameCodeSnippetMeta.textContent = hiddenEventRows.length
        ? `${location} · ${hiddenEventRows.length} 個事件行未收錄 · 同指令 ${sourceFrameCount} 幀`
        : `${location} · 自動片段 ${rows.filter(row => row.autoIncluded).length} 行 · 同指令 ${sourceFrameCount} 幀`;
      frameCodeSnippetMeta.classList.toggle('has-warning', hiddenEventRows.length > 0);
    }
    if (resetCodeSnippetButton) {
      resetCodeSnippetButton.disabled = !snippetSourceOverrideForFrame(frame)
        && !snippetFramesForSource(frame).some(candidate => trace.studio?.codeSnippetOverrides?.[candidate.id]);
    }
    if (!rows.length) {
      frameCodeSnippetList.append(el('div', 'trace-studio-empty', '目前行為沒有可編輯的程式碼片段'));
      return;
    }
    fragments.forEach(fragment => {
      const outline = el('div', 'trace-studio-event-outline trace-studio-snippet-outline');
      if (fragment.functionName) {
        const heading = el('div', 'trace-studio-snippet-function');
        heading.append(el('span', 'trace-studio-event-context-kind', '函式'),
          el('code', 'trace-studio-event-context-code', `${fragment.functionName}()`));
        outline.append(heading);
      }
      const body = el('div', 'trace-studio-event-context-children trace-studio-snippet-lines');
      fragment.rows.forEach(row => body.append(renderSnippetLine(row, fragment)));
      outline.append(body);
      frameCodeSnippetList.append(outline);
    });
  }

  function inspectorEventsForFrame(frame = trace?.frames?.[currentIndex]) {
    const events = frame?.events || [];
    const ordered = window.ASMTraceEvents?.orderedEntries?.(events)
      || events.map((event, index) => ({ event, index }));
    return ordered
      .filter(({ event }) => window.ASMTraceEvents?.showInspector?.(event, trace) !== false);
  }

  function fixedEventsForFrame(frame = trace?.frames?.[currentIndex]) {
    const events = frame?.events || [];
    const ordered = window.ASMTraceEvents?.orderedEntries?.(events)
      || events.map((event, index) => ({ event, index }));
    return ordered.filter(({ event }) => event.type === 'fixed');
  }

  function hasEventInspectorContent(frame = trace?.frames?.[currentIndex]) {
    return inspectorEventsForFrame(frame).length > 0 || fixedEventsForFrame(frame).length > 0;
  }

  function cancelEventAvailabilityRefresh() {
    if (availabilityRefreshFrame) cancelAnimationFrame(availabilityRefreshFrame);
    availabilityRefreshFrame = 0;
    pendingAvailabilityFrames.clear();
  }

  function writeSourceSettings() {
    if (!trace || restoringHistory || !window.asmWriteViewSettings || !window.ASMTraceViewSource?.fromTrace) return;
    // A manual edit (including deletion) of @asm-view is newer than Studio's
    // last write. Saving must not silently recreate the removed settings.
    if (window.ASMTraceEditor?.sourceViewWasEdited?.()) return false;
    const settings = window.ASMTraceViewSource.fromTrace(trace);
    const source = window.asmGetSourceCode?.() || '';
    if (!window.ASMTraceViewSource.findBlock(source)
      && !settings.rules?.length && !Object.keys(settings.skins || {}).length
      && !Object.keys(settings.studio || {}).length) return false;
    return window.asmWriteViewSettings(settings);
  }

  function variableName(variableId) {
    return trace?.variables?.[variableId]?.name || variableId || '';
  }

  function traceSvg(name, attributes = {}) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', name);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
    return node;
  }

  function field(label, control) {
    const wrapper = el('label', 'trace-studio-field');
    wrapper.append(el('span', '', label), control);
    return wrapper;
  }

  function section(title) {
    const wrapper = el('section', 'trace-studio-section');
    wrapper.append(el('h3', '', title));
    return wrapper;
  }

  // ---------------------------------------------------------------------------
  // 區段：復原／重做歷史
  // 程式碼框與事件動畫的每次調整都會改動 @asm-view，因此都記入歷史並寫回程式碼。
  // ---------------------------------------------------------------------------
  function recordHistory(options = {}) {
    if (restoringHistory || !trace) return;
    const snapshot = editableSnapshot();
    if (history[historyIndex] !== snapshot) {
      history.splice(historyIndex + 1);
      history.push(snapshot);
      if (history.length > 100) history.shift();
      historyIndex = history.length - 1;
      updateHistoryButtons();
    }
    if (options.write !== false) writeSourceSettings();
  }

  function restoreHistory(nextIndex) {
    if (!trace || nextIndex < 0 || nextIndex >= history.length || nextIndex === historyIndex) return;
    restoringHistory = true;
    historyIndex = nextIndex;
    const snapshot = JSON.parse(history[historyIndex]);
    trace.studio = snapshot.studio || {};
    ensureStudioData();
    window.ASMTraceCodePresenter?.applyPresentationSettings?.(trace);
    renderPlayerFrame(currentIndex, { animateEvents: false, animatePositions: false });
    // 整份動畫的事件設定（左側「事件動畫」下方）也要同步顯示還原後的值。
    window.dispatchEvent(new CustomEvent('asm:trace-event-settings-changed', {
      detail: { document: trace, fromHistory: true }
    }));
    renderSettings();
    restoringHistory = false;
    updateHistoryButtons();
    writeSourceSettings();
  }

  function undo() { restoreHistory(historyIndex - 1); }
  function redo() { restoreHistory(historyIndex + 1); }

  // ---------------------------------------------------------------------------
  // 區段：左側標籤
  // ---------------------------------------------------------------------------
  function tabButtons() {
    return [...document.querySelectorAll('#codePanel .side-tab[data-side-tab]')];
  }

  function settingsTabVisible() {
    return sideTab !== 'source' && !document.getElementById('codePanel')?.classList.contains('collapsed');
  }

  function setSideTab(name, options = {}) {
    const next = SIDE_TABS.includes(name) ? name : 'source';
    sideTab = next;
    tabButtons().forEach(button => {
      const active = button.dataset.sideTab === next;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
      if (active && options.focus) button.focus();
    });
    document.querySelectorAll('#codePanel [data-side-panel]').forEach(panel => {
      panel.hidden = panel.dataset.sidePanel !== next;
    });
    document.getElementById('codePanel')?.setAttribute('data-side-tab', next);
    if (options.persist !== false) {
      try { localStorage.setItem(SIDE_TAB_STORAGE_KEY, next); } catch {}
    }
    if (next === 'source') {
      if (typeof aceEditor !== 'undefined') aceEditor.resize?.();
      return;
    }
    if (trace && settingsDirty) {
      window.ASMTraceRenderers?.preflightEventAvailability?.(trace, { frameIndex: currentIndex });
      renderSettings();
    }
  }

  function bindTabs() {
    const buttons = tabButtons();
    if (!buttons.length || buttons[0].dataset.sideTabBound) return;
    buttons.forEach((button, index) => {
      button.dataset.sideTabBound = '1';
      button.addEventListener('click', () => setSideTab(button.dataset.sideTab));
      button.addEventListener('keydown', event => {
        const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
        if (event.key === 'Home' || event.key === 'End') {
          event.preventDefault();
          setSideTab(buttons[event.key === 'Home' ? 0 : buttons.length - 1].dataset.sideTab, { focus: true });
          return;
        }
        if (!step) return;
        event.preventDefault();
        const target = buttons[(index + step + buttons.length) % buttons.length];
        setSideTab(target.dataset.sideTab, { focus: true });
      });
    });
    let saved = 'source';
    try { saved = localStorage.getItem(SIDE_TAB_STORAGE_KEY) || 'source'; } catch {}
    setSideTab(saved, { persist: false });
  }

  // ---------------------------------------------------------------------------
  // 區段：標籤內容
  // ---------------------------------------------------------------------------
  function frameToolbar() {
    const toolbar = el('div', 'side-panel-toolbar');
    const label = el('strong', 'side-panel-frame', '');
    frameLabels.push(label);
    const historyControls = el('div', 'trace-studio-history');
    const undoButton = el('button', '', '↶');
    undoButton.type = 'button';
    undoButton.title = '復原 (Ctrl+Z)';
    undoButton.setAttribute('aria-label', '復原');
    undoButton.addEventListener('click', undo);
    const redoButton = el('button', '', '↷');
    redoButton.type = 'button';
    redoButton.title = '重做 (Ctrl+Y)';
    redoButton.setAttribute('aria-label', '重做');
    redoButton.addEventListener('click', redo);
    undoButtons.push(undoButton);
    redoButtons.push(redoButton);
    historyControls.append(undoButton, redoButton);
    toolbar.append(label, historyControls);
    return toolbar;
  }

  function groupHeading(text) {
    return el('h2', 'side-panel-group', text);
  }

  function buildCodeFramePanel() {
    const content = el('div', 'side-panel-content trace-studio-code-panel');
    frameCodeSnippetEditor = section('程式碼片段');
    frameCodeSnippetEditor.classList.add('trace-studio-code-snippet-section');
    const snippetHeader = el('div', 'trace-studio-snippet-head');
    frameCodeSnippetMeta = el('span', 'trace-studio-snippet-meta', '');
    resetCodeSnippetButton = el('button', 'trace-studio-snippet-reset');
    resetCodeSnippetButton.type = 'button';
    resetCodeSnippetButton.title = '恢復自動篩選';
    resetCodeSnippetButton.setAttribute('aria-label', '恢復自動篩選');
    resetCodeSnippetButton.append(snippetActionIcon());
    resetCodeSnippetButton.addEventListener('click', resetCurrentCodeSnippet);
    const snippetActions = el('div', 'trace-studio-snippet-actions');
    snippetActions.append(resetCodeSnippetButton);
    snippetHeader.append(frameCodeSnippetMeta, snippetActions);
    frameCodeSnippetList = el('div', 'trace-studio-frame-events trace-studio-code-snippet-list');
    frameCodeSnippetList.addEventListener('wheel', event => {
      if (!event.shiftKey || Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
      event.preventDefault();
      frameCodeSnippetList.scrollLeft += event.deltaY;
    }, { passive: false });
    frameCodeSnippetEditor.append(snippetHeader, frameCodeSnippetList);

    const codePanel = section('程式碼框外觀');
    codePanel.dataset.traceCodeControls = '1';
    codePanelSettingsSection = codePanel;
    codePanelFontSize = document.createElement('input');
    codePanelFontSize.type = 'range';
    codePanelFontSize.min = '8';
    codePanelFontSize.max = '64';
    codePanelFontSize.step = '1';
    codePanelFontSizeValue = el('output', 'trace-studio-range-value', '20px');
    const codeFontSizeRow = el('div', 'trace-studio-range-row');
    codeFontSizeRow.append(codePanelFontSize, codePanelFontSizeValue);
    codePanelFontSize.addEventListener('input', () => {
      const size = window.ASMTraceCodePresenter?.normalizeFontSize?.(codePanelFontSize.value)
        || Number(codePanelFontSize.value) || 20;
      trace.studio ||= {};
      trace.studio.codePanelFontSize = size;
      codePanelFontSizeValue.textContent = `${size}px`;
      window.ASMTraceCodePresenter?.applyPresentationSettings?.(trace);
    });
    codePanelFontSize.addEventListener('change', () => recordHistory());
    codePanel.append(field('字體大小', codeFontSizeRow));
    codePanelRanges.clear();
    [
      {key:'codePanelScrollMs',label:'片段滾動時間',min:0,max:2000,step:20,suffix:' ms',
        normalize:value => window.ASMTraceCodePresenter.normalizeScrollMs(value)},
      {key:'codePanelWidthPercent',label:'最大寬度',min:20,max:95,step:1,suffix:'%',
        normalize:value => window.ASMTraceCodePresenter.normalizePanelPercent(value,48)},
      {key:'codePanelHeightPercent',label:'最大高度',min:20,max:95,step:1,suffix:'%',
        normalize:value => window.ASMTraceCodePresenter.normalizePanelPercent(value,78)}
    ].forEach(setting => {
      const input = document.createElement('input');
      input.type = 'range';
      input.min = String(setting.min); input.max = String(setting.max); input.step = String(setting.step);
      input.dataset.codePanelSetting = setting.key;
      const output = el('output','trace-studio-range-value','');
      const row = el('div','trace-studio-range-row'); row.append(input,output);
      codePanelRanges.set(setting.key,{...setting,input,output});
      input.addEventListener('input', () => {
        trace.studio ||= {};
        const value = setting.normalize(input.value);
        trace.studio[setting.key] = value;
        output.textContent = `${value}${setting.suffix}`;
        window.ASMTraceCodePresenter.applyPresentationSettings(trace);
      });
      input.addEventListener('change', () => recordHistory());
      codePanel.append(field(setting.label,row));
    });
    content.append(groupHeading('這一幀'), frameCodeSnippetEditor, groupHeading('整份動畫'), codePanel);
    return content;
  }

  function buildEventAnimationPanel() {
    const content = el('div', 'side-panel-content trace-studio-events-panel');
    frameEventsEditor = section('事件程式碼');
    frameEventsEditor.classList.add('trace-studio-frame-events-section');
    frameEventsList = el('div', 'trace-studio-frame-events');
    frameEventsEditor.append(frameEventsList);
    frameFixedEditor = section('自動固定');
    frameFixedEditor.classList.add('trace-studio-fixed-section');
    frameFixedList = el('div', 'trace-studio-fixed-batches');
    frameFixedEditor.append(frameFixedList);
    content.append(groupHeading('這一幀'), frameEventsEditor, frameFixedEditor, groupHeading('整份動畫'));
    return content;
  }

  function buildPanels() {
    if (panelsBuilt) return true;
    codeFramePanel = document.getElementById('codeFramePanel');
    eventAnimationPanel = document.getElementById('eventAnimationPanel');
    if (!codeFramePanel || !eventAnimationPanel) return false;
    panelsBuilt = true;
    frameLabels = [];
    undoButtons = [];
    redoButtons = [];
    codeFramePanel.append(frameToolbar(), buildCodeFramePanel());
    const eventsContent = buildEventAnimationPanel();
    // 整份動畫的事件設定由 trace-editor.js 建立，放在「整份動畫」標題之後。
    const globalSettings = eventAnimationPanel.querySelector('.trace-event-settings-panel');
    eventAnimationPanel.append(frameToolbar(), eventsContent);
    if (globalSettings) eventsContent.append(globalSettings);
    updateHistoryButtons();
    return true;
  }

  function adoptGlobalEventSettings(panel) {
    if (!panel) return;
    const host = eventAnimationPanel?.querySelector('.trace-studio-events-panel');
    if (host) host.append(panel);
    else document.getElementById('eventAnimationPanel')?.append(panel);
  }

  function updateHistoryButtons() {
    undoButtons.forEach(button => { button.disabled = historyIndex <= 0; });
    redoButtons.forEach(button => { button.disabled = historyIndex < 0 || historyIndex >= history.length - 1; });
  }

  function setAttachedState(attached) {
    document.getElementById('codePanel')?.classList.toggle('has-trace-settings', attached);
  }

  function renderSettings() {
    if (!trace || !panelsBuilt) return;
    settingsDirty = false;
    const total = trace.frames.length;
    frameLabels.forEach(label => { label.textContent = `第 ${currentIndex + 1} 幀／共 ${total} 幀`; });
    if (codePanelFontSize && codePanelFontSizeValue) {
      const size = window.ASMTraceCodePresenter?.normalizeFontSize?.(trace?.studio?.codePanelFontSize) || 20;
      codePanelFontSize.value = String(size);
      codePanelFontSizeValue.textContent = `${size}px`;
    }
    codePanelRanges.forEach(({input,output,normalize,suffix}, key) => {
      const value = normalize(trace?.studio?.[key]);
      input.value = String(value);
      output.textContent = `${value}${suffix}`;
    });
    renderFrameEventsEditor();
    renderCodeSnippetEditor();
  }

  function refreshEventAvailability() {
    availabilityRefreshFrame = 0;
    const frameIds = new Set(pendingAvailabilityFrames);
    pendingAvailabilityFrames.clear();
    if (!trace || !settingsTabVisible()) return;
    if (frameIds.has(trace.frames[currentIndex]?.id)) renderFrameEventsEditor();
  }

  // ---------------------------------------------------------------------------
  // 區段：與播放器同步
  // ---------------------------------------------------------------------------
  function attach(source) {
    cancelEventAvailabilityRefresh();
    trace = source || window.ASMTracePlayer?.getDocument?.() || null;
    if (!trace?.frames?.length || document.body.classList.contains('asm-embed-runtime')) {
      if (!trace?.frames?.length) detach();
      return;
    }
    currentIndex = Math.max(0, Math.min(trace.frames.length - 1,
      window.ASMTracePlayer?.getCurrentFrame?.() || 0));
    ensureStudioData();
    if (!buildPanels()) return;
    setAttachedState(true);
    if (historyTrace !== trace) resetHistory();
    updateHistoryButtons();
    settingsDirty = true;
    if (settingsTabVisible()) {
      window.ASMTraceRenderers?.preflightEventAvailability?.(trace, { frameIndex: currentIndex });
      renderSettings();
    }
  }

  function detach() {
    cancelEventAvailabilityRefresh();
    trace = null;
    historyTrace = null;
    history = [];
    historyIndex = -1;
    setAttachedState(false);
    updateHistoryButtons();
  }

  window.addEventListener('asm:trace-frame', event => {
    if (!trace || event.detail?.document !== trace) return;
    currentIndex = Math.max(0, Math.min(trace.frames.length - 1, Number(event.detail.index) || 0));
    settingsDirty = true;
    if (!settingsTabVisible()) return;
    window.ASMTraceRenderers?.preflightEventAvailability?.(trace, { frameIndex: currentIndex });
    renderSettings();
  });

  window.addEventListener('asm:trace-menu-colors', event => {
    if (!trace || event.detail?.document !== trace) return;
    settingsDirty = true;
    if (settingsTabVisible()) renderSettings();
  });

  window.addEventListener('asm:trace-event-settings-changed', event => {
    if (!trace || event.detail?.document !== trace) return;
    // 「整份動畫」的事件設定由使用者調整時也記入歷史；是否寫回程式碼維持原本的規則。
    if (event.detail?.userEdit && !event.detail?.fromHistory) recordHistory({ write: false });
    settingsDirty = true;
    if (settingsTabVisible()) {
      renderFrameEventsEditor();
      renderCodeSnippetEditor();
    }
  });

  window.addEventListener('asm:trace-active-event', event => {
    if (!trace || event.detail?.document !== trace || !settingsTabVisible()) return;
    const eventId = String(event.detail?.event?.id || '');
    syncActiveSnippetEvent(event.detail?.phase === 'start' ? eventId : '', event.detail?.phase === 'start');
    const groupId = window.ASMTraceEventCodeTree?.eventGroupId?.(event.detail?.event);
    if (!groupId) return;
    if (event.detail?.phase === 'start') {
      activeEventCodeGroupId = groupId;
      syncActiveEventCode(groupId, true);
      return;
    }
    if (activeEventCodeGroupId === groupId) {
      activeEventCodeGroupId = '';
      syncActiveEventCode('', false);
    }
  });

  window.addEventListener('asm:trace-code-panel-selected', event => {
    if (!trace || event.detail?.document !== trace) return;
    const codePanel = document.getElementById('codePanel');
    if (!codePanel || codePanel.classList.contains('collapsed')
      || document.body.classList.contains('asm-embed-runtime')) return;
    // 點畫布上的程式碼框：切到「程式碼框」標籤並捲到程式碼框外觀設定。
    setSideTab('code-frame');
    codePanelSettingsSection?.scrollIntoView?.({ block: 'nearest' });
  });

  window.addEventListener('asm:trace-event-availability-changed', event => {
    if (!trace || event.detail?.document !== trace || !settingsTabVisible()) return;
    pendingAvailabilityFrames.add(event.detail.frameId);
    if (!availabilityRefreshFrame) {
      availabilityRefreshFrame = requestAnimationFrame(refreshEventAvailability);
    }
  });

  window.addEventListener('keydown', event => {
    if (!trace || !settingsTabVisible() || !(event.ctrlKey || event.metaKey) || window.isDrawingMode) return;
    const target = event.target;
    const tag = target?.tagName?.toLowerCase();
    const textInput = tag === 'textarea' || tag === 'select' || target?.isContentEditable
      || (tag === 'input' && !['range', 'checkbox', 'button'].includes(String(target.type || '').toLowerCase()));
    if (textInput) return;
    const key = event.key.toLowerCase();
    if (key !== 'z' && key !== 'y') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (key === 'y' || event.shiftKey) redo();
    else undo();
  }, true);

  function initialize() {
    bindTabs();
    document.getElementById('panelToggleBtn')?.addEventListener('click', () => {
      // 摺疊時不更新內容；展開後若停在設定標籤就補一次重畫。
      setTimeout(() => {
        if (trace && settingsDirty && settingsTabVisible()) renderSettings();
      }, 320);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize);
  else initialize();

  window.ASMTraceStudio = {
    attach,
    detach,
    showTab: name => setSideTab(name),
    currentTab: () => sideTab,
    adoptGlobalEventSettings,
    // 相容 API：舊呼叫端的 open 改為切到設定標籤；close 只把設定寫回程式碼。
    open(source) {
      attach(source);
      if (!trace) return;
      setSideTab(hasEventInspectorContent(trace.frames[currentIndex]) ? 'events' : 'code-frame');
    },
    close() {
      return writeSourceSettings();
    },
    refresh() {
      if (!trace) return;
      settingsDirty = true;
      if (settingsTabVisible()) renderSettings();
    },
    flushSourceSettings() {
      return writeSourceSettings();
    },
    undo,
    redo
  };
})();
