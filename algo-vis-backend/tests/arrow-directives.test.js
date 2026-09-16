const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const ArrowModel = require('../public/trace-arrow-model');
const { findArrowDirectives, findFrameDirectives } = require('../trace-instrumenter');
const { compile } = require('./helpers/compile');

const source = `
#include <vector>
int main() {
  std::vector<int> arr = {3, 1};
  int i = 0;
  // @frame arr[i]
  // @arrow from arr[i].bottom offset(0,8) to arr[1].top offset(0,-8) as "move_link" color AV_red width 2 head both line curve dash 6,4 when i == 0
}
`;

test('@arrow parses semantic endpoints, stable ID, style, offsets and condition', () => {
  const [arrow] = findArrowDirectives(source);
  assert.equal(arrow.id, 'move_link');
  assert.equal(arrow.fromTarget.targetName, 'arr');
  assert.deepEqual(arrow.fromTarget.indexExpressions, ['i']);
  assert.equal(arrow.fromTarget.anchor, 'bottom');
  assert.equal(arrow.fromTarget.offsetY, 8);
  assert.equal(arrow.toTarget.offsetY, -8);
  assert.deepEqual(arrow.style, {
    color: 'AV_red', width: 2, head: 'both', line: 'curve', dash: '6,4'
  });
  assert.equal(arrow.when.expression, 'i == 0');

  const [frame] = findFrameDirectives(source);
  assert.equal(frame.arrows.length, 1);
  assert.match(frame.arrows[0].from.targetVariableId, /:arr@/);
  assert.equal(frame.arrows[0].to.targetVariableId, frame.arrows[0].from.targetVariableId);
});

test('@arrow defaults omitted endpoint anchors to center', () => {
  const arrowSource = `
#include <vector>
int main() {
  std::vector<int> arr = {3, 1};
  // @frame arr
  // @arrow from arr[0] offset(0,8) to arr[1]
  // @arrow from arr to canvas
}`;
  const arrows = findArrowDirectives(arrowSource);
  assert.equal(arrows.length, 2);
  assert.equal(arrows[0].fromTarget.anchor, 'center');
  assert.equal(arrows[0].toTarget.anchor, 'center');
  assert.deepEqual(arrows[0].fromTarget.indexExpressions, ['0']);
  assert.deepEqual(arrows[0].toTarget.indexExpressions, ['1']);
  assert.equal(arrows[0].fromTarget.offsetY, 8);
  assert.equal(arrows[1].fromTarget.anchor, 'center');
  assert.equal(arrows[1].toTarget.anchor, 'center');
  assert.equal(arrows[1].toTarget.canvas, true);

  const [frame] = findFrameDirectives(arrowSource);
  assert.equal(frame.arrows.length, 2);
  assert.equal(frame.arrows[0].from.anchor, 'center');
  assert.equal(frame.arrows[0].to.anchor, 'center');

  const [matrixArrow] = findArrowDirectives('// @arrow from grid[0][1] to grid[1][0].top');
  assert.deepEqual(matrixArrow.fromTarget.indexExpressions, ['0', '1']);
  assert.equal(matrixArrow.fromTarget.anchor, 'center');
  assert.equal(matrixArrow.toTarget.anchor, 'top');
});

test('@arrow keeps nested array lookups inside a complete cell index', () => {
  const [arrow] = findArrowDirectives(
    '// @arrow from prime[j] to isprime[i*prime[j]].top color AV_green width 3');
  assert.deepEqual(arrow.fromTarget.indexExpressions, ['j']);
  assert.deepEqual(arrow.toTarget.indexExpressions, ['i*prime[j]']);
  assert.equal(arrow.toTarget.anchor, 'top');
  const [matrixArrow] = findArrowDirectives(
    '// @arrow from grid[prime[j]][i+1] to grid[0][1]');
  assert.deepEqual(matrixArrow.fromTarget.indexExpressions, ['prime[j]', 'i+1']);
  assert.throws(() => findArrowDirectives('// @arrow from prime[j] to isprime[i*prime[j]'),
    /定位目標無效/);
});

test('@arrow rejects missing endpoints and invalid options', () => {
  assert.throws(() => findArrowDirectives('// @arrow from arr.bottom'), /缺少 to/);
  assert.throws(() => findArrowDirectives('// @arrow from arr.bottom to arr.top head side'), /head 只支援/);
  assert.throws(() => findArrowDirectives('// @arrow from arr.bottom to arr.top width 0'), /width 必須是正數/);
});

test('@arrow when owns the remaining condition text', () => {
  const [arrow] = findArrowDirectives(
    '// @arrow from canvas.left to canvas.right width 2 when width > 0 && color != 1');
  assert.equal(arrow.style.width, 2);
  assert.equal(arrow.when.expression, 'width > 0 && color != 1');
});

test('shared arrow geometry preserves the original drawArrow margins', () => {
  const geometry = ArrowModel.geometry(
    { x: 0, y: 0 }, { x: 100, y: 0 },
    { indexExpression: 'i', anchor: 'center' },
    { indexExpression: 'j', anchor: 'center' },
    { width: 4, headStart: 'none', headEnd: 'arrow' }
  );
  assert.equal(geometry.x1, 12);
  assert.equal(geometry.x2, 76);
  assert.equal(geometry.marginStart, 12);
  assert.equal(geometry.marginEnd, 24);
});

test('directive, Studio and draw arrows share endpoint and foreground defaults', () => {
  for (const source of ['directive', 'studio', 'draw']) {
    const arrow = ArrowModel.normalize({
      id: 'link', source,
      from: { ref: 'arr', index: 1 },
      to: { group: 'grid', row: 2, col: 3 },
      style: { color: 'AV_red', width: 3 }
    });
    assert.equal(arrow.layer, 'foreground');
    assert.equal(arrow.from.objectKey, 'arr');
    assert.deepEqual(arrow.from.indexExpressions, ['1']);
    assert.equal(arrow.to.objectKey, 'grid');
    assert.deepEqual(arrow.to.indexExpressions, ['2', '3']);
    assert.equal(arrow.style.color, ArrowModel.COLORS.AV_red);
  }
  assert.equal(ArrowModel.normalize({ source: 'layout' }).layer, 'background');
});

test('presented arrow bounds follow SVG transforms and vanish with endpoints', () => {
  const dom = new JSDOM('<svg><g id="root"><g id="cell"><rect x="0" y="0" width="52" height="52"/></g></g></svg>');
  const root = dom.window.document.querySelector('#root');
  const cell = dom.window.document.querySelector('#cell');
  const rect = cell.querySelector('rect');
  function matrix(x, y) {
    return { a: 1, b: 0, c: 0, d: 1, e: x, f: y,
      inverse() { return matrix(-x, -y); },
      multiply(other) { return matrix(x + other.e, y + other.f); } };
  }
  root.getScreenCTM = () => matrix(100, 50);
  cell.getScreenCTM = () => matrix(190, 120);
  cell.getBBox = () => ({ x: 0, y: 0, width: 52, height: 52 });
  rect.getScreenCTM = () => matrix(190, 120);
  rect.getBBox = () => ({ x: 0, y: 0, width: 52, height: 52 });
  assert.equal(cell.isConnected, true);
  assert.equal(typeof cell.getScreenCTM, 'function');
  assert.deepEqual(ArrowModel.presentedBounds(cell, root), {
    x: 90, y: 70, width: 52, height: 52
  });
  cell.setAttribute('opacity', '0');
  assert.equal(ArrowModel.presentedBounds(cell, root), null);
  cell.removeAttribute('opacity');
  cell.remove();
  assert.equal(ArrowModel.presentedBounds(cell, root), null);
});

test('shared arrow targets expose stable keys and human-readable labels', () => {
  const dom = new JSDOM('<svg><g id="cell"></g></svg>');
  const cell = dom.window.document.querySelector('#cell');
  ArrowModel.registerTarget(cell, {
    objectKey: 'matrix', objectLabel: 'grid', indices: [2, 3], kind: 'matrix-cell'
  });
  assert.equal(ArrowModel.targetKey('matrix', [2, 3]), 'matrix#2,3');
  assert.equal(ArrowModel.targetLabel('grid', [2, 3]), 'grid[2][3]');
  assert.equal(cell.dataset.traceArrowTarget, '1');
  assert.equal(cell.dataset.traceArrowTargetKey, 'matrix#2,3');
  assert.equal(cell.dataset.traceArrowTargetLabel, 'grid[2][3]');
  assert.equal(cell.getAttribute('aria-label'), '箭頭目標：grid[2][3]');
});

function rendererDomApi() {
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
    expressionMatches() { return true; },
    resolveExpression(_document, _frame, expression) { return Number(expression); }
  };
  window.ASMTraceModel = { diffFrame() { return []; } };
  window.ASMTraceTransitions = { defaults() { return { duration: 0, easing: 'linear' }; } };
  window.eval(fs.readFileSync(path.join(__dirname, '../public/trace-renderer.js'), 'utf8'));
  return { window, renderer: window.ASMTraceRenderers };
}

test('rendered primary objects use the shared canvas.top offset(0,80) default', async () => {
  const { renderer } = rendererDomApi();
  const variableId = 'main:arr@1';
  const document = {
    variables: { [variableId]: { id: variableId, name: 'arr', kind: 'sequence' } },
    skins: {}, snapshots: [], layouts: [], studio: {}, frames: []
  };
  const frame = {
    id: 'default-placement', source: { primaryVariableId: variableId },
    state: { [variableId]: { data: { kind: 'sequence', items: [{ kind: 'scalar', value: 3 }] } } },
    events: [], bindings: [], objectBindings: [], renderers: {}, rendererOptions: {},
    captureOnlyVariableIds: [], texts: [], styles: [], segments: [], arrows: [], snapshotIds: []
  };
  document.frames.push(frame);
  await renderer.renderFrame(document, frame, null, { animatePositions: false, animateEvents: false });
  const placement = renderer.currentPlacement(variableId, false);
  assert.ok(placement);
  assert.equal(Math.round(placement.x + placement.width / 2), 550);
  assert.equal(Math.round(placement.y + placement.height), 72);
});

test('directive arrows render from the shared model after object placement', async () => {
  const { window, renderer } = rendererDomApi();
  const fromId = 'main:left@1';
  const toId = 'main:right@2';
  const document = {
    variables: {
      [fromId]: { id: fromId, name: 'left', kind: 'sequence' },
      [toId]: { id: toId, name: 'right', kind: 'sequence' }
    },
    skins: {}, snapshots: [], layouts: [], studio: {}, frames: []
  };
  const frame = {
    id: 'frame-0', source: {},
    state: {
      [fromId]: { data: { kind: 'sequence', items: [{ kind: 'scalar', value: 3 }] } },
      [toId]: { data: { kind: 'sequence', items: [{ kind: 'scalar', value: 1 }] } }
    },
    events: [], bindings: [], objectBindings: [], renderers: {}, rendererOptions: {},
    captureOnlyVariableIds: [], texts: [], styles: [], segments: [], snapshotIds: [],
    arrows: [{
      id: 'move_link', source: 'directive',
      from: { targetVariableId: fromId, anchor: 'bottom' },
      to: { targetVariableId: toId, anchor: 'top' },
      style: { color: 'AV_red', width: 2, head: 'end', line: 'straight', dash: '6,4' }
    }]
  };
  document.frames.push(frame);
  await renderer.renderFrame(document, frame, null, { animatePositions: false, animateEvents: false });
  const arrow = window.document.querySelector('.asm-trace-directive-arrows line');
  assert.ok(arrow, window.document.body.innerHTML);
  assert.equal(arrow.getAttribute('stroke'), 'rgba(239, 154, 154, 0.6)');
  assert.equal(arrow.getAttribute('stroke-width'), '2');
  assert.equal(arrow.getAttribute('stroke-dasharray'), '6,4');
  assert.match(arrow.getAttribute('marker-end'), /arrowhead/);
  assert.equal(arrow.dataset.traceArrowSource, 'directive');
});

test('one-dimensional and two-dimensional cells share the arrow target registry', async () => {
  const { window, renderer } = rendererDomApi();
  window.SVGElement.prototype.getBBox = function getBBox() {
    const rect = this.matches?.('rect') ? this : this.querySelector?.('rect');
    return {
      x: Number(rect?.getAttribute('x')) || 0,
      y: Number(rect?.getAttribute('y')) || 0,
      width: Number(rect?.getAttribute('width')) || 52,
      height: Number(rect?.getAttribute('height')) || 52
    };
  };
  const arrayId = 'main:arr@1';
  const matrixId = 'main:grid@2';
  const document = {
    variables: {
      [arrayId]: { id: arrayId, name: 'arr', kind: 'sequence' },
      [matrixId]: { id: matrixId, name: 'grid', kind: 'matrix' }
    },
    skins: {}, snapshots: [], layouts: [], studio: {}, frames: []
  };
  const scalar = value => ({ kind: 'scalar', value });
  const frame = {
    id: 'cell-targets', source: {},
    state: {
      [arrayId]: { data: { kind: 'sequence', items: [scalar(3), scalar(1)] } },
      [matrixId]: { data: { kind: 'matrix', items: [
        { kind: 'sequence', items: [scalar(4), scalar(5)] },
        { kind: 'sequence', items: [scalar(6), scalar(7)] }
      ] } }
    },
    events: [], bindings: [], objectBindings: [], renderers: {}, rendererOptions: {},
    captureOnlyVariableIds: [], texts: [], styles: [], segments: [], snapshotIds: [],
    arrows: [{
      id: 'cell-link', source: 'directive',
      from: { targetVariableId: arrayId, indexExpression: '1', anchor: 'bottom' },
      to: { targetVariableId: matrixId, indexExpression: '1,0', anchor: 'top' },
      style: { color: 'black', width: 2, head: 'end', line: 'straight' }
    }]
  };
  document.frames.push(frame);
  await renderer.renderFrame(document, frame, null, { animatePositions: false, animateEvents: false });
  const targets = renderer.currentArrowTargets();
  assert.ok(targets.some(target => target.key === `${arrayId}#1` && target.label === 'arr[1]'));
  assert.ok(targets.some(target => target.key === `${matrixId}#1,0` && target.label === 'grid[1][0]'));
  assert.ok(window.document.querySelector('.asm-trace-directive-arrows line'),
    JSON.stringify(window.document.querySelector('#asm-trace-root')?.dataset || {}));
});

const matrixSource = `
int main() {
  int grid[2][2] = {{1, 2}, {3, 4}};
  // @frame grid
  // @arrow from grid[0][1].bottom to grid[1][0].top
}`;

test('@arrow accepts C++-style two-dimensional cell endpoints', () => {
  const [arrow] = findArrowDirectives(matrixSource);
  assert.deepEqual(arrow.fromTarget.indexExpressions, ['0', '1']);
  assert.deepEqual(arrow.toTarget.indexExpressions, ['1', '0']);
});

test('compiled two-dimensional arrow endpoints render against registered cells', async () => {
  const { trace } = await compile(matrixSource);
  const { window, renderer } = rendererDomApi();
  window.SVGElement.prototype.getBBox = function getBBox() {
    const rect = this.matches?.('rect') ? this : this.querySelector?.('rect');
    return {
      x: Number(rect?.getAttribute('x')) || 0,
      y: Number(rect?.getAttribute('y')) || 0,
      width: Number(rect?.getAttribute('width')) || 52,
      height: Number(rect?.getAttribute('height')) || 52
    };
  };
  const matrixId = Object.keys(trace.variables).find(id => trace.variables[id].name === 'grid');
  trace.skins[matrixId].renderer = 'matrix';
  await renderer.renderFrame(trace, trace.frames[0], null, { animatePositions: false, animateEvents: false });
  assert.equal(renderer.currentArrowTargets().filter(target => target.kind === 'matrix-cell').length, 4);
  assert.ok(window.document.querySelector('.asm-trace-directive-arrows line'),
    JSON.stringify({
      root: window.document.querySelector('#asm-trace-root')?.dataset || {},
      targets: renderer.currentArrowTargets(),
      arrow: trace.frames[0].arrows[0]
    }));
});

test('compiled trace keeps @arrow on the same manual frame', async () => {
  const { trace } = await compile(source);
  assert.equal(trace.frames.length, 1);
  assert.equal(trace.frames[0].arrows.length, 1);
  assert.equal(trace.frames[0].arrows[0].id, 'move_link');
});

test('compiled anchorless @arrow renders between array cells', async () => {
  const arrowSource = `
#include <vector>
int main() {
  std::vector<int> arr = {4, 1, 3, 2};
  // @frame arr
  // @arrow from arr[0] to arr[3]
}`;
  const { trace } = await compile(arrowSource);
  assert.equal(trace.frames[0].arrows[0].from.anchor, 'center');
  assert.equal(trace.frames[0].arrows[0].to.anchor, 'center');
  const { window, renderer } = rendererDomApi();
  window.SVGElement.prototype.getBBox = function getBBox() {
    const rect = this.matches?.('rect') ? this : this.querySelector?.('rect');
    return {
      x: Number(rect?.getAttribute('x')) || 0,
      y: Number(rect?.getAttribute('y')) || 0,
      width: Number(rect?.getAttribute('width')) || 52,
      height: Number(rect?.getAttribute('height')) || 52
    };
  };
  await renderer.renderFrame(trace, trace.frames[0], null, {
    animatePositions: false, animateEvents: false
  });
  assert.ok(window.document.querySelector('.asm-trace-directive-arrows line'), JSON.stringify({
    arrow: trace.frames[0].arrows[0],
    targets: renderer.currentArrowTargets(),
    root: window.document.querySelector('#asm-trace-root')?.dataset || {}
  }));
});

test('anchorless @arrow renders between cells of a ranged @object array', async () => {
  const { trace } = await compile(`#include <bits/stdc++.h>
using namespace std;
int main() {
  int n = 20;
  vector<int> isprime(n + 5, 1);
  vector<int> prime = {2, 3};
  // @frame
  // @object isprime with range(1,n), columns(10), labels(index)
  // @object prime with columns(10), labels(value)
  // @place prime.top-left at isprime.bottom-left offset(0,60)
  // @arrow from isprime[1] to isprime[12]
  return 0;
}`);
  const frame = trace.frames[0];
  assert.equal(frame.arrows.length, 1);
  const { window, renderer } = rendererDomApi();
  window.SVGElement.prototype.getBBox = function getBBox() {
    const rect = this.matches?.('rect') ? this : this.querySelector?.('rect');
    return {
      x: Number(rect?.getAttribute('x')) || 0,
      y: Number(rect?.getAttribute('y')) || 0,
      width: Number(rect?.getAttribute('width')) || 52,
      height: Number(rect?.getAttribute('height')) || 52
    };
  };
  await renderer.renderFrame(trace, frame, null, {
    animatePositions: false, animateEvents: false
  });
  assert.equal(window.document.querySelector('#asm-trace-root')?.getAttribute('data-trace-directive-arrow-unresolved'), '0');
  const foreground = window.document.querySelector('#asm-trace-root')?.lastElementChild;
  assert.equal(foreground?.classList.contains('asm-trace-foreground-arrows'), true);
  assert.ok(foreground.querySelector('.asm-trace-directive-arrows'));
  assert.ok(window.document.querySelector('.asm-trace-directive-arrows line'), JSON.stringify({
    arrow: frame.arrows[0], targets: renderer.currentArrowTargets()
  }));
});

test('nested @arrow index resolves from captured C++ arrays and renders the target cell', async () => {
  const { trace } = await compile(`#include <bits/stdc++.h>
using namespace std;
int main() {
  int i = 2, j = 0;
  vector<int> prime = {2, 3};
  vector<int> isprime(20, 1);
  // @frame
  // @object isprime with range(1,19), columns(10), labels(index)
  // @object prime with labels(value)
  // @arrow from prime[j] to isprime[i*prime[j]] color AV_green width 3
  return 0;
}`);
  const frame = trace.frames[0];
  assert.deepEqual(Array.from(frame.arrows[0].to.indexExpressions), ['i*prime[j]']);
  const { window, renderer } = rendererDomApi();
  window.eval(fs.readFileSync(path.join(__dirname, '../public/trace-model.js'), 'utf8'));
  window.eval(fs.readFileSync(path.join(__dirname, '../public/trace-rules.js'), 'utf8'));
  assert.equal(window.ASMTraceRules.resolveExpression(trace, frame, 'i*prime[j]'), 4);
  window.SVGElement.prototype.getBBox = function getBBox() {
    const rect = this.matches?.('rect') ? this : this.querySelector?.('rect');
    return {
      x: Number(rect?.getAttribute('x')) || 0,
      y: Number(rect?.getAttribute('y')) || 0,
      width: Number(rect?.getAttribute('width')) || 52,
      height: Number(rect?.getAttribute('height')) || 52
    };
  };
  await renderer.renderFrame(trace, frame, null, {
    animatePositions: false, animateEvents: false
  });
  assert.equal(window.document.querySelector('#asm-trace-root')?.getAttribute('data-trace-directive-arrow-unresolved'), '0',
    JSON.stringify({ arrow: frame.arrows[0], targets: renderer.currentArrowTargets() }));
  assert.ok(window.document.querySelector('.asm-trace-directive-arrows line'));
});
