const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { findFrameDirectives } = require('../trace-instrumenter');
const { compile } = require('./helpers/compile');

const codePath = path.join(__dirname, '../algorithm_sample/DP/LCS.cpp');
const inputPath = path.join(__dirname, '../algorithm_sample/DP/LCS-sample_input.txt');

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
  assert.match(code, /@object LCS render matrix with labels\(value\), row-labels\("",S\), column-labels\("",T\), marker-layout\(none\)/);
  assert.match(code, /@object ans with labels\(value\)/);
  assert.match(code, /@style LCS\[x\]\[y\] highlight/);
  assert.match(code, /@arrow from LCS\[rr-1\]\[cc-1\] to LCS\[rr\]\[cc\]/);
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
  assert.equal(options.markerLayout, 'none');
  const bridgeArrows = window.ASMTraceModel.drawingDirectives(trace, last, 'arrows');
  assert.equal(bridgeArrows.length, 16);
  assert.deepEqual(Array.from(bridgeArrows[0].from.indexExpressions), ['0', '4']);
  assert.deepEqual(Array.from(bridgeArrows[0].to.indexExpressions), ['1', '5']);
  assert.equal(trace.frames[0].texts[0].segments.some(segment => segment.text.includes('這是 LCS')), false);
});
