'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function policy(){const context=vm.createContext({window:{}});vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/trace-frame-tween.js'),'utf8'),context);return context.window.ASMTraceFrameTween;}

test('equal before and after values retain the ordinary assignment stages',()=>{
 const p=policy();
 for(const kind of ['copy','compute','literal']){
  const plan=p.eventActionPlan({type:'assign',semantics:{kind},payload:{before:8,after:8}});
  assert.equal(plan.durationMs,1260,kind);assert.equal(plan.commitMs,660,kind);
  assert.deepEqual(Array.from(plan.stages,s=>s.id),['prepare','transfer','result-hold','cleanup'],kind);
 }
});
test('motion policy has fixed independent clocks and no extra read step',()=>{
 const p=policy();
 const event={type:'assign',semantics:{kind:'compute'},payload:{before:3,after:11}};
 assert.equal(p.eventActionPlan(event).commitMs,660);assert.equal(p.eventActionPlan(event).durationMs,1260);
 assert.equal(p.eventActionPlan({...event,type:'declare'}).durationMs,220);
 assert.equal(p.eventActionPlan({...event,type:'compare'}).durationMs,1560);
 assert.equal(p.eventActionPlan({...event,type:'swap'}).durationMs,520);
 assert.equal(p.eventActionPlan(event).readHighlight,'owner');
});
test('legacy winner-only selections never invent comparison operands',()=>{
 const p=policy(),event={type:'assign',selectionOperation:'min',selectedSourceRole:'source-left',payload:{before:0,after:3}};
 const old=p.eventActionPlan(event);assert.equal(old.durationMs,1260);assert.equal(old.commitMs,660);
 assert.ok(!old.stages.some(s=>s.id.startsWith('select')));
 const complete=p.eventActionPlan({...event,payload:{...event.payload,left:3,right:8}});
 assert.equal(complete.durationMs,2820);assert.equal(complete.commitMs,2220);
});
