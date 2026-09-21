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

test('standard segment tree renderer parses domain, root and unit options', () => {
  const frames = findFrameDirectives(source);
  const object = frames.flatMap(frame => frame.objects || [])
    .find(item => item.renderer === 'original-segment-tree');
  assert.ok(object);
  assert.equal(object.rendererOptions.domain.startExpression, '1');
  assert.equal(object.rendererOptions.domain.endExpression, 'n');
  assert.equal(object.rendererOptions.root.expression, '1');
  assert.equal(object.rendererOptions.unit.expression, '48');
  assert.throws(() => findFrameDirectives(source.replace('with domain(1,n), root(1), unit(48)', '')),
    /render segment_tree 必須指定 with domain/);
  assert.throws(() => findFrameDirectives(source.replace('render segment_tree', 'render heap')),
    /domain、root、unit 只支援 render segment_tree/);
});

test('standard segment tree sample resolves n=10 geometry options and preserves output', async () => {
  const { trace } = await compile(source, input);
  const byName = Object.fromEntries(Object.entries(trace.variables).map(([id, value]) => [value.name, id]));
  const frame = trace.frames.find(item => item.renderers?.[byName.tree] === 'original-segment-tree');
  assert.ok(frame);
  assert.deepEqual(Array.from(frame.rendererOptions[byName.tree].domain), [1, 10]);
  assert.equal(frame.rendererOptions[byName.tree].root, 1);
  assert.equal(frame.rendererOptions[byName.tree].unit, 48);
  assert.equal(Number(trace.frames.at(-1).state[byName.ans].data.value), 33);
  assert.ok(trace.frames.some(item => (item.segments || []).some(segment => segment.split?.phase === 'after')));
});
