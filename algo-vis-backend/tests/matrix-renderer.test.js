const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const ArrowModel = require('../public/trace-arrow-model');
const { findFrameDirectives } = require('../trace-instrumenter');
const { compile } = require('./helpers/compile');

test('matrix frame syntax keeps chained row and column bindings plus label options', () => {
  const [frame] = findFrameDirectives(`
#include <vector>
int main() {
  std::vector<std::vector<int>> grid = {{1, 2}, {3}};
  std::vector<char> rows = {'A', 'B'};
  std::vector<int> columns = {7, 8};
  int i = 0, j = 1;
  // @frame grid[i][j] with labels(none), row-labels("",rows), column-labels(blank(1),columns), inner-labels(index), gridlines(0), outerframe(false), marker-layout(inner)
}`);
  assert.equal(frame.bindings.length, 2);
  assert.deepEqual(frame.bindings.map(binding => binding.indexDimension), [0, 1]);
  assert.deepEqual(frame.bindings.map(binding => binding.indexExpression), ['i', 'j']);
  assert.equal(frame.rendererOptions.labels.showValue, false);
  assert.equal(frame.rendererOptions.labels.indexFormat, 'none');
  assert.equal(frame.rendererOptions.rowLabels.parts[0].value, '');
  assert.equal(frame.rendererOptions.columnLabels.parts[0].type, 'blank');
  assert.equal(frame.rendererOptions.innerLabels.mode, 'index');
  assert.equal(frame.rendererOptions.gridlines, 0);
  assert.equal(frame.rendererOptions.outerframe, false);
  assert.equal(frame.rendererOptions.markerLayout, 'inner');
  assert.ok(frame.rendererOptions.rowLabels.parts[1].variableId);
  assert.ok(frame.rendererOptions.columnLabels.parts[1].variableId);
});

test('matrix cell style keeps separate row and column expressions', () => {
  const [frame] = findFrameDirectives(`
#include <vector>
int main() {
  std::vector<std::vector<int>> grid = {{1, 2}, {3}};
  int i = 1, j = 0;
  // @frame grid
  // @style grid[i][j] highlight AV_red
}`);
  assert.deepEqual(frame.styles[0].selector, {
    type: 'matrix-cell', rowExpression: 'i', columnExpression: 'j'
  });
});

test('compiled vector and fixed matrices resolve custom label arrays per frame', async () => {
  const { trace, window } = await compile(`
#include <vector>
using namespace std;
int main() {
  vector<vector<int>> grid = {{1, 2}, {3}};
  vector<int> arr = {4, 5};
  int fixed[2][2] = {{4, 5}, {6, 7}};
  vector<int> rows = {9, 8};
  vector<int> columns = {7, 6};
  vector<vector<int>> inner = {{0, 1}, {0}};
  int i = 1, j = 0;
  // @frame grid[i][j] with row-labels("",rows), column-labels(blank(1),columns), inner-labels(inner), gridlines(0), outerframe(false)
  // @style grid[i][j] highlight AV_red
  // @frame fixed
  // @frame arr with index-labels("",columns), gridlines(0), outerframe(false)
}`);
  const ids = Object.fromEntries(Object.entries(trace.variables).map(([id, variable]) => [variable.name, id]));
  assert.equal(trace.variables[ids.grid].kind, 'matrix');
  assert.equal(trace.variables[ids.fixed].kind, 'matrix');
  const options = JSON.parse(JSON.stringify(trace.frames[0].rendererOptions[ids.grid]));
  assert.deepEqual(options.rowLabels.values, ['', 9, 8]);
  assert.deepEqual(options.columnLabels.values, ['', 7, 6]);
  assert.deepEqual(options.innerLabels.values, [[0, 1], [0]]);
  assert.equal(options.gridlines, 0);
  assert.equal(options.outerframe, false);
  assert.equal(Object.hasOwn(options, 'range'), false);
  const highlights = window.ASMTraceRules.evaluate(trace, trace.frames[0])[ids.grid];
  assert.equal(highlights['1,0'].styleTypes.highlight, 'rgba(239, 154, 154, 0.6)');
  const arrayOptions = JSON.parse(JSON.stringify(trace.frames[2].rendererOptions[ids.arr]));
  assert.deepEqual(arrayOptions.indexLabels.values, ['', 7, 6]);
  assert.equal(arrayOptions.gridlines, 0);
  assert.equal(arrayOptions.outerframe, false);
});

test('compiled matrix writes retain both row and column in event targets', async () => {
  const { trace } = await compile(`
#include <vector>
using namespace std;
int main() {
  vector<vector<int>> grid = {{1, 2}, {3}};
  int i = 1, j = 0;
  // @frame grid[i][j]
  grid[i][j] = 9;
  // @frame grid[i][j]
}`);
  const gridId = Object.keys(trace.variables).find(id => trace.variables[id].name === 'grid');
  const assign = trace.frames[1].events.find(event => event.type === 'assign'
    && event.targets?.some(target => target.variableId === gridId));
  assert.ok(assign);
  const target = assign.targets.find(item => item.variableId === gridId);
  assert.equal(target.indexExpression, 'i,j');
  assert.equal(Object.hasOwn(target, 'resolvedIndex'), false);
});

function rendererApi() {
  const dom = new JSDOM('<!doctype html><html><body><svg id="arraySvg"></svg></body></html>', {
    runScripts: 'outside-only'
  });
  const { window } = dom;
  window.queueMicrotask = queueMicrotask;
  window.ASMArrowModel = ArrowModel;
  window.ASMTraceRules = {
    evaluate(_document, frame) { return frame.testHighlights || {}; },
    decorations() { return []; },
    conditionMatches() { return true; },
    expressionMatches() { return true; },
    resolveExpression(_document, frame, expression) {
      const entry = Object.values(frame.state || {}).find(item => item.name === expression);
      return entry?.data?.value ?? (/^-?\d+$/.test(String(expression)) ? Number(expression) : null);
    }
  };
  window.ASMTraceModel = { diffFrame() { return []; } };
  window.ASMTraceTransitions = { defaults() { return { duration: 0, easing: 'linear' }; } };
  window.SVGElement.prototype.getBBox = function getBBox() {
    const left = Number(this.getAttribute('data-outerframe-left'));
    const top = Number(this.getAttribute('data-outerframe-top'));
    const right = Number(this.getAttribute('data-outerframe-right'));
    const bottom = Number(this.getAttribute('data-outerframe-bottom'));
    if ([left, top, right, bottom].every(Number.isFinite) && right > left && bottom > top) {
      return { x: left, y: top, width: right - left, height: bottom - top };
    }
    const rect = this.matches?.('rect') ? this : this.querySelector?.('rect');
    return {
      x: Number(rect?.getAttribute('x')) || 0, y: Number(rect?.getAttribute('y')) || 0,
      width: Number(rect?.getAttribute('width')) || 40, height: Number(rect?.getAttribute('height')) || 40
    };
  };
  window.eval(fs.readFileSync(path.join(__dirname, '../public/trace-renderer.js'), 'utf8'));
  return { window, renderer: window.ASMTraceRenderers };
}

test('original matrix renderer keeps ragged rows and isolates axis labels from cell highlights', async () => {
  const { window, renderer } = rendererApi();
  const gridId = 'main:grid@1';
  const iId = 'main:i@2';
  const jId = 'main:j@3';
  const scalar = value => ({ kind: 'scalar', value });
  const document = {
    variables: {
      [gridId]: { id: gridId, name: 'grid', kind: 'matrix' },
      [iId]: { id: iId, name: 'i', kind: 'scalar' },
      [jId]: { id: jId, name: 'j', kind: 'scalar' }
    },
    skins: { [gridId]: { renderer: 'original-matrix', options: {
      showValue: false, rowLabels: { mode: 'custom', values: ['', 'B'] },
      columnLabels: { mode: 'custom', values: ['X', 'Y'] },
      innerLabels: { mode: 'index', values: [] }, gridlines: 0, outerframe: false,
      markerLayout: 'inner'
    } } },
    snapshots: [], layouts: [], studio: {}, frames: []
  };
  const frame = {
    id: 'matrix', source: { primaryVariableId: gridId },
    state: {
      [gridId]: { name: 'grid', data: { kind: 'matrix', items: [
        { kind: 'sequence', items: [scalar(1), scalar(2)] },
        { kind: 'sequence', items: [scalar(3)] }
      ] } },
      [iId]: { name: 'i', data: scalar(1) },
      [jId]: { name: 'j', data: scalar(0) }
    },
    testHighlights: { [gridId]: { '1,0': { fill: 'pink' } } },
    events: [], bindings: [
      { mode: 'index', targetVariableId: gridId, sourceVariableId: iId, sourceVariableIds: [iId], sourceName: 'i', indexExpression: 'i', indexDimension: 0 },
      { mode: 'index', targetVariableId: gridId, sourceVariableId: jId, sourceVariableIds: [jId], sourceName: 'j', indexExpression: 'j', indexDimension: 1 }
    ], objectBindings: [], renderers: {}, rendererOptions: { [gridId]: { markerLayout: 'inner' } },
    captureOnlyVariableIds: [iId, jId], texts: [], styles: [], segments: [], arrows: [], snapshotIds: []
  };
  document.frames.push(frame);
  await renderer.renderFrame(document, frame, null, { animatePositions: false, animateEvents: false });
  assert.equal(window.document.querySelectorAll('[data-trace-arrow-target-kind="matrix-cell"]').length, 3);
  assert.equal(window.document.querySelectorAll('[data-trace-label-role="row"]').length, 2);
  assert.equal(window.document.querySelectorAll('[data-trace-label-role="column"]').length, 2);
  assert.equal(window.document.querySelectorAll('[data-trace-label-role="inner"]').length, 3);
  assert.equal(window.document.querySelector('.trace-matrix-outerframe'), null);
  assert.equal(window.document.querySelector(`[data-trace-object-key="${gridId}#1,0"] > rect`).getAttribute('fill'), 'pink');
  assert.equal(window.document.querySelector(`[data-trace-object-key="${gridId}#1,0:index"] > rect`).getAttribute('fill'), 'pink');
  assert.notEqual(window.document.querySelector(`[data-trace-object-key="${gridId}:row-label:1"] > rect`).getAttribute('fill'), 'pink');
  assert.equal(window.document.querySelector(`[data-trace-object-key="${gridId}#0,0"] > rect`).getAttribute('stroke-width'), '0');
  assert.equal(window.document.querySelectorAll('[data-trace-content-role="value"]').length, 0);
  const markerLabels = [...window.document.querySelectorAll('.trace-variable-marker-label-text')]
    .map(node => node.textContent).sort();
  assert.deepEqual(markerLabels, ['i', 'j']);
  const markerPaths = [...window.document.querySelectorAll('.trace-variable-marker-point path')]
    .map(pathNode => pathNode.getAttribute('d'));
  assert.ok(markerPaths.some(value => /-22/.test(value)), JSON.stringify(markerPaths));

  document.skins[gridId].options = {};
  frame.bindings = [];
  frame.captureOnlyVariableIds = [iId, jId];
  frame.testHighlights = {};
  await renderer.renderFrame(document, frame, frame, { animatePositions: false, animateEvents: false });
  assert.equal(window.document.querySelectorAll('[data-trace-arrow-target-kind="matrix-cell"]').length, 3);
  assert.equal(window.document.querySelectorAll('[data-trace-label-role="row"]').length, 2);
  assert.equal(window.document.querySelectorAll('[data-trace-label-role="column"]').length, 2);
  assert.equal(window.document.querySelectorAll('[data-trace-content-role="value"]').length, 3);
  assert.ok(window.document.querySelector('.trace-matrix-outerframe'));
});
