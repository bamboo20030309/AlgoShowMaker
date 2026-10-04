const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { compile } = require('./helpers/compile');

test('recursive merge pointers address the retained direct children, survive reload, and hide past the end', { timeout: 120000 }, async () => {
  const code = fs.readFileSync('algorithm_sample/Sorting/merge_sort_recursive_layout.cpp', 'utf8');
  const { trace, window: model } = await compile(code, '10\n38 27 43 3 9 82 10 19 84 60\n');
  const reopened = model.ASMTraceModel.normalizeTraceDocument(JSON.parse(JSON.stringify(trace)));
  assert.equal(reopened.frames.flatMap(f => f.bindings).filter(b => b.explicitPointer).length,
    trace.frames.flatMap(f => f.bindings).filter(b => b.explicitPointer).length);
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.ASM_TEST_BASE_URL + '/algorithm.html');
    const result = await page.evaluate(async trace => {
      window.ASMTracePlayer.apply(trace);
      let checked = 0, hidden = 0;
      let transitions = 0;
      for (let index = 0; index < trace.frames.length; index++) {
        const frame = trace.frames[index];
        if (!frame.bindings.some(b => b.explicitPointer)) continue;
        if (transitions < 3 && index > 0 && trace.frames[index-1].source?.recursionActivationId === frame.source?.recursionActivationId) {
          window.asmGetAnimationPlaybackRate = () => 16;
          await window.ASMTracePlayer.render(index-1, { stable: true });
          await window.ASMTracePlayer.render(index, { fromIndex: index-1, forceTransition: true });
          transitions++;
        }
        await window.ASMTracePlayer.render(index, { stable: true });
        const root = document.querySelector('#asm-trace-root');
        if (!root.lastElementChild?.classList.contains('asm-trace-pointer-layer'))
          throw new Error(`frame ${index+1}: pointers are below the foreground arrows`);
        for (const binding of frame.bindings.filter(b => b.explicitPointer)) {
          const child = trace.snapshots.filter(s => frame.snapshotIds.includes(s.id)
            && s.layoutId === binding.layoutChild.layoutId
            && s.recursionParentActivationId === frame.source.recursionActivationId
            && Number(s.layoutNode?.siblingIndex || 0) === Number(binding.layoutChild.childExpression)).at(-1);
          const local = Number(window.ASMTraceRules.resolveExpression(trace, frame, binding.indexExpression));
          const count = child.frame.state[child.frame.source.primaryVariableId].data.items.length;
          const start = binding.implicitIndex ? Number(window.ASMTraceRules.resolveExpression(trace, child.frame, 'L')) : 0;
          const end = binding.implicitIndex ? Number(window.ASMTraceRules.resolveExpression(trace, child.frame, 'R')) : count-1;
          const marker = [...root.querySelectorAll('[data-trace-source-variable-id]')]
            .find(el => el.dataset.traceSourceVariableId === binding.sourceVariableId && !el.closest('.asm-trace-snapshot'));
          if (local < start || local > end) {
            if (marker) throw new Error(`frame ${index+1}: exhausted ${binding.label} is still visible`);
            hidden++;
            continue;
          }
          if (!marker) throw new Error(`frame ${index+1}: missing ${binding.label} at ${local}`);
          const targetKey = marker.dataset.tracePointerTargetKey;
          const target = [...root.querySelectorAll('[data-trace-object-key]')].find(el => el.dataset.traceObjectKey === targetKey);
          if (target?.closest('[data-trace-snapshot]')?.dataset.traceSnapshot !== child.id)
            throw new Error(`frame ${index+1}: ${binding.label} targets wrong child (${targetKey})`);
          if (!targetKey.endsWith(`#${local}`)) throw new Error(`wrong local index ${targetKey}`);
          if (!marker.textContent.includes(binding.label)) throw new Error('wrong marker text');
          checked++;
        }
      }
      // Old stored traces lack the new optional binding metadata. Load,
      // render, save and reopen them through the same public model/player.
      const legacy = JSON.parse(JSON.stringify(trace));
      legacy.frames.forEach(frame => { frame.bindings = frame.bindings.filter(b => !b.explicitPointer); });
      legacy.snapshots.forEach(snapshot => { if (snapshot.frame) snapshot.frame.bindings = (snapshot.frame.bindings || []).filter(b => !b.explicitPointer); });
      window.ASMTracePlayer.apply(legacy);
      await window.ASMTracePlayer.render(8, { stable: true });
      const oldReopened = window.ASMTraceModel.normalizeTraceDocument(JSON.parse(JSON.stringify(legacy)));
      window.ASMTracePlayer.apply(oldReopened);
      await window.ASMTracePlayer.render(8, { stable: true });
      return { checked, hidden, transitions, build: document.documentElement.dataset.asmTraceRendererBuild };
    }, reopened);
    assert.ok(result.checked > 20, JSON.stringify(result));
    assert.ok(result.hidden > 0, JSON.stringify(result));
    assert.equal(result.transitions, 3);
    assert.equal(result.build, 'trace-260');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('legacy and independent array pointers render together', { timeout: 60000 }, async () => {
  const { trace } = await compile(`#include <vector>
int main(){ std::vector<int> a={1,2,3}; int i=0,j=2;
// @frame a[i]
// @pointer j at a
// @frame a[i]
// @pointer j at a[j]
return 0; }`);
  // Simulate a stored explicit binding from before implicitIndex existed.
  trace.frames[1].bindings.forEach(binding => { delete binding.implicitIndex; });
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  try {
    const page = await browser.newPage();
    await page.goto(process.env.ASM_TEST_BASE_URL + '/algorithm.html');
    const targets = await page.evaluate(async trace => {
      window.ASMTracePlayer.apply(trace);
      const targets = [];
      for (const index of [0, 1]) {
        await window.ASMTracePlayer.render(index, { stable: true });
        targets.push(...[...document.querySelectorAll('#asm-trace-root [data-trace-source-variable-id]')]
          .map(el => ({ frame: index, label: el.textContent, key: el.dataset.tracePointerTargetKey })));
      }
      return targets;
    }, trace);
    for (const index of [0, 1]) {
      assert.ok(targets.some(target => target.frame === index && target.label.includes('i') && target.key.endsWith('#0')), JSON.stringify(targets));
      assert.ok(targets.some(target => target.frame === index && target.label.includes('j') && target.key.endsWith('#2')), JSON.stringify(targets));
    }
  } finally { await browser.close(); }
});
