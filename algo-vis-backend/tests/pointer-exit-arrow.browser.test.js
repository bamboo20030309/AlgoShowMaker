const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('playwright'),{startIsolatedServer}=require('./helpers/isolated-server');
const {readPackage,savedTrace}=require('./helpers/deck-package'),{compile}=require('./helpers/compile');
async function inspect(page,trace,from,speed){return page.evaluate(async({trace,from,speed})=>{
 const player=ASMTracePlayer;player.apply(JSON.parse(JSON.stringify(trace)));window.asmGetAnimationPlaybackRate=()=>speed;
 await player.render(from,{animatePositions:false,animateEvents:false});
 const read=()=>[...document.querySelectorAll('#asm-trace-root [data-trace-pointer-instance-id]')].map(node=>{
  const label=node.querySelector('.trace-variable-marker-label-text'),path=node.querySelector('.trace-variable-marker-point path');
  const points=path?.getAttribute('d')?.match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi)?.map(Number)||[];
  let opacity=1;for(let n=label;n?.nodeType===1;n=n.parentElement)opacity*=Number(getComputedStyle(n).opacity);
  return{id:node.dataset.tracePointerInstanceId,name:label?.textContent,opacity,ghost:!!node.closest('.asm-trace-transition-ghost-motion'),
   start:points.slice(0,2),dx:points[2]-points[0],dy:points[3]-points[1]};
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
   assert.ok(!result.after.some(p=>p.id===before.id&&p.opacity>.01));
  }
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
 const outgoing=result.samples.flat().filter(p=>p.id===before.id&&p.ghost&&p.opacity>.01);assert.ok(outgoing.length>2);
 assert.ok(outgoing.some(p=>p.opacity<.9));
 assert.ok(outgoing.every(p=>Math.abs(p.dy)<.001&&p.dx>0),'row pointer must not acquire a top-pointer attachment');
 assert.ok(outgoing.every(p=>p.start[0]===before.start[0]&&p.start[1]===before.start[1]));
});
