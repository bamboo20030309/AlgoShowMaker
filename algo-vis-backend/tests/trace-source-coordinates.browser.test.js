'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {startIsolatedServer}=require('./helpers/isolated-server');
const {compile}=require('./helpers/compile');
const {verifySourceCoordinates}=require('../scripts/validation/trace-source-coordinates');

test('CRLF archive recovery turns red, preserves LF coordinates and saves the repaired ID', {timeout:90000},async t=>{
 const {base}=await startIsolatedServer(t);process.env.ASM_TEST_BASE_URL=base;
 const code='#include <vector>\nint main(){\nstd::vector<int> a={4,1};\n// @frame a\na[0]=a[1];\n// @frame a\n}';
 const {trace}=await compile(code.replace(/\n/g,'\r\n'));
 assert.equal(trace.sourceCode,code,'compiler uses LF source for offsets');
 const broken=JSON.parse(JSON.stringify(trace));broken.sourceCode=code.replace(/\n/g,'\r\n');
 broken.studio={eventSettings:{readHighlightEnabled:false},codePanelFontSize:19};
 const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({broken,code})=>{
  if(sessionStorage.seeded)return;
  localStorage.setItem('asm_reveal_fabric_deck_v5',JSON.stringify({groups:[{id:'g',slides:[{id:'a',kind:'algorithm-animation',animation:{mode:'trace',code:code.replace(/\n/g,'\r\n'),input:'',sliceMode:'manual',watches:[],traceDocument:broken,traceView:{studio:{eventSettings:{readHighlightEnabled:false},codePanelFontSize:19}}}}]}]}));sessionStorage.seeded='1';
 },{broken,code});
 let release;const gate=new Promise(r=>release=r);let submitted=0;
 await page.route('**/api/compile/jobs',async route=>{submitted++;await gate;await route.continue();});
 await page.goto(base+'/slides.html');
 await page.waitForFunction(()=>document.querySelector('#cloudSaveStatus')?.dataset.traceState==='updating');
 assert.equal(await page.locator('#cloudSaveStatus .cloud-status-dot').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 59, 48)');
 release();
 await page.waitForFunction(()=>document.body.dataset.localDeckSave==='saved'&&document.querySelector('#cloudSaveStatus')?.dataset.traceState==='',null,{timeout:40000});
 const repaired=await page.evaluate(async()=>{
  const store=ASMSlideStorage.create(indexedDB,localStorage);
  const deck=await store.loadDeck('asm_reveal_fabric_deck_v5',[],{lazyTraces:true});
  const a=deck.groups[0].slides[0].animation;
  return {animation:a,trace:await store.loadTrace(a.traceRef)};
 });
 assert.equal(repaired.trace.sourceCode,code);
 assert.equal(repaired.animation.code,code.replace(/\n/g,'\r\n'),'editor text remains intact');
 assert.equal(repaired.animation.traceView.studio.eventSettings.readHighlightEnabled,false);
 assert.equal(repaired.animation.traceView.studio.codePanelFontSize,19);
 for(const frame of repaired.trace.frames)for(const event of frame.events||[]){
  const s=event.source;if(!s||!Number.isInteger(s.from)||!s.column)continue;
  const prefix=code.slice(0,s.from),lines=prefix.split('\n');
  assert.equal(lines.length,s.line,`${event.type}: line`);
  assert.equal(lines.at(-1).length+1,s.column,`${event.type}: column`);
 }
 await page.reload();await page.waitForFunction(()=>document.querySelector('iframe.algorithm-slide-frame')?.contentDocument?.querySelector('#asm-trace-root [data-trace-variable]'));
 assert.equal(submitted,1,'saved repaired trace does not recompile on reopen');
 assert.deepEqual(errors,[]);
});

test('published quick sort uses aligned source spans and highlights the actual swap without compilation',{timeout:60000},async t=>{
 const fs=require('node:fs'),{readPackage,savedTrace}=require('./helpers/deck-package');
 const body=readPackage(fs.readFileSync('public/guest-decks/quick-sort.asmdeck')).body;
 for(const slide of body.deck.groups.flatMap(g=>g.slides).filter(s=>s.animation)){
  assert.ok(verifySourceCoordinates(savedTrace(body,slide.animation))>100);
 }
 const {base}=await startIsolatedServer(t);
 const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());
 const page=await browser.newPage();let jobs=0;
 page.on('request',r=>{if(r.method()==='POST'&&/\/(compile|api\/compile\/jobs)$/.test(new URL(r.url()).pathname))jobs++;});
 await page.goto(base+'/slides.html?sample=quick-sort');await page.waitForFunction(()=>document.body.classList.contains('sample-deck-ready'));
 await page.evaluate(()=>{const s=document.querySelector('section[data-slide-id="quick-teaching-23"]');const i=Reveal.getIndices(s);Reveal.slide(i.h,i.v);});
 await page.waitForFunction(()=>document.querySelector('iframe[data-slide-id="quick-teaching-23"]')?.contentWindow?.ASMTracePlayer?.getDocument()?.frames?.length);
 const result=await page.evaluate(async()=>{
  const w=document.querySelector('iframe[data-slide-id="quick-teaching-23"]').contentWindow;
  const trace=w.ASMTracePlayer.getDocument();
  const index=trace.frames.findIndex(f=>f.events.some(e=>e.type==='swap'&&e.source?.text.includes('swap(arr[i], arr[j])')));
  if(index<0)throw Error('missing expected swap');
  await w.ASMTracePlayer.renderStable(index);
  const frame=trace.frames[index],event=frame.events.find(e=>e.type==='swap');
  w.ASMTraceCodePresenter.renderFrame(trace,frame);
  w.ASMTraceCodePresenter.setActiveEvent(event.id,'start');
  return {active:[...w.document.querySelectorAll('.asm-trace-code-event-span.is-active')].map(e=>e.textContent).join(''),source:trace.sourceCode.slice(event.source.from,event.source.to)};
 });
 assert.equal(result.source,'swap(arr[i], arr[j])');
 assert.match(result.active,/swap\(arr\[i\], arr\[j\]\)/);
 assert.equal(jobs,0,'current published sample must not compile');
});
