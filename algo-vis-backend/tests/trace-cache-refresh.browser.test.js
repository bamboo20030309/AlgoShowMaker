'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const {startIsolatedServer}=require('./helpers/isolated-server'),{compile}=require('./helpers/compile');
const code=`#include <vector>
int main(){std::vector<int> a={4,1};
// @frame a
a[0]=a[1];
// @frame a
}
/* @asm-view
{"version":1,"studio":{"eventSettings":{"autoFixedEnabled":false,"autoLoopBoundaryEnabled":false,"readHighlightEnabled":false},"codePanelFontSize":19}}
@asm-view */`;
test('old cached sample animation shows red, never renders before refresh, and saves new ID', {timeout:60000},async t=>{
 const {base}=await startIsolatedServer(t);process.env.ASM_TEST_BASE_URL=base;
 const {trace:compiled}=await compile(code);const trace=JSON.parse(JSON.stringify(compiled));
 trace.provenance.generationFingerprint='a'.repeat(64);
 const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({trace,code})=>{
  if(sessionStorage.seeded)return;
  localStorage.setItem('asm_reveal_fabric_deck_v5',JSON.stringify({groups:[{id:'g',slides:[{id:'a',kind:'algorithm-animation',animation:{mode:'trace',code,input:'',sliceMode:'manual',watches:[],traceDocument:trace}}]}]}));sessionStorage.seeded='1';
 },{trace,code});
 let release;const gate=new Promise(r=>release=r);let submitted=0;
 await page.route('**/api/compile/jobs',async route=>{submitted++;await gate;
  if(submitted===1)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'test temporary failure'})});
  await route.continue();
 });
 await page.goto(base+'/slides.html');
 await page.waitForFunction(()=>document.querySelector('#cloudSaveStatus')?.dataset.traceState==='updating');
 await page.waitForFunction(()=>!!document.querySelector('iframe.algorithm-slide-frame'));
 const {studio,skins,rules,...oldBody}=trace;
 const storage=require('../public/slides-storage');
 const oldID=await storage.digest(storage.canonical(oldBody));
 assert.ok(oldID);
 assert.equal(await page.locator('#cloudSaveStatus .cloud-status-dot').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 59, 48)');
 assert.equal(await page.locator('iframe.algorithm-slide-frame').evaluate(f=>!!f.contentDocument?.querySelector('#asm-trace-root [data-trace-variable]')),false,'old result must not flash before refresh');
 release();
 await page.waitForFunction(()=>document.querySelector('#cloudSaveStatus')?.dataset.traceState==='error');
 assert.equal(submitted,1);assert.equal(await page.locator('#cloudSaveStatus .cloud-status-dot').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 59, 48)');
 await page.locator('.trace-refresh-retry').click();
 await page.waitForFunction(()=>document.querySelector('#cloudSaveStatus')?.dataset.traceState==='',null,{timeout:30000});
 await page.waitForFunction(()=>document.body.dataset.localDeckSave==='saved');
 const read=()=>page.evaluate(()=>ASMSlideStorage.create(indexedDB,localStorage).loadDeck('asm_reveal_fabric_deck_v5',[],{lazyTraces:true}));
 const updated=await read(),animation=updated.groups[0].slides[0].animation;
 assert.notEqual(animation.traceRef,oldID);assert.equal(animation.code,code);assert.equal(animation.traceDocument,undefined);
 const saved=await page.evaluate(async key=>ASMSlideStorage.create(indexedDB,localStorage).loadTrace(key),animation.traceRef);
 const version=await(await fetch(base+'/api/trace/version')).json();
 assert.equal(saved.provenance.generationFingerprint,version.generationFingerprint);
 assert.equal(animation.traceView.studio.eventSettings.readHighlightEnabled,false);
 assert.equal(animation.traceView.studio.codePanelFontSize,19);assert.equal(submitted,2);
 assert.equal(await page.locator('.algorithm-slide-placeholder').evaluate(e=>e.hidden),true);
 await page.reload();await page.waitForFunction(()=>window.Reveal?.isReady());
 await page.waitForFunction(()=>document.querySelector('iframe.algorithm-slide-frame')?.contentDocument?.querySelector('#asm-trace-root [data-trace-variable]'));
 assert.equal((await read()).groups[0].slides[0].animation.traceRef,animation.traceRef);assert.equal(submitted,2,'reopen uses current result without another job');
 assert.deepEqual(errors,[]);
});
