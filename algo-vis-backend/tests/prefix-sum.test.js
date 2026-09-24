const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { findFrameDirectives } = require('../trace-instrumenter');
const { compile } = require('./helpers/compile');

const codePath = path.join(__dirname, '../algorithm_sample/Basic/prefix_sum.cpp');
const inputPath = path.join(__dirname, '../algorithm_sample/Basic/prefix_sum-sample_input.txt');
const matrixCodePath = path.join(__dirname, '../algorithm_sample/Basic/prefix_sum_2D.cpp');
const matrixInputPath = path.join(__dirname, '../algorithm_sample/Basic/prefix_sum_2D-sample_input.txt');

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

test('two-dimensional prefix sum sample uses current matrix directives only', () => {
  const code = fs.readFileSync(matrixCodePath, 'utf8');
  assert.doesNotMatch(code, /AV\.hpp|\bAV\s+av\b|frame_draw|start_draw|end_draw|_draw_|@keep/);
  assert.match(code, /vector<vector<int>> num, pre;/);
  assert.match(code, /int r, c;/);
  assert.match(code, /pre\[r\]\[c\] = pre\[r - 1\]\[c\]/);
  assert.match(code, /pre\[r\]\[c\] \+= pre\[r\]\[c - 1\]/);
  assert.match(code, /pre\[r\]\[c\] -= pre\[r - 1\]\[c - 1\]/);
  assert.match(code, /pre\[r\]\[c\] \+= num\[r\]\[c\]/);
  assert.match(code, /@object pre\[r\]\[c\] render matrix/);
  assert.doesNotMatch(code, /\bint row, column\b|pre\[row\]\[column\]/);
  assert.match(code, /@object pre render matrix\s*$/m);
  assert.match(code, /@object num render matrix\s*$/m);
  assert.doesNotMatch(code, /inner-labels\(/);
  assert.doesNotMatch(code, /labels\(value,index\)|row-labels\(index\)|column-labels\(index\)|gridlines\(1\)|outerframe\(true\)/);
  assert.match(code, /marker-layout\(inner\)/);
  assert.match(code, /@place num\.left at pre\.right offset\(100,0\)/);
  assert.match(code, /@for rr in \[0:r-1\]/);
  assert.match(code, /@for cc in \[0:c\]/);
  assert.match(code, /"background":"AV_blue"/);
  assert.match(code, /"background":"AV_yellow"/);
  assert.match(code, /"background":"AV_red"/);
  assert.match(code, /"background":"AV_green"/);
  assert.match(code, /@camera focus num zoom\(2\.0\) when r <= n \/ 2/);
  assert.match(code, /@for r in \[r1:r2\]/);
  assert.match(code, /@style num\[r\]\[c\] background AV_green/);

  const frames = findFrameDirectives(code);
  assert.equal(frames.length, 7, 'each prefix cell has four authored build steps');
  assert.ok(frames.every(frame => frame.objects.length === 2));
  assert.equal(frames[1].objects[0].renderer, 'original-matrix');
  assert.equal(frames[1].objects[0].rendererOptions.innerLabels, undefined);
  assert.equal(frames[1].objects[0].rendererOptions.markerLayout, 'inner');
  assert.deepEqual(frames[1].bindings.map(binding => binding.indexDimension), [0, 1]);
  assert.deepEqual(frames[1].camera.condition.identifiers, ['r', 'n']);
  assert.equal(frames[1].camera.target.variableId, frames[1].objects[1].primaryVariableId);
  const buildColors = frames.slice(1, 5).map(frame => [...new Set(frame.texts
    .flatMap(text => text.segments)
    .map(segment => segment.background)
    .filter(Boolean))]);
  assert.deepEqual(buildColors, [
    ['AV_blue'],
    ['AV_blue', 'AV_yellow'],
    ['AV_blue', 'AV_yellow', 'AV_red'],
    ['AV_blue', 'AV_yellow', 'AV_red', 'AV_green']
  ]);
  assert.deepEqual(frames[6].styles[0].drawLoops.map(loop => loop.variable), ['r', 'c']);
});

test('two-dimensional prefix sum sample builds the matrix and answers both queries', async () => {
  const code = fs.readFileSync(matrixCodePath, 'utf8');
  const input = fs.readFileSync(matrixInputPath, 'utf8');
  const { trace, window } = await compile(code, input);
  assert.equal(trace.frames.length, 84);
  const byName = Object.fromEntries(Object.entries(trace.variables)
    .map(([id, variable]) => [variable.name, id]));
  const scalar = (frame, name) => Number(frame.state[byName[name]].data.value);
  const buildFrame = id => trace.frames.find(frame => (
    scalar(frame, 'r') === 2
    && scalar(frame, 'c') === 2
    && frame.texts.some(text => text.id === id)
  ));
  const buildSteps = [
    buildFrame('build_up_num'),
    buildFrame('build_left_num'),
    buildFrame('build_overlap_num'),
    buildFrame('build_value_num')
  ];
  assert.ok(buildSteps.every(Boolean));
  assert.deepEqual(buildSteps.map(frame => (
    Number(frame.state[byName.pre].data.items[2].items[2].value)
  )), [3, 10, 9, 16]);
  const buildStyles = window.ASMTraceRules.evaluate(trace, buildSteps[3]);
  assert.equal(buildStyles[byName.num]['1,2'].styleTypes.background, 'rgba(144, 202, 249, 0.6)');
  assert.equal(buildStyles[byName.num]['2,1'].styleTypes.background, 'rgba(252, 255, 64, 0.46)');
  assert.equal(buildStyles[byName.num]['1,1'].styleTypes.background, 'rgba(239, 154, 154, 0.6)');
  assert.equal(buildStyles[byName.num]['2,2'].styleTypes.background, 'rgba(165, 214, 167, 0.6)');
  assert.ok(Array.from({ length: 3 }, (_, row) => row).every(row => (
    Array.from({ length: 3 }, (_, column) => column).every(column => (
      buildStyles[byName.num][`${row},${column}`]?.styleTypes.background
    ))
  )));
  const last = trace.frames.at(-1);
  const matrix = last.state[byName.pre].data.items.map(row => (
    row.items.map(item => Number(item.value))
  ));
  assert.deepEqual(matrix, [
    [0, 0, 0, 0, 0, 0],
    [0, 1, 3, 6, 10, 15],
    [0, 7, 16, 27, 40, 55],
    [0, 18, 39, 63, 90, 120],
    [0, 34, 72, 114, 160, 210]
  ]);
  assert.equal(Number(last.state[byName.ans].data.value), 195);
  const styles = window.ASMTraceRules.evaluate(trace, last);
  assert.equal(styles[byName.pre]['4,5'].styleTypes.background, 'rgba(165, 214, 167, 0.6)');
  assert.equal(styles[byName.pre]['1,5'].styleTypes.background, 'rgba(239, 154, 154, 0.6)');
  assert.equal(styles[byName.pre]['4,0'].styleTypes.background, 'rgba(239, 154, 154, 0.6)');
  assert.ok(Array.from({ length: 3 }, (_, row) => row + 2).every(row => (
    Array.from({ length: 5 }, (_, column) => column + 1).every(column => (
      styles[byName.num][`${row},${column}`].styleTypes.background
        === 'rgba(165, 214, 167, 0.6)'
    ))
  )));
});
