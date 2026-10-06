const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const {compile}=require('./helpers/compile');const {startIsolatedServer}=require('./helpers/isolated-server');const {chromium}=require('playwright');
test('new KMP j pointer enters at p while the existing s pointer moves independently',{timeout:90000},async t=>{
 const {base}=await startIsolatedServer(t);const previous=process.env.ASM_TEST_BASE_URL;process.env.ASM_TEST_BASE_URL=base;t.after(()=>{if(previous)process.env.ASM_TEST_BASE_URL=previous;else delete process.env.ASM_TEST_BASE_URL;});
 const {trace}=await compile(fs.readFileSync(path.join(__dirname,'fixtures/kmp-fallback-multitarget.cpp'),'utf8'),'abababca');const pId=Object.keys(trace.variables).find(id=>trace.variables[id].name==='p');const sId=Object.keys(trace.variables).find(id=>trace.variables[id].name==='s');
 assert.ok(trace.frames[20].bindings.every(b=>!(b.sourceName==='j'&&b.targetName==='p')));
 assert.ok(trace.frames[21].bindings.some(b=>b.sourceName==='j'&&b.targetName==='p'));
 const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/algorithm.html');await page.waitForFunction(()=>document.body.dataset.defaultAnimationCache==='stored');await page.click('[data-tab="tab-canvas"]');
 const check=async doc=>page.evaluate(async({doc,pId,sId})=>{
  asmApplyTraceDocument(doc);await ASMTracePlayer.renderStable(20);
  const sample=()=>{
   const root=document.querySelector('#asm-trace-root'),inverse=root.getScreenCTM().inverse();
   const worldY=(el,bottom)=>{const r=el.getBoundingClientRect();return new DOMPoint(r.x,bottom?r.bottom:r.top).matrixTransform(inverse).y;};
   const markers=[...root.querySelectorAll('[data-trace-pointer-id]')].filter(e=>e.querySelector('.trace-variable-marker-label-text')?.textContent==='j');
   const at=prefix=>markers.find(e=>e.dataset.tracePointerTargetKey.startsWith(prefix+'#'));
   const p=at(pId),s=at(sId),cell=root.querySelector(`[data-trace-object-key="${pId}#0"] > rect`);
   return {pOffset:p?worldY(p,true)-worldY(cell,false):null,pInstance:p?.dataset.tracePointerInstanceId,sInstance:s?.dataset.tracePointerInstanceId,pTransition:p?.dataset.tracePointerTransition};
  };
  const transition=ASMTracePlayer.render(21);const samples=[];for(let i=0;i<16;i++){await new Promise(requestAnimationFrame);samples.push(sample());}await transition;
  const settled=sample();await ASMTracePlayer.render(22);return {samples,settled,next:sample()};
 },{doc,pId,sId});
 const result=await check(trace);
 for(const sample of result.samples){assert.notEqual(sample.pInstance,sample.sInstance);assert.ok(sample.pOffset!==null&&sample.pOffset>-70&&sample.pOffset<20,JSON.stringify(sample));}
 assert.ok(result.settled.pOffset>-30&&result.settled.pOffset<20,JSON.stringify(result.settled));assert.ok(result.next.pOffset>-30&&result.next.pOffset<20,JSON.stringify(result.next));
 // 舊 Trace 的 binding 不具 explicitPointer／implicitIndex 仍依目標陣列分開呈現。
 const legacy=JSON.parse(JSON.stringify(trace));legacy.frames.forEach(f=>f.bindings.forEach(b=>{delete b.explicitPointer;delete b.implicitIndex;}));
 const reopened=await check(legacy);assert.ok(reopened.samples.every(s=>s.pOffset>-70&&s.pOffset<20),JSON.stringify(reopened.samples));assert.deepEqual(errors,[]);
});
