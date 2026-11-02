'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { startIsolatedServer } = require('./helpers/isolated-server');
const { compile, load } = require('./helpers/compile');
const vm = require('node:vm');

test('semantic events retain independent runtime answers and execute conditional branches only once', { timeout: 90000 }, async t => {
  const { base } = await startIsolatedServer(t);
  const previous = process.env.ASM_TEST_BASE_URL;
  let result;
  try {
    process.env.ASM_TEST_BASE_URL = base;
    result = await compile(`#include <bits/stdc++.h>
using namespace std;
int main(){
 int b=3,c=8,a=0,i=0;
 // @frame a,b,c,i
 a=b;
 // @frame a,b,c,i
 int x=b+c;
 // @frame a,b,c,i,x
 a=(++i>0 ? b : c);
 // @frame a,b,c,i,x
 a=i++==0 ? b : c;
 // @frame a,b,c,i,x
 a=min(b,c);
 // @frame a,b,c,i,x
 a=max(b,c);
 // @frame a,b,c,i,x
 a+=b;
 // @frame a,b,c,i,x
 a=b+c;
 // @frame a,b,c,i,x
 a=b+c+b;
 // @frame a,b,c,i,x
 a=min(b,c)+4;
 // @frame a,b,c,i,x
 int pick=max(b,c);
 // @frame a,b,c,i,x,pick
 bool flag=b;
 // @frame a,b,c,i,x,pick,flag
 int chosen=(i++==2 ? b : c);
 // @frame a,b,c,i,x,pick,flag,chosen
}`);
  } finally {
    if (previous === undefined) delete process.env.ASM_TEST_BASE_URL;
    else process.env.ASM_TEST_BASE_URL = previous;
  }
  const { trace, window } = result;
  const scalar = data => data && typeof data === 'object' && data.kind === 'scalar' ? data.value : data;
  const value = (frame, name) => Object.values(frame.state).find(entry => entry.name === name)?.data?.value;
  assert.deepEqual(Array.from(trace.frames, frame => value(frame, 'a')), [0,3,3,3,8,3,8,11,11,14,7,7,7,7]);
  assert.deepEqual(Array.from(trace.frames, frame => value(frame, 'i')), [0,0,0,1,2,2,2,2,2,2,2,2,2,3]);
  const assignment = frame => frame.events.find(event => event.type === 'assign');
  assert.equal(assignment(trace.frames[1]).semantics.kind, 'copy');
  const init = assignment(trace.frames[2]);
  assert.equal(init.semantics.kind, 'compute');
  assert.equal(scalar(init.payload.after), 11);
  assert.equal(init.binaryOperation, '+');
  assert.equal(scalar(init.payload.left), 3);
  assert.equal(scalar(init.payload.right), 8);
  assert.deepEqual(Array.from(init.targets.filter(target => target.role.startsWith('source')), target => scalar(target.value)), [3,8]);
  assert.deepEqual(Array.from(init.targets.filter(target => target.role.startsWith('source')), target => trace.variables[target.variableId].name), ['b','c']);
  const declaration = trace.frames[2].events.find(event => event.type === 'declare');
  assert.ok(declaration.order < init.order);
  assert.equal(window.ASMTraceEvents.showInspector(init, trace), true);
  for (const [index, role, expected] of [[3,'source-left',3],[4,'source-right',8]]) {
    const event = assignment(trace.frames[index]);
    assert.equal(event.semantics.kind, 'conditional');
    assert.equal(event.selectedSourceRole, role);
    assert.equal(scalar(event.payload.after), expected);
    assert.equal(event.semantics.reads.length, 1);
    assert.equal(event.semantics.reads[0].variableId, event.targets.find(target => target.role === role).variableId);
  }
  for (const [index, operation, role] of [[5,'min','source-left'],[6,'max','source-right']]) {
    const event = assignment(trace.frames[index]);
    assert.equal(event.semantics.kind, 'select');
    assert.equal(event.selectionOperation, operation);
    assert.equal(event.selectedSourceRole, role);
    assert.deepEqual(Object.fromEntries(Object.entries(event.payload).map(([key, value]) => [key, scalar(value)])),
      {before:index===5?8:3,after:index===5?3:8,source:index===5?3:8,left:3,right:8});
  }
  assert.equal(trace.frames[7].events.find(event => event.compound).semantics.kind, 'compute');
  assert.equal(scalar(trace.frames[7].events.find(event => event.compound).payload.source), 3);
  assert.equal(scalar(assignment(trace.frames[8]).payload.left), 3);
  assert.equal(scalar(assignment(trace.frames[8]).payload.right), 8);
  assert.deepEqual(Array.from(assignment(trace.frames[9]).targets.filter(target => target.role.startsWith('source')), target => scalar(target.value)), [3,8,3]);
  const nested = assignment(trace.frames[10]);
  assert.equal(scalar(nested.payload.left), 3);
  assert.equal(scalar(nested.payload.right), 4);
  assert.equal(nested.selectionSteps.length, 1);
  assert.equal(nested.selectionSteps[0].operation, 'min');
  assert.equal(scalar(nested.selectionSteps[0].left), 3);
  assert.equal(scalar(nested.selectionSteps[0].right), 8);
  assert.equal(trace.variables[nested.targets.find(target => target.role === 'source-left').variableId].name, 'b');
  const pick = assignment(trace.frames[11]);
  assert.equal(pick.selectionOperation, 'max');
  assert.equal(pick.selectedSourceRole, 'source-right');
  assert.equal(scalar(pick.payload.left), 3);
  assert.equal(scalar(pick.payload.right), 8);
  const flag = assignment(trace.frames[12]);
  assert.equal(scalar(flag.payload.source), 3, 'copy preserves the original source value before bool conversion');
  assert.equal(scalar(flag.payload.after), true);
  const chosen = assignment(trace.frames[13]);
  assert.equal(chosen.conditionalSelection, true);
  assert.equal(chosen.conditionResult, true);
  assert.equal(chosen.selectedSourceRole, 'source-left');
  assert.equal(scalar(chosen.payload.source), 3);
  assert.equal(chosen.semantics.reads.length, 1, 'an unexecuted initializer branch must not become a highlighted read');
  assert.ok(trace.frames.flatMap(frame => frame.events).some(event => event.type === 'read' && event.semantics.ownerEventId));
  const persisted = JSON.parse(JSON.stringify(trace));
  for (const frame of persisted.frames) for (const event of frame.events) delete event.semantics;
  const reopened = window.ASMTraceModel.normalizeTraceDocument(persisted);
  assert.equal(assignment(reopened.frames[1]).semantics.kind, 'copy');
  assert.equal(assignment(reopened.frames[2]).semantics.kind, 'compute');
  assert.equal(assignment(reopened.frames[4]).selectedSourceRole, 'source-right');
});

test('executed reads belong to visible return, output and call events rather than completion bookkeeping', () => {
  const c = vm.createContext({ queueMicrotask() {} }); c.window = c;
  for (const name of ['trace-view-source.js','trace-model.js','trace-rules.js','trace-events.js']) load(c,name);
  const source = (from,to) => ({from,to});
  const read = (id,order,from,to,variableId='local',indexExpression='') => ({id,type:'read',order,source:source(from,to),targets:[{role:'target',variableId,expression:variableId,indexExpression}]});
  const document = c.ASMTraceModel.normalizeTraceDocument({variables:{local:{name:'local',kind:'scalar'},unused:{name:'unused',kind:'scalar'}},frames:[{id:'f',state:{},events:[
    {id:'return',type:'return',order:14,source:source(0,20),targets:[]},
    read('return-read',15,10,11),
    {id:'complete',type:'return-complete',order:16,returnEventId:'return',source:source(0,20),targets:[]},
    read('output-read',19,30,31),
    {id:'output',type:'output',order:20,source:source(25,40),targets:[]},
    {id:'call',type:'call',order:22,source:source(50,70),targets:[]},
    read('argument-read',23,60,61),
    {id:'call-complete',type:'call-return',order:24,callEventId:'call',source:source(50,70),targets:[]}
  ]}]});
  const events = document.frames[0].events;
  for (const [ownerId,readId] of [['return','return-read'],['output','output-read'],['call','argument-read']]) {
    const owner=events.find(event=>event.id===ownerId),executed=events.find(event=>event.id===readId);
    assert.equal(executed.semantics.ownerEventId,ownerId);
    assert.deepEqual(Array.from(owner.semantics.reads,target=>target.variableId),['local']);
    assert.deepEqual(Array.from(owner.semantics.readEventIds),[readId]);
  }
  assert.equal(events.find(event=>event.id==='complete').semantics.reads.length,0);
  const reopened=c.ASMTraceModel.normalizeTraceDocument(JSON.parse(JSON.stringify(document)));
  assert.deepEqual(Array.from(reopened.frames[0].events.find(event=>event.id==='output').semantics.readEventIds),['output-read'],
    'normalization must not accumulate duplicate read ownership');
});
