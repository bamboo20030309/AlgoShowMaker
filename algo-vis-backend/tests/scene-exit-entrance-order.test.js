const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

function loadTween() {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'public', 'trace-frame-tween.js'),
    'utf8'
  );
  const document = {
    documentElement: { dataset: {} },
    querySelectorAll() { return []; }
  };
  const context = {
    window: {}, document, console,
    requestAnimationFrame() {}, performance: { now() { return 0; } },
    CustomEvent: class CustomEvent {},
    queueMicrotask() {}
  };
  vm.runInNewContext(source, context);
  return context.window.ASMTraceFrameTween;
}

test('recursive roles match declarations, ancestry and visual domain, never names alone', () => {
  const tween = loadTween();
  const frame = (id, parent, fn = 'visit') => ({ source: {
    function: fn, recursionActivationId: id, recursionParentActivationId: parent
  }, events: [] });
  const parent = frame('parent', 'main');
  const child = frame('child', 'parent');
  const sibling = frame('sibling', 'parent');
  const visual = (variable, generation = '0', opacity = '1') => ({
    dataset: { traceVariable: variable, traceSceneGeneration: generation },
    getAttribute(name) { return name === 'opacity' ? opacity : null; },
    matches() { return false; }, closest() { return null; }
  });
  const variable = 'visit:i@40';
  const before = visual(variable);
  const after = visual(variable);
  const document = { variables: { [variable]: { name: 'i', functionName: 'visit' } },
    frames: [parent, child, sibling] };
  const previous = new Map([[variable, before]]);
  const current = new Map([[variable, after]]);
  const matches = (from, to, objects = previous, elements = current) =>
    tween.recursiveRoleContinuations(document, from, to, objects, elements);
  assert.equal(matches(parent, child).size, 1, 'descent preserves the role');
  assert.equal(matches(child, parent).size, 1, 'return restores the parent role');
  assert.equal(matches(child, sibling).size, 0, 'siblings do not share a lifetime');
  assert.equal(matches(frame('main', '', 'main'), child).size, 0, 'outer same name is distinct');
  assert.equal(matches(parent, child, new Map([[variable, visual('visit:i@80')]])).size, 0,
    'same function/name at another declaration is distinct');
  assert.equal(matches(parent, child, previous,
    new Map([[variable, visual(variable, '1')]])).size, 0, 'keep cuts the domain');
  assert.equal(matches(parent, child, new Map([[variable, visual(variable, '0', '0')]])).size, 0,
    'an absent visual must enter again');
});

test('scene entrance waits for every enabled exit slot', () => {
  const tween = loadTween();
  const timeline = [
    { animation: 'exit', start: 400, end: 620 },
    { animation: 'assign', start: 620, end: 900 },
    { animation: 'exit', start: 900, end: 1120 }
  ];

  assert.equal(tween.enabledExitBarrierEnd(timeline, 300), 1120);
});

test('scene entrance is unchanged when disabled exits produced no slots', () => {
  const tween = loadTween();
  assert.equal(tween.enabledExitBarrierEnd([
    { animation: 'assign', start: 300, end: 540 }
  ], 300), 300);
  assert.equal(tween.enabledExitBarrierEnd([], 450), 450);
});

test('function and recursive activation changes form a visual scene boundary', () => {
  const tween = loadTween();
  assert.equal(tween.frameSceneBoundaryChanged(
    { source: { function: 'heapify', recursionActivationId: 'activation-4' } },
    { source: { function: 'heap_sort', recursionActivationId: 'activation-1' } }
  ), true);
  assert.equal(tween.frameSceneBoundaryChanged(
    { source: { function: 'quick_sort', recursionActivationId: 'activation-7' } },
    { source: { function: 'quick_sort', recursionActivationId: 'activation-3' } }
  ), true, 'recursive callers are separate visual scenes even in the same function');
  assert.equal(tween.frameSceneBoundaryChanged(
    { source: { function: 'heap_sort', recursionActivationId: 'activation-1' } },
    { source: { function: 'heap_sort', recursionActivationId: 'activation-1' } }
  ), false);
});

test('scene boundaries preserve globals and reference parameters with continuous identity', () => {
  const tween = loadTween();
  const globalContainer = {
    dataset: {
      traceRuntimeIdentity: 'container-17',
      traceRuntimeLifetime: 'lifetime-global'
    }
  };
  const referenceParameter = {
    dataset: {
      traceRuntimeIdentity: 'container-17',
      traceRuntimeLifetime: 'lifetime-parameter'
    }
  };
  const scalarBefore = {
    dataset: { traceRuntimeLifetime: 'lifetime-global-scalar' }
  };
  const scalarAfter = {
    dataset: { traceRuntimeLifetime: 'lifetime-global-scalar' }
  };

  assert.equal(tween.sameRuntimeVisual(referenceParameter, globalContainer), true);
  assert.equal(tween.needsSceneBoundaryEntrance(
    true, referenceParameter, globalContainer
  ), false, 'a reference parameter must reuse the same container visual');
  assert.equal(tween.needsSceneBoundaryEntrance(
    true, scalarAfter, scalarBefore
  ), false, 'a global scalar keeps its lifetime across a function boundary');
});

test('a recursive reference parameter scope exit does not clone the continuing container', () => {
  const tween = loadTween();
  const visual = (dataset = {}) => ({
    dataset,
    isConnected: true,
    closest() { return null; },
    querySelectorAll() { return []; }
  });
  const previousArray = visual({
    traceVariable: 'quick_sort:arr@83',
    traceRuntimeIdentity: 'runtime-array-1',
    traceRuntimeLifetime: 'activation-2:arr'
  });
  const currentArray = visual({
    traceVariable: 'quick_sort:arr@83',
    traceRuntimeIdentity: 'runtime-array-1',
    traceRuntimeLifetime: 'activation-3:arr'
  });
  const previousLocal = visual({
    traceVariable: 'quick_sort:pivot@142',
    traceRuntimeLifetime: 'activation-2:pivot'
  });
  const currentLocal = visual({
    traceVariable: 'quick_sort:pivot@142',
    traceRuntimeLifetime: 'activation-3:pivot'
  });

  assert.equal(tween.scopeExitVisualContinues(
    previousArray, new Map([['current-array', currentArray]])
  ), true, 'the same underlying vector must remain one continuous visual');
  assert.equal(tween.scopeExitVisualContinues(
    previousArray, new Map([['current-array', currentArray]]),
    { type: 'scope-exit' }
  ), true, 'natural reference exits retain the underlying vector');
  assert.equal(tween.scopeExitVisualContinues(
    previousArray, new Map([['current-array', currentArray]]),
    { type: 'visual-exit', manualVisualExit: true }
  ), false, 'explicit exits cannot be suppressed by container continuity');
  const oldI = visual({ traceSourceVariableId: 'main:i', traceRuntimeIdentity: 'lifetime-i' });
  const newI = visual({ traceSourceVariableId: 'main:i', traceRuntimeIdentity: 'lifetime-i' });
  assert.equal(tween.scopeExitVisualContinues(
    oldI, new Map([['new-i', newI]]), { type: 'visual-exit', manualVisualExit: true }
  ), false, 'explicit exits must remove the old pointer even when for i remains alive');
  assert.equal(tween.scopeExitVisualContinues(
    previousLocal, new Map([['current-local', currentLocal]])
  ), false, 'a recursive local with a new lifetime must still leave and enter');
});

test('scene boundaries still introduce genuinely new local and recursive objects', () => {
  const tween = loadTween();
  assert.equal(tween.needsSceneBoundaryEntrance(true, {
    dataset: { traceRuntimeIdentity: 'container-recursion-2' }
  }, {
    dataset: { traceRuntimeIdentity: 'container-recursion-1' }
  }), true, 'a recursive local container has a distinct runtime identity');
  assert.equal(tween.needsSceneBoundaryEntrance(true, {
    dataset: { traceRuntimeLifetime: 'activation-2:local-i' }
  }, {
    dataset: { traceRuntimeLifetime: 'activation-1:local-i' }
  }), true, 'a recursive local scalar has a distinct lifetime');
  assert.equal(tween.needsSceneBoundaryEntrance(true, {
    dataset: { traceRuntimeLifetime: 'activation-2:new-local' }
  }, null), true, 'a newly declared local object still enters');
  assert.equal(tween.needsSceneBoundaryEntrance(false, {
    dataset: { traceRuntimeLifetime: 'activation-2:new-local' }
  }, null), false, 'ordinary declaration scheduling remains responsible within one scene');
});
