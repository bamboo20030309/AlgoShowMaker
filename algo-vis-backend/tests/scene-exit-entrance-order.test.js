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
