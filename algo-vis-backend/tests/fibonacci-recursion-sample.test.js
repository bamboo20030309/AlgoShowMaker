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
  assert.doesNotMatch(code, /string\s+call|@frame\s+(?:left|right|result)|@frame\s+left,right,result/);
  assert.match(code, /@frame value in fib_tree/);
  assert.match(code, /@let call = n/);
  assert.match(code, /@keep value as "F" in fib_tree/);

  const { trace } = await compile(code, input);
  assert.equal(trace.layouts.length, 1);
  assert.equal(trace.layouts[0].id, 'fib_tree');
  const finalSnapshotIds = new Set(trace.frames.at(-1).snapshotIds);
  const finalSnapshots = trace.snapshots.filter(snapshot => finalSnapshotIds.has(snapshot.id));
  assert.equal(finalSnapshots.length, 15, 'F(5) leaves one active node for every call');
  assert.ok(finalSnapshots.every(snapshot => snapshot.label === 'F'),
    'every recursion node keeps the requested F label while its canvas object ID stays unique');
  assert.equal(new Set(finalSnapshots.map(snapshot => snapshot.objectId)).size, 15);

  const roots = finalSnapshots.filter(snapshot => !snapshot.layoutNode?.parentSnapshotId);
  assert.equal(roots.length, 1);
  const directChildren = finalSnapshots.filter(snapshot => (
    snapshot.recursionParentActivationId === roots[0].recursionActivationId
  ));
  assert.equal(directChildren.length, 2);
  assert.deepEqual(directChildren.map(snapshot => snapshot.layoutNode.siblingIndex), [0, 1]);

  const recursiveFrames = trace.frames.filter(frame => frame.source?.layoutId === 'fib_tree');
  assert.equal(recursiveFrames.length, 22);
  assert.ok(recursiveFrames.every(frame => frame.source.recursionActivationId));
  assert.equal(recursiveFrames[0].snapshotIds.length, 1,
    'the first call is retained in the same frame instead of appearing one frame late');

  assert.equal(Number(roots[0].data.value), 5, 'the root F(5) node is updated to its return value');
  const returnedTwos = finalSnapshots.filter(snapshot => (
    snapshot.replacesSnapshotId && Number(snapshot.data.value) === 1
  ));
  assert.equal(returnedTwos.length, 3, 'each completed F(2) node is updated from 2 to 1');
  const returnFrameLine = code.split(/\r?\n/)
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(item => item.line.includes('@frame value in fib_tree'))
    .at(-1).number;
  returnedTwos.forEach(snapshot => {
    const createdFrame = trace.frames.find(frame => frame.id === snapshot.createdFrameId);
    assert.equal(createdFrame?.source?.line, returnFrameLine,
      'F(2) must change to 1 on its return frame, not on the next recursive call');
  });
});
