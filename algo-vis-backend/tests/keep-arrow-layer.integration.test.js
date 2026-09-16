const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const ArrowModel = require('../public/trace-arrow-model');
const { compile } = require('./helpers/compile');

const source = `#include <bits/stdc++.h>
using namespace std;
int main() {
  vector<int> arr = {0,5,7,2,1,9,4};
  // @frame arr
  // @keep arr as "init"
  // @frame arr render heap with range(1,6) at keep.bottom offset(0,40)
  // @keep arr as "tree_intro"
  // @frame arr render heap with range(1,6) at keep.bottom offset(0,40)
}`;

test('automatic keep arrows render without stealing pointer events', async () => {
  const { trace } = await compile(source);
  assert.equal(trace.frames.length, 3);
  const dom = new JSDOM('<!doctype html><html><body><svg id="arraySvg"></svg></body></html>', {
    runScripts: 'outside-only'
  });
  const { window } = dom;
  window.queueMicrotask = queueMicrotask;
  window.ASMArrowModel = ArrowModel;
  window.ASMTraceRules = {
    evaluate() { return {}; }, decorations() { return []; },
    conditionMatches() { return true; }, expressionMatches() { return true; },
    resolveExpression(_document, _frame, expression) { return Number(expression); }
  };
  window.ASMTraceModel = { diffFrame() { return []; } };
  window.ASMTraceTransitions = { defaults() { return { duration: 0, easing: 'linear' }; } };
  window.eval(fs.readFileSync(path.join(__dirname, '../public/trace-renderer.js'), 'utf8'));
  const renderer = window.ASMTraceRenderers;
  await renderer.renderFrame(trace, trace.frames[0], null, {
    animatePositions: false, animateEvents: false
  });
  await renderer.renderFrame(trace, trace.frames[1], trace.frames[0], {
    animatePositions: false, animateEvents: false
  });
  const keepArrowLayer = window.document.querySelector('#asm-trace-root .asm-trace-keep-arrows');
  assert.ok(keepArrowLayer, 'the first @keep creates an automatic arrow layer');
  assert.equal(keepArrowLayer.getAttribute('pointer-events'), 'none');
  assert.ok(keepArrowLayer.querySelector('.asm-trace-keep-arrow'));
});
