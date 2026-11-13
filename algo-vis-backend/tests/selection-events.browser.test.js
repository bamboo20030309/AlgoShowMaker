const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright');
const{compile}=require('./helpers/compile'),{startIsolatedServer}=require('./helpers/isolated-server');
test('independent selections play once in runtime order, persist across save, and obey their own switches',{timeout:90000},async t=>{
 const{base}=await startIsolatedServer(t),old=process.env.ASM_TEST_BASE_URL;let trace;
 try{process.env.ASM_TEST_BASE_URL=base;({trace}=await compile(fs.readFileSync('tests/fixtures/minmax-nested.cpp','utf8')));}finally{if(old===undefined)delete process.env.ASM_TEST_BASE_URL;else process.env.ASM_TEST_BASE_URL=old;}
 const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/algorithm.html?asmEmbed=runtime');await page.waitForFunction(()=>window.ASMTracePlayer);
 for(const mode of ['fresh','saved','disabled']){
 const r=await page.evaluate(async({trace,mode})=>{
  let doc=ASMTracePlayer.apply(JSON.parse(JSON.stringify(trace)));
  if(mode!=='fresh'){const saved=JSON.parse(JSON.stringify(ASMTracePlayer.getDocument()));if(mode==='disabled'){saved.studio||={};saved.studio.eventSettings||={};saved.studio.eventSettings.defaultEnabled={'select-max':false,'select-min':false};}doc=ASMTracePlayer.apply(saved);}
  window.asmGetAnimationPlaybackRate=()=>4;await ASMTracePlayer.render(0,{stable:true});const starts=[];const listener=e=>{if(e.detail.phase==='start')starts.push(e.detail.event.id);};window.addEventListener('asm:trace-active-event',listener);
  const native={raf:requestAnimationFrame,cancel:cancelAnimationFrame,now:Object.getOwnPropertyDescriptor(performance,'now')};let clock=performance.now(),elapsed=0,id=0;const callbacks=new Map();requestAnimationFrame=cb=>{callbacks.set(++id,cb);return id;};cancelAnimationFrame=id=>callbacks.delete(id);Object.defineProperty(performance,'now',{configurable:true,value:()=>clock});const restore=()=>{requestAnimationFrame=native.raf;cancelAnimationFrame=native.cancel;if(native.now)Object.defineProperty(performance,'now',native.now);else delete performance.now;};
  try{const pending=ASMTracePlayer.render(1,{fromIndex:0,forceTransition:true}),plan=ASMTracePlayer.getLastPlaybackPlan();while(elapsed<plan.totalDurationMs/4+100){elapsed+=8;clock+=8;const batch=[...callbacks.values()];callbacks.clear();batch.forEach(cb=>cb(clock));for(let i=0;i<12;i++)await Promise.resolve();}restore();await pending;const values={};for(const name of ['x','i','initial']){const key=Object.keys(doc.variables).find(id=>doc.variables[id].name===name);values[name]=document.querySelector(`[data-trace-object-key="${CSS.escape(key+'#0')}"] text[data-trace-content-role="value"]`)?.textContent;}
   return{starts,plan,values,selections:doc.frames[1].events.filter(e=>e.type.startsWith('select-')).map(e=>({id:e.id,type:e.type,enabled:e.enabled})),labels:['select-max','select-min'].map(type=>ASMTraceEvents.definition(type).label),leftovers:document.querySelectorAll('.asm-trace-selection-value,.asm-trace-selection-label').length};
  }finally{restore();window.removeEventListener('asm:trace-active-event',listener);ASMTraceFrameTween.cancel();}
 },{trace,mode});
 fs.mkdirSync('test-results/selection-events',{recursive:true});fs.writeFileSync(`test-results/selection-events/${mode}.json`,JSON.stringify(r));
 assert.deepEqual(r.labels,['取大','取小']);assert.deepEqual(r.values,{x:'1',i:'2',initial:'6'});assert.equal(r.leftovers,0);
 const played=r.starts.filter(id=>r.selections.some(e=>e.id===id));
 if(mode==='disabled'){assert.deepEqual(played,[]);assert.ok(r.selections.every(e=>e.enabled===false));assert.equal(r.plan.phases.some(p=>p.id==='selection-scale-restore'),false);}
 else{assert.deepEqual(played,r.selections.map(e=>e.id),'selections play exactly once, child before parent');const steps=r.plan.phases.flatMap(p=>p.steps||[]);for(const event of r.selections){const step=steps.find(s=>s.eventId===event.id);assert.ok(step);assert.equal(step.actionPlan?.stages?.some(s=>s.id==='transfer')||false,false,'selection owns no assignment transfer');}}
 }
 assert.deepEqual(errors,[]);
});
