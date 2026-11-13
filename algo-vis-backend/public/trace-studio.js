/**
 * 模組：Trace Studio 編輯器
 *
 * 責任：提供 frame 時間線、事件開關、物件樣式與位置、綁定、轉場、鏡頭及復原歷史的整合介面。
 * 資料流：所有編輯先寫入 trace.studio 的可序列化資料，經共用 renderer 即時預覽；history 保存設定快照，儲存時由 view-source 編碼回來源區塊。
 * 重要不變條件：選取 key、frame scope 與 runtime identity 必須可跨重繪解析；預覽操作不可直接永久改寫 DOM 幾何而略過設定模型。
 * 相容性：載入舊文件時缺少集合視為空集合，明確隱藏、關閉或自訂值必須在復原與儲存往返後保留。
 */
(function () {
  const DEFAULT_EVENT_COLORS = window.ASMTraceEvents?.colors || {};
  const EVENT_LABELS = window.ASMTraceEvents?.labels || {};
  const INSPECTOR_WIDTH_STORAGE_KEY = 'asm_trace_studio_inspector_width_v1';
  const DEFAULT_INSPECTOR_WIDTH = 420;

  let trace = null;
  let selectedFrames = new Set();
  let selectionAnchor = 0;
  let currentIndex = 0;
  let availabilityRefreshFrame = 0;
  const pendingAvailabilityFrames = new Set();
  let thumbnailRenderFrame = 0;
  let thumbnailRenderMode = '';
  let thumbnailCullFrame = 0;
  let pendingThumbnails = [];
  const THUMBNAIL_CACHE_LIMIT = 24;
  const thumbnailCache = new Map();
  const RAIL_ROW_HEIGHT = 174;
  const RAIL_ROW_PITCH = RAIL_ROW_HEIGHT + 5;
  let rail;
  let timeline;
  let inspector;
  let inspectorResizer;
  let eventGapRange;
  let eventGapValue;
  let inspectorMode = 'events';
  let inspectorToolbar;
  let inspectorEventButton;
  let inspectorEventCount;
  let inspectorCodeButton;
  let inspectorEventsPanel;
  let inspectorCodePanel;
  let codePanelSelectionActive = false;
  let codePanelSettingsSection;
  let frameEventsEditor;
  let frameEventsList;
  let frameFixedEditor;
  let frameFixedList;
  let frameCodeSnippetEditor;
  let frameCodeSnippetList;
  let frameCodeSnippetMeta;
  let resetCodeSnippetButton;
  let snippetFocusButton;
  let activeEventCodeGroupId = '';
  let codePanelFontSize;
  let codePanelFontSizeValue;
  const codePanelRanges = new Map();
  let cameraTimer = null;
  let undoButton;
  let redoButton;
  let history = [];
  let historyIndex = -1;
  let historyTrace = null;
  let restoringHistory = false;
  let studioRenderDepth = 0;

  // ---------------------------------------------------------------------------
  // 區段：DOM 建立與 render 邊界
  // ---------------------------------------------------------------------------
  function el(name, className, text) {
    const node = document.createElement(name);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function option(value, label) {
    const node = document.createElement('option');
    node.value = value;
    node.textContent = label;
    return node;
  }

  function inspectorWidthBounds() {
    return {
      min: 300,
      max: Math.max(300, Math.min(760, window.innerWidth - 250 - 420 - 12))
    };
  }

  function setInspectorWidth(value, persist = false) {
    const bounds = inspectorWidthBounds();
    const width = Math.round(Math.min(
      bounds.max,
      Math.max(bounds.min, Number(value) || DEFAULT_INSPECTOR_WIDTH)
    ));
    document.getElementById('main')?.style.setProperty('--trace-studio-inspector-width', `${width}px`);
    inspectorResizer?.setAttribute('aria-valuenow', String(width));
    if (persist) {
      try { localStorage.setItem(INSPECTOR_WIDTH_STORAGE_KEY, String(width)); } catch {}
    }
    scheduleThumbnailCulling();
    return width;
  }

  function restoreInspectorWidth() {
    let saved = DEFAULT_INSPECTOR_WIDTH;
    try { saved = Number(localStorage.getItem(INSPECTOR_WIDTH_STORAGE_KEY)) || saved; } catch {}
    setInspectorWidth(saved);
  }

  function beginInspectorResize(event) {
    if (event.button !== 0) return;
    event.preventDefault();
    const move = pointerEvent => setInspectorWidth(window.innerWidth - pointerEvent.clientX);
    const finish = pointerEvent => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      setInspectorWidth(window.innerWidth - pointerEvent.clientX, true);
      document.body.classList.remove('asm-trace-inspector-resizing');
    };
    document.body.classList.add('asm-trace-inspector-resizing');
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
  }

  function snippetActionIcon(kind) {
    const icon = traceSvg('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
      'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' });
    if (kind === 'reset') {
      icon.append(traceSvg('path', { d: 'M20 7v5h-5 M19.2 12a7.2 7.2 0 1 0-1.7 4.7' }));
    } else {
      icon.append(traceSvg('circle', { cx: 10, cy: 10, r: 6.5 }),
        traceSvg('path', { d: 'm15 15 5 5 M7 10h6' }));
      if (kind === 'zoom-in') icon.append(traceSvg('path', { d: 'M10 7v6' }));
    }
    return icon;
  }

  function setSnippetFocus(active) {
    document.body.classList.toggle('asm-trace-snippet-focus', Boolean(active));
    if (!snippetFocusButton) return;
    snippetFocusButton.setAttribute('aria-pressed', String(Boolean(active)));
    const label = active ? '縮小' : '放大';
    snippetFocusButton.replaceChildren(snippetActionIcon(active ? 'zoom-out' : 'zoom-in'));
    snippetFocusButton.setAttribute('aria-label', label);
    snippetFocusButton.title = label;
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

  // ---------------------------------------------------------------------------
  // 區段：Studio 模型正規化
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // 區段：復原／重做歷史
  // ---------------------------------------------------------------------------
  function editableSnapshot() {
    return JSON.stringify({ studio: trace?.studio || {} });
  }

  function updateHistoryButtons() {
    if (undoButton) undoButton.disabled = historyIndex <= 0;
    if (redoButton) redoButton.disabled = historyIndex < 0 || historyIndex >= history.length - 1;
  }

  function resetHistory() {
    history = [editableSnapshot()];
    historyIndex = 0;
    historyTrace = trace;
    updateHistoryButtons();
  }

  function recordHistory() {
    if (restoringHistory || !trace) return;
    const snapshot = editableSnapshot();
    if (history[historyIndex] !== snapshot) {
      history.splice(historyIndex + 1);
      history.push(snapshot);
      if (history.length > 100) history.shift();
      historyIndex = history.length - 1;
      updateHistoryButtons();
    }
    writeSourceSettings();
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
    renderRail();
    revealCurrentFrameInRail();
    renderTimeline();
    renderSelection();
    applyCameraForFrame(currentIndex, true);
    restoringHistory = false;
    updateHistoryButtons();
    writeSourceSettings();
  }

  function undo() { restoreHistory(historyIndex - 1); }
  function redo() { restoreHistory(historyIndex + 1); }

  function variables() {
    return Object.entries(trace?.variables || {});
  }

  // ---------------------------------------------------------------------------
  // 區段：frame scope 與語意 key
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // 區段：文字綁定
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // 區段：畫布元素與拖曳幾何
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // 區段：文字區段選取
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // 區段：物件轉場編輯
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // 區段：物件與文字樣式
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // 區段：值與位置綁定
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // 區段：綁定與指標同步
  // ---------------------------------------------------------------------------
  function applyCameraForFrame(index, animate = false, delay = 0, previousFrame = null) {
    clearTimeout(cameraTimer);
    const frame = trace?.frames?.[index];
    if (!frame) return;
    cameraTimer = setTimeout(() => {
      if (trace?.frames?.[currentIndex]?.id !== frame.id) return;
      // 鏡頭只依指令（@camera、defaults）或自動捕捉決定。
      window.ASMTraceCamera.apply(trace, frame, previousFrame, animate);
    }, delay);
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

  function eventDots(frame) {
    const dots = el('span', 'trace-studio-event-dots');
    const ordered = window.ASMTraceEvents?.ordered?.(frame.events || []) || frame.events || [];
    const visible = ordered.filter(event => window.ASMTraceEvents?.showTimelineEvent
      ? window.ASMTraceEvents.showTimelineEvent(event, trace)
      : event.enabled !== false
        && event.autoAnimationDisabled !== true
        && window.ASMTraceEvents?.showTag(event.type, trace) !== false);
    const uniqueEvents = new Map();
    visible.forEach(event => {
      const key = event.signature || event.type;
      const existing = uniqueEvents.get(key);
      if (!existing) uniqueEvents.set(key, event);
    });
    const events = [...uniqueEvents.values()];
    events.forEach(event => {
      const dot = el('i', 'trace-studio-event-dot');
      dot.style.background = eventColorFor(event);
      const label = eventLabel(event);
      const summary = eventSummary(event);
      dot.title = summary ? `${label}：${summary}` : label;
      dots.append(dot);
    });
    return dots;
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
      renderRail();
      renderTimeline();
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
    renderRail();
    renderTimeline();
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
    renderRail();
    renderTimeline();
    renderPlayerFrame(currentIndex, { animateEvents: false, animatePositions: false });
  }

  function setEventGap(value, save = true) {
    if (!trace) return;
    ensureStudioData();
    const gapMs = Math.max(0, Math.min(2000, Number(value) || 0));
    trace.studio.eventSettings.gapMs = gapMs;
    if (eventGapRange) {
      eventGapRange.value = String(gapMs);
      eventGapRange.title = `事件間隔時間 ${gapMs} ms`;
    }
    if (eventGapValue) eventGapValue.textContent = `${gapMs} ms`;
    if (!save) return;
    window.dispatchEvent(new CustomEvent('asm:trace-event-settings-changed', {
      detail: { document: trace }
    }));
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
    renderInspectorNavigation();
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

  function setInspectorMode(mode) {
    inspectorMode = mode === 'code' ? 'code' : 'events';
    renderInspectorNavigation();
  }

  function renderInspectorNavigation() {
    if (!inspectorToolbar) return;
    const eventCount = inspectorEventsForFrame().length;
    inspectorEventCount.textContent = String(eventCount);
    inspectorEventCount.hidden = !eventCount;
    [
      [inspectorEventButton, 'events'],
      [inspectorCodeButton, 'code']
    ].forEach(([button, mode]) => {
      const active = inspectorMode === mode;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    inspectorEventsPanel.hidden = inspectorMode !== 'events';
    inspectorCodePanel.hidden = inspectorMode !== 'code';
  }

  function selectFrame(index, event = {}) {
    const next = Math.max(0, Math.min(trace.frames.length - 1, Number(index) || 0));
    if (event.shiftKey) {
      selectedFrames.clear();
      const start = Math.min(selectionAnchor, next);
      const end = Math.max(selectionAnchor, next);
      for (let cursor = start; cursor <= end; cursor += 1) selectedFrames.add(trace.frames[cursor].id);
    } else if (event.ctrlKey || event.metaKey) {
      const id = trace.frames[next].id;
      if (selectedFrames.has(id) && selectedFrames.size > 1) selectedFrames.delete(id);
      else selectedFrames.add(id);
      selectionAnchor = next;
    } else {
      selectedFrames = new Set([trace.frames[next].id]);
      selectionAnchor = next;
    }
    currentIndex = next;
    renderPlayerFrame(next);
    renderSelection();
  }

  function cancelThumbnailRendering() {
    if (thumbnailRenderFrame) {
      if (thumbnailRenderMode === 'idle' && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(thumbnailRenderFrame);
      } else {
        cancelAnimationFrame(thumbnailRenderFrame);
      }
    }
    thumbnailRenderFrame = 0;
    thumbnailRenderMode = '';
    pendingThumbnails = [];
  }

  function cancelThumbnailCulling() {
    if (thumbnailCullFrame) cancelAnimationFrame(thumbnailCullFrame);
    thumbnailCullFrame = 0;
  }

  function thumbnailWithinViewport(itemTop, itemBottom, viewportTop, viewportBottom, overscan = 0) {
    return itemBottom >= viewportTop - overscan && itemTop <= viewportBottom + overscan;
  }

  function thumbnailPriority(itemTop, itemBottom, viewportTop, viewportBottom, overscan, isCurrent = false) {
    if (thumbnailWithinViewport(itemTop, itemBottom, viewportTop, viewportBottom, 0)) {
      return isCurrent ? 'current' : 'visible';
    }
    if (thumbnailWithinViewport(itemTop, itemBottom, viewportTop, viewportBottom, overscan)) {
      return isCurrent ? 'current' : 'buffer';
    }
    return '';
  }

  function clearThumbnailCache() {
    thumbnailCache.clear();
  }

  function cacheThumbnail(frameId, preview) {
    if (!frameId || !preview) return;
    thumbnailCache.delete(frameId);
    thumbnailCache.set(frameId, preview);
    while (thumbnailCache.size > THUMBNAIL_CACHE_LIMIT) {
      thumbnailCache.delete(thumbnailCache.keys().next().value);
    }
  }

  function takeCachedThumbnail(frameId) {
    const preview = thumbnailCache.get(frameId) || null;
    if (preview) thumbnailCache.delete(frameId);
    return preview;
  }

  function thumbnailPlaceholder() {
    const preview = el('span', 'trace-studio-frame-preview');
    preview.setAttribute('aria-label', '縮圖載入中');
    preview.setAttribute('aria-busy', 'true');
    return preview;
  }

  function shouldRenderThumbnail(button, list) {
    const itemRect = button.getBoundingClientRect();
    const viewportRect = list.getBoundingClientRect();
    const overscan = Math.min(180, Math.max(0, button.offsetHeight || 160));
    return Boolean(thumbnailPriority(
      itemRect.top,
      itemRect.bottom,
      viewportRect.top,
      viewportRect.bottom,
      overscan,
      Number(button.dataset.frameIndex) === currentIndex
    ));
  }

  function installThumbnail(preview, placeholder, frame, fromCache = false) {
    preview.dataset.thumbnailRendered = 'true';
    if (fromCache) preview.dataset.thumbnailCacheHit = 'true';
    else delete preview.dataset.thumbnailCacheHit;
    placeholder.replaceWith(preview);
    window.ASMTraceRenderers?.refreshThumbnailCamera?.(preview, trace, frame);
  }

  function renderThumbnailJob(job) {
    const { frame, index, placeholder, button } = job || {};
    const list = typeof rail?.querySelector === 'function'
      ? rail.querySelector('.trace-studio-frame-list')
      : null;
    if (!frame || !placeholder?.isConnected || (button && list && !shouldRenderThumbnail(button, list))) {
      return false;
    }
    const preview = window.ASMTraceRenderers.createThumbnail(trace, frame, trace.frames[index - 1] || null);
    installThumbnail(preview, placeholder, frame, false);
    return true;
  }

  function refreshThumbnailCulling() {
    thumbnailCullFrame = 0;
    if (!rail || !trace || !document.body.classList.contains('asm-trace-studio-open')) return;
    const list = rail.querySelector('.trace-studio-frame-list');
    if (!list) return;
    cancelThumbnailRendering();
    mountVisibleRailCards(list);
    const viewportRect = list.getBoundingClientRect();
    const viewportCenter = (viewportRect.top + viewportRect.bottom) / 2;
    const jobs = [];
    list.querySelectorAll('.trace-studio-frame').forEach((button, index) => {
      const preview = button.querySelector('.trace-studio-frame-preview');
      if (!preview) return;
      const itemRect = button.getBoundingClientRect();
      const overscan = Math.min(180, Math.max(0, button.offsetHeight || 160));
      const frameIndex = Number(button.dataset.frameIndex);
      const frame = trace.frames[frameIndex];
      const priority = thumbnailPriority(
        itemRect.top,
        itemRect.bottom,
        viewportRect.top,
        viewportRect.bottom,
        overscan,
        frameIndex === currentIndex
      );
      if (!priority) {
        if (preview.dataset.thumbnailRendered === 'true') {
          cacheThumbnail(button.dataset.frameId, preview);
          preview.replaceWith(thumbnailPlaceholder());
        }
        return;
      }
      if (preview.dataset.thumbnailRendered === 'true') return;
      if (!frame) return;
      const cached = takeCachedThumbnail(frame.id);
      if (cached) {
        installThumbnail(cached, preview, frame, true);
        return;
      }
      jobs.push({
        frame,
        index: frameIndex,
        placeholder: preview,
        button,
        priority,
        distance: Math.abs(((itemRect.top + itemRect.bottom) / 2) - viewportCenter)
      });
    });
    const priorityRank = { current: 0, visible: 1, buffer: 2 };
    jobs.sort((left, right) => priorityRank[left.priority] - priorityRank[right.priority]
      || left.distance - right.distance || left.index - right.index);
    if (jobs[0]?.priority === 'current') renderThumbnailJob(jobs.shift());
    pendingThumbnails = jobs;
    scheduleThumbnailRendering();
  }

  function scheduleThumbnailCulling() {
    if (thumbnailCullFrame) return;
    thumbnailCullFrame = requestAnimationFrame(refreshThumbnailCulling);
  }

  function scheduleThumbnailRendering() {
    if (thumbnailRenderFrame || !pendingThumbnails.length) return;
    const priority = pendingThumbnails[0]?.priority || 'visible';
    if (priority === 'buffer' && typeof window.requestIdleCallback === 'function') {
      thumbnailRenderMode = 'idle';
      thumbnailRenderFrame = window.requestIdleCallback(renderThumbnailBatch, { timeout: 500 });
      return;
    }
    thumbnailRenderMode = 'frame';
    thumbnailRenderFrame = requestAnimationFrame(() => renderThumbnailBatch(null));
  }

  function renderThumbnailBatch(deadline = null) {
    thumbnailRenderFrame = 0;
    thumbnailRenderMode = '';
    if (!trace || !document.body.classList.contains('asm-trace-studio-open')) {
      pendingThumbnails = [];
      return;
    }
    // Heap thumbnails perform synchronous SVG layout and getBBox calls. Doing
    // several in one animation frame made the freshly opened Studio stutter.
    if (deadline && !deadline.didTimeout && deadline.timeRemaining() < 6) {
      scheduleThumbnailRendering();
      return;
    }
    renderThumbnailJob(pendingThumbnails.shift());
    scheduleThumbnailRendering();
  }

  function createRailCard(frame, index) {
      const button = el('button', 'trace-studio-frame');
      button.type = 'button';
      button.dataset.frameId = frame.id;
      button.dataset.frameIndex = index;
      const header = el('span', 'trace-studio-frame-head');
      header.append(el('strong', '', `幀 ${index + 1}`));
      header.append(eventDots(frame));
      if (window.ASMTraceTransitions?.hasCustomTransition?.(trace, frame.id)) {
        const badge = el('i', 'trace-studio-transition-badge', '↝');
        badge.title = '此幀包含自訂幀間動畫';
        header.append(badge);
      }
      const directiveName = window.ASMTraceViewSource?.directiveName?.(frame) || '';
      const source = el(
        'small',
        '',
        `${directiveName ? `${directiveName} · ` : ''}${frame.source?.function || 'global'}:${frame.source?.line || '-'}`
      );
      const preview = thumbnailPlaceholder();
      button.append(header, source, preview);
      button.addEventListener('click', event => selectFrame(index, event));
      button.style.height = `${RAIL_ROW_HEIGHT}px`;
      button.style.boxSizing = 'border-box';
      button.classList.toggle('is-selected', selectedFrames.has(frame.id));
      button.classList.toggle('is-current', index === currentIndex);
      return button;
  }

  function mountVisibleRailCards(list) {
    const top = list.querySelector('[data-spacer="top"]');
    const bottom = list.querySelector('[data-spacer="bottom"]');
    if (!top || !bottom || list.clientHeight <= 0) return;
    const start = Math.max(0, Math.floor(Math.max(0, list.scrollTop - 6) / RAIL_ROW_PITCH) - 1);
    const end = Math.min(trace.frames.length,
      Math.ceil((list.scrollTop + list.clientHeight - 6) / RAIL_ROW_PITCH) + 1);
    const mounted = new Map();
    list.querySelectorAll('.trace-studio-frame').forEach(button => {
      const index = Number(button.dataset.frameIndex);
      if (index < start || index >= end) {
        const preview = button.querySelector('[data-thumbnail-rendered="true"]');
        if (preview) cacheThumbnail(button.dataset.frameId, preview);
        button.remove();
      } else mounted.set(index, button);
    });
    top.style.height = `${start * RAIL_ROW_PITCH}px`;
    bottom.style.height = `${(trace.frames.length - end) * RAIL_ROW_PITCH}px`;
    for (let index = start; index < end; index += 1) {
      if (mounted.has(index)) continue;
      const button = createRailCard(trace.frames[index], index);
      const following = [...list.querySelectorAll('.trace-studio-frame')]
        .find(item => Number(item.dataset.frameIndex) > index);
      list.insertBefore(button, following || bottom);
    }
  }

  function renderRail() {
    cancelThumbnailCulling();
    cancelThumbnailRendering();
    clearThumbnailCache();
    const list = rail.querySelector('.trace-studio-frame-list');
    const scrollTop = list.scrollTop;
    list.replaceChildren();
    const top = el('div', 'trace-studio-rail-spacer');
    top.dataset.spacer = 'top';
    const bottom = el('div', 'trace-studio-rail-spacer');
    bottom.dataset.spacer = 'bottom';
    bottom.style.height = `${trace.frames.length * RAIL_ROW_PITCH}px`;
    list.append(top, bottom);
    list.scrollTop = scrollTop;
    mountVisibleRailCards(list);
    scheduleThumbnailCulling();
  }

  function revealCurrentFrameInRail() {
    if (!rail || !trace) return;
    const list = rail.querySelector('.trace-studio-frame-list');
    if (!list) return;
    const top = 6 + currentIndex * RAIL_ROW_PITCH;
    const bottom = top + RAIL_ROW_HEIGHT;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
    mountVisibleRailCards(list);
    scheduleThumbnailCulling();
  }

  const TIMELINE_PITCH = 45;
  let timelineWindow = '';
  let timelineScrollFrame = 0;

  function mountTimelineFrames() {
    const track = timeline?.querySelector('.trace-studio-timeline-track');
    if (!track || !trace) return;
    const count = trace.frames.length;
    const start = Math.max(0, Math.floor((track.scrollLeft - 8) / TIMELINE_PITCH) - 1);
    const end = Math.min(count, Math.ceil((track.scrollLeft + track.clientWidth - 8) / TIMELINE_PITCH) + 1);
    const key = `${start}:${end}`;
    if (key === timelineWindow) return;
    timelineWindow = key;
    const fragment = document.createDocumentFragment();
    const spacer = width => {
      const node = el('div', 'trace-studio-time-spacer');
      node.style.flex = `0 0 ${Math.max(0, width)}px`;
      node.setAttribute('aria-hidden', 'true');
      return node;
    };
    if (start) fragment.append(spacer(start * TIMELINE_PITCH - 3));
    for (let index = start; index < end; index += 1) {
      const frame = trace.frames[index];
      const marker = el('button', 'trace-studio-time-frame');
      marker.type = 'button';
      marker.dataset.frameId = frame.id;
      marker.dataset.frameIndex = index;
      marker.classList.toggle('is-selected', selectedFrames.has(frame.id));
      marker.classList.toggle('is-current', index === currentIndex);
      marker.classList.toggle('has-custom-transition', Boolean(
        window.ASMTraceTransitions?.hasCustomTransition?.(trace, frame.id)
      ));
      marker.title = `幀 ${index + 1} · 程式第 ${frame.source?.line || '-'} 行`;
      marker.append(el('span', 'trace-studio-time-number', String(index + 1)), eventDots(frame));
      marker.addEventListener('click', event => selectFrame(index, event));
      fragment.append(marker);
    }
    if (end < count) fragment.append(spacer((count - end) * TIMELINE_PITCH - 3));
    track.replaceChildren(fragment);
  }

  function renderTimeline() {
    timelineWindow = '';
    mountTimelineFrames();
  }

  function revealTimelineFrame() {
    const track = timeline?.querySelector('.trace-studio-timeline-track');
    if (!track) return;
    const left = 8 + currentIndex * TIMELINE_PITCH;
    if (left < track.scrollLeft) track.scrollLeft = left;
    else if (left + 42 > track.scrollLeft + track.clientWidth) {
      track.scrollLeft = left + 42 - track.clientWidth;
    }
    mountTimelineFrames();
  }

  function cancelEventAvailabilityRefresh() {
    if (availabilityRefreshFrame) cancelAnimationFrame(availabilityRefreshFrame);
    availabilityRefreshFrame = 0;
    pendingAvailabilityFrames.clear();
  }

  function refreshEventAvailability() {
    availabilityRefreshFrame = 0;
    const frameIds = new Set(pendingAvailabilityFrames);
    pendingAvailabilityFrames.clear();
    if (!trace || !document.body.classList.contains('asm-trace-studio-open')) return;
    const frames = new Map(trace.frames.filter(frame => frameIds.has(frame.id))
      .map(frame => [frame.id, frame]));
    // Rendering a thumbnail evaluates event availability. Never redraw scenes in
    // response to that notification: doing so rebuilds every SVG for every frame.
    [rail, timeline].forEach(container => {
      container?.querySelectorAll('[data-frame-id]').forEach(item => {
        const frame = frames.get(item.dataset.frameId);
        if (!frame) return;
        item.querySelector('.trace-studio-event-dots')?.replaceWith(eventDots(frame));
      });
    });
    if (frameIds.has(trace.frames[currentIndex]?.id)) renderFrameEventsEditor();
  }

  function renderSelection() {
    if (!trace) return;
    revealTimelineFrame();
    rail.querySelectorAll('[data-frame-id]').forEach(item => {
      item.classList.toggle('is-selected', selectedFrames.has(item.dataset.frameId));
      item.classList.toggle('is-current', Number(item.dataset.frameIndex) === currentIndex);
    });
    timeline.querySelectorAll('[data-frame-id]').forEach(item => {
      item.classList.toggle('is-selected', selectedFrames.has(item.dataset.frameId));
      item.classList.toggle('is-current', Number(item.dataset.frameIndex) === currentIndex);
    });
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

  function buildInspector() {
    inspector = el('aside', 'trace-studio-inspector');
    const header = el('header', 'trace-studio-inspector-head');
    header.append(el('strong', '', '事件與程式碼'));
    inspector.append(header);

    inspectorToolbar = el('nav', 'trace-studio-inspector-toolbar');
    inspectorToolbar.setAttribute('aria-label', '右欄功能');
    const toolbarButton = (mode, icon, label, title) => {
      const button = el('button', 'trace-studio-inspector-tool');
      button.type = 'button';
      button.title = title;
      button.setAttribute('aria-label', label);
      button.append(el('span', 'trace-studio-inspector-tool-icon', icon), el('span', '', label));
      button.addEventListener('click', () => setInspectorMode(mode));
      return button;
    };
    inspectorEventButton = toolbarButton('events', '●', '事件', '事件程式碼');
    inspectorEventCount = el('i', 'trace-studio-inspector-tool-count', '0');
    inspectorEventButton.append(inspectorEventCount);
    inspectorCodeButton = toolbarButton('code', '</>', '程式碼', '編輯目前行為的程式碼片段');
    inspectorToolbar.append(inspectorEventButton, inspectorCodeButton);
    inspector.append(inspectorToolbar);

    eventGapRange = document.createElement('input');
    eventGapRange.type = 'range';
    eventGapRange.className = 'trace-studio-event-gap-range';
    eventGapRange.min = '0';
    eventGapRange.max = '2000';
    eventGapRange.step = '10';
    eventGapRange.value = String(trace?.studio?.eventSettings?.gapMs ?? 500);
    eventGapRange.title = `事件間隔時間 ${eventGapRange.value} ms`;
    eventGapValue = el('output', 'trace-studio-event-gap-value', `${eventGapRange.value} ms`);
    const eventGapControl = el('div', 'trace-studio-event-gap-control');
    eventGapControl.append(eventGapRange, eventGapValue);
    eventGapRange.addEventListener('input', () => {
      setEventGap(eventGapRange.value, false);
      window.dispatchEvent(new CustomEvent('asm:trace-event-gap-input', {
        detail: { document: trace, gapMs: Number(eventGapRange.value) || 0 }
      }));
    });
    eventGapRange.addEventListener('change', () => setEventGap(eventGapRange.value, true));
    const eventGapField = field('事件間隔時間', eventGapControl);

    inspectorEventsPanel = el('div', 'trace-studio-inspector-panel trace-studio-events-panel');
    inspectorCodePanel = el('div', 'trace-studio-inspector-panel trace-studio-code-panel');
    inspector.append(inspectorEventsPanel, inspectorCodePanel);

    frameEventsEditor = section('事件程式碼');
    frameEventsEditor.classList.add('trace-studio-frame-events-section');
    frameEventsList = el('div', 'trace-studio-frame-events');
    frameEventsEditor.append(frameEventsList);
    frameFixedEditor = section('自動固定');
    frameFixedEditor.classList.add('trace-studio-fixed-section');
    frameFixedList = el('div', 'trace-studio-fixed-batches');
    frameFixedEditor.append(frameFixedList);
    inspectorEventsPanel.append(eventGapField, frameEventsEditor, frameFixedEditor);
    renderFrameEventsEditor();

    frameCodeSnippetEditor = section('程式碼片段');
    frameCodeSnippetEditor.classList.add('trace-studio-code-snippet-section');
    const snippetHeader = el('div', 'trace-studio-snippet-head');
    frameCodeSnippetMeta = el('span', 'trace-studio-snippet-meta', '');
    resetCodeSnippetButton = el('button', 'trace-studio-snippet-reset');
    resetCodeSnippetButton.type = 'button';
    resetCodeSnippetButton.title = '恢復自動篩選';
    resetCodeSnippetButton.setAttribute('aria-label', '恢復自動篩選');
    resetCodeSnippetButton.append(snippetActionIcon('reset'));
    resetCodeSnippetButton.addEventListener('click', resetCurrentCodeSnippet);
    snippetFocusButton = el('button', 'trace-studio-snippet-focus');
    snippetFocusButton.type = 'button';
    setSnippetFocus(false);
    snippetFocusButton.addEventListener('click', () => setSnippetFocus(
      !document.body.classList.contains('asm-trace-snippet-focus')
    ));
    const snippetActions = el('div', 'trace-studio-snippet-actions');
    snippetActions.append(resetCodeSnippetButton, snippetFocusButton);
    snippetHeader.append(frameCodeSnippetMeta, snippetActions);
    frameCodeSnippetList = el('div', 'trace-studio-frame-events trace-studio-code-snippet-list');
    frameCodeSnippetList.addEventListener('wheel', event => {
      if (!event.shiftKey || Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
      event.preventDefault();
      frameCodeSnippetList.scrollLeft += event.deltaY;
    }, { passive: false });
    frameCodeSnippetEditor.append(snippetHeader, frameCodeSnippetList);
    inspectorCodePanel.append(frameCodeSnippetEditor);
    renderCodeSnippetEditor();

    const codePanel = section('程式碼框外觀');
    codePanel.dataset.traceCodeControls = '1';
    codePanelSettingsSection = codePanel;
    codePanelFontSize = document.createElement('input');
    codePanelFontSize.type = 'range';
    codePanelFontSize.min = '8';
    codePanelFontSize.max = '64';
    codePanelFontSize.step = '1';
    const savedCodeFontSize = window.ASMTraceCodePresenter?.normalizeFontSize?.(
      trace?.studio?.codePanelFontSize
    ) || 20;
    codePanelFontSize.value = String(savedCodeFontSize);
    codePanelFontSizeValue = el('output', 'trace-studio-range-value', `${savedCodeFontSize}px`);
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
    codePanelFontSize.addEventListener('change', recordHistory);
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
      const value = setting.normalize(trace?.studio?.[setting.key]);
      input.value = String(value);
      const output = el('output','trace-studio-range-value',`${value}${setting.suffix}`);
      const row = el('div','trace-studio-range-row'); row.append(input,output);
      codePanelRanges.set(setting.key,{...setting,input,output});
      input.addEventListener('input', () => {
        trace.studio ||= {};
        const value = setting.normalize(input.value);
        trace.studio[setting.key] = value;
        output.textContent = `${value}${setting.suffix}`;
        window.ASMTraceCodePresenter.applyPresentationSettings(trace);
      });
      input.addEventListener('change',recordHistory);
      codePanel.append(field(setting.label,row));
    });
    inspectorCodePanel.append(codePanel);
    renderInspectorNavigation();
    return inspector;
  }

  function closeStudio(options = {}) {
    cancelThumbnailCulling();
    cancelThumbnailRendering();
    cancelEventAvailabilityRefresh();
    writeSourceSettings();
    window.ASMTraceCodePresenter?.clearSelection?.();
    setSnippetFocus(false);
    document.body.classList.remove('asm-trace-studio-open');
    window.setLocalCameraStudio?.(false);
    codePanelSelectionActive = false;
    // Leaving the editor restores a stable scene, without replaying events.
    // Explicitly disabling event animation also preserves viewport-aware LOD.
    if (options.render !== false) renderPlayerFrame(currentIndex, { animateEvents: false, animatePositions: false });
  }

  function buildUi() {
    const main = document.getElementById('main');
    const vizPanel = document.getElementById('vizPanel');
    if (!main || !vizPanel || document.getElementById('traceStudioRail')) return;

    rail = el('aside', 'trace-studio-rail');
    rail.id = 'traceStudioRail';
    const railHeader = el('header', 'trace-studio-rail-head');
    railHeader.append(el('strong', '', '切片縮圖'));
    const historyControls = el('div', 'trace-studio-history');
    undoButton = el('button', '', '↶');
    undoButton.type = 'button';
    undoButton.title = '復原 (Ctrl+Z)';
    undoButton.addEventListener('click', undo);
    redoButton = el('button', '', '↷');
    redoButton.type = 'button';
    redoButton.title = '重做 (Ctrl+Y)';
    redoButton.addEventListener('click', redo);
    historyControls.append(undoButton, redoButton);
    const close = el('button', '', '返回程式碼');
    close.type = 'button';
    close.addEventListener('click', closeStudio);
    railHeader.append(historyControls, close);
    const frameList = el('div', 'trace-studio-frame-list');
    frameList.addEventListener('scroll', scheduleThumbnailCulling, { passive: true });
    rail.append(railHeader, frameList);

    inspector = buildInspector();
    inspectorResizer = el('div', 'trace-studio-inspector-resizer');
    inspectorResizer.id = 'traceStudioInspectorResizer';
    inspectorResizer.tabIndex = 0;
    inspectorResizer.setAttribute('role', 'separator');
    inspectorResizer.setAttribute('aria-label', '調整 Trace Studio 右側欄寬度');
    inspectorResizer.setAttribute('aria-orientation', 'vertical');
    inspectorResizer.setAttribute('aria-valuemin', '300');
    inspectorResizer.setAttribute('aria-valuemax', '760');
    inspectorResizer.title = '拖曳調整右側欄寬度；雙擊恢復預設';
    inspectorResizer.addEventListener('pointerdown', beginInspectorResize);
    inspectorResizer.addEventListener('dblclick', () => setInspectorWidth(DEFAULT_INSPECTOR_WIDTH, true));
    inspectorResizer.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)) return;
      event.preventDefault();
      const current = Number(inspectorResizer.getAttribute('aria-valuenow')) || DEFAULT_INSPECTOR_WIDTH;
      setInspectorWidth(event.key === 'Home'
        ? DEFAULT_INSPECTOR_WIDTH
        : current + (event.key === 'ArrowLeft' ? 24 : -24), true);
    });
    timeline = el('div', 'trace-studio-timeline');
    timeline.id = 'traceStudioTimeline';
    const timelineHead = el('div', 'trace-studio-timeline-head');
    timelineHead.append(el('strong', '', '事件時間線'));
    timeline.append(timelineHead, el('div', 'trace-studio-timeline-track'));
    const timeTrack = timeline.querySelector('.trace-studio-timeline-track');
    timeTrack.addEventListener('scroll', () => {
      if (timelineScrollFrame) return;
      timelineScrollFrame = requestAnimationFrame(() => {
        timelineScrollFrame = 0;
        mountTimelineFrames();
      });
    }, { passive: true });
    new ResizeObserver(() => mountTimelineFrames()).observe(timeTrack);


    main.insertBefore(rail, vizPanel);
    main.append(inspectorResizer, inspector);
    restoreInspectorWidth();
    vizPanel.append(timeline);
    window.addEventListener('resize', scheduleThumbnailCulling);
    window.addEventListener('resize', restoreInspectorWidth);
    window.addEventListener('keydown', event => {
      if (event.key === 'Escape' && document.body.classList.contains('asm-trace-snippet-focus')) {
        event.preventDefault();
        setSnippetFocus(false);
      }
    });
  }

  function open(source) {
    cancelThumbnailRendering();
    cancelEventAvailabilityRefresh();
    trace = source || window.ASMTracePlayer?.getDocument?.();
    if (!trace?.frames?.length) return;
    currentIndex = Math.max(0, window.ASMTracePlayer?.getCurrentFrame?.() || 0);
    // Compute the current frame before the inspector is created. Previously
    // buildUi rendered the first-frame buttons from stale/default availability
    // and they stayed green until that frame was visited through playback.
    window.ASMTraceRenderers?.preflightEventAvailability?.(trace, { frameIndex: currentIndex });
    const canvasTab = document.querySelector('.tab-btn[data-tab="tab-canvas"]');
    if (canvasTab && !canvasTab.classList.contains('active')) canvasTab.click();
    ensureStudioData();
    buildUi();
    document.body.classList.add('asm-trace-studio-open');
    window.setLocalCameraStudio?.(true);
    if (historyTrace !== trace) resetHistory();
    codePanelSelectionActive = false;
    inspectorMode = hasEventInspectorContent(trace.frames[currentIndex]) ? 'events' : 'code';
    selectedFrames = new Set([trace.frames[currentIndex].id]);
    selectionAnchor = currentIndex;
    renderRail();
    revealCurrentFrameInRail();
    renderTimeline();
    renderSelection();
    renderInspectorNavigation();
    if (!window.ASMTraceRenderers?.canReuseStudioScene?.(trace, trace.frames[currentIndex])) {
      renderPlayerFrame(currentIndex, { animateEvents: false, animatePositions: false });
    } else {
      window.ASMTraceRenderers.preflightEventAvailability(trace, { frameIndex: currentIndex });
    }
    applyCameraForFrame(currentIndex, false);
  }

  window.addEventListener('asm:trace-frame', event => {
    if (!trace || event.detail?.document !== trace) return;
    if (!document.body.classList.contains('asm-trace-studio-open')) return;
    const next = Math.max(0, Math.min(trace.frames.length - 1, Number(event.detail.index) || 0));
    currentIndex = next;
    window.ASMTraceRenderers?.preflightEventAvailability?.(trace, { frameIndex: next });
    if (studioRenderDepth === 0) {
      selectedFrames = new Set([trace.frames[next].id]);
      selectionAnchor = next;
    }
    renderSelection();
    applyCameraForFrame(currentIndex, Boolean(event.detail?.previousFrame), 0, event.detail?.previousFrame || null);
    if (studioRenderDepth === 0) revealCurrentFrameInRail();
  });

  window.addEventListener('asm:trace-menu-colors', event => {
    if (!trace || event.detail?.document !== trace) return;
    renderRail();
    renderTimeline();
    renderSelection();
  });

  window.addEventListener('asm:trace-event-settings-changed', event => {
    if (!trace || event.detail?.document !== trace) return;
    setEventGap(trace.studio?.eventSettings?.gapMs ?? 500, false);
    renderFrameEventsEditor();
    renderCodeSnippetEditor();
    renderRail();
    renderTimeline();
    renderInspectorNavigation();
  });

  window.addEventListener('asm:trace-active-event', event => {
    if (!trace || event.detail?.document !== trace
      || !document.body.classList.contains('asm-trace-studio-open')) return;
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
    if (!trace || event.detail?.document !== trace
      || !document.body.classList.contains('asm-trace-studio-open')) return;
    // 點畫布上的程式碼框：切到「程式碼」頁並捲到程式碼框外觀設定。
    codePanelSelectionActive = true;
    inspectorMode = 'code';
    renderInspectorNavigation();
    codePanelSettingsSection?.scrollIntoView?.({ block: 'nearest' });
  });

  window.addEventListener('asm:trace-event-availability-changed', event => {
    if (!trace || event.detail?.document !== trace
      || !document.body.classList.contains('asm-trace-studio-open')) return;
    pendingAvailabilityFrames.add(event.detail.frameId);
    if (!availabilityRefreshFrame) {
      availabilityRefreshFrame = requestAnimationFrame(refreshEventAvailability);
    }
  });

  window.addEventListener('asm:trace-event-gap-input', event => {
    if (!trace || event.detail?.document !== trace) return;
    setEventGap(event.detail?.gapMs ?? 500, false);
  });

  window.addEventListener('keydown', event => {
    if (!document.body.classList.contains('asm-trace-studio-open') || !(event.ctrlKey || event.metaKey)) return;
    const tag = event.target?.tagName?.toLowerCase();
    if (['input', 'textarea', 'select'].includes(tag) || event.target?.isContentEditable) return;
    const key = event.key.toLowerCase();
    if (key !== 'z' && key !== 'y') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (key === 'y' || event.shiftKey) redo();
    else undo();
  }, true);
  window.ASMTraceStudio = {
    open,
    close: closeStudio,
    refresh() {
      if (!trace || !document.body.classList.contains('asm-trace-studio-open')) return;
      renderRail();
      renderTimeline();
      renderSelection();
      renderFrameEventsEditor();
      renderInspectorNavigation();
    },
    refreshViewport() {
      if (!trace || !document.body.classList.contains('asm-trace-studio-open')) return;
      applyCameraForFrame(currentIndex, false);
      scheduleThumbnailCulling();
    },
    flushSourceSettings() {
      return writeSourceSettings();
    }
  };
})();
