'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {startIsolatedServer}=require('./helpers/isolated-server');
test('an external Trace applied before default initialization prevents the builtin from replacing it', {timeout:60000},async t=>{
  const {base}=await startIsolatedServer(t);
  const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
  t.after(()=>browser.close());
  const page=await browser.newPage(),errors=[],downloads=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(r.url().includes('/default-animation/'))downloads.push(r.url());});
  // This listener is registered before front.js registers its default loader.
  // It deliberately leaves Ace untouched: Trace application itself is user intent.
  await page.addInitScript(()=>document.addEventListener('DOMContentLoaded',()=>{
    ASMTracePlayer.apply({sourceCode:'int main(){return 42;}',variables:{},
      frames:[{id:'external-frame',state:{},events:[],objects:[]}]});
  },{once:true}));
  await page.goto(base+'/algorithm.html');
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(()=>ASMTracePlayer.getDocument().sourceCode),'int main(){return 42;}');
  assert.equal(await page.evaluate(()=>ASMTracePlayer.getDocument().frames[0].id),'external-frame');
  assert.deepEqual(downloads,[],'a cancelled default must not start downloads later');
  assert.deepEqual(errors,[]);
});
