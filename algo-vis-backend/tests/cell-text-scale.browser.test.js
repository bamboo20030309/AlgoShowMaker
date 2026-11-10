'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('playwright'),{startIsolatedServer}=require('./helpers/isolated-server');
const {readPackage,savedTrace}=require('./helpers/deck-package'),{compile}=require('./helpers/compile');

test('cell dimensions change without scaling glyphs in saved BIT copies and new comparisons',{timeout:120000},async t=>{
 const {base}=await startIsolatedServer(t),oldBase=process.env.ASM_TEST_BASE_URL;
 let comparison;try{process.env.ASM_TEST_BASE_URL=base;({trace:comparison}=await compile(`#include <vector>
int main(){std::vector<int>a={12,345};int i=0,j=1;
// @frame a
if(a[0]<a[1]){}
// @frame a
// @frame a
// @pointer i,j at a
if(i<j){}
// @frame a
// @pointer i,j at a
// @frame a
}`));}finally{if(oldBase===undefined)delete process.env.ASM_TEST_BASE_URL;else process.env.ASM_TEST_BASE_URL=oldBase;}
 const body=readPackage(fs.readFileSync('public/guest-decks/binary-indexed-tree-teaching.asmdeck')).body;
 const a=body.deck.groups.flatMap(g=>g.slides).find(s=>s.animation?.code.includes('BIT[i] = num[i]')).animation;
 const bit=savedTrace(body,a);
 const mergeBody=readPackage(fs.readFileSync('public/guest-decks/merge-sort.asmdeck')).body;
 const mergeAnimation=mergeBody.deck.groups.flatMap(g=>g.slides).find(s=>s.animation?.code.includes('split_tree')).animation;
 const retained=savedTrace(mergeBody,mergeAnimation),retainedIndex=retained.frames.findIndex(f=>f.events.some(e=>e.type==='compare'&&e.operation==='<='&&e.targets?.some(t=>/^num\[/.test(t.expression))));
 assert.ok(retainedIndex>0);
 const browser=await chromium.launch({headless:true,channel:'msedge'});t.after(()=>browser.close());
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/algorithm.html?asmEmbed=runtime');await page.waitForFunction(()=>window.ASMTracePlayer);
 for(const fixture of [{kind:'copy',trace:bit,from:8},{kind:'copy-cancel',trace:bit,from:8},{kind:'compare',trace:comparison,from:0},{kind:'popup',trace:comparison,from:2},{kind:'retained',trace:retained,from:retainedIndex-1}])for(const speed of fixture.kind==='copy-cancel'?[1]:[1,4]){
  const report=await page.evaluate(async({fixture,speed})=>{
   const doc=ASMTracePlayer.apply(JSON.parse(JSON.stringify(fixture.trace)));window.asmGetAnimationPlaybackRate=()=>speed;
   await ASMTracePlayer.render(fixture.from,{stable:true});
   // Normal-array glyphs are populated lazily after camera placement.
   await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
   const metrics=node=>{if(!node)return null;const root=document.getElementById('asm-trace-root'),m=root.getScreenCTM().inverse().multiply(node.getScreenCTM());return{sx:Math.hypot(m.a,m.b),sy:Math.hypot(m.c,m.d),font:getComputedStyle(node).fontSize};};
   const text=owner=>owner?.querySelector('text[data-trace-content-role="value"],text:not([data-trace-content-role="index"]):not(.outerframe-label)');
   const sources={};document.querySelectorAll('#arraySvg [data-trace-object-key]').forEach(owner=>{const n=text(owner);if(n)sources[owner.dataset.traceObjectKey]=metrics(n);});
   document.querySelectorAll('#arraySvg [data-trace-index]').forEach(owner=>{const variable=owner.closest('[data-trace-variable]')?.dataset.traceVariable,n=text(owner);if(variable&&n)sources[variable+'#'+owner.dataset.traceIndex]=metrics(n);});
   const variable=Object.keys(doc.variables).find(id=>doc.variables[id].name==='a');
   const read=()=>{const root=document.getElementById('asm-trace-root');return{
    transfers:[...root.querySelectorAll('.asm-trace-assign-transfer:not(.asm-trace-assign-transfer-value)')].filter(owner=>Number(getComputedStyle(owner).opacity)>.01).map(owner=>({source:owner.dataset.traceTransferSourceKey,text:metrics(text(owner)),rect:metrics(owner.querySelector('rect'))})),
    retained:[...root.querySelectorAll('[data-trace-compare-motion="1"]')].map(owner=>({text:metrics(text(owner)),rect:metrics(owner.querySelector('rect'))})),
    popups:[...root.querySelectorAll('.asm-trace-compare-marker-popup')].map(owner=>({text:metrics(owner.querySelector('text')),rect:metrics(owner.querySelector('rect'))})),
    cells:[0,1].map(index=>{const owner=root.querySelector(`[data-trace-object-key="${CSS.escape(variable+'#'+index)}"]`);return{text:metrics(text(owner)),rect:metrics(owner?.querySelector('rect'))};})
   };};
   const before=read(),samples=[],native={raf:requestAnimationFrame,cancel:cancelAnimationFrame,now:Object.getOwnPropertyDescriptor(performance,'now')};
   let clock=performance.now(),elapsed=0,serial=0;const callbacks=new Map();window.requestAnimationFrame=cb=>{callbacks.set(++serial,cb);return serial;};window.cancelAnimationFrame=id=>callbacks.delete(id);Object.defineProperty(performance,'now',{configurable:true,value:()=>clock});
   try{
    const pending=ASMTracePlayer.render(fixture.from+1,{fromIndex:fixture.from,forceTransition:true});const total=ASMTracePlayer.getLastPlaybackPlan().totalDurationMs;
    while(elapsed<total+100){elapsed+=16;clock+=16;const batch=[...callbacks.values()];callbacks.clear();batch.forEach(cb=>cb(clock));for(let k=0;k<12;k++)await Promise.resolve();samples.push({at:elapsed,...read()});if(fixture.kind==='copy-cancel'&&samples.at(-1).transfers.some(v=>v.rect?.sx>4)){ASMTraceFrameTween.cancel();break;}}
    window.requestAnimationFrame=native.raf;window.cancelAnimationFrame=native.cancel;if(native.now)Object.defineProperty(performance,'now',native.now);else delete performance.now;await pending;
    return{sources,before,samples,after:read(),remaining:document.querySelectorAll('.asm-trace-assign-transfer').length,afterGlyphs:[...document.querySelectorAll('#asm-trace-root text[data-trace-content-role="value"]')].map(metrics)};
   }finally{window.requestAnimationFrame=native.raf;window.cancelAnimationFrame=native.cancel;if(native.now)Object.defineProperty(performance,'now',native.now);else delete performance.now;ASMTraceFrameTween.cancel();}
  },{fixture,speed});
  fs.mkdirSync('test-results/cell-text-scale',{recursive:true});fs.writeFileSync(`test-results/cell-text-scale/${fixture.kind}-${speed}.json`,JSON.stringify(report));
  if(fixture.kind.startsWith('copy')){
   const transfers=report.samples.flatMap(s=>s.transfers);assert.ok(transfers.length>5,'must observe travelling BIT cell');
   assert.ok(transfers.some(v=>Math.abs(v.rect.sx-v.rect.sy)>.2),'cell must actually resize non-uniformly');
   // This saved fixture uses the normal cell's 16px glyph at unit world
   // scale. Its offscreen num[8] glyph may legitimately be absent under LOD;
   // the visible travelling copy still has to match that fixed standard.
   const bad=transfers.find(v=>!v.text||Math.abs(v.text.sx-1)>.001||Math.abs(v.text.sy-1)>.001||v.text.font!=='16px');
   assert.ok(!bad,'copy must preserve source glyph size and aspect: '+JSON.stringify(bad));assert.equal(report.remaining,0);
   assert.ok(report.afterGlyphs.length>5);assert.ok(report.afterGlyphs.every(g=>Math.abs(g.sx-1)<.001&&Math.abs(g.sy-1)<.001),'completion/cancel must restore glyph geometry');
  }else if(fixture.kind==='compare'){
   assert.ok(report.samples.some(s=>s.cells.some((v,i)=>v.rect&&v.rect.sx>report.before.cells[i].rect.sx*1.1)),'comparison must actually enlarge the cells');
   const bad=report.samples.find(s=>s.cells.some((v,i)=>v.text&&(Math.abs(v.text.sx-report.before.cells[i].text.sx)>.001||Math.abs(v.text.sy-report.before.cells[i].text.sy)>.001)));
   assert.ok(!bad,'comparison must preserve glyph size: '+JSON.stringify(bad));
  }else if(fixture.kind==='popup'){
   const popups=report.samples.flatMap(s=>s.popups);assert.ok(popups.length>5,'must observe numeric pointer comparison');
   assert.ok(popups.some(v=>Math.abs(v.rect.sx-1)>.05),'popup box must actually scale');
   assert.ok(popups.every(v=>Math.abs(v.text.sx-1)<.001&&Math.abs(v.text.sy-1)<.001),'pointer popup digits keep their original size');
  }else{
   const cells=report.samples.flatMap(s=>s.retained);assert.ok(cells.length>5);
   assert.ok(cells.some(v=>v.rect.sx>1.1),'kept source cells must actually enlarge');
   const bad=cells.find(v=>!v.text||Math.abs(v.text.sx-1)>.001||Math.abs(v.text.sy-1)>.001);
   assert.ok(!bad,'retained comparison must preserve glyph size: '+JSON.stringify(bad));
  }
 }
 const nested=await page.evaluate(()=>{
  const root=document.getElementById('asm-trace-root'),make=name=>document.createElementNS('http://www.w3.org/2000/svg',name);
  const parent=make('g'),cell=make('g'),rect=make('rect'),text=make('text');cell.dataset.traceIndex='0';rect.setAttribute('width','40');rect.setAttribute('height','40');text.setAttribute('x','20');text.setAttribute('y','20');text.setAttribute('transform','translate(3 1)');text.style.fontSize='24px';text.textContent='123';cell.append(rect,text);parent.append(cell);root.append(parent);
  const metrics=node=>{const m=root.getScreenCTM().inverse().multiply(node.getScreenCTM());return{x:Math.hypot(m.a,m.b),y:Math.hypot(m.c,m.d)};};
  const outer=ASMTraceFrameTween.preserveCellTextSize(parent),inner=ASMTraceFrameTween.preserveCellTextSize(cell);
  parent.setAttribute('transform','scale(3 2)');cell.setAttribute('transform','scale(.5 4)');outer.update(3,2);inner.update(.5,4);
  const scaled={text:metrics(text),rect:metrics(rect)};
  const clone=ASMTraceFrameTween.cloneWithoutCellTextScale(cell);clone.removeAttribute('transform');root.append(clone);const copied={transform:clone.querySelector('text').getAttribute('transform'),font:getComputedStyle(clone.querySelector('text')).fontSize};clone.remove();
  outer.remove(true);inner.remove(true);const restored={transform:text.getAttribute('transform'),font:getComputedStyle(text).fontSize,text:metrics(text),rect:metrics(rect)};parent.remove();return{scaled,copied,restored};
 });
 assert.ok(Math.abs(nested.scaled.rect.x-1.5)<.001&&Math.abs(nested.scaled.rect.y-8)<.001);
 assert.ok(Math.abs(nested.scaled.text.x-1)<.001&&Math.abs(nested.scaled.text.y-1)<.001,'nested scales compose without stretching glyphs');
 assert.equal(nested.copied.transform,'translate(3 1)');assert.equal(nested.copied.font,'24px');assert.equal(nested.restored.transform,'translate(3 1)');assert.equal(nested.restored.font,'24px');assert.ok(Math.abs(nested.restored.text.x-1)<.001&&Math.abs(nested.restored.text.y-1)<.001);
 assert.deepEqual(errors,[]);
});

test('heap resize/swap changes its geometry without distorting old-cell glyphs',{timeout:60000},async t=>{
 const {base}=await startIsolatedServer(t),previous=process.env.ASM_TEST_BASE_URL;let trace;
 try{process.env.ASM_TEST_BASE_URL=base;({trace}=await compile(`#include <vector>
#include <algorithm>
int main(){std::vector<int>h={0,1,2,3,4};int n=4;
// @frame h render heap with range(1,n)
std::swap(h[1],h[2]);h.pop_back();n--;
// @frame h render heap with range(1,n)
// @frame h render heap with range(1,n)
}`));}finally{if(previous===undefined)delete process.env.ASM_TEST_BASE_URL;else process.env.ASM_TEST_BASE_URL=previous;}
 const browser=await chromium.launch({headless:true,channel:'msedge'});t.after(()=>browser.close());const page=await browser.newPage();
 await page.goto(base+'/algorithm.html?asmEmbed=runtime');await page.waitForFunction(()=>window.ASMTracePlayer);
 fs.mkdirSync('test-results/cell-text-scale',{recursive:true});fs.writeFileSync('test-results/cell-text-scale/heap-resize-trace.json',JSON.stringify(trace));
 const samples=await page.evaluate(async trace=>{
  ASMTracePlayer.apply(trace);await ASMTracePlayer.render(0,{stable:true});
  const native={raf:requestAnimationFrame,cancel:cancelAnimationFrame,now:Object.getOwnPropertyDescriptor(performance,'now')};let clock=performance.now(),elapsed=0,id=0;const callbacks=new Map(),samples=[];
  window.requestAnimationFrame=cb=>{callbacks.set(++id,cb);return id;};window.cancelAnimationFrame=id=>callbacks.delete(id);Object.defineProperty(performance,'now',{configurable:true,value:()=>clock});
  try{const pending=ASMTracePlayer.render(1,{fromIndex:0,forceTransition:true}),total=ASMTracePlayer.getLastPlaybackPlan().totalDurationMs;
   let diagnostics;
   while(elapsed<total+100){elapsed+=16;clock+=16;const batch=[...callbacks.values()];callbacks.clear();batch.forEach(cb=>cb(clock));for(let i=0;i<12;i++)await Promise.resolve();const root=document.getElementById('asm-trace-root'),inverse=root.getScreenCTM().inverse();const metric=n=>{const m=inverse.multiply(n.getScreenCTM());return{x:Math.hypot(m.a,m.b),y:Math.hypot(m.c,m.d)};};
    if(!diagnostics)diagnostics={heaps:[...root.querySelectorAll('[data-layout="heap"]')].map(n=>({width:n.getAttribute('data-heap-totalW'),ghost:!!n.closest('[data-trace-heap-resize-ghost]'),indices:[...n.querySelectorAll('[data-trace-index]')].map(c=>({i:c.dataset.traceIndex,texts:c.querySelectorAll('text').length}))})),plan:ASMTracePlayer.getLastPlaybackPlan()};
    for(const cell of root.querySelectorAll('[data-trace-heap-resize-ghost] [data-trace-index]')){const text=cell.querySelector('text'),rect=cell.querySelector('rect');if(text&&rect)samples.push({text:metric(text),rect:metric(rect)});}
   }window.requestAnimationFrame=native.raf;window.cancelAnimationFrame=native.cancel;if(native.now)Object.defineProperty(performance,'now',native.now);else delete performance.now;await pending;return{samples,diagnostics};
  }finally{window.requestAnimationFrame=native.raf;window.cancelAnimationFrame=native.cancel;if(native.now)Object.defineProperty(performance,'now',native.now);else delete performance.now;ASMTraceFrameTween.cancel();}
 },trace);
 fs.writeFileSync('test-results/cell-text-scale/heap-resize.json',JSON.stringify(samples));assert.ok(samples.samples.length>5,'must observe heap resize ghost');assert.ok(samples.samples.some(s=>Math.abs(s.rect.x-s.rect.y)>.1),'heap width must actually change');assert.ok(samples.samples.every(s=>Math.abs(s.text.x-1)<.001&&Math.abs(s.text.y-1)<.001),'heap text keeps its original dimensions');
});
