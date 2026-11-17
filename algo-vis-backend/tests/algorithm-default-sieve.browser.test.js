// 預設配方執行與舊 SVG 快照隔離；執行檔快取另見 executable-only-*。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { startIsolatedServer } = require('./helpers/isolated-server');

test('authored draft is preserved instead of being replaced by cached default', { timeout:30000 }, async t=>{
 const {base}=await startIsolatedServer(t);const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());
 const page=await browser.newPage();let defaults=0;
 await page.addInitScript(()=>sessionStorage.setItem('asm_algorithm_draft_v2:page:%2Falgorithm.html:standalone',JSON.stringify({version:2,code:'int main(){return 7;}',input:'custom',cursor:{row:0,column:5}})));
 page.on('request',r=>{if(r.url().includes('/default-animation/'))defaults++;});
 await page.goto(base+'/algorithm.html');
 assert.equal(await page.evaluate(()=>asmGetSourceCode()),'int main(){return 7;}');assert.equal(await page.locator('#inputArea').inputValue(),'custom');assert.equal(defaults,0);
});

test('default Trace loads without compilation even while retired cache cleanup is pending', { timeout:60000 }, async t=>{
 const {base}=await startIsolatedServer(t);const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());
 const page=await browser.newPage();let compilations=0;
 await page.route('**/asmdeck.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text())+'\nASMDeck.clearCache = () => new Promise(() => {});'});});
 await page.route('**/api/compile/jobs',route=>{compilations++;return route.abort();});
 const started=Date.now();await page.goto(base+'/algorithm.html');await page.waitForFunction(()=>document.body.dataset.defaultAnimationState==='ready');
 assert.equal(compilations,0);assert.equal(await page.locator('body').getAttribute('data-default-animation-source'),'prebuilt');
 assert.match(await page.locator('#frameInfo').innerText(),/1\s*\/\s*116/);assert.match(await page.evaluate(()=>asmGetSourceCode()),/Euler.*Sieve/);
 console.log('Prebuilt default ready in '+(Date.now()-started)+'ms');
});

test('missing or expired default cache falls back to execution', { timeout:90000 }, async t=>{
 const {base}=await startIsolatedServer(t);const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());
 for(const kind of ['missing','expired']){
  const page=await browser.newPage();let compilations=0;
  page.on('request',r=>{if(r.url().endsWith('/api/compile/jobs'))compilations++;});
  await page.route('**/default-animation/cached.json',async route=>{
   if(kind==='missing')return route.fulfill({status:404,body:'missing'});
   const response=await route.fetch();const manifest=await response.json();manifest.engineVersion='1/1';await route.fulfill({response,json:manifest});
  });
  await page.goto(base+'/algorithm.html');await page.waitForFunction(()=>document.body.dataset.defaultAnimationState==='ready');
  assert.equal(await page.locator('body').getAttribute('data-default-animation-source'),'executed');assert.equal(compilations,1);
  assert.match(await page.locator('#frameInfo').innerText(),/1\s*\/\s*116/);await page.close();
 }
});

test('standalone startup and timeline scrubbing never restore retired demo arrows', { timeout:60000 }, async t=>{
 const {base}=await startIsolatedServer(t);const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());const page=await browser.newPage();const errors=[],legacyRequests=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/code_script.js*',route=>{legacyRequests.push(route.request().url());return route.abort();});
 await page.goto(base+'/algorithm.html');await page.waitForFunction(()=>document.body.dataset.defaultAnimationState==='ready');
 assert.equal(await page.evaluate(()=>window.CodeScript?.isTracePlayer),true);assert.match(await page.evaluate(()=>ace.edit('editor').getValue()),/isprime/);
 await page.evaluate(()=>{window.__legacySnapshotRestores=0;FrameSnapshotCache.restore=()=>{window.__legacySnapshotRestores++;const layer=document.createElementNS('http://www.w3.org/2000/svg','g');layer.id='retired-demo-arrows';layer.innerHTML='<path d="M0 0L10 10"/><path d="M0 10L10 0"/>';getViewport().append(layer);return true;};});
 const box=await page.locator('#frameTimeline').boundingBox();assert.ok(box&&box.width>0);await page.mouse.move(box.x+1,box.y+box.height/2);await page.mouse.down();for(const fraction of [.2,.7,.4,.95])await page.mouse.move(box.x+box.width*fraction,box.y+box.height/2);await page.mouse.up();
 assert.equal(await page.evaluate(()=>window.__legacySnapshotRestores),0);assert.equal(await page.locator('#retired-demo-arrows').count(),0);assert.equal(await page.evaluate(()=>CodeScript.isTracePlayer),true);
 await page.reload();await page.waitForFunction(()=>document.body.dataset.defaultAnimationState==='ready');assert.equal(await page.evaluate(()=>CodeScript.isTracePlayer),true);assert.match(await page.evaluate(()=>ace.edit('editor').getValue()),/isprime/);assert.equal(legacyRequests.length,0);assert.deepEqual(errors,[]);
});
