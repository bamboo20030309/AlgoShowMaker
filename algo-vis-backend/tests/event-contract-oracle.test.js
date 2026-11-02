'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {loadManifest,locateCase,verifyEvent}=require('./helpers/event-contract-oracle');
const {observeCase}=require('./helpers/event-contract-observe');
test('every contract has an independent answer and a real CASE source location',()=>{
 const m=loadManifest();assert.equal(m.cases.length,67);assert.equal(m.fixtures.length,7);
 for(const item of m.cases){
  assert.ok(locateCase(m,item).sourceLine>0,item.id);
  assert.ok(item.assertionKind==='control'?item.controlSpec&&item.eventSpec:item.expected,item.id);
 }
});
test('strict answers reject missing data, wrong values and lost duplicate operands',()=>{
 assert.equal(verifyEvent({value:3},{value:3}).pass,true);
 assert.equal(verifyEvent({}, {value:3}).pass,false);
 assert.equal(verifyEvent({value:4},{value:3}).pass,false);
 assert.equal(verifyEvent({sources:[3]},{sources:[3,3]}).pass,false);
});
test('changing an answer cannot change the observed product result',()=>{
 const manifest=loadManifest(),item=manifest.cases.find(c=>c.id==='E03'),line=locateCase(manifest,item).sourceLine;
 const scalar=value=>({kind:'scalar',value});
 const state=a=>({a:{name:'a',data:scalar(a)},b:{name:'b',data:scalar(3)}});
 const trace={variables:{a:{name:'a',kind:'scalar'},b:{name:'b',kind:'scalar'}},frames:[
  {id:'before',state:state(1),events:[]},{id:'after',state:state(3),events:[
   {id:'copy',type:'assign',order:1,line,targets:[{role:'target',variableId:'a',expression:'a'},
    {role:'source',variableId:'b',expression:'b'}],payload:{before:scalar(1),after:scalar(3),source:scalar(3)}}]}]};
 const good=observeCase({trace,item,manifest});assert.equal(good.data.pass,true);
 const wrong=observeCase({trace,item:{...item,expected:{...item.expected,after:99}},manifest});
 assert.deepEqual(wrong.actual,good.actual);assert.equal(wrong.data.pass,false);
 const corrupted=structuredClone(trace);corrupted.frames[1].events[0].payload.source=scalar(9);
 assert.equal(observeCase({trace:corrupted,item,manifest}).data.pass,false);
});
