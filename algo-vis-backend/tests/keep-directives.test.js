const { test } = require('node:test');
const assert = require('node:assert/strict');
const { findKeepDirectives, findExitDirectives } = require('../trace-instrumenter');
const { compile, load } = require('./helpers/compile');

const source = `
#include <bits/stdc++.h>
using namespace std;
int main() {
  vector<int> arr = {3, 1, 2};
  // @frame arr
  // @keep arr as "original" at arr.bottom offset(4,6)
  arr[0] = 1;
  // @frame arr
  // @keep arr as "original" at arr.right
  arr[1] = 3;
  // @frame arr
  // @keep last as "round" at canvas.top
  // @frame arr
}
`;

test('@keep accepts as, at and offset modifiers', () => {
  const directives = findKeepDirectives(source);
  assert.equal(directives.length, 3);
  assert.equal(directives[0].label, 'original');
  assert.equal(directives[0].binding.targetName, 'arr');
  assert.equal(directives[0].binding.anchor, 'bottom');
  assert.equal(directives[0].binding.offsetX, 4);
  assert.equal(directives[0].binding.offsetY, 6);
  assert.equal(directives[2].mode, 'last');
  assert.equal(directives[2].binding.canvas, true);
});

test('@keep accepts ordinary when conditions and rejects temporal lookups', () => {
  const conditionalSource = `
#include <bits/stdc++.h>
using namespace std;
int main() {
  int i = 1;
  vector<int> arr = {3, 1, 2};
  // @frame arr[i]
  // @keep last as "round" at canvas.top when i > 0
}
`;
  const [directive] = findKeepDirectives(conditionalSource);
  assert.equal(directive.when.expression, 'i > 0');
  assert.deepEqual(directive.when.identifiers, ['i']);
  assert.throws(() => findKeepDirectives(conditionalSource.replace(
    'when i > 0', 'when changed(i)'
  )), /@keep when 暫不支援跨幀函式/);
});

test('@exit resolves one or more live variables', () => {
  const exitSource = `
#include <bits/stdc++.h>
using namespace std;
int main() {
  int i = 0;
  int j = 1;
  // @exit i,j
}
`;
  const [directive] = findExitDirectives(exitSource);
  assert.deepEqual(directive.variables.map(variable => variable.name), ['i', 'j']);
  assert.throws(() => findExitDirectives(exitSource.replace('@exit i,j', '@exit missing')),
    /@exit 找不到可見變數/);
});

test('@keep when emits snapshots only when its runtime condition is true', async () => {
  const conditionalSource = `
#include <bits/stdc++.h>
using namespace std;
int main() {
  vector<int> arr = {3, 1, 2};
  for (int i = 0; i < 3; i++) {
    // @keep last as "round" when i > 0
    // @frame arr[i]
  }
}
`;
  const { trace } = await compile(conditionalSource);
  assert.deepEqual(trace.snapshots.map(snapshot => snapshot.objectId), ['round', 'round_1']);
  assert.equal(trace.frames[0].snapshotIds.length, 0,
    'the false first-iteration condition does not cut a keep scene');
});

test('an immediate natural scope exit is absorbed before @keep last', async () => {
  const lifecycleSource = `
#include <bits/stdc++.h>
using namespace std;
int main() {
  vector<int> arr = {3, 1};
  for (int i = 0; i < 2; i++) {
    int min_idx = i;
    // @frame arr[min_idx]
    // @keep last as "round"
  }
  // @frame arr
}
`;
  const { trace } = await compile(lifecycleSource);
  const minId = Object.keys(trace.variables).find(id => trace.variables[id].name === 'min_idx');
  assert.equal(trace.snapshots.length, 2);
  trace.snapshots.forEach(snapshot => {
    assert.equal(snapshot.frame.state[minId], undefined);
    assert.ok(!(snapshot.frame.bindings || []).some(binding => (
      binding.sourceVariableId === minId || (binding.sourceVariableIds || []).includes(minId)
    )));
  });
  const absorbed = trace.frames.flatMap(frame => frame.events).filter(event => (
    event.type === 'scope-exit' && event.name === 'min_idx' && event.preKeepExit === true
  ));
  assert.equal(absorbed.length, 2);
  assert.ok(absorbed.every(event => event.absorbedAfterKeep === true));
  assert.ok(absorbed.every(event => event.sceneGeneration
    === event.targets[0].sceneGeneration));
});

test('scope exit is not absorbed across an observable event after keep', async () => {
  const observableSource = `
#include <bits/stdc++.h>
using namespace std;
int main() {
  vector<int> arr = {3, 1};
  {
    int min_idx = 0;
    // @frame arr[min_idx]
    // @keep last as "before_change"
    min_idx++;
  }
  // @frame arr
}
`;
  const { trace } = await compile(observableSource);
  const minId = Object.keys(trace.variables).find(id => trace.variables[id].name === 'min_idx');
  const snapshot = trace.snapshots.find(item => item.objectId === 'before_change');
  const exit = trace.frames.flatMap(frame => frame.events).find(event => (
    event.type === 'scope-exit' && event.name === 'min_idx'
  ));
  assert.equal(exit.preKeepExit, undefined);
  assert.ok(snapshot.frame.state[minId],
    'the keep captures the still-live variable when a write occurs before its later scope exit');
});

test('@exit animates before keep and excludes that lifetime from the snapshot', async () => {
  const exitSource = `
#include <bits/stdc++.h>
using namespace std;
int main() {
  vector<int> arr = {3, 1};
  int min_idx = 0;
  // @frame arr[min_idx]
  // @exit min_idx
  // @keep last as "without_min"
  // @frame arr
}
`;
  const { trace } = await compile(exitSource);
  const minId = Object.keys(trace.variables).find(id => trace.variables[id].name === 'min_idx');
  const snapshot = trace.snapshots.find(item => item.objectId === 'without_min');
  const event = trace.frames.flatMap(frame => frame.events)
    .find(item => item.type === 'visual-exit');
  assert.ok(event);
  assert.equal(event.preKeepExit, true);
  assert.equal(event.manualVisualExit, true);
  assert.equal(snapshot.frame.state[minId], undefined);
  assert.equal(event.sceneGeneration, snapshot.sceneGeneration,
    'the pre-keep exit targets the outgoing scene rather than the new live scene');
});

test('@keep offset without at shifts the inherited placement', async () => {
  const offsetSource = `
#include <bits/stdc++.h>
using namespace std;
int main() {
  vector<int> arr = {3, 1, 2};
  // @frame arr
  // @keep last as "round" offset(0,-36)
  // @frame arr
}
`;
  const [directive] = findKeepDirectives(offsetSource);
  assert.equal(directive.binding, null);
  assert.deepEqual(directive.placementOffset, { x: 0, y: -36 });

  const { trace } = await compile(offsetSource);
  const snapshot = trace.snapshots.find(item => item.objectId === 'round');
  assert.deepEqual(JSON.parse(JSON.stringify(snapshot.placementOffset)), { x: 0, y: -36 });
});

test('keep snapshots inherit source Studio placement until edited directly', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const vm = require('node:vm');
  const rendererSource = fs.readFileSync(path.join(__dirname, '../public/trace-renderer.js'), 'utf8')
    .replace('window.ASMTraceRenderers = {',
      'window.ASMTraceRenderers = { snapshotStudioPosition, snapshotAutomaticBinding, objectMotionPositions, shiftPlacementTree,');
  const context = vm.createContext({ window: {}, document: { documentElement: { dataset: {} } } });
  vm.runInContext(rendererSource, context);
  const renderer = context.window.ASMTraceRenderers;
  const recursiveIdentity = '[5,7,2,1,9,4]';
  assert.equal(
    renderer.runtimeIdentityToken(recursiveIdentity, 'heapify:arr'),
    renderer.runtimeIdentityToken(recursiveIdentity, 'other-alias')
  );
  assert.ok(!renderer.runtimeIdentityToken(recursiveIdentity, 'heapify:arr').includes(recursiveIdentity),
    'recursive array identity is opaque instead of embedding its values');
  assert.deepEqual(
    JSON.parse(JSON.stringify(renderer.snapshotStudioPosition(
      { studio: { positions: {} } }, { id: 'current' },
      { id: 'snapshot:frame:1', objectId: 'round', kind: 'frame' }
    ))),
    { x: 0, y: 0, absolute: false, explicit: false },
    '@keep last keeps its source offset while the stack owns the extra spacing'
  );
  assert.ok(rendererSource.includes('const KEEP_SNAPSHOT_GAP = 50;'),
    'every automatically stacked keep row uses the shared 50px default gap');
  const measuredCell = {
    dataset: { traceObjectKey: 'arr#0' },
    getAttribute(name) {
      return ({
        'data-trace-position-x': '108',
        'data-trace-position-y': '88',
        'data-base-offset': '0,0'
      })[name] ?? null;
    }
  };
  const motionPositions = renderer.objectMotionPositions({
    querySelectorAll: () => [measuredCell]
  }, new Map([['arr#0', { x: 0, y: 0 }]]));
  assert.deepEqual(JSON.parse(JSON.stringify(motionPositions.get('arr#0'))), { x: 108, y: 88 },
    'a freshly rendered child cell reuses its measured bounds instead of outerframe origin');
  const parent = { contains: element => element === child };
  const child = {
    dataset: {
      tracePositionSpace: 'bounds', tracePositionX: '108', tracePositionY: '88'
    }
  };
  const shiftedPlacements = new Map([['arr#0', { x: 108, y: 88, width: 40, height: 40 }]]);
  renderer.shiftPlacementTree(parent, 25, 40, shiftedPlacements, new Map([['arr#0', child]]));
  assert.deepEqual(JSON.parse(JSON.stringify(shiftedPlacements.get('arr#0'))),
    { x: 133, y: 128, width: 40, height: 40 });
  assert.equal(child.dataset.tracePositionX, '133');
  assert.equal(child.dataset.tracePositionY, '128',
    'post-measurement parent bindings update child tween coordinates too');
  const document = {
    frames: [{ id: 'source', source: {}, state: { arr: {} } }, { id: 'current', state: {} }],
    studio: {
      positions: { source: { arr: { x: 32, y: 148, absolute: true } } },
      bindings: { source: { arr: { targetKey: '$canvas', targetAnchor: 'top', dy: 24 } } }
    }
  };
  const snapshot = {
    id: 'snapshot:arr:1',
    objectId: 'saved',
    sourceFrameId: 'source',
    sourceVariableId: 'arr',
    placementOffset: { x: 4, y: -20 }
  };

  assert.deepEqual(
    JSON.parse(JSON.stringify(renderer.snapshotStudioPosition(document, document.frames[1], snapshot))),
    { x: 36, y: 128, absolute: true, explicit: false }
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(renderer.snapshotAutomaticBinding(document, snapshot))),
    { targetKey: '$canvas', targetAnchor: 'top', dy: 24 }
  );

  document.studio.positions.current = { saved: { x: 90, y: 210, absolute: true } };
  assert.deepEqual(
    JSON.parse(JSON.stringify(renderer.snapshotStudioPosition(document, document.frames[1], snapshot))),
    { x: 90, y: 210, absolute: true, explicit: true },
    'a directly edited keep position remains authoritative and does not reapply the directive offset'
  );
});

test('@keep last retains an uninitialized declaration as an empty cell', async () => {
  const uninitializedSource = `
#include <bits/stdc++.h>
using namespace std;
int main() {
  vector<int> arr = {2, 1};
  // @frame arr
  int empty;
  // @keep last as "with_empty"
  // @frame empty
}
`;
  const { trace } = await compile(uninitializedSource);
  const emptyId = Object.keys(trace.variables).find(id => trace.variables[id].name === 'empty');
  const snapshot = trace.snapshots.find(item => item.objectId === 'with_empty');
  assert.deepEqual(JSON.parse(JSON.stringify(snapshot.frame.state[emptyId].data)), {
    kind: 'scalar', value: ''
  });
});

test('@keep exposes stable canvas IDs and suffixes only duplicate names', async () => {
  const { trace, context } = await compile(source);
  assert.deepEqual(trace.snapshots.map(snapshot => snapshot.objectId), [
    'original', 'original_1', 'round'
  ]);
  assert.deepEqual(trace.snapshots.map(snapshot => snapshot.label), [
    'original', 'original_1', 'round'
  ]);
  assert.equal(trace.snapshots[0].binding.anchor, 'bottom');
  assert.equal(trace.snapshots[0].binding.targetVariableId,
    Object.keys(trace.variables).find(id => trace.variables[id].name === 'arr'));
  assert.equal(trace.snapshots[2].binding.canvas, true);
  assert.ok(trace.frames.at(-1).snapshotIds.includes(trace.snapshots[2].id));
  assert.deepEqual(Array.from(trace.frames, frame => frame.sceneGeneration), [0, 1, 2, 3],
    'every keep directive cuts the retained scene from the following live scene');
  assert.deepEqual(Array.from(trace.snapshots, snapshot => snapshot.sceneGeneration), [0, 1, 2]);
  trace.frames.forEach(frame => frame.events.forEach(event => {
    assert.equal(event.sceneGeneration, frame.sceneGeneration);
    (event.targets || []).forEach(target => {
      assert.equal(target.sceneGeneration, frame.sceneGeneration);
    });
  }));
  const firstWriteFrame = trace.frames.find(frame => frame.events.some(event => (
    event.type === 'assign'
      && /arr\[0\]\s*=\s*1/.test(event.expression || event.signature || '')
  )));
  assert.equal(firstWriteFrame.sceneGeneration, 1,
    'work after the first keep belongs to the new live object generation');
  load(context, 'trace-transitions.js');
  const arrId = Object.keys(trace.variables).find(id => trace.variables[id].name === 'arr');
  const boundaryTransition = context.ASMTraceTransitions.resolve(
    trace, trace.frames[0], trace.frames[1], arrId, new Set([arrId])
  );
  assert.equal(boundaryTransition.mode, 'instant');
  assert.equal(boundaryTransition.sourceKey, '',
    'the new live array must not be mistaken for the retained old array');
});

test('@keep freezes source styles by default and supports without style', async () => {
  const styledSource = `
#include <bits/stdc++.h>
using namespace std;
int main() {
  vector<int> arr = {3, 1, 2};
  // @frame arr
  // @style arr[0] highlight AV_red
  // @keep arr as "styled"
  // @keep arr as "plain" without style
  // @keep last as "styled_frame"
  // @keep last as "plain_frame" without style
  arr[0] = 1;
  // @frame arr
}
`;
  const directives = findKeepDirectives(styledSource);
  assert.deepEqual(directives.map(item => item.preserveStyle), [true, false, true, false]);

  const { trace } = await compile(styledSource);
  const snapshots = Object.fromEntries(trace.snapshots.map(snapshot => [snapshot.objectId, snapshot]));
  assert.equal(snapshots.styled.styles.length, 1);
  assert.equal(snapshots.styled.styles[0].styleType, 'highlight');
  assert.equal(snapshots.styled.styles[0].color, 'AV_red');
  assert.equal(snapshots.plain.styles.length, 0);
  assert.equal(snapshots.styled_frame.frame.styles.length, 1);
  assert.equal(snapshots.plain_frame.frame.styles.length, 0);
});

test('@keep last commits post-frame state and excludes lifetimes that already exited', async () => {
  const lifecycleSource = `
#include <bits/stdc++.h>
using namespace std;
int main() {
  vector<int> arr = {1, 2};
  {
    int i = 0;
    // @frame arr[i]
    swap(arr[0], arr[1]);
    arr[0] = 9;
    i++;
  }
  // @keep last as "completed"
  // @frame arr
}
`;
  const { trace } = await compile(lifecycleSource);
  const snapshot = trace.snapshots.find(item => item.objectId === 'completed');
  const arrId = Object.keys(trace.variables).find(id => trace.variables[id].name === 'arr');
  const iId = Object.keys(trace.variables).find(id => trace.variables[id].name === 'i');

  assert.equal(snapshot.frame.state[arrId].data.items[0].value, 9,
    'the retained array includes mutations completed after the source frame and before keep');
  assert.equal(snapshot.frame.state[arrId].data.items[1].value, 1,
    'the retained array includes a completed swap even when no new frame followed the swap');
  assert.equal(snapshot.frame.state[iId], undefined,
    'a local object that exited before keep is not serialized into the retained frame');
  assert.ok(!(snapshot.frame.bindings || []).some(binding => (
    binding.sourceVariableId === iId || (binding.sourceVariableIds || []).includes(iId)
  )), 'the exited pointer has no retained binding');
});

test('@keep without at inherits the source frame placement binding', async () => {
  const positionedSource = `
#include <bits/stdc++.h>
using namespace std;
int main() {
  vector<int> arr = {0, 5, 7, 2};
  // @frame arr
  // @keep arr as "init"
  // @frame arr render heap with range(1,3) at init.bottom offset(0,40)
  // @keep arr as "tree_intro"
  arr[1]++;
  // @frame arr render heap with range(1,3)
}
`;
  const { trace } = await compile(positionedSource);
  const snapshots = Object.fromEntries(trace.snapshots.map(snapshot => [snapshot.objectId, snapshot]));

  assert.equal(snapshots.init.binding, null);
  assert.equal(snapshots.tree_intro.binding.targetObjectKey, 'init');
  assert.equal(snapshots.tree_intro.binding.anchor, 'bottom');
  assert.equal(snapshots.tree_intro.binding.offsetX, 0);
  assert.equal(snapshots.tree_intro.binding.offsetY, 40);
});

test('@keep at overrides an inherited source frame placement binding', async () => {
  const positionedSource = `
#include <bits/stdc++.h>
using namespace std;
int main() {
  vector<int> arr = {0, 5, 7, 2};
  // @frame arr
  // @keep arr as "init"
  // @frame arr render heap with range(1,3) at init.bottom offset(0,40)
  // @keep arr as "tree_intro" at init.right offset(12,0)
  arr[1]++;
  // @frame arr render heap with range(1,3)
}
`;
  const { trace } = await compile(positionedSource);
  const tree = trace.snapshots.find(snapshot => snapshot.objectId === 'tree_intro');

  assert.equal(tree.binding.targetObjectKey, 'init');
  assert.equal(tree.binding.anchor, 'right');
  assert.equal(tree.binding.offsetX, 12);
  assert.equal(tree.binding.offsetY, 0);
});

test('@keep rejects unknown without targets', () => {
  assert.throws(() => findKeepDirectives(`
#include <vector>
int main() {
  std::vector<int> arr = {1};
  // @frame arr
  // @keep arr without pointer
}
`), /@keep without 只支援 style/);
});
