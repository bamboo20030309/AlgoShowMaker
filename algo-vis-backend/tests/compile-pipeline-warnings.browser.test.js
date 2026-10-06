'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const {chromium}=require('playwright');const {startIsolatedServer}=require('./helpers/isolated-server');
test('RUN reports syntax, analysis, trace and drawing failures without hiding them behind successful output',{timeout:120000},async t=>{
 const {base}=await startIsolatedServer(t);const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/algorithm.html');await page.waitForFunction(()=>document.body.dataset.defaultAnimationCache==='stored');
 const good='#include <iostream>\nint main(){int n=1;\n// @frame n\nstd::cout<<n;}';
 async function run(code=good){await page.evaluate(code=>{aceEditor.setValue(code,-1);window.__runDone=false;window.addEventListener('asm:compile-finished',()=>window.__runDone=true,{once:true});document.querySelector('#runBtn').click();},code);await page.waitForFunction(()=>window.__runDone,{},{timeout:60000});return page.locator('#compileWarnings').textContent();}
 async function expectNotice(pattern){assert.match(await page.locator('#compileWarnings').textContent(),pattern);assert.equal(await page.locator('#compileWarnings').isVisible(),true);await page.click('[data-tab="tab-canvas"]');assert.equal(await page.locator('#compileWarnings').isVisible(),true);}
 await run();assert.equal(await page.locator('#compileWarnings').isVisible(),false);
 await page.route('**/syntax-tree',route=>route.fulfill({status:503,json:{error:'語法樹服務暫時無法使用'}}),{times:1});await run();await expectNotice(/語法樹.*服務暫時無法使用/);assert.equal((await page.locator('#outputArea').textContent()).trim(),'1');
 await page.route('**/syntax-tree',async route=>{const response=await route.fetch(),payload=await response.json();payload.root.children.push({id:'test-error',type:'Error',line:2,text:'?',depth:1,children:[]});await route.fulfill({response,json:payload});},{times:1});await run();await expectNotice(/語法樹.*第 2 行/);
 await run(good.replace('// @frame n','// @frame n\n// @object missing'));await expectNotice(/追蹤分析[\s\S]*missing[\s\S]*本次不會建立動畫/);assert.equal((await page.locator('#outputArea').textContent()).trim(),'1');assert.equal(await page.evaluate(()=>ASMTracePlayer.getDocument()),null);
 await page.route('**/compile',route=>route.fulfill({status:200,json:{output:'1',error:'',traceWarning:'動畫插樁失敗：測試原因',traceDocument:null}}),{times:1});await run();await expectNotice(/動畫解析.*測試原因/);
 await page.route('**/compile',route=>route.fulfill({status:200,json:{output:'1',error:'',traceDocument:null}}),{times:1});await run();await expectNotice(/動畫資料.*沒有回傳動畫/);
 await page.evaluate(()=>{window.__applyBeforeWarningTest=ASMTraceEditor.applyTraceDocument;ASMTraceEditor.applyTraceDocument=()=>{throw new Error('無法繪製指定物件');};});await run();await expectNotice(/動畫載入／繪製.*無法繪製指定物件/);assert.equal(await page.evaluate(()=>ASMTracePlayer.getDocument()),null);await page.evaluate(()=>ASMTraceEditor.applyTraceDocument=window.__applyBeforeWarningTest);
 await page.route('**/compile',route=>route.fulfill({status:200,json:{output:'1',error:'',scriptContent:'throw new Error("舊動畫腳本解析失敗")'}}),{times:1});await run();await expectNotice(/動畫腳本.*舊動畫腳本解析失敗/);
 await page.route('**/compile',route=>route.fulfill({status:200,contentType:'application/json',body:'{'}),{times:1});await run();await expectNotice(/編譯請求/);
 await run();assert.equal(await page.locator('#compileWarnings').isVisible(),false);
 const kmp=fs.readFileSync(require('node:path').join(__dirname,'fixtures/kmp-source-newlines.cpp'),'utf8');await run(kmp);await page.evaluate(()=>ASMTracePlayer.renderStable(3));await expectNotice(/事件動畫[\s\S]*畫面目標[\s\S]*s\[i\]/);
 await page.screenshot({path:'test-results/compile-pipeline-warning.png'});
 assert.deepEqual(errors,[]);
});