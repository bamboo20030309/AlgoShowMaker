'use strict';

const supported = new Set(['E02', 'E03', 'E04', 'E05', 'E06', 'E07', 'E08', 'E09', 'E17', 'E19']);

// The answer comes only from the handwritten case. The product timeline is
// never read to choose a sampling time or expected value. Geometry and values
// are observed from the actual SVG, including promoted effect-layer cells.
async function runClockProbe({ page, trace, item, observation }) {
  if (!supported.has(item.id)) return { applicable: false, pass: null, observed: {}, failures: [],
    reason: 'This probe covers scalar/cell copy, arithmetic, initialization and min/max assignment commit clocks.' };
  const commitMs = (item.timing?.assignmentCommitMs ?? item.timing?.commitMs ?? item.timing?.durationMs)
    + (item.timing?.codePromptMs || 0);
  if (!(commitMs > 0) || !Number.isInteger(observation?.frameIndex) || observation.frameIndex < 1) {
    return { applicable: true, pass: false, observed: {}, failures: [{ path: 'precondition',
      expected: 'handwritten positive commit time and a preceding frame', actual: { commitMs, frameIndex: observation?.frameIndex } }] };
  }
  const runs = [];
  for (const rate of [1, 2]) {
    runs.push(await page.evaluate(async ({ source, item, frameIndex, sourceLine, commitMs, rate }) => {
      const observed = { rate, commitAtWallMs: commitMs / rate }, failures = [];
      const own = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);
      const equal = (path, actual, expected) => {
        observed[path] = actual;
        if (JSON.stringify(actual) !== JSON.stringify(expected)) failures.push({ path, expected, actual: actual ?? null });
      };
      const required = (name, value) => { if (!value) throw Error('Missing observation: ' + name); return value; };
      const clone = value => JSON.parse(JSON.stringify(value));
      const native = { raf: window.requestAnimationFrame, cancel: window.cancelAnimationFrame,
        now: Object.getOwnPropertyDescriptor(performance, 'now'), camera: window.ASMTraceCamera,
        rate: window.asmGetAnimationPlaybackRate, debug: window.ASMTraceDebugRecorder };
      let time = performance.now(), serial = 0, activeTime = 0;
      const callbacks = new Map();
      const eventListener = event => {
        const slot = event.detail?.slot;
        (observed.eventSlots ||= []).push({ phase: event.detail?.phase,
          type: event.detail?.event?.type, id: event.detail?.event?.id, wallMs: activeTime,
          start: slot?.start, duration: slot?.duration, end: slot?.end });
      };
      const step = async delta => {
        time += delta; activeTime += delta;
        const batch = [...callbacks.values()]; callbacks.clear();
        for (const callback of batch) callback(time);
        await Promise.resolve(); await Promise.resolve();
      };
      const advanceTo = async target => {
        if (target < activeTime) throw Error('Clock cannot reverse');
        while (activeTime < target) await step(Math.min(10, target - activeTime));
      };
      const allObjects = () => [...document.querySelectorAll('#arraySvg [data-trace-object-key]')];
      const cell = key => allObjects().filter(node => node.dataset.traceObjectKey === key
        && !node.closest('.asm-trace-assign-transfer, [data-trace-snapshot]'))
        .find(node => node.querySelector('text[data-trace-content-role="value"], text:not([data-trace-content-role="index"]):not(.outerframe-label)'));
      const variableObject = id => [...document.querySelectorAll('#asm-trace-root [data-trace-variable]')]
        .find(node => node.dataset.traceVariable === id && !node.closest('[data-trace-snapshot]'));
      const descriptorCell = descriptor => {
        const object = variableObject(descriptor.variableId);
        if (!object) return null;
        const indices = descriptor.resolvedIndices || (Number.isInteger(descriptor.resolvedIndex) ? [descriptor.resolvedIndex] : null);
        const index = indices ? indices.join(',') : '0';
        const candidate = [...object.querySelectorAll('[data-trace-index]')].find(node => node.dataset.traceIndex === index);
        return candidate || (!descriptor.indexExpression ? object : null);
      };
      const readCell = key => {
        const found = cell(key);
        if (!found) observed.missingCell = { key, candidates: [...document.querySelectorAll('[data-trace-object-key]')]
          .filter(node => node.dataset.traceObjectKey === key).map(node => node.outerHTML.slice(0, 1800)) };
        const node = required('value cell ' + key, found);
        const text = node.querySelector('text[data-trace-content-role="value"]')
          || node.querySelector('text:not([data-trace-content-role="index"]):not(.outerframe-label)');
        required('text in ' + key, text);
        const rect = node.querySelector('rect:not(.asm-trace-compare-highlight):not(.highlight-blink)');
        return { key, text: text.textContent, fill: rect?.getAttribute('fill') ?? null,
          visible: getComputedStyle(node).visibility !== 'hidden' && node.getAttribute('opacity') !== '0' };
      };
      const snapshot = (targetKey, sourceKeys) => ({
        target: readCell(targetKey), sources: sourceKeys.map(readCell),
        transfers: [...document.querySelectorAll('.asm-trace-assign-transfer')].map(node => ({
          sourceKey: node.dataset.traceTransferSourceKey || '', valueOnly: node.classList.contains('asm-trace-assign-transfer-value'),
          texts: [...node.querySelectorAll('text')].map(text => text.textContent),
          rectCount: node.querySelectorAll('rect:not(.asm-trace-compare-highlight)').length,
          transform: node.getAttribute('transform') })),
        reads: [...document.querySelectorAll('.asm-trace-read-highlight')].map(node => ({
          source: node.dataset.traceReadSource, owner: node.dataset.traceReadOwner,
          animation: getComputedStyle(node).animationName }))
      });
      try {
        required('Trace playback API', window.ASMTraceFrameTween?.pause && window.asmApplyTraceDocument);
        const loaded = clone(source);
        const sourceFrame = required('target frame', loaded.frames[frameIndex]);
        const selected = (sourceFrame.events || []).filter(event => Number(event.line ?? event.source?.line) === sourceLine
          && (item.eventTypes || []).includes(event.type));
        const assignment = selected.find(event => ['assign', 'write'].includes(event.type));
        required('selected assignment', assignment);
        const target = required('assignment target', assignment.targets?.find(target => target.role === 'target'));
        const sources = (assignment.targets || []).filter(target => String(target.role || '').startsWith('source') && target.variableId);
        const targetFrame = { ...clone(sourceFrame), events: selected };
        loaded.frames = [clone(loaded.frames[frameIndex - 1]), targetFrame];
        loaded.studio ||= {}; loaded.studio.eventSettings = { ...(loaded.studio.eventSettings || {}),
          readHighlightEnabled: true, gapMs: 0, autoFixedEnabled: false, autoLoopBoundaryEnabled: false };
        window.ASMTraceCamera = { ...native.camera, apply() {}, transitionDuration: () => 0 };
        // Keep values above the product's 14px LOD threshold. This probe
        // measures event commits, not camera fitting or detail suppression.
        window.setCamera?.(600, 250, 2, false);

        // Find keys through the actual renderer before installing the clock.
        // An initializer target exists only in the destination frame.
        asmApplyTraceDocument(loaded); await CodeScript.goto(1);
        const targetKey = required('rendered target key', descriptorCell(target)?.dataset.traceObjectKey);
        await CodeScript.goto(0);
        window.ASMStructureLOD?.refresh?.();
        // Lazy glyph creation is a presentation task, not an event delay.
        // Let it finish before starting the measured animation clock.
        await new Promise(resolve => requestAnimationFrame(resolve));
        await new Promise(resolve => requestAnimationFrame(resolve));
        const sourceKeys = [...new Set(sources.map(source => descriptorCell(source)?.dataset.traceObjectKey).filter(Boolean))];
        const sourceBefore = sourceKeys.map(readCell);
        if (item.visual?.sourceRetained === true && sourceKeys.length === 0) throw Error('No visible source to check retention');
        if (item.visual?.targetStylePreserved === true) {
          loaded.studio.objectStyles ||= {};
          for (const frame of loaded.frames) loaded.studio.objectStyles[frame.id] = {
            ...(loaded.studio.objectStyles[frame.id] || {}), [targetKey]: { fill: '#123456' } };
        }
        ASMTraceFrameTween.cancel();
        window.requestAnimationFrame = callback => { callbacks.set(++serial, callback); return serial; };
        window.cancelAnimationFrame = id => callbacks.delete(id);
        Object.defineProperty(performance, 'now', { configurable: true, value: () => time });
        window.asmGetAnimationPlaybackRate = () => rate;
        window.ASMTraceCamera = { ...native.camera, apply() {}, transitionDuration: () => 0 };
        window.ASMTraceDebugRecorder = { ...native.debug, isRecording: () => true };
        window.addEventListener('asm:trace-active-event', eventListener);
        const doc = asmApplyTraceDocument(loaded);
        // Normalization may add unrelated automatic visual exits for objects
        // omitted by the next drawing directive. This is a single-operation
        // probe: keep exactly the authored case IDs after that normalization.
        const selectedIds = new Set(selected.map(event => event.id));
        doc.frames[1].events = doc.frames[1].events.filter(event => selectedIds.has(event.id));
        await CodeScript.goto(0);
        window.ASMStructureLOD?.refresh?.(); await step(0); await step(0);
        const before = item.id === 'E02' ? '' : String(item.expected.before);
        const baseline = item.id === 'E02' ? null : readCell(targetKey);
        if (baseline) equal('baselineValue', baseline.text, before);
        let completed = false;
        const animation = CodeScript.next();
        await step(0);
        ASMTraceFrameTween.waitForCompletion().then(() => { completed = true; });
        // 手寫答案的抵達前 250 ms 為飛入中點；包含宣告與 min/max 前置階段。
        const sampleAt = (commitMs - 250) / rate;
        await advanceTo(sampleAt);
        observed.during = snapshot(targetKey, sourceKeys);
        if (item.visual?.transfer === 'cell') {
          equal('wholeCellTransferObserved', observed.during.transfers.some(node => node.rectCount > 0 && !node.valueOnly), true);
        } else if (item.visual?.transfer === 'value') {
          equal('numberTransferObserved', observed.during.transfers.length > 0
            && observed.during.transfers.every(node => node.rectCount === 0 && node.valueOnly), true);
        }
        if (own(item.visual, 'parallelTransfers')) equal('parallelTransfers', observed.during.transfers.length, item.visual.parallelTransfers);
        if (own(item.visual, 'readHighlightCount')) equal('readHighlightCount', observed.during.reads.length, item.visual.readHighlightCount);
        equal('nonBlinkingReadHighlights', observed.during.reads.every(node => node.animation === 'none'), true);
        await advanceTo(commitMs / rate - 1);
        observed.beforeCommit = readCell(targetKey);
        equal('valueOneMsBeforeCommit', observed.beforeCommit.text, before);
        await advanceTo(commitMs / rate);
        observed.atCommit = readCell(targetKey);
        equal('valueAtCommit', observed.atCommit.text, String(item.expected.after));
        if (item.visual?.targetStylePreserved === true) equal('targetFillAtCommit', observed.atCommit.fill, '#123456');
        await advanceTo(commitMs / rate + 1500);
        await animation;
        observed.after = snapshot(targetKey, sourceKeys);
        equal('finalValue', observed.after.target.text, String(item.expected.after));
        if (item.visual?.targetStylePreserved === true) equal('targetFillAfter', observed.after.target.fill, '#123456');
        if (item.visual?.sourceRetained === true) equal('sourceValuesAndStyleAfter',
          observed.after.sources.map(({ key, text, fill }) => ({ key, text, fill })),
          sourceBefore.map(({ key, text, fill }) => ({ key, text, fill })));
        if (own(item.visual, 'temporaryCopiesAfter')) equal('temporaryCopiesAfter', document.querySelectorAll(
          '.asm-trace-assign-transfer,.asm-trace-assign-falling-value,.asm-trace-read-highlight,.asm-trace-selection-label').length,
        item.visual.temporaryCopiesAfter);
      } catch (error) {
        failures.push({ path: 'execution', expected: 'actual SVG observed at handwritten clock checkpoints', actual: error.message });
      } finally {
        window.removeEventListener('asm:trace-active-event', eventListener);
        window.ASMTraceFrameTween?.cancel?.(); callbacks.clear();
        window.requestAnimationFrame = native.raf; window.cancelAnimationFrame = native.cancel;
        if (native.now) Object.defineProperty(performance, 'now', native.now); else delete performance.now;
        window.ASMTraceCamera = native.camera; window.asmGetAnimationPlaybackRate = native.rate;
        window.ASMTraceDebugRecorder = native.debug;
      }
      return { pass: failures.length === 0, observed, failures };
    }, { source: trace, item, frameIndex: observation.frameIndex, sourceLine: observation.sourceLine, commitMs, rate }));
  }
  return { applicable: true, pass: runs.every(run => run.pass), observed: { runs: runs.map(run => run.observed) },
    failures: runs.flatMap(run => run.failures.map(failure => ({ rate: run.observed.rate, ...failure }))),
    covered: ['commit-before-and-at-fixed-time', 'two-playback-rates', 'requested-transfer-kind',
      'explicit-parallel-transfer-count', 'nonblinking-read', 'requested-source-retention', 'requested-target-style', 'requested-cleanup'],
    notCovered: ['all-expression-semantics', 'all-visual-flags', 'pointer-movement', 'layout', 'camera-motion'] };
}

module.exports = { runClockProbe };
