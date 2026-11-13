'use strict';
const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright');
const{compile}=require('./helpers/compile'),{startIsolatedServer}=require('./helpers/isolated-server');
test('min/max lift both cells, scale only runtime winner, retain scale until frame end without winner outlines',{timeout:90000},async t=>{
 const{base}=await startIsolatedServer(t),previous=process.env.ASM_TEST_BASE_URL;let trace;
 try{process.env.ASM_TEST_BASE_URL=base;({trace}=await compile('#include <bits/stdc++.h>\nusing namespace std;int main(){vector<int>v={3,8,6,2,5,5,7,7};int a=0,b=0,c=0,d=0,after=0,k=1;\n// @frame v,a,b,c,d,after\n// @pointer k at v\n// @style v[1] mark\na=max(v[0],v[1]);b=min(v[2],v[3]);c=max(v[4],v[5]);d=min(v[6],v[7]);after=42;\n// @frame v,a,b,c,d,after\n// @pointer k at v\n// @style v[1] mark\n}'));}finally{if(previous===undefined)delete process.env.ASM_TEST_BASE_URL;else process.env.ASM_TEST_BASE_URL=previous;}
 const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/algorithm.html?asmEmbed=runtime');await page.waitForFunction(()=>window.ASMTracePlayer);
 for(const speed of[1,4]){
  const r=await page.evaluate(async({trace,speed})=>{
   const doc=ASMTracePlayer.apply(JSON.parse(JSON.stringify(trace)));window.asmGetAnimationPlaybackRate=()=>speed;await ASMTracePlayer.render(0,{stable:true});const id=Object.keys(doc.variables).find(id=>doc.variables[id].name==='v');
   const read=()=>{const root=document.getElementById('asm-trace-root'),matrix=root.getScreenCTM().inverse(),cells=[];for(let i=0;i<8;i++){const cell=root.querySelector(`[data-trace-object-key="${CSS.escape(id+'#'+i)}"] > rect`);const b=cell.getBBox(),m=matrix.multiply(cell.getScreenCTM()),p=new DOMPoint(b.x+b.width/2,b.y+b.height/2).matrixTransform(m);cells.push({x:p.x,y:p.y,width:b.width*Math.hypot(m.a,m.b),font:cell.parentElement.querySelector('text')?.getAttribute('font-size')});}return{event:root.dataset.traceActiveEventId,cells,outline:!!root.querySelector('.asm-trace-selection-winner, rect[stroke-width="5"]')};};
   const before=read(),samples=[],native={raf:requestAnimationFrame,cancel:cancelAnimationFrame,now:Object.getOwnPropertyDescriptor(performance,'now')};let clock=performance.now(),elapsed=0,idn=0;const callbacks=new Map();requestAnimationFrame=cb=>{callbacks.set(++idn,cb);return idn;};cancelAnimationFrame=id=>callbacks.delete(id);Object.defineProperty(performance,'now',{configurable:true,value:()=>clock});const restore=()=>{requestAnimationFrame=native.raf;cancelAnimationFrame=native.cancel;if(native.now)Object.defineProperty(performance,'now',native.now);else delete performance.now;};
   try{const pending=ASMTracePlayer.render(1,{fromIndex:0,forceTransition:true});const plan=ASMTracePlayer.getLastPlaybackPlan();while(elapsed<plan.totalDurationMs/speed+100){elapsed+=8;clock+=8;const batch=[...callbacks.values()];callbacks.clear();batch.forEach(cb=>cb(clock));for(let i=0;i<12;i++)await Promise.resolve();samples.push({at:elapsed,...read()});}restore();await pending;return{before,samples,after:read(),events:trace.frames[1].events.filter(e=>e.selectionOperation).map(e=>({id:e.id,role:e.selectedSourceRole,op:e.selectionOperation})),follow:trace.frames[1].events.find(e=>e.type==='assign'&&e.targets.some(t=>doc.variables[t.variableId]?.name==='after'))?.id};}finally{restore();ASMTraceFrameTween.cancel();}
  },{trace,speed});
  fs.mkdirSync('test-results/minmax-presentation',{recursive:true});fs.writeFileSync(`test-results/minmax-presentation/${speed}.json`,JSON.stringify(r));
  assert.equal(r.samples.some(s=>s.outline),false,'no deep gray winner outline');assert.deepEqual(r.events.map(e=>e.role),['source-right','source-right','source-left','source-left']);
  for(let k=0;k<4;k++){const event=r.events[k],left=k*2,right=left+1,winner=[1,3,4,6][k],loser=winner===left?right:left,scale=k%2===0?1.25:.8,active=r.samples.filter(s=>s.event===event.id);
   const ratio=(s,index)=>s.cells[index].width/r.before.cells[index].width;
   assert.ok(active.some(s=>s.cells[left].y<r.before.cells[left].y-10&&s.cells[right].y<r.before.cells[right].y-10),'both candidates lift');
   assert.ok(active.every(s=>Math.abs(ratio(s,loser)-1)<.02),'non-selected candidate must not scale');
   assert.ok(active.some(s=>Math.abs(ratio(s,winner)-scale)<.02&&Math.abs(s.cells[left].y-r.before.cells[left].y)<.5&&Math.abs(s.cells[right].y-r.before.cells[right].y)<.5),'both lower together while winner retains its scale');
   const follow=r.samples.filter(s=>s.event===r.follow);assert.ok(follow.length>3);assert.ok(follow.every(s=>Math.abs(ratio(s,winner)-scale)<.02),'winner remains scaled during a later event in the same frame');
  }
  assert.ok(r.after.cells.every((c,i)=>Math.abs(c.width/r.before.cells[i].width-1)<.02),'frame completion restores presentation scale');
 }
 assert.deepEqual(errors,[]);
});
