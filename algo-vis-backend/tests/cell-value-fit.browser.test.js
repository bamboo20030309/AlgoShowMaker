'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('playwright');const {startStaticUiServer}=require('./helpers/static-ui-server');const {readPackage,savedTrace}=require('./helpers/deck-package');
test('segment tree page 26 frame 71 to 72 refits field rows whenever displayed width changes',{timeout:60000},async t=>{
 const {base}=await startStaticUiServer(t),body=readPackage(fs.readFileSync('public/guest-decks/segment-tree-teaching.asmdeck')).body;
 const trace=savedTrace(body,body.deck.groups.flatMap(g=>g.slides)[25].animation);
 const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());const page=await browser.newPage();
 await page.goto(base+'/algorithm.html?asmEmbed=runtime');await page.waitForFunction(()=>window.ASMTracePlayer);
 for(const speed of [1,4]){
  const report=await page.evaluate(async({trace,speed})=>{
   const doc=ASMTracePlayer.apply(JSON.parse(JSON.stringify(trace)));window.asmGetAnimationPlaybackRate=()=>speed;await ASMTracePlayer.render(70,{stable:true});
   const native={raf:requestAnimationFrame,cancel:cancelAnimationFrame,now:Object.getOwnPropertyDescriptor(performance,'now')};let clock=performance.now(),elapsed=0,id=0;const callbacks=new Map(),samples=[];
   const read=()=>{const root=document.getElementById('asm-trace-root');for(const cell of root.querySelectorAll('[data-trace-index]')){
    if(cell.closest('[data-trace-snapshot]'))continue;const text=cell.querySelector(':scope > text'),rect=cell.querySelector(':scope > rect');if(!text?.querySelector('[data-trace-field-variable]')||!rect)continue;
    const b=text.getBBox(),w=+rect.getAttribute('width');if(b.width>0)samples.push({event:root.dataset.traceActiveEventId,index:cell.dataset.traceIndex,text:text.textContent,width:b.width,available:w-8,font:text.getAttribute('font-size')});
   }};
   requestAnimationFrame=cb=>{callbacks.set(++id,cb);return id;};cancelAnimationFrame=id=>callbacks.delete(id);Object.defineProperty(performance,'now',{configurable:true,value:()=>clock});
   const restore=()=>{requestAnimationFrame=native.raf;cancelAnimationFrame=native.cancel;if(native.now)Object.defineProperty(performance,'now',native.now);else delete performance.now;};
   try{const pending=ASMTracePlayer.render(71,{fromIndex:70,forceTransition:true});const duration=ASMTracePlayer.getLastPlaybackPlan().totalDurationMs/speed;
    while(elapsed<duration+100){elapsed+=8;clock+=8;const batch=[...callbacks.values()];callbacks.clear();batch.forEach(cb=>cb(clock));for(let i=0;i<12;i++)await Promise.resolve();read();}
    restore();await pending;read();return samples;
   }finally{restore();ASMTraceFrameTween.cancel();}
  },{trace,speed});
  fs.mkdirSync('test-results/cell-value-fit',{recursive:true});fs.writeFileSync(`test-results/cell-value-fit/${speed}.json`,JSON.stringify(report));
  assert.ok(report.some(s=>s.index==='19'),'must inspect the reported updated node');
  const bad=report.find(s=>s.width>s.available+.5);assert.equal(bad,undefined,'displayed field row must fit its cell: '+JSON.stringify(bad));
 }
});
