const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Exercise the renderer's binding adapter without adding a public test API.
const source = fs.readFileSync(path.join(__dirname, '../public/trace-renderer.js'), 'utf8')
  .replace('window.ASMTraceRenderers = {',
    'window.ASMTraceRenderers = { renderFrameBindings, keepArrowObjectKey, ensureLinearIndexPlacement,')
  .replace('if (objects.length) renderStudioObjects(root, document, frame, placements, elements, options, objects);',
    'root.objects = objects;');
const context = vm.createContext({
  window: {},
  document: { documentElement: { dataset: {} } },
  queueMicrotask() {}
});
vm.runInContext(source, context);

test('keep arrows retain identity across recursive reference variable IDs', () => {
  const key = context.window.ASMTraceRenderers.keepArrowObjectKey;
  assert.equal(
    key('init', 'container-arr', 'heapify:arr@parent'),
    key('init', 'container-arr', 'heapify:arr@child')
  );
  assert.notEqual(
    key('init', 'container-arr', 'heapify:arr@parent'),
    key('init', 'different-arr', 'heapify:arr@child')
  );
  assert.notEqual(
    key('init', '', 'heapify:arr@parent'),
    key('init', '', 'heapify:arr@child')
  );
});

function bindings({ cells, values = { i: null }, count = 5, virtual = [], objectId = '' }) {
  context.window.ASMTraceRules = { resolveExpression: (doc, frame, expr) => values[expr] };
  const key = objectId || 'arr';
  const placements = new Map(cells.map(([index, x, y, width = 40]) =>
    [`${key}#${index}`, { x, y, width, height: 40 }]));
  const elements = new Map([...placements.keys()].map(id => [id, { closest: () => null }]));
  for (const [index, x, y] of virtual) placements.set(`${key}#${index}`, { x, y, width: 40, height: 40 });
  const before = [...placements.keys()];
  const frame = {
    source: objectId ? { objectId, primaryVariableId: 'arr' } : {},
    state: { arr: { identity: 'runtime-arr', data: { kind: 'sequence', items: Array(count).fill(1) } } },
    bindings: Object.keys(values).map(name => ({ mode: 'index', sourceVariableId: name,
      sourceName: name, targetVariableId: 'arr', indexExpression: name }))
  };
  const root = {};
  context.window.ASMTraceRenderers.renderFrameBindings(root, { variables: {} }, frame, placements, elements);
  return { objects: root.objects || [], placements, before };
}

function checkUnknown(result, left, top, names) {
  assert.equal(result.objects.length, names.length);
  const boxes = result.objects.map(object => {
    assert.equal(object.markerUnresolved, true);
    assert.equal(object.target, undefined);
    assert.equal(object.pointerTarget, undefined);
    const p = object.markerPlacement;
    assert.equal(p.y - 40, top - 40, 'same label height as reference cell');
    return { name: object.text, center: p.x + p.width / 2 + object.offsetX };
  }).sort((a, b) => a.center - b.center);
  assert.deepEqual(Array.from(boxes, box => box.name), names);
  assert.equal(boxes.at(-1).center + 9, left - 8);
  for (let i = 1; i < boxes.length; i++) assert.equal(boxes[i].center - boxes[i - 1].center, 26);
  assert.deepEqual([...result.placements.keys()], result.before, 'no fake cell placements');
}

test('unknown marker stays left of horizontal array at the same height', () => {
  checkUnknown(bindings({ cells: [[0, 100, 80], [1, 140, 80]] }), 100, 80, ['i']);
});

test('unresolved derived markers preserve constant array-cell offsets', () => {
  context.window.ASMTraceRules = { resolveExpression: () => null };
  const placements = new Map([
    ['arr#0', { x: 100, y: 80, width: 40, height: 40 }],
    ['arr#1', { x: 140, y: 80, width: 40, height: 40 }]
  ]);
  const elements = new Map([...placements.keys()].map(id => [id, { closest: () => null }]));
  const frame = {
    state: {
      arr: { identity: 'runtime-arr', data: { kind: 'sequence', items: [1, 2, 3] } }
    },
    bindings: ['j', 'j+1', 'j+2'].map(expression => ({
      mode: 'index', sourceVariableId: 'j', sourceVariableIds: ['j'], sourceName: 'j',
      targetVariableId: 'arr', indexExpression: expression
    }))
  };
  const root = {};
  context.window.ASMTraceRenderers.renderFrameBindings(
    root, { variables: {} }, frame, placements, elements
  );
  const centers = Object.fromEntries(root.objects.map(object => [
    object.text,
    object.markerPlacement.x + object.markerPlacement.width / 2 + object.offsetX
  ]));
  assert.equal(centers['j+1'] - centers.j, 40);
  assert.equal(centers['j+2'] - centers['j+1'], 40);
  assert.equal(centers['j+2'] + 9, 92,
    'the rightmost unresolved label remains eight pixels left of the first visible cell');
  root.objects.forEach(object => {
    assert.equal(object.markerUnresolved, true);
    assert.equal(object.target, undefined);
    assert.equal(object.pointerTarget, undefined);
    assert.equal(object.pointerTargetOffsetX, object.offsetX,
      'each derived marker keeps a vertical temporary arrow over its own logical slot');
  });
  assert.deepEqual([...placements.keys()], ['arr#0', 'arr#1'],
    'relative parking must not create fake array cells');
});
test('heap uses visual left edge, not the smallest index', () => {
  checkUnknown(bindings({ cells: [[1, 160, 40], [2, 80, 120], [3, 240, 120], [4, 20, 200]],
    values: { j: undefined, i: null } }), 20, 200, ['j', 'i']);
});
test('stack uses the uppermost cell when left edges tie', () => {
  checkUnknown(bindings({ cells: [[0, 100, 200], [1, 100, 140], [2, 100, 80]] }), 100, 80, ['i']);
});
test('single visible wide cell, nonzero range and object alias', () => {
  checkUnknown(bindings({ cells: [[3, -50, 35, 120]], values: { j: NaN, i: null }, objectId: 'named-array' }),
    -50, 35, ['j', 'i']);
});
test('decorations and virtual out-of-range cells are not reference cells', () => {
  checkUnknown(bindings({ cells: [[2, 100, 80]], virtual: [[-1, -100, 20], [6, -200, 10]] }), 100, 80, ['i']);
  assert.equal(bindings({ cells: [], virtual: [[-1, 0, 0]] }).objects.length, 0);
  assert.equal(bindings({ cells: [], count: 0 }).objects.length, 0);
});
test('known zero, out-of-range and hidden indices retain their existing behavior', () => {
  const zero = bindings({ cells: [[0, 100, 80], [1, 140, 80]], values: { i: 0 } });
  assert.equal(zero.objects[0].target.indexExpression, '0');
  assert.equal(zero.objects[0].markerUnresolved, undefined);
  const outside = bindings({ cells: [[0, 100, 80], [1, 140, 80]], values: { i: -1 } });
  assert.equal(outside.placements.get('arr#-1').x, 60);
  assert.equal(outside.objects[0].target.indexExpression, '-1');
  assert.equal(bindings({ cells: [[2, 100, 80]], values: { i: 1 } }).objects.length, 0);
});
test('unknown and known markers stay in separate groups and retain IDs when resolving', () => {
  const cells = [[0, 100, 80], [1, 140, 80]];
  const before = bindings({ cells, values: { i: null, j: 0 } });
  const after = bindings({ cells, values: { i: 1, j: 0 } });
  assert.equal(before.objects.find(o => o.text === 'i').id, after.objects.find(o => o.text === 'i').id);
  assert.equal(before.objects.find(o => o.text === 'j').offsetX, 0);
  assert.equal(after.objects.find(o => o.text === 'i').target.indexExpression, '1');
  assert.equal(
    before.objects.find(o => o.text === 'i').sourceVisualContinuityKey,
    after.objects.find(o => o.text === 'i').sourceVisualContinuityKey
  );
});

test('recursive automatic markers keep visual continuity without merging runtime identities', () => {
  const tweenSource = fs.readFileSync(path.join(__dirname, '../public/trace-frame-tween.js'), 'utf8')
    .replace('window.ASMTraceFrameTween = {', 'window.ASMTraceFrameTween = { markerActivationChanged,');
  vm.runInContext(tweenSource, context);
  const marker = (runtimeIdentity, continuityKey) => ({
    dataset: {
      traceSourceVariableId: 'heapify:i',
      traceRuntimeIdentity: runtimeIdentity,
      traceVisualContinuityKey: continuityKey
    }
  });
  const parent = marker('activation-parent', 'auto-marker:heapify:i:heapify:arr:0');
  const child = marker('activation-child', 'auto-marker:heapify:i:heapify:arr:0');
  assert.equal(context.window.ASMTraceFrameTween.markerActivationChanged(child, parent), false);
  assert.notEqual(child.dataset.traceRuntimeIdentity, parent.dataset.traceRuntimeIdentity);
  assert.equal(context.window.ASMTraceFrameTween.markerActivationChanged(
    marker('activation-child', 'auto-marker:other:i:arr:0'), parent
  ), true);
});

test('a reference parameter renames one continuing marker without re-entering', () => {
  const tweenSource = fs.readFileSync(path.join(__dirname, '../public/trace-frame-tween.js'), 'utf8')
    .replace('window.ASMTraceFrameTween = {',
      'window.ASMTraceFrameTween = { markerActivationChanged, previousVisualForEntry,');
  vm.runInContext(tweenSource, context);
  const aliasKey = 'auto-marker-alias:address-i:address-heap:$source';
  const caller = {
    dataset: {
      traceObjectKey: 'marker-i',
      traceSourceVariableId: 'main:i',
      traceRuntimeIdentity: 'caller-lifetime',
      traceVisualContinuityKey: 'auto-marker:main:i:main:heap:i:0',
      traceMarkerAliasContinuityKey: aliasKey
    },
    querySelectorAll: () => []
  };
  const callee = {
    dataset: {
      traceObjectKey: 'marker-pos',
      traceSourceVariableId: 'visit:pos',
      traceRuntimeIdentity: 'callee-lifetime',
      traceVisualContinuityKey: 'auto-marker:visit:pos:visit:heap:pos:0',
      traceMarkerAliasContinuityKey: aliasKey,
      traceMarkerReferenceAlias: '1'
    }
  };
  const previous = new Map([['marker-i', caller]]);
  assert.equal(
    context.window.ASMTraceFrameTween.previousVisualForEntry(callee, previous, 'marker-pos'),
    caller,
    'the reference alias reuses the caller marker visual'
  );
  assert.equal(
    context.window.ASMTraceFrameTween.markerActivationChanged(callee, caller),
    false,
    'renaming i to pos is not a new marker lifetime animation'
  );
});

test('renderer gives caller and reference parameter the same physical alias key', () => {
  const renderAlias = ({ sourceId, sourceName, sourceType, targetId, targetName, targetType }) => {
    context.window.ASMTraceRules = { resolveExpression: () => 1 };
    const placements = new Map([
      [`${targetId}#0`, { x: 0, y: 40, width: 40, height: 40 }],
      [`${targetId}#1`, { x: 40, y: 40, width: 40, height: 40 }]
    ]);
    const elements = new Map([...placements.keys()].map(key => [key, { closest: () => null }]));
    const frame = {
      state: {
        [sourceId]: { identity: 'address-i', lifetime: `life-${sourceName}`, data: { kind: 'scalar', value: 1 } },
        [targetId]: { identity: 'address-heap', lifetime: `life-${targetName}`, data: { kind: 'sequence', items: [0, 9] } }
      },
      bindings: [{
        mode: 'index', sourceVariableId: sourceId, sourceName,
        targetVariableId: targetId, targetName, indexExpression: sourceName
      }]
    };
    const root = {};
    context.window.ASMTraceRenderers.renderFrameBindings(root, {
      variables: {
        [sourceId]: { name: sourceName, cppType: sourceType },
        [targetId]: { name: targetName, cppType: targetType }
      }
    }, frame, placements, elements);
    return root.objects[0];
  };
  const caller = renderAlias({
    sourceId: 'main:i', sourceName: 'i', sourceType: 'int',
    targetId: 'main:heap', targetName: 'heap', targetType: 'vector<int>'
  });
  const callee = renderAlias({
    sourceId: 'visit:pos', sourceName: 'pos', sourceType: 'int&',
    targetId: 'visit:heap', targetName: 'heap', targetType: 'vector<int>&'
  });
  assert.equal(caller.sourceAliasContinuityKey, callee.sourceAliasContinuityKey);
  assert.equal(caller.sourceReferenceAlias, false);
  assert.equal(callee.sourceReferenceAlias, true);
});

test('a visible global keeps its marker beside a reference parameter alias', () => {
  context.window.ASMTraceRules = {
    resolveExpression: (doc, frame, expression) => frame.state[
      expression === 'pos' ? 'visit:pos' : 'global:i'
    ]?.data?.value
  };
  const placements = new Map([
    ['visit:heap#0', { x: 0, y: 40, width: 40, height: 40 }],
    ['visit:heap#1', { x: 40, y: 40, width: 40, height: 40 }]
  ]);
  const elements = new Map([...placements.keys()].map(key => [key, { closest: () => null }]));
  const frame = {
    state: {
      'global:i': { identity: 'address-i', lifetime: 'global-life', data: { kind: 'scalar', value: 1 } },
      'visit:pos': { identity: 'address-i', lifetime: 'param-life', data: { kind: 'scalar', value: 1 } },
      'visit:heap': { identity: 'address-heap', data: { kind: 'sequence', items: [0, 9] } }
    },
    bindings: [{
      mode: 'index', sourceVariableId: 'visit:pos', sourceName: 'pos',
      targetVariableId: 'visit:heap', targetName: 'heap', indexExpression: 'pos'
    }]
  };
  const root = {};
  context.window.ASMTraceRenderers.renderFrameBindings(root, {
    variables: {
      'global:i': { name: 'i', cppType: 'int', kind: 'scalar', functionName: 'global' },
      'visit:pos': { name: 'pos', cppType: 'int&', kind: 'scalar', functionName: 'visit' },
      'visit:heap': { name: 'heap', cppType: 'vector<int>&', kind: 'sequence', functionName: 'visit' }
    }
  }, frame, placements, elements);
  assert.deepEqual(Array.from(root.objects, object => object.text), ['i', 'pos']);
  assert.ok(root.objects.every(object => object.sourceVariableIds.includes('global:i')));
  assert.ok(root.objects.every(object => object.sourceVariableIds.includes('visit:pos')));
  assert.ok(root.objects.every(object => !object.sourceAliasContinuityKey),
    'two explicitly visible aliases remain separate marker visuals');
});

test('a moved swap container settles before its swap event can start', () => {
  const element = {
    dataset: { traceObjectKey: 'arr', traceRuntimeIdentity: 'runtime-arr' }
  };
  const previous = {
    dataset: { traceObjectKey: 'arr', traceRuntimeIdentity: 'runtime-arr' }
  };
  const eventFrame = {
    id: 'moved-swap-frame',
    events: [{
      id: 'swap-1', type: 'swap', order: 1, enabled: true,
      targets: [
        { variableId: 'arr', indexExpression: '0', resolvedIndex: 0 },
        { variableId: 'arr', indexExpression: '1', resolvedIndex: 1 }
      ]
    }]
  };
  const steps = context.window.ASMTraceFrameTween.swapContainerPlacementTransitionSteps({
    eventFrame,
    previousPlacements: new Map([['arr', { x: 80, y: 60, width: 120, height: 70 }]]),
    currentPlacements: new Map([['arr', { x: 300, y: 180, width: 120, height: 70 }]]),
    previousObjects: new Map([['arr', previous]]),
    currentElements: new Map([['arr', element]]),
    transitionForKey: () => ({ mode: 'move', sourceKey: 'arr', duration: 520 }),
    duration: 520
  });
  assert.equal(steps.length, 1);
  assert.equal(steps[0].subtype, 'swap-container-settle');
  assert.equal(steps[0].durationMs, 520);
  assert.deepEqual(JSON.parse(JSON.stringify(steps[0].from)), { x: 80, y: 60 });
  assert.deepEqual(JSON.parse(JSON.stringify(steps[0].to)), { x: 300, y: 180 });
  const preEvent = context.window.ASMTraceFrameTween.createPlaybackPlan({
    frame: eventFrame, direction: 1, transitionSteps: steps, eventTimeline: []
  });
  assert.equal(preEvent.preEventDurationMs, 520,
    'the second timeline pass starts swap only after the container movement');
});

test('text and marker lifecycles use distinct shared motion profiles', () => {
  const {
    visualLifecycleKind: kind,
    visualLifecycleOffsetY: offsetY,
    composeLifecycleOpacity: opacity,
    removedVisualStartMs: removalStart
  } =
    context.window.ASMTraceFrameTween;
  const text = {
    dataset: {},
    matches: selector => selector === '.asm-trace-text-object',
    closest: () => null,
    querySelector: () => null
  };
  const marker = {
    dataset: { traceSourceVariableId: 'main:i' },
    matches: () => false,
    closest: () => null,
    querySelector: () => null
  };
  const object = {
    dataset: {},
    matches: () => false,
    closest: () => null,
    querySelector: () => null
  };
  const array = {
    dataset: { traceLifecycleKind: 'array' },
    matches: selector => selector === '[data-trace-lifecycle-kind="array"]',
    closest: () => null,
    querySelector: () => null
  };

  assert.equal(kind(text), 'text');
  assert.equal(kind(marker), 'marker');
  assert.equal(kind(array), 'array');
  assert.equal(kind(object), 'object');
  assert.equal(offsetY('text', 'enter', 0), 0, 'text fades in without moving');
  assert.equal(offsetY('text', 'removed', 1), 0, 'text fades out without moving');
  assert.equal(offsetY('marker', 'enter', 0), -16, 'marker begins above its final position');
  assert.equal(offsetY('marker', 'enter', 1), 0, 'marker finishes at its bound position');
  assert.equal(offsetY('marker', 'exit', 1), -16, 'marker rises while fading out');
  assert.equal(offsetY('array', 'enter', 0), 0, 'arrays fade in at their rendered position');
  assert.equal(offsetY('array', 'exit', 1), 0, 'array scope exits stay in place');
  assert.equal(offsetY('array', 'removed', 1), 0, 'removed arrays fade out in place');
  assert.equal(offsetY('object', 'exit', 1), 0, 'ordinary scope exits remain in place');
  assert.equal(removalStart('text', 500, 220), 0,
    'an outgoing caption starts fading as soon as next is pressed');
  assert.equal(removalStart('array', 500, 220), 720,
    'ordinary visuals still wait for code and keep settlement');
  assert.equal(opacity(0, 0), 0, 'scope exit cannot reveal an object before entrance starts');
  assert.equal(opacity(0.4, 0), 0.4, 'entrance opacity is preserved before exit starts');
  assert.equal(opacity(0.6, 0.25), 0.75,
    'once exit begins it exclusively owns opacity');
  assert.equal(opacity(1, 1), 0, 'a fully exited object is hidden');
});

test('keep snapshots use an in-place lifecycle profile', () => {
  assert.equal(
    context.window.ASMTraceFrameTween.visualLifecycleOffsetY('keep-snapshot', 'enter', 0),
    0
  );
  assert.equal(
    context.window.ASMTraceFrameTween.visualLifecycleOffsetY('keep-snapshot', 'enter', 0.5),
    0
  );
  assert.equal(
    context.window.ASMTraceFrameTween.shouldAnimateObjectEntrance({
      keepSnapshotMember: true,
      declarationSlot: { start: 0 },
      hasPrevious: false
    }),
    false,
    'keep snapshots never receive an entrance animation, even without a handoff source'
  );
  assert.equal(
    context.window.ASMTraceFrameTween.shouldAnimateObjectEntrance({
      retainedSnapshot: true,
      sceneBoundaryEntrance: true,
      hasPrevious: false
    }),
    false,
    'an existing keep snapshot remains visible across a function scene boundary'
  );
});

test('new nested cells inherit a continuous container move', () => {
  const delta = context.window.ASMTraceFrameTween.relativeMotionDelta(
    { x: 0, y: 24 },
    { x: -180, y: -90 },
    { inheritParentMotion: true }
  );
  assert.deepEqual({ ...delta }, { x: 0, y: 0 },
    'a child without an alias must not cancel its moving parent transform');
  const swapDelta = context.window.ASMTraceFrameTween.relativeMotionDelta(
    { x: 40, y: -90 },
    { x: -180, y: -90 }
  );
  assert.deepEqual({ ...swapDelta }, { x: 220, y: 0 },
    'independently matched cells retain their own relative movement');
});

test('an outgoing live object retained by a new keep snapshot never receives generic removal', () => {
  const tweenSource = fs.readFileSync(path.join(__dirname, '../public/trace-frame-tween.js'), 'utf8')
    .replace('window.ASMTraceFrameTween = {',
      'window.ASMTraceFrameTween = { previousVisualRetainedByEnteringKeep, keepSnapshotHandoffSources,');
  const keepContext = vm.createContext({
    window: {}, document: { documentElement: { dataset: {} } },
    requestAnimationFrame() {}, cancelAnimationFrame() {}, performance: { now: () => 0 },
    queueMicrotask() {}
  });
  vm.runInContext(tweenSource, keepContext);
  const retained = keepContext.window.ASMTraceFrameTween.previousVisualRetainedByEnteringKeep;
  assert.equal(retained(
    'main:arr', { dataset: { traceRuntimeIdentity: 'runtime-arr' } },
    new Set(), new Set(['runtime-arr'])
  ), true);
  assert.equal(retained(
    'main:key', { dataset: { traceRuntimeIdentity: '' } },
    new Set(['main:key']), new Set()
  ), true);
  assert.equal(retained(
    'main:other', { dataset: { traceRuntimeIdentity: 'runtime-other' } },
    new Set(['main:arr']), new Set(['runtime-arr'])
  ), false);
  const handoffs = keepContext.window.ASMTraceFrameTween.keepSnapshotHandoffSources;
  const previousPlacements = new Map([['bubble:arr-object', { x: 40, y: 80 }]]);
  const result = handoffs([{
    key: 'round',
    snapshot: {
      kind: 'frame',
      frame: {
        source: { objectId: 'bubble:arr-object', primaryVariableId: 'main:arr' },
        state: { 'main:arr': { data: { kind: 'sequence', items: [2, 1] } } }
      }
    }
  }], previousPlacements);
  assert.equal(result.get('round'), 'bubble:arr-object',
    'the entering snapshot inherits the outgoing live visual geometry');
});

test('automatic marker continuity does not depend on binding order', () => {
  const cells = [[0, 100, 80], [1, 140, 80]];
  const first = bindings({ cells, values: { i: 1, j: 0 } });
  const reordered = bindings({ cells, values: { j: 0, i: 1 } });
  const firstI = first.objects.find(object => object.text === 'i');
  const reorderedI = reordered.objects.find(object => object.text === 'i');
  assert.notEqual(firstI.id, reorderedI.id, 'render IDs still describe the current binding slot');
  assert.equal(firstI.sourceVisualContinuityKey, reorderedI.sourceVisualContinuityKey);
});

test('derived markers sharing one runtime identity recover their own previous visual', () => {
  const tweenSource = fs.readFileSync(path.join(__dirname, '../public/trace-frame-tween.js'), 'utf8')
    .replace('window.ASMTraceFrameTween = {',
      'window.ASMTraceFrameTween = { previousVisualForEntry,');
  vm.runInContext(tweenSource, context);
  const marker = (key, continuityKey, x) => ({
    dataset: {
      traceObjectKey: key,
      traceSourceVariableId: 'main:j',
      traceRuntimeIdentity: 'shared-j-address',
      traceVisualContinuityKey: continuityKey
    },
    x
  });
  const previousJ = marker('marker-j', 'auto-marker:main:j:arr:j:0', 28);
  const previousJPlusOne = marker('marker-j-plus-one', 'auto-marker:main:j:arr:j:1', 68);
  const currentJPlusOne = marker('marker-j-plus-one', 'auto-marker:main:j:arr:j:1', 108);
  const previousObjects = new Map([
    ['marker-j', previousJ],
    ['marker-j-plus-one', previousJPlusOne]
  ]);
  assert.equal(
    context.window.ASMTraceFrameTween.previousVisualForEntry(
      currentJPlusOne, previousObjects, 'marker-j'
    ),
    previousJPlusOne,
    'runtime-identity aliasing must not collapse j+1 onto the previous j marker'
  );
});

test('a consecutive recursive marker with a different render ID skips entrance', () => {
  const tweenSource = fs.readFileSync(path.join(__dirname, '../public/trace-frame-tween.js'), 'utf8')
    .replace('window.ASMTraceFrameTween = {',
      'window.ASMTraceFrameTween = { markerContinuationFor, markerNeedsEntrance,');
  vm.runInContext(tweenSource, context);
  const continuityKey = 'auto-marker:heapify:i:heapify:arr:i:0';
  const previous = {
    dataset: {
      traceObjectKey: 'old-marker-id',
      traceSourceVariableId: 'heapify:i',
      traceRuntimeIdentity: 'activation-parent',
      traceVisualContinuityKey: continuityKey
    }
  };
  const current = {
    dataset: {
      traceObjectKey: 'new-marker-id',
      traceSourceVariableId: 'heapify:i',
      traceRuntimeIdentity: 'activation-child',
      traceVisualContinuityKey: continuityKey
    }
  };
  const previousPlacements = new Map([['old-marker-id', { x: 100, y: 80 }]]);
  const previousObjects = new Map([['old-marker-id', previous]]);
  const continuation = context.window.ASMTraceFrameTween.markerContinuationFor(
    current, 'new-marker-id', previousPlacements, previousObjects
  );
  assert.equal(continuation.key, 'old-marker-id');
  assert.deepEqual({ ...continuation.placement }, { x: 100, y: 80 });
  assert.equal(context.window.ASMTraceFrameTween.markerNeedsEntrance({
    element: current,
    key: 'new-marker-id',
    previousPlacements,
    previousObjects,
    currentAutomaticMarkers: new Set(['new-marker-id']),
    previousAutomaticMarkers: new Set(['old-marker-id'])
  }), false);
  assert.equal(context.window.ASMTraceFrameTween.markerNeedsEntrance({
    element: current,
    key: 'new-marker-id',
    previousPlacements: new Map(),
    previousObjects: new Map(),
    currentAutomaticMarkers: new Set(['new-marker-id'])
  }), true, 'a real visibility gap still enters');
});

test('a loop-local marker redeclared after keep enters as a new visual lifetime', () => {
  const tweenSource = fs.readFileSync(path.join(__dirname, '../public/trace-frame-tween.js'), 'utf8')
    .replace('window.ASMTraceFrameTween = {',
      'window.ASMTraceFrameTween = { markerDeclaredInFrame, markerNeedsEntrance, markerContinuationFor, previousVisualForEntry,');
  vm.runInContext(tweenSource, context);
  const marker = {
    dataset: {
      traceObjectKey: 'marker-j',
      traceSourceVariableId: 'main:j',
      traceRuntimeIdentity: 'reused-stack-address',
      traceVisualContinuityKey: 'auto-marker:main:j:main:arr:0',
      traceSceneGeneration: '1'
    }
  };
  const previous = { dataset: { ...marker.dataset, traceSceneGeneration: '0' } };
  const eventFrame = {
    events: [{
      type: 'declare',
      order: 10,
      targets: [{ role: 'target', variableId: 'main:j' }]
    }]
  };
  assert.equal(context.window.ASMTraceFrameTween.markerDeclaredInFrame(eventFrame, marker), true);
  assert.equal(context.window.ASMTraceFrameTween.markerContinuationFor(
    marker,
    'marker-j',
    new Map([['marker-j', { x: 180, y: 80 }]]),
    new Map([['marker-j', previous]])
  ), null, 'a keep generation boundary must reject the old marker as a motion source');
  assert.equal(context.window.ASMTraceFrameTween.previousVisualForEntry(
    marker,
    new Map([['marker-j', previous]]),
    'marker-j'
  ), null, 'event motion must not recover the old marker through its fallback lookup');
  assert.equal(context.window.ASMTraceFrameTween.markerNeedsEntrance({
    element: marker,
    key: 'marker-j',
    eventFrame,
    previousPlacements: new Map([['marker-j', { x: 180, y: 80 }]]),
    previousObjects: new Map([['marker-j', previous]]),
    currentAutomaticMarkers: new Set(['marker-j']),
    previousAutomaticMarkers: new Set(['marker-j'])
  }), true, 'a reused address must not pull the previous loop marker onto the current array');
});

test('a marker frozen inside keep ignores declarations from the new live frame', () => {
  const tweenSource = fs.readFileSync(path.join(__dirname, '../public/trace-frame-tween.js'), 'utf8')
    .replace('window.ASMTraceFrameTween = {',
      'window.ASMTraceFrameTween = { markerDeclaredInFrame, markerNeedsEntrance,');
  vm.runInContext(tweenSource, context);
  const marker = {
    dataset: {
      traceObjectKey: 'round_1:auto-frame-binding-main:j-main:arr-0',
      traceSourceVariableId: 'main:j',
      traceSnapshotOwner: 'round_1',
      traceVisualContinuityKey: 'snapshot:round_1:auto-marker:main:j:main:arr:j:0'
    },
    closest: () => ({ dataset: { traceSnapshot: 'snapshot-1' } })
  };
  const eventFrame = { events: [{
    type: 'declare', order: 10,
    targets: [{ role: 'target', variableId: 'main:j' }]
  }] };
  assert.equal(context.window.ASMTraceFrameTween.markerDeclaredInFrame(eventFrame, marker), false);
});

test('a live marker never continues from a retained keep marker in legacy traces', () => {
  const tweenSource = fs.readFileSync(path.join(__dirname, '../public/trace-frame-tween.js'), 'utf8')
    .replace('window.ASMTraceFrameTween = {',
      'window.ASMTraceFrameTween = { markerContinuationFor, markerNeedsEntrance, previousVisualForEntry,');
  vm.runInContext(tweenSource, context);
  const continuityKey = 'auto-marker:main:j:main:arr:j:0';
  const live = {
    dataset: {
      traceObjectKey: 'marker-j',
      traceSourceVariableId: 'main:j',
      traceRuntimeIdentity: 'reused-stack-address',
      traceVisualContinuityKey: continuityKey
    },
    closest: () => null
  };
  const kept = {
    dataset: {
      traceObjectKey: 'marker-j',
      traceSourceVariableId: 'main:j',
      traceRuntimeIdentity: 'reused-stack-address',
      traceVisualContinuityKey: continuityKey,
      traceSnapshotOwner: 'round'
    },
    closest: () => ({ dataset: { traceSnapshot: 'snapshot-1' } })
  };
  const previousPlacements = new Map([['marker-j', { x: 180, y: 80 }]]);
  const previousObjects = new Map([['marker-j', kept]]);
  assert.equal(context.window.ASMTraceFrameTween.markerContinuationFor(
    live, 'marker-j', previousPlacements, previousObjects
  ), null, 'missing generation metadata must not reconnect live j to kept j');
  assert.equal(context.window.ASMTraceFrameTween.previousVisualForEntry(
    live, previousObjects, 'marker-j'
  ), null, 'event effects must not use the kept marker as their visual source');
  assert.equal(context.window.ASMTraceFrameTween.markerNeedsEntrance({
    element: live,
    key: 'marker-j',
    eventFrame: { events: [] },
    previousPlacements,
    previousObjects,
    currentAutomaticMarkers: new Set(['marker-j']),
    previousAutomaticMarkers: new Set(['marker-j'])
  }), true, 'the following live marker must start a new entrance lifetime');
});

test('declaration and exit targets never bind to a retained keep marker', () => {
  const tweenSource = fs.readFileSync(path.join(__dirname, '../public/trace-frame-tween.js'), 'utf8')
    .replace('window.ASMTraceFrameTween = {',
      'window.ASMTraceFrameTween = { eventTargetVisualKeys, scopeExitVisualKeys,');
  vm.runInContext(tweenSource, context);
  const kept = {
    dataset: {
      traceObjectKey: 'round_1:marker-j',
      traceSourceVariableId: 'main:j',
      traceSourceVariableIds: JSON.stringify(['main:j']),
      traceRuntimeIdentity: 'lifetime-old',
      traceSnapshotOwner: 'round_1'
    },
    closest: () => ({ dataset: { traceSnapshot: 'snapshot-1' } }),
    querySelectorAll: () => []
  };
  const live = {
    dataset: {
      traceObjectKey: 'marker-j',
      traceSourceVariableId: 'main:j',
      traceSourceVariableIds: JSON.stringify(['main:j']),
      traceRuntimeIdentity: 'lifetime-new'
    },
    closest: () => null,
    querySelectorAll: () => []
  };
  const declaration = {
    type: 'declare', lifetimeIdentity: 'lifetime-new',
    targets: [{ role: 'target', variableId: 'main:j', lifetimeIdentity: 'lifetime-new' }]
  };
  const keys = context.window.ASMTraceFrameTween.eventTargetVisualKeys(
    { variables: {} }, { state: {} }, declaration, new Map(),
    new Map([['round_1:marker-j', kept], ['marker-j', live]])
  );
  assert.deepEqual([...keys], ['marker-j'],
    'the new j entrance is locked to the live array marker');

  const exit = {
    type: 'scope-exit', lifetimeIdentity: 'lifetime-old',
    targets: [{ role: 'target', variableId: 'main:j', lifetimeIdentity: 'lifetime-old' }]
  };
  const previous = new Map([['round_1:marker-j', kept], ['marker-j', {
    ...live,
    dataset: { ...live.dataset, traceRuntimeIdentity: 'lifetime-old' }
  }]]);
  assert.deepEqual(
    [...context.window.ASMTraceFrameTween.scopeExitVisualKeys(exit, previous)],
    ['marker-j'],
    'scope exit fades the old live marker but never the retained snapshot'
  );
});

test('recursive marker movement and marker entrance run in parallel before trace events', () => {
  const continuityKey = 'auto-marker:heapify:i:heapify:arr:0';
  const previous = {
    dataset: {
      traceObjectKey: 'marker-i',
      traceSourceVariableId: 'heapify:i',
      traceRuntimeIdentity: 'activation-parent',
      traceVisualContinuityKey: continuityKey
    },
    getAttribute: () => null
  };
  const current = {
    dataset: {
      traceObjectKey: 'marker-i',
      traceSourceVariableId: 'heapify:i',
      traceRuntimeIdentity: 'activation-child',
      traceVisualContinuityKey: continuityKey
    },
    getAttribute: () => null
  };
  const steps = context.window.ASMTraceFrameTween.recursiveMarkerTransitionSteps({
    previousPlacements: new Map([['marker-i', { x: 100, y: 80 }]]),
    currentPlacements: new Map([['marker-i', { x: 220, y: 160 }]]),
    previousObjects: new Map([['marker-i', previous]]),
    currentElements: new Map([['marker-i', current]]),
    transitionForKey: () => ({ mode: 'move', duration: 360 }),
    duration: 520
  });
  assert.equal(steps.length, 1);
  assert.equal(steps[0].subtype, 'recursive-marker-move');
  assert.equal(steps[0].durationMs, 360);
  assert.equal(steps[0].blocking, true);
  assert.deepEqual({ ...steps[0].from }, { x: 100, y: 80 });
  assert.deepEqual({ ...steps[0].to }, { x: 220, y: 160 });

  const preEvent = context.window.ASMTraceFrameTween.createPlaybackPlan({
    frame: { id: 'frame-child' },
    direction: 1,
    runId: 7,
    transitionSteps: steps,
    enteringMarkerKeys: ['marker-new']
  });
  assert.equal(preEvent.phases[0].id, 'frame-transition');
  assert.equal(preEvent.phases[0].mode, 'parallel');
  assert.equal(preEvent.phases[1].startMs, 0);
  assert.equal(preEvent.preEventDurationMs, 360);

  const event = { id: 'event-42', type: 'assign', order: 42 };
  const plan = context.window.ASMTraceFrameTween.createPlaybackPlan({
    frame: { id: 'frame-child' },
    direction: 1,
    runId: 7,
    transitionSteps: steps,
    enteringMarkerKeys: ['marker-new'],
    eventTimeline: [{ event, type: 'assign', animation: 'assign', start: 360, duration: 240, end: 600 }]
  });
  assert.equal(plan.phases[2].id, 'trace-events');
  assert.equal(plan.phases[2].startMs, 360);
  assert.equal(plan.phases[2].steps[0].eventOrder, 42);
  assert.equal(plan.totalDurationMs, 600);

  const eventControlled = context.window.ASMTraceFrameTween.recursiveMarkerTransitionSteps({
    previousPlacements: new Map([['marker-i', { x: 100, y: 80 }]]),
    currentPlacements: new Map([['marker-i', { x: 220, y: 160 }]]),
    previousObjects: new Map([['marker-i', previous]]),
    currentElements: new Map([['marker-i', current]]),
    eventControlledKeys: new Set(['marker-i'])
  });
  assert.equal(eventControlled.length, 0, 'event-controlled motion must keep its trace-event slot');
});

test('playback plan schedules a code jump before every visual phase', () => {
  const plan = context.window.ASMTraceFrameTween.createPlaybackPlan({
    frame: { id: 'frame-code-jump' },
    direction: 1,
    runId: 9,
    initialDelayMs: 500,
    transitionSteps: [{
      id: 'move-arr', kind: 'object-transition', durationMs: 520,
      blocking: true, enabled: true
    }],
    enteringMarkerKeys: ['marker-i'],
    eventTimeline: [{
      event: { id: 'event-1', type: 'assign', order: 1 },
      type: 'assign', animation: 'assign', start: 1020, duration: 300, end: 1320
    }]
  });
  assert.equal(plan.phases[0].id, 'code-transition');
  assert.equal(plan.phases[0].durationMs, 500);
  assert.equal(plan.phases.find(phase => phase.id === 'frame-transition').startMs, 500);
  assert.equal(plan.phases.find(phase => phase.id === 'object-entrance').startMs, 500);
  assert.equal(plan.phases.find(phase => phase.id === 'trace-events').startMs, 1020);
  assert.equal(plan.totalDurationMs, 1320);
});

test('each renderable sourced event prompts in code before its visual response', () => {
  const promptContext = vm.createContext({
    window: {},
    document: { documentElement: { dataset: {} } },
    queueMicrotask() {},
    CustomEvent: function CustomEvent() {}
  });
  promptContext.window.ASMTraceEvents = {
    ordered: events => events,
    animation: type => ({ declare: 'declare', 'function-enter': 'code' })[type] || 'none'
  };
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, '../public/trace-frame-tween.js'), 'utf8'),
    promptContext
  );
  const visual = { dataset: {}, closest: () => null };
  const declaration = {
    id: 'declare-i', type: 'declare', order: 1, enabled: true,
    autoAnimationDisabled: false,
    source: { from: 18, to: 23 },
    targets: [{ variableId: 'i', role: 'target' }]
  };
  const frame = { id: 'frame-code-first', events: [declaration], state: {} };
  const placements = new Map([['i#0', { x: 20, y: 30, width: 40, height: 40 }]]);
  const elements = new Map([['i#0', visual]]);
  const timeline = promptContext.window.ASMTraceFrameTween.buildEventTimeline(
    { variables: { i: { kind: 'scalar', name: 'i' } } },
    frame, 1, 520, new Map(), placements, elements
  );
  assert.equal(timeline.length, 1);
  assert.equal(timeline[0].promptStart, 0);
  assert.equal(timeline[0].codePromptDuration, 400);
  assert.equal(timeline[0].visualStart, 400);
  assert.equal(timeline[0].start, 400);
  assert.equal(timeline[0].end, 620);

  const plan = promptContext.window.ASMTraceFrameTween.createPlaybackPlan({
    frame, direction: 1, eventTimeline: timeline
  });
  const step = plan.phases.find(phase => phase.id === 'trace-events').steps[0];
  assert.equal(step.startMs, 0, 'the code highlight owns the formal event start');
  assert.equal(step.codePromptDurationMs, 400);
  assert.equal(step.visualStartMs, 400);
  assert.equal(step.visualDurationMs, 220);
  assert.equal(step.durationMs, 620);
});

test('a for-header code range does not substitute for a missing canvas target', () => {
  const availabilityContext = vm.createContext({
    window: { dispatchEvent() {} },
    document: { documentElement: { dataset: {} } },
    queueMicrotask(callback) { callback(); },
    CustomEvent: function CustomEvent() {}
  });
  availabilityContext.window.ASMTraceEvents = {
    ordered: events => events,
    animation: type => ({ compare: 'compare', 'function-enter': 'code' })[type] || 'none'
  };
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, '../public/trace-frame-tween.js'), 'utf8'),
    availabilityContext
  );
  const comparison = {
    id: 'compare-for-condition', type: 'compare', order: 1, enabled: true,
    source: {
      from: 12, to: 17,
      contexts: [{ type: 'ForStatement', headerFrom: 0, headerTo: 24,
        conditionFrom: 12, conditionTo: 17 }]
    },
    targets: [
      { variableId: 'i', role: 'left' },
      { variableId: 'n', role: 'right' }
    ]
  };
  availabilityContext.window.ASMTraceFrameTween.updateEventAvailability(
    { variables: { i: { kind: 'scalar', name: 'i' }, n: { kind: 'scalar', name: 'n' } } },
    { events: [comparison], state: {} }, new Map(), new Map()
  );
  assert.equal(comparison.codeRenderable, true);
  assert.equal(comparison.canvasRenderable, false);
  assert.equal(comparison.autoAnimationDisabled, true);
  assert.equal(comparison.autoAnimationUnavailableReason, 'missing-target');

  const functionEnter = {
    id: 'enter-main', type: 'function-enter', order: 2, enabled: true,
    source: { from: 30, to: 40 }
  };
  availabilityContext.window.ASMTraceFrameTween.updateEventAvailability(
    { variables: {} }, { events: [functionEnter], state: {} }, new Map(), new Map()
  );
  assert.equal(functionEnter.codeRenderable, true);
  assert.equal(functionEnter.canvasRenderable, false);
  assert.equal(functionEnter.autoAnimationDisabled, false);
});

test('code-only and sourceless events do not add a redundant prompt hold', () => {
  const promptContext = vm.createContext({
    window: {},
    document: { documentElement: { dataset: {} } },
    queueMicrotask() {},
    CustomEvent: function CustomEvent() {}
  });
  promptContext.window.ASMTraceEvents = {
    ordered: events => events,
    animation: type => ({ 'function-enter': 'code', declare: 'declare' })[type] || 'none'
  };
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, '../public/trace-frame-tween.js'), 'utf8'),
    promptContext
  );
  const functionEnter = {
    id: 'enter-main', type: 'function-enter', order: 1, enabled: true,
    autoAnimationDisabled: false, source: { from: 4, to: 14 }
  };
  const codeTimeline = promptContext.window.ASMTraceFrameTween.buildEventTimeline(
    { variables: {} }, { events: [functionEnter] }, 1, 520,
    new Map(), new Map(), new Map()
  );
  assert.equal(codeTimeline[0].codePromptDuration, 0);
  assert.equal(codeTimeline[0].promptStart, codeTimeline[0].visualStart);

  const visual = { dataset: {}, closest: () => null };
  const sourceless = {
    id: 'declare-j', type: 'declare', order: 2, enabled: true,
    autoAnimationDisabled: false, targets: [{ variableId: 'j', role: 'target' }]
  };
  const noSourceTimeline = promptContext.window.ASMTraceFrameTween.buildEventTimeline(
    { variables: { j: { kind: 'scalar', name: 'j' } } },
    { events: [sourceless], state: {} }, 1, 520,
    new Map(), new Map([['j#0', { x: 0, y: 0, width: 40, height: 40 }]]),
    new Map([['j#0', visual]])
  );
  assert.equal(noSourceTimeline[0].codePromptDuration, 0);
  assert.equal(noSourceTimeline[0].promptStart, noSourceTimeline[0].visualStart);
});

test('keep snapshots, live layout and camera settle together before entrances and events', () => {
  const plan = context.window.ASMTraceFrameTween.createPlaybackPlan({
    frame: { id: 'frame-keep' },
    direction: 1,
    runId: 10,
    initialDelayMs: 500,
    keepTransitionKeys: ['round'],
    keepTransitionDurationMs: 520,
    cameraTransitionDurationMs: 700,
    transitionSteps: [{
      id: 'move-arr', kind: 'object-transition', durationMs: 520,
      blocking: true, enabled: true
    }],
    enteringMarkerKeys: ['marker-j'],
    eventTimeline: [{
      event: { id: 'event-keep', type: 'assign', order: 12 },
      type: 'assign', animation: 'assign', start: 1420, duration: 300, end: 1720
    }]
  });
  const keep = plan.phases.find(phase => phase.id === 'keep-transition');
  const movement = plan.phases.find(phase => phase.id === 'frame-transition');
  const entrance = plan.phases.find(phase => phase.id === 'object-entrance');
  const events = plan.phases.find(phase => phase.id === 'trace-events');
  assert.deepEqual({ ...keep, steps: undefined }, {
    id: 'keep-transition', mode: 'parallel', startMs: 500, durationMs: 700, steps: undefined
  });
  assert.deepEqual([...keep.steps[0].targetKeys], ['round']);
  assert.equal(keep.steps[1].kind, 'camera-transition');
  assert.equal(keep.steps[1].durationMs, 700);
  assert.equal(movement.startMs, 500);
  assert.equal(entrance.startMs, 1200);
  assert.equal(events.startMs, 1420);
  assert.equal(plan.preEventDurationMs, 1420);
  assert.equal(plan.totalDurationMs, 1720);
});

test('absorbed scope exits finish before keep appearance and the new live scene', () => {
  const preKeepExit = {
    id: 'exit-min', type: 'scope-exit', order: 20, preKeepExit: true
  };
  const regularEvent = { id: 'declare-next-min', type: 'declare', order: 21 };
  const plan = context.window.ASMTraceFrameTween.createPlaybackPlan({
    frame: { id: 'frame-after-keep' },
    direction: 1,
    initialDelayMs: 500,
    keepTransitionKeys: ['round'],
    keepTransitionDurationMs: 520,
    transitionSteps: [{
      id: 'move-live-arr', kind: 'object-transition', durationMs: 520,
      blocking: true, enabled: true
    }],
    eventTimeline: [
      {
        event: preKeepExit, type: 'scope-exit', animation: 'exit',
        promptStart: 500, visualStart: 500, start: 500, duration: 220, end: 720
      },
      {
        event: regularEvent, type: 'declare', animation: 'declare',
        promptStart: 1240, visualStart: 1240, start: 1240, duration: 220, end: 1460
      }
    ]
  });
  const exit = plan.phases.find(phase => phase.id === 'pre-keep-exit');
  const keep = plan.phases.find(phase => phase.id === 'keep-transition');
  const movement = plan.phases.find(phase => phase.id === 'frame-transition');
  const events = plan.phases.find(phase => phase.id === 'trace-events');
  assert.equal(exit.startMs, 500);
  assert.equal(exit.durationMs, 220);
  assert.equal(keep.startMs, 720);
  assert.equal(movement.startMs, 720);
  assert.equal(events.startMs, 1240);
  assert.equal(events.steps.length, 1,
    'the pre-keep exit has its own phase and is not replayed with ordinary events');
});

test('one multi-target @exit batch finishes in parallel before keep appears', () => {
  const batchContext = vm.createContext({
    window: { dispatchEvent() {} },
    document: { documentElement: { dataset: {} } },
    queueMicrotask(callback) { callback(); },
    CustomEvent: function CustomEvent() {}
  });
  batchContext.window.ASMTraceEvents = {
    ordered: events => events,
    animation: type => type === 'visual-exit' || type === 'scope-exit' ? 'exit' : 'none'
  };
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, '../public/trace-frame-tween.js'), 'utf8'),
    batchContext
  );
  const exits = ['min_idx', 'i'].map((name, index) => ({
    id: `exit-${name}`,
    type: 'visual-exit',
    order: index + 1,
    line: 18,
    signature: '@exit min_idx,i',
    manualVisualExit: true,
    preKeepExit: true,
    enabled: true,
    source: { from: 120, to: 138 },
    targets: [{
      variableId: name,
      lifetimeIdentity: `life-${name}`,
      sceneGeneration: 0
    }]
  }));
  const marker = name => ({
    dataset: {
      traceSourceVariableId: name,
      traceSourceVariableIds: JSON.stringify([name]),
      traceRuntimeIdentity: `life-${name}`,
      traceSceneGeneration: '0'
    },
    querySelectorAll: () => []
  });
  const previousObjects = new Map([
    ['arr-min', marker('min_idx')],
    ['arr-i', marker('i')]
  ]);
  const traceDocument = {
    variables: {
      min_idx: { name: 'min_idx', kind: 'scalar' },
      i: { name: 'i', kind: 'scalar' }
    },
    studio: { eventIntervalMs: 500 }
  };
  const frame = { id: 'keep-batch', events: exits, state: {} };
  const timeline = batchContext.window.ASMTraceFrameTween.buildEventTimeline(
    traceDocument, frame, 1, 520, new Map(), new Map(), new Map(),
    500, previousObjects
  );
  assert.equal(timeline.length, 2);
  assert.equal(timeline[0].start, 500);
  assert.equal(timeline[1].start, 500);
  assert.equal(timeline[0].end, 720);
  assert.equal(timeline[1].end, 720);

  const plan = batchContext.window.ASMTraceFrameTween.createPlaybackPlan({
    frame,
    direction: 1,
    initialDelayMs: 500,
    keepTransitionKeys: ['round'],
    keepTransitionDurationMs: 220,
    eventTimeline: timeline
  });
  const exitPhase = plan.phases.find(phase => phase.id === 'pre-keep-exit');
  const keepPhase = plan.phases.find(phase => phase.id === 'keep-transition');
  assert.equal(exitPhase.durationMs, 220);
  assert.equal(exitPhase.steps[0].startMs, 500);
  assert.equal(exitPhase.steps[1].startMs, 500);
  assert.equal(keepPhase.startMs, 720);
  assert.equal(keepPhase.steps[0].subtype, 'in-place-fade');
});

test('consecutive scope-exit events keep separate rows but leave in one parallel batch', () => {
  const exitContext = vm.createContext({
    window: { dispatchEvent() {} },
    document: { documentElement: { dataset: {} } },
    queueMicrotask(callback) { callback(); },
    CustomEvent: function CustomEvent() {}
  });
  exitContext.window.ASMTraceEvents = {
    ordered: events => events,
    animation: type => type === 'scope-exit' ? 'exit' : type === 'assign' ? 'assign' : 'none'
  };
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, '../public/trace-frame-tween.js'), 'utf8'),
    exitContext
  );
  const target = name => ({
    variableId: name,
    lifetimeIdentity: `life-${name}`,
    sceneGeneration: 0
  });
  const exits = ['left', 'right'].map((name, index) => ({
    id: `scope-exit-${name}`,
    type: 'scope-exit',
    order: index + 1,
    enabled: true,
    source: { from: 80, to: 90 },
    targets: [target(name)]
  }));
  const marker = name => ({
    dataset: {
      traceSourceVariableId: name,
      traceSourceVariableIds: JSON.stringify([name]),
      traceRuntimeIdentity: `life-${name}`,
      traceSceneGeneration: '0',
      traceLifecycleKind: 'marker'
    },
    querySelectorAll: () => []
  });
  const elements = new Map([
    ['left#0', marker('left')],
    ['right#0', marker('right')]
  ]);
  const placements = new Map([
    ['left#0', { x: 0, y: 0, width: 40, height: 40 }],
    ['right#0', { x: 40, y: 0, width: 40, height: 40 }]
  ]);
  const traceDocument = {
    variables: {
      left: { name: 'left', kind: 'scalar' },
      right: { name: 'right', kind: 'scalar' }
    },
    studio: { eventIntervalMs: 500 }
  };
  const timeline = exitContext.window.ASMTraceFrameTween.buildEventTimeline(
    traceDocument,
    { id: 'parallel-scope-exits', events: exits, state: {} },
    1, 520, placements, placements, elements, 300, elements
  );

  assert.equal(timeline.length, 2, 'both exit events remain independently editable');
  assert.equal(timeline[0].event.id, 'scope-exit-left');
  assert.equal(timeline[1].event.id, 'scope-exit-right');
  assert.equal(timeline[0].start, timeline[1].start,
    'consecutive exits must begin together');
  assert.equal(timeline[0].end, timeline[1].end,
    'the parallel exit batch must finish together when durations match');
  assert.equal(timeline[1].exitBatchStart, timeline[0].start);
});

test('a visible event between exits preserves runtime order and starts a new exit batch', () => {
  const orderedContext = vm.createContext({
    window: { dispatchEvent() {} },
    document: { documentElement: { dataset: {} } },
    queueMicrotask(callback) { callback(); },
    CustomEvent: function CustomEvent() {}
  });
  orderedContext.window.ASMTraceEvents = {
    ordered: events => events,
    animation: type => type === 'scope-exit' ? 'exit' : type === 'assign' ? 'assign' : 'none'
  };
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, '../public/trace-frame-tween.js'), 'utf8'),
    orderedContext
  );
  const visual = name => ({
    dataset: {
      traceSourceVariableId: name,
      traceSourceVariableIds: JSON.stringify([name]),
      traceRuntimeIdentity: `life-${name}`,
      traceSceneGeneration: '0'
    },
    querySelectorAll: () => []
  });
  const elements = new Map([
    ['a#0', visual('a')], ['b#0', visual('b')], ['value#0', visual('value')]
  ]);
  const placements = new Map([...elements.keys()].map((key, index) => [
    key, { x: index * 40, y: 0, width: 40, height: 40 }
  ]));
  const exit = (name, order) => ({
    id: `exit-${name}`, type: 'scope-exit', order, enabled: true,
    targets: [{
      variableId: name, lifetimeIdentity: `life-${name}`, sceneGeneration: 0
    }]
  });
  const assign = {
    id: 'assign-value', type: 'assign', order: 2, enabled: true,
    targets: [{ role: 'target', variableId: 'value' }],
    payload: { before: 0, after: 1 }
  };
  const timeline = orderedContext.window.ASMTraceFrameTween.buildEventTimeline(
    {
      variables: {
        a: { name: 'a', kind: 'scalar' },
        b: { name: 'b', kind: 'scalar' },
        value: { name: 'value', kind: 'scalar' }
      },
      studio: { eventIntervalMs: 100 }
    },
    { id: 'ordered-exits', events: [exit('a', 1), assign, exit('b', 3)], state: {} },
    1, 520, placements, placements, elements, 0, elements
  );

  assert.equal(timeline.length, 3);
  assert.ok(timeline[0].end < timeline[1].start);
  assert.ok(timeline[1].end < timeline[2].start);
  assert.notEqual(timeline[0].start, timeline[2].start,
    'exit batches must not jump across another visible event');
});

test('forward replay checkpoints isolate every mutation from later frame state', () => {
  const target = (index, role = 'target') => ({
    role,
    variableId: 'arr',
    indexExpression: String(index),
    resolvedIndex: index
  });
  const assign = {
    id: 'assign-first', order: 1, type: 'assign',
    targets: [target(0)],
    payload: { before: { kind: 'scalar', value: 5 }, after: { kind: 'scalar', value: 3 } }
  };
  const disabledSwap = {
    id: 'swap-disabled', order: 2, type: 'swap', enabled: false,
    targets: [target(0, 'left'), target(1, 'right')],
    payload: {
      leftBefore: { kind: 'scalar', value: 3 },
      rightBefore: { kind: 'scalar', value: 7 },
      leftAfter: { kind: 'scalar', value: 7 },
      rightAfter: { kind: 'scalar', value: 3 }
    }
  };
  const suppressedBoundary = {
    id: 'boundary-hidden', order: 3, type: 'write', update: true,
    loopBoundarySuppressed: true,
    targets: [target(1)],
    payload: { before: { kind: 'scalar', value: 3 }, after: { kind: 'scalar', value: 99 } }
  };
  const frame = { id: 'forward-frame', events: [assign, disabledSwap, suppressedBoundary] };
  const plan = context.window.ASMTraceFrameTween.createForwardReplayPlan(
    { variables: { arr: { name: 'arr', kind: 'sequence' } } },
    frame,
    [{
      event: assign, animation: 'assign', markerAssignment: false,
      promptStart: 0, visualStart: 0, effectStart: 0, start: 0,
      duration: 760, end: 760
    }],
    1
  );
  assert.equal(plan.direction, 'forward');
  assert.equal(display(plan.initialState['value:arr#0']), '5');
  assert.equal(display(plan.initialState['value:arr#1']), '7');
  assert.equal(plan.checkpoints[0].mode, 'animated');
  assert.equal(plan.checkpoints[0].commitMs, 660);
  assert.equal(display(plan.checkpoints[0].afterState['value:arr#0']), '3');
  assert.equal(plan.checkpoints[1].mode, 'instant');
  assert.equal(plan.checkpoints[1].commitMs, 760);
  assert.equal(display(plan.checkpoints[1].afterState['value:arr#0']), '7');
  assert.equal(display(plan.checkpoints[1].afterState['value:arr#1']), '3');
  assert.equal(plan.checkpoints[2].mode, 'ignored');
  assert.equal(display(plan.finalState['value:arr#1']), '3',
    'a suppressed loop boundary is absent from both playback and logical state');

  function display(value) {
    return value && typeof value === 'object' && 'value' in value
      ? String(value.value)
      : String(value);
  }
});

test('rendered cell values advance only when their forward checkpoint commits', () => {
  const text = { textContent: 'final-frame-value' };
  const cell = {
    dataset: {},
    matches: () => false,
    querySelector: selector => selector === 'text' ? text : null
  };
  const replay = context.window.ASMTraceFrameTween.prepareForwardValues({
    currentElements: new Map([['arr#0', cell]])
  }, {
    valueTracks: [{
      kind: 'value', key: 'arr#0', initial: { kind: 'scalar', value: 5 },
      steps: [
        { mode: 'animated', commitMs: 100, after: { kind: 'scalar', value: 3 } },
        { mode: 'instant', commitMs: 180, after: { kind: 'scalar', value: 7 } }
      ]
    }]
  });
  assert.equal(text.textContent, '5');
  replay.update(99);
  assert.equal(text.textContent, '5');
  replay.update(100);
  assert.equal(text.textContent, '3');
  replay.update(180);
  assert.equal(text.textContent, '7');
});

test('swap checkpoints move value-carrying nodes without rewriting their text', () => {
  const target = (index, role = 'target') => ({
    role, variableId: 'arr', indexExpression: String(index), resolvedIndex: index
  });
  const assign = {
    id: 'assign-before-swap', order: 1, type: 'assign', targets: [target(0)],
    payload: { before: { kind: 'scalar', value: 5 }, after: { kind: 'scalar', value: 3 } }
  };
  const swap = {
    id: 'swap-after-assign', order: 2, type: 'swap',
    targets: [target(0, 'left'), target(1, 'right')],
    payload: {
      leftBefore: { kind: 'scalar', value: 3 }, rightBefore: { kind: 'scalar', value: 7 },
      leftAfter: { kind: 'scalar', value: 7 }, rightAfter: { kind: 'scalar', value: 3 }
    }
  };
  const plan = context.window.ASMTraceFrameTween.createForwardReplayPlan(
    { variables: { arr: { name: 'arr', kind: 'sequence' } } },
    { id: 'assign-swap-frame', events: [assign, swap] },
    [
      { event: assign, animation: 'assign', effectStart: 0, start: 0, end: 700 },
      { event: swap, animation: 'swap', start: 700, end: 1200 }
    ], 1
  );
  const byVisual = new Map(plan.visualValueTracks.map(track => [track.key, track]));
  assert.equal(byVisual.get('arr#1').initial.value, 5,
    'the node ending in cell 1 starts by carrying the old cell-0 value');
  assert.equal(byVisual.get('arr#1').steps.at(-1).after.value, 3,
    'the earlier assignment updates the same value-carrying node');
  assert.equal(byVisual.get('arr#0').initial.value, 7);
  assert.equal(byVisual.get('arr#0').steps.length, 0,
    'swap motion never flips text on the node that carries 7');
  assert.equal(plan.checkpoints[1].mutations[0].visualKey, 'arr#1');
  assert.equal(plan.checkpoints[1].mutations[1].visualKey, 'arr#0');
});

test('a declaration initializer stays blank until its paired assignment commits', () => {
  const target = {
    role: 'target', variableId: 'key', lifetimeIdentity: 'life-key', indexExpression: ''
  };
  const declaration = {
    id: 'declare-key', order: 1, type: 'declare', lifetimeIdentity: 'life-key',
    targets: [target], payload: { value: { kind: 'scalar', value: 9 } }
  };
  const assignment = {
    id: 'assign-key', order: 2, type: 'assign', targets: [target],
    payload: { before: null, after: { kind: 'scalar', value: 9 } }
  };
  const plan = context.window.ASMTraceFrameTween.createForwardReplayPlan(
    { variables: { key: { name: 'key', kind: 'scalar' } } },
    { id: 'key-frame', events: [declaration, assignment] },
    [
      { event: declaration, animation: 'declare', start: 0, end: 220 },
      { event: assignment, animation: 'assign', effectStart: 220, start: 220, end: 980 }
    ], 1
  );
  const track = plan.visualValueTracks.find(item => item.key === 'key#0');
  assert.equal(track.initial, null);
  assert.equal(track.steps[0].after, null,
    'the declaration controls presence only when a paired initializer assignment exists');
  assert.equal(track.steps[1].after.value, 9);
  assert.equal(track.steps[1].commitMs, 880);
});

test('a newly declared marker starts in the unresolved group before assignment motion', () => {
  const tweenSource = fs.readFileSync(path.join(__dirname, '../public/trace-frame-tween.js'), 'utf8')
    .replace('window.ASMTraceFrameTween = {',
      'window.ASMTraceFrameTween = { markerAssignmentMotion,');
  const motionContext = vm.createContext({
    window: {}, document: { documentElement: { dataset: {} } },
    requestAnimationFrame() {}, cancelAnimationFrame() {}, performance: { now: () => 0 },
    queueMicrotask() {}
  });
  motionContext.window.ASMTraceRules = {
    resolveExpression: (doc, frame, expression, locals) => Number(locals.j)
  };
  vm.runInContext(tweenSource, motionContext);
  const marker = {
    dataset: {
      traceBindingTarget: 'arr#2', traceSourceVariableId: 'j',
      traceSourceVariableIds: JSON.stringify(['j']), traceMarkerIndexExpression: 'j',
      traceMarkerSortKey: 'j', traceMarkerBaseCellWidth: '40'
    },
    getAttribute: name => name === 'transform' ? 'translate(100,80)' : null
  };
  const assignment = {
    id: 'assign-j', order: 2, type: 'assign',
    targets: [{ role: 'target', variableId: 'j' }],
    payload: { before: null, after: { kind: 'scalar', value: 2 } }
  };
  const placements = new Map([
    ['arr#0', { x: 0, y: 80, width: 40, height: 40 }],
    ['arr#1', { x: 40, y: 80, width: 40, height: 40 }],
    ['arr#2', { x: 80, y: 80, width: 40, height: 40 }]
  ]);
  const motion = motionContext.window.ASMTraceFrameTween.markerAssignmentMotion(
    { variables: { j: { name: 'j' } } },
    { events: [assignment] },
    [{ event: assignment, animation: 'assign', start: 300, motionStart: 300, end: 800 }],
    placements, new Map([['marker-j', marker]]), [{
      key: 'marker-j', element: marker, previousVisual: null,
      markerPointPath: {}, markerLabelBox: { getAttribute: () => '18' }
    }]
  );
  motion.update(0);
  assert.ok(motion.arrowStates.get('marker-j').x < 0,
    'before j has a value, its label is parked to the left of the leftmost cell');
  motion.update(550);
  assert.ok(motion.arrowStates.get('marker-j').x > -17
    && motion.arrowStates.get('marker-j').x < 100,
  'the marker moves from the unresolved group only when its assignment runs');
});

test('pre-keep exits remove matching marker lifetimes from the retained snapshot', () => {
  const tweenSource = fs.readFileSync(path.join(__dirname, '../public/trace-frame-tween.js'), 'utf8')
    .replace('window.ASMTraceFrameTween = {',
      'window.ASMTraceFrameTween = { hidePreKeepExitVisualsInSnapshots,');
  const exitContext = vm.createContext({
    window: {}, document: { documentElement: { dataset: {} } },
    requestAnimationFrame() {}, cancelAnimationFrame() {}, performance: { now: () => 0 },
    queueMicrotask() {}
  });
  vm.runInContext(tweenSource, exitContext);
  const attributes = new Map();
  const marker = {
    dataset: {
      traceSourceVariableId: 'min',
      traceSourceVariableIds: JSON.stringify(['min']),
      traceRuntimeIdentity: 'life-min',
      traceSceneGeneration: '0'
    },
    setAttribute(name, value) { attributes.set(name, value); }
  };
  const root = { querySelectorAll: () => [marker] };
  exitContext.window.ASMTraceFrameTween.hidePreKeepExitVisualsInSnapshots(root, {
    events: [{
      id: 'exit-min', order: 1, type: 'visual-exit', preKeepExit: true,
      targets: [{ variableId: 'min', lifetimeIdentity: 'life-min', sceneGeneration: 0 }]
    }]
  });
  assert.equal(attributes.get('display'), 'none',
    'the retained copy cannot remain visible behind the old lifetime exit ghost');
});

test('a scope exit already represented by the current marker does not need a previous ghost', () => {
  const tweenSource = fs.readFileSync(path.join(__dirname, '../public/trace-frame-tween.js'), 'utf8')
    .replace('window.ASMTraceFrameTween = {',
      'window.ASMTraceFrameTween = { hasCurrentScopeExitVisual,');
  const exitContext = vm.createContext({
    window: {}, document: { documentElement: { dataset: {} } },
    requestAnimationFrame() {}, cancelAnimationFrame() {}, performance: { now: () => 0 },
    queueMicrotask() {}
  });
  vm.runInContext(tweenSource, exitContext);
  const marker = (lifetimeIdentity, connected = true) => ({
    isConnected: connected,
    dataset: {
      traceSourceVariableId: 'main:j',
      traceSourceVariableIds: JSON.stringify(['main:j']),
      traceRuntimeIdentity: lifetimeIdentity,
      traceSceneGeneration: '0'
    },
    closest: () => null,
    querySelectorAll: () => []
  });
  const target = {
    variableId: 'main:j', lifetimeIdentity: 'lifetime-final-inner-loop', sceneGeneration: 0
  };
  const hasCurrent = exitContext.window.ASMTraceFrameTween.hasCurrentScopeExitVisual;
  assert.equal(hasCurrent(target, new Map([
    ['marker-j', marker('lifetime-final-inner-loop')]
  ])), true, 'the current marker must own its own exit animation');
  assert.equal(hasCurrent(target, new Map([
    ['marker-j', marker('lifetime-next-loop')]
  ])), false, 'a redeclared marker with a new lifetime must not absorb the old exit');
  assert.equal(hasCurrent(target, new Map([
    ['marker-j', marker('lifetime-final-inner-loop', false)]
  ])), false, 'a detached current element cannot replace the previous exit ghost');
});

test('a marker target one cell beyond the visible array remains renderable by extrapolation', () => {
  const tweenSource = fs.readFileSync(path.join(__dirname, '../public/trace-frame-tween.js'), 'utf8')
    .replace('window.ASMTraceFrameTween = {',
      'window.ASMTraceFrameTween = { markerTargetIsRenderable,');
  const markerContext = vm.createContext({
    window: {}, document: { documentElement: { dataset: {} } },
    requestAnimationFrame() {}, cancelAnimationFrame() {}, performance: { now: () => 0 }
  });
  vm.runInContext(tweenSource, markerContext);
  const placements = new Map([
    ['arr#4', { x: 160, y: 100, width: 40, height: 40 }],
    ['arr#5', { x: 200, y: 100, width: 40, height: 40 }]
  ]);
  assert.equal(markerContext.window.ASMTraceFrameTween.markerTargetIsRenderable('arr#6', placements), true);
  assert.equal(markerContext.window.ASMTraceFrameTween.markerTargetIsRenderable('missing#6', placements), false);
});

test('assignment retains the parked arrow until motion starts, then reaches the real cell', () => {
  const tweenSource = fs.readFileSync(path.join(__dirname, '../public/trace-frame-tween.js'), 'utf8')
    .replace('window.ASMTraceFrameTween = {', 'window.ASMTraceFrameTween = { markerAssignmentMotion,');
  context.window.ASMTraceRules = { resolveExpression: (doc, frame, expr, locals) => Number(locals.i) };
  vm.runInContext(tweenSource, context);
  const element = {
    dataset: { traceBindingTarget: 'arr#2', traceSourceVariableId: 'i', traceMarkerIndexExpression: 'i' },
    getAttribute: name => name === 'transform' ? 'translate(180,120)' : null
  };
  const previousVisual = {
    dataset: { traceMarkerUnresolved: '1', traceMarkerTargetX: '63', traceMarkerTargetY: '60' },
    getAttribute: name => name === 'transform' ? 'translate(63,40)' : null
  };
  const entry = { key: 'marker', element, previousVisual, markerPointPath: {},
    markerLabelBox: { getAttribute: () => '18' } };
  const placements = new Map([['arr#2', { x: 160, y: 120, width: 40, height: 40 }]]);
  const event = { type: 'assign', targets: [{ variableId: 'i', role: 'target' }],
    payload: { before: 0.5, after: 2 } };
  const motion = context.window.ASMTraceFrameTween.markerAssignmentMotion(
    { variables: { i: { name: 'i' } } }, {},
    [{ animation: 'assign', event, start: 0, motionStart: 100, end: 200 }],
    placements, new Map([['marker', element]]), [entry]);
  motion.update(99);
  assert.deepEqual({ ...motion.arrowStates.get('marker') }, { x: 63, y: 40, targetX: 63, targetY: 60 });
  motion.update(150);
  assert.ok(motion.arrowStates.get('marker').x > 63);
  assert.ok(motion.arrowStates.get('marker').x < 180);
  motion.update(200);
  assert.deepEqual({ ...motion.arrowStates.get('marker') }, { x: 180, y: 120, targetX: 180, targetY: 140 });
  motion.finish();
  assert.equal(motion.adjustments.size, 0);
});

test('same-cell marker reflow starts with the overlapping entrance, then frame events start', () => {
  const tweenSource = fs.readFileSync(path.join(__dirname, '../public/trace-frame-tween.js'), 'utf8')
    .replace('window.ASMTraceFrameTween = {',
      'window.ASMTraceFrameTween = { markerGroupReflowDuration, markerFrameMotionDelay,');
  vm.runInContext(tweenSource, context);
  const existingPrevious = {
    dataset: {
      traceBindingTarget: 'arr#0',
      traceVisualContinuityKey: 'auto-marker:i'
    }
  };
  const existingCurrent = {
    dataset: {
      traceSourceVariableId: 'i',
      traceBindingTarget: 'arr#0',
      traceVisualContinuityKey: 'auto-marker:i'
    }
  };
  const enteringCurrent = {
    dataset: {
      traceSourceVariableId: 'j',
      traceBindingTarget: 'arr#0',
      traceVisualContinuityKey: 'auto-marker:j'
    }
  };
  const reflowKeys = new Set();
  const settleDuration = context.window.ASMTraceFrameTween.markerGroupReflowDuration({
    enteringMarkerKeys: new Set(['marker-j']),
    currentElements: new Map([
      ['marker-i', existingCurrent],
      ['marker-j', enteringCurrent]
    ]),
    previousPlacements: new Map([['marker-i', { x: 120, y: 80 }]]),
    currentPlacements: new Map([
      ['marker-i', { x: 107, y: 80 }],
      ['marker-j', { x: 133, y: 80 }]
    ]),
    previousObjects: new Map([['marker-i', existingPrevious]]),
    transitionForKey: () => ({ mode: 'move', duration: 520 }),
    duration: 520,
    eventControlledKeys: new Set(['marker-i']),
    reflowKeys
  });
  assert.equal(settleDuration, 180,
    'the compare/lift timeline must wait until i and the entering j marker are settled');
  assert.deepEqual([...reflowKeys], ['marker-i'],
    'a later event must not delay the same-cell reflow that makes room for j');
  assert.equal(
    context.window.ASMTraceFrameTween.markerFrameMotionDelay(
      'marker-i', 0, 700, reflowKeys
    ),
    0,
    'the existing marker starts making room before entrance'
  );
  assert.equal(
    context.window.ASMTraceFrameTween.markerFrameMotionDelay(
      'marker-other', 0, 700, reflowKeys
    ),
    700,
    'markers outside the entering group retain their event timing'
  );

  context.window.ASMTraceRules = {
    resolveExpression: (doc, frame, expression, locals) => Number(locals[expression])
  };
  const movingCurrent = {
    dataset: {
      traceSourceVariableId: 'i',
      traceBindingTarget: 'arr#1',
      traceVisualContinuityKey: 'auto-marker:i',
      traceMarkerIndexExpression: 'i'
    }
  };
  const movingReflowKeys = new Set();
  const increment = {
    type: 'assign',
    order: 1,
    targets: [{ variableId: 'i', role: 'target' }],
    payload: { before: 0, after: 1 }
  };
  assert.equal(context.window.ASMTraceFrameTween.markerGroupReflowDuration({
    enteringMarkerKeys: new Set(['marker-j']),
    currentElements: new Map([
      ['marker-i', movingCurrent],
      ['marker-j', enteringCurrent]
    ]),
    previousPlacements: new Map([['marker-i', { x: 120, y: 80 }]]),
    currentPlacements: new Map([
      ['marker-i', { x: 160, y: 80 }],
      ['marker-j', { x: 120, y: 80 }]
    ]),
    previousObjects: new Map([['marker-i', existingPrevious]]),
    transitionForKey: () => ({ mode: 'move', duration: 520 }),
    duration: 520,
    traceDocument: { variables: { i: { name: 'i' } } },
    eventFrame: { events: [increment] },
    reflowKeys: movingReflowKeys
  }), 180, 'i still makes room at arr[0] before its later i++ movement');
  assert.deepEqual([...movingReflowKeys], ['marker-i']);

  const noEntranceReflowKeys = new Set();
  assert.equal(context.window.ASMTraceFrameTween.markerGroupReflowDuration({
    enteringMarkerKeys: new Set(),
    currentElements: new Map([['marker-i', existingCurrent]]),
    previousPlacements: new Map([['marker-i', { x: 120, y: 80 }]]),
    currentPlacements: new Map([['marker-i', { x: 107, y: 80 }]]),
    previousObjects: new Map([['marker-i', existingPrevious]]),
    transitionForKey: () => ({ mode: 'move', duration: 520 }),
    duration: 520,
    reflowKeys: noEntranceReflowKeys
  }), 0);
  assert.equal(noEntranceReflowKeys.size, 0,
    'without an entering marker there is no automatic make-room phase');

  const reflowStep = {
    id: 'marker-group-reflow', kind: 'object-transition', subtype: 'marker-group-reflow',
    durationMs: settleDuration, blocking: true, enabled: true
  };
  const preEventPlan = context.window.ASMTraceFrameTween.createPlaybackPlan({
    frame: { id: 'quick-third-frame' },
    direction: 1,
    enteringMarkerKeys: ['marker-j'],
    transitionSteps: [reflowStep]
  });
  assert.equal(preEventPlan.phases.find(phase => phase.id === 'frame-transition').startMs, 0);
  assert.equal(preEventPlan.phases.find(phase => phase.id === 'object-entrance').startMs, 0,
    'the incoming marker appears when its peers begin making room');
  assert.equal(preEventPlan.preEventDurationMs, 220,
    'the simultaneous 180 ms reflow and 220 ms entrance finish at 220 ms');

  const event = { id: 'compare-after-j-entry', type: 'compare', order: 3 };
  const plan = context.window.ASMTraceFrameTween.createPlaybackPlan({
    frame: { id: 'quick-third-frame' },
    direction: 1,
    enteringMarkerKeys: ['marker-j'],
    transitionSteps: [reflowStep],
    eventTimeline: [{ event, type: 'compare', animation: 'compare', start: 300, end: 700 }]
  });
  assert.equal(plan.phases.find(phase => phase.id === 'trace-events').startMs, 300);
  assert.equal(plan.preEventDurationMs, 300);

  const declaration = {
    id: 'declare-j', type: 'declare', order: 1, enabled: true,
    targets: [{ role: 'target', variableId: 'j' }]
  };
  context.window.ASMTraceEvents = {
    animation: type => type,
    ordered: events => events
  };
  const declarationFrame = { id: 'declare-j-frame', events: [declaration], state: {} };
  const declarationTimeline = context.window.ASMTraceFrameTween.buildEventTimeline(
    {
      variables: { i: { name: 'i' }, j: { name: 'j' } },
      studio: { eventSettings: { gapMs: 50 } }
    },
    declarationFrame, 1, 520,
    new Map([['marker-i', { x: 120, y: 80 }]]),
    new Map([
      ['marker-i', { x: 107, y: 80 }],
      ['marker-j', { x: 133, y: 80 }]
    ]),
    new Map([
      ['marker-i', existingCurrent],
      ['marker-j', enteringCurrent]
    ]),
    0,
    new Map([['marker-i', existingPrevious]])
  );
  assert.equal(declarationTimeline[0].declarationEntranceDelay, 80);
  assert.deepEqual(
    { start: declarationTimeline[0].start, end: declarationTimeline[0].end },
    { start: 0, end: 300 },
    'a declaration-owned marker also waits for the make-room head start'
  );
});

test('a caller marker waits for the outgoing same-cell marker to move and exit', () => {
  const marker = (variableId, lifetimeIdentity) => ({
    dataset: {
      traceSourceVariableId: variableId,
      traceSourceVariableIds: JSON.stringify([variableId]),
      traceRuntimeIdentity: lifetimeIdentity,
      traceBindingTarget: 'heap#5',
      traceMarkerIndexExpression: '5'
    },
    querySelectorAll: () => []
  });
  const entering = marker('main:i', 'life-i');
  const outgoing = marker('move_down:now', 'life-now');
  const assignment = {
    id: 'move-now', type: 'assign', order: 10,
    targets: [{ role: 'target', variableId: 'move_down:now' }]
  };
  const exit = {
    id: 'exit-now', type: 'scope-exit', order: 13,
    targets: [{ role: 'target', variableId: 'move_down:now', lifetimeIdentity: 'life-now' }]
  };
  const frame = { id: 'return-to-caller', events: [assignment, exit], state: {} };
  const timeline = [
    { event: assignment, animation: 'assign', promptStart: 0, visualStart: 0,
      start: 0, duration: 520, end: 520 },
    { event: exit, animation: 'exit', promptStart: 520, visualStart: 520,
      start: 520, duration: 220, end: 740 }
  ];
  const barriers = context.window.ASMTraceFrameTween.deferredMarkerEntranceBarriers({
    enteringMarkerKeys: new Set(['marker-i']),
    traceDocument: { variables: { 'main:i': { name: 'i' } } },
    eventFrame: frame,
    eventTimeline: timeline,
    currentElements: new Map([['marker-i', entering]]),
    previousObjects: new Map([['marker-now', outgoing]])
  });
  assert.equal(barriers.get('marker-i'), 740,
    'the caller marker waits until the outgoing parameter finishes its exit');

  const plan = context.window.ASMTraceFrameTween.createPlaybackPlan({
    frame,
    direction: 1,
    enteringMarkerKeys: [],
    deferredMarkerEntranceKeys: ['marker-i'],
    deferredMarkerEntranceStartMs: barriers.get('marker-i'),
    eventTimeline: timeline
  });
  const events = plan.phases.find(phase => phase.id === 'trace-events');
  const entrance = plan.phases.find(phase => phase.id === 'deferred-object-entrance');
  assert.equal(events.startMs, 0);
  assert.equal(entrance.startMs, 740);
  assert.equal(entrance.steps[0].targetKey, 'marker-i');
  assert.equal(plan.totalDurationMs, 960);
});

test('marker event motion preserves same-cell reflow and a peer entrance', () => {
  const tweenSource = fs.readFileSync(path.join(__dirname, '../public/trace-frame-tween.js'), 'utf8')
    .replace('window.ASMTraceFrameTween = {',
      'window.ASMTraceFrameTween = { markerAssignmentMotion,');
  vm.runInContext(tweenSource, context);
  const marker = (variableId, transform) => ({
    dataset: {
      traceBindingTarget: 'arr#0',
      traceSourceVariableId: variableId,
      traceMarkerIndexExpression: variableId,
      traceMarkerSortKey: variableId,
      traceMarkerBaseCellWidth: '40'
    },
    getAttribute: name => name === 'transform' ? transform : null
  });
  const currentI = marker('i', 'translate(15,8)');
  const previousI = marker('i', 'translate(28,8)');
  const currentJ = marker('j', 'translate(41,8)');
  const entry = (key, element, previousVisual = null) => ({
    key,
    element,
    previousVisual,
    markerPointPath: {},
    markerLabelBox: { getAttribute: name => name === 'width' ? '18' : null }
  });
  const motion = context.window.ASMTraceFrameTween.markerAssignmentMotion(
    { variables: {} },
    { events: [] },
    [],
    new Map([['arr#0', { x: 0, y: 8, width: 56, height: 40 }]]),
    new Map([['marker-i', currentI], ['marker-j', currentJ]]),
    [entry('marker-i', currentI, previousI), entry('marker-j', currentJ)],
    { keys: new Set(['marker-i']), duration: 520 }
  );

  motion.update(0);
  assert.equal(motion.adjustments.get('marker-i').x, 13,
    'i starts from its previous centered position');
  assert.equal(motion.adjustments.has('marker-j'), false,
    'j remains controlled by the entrance animation instead of an absolute event position');
  motion.update(260);
  assert.ok(motion.adjustments.get('marker-i').x > 0
    && motion.adjustments.get('marker-i').x < 13,
  'i moves aside while j enters');
  motion.update(520);
  assert.equal(motion.adjustments.get('marker-i').x, 0,
    'i reaches its allocated side before frame events');
});

test('a marker exit and its same-cell peer close-gap motion start together', () => {
  const oldMarker = (variableId, lifetime, x) => ({
    dataset: {
      traceBindingTarget: 'arr#0',
      traceSourceVariableId: variableId,
      traceRuntimeIdentity: lifetime,
      traceMarkerSortKey: variableId
    },
    closest: () => null,
    querySelector: selector => selector === '.trace-variable-marker-label-box'
      ? { getAttribute: name => name === 'width' ? '18' : null }
      : null,
    querySelectorAll: () => [],
    getAttribute: name => name === 'transform' ? `translate(${x},8)` : null
  });
  const currentI = oldMarker('i', 'life-i', 20);
  const previousI = oldMarker('i', 'life-i', 7);
  const previousJ = oldMarker('j', 'life-j', 20);
  const exit = {
    id: 'exit-j', type: 'scope-exit',
    targets: [{ variableId: 'j', lifetimeIdentity: 'life-j' }]
  };
  const schedule = context.window.ASMTraceFrameTween.exitMarkerReflowSchedule({
    eventTimeline: [{
      event: exit, animation: 'exit', markerExit: true,
      start: 0, visualStart: 0, exitDuration: 220, reflowStart: 0, end: 220
    }],
    currentElements: new Map([['marker-i', currentI]]),
    previousPlacements: new Map([['marker-i', { x: 7, y: 8 }]]),
    currentPlacements: new Map([
      ['arr#0', { x: 0, y: 8, width: 40, height: 40 }],
      ['marker-i', { x: 20, y: 8 }]
    ]),
    previousObjects: new Map([
      ['marker-i', previousI], ['marker-j', previousJ]
    ])
  });
  assert.deepEqual(JSON.parse(JSON.stringify(schedule.get('marker-i'))), {
    start: 0, duration: 220, eventId: 'exit-j', target: 'arr#0',
    holdOffsetX: -13, ghostOffsetX: 13, arrivalStart: 0, arrivalEnd: 0
  }, 'the peer keeps the two-marker offset until the exit starts');

  const tweenSource = fs.readFileSync(path.join(__dirname, '../public/trace-frame-tween.js'), 'utf8')
    .replace('window.ASMTraceFrameTween = {',
      'window.ASMTraceFrameTween = { markerAssignmentMotion,');
  const motionContext = vm.createContext({
    window: { ASMTraceRules: { resolveExpression: () => null } },
    document: { documentElement: { dataset: {} } },
    requestAnimationFrame() {}, cancelAnimationFrame() {}, performance: { now: () => 0 },
    queueMicrotask() {}
  });
  vm.runInContext(tweenSource, motionContext);
  const motionMarker = (variableId, lifetime, x) => ({
    dataset: {
      traceBindingTarget: 'arr#0', traceSourceVariableId: variableId,
      traceSourceVariableIds: JSON.stringify([variableId]),
      traceRuntimeIdentity: lifetime, traceMarkerIndexExpression: variableId,
      traceMarkerSortKey: variableId, traceMarkerBaseCellWidth: '40'
    },
    getAttribute: name => name === 'transform' ? `translate(${x},8)` : null
  });
  const liveI = motionMarker('i', 'life-i', 20);
  const oldI = motionMarker('i', 'life-i', 33);
  const motion = motionContext.window.ASMTraceFrameTween.markerAssignmentMotion(
    { variables: { i: { name: 'i' } } }, { events: [] }, [],
    new Map([['arr#0', { x: 0, y: 8, width: 40, height: 40 }]]),
    new Map([['marker-i', liveI]]),
    [{
      key: 'marker-i', element: liveI, previousVisual: oldI,
      markerPointPath: {},
      markerLabelBox: { getAttribute: name => ({ width: '18', y: '-40', height: '18' })[name] }
    }],
    { keys: new Set(), duration: 0, exitReflows: schedule }
  );
  motion.update(0);
  assert.equal(motion.arrowStates.get('marker-i').x, 7);
  assert.equal(motion.arrowStates.get('marker-i').targetX, 20,
    'the waiting peer stays offset while its arrow points to the cell centre');
  motion.update(110);
  assert.ok(motion.arrowStates.get('marker-i').x > 7
    && motion.arrowStates.get('marker-i').x < 20,
  'the label and arrow close the gap while the old marker exits');
  motion.update(220);
  assert.equal(motion.arrowStates.get('marker-i').x, 20);
  assert.equal(motion.arrowStates.get('marker-i').targetX, 20);
});

test('a new marker lifetime does not make room for the preceding lifetime exit', () => {
  const marker = (lifetime, target, x) => ({
    dataset: {
      traceBindingTarget: target,
      traceSourceVariableId: 'now',
      traceRuntimeIdentity: lifetime,
      traceVisualContinuityKey: 'heap-push:now',
      traceMarkerSortKey: 'now'
    },
    closest: () => null,
    querySelector: selector => selector === '.trace-variable-marker-label-box'
      ? { getAttribute: name => name === 'width' ? '18' : null }
      : null,
    querySelectorAll: () => [],
    getAttribute: name => name === 'transform' ? `translate(${x},8)` : null
  });
  const current = marker('now@new', 'heap#2', 60);
  const previous = marker('now@old', 'heap#1', 20);
  const exit = {
    id: 'exit-old-now', type: 'scope-exit',
    targets: [{ variableId: 'now', lifetimeIdentity: 'now@old' }]
  };
  const schedule = context.window.ASMTraceFrameTween.exitMarkerReflowSchedule({
    eventTimeline: [{
      event: exit, animation: 'exit', markerExit: true,
      start: 100, visualStart: 100, exitDuration: 220, reflowStart: 100, end: 320
    }],
    currentElements: new Map([['marker-now', current]]),
    currentPlacements: new Map([
      ['heap#1', { x: 20, y: 8, width: 40, height: 40 }],
      ['heap#2', { x: 60, y: 48, width: 40, height: 40 }],
      ['marker-now', { x: 60, y: 48 }]
    ]),
    previousObjects: new Map([['marker-now', previous]])
  });
  assert.equal(schedule.size, 0);
});

test('an exiting heap marker assignment uses the full parent node displacement', () => {
  context.window.ASMTraceRules = {
    resolveExpression: (document, frame, expression, locals) => locals[expression]
  };
  const visual = {
    dataset: {
      traceBindingTarget: 'heap#2',
      traceSourceVariableId: 'now',
      traceRuntimeIdentity: 'now@old',
      traceMarkerIndexExpression: 'now'
    }
  };
  const assignment = {
    id: 'assign-now-parent', type: 'assign', order: 10,
    payload: { before: 2, after: 1 },
    targets: [{ variableId: 'now', lifetimeIdentity: 'now@old', role: 'target' }]
  };
  const slot = { event: assignment, animation: 'assign', start: 100, motionStart: 220, end: 520 };
  const exitSlot = { event: {}, animation: 'exit', start: 600 };
  const schedule = context.window.ASMTraceFrameTween.previousMarkerAssignmentSchedule({
    traceDocument: { variables: { now: { name: 'now' } } },
    eventFrame: { events: [assignment] },
    eventTimeline: [slot, exitSlot],
    visual,
    placements: new Map([
      ['heap#1', { x: 100, y: 40, width: 40, height: 40 }],
      ['heap#2', { x: 60, y: 120, width: 40, height: 40 }]
    ]),
    exitSlot
  });
  assert.deepEqual(JSON.parse(JSON.stringify(schedule)), [{
    start: 220, end: 520,
    from: { x: 0, y: 0 }, to: { x: 40, y: -80 },
    fromTarget: 'heap#2', toTarget: 'heap#1'
  }]);
  assert.deepEqual(JSON.parse(JSON.stringify(
    context.window.ASMTraceFrameTween.previousMarkerAssignmentOffset(schedule, 520)
  )), { x: 40, y: -80 });
});

test('an exiting marker makes room for a marker that remains on its destination cell', () => {
  const visual = (name, target) => ({
    dataset: {
      traceBindingTarget: target,
      traceSourceVariableId: name,
      traceMarkerSortKey: name
    },
    querySelector: selector => selector === '.trace-variable-marker-label-box'
      ? { getAttribute: attribute => attribute === 'width' ? '18' : null }
      : null
  });
  const mover = {
    visual: visual('now', 'heap#2'),
    scopeExitSlot: { start: 800 },
    assignmentSchedule: [{
      start: 200, end: 500,
      from: { x: 0, y: 0 }, to: { x: 40, y: -80 },
      fromTarget: 'heap#2', toTarget: 'heap#1'
    }]
  };
  const parent = {
    visual: visual('parent', 'heap#1'),
    scopeExitSlot: { start: 800 },
    assignmentSchedule: []
  };
  context.window.ASMTraceFrameTween.applyPreviousMarkerAssignmentReflows([mover, parent]);
  assert.equal(mover.assignmentSchedule[0].to.x, 27,
    'the arriving marker lands on its allocated side of the shared cell');
  assert.deepEqual(JSON.parse(JSON.stringify(parent.assignmentPeerSchedule)), [{
    start: 200, end: 500,
    from: { x: 0, y: 0 }, to: { x: 13, y: 0 }
  }], 'the existing marker makes room while the arriving marker moves');
});

test('same-cell reflow finishes before a later i++ marker movement', () => {
  const tweenSource = fs.readFileSync(path.join(__dirname, '../public/trace-frame-tween.js'), 'utf8')
    .replace('window.ASMTraceFrameTween = {',
      'window.ASMTraceFrameTween = { markerAssignmentMotion,');
  vm.runInContext(tweenSource, context);
  context.window.ASMTraceRules = {
    resolveExpression: (doc, frame, expression, locals) => Number(locals[expression])
  };
  const marker = (variableId, target, transform) => ({
    dataset: {
      traceBindingTarget: target,
      traceSourceVariableId: variableId,
      traceMarkerIndexExpression: variableId,
      traceMarkerSortKey: variableId,
      traceMarkerBaseCellWidth: '40'
    },
    getAttribute: name => name === 'transform' ? transform : null
  });
  const currentI = marker('i', 'arr#1', 'translate(60,8)');
  const previousI = marker('i', 'arr#0', 'translate(20,8)');
  const currentJ = marker('j', 'arr#0', 'translate(20,8)');
  const entry = (key, element, previousVisual = null) => ({
    key,
    element,
    previousVisual,
    markerPointPath: {},
    markerLabelBox: { getAttribute: name => name === 'width' ? '18' : null }
  });
  const increment = {
    type: 'assign',
    order: 1,
    targets: [{ variableId: 'i', role: 'target' }],
    payload: { before: 0, after: 1 }
  };
  const motion = context.window.ASMTraceFrameTween.markerAssignmentMotion(
    { variables: { i: { name: 'i' }, j: { name: 'j' } } },
    { events: [increment] },
    [{ event: increment, animation: 'assign', start: 520, motionStart: 520, end: 1040 }],
    new Map([
      ['arr#0', { x: 0, y: 8, width: 40, height: 40 }],
      ['arr#1', { x: 40, y: 8, width: 40, height: 40 }]
    ]),
    new Map([['marker-i', currentI], ['marker-j', currentJ]]),
    [entry('marker-i', currentI, previousI), entry('marker-j', currentJ)],
    { keys: new Set(['marker-i']), duration: 520 }
  );
  const liveX = key => ({
    'marker-i': 60,
    'marker-j': 20
  })[key] + motion.adjustments.get(key).x;

  motion.update(0);
  assert.equal(liveX('marker-i'), 20);
  assert.equal(liveX('marker-j'), 33);
  motion.update(260);
  assert.ok(liveX('marker-i') < 20 && liveX('marker-i') > 7,
    'i first moves aside inside arr[0]');
  motion.update(520);
  assert.equal(liveX('marker-i'), 7);
  assert.equal(liveX('marker-j'), 33);
  motion.update(780);
  assert.ok(liveX('marker-i') > 7 && liveX('marker-i') < 60,
    'only after reflow does i++ move i toward arr[1]');
  assert.equal(liveX('marker-j'), 20,
    'the source peer starts immediately and finishes the shared reflow timing');
});

test('destination peers make room as soon as an arriving marker starts moving', () => {
  const tweenSource = fs.readFileSync(path.join(__dirname, '../public/trace-frame-tween.js'), 'utf8')
    .replace('window.ASMTraceFrameTween = {',
      'window.ASMTraceFrameTween = { markerAssignmentMotion,');
  vm.runInContext(tweenSource, context);
  context.window.ASMTraceRules = {
    resolveExpression: (doc, frame, expression, locals) => Number(locals[expression])
  };
  const marker = (variableId, target, transform, order) => ({
    dataset: {
      traceBindingTarget: target,
      traceSourceVariableId: variableId,
      traceMarkerIndexExpression: variableId,
      traceMarkerSortKey: variableId,
      traceMarkerSortOrder: String(order),
      traceMarkerBaseCellWidth: '40'
    },
    getAttribute: name => name === 'transform' ? transform : null
  });
  const currentI = marker('i', 'arr#1', 'translate(47,8)', 0);
  const previousI = marker('i', 'arr#0', 'translate(20,8)', 0);
  const currentJ = marker('j', 'arr#1', 'translate(73,8)', 1);
  const previousJ = marker('j', 'arr#1', 'translate(60,8)', 1);
  const entry = (key, element, previousVisual) => ({
    key, element, previousVisual, markerPointPath: {},
    markerLabelBox: { getAttribute: name => name === 'width' ? '18' : null }
  });
  const assignment = {
    type: 'assign', order: 1,
    targets: [{ variableId: 'i', role: 'target' }],
    payload: { before: 0, after: 1 }
  };
  const motion = context.window.ASMTraceFrameTween.markerAssignmentMotion(
    { variables: { i: { name: 'i' }, j: { name: 'j' } } },
    { events: [assignment] },
    [{ event: assignment, animation: 'assign', start: 0, motionStart: 0, end: 520 }],
    new Map([
      ['arr#0', { x: 0, y: 8, width: 40, height: 40 }],
      ['arr#1', { x: 40, y: 8, width: 40, height: 40 }]
    ]),
    new Map([['marker-i', currentI], ['marker-j', currentJ]]),
    [entry('marker-i', currentI, previousI), entry('marker-j', currentJ, previousJ)]
  );
  const liveJ = () => 73 + motion.adjustments.get('marker-j').x;
  motion.update(0);
  const startingArrow = motion.arrowStates.get('marker-i');
  assert.equal(startingArrow.targetX - startingArrow.x, 0,
    'the moving marker retains its source arrow direction at departure');
  motion.update(150);
  const turningArrow = motion.arrowStates.get('marker-i');
  assert.ok(turningArrow.targetX - turningArrow.x > 0
    && turningArrow.targetX - turningArrow.x < 13,
  'the moving marker turns continuously toward its destination direction');
  assert.ok(liveJ() > 60 && liveJ() < 73,
    'destination peer starts making room with the arriving marker');
  motion.update(520);
  assert.equal(liveJ(), 73, 'destination peer finishes reflow when the marker arrives');
});

test('a moving declaration continuation uses the standard cross-cell duration', () => {
  const source = fs.readFileSync(path.join(__dirname, '../public/trace-frame-tween.js'), 'utf8')
    .replace('window.ASMTraceFrameTween = {',
      'window.ASMTraceFrameTween = { markerAssignmentMotion,');
  const c = vm.createContext({
    window: {
      ASMTraceRules: { resolveExpression: (doc, frame, expression, locals) => (
        Number(locals[expression])
      ) },
      ASMTraceEvents: {
        animation: type => type === 'declare' ? 'declare' : 'none',
        ordered: events => [...events].sort((left, right) => left.order - right.order)
      }
    },
    document: { documentElement: { dataset: {} } },
    requestAnimationFrame() {}, cancelAnimationFrame() {}, performance: { now: () => 0 },
    CustomEvent: class CustomEvent {}, queueMicrotask() {}
  });
  vm.runInContext(source, c);
  const tween = c.window.ASMTraceFrameTween;
  const visual = (identity, target, x) => ({
    dataset: {
      traceObjectKey: 'marker-i',
      traceBindingTarget: target,
      traceSourceVariableId: 'i',
      traceMarkerIndexExpression: 'i',
      traceMarkerSortKey: 'i',
      traceMarkerBaseCellWidth: '40',
      traceRuntimeIdentity: identity,
      traceVisualContinuityKey: 'heapify:i:arr'
    },
    getAttribute: name => name === 'transform' ? `translate(${x},8)` : null
  });
  const previous = visual('parent-i', 'arr#0', 20);
  const current = visual('child-i', 'arr#1', 60);
  const declaration = {
    id: 'declare-child-i', type: 'declare', order: 1, name: 'i',
    targets: [{ variableId: 'i', role: 'target' }]
  };
  const previousPlacements = new Map([['marker-i', { x: 20, y: 8 }]]);
  const currentPlacements = new Map([
    ['marker-i', { x: 60, y: 8 }],
    ['arr#0', { x: 0, y: 8, width: 40, height: 40 }],
    ['arr#1', { x: 40, y: 8, width: 40, height: 40 }]
  ]);
  const elements = new Map([['marker-i', current]]);
  const slots = tween.buildEventTimeline(
    { variables: { i: { name: 'i' } } },
    { events: [declaration] }, 1, 520,
    previousPlacements, currentPlacements, elements, 0,
    new Map([['marker-i', previous]]), null,
    { continuingKeys: new Set(['marker-i']), skipAvailability: true }
  );
  assert.equal(slots[0].duration, 520);
  assert.equal(slots[0].declarationMarkerMotionDuration, 520);
  slots[0].continuingVisualKeys = new Set(['marker-i']);

  const motion = tween.markerAssignmentMotion(
    { variables: { i: { name: 'i' } } },
    { events: [declaration] }, slots, currentPlacements, elements,
    [{
      key: 'marker-i', element: current, previousVisual: previous,
      markerPointPath: {}, markerLabelBox: { getAttribute: () => '18' }
    }]
  );
  const liveX = () => 60 + motion.adjustments.get('marker-i').x;
  motion.update(180);
  assert.ok(liveX() > 20 && liveX() < 60,
    'the declaration continuation is still moving after the old 180ms duration');
  motion.update(520);
  assert.equal(liveX(), 60);

  const stationarySlots = tween.buildEventTimeline(
    { variables: { i: { name: 'i' } } },
    { events: [declaration] }, 1, 520,
    new Map([['marker-i', { x: 60, y: 8 }]]), currentPlacements, elements, 0,
    new Map([['marker-i', visual('parent-i', 'arr#1', 60)]]), null,
    { continuingKeys: new Set(['marker-i']), skipAvailability: true }
  );
  assert.equal(stationarySlots[0].duration, 220);
  assert.equal(stationarySlots[0].declarationMarkerMotionDuration, 180);
});

test('a BIT virtual marker target follows BIT geometry instead of linear extrapolation', () => {
  const placements = new Map([
    ['BIT#1', { x: 0, y: 156, width: 40, height: 52 }],
    ['BIT#2', { x: 0, y: 104, width: 80, height: 52 }],
    ['BIT#4', { x: 0, y: 52, width: 160, height: 52 }],
    ['BIT#8', { x: 0, y: 0, width: 320, height: 52 }],
    ['BIT#9', { x: 320, y: 156, width: 40, height: 52 }],
    ['BIT#10', { x: 320, y: 104, width: 80, height: 52 }]
  ]);
  const layout = {
    getAttribute: name => ({
      'data-layout': 'BIT', 'data-bit-rows': '3',
      'data-row-height': '52', 'data-box-size': '40'
    })[name] || null
  };
  const elements = new Map([...placements.keys()].map(key => [
    key, { closest: selector => selector === '[data-layout]' ? layout : null }
  ]));
  const virtual = context.window.ASMTraceRenderers.ensureLinearIndexPlacement(
    {}, 'BIT', 16, 11, placements, elements
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(virtual)),
    { x: 0, y: -52, width: 640, height: 52 }
  );
  assert.equal(placements.get('BIT#16'), virtual);
});

test('compound scalar writes move their dependent marker but array compounds do not', () => {
  const source = fs.readFileSync(path.join(__dirname, '../public/trace-frame-tween.js'), 'utf8')
    .replace('window.ASMTraceFrameTween = {',
      'window.ASMTraceFrameTween = { updateTargetsMarker,');
  const c = vm.createContext({
    window: {},
    document: { documentElement: { dataset: {} } },
    queueMicrotask() {}
  });
  vm.runInContext(source, c);
  const marker = {
    dataset: { traceSourceVariableId: 'build:i', traceRuntimeIdentity: 'build-i-life' },
    closest: () => null
  };
  const elements = new Map([['marker-i', marker]]);
  const compoundIndex = {
    type: 'write', compound: true,
    targets: [
      { role: 'target', variableId: 'build:i', lifetimeIdentity: 'build-i-life' },
      { role: 'source', variableId: 'build:lb' }
    ]
  };
  assert.equal(c.window.ASMTraceFrameTween.updateTargetsMarker(
    compoundIndex, elements, { events: [compoundIndex] }
  ), true, 'i += lb uses the position animation of the i marker');

  const compoundArray = {
    type: 'write', compound: true,
    targets: [
      { role: 'target', variableId: 'BIT', resolvedIndex: 4 },
      { role: 'source', variableId: 'num', resolvedIndex: 3 }
    ]
  };
  assert.equal(c.window.ASMTraceFrameTween.updateTargetsMarker(
    compoundArray, elements, { events: [compoundArray] }
  ), false, 'BIT[i] += num[k] remains a value assignment');
});

test('compare marker followers use the event checkpoint rather than the final rendered binding', () => {
  const source = fs.readFileSync(path.join(__dirname, '../public/trace-frame-tween.js'), 'utf8');
  assert.doesNotMatch(source, /function markerMatchesCompareOperand\(/);
  assert.doesNotMatch(source, /markerMotion\.targetStates/);
  assert.match(source,
    /const targetKey = bindingTargetForMarker\?\.\(element\) \?\? element\?\.dataset\?\.traceBindingTarget;[\s\S]*?this\.logicalAdjustments\.has\(targetKey\)/);
});

test('j and j+1 follow their comparison-time cells before a later j--', () => {
  const doc = { variables: { j: { name: 'j', kind: 'scalar' } } };
  const frame = { state: {} };
  const checkpoint = { beforeState: { 'value:j#0': { kind: 'scalar', value: 2 } } };
  const marker = expression => ({ dataset: {
    traceBindingTarget: expression === 'j' ? 'arr#1' : 'arr#2',
    traceSourceVariableId: 'j', traceMarkerIndexExpression: expression
  } });
  const originalRules = context.window.ASMTraceRules;
  context.window.ASMTraceRules = { resolveExpression: (doc, frame, expression, locals) => (
    Number(locals.j) + (expression === 'j+1' ? 1 : 0)
  ) };
  try {
    assert.equal(context.window.ASMTraceFrameTween.markerTargetAtCheckpoint(doc, frame, marker('j'), checkpoint), 'arr#2');
    assert.equal(context.window.ASMTraceFrameTween.markerTargetAtCheckpoint(doc, frame, marker('j+1'), checkpoint), 'arr#3');
  } finally { context.window.ASMTraceRules = originalRules; }
});

test('a disabled marker assignment still updates logical position after earlier comparisons', () => {
  const tweenSource = fs.readFileSync(path.join(__dirname, '../public/trace-frame-tween.js'), 'utf8')
    .replace('window.ASMTraceFrameTween = {',
      'window.ASMTraceFrameTween = { markerAssignmentMotion,');
  context.window.ASMTraceRules = {
    resolveExpression: (doc, frame, expr, locals) => Number(locals[expr])
  };
  vm.runInContext(tweenSource, context);
  const marker = {
    dataset: {
      traceBindingTarget: 'arr#1',
      traceSourceVariableId: 'i',
      traceMarkerIndexExpression: 'i'
    },
    getAttribute: name => name === 'transform' ? 'translate(140,120)' : null
  };
  const previous = {
    dataset: { traceBindingTarget: 'arr#0' },
    getAttribute: name => name === 'transform' ? 'translate(120,120)' : null
  };
  const entry = {
    key: 'marker-i', element: marker, previousVisual: previous,
    markerPointPath: {}, markerLabelBox: { getAttribute: () => '18' }
  };
  const compare = {
    id: 'compare-before-increment', order: 1, type: 'compare', enabled: true,
    targets: [{ variableId: 'arr', indexExpression: '1' }]
  };
  const hiddenIncrement = {
    id: 'hidden-i-increment', order: 2, type: 'assign', enabled: false,
    targets: [{ variableId: 'i', role: 'target' }],
    payload: { before: 0, after: 1 }
  };
  const eventFrame = { events: [compare, hiddenIncrement] };
  const placements = new Map([
    ['arr#0', { x: 100, y: 120, width: 40, height: 40 }],
    ['arr#1', { x: 140, y: 120, width: 40, height: 40 }]
  ]);
  const motion = context.window.ASMTraceFrameTween.markerAssignmentMotion(
    { variables: { i: { name: 'i' } } }, eventFrame,
    [{ animation: 'compare', event: compare, start: 0, end: 100 }],
    placements, new Map([['marker-i', marker]]), [entry]
  );

  motion.update(50);
  assert.equal(motion.arrowStates.get('marker-i').x, 120);

  motion.update(100);
  assert.equal(motion.arrowStates.get('marker-i').x, 140,
    'disabled animation still commits the logical marker state without adding duration');
});

test('a terminal loop increment remains at its event-final marker position', () => {
  const tweenSource = fs.readFileSync(path.join(__dirname, '../public/trace-frame-tween.js'), 'utf8')
    .replace('window.ASMTraceFrameTween = {',
      'window.ASMTraceFrameTween = { markerAssignmentMotion,');
  context.window.ASMTraceRules = {
    resolveExpression: (doc, frame, expression, locals) => Number(locals[expression])
  };
  vm.runInContext(tweenSource, context);
  const marker = {
    dataset: {
      traceBindingTarget: 'arr#4',
      traceSourceVariableId: 'j',
      traceMarkerIndexExpression: 'j',
      traceMarkerSortKey: 'j',
      traceMarkerBaseCellWidth: '40'
    },
    getAttribute: name => name === 'transform' ? 'translate(180,80)' : null
  };
  const increment = {
    id: 'terminal-j-increment', order: 1, type: 'write', update: true,
    targets: [{ variableId: 'j', role: 'target' }],
    payload: { before: { kind: 'scalar', value: 4 }, after: { kind: 'scalar', value: 5 } }
  };
  const placements = new Map([
    ['arr#4', { x: 160, y: 80, width: 40, height: 40 }],
    ['arr#5', { x: 200, y: 80, width: 40, height: 40 }]
  ]);
  const motion = context.window.ASMTraceFrameTween.markerAssignmentMotion(
    { variables: { j: { name: 'j' } } },
    { events: [increment] },
    [{ event: increment, animation: 'position', start: 0, motionStart: 0, end: 520 }],
    placements,
    new Map([['marker-j', marker]]),
    [{
      key: 'marker-j', element: marker, previousVisual: null,
      markerPointPath: {}, markerLabelBox: { getAttribute: () => '18' }
    }]
  );

  motion.finish();
  assert.equal(motion.committedTargets.get('marker-j'), 'arr#5');
  assert.equal(motion.adjustments.get('marker-j').x, 40,
    'finishing the event timeline keeps j at 5 instead of clearing back to the frame state j = 4');
  assert.equal(motion.arrowStates.get('marker-j').x, 220);
  motion.reset();
  assert.equal(motion.adjustments.size, 0,
    'backward playback can discard the outgoing frame commit instead of applying it to the target frame');
});

test('a disabled loop-boundary increment does not update the logical marker position', () => {
  const tweenSource = fs.readFileSync(path.join(__dirname, '../public/trace-frame-tween.js'), 'utf8')
    .replace('window.ASMTraceFrameTween = {',
      'window.ASMTraceFrameTween = { markerAssignmentMotion,');
  context.window.ASMTraceRules = {
    resolveExpression: (doc, frame, expression, locals) => Number(locals[expression])
  };
  vm.runInContext(tweenSource, context);
  const marker = {
    dataset: {
      traceBindingTarget: 'arr#4', traceSourceVariableId: 'j',
      traceMarkerIndexExpression: 'j', traceMarkerSortKey: 'j', traceMarkerBaseCellWidth: '40'
    },
    getAttribute: name => name === 'transform' ? 'translate(180,80)' : null
  };
  const increment = {
    id: 'terminal-j-increment', order: 1, type: 'write', update: true,
    enabled: false, loopBoundary: true, loopBoundarySuppressed: true,
    targets: [{ variableId: 'j', role: 'target' }],
    payload: { before: { kind: 'scalar', value: 4 }, after: { kind: 'scalar', value: 5 } }
  };
  const motion = context.window.ASMTraceFrameTween.markerAssignmentMotion(
    { variables: { j: { name: 'j' } } },
    { events: [increment] },
    [],
    new Map([
      ['arr#4', { x: 160, y: 80, width: 40, height: 40 }],
      ['arr#5', { x: 200, y: 80, width: 40, height: 40 }]
    ]),
    new Map([['marker-j', marker]]),
    [{ key: 'marker-j', element: marker, previousVisual: null,
      markerPointPath: {}, markerLabelBox: { getAttribute: () => '18' } }]
  );

  motion.finish();
  assert.equal(motion.committedTargets.get('marker-j'), 'arr#4');
  assert.equal(motion.adjustments.size, 0,
    'the hidden boundary j++ must not move to j = 5 even as a zero-duration logical event');
});

test('a second unknown marker stays parked until its own assignment', () => {
  context.window.ASMTraceRules = {
    resolveExpression: (doc, frame, expr, locals) => {
      const value = Number(locals[expr]);
      return value === 0 ? null : value;
    }
  };
  const entries = ['i', 'j'].map((name, index) => ({
    key: name,
    element: {
      dataset: { traceBindingTarget: `arr#${index + 2}`, traceSourceVariableId: name,
        traceMarkerIndexExpression: name, traceMarkerSortKey: name },
      getAttribute: () => `translate(${180 + index * 40},120)`
    },
    previousVisual: {
      dataset: { traceMarkerUnresolved: '1', traceMarkerTargetX: String(37 + index * 26), traceMarkerTargetY: '60' },
      getAttribute: () => `translate(${37 + index * 26},40)`
    },
    markerPointPath: {}, markerLabelBox: { getAttribute: () => '18' }
  }));
  const slots = ['i', 'j'].map((name, index) => ({
    animation: 'assign', start: index * 300, motionStart: index * 300 + 100, end: index * 300 + 200,
    event: { type: 'assign', targets: [{ variableId: name, role: 'target' }], payload: { before: 0, after: index + 2 } }
  }));
  const motion = context.window.ASMTraceFrameTween.markerAssignmentMotion(
    { variables: { i: { name: 'i' }, j: { name: 'j' } } }, {}, slots,
    new Map([[ 'arr#2', { x: 160, y: 120, width: 40, height: 40 } ],
      [ 'arr#3', { x: 200, y: 120, width: 40, height: 40 } ]]),
    new Map(entries.map(entry => [entry.key, entry.element])), entries);
  motion.update(250);
  assert.equal(motion.arrowStates.get('i').x, 180);
  assert.deepEqual({ ...motion.arrowStates.get('j') }, { x: 63, y: 40, targetX: 63, targetY: 60 });
  motion.update(399);
  assert.equal(motion.arrowStates.get('j').x, 63);
  motion.update(500);
  assert.equal(motion.arrowStates.get('j').x, 220);
});
test('a later same-frame declaration makes room before its initializer moves away', () => {
  const source = fs.readFileSync(path.join(__dirname, '../public/trace-frame-tween.js'), 'utf8')
    .replace('window.ASMTraceFrameTween = {', 'window.ASMTraceFrameTween = { markerAssignmentMotion,');
  const c = vm.createContext({ window: { ASMTraceRules: {
    resolveExpression: (doc, frame, expression, locals) => locals[expression]
  } }, document: { documentElement: { dataset: {} } } });
  vm.runInContext(source, c);
  const marker = (name, index, x) => ({
    dataset: { traceBindingTarget: `arr#${index}`, traceSourceVariableId: name,
      traceMarkerIndexExpression: name, traceMarkerSortKey: name },
    getAttribute: key => key === 'transform' ? `translate(${x},80)` : null
  });
  const i = marker('i', 4, 180), largest = marker('largest', 9, 380);
  const event = (type, order, name, before, after) => ({ type, order,
    targets: [{ variableId: name, role: 'target' }],
    payload: { before: { kind: 'scalar', value: before }, after: { kind: 'scalar', value: after } }
  });
  const di = event('declare', 1, 'i'), dl = event('declare', 2, 'largest');
  const init = event('assign', 3, 'largest', '', 4), move = event('assign', 4, 'largest', 4, 9);
  init.declarationInitializer = true;
  const slots = [
    { event: di, animation: 'declare', start: 0, end: 220 },
    { event: dl, animation: 'declare', start: 300, end: 520 },
    { event: init, animation: 'assign', start: 600, motionStart: 600, end: 900 },
    { event: move, animation: 'assign', start: 1000, motionStart: 1000, end: 1400 }
  ];
  const motion = c.window.ASMTraceFrameTween.markerAssignmentMotion(
    { variables: { i: { name: 'i' }, largest: { name: 'largest' } } },
    { events: [di, dl, init, move] }, slots,
    new Map([[ 'arr#4', { x: 160, y: 80, width: 40, height: 40 } ],
      [ 'arr#9', { x: 360, y: 80, width: 40, height: 40 } ]]),
    new Map([['i', i], ['largest', largest]]),
    [i, largest].map(element => ({ key: element.dataset.traceSourceVariableId, element,
      markerPointPath: {}, markerLabelBox: { getAttribute: () => '18' } }))
  );
  motion.update(290);
  assert.equal(motion.adjustments.get('i')?.x || 0, 0);
  motion.update(500);
  const ix = 180 + (motion.adjustments.get('i')?.x || 0);
  const lx = 380 + (motion.adjustments.get('largest')?.x || 0);
  assert.ok(lx - ix >= 26, `declaration peers overlap: ${ix}, ${lx}`);
  motion.update(700);
  assert.equal(180 + (motion.adjustments.get('i')?.x || 0), ix,
    'the initializer must not reset the declaration layout to an unresolved target');
});
