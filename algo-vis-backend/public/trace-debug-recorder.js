(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ASMTraceDebugRecorder = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  const SCHEMA_VERSION = 'asm-animation-debug/v1';
  const SVG_PRIMITIVES = 'rect,circle,ellipse,line,polyline,polygon,path,text';
  const EFFECT_SELECTOR = [
    '.asm-trace-compare-highlight', '.asm-trace-compare-operator',
    '.asm-trace-compare-marker-popup', '.asm-trace-assign-marker-popup',
    '.asm-trace-assign-falling-value', '.asm-trace-assign-transfer',
    '.asm-trace-compare-self-clone', '.asm-trace-transition-ghost-motion',
    '.asm-trace-transition-ghost', '.asm-trace-heap-resize-ghost'
  ].join(',');
  const VISUAL_ATTRIBUTES = [
    'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height',
    'd', 'points', 'transform', 'fill', 'fill-opacity', 'stroke', 'stroke-opacity',
    'stroke-width', 'opacity', 'display', 'visibility', 'data-av-key', 'data-trace-index'
  ];
  let active = false;
  let options = null;
  let session = null;
  let lastReport = null;
  let frameHandle = null;
  let lastSampleAt = -Infinity;
  let lastPeriodicSignature = '';
  let sequence = 0;
  let context = { frameId: '', frameIndex: -1, direction: 0 };

  const now = () => Number(root?.performance?.now?.()) || Date.now();
  const round = (value, digits = 2) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    const scale = 10 ** digits;
    return Math.round(numeric * scale) / scale;
  };
  const plain = value => {
    if (value == null) return value;
    try { return JSON.parse(JSON.stringify(value)); } catch { return String(value); }
  };
  const elapsed = () => round(now() - Number(session?.clockStartedAt || now()), 2);
  const classText = element => typeof element?.className === 'object'
    ? String(element.className.baseVal || '')
    : String(element?.className || '');
  const textValue = value => String(value ?? '').replace(/\s+/g, ' ').trim();

  function surfaceName() {
    let embed = '';
    try { embed = new URLSearchParams(root?.location?.search || '').get('asmEmbed') || ''; } catch {}
    if (root?.document?.body?.classList?.contains?.('asm-trace-studio-open')) return 'studio';
    return embed === 'runtime' ? 'slides-runtime' : embed === 'editor' ? 'slides-editor' : 'algorithm';
  }

  function canvasElement() {
    return root?.document?.getElementById?.('arraySvg') || null;
  }

  function rectangle(element, canvasRect) {
    const rect = element?.getBoundingClientRect?.();
    if (!rect || !canvasRect) return null;
    const x = Number(rect.left) - Number(canvasRect.left);
    const y = Number(rect.top) - Number(canvasRect.top);
    const width = Number(rect.width);
    const height = Number(rect.height);
    if (![x, y, width, height].every(Number.isFinite)) return null;
    return {
      x: round(x), y: round(y), width: round(width), height: round(height),
      right: round(x + width), bottom: round(y + height),
      normalized: {
        x: round(x / Math.max(1, Number(canvasRect.width)), 5),
        y: round(y / Math.max(1, Number(canvasRect.height)), 5),
        width: round(width / Math.max(1, Number(canvasRect.width)), 5),
        height: round(height / Math.max(1, Number(canvasRect.height)), 5)
      }
    };
  }

  function relevantAttributes(element, names = VISUAL_ATTRIBUTES) {
    const result = {};
    names.forEach(name => {
      const value = element?.getAttribute?.(name);
      if (value != null && value !== '') result[name] = String(value);
    });
    return result;
  }

  function primitiveState(element, canvasRect) {
    return {
      tag: String(element?.tagName || '').toLowerCase(),
      className: classText(element),
      text: String(element?.tagName || '').toLowerCase() === 'text'
        ? textValue(element.textContent) : '',
      attributes: relevantAttributes(element),
      screen: rectangle(element, canvasRect)
    };
  }

  function effectState(element, index, canvasRect) {
    let computed = null;
    try { computed = root?.getComputedStyle?.(element) || null; } catch {}
    return {
      key: `$effect:${classText(element).split(/\s+/).filter(Boolean).join('.') || element.tagName}:${index}`,
      occurrence: index,
      tag: String(element?.tagName || '').toLowerCase(),
      className: classText(element),
      text: textValue(element?.textContent),
      screen: rectangle(element, canvasRect),
      attributes: relevantAttributes(element),
      computed: {
        display: String(computed?.display || ''),
        visibility: String(computed?.visibility || ''),
        opacity: String(computed?.opacity || '')
      }
    };
  }

  function objectState(element, index, canvasRect, includeDetails = true) {
    const parent = element?.parentElement?.closest?.('[data-trace-object-key]');
    let computed = null;
    try { computed = root?.getComputedStyle?.(element) || null; } catch {}
    const labelCandidate = element?.querySelector?.(':scope > .trace-variable-marker-motion > .trace-variable-marker-label-box')
      || element?.querySelector?.('.trace-variable-marker-label-box');
    const label = labelCandidate?.closest?.('[data-trace-object-key]') === element
      ? labelCandidate : null;
    const valueText = element?.querySelector?.('text[data-trace-value-text]')
      || (element?.dataset?.traceIndex != null ? element.querySelector?.('text') : null);
    // Opacity can be applied to an inner motion wrapper, not the selectable
    // outer group. Measure the actual painted label/cell and all its ancestors.
    let effectiveOpacity = 1;
    const paintNode = label || valueText || element?.querySelector?.(SVG_PRIMITIVES) || element;
    for (let ancestor = paintNode; ancestor; ancestor = ancestor.parentElement) {
      const style = root?.getComputedStyle?.(ancestor);
      if (style?.display === 'none' || style?.visibility === 'hidden') effectiveOpacity = 0;
      effectiveOpacity *= Number(style?.opacity || 1);
      if (ancestor === canvasElement()) break;
    }
    const state = {
      key: String(element?.dataset?.traceObjectKey || ''),
      occurrence: index,
      parentKey: String(parent?.dataset?.traceObjectKey || ''),
      className: classText(element),
      runtimeIdentity: String(element?.dataset?.traceRuntimeIdentity || ''),
      runtimeLifetime: String(element?.dataset?.traceRuntimeLifetime || ''),
      bindingTarget: String(element?.dataset?.traceBindingTarget || ''),
      text: textValue(element?.textContent),
      effectiveOpacity: round(effectiveOpacity, 5),
      retained: Boolean(element?.closest?.('[data-trace-snapshot]'))
        || element?.classList?.contains?.('asm-trace-keep-arrow') === true,
      retainedKey: element?.closest?.('[data-trace-snapshot]')
        ? `${element.closest('[data-trace-snapshot]').dataset.traceSnapshot}/${element.dataset.traceObjectKey}`
        : element?.classList?.contains?.('asm-trace-keep-arrow') ? String(element.dataset.traceObjectKey) : '',
      markerLabel: label ? rectangle(label, canvasRect) : null,
      displayValue: valueText && valueText.dataset?.traceContentRole !== 'index'
        ? textValue(valueText.textContent) : null,
      screen: rectangle(element, canvasRect),
      attributes: relevantAttributes(element, [
        'transform', 'opacity', 'display', 'visibility', 'data-base-offset',
        'data-trace-position-x', 'data-trace-position-y', 'data-trace-render-position',
        'data-trace-appearing', 'data-trace-scene-generation', 'data-alive', 'data-layout'
      ]),
      computed: {
        display: String(computed?.display || ''),
        visibility: String(computed?.visibility || ''),
        opacity: String(computed?.opacity || '')
      }
    };
    if (includeDetails && options?.includePrimitives) {
      state.primitives = Array.from(element?.querySelectorAll?.(SVG_PRIMITIVES) || [])
        .filter(item => item.closest?.('[data-trace-object-key]') === element)
        .slice(0, options.maxPrimitivesPerObject)
        .map(item => primitiveState(item, canvasRect));
    }
    return state;
  }

  function visibleCodeState() {
    const panel = root?.document?.querySelector?.('.asm-trace-code-panel');
    if (!panel || panel.hidden) return { visible: false, lines: [] };
    const lines = Array.from(panel.querySelectorAll?.('.asm-trace-code-page:not(.is-leaving) .asm-trace-code-line') || []);
    return {
      visible: true,
      fontSize: String(panel.dataset?.codePanelRenderedFontSize || ''),
      screen: rectangle(panel, canvasElement()?.getBoundingClientRect?.()),
      lines: lines.map(line => ({
        number: Number(line.dataset?.sourceLine) || 0,
        text: textValue(line.textContent),
        classes: classText(line),
        events: Array.from(line.querySelectorAll?.('[data-trace-event-ids]') || []).map(span => ({
          ids: String(span.dataset?.traceEventIds || '').split(/\s+/).filter(Boolean),
          text: textValue(span.textContent),
          classes: classText(span)
        }))
      }))
    };
  }

  function cameraState() {
    let viewport = null;
    try { viewport = root?.getCameraViewport?.() || null; } catch {}
    const transform = root?.getViewport?.()?.getAttribute?.('transform') || '';
    return viewport ? {
      centerX: round(viewport.centerX), centerY: round(viewport.centerY),
      width: round(viewport.width), height: round(viewport.height),
      scale: round(viewport.scale, 4), aspect: round(viewport.aspect, 5), transform: String(transform)
    } : { transform: String(transform) };
  }

  function ttsState() {
    const speech = root?.speechSynthesis;
    return speech ? {
      speaking: Boolean(speech.speaking),
      pending: Boolean(speech.pending),
      paused: Boolean(speech.paused)
    } : null;
  }

  function canvasState(includeDetails = true) {
    const canvas = canvasElement();
    const rect = canvas?.getBoundingClientRect?.();
    const rootElement = canvas?.querySelector?.('#asm-trace-root');
    const keyed = Array.from(rootElement?.querySelectorAll?.('[data-trace-object-key]') || []);
    const occurrences = new Map();
    return {
      size: rect ? { width: round(rect.width), height: round(rect.height) } : null,
      playbackPlanId: String(rootElement?.dataset?.tracePlaybackPlanId || ''),
      playbackPhase: String(rootElement?.dataset?.tracePlaybackPhase || ''),
      playbackElapsedMs: Number(rootElement?.dataset?.traceDebugElapsedMs) || 0,
      activeEventId: String(rootElement?.dataset?.traceActiveEventId || ''),
      activeEventType: String(rootElement?.dataset?.traceActiveEventType || ''),
      camera: cameraState(),
      tts: ttsState(),
      code: visibleCodeState(),
      effects: Array.from(rootElement?.querySelectorAll?.(EFFECT_SELECTOR) || [])
        .map((element, index) => effectState(element, index, rect)),
      objects: keyed.map(element => {
        const key = String(element.dataset?.traceObjectKey || '');
        const occurrence = occurrences.get(key) || 0;
        occurrences.set(key, occurrence + 1);
        return objectState(element, occurrence, rect, includeDetails);
      })
    };
  }

  function capture(reason = 'manual', detail = {}) {
    if (!active || !session) return null;
    // Continuous samples only need real motion geometry. Full primitive
    // styles are captured at semantic checkpoints so recording does not
    // materially change the animation timing it is measuring.
    const visual = canvasState(reason !== 'animation-sample');
    const sample = {
      sequence: ++sequence,
      timeMs: elapsed(),
      reason: String(reason),
      surface: surfaceName(),
      frameIndex: Number.isInteger(detail.frameIndex) ? detail.frameIndex : context.frameIndex,
      frameId: String(detail.frameId || context.frameId || ''),
      direction: Number.isFinite(Number(detail.direction)) ? Number(detail.direction) : context.direction,
      ...visual
    };
    const signature = JSON.stringify({
      frameId: sample.frameId,
      playbackPhase: sample.playbackPhase,
      activeEventId: sample.activeEventId,
      camera: sample.camera,
      code: (sample.code?.lines || []).map(line => [line.number, line.classes,
        (line.events || []).map(event => [event.ids, event.classes])]),
      objects: (sample.objects || []).map(object => [
        object.key, object.occurrence, object.screen, object.attributes, object.computed
      ])
    });
    if (reason === 'animation-sample' && signature === lastPeriodicSignature) return null;
    if (reason === 'animation-sample') lastPeriodicSignature = signature;
    session.samples.push(sample);
    if (session.samples.length > options.maxSamples) {
      session.truncated = true;
      stopSampling();
    }
    if (reason !== 'animation-sample' || session.samples.length % 5 === 0) updateUi();
    return sample;
  }

  function scheduleSample() {
    if (!active || frameHandle != null) return;
    const callback = timestamp => {
      frameHandle = null;
      if (!active) return;
      const current = Number(timestamp) || now();
      if (current - lastSampleAt >= options.sampleIntervalMs) {
        lastSampleAt = current;
        capture('animation-sample');
      }
      scheduleSample();
    };
    frameHandle = root?.requestAnimationFrame
      ? root.requestAnimationFrame(callback)
      : root?.setTimeout?.(() => callback(now()), options.sampleIntervalMs);
  }

  function stopSampling() {
    if (frameHandle == null) return;
    if (root?.cancelAnimationFrame) root.cancelAnimationFrame(frameHandle);
    else root?.clearTimeout?.(frameHandle);
    frameHandle = null;
  }

  function traceIdentity() {
    const trace = root?.ASMTracePlayer?.getDocument?.();
    return {
      schemaVersion: String(trace?.schemaVersion || ''),
      provenance: plain(trace?.provenance || null),
      frameCount: Array.isArray(trace?.frames) ? trace.frames.length : 0,
      sourceCode: String(trace?.sourceCode || ''),
      input: String(root?.document?.getElementById?.('inputArea')?.value || ''),
      builds: {
        renderer: String(root?.asmTraceRendererBuild || ''),
        frameTween: String(root?.asmTraceFrameTweenBuild || '')
      },
      document: options?.includeTraceDocument ? plain(trace || null) : null
    };
  }

  function start(requested = {}) {
    if (active) return report();
    const numericInterval = Number(requested.sampleIntervalMs);
    options = {
      sampleIntervalMs: Math.max(16, Number.isFinite(numericInterval) ? numericInterval : 50),
      includePrimitives: requested.includePrimitives !== false,
      maxPrimitivesPerObject: Math.max(1, Number(requested.maxPrimitivesPerObject) || 200),
      maxSamples: Math.max(100, Number(requested.maxSamples) || 20000),
      includeTraceDocument: requested.includeTraceDocument !== false,
      label: String(requested.label || '')
    };
    sequence = 0;
    context = {
      frameId: String(root?.ASMTracePlayer?.getDocument?.()?.frames?.[root?.ASMTracePlayer?.getCurrentFrame?.()]?.id || ''),
      frameIndex: Number(root?.ASMTracePlayer?.getCurrentFrame?.()) || 0,
      direction: 0
    };
    const clockStartedAt = now();
    session = {
      schemaVersion: SCHEMA_VERSION,
      clockStartedAt,
      recordedAt: new Date().toISOString(),
      label: options.label,
      surface: surfaceName(),
      url: String(root?.location?.href || ''),
      userAgent: String(root?.navigator?.userAgent || ''),
      options: plain(options),
      trace: traceIdentity(),
      plans: [],
      events: [],
      samples: [],
      truncated: false
    };
    active = true;
    lastReport = null;
    lastSampleAt = -Infinity;
    lastPeriodicSignature = '';
    capture('session-start');
    scheduleSample();
    updateUi();
    return report();
  }

  function stop() {
    if (!active || !session) return lastReport;
    capture('session-stop');
    active = false;
    stopSampling();
    session.durationMs = elapsed();
    delete session.clockStartedAt;
    lastReport = plain(session);
    session = null;
    updateUi();
    return report();
  }

  function report() {
    const source = active ? session : lastReport;
    if (!source) return null;
    const result = plain(source);
    result.rows = rows(result);
    return result;
  }

  function eventData(event) {
    return {
      id: String(event?.id || ''), type: String(event?.type || ''),
      order: Number.isFinite(Number(event?.order)) ? Number(event.order) : null,
      expression: String(event?.expression || event?.source?.expression || ''),
      enabled: event?.enabled !== false,
      availability: String(event?.autoAnimationUnavailableReason || ''),
      source: plain(event?.source || null),
      targets: plain(event?.targets || []),
      payload: plain(event?.payload || null)
    };
  }

  function slotData(slot) {
    if (!slot) return null;
    return {
      animation: String(slot.animation || ''), type: String(slot.type || ''),
      startMs: round(slot.promptStart ?? slot.start),
      codePromptDurationMs: round(slot.codePromptDuration),
      visualStartMs: round(slot.visualStart ?? slot.start),
      endMs: round(slot.end), durationMs: round(slot.duration),
      effectStartMs: round(slot.effectStart), motionStartMs: round(slot.motionStart)
    };
  }

  function onPlaybackPlan(event) {
    if (!active) return;
    const detail = event?.detail || {};
    session.plans.push({
      sequence: ++sequence,
      timeMs: elapsed(),
      frameId: String(detail.frame?.id || ''),
      frameIndex: detail.document?.frames?.indexOf?.(detail.frame) ?? -1,
      plan: plain(detail.plan || null)
    });
    capture('playback-plan', { frameId: detail.frame?.id || '' });
  }

  function onFrame(event) {
    if (!active) return;
    const detail = event?.detail || {};
    context = {
      frameId: String(detail.frame?.id || ''),
      frameIndex: Number.isInteger(detail.index) ? detail.index : -1,
      direction: Number(detail.direction) || 0
    };
    capture('frame', context);
  }

  function onActiveEvent(event) {
    if (!active) return;
    const detail = event?.detail || {};
    const item = eventData(detail.event);
    const phase = String(detail.phase || '');
    session.events.push({
      sequence: ++sequence,
      timeMs: elapsed(),
      phase,
      frameId: String(detail.frame?.id || context.frameId || ''),
      frameIndex: detail.document?.frames?.indexOf?.(detail.frame) ?? context.frameIndex,
      event: item,
      slot: slotData(detail.slot)
    });
    capture(`event-${phase}:${item.id || item.order || item.type}`);
  }

  function onRendered(event) {
    if (!active) return;
    const detail = event?.detail || {};
    capture('rendered', {
      frameId: detail.frame?.id || context.frameId,
      frameIndex: detail.document?.frames?.indexOf?.(detail.frame) ?? context.frameIndex
    });
  }

  function onComplete(event) {
    if (!active) return;
    const detail = event?.detail || {};
    capture('playback-complete', {
      frameId: detail.frame?.id || context.frameId,
      frameIndex: detail.document?.frames?.indexOf?.(detail.frame) ?? context.frameIndex
    });
  }

  function rows(source = report()) {
    if (!source) return [];
    return (source.samples || []).flatMap(sample => {
      const visuals = [
        ...(sample.objects || []).map(object => ({ visualKind: 'object', value: object })),
        ...(sample.effects || []).map(effect => ({ visualKind: 'effect', value: effect }))
      ];
      if (!visuals.length) visuals.push({ visualKind: '', value: null });
      const activeLines = (sample.code?.lines || []).filter(line => (
        line.events?.some(event => /(?:^|\s)is-active(?:\s|$)/.test(event.classes))
      )).map(line => line.number).join('|');
      return visuals.map(({ visualKind, value: object }) => ({
        sequence: sample.sequence,
        timeMs: sample.timeMs,
        reason: sample.reason,
        surface: sample.surface,
        frameIndex: sample.frameIndex,
        frameId: sample.frameId,
        playbackPhase: sample.playbackPhase,
        activeEventId: sample.activeEventId,
        activeEventType: sample.activeEventType,
        activeCodeLines: activeLines,
        visualKind,
        cameraCenterX: sample.camera?.centerX ?? '',
        cameraCenterY: sample.camera?.centerY ?? '',
        cameraScale: sample.camera?.scale ?? '',
        ttsSpeaking: sample.tts?.speaking ?? '',
        ttsPending: sample.tts?.pending ?? '',
        objectKey: object?.key || '',
        occurrence: object?.occurrence ?? '',
        runtimeIdentity: object?.runtimeIdentity || '',
        bindingTarget: object?.bindingTarget || '',
        x: object?.screen?.x ?? '', y: object?.screen?.y ?? '',
        width: object?.screen?.width ?? '', height: object?.screen?.height ?? '',
        opacity: object?.computed?.opacity ?? '', display: object?.computed?.display ?? '',
        text: object?.text || ''
      }));
    });
  }

  function csv(source = report()) {
    const data = rows(source);
    if (!data.length) return '';
    const columns = Object.keys(data[0]);
    const quote = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
    return [columns.map(quote).join(','), ...data.map(row => columns.map(key => quote(row[key])).join(','))].join('\r\n');
  }

  function downloadPayload(content, type, filename) {
    if (!root?.document || typeof Blob !== 'function' || !root.URL?.createObjectURL) return false;
    const anchor = root.document.createElement('a');
    const url = root.URL.createObjectURL(new Blob([content], { type }));
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    root.setTimeout?.(() => root.URL.revokeObjectURL(url), 0);
    return true;
  }

  function filename(extension) {
    const label = String((active ? session : lastReport)?.label || 'animation-debug')
      .replace(/[^\w\u4e00-\u9fff-]+/g, '-').replace(/^-+|-+$/g, '') || 'animation-debug';
    return `${label}-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`;
  }

  function downloadJSON(name = filename('json')) {
    const value = report();
    return value ? downloadPayload(JSON.stringify(value, null, 2), 'application/json', name) : false;
  }

  function downloadCSV(name = filename('csv')) {
    const value = report();
    return value ? downloadPayload(csv(value), 'text/csv;charset=utf-8', name) : false;
  }

  function comparablePlan(plan) {
    return {
      phases: (plan?.phases || []).map(phase => ({
        id: phase.id,
        mode: phase.mode,
        startMs: round(phase.startMs),
        durationMs: round(phase.durationMs),
        steps: (phase.steps || []).map(step => ({
          kind: step.kind, subtype: step.subtype, eventType: step.eventType,
          eventOrder: Number.isFinite(Number(step.eventOrder)) ? Number(step.eventOrder) : null,
          targetKey: step.targetKey || '', targetKeys: step.targetKeys || [],
          startMs: round(step.startMs), durationMs: round(step.durationMs), endMs: round(step.endMs)
        }))
      })),
      forwardReplay: {
        version: Number(plan?.forwardReplay?.version) || 0,
        direction: String(plan?.forwardReplay?.direction || ''),
        checkpoints: (plan?.forwardReplay?.checkpoints || []).map(checkpoint => ({
          eventId: checkpoint.eventId,
          eventType: checkpoint.eventType,
          eventOrder: checkpoint.eventOrder,
          mode: checkpoint.mode,
          startMs: round(checkpoint.startMs),
          commitMs: round(checkpoint.commitMs),
          mutations: plain(checkpoint.mutations || [])
        }))
      }
    };
  }

  function compare(expected, actual, requested = {}) {
    const positionTolerancePx = Math.max(0, Number(requested.positionTolerancePx) || 1.5);
    const timingToleranceMs = Math.max(0, Number(requested.timingToleranceMs) || 80);
    const differences = [];
    const expectedEvents = (expected?.events || []).map(item => ({
      phase: item.phase, frameId: item.frameId, type: item.event?.type,
      order: item.event?.order, expression: item.event?.expression
    }));
    const actualEvents = (actual?.events || []).map(item => ({
      phase: item.phase, frameId: item.frameId, type: item.event?.type,
      order: item.event?.order, expression: item.event?.expression
    }));
    if (JSON.stringify(expectedEvents) !== JSON.stringify(actualEvents)) {
      differences.push({ kind: 'event-sequence', expected: expectedEvents, actual: actualEvents });
    }
    const expectedPlans = (expected?.plans || []).map(item => comparablePlan(item.plan));
    const actualPlans = (actual?.plans || []).map(item => comparablePlan(item.plan));
    if (JSON.stringify(expectedPlans) !== JSON.stringify(actualPlans)) {
      differences.push({ kind: 'playback-plan', expected: expectedPlans, actual: actualPlans });
    }
    const checkpoints = source => (source?.samples || []).filter(sample => (
      sample.reason === 'session-start' || sample.reason === 'playback-complete'
      || sample.reason === 'session-stop' || sample.reason.startsWith('event-')
    ));
    const left = checkpoints(expected);
    const right = checkpoints(actual);
    if (left.length !== right.length) {
      differences.push({ kind: 'checkpoint-count', expected: left.length, actual: right.length });
    }
    left.slice(0, Math.min(left.length, right.length)).forEach((a, index) => {
      const b = right[index];
      if (a.reason !== b.reason || a.frameId !== b.frameId) {
        differences.push({ kind: 'checkpoint-identity', index, expected: [a.reason, a.frameId], actual: [b.reason, b.frameId] });
        return;
      }
      if (Math.abs(Number(a.timeMs) - Number(b.timeMs)) > timingToleranceMs) {
        differences.push({ kind: 'timing', index, checkpoint: a.reason, expected: a.timeMs, actual: b.timeMs });
      }
      const keyed = sample => new Map((sample.objects || []).map(object => [`${object.key}#${object.occurrence}`, object]));
      const aObjects = keyed(a), bObjects = keyed(b);
      const keys = new Set([...aObjects.keys(), ...bObjects.keys()]);
      keys.forEach(key => {
        const x = aObjects.get(key), y = bObjects.get(key);
        if (!x || !y) {
          differences.push({ kind: 'object-presence', index, checkpoint: a.reason, key, expected: Boolean(x), actual: Boolean(y) });
          return;
        }
        for (const field of ['x', 'y', 'width', 'height']) {
          const av = Number(x.screen?.[field]), bv = Number(y.screen?.[field]);
          if (Number.isFinite(av) && Number.isFinite(bv) && Math.abs(av - bv) > positionTolerancePx) {
            differences.push({ kind: 'geometry', index, checkpoint: a.reason, key, field, expected: av, actual: bv });
          }
        }
        if (x.computed?.display !== y.computed?.display || x.computed?.opacity !== y.computed?.opacity) {
          differences.push({ kind: 'visibility', index, checkpoint: a.reason, key,
            expected: x.computed, actual: y.computed });
        }
      });
      const codeShape = sample => (sample.code?.lines || []).map(line => ({
        number: line.number,
        events: (line.events || []).map(event => ({ ids: event.ids, classes: event.classes }))
      }));
      if (JSON.stringify(codeShape(a)) !== JSON.stringify(codeShape(b))) {
        differences.push({ kind: 'code-state', index, checkpoint: a.reason,
          expected: codeShape(a), actual: codeShape(b) });
      }
    });
    return { pass: differences.length === 0, differences };
  }

  function mark(label = 'manual') {
    return capture(`mark:${label}`);
  }

  async function afterPaint() {
    if (!root?.requestAnimationFrame) return;
    await new Promise(resolve => root.requestAnimationFrame(() => root.requestAnimationFrame(resolve)));
  }

  async function recordAllFrames(requested = {}) {
    if (!root?.CodeScript) throw new Error('目前沒有可播放的追蹤動畫。請先 RUN。');
    if (active) stop();
    start({ label: requested.label || 'all-frames', ...requested });
    try {
      await root.CodeScript.reset();
      await afterPaint();
      mark('frame-0-settled');
      let frameIndex = 0;
      while (root.CodeScript.has_next_key?.()) {
        mark(`frame-${frameIndex}-before`);
        await root.CodeScript.next();
        await afterPaint();
        mark(`frame-${++frameIndex}-settled`);
      }
      return stop();
    } catch (error) {
      stop();
      throw error;
    }
  }

  function updateUi() {
    const doc = root?.document;
    if (!doc) return;
    const startButton = doc.getElementById('animationDebugStart');
    const stopButton = doc.getElementById('animationDebugStop');
    const jsonButton = doc.getElementById('animationDebugJson');
    const csvButton = doc.getElementById('animationDebugCsv');
    const status = doc.getElementById('animationDebugStatus');
    if (startButton) startButton.disabled = active;
    if (stopButton) stopButton.disabled = !active;
    const hasReport = Boolean(lastReport || session);
    if (jsonButton) jsonButton.disabled = !hasReport;
    if (csvButton) csvButton.disabled = !hasReport;
    if (status) status.textContent = active
      ? `記錄中：${session?.samples?.length || 0} 個畫面樣本`
      : lastReport
        ? `已停止：${lastReport.samples?.length || 0} 個樣本、${lastReport.events?.length || 0} 個事件節點`
        : '尚未開始動畫記錄';
  }

  function bindUi() {
    const doc = root?.document;
    if (!doc) return;
    doc.getElementById('animationDebugStart')?.addEventListener('click', () => start());
    doc.getElementById('animationDebugStop')?.addEventListener('click', () => stop());
    doc.getElementById('animationDebugJson')?.addEventListener('click', () => downloadJSON());
    doc.getElementById('animationDebugCsv')?.addEventListener('click', () => downloadCSV());
    doc.getElementById('animationDebugAll')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      button.disabled = true;
      try { await recordAllFrames(); } catch (error) {
        const status = doc.getElementById('animationDebugStatus');
        if (status) status.textContent = String(error?.message || error);
      } finally { button.disabled = false; updateUi(); }
    });
    updateUi();
    let auto = false;
    try { auto = new URLSearchParams(root?.location?.search || '').get('asmDebugRecord') === '1'; } catch {}
    if (auto) start({ label: 'automatic-browser-regression' });
  }

  root?.addEventListener?.('asm:trace-playback-plan', onPlaybackPlan);
  root?.addEventListener?.('asm:trace-frame', onFrame);
  root?.addEventListener?.('asm:trace-active-event', onActiveEvent);
  root?.addEventListener?.('asm:trace-rendered', onRendered);
  root?.addEventListener?.('asm:trace-playback-plan-complete', onComplete);
  if (root?.document?.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', bindUi);
  else bindUi();

  return {
    SCHEMA_VERSION,
    start,
    stop,
    mark,
    report,
    rows,
    csv,
    compare,
    downloadJSON,
    downloadCSV,
    recordAllFrames,
    isRecording: () => active,
    clear() { if (active) stop(); lastReport = null; updateUi(); }
  };
});
