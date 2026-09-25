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
  assert.doesNotMatch(code, /AV\.hpp|\bAV\s+av\b|frame_draw|start_draw|end_draw|_draw_/);
  assert.doesNotMatch(code, /這是 LCS|Longest Common Subsequence 最長共同子序列/);
  assert.match(code, /vector<vector<int>> LCS;/);
  assert.match(code, /set<string> ans;/);
  assert.match(code, /void dfs\(int x, int y, string now\)/);
  assert.match(code, /if \(S\[x - 1\] == T\[y - 1\]\)[\s\S]*dfs\(x - 1, y - 1, now \+ S\[x - 1\]\)/);
  assert.match(code, /else if \(LCS\[x - 1\]\[y\] == LCS\[x\]\[y - 1\]\)/);
  assert.match(code, /else if \(LCS\[x - 1\]\[y\] > LCS\[x\]\[y - 1\]\)/);
  assert.match(code, /LCS\[i\]\[j\] = max\(LCS\[i\]\[j - 1\], LCS\[i - 1\]\[j\]\)/);
  assert.match(code, /@object LCS render matrix with labels\(value\), row-labels\("",rowLabels\), column-labels\("",columnLabels\), marker-layout\(none\)/);
  assert.match(code, /@style LCS\[x\]\[y\] highlight/);
  assert.match(code, /@arrow from LCS\[i-1\]\[j-1\] to LCS\[i\]\[j\]/);
  assert.match(code, /@for i in \[1:n\][\s\S]*@for j in \[1:m\]/);
  assert.match(code, /@text \[[\s\S]*"background": "AV_green"/);
  assert.equal(findFrameDirectives(code).length, 10);
});

test('LCS sample builds its matrix and lists the sample answers', async () => {
  const code = fs.readFileSync(codePath, 'utf8');
  const input = fs.readFileSync(inputPath, 'utf8');
  const { trace } = await compile(code, input);
  const byName = Object.fromEntries(Object.entries(trace.variables)
    .map(([id, variable]) => [variable.name, id]));
  const last = trace.frames.at(-1);
  const matrix = last.state[byName.LCS].data.items
    .map(row => row.items.map(item => Number(item.value)));
  const answers = last.state[byName.answerList].data.items.map(item => item.value);
  const options = last.rendererOptions[byName.LCS];

  assert.equal(matrix[9][9], 5);
  assert.deepEqual(answers, ['abcde', 'edcba']);
  assert.deepEqual(Array.from(options.rowLabels.values), ['', ...'abcdedcba']);
  assert.deepEqual(Array.from(options.columnLabels.values), ['', ...'edcbabcde']);
  assert.equal(options.markerLayout, 'none');
  assert.equal(trace.frames[0].texts[0].segments.some(segment => segment.text.includes('這是 LCS')), false);
});
