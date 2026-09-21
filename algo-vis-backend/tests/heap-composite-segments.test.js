const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { findFrameDirectives, instrumentSource } = require('../trace-instrumenter');
const { compile } = require('./helpers/compile');

const source = fs.readFileSync(path.join(__dirname, 'fixtures/heap-composite-segments.cpp'), 'utf8');

test('fields, hide and separator parse as renderer options and capture each source array', () => {
  const frames = findFrameDirectives(source);
  const first = frames[0].objects[0];
  assert.deepEqual(first.rendererOptions.fields.names, ['tree','lazy','sets']);
  assert.equal(first.rendererOptions.fields.variableIds.length, 3);
  assert.deepEqual(first.rendererOptions.hide.entries, [
    {field:'lazy',value:'0'}, {field:'sets',value:'LM'}
  ]);
  assert.equal(frames[1].objects[0].rendererOptions.separator, ' / ');
  assert.deepEqual(frames[0].names, ['tree','lazy','sets']);
  assert.throws(()=>findFrameDirectives(source.replace('fields(tree,lazy,sets)','fields(lazy,tree,sets)')),
    /fields 第一個欄位必須是主要物件 tree/);
});

test('double segment selectors coexist with the existing array range selector', () => {
  const result = instrumentSource(source);
  const segments = result.frameDirectives.flatMap(frame => frame.segments || []);
  const internal = segments.filter(segment => segment.cellRange);
  assert.equal(internal.length, 9);
  assert.deepEqual(internal.slice(0,3).map(segment => ({
    cell:segment.cellExpression,start:segment.startExpression,end:segment.endExpression,
    color:segment.color,named:segment.named
  })), [
    {cell:'1',start:'0',end:'7',color:'AV_red',named:true},
    {cell:'1',start:'2',end:'5',color:'AV_green',named:true},
    {cell:'2',start:'2',end:'3',color:'AV_blue',named:true}
  ]);
  const legacy = segments.find(segment => !segment.cellRange);
  assert.equal(legacy.targetName, 'arr');
  assert.equal(legacy.startExpression, '1');
  assert.equal(legacy.endExpression, '2');
  assert.equal(legacy.endInclusive, true);
  const frontier = internal.filter(segment => segment.id === 'frontier');
  assert.equal(frontier.length, 3);
  assert.deepEqual(frontier.map(segment => ({
    cursor:segment.split.cursorExpression,phase:segment.split.phase
  })), [
    {cursor:'cursor',phase:'before'},
    {cursor:'cursor',phase:'before'},
    {cursor:'cursor',phase:'after'}
  ]);
  assert.throws(
    ()=>findFrameDirectives(source.replace('@segment arr[1:2]','@segment arr[1:2] with split(cursor)')),
    /split 只支援 heap 格子內部區段/
  );
  assert.throws(
    ()=>findFrameDirectives(source.replace('with split(cursor)','with split(cursor,done)')),
    /split 必須是 split\(cursor\) 或 split\(cursor,after\)/
  );
});

test('runtime keeps fields separate and serializes pair and tuple elements without flattening cells', async () => {
  const { trace } = await compile(source);
  const byName = Object.fromEntries(Object.entries(trace.variables).map(([id,value]) => [value.name,id]));
  const first = trace.frames[0];
  assert.deepEqual(JSON.parse(JSON.stringify(first.rendererOptions[byName.tree].fields.variableIds)),
    [byName.tree,byName.lazy,byName.sets]);
  assert.equal(first.state[byName.tree].data.items[1].value, 15);
  assert.equal(first.state[byName.lazy].data.items[2].value, 3);
  assert.equal(first.state[byName.sets].data.items[3].value, 8);
  const pairFrame = trace.frames.find(frame => frame.state[byName.pairs]);
  assert.equal(pairFrame.state[byName.pairs].data.items.length, 2);
  assert.equal(pairFrame.state[byName.pairs].data.items[0].kind, 'pair');
  assert.deepEqual(pairFrame.state[byName.pairs].data.items[0].items.map(item=>item.value), [5,0]);
  const tupleFrame = trace.frames.find(frame => frame.state[byName.tuples]);
  assert.equal(tupleFrame.state[byName.tuples].data.items.length, 2);
  assert.equal(tupleFrame.state[byName.tuples].data.items[0].kind, 'tuple');
  assert.deepEqual(tupleFrame.state[byName.tuples].data.items[0].items.map(item=>item.value), [1,0,3]);
  const writes=trace.frames.flatMap(frame=>frame.events||[]).filter(event=>event.type==='assign');
  assert.ok(writes.some(event=>event.targets?.some(target=>target.variableId===byName.lazy)));
  assert.ok(writes.some(event=>event.targets?.some(target=>target.variableId===byName.sets)));
});
