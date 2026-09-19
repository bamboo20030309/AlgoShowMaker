(function () {
  let activeRun = 0;
  let finishActiveRun = null;
  const markerEntrancesByFrame = new Map();

  const COMPARE_COLORS = Object.freeze({
    true: 'rgb(165, 214, 167)',
    false: 'rgb(239, 154, 154)'
  });
  const COMPARE_TIMING = Object.freeze({ popup: 180, wait: 400, size: 300, result: 420, reset: 260 });
  const COMPARE_DURATION = Object.values(COMPARE_TIMING).reduce((sum, value) => sum + value, 0);
  const COMPARE_SCALE_DELTA = 0.14;
  const ASSIGN_TIMING = Object.freeze({ frame: 160, valueHold: 500, drop: 500, hold: 500, exit: 100 });
  const GENERIC_EVENT_DURATION = Object.freeze({ lift: 340, pulse: 400, fade: 440, code: 400 });
  const APPEAR_TIMING = Object.freeze({ duration: 220, offsetY: -16 });
  const MARKER_REFLOW_TIMING = Object.freeze({ duration: 180, entranceDelay: 80 });
  const EXIT_OFFSET_Y = -16;
  const EVENT_CODE_PROMPT_DURATION = 400;
  const SEQUENCE_TIMING = Object.freeze({ duration: 440, travel: 48 });

  function sequenceEdge(operation) {
    return /(?:_front|^push_front$|^pop_front$)/.test(String(operation || ''))
      ? 'front' : 'back';
  }

  function sequenceCellKeys(document, frame, event, inserted = true) {
    const target = (event?.targets || []).find(item => item.role === 'target')
      || event?.targets?.[0];
    if (!target?.variableId) return [];
    const before = Number(event?.payload?.beforeSize);
    const after = Number(event?.payload?.afterSize);
    if (!Number.isInteger(before) || !Number.isInteger(after)
      || before < 0 || after < 0) return [];
    const delta = inserted ? after - before : before - after;
    if (delta <= 0) return [];
    const first = sequenceEdge(event.operation) === 'front'
      ? 0 : (inserted ? before : after);
    const objectKey = eventTargetKey(document, frame, target);
    return Array.from({ length: delta }, (_, offset) => `${objectKey}#${first + offset}`);
  }

  function visualLifecycleKind(element) {
    if (element?.matches?.('.asm-trace-text-object')
      || element?.closest?.('.asm-trace-text-object')) return 'text';
    if (element?.dataset?.traceSourceVariableId
      || element?.querySelector?.('.trace-variable-marker-point')) return 'marker';
    if (element?.matches?.('[data-trace-lifecycle-kind="array"]')
      || element?.closest?.('[data-trace-lifecycle-kind="array"]')) return 'array';
    return 'object';
  }

  function visualLifecycleOffsetY(kind, phase, progress) {
    const normalized = clamp01(progress);
    if (kind === 'text' || kind === 'array' || kind === 'keep-snapshot') return 0;
    const offset = phase === 'enter'
      ? APPEAR_TIMING.offsetY * (1 - normalized)
      : phase === 'exit'
        ? (kind === 'marker' ? EXIT_OFFSET_Y : 0) * normalized
        : phase === 'removed'
          ? (kind === 'marker' ? EXIT_OFFSET_Y : -15) * normalized
          : 0;
    if (Math.abs(offset) < 0.001) return 0;
    return offset;
  }

  function assignmentEffectDuration(markerAssignment = false) {
    return ASSIGN_TIMING.frame
      + (markerAssignment ? ASSIGN_TIMING.valueHold : 0)
      + ASSIGN_TIMING.drop + ASSIGN_TIMING.hold + ASSIGN_TIMING.exit;
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function parseColor(value, alpha = 1) {
    if (!value) return null;
    const source = String(value).trim().toLowerCase();
    const rgba = source.match(/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/);
    if (rgba) return { r: +rgba[1], g: +rgba[2], b: +rgba[3], a: +rgba[4] };
    const rgb = source.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
    if (rgb) return { r: +rgb[1], g: +rgb[2], b: +rgb[3], a: alpha };
    const hex = source.match(/^#([\da-f]{3}|[\da-f]{6})$/i);
    if (hex) {
      const value6 = hex[1].length === 3
        ? hex[1].split('').map(character => character + character).join('')
        : hex[1];
      return {
        r: parseInt(value6.slice(0, 2), 16),
        g: parseInt(value6.slice(2, 4), 16),
        b: parseInt(value6.slice(4, 6), 16),
        a: alpha
      };
    }
    const context = parseColor.context
      || (parseColor.context = document.createElement('canvas').getContext('2d'));
    if (!context) return null;
    // Canvas retains its previous fillStyle when given an invalid SVG paint
    // such as "none". Probe with two distinct sentinels so an unreadable
    // paint cannot silently become black during a style transition.
    context.fillStyle = '#010203';
    context.fillStyle = source;
    const first = context.fillStyle;
    context.fillStyle = '#040506';
    context.fillStyle = source;
    const second = context.fillStyle;
    return first === second ? parseColor(first, alpha) : null;
  }

  function paintTransitionColors(before, after) {
    const fromNone = String(before?.fill || '').trim().toLowerCase() === 'none';
    const toNone = String(after?.fill || '').trim().toLowerCase() === 'none';
    const from = fromNone ? null : parseColor(before?.fill, before?.opacity);
    const to = toNone ? null : parseColor(after?.fill, after?.opacity);
    if (fromNone && to) return [{ ...to, a: 0 }, to];
    if (toNone && from) return [from, { ...from, a: 0 }];
    return from && to ? [from, to] : null;
  }

  function interpolateColor(from, to, t) {
    return {
      r: Math.round(from.r + (to.r - from.r) * t),
      g: Math.round(from.g + (to.g - from.g) * t),
      b: Math.round(from.b + (to.b - from.b) * t),
      a: from.a + (to.a - from.a) * t
    };
  }

  function rectKey(rect, index, fallbackKey = '$object') {
    const owner = rect.closest?.('[data-trace-object-key]');
    const ownerKey = owner?.dataset?.traceObjectKey || fallbackKey;
    return `${ownerKey}|${rect.getAttribute('data-av-key') || index}`;
  }

  function rectStates(element, fallbackKey = '$object') {
    const states = new Map();
    [...(element?.querySelectorAll?.('rect') || [])].forEach((rect, index) => {
      const opacity = rect.hasAttribute('fill-opacity')
        ? Number(rect.getAttribute('fill-opacity'))
        : 1;
      states.set(rectKey(rect, index, fallbackKey), {
        fill: rect.getAttribute('fill') || '',
        opacity: Number.isFinite(opacity) ? opacity : 1,
        stroke: rect.getAttribute('stroke'),
        strokeOpacity: rect.getAttribute('stroke-opacity'),
        strokeWidth: rect.getAttribute('stroke-width'),
        rx: rect.getAttribute('rx'),
        ry: rect.getAttribute('ry')
      });
    });
    return states;
  }

  function previousVisualElement(previousObjects, sourceKey) {
    if (!sourceKey) return null;
    for (const [topKey, object] of previousObjects || []) {
      if (sourceKey === topKey) return object;
      if (!sourceKey.startsWith(`${topKey}#`) && !sourceKey.startsWith(`${topKey}:`)) continue;
      const child = object.querySelector?.(
        `[data-trace-object-key="${CSS.escape(sourceKey)}"]`
      );
      if (child) return child;
    }
    return null;
  }

  function markerActivationChanged(current, previous) {
    if (!current?.dataset?.traceSourceVariableId || !previous) return false;
    const currentContinuity = String(current.dataset.traceVisualContinuityKey || '');
    const previousContinuity = String(previous.dataset?.traceVisualContinuityKey || '');
    if (currentContinuity && currentContinuity === previousContinuity) return false;
    const currentIdentity = String(current.dataset.traceRuntimeIdentity || '');
    const previousIdentity = String(previous.dataset?.traceRuntimeIdentity || '');
    return Boolean(currentIdentity && previousIdentity && currentIdentity !== previousIdentity);
  }

  function retainedVisualOwner(element) {
    if (!element) return '';
    const explicitOwner = String(element.dataset?.traceSnapshotOwner || '');
    if (explicitOwner) return `owner:${explicitOwner}`;
    const host = element.matches?.('[data-trace-snapshot]')
      ? element
      : element.closest?.('[data-trace-snapshot]');
    const snapshotId = String(host?.dataset?.traceSnapshot || '');
    return snapshotId ? `snapshot:${snapshotId}` : '';
  }

  function sameVisualDomain(current, previous) {
    if (!current || !previous) return true;
    const currentOwner = retainedVisualOwner(current);
    const previousOwner = retainedVisualOwner(previous);
    // A retained @keep visual and the following live scene are different
    // visual lifetimes even when an older saved trace has no sceneGeneration.
    // Snapshot-to-snapshot continuity is valid only inside the same owner.
    if (currentOwner || previousOwner) return currentOwner === previousOwner;
    return true;
  }

  function sameSceneGeneration(current, previous) {
    if (!sameVisualDomain(current, previous)) return false;
    const currentGeneration = Number(current?.dataset?.traceSceneGeneration);
    const previousGeneration = Number(previous?.dataset?.traceSceneGeneration);
    return !Number.isFinite(currentGeneration)
      || !Number.isFinite(previousGeneration)
      || currentGeneration === previousGeneration;
  }

  function previousVisualByContinuity(
    previousObjects, continuityKey, preferredKey = '', currentElement = null
  ) {
    if (!continuityKey) return null;
    const preferred = previousVisualElement(previousObjects, preferredKey);
    if (String(preferred?.dataset?.traceVisualContinuityKey || '') === continuityKey
      && sameSceneGeneration(currentElement, preferred)) {
      return { key: preferredKey, element: preferred };
    }
    for (const [topKey, object] of previousObjects || []) {
      const candidates = [
        object,
        ...(object?.querySelectorAll?.('[data-trace-visual-continuity-key]') || [])
      ];
      const element = candidates.find(candidate => (
        String(candidate?.dataset?.traceVisualContinuityKey || '') === continuityKey
        && sameSceneGeneration(currentElement, candidate)
      ));
      if (!element) continue;
      return {
        key: String(element.dataset?.traceObjectKey || '') || topKey,
        element
      };
    }
    return null;
  }

  function previousVisualForEntry(element, previousObjects, preferredKey = '') {
    const continuityKey = String(element?.dataset?.traceVisualContinuityKey || '');
    if (element?.dataset?.traceSourceVariableId && continuityKey) {
      const match = previousVisualByContinuity(
        previousObjects, continuityKey, preferredKey, element
      );
      if (match?.element) return match.element;
    }
    const fallback = previousVisualElement(previousObjects, preferredKey);
    if (element?.dataset?.traceSourceVariableId
      && !sameSceneGeneration(element, fallback)) return null;
    return fallback;
  }

  function markerContinuationFor(element, key, previousPlacements, previousObjects) {
    if (!element?.dataset?.traceSourceVariableId) return null;
    const continuityKey = String(element.dataset.traceVisualContinuityKey || '');
    if (!continuityKey) return null;
    const match = previousVisualByContinuity(previousObjects, continuityKey, key, element);
    if (!match?.element) return null;
    const placement = previousPlacements?.get?.(match.key)
      || previousPlacements?.get?.(key);
    if (!placement) return null;
    return { ...match, placement };
  }

  function markerNeedsEntrance({
    element, key, previousPlacements, previousObjects,
    currentAutomaticMarkers = new Set(), previousAutomaticMarkers = new Set(), eventFrame = null
  } = {}) {
    if (!element?.dataset?.traceSourceVariableId) return false;
    if (markerDeclaredInFrame(eventFrame, element)) return true;
    const continuation = markerContinuationFor(
      element, key, previousPlacements, previousObjects
    );
    const directPrevious = previousVisualElement(previousObjects, key);
    const previousVisual = continuation?.element
      || (sameSceneGeneration(element, directPrevious) ? directPrevious : null);
    const sourceExists = Boolean(continuation
      || (previousVisual && previousPlacements?.has?.(key)));
    const automaticMarkerAppeared = currentAutomaticMarkers.has(key)
      && !previousAutomaticMarkers.has(key)
      && !continuation;
    return !sourceExists
      || automaticMarkerAppeared
      || markerActivationChanged(element, previousVisual);
  }

  function markerTargetBeforeFrameEvents(traceDocument, eventFrame, element) {
    const currentTarget = String(element?.dataset?.traceBindingTarget || '');
    const currentParts = markerTargetParts(currentTarget);
    if (!currentParts) return currentTarget;
    const sourceVariableIds = markerSourceVariableIds(element);
    if (!sourceVariableIds.length) return currentTarget;
    let startsUnresolved = false;
    for (const event of orderedEvents(eventFrame)) {
      const target = (event?.targets || []).find(candidate => (
        candidate?.role !== 'source'
        && sourceVariableIds.includes(candidate?.variableId)
        && eventMutatesVariable(event, candidate?.variableId)
      ));
      if (!target) continue;
      const beforeValue = displayEventValue(event?.payload?.before);
      const initialValue = beforeValue === '' && isDeclarationInitializerAssignment(event)
        ? displayEventValue(event?.payload?.after)
        : beforeValue;
      if (initialValue === '') {
        startsUnresolved = true;
        continue;
      }
      const variableName = traceDocument?.variables?.[target.variableId]?.name;
      const locals = variableName ? { [variableName]: initialValue } : {};
      const expression = String(
        element.dataset.traceMarkerIndexExpression
        || element.dataset.traceMarkerSortKey
        || ''
      );
      const rawResolved = window.ASMTraceRules?.resolveExpression?.(
        traceDocument, eventFrame, expression, locals
      );
      const resolved = rawResolved == null ? NaN : Number(rawResolved);
      if (Number.isInteger(resolved)) return `${currentParts.prefix}#${resolved}`;
    }
    if (startsUnresolved) return `unresolved:${currentParts.prefix}`;
    return currentTarget;
  }

  function markerGroupReflowDuration({
    enteringMarkerKeys = new Set(), currentElements, previousPlacements, currentPlacements,
    previousObjects, transitionForKey, duration, reflowKeys, traceDocument, eventFrame
  } = {}) {
    const enteringTargets = new Set();
    enteringMarkerKeys.forEach(key => {
      const target = markerTargetBeforeFrameEvents(
        traceDocument, eventFrame, currentElements?.get?.(key)
      );
      if (target) enteringTargets.add(target);
    });
    if (!enteringTargets.size) return 0;

    let hasReflow = false;
    currentElements?.forEach?.((element, key) => {
      if (!element?.dataset?.traceSourceVariableId
        || enteringMarkerKeys.has(key)) return;
      const target = markerTargetBeforeFrameEvents(traceDocument, eventFrame, element);
      if (!target || !enteringTargets.has(target)) return;
      const continuation = markerContinuationFor(element, key, previousPlacements, previousObjects);
      const previousVisual = continuation?.element || previousVisualElement(previousObjects, key);
      if (target.startsWith('unresolved:')) {
        if (previousVisual?.dataset?.traceMarkerUnresolved !== '1') return;
        const parts = markerTargetParts(String(element.dataset.traceBindingTarget || ''));
        if (!parts || `unresolved:${parts.prefix}` !== target) return;
      } else if (String(previousVisual?.dataset?.traceBindingTarget || '') !== target) return;
      const before = continuation?.placement || previousPlacements?.get?.(key);
      if (!before) return;
      const currentTarget = String(element.dataset.traceBindingTarget || '');
      const after = currentPlacements?.get?.(key);
      const moved = currentTarget !== target || Boolean(after && (
        Math.abs((Number(before.x) || 0) - (Number(after.x) || 0)) > 0.1
        || Math.abs((Number(before.y) || 0) - (Number(after.y) || 0)) > 0.1
      ));
      if (!moved) return;
      const transition = transitionForKey?.(key) || {};
      const mode = transition.requestedMode || transition.mode || 'move';
      if (mode === 'instant' || mode === 'fade') return;
      reflowKeys?.add?.(key);
      hasReflow = true;
    });
    return hasReflow ? MARKER_REFLOW_TIMING.duration : 0;
  }

  function markerFrameMotionDelay(key, swapStart, eventDelay, reflowKeys) {
    if (reflowKeys?.has?.(key)) return 0;
    return Math.max(Number(swapStart) || 0, Number(eventDelay) || 0);
  }

  function recursiveMarkerTransitionSteps({
    previousPlacements, currentPlacements, previousObjects, currentElements,
    transitionForKey, duration, eventControlledKeys = new Set()
  } = {}) {
    const steps = [];
    currentElements?.forEach?.((element, key) => {
      const continuityKey = String(element?.dataset?.traceVisualContinuityKey || '');
      const currentIdentity = String(element?.dataset?.traceRuntimeIdentity || '');
      if (!continuityKey || !currentIdentity || eventControlledKeys.has(key)) return;
      const previousMatch = previousVisualByContinuity(
        previousObjects, continuityKey, key, element
      );
      const previousIdentity = String(previousMatch?.element?.dataset?.traceRuntimeIdentity || '');
      if (!previousIdentity || previousIdentity === currentIdentity) return;
      const beforePlacement = previousPlacements?.get?.(previousMatch.key)
        || previousPlacements?.get?.(key);
      const afterPlacement = currentPlacements?.get?.(key);
      if (!beforePlacement || !afterPlacement) return;
      const before = motionPosition(previousMatch.element, beforePlacement);
      const after = motionPosition(element, afterPlacement);
      if (![before?.x, before?.y, after?.x, after?.y].every(Number.isFinite)) return;
      if (Math.abs(before.x - after.x) < 0.1 && Math.abs(before.y - after.y) < 0.1) return;
      const transition = transitionForKey?.(key) || {};
      const mode = transition.requestedMode || transition.mode || 'move';
      if (mode === 'instant' || mode === 'fade') return;
      steps.push({
        id: `recursive-marker-move:${continuityKey}`,
        kind: 'object-transition',
        subtype: 'recursive-marker-move',
        targetKey: key,
        sourceKey: previousMatch.key,
        visualContinuityKey: continuityKey,
        from: { x: before.x, y: before.y },
        to: { x: after.x, y: after.y },
        durationMs: Math.max(1, Number(transition.duration) || Number(duration) || 520),
        easing: String(transition.easing || 'smooth'),
        blocking: true,
        enabled: true,
        source: 'automatic'
      });
    });
    return steps;
  }

  function swapContainerPlacementTransitionSteps({
    eventFrame, previousPlacements, currentPlacements,
    previousObjects, currentElements, transitionForKey, duration = 520
  } = {}) {
    const containerKeys = new Set();
    orderedEvents(eventFrame).filter(event => (
      event?.type === 'swap'
      && event.enabled !== false
      && event.autoAnimationDisabled !== true
    )).forEach(event => {
      (event.targets || []).forEach(target => {
        if (!target?.variableId) return;
        containerKeys.add(objectKeyForVariable(eventFrame, target.variableId));
      });
    });
    if (!containerKeys.size) return [];

    const identityKeys = previousKeysByRuntimeIdentity(previousObjects);
    const steps = [];
    containerKeys.forEach(key => {
      const element = currentElements?.get?.(key);
      const current = currentPlacements?.get?.(key);
      if (!element || !current) return;
      const transition = transitionForKey?.(key) || {};
      const requestedSourceKey = transition.sourceKey || key;
      const sourceKey = previousAliasKey(
        requestedSourceKey, key, element, previousPlacements, identityKeys
      );
      const previous = previousPlacements?.get?.(sourceKey);
      if (!previous) return;
      const mode = transition.requestedMode || transition.mode || 'move';
      if (mode === 'instant' || mode === 'fade') return;
      const dx = (Number(previous.x) || 0) - (Number(current.x) || 0);
      const dy = (Number(previous.y) || 0) - (Number(current.y) || 0);
      if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) return;
      steps.push({
        id: `swap-container-settle:${key}`,
        kind: 'object-transition',
        subtype: 'swap-container-settle',
        targetKey: key,
        sourceKey,
        from: { x: Number(previous.x) || 0, y: Number(previous.y) || 0 },
        to: { x: Number(current.x) || 0, y: Number(current.y) || 0 },
        durationMs: Math.max(1, Number(transition.duration) || Number(duration) || 520),
        easing: String(transition.easing || 'smooth'),
        blocking: true,
        enabled: true,
        source: 'automatic'
      });
    });
    return steps;
  }

  function createPlaybackPlan({
    frame, direction, runId = 0, transitionSteps = [], enteringMarkerKeys = [], eventTimeline = [],
    initialDelayMs = 0, keepTransitionKeys = [], keepTransitionDurationMs = 0,
    cameraTransitionDurationMs = 0
  } = {}) {
    const initialDelay = Math.max(0, Number(initialDelayMs) || 0);
    const preKeepSlots = eventTimeline.filter(slot => slot?.event?.preKeepExit === true);
    const regularSlots = eventTimeline.filter(slot => slot?.event?.preKeepExit !== true);
    const preKeepEnd = preKeepSlots.reduce(
      (end, slot) => Math.max(end, Number(slot.end) || 0), initialDelay
    );
    const preKeepDuration = Math.max(0, preKeepEnd - initialDelay);
    const keepTargets = [...new Set(keepTransitionKeys)].filter(Boolean);
    const keepMotionDuration = keepTargets.length
      ? Math.max(0, Number(keepTransitionDurationMs) || 0)
      : 0;
    const enabledTransitions = transitionSteps.filter(step => step?.enabled !== false);
    const transitionDuration = enabledTransitions.reduce((end, step) => (
      step.blocking === false ? end : Math.max(end, Number(step.durationMs) || 0)
    ), 0);
    const cameraDuration = Math.max(0, Number(cameraTransitionDurationMs) || 0);
    // A keep frame fades retained snapshots into their final positions while
    // the new live layout and camera settle concurrently. Marker entrances
    // and trace events wait for the slowest part.
    const keepDuration = keepTargets.length
      ? Math.max(keepMotionDuration, transitionDuration, cameraDuration)
      : 0;
    const entranceTargets = [...new Set(enteringMarkerKeys)].filter(Boolean);
    const entranceDuration = entranceTargets.length ? APPEAR_TIMING.duration : 0;
    const markerReflowActive = entranceTargets.length > 0 && enabledTransitions.some(step => (
      step?.subtype === 'marker-group-reflow' && Number(step?.durationMs) > 0
    ));
    const entranceLead = markerReflowActive ? MARKER_REFLOW_TIMING.entranceDelay : 0;
    // Existing markers start making room first. The entering marker joins a
    // moment later, while the reflow is still running, and events wait for
    // both overlapping phases to complete.
    const frameTransitionStart = preKeepEnd;
    const entranceStart = frameTransitionStart + Math.max(keepDuration, entranceLead);
    const scheduledEventStart = regularSlots.length
      ? Math.min(...regularSlots.map(slot => Number(slot.promptStart ?? slot.start) || 0))
      : 0;
    const eventStart = Math.max(
      frameTransitionStart + transitionDuration,
      entranceStart + entranceDuration,
      scheduledEventStart
    );
    const timelineStep = slot => {
      const promptStart = Number(slot.promptStart ?? slot.start) || 0;
      const visualStart = Number(slot.visualStart ?? slot.start) || 0;
      const end = Number(slot.end) || 0;
      return {
        id: `trace-event:${slot.event?.id || slot.event?.order || visualStart}`,
        kind: 'trace-event',
        subtype: String(slot.animation || slot.type || ''),
        eventId: String(slot.event?.id || ''),
        eventType: String(slot.type || slot.event?.type || ''),
        eventOrder: Number(slot.event?.order),
        startMs: promptStart,
        codePromptDurationMs: Math.max(0, visualStart - promptStart),
        visualStartMs: visualStart,
        visualDurationMs: Math.max(0, Number(slot.duration) || 0),
        durationMs: Math.max(0, end - promptStart),
        endMs: end,
        blocking: true,
        enabled: true
      };
    };
    const preKeepSteps = preKeepSlots.map(timelineStep);
    const eventSteps = regularSlots.map(timelineStep);
    const eventEnd = regularSlots.reduce(
      (end, slot) => Math.max(end, Number(slot.end) || 0), eventStart
    );
    return {
      version: 1,
      id: `frame-playback:${frame?.id || 'unknown'}:${runId}`,
      frameId: String(frame?.id || ''),
      direction: Number(direction) || 0,
      preEventDurationMs: eventStart,
      totalDurationMs: Math.max(preKeepEnd, eventStart, eventEnd),
      phases: [
        ...(initialDelay ? [{
          id: 'code-transition',
          mode: 'sequence',
          startMs: 0,
          durationMs: initialDelay,
          steps: [{
            id: 'code-panel-jump',
            kind: 'code-transition',
            durationMs: initialDelay,
            blocking: true,
            enabled: true,
            source: 'automatic'
          }]
        }] : []),
        ...(preKeepDuration ? [{
          id: 'pre-keep-exit',
          mode: 'sequence',
          startMs: initialDelay,
          durationMs: preKeepDuration,
          steps: preKeepSteps
        }] : []),
        ...(keepDuration ? [{
          id: 'keep-transition',
          mode: 'parallel',
          startMs: frameTransitionStart,
          durationMs: keepDuration,
          steps: [{
            id: 'keep-snapshot-enter',
            kind: 'keep-transition',
            subtype: 'in-place-fade',
            targetKeys: keepTargets,
            durationMs: keepMotionDuration,
            blocking: true,
            enabled: true,
            source: 'automatic'
          }, ...(cameraDuration ? [{
            id: 'keep-camera-move',
            kind: 'camera-transition',
            targetKeys: ['$camera'],
            durationMs: cameraDuration,
            blocking: true,
            enabled: true,
            source: 'automatic'
          }] : [])]
        }] : []),
        {
          id: 'frame-transition',
          mode: 'parallel',
          startMs: frameTransitionStart,
          durationMs: transitionDuration,
          steps: enabledTransitions
        },
        {
          id: 'object-entrance',
          mode: 'parallel',
          startMs: entranceStart,
          durationMs: entranceDuration,
          steps: entranceTargets.map(targetKey => ({
            id: `marker-enter:${targetKey}`,
            kind: 'object-entrance',
            subtype: 'marker-enter',
            targetKey,
            durationMs: APPEAR_TIMING.duration,
            blocking: true,
            enabled: true,
            source: 'automatic'
          }))
        },
        {
          id: 'trace-events',
          mode: 'sequence',
          startMs: eventStart,
          durationMs: Math.max(0, eventEnd - eventStart),
          steps: eventSteps
        }
      ]
    };
  }

  function playbackPhaseAt(plan, elapsed) {
    return plan?.phases?.find(phase => (
      Number(phase.durationMs) > 0
      && elapsed >= Number(phase.startMs)
      && elapsed < Number(phase.startMs) + Number(phase.durationMs)
    ))?.id || '';
  }

  function addedKeepSnapshots(traceDocument, previousFrame, frame, direction = 1) {
    if (Number(direction) <= 0 || !previousFrame || !frame) return [];
    const previousIds = new Set(previousFrame.snapshotIds || []);
    const snapshotsById = new Map((traceDocument?.snapshots || []).map(snapshot => [snapshot.id, snapshot]));
    return (frame.snapshotIds || []).filter(id => !previousIds.has(id)).map(id => {
      const snapshot = snapshotsById.get(id);
      return {
        id: String(id),
        key: String(snapshot?.objectId || snapshot?.id || id),
        snapshot
      };
    });
  }

  function keepSnapshotSourceKeys(snapshot) {
    if (!snapshot) return [];
    if (snapshot.kind !== 'frame') {
      const variableId = String(snapshot.sourceVariableId || '');
      return variableId ? [objectKeyForVariable(snapshot.frame, variableId), variableId] : [];
    }
    const sourceFrame = snapshot.frame || {};
    const variableIds = Object.keys(sourceFrame.state || {});
    const primary = String(sourceFrame.source?.primaryVariableId || '');
    if (primary && variableIds.includes(primary)) {
      variableIds.splice(variableIds.indexOf(primary), 1);
      variableIds.unshift(primary);
    }
    return variableIds.flatMap(variableId => [objectKeyForVariable(sourceFrame, variableId), variableId]);
  }

  function keepSnapshotHandoffSources(keepSnapshots, previousPlacements) {
    const sources = new Map();
    keepSnapshots.forEach(({ key, snapshot }) => {
      const sourceKey = keepSnapshotSourceKeys(snapshot)
        .find(candidate => previousPlacements?.has?.(candidate));
      if (sourceKey) sources.set(key, sourceKey);
    });
    return sources;
  }

  function previousVisualRetainedByEnteringKeep(
    key, element, sourceKeys = new Set(), runtimeIdentities = new Set()
  ) {
    const runtimeIdentity = String(element?.dataset?.traceRuntimeIdentity || '');
    return sourceKeys.has(String(key || ''))
      || Boolean(runtimeIdentity && runtimeIdentities.has(runtimeIdentity));
  }

  const PRESENTATION_HINT_SELECTOR = '.highlight-blink, .arrow-bounce';

  function removePresentationHints(element) {
    element?.querySelectorAll?.(PRESENTATION_HINT_SELECTOR).forEach(hint => hint.remove());
  }

  function syncPresentationHints(element) {
    if (!element) return;
    const hints = [];
    if (element.matches?.(PRESENTATION_HINT_SELECTOR)) hints.push(element);
    hints.push(...(element.querySelectorAll?.(PRESENTATION_HINT_SELECTOR) || []));
    hints.forEach(hint => window.HintWidgets?.continuePresentationLoop?.(
      hint,
      hint.dataset?.tracePresentationId || ''
    ));
  }

  function clonePresentationHints(element) {
    if (!element?.querySelector?.(PRESENTATION_HINT_SELECTOR)) return null;
    const overlay = element.cloneNode(true);
    removeAnimationNodes(overlay);
    [...overlay.querySelectorAll('*')].reverse().forEach(node => {
      if (node.matches?.(PRESENTATION_HINT_SELECTOR)
        || node.querySelector?.(PRESENTATION_HINT_SELECTOR)) return;
      node.remove();
    });
    [overlay, ...overlay.querySelectorAll('[id]')].forEach(node => node.removeAttribute?.('id'));
    [overlay, ...overlay.querySelectorAll('[data-trace-object-key]')].forEach(node => {
      node.removeAttribute?.('data-trace-object-key');
      node.removeAttribute?.('data-trace-object-id');
    });
    syncPresentationHints(overlay);
    overlay.classList.add('asm-trace-presentation-overlay');
    overlay.setAttribute('pointer-events', 'none');
    return overlay;
  }

  function alignedRectStates(source, target, fallbackKey = '$object') {
    const states = new Map();
    const sourceRects = [...(source?.querySelectorAll?.('rect') || [])];
    const targetRects = [...(target?.querySelectorAll?.('rect') || [])];
    targetRects.forEach((rect, index) => {
      const sourceRect = sourceRects[index];
      if (!sourceRect) return;
      const opacity = sourceRect.hasAttribute('fill-opacity')
        ? Number(sourceRect.getAttribute('fill-opacity'))
        : 1;
      states.set(rectKey(rect, index, fallbackKey), {
        fill: sourceRect.getAttribute('fill') || '',
        opacity: Number.isFinite(opacity) ? opacity : 1,
        stroke: sourceRect.getAttribute('stroke'),
        strokeOpacity: sourceRect.getAttribute('stroke-opacity'),
        strokeWidth: sourceRect.getAttribute('stroke-width'),
        rx: sourceRect.getAttribute('rx'),
        ry: sourceRect.getAttribute('ry')
      });
    });
    return states;
  }

  function alignedDirectRectGeometry(source, target) {
    const sourceRects = [...(source?.children || [])].filter(child => (
      child?.tagName?.toLowerCase?.() === 'rect'
    ));
    const targetRects = [...(target?.children || [])].filter(child => (
      child?.tagName?.toLowerCase?.() === 'rect'
    ));
    const sourceTexts = [...(source?.children || [])].filter(child => (
      child?.tagName?.toLowerCase?.() === 'text'
    ));
    const targetTexts = [...(target?.children || [])].filter(child => (
      child?.tagName?.toLowerCase?.() === 'text'
    ));
    return targetRects.map((rect, index) => {
      const previous = sourceRects[index];
      const text = targetTexts[index] || null;
      const previousText = sourceTexts[index] || null;
      const number = (element, attribute) => Number(element?.getAttribute?.(attribute));
      const after = {
        x: number(rect, 'x'), y: number(rect, 'y'),
        width: number(rect, 'width'), height: number(rect, 'height')
      };
      const before = {
        x: number(previous, 'x'), y: number(previous, 'y'),
        width: number(previous, 'width'), height: number(previous, 'height')
      };
      if (!previous || [...Object.values(before), ...Object.values(after)].some(value => (
        !Number.isFinite(value)
      ))) return null;
      const beforeFontSize = number(previousText, 'font-size');
      const afterFontSize = number(text, 'font-size');
      return {
        rect, text, before, after,
        beforeFontSize: Number.isFinite(beforeFontSize) ? beforeFontSize : null,
        afterFontSize: Number.isFinite(afterFontSize) ? afterFontSize : null
      };
    }).filter(Boolean);
  }

  function applyLeftAnchoredRectGeometry(geometry, progress) {
    const t = clamp01(progress);
    (geometry || []).forEach(({
      rect, text, before, after, beforeFontSize, afterFontSize
    }) => {
      const width = before.width + (after.width - before.width) * t;
      const height = before.height + (after.height - before.height) * t;
      // The container translation already carries the old left edge into the
      // resized layout. Keep the authored target origin fixed so the cell
      // follows the outerframe while its new width opens to the right.
      rect.setAttribute('x', String(after.x));
      rect.setAttribute('y', String(after.y));
      rect.setAttribute('width', String(width));
      rect.setAttribute('height', String(height));
      if (!text) return;
      text.setAttribute('x', String(after.x + width / 2));
      text.setAttribute('y', String(after.y + height / 2));
      if (beforeFontSize !== null && afterFontSize !== null) {
        text.setAttribute('font-size', String(
          beforeFontSize + (afterFontSize - beforeFontSize) * t
        ));
      }
    });
  }

  function applyRectState(rect, state) {
    if (!rect || !state) return;
    if (state.fill) rect.setAttribute('fill', state.fill);
    else rect.removeAttribute('fill');
    rect.setAttribute('fill-opacity', String(state.opacity));
    [
      ['stroke', state.stroke],
      ['stroke-opacity', state.strokeOpacity],
      ['stroke-width', state.strokeWidth],
      ['rx', state.rx],
      ['ry', state.ry]
    ].forEach(([attribute, value]) => {
      if (value == null) rect.removeAttribute(attribute);
      else rect.setAttribute(attribute, value);
    });
  }

  function topLevelKey(element, root) {
    let current = element;
    let key = element?.dataset?.traceObjectKey || '';
    while (current?.parentElement && current.parentElement !== root) {
      const parentObject = current.parentElement.closest?.('[data-trace-object-key]');
      if (!parentObject || !root.contains(parentObject)) break;
      current = parentObject;
      key = current.dataset.traceObjectKey || key;
    }
    return key;
  }

  function parentObjectKey(element, root) {
    const parent = element?.parentElement?.closest?.('[data-trace-object-key]');
    return parent && root.contains(parent) ? parent.dataset.traceObjectKey || '' : '';
  }

  function motionPosition(element, fallback) {
    const space = element?.getAttribute?.('data-trace-position-space');
    if (space !== 'origin' && space !== 'bounds') return fallback;
    const x = Number(element.getAttribute('data-trace-position-x'));
    const y = Number(element.getAttribute('data-trace-position-y'));
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : fallback;
  }

  function relativeMotionDelta(own, parent, options = {}) {
    if (options.lockToTarget || options.inheritParentMotion) return { x: 0, y: 0 };
    return {
      x: (Number(own?.x) || 0) - (Number(parent?.x) || 0),
      y: (Number(own?.y) || 0) - (Number(parent?.y) || 0)
    };
  }

  function outerframeGeometryLabel(element) {
    return Boolean(element?.classList?.contains('outerframe-label')
      && [...(element.parentElement?.children || [])].some(child => (
        child.classList?.contains('outerframe-bg')
      )));
  }

  function indexLabelGrowthCandidate(entry, previousPlacements, previousObjects) {
    if (!entry?.element?.hasAttribute?.('data-trace-index-label')
      || entry.previous || entry.keepSnapshotMember || entry.sceneBoundaryEntrance) return false;
    const cellKey = String(entry.key || '').replace(/:index$/, '');
    if (cellKey === entry.key || !previousPlacements?.has?.(cellKey)) return false;
    const previousCell = previousVisualElement(previousObjects, cellKey);
    return Boolean(previousCell && sameSceneGeneration(entry.element, previousCell));
  }

  function indexLabelGrowthGeometry(element) {
    const children = [...(element?.children || [])];
    const rect = children.find(child => child.localName === 'rect');
    const text = children.find(child => child.localName === 'text');
    const height = Number(rect?.getAttribute('height'));
    if (!rect || !Number.isFinite(height) || height <= 0) return null;
    return { rect, text, height, textOpacity: text?.getAttribute('opacity') ?? null };
  }

  function applyIndexLabelGrowth(geometry, progress) {
    if (!geometry) return;
    const revealed = clamp01(progress);
    // Keep the rectangle's top edge at the cell bottom. The index text stays
    // at its final size and only appears once the small box has grown enough.
    geometry.rect.setAttribute('height', String(geometry.height * revealed));
    if (!geometry.text) return;
    if (revealed >= 1) {
      if (geometry.textOpacity == null) geometry.text.removeAttribute('opacity');
      else geometry.text.setAttribute('opacity', geometry.textOpacity);
      return;
    }
    const baseOpacity = geometry.textOpacity == null ? 1 : Number(geometry.textOpacity);
    geometry.text.setAttribute('opacity', String(
      (Number.isFinite(baseOpacity) ? baseOpacity : 1) * clamp01((revealed - 0.35) / 0.65)
    ));
  }

  function shouldAnimateObjectEntrance(options = {}) {
    // A @keep snapshot is already-visible history. It may move from the live
    // object's position into a layout slot, but it must never be introduced
    // as a newly-created visual.
    if (options.keepSnapshotMember || options.retainedSnapshot) return false;
    if (options.declarationSlot) return true;
    if (options.sceneBoundaryEntrance) return true;
    if (options.declarationKnown) return false;
    return options.hasPrevious !== true || options.enteringMarker === true;
  }

  function previousKeysByRuntimeIdentity(previousObjects) {
    const keys = new Map();
    previousObjects?.forEach?.((element, key) => {
      const identity = element?.dataset?.traceRuntimeIdentity || '';
      if (identity && !keys.has(identity)) keys.set(identity, key);
    });
    return keys;
  }

  function previousAliasKey(sourceKey, topKey, topElement, previousPlacements, identityKeys) {
    if (!sourceKey) return sourceKey;
    const identity = topElement?.dataset?.traceRuntimeIdentity || '';
    const previousTopKey = identity ? identityKeys.get(identity) : '';
    if (previousTopKey && topKey) {
      const suffix = sourceKey === topKey
        ? ''
        : (sourceKey.startsWith(`${topKey}#`) || sourceKey.startsWith(`${topKey}:`)
          ? sourceKey.slice(topKey.length)
          : null);
      if (suffix != null) {
        const alias = `${previousTopKey}${suffix}`;
        if (previousPlacements?.has?.(alias)) return alias;
      }
    }
    return sourceKey;
  }

  function swapSources(document, frame, eventTimeline = []) {
    const sources = new Map();
    orderedEvents(frame).filter(event => (
      event.type === 'swap'
      && event.enabled !== false
      && event.autoAnimationDisabled !== true
    )).forEach(event => {
      const slot = eventTimeline.find(item => item.event === event);
      if (!slot) return;
      const targets = (event.targets || []).filter(target => target.variableId && target.indexExpression);
      if (targets.length < 2 || targets[0].variableId !== targets[1].variableId) return;
      const indices = targets.slice(0, 2).map(target => Number(
        target.resolvedIndex != null && Number.isInteger(Number(target.resolvedIndex))
          ? target.resolvedIndex
          : window.ASMTraceRules?.resolveExpression?.(document, frame, target.indexExpression)
      ));
      if (indices.some(index => !Number.isInteger(index)) || indices[0] === indices[1]) return;
      const variableKey = objectKeyForVariable(frame, targets[0].variableId);
      const keys = indices.map(index => `${variableKey}#${index}`);
      const start = Math.max(0, Number(slot?.start) || 0);
      sources.set(keys[0], { sourceKey: keys[1], start });
      sources.set(keys[1], { sourceKey: keys[0], start });
    });
    return sources;
  }

  function heapLayoutElement(element) {
    if (!element) return null;
    return element.matches?.('[data-layout="heap"]')
      ? element
      : element.querySelector?.('[data-layout="heap"]');
  }

  function heapSwapIndices(event, traceDocument, frame) {
    return (event?.targets || []).slice(0, 2).map(target => {
      const captured = Number(target?.resolvedIndex);
      if (Object.prototype.hasOwnProperty.call(target || {}, 'resolvedIndex')
        && Number.isInteger(captured)) return captured;
      const resolved = Number(window.ASMTraceRules?.resolveExpression?.(
        traceDocument, frame, target?.indexExpression
      ));
      return Number.isInteger(resolved) ? resolved : NaN;
    });
  }

  function svgBox(element) {
    try {
      const box = element?.getBBox?.();
      if (!box) return null;
      return {
        x: Number(box.x) || 0,
        y: Number(box.y) || 0,
        width: Number(box.width) || 0,
        height: Number(box.height) || 0
      };
    } catch {
      return null;
    }
  }

  function prepareHeapResizeSwaps(
    traceDocument, eventFrame, eventTimeline, currentElements, previousObjects, previousIdentityKeys
  ) {
    const stages = [];
    const stagedTopKeys = new Set();
    eventTimeline.forEach(slot => {
      if (slot.type !== 'swap') return;
      const variableId = slot.event?.targets?.[0]?.variableId || '';
      const topKey = objectKeyForVariable(eventFrame, variableId);
      const currentTop = currentElements?.get?.(topKey);
      const currentHeap = heapLayoutElement(currentTop);
      const identity = currentTop?.dataset?.traceRuntimeIdentity || '';
      const previousTopKey = (identity && previousIdentityKeys.get(identity)) || topKey;
      const previousObject = previousObjects?.get?.(previousTopKey);
      const previousHeap = heapLayoutElement(previousObject);
      const previousWidth = Number(previousHeap?.getAttribute?.('data-heap-totalW'));
      const currentWidth = Number(currentHeap?.getAttribute?.('data-heap-totalW'));
      const indices = heapSwapIndices(slot.event, traceDocument, eventFrame);
      const changedWidth = Number.isFinite(previousWidth) && Number.isFinite(currentWidth)
        && Math.abs(previousWidth - currentWidth) > 0.1;
      const previousCells = indices.map(index => (
        [...(previousHeap?.querySelectorAll?.('[data-trace-index]') || [])]
          .find(cell => Number(cell.dataset.traceIndex) === index) || null
      ));
      const currentCells = indices.map(index => (
        [...(currentHeap?.querySelectorAll?.('[data-trace-index]') || [])]
          .find(cell => Number(cell.dataset.traceIndex) === index) || null
      ));
      const changedCellGeometry = previousCells.some((cell, sourcePosition) => {
        const previousBox = svgBox(cell);
        const targetBox = svgBox(currentCells[1 - sourcePosition])
          || svgBox(previousCells[1 - sourcePosition]);
        return previousBox && targetBox && (
          Math.abs(previousBox.width - targetBox.width) > 0.1
          || Math.abs(previousBox.height - targetBox.height) > 0.1
        );
      });
      if ((!changedWidth && !changedCellGeometry) || stagedTopKeys.has(topKey)
        || indices.some(index => !Number.isInteger(index))
        || previousCells.some(cell => !cell)
        || (!changedWidth && currentCells.some(cell => !cell))) return;
      stagedTopKeys.add(topKey);
      stages.push({
        slot, topKey, previousTopKey, currentTop, currentHeap,
        previousObject, previousHeap, previousWidth, currentWidth, indices, currentCells
      });
    });
    return stages;
  }

  function createHeapResizeSwapStages(root, descriptors) {
    const stages = descriptors.map(descriptor => {
      const ghost = descriptor.previousObject.cloneNode(true);
      const presentationOverlay = clonePresentationHints(descriptor.currentTop);
      // The ghost exists to retain pre-swap values and geometry. Frame-authored
      // highlights and points describe the current frame, so keeping their old
      // copies here makes the style look as if it updates only after the swap.
      removePresentationHints(ghost);
      removeAnimationNodes(ghost);
      [ghost, ...ghost.querySelectorAll('[id]')].forEach(element => element.removeAttribute?.('id'));
      ghost.classList.add('asm-trace-heap-resize-ghost');
      ghost.setAttribute('data-trace-heap-resize-ghost', '1');
      ghost.setAttribute('pointer-events', 'none');
      ghost.setAttribute('opacity', '1');
      appendBelowTraceIndicators(root, ghost);
      if (presentationOverlay) appendBelowTraceIndicators(root, presentationOverlay);

      const ghostHeap = heapLayoutElement(ghost);
      const ghostCellStates = new Map();
      [...ghostHeap.querySelectorAll('[data-trace-index]')].forEach(cell => {
        const index = Number(cell.dataset.traceIndex);
        const box = svgBox(cell);
        if (!Number.isInteger(index) || !box || ghostCellStates.has(index)) return;
        ghostCellStates.set(index, {
          cell,
          box,
          baseTransform: cell.getAttribute('transform') || '',
          eventTransforms: [],
          highlight: null
        });
      });
      const currentCellsByIndex = new Map();
      [...descriptor.currentHeap.querySelectorAll('[data-trace-index]')].forEach(cell => {
        const index = Number(cell.dataset.traceIndex);
        if (Number.isInteger(index) && !currentCellsByIndex.has(index)) {
          currentCellsByIndex.set(index, cell);
        }
      });
      const ghostCells = descriptor.indices.map(index => (
        ghostCellStates.get(index)?.cell
      ));
      // Current swap cells represent the incoming values; the visible ghost
      // cells still carry their source indices. Decorations must follow those
      // visible cells rather than disappear with the hidden current heap.
      const stylePresentationCells = new Map();
      currentCellsByIndex.forEach((cell, index) => {
        const swapIndex = descriptor.indices.indexOf(index);
        const sourceIndex = swapIndex < 0 ? index : descriptor.indices[1 - swapIndex];
        const presentationCell = ghostCellStates.get(sourceIndex)?.cell;
        if (!presentationCell) return;
        stylePresentationCells.set(cell, presentationCell);
        cell._asmStylePresentationCell = presentationCell;
      });
      const cellBoxes = ghostCells.map(cell => svgBox(cell));
      const targetCellBoxes = descriptor.currentCells
        .map((cell, index, cells) => (
          svgBox(cells[1 - index]) || svgBox(ghostCells[1 - index])
        ));
      const cellVisuals = ghostCells.map(cell => {
        const rect = cell.querySelector(':scope > rect');
        return { rect };
      });
      const counterScaledElements = [...ghostHeap.querySelectorAll('text, path')].map(element => {
        const box = svgBox(element);
        return {
          element,
          centerX: box ? box.x + box.width / 2 : 0,
          baseTransform: element.getAttribute('transform') || ''
        };
      });
      const baseTransforms = ghostCells.map(cell => cell.getAttribute('transform') || '');
      const ghostHeapBaseTransform = ghostHeap.getAttribute('transform') || '';
      const ghostWidthElement = ghostHeap.querySelector(':scope > .outerframe-bg') || ghostHeap;
      const currentWidthElement = descriptor.currentHeap.querySelector(':scope > .outerframe-bg')
        || descriptor.currentHeap;

      const resizeWrapper = createSvg('g', {
        'data-trace-heap-resize-current': '1',
        opacity: 0
      });
      const currentParent = descriptor.currentHeap.parentNode;
      currentParent.insertBefore(resizeWrapper, descriptor.currentHeap);
      resizeWrapper.append(descriptor.currentHeap);
      let renderedPreviousWidth = 0;
      let renderedCurrentWidth = 0;
      try {
        renderedPreviousWidth = ghostWidthElement.getBoundingClientRect().width;
        renderedCurrentWidth = currentWidthElement.getBoundingClientRect().width;
      } catch {
        // Fall back to the renderer's logical width when the SVG is not measurable yet.
      }
      const targetWidthRatio = renderedPreviousWidth > 0 && renderedCurrentWidth > 0
        ? renderedCurrentWidth / renderedPreviousWidth
        : (descriptor.previousWidth > 0 ? descriptor.currentWidth / descriptor.previousWidth : 1);

      return {
        ...descriptor,
        ghost,
        ghostCellStates,
        currentCellsByIndex,
        ghostCells,
        cellBoxes,
        targetCellBoxes,
        cellVisuals,
        counterScaledElements,
        baseTransforms,
        ghostHeap,
        ghostHeapBaseTransform,
        ghostWidthElement,
        currentWidthElement,
        resizeWrapper,
        presentationOverlay,
        targetWidthRatio,
        appliedScaleX: 1,
        update(elapsed, eventAdjustments) {
          const swapStart = this.slot.start;
          const swapProgress = easeOutCubic(clamp01(
            (elapsed - swapStart) / Math.max(1, this.slot.duration)
          ));
          let liveTargetWidthRatio = this.targetWidthRatio;
          try {
            const ghostRenderedWidth = this.ghostWidthElement.getBoundingClientRect().width;
            const currentRenderedWidth = this.currentWidthElement.getBoundingClientRect().width;
            const ghostNaturalWidth = ghostRenderedWidth / Math.max(0.001, this.appliedScaleX);
            if (ghostNaturalWidth > 0 && currentRenderedWidth > 0) {
              liveTargetWidthRatio = currentRenderedWidth / ghostNaturalWidth;
            }
          } catch {
            // Keep the initial renderer ratio when the live SVG geometry is unavailable.
          }
          if (this.currentWidth < this.previousWidth) {
            liveTargetWidthRatio = Math.min(1, liveTargetWidthRatio);
          } else if (this.currentWidth > this.previousWidth) {
            liveTargetWidthRatio = Math.max(1, liveTargetWidthRatio);
          }
          const scaleX = 1 + (liveTargetWidthRatio - 1) * swapProgress;
          this.appliedScaleX = scaleX;
          this.ghostCellStates.forEach((state, index) => {
            const adjustment = eventAdjustments?.get?.(`${this.topKey}#${index}`)
              || eventAdjustments?.get?.(`${this.previousTopKey}#${index}`)
              || null;
            const eventX = Number(adjustment?.x) || 0;
            const eventY = Number(adjustment?.y) || 0;
            const eventScale = Number(adjustment?.scale) || 1;
            const centerX = state.box.x + state.box.width / 2;
            const centerY = state.box.y + state.box.height / 2;
            const eventTranslate = Math.abs(eventX) > 0.01 || Math.abs(eventY) > 0.01
              ? `translate(${eventX}, ${eventY})`
              : '';
            const eventScaleTransform = Math.abs(eventScale - 1) > 0.001
              ? `translate(${centerX}, ${centerY}) scale(${eventScale}) translate(${-centerX}, ${-centerY})`
              : '';
            state.eventTransforms = [eventTranslate, eventScaleTransform].filter(Boolean);
            state.cell.setAttribute(
              'transform', [eventTranslate, state.baseTransform, eventScaleTransform].filter(Boolean).join(' ')
            );

            const sourceHighlight = this.currentCellsByIndex.get(index)
              ?.querySelector?.(':scope > .asm-trace-compare-highlight');
            if (sourceHighlight) {
              if (!state.highlight) {
                state.highlight = addHighlight(state.cell, sourceHighlight.getAttribute('stroke') || '#333333');
              }
              state.highlight?.setAttribute('stroke', sourceHighlight.getAttribute('stroke') || '#333333');
              state.highlight?.setAttribute('opacity', sourceHighlight.getAttribute('opacity') || '1');
            } else if (state.highlight) {
              state.highlight.remove();
              state.highlight = null;
            }
          });
          this.ghostCells.forEach((cell, index) => {
            const own = this.cellBoxes[index];
            const target = this.targetCellBoxes[index];
            if (!own || !target || own.width <= 0 || own.height <= 0) return;
            const ownCenterX = own.x + own.width / 2;
            const ownCenterY = own.y + own.height / 2;
            const targetCenterX = target.x + target.width / 2;
            const targetCenterY = target.y + target.height / 2;
            const desiredCenterX = ownCenterX + (targetCenterX - ownCenterX) * swapProgress;
            const desiredCenterY = ownCenterY + (targetCenterY - ownCenterY) * swapProgress;
            const desiredWidth = own.width + (target.width - own.width) * swapProgress;
            const translateX = desiredCenterX / Math.max(0.001, scaleX) - ownCenterX;
            const translateY = desiredCenterY - ownCenterY;
            const transform = `translate(${translateX}, ${translateY})`;
            const state = this.ghostCellStates.get(this.indices[index]);
            cell.setAttribute(
              'transform', [transform, state?.baseTransform || this.baseTransforms[index],
                ...(state?.eventTransforms || [])].filter(Boolean).join(' ')
            );

            const visual = this.cellVisuals[index];
            if (visual?.rect) {
              const localWidth = desiredWidth / Math.max(0.001, scaleX);
              visual.rect.setAttribute('x', String(ownCenterX - localWidth / 2));
              visual.rect.setAttribute('width', String(localWidth));
            }
          });
          const heapScale = Math.abs(scaleX - 1) > 0.001 ? `scale(${scaleX}, 1)` : '';
          this.ghostHeap.setAttribute(
            'transform', [this.ghostHeapBaseTransform, heapScale].filter(Boolean).join(' ')
          );
          const inverseScaleX = 1 / Math.max(0.001, scaleX);
          this.counterScaledElements.forEach(({ element, centerX, baseTransform }) => {
            const counterScale = Math.abs(inverseScaleX - 1) > 0.001
              ? `translate(${centerX}, 0) scale(${inverseScaleX}, 1) translate(${-centerX}, 0)`
              : '';
            element.setAttribute('transform', [baseTransform, counterScale].filter(Boolean).join(' '));
          });
          const finished = swapProgress >= 1;
          stylePresentationCells.forEach((presentationCell, cell) => {
            if (finished) delete cell._asmStylePresentationCell;
            else cell._asmStylePresentationCell = presentationCell;
          });
          this.ghost.setAttribute('opacity', finished ? '0' : '1');
          this.resizeWrapper.setAttribute('opacity', finished ? '1' : '0');
          this.resizeWrapper.removeAttribute('transform');
        },
        remove() {
          stylePresentationCells.forEach((_, cell) => { delete cell._asmStylePresentationCell; });
          this.presentationOverlay?.remove();
          this.ghost.remove();
          if (this.resizeWrapper?.parentNode && this.currentHeap) {
            this.resizeWrapper.parentNode.insertBefore(this.currentHeap, this.resizeWrapper);
            this.resizeWrapper.remove();
          }
        }
      };
    });
    return {
      heldPreviousKeys: new Set(stages.map(stage => stage.previousTopKey)),
      update(elapsed, eventAdjustments) {
        stages.forEach(stage => stage.update(elapsed, eventAdjustments));
      },
      finish() { stages.splice(0).forEach(stage => stage.remove()); }
    };
  }

  function objectKeyForVariable(frame, variableId) {
    const source = frame?.source || {};
    if (source.objectId && source.primaryVariableId === variableId) return source.objectId;
    return variableId;
  }

  function displayEventValue(value) {
    if (value == null) return '';
    if (typeof value !== 'object') return String(value);
    if (Object.prototype.hasOwnProperty.call(value, 'value')) return String(value.value ?? '');
    if (Array.isArray(value.items)) return `[${value.items.map(displayEventValue).join(', ')}]`;
    return String(value.label || value.type || value.kind || '');
  }

  function eventTargetKey(traceDocument, eventFrame, target) {
    if (!target?.variableId) return '';
    const variableKey = objectKeyForVariable(eventFrame, target.variableId);
    const expression = String(target.indexExpression ?? '').trim();
    const variable = traceDocument?.variables?.[target.variableId];
    if (!expression && ['scalar', 'string'].includes(variable?.kind)) {
      return `${variableKey}#0`;
    }
    if (!expression) return variableKey;
    const capturedIndex = Number(target.resolvedIndex);
    const indices = Object.prototype.hasOwnProperty.call(target, 'resolvedIndex')
      && Number.isInteger(capturedIndex)
      ? [capturedIndex]
      : expression.split(',').map(part => Number(
        window.ASMTraceRules?.resolveExpression?.(traceDocument, eventFrame, part.trim())
      ));
    if (!indices.length || indices.some(index => !Number.isInteger(index))) return variableKey;
    return `${variableKey}#${indices.join(',')}`;
  }

  function mutationVisualCommits(traceDocument, eventFrame, eventTimeline) {
    const commits = new Map();
    const remember = (key, slot, commitAt) => {
      if (!key) return;
      const previous = commits.get(key);
      if (!previous || commitAt > previous.time) {
        commits.set(key, { time: commitAt, slot });
      }
    };
    eventTimeline.forEach(slot => {
      if (slot.animation === 'swap') {
        (slot.event?.targets || []).slice(0, 2).forEach(target => {
          const key = eventTargetKey(traceDocument, eventFrame, target);
          remember(key, slot, slot.end);
          remember(`${key}:index`, slot, slot.end);
        });
        return;
      }
      if (slot.animation !== 'assign') return;
      const target = (slot.event?.targets || []).find(item => item.role === 'target')
        || slot.event?.targets?.[0];
      const key = eventTargetKey(traceDocument, eventFrame, target);
      const commitAt = (Number(slot.effectStart) || Number(slot.start) || 0)
        + ASSIGN_TIMING.frame
        + (slot.markerAssignment ? ASSIGN_TIMING.valueHold : 0)
        + ASSIGN_TIMING.drop;
      remember(key, slot, commitAt);
      remember(`${key}:index`, slot, commitAt);
    });
    return commits;
  }

  function forwardReplayMutations(traceDocument, eventFrame, event) {
    const targets = Array.isArray(event?.targets) ? event.targets : [];
    const targetMutation = (target, before, after, kind = 'value') => ({
      kind,
      key: eventTargetKey(traceDocument, eventFrame, target),
      target,
      before,
      after
    });
    if ((event?.type === 'assign' || (event?.type === 'write' && event?.update === true))
      && Object.prototype.hasOwnProperty.call(event?.payload || {}, 'after')) {
      const target = targets.find(item => item?.role === 'target') || targets[0];
      return target ? [targetMutation(
        target, event.payload?.before, event.payload?.after
      )] : [];
    }
    if (event?.type === 'swap' && targets.length >= 2) {
      return [
        targetMutation(targets[0], event.payload?.leftBefore, event.payload?.leftAfter),
        targetMutation(targets[1], event.payload?.rightBefore, event.payload?.rightAfter)
      ];
    }
    if (event?.type === 'sequence-operation' && targets[0]?.variableId) {
      const before = Number(event.payload?.beforeSize);
      const after = Number(event.payload?.afterSize);
      if (!Number.isInteger(before) || !Number.isInteger(after)
        || Math.abs(after - before) !== 1) return [];
      const index = sequenceEdge(event.operation) === 'front'
        ? 0 : Math.min(before, after);
      const target = {
        ...targets[0], indexExpression: String(index), resolvedIndex: index
      };
      return after > before ? [
        targetMutation(target, false, true, 'presence'),
        targetMutation(target, null, event.payload?.[
          sequenceEdge(event.operation) === 'front' ? 'afterFront' : 'afterBack'
        ])
      ] : [
        targetMutation(target, true, false, 'presence'),
        targetMutation(target, event.payload?.[
          sequenceEdge(event.operation) === 'front' ? 'beforeFront' : 'beforeBack'
        ], null)
      ];
    }
    if (event?.type === 'declare') {
      const target = targets.find(item => item?.role === 'target') || targets[0];
      const initializedLater = target && orderedEvents(eventFrame).some(candidate => {
        if (Number(candidate?.order) <= Number(event?.order)
          || candidate?.type !== 'assign'
          || candidate?.payload?.before != null) return false;
        const assigned = (candidate.targets || []).find(item => item?.role === 'target')
          || candidate.targets?.[0];
        if (assigned?.variableId !== target.variableId) return false;
        const declarationLifetime = String(target.lifetimeIdentity || event.lifetimeIdentity || '');
        const assignmentLifetime = String(assigned?.lifetimeIdentity || '');
        return !declarationLifetime || !assignmentLifetime
          || declarationLifetime === assignmentLifetime;
      });
      return target ? [
        targetMutation(target, false, true, 'presence'),
        // Runtime capture happens after a C++ declaration initializer has
        // evaluated, so the declaration payload already contains the final
        // value.  When instrumentation also emitted the paired assignment,
        // keep the entering object blank until that assignment commits.
        targetMutation(target, null, initializedLater ? null : event.payload?.value, 'value')
      ] : [];
    }
    if (event?.type === 'scope-exit' || event?.type === 'visual-exit') {
      return targets.filter(target => target?.variableId).map(target => (
        targetMutation(target, true, false, 'presence')
      ));
    }
    return [];
  }

  function forwardReplayCommitTime(slot) {
    if (!slot) return 0;
    if (slot.animation === 'assign') {
      return (Number(slot.effectStart) || Number(slot.start) || 0)
        + ASSIGN_TIMING.frame
        + (slot.markerAssignment ? ASSIGN_TIMING.valueHold : 0)
        + ASSIGN_TIMING.drop;
    }
    if (slot.animation === 'sequence') return Number(slot.start) || 0;
    return Number(slot.end) || Number(slot.start) || 0;
  }

  function createForwardReplayPlan(
    traceDocument, eventFrame, eventTimeline = [], direction = 1
  ) {
    const timelineSlotByEvent = new Map(eventTimeline.map(slot => [slot.event, slot]));
    const events = orderedEvents(eventFrame);
    const initialState = new Map();
    const currentState = new Map();
    const valueTracks = new Map();
    let logicalTime = 0;

    const descriptors = events.map(event => {
      const ignored = Number(direction) < 0
        || event?.loopBoundarySuppressed === true
        || event?.type === 'condition';
      const slot = ignored ? null : timelineSlotByEvent.get(event) || null;
      const mutations = ignored ? [] : forwardReplayMutations(traceDocument, eventFrame, event)
        .filter(mutation => mutation.key);
      const mode = ignored ? 'ignored' : slot ? 'animated' : 'instant';
      const commitMs = slot ? forwardReplayCommitTime(slot) : logicalTime;
      if (slot) logicalTime = Math.max(logicalTime, Number(slot.end) || commitMs);
      return { event, slot, mode, commitMs, mutations };
    });

    descriptors.forEach(({ mode, slot, mutations }) => {
      mutations.forEach(mutation => {
        const trackKey = `${mutation.kind}:${mutation.key}`;
        if (!initialState.has(trackKey)) initialState.set(trackKey, mutation.before);
        if (mode === 'instant') {
          if (mutation.kind === 'presence' && slot == null
            && mutation.after === true && mutation.before === false) {
            initialState.set(trackKey, true);
          } else if (mutation.kind === 'presence' && slot == null && mutation.after === false) {
            initialState.set(trackKey, false);
          } else if (mutation.kind === 'value' && eventTimeline.length
            && mutation.before == null && mutation.after != null) {
            // A disabled declaration has no entrance slot: its initialized
            // value is part of the immediately presented baseline.
            initialState.set(trackKey, mutation.after);
          }
        }
        if (!valueTracks.has(trackKey)) {
          valueTracks.set(trackKey, {
            kind: mutation.kind,
            key: mutation.key,
            target: mutation.target,
            initial: initialState.get(trackKey),
            steps: []
          });
        }
      });
    });
    initialState.forEach((value, key) => currentState.set(key, value));

    const checkpoints = descriptors.map(({ event, slot, mode, commitMs, mutations }) => {
      mutations.forEach(mutation => {
        const trackKey = `${mutation.kind}:${mutation.key}`;
        if (!currentState.has(trackKey)) currentState.set(trackKey, mutation.before);
      });
      const beforeState = Object.fromEntries(currentState);
      mutations.forEach(mutation => {
        const trackKey = `${mutation.kind}:${mutation.key}`;
        currentState.set(trackKey, mutation.after);
        valueTracks.get(trackKey)?.steps.push({
          eventId: String(event?.id || ''),
          order: Number(event?.order),
          mode,
          commitMs,
          before: mutation.before,
          after: mutation.after
        });
      });
      return {
        event,
        eventId: String(event?.id || ''),
        eventType: String(event?.type || ''),
        eventOrder: Number(event?.order),
        mode,
        startMs: slot ? Number(slot.promptStart ?? slot.start) || 0 : commitMs,
        animationStartMs: slot ? Number(slot.start) || 0 : commitMs,
        commitMs,
        beforeState,
        afterState: Object.fromEntries(currentState),
        mutations: mutations.map(mutation => ({
          kind: mutation.kind,
          key: mutation.key,
          before: mutation.before,
          after: mutation.after
        }))
      };
    });

    // Logical cells and rendered SVG nodes are not the same identity during
    // a swap.  The destination node carries one value from its source cell;
    // changing that node's text using the destination logical key makes the
    // values appear exchanged before motion and flip again at completion.
    // Build the visual permutation backwards from the final renderer, then
    // replay assignments and swaps forwards.
    const valueKeys = new Set(checkpoints.flatMap(checkpoint => (
      checkpoint.mutations.filter(mutation => mutation.kind === 'value')
        .map(mutation => mutation.key)
    )));
    const visualForLogical = new Map([...valueKeys].map(key => [key, key]));
    const swapMutations = checkpoint => checkpoint.eventType === 'swap'
      ? checkpoint.mutations.filter(mutation => mutation.kind === 'value').slice(0, 2)
      : [];
    [...checkpoints].reverse().forEach(checkpoint => {
      if (checkpoint.mode === 'ignored') return;
      const pair = swapMutations(checkpoint);
      if (pair.length < 2) return;
      const leftVisual = visualForLogical.get(pair[0].key) || pair[0].key;
      const rightVisual = visualForLogical.get(pair[1].key) || pair[1].key;
      visualForLogical.set(pair[0].key, rightVisual);
      visualForLogical.set(pair[1].key, leftVisual);
    });
    const visualTracks = new Map();
    visualForLogical.forEach((visualKey, logicalKey) => {
      if (!visualTracks.has(visualKey)) {
        visualTracks.set(visualKey, {
          kind: 'value', key: visualKey,
          initial: initialState.get(`value:${logicalKey}`), steps: []
        });
      }
    });
    checkpoints.forEach(checkpoint => {
      if (checkpoint.mode === 'ignored') return;
      checkpoint.visualBindingsBefore = Object.fromEntries(visualForLogical);
      const pair = swapMutations(checkpoint);
      checkpoint.mutations.filter(mutation => mutation.kind === 'value').forEach(mutation => {
        mutation.visualKey = visualForLogical.get(mutation.key) || mutation.key;
      });
      if (pair.length >= 2) {
        const leftVisual = visualForLogical.get(pair[0].key) || pair[0].key;
        const rightVisual = visualForLogical.get(pair[1].key) || pair[1].key;
        visualForLogical.set(pair[0].key, rightVisual);
        visualForLogical.set(pair[1].key, leftVisual);
        checkpoint.visualBindingsAfter = Object.fromEntries(visualForLogical);
        return;
      }
      checkpoint.mutations.filter(mutation => mutation.kind === 'value').forEach(mutation => {
        const visualKey = mutation.visualKey;
        if (!visualTracks.has(visualKey)) {
          visualTracks.set(visualKey, {
            kind: 'value', key: visualKey, initial: mutation.before, steps: []
          });
        }
        visualTracks.get(visualKey).steps.push({
          eventId: checkpoint.eventId,
          order: checkpoint.eventOrder,
          mode: checkpoint.mode,
          commitMs: checkpoint.commitMs,
          before: mutation.before,
          after: mutation.after
        });
      });
      checkpoint.visualBindingsAfter = Object.fromEntries(visualForLogical);
    });

    return {
      version: 1,
      direction: 'forward',
      frameId: String(eventFrame?.id || ''),
      initialState: Object.fromEntries(initialState),
      finalState: Object.fromEntries(currentState),
      checkpoints,
      valueTracks: [...valueTracks.values()],
      visualValueTracks: [...visualTracks.values()]
    };
  }

  function comparisonPoint(placements, key) {
    const box = placements?.get?.(key);
    if (!box) return null;
    return {
      x: (Number(box.x) || 0) + (Number(box.width) || 0) / 2,
      y: Number(box.y) || 0,
      width: Number(box.width) || 0,
      height: Number(box.height) || 0
    };
  }

  function markerLifetimeActiveAtEvent(eventFrame, event, element) {
    const variableId = String(element?.dataset?.traceSourceVariableId || '');
    const lifetime = String(element?.dataset?.traceRuntimeIdentity || '');
    if (!variableId || !lifetime || !event) return true;
    const eventOrder = Number(event.order);
    if (!Number.isFinite(eventOrder)) return true;
    let declaredAt = -Infinity;
    let exitedAt = Infinity;
    orderedEvents(eventFrame).forEach(candidate => {
      const order = Number(candidate?.order);
      if (!Number.isFinite(order)) return;
      (candidate.targets || []).forEach(target => {
        if (String(target?.variableId || '') !== variableId
          || String(target?.lifetimeIdentity || '') !== lifetime) return;
        if (candidate.type === 'declare') declaredAt = Math.max(declaredAt, order);
        if (candidate.type === 'scope-exit' || candidate.type === 'visual-exit') {
          exitedAt = Math.min(exitedAt, order);
        }
      });
    });
    return eventOrder >= declaredAt && eventOrder < exitedAt;
  }

  function markerVisualKey(elements, target, eventFrame = null, event = null) {
    for (const [key, element] of elements || []) {
      // A retained @keep marker can carry the same source variable id as the
      // live marker. It is playback history, not a target for current events.
      // Match the full lifetime and scene generation so a stale snapshot can
      // never make a missing live object look available.
      if (markerMatchesEventTarget(element, target)
        && markerLifetimeActiveAtEvent(eventFrame, event, element)) return key;
    }
    return '';
  }

  function eventOperand(
    traceDocument, eventFrame, target, value, placements, elements, visualKeyForSource,
    event = null
  ) {
    const logicalKey = eventTargetKey(traceDocument, eventFrame, target);
    let visualKey = typeof visualKeyForSource === 'function' ? visualKeyForSource(logicalKey) : logicalKey;
    let element = elements?.get?.(visualKey) || elements?.get?.(logicalKey);
    const directTargetMatches = !retainedSnapshotVisual(element)
      && (!element?.dataset?.traceSourceVariableId
        || (markerMatchesEventTarget(element, target)
          && markerLifetimeActiveAtEvent(eventFrame, event, element)));
    if (!element || !directTargetMatches) {
      const matchingMarkerKey = markerVisualKey(elements, target, eventFrame, event);
      visualKey = matchingMarkerKey || visualKey;
      element = matchingMarkerKey ? elements?.get?.(matchingMarkerKey) : null;
    }
    const point = comparisonPoint(placements, visualKey) || comparisonPoint(placements, logicalKey);
    if (!element || !point) return null;
    const marker = Boolean(element.dataset?.traceSourceVariableId);
    const markerX = Number(element.dataset?.traceMarkerPopupX);
    const markerY = Number(element.dataset?.traceMarkerPopupY);
    return {
      target,
      logicalKey,
      visualKey,
      element,
      point: marker && Number.isFinite(markerX) && Number.isFinite(markerY)
        ? { ...point, x: markerX, y: markerY }
        : point,
      value: displayEventValue(value),
      numericValue: Number(displayEventValue(value)),
      marker
    };
  }

  function clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }

  function composeLifecycleOpacity(appearOpacity = 1, exitProgress = 0) {
    return clamp01(appearOpacity) * (1 - clamp01(exitProgress));
  }

  function removedVisualStartMs(lifecycleKind, initialDelay = 0, keepSettlementDuration = 0) {
    // Captions belong to a separate presentation lane. Once the user asks for
    // the next frame, the previous caption should begin fading immediately;
    // it must not wait for the code-panel jump or keep/layout settlement.
    if (lifecycleKind === 'text') return 0;
    return Math.max(0, Number(initialDelay) || 0)
      + Math.max(0, Number(keepSettlementDuration) || 0);
  }

  function animationPlaybackRate() {
    const cssRate = Number(getComputedStyle(document.documentElement)
      .getPropertyValue('--asm-animation-playback-rate'));
    return Math.max(0.25, Math.min(4, Number(window.asmGetAnimationPlaybackRate?.()) || cssRate || 1));
  }

  function automaticMarkerKeys(frame) {
    const keys = new Set();
    (frame?.bindings || []).forEach((binding, index) => {
      if (binding?.mode !== 'index' || !binding.sourceVariableId || !binding.targetVariableId) return;
      const targetItems = frame?.state?.[binding.targetVariableId]?.data?.items;
      if (!Array.isArray(targetItems) || !targetItems.length) return;
      keys.add(`studio:auto-frame-binding-${binding.sourceVariableId}-${binding.targetVariableId}-${index}`);
    });
    return keys;
  }

  function eventGap(traceDocument) {
    const value = Number(traceDocument?.studio?.eventSettings?.gapMs);
    return Number.isFinite(value) ? Math.max(0, Math.min(2000, value)) : 500;
  }

  function createSvg(name, attributes = {}, text = '') {
    const element = document.createElementNS('http://www.w3.org/2000/svg', name);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
    if (text !== '') element.textContent = text;
    return element;
  }

  function appendBelowTextLayer(root, element) {
    const textLayer = root.querySelector?.(
      ':scope > .asm-trace-text-layer, :scope > .asm-trace-foreground-arrows'
    );
    root.insertBefore(element, textLayer || null);
    return element;
  }

  function appendBelowTraceIndicators(root, element) {
    const foreground = root.querySelector?.(
      ':scope > .asm-trace-bound-object, :scope > .asm-trace-text-layer, :scope > .asm-trace-foreground-arrows'
    );
    root.insertBefore(element, foreground || null);
    return element;
  }

  function createAnimationEffectLayer(root) {
    let layer = [...root.children].find(node => node.classList?.contains('asm-trace-animation-effect-layer'));
    if (!layer) layer = createSvg('g', {
      class: 'asm-trace-animation-effect-layer',
      'data-trace-animation-effect-layer': '1'
    });
    const style = [...root.children].find(node => node.classList?.contains('asm-trace-style-layer'));
    const arrows = [...root.children].find(node => node.classList?.contains('asm-trace-foreground-arrows'));
    root.insertBefore(layer, style || arrows || null);
    const initialChildren = new Set(root.children);
    const promoted = new Map();
    const infrastructure = node => node === layer || node.matches?.(
      '.asm-trace-style-layer, .asm-trace-pointer-layer, .asm-trace-background-arrows, '
      + '.asm-trace-foreground-arrows, .asm-trace-text-layer'
    );
    const topVisual = element => {
      let node = element;
      while (node?.parentNode && node.parentNode !== root && node.parentNode !== layer) {
        node = node.parentNode;
      }
      return node && (node.parentNode === root || node.parentNode === layer)
        && !infrastructure(node) ? node : null;
    };
    const directlyAnimatedVisual = element => {
      if (!element || infrastructure(element)) return null;
      if (element.closest?.('.asm-trace-pointer-layer')) return null;
      const cell = element.matches?.('[data-trace-index]')
        ? element : element.closest?.('[data-trace-index]');
      if (cell && root.contains(cell)) return cell;
      return topVisual(element);
    };
    const parentTransformInRoot = parent => {
      try {
        const rootMatrix = root.getScreenCTM?.();
        const parentMatrix = parent?.getScreenCTM?.();
        if (!rootMatrix || !parentMatrix) return '';
        const matrix = rootMatrix.inverse().multiply(parentMatrix);
        return `matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e} ${matrix.f})`;
      } catch {
        return '';
      }
    };
    const restore = (node, record) => {
      if (record.placeholder.parentNode === record.parent) {
        if (record.wrapper && node.parentNode === record.wrapper) {
          record.parent.insertBefore(node, record.placeholder);
        } else if (!record.wrapper && node.parentNode === layer) {
          record.parent.insertBefore(node, record.placeholder);
        }
      }
      record.wrapper?.remove();
      record.placeholder.remove();
      promoted.delete(node);
    };
    return {
      layer,
      sync(elements = []) {
        const desired = new Set();
        for (const element of elements) {
          const node = directlyAnimatedVisual(element);
          if (node) desired.add(node);
        }
        // The renderer has finished before this controller is created. New
        // root-level children are transient event/transition visuals.
        [...root.children].forEach(node => {
          if (!initialChildren.has(node) && !infrastructure(node)) desired.add(node);
        });
        promoted.forEach((record, node) => {
          if (record.runtime && node.isConnected) desired.add(node);
        });
        desired.forEach(node => {
          if (promoted.has(node)) return;
          const parent = node.parentNode;
          if (!parent || parent === layer || infrastructure(node)) return;
          const placeholder = parent === root
            ? document.createComment('asm-trace-animation-effect-order')
            : createSvg('g', {
              class: 'asm-trace-animation-cell-placeholder',
              display: 'none',
              'aria-hidden': 'true'
            });
          parent.insertBefore(placeholder, node);
          if (parent === root) {
            layer.append(node);
            promoted.set(node, {
              parent, placeholder, wrapper: null,
              runtime: !initialChildren.has(node)
            });
            return;
          }
          // Move only the directly animated cell. A wrapper carries the
          // parent-to-root transform so the cell does not jump when detached
          // from its array/container; outerframe, name and sibling cells stay
          // in the ordinary object layer.
          const wrapper = createSvg('g', {
            class: 'asm-trace-animation-cell-host',
            'pointer-events': 'none'
          });
          const transform = parentTransformInRoot(parent);
          if (transform) wrapper.setAttribute('transform', transform);
          layer.append(wrapper);
          wrapper.append(node);
          promoted.set(node, { parent, placeholder, wrapper, runtime: false });
        });
        [...promoted].forEach(([node, record]) => {
          if (!desired.has(node) || !node.isConnected) restore(node, record);
        });
      },
      clear() {
        [...promoted].forEach(([node, record]) => restore(node, record));
      }
    };
  }

  function elementBoundsInRoot(element, root) {
    if (!element || !root) return null;
    try {
      const box = element.getBBox();
      const rootMatrix = root.getScreenCTM();
      const elementMatrix = element.getScreenCTM();
      if (!rootMatrix || !elementMatrix) return null;
      const matrix = rootMatrix.inverse().multiply(elementMatrix);
      const corners = [
        [box.x, box.y],
        [box.x + box.width, box.y],
        [box.x, box.y + box.height],
        [box.x + box.width, box.y + box.height]
      ].map(([x, y]) => new DOMPoint(x, y).matrixTransform(matrix));
      const left = Math.min(...corners.map(point => point.x));
      const top = Math.min(...corners.map(point => point.y));
      const right = Math.max(...corners.map(point => point.x));
      const bottom = Math.max(...corners.map(point => point.y));
      return { x: left, y: top, width: right - left, height: bottom - top };
    } catch {
      return null;
    }
  }

  function markerCellElement(operand) {
    if (!operand?.marker) return null;
    return operand.element.querySelector?.('[data-trace-index="0"] rect')
      || operand.element.querySelector?.('[data-trace-index="0"]')
      || operand.element.querySelector?.('g[id*="cell-"] rect')
      || operand.element.querySelector?.('rect');
  }

  function markerPopupAnchorElement(operand) {
    if (!operand?.marker) return null;
    return operand.element.querySelector?.('.trace-variable-marker-label-box')
      || markerCellElement(operand);
  }

  function detachedMarkerPopupPoint(bindingPoint, markerElement) {
    if (!bindingPoint) return null;
    const labelBox = markerPopupAnchorElement({ marker: true, element: markerElement });
    const labelOffsetY = Number(labelBox?.getAttribute?.('y'));
    return {
      ...bindingPoint,
      x: bindingPoint.x + bindingPoint.width / 2,
      // Marker label boxes are authored relative to the bound cell anchor.
      // Reuse that exact offset so a detached lifetime lands where its live
      // label did, without counting the label/arrow height a second time.
      y: bindingPoint.y + (Number.isFinite(labelOffsetY) ? labelOffsetY : -40)
    };
  }

  function markerAssignmentStart(visible, current, delta) {
    const visualValue = Number(visible);
    const currentValue = Number(current);
    const offset = Number(delta) || 0;
    if (!Number.isFinite(visualValue) || !Number.isFinite(currentValue) || Math.abs(offset) < 0.01) {
      return visualValue;
    }
    const previousValue = currentValue + offset;
    // Depending on nesting, getScreenCTM() may already include the initial tween
    // translation. Apply the old-frame delta only when the DOM is still at its
    // destination coordinate.
    return Math.abs(visualValue - previousValue) <= Math.abs(visualValue - currentValue)
      ? visualValue
      : visualValue + offset;
  }

  function compareValuesEqual(operands) {
    if (operands.length < 2) return false;
    const leftNumber = operands[0].numericValue;
    const rightNumber = operands[1].numericValue;
    if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber === rightNumber;
    return String(operands[0].value) === String(operands[1].value);
  }

  function compareContactTargets(operands, equalValues) {
    if (operands.length < 2) return [];
    const order = operands
      .map((operand, index) => ({ operand, index }))
      .sort((left, right) => left.operand.point.x - right.operand.point.x || left.index - right.index);
    const left = order[0];
    const right = order[1];
    const contactX = (left.operand.point.x + right.operand.point.x) / 2;
    const leftWidth = Math.max(1, Number(left.operand.point.width) || 1);
    const rightWidth = Math.max(1, Number(right.operand.point.width) || 1);
    const leftCenterY = left.operand.point.y + left.operand.point.height / 2;
    const rightCenterY = right.operand.point.y + right.operand.point.height / 2;
    const sharedCenterY = (leftCenterY + rightCenterY) / 2;
    const verticalGap = equalValues ? 0 : 5;
    const targets = [];
    targets[left.index] = {
      x: contactX - leftWidth / 2 - left.operand.point.x,
      alignY: sharedCenterY - leftCenterY,
      splitY: -verticalGap
    };
    targets[right.index] = {
      x: contactX + rightWidth / 2 - right.operand.point.x,
      alignY: sharedCenterY - rightCenterY,
      splitY: verticalGap
    };
    return targets;
  }

  function compareScaleTargets(operands) {
    if (operands.length < 2) return [];
    const left = operands[0].numericValue;
    const right = operands[1].numericValue;
    if (!Number.isFinite(left) || !Number.isFinite(right) || left === right) return [1, 1];
    return left > right
      ? [1 + COMPARE_SCALE_DELTA, 1 - COMPARE_SCALE_DELTA]
      : [1 - COMPARE_SCALE_DELTA, 1 + COMPARE_SCALE_DELTA];
  }

  function addHighlight(element, color) {
    const source = element?.matches?.('rect') ? element : element?.querySelector?.('rect');
    if (!source) return null;
    const highlight = createSvg('rect', {
      class: 'asm-trace-compare-highlight',
      x: source.getAttribute('x') || 0,
      y: source.getAttribute('y') || 0,
      width: source.getAttribute('width') || 0,
      height: source.getAttribute('height') || 0,
      rx: source.getAttribute('rx') || 0,
      fill: 'none',
      stroke: color,
      'stroke-width': 3,
      'pointer-events': 'none'
    });
    element.append(highlight);
    // The same non-blinking result frame is used for single-value if reads
    // and ordinary compare results. It must follow the *presented* cell and
    // stay above objects even while that cell is scaled or lifted.
    window.ASMTraceRenderers?.attachStyleVisual?.(highlight, element, 'compare');
    return highlight;
  }

  function displayOperator(operation) {
    return ({ '!=': '≠', '==': '=', '<=': '≤', '>=': '≥' })[operation] || String(operation || '?');
  }

  function createComparisonExpression(root, event, operands, color, preferredTop = null) {
    if (operands.length < 2) return null;
    const centerX = (operands[0].point.x + operands[1].point.x) / 2;
    const top = Number.isFinite(preferredTop)
      ? preferredTop
      : Math.min(operands[0].point.y, operands[1].point.y) - 15;
    const operation = displayOperator(event?.operation);
    const left = `${operands[0].target?.expression || 'left'}(${operands[0].value})`;
    const right = `${operands[1].target?.expression || 'right'}(${operands[1].value})`;
    const fontSize = 14;
    const fallbackWidth = value => Math.max(fontSize * 0.58, Array.from(value).length * fontSize * 0.58);
    const gap = 6;
    const group = createSvg('g', {
      class: 'asm-trace-compare-operator',
      transform: `translate(${centerX}, ${top})`,
      'pointer-events': 'none'
    });
    const textAttributes = {
      y: 0, 'dominant-baseline': 'middle', 'font-family': 'Arial',
      'font-size': fontSize, 'font-weight': 'bold', fill: color
    };
    const leftText = createSvg('text', { ...textAttributes, 'text-anchor': 'start' }, left);
    const operationText = createSvg('text', { ...textAttributes, 'text-anchor': 'middle' }, operation);
    const rightText = createSvg('text', { ...textAttributes, 'text-anchor': 'start' }, right);
    group.append(leftText, operationText, rightText);
    appendBelowTextLayer(root, group);
    const measuredWidth = (node, fallback) => {
      try {
        const width = node.getComputedTextLength();
        return width > 0 ? width : fallback;
      } catch (error) {
        return fallback;
      }
    };
    const leftWidth = measuredWidth(leftText, fallbackWidth(left));
    const operationWidth = measuredWidth(operationText, fallbackWidth(operation));
    const rightWidth = measuredWidth(rightText, fallbackWidth(right));
    const totalWidth = leftWidth + operationWidth + rightWidth + gap * 2;
    const startX = -totalWidth / 2;
    const operationX = startX + leftWidth + gap + operationWidth / 2;
    leftText.setAttribute('x', String(startX));
    operationText.setAttribute('x', String(operationX));
    rightText.setAttribute('x', String(startX + leftWidth + gap + operationWidth + gap));
    if (event?.result !== true) {
      group.append(createSvg('line', {
        x1: operationX - operationWidth / 2 - 2, y1: -8,
        x2: operationX + operationWidth / 2 + 2, y2: 8,
        stroke: color,
        'stroke-width': 2,
        'stroke-linecap': 'square'
      }));
    }
    return group;
  }

  function createMarkerPopup(root, operand, className = 'asm-trace-compare-marker-popup') {
    const source = markerPopupAnchorElement(operand) || (operand.element.matches?.('rect')
      ? operand.element
      : operand.element.querySelector?.('rect'));
    const width = Math.max(16, Number(source?.getAttribute?.('width')) || 18);
    const height = Math.max(16, Number(source?.getAttribute?.('height')) || 18);
    const stroke = source?.getAttribute?.('stroke') || '#333';
    const strokeWidth = source?.getAttribute?.('stroke-width') || 1;
    const group = createSvg('g', {
      class: className,
      'pointer-events': 'none', opacity: 0
    });
    const rect = createSvg('rect', {
      x: -width / 2, y: -height, width, height,
      fill: 'none', stroke, 'stroke-width': strokeWidth,
      'stroke-dasharray': '4 3'
    });
    const text = createSvg('text', {
      x: 0, y: -height / 2,
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
      'font-family': 'Arial', 'font-size': Math.max(7, Math.min(13, height * 0.55)),
      'font-weight': 'bold', fill: source?.nextElementSibling?.getAttribute?.('fill') || '#1f282d'
    }, operand.value);
    group.append(rect, text);
    appendBelowTextLayer(root, group);
    return { group, rect, text, width, height };
  }

  function assignableTargetText(operand) {
    if (!operand || operand.marker) return null;
    const text = operand.element.matches?.('text')
      ? operand.element
      : operand.element.querySelector?.('text');
    return text?.dataset?.traceContentRole === 'index' ? null : text;
  }

  function createAssignmentTransfer(root, sourceOperand, targetOperand, value, sourceVisual = null) {
    if (!sourceOperand || !targetOperand || sourceOperand.marker || targetOperand.marker) return null;
    // An index-only cell is not a visual representation of its data value.
    // Transferring a clone of it would animate the index instead of the value.
    if (sourceOperand.element.querySelector?.('text[data-trace-content-role="index"]')) return null;
    if (sourceOperand.visualKey === targetOperand.visualKey) return null;
    if (sourceOperand.element.closest?.('[data-trace-visibility="hidden"]')
      || targetOperand.element.closest?.('[data-trace-visibility="hidden"]')) return null;

    let box;
    try {
      box = sourceOperand.element.getBBox();
    } catch (error) {
      return null;
    }
    if (!(box?.width > 0) || !(box?.height > 0)) return null;

    const clone = (sourceVisual || sourceOperand.element).cloneNode(true);
    [clone, ...clone.querySelectorAll('[id], [data-trace-object-key]')].forEach(node => {
      node.removeAttribute?.('id');
      node.removeAttribute?.('data-trace-object-key');
    });
    clone.removeAttribute('transform');
    clone.classList.remove('selected', 'draggable-object', 'asm-trace-selectable');
    removeAnimationNodes(clone);
    const cloneText = clone.matches?.('text') ? clone : clone.querySelector?.('text');
    if (cloneText) cloneText.textContent = displayEventValue(value);

    const group = createSvg('g', {
      class: 'asm-trace-assign-transfer',
      'pointer-events': 'none'
    });
    group.append(clone);
    appendBelowTextLayer(root, group);

    const sourceCenter = {
      x: sourceOperand.point.x,
      y: sourceOperand.point.y + sourceOperand.point.height / 2
    };
    const targetCenter = {
      x: targetOperand.point.x,
      y: targetOperand.point.y + targetOperand.point.height / 2
    };
    const boxCenter = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const sourceScale = {
      x: sourceOperand.point.width / box.width,
      y: sourceOperand.point.height / box.height
    };
    const targetScale = {
      x: targetOperand.point.width / box.width,
      y: targetOperand.point.height / box.height
    };
    const distance = Math.hypot(
      targetCenter.x - sourceCenter.x,
      targetCenter.y - sourceCenter.y
    );
    const arcHeight = Math.min(32, Math.max(10, distance * 0.14));

    return {
      group,
      update(progress, opacity = 1) {
        const x = sourceCenter.x + (targetCenter.x - sourceCenter.x) * progress;
        const y = sourceCenter.y + (targetCenter.y - sourceCenter.y) * progress
          - Math.sin(Math.PI * progress) * arcHeight;
        const scaleX = sourceScale.x + (targetScale.x - sourceScale.x) * progress;
        const scaleY = sourceScale.y + (targetScale.y - sourceScale.y) * progress;
        group.setAttribute(
          'transform',
          `translate(${x}, ${y}) scale(${scaleX}, ${scaleY}) translate(${-boxCenter.x}, ${-boxCenter.y})`
        );
        group.setAttribute('opacity', String(opacity));
      },
      remove() {
        group.remove();
      }
    };
  }

  function prepareForwardValues(options, replayPlan, eventFrame) {
    const tracks = [];
    const previousStyleFrame = options.previousFrame || eventFrame;
    const conditionalStyleVariables = new Set([
      ...(eventFrame?.styles || []), ...(previousStyleFrame?.styles || [])
    ]
      .map(style => style.targetVariableId));
    (replayPlan?.visualValueTracks || replayPlan?.valueTracks || [])
      .filter(track => track.kind === 'value').forEach(track => {
      const values = [
        track.initial,
        ...(track.steps || []).flatMap(step => [step.before, step.after])
      ].filter(value => value != null);
      // A recursive container parameter targets the whole rendered object.
      // Never serialize its value into the object's first <text>, which is the
      // outerframe label ("arr"). Container cells already come from frame state.
      if (values.some(value => (
        typeof value === 'object'
        && !Object.prototype.hasOwnProperty.call(value, 'value')
      ))) return;
      const element = options.currentElements?.get?.(track.key);
      if (!element || element.dataset?.traceSourceVariableId) return;
      const targetText = element.matches?.('text')
        ? element
        : element.querySelector?.('text');
      if (!targetText) return;
      const fixedIndex = targetText.dataset?.traceContentRole === 'index';
      const cell = element.closest?.('[data-trace-index]') || element;
      const variableId = cell.closest?.('[data-trace-variable]')?.dataset?.traceVariable;
      const index = Number(cell.dataset?.traceIndex);
      const styleRect = conditionalStyleVariables.has(variableId)
        && Number.isInteger(index)
        ? cell.querySelector?.(':scope > rect') || null
        : null;
      tracks.push({ ...track, targetText: fixedIndex ? null : targetText,
        targetCell: fixedIndex ? element : null, variableId, index, styleRect,
        applied: Symbol('unapplied'), currentValue: track.initial });
    });
    const styleTargets = tracks.filter(track => track.styleRect);
    // Value cells are visual nodes that may swap positions. Their index labels
    // stay at logical array indices, so labels must replay the logical value
    // tracks rather than inheriting the moving node's value.
    const indexTracks = [];
    (replayPlan?.valueTracks || []).filter(track => track.kind === 'value')
      .forEach(track => {
        const cell = options.currentElements?.get?.(track.key);
        const logicalIndex = Number(cell?.dataset?.traceIndex);
        const label = options.currentElements?.get?.(`${track.key}:index`)
          || (Number.isInteger(logicalIndex)
            ? cell?.parentElement?.querySelector?.(`[data-trace-index-label="${logicalIndex}"]`)
            : null);
        const variableId = label?.closest?.('[data-trace-variable]')?.dataset?.traceVariable
          || cell?.closest?.('[data-trace-variable]')?.dataset?.traceVariable;
        const index = Number(label?.getAttribute?.('data-trace-index-label')
          ?? label?.dataset?.traceIndexLabel ?? cell?.dataset?.traceIndex);
        const rect = label?.querySelector?.(':scope > rect') || null;
        if (!rect || !conditionalStyleVariables.has(variableId)
          || !Number.isInteger(index)) return;
        indexTracks.push({ ...track, variableId, index, rect,
          applied: Symbol('unapplied'), currentValue: track.initial });
      });
    // A conditional rule can style a whole range even when an event mutates
    // only one cell. Evaluate every visible cell and its index box against
    // the same currently presented state, including unchanged cells.
    const seenStyleRects = new Set(styleTargets.map(track => track.styleRect));
    const seenIndexRects = new Set(indexTracks.map(track => track.rect));
    options.currentElements?.forEach?.((element, key) => {
      const isIndexLabel = element?.hasAttribute?.('data-trace-index-label') === true;
      const index = Number(isIndexLabel
        ? element.getAttribute('data-trace-index-label') : element?.dataset?.traceIndex);
      const variableId = element?.closest?.('[data-trace-variable]')?.dataset?.traceVariable;
      if (!conditionalStyleVariables.has(variableId) || !Number.isInteger(index)) return;
      const rect = element.querySelector?.(':scope > rect');
      if (!rect) return;
      const target = { key, variableId, index, currentValue: null };
      if (isIndexLabel) {
        if (!seenIndexRects.has(rect)) {
          indexTracks.push({ ...target, rect, steps: [], applied: Symbol('unapplied') });
          seenIndexRects.add(rect);
        }
      } else if (!seenStyleRects.has(rect)) {
        styleTargets.push({ ...target, styleRect: rect });
        seenStyleRects.add(rect);
      }
    });
    let stylePaints = new Map();
    let stylesDirty = true;
    let evaluatedHighlights = {};
    let styleElapsed = 0;
    // Only animated swaps defer paint. Other frame-authored styles retain
    // their entry-time semantics; disabled swaps have no animation barrier.
    const swapPaintStarts = new Map();
    (replayPlan?.checkpoints || []).forEach(checkpoint => {
      if (checkpoint.eventType !== 'swap' || checkpoint.mode !== 'animated') return;
      checkpoint.mutations.filter(mutation => mutation.kind === 'value').forEach(mutation => {
        const start = Number(checkpoint.animationStartMs ?? checkpoint.startMs) || 0;
        for (const key of [mutation.visualKey || mutation.key, `${mutation.key}:index`]) {
          if (!swapPaintStarts.has(key)) swapPaintStarts.set(key, start);
        }
      });
    });
    const initialBindings = (replayPlan?.checkpoints || [])
      .find(checkpoint => checkpoint.visualBindingsBefore)?.visualBindingsBefore || {};
    const initialPaints = new Map();
    const previousPaint = (track, isIndex, fallback) => {
      if (initialPaints.has(track)) return initialPaints.get(track);
      let key = isIndex
        ? (String(track.key).endsWith(':index') ? track.key : `${track.key}:index`)
        : track.key;
      if (!isIndex && swapPaintStarts.has(key)) {
        key = Object.keys(initialBindings).find(source => initialBindings[source] === key) || key;
      }
      const previous = options.previousObjects?.get?.(key)
        || (typeof CSS !== 'undefined' ? previousVisualElement(options.previousObjects, key || '') : null);
      const rect = previous?.querySelector?.(':scope > rect');
      const paint = { fill: rect?.getAttribute('fill') || fallback.fill,
        opacity: rect?.getAttribute('fill-opacity') || fallback.opacity };
      initialPaints.set(track, paint);
      return paint;
    };
    const refreshStyles = () => {
      if (!stylesDirty) return;
      stylesDirty = false;
      // Match the original renderer: evaluate the new frame before events.
      const visualHighlights = (styleTargets.length || indexTracks.length)
        ? window.ASMTraceRules.evaluate(options.document, eventFrame) : {};
      const indexHighlights = visualHighlights;
      evaluatedHighlights = visualHighlights;
      const backgroundPaint = highlight => Object.hasOwn(highlight.styleTypes || {}, 'background')
        ? highlight.styleTypes.background || 'rgb(231, 144, 255)'
        : highlight.fill || '#ffffff';
      stylePaints = new Map([
        ...styleTargets.map(track => {
          const highlight = visualHighlights[track.variableId]?.[String(track.styleIndex ?? track.index)] || {};
          return [track.styleRect, {
            fill: backgroundPaint(highlight),
            opacity: '1'
          }];
        }),
        ...indexTracks.map(track => {
          const highlight = indexHighlights[track.variableId]?.[String(track.index)] || {};
          return [track.rect, {
            fill: backgroundPaint(highlight),
            opacity: '1'
          }];
        })
      ]);
    };
    const apply = (track, value) => {
      const displayed = displayEventValue(value);
      if (track.applied === displayed) return;
      track.applied = displayed;
      track.currentValue = value;
      if (styleTargets.length || indexTracks.length) stylesDirty = true;
      if (track.targetCell) track.targetCell.dataset.traceDataValue = displayed;
      else track.targetText.textContent = displayed;
    };
    const update = elapsed => {
      styleElapsed = Number(elapsed) || 0;
      // Numeric commits remain ordered; style is independent of these commits.
      [...tracks, ...indexTracks].forEach(track => {
        let value = track.initial;
        track.steps.forEach(step => {
          if (step.mode === 'ignored' || elapsed < Number(step.commitMs)) return;
          value = step.after;
        });
        if (track.rect) {
          const displayed = displayEventValue(value);
          if (track.applied === displayed) return;
          track.applied = displayed;
          track.currentValue = value;
          stylesDirty = true;
        } else {
          apply(track, value);
        }
      });
    };
    update(0);
    return {
      update,
      ownsPaint(rect) {
        return seenStyleRects.has(rect) || seenIndexRects.has(rect);
      },
      applyStyles() {
        refreshStyles();
        stylePaints.forEach((paint, rect) => {
          const track = styleTargets.find(item => item.styleRect === rect)
            || indexTracks.find(item => item.rect === rect);
          const isIndex = indexTracks.includes(track);
          const key = isIndex
            ? (String(track?.key).endsWith(':index') ? track.key : `${track?.key}:index`)
            : track?.key;
          const initial = previousPaint(track, isIndex, paint);
          const held = styleElapsed < (swapPaintStarts.get(key) ?? 0);
          if (held) paint = initial;
          // Establish the replay's initial paint immediately; only subsequent
          // changes transition. Geometry continues on the cell's own tick.
          if (rect.classList && !rect.classList.contains('asm-trace-style-paint')) {
            // Start the color transition at entry, not at numeric completion.
            // A freshly inserted rect already has the destination color.
            // Establish the source without accidentally starting a reverse
            // transition, then enable the shared 180ms transition once.
            rect.style.transition = 'none';
            rect.setAttribute('fill', initial.fill);
            rect.setAttribute('fill-opacity', initial.opacity);
            rect.classList.add('asm-trace-style-paint');
            window.getComputedStyle(rect).fill;
            rect.style.removeProperty('transition');
            window.getComputedStyle(rect).fill;
          }
          rect.setAttribute('fill', paint.fill);
          rect.setAttribute('fill-opacity', paint.opacity);
        });
        const focusColors = new Map();
        Object.entries(evaluatedHighlights).forEach(([id, highlights]) => {
          Object.values(highlights).forEach(highlight => {
            if (Object.hasOwn(highlight.styleTypes || {}, 'focus')) {
              focusColors.set(id, highlight.styleTypes.focus || '#ccc');
            }
          });
        });
        styleTargets.forEach(track => {
          const highlight = evaluatedHighlights[track.variableId]?.[String(track.styleIndex ?? track.index)] || {};
          const focused = Object.hasOwn(highlight.styleTypes || {}, 'focus');
          if (styleElapsed >= (swapPaintStarts.get(track.key) ?? 0)
            && focusColors.has(track.variableId) && !focused
            && !Object.hasOwn(highlight.styleTypes || {}, 'background')) {
            track.styleRect.setAttribute('fill', focusColors.get(track.variableId));
            const label = indexTracks.find(item => item.variableId === track.variableId
              && item.index === (track.styleIndex ?? track.index));
            label?.rect.setAttribute('fill', focusColors.get(track.variableId));
          }
          window.ASMTraceRenderers?.updatePresentedHints?.(
            options.currentElements?.get?.(track.key), highlight, track.key
          );
        });
      },
      finish() {
        styleElapsed = Infinity;

        [...tracks, ...indexTracks].forEach(track => {
          const committed = track.steps.filter(step => step.mode !== 'ignored');
          const value = committed.length ? committed.at(-1).after : track.initial;
          if (track.rect) {
            const displayed = displayEventValue(value);
            if (track.applied !== displayed) {
              track.applied = displayed;
              track.currentValue = value;
              stylesDirty = true;
            }
          } else {
            apply(track, value);
          }
        });
        // Numeric completion does not gate destination-frame styles.
        stylesDirty = true;
      }
    };
  }

  function createAssignEffect(
    root, event, traceDocument, eventFrame, placements, elements,
    rawDeltas, appearingKeys, previousObjects, visualKeyForSource, liveElements = elements
  ) {
    const target = (event?.targets || []).find(item => item.role === 'target') || event?.targets?.[0];
    const source = (event?.targets || []).find(item => item.role === 'source');
    if (!target) return null;
    const operand = eventOperand(
      traceDocument, eventFrame, target, event?.payload?.after,
      placements, elements, visualKeyForSource, event
    );
    if (!operand) return null;
    // Older saved traces recorded container methods as a generic write. A
    // collection has no assignable scalar text: its first <text> is usually
    // the outerframe name, so never replace that label with an event value.
    if (!target.indexExpression && !Number.isInteger(target.resolvedIndex)
      && operand.element.querySelector?.('.outerframe-bg')) return null;
    const rawDelta = appearingKeys?.has?.(operand.visualKey)
      ? { x: 0, y: 0 }
      : (rawDeltas?.get?.(operand.visualKey) || { x: 0, y: 0 });
    const carrierDelta = operand.visualKey !== operand.logicalKey ? rawDelta : { x: 0, y: 0 };
    // A marker from the preceding scene can still own an early event in this
    // frame. Its saved clone is detached, so its CTM is not a usable anchor;
    // the captured previous placement already is in the root coordinate space.
    const operandLifetime = String(operand.element?.dataset?.traceRuntimeIdentity || '');
    const exitsLaterInFrame = operand.marker && operandLifetime && orderedEvents(eventFrame).some(candidate => (
      ['scope-exit', 'visual-exit'].includes(candidate?.type)
      && Number(candidate?.order) > Number(event?.order)
      && (candidate.targets || []).some(item => (
        String(item?.lifetimeIdentity || '') === operandLifetime
      ))
    ));
    const liveMarker = liveElements?.get?.(operand.visualKey) === operand.element
      && !exitsLaterInFrame;
    if (operand.marker && !liveMarker) {
      const bindingTarget = String(operand.element?.dataset?.traceBindingTarget || '');
      const bindingElement = liveElements?.get?.(bindingTarget)
        || elements?.get?.(bindingTarget)
        || (bindingTarget && typeof CSS !== 'undefined'
          ? root.querySelector(`[data-trace-object-key="${CSS.escape(bindingTarget)}"]`)
          : null);
      const bindingBounds = elementBoundsInRoot(bindingElement, root);
      const bindingPoint = bindingBounds ? {
        x: bindingBounds.x, y: bindingBounds.y,
        width: bindingBounds.width, height: bindingBounds.height
      } : comparisonPoint(placements, bindingTarget);
      if (bindingPoint) {
        operand.point = detachedMarkerPopupPoint(bindingPoint, operand.element);
      }
    }
    const markerAnchor = liveMarker ? operand.element : null;
    const markerBounds = markerAnchor
      ? elementBoundsInRoot(markerPopupAnchorElement({ ...operand, element: markerAnchor }), root)
      : null;
    let x = markerBounds
      ? markerAssignmentStart(
        markerBounds.x + markerBounds.width / 2,
        operand.point.x,
        rawDelta.x
      )
      : operand.point.x + (operand.marker
        ? Number(rawDelta.x) || 0
        : Number(carrierDelta.x) || 0);
    let y = markerBounds
      ? markerAssignmentStart(markerBounds.y, operand.point.y, rawDelta.y)
      : operand.point.y + (operand.marker
        ? Number(rawDelta.y) || 0
        : Number(carrierDelta.y) || 0);
    const beforeValue = displayEventValue(event?.payload?.before);
    const afterValue = displayEventValue(event?.payload?.after);
    const sourceValue = event?.payload?.source ?? event?.payload?.after;
    const sourceLabel = String(source?.expression || afterValue || '').trim();
    const sourceOperand = source
      ? eventOperand(
        traceDocument, eventFrame, source, sourceValue,
        placements, elements, visualKeyForSource, event
      )
      : null;
    const previousSourceVisual = sourceOperand
      ? previousVisualElement(previousObjects, sourceOperand.visualKey)
      : null;
    let popup = null;
    let markerIncomingText = null;
    let fallingText = null;
    let transfer = null;
    let targetText = null;
    let finalText = '';
    let originalOpacity = null;
    let landed = false;
    let popupScale = 1;

    if (operand.marker) {
      popup = createMarkerPopup(
        root,
        { ...operand, value: beforeValue },
        'asm-trace-assign-marker-popup'
      );
      markerIncomingText = createSvg('text', {
        class: 'asm-trace-assign-marker-source',
        x: 0,
        y: -popup.height / 2 - 20,
        'text-anchor': 'middle',
        'dominant-baseline': 'middle',
        'font-family': popup.text.getAttribute('font-family') || 'Arial',
        'font-size': popup.text.getAttribute('font-size') || 12,
        'font-weight': popup.text.getAttribute('font-weight') || 'bold',
        fill: popup.text.getAttribute('fill') || '#1f282d',
        opacity: 0,
        'pointer-events': 'none'
      }, sourceLabel);
      popup.group.append(markerIncomingText);
    } else {
      targetText = assignableTargetText(operand);
      finalText = afterValue;
      originalOpacity = targetText?.getAttribute?.('opacity');
      if (targetText) targetText.textContent = beforeValue;
      transfer = createAssignmentTransfer(
        root, sourceOperand, operand, sourceValue, previousSourceVisual
      );
      if (!transfer) {
        const targetY = y + operand.point.height / 2;
        fallingText = createSvg('text', {
          class: 'asm-trace-assign-falling-value',
          x,
          y: targetY - Math.max(24, operand.point.height * 0.8),
          'text-anchor': 'middle',
          'dominant-baseline': 'middle',
          'font-family': targetText?.getAttribute?.('font-family') || 'Arial',
          'font-size': targetText?.getAttribute?.('font-size') || Math.max(12, operand.point.height * 0.48),
          'font-weight': targetText?.getAttribute?.('font-weight') || 'normal',
          fill: targetText?.getAttribute?.('fill') || '#1f282d',
          opacity: 0,
          'pointer-events': 'none'
        }, afterValue);
        fallingText.dataset.targetY = String(targetY);
        appendBelowTextLayer(root, fallingText);
      }
    }

    function landValue() {
      if (landed) return;
      landed = true;
      if (targetText) targetText.textContent = finalText;
      if (popup) popup.text.textContent = afterValue;
      markerIncomingText?.setAttribute('opacity', '0');
      fallingText?.setAttribute('opacity', '0');
    }

    return {
      syncPosition() {
        if (!popup || !liveMarker) return;
        const visibleBounds = elementBoundsInRoot(markerPopupAnchorElement(operand), root);
        if (!visibleBounds) return;
        x = visibleBounds.x + visibleBounds.width / 2;
        y = visibleBounds.y;
        popup.group.setAttribute('transform', `translate(${x}, ${y}) scale(${popupScale})`);
      },
      update(elapsed) {
        const frameProgress = easeOutCubic(clamp01(elapsed / ASSIGN_TIMING.frame));
        const dropStart = operand.marker
          ? ASSIGN_TIMING.frame + ASSIGN_TIMING.valueHold
          : 0;
        const dropProgress = easeOutCubic(clamp01((elapsed - dropStart) / ASSIGN_TIMING.drop));
        const exitStart = ASSIGN_TIMING.frame
          + (operand.marker ? ASSIGN_TIMING.valueHold : 0)
          + ASSIGN_TIMING.drop + ASSIGN_TIMING.hold;
        const exit = elapsed > exitStart
          ? easeOutCubic(clamp01((elapsed - exitStart) / ASSIGN_TIMING.exit))
          : 0;
        if (popup) {
          popupScale = 0.82 + 0.18 * frameProgress;
          popup.group.setAttribute('opacity', String(frameProgress * (1 - exit)));
          popup.group.setAttribute(
            'transform',
            `translate(${x}, ${y}) scale(${popupScale})`
          );
          popup.text.setAttribute('opacity', String(frameProgress * (1 - exit)));
          if (markerIncomingText) {
            const sourceY = -popup.height / 2 - 20 * (1 - dropProgress);
            const sourceOpacity = dropProgress < 1
              ? Math.min(frameProgress, clamp01(dropProgress * 4)) * (1 - exit)
              : 0;
            markerIncomingText.setAttribute('y', String(sourceY));
            markerIncomingText.setAttribute('opacity', String(sourceOpacity));
          }
        }
        if (fallingText) {
          const targetY = Number(fallingText.dataset.targetY) || y;
          const startY = targetY - Math.max(24, operand.point.height * 0.8);
          fallingText.setAttribute('y', String(startY + (targetY - startY) * dropProgress));
          fallingText.setAttribute('opacity', String(dropProgress < 1 ? clamp01(dropProgress * 4) : 0));
        }
        transfer?.update(dropProgress, 1 - exit);
        if (dropProgress >= 1) landValue();
      },
      remove() {
        landValue();
        if (targetText) {
          if (originalOpacity == null) targetText.removeAttribute('opacity');
          else targetText.setAttribute('opacity', originalOpacity);
        }
        popup?.group.remove();
        fallingText?.remove();
        transfer?.remove();
      }
    };
  }

  function createSelfCompareSplit(operand, splitDistance, verticalGap = 0) {
    const original = operand?.element;
    const parent = original?.parentNode;
    if (!original || !parent) return null;
    const originalOpacity = original.getAttribute('opacity');
    const clones = [-1, 1].map(direction => {
      const wrapper = createSvg('g', {
        class: 'asm-trace-compare-self-clone',
        opacity: 0,
        'pointer-events': 'none'
      });
      const clone = original.cloneNode(true);
      [clone, ...clone.querySelectorAll('[id], [data-trace-object-key]')].forEach(node => {
        node.removeAttribute?.('id');
        node.removeAttribute?.('data-trace-object-key');
      });
      clone.classList.remove('selected', 'draggable-object', 'asm-trace-selectable');
      clone.querySelectorAll('animate, animateTransform, animateMotion').forEach(node => node.remove());
      wrapper.append(clone);
      parent.insertBefore(wrapper, original.nextSibling);
      return { direction, wrapper, clone };
    });
    return {
      clones,
      update(lift, split, stay) {
        const amount = split * stay;
        original.setAttribute('opacity', String(1 - amount));
        clones.forEach(item => {
          item.wrapper.setAttribute('opacity', String(amount));
          item.wrapper.setAttribute(
            'transform',
            `translate(${item.direction * splitDistance * amount}, ${(-15 * lift + item.direction * verticalGap * split) * stay})`
          );
        });
      },
      remove() {
        if (originalOpacity == null) original.removeAttribute('opacity');
        else original.setAttribute('opacity', originalOpacity);
        clones.forEach(item => item.wrapper.remove());
      }
    };
  }

  function promoteCompareElements(operands) {
    const promoted = [];
    const seen = new Set();
    operands.forEach(operand => {
      const element = operand?.element;
      const parent = element?.parentNode;
      if (operand?.marker || !element || !parent || seen.has(element)) return;
      seen.add(element);
      const placeholder = document.createComment('asm-trace-compare-order');
      parent.insertBefore(placeholder, element);
      parent.append(element);
      promoted.push({ element, parent, placeholder });
    });
    return {
      remove() {
        promoted.forEach(({ element, parent, placeholder }) => {
          if (placeholder.parentNode === parent && element.parentNode === parent) {
            parent.insertBefore(element, placeholder);
          }
          placeholder.remove();
        });
        promoted.length = 0;
      }
    };
  }

  function markerTargetAtCheckpoint(traceDocument, eventFrame, element, checkpoint) {
    const target = String(element?.dataset?.traceBindingTarget || '');
    const parts = markerTargetParts(target);
    const expression = String(element?.dataset?.traceMarkerIndexExpression || '');
    if (!parts || !expression || !checkpoint?.beforeState) return target;
    const locals = {};
    markerSourceVariableIds(element).forEach(variableId => {
      const key = eventTargetKey(traceDocument, eventFrame, { variableId });
      const stateKey = `value:${key}`;
      if (!Object.prototype.hasOwnProperty.call(checkpoint.beforeState, stateKey)) return;
      const name = traceDocument?.variables?.[variableId]?.name;
      if (name) locals[name] = displayEventValue(checkpoint.beforeState[stateKey]);
    });
    const raw = window.ASMTraceRules?.resolveExpression?.(traceDocument, eventFrame, expression, locals);
    const index = raw == null || raw === '' ? NaN : Number(raw);
    return Number.isInteger(index) ? `${parts.prefix}#${index}` : `unresolved:${parts.prefix}`;
  }

  function createCompareEffect(
    root, event, traceDocument, eventFrame, placements, elements,
    visualKeyForSource, positionAdjustments, bindingTargetForMarker
  ) {
    const color = COMPARE_COLORS[String(event?.result === true)];
    const values = [event?.payload?.left, event?.payload?.right];
    const rawOperands = (event?.targets || []).slice(0, 2).map((target, index) => (
      eventOperand(traceDocument, eventFrame, target, values[index], placements, elements, visualKeyForSource)
    )).filter(Boolean);
    const compareBeforeLayout = new Map();
    const operands = rawOperands.map((operand, index) => {
      const adjustment = typeof positionAdjustments === 'function'
        ? positionAdjustments(operand)
        : positionAdjustments?.get?.(operand.visualKey);
      const point = operand.marker && adjustment
        ? {
          ...operand.point,
          x: operand.point.x + (Number(adjustment.x) || 0),
          y: operand.point.y + (Number(adjustment.y) || 0)
        }
        : { ...operand.point };
      compareBeforeLayout.set(`${operand.visualKey}:${index}`, point);
      return { ...operand, point };
    });
    const equalValues = compareValuesEqual(operands);
    const equalityComparison = ['==', '!='].includes(String(event?.operation || ''));
    let contactTargets = equalityComparison ? compareContactTargets(operands, equalValues) : [];
    const scaleTargets = equalityComparison ? operands.map(() => 1) : compareScaleTargets(operands);
    const selfCompare = operands.length >= 2 && operands[0].visualKey === operands[1].visualKey;
    const selfSplitDistance = selfCompare
      ? Math.max(8, operands[0].point.width / 2)
      : 0;
    const highlights = [];
    const popups = new Map();
    const promotedElements = promoteCompareElements(operands);
    const selfSplit = selfCompare && !operands[0].marker
      ? createSelfCompareSplit(operands[0], selfSplitDistance, equalValues ? 0 : 5)
      : null;
    let expression = null;
    let compareElapsed = 0;
    let popupStartsSynchronized = !operands.some(operand => operand.marker);
    let popupStartsLocked = popupStartsSynchronized;
    let attachedTop = Infinity;
    elements?.forEach?.((element, key) => {
      if (!element?.dataset?.traceSourceVariableId) return;
      const targetKey = bindingTargetForMarker?.(element) ?? element.dataset.traceBindingTarget;
      if (!operands.some(operand => operand.logicalKey === targetKey)) return;
      const point = comparisonPoint(placements, key);
      if (!point) return;
      const adjustment = typeof positionAdjustments === 'function'
        ? positionAdjustments({ visualKey: key, element, marker: true })
        : positionAdjustments?.get?.(key);
      attachedTop = Math.min(attachedTop, point.y + (Number(adjustment?.y) || 0));
    });
    const expressionTop = (Number.isFinite(attachedTop)
      ? attachedTop
      : Math.min(...operands.map(operand => operand.point.y))) - 30;

    const popupKey = (operand, index) => selfCompare
      ? `${operand.visualKey}:${index}`
      : operand.visualKey;

    function ensurePopups() {
      operands.forEach((operand, index) => {
        if (!operand.marker) return;
        const key = popupKey(operand, index);
        if (!popups.has(key)) popups.set(key, createMarkerPopup(root, operand));
      });
    }

    function showResult() {
      if (!highlights.length) {
        if (selfSplit) {
          selfSplit.clones.forEach(item => {
            const highlight = addHighlight(item.clone, color);
            if (highlight) highlights.push(highlight);
          });
        } else {
          const highlighted = new Set();
          operands.filter(operand => !operand.marker).forEach(operand => {
            if (highlighted.has(operand.visualKey)) return;
            highlighted.add(operand.visualKey);
            const highlight = addHighlight(operand.element, color);
            if (highlight) highlights.push(highlight);
          });
        }
      }
      popups.forEach(popup => popup.rect.setAttribute('stroke', color));
      if (!expression) expression = createComparisonExpression(root, event, operands, color, expressionTop);
    }

    function setResultOpacity(opacity) {
      const value = String(clamp01(opacity));
      highlights.forEach(highlight => highlight.setAttribute('opacity', value));
      expression?.setAttribute('opacity', value);
    }

    return {
      adjustments: new Map(),
      logicalAdjustments: new Map(),
      syncPosition() {
        if (popupStartsLocked) return;
        const waitEnd = COMPARE_TIMING.popup + COMPARE_TIMING.wait;
        let changed = false;
        operands.forEach(operand => {
          if (!operand.marker) return;
          const bounds = elementBoundsInRoot(markerPopupAnchorElement(operand), root);
          if (!bounds) return;
          operand.point = {
            ...operand.point,
            x: bounds.x + bounds.width / 2,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height
          };
          changed = true;
        });
        if (!changed) return;
        popupStartsSynchronized = true;
        contactTargets = equalityComparison ? compareContactTargets(operands, equalValues) : [];

        const popupReveal = easeOutCubic(clamp01(compareElapsed / COMPARE_TIMING.popup));
        const sizeElapsed = Math.max(0, compareElapsed - waitEnd);
        const alignProgress = equalityComparison
          ? easeOutCubic(clamp01(sizeElapsed / (COMPARE_TIMING.size / 2)))
          : 0;
        const contactProgress = equalityComparison
          ? easeOutCubic(clamp01((sizeElapsed - COMPARE_TIMING.size / 2) / (COMPARE_TIMING.size / 2)))
          : 0;
        operands.forEach((operand, index) => {
          const popup = popups.get(popupKey(operand, index));
          if (!popup) return;
          const contact = contactTargets[index] || { x: 0, alignY: 0, splitY: 0 };
          popup.group.setAttribute('opacity', String(popupReveal));
          popup.group.setAttribute(
            'transform',
            `translate(${operand.point.x + contact.x * contactProgress}, ${operand.point.y + contact.alignY * alignProgress + contact.splitY * contactProgress}) scale(${0.82 + 0.18 * popupReveal})`
          );
        });
        if (compareElapsed >= waitEnd) popupStartsLocked = true;
      },
      update(elapsed) {
        compareElapsed = elapsed;
        const popupEnd = COMPARE_TIMING.popup;
        const waitEnd = popupEnd + COMPARE_TIMING.wait;
        const sizeEnd = waitEnd + COMPARE_TIMING.size;
        const resultEnd = sizeEnd + COMPARE_TIMING.result;
        const resetEnd = resultEnd + COMPARE_TIMING.reset;
        const popupReveal = easeOutCubic(clamp01(elapsed / COMPARE_TIMING.popup));
        const lift = popupReveal;
        const size = elapsed < waitEnd
          ? 0
          : easeOutCubic(clamp01((elapsed - waitEnd) / COMPARE_TIMING.size));
        const sizeElapsed = Math.max(0, elapsed - waitEnd);
        const alignProgress = equalityComparison
          ? easeOutCubic(clamp01(sizeElapsed / (COMPARE_TIMING.size / 2)))
          : size;
        const contactProgress = equalityComparison
          ? easeOutCubic(clamp01((sizeElapsed - COMPARE_TIMING.size / 2) / (COMPARE_TIMING.size / 2)))
          : size;
        const reset = elapsed < resultEnd
          ? 0
          : easeOutCubic(clamp01((elapsed - resultEnd) / COMPARE_TIMING.reset));
        ensurePopups();
        if (elapsed >= waitEnd) {
          showResult();
          setResultOpacity(size * (1 - reset));
        }
        const stay = 1 - reset;
        this.adjustments.clear();
        this.logicalAdjustments.clear();
        operands.forEach((operand, index) => {
          const contact = contactTargets[index] || { x: 0, alignY: 0, splitY: 0 };
          const adjustment = {
            x: operand.marker ? 0 : contact.x * contactProgress * stay,
            y: operand.marker ? 0 : (equalityComparison
              ? (contact.alignY * alignProgress + contact.splitY * contactProgress) * stay
              : (-15 * lift) * stay),
            scale: operand.marker
              ? 1
              : 1 + ((scaleTargets[index] || 1) - 1) * size * stay
          };
          this.adjustments.set(operand.visualKey, adjustment);
          this.logicalAdjustments.set(operand.logicalKey, adjustment);
          const popup = popups.get(popupKey(operand, index));
          if (popup) {
            const popupScale = 0.82 + 0.18 * popupReveal;
            const popupOpacity = (popupStartsSynchronized ? popupReveal : 0) * stay;
            const splitX = contact.x * contactProgress * stay;
            const contactY = equalityComparison
              ? (contact.alignY * alignProgress + contact.splitY * contactProgress) * stay
              : 0;
            const compareScale = 1 + ((scaleTargets[index] || 1) - 1) * size * stay;
            popup.group.setAttribute('opacity', String(popupOpacity));
            popup.group.setAttribute(
              'transform',
              `translate(${operand.point.x + splitX}, ${operand.point.y + contactY}) scale(${popupScale * compareScale})`
            );
          }
        });
        selfSplit?.update(lift, equalityComparison ? contactProgress : size, stay);
        elements?.forEach?.((element, key) => {
          const targetKey = bindingTargetForMarker?.(element) ?? element?.dataset?.traceBindingTarget;
          if (!targetKey || !this.logicalAdjustments.has(targetKey)) return;
          const target = this.logicalAdjustments.get(targetKey);
          this.adjustments.set(key, { x: target.x, y: target.y, scale: 1 });
        });
        if (elapsed >= resetEnd) this.remove();
      },
      remove() {
        highlights.forEach(highlight => highlight.remove());
        expression?.remove();
        popups.forEach(popup => popup.group.remove());
        selfSplit?.remove();
        promotedElements.remove();
        highlights.length = 0;
        expression = null;
        popups.clear();
        compareBeforeLayout.clear();
        this.adjustments.clear();
        this.logicalAdjustments.clear();
      }
    };
  }

  function createTruthyCompareEffect(event, traceDocument, eventFrame, placements, elements,
    visualKeyForSource) {
    const target = event?.targets?.[0];
    const operand = target && eventOperand(traceDocument, eventFrame, target,
      event?.payload?.value, placements, elements, visualKeyForSource);
    // A single-value condition has no second operand to meet. Enlarge its
    // visible cell in place and color the result border from the captured
    // truth value; the cell's pointers follow the presented geometry.
    const color = COMPARE_COLORS[String(event?.result === true)];
    const highlight = operand ? addHighlight(operand.element, color) : null;
    const adjustments = new Map();
    if (highlight) {
      highlight.classList.add('asm-trace-truthy-highlight');
      highlight.setAttribute('opacity', '0');
    }
    return {
      adjustments,
      logicalAdjustments: new Map(),
      update(elapsed) {
        if (!highlight) return;
        const waitEnd = COMPARE_TIMING.popup + COMPARE_TIMING.wait;
        const resultEnd = waitEnd + COMPARE_TIMING.size + COMPARE_TIMING.result;
        const reveal = easeOutCubic(clamp01(elapsed / COMPARE_TIMING.popup));
        const size = elapsed < waitEnd ? 0
          : easeOutCubic(clamp01((elapsed - waitEnd) / COMPARE_TIMING.size));
        const reset = elapsed < resultEnd ? 0
          : easeOutCubic(clamp01((elapsed - resultEnd) / COMPARE_TIMING.reset));
        const stay = 1 - reset;
        highlight.setAttribute('opacity', String(reveal * stay));
        adjustments.set(operand.visualKey, {
          x: 0, y: 0, scale: 1 + COMPARE_SCALE_DELTA * size * stay
        });
        if (elapsed >= COMPARE_DURATION) this.remove();
      },
      remove() { highlight?.remove(); adjustments.clear(); }
    };
  }

  function eventAnimation(document, type) {
    return window.ASMTraceEvents?.animation?.(type) || 'none';
  }

  function orderedEvents(frame) {
    const shared = window.ASMTraceEvents?.ordered?.(frame?.events || []);
    if (Array.isArray(shared)) return shared;
    return (frame?.events || []).map((event, index) => {
      const explicitOrder = Number(event?.order);
      const idOrder = String(event?.id || '').match(/^event-(\d+)$/);
      return {
        event,
        index,
        order: Number.isFinite(explicitOrder)
          ? explicitOrder
          : (idOrder ? Number(idOrder[1]) : Number.MAX_SAFE_INTEGER)
      };
    }).sort((left, right) => left.order - right.order || left.index - right.index)
      .map(item => item.event);
  }

  function isForInitializerAssignment(event) {
    if (event?.type !== 'assign') return false;
    if (event.forInitializer === true) return true;
    const from = Number(event?.source?.from);
    const to = Number(event?.source?.to);
    if (!Number.isFinite(from) || !Number.isFinite(to)) return false;
    return (event.source?.contexts || []).some(context => (
      context?.type === 'ForStatement'
      && Number.isFinite(Number(context?.headerFrom))
      && Number.isFinite(Number(context?.conditionFrom))
      && from >= Number(context.headerFrom)
      && to <= Number(context.conditionFrom)
    ));
  }

  function isDeclarationInitializerAssignment(event) {
    return event?.type === 'assign' && (
      event.declarationInitializer === true
      || event.forInitializer === true
      || (event.parameterInitializer !== true
        && event?.payload?.before == null
        && Object.prototype.hasOwnProperty.call(event?.payload || {}, 'after'))
    );
  }

  function updateTargetsMarker(event, elements, eventFrame = null, previousObjects = null) {
    // A declaration initializer in a for header is a pointer-position event,
    // just like ++/--. Use semantic trace/AST metadata instead of matching the
    // source spelling, so old saved traces and all three playback surfaces
    // select the same position-only animation without an assignment value box.
    // A declaration initializer already determines the marker's first real
    // position. Enter there directly instead of showing an assignment box or
    // briefly parking the new marker beside the array first.
    if (isForInitializerAssignment(event)) return true;
    if (isDeclarationInitializerAssignment(event)) {
      return Boolean(assignmentTargetMarker(event, elements, eventFrame, previousObjects));
    }
    if (event?.type !== 'write' || event.update !== true) return false;
    for (const [, element] of elements || []) {
      if (!(event.targets || []).some(target => markerMatchesEventTarget(element, target))) continue;
      return true;
    }
    return false;
  }

  function markerSourceVariableIds(element) {
    try {
      const parsed = JSON.parse(element?.dataset?.traceSourceVariableIds || '[]');
      if (Array.isArray(parsed) && parsed.length) return parsed.filter(Boolean);
    } catch (error) {
      // Older traces only carry the primary source variable.
    }
    return element?.dataset?.traceSourceVariableId
      ? [element.dataset.traceSourceVariableId]
      : [];
  }

  function markerDependsOnVariable(element, variableId) {
    return Boolean(variableId) && markerSourceVariableIds(element).includes(variableId);
  }

  function retainedSnapshotVisual(element) {
    return Boolean(element?.dataset?.traceSnapshotOwner
      || element?.closest?.('[data-trace-snapshot]'));
  }

  function markerMatchesEventTarget(element, target) {
    if (!element?.dataset?.traceSourceVariableId || retainedSnapshotVisual(element)) return false;
    if (!markerDependsOnVariable(element, target?.variableId)) return false;
    const targetGeneration = Number(target?.sceneGeneration);
    const visualGeneration = Number(element.dataset.traceSceneGeneration);
    if (Number.isFinite(targetGeneration) && Number.isFinite(visualGeneration)
      && targetGeneration !== visualGeneration) return false;
    const lifetime = String(target?.lifetimeIdentity || '');
    return !lifetime || String(element.dataset.traceRuntimeIdentity || '') === lifetime;
  }

  function visualMatchesScopeExitTarget(element, target) {
    if (!element || retainedSnapshotVisual(element)) return false;
    const lifetime = String(target?.lifetimeIdentity || '');
    if (element.dataset?.traceSourceVariableId) {
      return markerMatchesEventTarget(element, target);
    }
    if (String(element.dataset?.traceVariable || '') !== String(target?.variableId || '')) return false;
    return !lifetime || String(element.dataset?.traceRuntimeLifetime || '') === lifetime;
  }

  function markerDeclaredInFrame(eventFrame, element) {
    // A marker rendered inside @keep is frozen playback state. A declaration
    // on the live frame may reuse the same C++ variable id, but it must not
    // restart or retarget the retained marker.
    if (retainedSnapshotVisual(element)) return false;
    return orderedEvents(eventFrame).some(event => (
      event?.type === 'declare'
      && (event.targets || []).some(target => target?.role !== 'source'
        && markerMatchesEventTarget(element, target))
    ));
  }

  function assignmentTargetMarker(event, elements, eventFrame = null, previousObjects = null) {
    if (event?.type !== 'assign') return null;
    const target = (event.targets || []).find(item => item.role === 'target') || event.targets?.[0];
    if (!target?.variableId) return null;
    const domains = previousObjects ? [elements, previousObjects] : [elements];
    for (const domain of domains) for (const [key, element] of domain || []) {
      if (markerMatchesEventTarget(element, target)
        && markerLifetimeActiveAtEvent(eventFrame, event, element)) {
        return { key, element, target };
      }
    }
    return null;
  }

  function eventMutatesVariable(event, variableId) {
    if (!variableId || !['assign', 'write'].includes(event?.type)) return false;
    const targets = event?.targets || [];
    if (event.type === 'assign') {
      const target = targets.find(item => item.role === 'target') || targets[0];
      return target?.variableId === variableId;
    }
    return targets.some(target => target?.variableId === variableId && target.role !== 'source');
  }

  function variableChangedBeforeEvent(eventFrame, currentEvent, variableId) {
    const events = orderedEvents(eventFrame);
    const currentIndex = events.indexOf(currentEvent);
    if (currentIndex <= 0) return false;
    return events.slice(0, currentIndex)
      .some(event => eventMutatesVariable(event, variableId));
  }

  function markerTargetDelta(marker, value, placements) {
    const currentTargetKey = String(marker?.element?.dataset?.traceBindingTarget || '');
    const separator = currentTargetKey.lastIndexOf('#');
    const index = Number(displayEventValue(value));
    if (separator < 0 || !Number.isInteger(index)) return null;
    const currentTarget = placements?.get?.(currentTargetKey);
    const nextTarget = placements?.get?.(`${currentTargetKey.slice(0, separator)}#${index}`);
    if (!currentTarget || !nextTarget) return null;
    return {
      x: (Number(nextTarget.x) || 0) + (Number(nextTarget.width) || 0) / 2
        - (Number(currentTarget.x) || 0) - (Number(currentTarget.width) || 0) / 2,
      y: (Number(nextTarget.y) || 0) - (Number(currentTarget.y) || 0)
    };
  }

  function markerTargetParts(targetKey) {
    const source = String(targetKey || '');
    const separator = source.lastIndexOf('#');
    const index = Number(source.slice(separator + 1));
    return separator >= 0 && Number.isInteger(index)
      ? { prefix: source.slice(0, separator), index }
      : null;
  }

  function markerTargetPoint(targetKey, placements) {
    const direct = placements?.get?.(targetKey);
    if (direct) {
      return {
        x: (Number(direct.x) || 0) + (Number(direct.width) || 0) / 2,
        y: Number(direct.y) || 0
      };
    }
    const requested = markerTargetParts(targetKey);
    if (!requested) return null;
    const siblings = [];
    placements?.forEach?.((placement, key) => {
      const parts = markerTargetParts(key);
      if (!parts || parts.prefix !== requested.prefix) return;
      siblings.push({
        index: parts.index,
        x: (Number(placement.x) || 0) + (Number(placement.width) || 0) / 2,
        y: Number(placement.y) || 0,
        width: Number(placement.width) || 40
      });
    });
    siblings.sort((left, right) => left.index - right.index);
    if (!siblings.length) return null;
    const nearest = [...siblings].sort((left, right) => (
      Math.abs(left.index - requested.index) - Math.abs(right.index - requested.index)
    ))[0];
    const neighbor = siblings.find(item => item.index !== nearest.index);
    const stepX = neighbor
      ? (neighbor.x - nearest.x) / (neighbor.index - nearest.index)
      : nearest.width;
    const stepY = neighbor
      ? (neighbor.y - nearest.y) / (neighbor.index - nearest.index)
      : 0;
    return {
      x: nearest.x + stepX * (requested.index - nearest.index),
      y: nearest.y + stepY * (requested.index - nearest.index)
    };
  }

  function markerTargetGeometry(targetKey, placements) {
    const direct = placements?.get?.(targetKey);
    if (direct) {
      return {
        x: (Number(direct.x) || 0) + (Number(direct.width) || 0) / 2,
        y: Number(direct.y) || 0,
        width: Number(direct.width) || 40,
        height: Number(direct.height) || 40
      };
    }
    const point = markerTargetPoint(targetKey, placements);
    const requested = markerTargetParts(targetKey);
    if (!point || !requested) return null;
    let nearest = null;
    placements?.forEach?.((placement, key) => {
      const parts = markerTargetParts(key);
      if (!parts || parts.prefix !== requested.prefix) return;
      if (!nearest || Math.abs(parts.index - requested.index) < nearest.distance) {
        nearest = {
          distance: Math.abs(parts.index - requested.index),
          width: Number(placement.width) || 40,
          height: Number(placement.height) || 40
        };
      }
    });
    return {
      ...point,
      width: nearest?.width || 40,
      height: nearest?.height || 40
    };
  }

  function markerTargetIsRenderable(targetKey, placements) {
    return Boolean(targetKey && markerTargetGeometry(targetKey, placements));
  }

  function markerArrowPath(entry, state) {
    if (!entry?.markerPointPath || !state) return '';
    const labelTop = Number(entry.markerLabelBox?.getAttribute?.('y')) || -40;
    const labelHeight = Number(entry.markerLabelBox?.getAttribute?.('height')) || 18;
    const arrowTop = labelTop + labelHeight;
    const directionX = (Number(state.targetX) || 0) - (Number(state.x) || 0);
    const directionY = (Number(state.targetY) || 0) - (Number(state.y) || 0) - arrowTop;
    const directionLength = Math.max(0.001, Math.hypot(directionX, directionY));
    const unitX = directionX / directionLength;
    const unitY = directionY / directionLength;
    const perpendicularX = -unitY;
    const perpendicularY = unitX;
    const arrowLength = 20;
    const pointerX = unitX * arrowLength;
    const pointerY = arrowTop + unitY * arrowLength;
    const headLength = 6;
    const headHalfWidth = 3;
    const headBaseX = pointerX - unitX * headLength;
    const headBaseY = pointerY - unitY * headLength;
    const headLeftX = headBaseX + perpendicularX * headHalfWidth;
    const headLeftY = headBaseY + perpendicularY * headHalfWidth;
    const headRightX = headBaseX - perpendicularX * headHalfWidth;
    const headRightY = headBaseY - perpendicularY * headHalfWidth;
    return `M 0 ${arrowTop} L ${pointerX} ${pointerY} M ${headLeftX} ${headLeftY} L ${pointerX} ${pointerY} L ${headRightX} ${headRightY}`;
  }

  function markerForMotionSlot(slot, elements) {
    return markersForMotionSlot(slot, elements)[0] || null;
  }

  function markersForMotionSlot(slot, elements, eventFrame = null) {
    if (!['assign', 'position', 'declare'].includes(slot.animation)) return [];
    const targets = slot.event?.targets || [];
    const variableIds = new Set(targets
      .filter(target => target?.role !== 'source')
      .map(target => target?.variableId)
      .filter(Boolean));
    const markers = [];
    for (const [key, element] of elements || []) {
      const target = targets.find(item => (
        item?.role !== 'source' && markerMatchesEventTarget(element, item)
          && markerLifetimeActiveAtEvent(eventFrame, slot.event, element)
      ));
      if (!target || !variableIds.has(target.variableId)) continue;
      markers.push({ key, element, target });
    }
    return markers;
  }

  function markersForLogicalEvent(event, elements, eventFrame = null) {
    if (!['assign', 'write'].includes(event?.type)) return [];
    const targets = event?.targets || [];
    const markers = [];
    for (const [key, element] of elements || []) {
      const target = targets.find(item => (
        item?.role !== 'source'
        && eventMutatesVariable(event, item?.variableId)
        && markerMatchesEventTarget(element, item)
        && markerLifetimeActiveAtEvent(eventFrame, event, element)
      ));
      if (target) markers.push({ key, element, target });
    }
    return markers;
  }

  function markerAssignmentMotion(
    traceDocument, eventFrame, eventTimeline, placements, elements, markerEntries = [],
    frameReflow = {}
  ) {
    const metadata = new Map();
    markerEntries.forEach(entry => {
      if (!entry.markerPointPath) return;
      const currentTarget = String(entry.element?.dataset?.traceBindingTarget || '');
      const targetParts = markerTargetParts(currentTarget);
      const finalBase = elementTranslation(entry.element);
      if (!targetParts || !finalBase) return;
      const previousBase = elementTranslation(entry.previousVisual);
      const labelWidth = Number(entry.markerLabelBox?.getAttribute?.('width')) || 18;
      metadata.set(entry.key, {
        key: entry.key,
        variableId: String(entry.element.dataset.traceSourceVariableId || ''),
        variableIds: markerSourceVariableIds(entry.element),
        indexExpression: String(entry.element.dataset.traceMarkerIndexExpression || ''),
        sortKey: String(entry.element.dataset.traceMarkerSortKey || entry.key),
        currentTarget,
        previousTarget: String(
          entry.previousVisual?.dataset?.traceBindingTarget
          || entry.markerPreviousTarget
          || ''
        ),
        previousBase,
        previousUnresolvedTarget: entry.previousVisual?.dataset?.traceMarkerUnresolved === '1'
          ? {
            targetX: Number(entry.previousVisual.dataset.traceMarkerTargetX),
            targetY: Number(entry.previousVisual.dataset.traceMarkerTargetY)
          }
          : null,
        finalBase,
        labelWidth,
        baseCellWidth: Math.max(
          1,
          Number(entry.element.dataset.traceMarkerBaseCellWidth) || 40
        ),
        bias: { x: 0, y: 0 }
      });
    });
    if (!metadata.size) {
      const adjustments = new Map();
      const arrowStates = new Map();
      return {
        adjustments,
        arrowStates,
        committedTargets: new Map(),
        update() {},
        finish() {},
        reset() {}
      };
    }

    const timelineSlotByEvent = new Map(eventTimeline.map(slot => [slot.event, slot]));
    const replayEvents = frameReflow.replayPlan?.checkpoints
      ?.filter(checkpoint => checkpoint.mode !== 'ignored')
      .map(checkpoint => checkpoint.event)
      .filter(Boolean);
    const logicalEvents = replayEvents || orderedEvents(eventFrame)
      .filter(event => event?.loopBoundarySuppressed !== true);
    eventTimeline.forEach(slot => {
      if (slot.event && !logicalEvents.includes(slot.event)) logicalEvents.push(slot.event);
    });
    let logicalCursor = 0;
    const logicalMotionSlots = logicalEvents.map(event => {
      const visibleSlot = timelineSlotByEvent.get(event);
      const slot = visibleSlot || {
        event,
        animation: 'assign',
        start: logicalCursor,
        motionStart: logicalCursor,
        end: logicalCursor,
        logicalOnly: true
      };
      const markers = visibleSlot
        ? markersForMotionSlot(slot, elements, eventFrame)
        : markersForLogicalEvent(event, elements, eventFrame);
      if (visibleSlot) logicalCursor = Math.max(logicalCursor, Number(visibleSlot.end) || 0);
      return {
        slot,
        markers: markers.filter(marker => metadata.has(marker.key))
      };
    }).filter(item => item.markers.length);

    const finalState = new Map([...metadata].map(([key, item]) => [key, item.currentTarget]));
    const initialState = new Map(finalState);
    metadata.forEach((item, key) => {
      if (item.previousUnresolvedTarget && item.previousBase) initialState.set(key, `unresolved:${key}`);
      else if (markerTargetParts(item.previousTarget)) initialState.set(key, item.previousTarget);
    });
    const markerTargetForEvent = (item, slot, phase) => {
      const parts = markerTargetParts(item.currentTarget);
      if (!parts) return '';
      const target = (slot.event?.targets || []).find(candidate => (
        candidate?.role !== 'source' && item.variableIds.includes(candidate?.variableId)
      ));
      const variableName = traceDocument?.variables?.[target?.variableId]?.name;
      const value = displayEventValue(slot.event?.payload?.[phase]);
      // A missing before/after snapshot is not permission to fall back to the
      // frame's final value. That made a newly-entering marker start from the
      // last assignment in the frame and visually skip earlier movements.
      if (value === '') return phase === 'before'
        ? `unresolved:${parts.prefix}`
        : '';
      const locals = variableName ? { [variableName]: value } : {};
      const rawResolved = window.ASMTraceRules?.resolveExpression?.(
        traceDocument, eventFrame, item.indexExpression || item.sortKey, locals
      );
      const resolved = rawResolved == null ? NaN : Number(rawResolved);
      return Number.isInteger(resolved) ? `${parts.prefix}#${resolved}` : '';
    };
    const initializedMarkers = new Set();
    logicalMotionSlots.forEach(({ slot, markers }) => {
      if (slot.animation === 'declare') return;
      markers.forEach(marker => {
        const item = metadata.get(marker.key);
        if (item?.previousTarget || item?.previousUnresolvedTarget) return;
        if (initializedMarkers.has(marker.key)) return;
        const beforeTarget = markerTargetForEvent(item, slot, 'before');
        const afterTarget = markerTargetForEvent(item, slot, 'after');
        const initialTarget = beforeTarget || afterTarget;
        if (!initialTarget) return;
        initialState.set(marker.key, initialTarget);
        initializedMarkers.add(marker.key);
      });
    });

    // Hidden declarations do not occupy a slot yet. Their insertion must
    // reflow the peers that exist at that execution point, not last frame.
    logicalMotionSlots.filter(({ slot }) => slot.animation === 'declare')
      .forEach(({ slot, markers }) => markers.forEach(marker => {
        if (!slot.continuingVisualKeys?.has(marker.key)) initialState.delete(marker.key);
      }));

    const positionsForState = state => {
      const groups = new Map();
      const positions = new Map();
      state.forEach((targetKey, key) => {
        const item = metadata.get(key);
        if (targetKey === `unresolved:${key}` && item?.previousBase && item.previousUnresolvedTarget) {
          positions.set(key, { ...item.previousBase, ...item.previousUnresolvedTarget });
          return;
        }
        if (!metadata.has(key)) return;
        if (String(targetKey).startsWith('unresolved:')) {
          if (!groups.has(targetKey)) groups.set(targetKey, []);
          groups.get(targetKey).push(metadata.get(key));
          return;
        }
        if (!markerTargetParts(targetKey)) return;
        if (!groups.has(targetKey)) groups.set(targetKey, []);
        groups.get(targetKey).push(metadata.get(key));
      });
      groups.forEach((group, targetKey) => {
        const unresolvedPrefix = String(targetKey).startsWith('unresolved:')
          ? String(targetKey).slice('unresolved:'.length)
          : '';
        if (unresolvedPrefix) {
          const candidates = [];
          placements?.forEach?.((placement, key) => {
            const parts = markerTargetParts(key);
            if (!parts || parts.prefix !== unresolvedPrefix) return;
            candidates.push({ placement, index: parts.index });
          });
          candidates.sort((left, right) => (
            (Number(left.placement.x) || 0) - (Number(right.placement.x) || 0)
            || (Number(left.placement.y) || 0) - (Number(right.placement.y) || 0)
            || left.index - right.index
          ));
          const reference = candidates[0]?.placement;
          if (!reference) return;
          group.sort((left, right) => (
            left.sortKey.localeCompare(right.sortKey, 'en', { numeric: true, sensitivity: 'base' })
            || left.key.localeCompare(right.key)
          ));
          const gap = 8;
          const totalWidth = group.reduce((sum, item) => sum + item.labelWidth, 0)
            + Math.max(0, group.length - 1) * gap;
          let cursor = (Number(reference.x) || 0) - gap - totalWidth;
          group.forEach(item => {
            const x = cursor + item.labelWidth / 2;
            positions.set(item.key, {
              x: x + item.bias.x,
              y: (Number(reference.y) || 0) + item.bias.y,
              // There is no real cell target yet. Keep the temporary arrow
              // vertical beneath its own parked label.
              targetX: x + item.bias.x,
              targetY: (Number(reference.y) || 0) + (Number(reference.height) || 0) / 2
            });
            cursor += item.labelWidth + gap;
          });
          return;
        }
        const target = markerTargetGeometry(targetKey, placements);
        if (!target) return;
        group.sort((left, right) => (
          left.sortKey.localeCompare(right.sortKey, 'en', { numeric: true, sensitivity: 'base' })
          || left.key.localeCompare(right.key)
        ));
        const gap = 8;
        const totalWidth = group.reduce((sum, item) => sum + item.labelWidth, 0)
          + Math.max(0, group.length - 1) * gap;
        const keepArrowsVertical = group.length > 1
          && target.width >= group[0].baseCellWidth * 2 - 0.5;
        let cursor = -totalWidth / 2;
        group.forEach(item => {
          const offsetX = cursor + item.labelWidth / 2;
          positions.set(item.key, {
            x: target.x + offsetX + item.bias.x,
            y: target.y + item.bias.y,
            targetX: keepArrowsVertical ? target.x + offsetX : target.x,
            targetY: target.y + target.height / 2
          });
          cursor += item.labelWidth + gap;
        });
      });
      return positions;
    };

    const unbiasedFinal = positionsForState(finalState);
    metadata.forEach(item => {
      const expected = unbiasedFinal.get(item.key);
      if (!expected) return;
      item.bias = {
        x: item.finalBase.x - expected.x,
        y: item.finalBase.y - expected.y
      };
    });

    const state = new Map(initialState);
    const initialPositions = positionsForState(state);
    const settledFramePositions = new Map(
      [...initialPositions].map(([key, point]) => [key, { ...point }])
    );
    metadata.forEach((item, key) => {
      if (!item.previousBase || !initialPositions.has(key)) return;
      initialPositions.set(key, {
        ...initialPositions.get(key),
        // Keep a parked marker's arrow with its previous visual until its
        // assignment motion begins; it has no real cell binding to resolve.
        ...(item.previousUnresolvedTarget
          && Object.values(item.previousUnresolvedTarget).every(Number.isFinite)
          ? item.previousUnresolvedTarget : {}),
        x: item.previousBase.x,
        y: item.previousBase.y
      });
    });
    let currentPositions = new Map(initialPositions);
    const tracks = new Map();
    const addStep = (key, start, end, from, to, fromTarget, toTarget, instant = false) => {
      if (!from || !to) return;
      const positionStable = Math.abs(from.x - to.x) < 0.1 && Math.abs(from.y - to.y) < 0.1;
      const arrowStable = Math.abs(from.targetX - to.targetX) < 0.1
        && Math.abs(from.targetY - to.targetY) < 0.1;
      if (positionStable && arrowStable) return;
      if (!tracks.has(key)) tracks.set(key, []);
      tracks.get(key).push({
        start, end, from: { ...from }, to: { ...to }, fromTarget, toTarget, instant
      });
    };

    const frameReflowKeys = frameReflow.keys instanceof Set
      ? frameReflow.keys
      : new Set(frameReflow.keys || []);
    const frameReflowDuration = Math.max(0, Number(frameReflow.duration) || 0);
    if (frameReflowDuration > 0) {
      frameReflowKeys.forEach(key => {
        const from = initialPositions.get(key);
        const to = settledFramePositions.get(key);
        if (!from || !to) return;
        addStep(key, 0, frameReflowDuration, from, to, state.get(key), state.get(key));
        currentPositions.set(key, { ...to });
      });
    }

    const initializedAtDeclaration = new Set();
    logicalMotionSlots.forEach(({ slot, markers }, slotIndex) => {
      let beforeStateChanged = false;
      markers.forEach(marker => {
        if (slot.animation === 'declare') return;
        if (initializedAtDeclaration.has(marker.key)
          && displayEventValue(slot.event?.payload?.before) === '') return;
        const item = metadata.get(marker.key);
        const beforeTarget = markerTargetForEvent(item, slot, 'before');
        if (beforeTarget && state.get(marker.key) !== beforeTarget) {
          state.set(marker.key, beforeTarget);
          beforeStateChanged = true;
        }
      });
      if (slotIndex > 0 && beforeStateChanged) currentPositions = positionsForState(state);
      const nextState = new Map(state);
      markers.forEach(marker => {
        const item = metadata.get(marker.key);
        const afterTarget = slot.animation === 'declare'
          ? markerTargetBeforeFrameEvents(traceDocument, eventFrame, elements.get(marker.key))
          : markerTargetForEvent(item, slot, 'after');
        if (afterTarget) nextState.set(marker.key, afterTarget);
      });
      const nextPositions = positionsForState(nextState);
      const start = Number(slot.animation === 'declare' ? slot.visualStart ?? slot.start : slot.motionStart ?? slot.start) || 0;
      const instant = slot.logicalOnly === true;
      const end = instant ? start : slot.animation === 'declare'
        ? start + MARKER_REFLOW_TIMING.duration
        : Math.max(start + 1, Number(slot.end) || start + 1);
      if (slot.animation === 'declare') markers.forEach(marker => {
        if (slot.continuingVisualKeys?.has(marker.key)) initializedAtDeclaration.add(marker.key);
        const point = nextPositions.get(marker.key);
        if (point && !currentPositions.has(marker.key)) {
          if (!String(nextState.get(marker.key)).startsWith('unresolved:')) {
            initializedAtDeclaration.add(marker.key);
          }
          initialPositions.set(marker.key, { ...point });
          currentPositions.set(marker.key, { ...point });
        }
      });
      metadata.forEach((unused, key) => {
        addStep(
          key, start, end, currentPositions.get(key), nextPositions.get(key),
          state.get(key), nextState.get(key), instant
        );
      });
      state.clear();
      nextState.forEach((value, key) => state.set(key, value));
      currentPositions = nextPositions;
    });

    // The destination scene no longer contains the exiting marker. Patch the
    // peer's last arrival before the exit so it lands in the temporary
    // two-marker layout, then close the gap while the old marker exits.
    frameReflow.exitReflows?.forEach?.((reflow, key) => {
      const item = metadata.get(key);
      if (!item) return;
      const targetGeometry = markerTargetGeometry(
        String(reflow?.target || item.currentTarget), placements
      );
      const settled = {
        x: item.finalBase.x,
        y: item.finalBase.y,
        targetX: targetGeometry?.x ?? item.finalBase.x,
        targetY: targetGeometry
          ? targetGeometry.y + targetGeometry.height / 2
          : item.finalBase.y
      };
      const hold = {
        ...settled,
        x: settled.x + (Number(reflow?.holdOffsetX) || 0)
      };
      const start = Math.max(0, Number(reflow?.start) || 0);
      const end = start + Math.max(
        1, Number(reflow?.duration) || MARKER_REFLOW_TIMING.duration
      );
      const track = tracks.get(key) || [];
      const arrival = [...track].reverse().find(step => (
        Number(step.end) <= start
        && (!Number(reflow?.arrivalEnd)
          || Math.abs(Number(step.end) - Number(reflow.arrivalEnd)) < 1)
      ));
      if (arrival) arrival.to = { ...hold };
      else initialPositions.set(key, { ...hold });
      addStep(key, start, end, hold, settled, reflow?.target, reflow?.target);
      tracks.get(key)?.sort((left, right) => left.start - right.start || left.end - right.end);
    });

    const committedTargets = new Map(state);
    const adjustments = new Map();
    const arrowStates = new Map();
    const publishPosition = elapsed => {
      adjustments.clear();
      arrowStates.clear();
      metadata.forEach((item, key) => {
        const track = tracks.get(key) || [];
        // Markers without a logical movement track must remain under the
        // frame transition/entrance controller. Publishing an absolute
        // zero adjustment here used to cancel both same-cell make-room
        // motion and the entering marker's vertical entrance offset.
        if (!track.length) return;
        let point = initialPositions.get(key) || item?.finalBase;
        for (const step of track) {
          if (elapsed < step.start) break;
          if (step.instant) {
            point = step.to;
            continue;
          }
          if (elapsed < step.end) {
            const progress = easeOutCubic(clamp01((elapsed - step.start) / (step.end - step.start)));
            point = {
              x: step.from.x + (step.to.x - step.from.x) * progress,
              y: step.from.y + (step.to.y - step.from.y) * progress,
              targetX: step.from.targetX + (step.to.targetX - step.from.targetX) * progress,
              targetY: step.from.targetY + (step.to.targetY - step.from.targetY) * progress
            };
            break;
          }
          point = step.to;
        }
        if (!item) return;
        if (point) {
          adjustments.set(key, {
            x: point.x - item.finalBase.x,
            y: point.y - item.finalBase.y,
            scale: 1,
            absolute: true
          });
          arrowStates.set(key, point);
        }
      });
    };
    return {
      adjustments,
      arrowStates,
      committedTargets,
      update: publishPosition,
      // The rendered frame is the state at @frame time, but trailing events
      // (for example the final j++ before @keep last) can move a marker after
      // that capture. Keep the event-final position published until the next
      // frame is rendered instead of snapping back to the captured position.
      finish() {
        publishPosition(Number.POSITIVE_INFINITY);
        metadata.forEach((item, key) => {
          const adjustment = adjustments.get(key);
          const returnsToCapturedPosition = committedTargets.get(key) === item.currentTarget
            && Math.abs(Number(adjustment?.x) || 0) < 0.1
            && Math.abs(Number(adjustment?.y) || 0) < 0.1;
          if (!returnsToCapturedPosition) return;
          adjustments.delete(key);
          arrowStates.delete(key);
        });
      },
      reset() {
        adjustments.clear();
        arrowStates.clear();
      }
    };
  }

  function eventTargetVisualKeys(traceDocument, eventFrame, event, placements, elements) {
    const keys = new Set();
    (event?.targets || []).forEach(target => {
      const variableId = target?.variableId;
      if (variableId) {
        // Scalar renderers expose both the complete visual object (`key`) and
        // its inner cell (`key#0`).  A declaration owns the lifetime of the
        // complete object, including its outer frame and label, so keep the
        // top-level object hidden until the declaration slot as well.  Without
        // this, only the inner cell waited while the outer frame used the
        // generic frame-entrance timing and appeared too early.
        if (event?.type === 'declare') {
          const objectKey = objectKeyForVariable(eventFrame, variableId);
          if (placements?.has?.(objectKey) && elements?.has?.(objectKey)) keys.add(objectKey);
        }
        elements?.forEach?.((element, key) => {
          if (markerMatchesEventTarget(element, target)) keys.add(key);
        });
      }
      const operand = eventOperand(
        traceDocument, eventFrame, target, event?.payload?.after,
        placements, elements, key => key
      );
      if (operand?.visualKey) keys.add(operand.visualKey);
    });
    return keys;
  }

  function scopeExitVisualKeys(event, previousObjects) {
    const keys = new Set();
    const targets = (event?.targets || []).filter(target => target?.variableId);
    previousObjects?.forEach?.((element, key) => {
      const candidates = [
        element,
        ...(element?.querySelectorAll?.('[data-trace-source-variable-id], [data-trace-variable]') || [])
      ];
      if (targets.some(target => candidates.some(candidate => (
        visualMatchesScopeExitTarget(candidate, target)
      )))) keys.add(key);
    });
    return keys;
  }

  function scopeExitVisualMatches(event, previousObjects) {
    const matches = [];
    const targets = (event?.targets || []).filter(target => target?.variableId);
    targets.forEach(target => {
      previousObjects?.forEach?.((element, topKey) => {
        const candidates = [
          element,
          ...(element?.querySelectorAll?.('[data-trace-source-variable-id], [data-trace-variable]') || [])
        ];
        const visual = candidates.find(candidate => visualMatchesScopeExitTarget(candidate, target));
        if (!visual) return;
        matches.push({ topKey, element, visual, target });
      });
    });
    return matches;
  }

  function scopeExitVisualContinues(previousVisual, currentElements, event = null) {
    if (!previousVisual || retainedSnapshotVisual(previousVisual)) return false;
    // Explicit visual exits end the old presentation even when the C++
    // variable remains alive. Only natural scope exits may preserve a shared
    // reference/container visual across function activations.
    if (event?.type === 'visual-exit' || event?.manualVisualExit === true) return false;
    let found = false;
    currentElements?.forEach?.(element => {
      if (found || !element || element.isConnected === false) return;
      const candidates = [
        element,
        ...(element.querySelectorAll?.(
          '[data-trace-source-variable-id], [data-trace-variable]'
        ) || [])
      ];
      found = candidates.some(candidate => (
        !retainedSnapshotVisual(candidate)
        && sameRuntimeVisual(candidate, previousVisual)
      ));
    });
    return found;
  }

  function hasCurrentScopeExitVisual(target, currentElements) {
    let found = false;
    currentElements?.forEach?.(element => {
      if (found || !element || element.isConnected === false) return;
      const candidates = [
        element,
        ...(element.querySelectorAll?.(
          '[data-trace-source-variable-id], [data-trace-variable]'
        ) || [])
      ];
      found = candidates.some(candidate => visualMatchesScopeExitTarget(candidate, target));
    });
    return found;
  }

  function retainedVisualMatchesScopeExitTarget(element, target) {
    if (!element || !target?.variableId) return false;
    const lifetime = String(target.lifetimeIdentity || '');
    let matches = false;
    if (element.dataset?.traceSourceVariableId) {
      matches = markerDependsOnVariable(element, target.variableId);
      if (matches && lifetime) {
        matches = String(element.dataset.traceRuntimeIdentity || '') === lifetime;
      }
    } else {
      matches = String(element.dataset?.traceVariable || '') === String(target.variableId);
      if (matches && lifetime) {
        matches = String(element.dataset?.traceRuntimeLifetime || '') === lifetime;
      }
    }
    const targetGeneration = Number(target.sceneGeneration);
    const visualGeneration = Number(element.dataset?.traceSceneGeneration);
    if (matches && Number.isFinite(targetGeneration) && Number.isFinite(visualGeneration)) {
      matches = targetGeneration === visualGeneration;
    }
    return matches;
  }

  function hidePreKeepExitVisualsInSnapshots(root, eventFrame) {
    const targets = orderedEvents(eventFrame).filter(event => (
      (event?.type === 'visual-exit' || event?.type === 'scope-exit')
      && event.preKeepExit === true
    )).flatMap(event => event.targets || []);
    if (!targets.length) return;
    root.querySelectorAll(
      '[data-trace-snapshot] [data-trace-source-variable-id], '
      + '[data-trace-snapshot] [data-trace-variable]'
    ).forEach(element => {
      if (!targets.some(target => retainedVisualMatchesScopeExitTarget(element, target))) return;
      // @exit immediately before @keep describes the state that is retained:
      // animate the old live visual out, but do not reveal a duplicate pointer
      // inside the newly rendered keep snapshot behind that exit ghost.
      element.setAttribute('display', 'none');
    });
  }

  function isolatedScopeExitClone(element, target) {
    const clone = element?.cloneNode?.(true);
    if (!clone) return null;
    const candidates = [
      clone,
      ...(clone.querySelectorAll?.('[data-trace-source-variable-id], [data-trace-variable]') || [])
    ];
    const visual = candidates.find(candidate => visualMatchesScopeExitTarget(candidate, target));
    if (!visual) return null;
    // Previous scenes are captured as top-level objects, but lifecycle events
    // target one nested marker lifetime. Retain only the ancestor chain leading
    // to that marker so two exits inside the same array remain independent.
    let branch = visual;
    while (branch && branch !== clone) {
      const parent = branch.parentNode;
      if (!parent) return null;
      [...(parent.children || [])].forEach(child => {
        if (child !== branch) child.remove();
      });
      branch = parent;
    }
    return { clone, visual };
  }

  function recursiveRoleContinuations(traceDocument, previousFrame, frame, previousObjects, elements) {
    const matches = new Map();
    const previousSource = previousFrame?.source || {};
    const source = frame?.source || {};
    const beforeId = String(previousSource.recursionActivationId || '');
    const afterId = String(source.recursionActivationId || '');
    if (!beforeId || !afterId || beforeId === afterId
      || !source.function || source.function !== previousSource.function) return matches;
    const parents = new Map((traceDocument?.frames || []).map(item => [
      String(item.source?.recursionActivationId || ''),
      String(item.source?.recursionParentActivationId || '')
    ]));
    parents.set(beforeId, String(previousSource.recursionParentActivationId || ''));
    parents.set(afterId, String(source.recursionParentActivationId || ''));
    const ancestor = (parent, child) => {
      const visited = new Set();
      while (child && !visited.has(child)) {
        if (child === parent) return true;
        visited.add(child);
        child = parents.get(child);
      }
      return false;
    };
    if (!ancestor(beforeId, afterId) && !ancestor(afterId, beforeId)) return matches;
    elements?.forEach?.((element, key) => {
      if (retainedSnapshotVisual(element)) return;
      const variableId = String(element.dataset?.traceSourceVariableId
        || element.dataset?.traceVariable || '');
      const variable = traceDocument?.variables?.[variableId];
      if (!variableId || variable?.functionName !== source.function) return;
      let match = null;
      if (element.dataset?.traceSourceVariableId) {
        match = previousVisualByContinuity(previousObjects,
          String(element.dataset.traceVisualContinuityKey || ''), key, element);
      } else {
        const previous = previousVisualElement(previousObjects, key);
        if (previous?.dataset?.traceVariable === variableId
          && sameSceneGeneration(element, previous)) match = { key, element: previous };
      }
      if (!match || match.element.getAttribute?.('opacity') === '0'
        || match.element.getAttribute?.('display') === 'none') return;
      // Explicit presentation exits and keep cuts are never recursive handoffs.
      if (orderedEvents(frame).some(event => (event.type === 'visual-exit'
        || event.manualVisualExit === true) && (event.targets || []).some(target => (
          visualMatchesScopeExitTarget(match.element, target)
        )))) return;
      matches.set(key, match);
    });
    return matches;
  }

  function declarationVisualSchedule(
    traceDocument, eventFrame, eventTimeline, placements, elements, continuingKeys = new Set()
  ) {
    const declaredKeys = new Set();
    const slotsByKey = new Map();
    orderedEvents(eventFrame).filter(event => event?.type === 'declare').forEach(event => {
      eventTargetVisualKeys(
        traceDocument, eventFrame, event, placements, elements
      ).forEach(key => { if (!continuingKeys.has(key)) declaredKeys.add(key); });
    });
    (eventTimeline || []).filter(slot => slot?.animation === 'declare').forEach(slot => {
      eventTargetVisualKeys(
        traceDocument, eventFrame, slot.event, placements, elements
      ).forEach(key => {
        if (continuingKeys.has(key)) return;
        declaredKeys.add(key);
        if (!slotsByKey.has(key)) slotsByKey.set(key, slot);
      });
    });
    return { declaredKeys, slotsByKey };
  }

  function markerReflowPeerKeys({
    traceDocument, eventFrame, enteringKey, currentElements,
    previousPlacements, currentPlacements, previousObjects
  } = {}) {
    const peers = [];
    const entering = currentElements?.get?.(enteringKey);
    if (!entering?.dataset?.traceSourceVariableId) return peers;
    const target = markerTargetBeforeFrameEvents(traceDocument, eventFrame, entering);
    if (!target) return peers;
    const enteringDeclaration = orderedEvents(eventFrame).find(event => event.type === 'declare'
      && (event.targets || []).some(item => markerMatchesEventTarget(entering, item)));
    currentElements?.forEach?.((element, key) => {
      if (key === enteringKey || !element?.dataset?.traceSourceVariableId) return;
      const continuation = markerContinuationFor(
        element, key, previousPlacements, previousObjects
      );
      const previousVisual = continuation?.element || previousVisualElement(previousObjects, key);
      let peerTarget = markerTargetBeforeFrameEvents(traceDocument, eventFrame, element);
      if (target.startsWith('unresolved:')
        && previousVisual?.dataset?.traceMarkerUnresolved === '1') {
        const parts = markerTargetParts(String(element.dataset.traceBindingTarget || ''));
        if (parts) peerTarget = `unresolved:${parts.prefix}`;
      }
      if (peerTarget !== target) return;
      const earlierDeclaration = enteringDeclaration && orderedEvents(eventFrame).some(event => (
        event.type === 'declare' && Number(event.order) < Number(enteringDeclaration.order)
        && (event.targets || []).some(item => markerMatchesEventTarget(element, item))
      ));
      if (earlierDeclaration) { peers.push(key); return; }
      if (!target.startsWith('unresolved:')
        && String(previousVisual?.dataset?.traceBindingTarget || '') !== target) return;
      const before = continuation?.placement || previousPlacements?.get?.(key);
      const after = currentPlacements?.get?.(key);
      if (!before || !after) return;
      const moved = Math.abs((Number(before.x) || 0) - (Number(after.x) || 0)) > 0.1
        || Math.abs((Number(before.y) || 0) - (Number(after.y) || 0)) > 0.1;
      if (moved) peers.push(key);
    });
    return peers;
  }

  function declarationMarkerReflowSchedule({
    traceDocument, eventFrame, entranceSlots, currentElements,
    previousPlacements, currentPlacements, previousObjects
  } = {}) {
    const schedule = new Map();
    entranceSlots?.forEach?.((slot, enteringKey) => {
      markerReflowPeerKeys({
        traceDocument,
        eventFrame,
        enteringKey,
        currentElements,
        previousPlacements,
        currentPlacements,
        previousObjects
      }).forEach(key => {
        const existing = schedule.get(key);
        if (!existing || Number(slot.start) < Number(existing.start)) {
          schedule.set(key, {
            start: Number(slot.start) || 0,
            duration: MARKER_REFLOW_TIMING.duration,
            enteringKey
          });
        }
      });
    });
    return schedule;
  }

  function exitMarkerReflowSchedule({
    eventTimeline, currentElements, previousPlacements, currentPlacements, previousObjects
  } = {}) {
    const schedule = new Map();
    (eventTimeline || []).filter(slot => (
      slot?.animation === 'exit' && slot?.markerExit === true
    )).forEach(slot => {
      const exitingTargets = new Set();
      // Most exits remove the marker from the destination scene, so its last
      // binding lives in previousObjects. A variable declared and retired in
      // the same frame can exist only in currentElements. Accept both scenes
      // while retaining lifetime-aware matching.
      [previousObjects, currentElements].forEach(elements => {
        scopeExitVisualMatches(slot.event, elements).forEach(match => {
          const candidates = [
            match.element,
            ...(match.element?.querySelectorAll?.('[data-trace-source-variable-id]') || [])
          ];
          const marker = candidates.find(candidate => markerMatchesEventTarget(candidate, match.target));
          const target = String(marker?.dataset?.traceBindingTarget || '');
          if (target) exitingTargets.add(target);
        });
      });
      exitingTargets.forEach(exitingTarget => {
        const exitMatches = [previousObjects, currentElements].flatMap(elements => (
          scopeExitVisualMatches(slot.event, elements)
        ));
        const exitingMarker = exitMatches.flatMap(match => [
          match.element,
          ...(match.element?.querySelectorAll?.('[data-trace-source-variable-id]') || [])
        ]).find(candidate => (
          String(candidate?.dataset?.traceBindingTarget || '') === exitingTarget
          && (slot.event?.targets || []).some(target => markerMatchesEventTarget(candidate, target))
        ));
        if (!exitingMarker) return;

        const peers = [];
        currentElements?.forEach?.((element, key) => {
          if (!element?.dataset?.traceSourceVariableId) return;
          if ((slot.event?.targets || []).some(target => markerMatchesEventTarget(element, target))) return;
          const previous = previousVisualForEntry(element, previousObjects, key);
          const previousTarget = String(previous?.dataset?.traceBindingTarget || '');
          const currentTarget = String(element.dataset.traceBindingTarget || '');
          if (previousTarget !== exitingTarget && currentTarget !== exitingTarget) return;
          if (!currentPlacements?.has?.(key)) return;
          peers.push({ key, element, target: currentTarget || previousTarget });
        });
        if (!peers.length) return;
        const targetGeometry = markerTargetGeometry(exitingTarget, currentPlacements);
        if (!targetGeometry) return;

        const participants = [
          ...peers.map(peer => ({ ...peer, exiting: false })),
          { key: '__exiting__', element: exitingMarker, exiting: true }
        ].map(item => ({
          ...item,
          width: Number(item.element.querySelector?.('.trace-variable-marker-label-box')
            ?.getAttribute?.('width')) || 18,
          sortKey: String(item.element.dataset?.traceMarkerSortKey
            || item.element.dataset?.traceMarkerIndexExpression
            || item.element.dataset?.traceSourceVariableId
            || item.key)
        })).sort((left, right) => (
          left.sortKey.localeCompare(right.sortKey, 'en', { numeric: true, sensitivity: 'base' })
          || left.key.localeCompare(right.key)
        ));
        const gap = 8;
        const totalWidth = participants.reduce((sum, item) => sum + item.width, 0)
          + Math.max(0, participants.length - 1) * gap;
        let cursor = -totalWidth / 2;
        const offsets = new Map();
        participants.forEach(item => {
          offsets.set(item.key, cursor + item.width / 2);
          cursor += item.width + gap;
        });
        const exitingBase = elementTranslation(exitingMarker);
        const exitingOffsetX = targetGeometry.x
          + (Number(offsets.get('__exiting__')) || 0)
          - (Number(exitingBase?.x) || targetGeometry.x);
        const start = Number(slot.reflowStart ?? slot.visualStart ?? slot.start) || 0;
        const duration = Math.max(1, Number(slot.exitDuration) || APPEAR_TIMING.duration);
        peers.forEach(peer => {
          const sourceIds = markerSourceVariableIds(peer.element);
          const arrival = (eventTimeline || []).filter(candidate => (
            ['assign', 'position'].includes(candidate?.animation)
            && Number(candidate.end) <= start
            && (candidate.event?.targets || []).some(target => (
              target?.role !== 'source' && sourceIds.includes(target?.variableId)
            ))
          )).at(-1);
          const existing = schedule.get(peer.key);
          if (!existing || start < Number(existing.start)) {
            schedule.set(peer.key, {
              start,
              duration,
              eventId: String(slot.event?.id || ''),
              target: exitingTarget,
              holdOffsetX: Number(offsets.get(peer.key)) || 0,
              ghostOffsetX: exitingOffsetX,
              arrivalStart: Number(arrival?.motionStart ?? arrival?.start) || 0,
              arrivalEnd: Number(arrival?.end) || 0
            });
          }
        });
      });
    });
    return schedule;
  }

  function markerExitNeedsReflow(
    event, currentElements, previousPlacements, currentPlacements, previousObjects
  ) {
    const probe = exitMarkerReflowSchedule({
      eventTimeline: [{
        event,
        animation: 'exit',
        markerExit: true,
        reflowStart: APPEAR_TIMING.duration,
        end: APPEAR_TIMING.duration + MARKER_REFLOW_TIMING.duration
      }],
      currentElements,
      previousPlacements,
      currentPlacements,
      previousObjects
    });
    return probe.size > 0;
  }

  function eventHasVisibleAnimationTargets(
    traceDocument, eventFrame, event, animation, placements, elements, previousObjects = null
  ) {
    if (animation === 'code') return eventUsesCodePanelTarget(event);
    const targets = Array.isArray(event?.targets) ? event.targets : [];
    if (animation === 'exit') {
      // A loop-local variable can be declared, used, and leave its scope in
      // one frame. That runtime lifetime exists only in the current scene;
      // ordinary exits can instead exist only in the preceding scene.
      // Search both without relaxing the lifetime-aware match.
      if (scopeExitVisualKeys(event, elements).size > 0) return true;
      return previousObjects != null && scopeExitVisualKeys(event, previousObjects).size > 0;
    }
    if (animation === 'declare') {
      return [...eventTargetVisualKeys(
        traceDocument, eventFrame, event, placements, elements
      )].some(key => placements?.has?.(key) && elements?.has?.(key));
    }
    if (animation === 'position') return Boolean(markerForMotionSlot({ animation, event }, elements));
    if (animation === 'sequence') {
      const target = targets.find(item => item.role === 'target') || targets[0];
      const key = target ? eventTargetKey(traceDocument, eventFrame, target) : '';
      if (!key || !placements?.has?.(key) || !elements?.has?.(key)
        || retainedSnapshotVisual(elements.get(key))) return false;
      const before = Number(event?.payload?.beforeSize);
      const after = Number(event?.payload?.afterSize);
      if (after > before) return sequenceCellKeys(traceDocument, eventFrame, event)
        .every(cellKey => elements?.has?.(cellKey));
      if (before > after) return sequenceCellKeys(traceDocument, eventFrame, event, false)
        .every(cellKey => Boolean(previousVisualElement(previousObjects, cellKey)));
      return true;
    }
    const visible = target => Boolean(eventOperand(
      traceDocument,
      eventFrame,
      target,
      event?.payload?.after,
      placements,
      elements,
      key => key
    ));
    if (animation === 'assign') {
      const target = targets.find(item => item.role === 'target') || targets[0];
      const variableTargets = targets.filter(item => item?.variableId);
      const targetOperand = target ? eventOperand(
        traceDocument,
        eventFrame,
        target,
        event?.payload?.after,
        placements,
        elements,
        key => key,
        event
      ) : null;
      if (!targetOperand) {
        return Boolean(assignmentTargetMarker(event, new Map(), eventFrame, previousObjects));
      }
      // An index marker assignment (for example largest = l) is fully
      // determined by the captured before/after/source values. The source
      // scalar does not need its own box or pointer on the canvas.
      if (targetOperand.marker && Number.isFinite(Number(displayEventValue(event?.payload?.after)))) {
        return true;
      }
      return variableTargets.every(visible);
    }
    if (animation === 'compare' && event?.comparisonKind === 'truthy') {
      return targets.length === 1 && visible(targets[0]);
    }
    if (animation === 'compare' || animation === 'swap') {
      return targets.length >= 2 && targets.slice(0, 2).every(visible);
    }
    const variableTargets = targets.filter(target => target?.variableId);
    return variableTargets.length > 0 && variableTargets.every(visible);
  }

  function eventAvailabilityAnimation(event, elements, eventFrame = null, previousObjects = null) {
    // "fixed" is rendered as a persistent cell mark rather than a timed
    // animation. Treat it as its own renderable event so availability does
    // not make the switch look off after the renderer has already drawn it.
    if (event?.type === 'fixed') return 'fixed';
    const positionOnly = updateTargetsMarker(event, elements, eventFrame, previousObjects);
    const standaloneUpdate = event?.type === 'write' && event?.update === true && !positionOnly;
    return positionOnly
      ? 'position'
      : (standaloneUpdate ? 'assign' : eventAnimation(null, event.type));
  }

  function eventAnimationIsRenderable(animation) {
    return ['declare', 'exit', 'position', 'assign', 'compare', 'swap', 'fixed', 'sequence'].includes(animation)
      || Boolean(GENERIC_EVENT_DURATION[animation]);
  }

  function eventUsesCodePanelTarget(event) {
    // Whole conditions, their comparison slices, and declaration initializers
    // in a classic for header have exact spans that the code panel can animate.
    // Keep them in the formal schedule when scalar values are intentionally not
    // drawn, without relaxing canvas-target checks for ordinary events.
    if (event?.type === 'condition') return true;
    if (['function-enter', 'call'].includes(event?.type)) {
      return Number.isFinite(Number(event?.source?.from))
        && Number.isFinite(Number(event?.source?.to));
    }
    if (!['assign', 'compare'].includes(event?.type)) return false;
    const source = event?.source;
    if (!Number.isFinite(Number(source?.from)) || !Number.isFinite(Number(source?.to))) return false;
    return (source?.contexts || []).some(context => {
      if (!Number.isFinite(Number(context.conditionFrom))) return false;
      if (event.type === 'compare') {
        return Number.isFinite(Number(context.conditionTo))
          && Number(source.from) >= Number(context.conditionFrom)
          && Number(source.to) <= Number(context.conditionTo);
      }
      return context?.type === 'ForStatement'
        && Number(source.from) >= Number(context.headerFrom)
        && Number(source.to) <= Number(context.conditionFrom);
    });
  }

  function eventHasRenderableTargetDefinition(event, animation) {
    // Code-only events may use their source range as the target. A normal
    // canvas event does not become renderable merely because its for-header
    // source can be highlighted; it still needs a real canvas target.
    if (animation === 'code') return eventUsesCodePanelTarget(event);
    const targets = Array.isArray(event?.targets) ? event.targets : [];
    if (animation === 'assign') {
      const target = targets.find(item => item?.role === 'target') || targets[0];
      return Boolean(target?.variableId);
    }
    if (animation === 'compare' && event?.comparisonKind === 'truthy') {
      return targets.length === 1 && Boolean(targets[0]?.variableId);
    }
    if (animation === 'compare' || animation === 'swap') {
      return targets.length >= 2 && targets.slice(0, 2).every(target => target?.variableId);
    }
    return targets.some(target => target?.variableId);
  }

  function updateEventAvailability(
    traceDocument, eventFrame, placements, elements, previousObjects = null
  ) {
    let changed = false;
    orderedEvents(eventFrame).forEach(event => {
      if (event.type === 'condition') {
        if (event.autoAnimationDisabled === false
          && !event.autoAnimationUnavailableReason) return;
        event.autoAnimationDisabled = false;
        delete event.autoAnimationUnavailableReason;
        changed = true;
        return;
      }
      if (event.type === 'fixed') {
        if (event.autoAnimationDisabled === false
          && !event.autoAnimationUnavailableReason) return;
        event.autoAnimationDisabled = false;
        delete event.autoAnimationUnavailableReason;
        changed = true;
        return;
      }
      const animation = eventAvailabilityAnimation(event, elements, eventFrame, previousObjects);
      const codeRenderable = eventUsesCodePanelTarget(event);
      const animationRenderable = eventAnimationIsRenderable(animation);
      const hasCanvasTargetDefinition = animation !== 'code'
        && eventHasRenderableTargetDefinition(event, animation);
      const canvasRenderable = hasCanvasTargetDefinition
        && eventHasVisibleAnimationTargets(
          traceDocument, eventFrame, event, animation, placements, elements, previousObjects
        );
      const unavailableReason = animation === 'code'
        ? (codeRenderable && animationRenderable ? '' : 'unrenderable')
        : !animationRenderable
          ? 'unrenderable'
          : !hasCanvasTargetDefinition
            ? (codeRenderable ? 'missing-target' : 'unrenderable')
          : !canvasRenderable ? 'missing-target' : '';
      const autoDisabled = Boolean(unavailableReason);
      event.codeRenderable = codeRenderable;
      event.canvasRenderable = canvasRenderable;
      if (event.autoAnimationDisabled === autoDisabled
        && String(event.autoAnimationUnavailableReason || '') === unavailableReason) return;
      event.autoAnimationDisabled = autoDisabled;
      if (unavailableReason) event.autoAnimationUnavailableReason = unavailableReason;
      else delete event.autoAnimationUnavailableReason;
      changed = true;
    });
    if (changed) {
      queueMicrotask(() => window.dispatchEvent(new CustomEvent(
        'asm:trace-event-availability-changed',
        { detail: { document: traceDocument, frameId: eventFrame?.id || '' } }
      )));
    }
    return changed;
  }

  function buildEventTimeline(
    traceDocument, eventFrame, direction, swapDuration,
    previousPlacements, currentPlacements, elements, initialDelay = 0,
    previousObjects = null, eventFilter = null
  ) {
    if (Number(direction) < 0) return [];
    const slots = [];
    const seenMarkerAssignments = new Set();
    let cursor = Math.max(0, Number(initialDelay) || 0);
    updateEventAvailability(
      traceDocument, eventFrame, currentPlacements, elements, previousObjects
    );
    const exitIdentity = target => [
      String(target?.variableId || ''),
      String(target?.lifetimeIdentity || ''),
      String(target?.sceneGeneration ?? '')
    ].join('|');
    const ordered = orderedEvents(eventFrame);
    const manualPreKeepExitIdentities = new Set(ordered.filter(event => (
      event?.type === 'visual-exit'
      && event?.manualVisualExit === true
      && event?.preKeepExit === true
    )).flatMap(event => (event.targets || []).map(exitIdentity)));
    const enabledEvents = ordered.filter(event => (
      event.type !== 'condition'
      && event.enabled !== false && event.autoAnimationDisabled !== true
      && !(event.type === 'scope-exit' && event.absorbedAfterKeep === true
        && (event.targets || []).some(target => (
          manualPreKeepExitIdentities.has(exitIdentity(target))
        )))
      && (!eventFilter || eventFilter(event))
    ));
    enabledEvents.forEach(event => {
      const positionOnly = updateTargetsMarker(event, elements, eventFrame, previousObjects);
      const standaloneUpdate = event?.type === 'write' && event?.update === true && !positionOnly;
      const animation = positionOnly
        ? 'position'
        : (standaloneUpdate ? 'assign' : eventAnimation(traceDocument, event.type));
      let duration = 0;
      let effectDuration = 0;
      let markerAssignment = null;
      if (positionOnly) duration = swapDuration;
      let declarationEntranceDelay = 0;
      if (animation === 'declare') {
        const declarationKeys = [...eventTargetVisualKeys(
          traceDocument, eventFrame, event, currentPlacements, elements
        )];
        const makesRoom = declarationKeys.some(key => (
          visualLifecycleKind(elements?.get?.(key)) === 'marker'
          && markerReflowPeerKeys({
            traceDocument,
            eventFrame,
            enteringKey: key,
            currentElements: elements,
            previousPlacements,
            currentPlacements,
            previousObjects
          }).length > 0
        ));
        declarationEntranceDelay = makesRoom ? MARKER_REFLOW_TIMING.entranceDelay : 0;
        duration = APPEAR_TIMING.duration + declarationEntranceDelay;
      }
      let markerExit = false;
      if (animation === 'exit') {
        markerExit = markerExitNeedsReflow(
          event, elements, previousPlacements, currentPlacements, previousObjects
        );
        duration = markerExit
          ? Math.max(APPEAR_TIMING.duration, MARKER_REFLOW_TIMING.duration)
          : APPEAR_TIMING.duration;
      }
      if (animation === 'assign') {
        const target = (event?.targets || []).find(item => item.role === 'target') || event?.targets?.[0];
        const operand = target ? eventOperand(
          traceDocument, eventFrame, target, event?.payload?.after,
          currentPlacements, elements, key => key
        ) : null;
        const before = operand ? previousPlacements?.get?.(operand.visualKey) : null;
        const after = operand ? currentPlacements?.get?.(operand.visualKey) : null;
        const targetMoves = Boolean(before && after && (
          Math.abs((Number(before.x) || 0) - (Number(after.x) || 0)) > 0.1
          || Math.abs((Number(before.y) || 0) - (Number(after.y) || 0)) > 0.1
        ));
        markerAssignment = assignmentTargetMarker(event, elements, eventFrame, previousObjects);
        const markerDelta = markerAssignment
          ? markerTargetDelta(markerAssignment, event?.payload?.after, currentPlacements)
          : null;
        const markerMovesWithinFrame = Boolean(markerAssignment && (
          seenMarkerAssignments.has(markerAssignment.key)
          || (event?.payload?.before != null && event?.payload?.after != null
            && displayEventValue(event.payload.before) !== displayEventValue(event.payload.after))
          || Math.abs(Number(markerDelta?.x) || 0) > 0.1
          || Math.abs(Number(markerDelta?.y) || 0) > 0.1
        ));
        if (markerAssignment) seenMarkerAssignments.add(markerAssignment.key);
        effectDuration = assignmentEffectDuration(Boolean(markerAssignment));
        duration = effectDuration
          + (!standaloneUpdate && (targetMoves || markerMovesWithinFrame) ? swapDuration : 0);
      }
      if (event.type === 'compare' && animation === 'compare') {
        duration = COMPARE_DURATION;
      }
      if (event.type === 'swap' && animation === 'swap') duration = swapDuration;
      if (animation === 'sequence') duration = SEQUENCE_TIMING.duration;
      if (!duration && GENERIC_EVENT_DURATION[animation]) duration = GENERIC_EVENT_DURATION[animation];
      if (!duration) return;
      const preKeepBatchKey = event?.type === 'visual-exit'
        && event?.manualVisualExit === true
        && event?.preKeepExit === true
        ? [
            String(event?.line ?? ''),
            String(event?.signature || ''),
            String(event?.source?.from ?? ''),
            String(event?.source?.to ?? '')
          ].join('|')
        : '';
      const previousSlot = slots[slots.length - 1] || null;
      // Consecutive enabled exits describe one observable scope boundary. Keep
      // every source event as an independent, editable timeline item, but run
      // their visual departures as one parallel batch. A non-exit event ends
      // the batch so runtime ordering is never crossed.
      const parallelExitBatch = animation === 'exit'
        && previousSlot?.animation === 'exit';
      const parallelWithPrevious = Boolean(
        parallelExitBatch
        || (preKeepBatchKey && previousSlot?.preKeepBatchKey === preKeepBatchKey)
      );
      if (slots.length && !parallelWithPrevious) cursor += eventGap(traceDocument);
      const targetsEntering = [...eventTargetVisualKeys(
        traceDocument, eventFrame, event, currentPlacements, elements
      )].some(key => currentPlacements?.has?.(key) && !previousPlacements?.has?.(key));
      // The declaration slot is itself responsible for introducing a new
      // object. Other events still wait for the ordinary pre-event entrance.
      if (targetsEntering && animation !== 'declare') {
        cursor = Math.max(cursor, APPEAR_TIMING.duration + 1);
      }
      const sourceFrom = Number(event?.source?.from);
      const sourceTo = Number(event?.source?.to);
      const hasCodePrompt = animation !== 'code' && event?.type !== 'visual-exit'
        && Number.isFinite(sourceFrom) && Number.isFinite(sourceTo) && sourceTo > sourceFrom;
      const promptStart = parallelWithPrevious
        ? Number(previousSlot.promptStart) || 0
        : cursor;
      const codePromptDuration = hasCodePrompt ? EVENT_CODE_PROMPT_DURATION : 0;
      const visualStart = promptStart + codePromptDuration;
      const effectStart = visualStart;
      const motionStart = visualStart + (animation === 'assign' ? effectDuration : 0);
      slots.push({
        event, type: event.type, animation,
        promptStart, codePromptDuration, visualStart, start: visualStart,
        effectStart, motionStart, effectDuration,
        declarationEntranceDelay,
        markerExit,
        exitDuration: animation === 'exit' ? APPEAR_TIMING.duration : 0,
        reflowStart: animation === 'exit' && markerExit
          ? visualStart : 0,
        markerAssignment: Boolean(markerAssignment), duration, end: visualStart + duration,
        preKeepBatchKey,
        exitBatchStart: parallelExitBatch
          ? Number(previousSlot?.exitBatchStart ?? previousSlot?.visualStart ?? visualStart)
          : (animation === 'exit' ? visualStart : null)
      });
      cursor = parallelWithPrevious
        ? Math.max(cursor, visualStart + duration)
        : visualStart + duration;
    });
    return slots;
  }

  function enabledExitBarrierEnd(eventTimeline = [], minimum = 0) {
    return (eventTimeline || []).reduce((end, slot) => {
      if (slot?.animation !== 'exit') return end;
      return Math.max(end, Number(slot.end) || 0);
    }, Math.max(0, Number(minimum) || 0));
  }

  function frameSceneBoundaryChanged(previousFrame, frame) {
    if (!previousFrame || !frame) return false;
    const previousActivation = String(
      previousFrame.source?.recursionActivationId || ''
    );
    const currentActivation = String(frame.source?.recursionActivationId || '');
    if (previousActivation && currentActivation) {
      return previousActivation !== currentActivation;
    }
    return String(previousFrame.source?.function || '')
      !== String(frame.source?.function || '');
  }

  function sameRuntimeVisual(current, previous) {
    if (!current || !previous) return false;
    const currentIdentity = String(current.dataset?.traceRuntimeIdentity || '');
    const previousIdentity = String(previous.dataset?.traceRuntimeIdentity || '');
    if (currentIdentity && previousIdentity) {
      return currentIdentity === previousIdentity;
    }
    const currentLifetime = String(current.dataset?.traceRuntimeLifetime || '');
    const previousLifetime = String(previous.dataset?.traceRuntimeLifetime || '');
    return Boolean(
      currentLifetime
      && previousLifetime
      && currentLifetime === previousLifetime
    );
  }

  function needsSceneBoundaryEntrance(sceneChanged, current, previous) {
    return Boolean(sceneChanged && !sameRuntimeVisual(current, previous));
  }

  function eventMotionDelays(traceDocument, eventFrame, eventTimeline, placements, elements) {
    const delays = new Map();
    eventTimeline.forEach(slot => {
      if (slot.animation === 'position') {
        elements?.forEach?.((element, key) => {
          if (!(slot.event?.targets || []).some(target => (
            markerMatchesEventTarget(element, target)
          ))) return;
          delays.set(key, Math.max(delays.get(key) || 0, slot.start));
        });
        return;
      }
      let targets = [];
      let delay = 0;
      if (slot.animation === 'assign') {
        if (slot.duration <= (Number(slot.effectDuration) || 0)) return;
        targets = [(slot.event?.targets || []).find(item => item.role === 'target')
          || slot.event?.targets?.[0]].filter(Boolean);
        delay = slot.motionStart ?? slot.start;
      } else if (GENERIC_EVENT_DURATION[slot.animation]) {
        targets = slot.event?.targets || [];
        delay = slot.end;
      }
      targets.forEach(target => {
        if (target?.variableId) {
          elements?.forEach?.((element, key) => {
            if (!markerMatchesEventTarget(element, target)) return;
            delays.set(key, Math.max(delays.get(key) || 0, delay));
          });
        }
        const operand = eventOperand(
          traceDocument, eventFrame, target, slot.event?.payload?.after,
          placements, elements, key => key
        );
        if (!operand) return;
        delays.set(operand.visualKey, Math.max(delays.get(operand.visualKey) || 0, delay));
      });
    });
    return delays;
  }

  function createGenericEventEffect(slot, traceDocument, eventFrame, placements, elements) {
    const keys = new Set();
    (slot.event?.targets || []).forEach(target => {
      const operand = eventOperand(
        traceDocument, eventFrame, target, null, placements, elements, key => key
      );
      if (operand?.visualKey) keys.add(operand.visualKey);
    });
    const adjustments = new Map();
    const opacities = new Map();
    return {
      adjustments,
      opacities,
      update(elapsed) {
        const progress = clamp01(elapsed / Math.max(1, slot.duration));
        const eased = easeOutCubic(progress);
        keys.forEach(key => {
          if (slot.animation === 'lift') {
            adjustments.set(key, { x: 0, y: 12 * (1 - eased), scale: 1 });
            opacities.set(key, 0.45 + 0.55 * eased);
          } else if (slot.animation === 'pulse') {
            adjustments.set(key, { x: 0, y: 0, scale: 1 + 0.08 * Math.sin(Math.PI * progress) });
            opacities.set(key, 1 - 0.38 * Math.sin(Math.PI * progress));
          } else if (slot.animation === 'fade') {
            opacities.set(key, 0.18 + 0.82 * eased);
          }
        });
      },
      remove() {
        adjustments.clear();
        opacities.clear();
      }
    };
  }

  function createSequenceOperationEffect(
    slot, traceDocument, eventFrame, placements, elements, previousObjects
  ) {
    const event = slot.event;
    const target = (event?.targets || []).find(item => item.role === 'target')
      || event?.targets?.[0];
    const topKey = target ? eventTargetKey(traceDocument, eventFrame, target) : '';
    const currentTop = elements?.get?.(topKey);
    const content = currentTop?.querySelector?.('.outerframe-bg')?.parentElement;
    const before = Number(event?.payload?.beforeSize);
    const after = Number(event?.payload?.afterSize);
    const direction = sequenceEdge(event.operation) === 'front' ? -1 : 1;
    const inserted = after > before
      ? sequenceCellKeys(traceDocument, eventFrame, event) : [];
    const removed = before > after
      ? sequenceCellKeys(traceDocument, eventFrame, event, false) : [];
    const adjustments = new Map();
    const opacities = new Map();
    const ghosts = [];

    if (content && removed.length) {
      removed.forEach(cellKey => {
        const oldCell = previousVisualElement(previousObjects, cellKey);
        if (!oldCell) return;
        const wrapper = createSvg('g', {
          class: 'asm-trace-sequence-ghost', 'pointer-events': 'none', opacity: 0
        });
        const cell = oldCell.cloneNode(true);
        const indexLabel = previousVisualElement(previousObjects, `${cellKey}:index`);
        [cell, ...(indexLabel ? [indexLabel.cloneNode(true)] : [])].forEach(clone => {
          removeAnimationNodes(clone);
          [clone, ...clone.querySelectorAll('[id], [data-trace-object-key]')]
            .forEach(node => {
              node.removeAttribute('id');
              node.removeAttribute('data-trace-object-key');
            });
          wrapper.append(clone);
        });
        content.append(wrapper);
        ghosts.push({ wrapper, cellKey });
      });
    }

    return {
      adjustments, opacities,
      update(elapsed) {
        const progress = easeOutCubic(clamp01(elapsed / Math.max(1, slot.duration)));
        adjustments.clear();
        opacities.clear();
        inserted.forEach(cellKey => {
          [cellKey, `${cellKey}:index`].forEach(key => {
            if (!elements?.has?.(key)) return;
            adjustments.set(key, {
              x: direction * SEQUENCE_TIMING.travel * (1 - progress), y: 0, scale: 1
            });
            opacities.set(key, progress);
          });
        });
        ghosts.forEach(({ wrapper }) => {
          wrapper.setAttribute('transform', `translate(${direction * SEQUENCE_TIMING.travel * progress}, 0)`);
          wrapper.setAttribute('opacity', String(1 - progress));
        });
        if (!inserted.length && !removed.length && topKey) {
          adjustments.set(topKey, {
            x: 0, y: 0, scale: 1 + 0.035 * Math.sin(Math.PI * progress)
          });
        }
      },
      remove() {
        adjustments.clear();
        opacities.clear();
        ghosts.forEach(({ wrapper }) => wrapper.remove());
      }
    };
  }

  function eventSequence(options, eventFrame, eventTimeline) {
    const logicalEvents = orderedEvents(eventFrame)
      .filter(event => event?.loopBoundarySuppressed !== true);
    if (!eventTimeline.length && !logicalEvents.length) return null;
    const replayPlan = options.forwardReplayPlan || createForwardReplayPlan(
      options.document, eventFrame, eventTimeline, options.direction
    );
    const forwardValues = prepareForwardValues(options, replayPlan, eventFrame);
    const markerMotion = markerAssignmentMotion(
      options.document, eventFrame, eventTimeline,
      options.currentPlacements, options.currentElements, options.markerEntries,
      {
        keys: options.markerReflowKeys,
        duration: options.markerReflowDuration,
        exitReflows: options.exitReflowSchedule,
        replayPlan
      }
    );
    const combinedAdjustments = new Map();
    const sequenceEffects = new Map(eventTimeline.filter(slot => (
      slot.animation === 'sequence'
    )).map(slot => [slot, createSequenceOperationEffect(
      slot, options.document, eventFrame,
      options.currentPlacements, options.currentElements, options.previousObjects
    )]));
    let activeSlot = null;
    let activeEffect = null;
    let activeEffectStarted = false;
    let activeAnimatedElements = [];
    let finished = false;
    let announcementsReady = false;
    queueMicrotask(() => { announcementsReady = true; });
    const completedLogicalEventIds = new Set();
    function announceEvent(event, phase, slot = null) {
      if (!event || typeof window.dispatchEvent !== 'function') return;
      window.dispatchEvent(new CustomEvent('asm:trace-active-event', {
        detail: {
          document: options.document,
          frame: eventFrame,
          event,
          slot,
          phase
        }
      }));
    }
    function announce(slot, phase) {
      if (!slot?.event) return;
      if (phase === 'end') completedLogicalEventIds.add(String(slot.event.id || ''));
      announceEvent(slot.event, phase, slot);
    }
    function completeLogicalEventsBefore(order = Infinity) {
      logicalEvents.forEach(event => {
        if (!(Number(event?.order) < Number(order))) return;
        const id = String(event?.id || '');
        if (!id || completedLogicalEventIds.has(id)) return;
        completedLogicalEventIds.add(id);
        announceEvent(event, 'complete');
      });
    }
    function effectFor(slot) {
      if (!slot) return null;
      const checkpoint = replayPlan.checkpoints.find(item => item.event === slot.event);
      const visualKeyAtEvent = key => checkpoint?.visualBindingsBefore?.[key]
        || options.visualKeyForSource?.(key)
        || key;
      if (slot.type === 'compare') {
        if (slot.event?.comparisonKind === 'truthy') {
          return createTruthyCompareEffect(
            slot.event, options.document, eventFrame,
            options.currentPlacements, options.currentElements, visualKeyAtEvent
          );
        }
        const markerPositionAtCompare = operand => {
          const liveAdjustment = markerMotion.adjustments.get(operand.visualKey);
          if (liveAdjustment) return liveAdjustment;
          const variableId = String(operand.element?.dataset?.traceSourceVariableId || '');
          const movedEarlier = variableChangedBeforeEvent(eventFrame, slot.event, variableId);
          return movedEarlier ? null : options.rawDeltas?.get?.(operand.visualKey);
        };
        return createCompareEffect(
          options.root, slot.event, options.document, eventFrame,
          options.currentPlacements, options.currentElements, visualKeyAtEvent,
          markerPositionAtCompare,
          element => markerTargetAtCheckpoint(options.document, eventFrame, element, checkpoint)
        );
      }
      if (slot.animation === 'assign') {
        const assignmentElements = new Map([
          ...(options.previousObjects || new Map()),
          ...(options.currentElements || new Map())
        ]);
        const assignmentPlacements = new Map([
          ...(options.previousPlacements || new Map()),
          ...(options.currentPlacements || new Map())
        ]);
        return createAssignEffect(
          options.root, slot.event, options.document, eventFrame,
          assignmentPlacements, assignmentElements, options.rawDeltas,
          options.appearingKeys, options.previousObjects, visualKeyAtEvent,
          options.currentElements
        );
      }
      if (slot.animation === 'sequence') return sequenceEffects.get(slot) || null;
      if (GENERIC_EVENT_DURATION[slot.animation]) {
        return createGenericEventEffect(
          slot, options.document, eventFrame,
          options.currentPlacements, options.currentElements
        );
      }
      return null;
    }
    function animatedElementsFor(slot) {
      const checkpoint = replayPlan.checkpoints.find(item => item.event === slot.event);
      const visualKeyAtEvent = key => checkpoint?.visualBindingsBefore?.[key]
        || options.visualKeyForSource?.(key) || key;
      return (slot.event?.targets || []).map(target => eventOperand(
        options.document, eventFrame, target, null,
        options.currentPlacements, options.currentElements, visualKeyAtEvent, slot.event
      )?.element).filter(Boolean);
    }
    return {
      get adjustments() { return combinedAdjustments; },
      get animatedElements() { return activeAnimatedElements; },
      get markerArrowStates() { return markerMotion.arrowStates; },
      get markerTargets() { return markerMotion.committedTargets; },
      get opacities() { return activeEffect?.opacities || new Map(); },
      applyStyles() { forwardValues.applyStyles(); },
      ownsPaint(rect) { return forwardValues.ownsPaint(rect); },
      syncPositions() { activeEffect?.syncPosition?.(); },
      update(elapsed) {
        markerMotion.update(elapsed);
        if (!announcementsReady) return;
        const slot = eventTimeline.find((item, index) => (
          elapsed >= Number(item.promptStart ?? item.start)
          && (elapsed < item.end || (index === eventTimeline.length - 1 && elapsed <= item.end))
        )) || null;
        if (slot !== activeSlot) {
          announce(activeSlot, 'end');
          activeEffect?.remove?.();
          activeSlot = slot;
          activeEffect = null;
          activeEffectStarted = false;
          activeAnimatedElements = [];
          if (slot) {
            completeLogicalEventsBefore(slot.event?.order);
            options.root.dataset.traceActiveEventId = String(slot.event?.id || '');
            options.root.dataset.traceActiveEventType = String(slot.type || '');
            announce(slot, 'start');
          } else {
            const nextSlot = eventTimeline.find(item => (
              elapsed < Number(item.promptStart ?? item.start)
            )) || null;
            completeLogicalEventsBefore(nextSlot?.event?.order ?? Infinity);
            delete options.root.dataset.traceActiveEventId;
            delete options.root.dataset.traceActiveEventType;
          }
        }
        if (slot && !activeEffectStarted && elapsed >= Number(slot.visualStart ?? slot.start)) {
          activeEffectStarted = true;
          activeEffect = effectFor(slot);
          if (activeEffect) activeAnimatedElements = animatedElementsFor(slot);
        }
        if (slot && activeEffect) activeEffect.update(Math.max(0, elapsed - (slot.effectStart ?? slot.start)));
        // The DOM is rendered from the destination frame, but visible values
        // are always committed by the forward checkpoint stream. A later
        // event can therefore never leak its final value into an earlier one.
        forwardValues.update(elapsed);
        combinedAdjustments.clear();
        markerMotion.adjustments.forEach((value, key) => combinedAdjustments.set(key, value));
        activeEffect?.adjustments?.forEach?.((value, key) => {
          const existing = combinedAdjustments.get(key);
          combinedAdjustments.set(key, existing
            ? {
              x: (Number(existing.x) || 0) + (Number(value.x) || 0),
              y: (Number(existing.y) || 0) + (Number(value.y) || 0),
              scale: Number(value.scale) || Number(existing.scale) || 1,
              absolute: existing.absolute === true
            }
            : value);
        });
      },
      finish() {
        if (finished) return;
        finished = true;
        const announceCompletion = () => {
          announce(activeSlot, 'end');
          completeLogicalEventsBefore(Infinity);
        };
        if (announcementsReady) announceCompletion();
        else queueMicrotask(announceCompletion);
        activeEffect?.remove?.();
        sequenceEffects.forEach(effect => effect.remove());
        activeEffect = null;
        activeEffectStarted = false;
        activeAnimatedElements = [];
        activeSlot = null;
        if (Number(options.direction) >= 0) markerMotion.finish();
        else markerMotion.reset();
        combinedAdjustments.clear();
        markerMotion.adjustments.forEach((value, key) => combinedAdjustments.set(key, value));
        forwardValues.finish();
        delete options.root.dataset.traceActiveEventId;
        delete options.root.dataset.traceActiveEventType;
      }
    };
  }

  function removeAnimationNodes(element) {
    element?.querySelectorAll?.('animate, animateTransform, animateMotion').forEach(node => node.remove());
  }

  function wrapAttachedVisual(element) {
    const parent = element?.parentNode;
    if (!parent) return null;
    const wrapper = createSvg('g', {
      class: 'asm-trace-attached-motion',
      'pointer-events': 'none'
    });
    parent.insertBefore(wrapper, element);
    wrapper.append(element);
    return { wrapper, element, baseOpacity: wrapper.getAttribute('opacity') };
  }

  function unwrapAttachedVisual(attachment) {
    const { wrapper, element } = attachment || {};
    if (!wrapper?.parentNode || !element) return;
    wrapper.parentNode.insertBefore(element, wrapper);
    wrapper.remove();
  }

  function elementTranslation(element) {
    const transform = String(element?.getAttribute?.('transform') || '');
    const translate = transform.match(
      /translate\(\s*(-?[\d.]+)(?:[\s,]+(-?[\d.]+))?\s*\)/i
    );
    if (translate) {
      return {
        x: Number(translate[1]) || 0,
        y: Number(translate[2]) || 0
      };
    }
    const matrix = transform.match(
      /matrix\(\s*(-?[\d.]+)[\s,]+(-?[\d.]+)[\s,]+(-?[\d.]+)[\s,]+(-?[\d.]+)[\s,]+(-?[\d.]+)[\s,]+(-?[\d.]+)\s*\)/i
    );
    return matrix
      ? { x: Number(matrix[5]) || 0, y: Number(matrix[6]) || 0 }
      : null;
  }

  function segmentGeometry(element) {
    if (!element?.classList?.contains('asm-trace-segment')) return null;
    const geometry = {
      left: Number(element.dataset.traceSegmentLeft),
      right: Number(element.dataset.traceSegmentRight),
      top: Number(element.dataset.traceSegmentTop),
      bottom: Number(element.dataset.traceSegmentBottom),
      arrowY: Number(element.dataset.traceSegmentArrowY)
    };
    return Object.values(geometry).every(Number.isFinite) ? geometry : null;
  }

  function outerframeGeometry(element) {
    const background = element?.querySelector?.('.outerframe-bg');
    const group = background?.parentElement;
    if (!group || !background) return null;
    const directChild = className => [...group.children].find(child => (
      child.classList?.contains(className)
    )) || null;
    const numberAttribute = (node, name) => Number(node?.getAttribute?.(name));
    const rectGeometry = node => node ? {
      x: numberAttribute(node, 'x'), y: numberAttribute(node, 'y'),
      width: numberAttribute(node, 'width'), height: numberAttribute(node, 'height')
    } : null;
    const backgroundBox = rectGeometry(background);
    if (!backgroundBox || !Object.values(backgroundBox).every(Number.isFinite)
      || backgroundBox.width <= 0 || backgroundBox.height <= 0) return null;
    const nameBox = rectGeometry(directChild('outerframe-nb'));
    const label = directChild('outerframe-label');
    const labelPosition = label ? {
      x: numberAttribute(label, 'x'), y: numberAttribute(label, 'y')
    } : null;
    const bounds = ['left', 'top', 'right', 'bottom'].map(edge => (
      numberAttribute(group, `data-outerframe-${edge}`)
    ));
    return {
      group, background, backgroundBox,
      nameBox: nameBox && Object.values(nameBox).every(Number.isFinite) ? nameBox : null,
      labelPosition: labelPosition && Object.values(labelPosition).every(Number.isFinite)
        ? labelPosition : null,
      bounds: bounds.every(Number.isFinite) ? bounds : null
    };
  }

  function outerframeGeometryChanged(before, after) {
    if (!before || !after) return false;
    const values = geometry => [
      geometry.backgroundBox, geometry.nameBox, geometry.labelPosition, geometry.bounds
    ].map(part => part == null ? null : Array.isArray(part)
      ? part : Object.values(part));
    return JSON.stringify(values(before)) !== JSON.stringify(values(after));
  }

  function applyOuterframeGeometry(current, previous, progress) {
    if (!current || !previous) return;
    const interpolate = (from, to) => from + (to - from) * progress;
    const setBox = (element, before, after) => {
      if (!element || !before || !after) return;
      ['x', 'y', 'width', 'height'].forEach(name => {
        element.setAttribute(name, String(interpolate(before[name], after[name])));
      });
    };
    setBox(current.background, previous.backgroundBox, current.backgroundBox);
    const directChild = className => [...current.group.children].find(child => (
      child.classList?.contains(className)
    )) || null;
    setBox(directChild('outerframe-nb'),
      previous.nameBox, current.nameBox);
    const label = directChild('outerframe-label');
    if (label && previous.labelPosition && current.labelPosition) {
      ['x', 'y'].forEach(name => label.setAttribute(name, String(interpolate(
        previous.labelPosition[name], current.labelPosition[name]
      ))));
    }
    if (previous.bounds && current.bounds) {
      ['left', 'top', 'right', 'bottom'].forEach((edge, index) => {
        current.group.setAttribute(`data-outerframe-${edge}`, String(interpolate(
          previous.bounds[index], current.bounds[index]
        )));
      });
    }
  }

  function applySegmentGeometry(element, geometry) {
    if (!element || !geometry) return;
    const { left, right, top, bottom, arrowY } = geometry;
    const width = Math.max(0, right - left);
    const head = Math.min(6, Math.max(2, width / 3));
    const role = name => element.querySelector(`[data-trace-segment-role="${name}"]`);
    const leftBoundary = role('left-boundary');
    const rightBoundary = role('right-boundary');
    const widthLine = role('width-line');
    const leftHead = role('left-head');
    const rightHead = role('right-head');
    const label = role('width-label');
    const strokeWidth = Number(widthLine?.getAttribute('stroke-width')) || 2;
    const arrowLeft = Math.min(right, left + strokeWidth / 2);
    const arrowRight = Math.max(arrowLeft, right - strokeWidth / 2);
    if (leftBoundary) {
      leftBoundary.setAttribute('x1', left);
      leftBoundary.setAttribute('x2', left);
      leftBoundary.setAttribute('y1', top);
      leftBoundary.setAttribute('y2', bottom);
    }
    if (rightBoundary) {
      rightBoundary.setAttribute('x1', right);
      rightBoundary.setAttribute('x2', right);
      rightBoundary.setAttribute('y1', top);
      rightBoundary.setAttribute('y2', bottom);
    }
    if (widthLine) {
      widthLine.setAttribute('x1', arrowLeft);
      widthLine.setAttribute('x2', arrowRight);
      widthLine.setAttribute('y1', arrowY);
      widthLine.setAttribute('y2', arrowY);
    }
    leftHead?.setAttribute('d', `M ${arrowLeft + head} ${arrowY - 4} L ${arrowLeft} ${arrowY} L ${arrowLeft + head} ${arrowY + 4}`);
    rightHead?.setAttribute('d', `M ${arrowRight - head} ${arrowY - 4} L ${arrowRight} ${arrowY} L ${arrowRight - head} ${arrowY + 4}`);
    if (label) {
      label.setAttribute('x', left + width / 2);
      label.setAttribute('y', arrowY - 7);
    }
  }

  function interpolateSegmentGeometry(before, after, progress) {
    const result = {};
    Object.keys(after).forEach(key => {
      result[key] = before[key] + (after[key] - before[key]) * progress;
    });
    return result;
  }

  function play(options = {}) {
    const {
      root, document: traceDocument, frame, previousPlacements, currentPlacements,
      previousObjects, currentElements, transitionForKey
    } = options;
    if (!root || !currentPlacements || !currentElements) return Promise.resolve();

    // Automatic markers from several draw types are nested renderer objects.
    // Register their actual DOM geometry for lifecycle availability and tween
    // scheduling even when the renderer did not publish them in its maps.
    root.querySelectorAll('[data-trace-object-key][data-trace-source-variable-id]')
      .forEach(element => {
        if (retainedSnapshotVisual(element)) return;
        const key = String(element.dataset.traceObjectKey || '');
        if (!key) return;
        if (!currentElements.has(key)) currentElements.set(key, element);
        if (currentPlacements.has(key)) return;
        const position = elementTranslation(element);
        if (!position) return;
        let width = 0;
        let height = 0;
        try {
          const box = element.getBBox();
          width = Number(box.width) || 0;
          height = Number(box.height) || 0;
        } catch (error) {
          // Position alone is sufficient for marker lifecycle animation.
        }
        currentPlacements.set(key, { x: position.x, y: position.y, width, height });
      });

    const duration = Math.max(0, Number(options.duration) || 520);
    const initialDelay = Math.max(0, Number(options.initialDelayMs) || 0);
    if (!duration) return Promise.resolve();
    const runId = ++activeRun;
    const animationEffectLayer = createAnimationEffectLayer(root);
    const arrowRecord = (element, key) => {
      try { return { ...JSON.parse(element.dataset.traceArrowIdentity), element, key }; }
      catch { return null; }
    };
    const oldArrows = [...(previousObjects || new Map())].map(([key, element]) => arrowRecord(element, key)).filter(Boolean);
    const newArrows = [...root.querySelectorAll('[data-trace-arrow-identity]')]
      .map(element => arrowRecord(element, element.dataset.traceObjectKey)).filter(Boolean);
    const arrowPairs = window.ASMArrowModel?.pair?.(oldArrows, newArrows) || new Map();
    const pairedArrowKeys = new Set([...arrowPairs.values()].map(record => record.key));
    newArrows.forEach(record => {
      const previous = arrowPairs.get(record)?.element;
      record.element._asmArrowTween = previous ? { previous, progress: 0,
        targetColor: record.element.getAttribute('stroke'),
        targetWidth: Number(record.element.getAttribute('stroke-width')), color: (before, after, progress) => {
          const from = parseColor(before), to = parseColor(after);
          if (!from || !to) return progress < 1 ? before : after;
          const paint = interpolateColor(from, to, progress);
          return `rgba(${paint.r},${paint.g},${paint.b},${paint.a})`;
        } } : null;
      record.element.setAttribute('opacity', previous ? '1' : '0');
    });
    let resolveRun = null;
    const completion = new Promise(resolve => { resolveRun = resolve; });
    const finishRun = () => {
      if (!resolveRun) return;
      animationEffectLayer.clear();
      newArrows.forEach(({ element }) => {
        const tween = element._asmArrowTween;
        if (tween) {
          element.setAttribute('stroke', tween.targetColor);
          element.setAttribute('stroke-width', tween.targetWidth);
        }
        delete element._asmArrowTween;
        element.removeAttribute('opacity');
      });
      window.ASMTraceRenderers?.refreshArrows?.();
      const resolve = resolveRun;
      resolveRun = null;
      if (finishActiveRun === finishRun) finishActiveRun = null;
      resolve();
    };
    finishActiveRun = finishRun;
    const eventFrame = options.eventFrame || frame;
    hidePreKeepExitVisualsInSnapshots(root, eventFrame);
    const keepSnapshots = addedKeepSnapshots(
      traceDocument, options.previousFrame, frame, options.direction
    );
    const keepSnapshotIds = new Set(keepSnapshots.map(snapshot => snapshot.id));
    const keepTransitionKeys = new Set(keepSnapshots.map(snapshot => snapshot.key));
    const keepHandoffSources = keepSnapshotHandoffSources(keepSnapshots, previousPlacements);
    const keepTransitionDuration = keepTransitionKeys.size ? APPEAR_TIMING.duration : 0;
    const belongsToEnteringKeep = (element, topKey = '') => {
      const host = element?.matches?.('[data-trace-snapshot]')
        ? element
        : element?.closest?.('[data-trace-snapshot]');
      if (!host) return false;
      return keepSnapshotIds.has(String(host.dataset?.traceSnapshot || ''))
        || keepTransitionKeys.has(topKey);
    };
    const enteringKeepRuntimeIdentities = new Set();
    const enteringKeepSourceKeys = new Set();
    root.querySelectorAll('[data-trace-snapshot]').forEach(host => {
      if (!keepSnapshotIds.has(String(host.dataset?.traceSnapshot || ''))) return;
      host.querySelectorAll('[data-trace-object-key]').forEach(element => {
        const key = String(element.dataset?.traceObjectKey || '');
        const identity = String(element.dataset?.traceRuntimeIdentity || '');
        if (key) enteringKeepSourceKeys.add(key);
        if (identity) enteringKeepRuntimeIdentities.add(identity);
      });
    });
    const currentAutomaticMarkers = automaticMarkerKeys(frame);
    const frameIndex = traceDocument?.frames?.findIndex(item => item.id === frame.id) ?? -1;
    const timelinePreviousFrame = Number(options.direction) >= 0 && frameIndex > 0
      ? traceDocument.frames[frameIndex - 1]
      : options.previousFrame;
    const previousAutomaticMarkers = automaticMarkerKeys(timelinePreviousFrame);
    const now = performance.now();
    markerEntrancesByFrame.forEach((entry, frameId) => {
      if (entry.expiresAt <= now) markerEntrancesByFrame.delete(frameId);
    });
    const entranceSourceFrameId = String(options.previousFrame?.id || '');
    const rememberedEntrance = markerEntrancesByFrame.get(frame.id);
    const enteringMarkerKeys = new Set(
      rememberedEntrance?.sourceFrameId === entranceSourceFrameId
        ? rememberedEntrance.keys
        : []
    );
    const recursiveContinuations = recursiveRoleContinuations(
      traceDocument, options.previousFrame, frame, previousObjects, currentElements
    );
    const continuingKeys = new Set(recursiveContinuations.keys());
    currentElements.forEach((element, key) => {
      if (continuingKeys.has(topLevelKey(element, root))) continuingKeys.add(key);
    });
    const declaredVisualKeys = declarationVisualSchedule(
      traceDocument, eventFrame, [], currentPlacements, currentElements, continuingKeys
    ).declaredKeys;
    const markerContinuations = new Map();
    const redeclaredMarkerKeys = new Set();
    let detectedMarkerEntrance = false;
    currentElements.forEach((element, key) => {
      if (!element?.dataset?.traceSourceVariableId) return;
      const redeclared = markerDeclaredInFrame(eventFrame, element) && !continuingKeys.has(key);
      if (redeclared) {
        redeclaredMarkerKeys.add(key);
        // Definition-enabled markers enter at their declaration event. With
        // definition disabled they are immediately present, so neither case
        // belongs to the frame-level entrance phase.
        enteringMarkerKeys.delete(key);
      }
      const continuation = markerContinuationFor(
        element, key, previousPlacements, previousObjects
      );
      if (continuation && !redeclared) markerContinuations.set(key, continuation);
      if (!redeclared && !continuingKeys.has(key) && markerNeedsEntrance({
        element,
        key,
        previousPlacements,
        previousObjects,
        currentAutomaticMarkers,
        previousAutomaticMarkers,
        eventFrame
      })) {
        enteringMarkerKeys.add(key);
        detectedMarkerEntrance = true;
      }
    });
    declaredVisualKeys.forEach(key => enteringMarkerKeys.delete(key));
    if (detectedMarkerEntrance) {
      markerEntrancesByFrame.set(frame.id, {
        keys: new Set(enteringMarkerKeys),
        sourceFrameId: entranceSourceFrameId,
        expiresAt: now + 2000
      });
    }
    const preKeepEventTimeline = buildEventTimeline(
      traceDocument, eventFrame, options.direction, duration,
      previousPlacements, currentPlacements, currentElements,
      initialDelay, previousObjects, event => event?.preKeepExit === true
    );
    const provisionalRegularTimeline = buildEventTimeline(
      traceDocument, eventFrame, options.direction, duration,
      previousPlacements, currentPlacements, currentElements,
      0, previousObjects, event => event?.preKeepExit !== true
    );
    const provisionalEventTimeline = [...preKeepEventTimeline, ...provisionalRegularTimeline];
    const eventControlledKeys = new Set(eventMotionDelays(
      traceDocument, eventFrame, provisionalEventTimeline, currentPlacements, currentElements
    ).keys());
    // Event switches control presentation only. Even a disabled assignment
    // still changes the runtime marker state, so it must not be mistaken for a
    // recursive/frame-level transition to the frame-final position.
    orderedEvents(eventFrame).forEach(event => {
      markersForLogicalEvent(event, currentElements, eventFrame).forEach(marker => {
        eventControlledKeys.add(marker.key);
      });
    });
    const markerReflowKeys = new Set();
    const markerReflowDuration = markerGroupReflowDuration({
      enteringMarkerKeys,
      currentElements,
      previousPlacements,
      currentPlacements,
      previousObjects,
      transitionForKey,
      duration,
      reflowKeys: markerReflowKeys,
      traceDocument,
      eventFrame
    });
    const transitionSteps = recursiveMarkerTransitionSteps({
      previousPlacements,
      currentPlacements,
      previousObjects,
      currentElements,
      transitionForKey,
      duration,
      eventControlledKeys
    });
    transitionSteps.push(...swapContainerPlacementTransitionSteps({
      eventFrame,
      previousPlacements,
      currentPlacements,
      previousObjects,
      currentElements,
      transitionForKey,
      duration
    }));
    if (markerReflowDuration > 0) {
      transitionSteps.push({
        id: 'marker-group-reflow',
        kind: 'object-transition',
        subtype: 'marker-group-reflow',
        targetKeys: [...markerReflowKeys],
        durationMs: markerReflowDuration,
        blocking: true,
        enabled: true,
        source: 'automatic'
      });
    }
    const preEventPlan = createPlaybackPlan({
      frame,
      direction: options.direction,
      runId,
      transitionSteps,
      enteringMarkerKeys,
      eventTimeline: preKeepEventTimeline,
      initialDelayMs: initialDelay,
      keepTransitionKeys,
      keepTransitionDurationMs: keepTransitionDuration,
      cameraTransitionDurationMs: options.cameraTransitionDurationMs
    });
    const regularEventTimeline = buildEventTimeline(
      traceDocument, eventFrame, options.direction, duration,
      previousPlacements, currentPlacements, currentElements,
      Math.max(preEventPlan.preEventDurationMs, markerReflowDuration),
      previousObjects, event => event?.preKeepExit !== true
    );
    const eventTimeline = [...preKeepEventTimeline, ...regularEventTimeline];
    eventTimeline.forEach(slot => { slot.continuingVisualKeys = continuingKeys; });
    const declarationSchedule = declarationVisualSchedule(
      traceDocument, eventFrame, eventTimeline, currentPlacements, currentElements, continuingKeys
    );
    const declarationReflowSchedule = declarationMarkerReflowSchedule({
      traceDocument,
      eventFrame,
      entranceSlots: declarationSchedule.slotsByKey,
      currentElements,
      previousPlacements,
      currentPlacements,
      previousObjects
    });
    const exitReflowSchedule = exitMarkerReflowSchedule({
      eventTimeline,
      currentElements,
      previousPlacements,
      currentPlacements,
      previousObjects
    });
    const playbackPlan = createPlaybackPlan({
      frame,
      direction: options.direction,
      runId,
      transitionSteps,
      enteringMarkerKeys,
      eventTimeline,
      initialDelayMs: initialDelay,
      keepTransitionKeys,
      keepTransitionDurationMs: keepTransitionDuration,
      cameraTransitionDurationMs: options.cameraTransitionDurationMs
    });
    const forwardReplayPlan = createForwardReplayPlan(
      traceDocument, eventFrame, eventTimeline, options.direction
    );
    playbackPlan.forwardReplay = {
      version: forwardReplayPlan.version,
      direction: forwardReplayPlan.direction,
      frameId: forwardReplayPlan.frameId,
      initialState: forwardReplayPlan.initialState,
      finalState: forwardReplayPlan.finalState,
      checkpoints: forwardReplayPlan.checkpoints.map(({ event, ...checkpoint }) => checkpoint)
    };
    const keepSettlementDuration = Number(
      playbackPlan.phases.find(phase => phase.id === 'keep-transition')?.durationMs
    ) || 0;
    const frameTransitionStart = Number(
      playbackPlan.phases.find(phase => phase.id === 'frame-transition')?.startMs
    ) || initialDelay;
    // A destination scene is rendered before playback begins, but it must not
    // become visible while enabled exits from the previous function/recursive
    // scene are still running. Disabled and unavailable exits never enter the
    // event timeline, so they add no delay.
    const sceneEntranceStart = enabledExitBarrierEnd(eventTimeline, frameTransitionStart);
    const functionSceneChanged = frameSceneBoundaryChanged(options.previousFrame, frame);
    root.dataset.tracePlaybackPlanId = playbackPlan.id;
    root.dataset.tracePlaybackPhase = playbackPhaseAt(playbackPlan, 0);
    const previousIdentityKeys = previousKeysByRuntimeIdentity(previousObjects);
    const heapResizeDescriptors = prepareHeapResizeSwaps(
      traceDocument, eventFrame, eventTimeline,
      currentElements, previousObjects, previousIdentityKeys
    );
    const sequenceEntrances = new Map();
    const sequenceResizeSlots = new Map();
    eventTimeline.filter(slot => slot.animation === 'sequence').forEach(slot => {
      sequenceCellKeys(traceDocument, eventFrame, slot.event).forEach(cellKey => {
        sequenceEntrances.set(cellKey, slot);
        sequenceEntrances.set(`${cellKey}:index`, slot);
      });
      const before = Number(slot.event?.payload?.beforeSize);
      const after = Number(slot.event?.payload?.afterSize);
      const target = (slot.event?.targets || []).find(item => item.role === 'target')
        || slot.event?.targets?.[0];
      if (before === after || !target?.variableId) return;
      const key = eventTargetKey(traceDocument, eventFrame, target);
      if (!sequenceResizeSlots.has(key)) sequenceResizeSlots.set(key, []);
      sequenceResizeSlots.get(key).push(slot);
    });
    const swapMap = swapSources(traceDocument, eventFrame, eventTimeline);
    const motionDelays = eventMotionDelays(
      traceDocument, eventFrame, eventTimeline, currentPlacements, currentElements
    );
    const visualKeyBySource = new Map();
    swapMap.forEach((swap, visualKey) => visualKeyBySource.set(swap.sourceKey, visualKey));
    const rawDeltas = new Map();
    const entries = [];
    const visualCommits = mutationVisualCommits(traceDocument, eventFrame, eventTimeline);
    const currentTopKeys = new Set();
    const attachmentsByKey = new Map();

    root.querySelectorAll('[data-trace-attached-to]').forEach(element => {
      // Style decorations have their own presented-matrix layer. Wrapping
      // them here would apply the cell motion a second time.
      if (element.closest('.asm-trace-style-layer')) return;
      const key = element.getAttribute('data-trace-attached-to') || '';
      if (!key) return;
      if (!attachmentsByKey.has(key)) attachmentsByKey.set(key, []);
      attachmentsByKey.get(key).push(element);
    });

    currentElements.forEach((element, key) => {
      if (!element?.isConnected) return;
      // Retention connectors are persistent infrastructure, not entering or
      // exiting visual objects. Their endpoints are updated by the renderer.
      if (element.classList?.contains('asm-trace-keep-arrow')) return;
      if (element.hasAttribute?.('data-trace-arrow-identity')) return;
      const currentPlacement = currentPlacements.get(key);
      if (!currentPlacement) return;
      const current = motionPosition(element, currentPlacement);
      const plan = transitionForKey?.(key) || { mode: 'move', sourceKey: key, duration };
      const swap = swapMap.get(key);
      const markerContinuation = markerContinuations.get(key);
      const useMarkerContinuation = markerContinuation
        && !redeclaredMarkerKeys.has(key)
        && !swap
        && (plan.requestedMode === 'auto' || !plan.sourceKey || plan.sourceKey === key);
      const requestedSourceKey = useMarkerContinuation
        ? markerContinuation.key
        : swap?.sourceKey || plan.sourceKey || key;
      const topKey = topLevelKey(element, root);
      const topElement = currentElements.get(topKey) || element;
      const keepSnapshotMember = belongsToEnteringKeep(element, topKey);
      const retainedSnapshot = retainedSnapshotVisual(element);
      const keepTransition = keepSnapshotMember && key === topKey;
      const keepHandoffSourceKey = keepTransition ? keepHandoffSources.get(topKey) || '' : '';
      const sourceKey = previousAliasKey(
        keepHandoffSourceKey || requestedSourceKey,
        topKey,
        topElement,
        previousPlacements,
        previousIdentityKeys
      );
      const candidatePreviousVisual = redeclaredMarkerKeys.has(key)
        ? null
        : useMarkerContinuation
        ? markerContinuation.element
        : previousVisualElement(previousObjects, sourceKey);
      const activationChanged = markerActivationChanged(element, candidatePreviousVisual);
      // @keep cuts every live visual into a new scene, not only automatic
      // markers. The retained copy owns the old generation; the following
      // array/cell/object must enter independently instead of borrowing the
      // old runtime object's already-visible DOM.
      const generationChanged = candidatePreviousVisual
        && !keepSnapshotMember
        && !retainedSnapshot
        && !sameSceneGeneration(element, candidatePreviousVisual);
      const sceneActivationChanged = key === topKey
        && !keepSnapshotMember
        && !retainedSnapshot
        && !continuingKeys.has(key)
        && needsSceneBoundaryEntrance(
          functionSceneChanged,
          topElement,
          candidatePreviousVisual
        );
      const previous = redeclaredMarkerKeys.has(key) || activationChanged || generationChanged
        ? null
        : (useMarkerContinuation
          ? markerContinuation.placement
          : previousPlacements?.get(sourceKey));
      const mode = previous && plan.requestedMode === 'auto'
        ? 'move'
        : plan.mode || (previous ? 'move' : 'lift');
      // Snapshot hosts store their authored origin, while placements describe
      // the actual rendered content bounds. A keep handoff must align those
      // content bounds with the outgoing live object, otherwise the retained
      // array visibly nudges by its inner padding before settling.
      const deltaCurrent = keepHandoffSourceKey ? currentPlacement : current;
      const raw = previous
        ? {
          x: (Number(previous.x) || 0) - (Number(deltaCurrent.x) || 0),
          y: (Number(previous.y) || 0) - (Number(deltaCurrent.y) || 0)
        }
        : { x: 0, y: 24 };
      rawDeltas.set(key, raw);
      const topResizeSlots = sequenceResizeSlots.get(topKey) || [];
      // A heap level change moves the container origin as well as its cells.
      // Hold both at the previous geometry until the sequence resize starts,
      // then let the container, outerframe, cells and labels settle together.
      const sequenceMotionSlot = previous
        && topResizeSlots.length === 1
        && Boolean(heapLayoutElement(topElement))
        && (key === topKey || Boolean(element.closest?.('[data-layout="heap"]')))
        ? topResizeSlots[0]
        : null;
      const sequenceGeometrySlot = key !== topKey ? sequenceMotionSlot : null;
      if (topKey === key) {
        currentTopKeys.add(key);
        if (sourceKey) currentTopKeys.add(sourceKey);
      }
      entries.push({
        key, sourceKey, element, current, previous, plan, mode, topKey,
        keepTransition, keepSnapshotMember, retainedSnapshot,
        keepHandoff: Boolean(keepHandoffSourceKey && previous),
        sceneBoundaryEntrance: generationChanged || sceneActivationChanged,
        lifecycleKind: keepTransition ? 'keep-snapshot' : visualLifecycleKind(element),
        markerContinuation: useMarkerContinuation ? markerContinuation : null,
        declarationReflow: declarationReflowSchedule.get(key) || null,
        exitReflow: exitReflowSchedule.get(key) || null,
        markerGroupReflow: markerReflowKeys.has(key),
        sequenceMotionSlot,
        sequenceGeometrySlot,
        // A marker that only shifts aside for an entering peer must move at
        // frame start even when a later event also references that marker.
        motionDelay: sequenceMotionSlot
          ? Math.max(Number(sequenceMotionSlot.start) || 0, frameTransitionStart)
          : declarationReflowSchedule.has(key)
          ? Number(declarationReflowSchedule.get(key)?.start) || 0
          : exitReflowSchedule.has(key)
            ? Number(exitReflowSchedule.get(key)?.start) || 0
          : Math.max(frameTransitionStart, markerFrameMotionDelay(
            key, swap?.start, motionDelays.get(key), markerReflowKeys
          ))
      });
    });

    const entriesByKey = new Map(entries.map(entry => [entry.key, entry]));
    entries.forEach(entry => {
      entry.isIndexLabel = entry.element?.hasAttribute?.('data-trace-index-label') === true;
      entry.indexLabelEntrance = indexLabelGrowthCandidate(
        entry, previousPlacements, previousObjects
      );
      const parentKey = parentObjectKey(entry.element, root);
      const own = rawDeltas.get(entry.key) || { x: 0, y: 0 };
      const parent = rawDeltas.get(parentKey) || { x: 0, y: 0 };
      const declarationDirect = declarationSchedule.declaredKeys.has(entry.key)
        && !declarationSchedule.slotsByKey.has(entry.key);
      const topEntry = entriesByKey.get(entry.topKey);
      // Reference parameters can give the same container a new source key in
      // another function/recursion. The top-level runtime identity still
      // proves continuity, but a nested cell may have no independently keyed
      // previous placement. In that case it must inherit the container motion
      // instead of applying an inverse delta that leaves the cell behind.
      const inheritParentMotion = entry.key !== entry.topKey
        && !entry.previous
        && Boolean(topEntry?.previous);
      const relativeDelta = relativeMotionDelta(own, parent, {
        // The name already receives x/y interpolation from the outerframe
        // geometry. A second child motion would move it twice while the
        // background and name area only move once.
        lockToTarget: outerframeGeometryLabel(entry.element)
          || (entry.isIndexLabel && !entry.sequenceGeometrySlot)
          || declarationDirect || (entry.keepSnapshotMember && !entry.keepHandoff),
        inheritParentMotion
      });
      entry.dx = relativeDelta.x;
      entry.dy = relativeDelta.y;
      entry.target = entry.key === entry.topKey
        ? entry.element.querySelector(':scope > .asm-trace-motion') || entry.element
        : entry.element;
      entry.baseTransform = entry.target.getAttribute('transform') || '';
      entry.baseOpacity = entry.target.getAttribute('opacity');
      const declarationSlot = declarationSchedule.slotsByKey.get(entry.key) || null;
      // A scalar/container declaration owns the whole freshly-created visual,
      // including nested cell groups.  The value commit may keep the text
      // blank until the following assignment, but it must not hide the cell
      // frame after the declared parent has entered.
      const declarationKnown = declarationSchedule.declaredKeys.has(entry.key)
        || declarationSchedule.declaredKeys.has(entry.topKey);
      entry.declarationOwned = declarationKnown;
      // A bottom index decoration is anchored to its own data cell. If that
      // cell already exists, reveal the box downward from the cell edge; if
      // the whole array is new, ride its entrance instead of flying in from
      // a generic offset that can belong to another wrapped row.
      entry.appearing = entry.indexLabelEntrance || (!entry.isIndexLabel
        && shouldAnimateObjectEntrance({
        keepSnapshotMember: entry.keepSnapshotMember,
        retainedSnapshot: entry.retainedSnapshot,
        declarationSlot,
        declarationKnown,
        sceneBoundaryEntrance: entry.sceneBoundaryEntrance,
        hasPrevious: Boolean(entry.previous),
        enteringMarker: enteringMarkerKeys.has(entry.key)
      }));
      const sequenceEntrance = !entry.previous && !entry.keepSnapshotMember
        && !entry.retainedSnapshot
        ? sequenceEntrances.get(entry.key) || null : null;
      if (sequenceEntrance) entry.appearing = true;
      // A new ordinary object (including @text) belongs to the visual phase,
      // so it must remain hidden while the code panel is changing. Markers use
      // their dedicated entrance phase after keep/layout settlement. Objects
      // controlled by an enabled declaration stay absent until that exact
      // event slot; a disabled declaration skips entrance and shows the final
      // declared state immediately.
      entry.appearanceStart = entry.keepTransition
        ? frameTransitionStart
        : declarationSlot
        ? (Number(declarationSlot.start) || 0)
          + (Number(declarationSlot.declarationEntranceDelay) || 0)
        : entry.sceneBoundaryEntrance
          ? sceneEntranceStart
        : enteringMarkerKeys.has(entry.key)
          ? playbackPlan.phases.find(phase => phase.id === 'object-entrance').startMs
          : frameTransitionStart;
      if (sequenceEntrance) entry.appearanceStart = Number(sequenceEntrance.start) || 0;
      entry.declarationEntrance = Boolean(declarationSlot);
      if (entry.appearing) entry.target.dataset.traceAppearing = '1';
      entry.attachedVisuals = (attachmentsByKey.get(entry.key) || [])
        .map(wrapAttachedVisual)
        .filter(Boolean);
      try {
        const box = entry.element.getBBox();
        entry.compareCenter = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      } catch (error) {
        entry.compareCenter = { x: 0, y: 0 };
      }
      entry.rects = [...entry.element.querySelectorAll('rect')];
      entry.indexLabelGeometry = entry.indexLabelEntrance
        ? indexLabelGrowthGeometry(entry.element) : null;
      // A retained snapshot is an immutable visual domain. Its cells and
      // styles must already be the captured final state while the group moves
      // into its layout slot; never fade it in or interpolate its styling from
      // the outgoing live object.
      const previousTop = entry.keepSnapshotMember
        ? null
        : previousObjects?.get(entry.topKey);
      const markerContinuation = entry.markerContinuation;
      const candidatePreviousVisual = entry.keepSnapshotMember
        ? null
        : markerContinuation?.element
          || previousVisualForEntry(entry.element, previousObjects, entry.sourceKey);
      const previousVisual = markerActivationChanged(entry.element, candidatePreviousVisual)
        ? null
        : candidatePreviousVisual;
      entry.previousVisual = previousVisual;
      entry.sequenceRectGeometry = entry.sequenceGeometrySlot && previousVisual
        ? alignedDirectRectGeometry(previousVisual, entry.element)
        : [];
      entry.previousSegmentGeometry = segmentGeometry(previousVisual);
      entry.currentSegmentGeometry = segmentGeometry(entry.element);
      // The outerframe is part of the same moving array as its cells. Keep
      // its authored final geometry separately because each tick rewrites the
      // live SVG attributes while the child cells follow their own deltas.
      entry.currentOuterframeGeometry = entry.key === entry.topKey
        ? outerframeGeometry(entry.element) : null;
      const resizeSlots = sequenceResizeSlots.get(entry.key) || [];
      entry.outerframeResizeSlot = resizeSlots.length === 1 ? resizeSlots[0] : null;
      entry.previousOuterframeGeometry = entry.currentOuterframeGeometry
        && entry.previous && !entry.keepSnapshotMember
        ? outerframeGeometry(previousVisual) : null;
      entry.visualCommit = visualCommits.get(entry.key) || null;
      entry.previousRectStates = previousVisual
        ? alignedRectStates(previousVisual, entry.element, entry.topKey)
        : (previousTop ? rectStates(previousTop, entry.topKey) : new Map());
      entry.currentRectStates = rectStates(entry.element, entry.topKey);
      entry.geometryTransition = outerframeGeometryChanged(
        entry.previousOuterframeGeometry, entry.currentOuterframeGeometry
      ) || (entry.previousSegmentGeometry && entry.currentSegmentGeometry
        && Object.keys(entry.currentSegmentGeometry).some(key => (
          Math.abs(entry.currentSegmentGeometry[key] - entry.previousSegmentGeometry[key]) > 0.01
        )));
      entry.repaintTransition = !entry.visualCommit
        && [...entry.currentRectStates].some(([key, after]) => {
          const before = entry.previousRectStates.get(key);
          return before && (before.fill !== after.fill || before.opacity !== after.opacity);
        });
      entry.markerLabelBox = entry.element.querySelector('.trace-variable-marker-label-box');
      entry.markerLabelText = entry.element.querySelector('.trace-variable-marker-label-text');
      entry.markerPointPath = entry.element.querySelector('.trace-variable-marker-point path');
      entry.markerLabelBoxBaseTransform = entry.markerLabelBox?.getAttribute('transform') || '';
      entry.markerLabelTextBaseTransform = entry.markerLabelText?.getAttribute('transform') || '';
      entry.markerPointBasePath = entry.markerPointPath?.getAttribute('d') || '';
    });
    const heapResizeStages = createHeapResizeSwapStages(root, heapResizeDescriptors);
    const scopeExitControlledKeys = new Set();
    orderedEvents(eventFrame).filter(event => (
      event.type === 'scope-exit' || event.type === 'visual-exit'
    )).forEach(event => {
      scopeExitVisualKeys(event, previousObjects).forEach(key => scopeExitControlledKeys.add(key));
    });
    const currentScopeExitSlots = new Map();
    eventTimeline.filter(slot => slot.animation === 'exit').forEach(slot => {
      (slot.event?.targets || []).forEach(target => {
        currentElements?.forEach?.((element, key) => {
          if (!visualMatchesScopeExitTarget(element, target)
            || currentScopeExitSlots.has(key)) return;
          currentScopeExitSlots.set(key, slot);
        });
      });
    });
    entries.forEach(entry => {
      // Automatic variable markers are nested renderer objects. Depending on
      // the draw type they are not guaranteed to be present in the renderer's
      // public element map, even though they are real tween entries. Match the
      // actual animated element as the final authority so a loop-local or
      // recursive marker always receives its lifetime-specific exit slot.
      const directSlot = eventTimeline.find(slot => (
        slot.animation === 'exit'
        && (slot.event?.targets || []).some(target => (
          visualMatchesScopeExitTarget(entry.element, target)
        ))
      )) || null;
      entry.scopeExitSlot = directSlot || currentScopeExitSlots.get(entry.key) || null;
      if (entry.scopeExitSlot && !currentScopeExitSlots.has(entry.key)) {
        currentScopeExitSlots.set(entry.key, entry.scopeExitSlot);
      }
    });
    const entryElements = new Set(entries.map(entry => entry.element));
    const markerEntryElements = entries
      .filter(entry => entry.lifecycleKind === 'marker')
      .map(entry => entry.element);
    const nestedLifecycleVisuals = [];
    root.querySelectorAll('[data-trace-source-variable-id], [data-trace-variable]')
      .forEach(element => {
        if (entryElements.has(element)) return;
        if (markerEntryElements.some(marker => marker.contains?.(element))) return;
        const declarationSlot = eventTimeline.find(slot => (
          slot.animation === 'declare'
          && !continuingKeys.has(String(element.dataset?.traceObjectKey || ''))
          && (slot.event?.targets || []).some(target => (
            visualMatchesScopeExitTarget(element, target)
          ))
        )) || null;
        const exitSlot = eventTimeline.find(slot => (
          slot.animation === 'exit'
          && (slot.event?.targets || []).some(target => (
            visualMatchesScopeExitTarget(element, target)
          ))
        )) || null;
        if (!declarationSlot && !exitSlot) return;
        nestedLifecycleVisuals.push({
          element,
          declarationSlot,
          exitSlot,
          lifecycleKind: visualLifecycleKind(element),
          baseTransform: element.getAttribute('transform') || ''
        });
      });

    const previousExitGhosts = [];
    const previousExitIdentities = new Set();
    eventTimeline.filter(slot => slot.animation === 'exit').forEach(slot => {
      scopeExitVisualMatches(slot.event, previousObjects).forEach(match => {
        if (slot.event?.type !== 'visual-exit' && !slot.event?.manualVisualExit
          && [...recursiveContinuations.values()].some(item => item.element === match.visual)) return;
        // A frame directive can capture a marker before the loop-local value
        // reaches its scope exit. In that case the current scene already owns
        // the exact lifetime that must fade out. Cloning the previous scene as
        // an exit ghost would temporarily draw both the old and current j/j+1
        // markers (most visibly on the final inner-loop frame of bubble sort).
        // Let the current tween entry handle the exit and reserve ghosts for
        // lifetimes that are genuinely absent from the newly rendered scene.
        if (hasCurrentScopeExitVisual(match.target, currentElements)) return;
        // Reference parameters receive a fresh C++ lifetime in every function
        // or recursive activation even when they still refer to the exact same
        // container.  The binding leaves scope, but the visual object does not:
        // cloning the old top-level array here would draw it on top of the new
        // activation until the exit slot completes.
        if (scopeExitVisualContinues(match.visual, currentElements, slot.event)) return;
        const identity = [
          match.topKey,
          match.target?.variableId,
          match.target?.lifetimeIdentity,
          match.target?.sceneGeneration
        ].join('|');
        // @exit followed by an absorbed natural scope-exit describes the same
        // lifetime. Animate it once, at the first runtime-ordered exit slot.
        if (previousExitIdentities.has(identity)) return;
        const isolated = isolatedScopeExitClone(match.element, match.target);
        if (!isolated) return;
        previousExitIdentities.add(identity);
        removeAnimationNodes(isolated.clone);
        [isolated.clone, ...isolated.clone.querySelectorAll('[id], [data-trace-object-key]')]
          .forEach(node => {
            node.removeAttribute?.('id');
            node.removeAttribute?.('data-trace-object-key');
          });
        isolated.clone.classList.add('asm-trace-transition-ghost');
        isolated.clone.setAttribute('pointer-events', 'none');
        syncPresentationHints(isolated.clone);
        const wrapper = createSvg('g', {
          class: 'asm-trace-transition-ghost-motion',
          'pointer-events': 'none'
        });
        wrapper.append(isolated.clone);
        root.prepend(wrapper);
        const exitReflow = [...exitReflowSchedule.values()].find(reflow => (
          String(reflow?.eventId || '') === String(slot.event?.id || '')
        )) || null;
        previousExitGhosts.push({
          wrapper,
          scopeExitSlot: slot,
          lifecycleKind: visualLifecycleKind(isolated.visual),
          exitReflow
        });
      });
    });
    const ghosts = [...previousExitGhosts];
    previousObjects?.forEach((clone, key) => {
      // A disabled exit applies the final absent state immediately; it must
      // not fall back to the generic cross-frame lift/fade.
      if (scopeExitControlledKeys.has(key)) return;
      if (clone.classList?.contains('asm-trace-keep-arrow')) return;
      if (pairedArrowKeys.has(key)) return;
      if (currentTopKeys.has(key)
        || heapResizeStages.heldPreviousKeys.has(key)) return;
      removeAnimationNodes(clone);
      clone.removeAttribute('id');
      clone.removeAttribute('data-trace-object-key');
      clone.classList.add('asm-trace-transition-ghost');
      clone.setAttribute('pointer-events', 'none');
      syncPresentationHints(clone);
      const wrapper = createSvg('g', { class: 'asm-trace-transition-ghost-motion', 'pointer-events': 'none' });
      wrapper.append(clone);
      root.prepend(wrapper);
      const retainedByEnteringKeep = previousVisualRetainedByEnteringKeep(
        key, clone, enteringKeepSourceKeys, enteringKeepRuntimeIdentities
      );
      ghosts.push({
        wrapper,
        scopeExitSlot: null,
        lifecycleKind: visualLifecycleKind(clone),
        retainedByEnteringKeep
      });
    });

    const appearingKeys = new Set(entries.filter(entry => entry.appearing).map(entry => entry.key));
    const events = eventSequence({
      ...options,
      rawDeltas,
      markerEntries: entries,
      markerReflowKeys,
      markerReflowDuration,
      exitReflowSchedule,
      appearingKeys,
      forwardReplayPlan,
      visualKeyForSource: key => visualKeyBySource.get(key) || key
    }, eventFrame, eventTimeline);
    const eventTimelineDuration = eventTimeline.reduce((end, slot) => Math.max(end, slot.end), 0);
    const motionDuration = entries.reduce((end, entry) => {
      const localDuration = Math.max(
          1,
          Number(entry.sequenceMotionSlot?.duration)
          || Number(entry.declarationReflow?.duration)
          || Number(entry.exitReflow?.duration)
          || (entry.markerGroupReflow ? markerReflowDuration : 0)
          || Number(entry.plan?.duration)
          || duration
      );
      const normalEnd = entry.motionDelay + localDuration;
      const appearanceEnd = entry.appearing
        ? entry.appearanceStart + Math.min(APPEAR_TIMING.duration, localDuration)
        : 0;
      return Math.max(end, normalEnd, appearanceEnd);
    }, duration);
    const totalDuration = Math.max(
      eventTimelineDuration,
      motionDuration,
      playbackPlan.totalDurationMs
    );
    let previousTick = performance.now();
    let elapsed = 0;
    let codeTransitionElapsed = 0;
    let animationElapsed = 0;
    function tick(now) {
      if (runId !== activeRun) return;
      let wallDelta = Math.max(0, now - previousTick);
      previousTick = now;
      if (codeTransitionElapsed < initialDelay) {
        const delayDelta = Math.min(wallDelta, initialDelay - codeTransitionElapsed);
        codeTransitionElapsed += delayDelta;
        wallDelta -= delayDelta;
      }
      if (wallDelta > 0) animationElapsed += wallDelta * animationPlaybackRate();
      elapsed = codeTransitionElapsed + animationElapsed;
      if (window.ASMTraceDebugRecorder?.isRecording?.()) {
        root.dataset.traceDebugElapsedMs = String(elapsed);
      }
      const playbackPhase = playbackPhaseAt(playbackPlan, elapsed);
      if (playbackPhase) root.dataset.tracePlaybackPhase = playbackPhase;
      else delete root.dataset.tracePlaybackPhase;
      const progress = Math.max(0, Math.min(1, elapsed / duration));
      const eased = easeOutCubic(progress);

      if (elapsed < eventTimelineDuration) {
        events?.update(elapsed);
      } else {
        events?.finish();
      }
      heapResizeStages.update(elapsed, events?.adjustments);

      const motionStates = new Map();
      entries.forEach(entry => {
        const motionElapsed = Math.max(0, elapsed - entry.motionDelay);
        const localDuration = Math.max(
          1,
          Number(entry.sequenceMotionSlot?.duration)
            || Number(entry.declarationReflow?.duration)
            || Number(entry.exitReflow?.duration)
            || (entry.markerGroupReflow ? markerReflowDuration : 0)
            || Number(entry.plan?.duration)
            || duration
        );
        const localProgress = Math.max(0, Math.min(1, motionElapsed / localDuration));
        const localEased = easeOutCubic(localProgress);
        const appearElapsed = Math.max(0, elapsed - entry.appearanceStart);
        const appearProgress = clamp01(
          appearElapsed / Math.min(APPEAR_TIMING.duration, localDuration)
        );
        const appearEased = easeOutCubic(appearProgress);
        let dx = entry.dx * (1 - localEased);
        let dy = entry.dy * (1 - localEased);
        if (entry.mode === 'arc' && entry.previous) {
          dy -= Math.sin(Math.PI * localEased) * Math.max(18, Math.min(90, Math.hypot(entry.dx, entry.dy) * 0.22));
        }
        if (entry.mode === 'instant' || entry.mode === 'fade') dx = dy = 0;
        if (entry.appearing) {
          dx = 0;
          // Text captions fade in at their authored position. Automatic
          // markers always descend from above, including declaration-owned
          // entrances. Other declared objects retain their in-place fade.
          dy = entry.lifecycleKind === 'text'
            || (entry.declarationEntrance && entry.lifecycleKind !== 'marker')
            ? 0
            : visualLifecycleOffsetY(entry.lifecycleKind, 'enter', appearEased);
        }
        if (entry.previousSegmentGeometry && entry.currentSegmentGeometry) {
          dx = 0;
          dy = 0;
          applySegmentGeometry(
            entry.element,
            interpolateSegmentGeometry(
              entry.previousSegmentGeometry,
              entry.currentSegmentGeometry,
              localEased
            )
          );
        }
        const adjustment = events?.adjustments?.get?.(entry.key) || { x: 0, y: 0, scale: 1 };
        const adjustedX = adjustment.absolute === true
          ? Number(adjustment.x) || 0
          : dx + (Number(adjustment.x) || 0);
        const exitProgress = entry.scopeExitSlot
          ? easeOutCubic(clamp01(
            Math.max(0, elapsed - Number(entry.scopeExitSlot.start || 0))
              / Math.max(1, Number(entry.scopeExitSlot.exitDuration) || APPEAR_TIMING.duration)
          ))
          : 0;
        const exitOffsetY = visualLifecycleOffsetY(
          entry.lifecycleKind, 'exit', exitProgress
        );
        const adjustedY = (adjustment.absolute === true
          ? (Number(adjustment.y) || 0) + (entry.appearing ? dy : 0)
          : dy + (Number(adjustment.y) || 0)) + exitOffsetY;
        motionStates.set(entry.key, {
          x: adjustedX,
          y: adjustedY,
          scale: Number(adjustment.scale) || 1,
          localEased,
          appearProgress,
          appearEased,
          exitProgress
        });
      });
      // The effect layer is reserved for direct event participants. Ordinary
      // frame movement, outerframe resizing and repainting stay in the normal
      // object layer; promoting every transitioning entry can lift a whole
      // container and then its cells, changing child order and z-order.
      const animatedVisuals = [];
      nestedLifecycleVisuals.forEach(({ element, declarationSlot, exitSlot }) => {
        const entranceStart = (Number(declarationSlot?.start) || 0)
          + (Number(declarationSlot?.declarationEntranceDelay) || 0);
        const exitStart = Number(exitSlot?.start) || 0;
        if ((declarationSlot && elapsed >= entranceStart
            && elapsed < entranceStart + APPEAR_TIMING.duration)
          || (exitSlot && elapsed >= exitStart
            && elapsed < exitStart + (Number(exitSlot.exitDuration) || APPEAR_TIMING.duration))) {
          animatedVisuals.push(element);
        }
      });
      animatedVisuals.push(...(events?.animatedElements || []));
      animationEffectLayer.sync(animatedVisuals);
      entries.forEach(entry => {
        const state = motionStates.get(entry.key);
        const adjustedX = state.x;
        const adjustedY = state.y;
        const translate = Math.abs(adjustedX) > 0.01 || Math.abs(adjustedY) > 0.01
          ? `translate(${adjustedX}, ${adjustedY})`
          : '';
        const scale = state.scale;
        const pivot = entry.compareCenter || { x: 0, y: 0 };
        const scaleTransform = Math.abs(scale - 1) > 0.001
          ? `translate(${pivot.x}, ${pivot.y}) scale(${scale}) translate(${-pivot.x}, ${-pivot.y})`
          : '';
        entry.target.setAttribute('transform', [translate, entry.baseTransform, scaleTransform].filter(Boolean).join(' '));
        if (entry.sequenceRectGeometry?.length) {
          applyLeftAnchoredRectGeometry(entry.sequenceRectGeometry, state.localEased);
        }
        applyIndexLabelGrowth(entry.indexLabelGeometry, state.appearEased);
        if (entry.previousOuterframeGeometry) {
          const resizeSlot = entry.outerframeResizeSlot;
          const geometryProgress = resizeSlot
            ? easeOutCubic(clamp01((elapsed - Number(resizeSlot.start))
              / Math.max(1, Number(resizeSlot.duration))))
            : state.localEased;
          applyOuterframeGeometry(
            entry.currentOuterframeGeometry,
            entry.previousOuterframeGeometry,
            geometryProgress
          );
        }
        entry.attachedVisuals.forEach(attachment => {
          attachment.wrapper.setAttribute('transform', [translate, scaleTransform].filter(Boolean).join(' '));
        });
        const markerArrowState = events?.markerArrowStates?.get?.(entry.key);
        if (entry.markerPointPath && markerArrowState) {
          entry.markerPointPath.setAttribute('d', markerArrowPath(entry, markerArrowState));
        }
        if (entry.appearing) {
          entry.target.setAttribute('opacity', String(state.appearEased));
          if (state.appearProgress >= 1) delete entry.target.dataset.traceAppearing;
          entry.attachedVisuals.forEach(attachment => {
            attachment.wrapper.setAttribute('opacity', String(state.appearEased));
          });
        } else if (entry.mode === 'fade') {
          entry.target.setAttribute('opacity', String(state.localEased));
        }
        if (entry.visualCommit && elapsed < entry.visualCommit.time
          && !entry.previousVisual && !entry.declarationOwned) {
          entry.target.setAttribute('opacity', '0');
        }
        const eventOpacity = events?.opacities?.get?.(entry.key);
        if (Number.isFinite(eventOpacity)) entry.target.setAttribute('opacity', String(eventOpacity));
        if (entry.scopeExitSlot) {
          // One frame can contain both a declaration entrance and its matching
          // scope exit. Compose the phases so exit cannot reveal the object by
          // overwriting an entrance opacity that is still below one.
          const appearOpacity = entry.appearing ? state.appearEased : 1;
          const lifecycleOpacity = composeLifecycleOpacity(appearOpacity, state.exitProgress);
          entry.target.setAttribute('opacity', String(lifecycleOpacity));
          entry.attachedVisuals.forEach(attachment => {
            attachment.wrapper.setAttribute('opacity', String(lifecycleOpacity));
          });
        }

        entry.rects.forEach((rect, index) => {
          // A rect must have one paint writer. Style owns value/index colors;
          // ordinal parent-rect interpolation must not overwrite those colors.
          if (events?.ownsPaint?.(rect)) return;
          const key = rectKey(rect, index);
          const before = entry.previousRectStates.get(key);
          const after = entry.currentRectStates.get(key);
          if (!before || !after) return;
          if (entry.visualCommit) {
            applyRectState(rect, elapsed < entry.visualCommit.time ? before : after);
            return;
          }
          if (before.fill === after.fill && before.opacity === after.opacity) return;
          const colors = paintTransitionColors(before, after);
          if (!colors) {
            applyRectState(rect, state.localEased < 1 ? before : after);
            return;
          }
          const [fromColor, toColor] = colors;
          const color = interpolateColor(fromColor, toColor, state.localEased);
          rect.setAttribute('fill', `rgb(${color.r},${color.g},${color.b})`);
          rect.setAttribute('fill-opacity', String(color.a));
        });
      });
      events?.applyStyles?.();
      // Some draw types expose automatic markers only as nested DOM visuals.
      // Compose their declaration and exit phases just like ordinary entries;
      // otherwise a newly declared marker is already visible behind the old
      // lifetime while that old marker is trying to leave.
      nestedLifecycleVisuals.forEach(({
        element, declarationSlot, exitSlot, lifecycleKind, baseTransform
      }) => {
        const appearanceStart = declarationSlot
          ? (Number(declarationSlot.start) || 0)
            + (Number(declarationSlot.declarationEntranceDelay) || 0)
          : 0;
        const appearProgress = declarationSlot
          ? clamp01(Math.max(0, elapsed - appearanceStart) / APPEAR_TIMING.duration)
          : 1;
        const appearOpacity = easeOutCubic(appearProgress);
        const exitProgress = exitSlot
          ? easeOutCubic(clamp01(
            Math.max(0, elapsed - Number(exitSlot.start || 0))
              / Math.max(1, Number(exitSlot.exitDuration) || APPEAR_TIMING.duration)
          ))
          : 0;
        element.setAttribute('opacity', String(
          composeLifecycleOpacity(appearOpacity, exitProgress)
        ));
        const enterOffsetY = declarationSlot
          ? visualLifecycleOffsetY(lifecycleKind, 'enter', appearOpacity)
          : 0;
        const exitOffsetY = visualLifecycleOffsetY(lifecycleKind, 'exit', exitProgress);
        const offsetY = enterOffsetY + exitOffsetY;
        const translate = Math.abs(offsetY) > 0.01 ? `translate(0, ${offsetY})` : '';
        const transform = [translate, baseTransform].filter(Boolean).join(' ');
        if (transform) element.setAttribute('transform', transform);
        else element.removeAttribute('transform');
      });
      events?.syncPositions?.();
      const arrowProgress = easeOutCubic(clamp01((elapsed - initialDelay) / duration));
      newArrows.forEach(({ element }) => {
        if (element._asmArrowTween) element._asmArrowTween.progress = arrowProgress;
        element.setAttribute('opacity', element._asmArrowTween ? '1' : String(arrowProgress));
      });
      // Endpoints use the SVG positions produced by this tick, not a second
      // independent tween which would lag behind the moving objects.
      window.ASMTraceRenderers?.refreshArrows?.();

      ghosts.forEach(({
        wrapper: ghost, scopeExitSlot, lifecycleKind, retainedByEnteringKeep, exitReflow
      }) => {
        if (retainedByEnteringKeep) {
          ghost.setAttribute('opacity', '1');
          ghost.removeAttribute('transform');
          return;
        }
        if (scopeExitSlot) {
          const ghostProgress = easeOutCubic(clamp01(
            Math.max(0, elapsed - Number(scopeExitSlot.start || 0))
              / Math.max(1, Number(scopeExitSlot.exitDuration) || APPEAR_TIMING.duration)
          ));
          ghost.setAttribute('opacity', String(1 - ghostProgress));
          const offsetY = visualLifecycleOffsetY(lifecycleKind, 'exit', ghostProgress);
          const holdOffsetX = Number(exitReflow?.ghostOffsetX) || 0;
          const arrivalStart = Number(exitReflow?.arrivalStart) || 0;
          const arrivalEnd = Number(exitReflow?.arrivalEnd) || arrivalStart;
          const arrivalProgress = elapsed < arrivalStart ? 0
            : arrivalEnd <= arrivalStart ? 1
            : easeOutCubic(clamp01((elapsed - arrivalStart) / (arrivalEnd - arrivalStart)));
          const offsetX = holdOffsetX * arrivalProgress * (1 - ghostProgress);
          if (Math.abs(offsetX) > 0.01 || Math.abs(offsetY) > 0.01) {
            ghost.setAttribute('transform', `translate(${offsetX}, ${offsetY})`);
          }
          else ghost.removeAttribute('transform');
          return;
        }
        const removalStart = removedVisualStartMs(
          lifecycleKind, initialDelay, keepSettlementDuration
        );
        const ghostProgress = easeOutCubic(clamp01(
          Math.max(0, elapsed - removalStart) / APPEAR_TIMING.duration
        ));
        ghost.setAttribute('opacity', String(1 - ghostProgress));
        const offsetY = visualLifecycleOffsetY(lifecycleKind, 'removed', ghostProgress);
        if (Math.abs(offsetY) > 0.01) ghost.setAttribute('transform', `translate(0, ${offsetY})`);
        else ghost.removeAttribute('transform');
      });

      if (elapsed < totalDuration) {
        requestAnimationFrame(tick);
        return;
      }

      events?.finish?.();
      events?.applyStyles?.();
      entries.forEach(entry => {
        delete entry.target.dataset.traceAppearing;
        applyIndexLabelGrowth(entry.indexLabelGeometry, 1);
        const markerAdjustment = entry.markerPointPath
          ? events?.adjustments?.get?.(entry.key)
          : null;
        const markerTarget = String(events?.markerTargets?.get?.(entry.key) || '');
        // Event motion may finish on a derived index such as j+1 just beyond
        // the last rendered cell. The marker target geometry can still be
        // extrapolated from its neighboring cells, so keep that final marker
        // visible instead of requiring a physical cell placement.
        const markerTargetVisible = markerTargetIsRenderable(markerTarget, currentPlacements);
        const commitMarker = markerAdjustment?.absolute === true && markerTargetVisible;
        if (entry.baseTransform) entry.target.setAttribute('transform', entry.baseTransform);
        else entry.target.removeAttribute('transform');
        if (commitMarker) {
          const committedX = entry.current.x + (Number(markerAdjustment.x) || 0);
          const committedY = entry.current.y + (Number(markerAdjustment.y) || 0);
          const currentTransform = String(entry.element.getAttribute('transform') || '');
          const translated = `translate(${committedX}, ${committedY})`;
          const translatePattern = /translate\(\s*-?[\d.]+(?:[\s,]+-?[\d.]+)?\s*\)/i;
          entry.element.setAttribute(
            'transform',
            translatePattern.test(currentTransform)
              ? currentTransform.replace(translatePattern, translated)
              : `${translated} ${currentTransform}`.trim()
          );
          entry.element.dataset.tracePositionX = String(committedX);
          entry.element.dataset.tracePositionY = String(committedY);
          entry.element.setAttribute('data-base-offset', `${committedX},${committedY}`);
          entry.element.dataset.traceBindingTarget = markerTarget;
          const placement = currentPlacements.get(entry.key);
          if (placement) {
            currentPlacements.set(entry.key, {
              ...placement,
              x: placement.x + (Number(markerAdjustment.x) || 0),
              y: placement.y + (Number(markerAdjustment.y) || 0)
            });
          }
        } else if (markerAdjustment?.absolute === true && markerTarget && !markerTargetVisible) {
          // No real or safely extrapolated target remains for this marker.
          entry.element.setAttribute('display', 'none');
        }
        if (entry.scopeExitSlot) entry.target.setAttribute('opacity', '0');
        else if (entry.baseOpacity != null) entry.target.setAttribute('opacity', entry.baseOpacity);
        else entry.target.removeAttribute('opacity');
        entry.attachedVisuals.forEach(attachment => unwrapAttachedVisual(attachment));
        entry.currentRectStates.forEach((state, key) => {
          const rect = entry.rects.find((item, index) => rectKey(item, index) === key);
          if (!rect) return;
          applyRectState(rect, state);
        });
        if (entry.currentSegmentGeometry) {
          applySegmentGeometry(entry.element, entry.currentSegmentGeometry);
        }
        if (entry.currentOuterframeGeometry) {
          applyOuterframeGeometry(entry.currentOuterframeGeometry,
            entry.currentOuterframeGeometry, 1);
        }
        if (entry.markerPointPath) {
          const committedArrowState = commitMarker
            ? events?.markerArrowStates?.get?.(entry.key)
            : null;
          entry.markerPointPath.setAttribute(
            'd',
            committedArrowState
              ? markerArrowPath(entry, committedArrowState)
              : entry.markerPointBasePath
          );
        }
      });
      nestedLifecycleVisuals.forEach(({ element, exitSlot, baseTransform }) => {
        if (exitSlot) {
          element.setAttribute('opacity', '0');
          element.setAttribute('display', 'none');
          return;
        }
        element.removeAttribute('opacity');
        if (baseTransform) element.setAttribute('transform', baseTransform);
        else element.removeAttribute('transform');
      });
      ghosts.forEach(({ wrapper }) => wrapper.remove());
      heapResizeStages.finish();
      window.ASMTraceRenderers?.refreshArrows?.();
      markerEntrancesByFrame.delete(frame.id);
      delete root.dataset.tracePlaybackPhase;
      // CSS paint transitions are presentation only, but are still part of
      // playback completion. Never wait on the infinite blink/bounce loops.
      root.getBoundingClientRect();
      const paintTransitions = (root.getAnimations?.({ subtree: true }) || [])
        .filter(animation => ['fill', 'stroke'].includes(animation.transitionProperty)
          && animation.playState !== 'finished');
      Promise.allSettled(paintTransitions.map(animation => animation.finished)).then(() => {
        if (runId !== activeRun) return;
        root.querySelectorAll('.asm-trace-style-paint').forEach(element => {
          element.classList.remove('asm-trace-style-paint');
        });
        finishRun();
      });
    }
    tick(previousTick);
    completion.playbackPlan = playbackPlan;
    return completion;
  }

  function cancel() {
    activeRun += 1;
    finishActiveRun?.();
    document.querySelectorAll('.asm-trace-style-paint').forEach(element => {
      element.classList.remove('asm-trace-style-paint');
    });
    document.querySelectorAll('[data-trace-index]').forEach(cell => {
      delete cell._asmStylePresentationCell;
    });
    document.querySelectorAll(
      '.asm-trace-compare-highlight, .asm-trace-compare-operator, '
      + '.asm-trace-compare-marker-popup, .asm-trace-assign-marker-popup, '
      + '.asm-trace-assign-falling-value, .asm-trace-assign-transfer, '
      + '.asm-trace-compare-self-clone, .asm-trace-transition-ghost-motion, '
      + '.asm-trace-transition-ghost, .asm-trace-heap-resize-ghost, '
      + '.asm-trace-sequence-ghost'
    ).forEach(element => element.remove());
    document.querySelectorAll('[data-trace-heap-resize-current]').forEach(wrapper => {
      const heap = wrapper.querySelector(':scope > [data-layout="heap"]');
      if (heap && wrapper.parentNode) wrapper.parentNode.insertBefore(heap, wrapper);
      wrapper.remove();
    });
    document.querySelectorAll('[data-trace-appearing]').forEach(element => {
      delete element.dataset.traceAppearing;
    });
    document.querySelectorAll('[data-trace-playback-plan-id]').forEach(element => {
      delete element.dataset.tracePlaybackPhase;
    });
  }

  if (typeof document !== 'undefined') {
  document.documentElement.dataset.asmTraceFrameTweenBuild = 'trace-210';
  }
  window.ASMTraceFrameTween = {
    build: 'trace-210', play, cancel, updateEventAvailability,
    createPlaybackPlan, recursiveMarkerTransitionSteps, swapContainerPlacementTransitionSteps,
    buildEventTimeline, enabledExitBarrierEnd, frameSceneBoundaryChanged,
    sameRuntimeVisual, needsSceneBoundaryEntrance,
    scopeExitVisualContinues,
    declarationVisualSchedule, recursiveRoleContinuations, exitMarkerReflowSchedule,
    isForInitializerAssignment,
    isDeclarationInitializerAssignment, markerTargetBeforeFrameEvents, markerTargetAtCheckpoint,
    markerLifetimeActiveAtEvent, detachedMarkerPopupPoint,
    visualLifecycleKind, visualLifecycleOffsetY, composeLifecycleOpacity, removedVisualStartMs,
    relativeMotionDelta, shouldAnimateObjectEntrance, createAnimationEffectLayer,
    createForwardReplayPlan, prepareForwardValues
  };
})();
