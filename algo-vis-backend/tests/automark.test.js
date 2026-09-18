const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { findFrameDirectives } = require('../trace-instrumenter');
const { compile, load } = require('./helpers/compile');
const source = fs.readFileSync(path.join(__dirname, 'fixtures/automark.cpp'), 'utf8');
const names = frame => frame.autoMarkVariableIds?.map(id => frame.variables.find(variable => variable.id === id).name) ?? null;

test('automark supports lists, none, defaults and ordered preset/local overrides without frame inheritance', () => {
  const frames = findFrameDirectives(`
// @defaults
// @automark a
// @enddefaults
// @preset view
// @object a
// @object b
// @automark b
// @endpreset
int main(){
int a[2]={},b[2]={};
// @frame a,b
// @frame use view
// @frame use view
// @automark a,b
// @frame use view
// @automark a
// @automark none
// @frame a,b
}`);
  assert.deepEqual(frames.map(names), [['a'],['b'],['a','b'],[],['a']]);
  assert.deepEqual(findFrameDirectives(source).map(names), [null,['a'],['a','b'],[],null]);
  const hidden = findFrameDirectives('int main(){int a[2]={},b[2]={};\n// @frame a\n// @automark b\n}')[0];
  assert.ok(hidden.captureOnlyVariableIds.includes(hidden.autoMarkVariableIds[0]));
  assert.deepEqual(hidden.names, ['a'], 'automark must not add displayed objects');
});

test('automark rejects missing, duplicate, indexed, unsupported and out-of-scope targets', () => {
  for (const [directive, error] of [
    ['', /格式/], ['a,a', /重複/], ['a,', /格式/], ['none,a', /格式/],
    ['a[0]', /格式/], ['a when true', /格式/], ['missing', /可見變數/], ['number', /只支援/]
  ]) assert.throws(() => findFrameDirectives('int main(){int a[2]={};int number=1;\n// @frame a\n// @automark '+directive+'\n}'), error, directive);
  assert.throws(() => findFrameDirectives('// @automark none\nint main(){int a[2]={};\n// @frame a\n}'), /找不到.*@frame/);
  assert.throws(() => findFrameDirectives('int main(){int a[2]={};{int b[2]={};}\n// @frame a\n// @automark b\n}'), /可見變數/);
});

test('automark filters persistent fixed state by runtime identity and leaves events and manual marks intact', () => {
  const context = vm.createContext({ document: { documentElement: { dataset: {} } } });
  context.window = context;
  load(context, 'trace-model.js'); load(context, 'trace-rules.js'); load(context, 'trace-renderer.js');
  const data = { kind: 'sequence', items: [{kind:'scalar',value:1},{kind:'scalar',value:2}] };
  const frame = {
    id: 'f', autoMarkVariableIds: ['alias'],
    state: { a: {identity:'object-a',data}, alias: {identity:'object-a',data}, b: {identity:'object-b',data} },
    styles: [{id:'manual',targetVariableId:'b',styleType:'mark',color:'blue',selector:{type:'index',indexExpression:'0'}}],
    events: [
      {id:'fixed-a',type:'fixed',enabled:true,runtimeIdentity:'object-a',targets:[{variableId:'a',resolvedIndex:0,indexExpression:'0'}]},
      {id:'fixed-b',type:'fixed',enabled:true,runtimeIdentity:'object-b',targets:[{variableId:'b',resolvedIndex:1,indexExpression:'1'}]}
    ]
  };
  const doc = {frames:[frame]}, before = JSON.stringify(frame.events);
  const highlights = context.ASMTraceRenderers.evaluateFrameHighlights(doc, frame);
  assert.equal(highlights.a[0].fixedMark, '#4caf50');
  assert.equal(highlights.alias[0].fixedMark, '#4caf50');
  assert.equal(highlights.b?.[1]?.fixedMark, undefined);
  assert.equal(highlights.b[0].styleTypes.mark, 'blue');
  frame.autoMarkVariableIds = [];
  const none = context.ASMTraceRenderers.evaluateFrameHighlights(doc, frame);
  assert.equal(none.a, undefined);
  assert.equal(none.b[0].styleTypes.mark, 'blue');
  assert.equal(JSON.stringify(frame.events), before);
});

test('automark model normalization preserves null versus none and old trace compatibility', () => {
  const context = vm.createContext({}); context.window = context; load(context, 'trace-model.js');
  const doc = context.ASMTraceModel.normalizeTraceDocument({frames:[{id:'old'},{id:'none',autoMarkVariableIds:[]},{id:'list',autoMarkVariableIds:['a']}]});
  assert.deepEqual(Array.from(doc.frames, frame => frame.autoMarkVariableIds && Array.from(frame.autoMarkVariableIds)), [null,[],['a']]);
  const reload = context.ASMTraceModel.normalizeTraceDocument(JSON.parse(JSON.stringify(doc)));
  assert.deepEqual(Array.from(reload.frames, frame => frame.autoMarkVariableIds && Array.from(frame.autoMarkVariableIds)), [null,[],['a']]);
});

test('automark survives analyze/compile mapping and preserves unselected fixed event metadata', async () => {
  const {trace,window} = await compile(source);
  const aId = Object.keys(trace.variables).find(id => trace.variables[id].name === 'a');
  const bId = Object.keys(trace.variables).find(id => trace.variables[id].name === 'b');
  assert.deepEqual(Array.from(trace.frames, frame => frame.autoMarkVariableIds && Array.from(frame.autoMarkVariableIds)), [null,[aId],[aId,bId],[],null]);
  assert.ok(trace.frames[1].events.some(event => event.type === 'fixed' && event.targets.some(target => target.variableId === bId)));
  const fixed = trace.frames.flatMap(frame => frame.events.filter(event => event.type === 'fixed'));
  assert.equal(fixed.flatMap(event => event.targets).length, 6);
  const reload = window.ASMTraceModel.normalizeTraceDocument(JSON.parse(JSON.stringify(trace)));
  assert.deepEqual(Array.from(reload.frames, frame => frame.autoMarkVariableIds && Array.from(frame.autoMarkVariableIds)), [null,[aId],[aId,bId],[],null]);
});
