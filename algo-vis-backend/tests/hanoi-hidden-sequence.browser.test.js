'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),{chromium}=require('playwright');
const {startIsolatedServer}=require('./helpers/isolated-server'),{compile}=require('./helpers/compile');
test('hidden Hanoi ans uses visual-only expansion then complete cell entry', {timeout:120000},async t=>{
 const{base}=await startIsolatedServer(t);const old=process.env.ASM_TEST_BASE_URL;process.env.ASM_TEST_BASE_URL=base;let trace;
 try{({trace}=await compile(fs.readFileSync('tests/fixtures/hanoi-hidden-sequence.cpp','utf8'),'4\n'));}finally{if(old===undefined)delete process.env.ASM_TEST_BASE_URL;else process.env.ASM_TEST_BASE_URL=old;}
 const id=Object.keys(trace.variables).find(id=>trace.variables[id].name==='ans');
 const indices=trace.frames.map((f,i)=>i>0&&[1,2,3].includes(f.state[id]?.data?.items?.length)&&f.state[id].data.items.length!==trace.frames[i-1].state[id]?.data?.items?.length?i:-1).filter(i=>i>0);
 assert.equal(indices.length,3);assert.ok(indices.every(i=>!trace.frames[i].events.some(e=>e.operation==='push_back')));
 const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/algorithm.html?asmEmbed=runtime');await page.waitForFunction(()=>window.asmApplyTraceDocument);
 const reports=await page.evaluate(async({trace,id,indices})=>{
 const results=[];
 for(const rate of [1,2])for(const index of indices){
  const doc=asmApplyTraceDocument(JSON.parse(JSON.stringify(trace)));const camera=window.ASMTraceCamera;window.ASMTraceCamera={...camera,apply(){},transitionDuration:()=>0};
  const owner=()=>[...document.querySelectorAll('#asm-trace-root [data-trace-variable]')].find(n=>n.dataset.traceVariable===id&&!n.closest('[data-trace-snapshot]'));
  const height=()=>owner().querySelector('.outerframe-bg').getBBox().height;
  const disks=()=>{const result={};const root=document.querySelector('#asm-trace-root');for(const cell of document.querySelectorAll('#arraySvg [data-trace-visual-continuity-key^="disk:"]')){if(cell.closest('[data-trace-snapshot],.asm-trace-transition-ghost'))continue;const rect=cell.querySelector('rect');if(!rect)continue;const box=rect.getBBox(),matrix=root.getScreenCTM().inverse().multiply(rect.getScreenCTM()),point=new DOMPoint(box.x+box.width/2,box.y+box.height/2).matrixTransform(matrix);let opacity=1;for(let n=cell;n&&n!==document.body;n=n.parentElement)opacity*=Number(getComputedStyle(n).opacity);result[cell.dataset.traceVisualContinuityKey]={x:point.x,y:point.y,opacity};}return result;};
  await ASMTracePlayer.render(index,{stable:true});const final=height(),finalDisks=disks();await ASMTracePlayer.render(index-1,{stable:true});await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);const before=height(),beforeDisks=disks();
  const raf=window.requestAnimationFrame,cancel=window.cancelAnimationFrame,now=Object.getOwnPropertyDescriptor(performance,'now'),getRate=window.asmGetAnimationPlaybackRate;let time=performance.now(),elapsed=0,serial=0,slot=null;const callbacks=new Map();
  const listener=e=>{if(e.detail.phase==='start'&&e.detail.event.presentationOnly&&e.detail.event.targets?.some(t=>t.variableId===id))slot={...e.detail.slot};};window.addEventListener('asm:trace-active-event',listener);
  window.requestAnimationFrame=f=>{callbacks.set(++serial,f);return serial;};window.cancelAnimationFrame=i=>callbacks.delete(i);Object.defineProperty(performance,'now',{configurable:true,value:()=>time});window.asmGetAnimationPlaybackRate=()=>rate;
  const step=async delta=>{time+=delta;elapsed+=delta;const batch=[...callbacks.values()];callbacks.clear();for(const f of batch)f(time);for(let i=0;i<5;i++)await Promise.resolve();};const advance=async at=>{while(elapsed<at)await step(Math.min(5,at-elapsed));};
  try{const pending=ASMTracePlayer.render(index,{fromIndex:index-1,forceTransition:true});await step(0);await advance(90/rate);const earlyDisks=disks();while(!slot&&elapsed<15000)await step(5);if(!slot)throw Error('Missing visual lifecycle for ans');const samples={};
   for(const at of [90,299,300,390,480]){await advance((Number(slot.start)+at)/rate);samples[at]={height:height(),entries:[...owner().querySelectorAll('.asm-trace-sequence-entry')].map(n=>({text:n.textContent,opacity:Number(getComputedStyle(n).opacity)}))};}
   await advance((Number(slot.end)+2500)/rate);await pending;results.push({rate,index,before,final,size:trace.frames[index].state[id].data.items.length,samples,beforeDisks,finalDisks,earlyDisks,visualStart:slot.start,remaining:owner().querySelectorAll('.asm-trace-sequence-entry').length,persisted:doc.frames[index].events.some(e=>e.presentationOnly)});
  }finally{ASMTraceFrameTween.cancel();window.removeEventListener('asm:trace-active-event',listener);callbacks.clear();window.requestAnimationFrame=raf;window.cancelAnimationFrame=cancel;if(now)Object.defineProperty(performance,'now',now);else delete performance.now;window.asmGetAnimationPlaybackRate=getRate;window.ASMTraceCamera=camera;}
 }
 return results;
 },{trace,id,indices});
 fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/hanoi-hidden-sequence.json',JSON.stringify(reports,null,2));
 for(const r of reports){const label='frame '+(r.index+1)+' @'+r.rate+'x';assert.ok(r.size===1?Math.abs(r.final-r.before)<.01:r.final>r.before,label);assert.ok(r.visualStart<=180,label+' visual handoff must not wait for later output/call hints');const moved=Object.keys(r.beforeDisks).filter(k=>r.finalDisks[k]&&Math.hypot(r.beforeDisks[k].x-r.finalDisks[k].x,r.beforeDisks[k].y-r.finalDisks[k].y)>2);assert.equal(moved.length,1,label+' one disk changes pegs');for(const k of moved){const a=r.beforeDisks[k],b=r.finalDisks[k],m=r.earlyDisks[k];assert.ok(m&&m.opacity>0,label+' moving disk stays visible');assert.ok(Math.hypot(m.x-a.x,m.y-a.y)>1,label+' disk starts moving immediately');assert.ok(Math.hypot(m.x-b.x,m.y-b.y)>1,label+' disk does not jump to final peg');}
if(r.size>1)assert.ok(r.samples[90].height>r.before&&r.samples[90].height<r.final,label+' expansion');assert.ok(Math.abs(r.samples[300].height-r.final)<.01,label+' expand complete before entry');assert.ok(Math.abs(r.samples[390].height-r.final)<.01,label+' fixed during entry');assert.ok(r.samples[299].entries.every(n=>n.opacity===0),label+' no early entry');assert.ok(r.samples[390].entries.some(n=>n.opacity>0&&n.text.includes('→')),label+' cell with text before commit');assert.equal(r.remaining,0);assert.equal(r.persisted,false,'visual lifecycle must not create runtime events in saved trace');}
 assert.deepEqual(errors,[]);
});
