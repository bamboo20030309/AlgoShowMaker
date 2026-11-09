'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');
const { startIsolatedServer } = require('./helpers/isolated-server');
const { compile } = require('./helpers/compile');

test('initializer visibility controls joined entry; pointer assignment moves continuously', { timeout: 120000 }, async t => {
  const { base } = await startIsolatedServer(t);
  const previousBase = process.env.ASM_TEST_BASE_URL;
  let trace;
  try {
    process.env.ASM_TEST_BASE_URL = base;
    trace = (await compile(fs.readFileSync(path.join(__dirname, 'fixtures/initializer-visibility.cpp'), 'utf8'))).trace;
  } finally {
    if (previousBase === undefined) delete process.env.ASM_TEST_BASE_URL; else process.env.ASM_TEST_BASE_URL = previousBase;
  }
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  t.after(() => browser.close());
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/algorithm.html?asmEmbed=runtime');
  await page.waitForFunction(() => window.ASMTracePlayer);
  for (const mode of ['fresh', 'saved']) {
    const result = await page.evaluate(async ({ trace, mode }) => {
      if (mode === 'saved') {
        // Persist and reopen without adding any new mandatory metadata.
        localStorage.setItem('asm-initializer-test', JSON.stringify(trace));
        trace = JSON.parse(localStorage.getItem('asm-initializer-test'));
        localStorage.removeItem('asm-initializer-test');
        trace.frames.forEach(frame => frame.events.forEach(event => { delete event.semantics; delete event.declarationInitializer; }));
      }
      const doc = ASMTracePlayer.apply(trace);
      doc.studio ||= {}; doc.studio.eventSettings ||= {}; doc.studio.eventSettings.gapMs = 100;
      window.asmGetAnimationPlaybackRate = () => mode === 'saved' ? 2 : 1;
      window.ASMTraceCamera = { ...ASMTraceCamera, apply() {}, transitionDuration: () => 0 };
      const byName = name => Object.keys(doc.variables).find(id => doc.variables[id].name === name);
      const read = name => {
        const id = byName(name);
        const marker = [...document.querySelectorAll('#asm-trace-root [data-trace-source-variable-id]')]
          .find(node => node.dataset.traceSourceVariableId === id && node.dataset.traceBindingTarget);
        if (marker) {
          const label = marker.querySelector('.trace-variable-marker-label-box') || marker;
          const box = label.getBoundingClientRect(), root = document.getElementById('asm-trace-root');
          const point = new DOMPoint(box.x + box.width / 2, box.y + box.height / 2).matrixTransform(root.getScreenCTM().inverse());
          return { x: point.x, y: point.y, transform: marker.getAttribute('transform'), target: marker.dataset.traceBindingTarget,
            arrow: marker.querySelector('path')?.getAttribute('d') };
        }
        const object = [...document.querySelectorAll('#asm-trace-root [data-trace-variable]')]
          .find(node => node.dataset.traceVariable === id);
        const values = [...(object?.querySelectorAll('text[data-trace-content-role="value"]') || [])];
        let opacity = values.length ? 1 : 0;
        for (let node = values[0]; node?.nodeType === 1; node = node.parentElement) {
          const style = getComputedStyle(node);
          if (style.visibility === 'hidden' || style.display === 'none') { opacity = 0; break; }
          opacity *= Number(style.opacity);
        }
        return { values: values.map(node => node.textContent), visible: opacity > .001 };
      };
      const runs = [];
      for (const step of [1, 2, 3, 'cancel']) {
        const index = step === 'cancel' ? 2 : step;
        await ASMTracePlayer.render(index - 1, { stable: true });
        const native = { raf: requestAnimationFrame, cancel: cancelAnimationFrame, now: Object.getOwnPropertyDescriptor(performance, 'now') };
        let clock = performance.now(), elapsed = 0, serial = 0;
        const callbacks = new Map(), slots = [], samples = [];
        window.requestAnimationFrame = callback => { callbacks.set(++serial, callback); return serial; };
        window.cancelAnimationFrame = id => callbacks.delete(id);
        Object.defineProperty(performance, 'now', { configurable: true, value: () => clock });
        const listener = e => {
          if (e.detail.phase !== 'start') return;
          const slot = e.detail.slot;
          slots.push({ name: e.detail.event.name, expression: e.detail.event.expression,
            duration: slot.duration, transfer: slot.declarationInitializerTransfer,
            direct: slot.declarationInitializerDirect, member: slot.initializerEvent?.expression,
            start: slot.start, end: slot.end, motionStart: slot.motionStart, at: elapsed,
            text: [...document.querySelectorAll('#traceCodePanel .is-active')].map(node => node.textContent).join('').replace(/\s+/g, '') });
        };
        window.addEventListener('asm:trace-active-event', listener);
        const restore = () => {
          window.requestAnimationFrame = native.raf; window.cancelAnimationFrame = native.cancel;
          if (native.now) Object.defineProperty(performance, 'now', native.now); else delete performance.now;
        };
        try {
          const pending = ASMTracePlayer.render(index, { fromIndex: index - 1, forceTransition: true });
          const total = ASMTracePlayer.getLastPlaybackPlan().totalDurationMs;
          let interrupted = null;
          while (elapsed < total + 100) {
            elapsed += 20; clock += 20;
            const batch = [...callbacks.values()]; callbacks.clear(); batch.forEach(callback => callback(clock));
            for (let n = 0; n < 10; n++) await Promise.resolve();
            const active = slots.at(-1);
            if (active) samples.push({ at: elapsed, active: active.name || active.expression,
              i: read('i'), k: read('k'), literal: read('literal'), copied: read('copied'),
              repeated: read('repeated'), values: read('values'), grid: read('grid'), computed: read('computed'), cloned: read('cloned'),
              copies: [...document.querySelectorAll('.asm-trace-assign-transfer')].map(node => ({
                source: node.dataset.traceTransferSourceKey, cell: Boolean(node.querySelector('rect')),
                transform: node.getAttribute('transform')
              })), formula: document.querySelectorAll('.asm-trace-calculation-popup').length,
              comparisons: document.querySelectorAll('.asm-trace-compare-operator').length });
            if (step === 'cancel' && active && elapsed >= active.at
              + (active.motionStart - active.start + 260) / (mode === 'saved' ? 2 : 1)) {
              interrupted = read('i');
              ASMTraceFrameTween.cancel();
              break;
            }
          }
          document.querySelectorAll('#asm-trace-root *').forEach(node => node.getAnimations?.().forEach(a => { if (a.transitionProperty) a.finish(); }));
          restore(); await pending;
          if (step === 'cancel') await ASMTracePlayer.render(1, { stable: true });
          runs.push({ index, interrupted, slots, samples, final: { i: read('i'), k: read('k'), copied: read('copied'), repeated: read('repeated') },
            remainingTransfers: document.querySelectorAll('.asm-trace-assign-transfer').length });
        } finally { restore(); window.removeEventListener('asm:trace-active-event', listener); ASMTraceFrameTween.cancel(); }
      }
      // A stable jump and a serialized reload must agree with animated final state.
      const saved = JSON.parse(JSON.stringify(ASMTracePlayer.getDocument()));
      ASMTracePlayer.apply(saved); await ASMTracePlayer.render(3, { stable: true });
      return { runs, reopened: { i: read('i'), k: read('k'), copied: read('copied') } };
    }, { trace, mode });
    fs.mkdirSync(path.join(__dirname, '../test-results/initializer-visibility'), { recursive: true });
    fs.writeFileSync(path.join(__dirname, `../test-results/initializer-visibility/${mode}.json`), JSON.stringify(result));
    const slots = result.runs[0].slots;
    for (const name of ['literal', 'hidden', 'repeated', 'values', 'grid', 'i', 'newSource']) {
      const slot = slots.find(slot => slot.name === name);
      assert.ok(slot?.direct, `${mode}: ${name} enters with its initialized value`);
      assert.equal(slot.duration, 220, `${mode}: ${name} has one entry slot`);
    }
    const pointerInit = slots.find(slot => slot.name === 'k');
    assert.ok(pointerInit?.direct && !pointerInit.transfer, `${mode}: pointer initializes directly at its target`);
    assert.equal(pointerInit.duration, 300, `${mode}: shared-cell initialization keeps the existing 80ms make-room delay and 220ms entrance`);
    for (const name of ['copied', 'computed', 'cloned', 'fromNew']) {
      const slot = slots.find(slot => slot.name === name);
      assert.ok(slot?.transfer, `${mode}: ${name} receives a visible source`);
      assert.equal(slot.duration, 1480);
    }
    assert.equal(slots.filter(slot => slot.expression && /^(literal|hidden|copied|computed|repeated|values|cloned|i|k)\s*=/.test(slot.expression)).length, 0,
      'paired assignments are not replayed as extra events');
    assert.ok(result.runs[0].samples.some(sample => sample.active === 'copied' && sample.copies.some(copy => copy.cell)), 'copy initialization moves the source cell');
    const entry = result.runs[0];
    // Active code includes the 200ms prompt before entrance. Check initialized
    // contents when the actual SVG first becomes visible, not while hidden.
    assert.deepEqual(entry.samples.find(sample => sample.active === 'literal' && sample.literal.visible).literal.values, ['9']);
    assert.deepEqual(entry.samples.find(sample => sample.active === 'repeated' && sample.repeated.visible).repeated.values, ['0', '0', '0', '0', '0']);
    assert.deepEqual(entry.samples.find(sample => sample.active === 'values' && sample.values.visible).values.values, ['1', '2', '3']);
    assert.deepEqual(entry.samples.find(sample => sample.active === 'grid' && sample.grid.visible).grid.values, ['0', '0', '0', '0', '0', '0']);
    assert.ok(entry.samples.filter(sample => sample.active === 'repeated').every(sample => sample.copies.length === 0));
    assert.ok(!entry.samples.find(sample => sample.active === 'copied').copied.values.includes('8'), 'visible-source target begins empty');
    assert.ok(entry.samples.some(sample => sample.active === 'cloned' && sample.copies.length === 5), 'all five array cells copy in one initialization');
    assert.ok(entry.slots.some(slot => slot.name === 'later' && !slot.member));
    assert.ok(entry.slots.some(slot => slot.expression === 'later=b'), 'a later assignment must not be merged into a bare declaration');
    assert.ok(entry.samples.some(sample => sample.active === 'fromNew'
      && sample.copies.some(copy => copy.source.includes('newSource') && copy.cell)),
    'a source that entered earlier in the same frame is available for copying');
    assert.ok(entry.slots.some(slot => slot.name === 'selected' && slot.transfer && slot.duration === 3040));
    assert.ok(entry.samples.some(sample => sample.active === 'selected' && sample.comparisons > 0),
      'joining initialization preserves min/max comparison before transferring its selected result');
    const kPositions = new Set(entry.samples.filter(sample => sample.active === 'k').map(sample => sample.k.x.toFixed(2)));
    assert.ok(kPositions.size <= 2, 'pointer enters at its target instead of travelling from an unbound slot');
    assert.ok(entry.samples.filter(sample => sample.active === 'k')
      .every(sample => Math.abs(sample.k.x - entry.final.k.x) < 0.5),
      'pointer initialization stays at its final target throughout entry');
    assert.ok(result.runs[0].samples.every(sample => sample.formula === 0), 'no additional floating formula panel');
    const movement = result.runs[1];
    assert.equal(movement.slots.find(slot => slot.expression === 'i=4').duration, 2280);
    const transforms = new Set(movement.samples.map(sample => sample.i.x.toFixed(2)));
    assert.ok(transforms.size > 5, `${mode}: pointer has intermediate positions, not a jump`);
    assert.ok(new Set(movement.samples.map(sample => sample.i.arrow)).size > 5, 'arrow follows the moving pointer');
    assert.equal(result.reopened.i.transform, movement.final.i.transform);
    const same = result.runs[2];
    assert.ok(same.slots.some(slot => slot.expression === 'i=4' && slot.duration > 0), 'equal-value assignment still plays');
    const cancelled = result.runs[3];
    assert.ok(cancelled.interrupted.x > entry.final.i.x && cancelled.interrupted.x < movement.final.i.x,
      'cancel halfway through actual pointer travel');
    assert.ok(Math.abs(cancelled.final.i.x - entry.final.i.x) < 0.1, 'jumping back restores the original pointer position');
    assert.equal(cancelled.remainingTransfers, 0, 'cancellation and stable navigation clean up temporary copies');
  }
  assert.deepEqual(errors, []);
});
