const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { findFrameDirectives } = require('../trace-instrumenter');
const { compile } = require('./helpers/compile');

const samplePath = path.join(__dirname, '../algorithm_sample/Tree/Segment_Tree_standard.cpp');
const inputPath = path.join(__dirname, '../algorithm_sample/Tree/Segment_Tree_standard-sample_input.txt');
const source = fs.readFileSync(samplePath, 'utf8');
const input = fs.readFileSync(inputPath, 'utf8');

test('standard segment tree renderer derives its domain and root from range', () => {
  const frames = findFrameDirectives(source);
  const object = frames.flatMap(frame => frame.objects || [])
    .find(item => item.renderer === 'original-segment-tree');
  assert.ok(object);
  assert.equal(object.rendererOptions.range.startExpression, '1');
  assert.equal(object.rendererOptions.range.endExpression, 'n');
  assert.equal(object.rendererOptions.domain, undefined);
  assert.equal(object.rendererOptions.root, undefined);
  assert.equal(object.rendererOptions.unit, undefined);
  assert.throws(() => findFrameDirectives(source.replace('with range(1,n)', '')),
    /render segment_tree 必須指定 with range/);
  assert.throws(() => findFrameDirectives(source.replace('range(1,n)', 'unit(48)')),
    /不支援 with unit/);
});

test('standard segment tree sample resolves n=10 geometry options and preserves output', async () => {
  const { trace } = await compile(source, input);
  const byName = Object.fromEntries(Object.entries(trace.variables).map(([id, value]) => [value.name, id]));
  const frame = trace.frames.find(item => item.renderers?.[byName.tree] === 'original-segment-tree');
  assert.ok(frame);
  assert.deepEqual(Array.from(frame.rendererOptions[byName.tree].range), [1, 11]);
  assert.equal(frame.rendererOptions[byName.tree].domain, undefined);
  assert.equal(frame.rendererOptions[byName.tree].root, undefined);
  assert.equal(frame.rendererOptions[byName.tree].unit, undefined);
  assert.equal(Number(trace.frames.at(-1).state[byName.ans].data.value), 33);
  assert.ok(trace.frames.some(item => (item.segments || []).some(segment => segment.split?.phase === 'after')));
});

test('gap accepts one or two expressions and resolves horizontal and vertical spacing', async () => {
  const twoAxisSource = source.replaceAll('range(1,n)', 'range(1,n), gap(10,24)');
  const frames = findFrameDirectives(twoAxisSource);
  const object = frames.flatMap(frame => frame.objects || [])
    .find(item => item.renderer === 'original-segment-tree');
  assert.deepEqual(object.rendererOptions.gap, {
    horizontalExpression: '10',
    verticalExpression: '24',
    identifiers: []
  });
  const { trace } = await compile(twoAxisSource, input);
  const treeId = Object.entries(trace.variables).find(([, value]) => value.name === 'tree')[0];
  const frame = trace.frames.find(item => item.renderers?.[treeId] === 'original-segment-tree');
  assert.deepEqual(JSON.parse(JSON.stringify(frame.rendererOptions[treeId].gap)),
    { horizontal: 10, vertical: 24 });

  const oneAxisSource = source.replaceAll('range(1,n)', 'range(1,n), gap(7)');
  const oneAxis = findFrameDirectives(oneAxisSource).flatMap(item => item.objects || [])
    .find(item => item.renderer === 'original-segment-tree');
  assert.equal(oneAxis.rendererOptions.gap.horizontalExpression, '7');
  assert.equal(oneAxis.rendererOptions.gap.verticalExpression, '7');
  assert.throws(() => findFrameDirectives(source.replace('range(1,n)', 'range(1,n), gap(1,2,3)')),
    /gap 必須是 gap\(horizontal\) 或 gap\(horizontal,vertical\)/);
});
