'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('playwright'),{startIsolatedServer}=require('./helpers/isolated-server');
const {readPackage,savedTrace}=require('./helpers/deck-package');
test('quick sort frame 4 to 5 only lifts the pointer attached to the compared cell',{timeout:60000},async t=>{
 const body=readPackage(fs.readFileSync('public/guest-decks/quick-sort.asmdeck')).body;
 const animation=body.deck.groups.flatMap(g=>g.slides).find(s=>s.animation).animation;
 const trace=savedTrace(body,animation);
 const comparison=trace.frames[4].events.find(e=>e.type==='compare'&&e.source?.text==='arr[j] < pivot');
 assert.equal(comparison.targets[0].resolvedIndex,2);
 const {base}=await startIsolatedServer(t),browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 await page.goto(base+'/algorithm.html?asmEmbed=runtime');await page.waitForFunction(()=>window.ASMTracePlayer);
 for(const speed of [1,4]){
 const result=await page.evaluate(async({trace,eventId,speed})=>{
  const p=ASMTracePlayer;p.apply(JSON.parse(JSON.stringify(trace)));window.asmGetAnimationPlaybackRate=()=>speed;
  await p.render(3,{animatePositions:false,animateEvents:false});
  const point=name=>{
   const root=document.getElementById('asm-trace-root');
   const node=[...root.querySelectorAll('[data-trace-pointer-instance-id]')].find(n=>n.querySelector('.trace-variable-marker-label-text')?.textContent===name);
   const rect=node?.querySelector('.trace-variable-marker-label-text')?.getBoundingClientRect();
   if(!rect)return null;const v=new DOMPoint(rect.x+rect.width/2,rect.y+rect.height/2).matrixTransform(root.getScreenCTM().inverse());return{x:v.x,y:v.y};
  };
  const before=point('i'),samples=[];let done=false;
  const transition=p.render(4).finally(()=>done=true);
  while(!done){await new Promise(requestAnimationFrame);if(document.getElementById('asm-trace-root').dataset.traceActiveEventId===eventId)samples.push({i:point('i'),j:point('j')});}
  await transition;return{before,samples};
 },{trace,eventId:comparison.id,speed});
 assert.ok(result.samples.length>=3,JSON.stringify(result));
 assert.ok(result.samples.every(s=>s.i&&Math.abs(s.i.y-result.before.y)<0.5),'unrelated i must stay still: '+JSON.stringify(result));
 assert.ok(result.samples.some(s=>s.j&&s.j.y<result.before.y-4),'j must follow its compared cell');
 }
});
