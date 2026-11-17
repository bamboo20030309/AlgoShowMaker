'use strict';
const{test}=require('node:test'),assert=require('node:assert/strict'),{chromium}=require('playwright'),{startIsolatedServer}=require('./helpers/isolated-server');
test('algorithm default executes the linear sieve on each opening without persistent Trace cache',{timeout:120000},async t=>{
 const{base}=await startIsolatedServer(t),browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());const page=await browser.newPage(),errors=[];let jobs=0,traceAssets=0;page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{const path=new URL(r.url()).pathname;if(path==='/api/compile/jobs')jobs++;if(path.endsWith('.asmtrace')||path.startsWith('/deck-traces/'))traceAssets++;});
 await page.goto(base+'/algorithm.html');await page.waitForFunction(()=>document.body.dataset.defaultAnimationState==='ready',null,{timeout:60000});assert.equal(jobs,1);assert.equal(traceAssets,0);assert.equal(await page.evaluate(()=>document.body.dataset.defaultAnimationSource),'executed');
 await page.reload();await page.waitForFunction(()=>document.body.dataset.defaultAnimationState==='ready',null,{timeout:60000});assert.equal(jobs,2);assert.equal(traceAssets,0);assert.deepEqual(errors,[]);
 const databases=await page.evaluate(()=>indexedDB.databases());assert.ok(!databases.some(db=>['asm-default-animation-cache','algoshowmaker-trace-cache-v1'].includes(db.name)));
});
