const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const ArrowModel = require('../public/trace-arrow-model');
const {
  findKeepDirectives,
  findLayoutDirectives
} = require('../trace-instrumenter');
const { compile } = require('./helpers/compile');

const declaration = `
// @layout recursion as "quick_tree" at canvas.top offset(0,80)
// @layout quick_tree direction top-down
`;

test('@layout recursion requires a named target and provides documented defaults', () => {
  const [layout] = findLayoutDirectives(declaration);
  assert.equal(layout.id, 'quick_tree');
  assert.equal(layout.type, 'recursion');
  assert.equal(layout.direction, 'top-down');
  assert.equal(layout.mode, 'compact');
  assert.equal(layout.align, 'center');
  assert.equal(layout.siblingGap, 40);
  assert.equal(layout.levelGap, 100);
  assert.equal(layout.degree, 2);
  assert.equal(layout.showEdges, true);
  assert.equal(layout.edgeColor, 'black');
  assert.equal(layout.edgeWidth, 2);
  assert.equal(layout.binding.canvas, true);
  assert.equal(layout.binding.anchor, 'top');
  assert.equal(layout.binding.offsetX, 0);
  assert.equal(layout.binding.offsetY, 80);

  assert.throws(() => findLayoutDirectives('// @layout direction top-down'),
    /必須指定排版 ID/);
  assert.throws(() => findLayoutDirectives('// @layout recursion at canvas.top'),
    /必須使用 as 指定排版 ID/);
});

test('@layout accepts explicit recursion settings and all four directions', () => {
  for (const direction of ['top-down', 'bottom-up', 'left-right', 'right-left']) {
    const [layout] = findLayoutDirectives(`
// @layout recursion as tree
// @layout tree direction ${direction}
// @layout tree mode inorder
// @layout tree sibling-gap 52
// @layout tree level-gap 120
// @layout tree align end
// @layout tree degree 3
// @layout tree edges off
`);
    assert.equal(layout.direction, direction);
    assert.equal(layout.mode, 'inorder');
    assert.equal(layout.siblingGap, 52);
    assert.equal(layout.levelGap, 120);
    assert.equal(layout.align, 'end');
    assert.equal(layout.degree, 3);
    assert.equal(layout.showEdges, false);
  }
});

test('@keep in attaches a snapshot to an existing recursion layout', () => {
  const source = `
${declaration}
#include <vector>
int main() {
  std::vector<int> arr = {3, 1, 2};
  // @frame arr
  // @keep last as "root" in quick_tree
}
`;
  const [keep] = findKeepDirectives(source);
  assert.equal(keep.layoutId, 'quick_tree');
  assert.throws(() => findKeepDirectives(source.replace('in quick_tree', 'in missing')),
    /找不到排版 ID：missing/);
});

test('@frame in binds the live object to an existing recursion layout', () => {
  const source = `
${declaration}
#include <vector>
void split(std::vector<int>& arr) {
  // @frame arr in quick_tree
}
`;
  const [frame] = require('../trace-instrumenter').findFrameDirectives(source);
  assert.equal(frame.layoutId, 'quick_tree');
  assert.throws(() => require('../trace-instrumenter').instrumentSource(
    source.replace('in quick_tree', 'in missing')
  ), /找不到排版 ID：missing/);
  assert.throws(() => require('../trace-instrumenter').findFrameDirectives(
    source.replace('in quick_tree', 'in quick_tree at canvas.top')
  ), /不可同時使用 in 與 at/);
});

function rendererApi() {
  const source = fs.readFileSync(path.join(__dirname, '../public/trace-renderer.js'), 'utf8');
  const context = vm.createContext({
    window: {},
    document: { documentElement: { dataset: {} } },
    queueMicrotask() {}
  });
  vm.runInContext(source, context);
  return context.window.ASMTraceRenderers;
}

function rendererDomApi() {
  const source = fs.readFileSync(path.join(__dirname, '../public/trace-renderer.js'), 'utf8');
  const dom = new JSDOM('<!doctype html><html><body><svg id="arraySvg"></svg></body></html>', {
    runScripts: 'outside-only'
  });
  const { window } = dom;
  window.queueMicrotask = queueMicrotask;
  window.ASMArrowModel = ArrowModel;
  window.ASMTraceRules = {
    evaluate() { return {}; },
    decorations() { return []; },
    conditionMatches() { return true; },
    expressionMatches() { return true; }
  };
  window.ASMTraceModel = { diffFrame() { return []; } };
  window.ASMTraceTransitions = { defaults() { return { duration: 0, easing: 'linear' }; } };
  window.eval(source);
  return { dom, window, renderer: window.ASMTraceRenderers };
}

test('recursion layout coordinates grow in the selected direction', () => {
  const renderer = rendererApi();
  const nodes = [
    { id: 'root', parentId: '', siblingIndex: 0, box: { width: 80, height: 40 } },
    { id: 'left', parentId: 'root', siblingIndex: 0, box: { width: 60, height: 40 } },
    { id: 'right', parentId: 'root', siblingIndex: 1, box: { width: 60, height: 40 } }
  ];
  const base = { mode: 'compact', align: 'center', siblingGap: 40, levelGap: 100, degree: 2 };
  const topDown = renderer.recursionLayoutCoordinates({ ...base, direction: 'top-down' }, nodes, { x: 300, y: 80 });
  assert.ok(topDown.get('left').y > topDown.get('root').y);
  assert.ok(topDown.get('left').x < topDown.get('right').x);
  const bottomUp = renderer.recursionLayoutCoordinates({ ...base, direction: 'bottom-up' }, nodes, { x: 300, y: 500 });
  assert.ok(bottomUp.get('left').y < bottomUp.get('root').y);
  const leftRight = renderer.recursionLayoutCoordinates({ ...base, direction: 'left-right' }, nodes, { x: 80, y: 300 });
  assert.ok(leftRight.get('left').x > leftRight.get('root').x);
  const rightLeft = renderer.recursionLayoutCoordinates({ ...base, direction: 'right-left' }, nodes, { x: 900, y: 300 });
  assert.ok(rightLeft.get('left').x < rightLeft.get('root').x);
});

test('recursion layout edges use directional outerframe anchors', () => {
  const renderer = rendererApi();
  const parent = { x: 100, y: 40, width: 120, height: 60 };
  const child = { x: 130, y: 220, width: 80, height: 50 };

  assert.deepEqual(
    JSON.parse(JSON.stringify(renderer.recursionLayoutEdgePoints(parent, child, 'top-down'))),
    { x1: 160, y1: 100, x2: 170, y2: 220 }
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(renderer.recursionLayoutEdgePoints(parent, child, 'bottom-up'))),
    { x1: 160, y1: 40, x2: 170, y2: 270 }
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(renderer.recursionLayoutEdgePoints(parent, child, 'left-right'))),
    { x1: 220, y1: 70, x2: 130, y2: 245 }
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(renderer.recursionLayoutEdgePoints(parent, child, 'right-left'))),
    { x1: 100, y1: 70, x2: 210, y2: 245 }
  );
});

test('recursion layout edge target uses the nested array outerframe after transforms', () => {
  const renderer = rendererApi();
  const stop = {};
  const snapshot = {
    parentElement: stop,
    getAttribute(name) {
      return name === 'transform' ? 'translate(100, 200) translate(30, 40)' : '';
    },
    querySelectorAll() { return [owner]; }
  };
  const owner = {
    dataset: { traceVariable: 'arr-id' },
    parentElement: snapshot,
    getAttribute(name) { return name === 'transform' ? 'translate(10, 20)' : ''; },
    matches() { return false; },
    querySelector() { return outerframe; }
  };
  const values = {
    'data-outerframe-left': '0',
    'data-outerframe-top': '5',
    'data-outerframe-right': '80',
    'data-outerframe-bottom': '45',
    transform: ''
  };
  const outerframe = {
    parentElement: owner,
    getAttribute(name) { return values[name] || ''; }
  };
  const box = renderer.recursionOuterframePlacement(
    snapshot,
    { x: 90, y: 180, width: 200, height: 120 },
    stop,
    'arr-id'
  );
  assert.deepEqual(JSON.parse(JSON.stringify(box)), {
    x: 140, y: 265, width: 80, height: 40
  });
  assert.equal(renderer.recursionLayoutEdgePoints(
    { x: 100, y: 100, width: 80, height: 40 }, box, 'top-down'
  ).y2, 265);
});

test('complete recursion scene keeps a parent-child edge after final placement', async () => {
  const { window, renderer } = rendererDomApi();
  const data = value => ({ kind: 'sequence', items: [{ kind: 'scalar', value }] });
  const snapshots = [
    {
      id: 'snapshot-root', objectId: 'root', sourceVariableId: 'arr-id', label: 'root',
      data: data(2), layoutId: 'quick_tree',
      layoutNode: { parentSnapshotId: '', siblingIndex: 0, rootIndex: 0 }
    },
    {
      id: 'snapshot-child', objectId: 'child', sourceVariableId: 'arr-id', label: 'child',
      data: data(1), layoutId: 'quick_tree',
      layoutNode: { parentSnapshotId: 'snapshot-root', siblingIndex: 0, rootIndex: 0 }
    }
  ];
  const document = {
    variables: { 'arr-id': { id: 'arr-id', name: 'arr', kind: 'sequence' } },
    skins: {}, snapshots,
    layouts: [{
      id: 'quick_tree', type: 'recursion', direction: 'top-down', mode: 'compact',
      align: 'center', siblingGap: 40, levelGap: 100, degree: 2,
      showEdges: true, edgeColor: 'black', edgeWidth: 2,
      binding: { canvas: true, anchor: 'top', offsetX: 0, offsetY: 80 }
    }],
    studio: {}, frames: []
  };
  const frame = {
    id: 'frame-0', source: {}, state: {}, events: [], bindings: [], objectBindings: [],
    renderers: {}, rendererOptions: {}, captureOnlyVariableIds: [], texts: [], styles: [],
    segments: [], snapshotIds: snapshots.map(snapshot => snapshot.id)
  };
  document.frames.push(frame);
  await renderer.renderFrame(document, frame, null, {
    animatePositions: false, animateEvents: false
  });
  const edge = window.document.querySelector('.asm-trace-layout-edge');
  assert.ok(edge, `renderer must keep the recursion edge in the final SVG scene: ${[
    ...window.document.querySelectorAll('[data-trace-layout-node]')
  ].map(node => `${node.dataset.traceLayoutNode}<-${node.dataset.traceLayoutParent}`).join(', ')}`);
  assert.equal(edge.getAttribute('stroke'), 'black');
  assert.equal(edge.getAttribute('stroke-width'), '2');
  assert.ok(Number(edge.getAttribute('y2')) < renderer.currentPlacement('child', false).y,
    'the original drawArrow geometry reserves space before the child outerframe for its arrowhead');
  assert.match(edge.getAttribute('marker-end'), /arrowhead/);
});

test('@keep in replaces its live @frame node without shifting the array outerframe', async () => {
  const { window, renderer } = rendererDomApi();
  const sequence = {
    kind: 'sequence',
    items: [5, 7, 2].map(value => ({ kind: 'scalar', value }))
  };
  const baseFrame = {
    state: { 'arr-id': { name: 'arr', data: sequence } },
    events: [], bindings: [], objectBindings: [], renderers: {}, rendererOptions: {},
    captureOnlyVariableIds: [], texts: [], styles: [], segments: [], snapshotIds: []
  };
  const liveFrame = {
    ...baseFrame,
    id: 'frame-live',
    source: {
      layoutId: 'quick_tree', primaryVariableId: 'arr-id',
      recursionActivationId: 'activation-0', recursionAncestorActivationIds: [],
      recursionSiblingIndex: 0, recursionRootIndex: 0
    }
  };
  const snapshot = {
    id: 'snapshot-arr', objectId: 'partition', sourceVariableId: 'arr-id',
    sourceFrameId: liveFrame.id, createdFrameId: 'frame-keep', label: 'partition',
    data: sequence, layoutId: 'quick_tree', recursionActivationId: 'activation-0',
    layoutNode: { parentSnapshotId: '', siblingIndex: 0, rootIndex: 0 }
  };
  const keepFrame = {
    ...baseFrame,
    id: 'frame-keep', source: {}, snapshotIds: [snapshot.id]
  };
  const document = {
    variables: { 'arr-id': { id: 'arr-id', name: 'arr', kind: 'sequence' } },
    skins: {}, snapshots: [snapshot],
    layouts: [{
      id: 'quick_tree', type: 'recursion', direction: 'top-down', mode: 'compact',
      align: 'center', siblingGap: 40, levelGap: 100, degree: 2,
      showEdges: true, edgeColor: 'black', edgeWidth: 2,
      binding: { canvas: true, anchor: 'top', offsetX: 0, offsetY: 80 }
    }],
    studio: {}, frames: [liveFrame, keepFrame]
  };

  await renderer.renderFrame(document, liveFrame, null, {
    animatePositions: false, animateEvents: false
  });
  const liveRoot = window.document.querySelector('#asm-trace-root');
  const liveElement = window.document.querySelector('[data-trace-object-key="arr-id"]');
  const liveOuterframe = renderer.recursionOuterframePlacement(
    liveElement, renderer.currentPlacement('arr-id', false), liveRoot, 'arr-id'
  );

  await renderer.renderFrame(document, keepFrame, liveFrame, {
    animatePositions: false, animateEvents: false
  });
  const keepRoot = window.document.querySelector('#asm-trace-root');
  const keepElement = window.document.querySelector('[data-trace-object-key="partition"]');
  const keepOuterframe = renderer.recursionOuterframePlacement(
    keepElement, renderer.currentPlacement('partition', false), keepRoot, 'arr-id'
  );

  assert.deepEqual(
    { x: keepOuterframe.x, y: keepOuterframe.y },
    { x: liveOuterframe.x, y: liveOuterframe.y }
  );

  const sameFrame = {
    ...liveFrame,
    id: 'frame-live-and-keep',
    snapshotIds: [snapshot.id]
  };
  document.frames.push(sameFrame);
  await renderer.renderFrame(document, sameFrame, keepFrame, {
    animatePositions: false, animateEvents: false
  });
  const visibleObjects = [...window.document.querySelectorAll(
    '#asm-trace-root > .asm-trace-object'
  )];
  assert.equal(visibleObjects.length, 1,
    'a live recursion value and its active keep snapshot share one visible node');
  assert.equal(visibleObjects[0].dataset.traceObjectKey, 'partition');
  assert.deepEqual(
    renderer.currentPlacement('arr-id', false),
    renderer.currentPlacement('partition', false),
    'the live variable key remains an alias for text and event bindings'
  );
});

test('recursion layout arrows use stable depth-first preorder', () => {
  const renderer = rendererApi();
  const nodes = [
    { id: 'right', parentId: 'root', siblingIndex: 1, rootIndex: 0 },
    { id: 'left-leaf', parentId: 'left', siblingIndex: 0, rootIndex: 0 },
    { id: 'root', parentId: '', siblingIndex: 0, rootIndex: 0 },
    { id: 'left', parentId: 'root', siblingIndex: 0, rootIndex: 0 }
  ];
  assert.deepEqual(
    Array.from(renderer.recursionLayoutPreorder(nodes), node => node.id),
    ['root', 'left', 'left-leaf', 'right']
  );
});

test('recursive keep snapshots retain runtime parent-child layout identities', async () => {
  const source = `
#include <vector>
// @layout recursion as "quick_tree" at canvas.top offset(0,80)
// @layout quick_tree direction top-down
using namespace std;
void split(vector<int>& arr, int depth) {
  // @frame arr in quick_tree
  // @keep last as "part" in quick_tree
  if (depth < 2) {
    split(arr, depth + 1);
    split(arr, depth + 1);
  }
}
int main() {
  vector<int> arr = {3, 1, 2};
  // @frame arr
  split(arr, 0);
  // @frame arr
}
`;
  const { trace } = await compile(source);
  assert.equal(trace.layouts.length, 1);
  assert.equal(trace.layouts[0].id, 'quick_tree');
  assert.equal(trace.snapshots.length, 7);
  assert.ok(trace.snapshots.every(snapshot => snapshot.layoutId === 'quick_tree'));
  const roots = trace.snapshots.filter(snapshot => !snapshot.layoutNode.parentSnapshotId);
  assert.equal(roots.length, 1);
  const children = trace.snapshots.filter(snapshot => (
    snapshot.layoutNode.parentSnapshotId === roots[0].id
  ));
  assert.equal(children.length, 2);
  assert.deepEqual(children.map(snapshot => snapshot.layoutNode.siblingIndex), [0, 1]);
  const recursiveFrames = trace.frames.filter(frame => frame.source?.layoutId === 'quick_tree');
  assert.ok(recursiveFrames.length >= 3);
  assert.ok(recursiveFrames.every(frame => frame.source.recursionActivationId));
});
