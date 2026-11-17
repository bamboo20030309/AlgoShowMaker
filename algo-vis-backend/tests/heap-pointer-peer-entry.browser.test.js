'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('playwright'),{startIsolatedServer}=require('./helpers/isolated-server');
const {readPackage,savedTrace}=require('./helpers/deck-package');

test('bottom-up heap frame 3 to 4 keeps now arrow aligned when largest appears',{timeout:90000},async t=>{
 const body=readPackage(fs.readFileSync('public/guest-decks/heap-teaching.asmdeck')).body;
 const animation=body.deck.groups.flatMap(g=>g.slides).find(s=>s.animation?.code.startsWith('// Bottom-up')).animation;
 const trace=savedTrace(body,animation);
 const {base}=await startIsolatedServer(t),browser=await chromium.launch({headless:true,channel:'msedge'});t.after(()=>browser.close());
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/algorithm.html?asmEmbed=runtime');await page.waitForFunction(()=>window.ASMTracePlayer);
 for(const speed of [1,4]){
  const report=await page.evaluate(async({trace,speed})=>{
   ASMTracePlayer.apply(JSON.parse(JSON.stringify(trace)));window.asmGetAnimationPlaybackRate=()=>speed;
   await ASMTracePlayer.render(2,{stable:true});
   const read=()=>{const root=document.getElementById('asm-trace-root'),inverse=root.getScreenCTM().inverse();
    return [...root.querySelectorAll('[data-trace-source-variable-id]')].map(marker=>{
     const label=marker.querySelector('.trace-variable-marker-label-text'),rect=marker.querySelector('.trace-variable-marker-label-box');
     if(!label||!rect)return null;
     let opacity=1;for(let n=rect;n?.nodeType===1;n=n.parentElement){const s=getComputedStyle(n);if(s.display==='none'||s.visibility==='hidden'){opacity=0;break;}opacity*=Number(s.opacity);}
     const b=rect.getBoundingClientRect(),p=new DOMPoint(b.x+b.width/2,b.y+b.height/2).matrixTransform(inverse);
     const path=marker.querySelector('.trace-variable-marker-point path')?.getAttribute('d'),numbers=path?.match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi)?.map(Number)||[];
     return{name:label.textContent,x:p.x,y:p.y,opacity,mode:marker.dataset.tracePointerArrowAnchorMode,target:marker.dataset.traceBindingTarget,dx:numbers[2]-numbers[0],dy:numbers[3]-numbers[1]};
    }).filter(Boolean);
   };
   const native={raf:requestAnimationFrame,cancel:cancelAnimationFrame,now:Object.getOwnPropertyDescriptor(performance,'now')};
   let clock=performance.now(),elapsed=0,serial=0;const callbacks=new Map(),samples=[],slots=[];
   window.requestAnimationFrame=cb=>{callbacks.set(++serial,cb);return serial;};window.cancelAnimationFrame=id=>callbacks.delete(id);Object.defineProperty(performance,'now',{configurable:true,value:()=>clock});
   const listener=e=>{if(e.detail.phase==='start')slots.push({at:elapsed,type:e.detail.event.type,name:e.detail.event.name,expression:e.detail.event.expression,start:e.detail.slot.start,motionStart:e.detail.slot.motionStart,end:e.detail.slot.end});};
   window.addEventListener('asm:trace-active-event',listener);
   const before=read();
   try{
    const pending=ASMTracePlayer.render(3,{fromIndex:2,forceTransition:true});const total=ASMTracePlayer.getLastPlaybackPlan().totalDurationMs;
    while(elapsed<total+100){elapsed+=16;clock+=16;const batch=[...callbacks.values()];callbacks.clear();batch.forEach(cb=>cb(clock));for(let k=0;k<12;k++)await Promise.resolve();samples.push({at:elapsed,markers:read()});}
    window.requestAnimationFrame=native.raf;window.cancelAnimationFrame=native.cancel;if(native.now)Object.defineProperty(performance,'now',native.now);else delete performance.now;await pending;
    return{before,samples,slots,after:read()};
   }finally{window.requestAnimationFrame=native.raf;window.cancelAnimationFrame=native.cancel;if(native.now)Object.defineProperty(performance,'now',native.now);else delete performance.now;window.removeEventListener('asm:trace-active-event',listener);ASMTraceFrameTween.cancel();}
  },{trace,speed});
  fs.mkdirSync('test-results/heap-pointer-peer-entry',{recursive:true});fs.writeFileSync(`test-results/heap-pointer-peer-entry/${speed}.json`,JSON.stringify(report));
  const now=report.before.find(p=>p.name==='now');assert.ok(now);assert.ok(Math.abs(now.dx)<.001&&now.dy>0);
  const shared=report.samples.filter(s=>s.markers.some(p=>p.name==='largest'&&p.opacity>.001));assert.ok(shared.length>5);
  const first=shared[0].markers.find(p=>p.name==='largest');
  assert.ok(Math.abs(first.x-now.x-13)<1,'largest must first appear beside now at index 5, not at the later index 10: '+JSON.stringify(first));
  assert.ok(first.y<=now.y&&first.y>=now.y-17,'largest enters from above the current row');
  const assign=report.slots.find(s=>s.expression==='largest = left');assert.ok(assign);
  const settled=report.samples.find(s=>s.at>400/speed&&s.at<assign.at);
  const pair=settled.markers.filter(p=>['now','largest'].includes(p.name));assert.equal(pair.length,2);
  assert.ok(Math.abs((pair[0].x+pair[1].x)/2-now.x)<1,'both labels must share the index-5 slots before reassignment');
  const bad=shared.find(s=>{const p=s.markers.find(p=>p.name==='now'&&p.opacity>.001);return !p||Math.abs(p.dx)>=.001||p.dy<=0;});
  assert.ok(!bad,'now arrow must retain its vertical geometry: '+JSON.stringify(bad));
  assert.deepEqual(errors,[]);
 }
});
