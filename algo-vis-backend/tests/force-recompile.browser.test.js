'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const path=require('node:path');const {chromium}=require('playwright');
const {startIsolatedServer}=require('./helpers/isolated-server');
test('normal RUN caches binaries, force remains API-only and removed shortcuts submit nothing',{timeout:90000},async t=>{
 const preload=path.join(__dirname,'fixtures/count-compiler-spawns.cjs');
 const {base,logs}=await startIsolatedServer(t,{NODE_OPTIONS:`--require ${JSON.stringify(preload)}`});
 const launches=()=> (logs.join('').match(/ASM_TEST_COMPILER_SPAWN/g)||[]).length;
 const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());
 const page=await browser.newPage();await page.goto(base+'/algorithm.html');await page.waitForFunction(()=>document.body.dataset.defaultAnimationCache==='stored');
 assert.equal(await page.locator('#forceRunBtn').count(),0);
 const code='#include <iostream>\nint main(){int n;std::cin>>n;\n// @frame n\nstd::cout<<n;}';
 await page.evaluate(code=>{aceEditor.setValue(code,-1);document.querySelector('#inputArea').value='17';},code);
 const requests=[];page.on('request',r=>{if(new URL(r.url()).pathname==='/compile')requests.push(r.postDataJSON());});
 async function run(action){await page.evaluate(()=>{window.__runDone=false;window.addEventListener('asm:compile-finished',()=>window.__runDone=true,{once:true});});const pending=page.waitForResponse(r=>new URL(r.url()).pathname==='/compile');await action();const response=await pending,result=await response.json();await page.waitForFunction(()=>window.__runDone);assert.equal(result.output.trim(),'17');assert.equal(result.error,'');assert.equal(requests.at(-1).forceRecompile,undefined);return requests.at(-1);}
 const sent=await run(()=>page.click('#runBtn'));assert.equal(launches(),1);await run(()=>page.click('#runBtn'));assert.equal(launches(),1);
 const forced=await page.request.post(base+'/compile',{data:{...sent,forceRecompile:true,cachePolicy:'shared'}});assert.equal(forced.status(),200);assert.equal(forced.headers()['x-compile-executable-cache'],'BYPASS');assert.equal((await forced.json()).output.trim(),'17');assert.equal(launches(),2);
 await page.evaluate(()=>aceEditor.focus());const before=requests.length;await page.keyboard.press('Control+Shift+Enter');await page.keyboard.press('Meta+Shift+Enter');await page.waitForTimeout(150);assert.equal(requests.length,before);await page.evaluate(code=>aceEditor.setValue(code,-1),code);await run(()=>page.keyboard.press('Control+Enter'));assert.equal(launches(),2);
 assert.equal(await page.locator('#runBtn').isEnabled(),true);
});