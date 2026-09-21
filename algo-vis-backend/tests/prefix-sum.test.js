const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { findFrameDirectives } = require('../trace-instrumenter');
const { compile } = require('./helpers/compile');

const codePath = path.join(__dirname, '../algorithm_sample/Basic/prefix_sum.cpp');
const inputPath = path.join(__dirname, '../algorithm_sample/Basic/prefix_sum-sample_input.txt');

test('one-dimensional prefix sum sample uses only current directives', () => {
  const code = fs.readFileSync(codePath, 'utf8');
  assert.doesNotMatch(code, /AV\.hpp|\bAV\s+av\b|frame_draw|start_draw|end_draw|_draw_|@keep/);
  assert.match(code, /vector<int> num, pre;/);
  assert.match(code, /pre\[i\] = pre\[i - 1\] \+ num\[i\];/);
  assert.match(code, /int ans = pre\[R\] - pre\[L - 1\];/);
  assert.match(code, /@place num\.left-bottom at pre\.left-top offset\(0,-70\)/);
  assert.match(code, /@style num\[L:R\] background AV_green/);
  assert.match(code, /@style pre\[L-1\] background AV_red/);
  const frames = findFrameDirectives(code);
  assert.ok(frames.length >= 5);
  assert.ok(frames.every(frame => frame.objects.length === 2));
});

test('one-dimensional prefix sum sample builds the table and answers its range', async () => {
  const code = fs.readFileSync(codePath, 'utf8');
  const input = fs.readFileSync(inputPath, 'utf8');
  const { trace, window } = await compile(code, input);
  assert.equal(trace.frames.length, 24);
  const byName = Object.fromEntries(Object.entries(trace.variables)
    .map(([id, variable]) => [variable.name, id]));
  const last = trace.frames.at(-1);
  assert.deepEqual(last.state[byName.pre].data.items.slice(0, 6).map(item => Number(item.value)),
    [0, 1, 3, 6, 10, 15]);
  assert.equal(Number(last.state[byName.ans].data.value), 102);
  const styles = window.ASMTraceRules.evaluate(trace, last);
  assert.equal(styles[byName.pre]['14'].styleTypes.background, 'rgba(165, 214, 167, 0.6)');
  assert.equal(styles[byName.pre]['2'].styleTypes.background, 'rgba(239, 154, 154, 0.6)');
  assert.ok(Array.from({ length: 12 }, (_, index) => index + 3)
    .every(index => styles[byName.num][String(index)].styleTypes.background
      === 'rgba(165, 214, 167, 0.6)'));
});
