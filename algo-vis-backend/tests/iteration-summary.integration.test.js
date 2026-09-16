const { test } = require('node:test');
const assert = require('node:assert/strict');
const { compile } = require('./helpers/compile');

test('iteration.last resolves the completed inner-loop lifetime without creating a visible object', async () => {
  const { trace, window } = await compile(`#include <bits/stdc++.h>
using namespace std;

// @preset loop_view
// @object values
// @style values[0:iteration.last(j)] focus
// @endpreset

int main() {
  vector<int> values = {10, 20, 30, 40, 50};
  for (int i=2; i<=4; i++) {
    // @frame use loop_view
    for (int j=0; j<i; j++) {
      // @frame use loop_view
    }
    // @frame use loop_view
  }
  return 0;
}`);

  const framesWithoutJ = trace.frames.filter(frame => !Object.values(frame.state || {})
    .some(entry => entry?.name === 'j'));
  const outerFrames = framesWithoutJ.filter((frame, index) => index % 2 === 0);
  const afterFrames = framesWithoutJ.filter((frame, index) => index % 2 === 1);
  assert.equal(outerFrames.length, 3);
  assert.equal(afterFrames.length, 3);
  assert.deepEqual(
    Array.from(outerFrames, frame => window.ASMTraceRules.resolveExpression(
      trace, frame, 'iteration.last(j)'
    )),
    [1, 2, 3]
  );
  assert.deepEqual(
    Array.from(afterFrames, frame => window.ASMTraceRules.resolveExpression(
      trace, frame, 'iteration.last(j)'
    )),
    [1, 2, 3]
  );
  assert.equal(framesWithoutJ.length, 6);
  assert.ok(trace.frames.every(frame => frame.styles[0]?.selector?.endExpression
    === 'iteration.last(j)'));
  assert.ok(trace.frames.every(frame => !Object.values(frame.state || {})
    .some(entry => entry?.name === 'iteration')));
  assert.equal(Object.prototype.propertyIsEnumerable.call(trace, 'iterationSummaries'), false);
  assert.equal(JSON.stringify(trace).includes('iterationSummaries'), false);
});

test('iteration.last can be used by a style condition and stays scoped to each loop lifetime', async () => {
  const { trace, window } = await compile(`#include <bits/stdc++.h>
using namespace std;

int main() {
  vector<int> values = {1, 2, 3, 4, 5};
  for (int i=2; i<=3; i++) {
    // @frame values
    // @style values[0:4] background when index <= iteration.last(j)
    for (int j=0; j<i; j++) {
      // @frame values
      // @style values[0:4] background when index <= iteration.last(j)
    }
  }
  return 0;
}`);

  const valuesId = Object.keys(trace.variables).find(id => trace.variables[id].name === 'values');
  const outerFrames = trace.frames.filter(frame => !Object.values(frame.state || {})
    .some(entry => entry?.name === 'j'));
  assert.deepEqual(Array.from(outerFrames, frame =>
    Object.keys(window.ASMTraceRules.evaluate(trace, frame)[valuesId] || {})), [
    ['0', '1'],
    ['0', '1', '2']
  ]);
});
