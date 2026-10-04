const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { compile } = require('./helpers/compile');

test('recursive as slots continue across merged to num slices by displayed cell order', { timeout: 120000 }, async () => {
  const code = fs.readFileSync('algorithm_sample/Sorting/merge_sort_recursive_layout.cpp', 'utf8');
  const { trace } = await compile(code, '10\n38 27 43 3 9 82 10 19 84 60\n');
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  try {
    const page = await browser.newPage();
    await page.goto(process.env.ASM_TEST_BASE_URL + '/algorithm.html');
    const result = await page.evaluate(async trace => {
      const pairs = trace.frames.flatMap((frame, index) => {
        const previous = trace.frames[index - 1];
        return previous && trace.variables[previous.source.primaryVariableId]?.name === 'merged'
          && trace.variables[frame.source.primaryVariableId]?.name === 'num'
          && previous.source.recursionActivationId === frame.source.recursionActivationId ? [index] : [];
      });
      const violations = [], slots = [], sampled = [];
      window.ASMTracePlayer.apply(JSON.parse(JSON.stringify(trace)));
      window.asmGetAnimationPlaybackRate = () => 8;
      for (const index of pairs) {
        await window.ASMTracePlayer.render(index - 1, { stable: true });
        const source = trace.frames[index].source;
        const alias = source.objectIds?.[source.primaryVariableId] || source.objectId;
        const getOwner = () => [...document.querySelectorAll('#asm-trace-root .asm-trace-object')]
          .find(node => node.dataset.traceObjectKey === alias && !node.closest('[data-trace-snapshot]'));
        const before = getOwner();
        const beforeKeys = [...before.querySelectorAll('[data-trace-authored-continuity]')].map(n => n.dataset.traceAuthoredContinuity);
        slots.push(before.dataset.traceAuthoredContinuity);
        let done = false, samples = 0;
        const pending = window.ASMTracePlayer.render(index, { fromIndex: index - 1, forceTransition: true }).finally(() => { done = true; });
        while (!done) {
          await new Promise(requestAnimationFrame);
          const owner = getOwner();
          if (owner && Number(getComputedStyle(owner).opacity) < 0.99) violations.push({ index, reason: 'outerframe faded' });
          if (owner?.querySelector('.asm-trace-motion') && Number(getComputedStyle(owner.querySelector('.asm-trace-motion')).opacity) < 0.99) violations.push({ index, reason: 'motion faded' });
          for (const cell of owner?.querySelectorAll('[data-trace-index]') || []) {
            if (Number(getComputedStyle(cell).opacity) < 0.99) violations.push({ index, reason: 'cell faded' });
          }
          for (const ghost of document.querySelectorAll('#asm-trace-root .asm-trace-transition-ghost')) {
            if (ghost.dataset.traceAuthoredContinuity === before.dataset.traceAuthoredContinuity
              && !violations.some(v => v.index === index && v.reason === 'exit ghost')) {
              violations.push({ index, reason: 'exit ghost', text: ghost.textContent, slot: ghost.dataset.traceAuthoredContinuity,
                ghostOwner: ghost.dataset.traceSnapshotOwner, current: owner?.dataset.traceAuthoredContinuity,
                currentOwner: owner?.dataset.traceSnapshotOwner });
            }
          }
          samples++;
        }
        await pending;
        const after = getOwner();
        const afterKeys = [...after.querySelectorAll('[data-trace-authored-continuity]')].map(n => n.dataset.traceAuthoredContinuity);
        if (JSON.stringify(beforeKeys) !== JSON.stringify(afterKeys)) violations.push({ index, reason: 'ordinal mismatch', beforeKeys, afterKeys });
        sampled.push(samples);
      }
      return { pairs, violations, slots, sampled };
    }, trace);
    assert.equal(result.pairs.length, 9);
    assert.deepEqual(result.violations, []);
    assert.equal(new Set(result.slots).size, 9, 'recursive activations must not share a visual slot');
    assert.ok(result.sampled.every(n => n > 0));
  } finally { await browser.close(); }
});
