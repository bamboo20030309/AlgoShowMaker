const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { compile } = require('./helpers/compile');

const samplePath = path.join(
  __dirname, '../algorithm_sample/Backtracking/fibonacci.cpp'
);
const inputPath = path.join(
  __dirname, '../algorithm_sample/Backtracking/fibonacci-sample_input.txt'
);

test('Fibonacci sample uses the current recursion layout and preserves call relationships', async () => {
  assert.ok(process.env.ASM_TEST_BASE_URL, 'set ASM_TEST_BASE_URL to an isolated server');
  const code = fs.readFileSync(samplePath, 'utf8');
  const input = fs.readFileSync(inputPath, 'utf8');

  assert.doesNotMatch(code, /AV\.hpp|\bAV\s+av\b|TreeLayout|\/\/draw\{|frame_draw|tree\.paint/);
  assert.match(code, /@layout recursion as "fib_tree"/);
  assert.match(code, /@frame call in fib_tree/);
  assert.match(code, /@keep last as "call" in fib_tree/);

  const { trace } = await compile(code, input);
  assert.equal(trace.layouts.length, 1);
  assert.equal(trace.layouts[0].id, 'fib_tree');
  assert.equal(trace.snapshots.length, 15, 'F(5) creates one retained node for every call');

  const roots = trace.snapshots.filter(snapshot => !snapshot.layoutNode?.parentSnapshotId);
  assert.equal(roots.length, 1);
  const directChildren = trace.snapshots.filter(snapshot => (
    snapshot.layoutNode?.parentSnapshotId === roots[0].id
  ));
  assert.equal(directChildren.length, 2);
  assert.deepEqual(directChildren.map(snapshot => snapshot.layoutNode.siblingIndex), [0, 1]);

  const recursiveFrames = trace.frames.filter(frame => frame.source?.layoutId === 'fib_tree');
  assert.equal(recursiveFrames.length, 15);
  assert.ok(recursiveFrames.every(frame => frame.source.recursionActivationId));

  const finalFrame = trace.frames.at(-1);
  const resultId = Object.keys(trace.variables).find(id => (
    trace.variables[id].name === 'result' && trace.variables[id].functionName === 'main'
  ));
  assert.equal(Number(finalFrame.state[resultId].data.value), 5);
});
