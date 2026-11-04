'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {compile}=require('./helpers/compile');
const {startIsolatedServer}=require('./helpers/isolated-server');

for (const shape of ['array','matrix']) test(shape+' styles share comparison motion and survive temporary cell copies', {timeout:120000},async t=>{
 const {base}=await startIsolatedServer(t),oldBase=process.env.ASM_TEST_BASE_URL;let trace;
 let code=`#include <vector>
// @preset view
// @object a with labels(value,index)
// @object target
// @style a[0:1] highlight,point,mark
// @style a[0:1] highlight #567890
// @style a[0:1] point #345678
// @style a[0:1] mark #123456
// @style a[0] background AV_blue
// @style a[0] focus
// @endpreset
int main(){std::vector<int> a={8,3};int target=0;
// @frame use view
bool answer=a[0]<a[1];
// @frame use view
answer=a[0]==a[0];
// @frame use view
target=a[0];
// @frame use view
}`;
 if(shape==='matrix')code=code.replace('std::vector<int> a={8,3};','std::vector<std::vector<int>> a={{8,3}};')
  .replace('@object a with','@object a render matrix with').replace(/a\[([01])\]/g,'a[0][$1]').replaceAll('a[0:1]','a[0][0:1]');
 try{process.env.ASM_TEST_BASE_URL=base;({trace}=await compile(code));}finally{if(oldBase===undefined)delete process.env.ASM_TEST_BASE_URL;else process.env.ASM_TEST_BASE_URL=oldBase;}
 const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/algorithm.html?asmEmbed=runtime');await page.waitForFunction(()=>window.ASMTracePlayer);
 await page.addScriptTag({url:base+'/slides-storage.js'});
 await page.addStyleTag({content:'.arrow-bounce{animation:none!important}'});
 const reports=await page.evaluate(async raw=>{
  const store=ASMSlideStorage.create(indexedDB,localStorage,'style-cell-motion'),reports=[];
  const camera=ASMTraceCamera;window.ASMTraceCamera={...camera,apply(){},transitionDuration:()=>0};
  const components=m=>['a','b','c','d','e','f'].map(k=>m[k]);
  for(const saved of [false,true])for(const rate of [1,2])for(const self of [false,true]){
   const copy=structuredClone(raw),index=copy.frames.findIndex(f=>f.events.some(e=>e.type==='compare'&&(e.operation==='==')===self));
   copy.frames=[copy.frames[index-1],copy.frames[index]];copy.frames[1].events=copy.frames[1].events.filter(e=>e.type==='compare');
   copy.studio||={};copy.studio.eventSettings={gapMs:0,readHighlightEnabled:true,readHighlightColor:'#ff0000'};
   if(saved){for(const f of copy.frames)for(const e of f.events)delete e.semantics;const key=await ASMSlideStorage.digest(ASMSlideStorage.canonical(copy));await store.putTrace(key,copy);Object.assign(copy,await store.loadTrace(key));}
   ASMTracePlayer.apply(copy);await ASMTracePlayer.render(0,{stable:true});await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
   const native={raf:requestAnimationFrame,cancel:cancelAnimationFrame,now:Object.getOwnPropertyDescriptor(performance,'now'),rate:window.asmGetAnimationPlaybackRate};
   let time=performance.now(),elapsed=0,serial=0;const callbacks=new Map();window.requestAnimationFrame=cb=>{callbacks.set(++serial,cb);return serial;};window.cancelAnimationFrame=id=>callbacks.delete(id);Object.defineProperty(performance,'now',{configurable:true,value:()=>time});window.asmGetAnimationPlaybackRate=()=>rate;
   const advance=async target=>{while(elapsed<target){const delta=Math.min(10,target-elapsed);time+=delta;elapsed+=delta;const pending=[...callbacks.values()];callbacks.clear();pending.forEach(cb=>cb(time));for(let n=0;n<10;n++)await Promise.resolve();}};
   try{
    const pending=CodeScript.next();await advance(1000/rate);
    const root=document.querySelector('#asm-trace-root'),inverse=root.getScreenCTM().inverse();
    const decorations=[...root.querySelectorAll('.asm-trace-style-decoration')].filter(w=>w._asmStyleCell?.isConnected).map(w=>({kind:w.className.baseVal,actual:components(w.getScreenCTM()),expected:components(w._asmStyleCell.getScreenCTM().multiply(w._asmStyleBasis)),ownerScale:Math.hypot(inverse.multiply(w._asmStyleCell.getScreenCTM()).a,inverse.multiply(w._asmStyleCell.getScreenCTM()).b)}));
    const clones=[...root.querySelectorAll('.asm-trace-compare-self-clone')].map(w=>({marks:w.querySelectorAll('[data-trace-attachment-kind="mark"]').length,points:w.querySelectorAll('[data-trace-attachment-kind="point"]').length,styleCopies:w.querySelectorAll('.asm-trace-cell-style-copy').length,colors:[...w.querySelectorAll('.asm-trace-cell-style-copy [data-trace-attachment-kind]')].map(el=>[el.dataset.traceAttachmentKind,el.getAttribute(el.dataset.traceAttachmentKind==='point'?'fill':'stroke')]).sort((a,b)=>a[0].localeCompare(b[0]))}));
    await advance(1800/rate);await pending;
    reports.push({saved,rate,self,decorations,clones,remaining:root.querySelectorAll('.asm-trace-compare-self-clone').length});
   }finally{ASMTraceFrameTween.cancel();window.requestAnimationFrame=native.raf;window.cancelAnimationFrame=native.cancel;if(native.now)Object.defineProperty(performance,'now',native.now);else delete performance.now;window.asmGetAnimationPlaybackRate=native.rate;}
  }
  const copy=structuredClone(raw),index=copy.frames.findIndex(f=>f.events.some(e=>e.type==='assign'&&e.expression==='target = a[0]'));
  // 以實際來源範圍辨識賦值，不依 C++ 變數在 Trace 中的流水 ID。
  const assignmentIndex=index>=0?index:copy.frames.findIndex(f=>f.events.some(e=>e.type==='assign'&&/target\s*=\s*a\[/.test(e.source?.text||'')));
  if(assignmentIndex<1)throw Error('Missing whole-cell copy fixture');
  copy.frames=[copy.frames[assignmentIndex-1],copy.frames[assignmentIndex]];copy.frames[1].events=copy.frames[1].events.filter(e=>e.type==='assign');
  ASMTracePlayer.apply(copy);await ASMTracePlayer.render(0,{stable:true});
  let transferStyles=0,copyDone=false;const copyPlay=ASMTracePlayer.render(1,{fromIndex:0,forceTransition:true}).finally(()=>copyDone=true);
  const deadline=performance.now()+10000;
  do{await new Promise(requestAnimationFrame);transferStyles=Math.max(transferStyles,[...document.querySelectorAll('.asm-trace-assign-transfer')].filter(el=>Number(el.getAttribute('opacity'))>0).reduce((sum,el)=>sum+el.querySelectorAll('.asm-trace-cell-style-copy').length,0));}while(!copyDone&&performance.now()<deadline);
  if(!copyDone)throw Error('Whole-cell copy did not finish');
  await copyPlay;window.ASMTraceCamera=camera;return {reports,transferStyles};
 },trace);
 for(const r of reports.reports){const label=JSON.stringify({saved:r.saved,rate:r.rate,self:r.self});
  assert.ok(r.decorations.length>=6,label+' authored styles exist');
  for(const d of r.decorations)for(let i=0;i<6;i++)assert.ok(Math.abs(d.actual[i]-d.expected[i])<0.001,label+' style uses the complete presented cell matrix '+JSON.stringify(d));
  if(r.self){assert.equal(r.clones.length,2,label);assert.ok(r.clones.every(c=>c.marks===1&&c.points===1&&c.styleCopies>=2),label+' each temporary cell carries its own styles');for(const c of r.clones)assert.deepEqual(c.colors,[['highlight','#567890'],['mark','#123456'],['point','#345678']],label+' custom colors preserved');}
  else{assert.ok(r.decorations.some(d=>Math.abs(d.ownerScale-1.14)<0.001),label+' larger cell');assert.ok(r.decorations.some(d=>Math.abs(d.ownerScale-0.86)<0.001),label+' smaller cell');}
  assert.equal(r.remaining,0,label+' temporary styles are cleaned with their cells');
 }
 assert.ok(reports.transferStyles>=3,'whole-cell assignment also carries source highlight, point and mark');
 assert.deepEqual(errors,[]);
});
