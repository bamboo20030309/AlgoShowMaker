'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const{chromium}=require('playwright'),{startIsolatedServer}=require('./helpers/isolated-server');
global.ASMTraceProvenance=require('../public/trace-provenance');const A=require('../public/asmdeck'),R=require('../public/animation-recipe');
const code='#include <iostream>\nusing namespace std;\nint main(){int a;cin>>a;\n// @frame a\ncout<<a;return 0;\n}';
test('slides prepare from the first animation despite navigation, continue on error, and execute again on reload',{timeout:120000},async t=>{
 const{base}=await startIsolatedServer(t);const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());const page=await browser.newPage(),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).pathname==='/api/compile/jobs')requests.push(JSON.parse(r.postData()).input);});
 const deck={groups:[{id:'g',slides:[1,2,3].map(n=>({id:'s'+n,kind:'algorithm-animation',animation:R.strip({mode:'trace',code:n===2?'int main(){ broken; }':code,input:String(n),traceView:{studio:{eventSettings:{autoFixedEnabled:false,readHighlightEnabled:false}}}})}))}]};
 const bytes=Buffer.from(await(await A.encode(await A.project(deck))).arrayBuffer());
 await page.route('**/guest-decks.json',route=>route.fulfill({json:{decks:[{id:'queue-test',title:'Queue test',archive:'/queue-test.asmdeck'}]}}));await page.route('**/queue-test.asmdeck',route=>route.fulfill({body:bytes,contentType:'application/octet-stream'}));
 await page.goto(base+'/slides.html?sample=queue-test#/0/2');
 await page.waitForFunction(()=>document.body.dataset.asmdeckLastImportStats&&JSON.parse(document.body.dataset.asmdeckLastImportStats).run===2,null,{timeout:90000});
 assert.deepEqual(requests,['1','2','3']);
 await page.reload();await page.waitForFunction(()=>document.body.dataset.asmdeckLastImportStats&&JSON.parse(document.body.dataset.asmdeckLastImportStats).run===2,null,{timeout:90000});assert.deepEqual(requests,['1','2','3','1','2','3']);assert.deepEqual(errors,[]);
});
