'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{startIsolatedServer}=require('./helpers/isolated-server'),{compile}=require('./helpers/compile');
test('a composite pointer and indexed assignment share the state before a later update',{timeout:60000},async t=>{
 const {base}=await startIsolatedServer(t);process.env.ASM_TEST_BASE_URL=base;
 const code=`#include <vector>
int main(){std::vector<int>a={10,20,30,40,50};int i=0,k=0;
// @frame a
// @pointer i+k at a
i=1;
a[i+k]=a[4];
k=2;
// @frame a
// @pointer i+k at a
}`;
 const {trace}=await compile(code);
 const frame=trace.frames[1],assignment=frame.events.find(e=>e.type==='assign'&&e.targets.some(t=>t.variableId.includes(':a@')));
 assert.ok(assignment);assert.equal(assignment.targets.find(t=>t.role==='target').resolvedIndex,1);
 const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());
 const page=await browser.newPage();await page.goto(base+'/algorithm.html?asmEmbed=runtime');await page.waitForFunction(()=>window.ASMTracePlayer);
 const result=await page.evaluate(async({trace,eventId})=>{
  const player=ASMTracePlayer;player.apply(trace);window.asmGetAnimationPlaybackRate=()=>4;
  await player.render(0,{animatePositions:false,animateEvents:false});
  const samples=[];let done=false;
  const transition=player.render(1).finally(()=>done=true);
  const root=document.getElementById('asm-trace-root');
  while(!done){await new Promise(requestAnimationFrame);if(root.dataset.traceActiveEventId!==eventId)continue;
   const marker=[...root.querySelectorAll('[data-trace-pointer-instance-id]')].find(n=>n.querySelector('.trace-variable-marker-label-text')?.textContent==='i+k');
   const label=marker?.querySelector('.trace-variable-marker-label-text')?.getBoundingClientRect();
   const cell=[...root.querySelectorAll('[data-trace-object-key]')].find(n=>n.dataset.traceObjectKey.endsWith('#1')&&n.querySelector('rect'))?.getBoundingClientRect();
   if(label&&cell)samples.push({pointerX:label.x+label.width/2,cellX:cell.x+cell.width/2});
  }
  await transition;
  const final=[...root.querySelectorAll('[data-trace-pointer-instance-id]')].find(n=>n.querySelector('.trace-variable-marker-label-text')?.textContent==='i+k');
  return{samples,final:final?.dataset.traceBindingTarget};
 },{trace,eventId:assignment.id});
 assert.ok(result.samples.length>=3,JSON.stringify(result));
 assert.ok(result.samples.every(s=>Math.abs(s.pointerX-s.cellX)<0.75),'i+k must point to 1 before k becomes 2: '+JSON.stringify(result));
 assert.match(result.final,/#3$/);
});

test('min selection starts at the current pointer position after an earlier assignment',{timeout:60000},async t=>{
 const {base}=await startIsolatedServer(t);process.env.ASM_TEST_BASE_URL=base;
 const {trace}=await compile(`#include <bits/stdc++.h>
using namespace std;
int main(){vector<int>a={10,20,30,40,50};int i=0,j=2,best=0;
// @frame a,best
// @pointer i,j at a
i=1;
best=min(i,j);
i=3;
// @frame a,best
// @pointer i,j at a
}`);
 const selection=trace.frames[1].events.find(e=>e.selectionOperation==='min');assert.ok(selection);
 const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());
 const page=await browser.newPage();await page.goto(base+'/algorithm.html?asmEmbed=runtime');await page.waitForFunction(()=>window.ASMTracePlayer);
 const samples=await page.evaluate(async({trace,eventId})=>{
  ASMTracePlayer.apply(trace);window.asmGetAnimationPlaybackRate=()=>4;
  await ASMTracePlayer.render(0,{animatePositions:false,animateEvents:false});
  const samples=[];let done=false;const transition=ASMTracePlayer.render(1).finally(()=>done=true);
  while(!done){await new Promise(requestAnimationFrame);
   const root=document.getElementById('asm-trace-root');if(root.dataset.traceActiveEventId!==eventId)continue;
   const marker=[...root.querySelectorAll('[data-trace-pointer-instance-id]')].find(n=>n.querySelector('.trace-variable-marker-label-text')?.textContent==='i');
   const popup=[...root.querySelectorAll('.asm-trace-compare-marker-popup')].find(n=>n.querySelector('text')?.textContent==='1'&&Number(n.getAttribute('opacity'))>.3);
   if(!marker||!popup)continue;
   const a=marker.querySelector('.trace-variable-marker-label-text').getBoundingClientRect(),b=popup.getBoundingClientRect();
   samples.push({pointerX:a.x+a.width/2,popupX:b.x+b.width/2});
  }
  await transition;return samples;
 },{trace,eventId:selection.id});
 assert.ok(samples.length>=3,JSON.stringify(samples));
 assert.ok(samples.every(s=>Math.abs(s.pointerX-s.popupX)<1),JSON.stringify(samples));
});
