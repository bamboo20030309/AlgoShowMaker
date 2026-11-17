'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const window={ASMTraceRules:{resolveExpression:(_doc,frame,_expression,locals)=>locals?.i??frame.state.i.data.value}};
vm.runInNewContext(fs.readFileSync('public/trace-pointer-model.js','utf8'),{window});
const recover=window.ASMTracePointerModel.recoveredBindings;
function fixture(){
 const binding={mode:'index',explicitPointer:true,sourceVariableId:'i',targetVariableId:'a',indexExpression:'i',sourceName:'i',pointerColor:'AV_red'};
 const doc={variables:{i:{name:'i'},a:{name:'a'}}};
 const previous={bindings:[binding],state:{i:{lifetime:'i:1',data:{kind:'scalar',value:2}},a:{identity:'a:1'}}};
 const frame={bindings:[],state:{i:{lifetime:'i:1',data:{kind:'scalar',value:1}},a:{identity:'a:1'}},events:[
  {type:'sequence-operation',order:1,targets:[{role:'target',variableId:'a'}],payload:{beforeSize:3,afterSize:2}},
  {type:'write',order:2,targets:[{role:'target',variableId:'i'}],payload:{before:2,after:1}}
 ]};
 return{doc,frame,previous,binding};
}
test('temporary invalid pointer recovers by runtime order without mutating saved bindings',()=>{
 const {doc,frame,previous,binding}=fixture(),before=JSON.stringify({doc,frame,previous});
 frame.events.reverse();const reversed=JSON.stringify({doc,frame,previous});
 assert.equal(recover(doc,frame,previous)[0],binding);assert.equal(recover(doc,frame,previous)[0].pointerColor,'AV_red');
 assert.equal(JSON.stringify({doc,frame,previous}),reversed);assert.notEqual(before,reversed);
});
test('no recovery without a later valid write, and no reappearance across explicit exit or lifetime change',()=>{
 for(const change of [
  f=>{f.frame.events.pop();},
  f=>{f.frame.events[1].order=0;},
  f=>{f.frame.events[1].payload.after=2;f.frame.state.i.data.value=2;},
  f=>{f.frame.state.i.lifetime='i:2';},
  f=>{f.frame.state.a.identity='a:2';},
  ...['declare','scope-exit','visual-exit'].map(type=>f=>f.frame.events.push({type,order:3,targets:[{variableId:'i',role:'target'}]})),
  f=>{f.frame.bindings=[{sourceVariableId:'i',targetVariableId:'b'}];}
 ]){const f=fixture();change(f);assert.equal(recover(f.doc,f.frame,f.previous).length,0);}
});
test('disabled animation still commits recovery while constant pointers do not acquire a binding',()=>{
 const f=fixture();f.frame.events[1].enabled=false;assert.equal(recover(f.doc,f.frame,f.previous).length,1);
 f.previous.bindings[0].sourceVariableId='constant';f.previous.state.constant=f.previous.state.i;f.frame.state.constant=f.frame.state.i;
 assert.equal(recover(f.doc,f.frame,f.previous).length,0);
});
