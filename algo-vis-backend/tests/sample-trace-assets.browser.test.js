'use strict';
const{test}=require('node:test'),assert=require('node:assert/strict'),{chromium}=require('playwright'),{startStaticUiServer}=require('./helpers/static-ui-server');
test('legacy reference import keeps settings while session results stay out of IndexedDB',{timeout:60000},async t=>{
 const{base}=await startStaticUiServer(t),browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());const page=await browser.newPage();let requests=0;page.on('request',r=>{if(r.url().includes('/deck-traces/'))requests++;});await page.goto(base+'/slides.html');await page.waitForFunction(()=>window.ASMSlideTraceStore&&window.ASMAnimationRecipe);
 const state=await page.evaluate(async()=>{
  const storage=ASMSlideStorage.create(indexedDB,null,'browser-recipe'),source={groups:[{slides:[{animation:{code:'int main(){}',input:'2',traceRef:'a'.repeat(64),traceView:{studio:{eventSettings:{autoFixedEnabled:false},codePanelFontSize:19}}}}]}]};
  await storage.saveDeck('d',JSON.stringify(source));const saved=await ASMSlideStorage.create(indexedDB,null,'browser-recipe').loadDeck('d');
  let runs=0;const results=ASMSlideTraceStore.create(ASMSlideStorage,storage,null,async a=>{runs++;return{...a,traceDocument:{frames:[{id:'fresh'}],...a.traceView}};});
  const played=await results.materializeDeck(saved);const reread=await ASMSlideStorage.create(indexedDB,null,'browser-recipe').loadDeck('d');
  return{runs,frame:played.groups[0].slides[0].animation.traceDocument.frames[0].id,saved:reread};
 });
 assert.equal(state.runs,1);assert.equal(state.frame,'fresh');const a=state.saved.groups[0].slides[0].animation;assert.equal(a.traceRef,undefined);assert.equal(a.traceDocument,undefined);assert.equal(a.traceView.studio.eventSettings.autoFixedEnabled,false);assert.equal(a.traceView.studio.codePanelFontSize,19);assert.equal(requests,0);
});
