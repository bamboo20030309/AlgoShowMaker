'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {startIsolatedServer}=require('./helpers/isolated-server');
const {compile}=require('./helpers/compile');

test('tree edge directions survive reopening; yellow code prompt precedes canvas effects', {timeout:60000},async t=>{
 const {base}=await startIsolatedServer(t);process.env.ASM_TEST_BASE_URL=base;
 const {trace}=await compile(`#include <vector>
 // @layout recursion as tree
 // @layout tree branch-previews off
 // @layout tree arrow-direction up
 void visit(std::vector<int>& a,int L,int R){
 // @frame a with range(L,R) in tree
 // @keep last in tree
 if(L<R){visit(a,L,L);visit(a,R,R);}
 }
 int main(){std::vector<int> a={4,1};visit(a,0,1);
 // @frame
 }
 `);
 assert.equal(trace.layouts[0].arrowDirection,'up');
 const {trace:operations}=await compile(`#include <vector>
 int main(){std::vector<int> a={4,1};
 // @frame a
 if(a[0]>a[1])a[0]=a[1];
 // @frame a
 }
 `);
 const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/algorithm.html?asmEmbed=runtime');await page.waitForFunction(()=>window.ASMTracePlayer);
 const directions=await page.evaluate(async trace=>{
  const outcomes=[];
  for(const layoutDirection of ['top-down','bottom-up'])for(const arrowDirection of [undefined,'up','down','child-to-parent']){
   const copy=JSON.parse(JSON.stringify(trace));copy.layouts[0].direction=layoutDirection;
   if(arrowDirection)copy.layouts[0].arrowDirection=arrowDirection;else delete copy.layouts[0].arrowDirection;
   // 舊資料缺欄位與新設定都實際序列化、重開，不能靠記憶體狀態。
   ASMTracePlayer.apply(JSON.parse(JSON.stringify(copy)));await ASMTracePlayer.render(copy.frames.length-1,{stable:true});
   const edges=[...document.querySelectorAll('.asm-trace-layout-edge')].map(e=>({start:e.hasAttribute('marker-start'),end:e.hasAttribute('marker-end'),dy:Number(e.getAttribute('y2'))-Number(e.getAttribute('y1'))}));
   outcomes.push({layoutDirection,arrowDirection:arrowDirection||'legacy',edges});
  }
  const disabled=JSON.parse(JSON.stringify(trace));disabled.layouts[0].showEdges=false;
  ASMTracePlayer.apply(disabled);await ASMTracePlayer.render(disabled.frames.length-1,{stable:true});
  outcomes.push({disabled:document.querySelectorAll('.asm-trace-layout-edge').length});return outcomes;
 },trace);
 for(const result of directions.filter(r=>r.edges)){
  assert.equal(result.edges.length,2,JSON.stringify(result));
  for(const edge of result.edges){
   const reverse=result.arrowDirection==='child-to-parent'||(result.arrowDirection==='up'&&edge.dy>0)||(result.arrowDirection==='down'&&edge.dy<0);
   assert.equal(edge.start,reverse,JSON.stringify(result));assert.equal(edge.end,!reverse,JSON.stringify(result));
   assert.equal(Math.sign(edge.dy),result.layoutDirection==='top-down'?1:-1);
  }
 }
 assert.equal(directions.at(-1).disabled,0);
 for(const speed of [1,2]){
  const result=await page.evaluate(async({trace,speed})=>{
   const doc=ASMTracePlayer.apply(trace);doc.studio.codePanelScrollMs=0;doc.studio.eventSettings={...doc.studio.eventSettings,gapMs:137};
   window.asmGetAnimationPlaybackRate=()=>speed;window.ASMTraceCamera={...ASMTraceCamera,apply(){},transitionDuration:()=>0};
   await ASMTracePlayer.render(0,{stable:true});
   const native={raf:requestAnimationFrame,cancel:cancelAnimationFrame,now:Object.getOwnPropertyDescriptor(performance,'now')};
   let clock=performance.now(),elapsed=0,serial=0;const callbacks=new Map(),samples=[];
   window.requestAnimationFrame=f=>{callbacks.set(++serial,f);return serial;};window.cancelAnimationFrame=id=>callbacks.delete(id);
   Object.defineProperty(performance,'now',{configurable:true,value:()=>clock});
   const restore=()=>{window.requestAnimationFrame=native.raf;window.cancelAnimationFrame=native.cancel;if(native.now)Object.defineProperty(performance,'now',native.now);else delete performance.now;};
   try{
    const pending=ASMTracePlayer.render(1,{fromIndex:0,forceTransition:true});
    const plan=ASMTracePlayer.getLastPlaybackPlan(),steps=plan.phases.flatMap(p=>p.steps||[]).filter(s=>s.kind==='trace-event');
    while(elapsed*speed<plan.totalDurationMs+100){
     elapsed+=20;clock+=20;const batch=[...callbacks.values()];callbacks.clear();batch.forEach(f=>f(clock));for(let n=0;n<10;n++)await Promise.resolve();
     samples.push({at:elapsed*speed,active:document.querySelector('#asm-trace-root').dataset.traceActiveEventType,yellow:!!document.querySelector('.asm-trace-code-panel .is-active'),compare:!!document.querySelector('.asm-trace-compare-highlight')});
    }
    restore();await pending;return{steps,samples};
   }finally{restore();ASMTraceFrameTween.cancel();}
  },{trace:operations,speed});
  const compare=result.steps.find(s=>s.type==='compare'||s.eventType==='compare'||s.animation==='compare');
  assert.ok(compare,JSON.stringify(result.steps));
  assert.equal(compare.codePromptDurationMs,200);
  const during=result.samples.filter(s=>s.active==='compare'&&s.at>compare.startMs&&s.at<compare.visualStartMs);
  assert.ok(during.length>=3);assert.ok(during.every(s=>s.yellow&&!s.compare),JSON.stringify(during));
  assert.ok(result.samples.some(s=>s.at>=compare.visualStartMs&&s.compare));
  const assignment=result.steps.find(s=>s.type==='assign'||s.eventType==='assign'||s.animation==='assign');
  assert.ok(assignment);assert.equal(assignment.codePromptDurationMs,200);
  assert.ok(assignment.startMs>=compare.startMs+compare.durationMs+137,'閱讀停留不取代使用者事件間隔');
 }
 assert.deepEqual(errors,[]);
});
