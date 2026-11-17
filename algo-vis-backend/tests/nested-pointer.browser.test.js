'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const {startIsolatedServer}=require('./helpers/isolated-server');
const {readPackage,savedTrace}=require('./helpers/deck-package');
const {compile}=require('./helpers/compile');

test('fresh Merge Sort frame 12 tracks nested j++ and keeps its source through push', {timeout:60000},async t=>{
  const {base}=await startIsolatedServer(t);process.env.ASM_TEST_BASE_URL=base;
  const body=readPackage(fs.readFileSync(path.join(__dirname,'../public/guest-decks/merge-sort.asmdeck'))).body;
  const animation=body.deck.groups.flatMap(g=>g.slides||[]).find(s=>s.animation).animation;
  const {trace}=await compile(animation.code,animation.input);
  const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/algorithm.html?asmEmbed=runtime');await page.waitForFunction(()=>window.ASMTracePlayer);
  for(const currentTrace of [trace,savedTrace(body,animation)])for(const rate of [1,2])for(const gap of [0,500]){
    const result=await page.evaluate(async({trace,rate,gap})=>{
      const doc=ASMTracePlayer.apply(trace);doc.studio.eventSettings.gapMs=gap;
      window.asmGetAnimationPlaybackRate=()=>rate;
      window.ASMTraceCamera={...ASMTraceCamera,apply(){},transitionDuration:()=>0};
      await ASMTracePlayer.render(10,{stable:true});
      const opacity=node=>{let value=1;for(let p=node;p&&p.id!=='arraySvg';p=p.parentElement){const s=getComputedStyle(p);if(s.display==='none'||s.visibility==='hidden')return 0;value*=Number(s.opacity);}return value;};
      const read=()=>{
        const pointer=[...document.querySelectorAll('[data-trace-source-variable-id]')].find(n=>doc.variables[n.dataset.traceSourceVariableId]?.name==='j'&&opacity(n)>.99);
        const box=pointer?.querySelector('.trace-variable-marker-label-box')?.getBoundingClientRect();
        const owner=[...document.querySelectorAll('#asm-trace-root [data-trace-variable]')].find(n=>doc.variables[n.dataset.traceVariable]?.name==='merged'&&!n.closest('[data-trace-snapshot],.asm-trace-transition-ghost'));
        const cell=owner?.querySelector('[data-trace-index="1"]');
        return{visible:!!pointer,x:box?box.x+box.width/2:null,value:cell?.querySelector('text')?.textContent,opacity:cell?opacity(cell):0};
      };
      const native={raf:requestAnimationFrame,cancel:cancelAnimationFrame,now:Object.getOwnPropertyDescriptor(performance,'now')};
      let clock=performance.now(),elapsed=0,serial=0;const callbacks=new Map(),samples=[],slots=[],announcements=[];
      window.requestAnimationFrame=f=>{callbacks.set(++serial,f);return serial;};window.cancelAnimationFrame=id=>callbacks.delete(id);
      Object.defineProperty(performance,'now',{configurable:true,value:()=>clock});
      const listener=e=>{const expression=e.detail.event.expression||e.detail.event.source?.text;announcements.push({expression,phase:e.detail.phase,at:elapsed*rate});if(e.detail.phase==='start'&&e.detail.slot)slots.push({expression,start:e.detail.slot.start,end:e.detail.slot.end});};
      window.addEventListener('asm:trace-active-event',listener);
      const restore=()=>{window.requestAnimationFrame=native.raf;window.cancelAnimationFrame=native.cancel;if(native.now)Object.defineProperty(performance,'now',native.now);else delete performance.now;};
      try{
        const pending=ASMTracePlayer.render(11,{fromIndex:10,forceTransition:true});const total=ASMTracePlayer.getLastPlaybackPlan().totalDurationMs;
        while(elapsed*rate<total+100){elapsed+=20;clock+=20;const batch=[...callbacks.values()];callbacks.clear();batch.forEach(f=>f(clock));for(let n=0;n<10;n++)await Promise.resolve();samples.push({at:elapsed*rate,...read()});}
        document.querySelectorAll('#asm-trace-root *').forEach(n=>n.getAnimations?.().forEach(a=>{if(a.transitionProperty)a.finish();}));
        restore();await pending;return{slots,samples,announcements,final:read()};
      }finally{restore();ASMTraceFrameTween.cancel();window.removeEventListener('asm:trace-active-event',listener);}
    },{trace:currentTrace,rate,gap});
    const movement=result.slots.find(s=>s.expression==='j++'),push=result.slots.find(s=>s.expression==='merged.push_back(num[j++])');
    assert.ok(movement&&push,JSON.stringify(result.slots));
    assert.equal(movement.end-movement.start,520);assert.ok(movement.start>=push.end+gap);
    const moving=result.samples.filter(s=>s.at>movement.start&&s.at<movement.end);
    assert.ok(new Set(moving.map(s=>s.x?.toFixed(2))).size>=3,'j must move rather than jump');
    assert.ok(result.samples.filter(s=>s.at<movement.end).every(s=>s.visible),'source remains visible until its deferred movement finishes');
    const copying=result.samples.filter(s=>s.at>=push.start&&s.at<push.end);
    assert.equal(new Set(copying.map(s=>s.x?.toFixed(2))).size,1,'postfix pointer remains at the old index while copying');
    assert.ok(result.samples.filter(s=>s.at>=push.end&&s.at<movement.end).every(s=>s.value==='7'&&s.opacity>.99),'copied cell stays visible during the deferred update and gap');
    assert.ok(!result.announcements.some(e=>e.expression==='j++'&&['end','complete'].includes(e.phase)&&e.at<movement.start),'postfix code cannot be completed before its movement starts');
    assert.equal(result.final.value,'7');assert.ok(result.final.opacity>.99);assert.equal(result.final.visible,false);
  }
  assert.deepEqual(errors,[]);
});
