'use strict';
const { loadManifest, locateCase } = require('./event-contract-oracle');

// Control answers are declared in the manifest; this helper observes real SVG,
// navigation and IndexedDB. It never treats a planner's own output as an oracle.
async function runControlCase({ page, trace, item, allTraces = {} }) {
  const manifest = loadManifest();
  const fixtureId = item.id === 'C12' ? 'visibility' : item.eventSpec?.fixture || item.fixture;
  const marker = item.id === 'C11' ? 'E08' : item.id === 'C12' ? 'E13' : item.eventSpec?.marker || item.marker;
  const located = locateCase(manifest, { ...item, fixture: fixtureId, marker, expression: undefined });
  const selectedTrace = (allTraces instanceof Map ? allTraces.get(fixtureId) : allTraces[fixtureId]) || trace;
  if (!selectedTrace?.frames?.length || (item.id === 'C12' && fixtureId !== item.fixture && !allTraces[fixtureId] && !(allTraces instanceof Map && allTraces.has(fixtureId)))) {
    return { pass: false, observed: {}, failures: [{ path: 'fixture', expected: fixtureId, actual: 'missing' }] };
  }
  return page.evaluate(async ({ source, item, line, marker }) => {
    const observed = { marker }, failures = [];
    const equal = (path, actual, expected) => {
      observed[path] = actual;
      if (JSON.stringify(actual) !== JSON.stringify(expected)) failures.push({ path, expected, actual: actual ?? null });
    };
    const required = (path, value) => { if (!value) throw Error('Missing observation: ' + path); return value; };
    const clone = value => JSON.parse(JSON.stringify(value));
    const native = { raf: window.requestAnimationFrame, cancel: window.cancelAnimationFrame,
      now: Object.getOwnPropertyDescriptor(performance, 'now'), camera: window.ASMTraceCamera,
      rate: window.asmGetAnimationPlaybackRate, debug: window.ASMTraceDebugRecorder };
    let now = performance.now(), serial = 0, rate = 1;
    const callbacks = new Map();
    const step = async delta => {
      now += delta;
      const batch = [...callbacks.values()]; callbacks.clear();
      for (const callback of batch) callback(now);
      await Promise.resolve(); await Promise.resolve();
    };
    const advance = async (duration, increment = 25) => {
      for (let left = duration; left > 0;) { const amount = Math.min(increment, left); await step(amount); left -= amount; }
    };
    const temporary = () => document.querySelectorAll('.asm-trace-assign-transfer, .asm-trace-assign-falling-value, .asm-trace-read-highlight').length;
    const readHighlights = () => [...document.querySelectorAll('.asm-trace-read-highlight')];
    const transfers = () => [...document.querySelectorAll('.asm-trace-assign-transfer')];
    let current, targetId, targetFrame, owner, targetValueKey = null;
    const object = id => [...document.querySelectorAll('#asm-trace-root [data-trace-variable]')]
      .find(element => element.dataset.traceVariable === id && !element.closest('[data-trace-snapshot]'));
    const value = () => {
      const element = required('target DOM', object(targetId));
      // An animated value cell is promoted out of its object's wrapper into
      // the shared effect layer. Resolve the exact pre-observed cell identity,
      // never a similarly valued source text or a transfer clone.
      const promotedCell = targetValueKey && [...document.querySelectorAll('#asm-trace-root [data-trace-object-key]')]
        .find(node => node.dataset.traceObjectKey === targetValueKey
          && !node.closest('.asm-trace-assign-transfer, [data-trace-snapshot]'));
      const text = promotedCell?.querySelector('text:not([data-trace-content-role="index"])')
        || element.querySelector('.asm-trace-motion text:not(.outerframe-label)')
        || element.querySelector('text:not(.outerframe-label)');
      if (!text) observed.valueDom = { target: element.outerHTML.slice(0, 1000),
        candidates: [...document.querySelectorAll('#asm-trace-root text')].map(node => ({ text: node.textContent,
          parent: node.parentElement?.outerHTML.slice(0, 450) })).filter(node => node.text === '3' || node.text === '11') };
      return required('target value text', text).textContent;
    };
    const start = async () => {
      asmApplyTraceDocument(current);
      await CodeScript.goto(0);
      targetValueKey = object(targetId)?.querySelector('[data-trace-index="0"]')?.dataset.traceObjectKey || null;
      window.__eventContractControlCompletion = CodeScript.next();
      await step(0);
    };
    const finish = async () => {
      await advance(1500);
      await window.__eventContractControlCompletion;
    };
    const saveReopen = async document => {
      required('storage API', window.ASMSlideStorage?.create && window.ASMSlideTraceStore?.create);
      const database = 'asm-event-controls-' + item.id + '-' + Date.now();
      const key = 'deck-' + item.id;
      const client = ASMSlideStorage.create(indexedDB, localStorage, database);
      const deck = { groups: [{ id: 'group', slides: [{ id: 'slide', kind: 'algorithm-animation',
        animation: { mode: 'trace', code: document.sourceCode, input: '', traceDocument: document } }] }] };
      await client.saveDeck(key, JSON.stringify(deck));
      // A new client must read the persisted ID and fetch the actual Trace
      // from IndexedDB; no in-memory source or network fallback is supplied.
      const reopened = ASMSlideStorage.create(indexedDB, localStorage, database);
      const compact = await reopened.loadDeck(key, [], { lazyTraces: true });
      const animation = required('saved animation', compact?.groups?.[0]?.slides?.[0]?.animation);
      equal('savedReferenceIsId', /^[a-f0-9]{64}$/.test(animation.traceRef || ''), true);
      equal('savedTraceIsExternal', !animation.traceDocument, true);
      const restored = await ASMSlideTraceStore.create(ASMSlideStorage, reopened).materializeAnimation(animation);
      return required('reopened Trace', restored.traceDocument);
    };
    try {
      required('trace API', window.ASMTraceFrameTween?.pause && window.asmApplyTraceDocument);
      const full = clone(source);
      const index = full.frames.findIndex(frame => (frame.events || []).some(event =>
        ['assign', 'write'].includes(event.type) && Number(event.line ?? event.source?.line) === line));
      if (index < 1) throw Error('Missing operation frame for ' + marker + ' at line ' + line);
      owner = full.frames[index].events.find(event => ['assign', 'write'].includes(event.type)
        && Number(event.line ?? event.source?.line) === line);
      targetId = required('target variable', owner.targets?.find(target => target.role === 'target')?.variableId);
      current = { ...full, frames: [clone(full.frames[index - 1]), clone(full.frames[index])] };
      current.studio ||= {};
      current.studio.eventSettings = { ...(current.studio.eventSettings || {}), gapMs: 0,
        autoFixedEnabled: false, autoLoopBoundaryEnabled: false };
      targetFrame = current.frames[1];
      // Deterministic animation time, while DOM and IndexedDB remain real.
      // Camera itself has a separate timing test; isolate its precondition here.
      window.ASMTraceFrameTween.cancel();
      window.requestAnimationFrame = callback => { callbacks.set(++serial, callback); return serial; };
      window.cancelAnimationFrame = id => callbacks.delete(id);
      Object.defineProperty(performance, 'now', { configurable: true, value: () => now });
      window.asmGetAnimationPlaybackRate = () => rate;
      window.ASMTraceCamera = { ...native.camera, apply() {}, transitionDuration: () => 0 };
      window.ASMTraceDebugRecorder = { ...native.debug, isRecording: () => true };

      if (item.id === 'C01') {
        await start(); await advance(item.controlSpec.atMs);
        required('active transfer', transfers()[0]);
        required('active read highlight', readHighlights()[0]);
        ASMPlaybackNavigation.pause();
        const before = transfers().map(node => node.getAttribute('transform'));
        const beforeRead = readHighlights().map(node => node.dataset.traceReadSource);
        await advance(200);
        equal('paused', ASMTraceFrameTween.isPaused(), true);
        equal('pausedTransform', transfers().map(node => node.getAttribute('transform')), before);
        equal('pausedReadHighlight', readHighlights().map(node => node.dataset.traceReadSource), beforeRead);
        equal('beforeCommit', value(), String(item.eventSpec.before));
        ASMTraceFrameTween.resume();
        await advance(149);
        equal('stillBeforeCommit', value(), String(item.eventSpec.before));
        await step(1);
        equal('afterResumeCommit', value(), String(item.eventSpec.after));
        await finish(); equal('temporaryCopiesAfter', temporary(), 0);
      } else if (item.id === 'C02') {
        asmApplyTraceDocument(current); await CodeScript.goto(1); await CodeScript.prev();
        equal('frame', CodeScript.get_current_frame_index(), 0);
        equal('value', value(), String(item.eventSpec.before));
        equal('temporaryCopiesAfter', temporary(), 0);
        equal('activePlan', ASMTracePlayer.getActivePlaybackPlan(), null);
      } else if (item.id === 'C03') {
        await start(); await advance(100); await CodeScript.goto(1);
        equal('frame', CodeScript.get_current_frame_index(), 1);
        equal('value', value(), String(item.eventSpec.after));
        equal('temporaryCopiesAfter', temporary(), 0);
        equal('activePlan', ASMTracePlayer.getActivePlaybackPlan(), null);
      } else if (item.id === 'C04') {
        current.frames = full.frames.slice(index - 1, index + 3).map(clone);
        equal('fixtureFrameCount', current.frames.length, 4);
        asmApplyTraceDocument(current); await CodeScript.goto(0); ASMPlaybackNavigation.cancelForwardBurst();
        const pending = item.controlSpec.requests.map(() => ASMPlaybackNavigation.requestForwardStep(() => CodeScript.next()));
        await Promise.all(pending);
        equal('frame', CodeScript.get_current_frame_index(), item.controlSpec.finalFrame);
        equal('value', value(), '8');
        equal('temporaryCopiesAfter', temporary(), 0);
        equal('activePlan', ASMTracePlayer.getActivePlaybackPlan(), null);
      } else if (item.id === 'C05') {
        const next = required('next assignment frame', full.frames[index + 1]);
        current.frames[1] = { ...clone(next), id: targetFrame.id,
          events: [...clone(targetFrame.events), ...clone(next.events)] };
        await start(); await advance(150); rate = item.controlSpec.changeDuringEvent.to;
        await advance(149); equal('currentBefore300ms', value(), '3');
        await step(1); equal('currentAt300ms', value(), '11');
        await advance(149); equal('nextBefore150ms', value(), '11');
        await step(1); equal('nextAt150ms', value(), '14');
        await finish();
      } else if (item.id === 'C06') {
        await start(); await advance(150); required('active transfer', transfers()[0]);
        window.dispatchEvent(new Event('pagehide'));
        await Promise.resolve();
        equal('temporaryCopiesAfterLeave', temporary(), 0);
        equal('valueAfterLeave', value(), String(item.eventSpec.after));
        window.dispatchEvent(new Event('pageshow')); await advance(1000);
        equal('frameAfterReturn', CodeScript.get_current_frame_index(), 1);
        equal('temporaryCopiesAfterReturn', temporary(), 0);
        equal('valueAfterReturn', value(), String(item.eventSpec.after));
      } else if (['C07', 'C09'].includes(item.id)) {
        const event = targetFrame.events.find(event => event.id === owner.id);
        current.studio.eventInstructionStates ||= {};
        current.studio.eventInstructionStates[ASMTraceEvents.instructionKey(event)] = false;
        if (item.id === 'C09') {
          asmApplyTraceDocument(current); await CodeScript.goto(0);
          const key = required('style target key', object(targetId)?.dataset.traceObjectKey);
          current.studio.objectStyles ||= {};
          for (const frame of current.frames) current.studio.objectStyles[frame.id] = {
            ...(current.studio.objectStyles[frame.id] || {}), [key]: { fill: item.controlSpec.customFill } };
          current = await saveReopen(current);
        }
        await start(); await finish();
        equal('value', value(), String(item.eventSpec.after));
        equal('transferCount', transfers().length, 0);
        const saved = ASMTracePlayer.getDocument();
        const retained = saved.frames[1].events.find(event => event.id === owner.id);
        equal('eventRetained', Boolean(retained), true); equal('enabled', retained?.enabled, false);
        if (item.id === 'C09') {
          equal('gapMs', saved.studio.eventSettings.gapMs, 0);
          const fills = [...object(targetId).querySelectorAll('rect')].filter(node => node.getAttribute('fill') !== 'none')
            .map(node => node.getAttribute('fill'));
          equal('customFillInDom', fills.includes(item.controlSpec.customFill), true);
        }
      } else if (item.id === 'C08') {
        for (const frame of current.frames) for (const event of frame.events || []) {
          for (const field of item.controlSpec.removeFields) delete event[field];
        }
        asmApplyTraceDocument(current); await CodeScript.goto(0);
        equal('loadedOldValue', value(), String(item.eventSpec.before));
        // Save after actually loading and using the legacy representation.
        await CodeScript.goto(1); equal('usedOldValue', value(), String(item.eventSpec.after));
        current = await saveReopen(ASMTracePlayer.getDocument());
        await start(); await finish();
        equal('reopenedValue', value(), String(item.eventSpec.after));
      } else if (item.id === 'C10') {
        const sourceId = required('read source b', Object.keys(current.variables).find(id => current.variables[id].name === 'b'));
        current.rules = [...(current.rules || []), { id: 'authored-highlight', match: {}, actions: [{
          targetVariableId: sourceId, style: { styleTypes: { highlight: '#7b1fa2' } } }] }];
        asmApplyTraceDocument(current); await CodeScript.goto(0);
        const authored = () => [...document.querySelectorAll('#asm-trace-root [stroke="#7b1fa2"]')]
          .filter(node => !node.classList.contains('asm-trace-read-highlight'));
        required('authored highlight before event', authored()[0]);
        await start(); await advance(150);
        const automatic = readHighlights(); required('automatic highlight during read', automatic[0]);
        equal('automaticBlink', automatic.some(node => getComputedStyle(node).animationName !== 'none'), false);
        await finish(); equal('automaticHighlightEnds', readHighlights().length, 0);
        equal('authoredHighlightPreserved', authored().length > 0, true);
      } else if (item.id === 'C11') {
        await start(); await advance(150);
        equal('readHighlightCount', readHighlights().length, item.controlSpec.readHighlightCount);
        equal('transferCount', transfers().length, item.controlSpec.transferCount);
        equal('automaticBlink', readHighlights().some(node => getComputedStyle(node).animationName !== 'none'), false);
        await finish(); equal('value', value(), '6'); equal('temporaryCopiesAfter', temporary(), 0);
      } else if (item.id === 'C12') {
        await start(); await step(1);
        observed.owner = ASMTracePlayer.getDocument().frames[1].events.find(event => event.id === owner.id);
        const visibleId = Object.keys(current.variables).find(id => current.variables[id].name === item.controlSpec.visibleSource);
        const hiddenId = Object.keys(current.variables).find(id => current.variables[id].name === item.controlSpec.hiddenSource);
        equal('hiddenSourceHasNoObject', Boolean(object(hiddenId)), false);
        const target = required('target DOM', object(targetId)).getBoundingClientRect();
        const visible = required('visible source DOM', object(visibleId)).getBoundingClientRect();
        const moving = transfers(); equal('transferCount', moving.length, 2);
        const centers = moving.map(node => { const bounds = node.getBoundingClientRect(); return {
          x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2,
          source: node.dataset.traceTransferSourceKey || '', literal: node.classList.contains('asm-trace-assign-literal-value') }; });
        const visibleTransfer = required('visible source transfer', centers.find(node => node.source.includes(visibleId)));
        const hiddenTransfer = required('hidden numeric transfer', centers.find(node => node.literal));
        equal('visibleOriginAtSource', Math.abs(visibleTransfer.x - (visible.x + visible.width / 2)) < 1, true);
        equal('hiddenOriginAboveTarget', hiddenTransfer.y < target.y + target.height / 2, true);
        await advance(298); equal('beforeAllArrive', value(), String(item.eventSpec.before));
        await step(1); equal('afterAllArrive', value(), String(item.eventSpec.after));
        await finish();
      } else throw Error('Unsupported control case: ' + item.id);
    } catch (error) {
      failures.push({ path: 'execution', expected: 'observable control result', actual: error.message });
    } finally {
      window.ASMTraceFrameTween?.cancel?.();
      callbacks.clear(); window.requestAnimationFrame = native.raf; window.cancelAnimationFrame = native.cancel;
      if (native.now) Object.defineProperty(performance, 'now', native.now); else delete performance.now;
      window.ASMTraceCamera = native.camera; window.asmGetAnimationPlaybackRate = native.rate;
      window.ASMTraceDebugRecorder = native.debug;
      delete window.__eventContractControlCompletion;
    }
    return { pass: failures.length === 0, observed, failures };
  }, { source: selectedTrace, item, line: located.sourceLine, marker });
}

module.exports = { runControlCase };
