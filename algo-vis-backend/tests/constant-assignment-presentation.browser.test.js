const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
const {compile}=require('./helpers/compile');
const {startIsolatedServer}=require('./helpers/isolated-server');

test('single constants drop, mixed constants cover the destination value with their arithmetic operator', {timeout:90000},async t=>{
 const {base}=await startIsolatedServer(t),previous=process.env.ASM_TEST_BASE_URL;let trace;
 try{process.env.ASM_TEST_BASE_URL=base;({trace}=await compile(`#include <bits/stdc++.h>
using namespace std;int main(){int shown=12,hidden=7,result=0;
// @frame shown,result when hidden>=0
result=5;result=-5;result=0;result=0x10;result+=2;result-=2;result*=3;result/=3;
result=shown+2;result=shown-2;result=shown*2;result=shown/2;
result=2-shown;result=24/shown;result=1+2;result=shown+2-3+4;
// @frame shown,result when hidden>=0
}`));}finally{if(previous===undefined)delete process.env.ASM_TEST_BASE_URL;else process.env.ASM_TEST_BASE_URL=previous;}
 const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/algorithm.html?asmEmbed=runtime');await page.waitForFunction(()=>window.ASMTracePlayer);
 for(const speed of [1,4]){
  const report=await page.evaluate(async({trace,speed})=>{
   const doc=ASMTracePlayer.apply(JSON.parse(JSON.stringify(trace)));window.asmGetAnimationPlaybackRate=()=>speed;await ASMTracePlayer.render(0,{stable:true});
   const events=Object.fromEntries(doc.frames[1].events.filter(e=>['assign','write'].includes(e.type)).map(e=>[e.id,e.expression.replace(/\s/g,'')]));
   const samples={};const native={raf:requestAnimationFrame,cancel:cancelAnimationFrame,now:Object.getOwnPropertyDescriptor(performance,'now')};let clock=performance.now(),elapsed=0,id=0;const callbacks=new Map();requestAnimationFrame=cb=>{callbacks.set(++id,cb);return id;};cancelAnimationFrame=id=>callbacks.delete(id);Object.defineProperty(performance,'now',{configurable:true,value:()=>clock});
   const restore=()=>{requestAnimationFrame=native.raf;cancelAnimationFrame=native.cancel;if(native.now)Object.defineProperty(performance,'now',native.now);else delete performance.now;};
   try{const pending=ASMTracePlayer.render(1,{fromIndex:0,forceTransition:true}),plan=ASMTracePlayer.getLastPlaybackPlan();while(elapsed<plan.totalDurationMs/speed+100){elapsed+=8;clock+=8;const batch=[...callbacks.values()];callbacks.clear();batch.forEach(cb=>cb(clock));for(let i=0;i<12;i++)await Promise.resolve();const root=document.getElementById('asm-trace-root'),expression=events[root.dataset.traceActiveEventId];if(!expression)continue;const list=samples[expression]||=[];const targetId=Object.keys(doc.variables).find(id=>doc.variables[id].name==='result'),target=root.querySelector(`[data-trace-object-key="${CSS.escape(targetId+'#0')}"] text[data-trace-content-role="value"]`),tb=target.getBBox(),tm=root.getScreenCTM().inverse().multiply(target.getScreenCTM()),tp=new DOMPoint(tb.x+tb.width/2,tb.y+tb.height/2).matrixTransform(tm);for(const group of root.querySelectorAll('.asm-trace-assign-literal-value')){if(Number(group.getAttribute('opacity'))<.2)continue;const text=group.querySelector('text'),b=text.getBBox(),m=root.getScreenCTM().inverse().multiply(text.getScreenCTM()),point=new DOMPoint(b.x+b.width/2,b.y+b.height/2).matrixTransform(m);list.push({text:text.textContent,y:point.y,x:point.x,width:b.width*Math.hypot(m.a,m.b),targetY:tp.y,targetOpacity:Number(target.getAttribute('opacity')??1),motion:group.dataset.traceLiteralMotion});}}
    restore();await pending;return{samples,restorePhase:plan.phases.find(p=>p.id==='selection-scale-restore'),events:doc.frames[1].events.filter(e=>['assign','write'].includes(e.type)),leftovers:document.querySelectorAll('.asm-trace-assign-literal-value').length};
   }finally{restore();ASMTraceFrameTween.cancel();}
  },{trace,speed});
  fs.mkdirSync('test-results/constant-assignment-presentation',{recursive:true});fs.writeFileSync(`test-results/constant-assignment-presentation/${speed}.json`,JSON.stringify(report));
  for(const [expression,label] of Object.entries({'result=5':'+5','result=-5':'-5','result=0':'+0','result=0x10':'+16','result+=2':'+2','result-=2':'-2','result*=3':'*3','result/=3':'/3'})){
   const values=report.samples[expression]?.filter(s=>s.text===label)||[];assert.ok(values.length>2,JSON.stringify({expression,report}));assert.ok(values.every(s=>s.motion==='drop'));assert.ok(Math.max(...values.map(s=>s.y))-Math.min(...values.map(s=>s.y))>12,expression+' must fall');
  }
  for(const [expression,labels] of Object.entries({'result=shown+2':['+2'],'result=shown-2':['-2'],'result=shown*2':['*2'],'result=shown/2':['/2'],'result=2-shown':['2 -'],'result=24/shown':['24 /'],'result=1+2':['+1','+2'],'result=shown+2-3+4':['+2','-3','+4']})){
   for(const label of labels){const values=report.samples[expression]?.filter(s=>s.text===label)||[];assert.ok(values.length>2,JSON.stringify({expression,label,report}));assert.ok(values.every(s=>s.motion==='stationary'));assert.ok(values.every(s=>Math.abs(s.y-s.targetY)<.5),'constant occupies destination text baseline');assert.ok(values.every(s=>s.targetOpacity===0),'old value is hidden while the constant covers it');assert.ok(Math.max(...values.map(s=>s.y))-Math.min(...values.map(s=>s.y))<.05,expression+' constant must stay in place');}
  }
  const row=['+2','-3','+4'].map(label=>report.samples['result=shown+2-3+4'].find(s=>s.text===label));
  for(let i=1;i<row.length;i++)assert.ok(row[i-1].x+row[i-1].width/2<row[i].x-row[i].width/2,'multiple constant hints must not overlap');
  assert.equal(report.restorePhase,undefined,'frames without min/max must not add a restoration delay');
  assert.equal(report.leftovers,0);
 }
 assert.deepEqual(errors,[]);
});
