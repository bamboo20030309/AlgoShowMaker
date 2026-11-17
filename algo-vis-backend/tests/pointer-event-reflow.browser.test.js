'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('playwright'),{startIsolatedServer}=require('./helpers/isolated-server');
const {readPackage,savedTrace}=require('./helpers/deck-package');
const {compile}=require('./helpers/compile');
async function sample(page,trace,from,speed){return page.evaluate(async({trace,from,speed})=>{
 const player=ASMTracePlayer;player.apply(JSON.parse(JSON.stringify(trace)));window.asmGetAnimationPlaybackRate=()=>speed;
 await player.render(from,{animatePositions:false,animateEvents:false});
 const read=()=>{const root=document.getElementById('asm-trace-root'),markers={};
  for(const node of root.querySelectorAll('[data-trace-pointer-instance-id]')){
   const text=node.querySelector('.trace-variable-marker-label-text');if(!text)continue;
   let opacity=1;for(let n=text;n&&n.nodeType===1;n=n.parentElement){const style=getComputedStyle(n);if(style.visibility==='hidden'||style.display==='none'){opacity=0;break;}opacity*=Number(style.opacity);}
   const box=text.getBoundingClientRect(),p=new DOMPoint(box.x+box.width/2,box.y+box.height/2).matrixTransform(root.getScreenCTM().inverse());
   if(opacity>.001)markers[text.textContent]={x:p.x,y:p.y,opacity,target:node.dataset.traceBindingTarget};
  }
  return{event:root.dataset.traceActiveEventId||'',phase:root.dataset.tracePlaybackPhase||'',markers};
 };
 const before=read(),samples=[];let done=false;const pending=player.render(from+1).finally(()=>done=true);
 while(!done){await new Promise(requestAnimationFrame);samples.push(read());}await pending;
 return{before,samples,after:read()};
},{trace,from,speed});}

test('selection min_idx initializes at i without travelling from an unresolved slot',{timeout:45000},async t=>{
 const body=readPackage(fs.readFileSync('public/guest-decks/selection-sort.asmdeck')).body;
 const trace=savedTrace(body,body.deck.groups.flatMap(g=>g.slides).find(s=>s.animation).animation);
 const {base}=await startIsolatedServer(t),browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());
 const page=await browser.newPage();await page.goto(base+'/algorithm.html?asmEmbed=runtime');await page.waitForFunction(()=>window.ASMTracePlayer);
 for(const speed of [1,4]){
  const result=await sample(page,trace,0,speed),final=result.after.markers.min_idx;
  assert.ok(final);assert.ok(final.target.endsWith('#0'));
  const visible=result.samples.filter(s=>s.markers.min_idx);
  assert.ok(visible.length>2);
  assert.ok(visible.every(s=>Math.abs(s.markers.min_idx.x-final.x)<.5),'min_idx must enter beside i at arr[0]');
 }
});

test('quick sort 18 to 19 recenters i with j exit, never during the preceding frame phase',{timeout:60000},async t=>{
 const body=readPackage(fs.readFileSync('public/guest-decks/quick-sort.asmdeck')).body;
 const trace=savedTrace(body,body.deck.groups.flatMap(g=>g.slides).find(s=>s.animation).animation);
 const exit=trace.frames[18].events.find(e=>e.type==='scope-exit'&&e.name==='j');assert.ok(exit);
 const {base}=await startIsolatedServer(t),browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());
 const page=await browser.newPage();await page.goto(base+'/algorithm.html?asmEmbed=runtime');await page.waitForFunction(()=>window.ASMTracePlayer);
 for(const speed of [1,4]){
  const result=await sample(page,trace,17,speed),initial=result.before.markers.i.x;
  const beforeExit=result.samples.filter(s=>s.markers.j?.opacity>.999);
  assert.ok(beforeExit.length>=3);
  assert.ok(beforeExit.every(s=>Math.abs(s.markers.i.x-initial)<.5),'i moved before j faded: '+JSON.stringify(beforeExit.find(s=>Math.abs(s.markers.i.x-initial)>=.5)));
  const moving=result.samples.filter(s=>s.markers.i&&Math.abs(s.markers.i.x-initial)>1&&s.markers.j);
  assert.ok(moving.length>0,'peer and departing marker must animate concurrently');
  assert.ok(moving.every(s=>s.event===exit.id&&s.markers.j.opacity<.999),JSON.stringify(moving));
  assert.ok(Math.abs(result.after.markers.i.x-initial)>5);
  assert.equal(result.after.markers.j,undefined);
 }
});
test('same-cell peers wait for declaration and movement; view-only removal shares its fade clock',{timeout:60000},async t=>{
 const {base}=await startIsolatedServer(t);process.env.ASM_TEST_BASE_URL=base;
 const {trace}=await compile(`#include <vector>
int main(){std::vector<int>a={4,5,6};int i=0;
// @frame a
// @pointer i at a
int j=0;
// @frame a
// @pointer i,j at a
j=1;
// @frame a
// @pointer i,j at a
j=0;
// @frame a
// @pointer i,j at a
// @frame a
// @pointer i at a
i=i;
// @frame a
// @pointer i at a
}`);
 const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());
 const page=await browser.newPage();await page.goto(base+'/algorithm.html?asmEmbed=runtime');await page.waitForFunction(()=>window.ASMTracePlayer);
 const enter=await sample(page,trace,0,4),initial=enter.before.markers.i.x;
 assert.ok(enter.samples.some(s=>s.markers.j&&Math.abs(s.markers.i.x-initial)>1));
 assert.ok(enter.samples.filter(s=>!s.markers.j).every(s=>Math.abs(s.markers.i.x-initial)<.5),'peer moved before new j was visible');
 const move=await sample(page,trace,1,4),oldI=move.before.markers.i.x,oldJ=move.before.markers.j.x;
 const changed=move.samples.filter(s=>s.markers.i&&Math.abs(s.markers.i.x-oldI)>1);
 assert.ok(changed.length>2);
 assert.ok(changed.every(s=>s.markers.j&&Math.abs(s.markers.j.x-oldJ)>.5),'peer moved before j left the shared cell');
 const hidden=await sample(page,trace,3,4),old=hidden.before.markers.i.x;
 assert.ok(hidden.samples.some(s=>s.markers.j&&s.markers.j.opacity<.99&&Math.abs(s.markers.i.x-old)>1));
 assert.ok(hidden.samples.filter(s=>s.markers.j?.opacity>.999).every(s=>Math.abs(s.markers.i.x-old)<.5));
 assert.equal(hidden.after.markers.j,undefined);
});

test('matrix row pointer peers also wait for the departing pointer event',{timeout:45000},async t=>{
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
 const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());
 const page=await browser.newPage();await page.goto(base+'/algorithm.html?asmEmbed=runtime');await page.waitForFunction(()=>window.ASMTracePlayer);
 const result=await sample(page,trace,1,4),initial=result.before.markers.i.x;
 assert.ok(result.samples.filter(s=>s.markers.j?.opacity>.999).every(s=>Math.abs(s.markers.i.x-initial)<.5));
 assert.ok(result.samples.some(s=>s.markers.j&&s.markers.j.opacity<.99&&Math.abs(s.markers.i.x-initial)>1));
 assert.equal(result.after.markers.j,undefined);
});

test('a pointer waiting behind an exit barrier is not counted before its entrance',{timeout:45000},async t=>{
 const {base}=await startIsolatedServer(t);process.env.ASM_TEST_BASE_URL=base;
 const {trace}=await compile(`#include <vector>
int main(){std::vector<int>a={4,5};int i=0,k=0;
{int j=0;
// @frame a
// @pointer i,j at a
}
// @frame a
// @pointer i,k at a
i=i;
// @frame a
// @pointer i,k at a
}`);
 const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());
 const page=await browser.newPage();await page.goto(base+'/algorithm.html?asmEmbed=runtime');await page.waitForFunction(()=>window.ASMTracePlayer);
 const result=await sample(page,trace,0,1),initial=result.before.markers.i.x;
 const whileLeaving=result.samples.filter(s=>s.markers.j&&s.markers.j.opacity<.9&&!s.markers.k);
 assert.ok(whileLeaving.some(s=>s.markers.i.x>initial+3),'future k occupied a slot before entering: '+JSON.stringify({before:result.before,first:result.samples.slice(0,2),leaving:whileLeaving.slice(0,2),after:result.after}));
 assert.ok(result.samples.filter(s=>s.markers.j?.opacity>.999).every(s=>!s.markers.k&&Math.abs(s.markers.i.x-initial)<.5));
 assert.ok(result.after.markers.k);assert.equal(result.after.markers.j,undefined);
 assert.ok(Math.abs(result.after.markers.i.x-initial)<.5,'replacement restores the two-pointer layout');
});
