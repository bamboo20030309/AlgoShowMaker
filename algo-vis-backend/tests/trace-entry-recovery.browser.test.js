'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('playwright');
const {startIsolatedServer}=require('./helpers/isolated-server');
const {compile}=require('./helpers/compile');
const {readPackage,savedTrace}=require('./helpers/deck-package');
const code='#include <vector>\nint main(){std::vector<int> a={4,1};\n// @frame a\na[0]=a[1];\n// @frame a\n}';
const launch=()=>chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
test('missing editor results rebuild from legacy ID or portable metadata; empty new editors never run',{timeout:60000},async t=>{
 const {base}=await startIsolatedServer(t);const browser=await launch();t.after(()=>browser.close());const p=await browser.newPage();let jobs=0;
 p.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/api/compile/jobs'))jobs++;});
 await p.goto(base+'/algorithm.html?asmEmbed=editor');await p.waitForFunction(()=>window.ASMTraceProvenance.generationFingerprint);
 await p.waitForTimeout(250);assert.equal(jobs,0);
 for(const portable of [false,true]){
  const animation={mode:'trace',code,input:'',traceRef:'f'.repeat(64),traceView:{studio:{codePanelFontSize:23,eventSettings:{autoFixedEnabled:false,readHighlightEnabled:false}}},...(portable?{rebuild:{view:{studio:{codePanelFontSize:23,eventSettings:{autoFixedEnabled:false,readHighlightEnabled:false}},rules:[],skins:{}},globals:{}}}:{})};
  await p.evaluate(a=>{asmReplaceEditorCode(a.code,-1);ASMTraceEditor.loadAnimation(a);},animation);
  await p.waitForFunction(()=>document.querySelector('#traceFreshnessNotice').dataset.status==='current');
  const saved=await p.evaluate(()=>ASMTraceEditor.snapshot().traceDocument);assert.ok(saved.frames.length);assert.equal(saved.studio.codePanelFontSize,23);assert.equal(saved.studio.eventSettings.readHighlightEnabled,false);
 }
 assert.equal(jobs,2);
});
test('export repairs an unseen stale animation and names the failing page when repair fails',{timeout:60000},async t=>{
 const {base}=await startIsolatedServer(t);process.env.ASM_TEST_BASE_URL=base;const {trace}=await compile(code);trace.provenance.generationFingerprint='a'.repeat(64);
 const browser=await launch();t.after(()=>browser.close());const p=await browser.newPage();let jobs=0;
 p.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/api/compile/jobs'))jobs++;});
 await p.addInitScript(({code,trace})=>{localStorage.setItem('asm_reveal_fabric_deck_v5',JSON.stringify({groups:[{id:'g',slides:[{id:'blank',kind:'fabric',objects:[]},{id:'animation',kind:'algorithm-animation',animation:{mode:'trace',code,input:'',sliceMode:'manual',traceDocument:trace}}]}]}));},{code,trace});
 await p.goto(base+'/slides.html');await p.waitForFunction(()=>window.Reveal?.isReady());await p.waitForTimeout(200);assert.equal(jobs,0,'an unseen animation is not eagerly executed');
 let rejectNext=true;await p.route('**/api/compile/jobs',route=>{if(rejectNext){rejectNext=false;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'export test unavailable'})});}return route.continue();});
 await p.locator('#exportDeckBtn').click();await p.waitForFunction(()=>document.querySelector('#cloudSaveStatus').textContent.includes('第 2 頁'));assert.equal(jobs,1);
 const downloaded=p.waitForEvent('download');await p.locator('#exportDeckBtn').click();const download=await downloaded;const bytes=fs.readFileSync(await download.path());const body=readPackage(bytes).body;const animation=body.deck.groups[0].slides[1].animation;
 assert.ok(animation.traceRef);assert.equal(animation.traceDocument,undefined);assert.equal(jobs,2);
 const saved=await p.evaluate(async id=>{const store=ASMSlideStorage.create(indexedDB,localStorage);return store.loadTrace(id);},animation.traceRef);
 const version=await (await fetch(base+'/api/trace/version')).json();assert.equal(saved.provenance.generationFingerprint,version.generationFingerprint);
});
test('slide focus rechecks version; Merge Sort saved and manual results agree and frame 21 fits',{timeout:90000},async t=>{
 const {base}=await startIsolatedServer(t);const browser=await launch();t.after(()=>browser.close());const p=await browser.newPage();let versions=0;
 p.on('request',r=>{if(r.url().endsWith('/api/trace/version'))versions++;});
 await p.goto(base+'/slides.html?sample=merge-sort');await p.waitForFunction(()=>window.Reveal?.isReady()&&document.body.classList.contains('sample-deck-ready'));await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await p.evaluate(()=>Reveal.slide(7,3));await p.waitForFunction(()=>document.querySelector('iframe[data-slide-id]')?.contentWindow?.ASMTracePlayer?.isActive());
 const before=versions;await p.evaluate(()=>window.dispatchEvent(new Event('focus')));await p.waitForTimeout(300);assert.ok(versions>before,'parent slide checks again without reloading');
 const body=readPackage(fs.readFileSync('public/guest-decks/merge-sort.asmdeck')).body;
 for(const slide of body.deck.groups.flatMap(g=>g.slides).filter(s=>s.animation)){
  const animation=slide.animation;const saved=savedTrace(body,animation);animation.traceDocument=saved;
  const result=await p.evaluate(async a=>{const w=document.querySelector('iframe[data-slide-id]').contentWindow;w.asmReplaceEditorCode(a.code,-1);w.document.getElementById('inputArea').value=a.input;w.ASMTraceEditor.loadAnimation(a,{openStudio:false});const config=await w.ASMTraceEditor.getCompileConfig(a.code);const r=await w.fetch('/compile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:a.code,input:a.input,trace:config,refreshTrace:true})});return r.json();},animation);
  assert.ok(result.traceDocument,result.error);const keys=['state','events','source','camera'];assert.equal(saved.frames.length,result.traceDocument.frames.length);
  for(let i=0;i<saved.frames.length;i++)for(const key of keys)assert.deepEqual(result.traceDocument.frames[i][key],saved.frames[i][key],`${slide.id} frame ${i+1} ${key}`);
  // Only auto capture promises to include the whole scene. Explicit focus is intentionally a close-up.
  const geometry=await p.evaluate(async()=>{const w=document.querySelector('iframe[data-slide-id]').contentWindow;await w.ASMTracePlayer.renderStable(20);await new Promise(r=>setTimeout(r,50));const d=w.ASMTracePlayer.getDocument(),rule=w.ASMTraceCamera.ruleForFrame(d,d.frames[20]),svg=w.document.getElementById('arraySvg').getBoundingClientRect();const nodes=[...w.document.querySelectorAll('#asm-trace-root rect.outerframe-bg')].filter(e=>getComputedStyle(e).visibility!=='hidden').map(e=>e.getBoundingClientRect());return{rule,top:Math.min(...nodes.map(r=>r.top))-svg.top,bottom:svg.bottom-Math.max(...nodes.map(r=>r.bottom))};});
  if(!geometry.rule?.target)assert.ok(geometry.top>=19&&geometry.bottom>=19,JSON.stringify(geometry));
 }
});
test('local camera modifier explains frame 21 crop and reset restores auto fit without changing trace',{timeout:30000},async t=>{
 const {base}=await startIsolatedServer(t),browser=await launch();t.after(()=>browser.close());const p=await browser.newPage();
 const body=readPackage(fs.readFileSync('public/guest-decks/merge-sort.asmdeck')).body;const animation=body.deck.groups.flatMap(g=>g.slides).find(s=>s.animation).animation;animation.traceDocument=savedTrace(body,animation);
 await p.goto(base+'/algorithm.html?asmEmbed=runtime');await p.evaluate(async a=>{asmReplaceEditorCode(a.code,-1);document.getElementById('inputArea').value=a.input;ASMTraceEditor.loadAnimation(a,{openStudio:false});await ASMTracePlayer.renderStable(20);},animation);
 await p.waitForFunction(()=>document.querySelector('#traceFreshnessNotice').dataset.status==='current');
 await p.evaluate(()=>{ASMLocalCamera.write('test-camera:playback',{zoomFactor:1.1,panXRatio:.01,panYRatio:-.01});ASMLocalCamera.write('other-camera:playback',{zoomFactor:1.7});setLocalCameraSurface('test-camera');});
 assert.ok(await p.locator('#temporaryCameraResetBtn').isVisible());assert.match(await p.locator('#temporaryCameraResetBtn').textContent(),/110%/);
 const measure=()=>p.evaluate(()=>{const svg=document.getElementById('arraySvg').getBoundingClientRect();const nodes=[...document.querySelectorAll('#asm-trace-root rect.outerframe-bg')].map(e=>e.getBoundingClientRect());return{top:Math.min(...nodes.map(r=>r.top))-svg.top,bottom:svg.bottom-Math.max(...nodes.map(r=>r.bottom))};});
 const cropped=await measure();assert.ok(cropped.top<0||cropped.bottom<0,JSON.stringify(cropped));
 await p.locator('#temporaryCameraResetBtn').click();assert.equal(await p.locator('#temporaryCameraResetBtn').isVisible(),false);
 const fit=await measure();assert.ok(fit.top>=19&&fit.bottom>=19,JSON.stringify(fit));assert.equal(await p.evaluate(()=>ASMLocalCamera.read('other-camera:playback').zoomFactor),1.7);
 assert.equal(await p.evaluate(()=>ASMTraceEditor.getTraceDocument().frames.length),83);assert.equal(await p.locator('#traceFreshnessNotice').getAttribute('data-status'),'current');
});
