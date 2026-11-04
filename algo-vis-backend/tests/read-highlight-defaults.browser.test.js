'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const {startIsolatedServer}=require('./helpers/isolated-server'),{compile}=require('./helpers/compile');
test('read emphasis defaults off, uses AV_red when enabled, and preserves saved choices', {timeout:120000},async t=>{
 const {base}=await startIsolatedServer(t);let trace;const old=process.env.ASM_TEST_BASE_URL;process.env.ASM_TEST_BASE_URL=base;try{({trace}=await compile('int main(){\nint a=1,b=3;\n// @frame a,b\na=b;\n// @frame a,b\n}\n'));}finally{if(old===undefined)delete process.env.ASM_TEST_BASE_URL;else process.env.ASM_TEST_BASE_URL=old;}
 const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/algorithm.html?asmEmbed=editor&localOnly=1');await page.waitForFunction(()=>window.ASMTraceEditor&&window.asmApplyTraceDocument);await page.addScriptTag({url:base+'/slides-storage.js'});await page.addScriptTag({url:base+'/slide-trace-store.js'});
 const results=await page.evaluate(async source=>{
  const results=[];const camera=window.ASMTraceCamera;window.ASMTraceCamera={...camera,apply(){},transitionDuration:()=>0};
  for(const variant of [{name:'old-missing'},{name:'new-default',enabled:false},{name:'on',enabled:true},{name:'custom',enabled:true,color:'#123456'},{name:'explicit-off',enabled:false,color:'#123456'}]){
   let doc=JSON.parse(JSON.stringify(source));doc.studio||={};doc.studio.eventSettings={gapMs:0,autoFixedEnabled:false};if('enabled'in variant)doc.studio.eventSettings.readHighlightEnabled=variant.enabled;if(variant.color)doc.studio.eventSettings.readHighlightColor=variant.color;
   // Actual IndexedDB round trip, with a separate client and external Trace ID.
   const deck={groups:[{id:'g',slides:[{id:'s',kind:'algorithm-animation',animation:{mode:'trace',code:doc.sourceCode,input:'',traceDocument:doc}}]}]};
   // Reopen the same named database; no in-memory Trace is supplied.
   const dbName='read-settings-'+variant.name+'-'+Date.now();const first=ASMSlideStorage.create(indexedDB,localStorage,dbName);await first.saveDeck('d',JSON.stringify(deck));const second=ASMSlideStorage.create(indexedDB,localStorage,dbName);const compact=await second.loadDeck('d',[],{lazyTraces:true});const animation=await ASMSlideTraceStore.create(ASMSlideStorage,second).materializeAnimation(compact.groups[0].slides[0].animation);doc=animation.traceDocument;
   ace.edit('editor').setValue(doc.sourceCode,-1);ASMTraceEditor.loadAnimation({mode:'trace',code:doc.sourceCode,input:'',traceDocument:doc},{openStudio:false});await CodeScript.goto(0);document.getElementById('eventSettingsBtn').click();const toggle=document.querySelector('.trace-read-highlight-toggle');const checked=toggle.checked;document.querySelector('.trace-event-settings-panel').hidden=true;
   const pending=CodeScript.next();await new Promise(r=>setTimeout(r,120));const reads=[...document.querySelectorAll('.asm-trace-read-highlight')].map(n=>({stroke:n.getAttribute('stroke'),animation:getComputedStyle(n).animationName}));await pending;
   const current=ASMTracePlayer.getDocument();const view=ASMTraceViewSource.fromTrace(current);results.push({name:variant.name,checked,reads,settings:current.studio.eventSettings,view:view.studio?.eventSettings,remaining:document.querySelectorAll('.asm-trace-read-highlight').length});
  }
  window.ASMTraceCamera=camera;return results;
 },trace);
 for(const r of results){const on=['on','custom'].includes(r.name);assert.equal(r.checked,on,r.name+' toggle');assert.equal(r.reads.length,on?1:0,r.name+' actual read highlight');assert.equal(r.remaining,0);if(on){assert.equal(r.reads[0].stroke,r.name==='custom'?'#123456':'rgba(239, 154, 154, 0.6)');assert.equal(r.reads[0].animation,'none');assert.equal(r.view.readHighlightEnabled,true);}if(r.name==='explicit-off'){assert.equal(r.view.readHighlightEnabled,false);assert.equal(r.view.readHighlightColor,'#123456');}}
 const ui=await page.evaluate(()=>{document.getElementById('eventSettingsBtn').click();const toggle=document.querySelector('.trace-read-highlight-toggle');toggle.click();const enabled=ASMTracePlayer.getDocument().studio.eventSettings.readHighlightEnabled;toggle.click();return {enabled,disabled:ASMTracePlayer.getDocument().studio.eventSettings.readHighlightEnabled};});assert.deepEqual(ui,{enabled:true,disabled:false});
 assert.deepEqual(errors,[]);
});
