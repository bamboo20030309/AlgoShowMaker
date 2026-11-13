'use strict';
const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright');
const{startIsolatedServer}=require('./helpers/isolated-server'),{compile}=require('./helpers/compile');
test('LCS j increments follow column anchors when presets contain string size aliases',{timeout:90000},async t=>{
 const{base}=await startIsolatedServer(t),previous=process.env.ASM_TEST_BASE_URL;let trace;
 try{process.env.ASM_TEST_BASE_URL=base;({trace}=await compile(fs.readFileSync('tests/fixtures/lcs-axis-events.cpp','utf8'),'abcdedcba\nedcbabcde\n'));}finally{if(previous===undefined)delete process.env.ASM_TEST_BASE_URL;else process.env.ASM_TEST_BASE_URL=previous;}
 const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/algorithm.html?asmEmbed=runtime');await page.waitForFunction(()=>window.ASMTracePlayer);
 for(const from of[0,3])for(const speed of[1,4]){
  const report=await page.evaluate(async({trace,from,speed})=>{
   const doc=ASMTracePlayer.apply(JSON.parse(JSON.stringify(trace)));window.asmGetAnimationPlaybackRate=()=>speed;await ASMTracePlayer.render(from,{stable:true});
   const root=document.getElementById('asm-trace-root');const matrixId=Object.keys(doc.variables).find(id=>doc.variables[id].name==='LCS');
   const center=node=>{const b=node.getBBox();return new DOMPoint(b.x+b.width/2,b.y+b.height/2).matrixTransform(document.getElementById('asm-trace-root').getScreenCTM().inverse().multiply(node.getScreenCTM()));};
   const inspect=()=>{const root=document.getElementById('asm-trace-root');const p=[...root.querySelectorAll('[data-trace-pointer-id]')].find(n=>n.querySelector('.trace-variable-marker-label-text')?.textContent==='j'&&!n.closest('[data-trace-snapshot]'));return p?{...(()=>{const pt=center(p.querySelector('.trace-variable-marker-label-box'));return{x:pt.x,y:pt.y};})(),target:p.dataset.traceBindingTarget}:null;};
   const expected=center(root.querySelector(`[data-trace-object-key="${CSS.escape(matrixId+'#0,'+(from+2))}"] > rect`));const before=inspect(),samples=[],winners=[];
   const locals={S:'abcdedcba',T:'edcbabcde',j:from+2};const expressions={size:ASMTraceRules.resolveExpression(doc,doc.frames[from+1],'S.size()',locals),j:ASMTraceRules.resolveExpression(doc,doc.frames[from+1],'j',locals),index:ASMTraceRules.resolveExpression(doc,doc.frames[from+1],'T[j-1]',locals)};
   const native={raf:requestAnimationFrame,cancel:cancelAnimationFrame,now:Object.getOwnPropertyDescriptor(performance,'now')};let clock=performance.now(),elapsed=0,id=0;const callbacks=new Map();requestAnimationFrame=cb=>{callbacks.set(++id,cb);return id;};cancelAnimationFrame=id=>callbacks.delete(id);Object.defineProperty(performance,'now',{configurable:true,value:()=>clock});
   const restore=()=>{requestAnimationFrame=native.raf;cancelAnimationFrame=native.cancel;if(native.now)Object.defineProperty(performance,'now',native.now);else delete performance.now;};
   try{const pending=ASMTracePlayer.render(from+1,{fromIndex:from,forceTransition:true});const plan=ASMTracePlayer.getLastPlaybackPlan();while(elapsed<plan.totalDurationMs/speed+100){elapsed+=8;clock+=8;const batch=[...callbacks.values()];callbacks.clear();batch.forEach(cb=>cb(clock));for(let i=0;i<12;i++)await Promise.resolve();samples.push({at:elapsed,marker:inspect(),event:document.getElementById('asm-trace-root').dataset.traceActiveEventId});for(const h of document.getElementById('asm-trace-root').querySelectorAll('.asm-trace-selection-winner'))winners.push({stroke:h.getAttribute('stroke'),width:h.getAttribute('stroke-width')});}restore();await pending;return{before,after:inspect(),expected:{x:expected.x,y:expected.y},samples,expressions,winners};}finally{restore();ASMTraceFrameTween.cancel();}
  },{trace,from,speed});
  fs.mkdirSync('test-results/lcs-axis-events',{recursive:true});fs.writeFileSync(`test-results/lcs-axis-events/${from}-${speed}.json`,JSON.stringify(report));
  assert.equal(report.expressions.size,9);assert.equal(report.expressions.j,from+2);assert.equal(report.expressions.index,'edcbabcde'[from+1]);
  const target=report.expected.x,start=report.before.x;assert.ok(Math.abs(target-start-40)<.5,'one column is exactly 40 world units');
  const write=trace.frames[from+1].events.find(e=>e.type==='write'&&e.source?.text==='j++');assert.ok(write);
  const active=report.samples.filter(s=>s.event===write.id&&s.marker);assert.ok(active.length>3);
  assert.ok(active.every(s=>s.marker.x>=start-.5&&s.marker.x<=target+.5),'j must remain between old and next column, never travel toward an unresolved parking slot');
  assert.ok(Math.abs(active.at(-1).marker.x-target)<.5,'j reaches the next column before later events');
  assert.ok(Math.abs(report.after.x-target)<.5,'completed position agrees with the next frame');
  if(from===0)assert.ok(report.winners.some(h=>h.stroke==='#333333'&&h.width==='5'),'records the existing max winner outline');
 }
 const arrows=await page.evaluate(async()=>{
  await ASMTracePlayer.render(4,{stable:true});
  return [...document.querySelectorAll('#asm-trace-root [data-trace-arrow-source="directive"]')]
    .map(node=>({from:node.dataset.traceArrowFromKey,to:node.dataset.traceArrowToKey,
      strokes:[node,...node.querySelectorAll('line,path,polyline')].map(part=>getComputedStyle(part).stroke).filter(stroke=>stroke!=='none')}));
 });
 assert.equal(arrows.length,1,'the first matching character has one diagonal arrow, not a preset plus a local duplicate');
 assert.ok(arrows[0].from.endsWith('#0,4')&&arrows[0].to.endsWith('#1,5'));
 assert.ok(arrows[0].strokes.length>0&&arrows[0].strokes.every(stroke=>stroke==='rgb(0, 0, 0)'),'the diagonal arrow is black');
 assert.deepEqual(errors,[]);
});
