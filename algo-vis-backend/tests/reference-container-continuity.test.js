const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const dom=new JSDOM('<!doctype html>'),context={window:{},document:dom.window.document};
vm.runInNewContext(fs.readFileSync('public/trace-frame-tween.js','utf8'),context);
const resolve=context.window.ASMTraceFrameTween.referenceContainerContinuations;
function fixture(){
 const make=id=>{const n=dom.window.document.createElement('div');n.className='asm-trace-object';Object.assign(n.dataset,{traceVariable:id,traceObjectKey:id,traceRuntimeIdentity:'same-storage',traceSceneGeneration:'2'});return n;};
 const previous=make('caller'),current=make('callee');
 return{previous,current,doc:{variables:{caller:{cppType:'vector<int>',kind:'sequence'},callee:{cppType:'vector<int>&',kind:'sequence'}}},before:{source:{},events:[]},after:{source:{},events:[]}};
}
function run(f){return resolve(f.doc,f.before,f.after,new Map([['caller',f.previous]]),new Map([['callee',f.current]]));}
test('reference container handoffs follow storage identity across calls and returns',()=>{
 const f=fixture();assert.equal(run(f).size,1);
 f.doc.variables.caller.cppType='vector<int>&';f.doc.variables.callee.cppType='vector<int>';
 assert.equal(run(f).size,1,'returning to the owning caller keeps the same container');
});
test('same label or memory alone cannot merge a new value, pointer or scene',()=>{
 for(const change of [f=>{f.current.dataset.traceRuntimeIdentity='different-storage';},
  f=>{f.doc.variables.callee.cppType='vector<int>';},
  f=>{f.current.dataset.traceSourceVariableId='index';},
  f=>{f.current.dataset.traceSceneGeneration='3';},
  f=>{f.current.dataset.traceSnapshotOwner='saved';},
  f=>{f.previous.setAttribute('opacity','0');}]){
  const f=fixture();change(f);assert.equal(run(f).size,0);
 }
});
test('authored exits, distinct aliases and new recursion nodes keep independent lifetimes',()=>{
 const exit=fixture();exit.after.events=[{type:'visual-exit',targets:[{variableId:'callee'}]}];assert.equal(run(exit).size,0);
 const ended=fixture();ended.after.events=[{type:'scope-exit',targets:[{variableId:'caller'}]}];assert.equal(run(ended).size,0);
 const alias=fixture();alias.before.source.objectIds={caller:'one'};alias.after.source.objectIds={callee:'two'};assert.equal(run(alias).size,0);
 const layout=fixture();Object.assign(layout.previous.dataset,{traceLayoutId:'tree',traceLayoutNode:'parent',traceLayoutActivation:'parent'});
 Object.assign(layout.current.dataset,{traceLayoutId:'tree',traceLayoutNode:'child',traceLayoutActivation:'child'});assert.equal(run(layout).size,0);
 Object.assign(layout.current.dataset,{traceLayoutNode:'parent',traceLayoutActivation:'parent'});assert.equal(run(layout).size,1,'an unchanged layout slot can continue');
});
