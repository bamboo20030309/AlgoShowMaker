'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const {startIsolatedServer}=require('./helpers/isolated-server'),{compile}=require('./helpers/compile');
test('read emphasis defaults off, uses pure red when enabled, and preserves saved choices', {timeout:120000},async t=>{
 const {base}=await startIsolatedServer(t);let trace;const old=process.env.ASM_TEST_BASE_URL;process.env.ASM_TEST_BASE_URL=base;try{({trace}=await compile('int main(){\nint a=1,b=3;\n// @frame a,b\na=b;\n// @frame a,b\n}\n'));}finally{if(old===undefined)delete process.env.ASM_TEST_BASE_URL;else process.env.ASM_TEST_BASE_URL=old;}
 const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/algorithm.html?asmEmbed=editor&localOnly=1');await page.waitForFunction(()=>window.ASMTraceEditor&&window.asmApplyTraceDocument);await page.addScriptTag({url:base+'/slides-storage.js'});await page.addScriptTag({url:base+'/slide-trace-store.js'});
 const results=await page.evaluate(async source=>{
  const results=[];const camera=window.ASMTraceCamera;window.ASMTraceCamera={...camera,apply(){},transitionDuration:()=>0};
  for(const variant of [{name:'old-missing'},{name:'new-default',enabled:false},{name:'on',enabled:true},{name:'custom',enabled:true,color:'#123456'},{name:'saved-palette',enabled:true,color:'AV_red'},{name:'explicit-off',enabled:false,color:'#123456'}]){
   let doc=JSON.parse(JSON.stringify(source));doc.studio||={};doc.studio.eventSettings={gapMs:0,autoFixedEnabled:false};if('enabled'in variant)doc.studio.eventSettings.readHighlightEnabled=variant.enabled;if(variant.color)doc.studio.eventSettings.readHighlightColor=variant.color;
   // Actual IndexedDB round trip, with a separate client and external Trace ID.
   const deck={groups:[{id:'g',slides:[{id:'s',kind:'algorithm-animation',animation:{mode:'trace',code:doc.sourceCode,input:'',traceDocument:doc}}]}]};
   // Reopen the same named database; no in-memory Trace is supplied.
   const dbName='read-settings-'+variant.name+'-'+Date.now();const first=ASMSlideStorage.create(indexedDB,localStorage,dbName);await first.saveDeck('d',JSON.stringify(deck));const second=ASMSlideStorage.create(indexedDB,localStorage,dbName);const compact=await second.loadDeck('d',[],{lazyTraces:true});const animation=await ASMSlideTraceStore.create(ASMSlideStorage,second).materializeAnimation(compact.groups[0].slides[0].animation);doc=animation.traceDocument;
   ace.edit('editor').setValue(doc.sourceCode,-1);ASMTraceEditor.loadAnimation({mode:'trace',code:doc.sourceCode,input:'',traceDocument:doc},{openStudio:false});await CodeScript.goto(0);document.getElementById('eventSettingsBtn').click();const toggle=document.querySelector('.trace-read-highlight-toggle');const checked=toggle.checked;document.querySelector('.trace-event-settings-panel').hidden=true;
   // Code highlight has its own lead-in. Observe the owner's complete event,
   // rather than assuming its visual phase has started at wall-clock 120 ms.
   let settled=false,reads=[];const pending=CodeScript.next().finally(()=>settled=true);
   while(!settled){await new Promise(requestAnimationFrame);const visible=[...document.querySelectorAll('.asm-trace-read-highlight')].map(n=>({stroke:n.getAttribute('stroke'),animation:getComputedStyle(n).animationName,owner:n.dataset.traceReadOwner}));if(visible.length>reads.length)reads=visible;}
   await pending;
   const current=ASMTracePlayer.getDocument();const view=ASMTraceViewSource.fromTrace(current);results.push({name:variant.name,checked,reads,owner:current.frames[1].events.find(e=>e.type==='assign'&&e.source?.text==='a=b')?.id,settings:current.studio.eventSettings,view:view.studio?.eventSettings,remaining:document.querySelectorAll('.asm-trace-read-highlight').length});
  }
  window.ASMTraceCamera=camera;return results;
 },trace);
 for(const r of results){const on=['on','custom','saved-palette'].includes(r.name);assert.equal(r.checked,on,r.name+' toggle');assert.equal(r.reads.length,on?1:0,r.name+' actual read highlight');assert.equal(r.remaining,0);if(on){assert.ok(r.owner);assert.equal(r.reads[0].owner,r.owner);assert.equal(r.reads[0].stroke,r.name==='custom'?'#123456':r.name==='saved-palette'?'rgba(239, 154, 154, 0.6)':'red');assert.equal(r.reads[0].animation,'none');assert.equal(r.view.readHighlightEnabled,true);}if(r.name==='explicit-off'){assert.equal(r.view.readHighlightEnabled,false);assert.equal(r.view.readHighlightColor,'#123456');}}
 const ui=await page.evaluate(()=>{document.getElementById('eventSettingsBtn').click();const toggle=document.querySelector('.trace-read-highlight-toggle');toggle.click();const enabled=ASMTracePlayer.getDocument().studio.eventSettings.readHighlightEnabled;toggle.click();return {enabled,disabled:ASMTracePlayer.getDocument().studio.eventSettings.readHighlightEnabled};});assert.deepEqual(ui,{enabled:true,disabled:false});
 assert.deepEqual(errors,[]);
});

test('insertion initialization clocks remain ordered and equal-value assignments still copy', {timeout:90000},async t=>{
 const {base}=await startIsolatedServer(t);const old=process.env.ASM_TEST_BASE_URL;let trace;
 try{process.env.ASM_TEST_BASE_URL=base;({trace}=await compile(`#include <vector>
int main(){std::vector<int> arr(3);arr[1]=8;int i=1;
// @frame arr
// @pointer i at arr
int j=i-1;
int key=arr[i];
// @frame arr,key
// @pointer i,j at arr
arr[j+1]=key;
// @frame arr,key
// @pointer i,j at arr
}`));}finally{if(old===undefined)delete process.env.ASM_TEST_BASE_URL;else process.env.ASM_TEST_BASE_URL=old;}
 const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());const page=await browser.newPage();
 await page.goto(base+'/algorithm.html?asmEmbed=runtime');await page.waitForFunction(()=>window.ASMTracePlayer);
 const result=await page.evaluate(async source=>{
  source.studio||={};source.studio.eventSettings={gapMs:0,readHighlightEnabled:true};
  for(const f of source.frames)for(const e of f.events){e.enabled=true;e.autoAnimationDisabled=false;}
  const player=ASMTracePlayer;player.apply(source);window.asmGetAnimationPlaybackRate=()=>1;
  const camera=window.ASMTraceCamera;window.ASMTraceCamera={...camera,apply(){},transitionDuration:()=>0};
  const slots=[];const listener=e=>{if(e.detail?.phase==='start'){const s=e.detail.slot;slots.push({type:s.event.type,name:source.variables[s.event.targets.find(t=>t.role==='target')?.variableId]?.name,duration:s.duration});}};
  window.addEventListener('asm:trace-active-event',listener);
  await player.render(0,{animatePositions:false,animateEvents:false});await player.render(1);
  const pending=player.render(2);await new Promise(r=>setTimeout(r,100));
  const target=[...document.querySelectorAll('.asm-trace-event-emphasis')].map(n=>n.getAttribute('stroke'));
  const transfers=[...document.querySelectorAll('.asm-trace-assign-transfer')].map(n=>({rects:n.querySelectorAll('rect').length,value:n.textContent}));
  const read=[...document.querySelectorAll('.asm-trace-read-highlight')].map(n=>n.getAttribute('stroke'));
  await pending;window.removeEventListener('asm:trace-active-event',listener);window.ASMTraceCamera=camera;return {slots,target,read,transfers};
 },trace);
 assert.equal(result.slots.find(s=>s.type==='declare'&&s.name==='j')?.duration,220,JSON.stringify(result));
 assert.equal(result.slots.find(s=>s.type==='declare'&&s.name==='key')?.duration,220,JSON.stringify(result));
 assert.equal(result.slots.find(s=>s.type==='assign'&&s.name==='key')?.duration,1260,JSON.stringify(result));
 assert.deepEqual(result.target,[]);assert.deepEqual(result.read,['red']);
 assert.ok(result.transfers.some(n=>n.rects>0&&n.value.includes('8')),JSON.stringify(result));
});
