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
  assert.deepEqual(object.rendererOptions.fields.names, ['tree', 'sets', 'lazy']);
  assert.deepEqual(object.rendererOptions.format.entries.map(({ field, type }) => ({ field, type })), [
    { field: 'sets', type: 'assign' },
    { field: 'lazy', type: 'signed' }
  ]);
  assert.throws(() => findFrameDirectives(source.replace(
    'with range(1,n), fields(tree,sets,lazy), hide(sets=LM,lazy=0), format(sets=assign,lazy=signed)',
    'with fields(tree,sets,lazy), hide(sets=LM,lazy=0), format(sets=assign,lazy=signed)'
  )),
    /render segment_tree 必須指定 with range/);
  assert.throws(() => findFrameDirectives(source.replace('range(1,n)', 'unit(48)')),
    /不支援 with unit/);
});

test('standard segment tree sample resolves n=15 options and executes modify, set and query', async () => {
  const { trace } = await compile(source, input);
  const byName = Object.fromEntries(Object.entries(trace.variables).map(([id, value]) => [value.name, id]));
  const frame = trace.frames.find(item => item.renderers?.[byName.tree] === 'original-segment-tree');
  assert.ok(frame);
  assert.deepEqual(Array.from(frame.rendererOptions[byName.tree].range), [1, 16]);
  assert.equal(frame.rendererOptions[byName.tree].domain, undefined);
  assert.equal(frame.rendererOptions[byName.tree].root, undefined);
  assert.equal(frame.rendererOptions[byName.tree].unit, undefined);
  assert.deepEqual(JSON.parse(JSON.stringify(frame.rendererOptions[byName.tree].fields.variableIds)),
    [byName.tree, byName.sets, byName.lazy]);
  assert.deepEqual(JSON.parse(JSON.stringify(frame.rendererOptions[byName.tree].format.entries)), [
    { field: 'sets', type: 'assign', variableId: byName.sets },
    { field: 'lazy', type: 'signed', variableId: byName.lazy }
  ]);
  assert.equal(Number(trace.frames.at(-1).state[byName.sum].data.value), 12);
  assert.ok(trace.frames.some(item => (item.segments || []).some(segment => segment.color === 'AV_magenta')));
  assert.ok(trace.frames.some(item => (item.segments || []).some(segment => segment.color === 'AV_orange')));
  assert.ok(trace.frames.some(item => (item.segments || []).some(segment => segment.color === 'AV_green')));
  assert.ok(trace.frames.some(item => (item.segments || []).some(segment => segment.split?.phase === 'after')));
  const textOf = frame => (frame.texts || []).flatMap(text => text.segments || [])
    .map(segment => segment.text || '').join('');
  assert.ok(trace.frames.some(frame => textOf(frame).includes('回朔到節點')));
  assert.equal(['leftSum','rightSum','result'].some(name => byName[name]), false);
  const queryHits = trace.frames.filter(frame => frame.source?.function === 'query'
    && (frame.events || []).some(event => event.signature?.includes('sum += tree[now]')));
  assert.ok(queryHits.length > 0, 'query hit frames add tree[now] directly into sum');
  assert.ok(queryHits.every(frame => Object.keys(frame.renderers || {}).includes(byName.sum)));
  assert.ok(queryHits.every(frame => (frame.segments || []).some(segment => segment.color === 'AV_green'
    && segment.split?.phase === 'after')));
  const updateBacktracks = trace.frames.filter(frame => textOf(frame).includes('回朔到節點'));
  assert.ok(updateBacktracks.some(frame => (frame.segments || []).some(segment => segment.color === 'AV_magenta'
    && segment.split?.phase === 'after')));
  assert.ok(updateBacktracks.some(frame => (frame.segments || []).some(segment => segment.color === 'AV_orange'
    && segment.split?.phase === 'after')));
});

test('format accepts the first-version value formats and rejects invalid declarations', () => {
  const formatted = `vector<int> tree, sets, lazy;
int main(){
  // @frame tree with fields(tree,sets,lazy), format(tree=raw,sets=hex,lazy=fixed(2))
}`;
  const object = findFrameDirectives(formatted)[0].objects[0];
  assert.deepEqual(object.rendererOptions.format.entries.map(entry => ({
    field: entry.field, type: entry.type, precision: entry.precision
  })), [
    { field: 'tree', type: 'raw', precision: undefined },
    { field: 'sets', type: 'hex', precision: undefined },
    { field: 'lazy', type: 'fixed', precision: 2 }
  ]);
  const singleField = `vector<int> mask;\nint main(){ // @frame mask with format(mask=binary)\n}`;
  assert.equal(findFrameDirectives(singleField)[0].objects[0].rendererOptions.format.entries[0].type,
    'binary');
  assert.throws(() => findFrameDirectives(source.replace('sets=assign', 'sets=unknown')),
    /format 不支援格式/);
  assert.throws(() => findFrameDirectives(source.replace('sets=assign', 'missing=assign')),
    /format 找不到欄位：missing/);
  assert.throws(() => findFrameDirectives(source.replace(
    'format(sets=assign,lazy=signed)', 'format(sets=assign,sets=hex)'
  )), /format 不可重複欄位/);
  assert.throws(() => findFrameDirectives(source.replace('sets=assign', 'sets=fixed(11)')),
    /format 不支援格式/);
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
