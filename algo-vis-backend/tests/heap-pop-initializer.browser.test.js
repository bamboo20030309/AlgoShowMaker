'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('playwright'),{startIsolatedServer}=require('./helpers/isolated-server');
const {readPackage,savedTrace}=require('./helpers/deck-package');

test('saved Heap keeps the removed tail until pop and initializes a disabled-assignment pointer at its source',{timeout:90000},async t=>{
 const body=readPackage(fs.readFileSync('public/guest-decks/heap-teaching.asmdeck')).body;
 const animation=body.deck.groups.flatMap(g=>g.slides).find(s=>s.animation?.code.includes('pop_back')).animation;
 const trace=savedTrace(body,animation);
 assert.equal(trace.studio.eventInstructionStates['assign:heap_pop:largest = now'],false);
 const {base}=await startIsolatedServer(t),browser=await chromium.launch({headless:true,channel:'msedge'});t.after(()=>browser.close());
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/algorithm.html?asmEmbed=runtime');await page.waitForFunction(()=>window.ASMTracePlayer);
 for(const speed of [1,4]){
 const runs=await page.evaluate(async({trace,speed})=>{
  const doc=ASMTracePlayer.apply(JSON.parse(JSON.stringify(trace)));
  window.asmGetAnimationPlaybackRate=()=>speed;
  const runs=[];
  const visible=n=>{if(!n)return false;let o=1;for(;n?.nodeType===1;n=n.parentElement){const s=getComputedStyle(n);if(s.display==='none'||s.visibility==='hidden')return false;o*=Number(s.opacity);}return o>.001;};
  for(const from of [39,40]){
   await ASMTracePlayer.render(from,{stable:true});
   const native={raf:requestAnimationFrame,cancel:cancelAnimationFrame,now:Object.getOwnPropertyDescriptor(performance,'now')};
   let clock=performance.now(),elapsed=0,serial=0;const callbacks=new Map(),slots=[],samples=[];
   window.requestAnimationFrame=cb=>{callbacks.set(++serial,cb);return serial;};window.cancelAnimationFrame=id=>callbacks.delete(id);
   Object.defineProperty(performance,'now',{configurable:true,value:()=>clock});
   const listener=e=>{if(e.detail.phase==='start')slots.push({at:elapsed,name:e.detail.event.name,expression:e.detail.event.expression,operation:e.detail.event.operation,type:e.detail.event.type,start:e.detail.slot.start,visualStart:e.detail.slot.visualStart});};
   window.addEventListener('asm:trace-active-event',listener);
   try{
    const pending=ASMTracePlayer.render(from+1,{fromIndex:from,forceTransition:true});
    const total=ASMTracePlayer.getLastPlaybackPlan().totalDurationMs;
    while(elapsed<total+200){elapsed+=20;clock+=20;const batch=[...callbacks.values()];callbacks.clear();batch.forEach(cb=>cb(clock));for(let k=0;k<12;k++)await Promise.resolve();
     const root=document.getElementById('asm-trace-root');
     const tail=[...root.querySelectorAll('[data-trace-index="10"]')].find(n=>visible(n)&&n.querySelector('[data-trace-content-role="value"]')?.textContent==='100');
     const marker=[...root.querySelectorAll('[data-trace-source-variable-id]')].find(n=>n.dataset.traceSourceVariableId===Object.keys(doc.variables).find(id=>doc.variables[id].name==='largest'&&doc.variables[id].functionName==='heap_pop')&&visible(n.querySelector('.trace-variable-marker-label-box')));
     const label=marker?.querySelector('.trace-variable-marker-label-box'),rect=label?.getBoundingClientRect();
     const x=rect?new DOMPoint(rect.x+rect.width/2,rect.y+rect.height/2).matrixTransform(root.getScreenCTM().inverse()).x:null;
     const cells=[...root.querySelectorAll('[data-trace-index]')].filter(n=>n.closest('[data-layout="heap"]'));
     const centers=[1,2].map(i=>{const n=cells.find(n=>Number(n.dataset.traceIndex)===i);const r=n?.getBoundingClientRect();return r?new DOMPoint(r.x+r.width/2,r.y+r.height/2).matrixTransform(root.getScreenCTM().inverse()).x:null;});
     samples.push({at:elapsed,tail:!!tail,x,centers,active:slots.at(-1)?.expression||slots.at(-1)?.name});
    }
    window.requestAnimationFrame=native.raf;window.cancelAnimationFrame=native.cancel;if(native.now)Object.defineProperty(performance,'now',native.now);else delete performance.now;
    await pending;runs.push({from,slots,samples});
   }finally{window.requestAnimationFrame=native.raf;window.cancelAnimationFrame=native.cancel;if(native.now)Object.defineProperty(performance,'now',native.now);else delete performance.now;window.removeEventListener('asm:trace-active-event',listener);ASMTraceFrameTween.cancel();}
  }
  await ASMTracePlayer.render(39,{stable:true});
  const cancelled=ASMTracePlayer.render(40,{fromIndex:39,forceTransition:true});
  for(let k=0;k<12;k++)await Promise.resolve();
  ASMTraceFrameTween.cancel();await cancelled;
  if(document.querySelector('.asm-trace-sequence-pending-removal'))throw Error('Cancelled pop retained a temporary cell');
  return runs;
 },{trace,speed});
 fs.mkdirSync('test-results/heap-pop-initializer',{recursive:true});fs.writeFileSync(`test-results/heap-pop-initializer/${speed}.json`,JSON.stringify(runs));
 const pop=runs[0].slots.find(s=>s.operation==='pop_back');assert.ok(pop,'pop event must play');
 const before=runs[0].samples.filter(s=>s.at<pop.at+(pop.visualStart-pop.start+200)/speed);assert.ok(before.length>2);assert.ok(before.every(s=>s.tail),`tail missing before pop: ${JSON.stringify(before.find(s=>!s.tail))}`);
 assert.equal(runs[0].samples.at(-1).tail,false);
 const init=runs[1],first=init.samples.find(s=>s.x!==null);assert.ok(first,'largest must enter');
 // At declaration its value is now=1; the later largest=left moves it to 2.
 assert.ok(Math.abs(first.x-first.centers[0])<20,`largest entered away from root: ${JSON.stringify(first)}`);
 assert.ok(Math.abs(init.samples.at(-1).x-init.samples.at(-1).centers[1])<1,'later assignment must reach left child');
 assert.ok(!init.slots.some(s=>s.expression==='largest = now'),'explicit disabled assignment stays disabled');
 }
 assert.deepEqual(errors,[]);
});
