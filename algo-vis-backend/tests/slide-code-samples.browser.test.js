'use strict';
const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const{chromium}=require('playwright'),{startIsolatedServer}=require('./helpers/isolated-server'),{readPackage}=require('./helpers/deck-package');
const{canonical,digest}=require('../scripts/build/export-slide-code-samples');
test('slide code samples expose named programs and matching inputs without compiling animations',{timeout:60000},async t=>{
 const{base}=await startIsolatedServer(t),manifest=JSON.parse(fs.readFileSync('algorithm_sample/Slide_Examples/.manifest.json','utf8'));
 const response=await fetch(base+'/api/samples');assert.equal(response.status,200);const tree=await response.json();
 const flatten=items=>items.flatMap(item=>[item,...flatten(item.children||[])]),items=flatten(tree),byPath=new Map(items.map(item=>[item.path,item]));
 assert.equal(byPath.get('Slide_Examples').displayName,'投影片範例');assert.ok(!items.some(item=>item.name==='.manifest.json'));
 const decks=new Map(require('../public/guest-decks.json').decks.map(entry=>[entry.id,readPackage(fs.readFileSync('public'+entry.archive)).body.deck]));
 let animations=0,inputs=0;
 for(const entry of manifest.entries){
  assert.match(entry.path,/^[A-Za-z0-9_/-]+\.cpp$/);assert.equal(byPath.get(entry.path).displayName,entry.title);
  const program=await fetch(base+'/api/samples?filename='+encodeURIComponent(entry.path));assert.equal(program.status,200);const code=canonical(await program.text());assert.equal(digest(code),entry.codeSha256);
  const slides=decks.get(entry.sourceDeckId).groups.flatMap(g=>g.slides||[]);
  for(const origin of entry.slides){const slide=slides.find(s=>s.id===origin.slideId);assert.ok(slide?.animation);assert.equal(code,canonical(slide.animation.code));const input=await fetch(base+'/api/samples?filename='+encodeURIComponent(origin.inputPath));assert.equal(input.status,200);assert.equal(canonical(await input.text()),canonical(slide.animation.input));animations++;}
  inputs+=entry.inputs.length;
 }
 assert.equal(animations,36);assert.equal(manifest.entries.length,29);assert.equal(inputs,36);
 const old=items.find(item=>item.type==='file'&&item.name.endsWith('.cpp')&&!item.path.startsWith('Slide_Examples/'));assert.ok(old);assert.equal((await fetch(base+'/api/samples?filename='+encodeURIComponent(old.path))).status,200);
 const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));let compileRequests=0;page.on('request',request=>{if(new URL(request.url()).pathname==='/compile')compileRequests++;});
 await page.goto(base+'/algorithm.html');await page.waitForFunction(()=>window.ace&&window.asmReplaceEditorCode);await page.evaluate(()=>window.ASMDefaultAlgorithm?.cancel?.('sample-library-test'));
 await page.click('#algoSamplesBtn');await page.getByText('投影片範例',{exact:true}).click();await page.getByText('排序',{exact:true}).click();
 const entry=manifest.entries.find(e=>e.path.endsWith('/merge-sort-recursive.cpp'));const wrapper=page.locator('.code-wrapper').filter({has:page.getByText(entry.title,{exact:true})});await wrapper.locator('.code-file').click();
 const expected=canonical(fs.readFileSync(path.join('algorithm_sample',entry.path),'utf8'));
 await page.waitForFunction(expected=>ace.edit('editor').getValue().replace(/\r\n?/g,'\n')===expected,expected);
 assert.equal(await wrapper.locator('.input-item').count(),2);await wrapper.locator('.input-item').filter({hasText:'測資 2'}).click();
 const input=fs.readFileSync(path.join('algorithm_sample',entry.inputs[1].path),'utf8');await page.waitForFunction(input=>document.getElementById('inputArea').value===input,input);
 await page.reload();await page.waitForFunction(()=>window.ace&&window.asmReplaceEditorCode);await page.evaluate(()=>window.ASMDefaultAlgorithm?.cancel?.('sample-library-test'));
 await page.waitForFunction(expected=>ace.edit('editor').getValue().replace(/\r\n?/g,'\n')===expected,expected);assert.equal(await page.inputValue('#inputArea'),input);
 assert.equal(compileRequests,0,'reading the sample library never compiles programs');assert.deepEqual(errors,[]);
});
