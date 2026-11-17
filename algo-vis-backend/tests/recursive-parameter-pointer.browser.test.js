'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { compile } = require('./helpers/compile');
const { startIsolatedServer } = require('./helpers/isolated-server');
const { readPackage, savedTrace } = require('./helpers/deck-package');

test('recursive pointer uses its bound parameter after a same-named helper parameter exits', { timeout: 120000 }, async t => {
  const { base } = await startIsolatedServer(t);
  const previous = process.env.ASM_TEST_BASE_URL;
  let trace;
  try {
    process.env.ASM_TEST_BASE_URL = base;
    ({ trace } = await compile(fs.readFileSync('tests/fixtures/segment-recursive-parameter-pointer.cpp', 'utf8'),
      '10 5\n1 2 3 4 5 6 7 8 9 10\n3 2 9\n1 2 8 3\n3 2 9\n2 4 7 5\n3 2 9'));
  } finally {
    if (previous === undefined) delete process.env.ASM_TEST_BASE_URL;
    else process.env.ASM_TEST_BASE_URL = previous;
  }
  const body = readPackage(fs.readFileSync('public/guest-decks/segment-tree-teaching.asmdeck')).body;
  const animation = body.deck.groups.flatMap(group => group.slides).find(slide =>
    slide.animation?.code.includes('render segment_tree') && slide.animation.code.includes('operation_pointer_view')).animation;
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  t.after(() => browser.close());
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/algorithm.html?asmEmbed=runtime');
  await page.waitForFunction(() => window.ASMTracePlayer);
  for (const [kind, document] of [['fresh', trace], ['saved', savedTrace(body, animation)]]) {
    // The input requires the recursive query parameter to change from 2 to 4.
    const declaration = document.frames[3].events.find(event => event.type === 'declare' && event.name === 'now'
      && event.targets?.some(target => target.variableId.startsWith('query:')));
    assert.equal(declaration?.payload.value.value, 4);
    assert.ok(document.frames[3].events.some(event => event.type === 'scope-exit' && event.name === 'now'
      && event.targets?.some(target => target.variableId.startsWith('push:'))));
    for (const speed of [1, 4]) {
      const report = await page.evaluate(async ({ document: trace, speed }) => {
        ASMTracePlayer.apply(JSON.parse(JSON.stringify(trace)));
        window.asmGetAnimationPlaybackRate = () => speed;
        await ASMTracePlayer.render(2, { stable: true });
        const read = () => {
          const root = document.getElementById('asm-trace-root'), inverse = root.getScreenCTM().inverse();
          const center = node => {
            const box = node.getBoundingClientRect();
            const point = new DOMPoint(box.x + box.width / 2, box.y + box.height / 2).matrixTransform(inverse);
            return { x: point.x, y: point.y };
          };
          const marker = [...root.querySelectorAll('[data-trace-source-variable-id]')].find(node =>
            node.querySelector('.trace-variable-marker-label-text')?.textContent === 'now');
          const label = marker.querySelector('.trace-variable-marker-label-box');
          const tree = root.querySelector('[data-trace-index="4"]').closest('[data-trace-variable]');
          const cell = index => center(tree.querySelector(`[data-trace-index="${index}"] rect`));
          let opacity = 1;
          for (let node = label; node?.nodeType === 1; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
          return { ...center(label), target: marker.dataset.traceBindingTarget, opacity, cells: { two: cell(2), four: cell(4) } };
        };
        const before = read(), native = { raf: requestAnimationFrame, cancel: cancelAnimationFrame,
          now: Object.getOwnPropertyDescriptor(performance, 'now') };
        let clock = performance.now(), elapsed = 0, serial = 0;
        const callbacks = new Map(), samples = [];
        window.requestAnimationFrame = callback => { callbacks.set(++serial, callback); return serial; };
        window.cancelAnimationFrame = id => callbacks.delete(id);
        Object.defineProperty(performance, 'now', { configurable: true, value: () => clock });
        const restore = () => {
          window.requestAnimationFrame = native.raf; window.cancelAnimationFrame = native.cancel;
          if (native.now) Object.defineProperty(performance, 'now', native.now); else delete performance.now;
        };
        try {
          const pending = ASMTracePlayer.render(3, { fromIndex: 2, forceTransition: true });
          const total = ASMTracePlayer.getLastPlaybackPlan().totalDurationMs;
          while (elapsed < total + 100) {
            elapsed += 16; clock += 16;
            const batch = [...callbacks.values()]; callbacks.clear(); batch.forEach(callback => callback(clock));
            for (let i = 0; i < 12; i++) await Promise.resolve();
            samples.push({ at: elapsed, ...read() });
          }
          restore(); await pending;
          const after = read();
          await ASMTracePlayer.render(2, { stable: true });
          const back = read();
          await ASMTracePlayer.render(3, { stable: true });
          return { before, samples, after, back, reopened: read() };
        } finally { restore(); ASMTraceFrameTween.cancel(); }
      }, { document, speed });
      fs.mkdirSync('test-results/recursive-parameter-pointer', { recursive: true });
      fs.writeFileSync(`test-results/recursive-parameter-pointer/${kind}-${speed}.json`, JSON.stringify(report));
      assert.ok(Math.abs(report.before.x - report.before.cells.two.x) < .01, 'frame 3 points at node 2');
      const { two, four } = report.before.cells;
      const bad = report.samples.find(sample => sample.opacity > .001 &&
        (sample.x < Math.min(two.x, four.x) - .01 || sample.x > Math.max(two.x, four.x) + .01));
      assert.ok(!bad, 'pointer must travel between nodes 2 and 4, never park at the left edge: ' + JSON.stringify(bad));
      assert.ok(report.samples.some(sample => sample.x > Math.min(two.x, four.x) + 1 && sample.x < Math.max(two.x, four.x) - 1),
        'recursive parameter change must actually move the pointer');
      for (const result of [report.after, report.reopened]) {
        assert.ok(result.target.endsWith('#4'));
        assert.ok(Math.abs(result.x - result.cells.four.x) < .01, 'recursive value 4 must land over node 4');
      }
      assert.ok(Math.abs(report.back.x - report.back.cells.two.x) < .01);
    }
  }
  assert.deepEqual(errors, []);
});
