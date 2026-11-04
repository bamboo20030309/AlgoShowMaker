const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {compile}=require('./helpers/compile');
const {startIsolatedServer}=require('./helpers/isolated-server');

test('original comparison visuals run on the current scheduler at 1x and 2x', {timeout:120000},async t=>{
 const {base}=await startIsolatedServer(t);const previous=process.env.ASM_TEST_BASE_URL;let trace;
 try{process.env.ASM_TEST_BASE_URL=base;({trace}=await compile(`#include <vector>
int main(){std::vector<int> a(3);a[0]=8;a[1]=5;a[2]=3;int i=0,j=2;
// @frame a
// @pointer i,j at a
bool result=a[i]<a[j];
// @frame a
// @pointer i,j at a
result=a[i]!=a[j];
// @frame a
// @pointer i,j at a
a[2]=8;
// @frame a
// @pointer i,j at a
result=a[i]==a[j];
// @frame a
// @pointer i,j at a
result=a[i]==a[i];
// @frame a
// @pointer i,j at a
}`));}finally{if(previous===undefined)delete process.env.ASM_TEST_BASE_URL;else process.env.ASM_TEST_BASE_URL=previous;}
 const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/algorithm.html?asmEmbed=runtime');await page.waitForFunction(()=>window.ASMTracePlayer);
 await page.addScriptTag({url:base+'/slides-storage.js'});
 const reports=await page.evaluate(async raw=>{
  const reports=[],id=Object.keys(raw.variables).find(id=>raw.variables[id].name==='a');
  const store=ASMSlideStorage.create(indexedDB,localStorage);
  const originalCamera=window.ASMTraceCamera;window.ASMTraceCamera={...originalCamera,apply(){},transitionDuration:()=>0};
  for(const mode of ['fresh','saved-legacy'])for(const rate of [1,2])for(const operation of ['<','!=','==','self']){
   const actualOperation=operation==='self'?'==':operation;
   const matches=e=>e.type==='compare'&&e.operation===actualOperation
     && (actualOperation!=='=='||(e.targets[0].expression===e.targets[1].expression)===(operation==='self'));
   const source=structuredClone(raw);const index=source.frames.findIndex(f=>f.events.some(matches));
   source.frames=[source.frames[index-1],source.frames[index]];
   source.frames[1].events=source.frames[1].events.filter(matches);
   if(mode==='saved-legacy')for(const f of source.frames)for(const e of f.events)delete e.semantics;
   source.studio||={};source.studio.eventSettings={gapMs:0,readHighlightEnabled:false};
   source.studio.objectStyles||={};source.studio.objectStyles[source.frames[1].id]={[id+'#0']:{fill:'#123456'}};
   const key=await ASMSlideStorage.digest(ASMSlideStorage.canonical(source));await store.putTrace(key,source);
   const doc=ASMTracePlayer.apply(await store.loadTrace(key));
   const root=()=>document.querySelector('#asm-trace-root');
   const cell=n=>[...document.querySelectorAll('[data-trace-object-key]')].find(el=>el.dataset.traceObjectKey===id+'#'+n&&!el.closest('[data-trace-snapshot]'));
   const geometry=n=>{const el=cell(n);if(!el)throw Error('Missing cell '+n);const rect=el.querySelector('rect');const b=rect.getBBox();const m=root().getScreenCTM().inverse().multiply(rect.getScreenCTM());const center=new DOMPoint(b.x+b.width/2,b.y+b.height/2).matrixTransform(m);return {x:center.x,y:center.y,width:b.width*Math.hypot(m.a,m.b)};};
   const read=()=>({left:geometry(0),right:geometry(2),expression:[...document.querySelectorAll('.asm-trace-compare-operator')].map(n=>n.textContent).join(''),resultOpacity:Number(document.querySelector('.asm-trace-compare-operator')?.getAttribute('opacity')||0),slashes:document.querySelectorAll('.asm-trace-compare-operator line').length,fill:cell(0).querySelector('rect').getAttribute('fill'),clones:[...document.querySelectorAll('.asm-trace-compare-self-clone')].map(el=>{const m=el.transform.baseVal.consolidate()?.matrix;return {x:m?.e,y:m?.f,opacity:Number(el.getAttribute('opacity'))};})});
   await ASMTracePlayer.render(0,{stable:true});await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
   const baseline=read(),native={raf:window.requestAnimationFrame,cancel:window.cancelAnimationFrame,now:Object.getOwnPropertyDescriptor(performance,'now'),rate:window.asmGetAnimationPlaybackRate};
   let time=performance.now(),elapsed=0,serial=0;const callbacks=new Map();
   window.requestAnimationFrame=cb=>{callbacks.set(++serial,cb);return serial;};window.cancelAnimationFrame=id=>callbacks.delete(id);
   Object.defineProperty(performance,'now',{configurable:true,value:()=>time});window.asmGetAnimationPlaybackRate=()=>rate;
   const advance=async target=>{while(elapsed<target){const delta=Math.min(10,target-elapsed);elapsed+=delta;time+=delta;const pending=[...callbacks.values()];callbacks.clear();pending.forEach(cb=>cb(time));for(let i=0;i<8;i++)await Promise.resolve();}};
   try{
    const pending=CodeScript.next();const samples={};
    for(const at of [180,579,580,581,730,879,880,1000,1560]){await advance(at/rate);samples[at]=read();}
    await advance(1800/rate);await pending;
    reports.push({mode,rate,operation,baseline,samples,final:read(),remaining:document.querySelectorAll('.asm-trace-compare-operator,.asm-trace-compare-highlight,.asm-trace-compare-self-clone').length});
   }finally{ASMTraceFrameTween.cancel();callbacks.clear();window.requestAnimationFrame=native.raf;window.cancelAnimationFrame=native.cancel;if(native.now)Object.defineProperty(performance,'now',native.now);else delete performance.now;window.asmGetAnimationPlaybackRate=native.rate;}
  }
  window.ASMTraceCamera=originalCamera;return reports;
 },trace);
 const near=(a,b,label)=>assert.ok(Math.abs(a-b)<0.01,label+': '+JSON.stringify({a,b}));
 for(const r of reports){const label=r.mode+' '+r.operation+' '+r.rate+'x',mid=r.samples[730],peak=r.samples[1000];
  assert.equal(r.samples[579].expression,'',label+' wait before comparing');
  assert.equal(r.samples[580].resultOpacity,0,label+' result starts hidden');
  assert.ok(r.samples[581].resultOpacity>0&&r.samples[581].resultOpacity<1,label+' old gradual result reveal starts with scaling');
  near(r.samples[880].resultOpacity,1,label+' result fully shown at 880ms');
  if(r.operation==='<'){
   near(mid.left.x,r.baseline.left.x,label+' larger cell stays in its column');near(mid.right.x,r.baseline.right.x,label+' smaller cell stays in its column');
   near(peak.left.y,r.baseline.left.y-15,label+' left joins common 15px lift');near(peak.right.y,r.baseline.right.y-15,label+' right joins common 15px lift');
   near(peak.left.width/r.baseline.left.width,1.14,label+' larger grows');near(peak.right.width/r.baseline.right.width,.86,label+' smaller shrinks');
   assert.match(peak.expression,/</,label+' original condition operator');assert.doesNotMatch(peak.expression,/true|false/);assert.equal(peak.slashes,1,label+' false condition crosses its operator');
  }else if(r.operation==='self'){
   assert.equal(peak.clones.length,2,label+' two presentations of the same source');
   assert.ok(peak.clones.every(c=>c.y===-15&&c.opacity>0),label+' original self-compare split lifts both presentations');
   assert.match(peak.expression,/=/);
  }else{
   near(mid.left.x,r.baseline.left.x,label+' first half aligns before moving left source');near(mid.right.x,r.baseline.right.x,label+' first half aligns before moving right source');
   assert.ok(peak.left.x>mid.left.x&&peak.right.x<mid.right.x,label+' second half brings sources together');
   const split=r.operation==='!='?5:0;
   near(peak.left.y,r.baseline.left.y-split,label+' original vertical split left');near(peak.right.y,r.baseline.right.y+split,label+' original vertical split right');
   assert.match(peak.expression,r.operation==='!='?/≠/:/=/,label+' equality symbol');
  }
  near(r.final.left.x,r.baseline.left.x,label+' restored x');near(r.final.left.y,r.baseline.left.y,label+' restored y');
  assert.equal(r.final.fill,'#123456',label+' saved custom style');assert.equal(r.remaining,0,label+' cleanup');
 }
 assert.deepEqual(errors,[]);
 const autoplay=await page.evaluate(async raw=>{
  const reports=[];const camera=window.ASMTraceCamera;window.ASMTraceCamera={...camera,apply(){},transitionDuration:()=>0};
  for(const rate of [1,2]){
   const doc=structuredClone(raw);doc.frames=doc.frames.slice(0,3);
   doc.frames.slice(1).forEach(f=>{f.events=f.events.filter(e=>e.type==='compare');});
   doc.studio||={};doc.studio.eventSettings={gapMs:0};ASMTracePlayer.apply(doc);await CodeScript.goto(0);
   window.asmGetAnimationPlaybackRate=()=>rate;
   const events=[];const listener=e=>{if(e.detail?.event?.type==='compare')events.push({phase:e.detail.phase,id:e.detail.event.id,time:performance.now(),duration:e.detail.slot.duration});};
   window.addEventListener('asm:trace-active-event',listener);document.getElementById('playToggleBtn').click();
   const deadline=performance.now()+10000;
   while(performance.now()<deadline&&(CodeScript.get_current_frame_index()!==2||ASMTracePlayer.getActivePlaybackPlan()))await new Promise(r=>setTimeout(r,20));
   ASMPlaybackNavigation.pause();window.removeEventListener('asm:trace-active-event',listener);
   reports.push({rate,frame:CodeScript.get_current_frame_index(),events,remaining:document.querySelectorAll('.asm-trace-compare-operator,.asm-trace-compare-highlight').length});
  }
  const disabled=structuredClone(raw);disabled.frames=disabled.frames.slice(0,2);
  disabled.frames[1].events=disabled.frames[1].events.filter(e=>e.type==='compare');
  const event=disabled.frames[1].events[0];event.enabled=false;delete event.semantics;
  disabled.studio||={};disabled.studio.eventSettings={gapMs:0};
  disabled.studio.eventInstructionStates={[ASMTraceEvents.instructionKey(event)]:false};
  const store=ASMSlideStorage.create(indexedDB,localStorage),key=await ASMSlideStorage.digest(ASMSlideStorage.canonical(disabled));
  await store.putTrace(key,disabled);ASMTracePlayer.apply(await store.loadTrace(key));await CodeScript.goto(0);await CodeScript.next();
  const disabledResult={enabled:ASMTracePlayer.getDocument().frames[1].events.find(e=>e.type==='compare')?.enabled,
    effects:document.querySelectorAll('.asm-trace-compare-operator,.asm-trace-compare-highlight,.asm-trace-compare-self-clone').length};
  window.ASMTraceCamera=camera;return {reports,disabled:disabledResult};
 },trace);
 for(const r of autoplay.reports){
  assert.equal(r.frame,2);assert.equal(r.remaining,0);
  assert.deepEqual(r.events.map(e=>e.phase),['start','end','start','end']);
  assert.ok(r.events.every(e=>e.duration===1560));assert.ok(r.events[2].time>=r.events[1].time);
 }
 assert.equal(autoplay.disabled.enabled,false);assert.equal(autoplay.disabled.effects,0);
 assert.deepEqual(errors,[]);
});
