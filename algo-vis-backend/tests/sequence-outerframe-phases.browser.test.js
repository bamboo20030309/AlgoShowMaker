'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {startIsolatedServer}=require('./helpers/isolated-server');
const {compile}=require('./helpers/compile');

// 固定答案直接來自使用者確認的 300+180 / 180+300 ms，
// 不讀取產品動作計畫來產生預期時間。
test('normal insert/push expand before entry; erase/pop shrink only after exit', {timeout:120000},async t=>{
 const {base}=await startIsolatedServer(t),previous=process.env.ASM_TEST_BASE_URL;
 process.env.ASM_TEST_BASE_URL=base;
 let trace;
 try {({trace}=await compile('#include <vector>\nusing namespace std;\nint main(){\nvector<int> a={2,4,6};\n// @frame a\na.insert(a.begin()+1,9);\n// @frame a\na.erase(a.begin()+1);\n// @frame a\na.push_back(8);\n// @frame a\na.pop_back();\n// @frame a\n}\n'));}
 finally {if(previous===undefined)delete process.env.ASM_TEST_BASE_URL;else process.env.ASM_TEST_BASE_URL=previous;}
 const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());
 const page=await browser.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/algorithm.html?asmEmbed=runtime');await page.waitForFunction(()=>window.asmApplyTraceDocument);
 const results=await page.evaluate(async trace=>{
  const reports=[];
  for(const rate of [1,2])for(const operation of ['insert','erase','push_back','pop_back']){
   const index=trace.frames.findIndex(f=>f.events.some(e=>e.operation===operation));
   if(index<1)throw Error('Missing operation '+operation);
   const selected=trace.frames[index].events.filter(e=>e.operation===operation);
   const copy=JSON.parse(JSON.stringify(trace));copy.frames=[copy.frames[index-1],copy.frames[index]];
   copy.studio||={};copy.studio.cameraRules=[];
   const doc=asmApplyTraceDocument(copy);const ids=new Set(selected.map(e=>e.id));doc.frames[1].events=doc.frames[1].events.filter(e=>ids.has(e.id));
   const camera=window.ASMTraceCamera;window.ASMTraceCamera={...camera,apply(){},transitionDuration:()=>0};
   await CodeScript.goto(1);
   const width=()=>{const rect=document.querySelector('#asm-trace-root [data-trace-variable] .outerframe-bg');if(!rect)throw Error('Missing outerframe');return rect.getBBox().width;};
   const final=width();await CodeScript.goto(0);await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);const before=width();
   const raf=window.requestAnimationFrame,cancel=window.cancelAnimationFrame,now=Object.getOwnPropertyDescriptor(performance,'now'),getRate=window.asmGetAnimationPlaybackRate;
   let time=performance.now(),serial=0;const callbacks=new Map();let start=0;const active=[];
   const listen=e=>{if(e.detail.phase==='start'){start=Number(e.detail.slot?.start)||0;active.push({type:e.detail.event.type,operation:e.detail.event.operation,slot:{start:e.detail.slot?.start,duration:e.detail.slot?.duration},payload:e.detail.event.payload});}};
   window.addEventListener('asm:trace-active-event',listen);
   window.requestAnimationFrame=cb=>{callbacks.set(++serial,cb);return serial;};window.cancelAnimationFrame=id=>callbacks.delete(id);
   Object.defineProperty(performance,'now',{configurable:true,value:()=>time});window.asmGetAnimationPlaybackRate=()=>rate;
   let elapsed=0;const step=async delta=>{time+=delta;elapsed+=delta;const batch=[...callbacks.values()];callbacks.clear();for(const cb of batch)cb(time);for(let i=0;i<5;i++)await Promise.resolve();};
   const advance=async target=>{while(elapsed<target)await step(Math.min(5,target-elapsed));};
   try{
    const pending=CodeScript.next();await step(0);const samples={};
    for(const at of [0,90,179,180,299,300,390,480]){await advance((start+at)/rate);samples[at]=width();}
    await advance((start+1200)/rate);await pending;
    reports.push({operation,rate,before,final,samples,active,events:doc.frames[1].events,after:width()});
   }finally{ASMTraceFrameTween.cancel();callbacks.clear();window.removeEventListener('asm:trace-active-event',listen);window.requestAnimationFrame=raf;window.cancelAnimationFrame=cancel;if(now)Object.defineProperty(performance,'now',now);else delete performance.now;window.asmGetAnimationPlaybackRate=getRate;window.ASMTraceCamera=camera;}
  }
  return reports;
 },trace);
 require('fs').mkdirSync('test-results',{recursive:true});require('fs').writeFileSync('test-results/sequence-outerframe-phases.json',JSON.stringify(results,null,2));
 const near=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<0.01,label+' '+JSON.stringify({actual,expected}));
 for(const r of results){const label=r.operation+' @'+r.rate+'x';near(r.samples[0],r.before,label+' starts at old width');near(r.after,r.final,label+' final');
  if(['insert','push_back'].includes(r.operation)){
   assert.ok(r.final>r.before,label+' grows');assert.ok(r.samples[90]>r.before&&r.samples[90]<r.final,label+' expands during make room');
   near(r.samples[300],r.final,label+' expanded by 300ms');near(r.samples[390],r.final,label+' fixed during entry');near(r.samples[480],r.final,label+' entry complete');
  }else{
   assert.ok(r.final<r.before,label+' shrinks');near(r.samples[90],r.before,label+' fixed during exit');near(r.samples[179],r.before,label+' fixed before exit completes');near(r.samples[180],r.before,label+' shrink starts after exit');
   assert.ok(r.samples[300]<r.before&&r.samples[300]>r.final,label+' shrinks during close gap');near(r.samples[480],r.final,label+' closed by 480ms');
  }
 }
 assert.deepEqual(errors,[]);
});
