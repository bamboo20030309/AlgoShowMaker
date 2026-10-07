const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { startIsolatedServer } = require('./helpers/isolated-server');
global.ASMTraceProvenance = require('../public/trace-provenance');
global.ASMTraceViewSource = require('../public/trace-view-source');
global.ASMTraceModel = { normalizeTraceDocument: value => value };
const archive = require('../public/asmdeck');

test('sample copies use normal editing, persist locally and export edits without remote writes', { timeout: 90000 }, async t => {
  const { base } = await startIsolatedServer(t);
  const code = '#include <iostream>\nint main(){int n;std::cin>>n;\n// @frame n\nstd::cout<<n;}\n'
    + '/* @asm-view\n{"version":1,"rules":[],"skins":{},"studio":{"eventSettings":{"autoFixedEnabled":false},"codePanelFontSize":19}}\n@asm-view */';
  const compiled = await (await fetch(base+'/compile', {method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({code,input:'7',trace:{enabled:true}})})).json();
  assert.equal(compiled.error,'');
  // Existing objects without any new local-edit fields are intentionally used.
  const original = {groups:[{id:'sample-group',slides:[{id:'sample-animation',kind:'algorithm-animation',
    animation:{mode:'trace',code,input:'7',traceDocument:compiled.traceDocument},canvas:{objects:[]},widgets:[]}]}]};
  const projected = await archive.project(original);
  const blob = await archive.encode(projected);
  const buffer = Buffer.from(await blob.arrayBuffer());
  const browser = await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
  t.after(()=>browser.close());
  const context = await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
  for (const seed of projected.cacheSeeds.filter(seed => /^[a-f0-9]{64}$/.test(seed.key))) {
    await context.route('**/deck-traces/'+seed.key+'.json', route=>route.fulfill({json:seed.trace}));
  }
  const writes=[],errors=[];
  await context.route('**/guest-decks.json',route=>route.fulfill({json:{decks:[
    {id:'local-fixture',title:'本機測試範例',archive:'/fixture.asmdeck'},
    {id:'other-fixture',title:'另一個範例',archive:'/fixture.asmdeck'}]}}));
  await context.route('**/fixture.asmdeck',route=>route.fulfill({body:buffer,contentType:'application/octet-stream'}));
  await context.route('**/api/user/preferences/event-settings',route=>route.fulfill({json:{eventSettings:{}}}));
  context.on('request',r=>{if(!['GET','HEAD'].includes(r.method())&&!['/compile','/trace/analyze','/syntax-tree'].includes(new URL(r.url()).pathname)) writes.push(r.url());});
  await context.addInitScript(()=>localStorage.setItem('algo_jwt_token','fixture-token'));
  const page = await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/slides.html?sample=local-fixture');
  await page.waitForFunction(()=>document.body.dataset.asmdeckRebuild==='ready');
  assert.equal(await page.locator('#algorithmCodeEditSlideBtn').count(),0);
  const runtime=await (await page.waitForSelector('.algorithm-slide-frame')).contentFrame();
  assert.equal(await runtime.locator('.runtime-local-controls').count(),0);
  assert.equal(await runtime.locator('#codePanel').isVisible(),false);
  assert.equal(await page.locator('#modeToggleBtn').isVisible(),true);
  assert.equal(await page.locator('#sharedAccessBadge').textContent(),'範例本機副本');
  if(!await page.evaluate(()=>document.body.classList.contains('asm-edit-mode'))) await page.click('#modeToggleBtn');
  await page.click('#algorithmEditSlideBtn');
  const frame = await (await page.waitForSelector('#algorithmEditorFrame')).contentFrame();
  await frame.waitForFunction(()=>Boolean(ASMTracePlayer.getDocument()?.frames?.length));
  assert.ok(frame.url().includes('localOnly=1'));
  if (await frame.getByRole('button',{name:'返回程式碼',exact:true}).isVisible()) await frame.getByRole('button',{name:'返回程式碼',exact:true}).click();
  const changed=code.replace('std::cout<<n;','std::cout<<n+1;');
  await frame.evaluate(code=>{aceEditor.setValue(code,-1);document.getElementById('inputArea').value='23';},changed);
  await frame.click('#runBtn');
  await frame.waitForFunction(code=>ASMTracePlayer.getDocument()?.sourceCode===code&&!document.getElementById('runBtn').disabled,changed).catch(async error=>{ console.error(await frame.evaluate(()=>({code:aceEditor.getValue(),trace:ASMTracePlayer.getDocument()?.sourceCode,output:document.getElementById('outputArea').textContent,debug:document.getElementById('debugArea')?.textContent})));throw error; });
  assert.equal((await frame.locator('#outputArea').textContent()).trim(),'24');
  await frame.evaluate(()=>{const trace=ASMTracePlayer.getDocument();trace.studio.eventSettings.autoFixedEnabled=false;
    window.dispatchEvent(new CustomEvent('asm:trace-event-settings-changed',{detail:{document:trace}}));});
  await page.click('#saveAlgorithmEditorBtn');
  await page.waitForFunction(()=>document.getElementById('algorithmEditorModal').hidden&&document.body.dataset.localDeckSave==='saved');
  await page.reload();
  await page.waitForFunction(()=>document.body.dataset.asmdeckRebuild==='ready');
  if(!await page.evaluate(()=>document.body.classList.contains('asm-edit-mode'))) await page.click('#modeToggleBtn');
  await page.click('#algorithmEditSlideBtn');
  const reopened=await (await page.waitForSelector('#algorithmEditorFrame')).contentFrame();
  await reopened.waitForFunction(()=>aceEditor.getValue().includes('std::cout<<n+1;'));
  assert.equal(await reopened.locator('#inputArea').inputValue(),'23');
  assert.equal(await reopened.evaluate(()=>ASMTracePlayer.getDocument().studio.eventSettings.autoFixedEnabled),false);
  assert.equal(await reopened.evaluate(()=>ASMTracePlayer.getDocument().studio.codePanelFontSize),19);
  // Close via the existing editor save and export the actual local copy.
  await page.click('#saveAlgorithmEditorBtn');
  await page.waitForFunction(()=>document.getElementById('algorithmEditorModal').hidden);
  const pending=page.waitForEvent('download');await page.click('#exportDeckBtn');const download=await pending;
  const exported=await archive.decode(new Blob([fs.readFileSync(await download.path())]));
  assert.ok(exported.deck.groups[0].slides[0].animation.code.includes('std::cout<<n+1;')); 
  assert.equal(exported.deck.groups[0].slides[0].animation.input,'23');
  // New objects use the same ordinary slide editor and survive its storage round trip.
  if(!await page.evaluate(()=>document.body.classList.contains('asm-edit-mode'))) await page.click('#modeToggleBtn');
  await page.click('section.present > .slide-edge-add-right');
  await page.click('[data-tool="text"]');
  await page.click('#modeToggleBtn');
  await page.waitForFunction(()=>document.body.dataset.localDeckSave==='saved');
  await page.reload();await page.waitForFunction(()=>document.body.dataset.asmdeckRebuild==='ready');
  const nextDownload=page.waitForEvent('download');await page.click('#exportDeckBtn');
  const roundTrip=await archive.decode(new Blob([fs.readFileSync(await (await nextDownload).path())]));
  assert.ok(roundTrip.deck.groups.flatMap(g=>g.slides).some(s=>s.canvas?.objects?.some(o=>o.type==='textbox')));
  assert.ok(roundTrip.deck.groups.flatMap(g=>g.slides).find(s=>s.id==='sample-animation').animation.code.includes('std::cout<<n+1;'));
  const other=await context.newPage();await other.goto(base+'/slides.html?sample=other-fixture');
  await other.waitForFunction(()=>document.body.dataset.asmdeckRebuild==='ready');
  if(!await other.evaluate(()=>document.body.classList.contains('asm-edit-mode'))) await other.click('#modeToggleBtn');
  await other.click('#algorithmEditSlideBtn');
  const otherFrame=await (await other.waitForSelector('#algorithmEditorFrame')).contentFrame();
  await otherFrame.waitForFunction(code=>aceEditor.getValue()===code,code);
  assert.equal(await otherFrame.locator('#inputArea').inputValue(),'7');
  // View links edit only a token-scoped local copy, including animation source.
  await context.route('**/api/shared-slides/view-fixture?*',route=>route.fulfill({json:{access:'view',slide:{title:'唯讀分享',deck:original}}}));
  const viewer=await context.newPage();await viewer.goto(base+'/slides.html?share=view-fixture');
  await viewer.waitForFunction(()=>document.body.dataset.slideCount==='1');
  assert.equal(await viewer.locator('#modeToggleBtn').isVisible(),true);
  assert.equal(await viewer.locator('#sharedAccessBadge').textContent(),'分享本機副本');
  if(!await viewer.evaluate(()=>document.body.classList.contains('asm-edit-mode'))) await viewer.click('#modeToggleBtn');
  await viewer.click('#algorithmEditSlideBtn');
  const viewerEditor=await (await viewer.waitForSelector('#algorithmEditorFrame')).contentFrame();
  await viewerEditor.waitForFunction(()=>Boolean(ASMTracePlayer.getDocument()?.frames?.length));
  assert.ok(viewerEditor.url().includes('localOnly=1'));
  await viewerEditor.evaluate(()=>document.getElementById('inputArea').value='11');
  await viewer.click('#saveAlgorithmEditorBtn');
  await viewer.waitForFunction(()=>document.getElementById('algorithmEditorModal').hidden);
  await viewer.click('section.present > .slide-edge-add-right');
  await viewer.click('[data-tool="text"]');
  await viewer.click('#modeToggleBtn');
  await viewer.waitForFunction(()=>document.body.dataset.localDeckSave==='saved');
  await viewer.reload();
  await viewer.waitForFunction(()=>document.body.dataset.slideCount==='2');
  const localShared = await viewer.evaluate(async()=>ASMSlideStorage.create(indexedDB,localStorage)
    .loadDeck('asm_reveal_fabric_deck_v5:share:view-fixture',[],{lazyTraces:true}));
  assert.ok(localShared.groups.flatMap(g=>g.slides).some(s=>s.canvas?.objects?.some(o=>o.type==='textbox')));
  assert.equal(original.groups[0].slides.length,1);
  assert.equal(original.groups[0].slides[0].animation.input,'7');
  const cleanContext=await browser.newContext();
  await cleanContext.route('**/api/shared-slides/view-fixture?*',route=>route.fulfill({json:{access:'view',slide:{title:'唯讀分享',deck:original}}}));
  const cleanViewer=await cleanContext.newPage();await cleanViewer.goto(base+'/slides.html?share=view-fixture');
  await cleanViewer.waitForFunction(()=>document.body.dataset.slideCount==='1');
  assert.equal(await cleanViewer.locator('#sharedAccessBadge').textContent(),'分享本機副本');
  if(!await cleanViewer.evaluate(()=>document.body.classList.contains('asm-edit-mode'))) await cleanViewer.click('#modeToggleBtn');
  await cleanViewer.click('section.present > .slide-edge-add-right');
  await cleanViewer.waitForFunction(()=>document.body.dataset.slideCount==='2');
  await cleanContext.close();
  await viewer.route('**/api/shared-slides/view-fixture?*',route=>route.fulfill({status:404,json:{error:'分享已停止'}}));
  await viewer.reload();
  await viewer.waitForFunction(()=>document.getElementById('cloudSaveStatus').textContent.includes('分享已停止'));
  assert.equal(await viewer.locator('section.asm-slide').count(),0,'revoked link cannot render the saved local copy through this entry');
  assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
});
