const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('playwright'),{startIsolatedServer}=require('./helpers/isolated-server');
const {readPackage,savedTrace}=require('./helpers/deck-package'),{compile}=require('./helpers/compile');
async function inspect(page,trace,from,speed){return page.evaluate(async({trace,from,speed})=>{
 const player=ASMTracePlayer;player.apply(JSON.parse(JSON.stringify(trace)));window.asmGetAnimationPlaybackRate=()=>speed;
 await player.render(from,{animatePositions:false,animateEvents:false});
 const read=()=>[...document.querySelectorAll('#asm-trace-root [data-trace-pointer-instance-id]')].map(node=>{
  const label=node.querySelector('.trace-variable-marker-label-text'),path=node.querySelector('.trace-variable-marker-point path');
  const points=path?.getAttribute('d')?.match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi)?.map(Number)||[];
  let opacity=1;for(let n=label;n?.nodeType===1;n=n.parentElement){const style=getComputedStyle(n);if(style.display==='none'||style.visibility==='hidden'){opacity=0;break;}opacity*=Number(style.opacity);}
  const root=document.getElementById('asm-trace-root'),box=label.getBoundingClientRect();
  const point=new DOMPoint(box.x+box.width/2,box.y+box.height/2).matrixTransform(root.getScreenCTM().inverse());
  return{id:node.dataset.tracePointerInstanceId,name:label?.textContent,target:node.dataset.traceBindingTarget,opacity,ghost:!!node.closest('.asm-trace-transition-ghost-motion'),
   x:point.x,y:point.y,start:points.slice(0,2),dx:points[2]-points[0],dy:points[3]-points[1]};
 });
 const before=read(),samples=[];let done=false;const pending=player.render(from+1).finally(()=>done=true);
 while(!done){await new Promise(requestAnimationFrame);samples.push(read());}await pending;
 return{before,samples,after:read()};
},{trace,from,speed});}
test('heap 13 to 14 exits preserve their rendered vertical arrow and storage offsets',{timeout:60000},async t=>{
 const body=readPackage(fs.readFileSync('public/guest-decks/heap-sort.asmdeck')).body;
 const trace=savedTrace(body,body.deck.groups.flatMap(g=>g.slides).find(s=>s.animation).animation);
 const {base}=await startIsolatedServer(t),browser=await chromium.launch({headless:true,channel:'msedge'});t.after(()=>browser.close());
 const page=await browser.newPage();await page.goto(base+'/algorithm.html?asmEmbed=runtime');await page.waitForFunction(()=>window.ASMTracePlayer);
 for(const speed of [1,4]){
  const result=await inspect(page,trace,12,speed);
  for(const name of ['i','largest']){
   const before=result.before.find(p=>p.name===name);assert.ok(before);assert.ok(Math.abs(before.dx)<.001&&before.dy>0);
   const outgoing=result.samples.flat().filter(p=>p.id===before.id&&p.ghost&&p.opacity>.01);
   assert.ok(outgoing.length>2);
   assert.ok(outgoing.some(p=>p.opacity<.9),'must sample actual fading, not only the parked ghost');
   assert.ok(outgoing.every(p=>Math.abs(p.dx)<.001&&p.dy>0),'heap arrow must never turn left while leaving');
   assert.ok(outgoing.every(p=>Math.abs(p.x-before.x)<.5),'each exiting label must stay on its own vertical line');
   assert.ok(outgoing.some(p=>p.y<before.y-4),'exit must move upward from its own position');
   assert.ok(!result.after.some(p=>p.id===before.id&&p.opacity>.01));
  }
  const pair=result.samples.filter(sample=>result.before.every(p=>sample.some(q=>q.ghost&&q.id===p.id&&q.opacity>.01)));
  assert.ok(pair.some(sample=>sample.every(p=>!p.ghost||p.opacity<.9)),'both pointers fade together');
  assert.ok(pair.every(sample=>{
   const outgoing=sample.filter(p=>p.ghost);
   return Math.max(...outgoing.map(p=>p.opacity))-Math.min(...outgoing.map(p=>p.opacity))<.001;
  }),'parallel exits share one fade clock');
 }
});
test('matrix row exit keeps its right-facing attachment edge',{timeout:45000},async t=>{
 const {base}=await startIsolatedServer(t);process.env.ASM_TEST_BASE_URL=base;
 const {trace}=await compile(`#include <vector>
int main(){std::vector<std::vector<int>>a={{1,2},{3,4}};int i=0;
// @frame a render matrix
// @pointer i at a.row
{int j=0;
// @frame a render matrix
// @pointer i,j at a.row
}
// @frame a render matrix
// @pointer i at a.row
}`);
 const browser=await chromium.launch({headless:true,channel:'msedge'});t.after(()=>browser.close());
 const page=await browser.newPage();await page.goto(base+'/algorithm.html?asmEmbed=runtime');await page.waitForFunction(()=>window.ASMTracePlayer);
 const result=await inspect(page,trace,1,1),before=result.before.find(p=>p.name==='j');assert.ok(before);
 assert.ok(before.target.endsWith(':row-label:0'),'keep the canonical row anchor instead of a fictitious #0 cell');
 const outgoing=result.samples.flat().filter(p=>p.id===before.id&&p.ghost&&p.opacity>.01);assert.ok(outgoing.length>2);
 assert.ok(outgoing.some(p=>p.opacity<.9));
 assert.ok(outgoing.every(p=>Math.abs(p.dy)<.001&&p.dx>0),'row pointer must not acquire a top-pointer attachment '+JSON.stringify(outgoing.find(p=>Math.abs(p.dy)>=.001||p.dx<=0)));
 assert.ok(outgoing.every(p=>p.start[0]===before.start[0]&&p.start[1]===before.start[1]));
});

test('manual pointer exit before keep moves each label upward from its own position',{timeout:45000},async t=>{
 const {base}=await startIsolatedServer(t);process.env.ASM_TEST_BASE_URL=base;
 const {trace}=await compile(`#include <vector>
int main(){std::vector<int>a={1,2};int i=0,j=0;
// @frame a
// @pointer i,j at a
// @frame a
// @pointer i,j at a
// @exit i,j
// @keep last
// @frame a
}`);
 trace.studio ||= {};
 trace.studio.eventSettings={...trace.studio.eventSettings,autoFixedEnabled:true};
 trace.studio.eventInstructionStates={...trace.studio.eventInstructionStates,'visual-exit:main:i':true,'visual-exit:main:j':true};
 const browser=await chromium.launch({headless:true,channel:'msedge'});t.after(()=>browser.close());
 const page=await browser.newPage();await page.goto(base+'/algorithm.html?asmEmbed=runtime');await page.waitForFunction(()=>window.ASMTracePlayer);
 const exitFrame=trace.frames.findIndex(frame=>frame.events.some(event=>event.type==='visual-exit'));
 assert.ok(exitFrame>0);
 // Advance every RAF deterministically; the 220ms exit must not disappear
 // between samples when the host is busy running another browser process.
 const clockTime=new Date('2026-11-10T00:00:00Z');
 await page.clock.install({time:clockTime});await page.clock.pauseAt(new Date(clockTime.getTime()+1));
 let done=false;const pending=inspect(page,trace,exitFrame-1,1).finally(()=>done=true);
 for(let tick=0;!done&&tick<2000;tick++)await page.clock.runFor(16);
 assert.ok(done,'manual exit playback must complete');
 const result=await pending;
 for(const name of ['i','j']){
  const before=result.before.find(p=>p.name===name&&p.opacity>.01);assert.ok(before);
  const fading=result.samples.flat().filter(p=>p.id===before.id&&p.opacity>.01&&p.opacity<.9);
  assert.ok(fading.length>2,'must observe the actual manual exit');
  assert.ok(fading.every(p=>Math.abs(p.x-before.x)<.5),'manual exit must not recenter horizontally');
  assert.ok(fading.some(p=>p.y<before.y-4));
 }
});
