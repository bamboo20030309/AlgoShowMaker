// 預設配方執行與舊 SVG 快照隔離；執行檔快取另見 executable-only-*。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { startIsolatedServer } = require('./helpers/isolated-server');

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
