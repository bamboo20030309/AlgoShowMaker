const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { findFrameDirectives, findArrowDirectives, findEventControlDirectives } = require('../trace-instrumenter');
const arrows = require('../public/trace-arrow-model');
const { compile, load } = require('./helpers/compile');

function traceApi() {
  const context = vm.createContext({});
  context.window = context;
  for (const name of ['trace-model.js', 'trace-rules.js', 'trace-events.js']) load(context, name);
  return context;
}

test('frame event controls capture conditions without leaking to another frame', () => {
  const frames = findFrameDirectives(`int main(){int i=8; int values[3]={1,2,3};
// @frame values
// @events compare,read animate off when i>7
// @frame values
}`);
  assert.deepEqual(frames[0].eventControls[0].types, ['compare', 'read']);
  assert.equal(frames[0].eventControls[0].when.expression, 'i>7');
  assert.ok(frames[0].variables.some(variable => variable.name === 'i'));
  assert.equal(frames[1].eventControls.length, 0);
  assert.throws(() => findEventControlDirectives('// @events condition animate on'), /種類無效/);
  assert.throws(() => findEventControlDirectives('// @events animate maybe'), /格式應為/);
  assert.throws(() => findFrameDirectives('int main(){// @events animate off\n}'), /找不到可套用/);
});

test('event controls preserve metadata and values, obey frame condition and last matching rule', () => {
  const api = traceApi();
  const frame = value => ({ id: 'f'+value, state: { i: { name: 'i', data: { kind: 'scalar', value } } },
    events: ['compare', 'write', 'read', 'condition'].map((type, order) =>
      ({ id: type+value, type, order, targets: [], payload: { after: 99 } })),
    eventControls: [{ types: ['all'], animate: false, when: { expression: 'i>7' } },
      { types: ['read'], animate: true, when: { expression: 'i>7' } }] });
  const source = { variables: { i: { name: 'i', kind: 'scalar' } }, frames: [frame(7),frame(8),frame(9)] };
  source.frames[2].eventControls = [];
  const doc = api.ASMTraceModel.normalizeTraceDocument(source);
  assert.equal(doc.frames[0].events[1].enabled, true);
  assert.deepEqual(Array.from(doc.frames[1].events, event => event.enabled), [false,false,true,false]);
  assert.equal(doc.frames[2].events[1].enabled, true);
  assert.equal(doc.frames[1].state.i.data.value, 8);
  assert.equal(doc.frames[1].events[1].payload.after, 99);
  assert.equal(doc.frames[1].events.length, 4);
  api.ASMTraceEvents.applyEnabledStates(doc);
  assert.deepEqual(Array.from(doc.frames[1].events, event => event.enabled), [false,false,true,false]);
  doc.frames[1].eventControls = [{ types: ['all'], animate: true }];
  api.ASMTraceEvents.applyEnabledStates(doc);
  assert.equal(doc.frames[1].events[3].enabled, false, 'internal condition cannot be enabled');
  doc.frames[1].eventControls = [{ types: ['all'], animate: false, when: { expression: 'missing>0' } }];
  assert.throws(() => api.ASMTraceEvents.applyEnabledStates(doc), /條件無法解析/);
});

test('event controls merge defaults, presets and local rules in order', () => {
  const code=`// @defaults
// @events animate off
// @enddefaults
// @preset details
// @events compare animate on
// @endpreset
int main(){int values[2]={};
// @frame use details
// @object values
// @events compare animate off
}`;
  const [frame]=findFrameDirectives(code);
  assert.deepEqual(frame.eventControls.map(rule=>rule.animate),[false,true,false]);
  assert.deepEqual(frame.eventControls.map(rule=>rule.types),[['all'],['compare'],['compare']]);
});

test('batch arrow parses multiline ranges, captures dependencies and shadows C++ index', () => {
  const code = `int main(){int n=5,k=99; int values[5]={};
// @frame values
// @arrow for k in 0..n-1 step 2
//   from values[0].bottom
//   to values[k].top as "links" when k>0
}`;
  const [frame] = findFrameDirectives(code);
  assert.deepEqual(frame.arrows[0].batch, { variable: 'k', startExpression: '0', endExpression: 'n-1', stepExpression: '2' });
  assert.ok(frame.variables.some(variable => variable.name === 'n'));
  assert.ok(!frame.variables.some(variable => variable.name === 'k'), 'drawing index does not capture runtime k');
  const [arrow] = findArrowDirectives('// @arrow for k in 0..3 from a[k] to b[a[k]]');
  assert.deepEqual(arrow.toTarget.indexExpressions, ['a[k]']);
  assert.throws(() => findArrowDirectives('// @arrow for k in 0..3 step 0 from a[k] to b[k]'), /非零整數/);
  assert.throws(() => findArrowDirectives('// @arrow for k in 0..k from a[k] to b[k]'), /範圍無效/);
  assert.throws(() => findArrowDirectives('// @arrow for iteration in 0..3 from a[iteration] to b[iteration]'), /保留名稱/);
});

test('batch expansion evaluates nested indices, per-arrow conditions and stable IDs', () => {
  const api = traceApi();
  const doc = { variables: { p: { name: 'prime' }, i: { name: 'i' } } };
  const frame = { state: {
    p: { data: { kind: 'sequence', items: [2,3,5,7].map(value => ({ kind:'scalar',value })) } },
    i: { data: { kind:'scalar',value:7 } }
  } };
  const resolve = (expression, locals) => api.ASMTraceRules.resolveExpression(doc, frame, expression, locals);
  const [parsed] = findArrowDirectives('// @arrow for k in 0..3 from prime[k] to isprime[i*prime[k]] as "links" when k!=1');
  const arrow = { ...parsed, from: parsed.fromTarget, to: parsed.toTarget };
  const expanded = arrows.expandBatch(arrow, resolve,
    (condition, locals) => api.ASMTraceRules.expressionMatches(doc, frame, condition, locals));
  assert.deepEqual(expanded.map(item => item.id), ['links[0]','links[2]','links[3]']);
  assert.deepEqual(expanded.map(item => item.to.indexExpression), ['14','35','49']);
  assert.deepEqual(arrows.expandBatch({ ...arrow, batch: { ...arrow.batch, endExpression:'2' } }, resolve,
    (condition, locals) => api.ASMTraceRules.expressionMatches(doc, frame, condition, locals))
    .map(item => item.id), ['links[0]','links[2]']);
  assert.equal(frame.state.i.data.value, 7);
  const multiples=arrows.expandBatch({ ...arrow,when:null,
    batch:{variable:'k',startExpression:'i*prime[0]',endExpression:'28',stepExpression:'prime[0]'},
    from:{...arrow.from,indexExpressions:['0']},
    to:{...arrow.to,indexExpressions:['k']} },resolve);
  assert.deepEqual(multiples.map(item=>item.to.indexExpression),['14','16','18','20','22','24','26','28']);
});

test('batch ranges handle empty and descending ranges and reject unresolved or excessive expansion', () => {
  const arrow = { id:'a', from:{}, to:{}, batch:{ variable:'k',startExpression:'2',endExpression:'1',stepExpression:'1' } };
  assert.deepEqual(arrows.expandBatch(arrow, Number), []);
  assert.deepEqual(arrows.expandBatch({ ...arrow,batch:{...arrow.batch,stepExpression:'-1'} },Number).map(item=>item.id), ['a[2]','a[1]']);
  for (const stepExpression of ['0','0.5','NaN']) {
    assert.throws(() => arrows.expandBatch({ ...arrow,batch:{...arrow.batch,stepExpression} },Number), /非零整數|安全整數/);
  }
  assert.throws(() => arrows.expandBatch({ ...arrow,batch:{...arrow.batch,startExpression:'0',endExpression:'2048'} },Number), /2048/);
  assert.deepEqual(arrows.expandBatch({ ...arrow,when:{expression:'false',identifiers:[]},
    batch:{...arrow.batch,endExpression:'unavailable'} },Number,()=>false), []);
});

test('iteration.last works after an uncaptured normally-completed loop and respects each lifetime', async () => {
  const code=`int main(){
  int values[8]={};
  for(int i=2;i<=4;i++){
    // @frame values
    for(int j=0;j<i;j++){values[j]=i;}
    // @frame values
    // @events animate off
    // @arrow for k in 0..iteration.last(j) from values[0] to values[k] as "range"
  }
}`;
  const {trace,window}=await compile(code);
  const after=trace.frames.filter(frame=>frame.eventControls.length);
  assert.deepEqual(Array.from(after,frame=>window.ASMTraceRules.iterationLastValue(trace,frame,'j')),[1,2,3]);
});

test('compiled linear sieve preserves results and uses iteration.last for user-written compact arrows', async () => {
  const code = fs.readFileSync(path.join(__dirname,'fixtures/events-batch-sieve.cpp'),'utf8');
  const { trace, window } = await compile(code);
  const compact = trace.frames.filter(frame => frame.eventControls.length);
  assert.equal(compact.length,23);
  const iId = Object.keys(trace.variables).find(id=>trace.variables[id].name==='i');
  assert.deepEqual(Array.from(compact.slice(0,3), frame=>frame.state[iId].data.value), [8,9,10]);
  const counts = compact.slice(0,3).map(frame=>arrows.expandBatch(frame.arrows[0],
    (expression,locals)=>window.ASMTraceRules.resolveExpression(trace,frame,expression,locals),
    (condition,locals)=>window.ASMTraceRules.expressionMatches(trace,frame,condition,locals)).length);
  assert.deepEqual(Array.from(counts),[1,2,1]);
  assert.ok(compact.every(frame=>frame.events.length>0 && frame.events.every(event=>event.enabled===false)));
  assert.ok(trace.frames.some(frame=>!frame.eventControls.length && frame.events.some(event=>event.enabled===true)));
  const isprimeId=Object.keys(trace.variables).find(id=>trace.variables[id].name==='isprime');
  const final=trace.frames.at(-1).state[isprimeId].data.items.map(item=>item.value);
  assert.deepEqual(Array.from(final.entries()).filter(([,value])=>value===1).map(([index])=>index),[2,3,5,7,11,13,17,19,23,29]);
});
