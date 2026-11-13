const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {compile}=require('./helpers/compile');
const {startIsolatedServer}=require('./helpers/isolated-server');
test('standalone and nested min/max emit child-first selection events before consumers, once each',{timeout:90000},async t=>{
 const {base}=await startIsolatedServer(t),previous=process.env.ASM_TEST_BASE_URL;let trace;
 try{process.env.ASM_TEST_BASE_URL=base;({trace}=await compile(fs.readFileSync('tests/fixtures/minmax-nested.cpp','utf8')));}finally{if(previous===undefined)delete process.env.ASM_TEST_BASE_URL;else process.env.ASM_TEST_BASE_URL=previous;}
 const events=Array.from(trace.frames[1].events),selections=events.filter(e=>e.type.startsWith('select-'));
 fs.mkdirSync('test-results/selection-events',{recursive:true});fs.writeFileSync('test-results/selection-events/trace.json',JSON.stringify(trace));
 assert.deepEqual(selections.map(e=>e.expression.replace(/\s/g,'')),['max(v[0],v[1])','min(v[1],v[2])','max(v[0],v[3])','max(min(v[1],v[2]),max(v[0],v[3]))','max(v[0],v[1])','min(max(v[0],v[1]),v[2])','max(v[0],v[1])','max(i++,i++)']);
 assert.deepEqual(selections.map(e=>e.payload.source.value),[8,6,3,6,8,6,8,1]);
 assert.equal(events.filter(e=>e.type==='call'&&/max|min/.test(e.expression)).length,0,'selection must not also create a generic function call');
 const assigned=events.filter(e=>e.type==='assign'&&e.expression.includes('max'));
 assert.ok(assigned.length>=4);
 for(const event of assigned){const prior=selections.filter(s=>s.order<event.order).at(-1);assert.ok(prior);assert.equal(event.selectionEventsRecorded,true,'consumer carries provenance without re-playing selection');assert.equal(event.selectionOperation,undefined);}
 assert.deepEqual(Array.from(selections[3].dependencyEventIds),[selections[1].id,selections[2].id],'outer operation depends on its two completed inner selections');
 const outer=selections[3];assert.equal(outer.targets[0].variableId,Object.keys(trace.variables).find(id=>trace.variables[id].name==='v'));assert.equal(outer.targets[0].resolvedIndex,2,'outer comparison receives inner selected leaf');
 const post=selections.at(-1),increments=events.filter(e=>e.type==='write'&&e.expression==='i++');assert.equal(increments.length,2);assert.ok(increments.every(e=>e.order<post.order));assert.deepEqual([post.payload.left.value,post.payload.right.value],[0,1]);
 const frame=trace.frames[1];const state=name=>frame.state[Object.keys(trace.variables).find(id=>trace.variables[id].name===name)].data;
 assert.equal(state('x').value,1);assert.equal(state('i').value,2);assert.equal(state('initial').value,6);
});

test('selection preserves references to visible lvalue operands',{timeout:60000},async t=>{
 const{base}=await startIsolatedServer(t),old=process.env.ASM_TEST_BASE_URL;let trace;
 try{process.env.ASM_TEST_BASE_URL=base;({trace}=await compile(`#include <bits/stdc++.h>
using namespace std;int main(){vector<int> v={3,8};int observed=0;
// @frame v,observed
const int& alias=max(v[0],v[1]);v[1]=11;observed=alias;
// @frame v,observed
}`));}finally{if(old===undefined)delete process.env.ASM_TEST_BASE_URL;else process.env.ASM_TEST_BASE_URL=old;}
 const frame=trace.frames[1],key=Object.keys(trace.variables).find(id=>trace.variables[id].name==='observed');assert.equal(frame.state[key].data.value,11,'max returns the selected lvalue, rather than a copied temporary');
 assert.equal(frame.events.filter(e=>e.type==='select-max').length,1);
});
