'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('playwright'),{startIsolatedServer}=require('./helpers/isolated-server');
const {readPackage,savedTrace}=require('./helpers/deck-package');
test('recursive quick sort copies the visible source paint, not the previous parent paint',{timeout:60000},async t=>{
 const body=readPackage(fs.readFileSync('public/guest-decks/quick-sort.asmdeck')).body;
 const animation=body.deck.groups.flatMap(g=>g.slides).find(s=>s.animation).animation;
 const trace=savedTrace(body,animation);
 const {base}=await startIsolatedServer(t),browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());
 const page=await browser.newPage();await page.goto(base+'/algorithm.html?asmEmbed=runtime');await page.waitForFunction(()=>window.ASMTracePlayer);
 for(const speed of [1,4]){
  const samples=await page.evaluate(async({trace,speed})=>{
   const player=ASMTracePlayer;player.apply(JSON.parse(JSON.stringify(trace)));window.asmGetAnimationPlaybackRate=()=>speed;
   await player.render(11,{animatePositions:false,animateEvents:false});
   const samples=[];let done=false;const transition=player.render(12).finally(()=>done=true);
   while(!done){await new Promise(requestAnimationFrame);const root=document.getElementById('asm-trace-root');
    for(const copy of root.querySelectorAll('.asm-trace-assign-transfer')){
     if(Number(copy.getAttribute('opacity'))<=.2)continue;
     const key=copy.dataset.traceTransferSourceKey;
     if(!key?.endsWith('#2'))continue;
     const source=[...root.querySelectorAll('[data-trace-object-key]')].find(n=>n.dataset.traceObjectKey===key&&!n.closest('.asm-trace-assign-transfer'));
     const rect=source?.querySelector(':scope > rect');
     samples.push({source:rect?.getAttribute('fill'),copy:copy.querySelector('rect')?.getAttribute('fill'),value:copy.querySelector('text')?.textContent});
    }
   }
   await transition;return samples;
  },{trace,speed});
  assert.ok(samples.length>=3,JSON.stringify(samples));
  assert.ok(samples.every(s=>s.source==='#ffffff'&&s.copy==='#ffffff'&&s.value==='3'),JSON.stringify(samples));
 }
});
