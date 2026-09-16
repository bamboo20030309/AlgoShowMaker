const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const ArrowModel = require('../public/trace-arrow-model');
const { findFrameDirectives, findPlaceDirectives } = require('../trace-instrumenter');
const { compile } = require('./helpers/compile');

const source = `
#include <vector>
// @layout recursion as "quick_tree" at canvas.top offset(0,80)
void quick(std::vector<int>& arr, int low, int high) {
  int i = low;
  int pivot = arr[high];
  // @frame arr[i],pivot with range(low,high) in quick_tree
  // @place pivot at arr.right offset(16,0) when low <= high
}
int main() {
  std::vector<int> arr = {3, 1, 2};
  quick(arr, 0, 2);
}
`;

test('@place parses and attaches to the preceding frame', () => {
  const [place] = findPlaceDirectives(source);
  assert.equal(place.sourceName, 'pivot');
  assert.equal(place.binding.targetName, 'arr');
  assert.equal(place.binding.anchor, 'right');
  assert.equal(place.binding.offsetX, 16);
  assert.equal(place.binding.when.expression, 'low <= high');

  const [frame] = findFrameDirectives(source);
  assert.equal(frame.layoutId, 'quick_tree');
  assert.equal(frame.variables[0].name, 'arr');
  assert.equal(frame.placeBindings.length, 1);
  assert.equal(frame.variables.find(variable => variable.id === frame.placeBindings[0].sourceVariableId).name, 'pivot');
  assert.equal(frame.variables.find(variable => variable.id === frame.placeBindings[0].targetVariableId).name, 'arr');
});

test('@place supports an explicit source anchor and rejects hidden C++ sources', () => {
  assert.equal(
    findFrameDirectives(source.replace('@place pivot at', '@place pivot.left at'))[0]
      .placeBindings[0].sourceAnchor,
    'left'
  );
  assert.throws(() => findFrameDirectives(source.replace(
    '// @frame arr[i],pivot',
    '// @frame arr[i]'
  )), /來源變數未由前一個 @frame 顯示：pivot/);
});

test('@place survives compile in the shared frame objectBindings model', async () => {
  const { trace, window } = await compile(source);
  const frame = trace.frames.find(item => item.source?.layoutId === 'quick_tree');
  assert.ok(frame);
  const binding = frame.objectBindings.find(item => item.sourceName === 'pivot');
  assert.ok(binding);
  assert.equal(binding.anchor, 'right');
  assert.equal(binding.offsetX, 16);
  assert.equal(binding.when.expression, 'low <= high');

  const reopened = window.ASMTraceModel.normalizeTraceDocument(JSON.parse(JSON.stringify(trace)));
  const reopenedBinding = reopened.frames.find(item => item.source?.layoutId === 'quick_tree')
    .objectBindings.find(item => item.sourceName === 'pivot');
  assert.equal(reopenedBinding.anchor, 'right');
  assert.equal(reopenedBinding.when.expression, 'low <= high');
});

function rendererDomApi(conditionMatches) {
  const rendererSource = fs.readFileSync(path.join(__dirname, '../public/trace-renderer.js'), 'utf8');
  const dom = new JSDOM('<!doctype html><html><body><svg id="arraySvg"></svg></body></html>', {
    runScripts: 'outside-only'
  });
  const { window } = dom;
  window.queueMicrotask = queueMicrotask;
  window.ASMArrowModel = ArrowModel;
  window.ASMTraceRules = {
    evaluate() { return {}; }, decorations() { return []; },
    conditionMatches() { return conditionMatches; }, expressionMatches() { return true; },
    resolveExpression() { return 0; }
  };
  window.ASMTraceModel = { diffFrame() { return []; } };
  window.ASMTraceTransitions = { defaults() { return { duration: 0, easing: 'linear' }; } };
  window.eval(rendererSource);
  return { window, renderer: window.ASMTraceRenderers };
}

function renderDocument(conditionMatches) {
  const { window, renderer } = rendererDomApi(conditionMatches);
  const document = {
    variables: {
      arr: { id: 'arr', name: 'arr', kind: 'sequence' },
      pivot: { id: 'pivot', name: 'pivot', kind: 'scalar' }
    },
    skins: {}, snapshots: [], layouts: [], studio: {}, frames: []
  };
  const frame = {
    id: 'frame-0', source: { primaryVariableId: 'arr' },
    state: {
      arr: { name: 'arr', data: { kind: 'sequence', items: [3, 1, 2].map(value => ({ kind: 'scalar', value })) } },
      pivot: { name: 'pivot', data: { kind: 'scalar', value: 2 } }
    },
    events: [], bindings: [],
    objectBindings: [{
      type: 'semantic', sourceVariableId: 'pivot', sourceName: 'pivot', sourceAnchor: '',
      targetVariableId: 'arr', targetName: 'arr', targetExpression: 'arr', indexExpressions: [],
      anchor: 'right', offsetX: 16, offsetY: 0,
      when: { expression: 'enabled', identifiers: [] }
    }],
    renderers: {}, rendererOptions: {}, captureOnlyVariableIds: [], texts: [], styles: [],
    segments: [], arrows: [], snapshotIds: []
  };
  document.frames.push(frame);
  return { window, renderer, document, frame };
}

test('@place positions a secondary object beside the array and keeps the array grouped', async () => {
  const { window, renderer, document, frame } = renderDocument(true);
  await renderer.renderFrame(document, frame, null, { animatePositions: false, animateEvents: false });
  const arr = renderer.currentPlacement('arr', false);
  const pivot = renderer.currentPlacement('pivot', false);
  assert.ok(arr && pivot);
  assert.equal(Math.round(pivot.x), Math.round(arr.x + arr.width + 8 + 16));

  const arrObject = window.document.querySelector('[data-trace-object-key="arr"]');
  const motion = arrObject.querySelector(':scope > .asm-trace-motion');
  assert.ok(motion);
  assert.ok(motion.querySelector('rect'), 'outerframe belongs to the shared motion container');
  assert.ok(motion.querySelector('[data-trace-index]'), 'cells belong to the shared motion container');
});

test('@place when false leaves the secondary object in automatic layout', async () => {
  const enabled = renderDocument(true);
  await enabled.renderer.renderFrame(enabled.document, enabled.frame, null, { animatePositions: false, animateEvents: false });
  const placedX = enabled.renderer.currentPlacement('pivot', false).x;

  const disabled = renderDocument(false);
  await disabled.renderer.renderFrame(disabled.document, disabled.frame, null, { animatePositions: false, animateEvents: false });
  const automaticX = disabled.renderer.currentPlacement('pivot', false).x;
  assert.notEqual(Math.round(placedX), Math.round(automaticX));
});

test('@place top-left to bottom-left aligns array outerframes, not their first cells', async () => {
  const { window, renderer, document, frame } = renderDocument(true);
  window.CSS = { escape: value => value };
  window.draw_array_normal = (group, id, values) => {
    const width = values.length * 40;
    [['left', -8], ['top', -8], ['right', width + 8], ['bottom', 72]]
      .forEach(([edge, value]) => group.setAttribute(`data-outerframe-${edge}`, String(value)));
    const cell = window.document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    cell.setAttribute('id', `cell-${id}-0`);
    cell.setAttribute('x', '0');
    cell.setAttribute('y', '0');
    cell.setAttribute('width', '40');
    cell.setAttribute('height', '40');
    group.append(cell);
  };
  document.variables.isprime = { id: 'isprime', name: 'isprime', kind: 'sequence' };
  document.variables.prime = { id: 'prime', name: 'prime', kind: 'sequence' };
  frame.state = {
    isprime: { name: 'isprime', data: { kind: 'sequence', items: Array.from({ length: 10 }, (_, value) => ({ kind: 'scalar', value })) } },
    prime: { name: 'prime', data: { kind: 'sequence', items: [{ kind: 'scalar', value: 2 }] } }
  };
  frame.renderers = { isprime: 'original-array', prime: 'original-array' };
  frame.objectBindings = [{
    type: 'semantic', sourceVariableId: 'prime', sourceName: 'prime', sourceAnchor: 'top-left',
    targetVariableId: 'isprime', targetName: 'isprime', anchor: 'bottom-left',
    indexExpressions: [], offsetX: 0, offsetY: 60
  }];
  await renderer.renderFrame(document, frame, null, { animatePositions: false, animateEvents: false });
  const isprime = renderer.currentPlacement('isprime', false);
  const prime = renderer.currentPlacement('prime', false);
  const primeFrame = renderer.currentAnchorForKey('prime', 'top-left', false);
  const isprimeFrame = renderer.currentAnchorForKey('isprime', 'bottom-left', false);
  assert.equal(primeFrame.x, isprimeFrame.x, 'the two outerframe left edges coincide');
  assert.equal(primeFrame.y, isprimeFrame.y + 60, '60px means exact outerframe-to-outerframe spacing');
  assert.ok(isprime && prime);
  const primeGroup = window.document.querySelector('[data-trace-object-key="prime"] [data-outerframe-left]');
  assert.equal(primeGroup.getAttribute('data-outerframe-left'), '-8',
    'the outerframe is distinct from the first cell at local x=0');
});

test('@place object anchors ignore point and highlight overflow outside the outerframe', () => {
  const { window, renderer } = rendererDomApi(true);
  const root = window.document.querySelector('#arraySvg');
  const object = window.document.createElementNS('http://www.w3.org/2000/svg', 'g');
  object.setAttribute('transform', 'translate(422, -20)');
  const content = window.document.createElementNS('http://www.w3.org/2000/svg', 'g');
  content.setAttribute('data-outerframe-left', '0');
  content.setAttribute('data-outerframe-top', '0');
  content.setAttribute('data-outerframe-right', '240');
  content.setAttribute('data-outerframe-bottom', '40');
  const point = window.document.createElementNS('http://www.w3.org/2000/svg', 'path');
  point.setAttribute('d', 'M 220 -30 L 230 -10');
  content.append(point);
  object.append(content);
  root.append(object);
  const elements = new Map([['arr', object]]);

  const overflowPlacements = new Map([
    ['arr', { x: 422, y: -50, width: 240, height: 90 }]
  ]);
  const withPointOverflow = renderer.semanticTargetPlacement(
    'arr', overflowPlacements, elements
  );
  const withoutOverflow = renderer.semanticTargetPlacement(
    'arr',
    new Map([['arr', { x: 422, y: -20, width: 240, height: 64 }]]),
    elements
  );

  assert.deepEqual({ ...withPointOverflow }, { x: 422, y: -20, width: 240, height: 40 });
  assert.deepEqual({ ...withoutOverflow }, { ...withPointOverflow });
  assert.deepEqual(
    { ...renderer.anchorPoint(withPointOverflow, 'right') },
    { x: 662, y: 0 }
  );
  const expectedAnchors = {
    top: { x: 542, y: -20 },
    right: { x: 662, y: 0 },
    bottom: { x: 542, y: 20 },
    left: { x: 422, y: 0 },
    center: { x: 542, y: 0 }
  };
  Object.entries(expectedAnchors).forEach(([anchor, expected]) => {
    assert.deepEqual(
      { ...renderer.resolveAnchor({}, {}, { objectKey: 'arr', anchor }, overflowPlacements, elements) },
      expected,
      `${anchor} must use the stable outerframe`
    );
  });
});

test('moving a container updates its origin and every measured child together', () => {
  const { window, renderer } = rendererDomApi(true);
  const parent = window.document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const child = window.document.createElementNS('http://www.w3.org/2000/svg', 'g');
  parent.append(child);
  parent.dataset.tracePositionSpace = 'origin';
  parent.dataset.tracePositionX = '10';
  parent.dataset.tracePositionY = '20';
  child.dataset.tracePositionSpace = 'bounds';
  child.dataset.tracePositionX = '100';
  child.dataset.tracePositionY = '120';
  const placements = new Map([
    ['arr', { x: 90, y: 110, width: 120, height: 60 }],
    ['arr#0', { x: 100, y: 120, width: 40, height: 40 }]
  ]);
  const elements = new Map([['arr', parent], ['arr#0', child]]);

  renderer.shiftPlacementTree(parent, 30, 40, placements, elements);

  assert.equal(parent.dataset.tracePositionX, '40');
  assert.equal(parent.dataset.tracePositionY, '60');
  assert.equal(child.dataset.tracePositionX, '130');
  assert.equal(child.dataset.tracePositionY, '160');
  assert.deepEqual({ ...placements.get('arr') }, { x: 120, y: 150, width: 120, height: 60 });
  assert.deepEqual({ ...placements.get('arr#0') }, { x: 130, y: 160, width: 40, height: 40 });
});
