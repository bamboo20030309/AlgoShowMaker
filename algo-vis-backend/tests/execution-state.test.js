'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function setup(){
 const c=vm.createContext({window:{},document:{documentElement:{dataset:{}}},queueMicrotask(){}});
 for(const file of ['trace-model.js','trace-rules.js','trace-frame-tween.js'])vm.runInContext(fs.readFileSync('public/'+file,'utf8'),c);
 return c.window;
}
const scalar=value=>({kind:'scalar',value});
function fixture(){
 const write=(id,name,before,after,order)=>({id,order,type:'write',update:true,enabled:false,targets:[{role:'target',variableId:name}],payload:{before:scalar(before),after:scalar(after)}});
 const events=[write('increment-i','i',0,1,1),{id:'compare',order:2,type:'compare',targets:[{role:'left',variableId:'a',indexExpression:'i+k',resolvedIndex:2},{role:'right',variableId:'k'}],payload:{left:scalar(30),right:scalar(1)}},write('increment-k','k',1,3,3),write('late-i','i',1,9,4)];
 const frame={id:'f',events,state:{i:{name:'i',data:scalar(9)},k:{name:'k',data:scalar(3)},a:{name:'a',identity:'array-A',lifetime:'one',data:{kind:'sequence',items:[10,20,30,40,50].map(scalar)}}}};
 const doc={variables:{i:{name:'i',kind:'scalar'},k:{name:'k',kind:'scalar'},a:{name:'a',kind:'sequence'}},frames:[frame]};
 return{doc,frame,events};
}
test('all expressions and pointer bindings use chronological state, including disabled writes',()=>{
 const w=setup(),{doc,frame,events}=fixture(),before=JSON.stringify(frame);
 const plan=w.ASMTraceFrameTween.createForwardReplayPlan(doc,frame,[]);
 const context=w.ASMTraceFrameTween.createExecutionContext(doc,frame,plan);
 const resolve=(event,expression,phase)=>w.ASMTraceRules.resolveExpression(doc,context.frame(event,phase),expression);
 assert.equal(resolve(events[0],'i'),0);
 assert.equal(resolve(events[1],'i+k'),2);
 assert.equal(resolve(events[1],'a[i+k]'),30);
 assert.equal(resolve(events[2],'i+k','after'),4);
 assert.equal(resolve(events[3],'i','after'),9);
 const marker={dataset:{traceSourceVariableId:'i',traceSourceVariableIds:'["i","k"]',traceMarkerIndexExpression:'i+k',traceBindingTarget:'a#12'}};
 assert.equal(context.pointerTarget(marker,events[1]),'a#2');
 assert.equal(context.pointerTarget(marker,events[2],'after'),'a#4');
 assert.deepEqual(Array.from(context.pointersByCell(new Map([['cursor',marker]]),events[1]).get('a#2')),['cursor']);
 assert.equal(JSON.stringify(frame),before,'execution state must not rewrite saved frames');
});
test('physical aliases share event cell identity while different indices and lifetimes remain distinct',()=>{
 const w=setup(),{doc,frame,events}=fixture();
 doc.variables.alias={name:'alias',kind:'sequence'};
 frame.state.alias={...frame.state.a,name:'alias'};
 doc.variables.other={name:'other',kind:'sequence'};
 frame.state.other={...frame.state.a,name:'other',lifetime:'two'};
 const context=w.ASMTraceFrameTween.createExecutionContext(doc,frame,w.ASMTraceFrameTween.createForwardReplayPlan(doc,frame,[]));
 assert.equal(context.cellIdentity('a#2',events[1]),context.cellIdentity('alias#2',events[1]));
 assert.notEqual(context.cellIdentity('a#0',events[1]),context.cellIdentity('a#2',events[1]));
 assert.notEqual(context.cellIdentity('a#2',events[1]),context.cellIdentity('other#2',events[1]));
});

test('row, column and matrix cell pointers resolve every coordinate at the event boundary',()=>{
 const w=setup(),{doc,frame,events}=fixture();
 const context=w.ASMTraceFrameTween.createExecutionContext(doc,frame,w.ASMTraceFrameTween.createForwardReplayPlan(doc,frame,[]));
 const marker=(target,expression,expressions)=>({dataset:{traceBindingTarget:target,traceMarkerIndexExpression:expression,traceMarkerIndexExpressions:JSON.stringify(expressions||null),traceSourceVariableId:'i'}});
 assert.equal(context.pointerTarget(marker('dp:row-label:9','i'),events[1]),'dp:row-label:1');
 assert.equal(context.pointerTarget(marker('dp:column-label:3','k'),events[1]),'dp:column-label:1');
 assert.equal(context.pointerTarget(marker('dp#9,3','k',['i','k']),events[1]),'dp#1,1');
 assert.equal(context.pointerTarget(marker('dp#9,3','k',['i','k']),events[2],'after'),'dp#1,3');
});

test('visual exit cannot erase a live variable; scope exit can end its logical presence',()=>{
 const w=setup(),{doc,frame,events}=fixture();
 const visualExit={id:'hide-i',order:2.5,type:'visual-exit',targets:[{variableId:'i'}]};
 const scopeExit={id:'end-i',order:5,type:'scope-exit',targets:[{variableId:'i'}]};
 frame.events=[events[0],events[1],visualExit,events[2],events[3],scopeExit];
 const context=w.ASMTraceFrameTween.createExecutionContext(doc,frame,w.ASMTraceFrameTween.createForwardReplayPlan(doc,frame,[]));
 const marker={dataset:{traceSourceVariableId:'i',traceBindingTarget:'a#9',traceMarkerIndexExpression:'i'}};
 assert.equal(context.pointerTarget(marker,events[2]),'a#1');
 assert.equal(context.pointerTarget(marker,scopeExit,'before'),'a#9');
 assert.equal(context.pointerTarget(marker,scopeExit,'after'),'unresolved:a');
});

test('sequence length is event state, not the number of final rendered cells',()=>{
 const w=setup(),{doc,frame}=fixture();
 const before={kind:'sequence',items:[10,20].map(scalar)},after={kind:'sequence',items:[10,20,30].map(scalar)};
 const push={id:'push',order:1,type:'sequence-operation',operation:'push_back',targets:[{role:'target',variableId:'a'}],payload:{before,after,beforeSize:2,afterSize:3,insertedValue:scalar(30)}};
 frame.events=[push];frame.state.a.data=after;
 doc.variables.alias={name:'alias',kind:'sequence'};frame.state.alias={...frame.state.a,name:'alias'};
 const context=w.ASMTraceFrameTween.createExecutionContext(doc,frame,w.ASMTraceFrameTween.createForwardReplayPlan(doc,frame,[]));
 assert.equal(w.ASMTraceRules.resolveExpression(doc,context.frame(push),'a.size()'),2);
 assert.equal(w.ASMTraceRules.resolveExpression(doc,context.frame(push,'after'),'a.size()'),3);
 assert.equal(w.ASMTraceRules.resolveExpression(doc,context.frame(push),'alias.size()'),2);
 const marker={dataset:{traceBindingTarget:'a#2',traceSourceVariableId:'i',traceMarkerIndexExpression:'a.size()-1'}};
 assert.equal(context.pointerTarget(marker,push),'a#1');
 assert.equal(context.pointerTarget(marker,push,'after'),'a#2');
});

test('a character write changes one string cell and does not replace the whole string',()=>{
 const w=setup(),event={id:'write-char',order:1,type:'assign',targets:[{role:'target',variableId:'s',indexExpression:'1',resolvedIndex:1}],payload:{before:scalar('b'),after:scalar('z')}};
 const frame={id:'s',events:[event],state:{s:{name:'s',data:scalar('azc')}}};
 const doc={variables:{s:{name:'s',kind:'string'}},frames:[frame]};
 const context=w.ASMTraceFrameTween.createExecutionContext(doc,frame,w.ASMTraceFrameTween.createForwardReplayPlan(doc,frame,[]));
 assert.equal(w.ASMTraceRules.resolveExpression(doc,context.frame(event),'s'),'abc');
 assert.equal(w.ASMTraceRules.resolveExpression(doc,context.frame(event,'after'),'s'),'azc');
});

test('declaring a reference does not erase its already-live source before entry',()=>{
 const w=setup(),{doc,frame}=fixture();
 doc.variables.alias={name:'alias',kind:'sequence'};frame.state.alias={...frame.state.a,name:'alias'};
 const declaration={id:'alias-entry',order:1,type:'declare',targets:[{role:'target',variableId:'alias'}],payload:{value:frame.state.a.data}};
 frame.events=[declaration];
 const context=w.ASMTraceFrameTween.createExecutionContext(doc,frame,w.ASMTraceFrameTween.createForwardReplayPlan(doc,frame,[]));
 assert.equal(w.ASMTraceRules.resolveExpression(doc,context.frame(declaration),'a[0]'),10);
 assert.equal(w.ASMTraceRules.resolveExpression(doc,context.frame(declaration,'after'),'alias[0]'),10);
});
