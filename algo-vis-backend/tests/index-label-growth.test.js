const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { findFrameDirectives } = require('../trace-instrumenter');

function setup() {
  const dom = new JSDOM('<!doctype html><html><body><svg id="scene"></svg></body></html>', {
    runScripts: 'outside-only'
  });
  const source = fs.readFileSync(path.join(__dirname, '../public/trace-frame-tween.js'), 'utf8')
    .replace('window.ASMTraceFrameTween = {',
      'window.ASMTraceFrameTween = { indexLabelGrowthCandidate, indexLabelGrowthGeometry, applyIndexLabelGrowth,');
  dom.window.eval(source);
  return dom.window;
}

test('a bottom index label grows from the cell edge only when that cell already existed', () => {
  const window = setup();
  const tween = window.ASMTraceFrameTween;
  const ns = 'http://www.w3.org/2000/svg';
  const previousCell = window.document.createElementNS(ns, 'g');
  previousCell.dataset.traceObjectKey = 'arr#0';
  previousCell.dataset.traceSceneGeneration = '0';
  window.document.querySelector('#scene').append(previousCell);
  const label = window.document.createElementNS(ns, 'g');
  label.dataset.traceIndexLabel = '0';
  label.dataset.traceSceneGeneration = '0';
  const rect = window.document.createElementNS(ns, 'rect');
  rect.setAttribute('y', '48');
  rect.setAttribute('height', '12');
  const text = window.document.createElementNS(ns, 'text');
  label.append(rect, text);
  const entry = {
    key: 'arr#0:index', element: label, previous: null,
    keepSnapshotMember: false, sceneBoundaryEntrance: false
  };
  const placements = new Map([['arr#0', { x: 8, y: 8, width: 40, height: 40 }]]);
  const previousObjects = new Map([['arr#0', previousCell]]);
  assert.equal(tween.indexLabelGrowthCandidate(entry, placements, previousObjects), true);
  const geometry = tween.indexLabelGrowthGeometry(label);
  tween.applyIndexLabelGrowth(geometry, 0);
  assert.equal(rect.getAttribute('y'), '48');
  assert.equal(rect.getAttribute('height'), '0');
  assert.equal(text.getAttribute('opacity'), '0');
  tween.applyIndexLabelGrowth(geometry, 0.5);
  assert.equal(rect.getAttribute('height'), '6');
  tween.applyIndexLabelGrowth(geometry, 1);
  assert.equal(rect.getAttribute('height'), '12');
  assert.equal(text.hasAttribute('opacity'), false);

  assert.equal(tween.indexLabelGrowthCandidate({ ...entry, keepSnapshotMember: true },
    placements, previousObjects), false);
  assert.equal(tween.indexLabelGrowthCandidate(entry, new Map(), previousObjects), false);
});

test('labels(index) can switch back to the default value-plus-bottom-index view', () => {
  const frames = findFrameDirectives(`
#include <vector>
int main() {
  std::vector<int> arr = {3, 5};
  // @frame arr with labels(index)
  // @frame arr
}`);
  assert.equal(frames.length, 2);
  assert.equal(frames[0].rendererOptions.labels.showValue, false);
  assert.deepEqual(frames[1].rendererOptions, {});
});
