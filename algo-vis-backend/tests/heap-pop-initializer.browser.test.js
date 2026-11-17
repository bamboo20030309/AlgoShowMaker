'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('playwright'),{startIsolatedServer}=require('./helpers/isolated-server');
const {readPackage,savedTrace}=require('./helpers/deck-package');
const {compile}=require('./helpers/compile');

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
     const sizeMarker=[...root.querySelectorAll('[data-trace-source-variable-id]')].find(n=>n.querySelector('.trace-variable-marker-label-text')?.textContent==='heapSize');
     const sizeLabel=sizeMarker?.querySelector('.trace-variable-marker-label-box'),sizeRect=sizeLabel?.getBoundingClientRect();
     const arrowNumbers=sizeMarker?.querySelector('.trace-variable-marker-point path')?.getAttribute('d')?.match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi)?.map(Number)||[];
     const sizePoint=sizeRect?new DOMPoint(sizeRect.x+sizeRect.width/2,sizeRect.y+sizeRect.height/2).matrixTransform(root.getScreenCTM().inverse()):null;
     let sizeOpacity=sizeLabel?1:0;for(let n=sizeLabel;n?.nodeType===1;n=n.parentElement){const s=getComputedStyle(n);if(s.display==='none'||s.visibility==='hidden'){sizeOpacity=0;break;}sizeOpacity*=Number(s.opacity);}
     const ninth=cells.find(n=>Number(n.dataset.traceIndex)===9),ninthRect=ninth?.getBoundingClientRect();
     const ninthPoint=ninthRect?new DOMPoint(ninthRect.x+ninthRect.width/2,ninthRect.y+ninthRect.height/2).matrixTransform(root.getScreenCTM().inverse()):null;
     samples.push({at:elapsed,tail:!!tail,x,centers,heapSize:sizePoint?{x:sizePoint.x,y:sizePoint.y,opacity:sizeOpacity,dx:arrowNumbers[2]-arrowNumbers[0],dy:arrowNumbers[3]-arrowNumbers[1]}:null,ninth:ninthPoint?{x:ninthPoint.x,y:ninthPoint.y}:null,active:slots.at(-1)?.expression||slots.at(-1)?.name});
    }
    window.requestAnimationFrame=native.raf;window.cancelAnimationFrame=native.cancel;if(native.now)Object.defineProperty(performance,'now',native.now);else delete performance.now;
    await pending;runs.push({from,slots,samples});
   }finally{window.requestAnimationFrame=native.raf;window.cancelAnimationFrame=native.cancel;if(native.now)Object.defineProperty(performance,'now',native.now);else delete performance.now;window.removeEventListener('asm:trace-active-event',listener);ASMTraceFrameTween.cancel();}
  }
  const reopened=ASMTracePlayer.apply(JSON.parse(JSON.stringify(ASMTracePlayer.getDocument())));
  await ASMTracePlayer.render(40,{stable:true});
  const stableRoot=document.getElementById('asm-trace-root');
  const stableMarker=[...stableRoot.querySelectorAll('[data-trace-source-variable-id]')].find(n=>n.querySelector('.trace-variable-marker-label-text')?.textContent==='heapSize');
  if(!visible(stableMarker?.querySelector('.trace-variable-marker-label-box')))throw Error('Reopened frame lost the recovered pointer');
  if(reopened.frames[40].bindings.length)throw Error('Recovery mutated the stored bindings');
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
 const sizeFinal=runs[0].samples.at(-1);
 assert.ok(runs[0].samples.every(s=>s.heapSize?.opacity>.999),'temporary missing cell must not fade the recovering pointer');
 assert.ok(runs[0].samples.filter(s=>!s.tail).every(s=>Math.abs(s.heapSize.dx)<.001&&s.heapSize.dy>0),'missing-target heapSize arrow must stay vertically downward');
 assert.ok(sizeFinal.heapSize?.opacity>.999,'recovering heapSize must remain visible after decrement');
 assert.ok(Math.abs(sizeFinal.heapSize.x-sizeFinal.ninth.x)<1,'heapSize must arrive at heap[9]');
 const sizeStart=runs[0].samples[0].heapSize.x;
 assert.ok(runs[0].samples.some(s=>s.heapSize.x<sizeStart-2&&s.heapSize.x>sizeFinal.heapSize.x+2),'decrement must slide continuously rather than teleport');
 const init=runs[1],first=init.samples.find(s=>s.x!==null);assert.ok(first,'largest must enter');
 // At declaration its value is now=1; the later largest=left moves it to 2.
 assert.ok(Math.abs(first.x-first.centers[0])<20,`largest entered away from root: ${JSON.stringify(first)}`);
 assert.ok(Math.abs(init.samples.at(-1).x-init.samples.at(-1).centers[1])<1,'later assignment must reach left child');
 assert.ok(!init.slots.some(s=>s.expression==='largest = now'),'explicit disabled assignment stays disabled');
 }
 assert.deepEqual(errors,[]);
});

test('new normal-array cursor recovers with its custom color and survives save/reopen',{timeout:60000},async t=>{
 const {base}=await startIsolatedServer(t),oldBase=process.env.ASM_TEST_BASE_URL;
 let trace;
 try{process.env.ASM_TEST_BASE_URL=base;({trace}=await compile(`#include <vector>
int main(){std::vector<int>a={3,6,9};int i=2;
// @frame a
// @pointer i at a color AV_red
a.pop_back();i--;
// @frame a
// @text "Recovered cursor before leaving main" at a.bottom
// @frame a
}
`));}finally{if(oldBase===undefined)delete process.env.ASM_TEST_BASE_URL;else process.env.ASM_TEST_BASE_URL=oldBase;}
 const browser=await chromium.launch({headless:true,channel:'msedge'});t.after(()=>browser.close());
 const page=await browser.newPage();await page.goto(base+'/algorithm.html?asmEmbed=runtime');await page.waitForFunction(()=>window.ASMTracePlayer);
 const result=await page.evaluate(async trace=>{
  const doc=ASMTracePlayer.apply(trace);await ASMTracePlayer.render(0,{stable:true});
  const read=()=>{const root=document.getElementById('asm-trace-root'),marker=[...root.querySelectorAll('[data-trace-source-variable-id]')].find(n=>n.querySelector('.trace-variable-marker-label-text')?.textContent==='i');
   const box=marker?.querySelector('.trace-variable-marker-label-box'),cell=root.querySelector('[data-trace-index="1"]');
   return{target:marker?.dataset.traceBindingTarget,color:box?.getAttribute('fill'),x:box?.getBoundingClientRect().x,width:box?.getBoundingClientRect().width,cellX:cell?.getBoundingClientRect().x,cellWidth:cell?.getBoundingClientRect().width};};
  const before=read();await ASMTracePlayer.render(1);const animated=read();
  ASMTracePlayer.apply(JSON.parse(JSON.stringify(doc)));await ASMTracePlayer.render(1,{stable:true});return{before,animated,reopened:read()};
 },trace);
 fs.mkdirSync('test-results/heap-pop-initializer',{recursive:true});
 fs.writeFileSync('test-results/heap-pop-initializer/new-array.json',JSON.stringify({trace,result}));
 assert.equal(result.before.color,'rgba(239, 154, 154, 0.6)');
 for(const value of [result.animated,result.reopened]){assert.ok(value.target?.endsWith('#1'),JSON.stringify(result));assert.equal(value.color,result.before.color);assert.ok(Math.abs(value.x+value.width/2-value.cellX-value.cellWidth/2)<1);}
});
