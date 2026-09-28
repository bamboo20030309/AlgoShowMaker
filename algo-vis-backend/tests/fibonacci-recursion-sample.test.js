/**
 * 測試模組：fibonacci-recursion-sample.test
 *
 * 驗證重點：fibonacci recursion sample.test 相關功能的公開行為、回歸條件與錯誤邊界。
 * 執行環境：Node.js 單元／契約測試；聚焦可重複的行為邊界。
 * 檔案結構：先準備 fixture、替代物與共用 helper，再以具名案例驗證使用者可觀察結果。
 * 維護原則：功能規格改變時同步更新案例理由；不得只放寬斷言來掩蓋失敗。
 */
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

// -----------------------------------------------------------------------------
// 測試案例：下列具名案例各自描述一項可觀察契約。
// -----------------------------------------------------------------------------
test('Fibonacci sample uses the current recursion layout and preserves call relationships', async () => {
  assert.ok(process.env.ASM_TEST_BASE_URL, 'set ASM_TEST_BASE_URL to an isolated server');
  const code = fs.readFileSync(samplePath, 'utf8');
  const input = fs.readFileSync(inputPath, 'utf8');

  assert.doesNotMatch(code, /AV\.hpp|\bAV\s+av\b|TreeLayout|\/\/draw\{|frame_draw|tree\.paint/);
  assert.match(code, /@layout recursion as "fib_tree"/);
  assert.match(code, /@layout fib_tree branch-previews off/);
  assert.doesNotMatch(code, /@layout fib_tree (?:direction top-down|mode compact|sibling-gap\b|level-gap\b|degree 2|flow-arrows\b)/,
    'the sample omits default layout settings and does not use flow arrows');
  assert.doesNotMatch(code, /string\s+call|@frame\s+(?:left|right|result)|@frame\s+left,right,result/);
  assert.match(code, /int F\(int n\)/);
  assert.match(code, /@frame n in fib_tree with display\("F\(\$\{call\}\)"\)/);
  assert.match(code, /@frame sum in fib_tree/);
  assert.match(code, /@let call = n/);
  assert.match(code, /@text "目前呼叫 F\(\$\{call\}\)" at n\.bottom/);
  assert.match(code, /@keep (?:n|sum) as "F" in fib_tree/);
  assert.match(code, /int left = F\(n - 1\);\s+int right = F\(n - 2\);/s,
    'the sample explicitly sequences the left subtree before the right subtree');

  const { trace } = await compile(code, input);
  assert.equal(trace.layouts.length, 1);
  assert.equal(trace.layouts[0].id, 'fib_tree');
  assert.equal(trace.layouts[0].showBranchPreviews, false);
  assert.equal(trace.layouts[0].showFlowArrows, false);
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
  const previewFrames = recursiveFrames.filter(frame => frame.source?.systemBranchPreview === true);
  const executionFrames = recursiveFrames.filter(frame => frame.source?.systemBranchPreview !== true);
  assert.equal(executionFrames.length, 30,
    'each of the 15 calls has one pending frame and one returned-value frame');
  assert.equal(previewFrames.length, 0,
    'recursive children appear only when their calls actually begin');
  assert.ok(recursiveFrames.every(frame => frame.source.recursionActivationId));
  assert.equal(recursiveFrames[0].snapshotIds.length, 1,
    'the first call is retained in the same frame instead of appearing one frame late');

  const initialSnapshots = trace.snapshots.filter(snapshot => !snapshot.replacesSnapshotId);
  const rootPending = initialSnapshots.find(snapshot => !snapshot.recursionParentActivationId);
  const rootChildren = initialSnapshots.filter(snapshot => (
    snapshot.recursionParentActivationId === rootPending.recursionActivationId
  )).sort((left, right) => left.recursionSiblingIndex - right.recursionSiblingIndex);
  const leftCreationFrame = trace.frames.find(frame => frame.id === rootChildren[0].createdFrameId);
  assert.ok(leftCreationFrame.snapshotIds.includes(rootChildren[0].id));
  assert.ok(!leftCreationFrame.snapshotIds.includes(rootChildren[1].id),
    'the right recursive child is not drawn while the left subtree starts');

  const rootActivation = recursiveFrames[0].source.recursionActivationId;
  const rootCalls = trace.callLifecycles.filter(event => (
    event.callerActivationId === rootActivation
    && event.source?.functionName === 'F'
  ));
  assert.deepEqual(Array.from(rootCalls, event => event.expression), ['F(n - 1)', 'F(n - 2)']);
  assert.ok(rootCalls[0].returnOrder < rootCalls[1].order,
    'the right call starts only after the complete left subtree has returned');
  assert.ok(rootCalls.every(event => event.calleeActivationId),
    'each code-call occurrence links to the recursion node it creates');

  const pendingSnapshots = initialSnapshots;
  assert.deepEqual(pendingSnapshots.map(snapshot => (
    `${snapshot.objectId}=F(${snapshot.data.value})`
  )), [
    'F=F(5)', 'F_1=F(4)', 'F_2=F(3)', 'F_3=F(2)', 'F_4=F(1)',
    'F_5=F(0)', 'F_6=F(1)', 'F_7=F(2)', 'F_8=F(1)', 'F_9=F(0)',
    'F_10=F(3)', 'F_11=F(2)', 'F_12=F(1)', 'F_13=F(0)', 'F_14=F(1)'
  ], 'keep names follow first-creation order in the depth-first recursion traversal');
  assert.ok(pendingSnapshots.every(snapshot => (
    snapshot.rendererOptions?.display?.template === 'F(${call})'
  )), 'unresolved calls keep the F(n) display template');
  assert.ok(finalSnapshots.every(snapshot => !snapshot.rendererOptions?.display),
    'returned calls remove the pending template so the numeric result is shown');

  assert.equal(Number(roots[0].data.value), 5, 'the root F(5) node is updated to its return value');
  const snapshotsById = new Map(trace.snapshots.map(snapshot => [snapshot.id, snapshot]));
  const returnedTwos = finalSnapshots.filter(snapshot => (
    Number(snapshotsById.get(snapshot.replacesSnapshotId)?.data?.value) === 2
    && Number(snapshot.data.value) === 1
  ));
  assert.equal(returnedTwos.length, 3, 'each completed F(2) node is updated from 2 to 1');
  const returnFrameLine = code.split(/\r?\n/)
    .map((line, index) => ({ line, number: index + 1 }))
    .filter(item => item.line.includes('@frame sum in fib_tree'))
    .at(-1).number;
  returnedTwos.forEach(snapshot => {
    const createdFrame = trace.frames.find(frame => frame.id === snapshot.createdFrameId);
    assert.equal(createdFrame?.source?.line, returnFrameLine,
      'F(2) must change to 1 on its return frame, not on the next recursive call');
  });
});
