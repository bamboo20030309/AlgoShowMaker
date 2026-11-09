const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('playwright'),{startIsolatedServer}=require('./helpers/isolated-server');
const {readPackage,savedTrace}=require('./helpers/deck-package');
test('heap references stay visible across call, return and recursive call with declaration enabled',{timeout:90000},async t=>{
 const b=readPackage(fs.readFileSync('public/guest-decks/heap-sort.asmdeck')).body;
 const trace=savedTrace(b,b.deck.groups.flatMap(g=>g.slides).find(s=>s.animation).animation);
 for(const fn of ['heapify','heap_sort']){
  trace.studio.eventInstructionStates[`declare:${fn}:arr`]=true;
  trace.studio.eventInstructionStates[`assign:${fn}:arr = <parameter>`]=true;
 }
 const {base}=await startIsolatedServer(t),browser=await chromium.launch({headless:true,channel:'msedge'});t.after(()=>browser.close());
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/algorithm.html?asmEmbed=runtime');await page.waitForFunction(()=>window.ASMTracePlayer);
 for(const speed of [1,4]){
  const results=await page.evaluate(async({trace,speed})=>{
   // Serialize/reopen the existing saved Trace; no new metadata is required.
   ASMTracePlayer.apply(JSON.parse(JSON.stringify(trace)));window.asmGetAnimationPlaybackRate=()=>speed;const results=[];
   for(const from of [3,4,7]){
    await ASMTracePlayer.render(from,{animatePositions:false,animateEvents:false});
    const before=trace.frames[from],after=trace.frames[from+1],fromId=before.source.primaryVariableId,toId=after.source.primaryVariableId;
    const samples=[];let done=false;const pending=ASMTracePlayer.render(from+1).finally(()=>done=true);
    while(!done){await new Promise(requestAnimationFrame);const root=document.getElementById('asm-trace-root');
     const a=[...root.querySelectorAll('[data-trace-variable]')].find(n=>n.dataset.traceVariable===toId&&!n.closest('[data-trace-snapshot]')&&!n.closest('.asm-trace-transition-ghost-motion'));
     const cell=a?.querySelector('[data-trace-content-role="value"]');
     if(!cell){samples.push({missing:true});continue;}
     let opacity=1;for(let n=cell;n?.nodeType===1;n=n.parentElement)opacity*=Number(getComputedStyle(n).opacity);
     samples.push({opacity,copies:root.querySelectorAll('.asm-trace-assign-transfer').length});
    }await pending;results.push({from,samples,same:before.state[fromId].identity===after.state[toId].identity});
   }return results;
  },{trace,speed});
  for(const result of results){assert.ok(result.same);assert.ok(result.samples.length>2);
   assert.ok(result.samples.every(s=>!s.missing&&s.opacity>.999),JSON.stringify({speed,from:result.from,first:result.samples.find(s=>s.missing||s.opacity<=.999)}));
  }
 }
 assert.deepEqual(errors,[]);
});
