/**
 * 測試模組：lcs-sample.test
 *
 * 驗證重點：lcs sample.test 相關功能的公開行為、回歸條件與錯誤邊界。
 * 執行環境：Node.js 單元／契約測試；聚焦可重複的行為邊界。
 * 檔案結構：先準備 fixture、替代物與共用 helper，再以具名案例驗證使用者可觀察結果。
 * 維護原則：功能規格改變時同步更新案例理由；不得只放寬斷言來掩蓋失敗。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { findFrameDirectives } = require('../trace-instrumenter');
const { compile } = require('./helpers/compile');

const codePath = path.join(__dirname, '../algorithm_sample/DP/LCS.cpp');
const inputPath = path.join(__dirname, '../algorithm_sample/DP/LCS-sample_input.txt');

// -----------------------------------------------------------------------------
// 測試案例：下列具名案例各自描述一項可觀察契約。
// -----------------------------------------------------------------------------
test('LCS sample uses current matrix directives without the legacy introduction', () => {
  const code = fs.readFileSync(codePath, 'utf8');
  assert.doesNotMatch(code, /AV\.hpp|\bAV\s+av\b|frame_draw|start_draw|end_draw/);
  assert.doesNotMatch(code, /這是 LCS|Longest Common Subsequence 最長共同子序列/);
  assert.match(code, /vector<vector<int>> LCS;/);
  assert.match(code, /set<string> ans;/);
  assert.doesNotMatch(code, /\b(?:dp|bridge|pathDirection|answerList|rowLabels|columnLabels|collectLCS)\b|_draw_/);
  assert.match(code, /void dfs\(int x,\s*int y,\s*string now\)/);
  assert.match(code, /if\s*\(S\[x\s*-\s*1\]\s*==\s*T\[y\s*-\s*1\]\)[\s\S]*dfs\(x\s*-\s*1,\s*y\s*-\s*1,\s*now\s*\+\s*S\[x\s*-\s*1\]\)/);
  assert.match(code, /else if\s*\(LCS\[x\s*-\s*1\]\[y\]\s*==\s*LCS\[x\]\[y\s*-\s*1\]\)/);
  assert.match(code, /else if\s*\(LCS\[x\s*-\s*1\]\[y\]\s*>\s*LCS\[x\]\[y\s*-\s*1\]\)/);
  assert.match(code, /LCS\[i\]\[j\]\s*=\s*max\(LCS\[i\]\[j\s*-\s*1\],\s*LCS\[i\s*-\s*1\]\[j\]\)/);
  assert.match(code, /@let rows = S\.size\(\)/);
  assert.match(code, /@let columns = T\.size\(\)/);
  assert.match(code, /@object LCS render matrix with labels\(value\), row-labels\("",S\), column-labels\("",T\)/);
  assert.match(code, /@object LCS\[i\]\[j\] render matrix with labels\(value\), row-labels\("",S\), column-labels\("",T\)/);
  assert.match(code, /@object LCS\[x\]\[y\] render matrix with labels\(value\), row-labels\("",S\), column-labels\("",T\)/);
  assert.match(code, /@object ans with labels\(value\)/);
  assert.match(code, /@style LCS\[x\]\[y\] highlight/);
  assert.match(code, /@arrow from LCS\[rr-1\]\[cc-1\] to LCS\[rr\]\[cc\]/);
  assert.match(code, /@style LCS\.row-label\[i\] background AV_green! when S\[i-1\] == T\[j-1\]/);
  assert.match(code, /@style LCS\.column-label\[j\] background AV_red! when S\[i-1\] != T\[j-1\]/);
  assert.match(code, /@for rr in \[1:rows\][\s\S]*@for cc in \[1:columns\]/);
  assert.match(code, /when S\[rr-1\] == T\[cc-1\] && LCS\[rr\]\[cc\] == LCS\[rr-1\]\[cc-1\] \+ 1/);
  assert.match(code, /@text \[[\s\S]*"background": "AV_green"/);
  assert.equal(findFrameDirectives(code).length, 10);
});

test('LCS sample builds its matrix and lists the sample answers', async () => {
  const code = fs.readFileSync(codePath, 'utf8');
  const input = fs.readFileSync(inputPath, 'utf8');
  const { trace, window } = await compile(code, input);
  const byName = Object.fromEntries(Object.entries(trace.variables)
    .map(([id, variable]) => [variable.name, id]));
  const last = trace.frames.at(-1);
  const matrix = last.state[byName.LCS].data.items
    .map(row => row.items.map(item => Number(item.value)));
  const answers = last.state[byName.ans].data.items.map(item => item.value);
  const options = last.rendererOptions[byName.LCS];

  assert.equal(matrix[9][9], 5);
  assert.deepEqual(answers, ['abcde', 'edcba']);
  assert.deepEqual(Array.from(options.rowLabels.values), ['', ...'abcdedcba']);
  assert.deepEqual(Array.from(options.columnLabels.values), ['', ...'edcbabcde']);
  assert.equal(options.markerLayout, undefined);
  const buildFrames = trace.frames.filter(frame => frame.bindings.some(binding => binding.sourceName === 'i'));
  const buildFrame = buildFrames[0];
  const dfsFrame = trace.frames.find(frame => frame.bindings.some(binding => binding.sourceName === 'x'));
  assert.deepEqual(Array.from(buildFrame.bindings, binding => [binding.sourceName, binding.indexDimension]), [
    ['i', 0], ['j', 1]
  ]);
  assert.deepEqual(Array.from(dfsFrame.bindings, binding => [binding.sourceName, binding.indexDimension]), [
    ['x', 0], ['y', 1]
  ]);
  const maxAssignments = buildFrames.flatMap(frame => frame.events.filter(event => (
    event.selectionOperation === 'max'
  )));
  assert.ok(maxAssignments.length > 0, 'mismatching characters use selected-source max events');
  assert.ok(maxAssignments.every(event => ['source-left', 'source-right']
    .includes(event.selectedSourceRole)));
  assert.ok(maxAssignments.every(event => (
    Number(event.payload.source.value) === Number(event.payload.after.value)
  )));
  const [iBinding, jBinding] = buildFrame.bindings;
  const iValue = Number(buildFrame.state[iBinding.sourceVariableId].data.value);
  const jValue = Number(buildFrame.state[jBinding.sourceVariableId].data.value);
  const sameCharacter = options.rowLabels.values[iValue] === options.columnLabels.values[jValue];
  const expectedLabelColor = sameCharacter
    ? '#a5d6a7'
    : '#ef9a9a';
  const labelHighlights = window.ASMTraceRules.evaluate(trace, buildFrame)[byName.LCS];
  assert.equal(labelHighlights[`$row-label:${iValue}`].styleTypes.background, expectedLabelColor);
  assert.equal(labelHighlights[`$column-label:${jValue}`].styleTypes.background, expectedLabelColor);
  const matchingBuildFrame = buildFrames.find(frame => {
    const [rowBinding, columnBinding] = frame.bindings;
    const row = Number(frame.state[rowBinding.sourceVariableId].data.value);
    const column = Number(frame.state[columnBinding.sourceVariableId].data.value);
    return options.rowLabels.values[row] === options.columnLabels.values[column];
  });
  assert.ok(matchingBuildFrame, 'the sample must contain a matching-character build frame');
  const [matchingRowBinding, matchingColumnBinding] = matchingBuildFrame.bindings;
  const matchingRow = Number(matchingBuildFrame.state[matchingRowBinding.sourceVariableId].data.value);
  const matchingColumn = Number(matchingBuildFrame.state[matchingColumnBinding.sourceVariableId].data.value);
  const matchingHighlights = window.ASMTraceRules.evaluate(trace, matchingBuildFrame)[byName.LCS];
  assert.equal(matchingHighlights[`$row-label:${matchingRow}`].styleTypes.background, '#a5d6a7');
  assert.equal(matchingHighlights[`$column-label:${matchingColumn}`].styleTypes.background, '#a5d6a7');
  const bridgeArrows = window.ASMTraceModel.drawingDirectives(trace, last, 'arrows');
  assert.equal(bridgeArrows.length, 16);
  assert.deepEqual(Array.from(bridgeArrows[0].from.indexExpressions), ['0', '4']);
  assert.deepEqual(Array.from(bridgeArrows[0].to.indexExpressions), ['1', '5']);
  const deepestDfsFrame = trace.frames.filter(frame => frame.source?.function === 'dfs')
    .sort((left, right) => (right.source.recursionAncestorActivationIds?.length || 0)
      - (left.source.recursionAncestorActivationIds?.length || 0))[0];
  const activePath = window.ASMTraceModel.returnTrailArrows(trace, deepestDfsFrame);
  assert.equal(activePath.length, deepestDfsFrame.source.recursionAncestorActivationIds.length);
  assert.ok(activePath.every(arrow => arrow.trailActivationId));
  const deepestIndex = trace.frames.indexOf(deepestDfsFrame);
  const returnedFrame = trace.frames.slice(deepestIndex + 1)
    .find(frame => frame.source?.function === 'dfs'
      && (frame.source.recursionAncestorActivationIds?.length || 0) < activePath.length);
  assert.ok(returnedFrame, 'the sample must return from the deepest DFS branch');
  assert.ok(window.ASMTraceModel.returnTrailArrows(trace, returnedFrame).length < activePath.length,
    'returning from recursion removes arrows that no longer belong to the active call path');
  assert.equal(trace.frames[0].texts[0].segments.some(segment => segment.text.includes('這是 LCS')), false);
});
