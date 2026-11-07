'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const c={window:{},document:{documentElement:{dataset:{}}}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/trace-frame-tween.js'),'utf8'),c);
const clock=c.window.ASMTraceFrameTween.recursionDeclarationClock;
const element={dataset:{traceLayoutPreferredVariable:'num',traceLayoutActivation:'child'}};
const declaration=(id,activation,lifetime)=>({id,type:'declare',recursionActivationId:activation,targets:[{variableId:'num',lifetimeIdentity:lifetime}]});
test('growth uses its own activation declaration, never a same-name ancestor event',()=>{
 const parent=declaration('p','parent','p'),child=declaration('c','child','c');
 const slots=[{event:parent,animation:'declare',start:50,duration:220},{event:child,animation:'declare',visualStart:700,start:700,duration:1500}];
 const result=clock(element,{}, {events:[parent,child],state:{num:{lifetime:'c'}}},slots);
 assert.equal(result.eventId,'c');assert.equal(result.start,700);assert.equal(result.duration,220,'initializer transfer does not extend structural entrance');
});
test('old events use verified lifetime; missing declarations keep authored growth independent',()=>{
 const parent=declaration('p',undefined,'p'),child=declaration('c',undefined,'c');
 const frame={events:[parent,child],state:{num:{lifetime:'c'}}};
 const result=clock(element,{},frame,[{event:child,animation:'declare',start:800,duration:220}]);
 assert.equal(result.eventId,'c');assert.equal(result.start,800);
 assert.equal(clock(element,{}, {events:[parent],state:{num:{lifetime:'c'}}},[]),null);
 assert.equal(clock(element,null,frame,[]),null,'keep handoff without new growth is not redeclared');
});
test('a disabled declaration immediately commits the node without an independent animation',()=>{
 const event=declaration('c','child','c');event.enabled=false;
 const result=clock(element,{}, {events:[event]},[]);
 assert.equal(result.instant,true);assert.equal(result.start,0);assert.equal(result.duration,0);
});
