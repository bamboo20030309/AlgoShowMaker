/**
 * 測試模組：pointer-model.test
 *
 * 驗證 canonical pointer state、anchor lane、集中避讓與六種狀態差異。
 * 舊 renderer 的 fallback 另由 renderer 契約測試保護。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadModel() {
  const window = {};
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, '../public/trace-pointer-model.js'), 'utf8'),
    { window }
  );
  return window.ASMTracePointerModel;
}

function pointer(overrides = {}) {
  return {
    id: 'marker-i',
    sourceVariableId: 'i',
    sourceVisualContinuityKey: 'auto-marker:i:num:0',
    targetVariableId: 'num',
    targetObjectKey: 'var:num',
    targetPlacement: { x: 100, y: 50, width: 40, height: 40 },
    target: { variableId: 'num', indexExpression: '2', anchor: 'top' },
    pointerTarget: { variableId: 'num', indexExpression: '2', anchor: 'center' },
    labelWidth: 18,
    markerSortOrder: 0,
    ...overrides
  };
}

test('normalizes one-dimensional and matrix axes into stable pointer lanes', () => {
  const model = loadModel();
  const one = model.normalize(pointer(), { resolveTargetKey: () => 'var:num#2' });
  const row = model.normalize(pointer({
    shape: 'arrow-left',
    target: { variableId: 'grid', indexExpression: '1', axis: 'row', anchor: 'left' }
  }), { resolveTargetKey: () => 'var:grid:row-label:1' });
  const column = model.normalize(pointer({
    target: { variableId: 'grid', indexExpression: '2', axis: 'column', anchor: 'top' }
  }), { resolveTargetKey: () => 'var:grid:column-label:2' });
  assert.equal(one.lane, 'top');
  assert.equal(row.lane, 'left');
  assert.equal(column.lane, 'top');
  assert.equal(one.pointerId, 'auto-marker:i:num:0');
  assert.equal(one.pointerInstanceId, 'auto-marker:i:num:0');
});

test('separates a stable pointer role from each C++ lifetime instance', () => {
  const model = loadModel();
  const first = model.normalize(pointer({ sourceRuntimeIdentity: 'lifetime-12' }), {
    resolveTargetKey: () => 'var:num#0'
  });
  const second = model.normalize(pointer({ sourceRuntimeIdentity: 'lifetime-17' }), {
    resolveTargetKey: () => 'var:num#2'
  });
  assert.equal(first.pointerId, second.pointerId);
  assert.notEqual(first.pointerInstanceId, second.pointerInstanceId);
});

test('central layout assigns deterministic non-overlapping slots to a shared anchor', () => {
  const model = loadModel();
  const states = model.layout([
    pointer({ id: 'j', sourceVisualContinuityKey: 'j', markerSortOrder: 1 }),
    pointer({ id: 'i', sourceVisualContinuityKey: 'i', markerSortOrder: 0 })
  ], { resolveTargetKey: () => 'var:num#2' });
  assert.equal(states.map(state => state.pointerId).join(','), 'i,j');
  assert.equal(states.map(state => state.slot).join(','), '0,1');
  assert.equal(states[0].offsetX, -13);
  assert.equal(states[1].offsetX, 13);
  assert.equal(states[0].groupSize, 2);
});

test('unresolved relative pointers keep expression offsets in one layout pass', () => {
  const model = loadModel();
  const reference = { x: 100, y: 50, width: 40, height: 40 };
  const states = model.layout([
    pointer({
      id: 'i-minus-one', sourceVisualContinuityKey: 'i-1', unresolvedIndex: true,
      relativeMarkerBase: 'i', relativeMarkerOffset: -1, targetPlacement: reference
    }),
    pointer({
      id: 'i', sourceVisualContinuityKey: 'i', unresolvedIndex: true,
      relativeMarkerBase: 'i', relativeMarkerOffset: 0, targetPlacement: reference,
      markerSortOrder: 1
    })
  ]);
  assert.equal(states.every(state => state.status === 'unresolved'), true);
  assert.equal(states[1].offsetX - states[0].offsetX, 40);
  assert.equal(model.toRendererObject(states[0]).markerUnresolved, true);
  assert.equal('target' in model.toRendererObject(states[0]), false);
});

test('classifies the six pointer state differences without renderer-specific cases', () => {
  const model = loadModel();
  const base = model.layout([pointer()], { resolveTargetKey: () => 'var:num#2' })[0];
  assert.equal(model.diff(null, base), 'enter');
  assert.equal(model.diff(base, null), 'exit');
  assert.equal(model.diff(base, { ...base }), 'stay');
  assert.equal(model.diff(base, { ...base, targetKey: 'var:num#3' }), 'retarget');
  assert.equal(model.diff(base, { ...base, slot: 1 }), 'reflow');
  assert.equal(model.diff(base, {
    ...base,
    targetPlacement: { ...base.targetPlacement, x: base.targetPlacement.x + 20 }
  }), 'move');
});

test('builds one canonical transition plan for exact lifetimes and approved recursive roles', () => {
  const model = loadModel();
  const state = overrides => model.layout([pointer(overrides)], {
    resolveTargetKey: target => `var:num#${target.indexExpression}`
  })[0];
  const oldI = { key: 'old-i', state: state({ sourceRuntimeIdentity: 'life-i' }) };
  const oldRecursive = { key: 'old-rec', state: state({
    sourceVisualContinuityKey: 'recursive-role', sourceRuntimeIdentity: 'parent'
  }) };
  const currentI = { key: 'current-i', state: { ...oldI.state } };
  const currentRecursive = { key: 'current-rec', state: state({
    sourceVisualContinuityKey: 'recursive-role', sourceRuntimeIdentity: 'child',
    target: { variableId: 'num', indexExpression: '1', anchor: 'top' }
  }) };
  const entered = { key: 'entered', state: state({
    sourceVisualContinuityKey: 'entered-role', sourceRuntimeIdentity: 'new'
  }) };
  const plan = model.transitionPlan(
    [oldI, oldRecursive], [currentI, currentRecursive, entered], {
      roleContinuation(entry) {
        return entry.key === 'current-rec' ? oldRecursive : null;
      }
    }
  );
  assert.deepEqual(Array.from(plan.map(item => item.type)), ['stay', 'retarget', 'enter']);
  assert.equal(plan[1].previous, oldRecursive);
});

test('keeps unresolved matrix axes in separate parking groups', () => {
  const model = loadModel();
  const reference = { x: 100, y: 50, width: 40, height: 40 };
  const states = model.layout([
    pointer({ unresolvedIndex: true, targetObjectKey: 'var:grid', targetPlacement: reference,
      shape: 'arrow-left', target: { axis: 'row', anchor: 'left' } }),
    pointer({ unresolvedIndex: true, targetObjectKey: 'var:grid', targetPlacement: reference,
      sourceVisualContinuityKey: 'column', target: { axis: 'column', anchor: 'top' } })
  ]);
  assert.notEqual(states[0].targetKey, states[1].targetKey);
  assert.deepEqual(Array.from(states.map(item => item.lane)), ['left', 'top']);
  assert.ok(states[0].markerPlacement.x < reference.x);
  assert.ok(states[1].markerPlacement.y < reference.y);
});

test('canonical-only validation does not expose a silent legacy switch', () => {
  const model = loadModel();
  assert.equal(model.enabled(), true);
  assert.equal(model.canonicalOnly(), true);
  assert.equal(model.useLegacy, undefined);
});
