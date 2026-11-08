'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {startIsolatedServer}=require('./helpers/isolated-server');
const {compile}=require('./helpers/compile');
const code='#include <vector>\nint main(){std::vector<int> a={4,1};\n// @frame a\na[0]=a[1];\n// @frame a\n}';
test('standalone and editor refresh stale traces, retry failure, preserve settings and reject superseded results',{timeout:90000},async t=>{
 const {base}=await startIsolatedServer(t);process.env.ASM_TEST_BASE_URL=base;
 const {trace}=await compile(code);
 trace.provenance.generationFingerprint='a'.repeat(64);
 trace.studio={...trace.studio,codePanelFontSize:19,eventSettings:{autoFixedEnabled:false,readHighlightEnabled:false}};
 const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());
 for(const embedded of [false,true]){
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/algorithm.html'+(embedded?'?asmEmbed=editor':''));
  if(!embedded)await page.waitForFunction(()=>document.body.dataset.defaultAnimationState==='ready');
  await page.waitForFunction(()=>window.ASMTraceFreshness&&window.ASMTraceProvenance.generationFingerprint);
  let release;let gate=new Promise(r=>release=r),jobs=0;
  await page.route('**/api/compile/jobs',async route=>{jobs++;await gate;if(jobs===1)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'test unavailable'})});return route.continue();});
  const load=()=>page.evaluate(({code,trace})=>{asmReplaceEditorCode(code,-1);document.getElementById('inputArea').value='';ASMTraceEditor.loadAnimation({mode:'trace',code,input:'',traceDocument:trace});},{code,trace});
  await load();await page.waitForFunction(()=>document.body.classList.contains('asm-trace-outdated'));
  assert.equal(await page.locator('#traceFreshnessNotice').getAttribute('data-status'),'outdated');
  release();await page.waitForFunction(()=>document.querySelector('#traceFreshnessNotice').title.includes('更新失敗'));
  assert.ok(await page.locator('#debugArea').textContent().then(s=>s.includes('test unavailable')));
  await page.locator('#traceFreshnessNotice').click();
  await page.waitForFunction(()=>document.querySelector('#traceFreshnessNotice').dataset.status==='current');
  const saved=await page.evaluate(()=>ASMTraceEditor.snapshot().traceDocument);
  assert.notEqual(saved.provenance.generationFingerprint,'a'.repeat(64));assert.equal(saved.studio.eventSettings.readHighlightEnabled,false);assert.equal(saved.studio.codePanelFontSize,19);assert.equal(jobs,2);
  if(!embedded){await page.reload();assert.equal(await page.evaluate(()=>ASMTraceProvenance.sourceText(aceEditor.getValue())),code);}
  await page.evaluate(({code,saved})=>ASMTraceEditor.loadAnimation({mode:'trace',code,input:'',traceDocument:saved}),{code,saved});
  await page.waitForFunction(()=>document.querySelector('#traceFreshnessNotice').dataset.status==='current');assert.equal(jobs,2,'reopening saved result needs no extra job');
  // Another outdated load starts a new job; editing while it waits invalidates that result.
  gate=new Promise(r=>release=r);await load();await page.waitForFunction(()=>document.body.classList.contains('asm-trace-outdated'));
  await page.waitForFunction(()=>!!window.ASMTraceEditor.getTraceDocument());
  await new Promise(r=>setTimeout(r,250));
  await page.evaluate(()=>aceEditor.setValue(aceEditor.getValue()+'\n// user edit',-1));release();
  await page.waitForFunction(()=>document.querySelector('#traceFreshnessNotice').dataset.status==='dirty');
  await new Promise(r=>setTimeout(r,1800));assert.ok(await page.evaluate(()=>aceEditor.getValue().endsWith('// user edit')));
  assert.deepEqual(errors,[]);await page.close();
 }
});
