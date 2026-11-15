'use strict';
const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const{chromium}=require('playwright'),{startIsolatedServer}=require('./helpers/isolated-server'),{readPackage}=require('./helpers/deck-package');
const{canonical,digest}=require('../scripts/build/export-slide-code-samples');
test('slide code samples expose named programs and matching inputs without compiling animations',{timeout:60000},async t=>{
 const{base}=await startIsolatedServer(t),manifest=JSON.parse(fs.readFileSync('algorithm_sample/.slide-samples.json','utf8'));
 const response=await fetch(base+'/api/samples');assert.equal(response.status,200);const tree=await response.json();
 const flatten=items=>items.flatMap(item=>[item,...flatten(item.children||[])]),items=flatten(tree),byPath=new Map(items.map(item=>[item.path,item]));
 assert.ok(!byPath.has('Slide_Examples'));assert.ok(!items.some(item=>item.name.startsWith('.')));for(const item of items.filter(i=>i.type==='file')){assert.match(item.name,/^[A-Za-z0-9_.-]+$/);assert.equal(item.displayName,undefined);}
 const retired=['Backtracking/eight_queens_array_recursion.cpp','Backtracking/eight_queens_loop.cpp','Backtracking/hanoi_recursion.cpp','DP/lcs_table.cpp'];for(const name of retired){assert.ok(!byPath.has(name));assert.ok(!byPath.has(name.replace(/\.cpp$/,'-sample_input.txt')));}for(const name of ['Backtracking/8queen_array_teaching.cpp','Backtracking/8queen_loop_teaching.cpp','Backtracking/hanoi.cpp','DP/LCS.cpp'])assert.ok(byPath.has(name));assert.equal(items.filter(i=>i.name?.endsWith('.cpp')).length,53);
 const decks=new Map(require('../public/guest-decks.json').decks.map(entry=>[entry.id,readPackage(fs.readFileSync('public'+entry.archive)).body.deck]));
 let animations=0,inputs=0;
 for(const entry of manifest.entries){
  assert.match(entry.path,/^[A-Za-z0-9_/-]+\.cpp$/);assert.equal(byPath.get(entry.path).name,path.basename(entry.path));assert.ok(!path.basename(entry.path).includes('-'));
  const program=await fetch(base+'/api/samples?filename='+encodeURIComponent(entry.path));assert.equal(program.status,200);const code=canonical(await program.text());assert.equal(digest(code),entry.codeSha256);
  const slides=decks.get(entry.sourceDeckId).groups.flatMap(g=>g.slides||[]);
  for(const origin of entry.slides){const slide=slides.find(s=>s.id===origin.slideId);assert.ok(slide?.animation);assert.equal(code,canonical(slide.animation.code));const input=await fetch(base+'/api/samples?filename='+encodeURIComponent(origin.inputPath));assert.equal(input.status,200);assert.equal(canonical(await input.text()),canonical(slide.animation.input));animations++;}
  inputs+=entry.inputs.length;
 }
 for(const legacy of manifest.legacyUnconverted){assert.ok(path.basename(legacy.to).startsWith('old_'));assert.ok(byPath.has(legacy.to));assert.ok(!byPath.has(legacy.from));}assert.equal(manifest.legacyUnconverted.length,9);assert.ok(!items.some(i=>i.name.endsWith('_slides.cpp')));
 assert.equal(animations,36);assert.equal(manifest.entries.length,29);assert.equal(inputs,36);
 const old=byPath.get('Sorting/quick_sort.cpp');assert.ok(old);assert.equal((await fetch(base+'/api/samples?filename='+encodeURIComponent(old.path))).status,200);
 const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));let compileRequests=0;page.on('request',request=>{if(['/compile','/api/compile/jobs'].includes(new URL(request.url()).pathname))compileRequests++;});
 await page.addInitScript(()=>{const key='asm_algorithm_draft_v2:page:%2Falgorithm.html:standalone';if(!sessionStorage.getItem(key))sessionStorage.setItem(key,JSON.stringify({version:2,code:'int main(){return 0;}',input:'',updatedAt:Date.now()}));});
 await page.goto(base+'/algorithm.html');await page.waitForFunction(()=>window.ace&&window.asmReplaceEditorCode);await page.evaluate(()=>window.ASMDefaultAlgorithm?.cancel?.('sample-library-test'));
 await page.click('#algoSamplesBtn');await page.getByText('Sorting',{exact:true}).click();
 const entry=manifest.entries.find(e=>e.path.endsWith('/merge_sort.cpp'));const wrapper=page.locator('.code-wrapper').filter({has:page.getByText(path.basename(entry.path),{exact:true})});await wrapper.locator('.code-file').click();
 const expected=canonical(fs.readFileSync(path.join('algorithm_sample',entry.path),'utf8'));
 await page.waitForFunction(expected=>ace.edit('editor').getValue().replace(/\r\n?/g,'\n')===expected,expected);
 const stem=path.basename(entry.path,'.cpp'),folder=path.dirname(entry.path);const matching=items.filter(i=>i.type==='file'&&i.name.endsWith('.txt')&&path.dirname(i.path)===folder&&i.name.split('-')[0]===stem);assert.equal(await wrapper.locator('.input-item').count(),matching.length);await wrapper.locator('.input-item').filter({hasText:'input_02.txt'}).click();
 const input=fs.readFileSync(path.join('algorithm_sample',entry.inputs[1].path),'utf8');await page.waitForFunction(input=>document.getElementById('inputArea').value===input,input);
 await page.reload();await page.waitForFunction(()=>window.ace&&window.asmReplaceEditorCode);await page.evaluate(()=>window.ASMDefaultAlgorithm?.cancel?.('sample-library-test'));
 await page.waitForFunction(expected=>ace.edit('editor').getValue().replace(/\r\n?/g,'\n')===expected,expected);assert.equal(await page.inputValue('#inputArea'),input);
 const names=['8queen.cpp','8queen_recursion.cpp','8Queen.cpp','8queen-sample_input.txt','8queen-input_02.txt','8queen_recursion-sample_input.txt','8queen_extra-sample_input.txt','8Queen-sample_input.txt','8queen_sample_input.txt','8queen.txt'];
 await page.route('**/api/samples',route=>route.fulfill({json:names.map(name=>({type:'file',name,path:name}))}));
 await page.reload();await page.waitForFunction(()=>window.ace&&window.asmReplaceEditorCode);await page.click('#algoSamplesBtn');
 const exact=page.locator('.code-wrapper').filter({has:page.getByText('8queen.cpp',{exact:true})});
 await exact.locator('.code-file').waitFor();assert.deepEqual(await exact.locator('.input-item').evaluateAll(nodes=>nodes.map(node=>node.title)),['8queen-sample_input.txt','8queen-input_02.txt']);
 const recursion=page.locator('.code-wrapper').filter({has:page.getByText('8queen_recursion.cpp',{exact:true})});assert.deepEqual(await recursion.locator('.input-item').evaluateAll(nodes=>nodes.map(node=>node.title)),['8queen_recursion-sample_input.txt']);
 assert.equal(compileRequests,0,'reading the sample library never compiles programs');assert.deepEqual(errors,[]);
});
