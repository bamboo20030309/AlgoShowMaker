const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright');
const{compile}=require('./helpers/compile'),{startIsolatedServer}=require('./helpers/isolated-server');
test('matrix row and column label cells preserve their variable/index provenance across event playback and old saves',{timeout:90000},async t=>{
 const{base}=await startIsolatedServer(t),old=process.env.ASM_TEST_BASE_URL;let trace;
 try{process.env.ASM_TEST_BASE_URL=base;({trace}=await compile(`#include <bits/stdc++.h>
using namespace std;int main(){string S="aba",T="aca";vector<vector<int>> dp(4,vector<int>(4));char copied='?';
// @frame dp,copied with row-labels("",S),column-labels("",T)
bool equal=S[0]==T[0];bool different=S[1]!=T[1];bool less=S[1]<T[1];copied=S[2];S[1]='x';copied=S[1];T[1]='y';
// @frame dp,copied with row-labels("",S),column-labels("",T)
}`));}finally{if(old===undefined)delete process.env.ASM_TEST_BASE_URL;else process.env.ASM_TEST_BASE_URL=old;}
 const dp=Object.keys(trace.variables).find(id=>trace.variables[id].name==='dp'),S=Object.keys(trace.variables).find(id=>trace.variables[id].name==='S');
 assert.deepEqual(JSON.parse(JSON.stringify(trace.frames[0].rendererOptions[dp].rowLabels.sources)),[null,{variableId:S,index:0},{variableId:S,index:1},{variableId:S,index:2}]);
 const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/algorithm.html?asmEmbed=runtime');await page.waitForFunction(()=>window.ASMTracePlayer);
 for(const mode of ['fresh','legacy','reopened','read-off','custom'])for(const speed of [1,4]){
 const report=await page.evaluate(async({trace,mode,speed})=>{
  const saved=JSON.parse(JSON.stringify(trace));saved.studio||={};saved.studio.eventSettings||={};saved.studio.eventSettings.readHighlightEnabled=mode!=='read-off';if(mode!=='fresh')for(const f of saved.frames)for(const o of Object.values(f.rendererOptions||{})){delete o.rowLabels?.sources;delete o.columnLabels?.sources;}
  if(mode==='custom'){
   const id=Object.keys(saved.variables).find(id=>saved.variables[id].name==='dp');
   saved.studio.objectStyles=Object.fromEntries(saved.frames.map(f=>[f.id,{[id+':row-label:1']:{fill:'#123456'}}]));
  }
  let doc=ASMTracePlayer.apply(saved);if(mode==='reopened')doc=ASMTracePlayer.apply(JSON.parse(JSON.stringify(ASMTracePlayer.getDocument())));window.asmGetAnimationPlaybackRate=()=>speed;window.ASMTraceCamera={...window.ASMTraceCamera,apply(){},transitionDuration:()=>0};await ASMTracePlayer.render(0,{stable:true});window.setCamera?.(600,150,1,false);window.ASMStructureLOD?.refresh?.();await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
  const dp=Object.keys(doc.variables).find(id=>doc.variables[id].name==='dp');const read=()=>{const root=document.getElementById('asm-trace-root'),inverse=root.getScreenCTM().inverse();const labels=[...root.querySelectorAll('[data-trace-label-source-key]')].map(n=>{const b=n.querySelector('rect').getBBox(),m=inverse.multiply(n.querySelector('rect').getScreenCTM()),p=new DOMPoint(b.x+b.width/2,b.y+b.height/2).matrixTransform(m);return{key:n.dataset.traceObjectKey,source:n.dataset.traceLabelSourceKey,x:p.x,y:p.y,width:b.width*Math.hypot(m.a,m.b),fill:n.querySelector('rect').getAttribute('fill'),text:n.querySelector('text')?.textContent??null};});return{event:root.dataset.traceActiveEventId,labels,transfer:[...root.querySelectorAll('.asm-trace-assign-transfer')].map(n=>({source:n.dataset.traceTransferSourceKey,rects:n.querySelectorAll('rect').length,text:n.textContent})),reads:[...root.querySelectorAll('.asm-trace-read-highlight')].map(n=>n.dataset.traceReadSource)};};
  const before=read(),samples=[],native={raf:requestAnimationFrame,cancel:cancelAnimationFrame,now:Object.getOwnPropertyDescriptor(performance,'now')};let clock=performance.now(),elapsed=0,id=0;const callbacks=new Map();requestAnimationFrame=cb=>{callbacks.set(++id,cb);return id;};cancelAnimationFrame=id=>callbacks.delete(id);Object.defineProperty(performance,'now',{configurable:true,value:()=>clock});const restore=()=>{requestAnimationFrame=native.raf;cancelAnimationFrame=native.cancel;if(native.now)Object.defineProperty(performance,'now',native.now);else delete performance.now;};
  try{const pending=ASMTracePlayer.render(1,{fromIndex:0,forceTransition:true}),plan=ASMTracePlayer.getLastPlaybackPlan();while(elapsed<plan.totalDurationMs/speed+100){elapsed+=8;clock+=8;const batch=[...callbacks.values()];callbacks.clear();batch.forEach(cb=>cb(clock));for(let i=0;i<12;i++)await Promise.resolve();samples.push(read());}restore();await pending;return{before,samples,after:read(),events:doc.frames[1].events.filter(e=>['compare','assign'].includes(e.type)).map(e=>({id:e.id,type:e.type,expression:e.expression,disabled:e.autoAnimationDisabled})),dp};}finally{restore();ASMTraceFrameTween.cancel();}
 },{trace,mode,speed});
 fs.mkdirSync('test-results/matrix-label-events',{recursive:true});fs.writeFileSync(`test-results/matrix-label-events/${mode}-${speed}.json`,JSON.stringify(report));
 const compares=report.events.filter(e=>e.type==='compare');assert.equal(compares.length,3);assert.ok(compares.every(e=>!e.disabled),'S/T comparisons can play through label cells');
 if(mode==='read-off')assert.ok(report.samples.every(s=>s.reads.length===0),'read highlight stays explicitly off');
 else assert.ok(report.samples.some(s=>s.reads.includes(S+'#0')),'read emphasis uses the original string identity through its label');
 assert.equal(report.before.labels.length,6,'blank prefix is not a source cell');
 assert.ok(report.before.labels.every(n=>n.fill===(mode==='custom'&&n.key===report.dp+':row-label:1'?'#123456':'rgba(111, 161, 255, 0.7)')),'source labels retain original header color and authored fill');
 for(const [event,row,column] of [[compares[0],1,1],[compares[1],2,2],[compares[2],2,2]]){
  const keys=[report.dp+':row-label:'+row,report.dp+':column-label:'+column];
  const active=report.samples.filter(s=>s.event===event.id);assert.ok(active.length>3);
  for(const key of keys){
   const baseline=report.before.labels.find(n=>n.key===key),positions=active.map(s=>s.labels.find(n=>n.key===key));
   assert.ok(positions.every(n=>Math.abs(n.x-baseline.x)<.1),'label never converges horizontally');
   assert.ok(positions.some(n=>n.y<baseline.y-10&&n.width>baseline.width*1.2),'each label lifts and enlarges regardless of comparison result');
   const last=positions.at(-1);assert.ok(Math.abs(last.y-baseline.y)<.1&&Math.abs(last.width-baseline.width)<.1,'label restores before the next event');
  }
 }
 assert.ok(report.samples.some(s=>s.transfer.some(v=>v.source===report.dp+':row-label:3'&&v.rects>0)),'S[2] copies the third character label, not the equal first character');
 assert.equal(report.after.labels.find(n=>n.key===report.dp+':row-label:2').text,'x');assert.equal(report.after.labels.find(n=>n.key===report.dp+':column-label:2').text,'y');
 }
 assert.deepEqual(errors,[]);
});
