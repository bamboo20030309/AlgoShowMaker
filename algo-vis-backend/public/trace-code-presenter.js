(function () {
  let panel = null;
  let body = null;
  let currentDocument = null;
  let currentFrame = null;
  let currentPlan = null;
  let currentFocusLine = 0;
  let currentEvents = new Map();
  let activeEventId = '';
  let startedEventIds = new Set();
  let completedEventIds = new Set();
  let scheduledEventIds = new Set();
  let cppTokenizer = null;
  let syntaxSource = null;
  let syntaxByLine = new Map();
  let transitionTimers = [];
  let transitionFinalPage = null;
  let dragState = null;
  let viewportObserver = null;
  let observedViewport = null;
  let appliedPositionKey = null;
  const eventNodes = new Map();
  const CODE_TRANSITION_MS = 500;
  const CODE_SCROLL_MS = 460;
  const CODE_PANEL_REFERENCE_WIDTH = 1600;
  const CODE_PANEL_REFERENCE_HEIGHT = 900;
  const DEFAULT_CODE_PANEL_FONT_SIZE = 20;
  const MIN_CODE_PANEL_FONT_SIZE = 8;
  const MAX_CODE_PANEL_FONT_SIZE = 32;

  function ensurePanel() {
    const wrapper = document.getElementById('canvasWrapper');
    if (!wrapper) return null;
    if (panel?.isConnected && panel.parentElement === wrapper) {
      observeViewport();
      return panel;
    }
    panel = document.createElement('aside');
    panel.id = 'traceCodePanel';
    panel.className = 'asm-trace-code-panel';
    panel.hidden = true;
    panel.setAttribute('aria-label', '目前程式碼片段');
    panel.innerHTML = '<div class="asm-trace-code-body ace-tm"></div>';
    body = panel.querySelector('.asm-trace-code-body');
    wrapper.append(panel);
    bindDragging();
    observeViewport();
    return panel;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalizeFontSize(value) {
    const size = Number(value);
    return Math.round(clamp(
      Number.isFinite(size) ? size : DEFAULT_CODE_PANEL_FONT_SIZE,
      MIN_CODE_PANEL_FONT_SIZE,
      MAX_CODE_PANEL_FONT_SIZE
    ));
  }

  function scaledFontSize(value, viewportHeight = document.documentElement?.clientHeight || window.innerHeight,
    viewportWidth = 0) {
    const height = Number(viewportHeight) > 0 ? Number(viewportHeight) : CODE_PANEL_REFERENCE_HEIGHT;
    const scales = [height / CODE_PANEL_REFERENCE_HEIGHT];
    if (Number(viewportWidth) > 0) scales.push(Number(viewportWidth) / CODE_PANEL_REFERENCE_WIDTH);
    return normalizeFontSize(value) * Math.min(...scales);
  }

  function viewportSize() {
    const canvas = document.getElementById('arraySvg');
    const rect = canvas?.getBoundingClientRect?.();
    return {
      width: Number(rect?.width) || canvas?.clientWidth || CODE_PANEL_REFERENCE_WIDTH,
      height: Number(rect?.height) || canvas?.clientHeight || CODE_PANEL_REFERENCE_HEIGHT
    };
  }

  function observeViewport() {
    const canvas = document.getElementById('arraySvg');
    if (!canvas || typeof window.ResizeObserver !== 'function' || observedViewport === canvas) return;
    viewportObserver?.disconnect?.();
    observedViewport = canvas;
    viewportObserver = new window.ResizeObserver(() => requestAnimationFrame(() => {
      applyStoredFontSize();
      applyStoredPosition();
    }));
    viewportObserver.observe(canvas);
  }

  function applyStoredFontSize() {
    if (!panel) return;
    const preferred = normalizeFontSize(currentDocument?.studio?.codePanelFontSize);
    const viewport = viewportSize();
    panel.dataset.codePanelFontSize = String(preferred);
    panel.style.fontSize = `${scaledFontSize(preferred, viewport.height, viewport.width)}px`;
    panel.dataset.codePanelRenderedFontSize = String(
      Math.round(scaledFontSize(preferred, viewport.height, viewport.width) * 100) / 100
    );
  }

  function setPanelPixels(left, top) {
    const wrapper = panel?.parentElement;
    if (!panel || !wrapper) return;
    panel.style.left = `${clamp(left, 8, Math.max(8, wrapper.clientWidth - panel.offsetWidth - 8))}px`;
    panel.style.top = `${clamp(top, 8, Math.max(8, wrapper.clientHeight - panel.offsetHeight - 8))}px`;
  }

  function storedPositionKey(trace = currentDocument) {
    const saved = trace?.studio?.codePanelPosition;
    return Number.isFinite(Number(saved?.x)) && Number.isFinite(Number(saved?.y))
      ? `${Number(saved.x)}:${Number(saved.y)}`
      : 'default';
  }

  function applyStoredPosition() {
    if (!panel || panel.hidden) return;
    appliedPositionKey = storedPositionKey();
    const wrapper = panel.parentElement;
    const saved = currentDocument?.studio?.codePanelPosition;
    if (!wrapper || !Number.isFinite(Number(saved?.x)) || !Number.isFinite(Number(saved?.y))) {
      setPanelPixels(24, 24);
      return;
    }
    const availableX = Math.max(0, wrapper.clientWidth - panel.offsetWidth);
    const availableY = Math.max(0, wrapper.clientHeight - panel.offsetHeight);
    setPanelPixels(clamp(Number(saved.x), 0, 1) * availableX, clamp(Number(saved.y), 0, 1) * availableY);
  }

  function storePanelPosition() {
    const wrapper = panel?.parentElement;
    if (!panel || !wrapper || !currentDocument) return;
    const availableX = Math.max(1, wrapper.clientWidth - panel.offsetWidth);
    const availableY = Math.max(1, wrapper.clientHeight - panel.offsetHeight);
    currentDocument.studio ||= {};
    currentDocument.studio.codePanelPosition = {
      x: Math.round(clamp(panel.offsetLeft / availableX, 0, 1) * 10000) / 10000,
      y: Math.round(clamp(panel.offsetTop / availableY, 0, 1) * 10000) / 10000
    };
    appliedPositionKey = storedPositionKey();
  }

  function finishDrag(event) {
    if (!dragState || (event?.pointerId != null && event.pointerId !== dragState.pointerId)) return;
    try { panel?.releasePointerCapture?.(dragState.pointerId); } catch (_) { /* already released */ }
    dragState = null;
    panel?.classList.remove('is-dragging');
    storePanelPosition();
  }

  function bindDragging() {
    if (!panel || panel.dataset.dragBound) return;
    panel.dataset.dragBound = '1';
    panel.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      if (!window._canvasInteraction?.selectExternal?.(panel)) {
        panel.classList.add('selected');
      }
      window.dispatchEvent(new CustomEvent('asm:trace-code-panel-selected', {
        detail: { document: currentDocument, panel }
      }));
      // Code text remains selectable. Dragging starts from the panel padding,
      // ellipses or other blank space instead of consuming text selection.
      if (event.target.closest?.('code')) return;
      const rect = panel.getBoundingClientRect();
      dragState = {
        pointerId: event.pointerId,
        dx: event.clientX - rect.left,
        dy: event.clientY - rect.top
      };
      panel.classList.add('is-dragging');
      panel.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    });
    panel.addEventListener('pointermove', event => {
      if (!dragState || event.pointerId !== dragState.pointerId) return;
      const wrapperRect = panel.parentElement.getBoundingClientRect();
      setPanelPixels(event.clientX - wrapperRect.left - dragState.dx, event.clientY - wrapperRect.top - dragState.dy);
      event.preventDefault();
    });
    panel.addEventListener('pointerup', finishDrag);
    panel.addEventListener('pointercancel', finishDrag);
  }

  function clearSelection() {
    if (!panel) return;
    if (!window._canvasInteraction?.clearExternalSelection?.(panel)) {
      panel.classList.remove('selected', 'is-selected');
    }
  }

  function registerEventNode(eventId, node) {
    if (!eventId) return;
    if (!eventNodes.has(eventId)) eventNodes.set(eventId, []);
    eventNodes.get(eventId).push(node);
  }

  function aceTokenClasses(type = '') {
    return String(type).split('.').filter(part => part && part !== 'text')
      .map(part => `ace_${part.replace(/[^A-Za-z0-9_-]/g, '_')}`);
  }

  function getCppTokenizer() {
    if (cppTokenizer) return cppTokenizer;
    try {
      window.ace?.require?.('ace/theme/textmate');
      const Mode = window.ace?.require?.('ace/mode/c_cpp')?.Mode;
      cppTokenizer = Mode ? new Mode().getTokenizer() : null;
    } catch (_) {
      cppTokenizer = null;
    }
    return cppTokenizer;
  }

  function syntaxForSource(source = '') {
    if (source === syntaxSource) return syntaxByLine;
    syntaxSource = source;
    syntaxByLine = window.ASMTraceCodeModel?.tokenizeSource?.(source, getCppTokenizer()) || new Map();
    return syntaxByLine;
  }

  function appendSyntaxSegment(segment, parent) {
    const tokenClasses = aceTokenClasses(segment.tokenType);
    if (!tokenClasses.length) {
      parent.append(document.createTextNode(segment.text));
      return;
    }
    const span = document.createElement('span');
    span.classList.add(...tokenClasses);
    span.textContent = segment.text;
    parent.append(span);
  }

  function renderSegments(segments, code) {
    let eventWrapper = null;
    let wrapperKey = '';
    segments.forEach(segment => {
      const ids = Array.isArray(segment.eventIds) ? segment.eventIds.filter(Boolean) : [];
      const key = ids.join(' ');
      if (!key) {
        eventWrapper = null;
        wrapperKey = '';
        appendSyntaxSegment(segment, code);
        return;
      }
      if (!eventWrapper || key !== wrapperKey) {
        eventWrapper = document.createElement('span');
        eventWrapper.className = 'asm-trace-code-event-span';
        eventWrapper.dataset.traceEventIds = key;
        ids.forEach(id => registerEventNode(id, eventWrapper));
        code.append(eventWrapper);
        wrapperKey = key;
      }
      appendSyntaxSegment(segment, eventWrapper);
    });
  }

  function renderLine(item, fragmentElement, syntaxLines, transitionLines = null) {
    if (item.kind === 'ellipsis') {
      const ellipsis = document.createElement('div');
      ellipsis.className = 'asm-trace-code-ellipsis';
      ellipsis.textContent = '⋯';
      fragmentElement.append(ellipsis);
      return;
    }
    const line = document.createElement('div');
    line.className = 'asm-trace-code-line';
    line.dataset.sourceLine = String(item.number);
    if (transitionLines?.entering?.has(Number(item.number))) {
      line.classList.add('is-transition-entering');
    }
    if (transitionLines?.leaving?.has(Number(item.number))) {
      line.classList.add('is-transition-leaving');
    }
    const code = document.createElement('code');
    const segments = window.ASMTraceCodeModel.mergeSyntaxSegments(
      item,
      syntaxLines.get(item.number) || []
    );
    renderSegments(segments, code);
    line.append(code);
    fragmentElement.append(line);
  }

  function sourceRange(event) {
    const from = Number(event?.source?.from);
    const to = Number(event?.source?.to);
    return Number.isFinite(from) && Number.isFinite(to) && to >= from
      ? { from, to }
      : null;
  }

  function conditionContainsComparison(condition, events = currentEvents) {
    const conditionRange = sourceRange(condition);
    if (!conditionRange) return false;
    return [...events.values()].some(event => {
      if (event?.type !== 'compare') return false;
      const compareRange = sourceRange(event);
      return compareRange
        && compareRange.from >= conditionRange.from
        && compareRange.to <= conditionRange.to;
    });
  }

  function comparisonCanPlay(event) {
    return event?.type === 'compare' && event.enabled !== false
      && event.autoAnimationDisabled !== true;
  }

  function conditionCodeHighlightEnabled(condition, events = currentEvents) {
    const conditionRange = sourceRange(condition);
    if (!conditionRange) return false;
    const comparisons = [...events.values()].filter(event => {
      if (event?.type !== 'compare') return false;
      const compareRange = sourceRange(event);
      return compareRange
        && compareRange.from >= conditionRange.from
        && compareRange.to <= conditionRange.to;
    });
    // A whole-condition result is internal metadata, not an independent
    // highlight control. Only color it after every comparison slice that
    // produced the result is enabled; otherwise an unchecked slice can still
    // paint the entire if/for expression through its condition event.
    return comparisons.length > 0 && comparisons.every(comparisonCanPlay);
  }

  function visualStateForIds(ids, events = currentEvents, started = startedEventIds,
    completed = completedEventIds, activeId = activeEventId) {
    const candidates = ids.map(id => events.get(id)).filter(Boolean);
    const disabledComparisonOnSegment = candidates.some(event => (
      event.type === 'compare' && !comparisonCanPlay(event)
    ));
    const linked = candidates.filter(event => {
      if (event.type === 'compare') return comparisonCanPlay(event);
      if (event.type === 'call') return event.enabled !== false && event.autoAnimationDisabled !== true;
      if (event.type !== 'condition') return true;
      return !disabledComparisonOnSegment && conditionCodeHighlightEnabled(event, events);
    });
    const linkedIds = new Set(linked.map(event => String(event.id || '')).filter(Boolean));
    const completedConditions = linked
      .filter(event => event.type === 'condition' && completed.has(String(event.id)))
      .sort((left, right) => Number(left?.order) - Number(right?.order));
    const condition = completedConditions.at(-1) || null;
    const pendingConditions = linked.filter(event => (
      event.type === 'condition' && !completed.has(String(event.id))
    ));
    const pendingComparison = pendingConditions.length > 0 && linked.some(event => (
      event.type === 'compare'
      && (started.has(String(event.id)) || completed.has(String(event.id)))
    ));
    const activeEvent = events.get(String(activeId || ''));
    const suppressWholeConditionPulse = activeEvent?.type === 'condition'
      && conditionContainsComparison(activeEvent, events);
    const active = Boolean(activeId) && linkedIds.has(String(activeId))
      && !suppressWholeConditionPulse;
    // Calling a function is a code-only breadcrumb: turn the call grey in
    // execution order, without the yellow pulse used by canvas responses.
    const activeCall = active && activeEvent?.type === 'call';
    // A split condition can contain unchecked slices. Those slices must not
    // prevent a checked, completed comparison from retaining its own result.
    // Restrict the fallback to one source range so it cannot paint a union of
    // multiple comparisons as though the whole condition were enabled.
    const comparisonRanges = new Set(candidates.filter(event => event.type === 'compare')
      .map(event => {
        const range = sourceRange(event);
        return range ? `${range.from}:${range.to}` : String(event.id || '');
      }));
    const completedComparison = !disabledComparisonOnSegment && comparisonRanges.size === 1
      ? linked.filter(event => event.type === 'compare'
        && completed.has(String(event.id)) && typeof event.result === 'boolean')
        .sort((left, right) => Number(left.order) - Number(right.order)).at(-1)
      : null;
    const conditionResult = condition?.result
      ?? (!pendingComparison ? completedComparison?.result : undefined);
    return {
      active: active && !activeCall,
      pending: !activeCall && pendingComparison,
      complete: activeCall || (conditionResult == null && !pendingComparison
        && [...linkedIds].some(id => completed.has(id))),
      conditionResult: activeCall ? undefined : conditionResult
    };
  }

  function applyEventClasses() {
    const knownNodes = [...new Set([...eventNodes.values()].flat())];
    [...new Set(knownNodes.map(node => node.closest('.asm-trace-code-line')).filter(Boolean))]
      .forEach(line => line.classList.remove('has-active-event'));
    knownNodes.forEach(node => {
      const ids = String(node.dataset.traceEventIds || '').split(/\s+/).filter(Boolean);
      const state = visualStateForIds(ids);
      node.classList.toggle('is-active', state.active);
      node.classList.toggle('is-condition-pending', state.pending);
      node.classList.toggle('is-complete', state.complete);
      node.classList.toggle('is-condition-true', state.conditionResult === true);
      node.classList.toggle('is-condition-false', state.conditionResult === false);
      node.classList.remove('is-active-first', 'is-active-last');
    });
    const activeByLine = new Map();
    const activeEvent = currentEvents.get(activeEventId);
    const activeNodes = activeEvent?.type === 'compare' && !comparisonCanPlay(activeEvent)
      ? [] : eventNodes.get(activeEventId) || [];
    activeNodes.forEach(node => {
      const line = node.closest('.asm-trace-code-line');
      if (!line) return;
      if (!activeByLine.has(line)) activeByLine.set(line, []);
      activeByLine.get(line).push(node);
    });
    activeByLine.forEach((nodes, line) => {
      line.classList.add('has-active-event');
      nodes[0]?.classList.add('is-active-first');
      nodes.at(-1)?.classList.add('is-active-last');
    });
  }

  function setActiveEvent(eventId = '', phase = 'start') {
    const id = String(eventId || '');
    const event = currentEvents.get(id);
    if (event?.type === 'compare' && !comparisonCanPlay(event)) return;
    if (phase === 'start' && id) startedEventIds.add(id);
    if ((phase === 'end' || phase === 'complete') && id
      && (event?.type === 'condition' || scheduledEventIds.has(id))) completedEventIds.add(id);
    activeEventId = phase === 'start' ? id : (activeEventId === id ? '' : activeEventId);
    applyEventClasses();
  }

  function planFocusLine(plan) {
    if (Number(plan?.focusLine) > 0) return Number(plan.focusLine);
    const lines = (plan.fragments || []).flatMap(fragment => fragment.items || [])
      .filter(item => item.kind === 'line').map(item => Number(item.number)).filter(Number.isFinite);
    return lines.length ? Math.min(...lines) : 0;
  }

  function buildPage(plan, syntaxLines, expanded = false) {
    const page = document.createElement('div');
    page.className = 'asm-trace-code-page';
    const fragments = plan.fragments || [];
    let lastWasEllipsis = false;
    fragments.forEach((fragment, index) => {
      const items = expanded ? (fragment.expandedItems || fragment.items || []) : (fragment.items || []);
      if (index && !lastWasEllipsis && items[0]?.kind !== 'ellipsis') {
        const divider = document.createElement('div');
        divider.className = 'asm-trace-code-fragment-divider';
        divider.textContent = '⋯';
        page.append(divider);
        lastWasEllipsis = true;
      }
      const fragmentElement = document.createElement('section');
      fragmentElement.className = 'asm-trace-code-fragment';
      const transitionLines = expanded ? {
        entering: new Set(fragment.transitionEnteringLines || []),
        leaving: new Set(fragment.transitionLeavingLines || [])
      } : null;
      items.forEach(item => {
        if (item.kind === 'ellipsis' && lastWasEllipsis) return;
        renderLine(item, fragmentElement, syntaxLines, transitionLines);
        lastWasEllipsis = item.kind === 'ellipsis';
      });
      page.append(fragmentElement);
    });
    if (expanded) page.classList.add('is-transition-expanded');
    return page;
  }

  function scheduleTransition(callback, delay) {
    transitionTimers.push(setTimeout(callback, delay));
  }

  function finishPageTransition() {
    transitionTimers.forEach(timer => clearTimeout(timer));
    transitionTimers = [];
    if (transitionFinalPage && body) body.replaceChildren(transitionFinalPage);
    transitionFinalPage = null;
    body?.classList.remove('is-switching', 'is-code-expanding', 'is-code-scrolling', 'is-code-collapsing');
  }

  function lineItems(items = []) {
    return new Map(items.filter(item => item?.kind === 'line')
      .map(item => [Number(item.number), item]));
  }

  function selectiveTransitionFragment(previousFragment, nextFragment) {
    const previousLines = lineItems(previousFragment?.items);
    const nextLines = lineItems(nextFragment?.items);
    const visibleLines = new Set([...previousLines.keys(), ...nextLines.keys()]);
    const catalogue = lineItems([
      ...(previousFragment?.expandedItems || previousFragment?.items || []),
      ...(nextFragment?.expandedItems || nextFragment?.items || [])
    ]);
    previousLines.forEach((item, number) => catalogue.set(number, item));
    nextLines.forEach((item, number) => catalogue.set(number, item));
    const ordered = [...catalogue.keys()].filter(Number.isFinite).sort((left, right) => left - right);
    const items = [];
    let omitted = false;
    ordered.forEach(number => {
      if (!visibleLines.has(number)) {
        omitted = true;
        return;
      }
      if (omitted && items.at(-1)?.kind !== 'ellipsis') {
        items.push({ kind: 'ellipsis' });
      }
      items.push(nextLines.get(number) || previousLines.get(number) || catalogue.get(number));
      omitted = false;
    });
    if (omitted && items.length && items.at(-1)?.kind !== 'ellipsis') items.push({ kind: 'ellipsis' });
    return {
      ...nextFragment,
      expandedItems: items,
      transitionEnteringLines: [...nextLines.keys()].filter(number => !previousLines.has(number)),
      transitionLeavingLines: [...previousLines.keys()].filter(number => !nextLines.has(number))
    };
  }

  function selectiveTransitionPlan(previousPlan, nextPlan) {
    const available = new Map();
    (previousPlan?.fragments || []).forEach(fragment => {
      const key = `${fragment?.functionName || ''}|${fragment?.subtreeKey || ''}`;
      if (!available.has(key)) available.set(key, []);
      available.get(key).push(fragment);
    });
    const fragments = (nextPlan?.fragments || []).map(fragment => {
      const matches = available.get(`${fragment?.functionName || ''}|${fragment?.subtreeKey || ''}`) || [];
      const previousFragment = matches.shift() || null;
      return previousFragment
        ? selectiveTransitionFragment(previousFragment, fragment)
        : {
          ...fragment,
          expandedItems: fragment.items || [],
          transitionEnteringLines: [...lineItems(fragment.items).keys()],
          transitionLeavingLines: []
        };
    });
    // Keep the old-only source in the same scrolling document until the new
    // focus is reached. Slide code widgets likewise scroll one stable code
    // surface rather than sending a separate old widget off screen.
    available.forEach(matches => matches.forEach(fragment => fragments.push({
      ...fragment,
      expandedItems: fragment.items || [],
      transitionEnteringLines: [],
      transitionLeavingLines: [...lineItems(fragment.items).keys()]
    })));
    fragments.sort((left, right) => {
      const firstLine = fragment => Math.min(...[...lineItems(fragment.items).keys(),
        Number(fragment.focusLine)].filter(Number.isFinite));
      return firstLine(left) - firstLine(right);
    });
    return {
      ...nextPlan,
      fragments
    };
  }

  function showExpandedTransition(nextPage, nextPlan, syntaxLines, previous, nextFocusLine) {
    const oldAnchor = previous.querySelector(`[data-source-line="${currentFocusLine}"]`)
      || previous.querySelector('.asm-trace-code-line');
    const bodyRect = body.getBoundingClientRect();
    const oldAnchorY = oldAnchor ? oldAnchor.getBoundingClientRect().top - bodyRect.top : 0;
    const transitionPlan = selectiveTransitionPlan(currentPlan, nextPlan);
    const expandedPage = buildPage(transitionPlan, syntaxLines, true);
    const previousAnchor = expandedPage.querySelector(`[data-source-line="${currentFocusLine}"]`);
    const nextAnchor = expandedPage.querySelector(`[data-source-line="${nextFocusLine}"]`);
    if (!previousAnchor || !nextAnchor) return false;

    expandedPage.classList.add('is-transition-preparing');
    body.classList.add('is-switching');
    body.replaceChildren(expandedPage);
    const expandedBodyTop = body.getBoundingClientRect().top;
    const previousAnchorY = previousAnchor.getBoundingClientRect().top - expandedBodyTop;
    const initialOffset = oldAnchorY - previousAnchorY;
    const measuredPage = expandedPage.cloneNode(true);
    measuredPage.classList.add('is-transition-scrolling');
    measuredPage.style.position = 'absolute';
    measuredPage.style.top = '0';
    measuredPage.style.left = '0';
    measuredPage.style.visibility = 'hidden';
    measuredPage.style.transition = 'none';
    measuredPage.querySelectorAll('.is-transition-entering').forEach(line => {
      line.style.transition = 'none';
      line.style.maxHeight = '1.58em';
    });
    measuredPage.querySelectorAll('.is-transition-leaving').forEach(line => {
      line.style.transition = 'none';
      line.style.maxHeight = '1.58em';
    });
    body.append(measuredPage);
    const measuredAnchor = measuredPage.querySelector(`[data-source-line="${nextFocusLine}"]`);
    const targetAnchorY = measuredAnchor?.getBoundingClientRect().top - body.getBoundingClientRect().top;
    measuredPage.remove();
    if (!Number.isFinite(targetAnchorY)) {
      body.classList.remove('is-switching');
      return false;
    }
    // Measure the destination in its final, collapsed layout. Keeping this
    // offset after the expanded page is removed prevents a last-frame jump.
    nextPage.style.position = 'absolute';
    nextPage.style.top = '0';
    nextPage.style.left = '0';
    nextPage.style.visibility = 'hidden';
    body.append(nextPage);
    const finalAnchor = nextPage.querySelector(`[data-source-line="${nextFocusLine}"]`);
    const finalAnchorY = finalAnchor?.getBoundingClientRect().top - body.getBoundingClientRect().top;
    const finalPageHeight = nextPage.getBoundingClientRect().height;
    nextPage.remove();
    nextPage.style.removeProperty('position');
    nextPage.style.removeProperty('top');
    nextPage.style.removeProperty('left');
    nextPage.style.removeProperty('visibility');
    if (!Number.isFinite(finalAnchorY)) {
      body.classList.remove('is-switching');
      return false;
    }
    // The previous focus can sit below the new page's visible height. Park
    // the new focus near the top of the viewport instead of clipping it.
    const maximumHeight = parseFloat(window.getComputedStyle?.(body)?.maxHeight);
    const viewportHeight = Math.min(Number.isFinite(maximumHeight) ? maximumHeight
      : body.getBoundingClientRect().height, finalPageHeight + 18);
    const destinationY = Math.min(finalAnchorY, Math.max(12, viewportHeight * 0.32));
    const finalOffset = boundedScrollOffset(finalPageHeight + 18, viewportHeight,
      destinationY - finalAnchorY);
    const targetOffset = finalAnchorY + finalOffset - targetAnchorY;
    nextPage.style.transform = `translateY(${finalOffset}px)`;
    transitionFinalPage = nextPage;
    if (Math.abs(targetOffset - initialOffset) >= 1) body.classList.add('is-code-scrolling');
    expandedPage.style.transform = `translateY(${initialOffset}px)`;
    requestAnimationFrame(() => {
      expandedPage.classList.remove('is-transition-preparing');
      expandedPage.classList.add('is-transition-scrolling');
      expandedPage.style.transform = `translateY(${targetOffset}px)`;
    });
    scheduleTransition(finishPageTransition, CODE_TRANSITION_MS);
    return true;
  }

  function boundedScrollOffset(contentHeight, viewportHeight, proposedOffset) {
    return Math.max(Math.min(0, viewportHeight - contentHeight), Math.min(0, proposedOffset));
  }

  function focusNeedsScroll(nextFocusLine) {
    if (!body || !nextFocusLine) return false;
    const anchor = body.querySelector(`.asm-trace-code-page [data-source-line="${nextFocusLine}"]`);
    if (!anchor) return false;
    const viewport = body.getBoundingClientRect();
    const target = anchor.getBoundingClientRect();
    return target.top < viewport.top || target.bottom > viewport.bottom;
  }

  function showPage(nextPage, nextPlan, syntaxLines, animate) {
    finishPageTransition();
    const previous = body.querySelector('.asm-trace-code-page:not(.is-leaving)');
    const nextFocusLine = planFocusLine(nextPlan);
    const sameLayout = Boolean(currentPlan?.layoutKey && currentPlan.layoutKey === nextPlan.layoutKey);
    const sameFocus = currentFocusLine === nextFocusLine;
    const unchangedViewport = sameLayout && (sameFocus || !focusNeedsScroll(nextFocusLine));
    if (!previous || !animate || unchangedViewport
      || window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
      if (previous && animate && unchangedViewport) {
        nextPage.style.transform = previous.style.transform;
      }
      body.replaceChildren(nextPage);
      return;
    }
    if (showExpandedTransition(nextPage, nextPlan, syntaxLines, previous, nextFocusLine)) return;
    // A frame with no measurable source anchor has nothing to scroll toward.
    body.replaceChildren(nextPage);
  }

  function playbackEventIds(plan) {
    return new Set((plan?.phases || []).flatMap(phase => phase?.steps || [])
      .filter(step => step?.kind === 'trace-event' && step?.enabled !== false)
      .map(step => String(step?.eventId || ''))
      .filter(Boolean));
  }

  function transitionDelay(trace, frame) {
    if (!trace || !frame || !window.ASMTraceCodeModel || dragState) return 0;
    if (currentDocument !== trace || !currentFrame || currentFrame.id === frame.id) return 0;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return 0;
    const nextPlan = window.ASMTraceCodeModel.planFrame(trace, frame);
    const nextFocusLine = planFocusLine(nextPlan);
    // Recursive calls can remove an unrelated caller fragment while keeping
    // the exact same focused directive line. Let that code-page cleanup run
    // concurrently; it must not hold the recursion node motion for 500 ms.
    if (currentFocusLine === nextFocusLine) return 0;
    return currentPlan?.layoutKey && (currentPlan.layoutKey !== nextPlan.layoutKey
      || focusNeedsScroll(nextFocusLine))
      ? CODE_TRANSITION_MS
      : 0;
  }

  function renderFrame(trace, frame, playbackPlan = null) {
    ensurePanel();
    const wasPanelHidden = panel?.hidden !== false;
    const animate = Boolean(currentDocument === trace && currentFrame && currentFrame.id !== frame?.id && !dragState);
    const previousDocument = currentDocument;
    currentDocument = trace;
    applyStoredFontSize();
    activeEventId = '';
    startedEventIds = new Set();
    completedEventIds = new Set();
    currentEvents = new Map((frame?.events || []).map(event => [String(event?.id || ''), event]));
    scheduledEventIds = playbackEventIds(playbackPlan);
    if (!scheduledEventIds.size) {
      currentEvents.forEach((event, id) => {
        if (id && event?.type === 'condition') completedEventIds.add(id);
      });
    }
    eventNodes.clear();
    if (!panel || !body || !window.ASMTraceCodeModel) return;
    const plan = window.ASMTraceCodeModel.planFrame(trace, frame);
    const syntaxLines = syntaxForSource(plan.sourceCode);
    const fragments = plan.fragments || [];
    const nextFocusLine = planFocusLine(plan);
    showPage(buildPage(plan, syntaxLines), plan, syntaxLines, animate);
    currentFrame = frame;
    currentPlan = plan;
    currentFocusLine = nextFocusLine;
    panel.hidden = !fragments.length;
    if (panel.hidden) clearSelection();
    panel.closest('#canvasWrapper')?.classList.toggle('has-trace-code-panel', fragments.length > 0);
    applyEventClasses();
    if (previousDocument !== trace) panel.style.removeProperty('will-change');
    // The scrolling page temporarily expands before it collapses. Reapplying
    // a position normalized by the panel's *remaining* space during that
    // interval moves the whole code panel when only its contents should move.
    // Keep its pixel position across frames; recalculate on initial display,
    // an authored position change, or a viewport resize instead.
    if (!panel.hidden && (previousDocument !== trace || wasPanelHidden
      || appliedPositionKey !== storedPositionKey(trace))) applyStoredPosition();
    const liveEvent = document.querySelector('[data-trace-active-event-id]')?.dataset?.traceActiveEventId || '';
    if (liveEvent) setActiveEvent(liveEvent, 'start');
  }

  function safeInsetLeft() {
    ensurePanel();
    if (!panel || panel.hidden) return 0;
    const rect = panel.getBoundingClientRect();
    const wrapperRect = panel.parentElement?.getBoundingClientRect?.();
    if (!wrapperRect || rect.left - wrapperRect.left > wrapperRect.width * 0.42) return 0;
    return Math.max(0, rect.right - wrapperRect.left + 20);
  }

  function applyPresentationSettings(trace = currentDocument) {
    if (trace) currentDocument = trace;
    ensurePanel();
    applyStoredFontSize();
    requestAnimationFrame(applyStoredPosition);
  }

  window.addEventListener('resize', () => requestAnimationFrame(() => {
    applyStoredFontSize();
    applyStoredPosition();
  }));

  window.addEventListener('asm:trace-frame', event => {
    if (!event.detail?.document || !event.detail?.frame) return;
    renderFrame(event.detail.document, event.detail.frame, event.detail.plan || null);
  });

  window.addEventListener('asm:trace-active-event', event => {
    if (event.detail?.document !== currentDocument || event.detail?.frame !== currentFrame) return;
    setActiveEvent(event.detail?.event?.id || '', event.detail?.phase || 'start');
  });

  window.addEventListener('asm:trace-event-availability-changed', event => {
    if (event.detail?.document !== currentDocument
      || event.detail?.frameId !== currentFrame?.id) return;
    // Availability is measured from the rendered canvas after renderFrame.
    // Refresh in the same frame so a canceled comparison cannot color code.
    applyEventClasses();
  });

  window.addEventListener('asm:trace-playback-plan-complete', event => {
    if (event.detail?.document !== currentDocument || event.detail?.frame !== currentFrame) return;
    (currentFrame?.events || []).forEach(item => {
      const id = String(item?.id || '');
      if (id && (item?.type === 'condition' || scheduledEventIds.has(id))) completedEventIds.add(id);
    });
    activeEventId = '';
    applyEventClasses();
  });

  window.ASMTraceCodePresenter = {
    renderFrame,
    setActiveEvent,
    transitionDelay,
    transitionPlan: selectiveTransitionPlan,
    visualStateForIds,
    safeInsetLeft,
    normalizeFontSize,
    scaledFontSize,
    boundedScrollOffset,
    scrollDuration: CODE_SCROLL_MS,
    applyPresentationSettings,
    clearSelection,
    getPanel: () => ensurePanel()
  };
})();
