'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('playwright');
const {startIsolatedServer}=require('./helpers/isolated-server');
const {readPackage,savedTrace}=require('./helpers/deck-package');

test('merge sort frames 11 and 12 keep marks at the moving cell corner', {timeout:120000},async t=>{
 const {base}=await startIsolatedServer(t),body=readPackage(fs.readFileSync('public/guest-decks/merge-sort.asmdeck')).body;
 const traces=body.deck.groups.flatMap(g=>g.slides||[]).filter(s=>s.animation).slice(0,2).map(s=>savedTrace(body,s.animation));
 const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/algorithm.html?asmEmbed=runtime');await page.waitForFunction(()=>window.ASMTracePlayer);await page.addScriptTag({url:base+'/slides-storage.js'});
 const reports=await page.evaluate(async traces=>{
  const reports=[],store=ASMSlideStorage.create(indexedDB,localStorage,'merge-kept-mark-motion');
  const camera=ASMTraceCamera;window.ASMTraceCamera={...camera,apply(){},transitionDuration:()=>0};
  window.ASMStructureLOD=undefined;
  for(let example=0;example<traces.length;example++)for(const saved of [false,true])for(const rate of [1,2])for(const index of [10,11]){
   let trace=structuredClone(traces[example]);
   if(saved){for(const f of trace.frames)for(const e of f.events)delete e.semantics;const key=await ASMSlideStorage.digest(ASMSlideStorage.canonical(trace));await store.putTrace(key,trace);trace=await store.loadTrace(key);}
   ASMTracePlayer.apply(trace);window.asmGetAnimationPlaybackRate=()=>rate;await ASMTracePlayer.render(index-1,{stable:true});await new Promise(requestAnimationFrame);
   const native={raf:requestAnimationFrame,cancel:cancelAnimationFrame,now:Object.getOwnPropertyDescriptor(performance,'now')};
   let clock=performance.now(),elapsed=0,serial=0,checked=0,activeChecks=0,maxError=0;const callbacks=new Map(),failures=[];
   window.requestAnimationFrame=f=>{callbacks.set(++serial,f);return serial;};window.cancelAnimationFrame=id=>callbacks.delete(id);Object.defineProperty(performance,'now',{configurable:true,value:()=>clock});
   try{
    const pending=ASMTracePlayer.render(index,{fromIndex:index-1,forceTransition:true}),total=ASMTracePlayer.getLastPlaybackPlan()?.totalDurationMs||1000;
    while(elapsed<total/rate+200){elapsed+=25;clock+=25;const batch=[...callbacks.values()];callbacks.clear();batch.forEach(f=>f(clock));for(let n=0;n<10;n++)await Promise.resolve();
     const active=document.querySelector('#asm-trace-root')?.dataset.traceActiveEventType;
     for(const mark of document.querySelectorAll('[data-trace-attachment-kind="mark"]')){
      const cell=mark.closest('.asm-trace-style-decoration')?._asmStyleCell,rect=cell?.querySelector(':scope > rect');
      if(!cell?.isConnected||!rect||mark.closest('[display="none"]')||getComputedStyle(mark).visibility==='hidden')continue;
      const matrix=cell.getScreenCTM().inverse().multiply(mark.getScreenCTM()),box=mark.getBBox(),actual=new DOMPoint(box.x+box.width/2,box.y+box.height/2).matrixTransform(matrix);
      // drawMark 的手寫幾何：右下角內縮 (9.5,10)，不是從播放計畫或 style basis 推回答案。
      const expected={x:Number(rect.getAttribute('x'))+Number(rect.getAttribute('width'))-9.5,y:Number(rect.getAttribute('y'))+Number(rect.getAttribute('height'))-10};
      const error=Math.max(Math.abs(actual.x-expected.x),Math.abs(actual.y-expected.y));maxError=Math.max(maxError,error);checked++;if(active==='compare')activeChecks++;
      if(error>0.002&&failures.length<4)failures.push({elapsed,active,key:mark.dataset.traceAttachedTo,actual:{x:actual.x,y:actual.y},expected,error});
     }
    }
    document.querySelectorAll('#asm-trace-root *').forEach(el=>el.getAnimations?.().forEach(a=>{if(a.transitionProperty)a.finish();}));
    window.requestAnimationFrame=native.raf;window.cancelAnimationFrame=native.cancel;if(native.now)Object.defineProperty(performance,'now',native.now);else delete performance.now;await pending;
    reports.push({example,saved,rate,frame:index+1,checked,activeChecks,maxError,failures});
   }finally{ASMTraceFrameTween.cancel();window.requestAnimationFrame=native.raf;window.cancelAnimationFrame=native.cancel;if(native.now)Object.defineProperty(performance,'now',native.now);else delete performance.now;}
  }
  window.ASMTraceCamera=camera;return reports;
 },traces);
 for(const r of reports){assert.ok(r.checked>0,JSON.stringify(r));if(r.frame===11)assert.ok(r.activeChecks>0,'actual comparison must be sampled');assert.deepEqual(r.failures,[],JSON.stringify(r));}
 assert.equal(reports.length,16);assert.deepEqual(errors,[]);
});
