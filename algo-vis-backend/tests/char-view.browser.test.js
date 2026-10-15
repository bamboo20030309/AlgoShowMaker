'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { compile } = require('./helpers/compile');
const { startIsolatedServer } = require('./helpers/isolated-server');
const fs = require('node:fs');
const path = require('node:path');

test('char string cells, pointers, events, styles and saved snapshots keep source identity', {timeout:90000}, async t => {
  const {base} = await startIsolatedServer(t);
  const oldBase = process.env.ASM_TEST_BASE_URL;
  process.env.ASM_TEST_BASE_URL = base;
  t.after(() => { if (oldBase) process.env.ASM_TEST_BASE_URL = oldBase; else delete process.env.ASM_TEST_BASE_URL; });
  const code = `#include <iostream>
#include <string>
using namespace std;
// @preset char_view
// @object char(s) with labels(value,index)
// @pointer i at s
// @pointer j at s
// @endpreset
int main(){string s; cin>>s; int i=0,j=2;
// @frame use char_view
// @style s[0:2] background AV_green when value == s[0]
// @keep s as "original"
if(s[i]==s[j]) s[i]=s[j];
s[1]='z';
// @frame char(s) with labels(value,index)
// @pointer i at s
// @pointer j at s
// @style s[1] highlight
// @frame s
string empty="";
// @frame char(empty)
cout<<s;
}`;
  const {trace,window} = await compile(code,'aba');
  const id = Object.keys(trace.variables).find(id => trace.variables[id].name === 's');
  assert.ok(id);
  assert.equal(trace.frames[0].state[id].data.value,'aba');
  assert.equal(trace.frames[1].state[id].data.value,'aza');
  assert.equal(window.ASMTraceRules.evaluate(trace,trace.frames[0])[id]['2'].styleTypes.background,'rgba(165, 214, 167, 0.6)');
  const indexed = trace.frames[1].events.filter(e => e.targets?.some(x=>x.variableId===id && x.indexExpression));
  assert.ok(indexed.some(e=>e.type==='compare'), 'string comparisons retain indexed runtime targets');
  assert.ok(indexed.some(e=>['assign','write'].includes(e.type)), 'string writes retain indexed runtime targets');
  const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
  t.after(()=>browser.close());
  const page=await browser.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/algorithm.html');
  await page.waitForFunction(()=>document.body.dataset.defaultAnimationCache==='stored');
  await page.click('[data-tab="tab-canvas"]');
  const inspect = async index => {
    await page.evaluate(async ({trace,index})=>{window.asmApplyTraceDocument(trace);await ASMTracePlayer.renderStable(index);},{trace,index});
    await page.waitForFunction(()=>!document.querySelector('#asm-trace-root [data-asm-lod-pending]'));
    return page.evaluate(id=>{
      const object=[...document.querySelectorAll('#asm-trace-root > .asm-trace-object')].find(e=>e.dataset.traceVariable===id||e.dataset.traceObjectKey===id);
      const cells=object ? [...object.querySelectorAll('[data-trace-index]')].filter(e=>!e.hasAttribute('data-trace-index-label')):[];
      return {name:object?.querySelector('.outerframe-label')?.textContent,
        values:cells.map(e=>e.querySelector('text')?.textContent),
        keys:cells.map(e=>e.dataset.traceObjectKey),
        pointers:[...document.querySelectorAll('#asm-trace-root [data-trace-binding-target]')].map(e=>e.textContent),
        snapshots:document.querySelectorAll('#asm-trace-root [data-trace-snapshot]').length};
    },id);
  };
  const first=await inspect(0); assert.deepEqual(first.values,['a','b','a']); assert.equal(first.name,'s');
  assert.ok(first.keys.every((key,i)=>key===`${id}#${i}`));
  assert.ok(first.pointers.some(text=>text.includes('i')) && first.pointers.some(text=>text.includes('j')));
  const changed=await inspect(1); assert.deepEqual(changed.values,['a','z','a']); assert.ok(changed.snapshots>0);
  assert.equal(await page.locator(`#asm-trace-root > [data-trace-variable="${id}"] [data-trace-index-label]`).count(), 3,
    'labels(value,index) keeps indices on the live char view');
  assert.equal(await page.locator('#asm-trace-root > [data-trace-snapshot] [data-trace-index-label]').count(), 3,
    'kept char view retains its sequence indices');
  const reopened = JSON.parse(JSON.stringify(trace));
  await page.evaluate(async trace => { asmApplyTraceDocument(trace); await ASMTracePlayer.renderStable(1); }, reopened);
  assert.equal(await page.locator(`#asm-trace-root > [data-trace-variable="${id}"] [data-trace-index-label]`).count(), 3,
    'saved char view retains explicit index settings after reopen');
  const playback=await page.evaluate(async ({trace,id})=>{
    asmApplyTraceDocument(trace); await ASMTracePlayer.renderStable(0);
    let settled=false; const samples=[];
    const transition=ASMTracePlayer.render(1).finally(()=>settled=true);
    for(let tick=0; tick<600 && !settled; tick++){
      await new Promise(requestAnimationFrame);
      samples.push({compare:!!document.querySelector('.asm-trace-compare-highlight'),
        assign:!!document.querySelector('.asm-trace-assign-falling-value, .asm-trace-assign-transfer')});
    }
    await transition;
    const events=ASMTracePlayer.getDocument().frames[1].events.filter(e=>e.targets?.some(t=>t.variableId===id&&t.indexExpression));
    return {samples,events:events.map(e=>({type:e.type,reason:e.autoAnimationUnavailableReason}))};
  },{trace,id});
  assert.ok(playback.samples.some(s=>s.compare),'indexed string comparison animates: '+JSON.stringify(playback.events));
  assert.ok(playback.samples.some(s=>s.assign),'indexed string assignment animates: '+JSON.stringify(playback.events));
  const old=await inspect(2); assert.deepEqual(old.values,['aza'], 'ordinary string display remains a single cell');
  assert.equal(await page.locator(`#asm-trace-root > [data-trace-variable="${id}"] [data-trace-index-label]`).count(), 0);
  // Reopen serialized trace: transforms and explicit customization survive.
  const saved=JSON.parse(JSON.stringify(trace));
  saved.frames[1].rendererOptions[id].showIndex=false;
  saved.frames[1].rendererOptions[id].indexMode=0;
  saved.frames[1].rendererOptions[id].indexLabels={mode:'none',values:[]};
  await page.evaluate(async trace=>{asmApplyTraceDocument(trace);await ASMTracePlayer.renderStable(1);},saved);
  assert.equal(await page.locator(`#asm-trace-root > [data-trace-variable="${id}"] [data-trace-index-label]`).count(),0);
  await page.evaluate(async trace=>{asmApplyTraceDocument(trace);await ASMTracePlayer.renderStable(3);},saved);
  const emptyId=Object.keys(trace.variables).find(id=>trace.variables[id].name==='empty');
  assert.equal(await page.locator(`#asm-trace-root > [data-trace-variable="${emptyId}"] [data-trace-index]`).count(),0);
  assert.deepEqual(errors,[]);
});

test('KMP uses char(s) without a copied display array', {timeout:90000}, async t => {
  const {base}=await startIsolatedServer(t);
  const source=fs.readFileSync(path.join(__dirname,'fixtures/kmp-first-frame.cpp'),'utf8')
    .replace(/^\s*vector<string> pat\(n\);\r?\n/m,'')
    .replace(/^\s*for \(int k = 0; k < n; \+\+k\) pat\[k\] = string\(1, s\[k\]\);\r?\n/m,'')
    .replace(/@frame pat/g,'@frame char(s)').replace(/\bpat\b/g,'s')
    .replace('int main()', '// @defaults\n// @camera focus s zoom(2)\n// @enddefaults\nint main()');
  const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());
  const page=await browser.newPage();await page.goto(base+'/algorithm.html');
  await page.waitForFunction(()=>document.body.dataset.defaultAnimationCache==='stored');
  await page.evaluate(code=>{aceEditor.setValue(code,-1);document.querySelector('#inputArea').value='abababca';
    window.__charDone=false;window.addEventListener('asm:compile-finished',()=>window.__charDone=true,{once:true});document.querySelector('#runBtn').click();},source);
  await page.waitForFunction(()=>window.__charDone);
  assert.equal((await page.locator('#outputArea').textContent()).trim(),'0 0 1 2 3 4 0 1');
  const result=await page.evaluate(async()=>{
    const doc=ASMTracePlayer.getDocument();const id=Object.keys(doc.variables).find(id=>doc.variables[id].name==='s');
    const index=doc.frames.findIndex(f=>f.events.some(e=>e.type==='compare'&&e.targets?.some(t=>t.variableId===id&&t.indexExpression)));
    if(index<0)return {index};
    await ASMTracePlayer.renderStable(index);
    // Zoom in before checking actual glyphs: the default whole-scene view
    // deliberately omits text below the existing 14px LOD threshold.
    window.setCamera(160,0,2,false);
    await new Promise(requestAnimationFrame);
    while(document.querySelector('#asm-trace-root [data-asm-lod-pending]')) await new Promise(requestAnimationFrame);
    const cells=[...document.querySelectorAll('#asm-trace-root > [data-trace-variable="'+id+'"] [data-trace-index]')]
      .filter(e=>!e.hasAttribute('data-trace-index-label'));
    const events=doc.frames[index].events.filter(e=>e.type==='compare'&&e.targets?.some(t=>t.variableId===id&&t.indexExpression));
    return {index,values:cells.map(e=>e.querySelector('text')?.textContent),
      names:Object.values(doc.variables).map(v=>v.name),reasons:events.map(e=>e.autoAnimationUnavailableReason||'')};
  });
  assert.ok(result.index>=0);assert.deepEqual(result.values,['a','b','a','b','a','b','c','a'],JSON.stringify(result));
  assert.ok(!result.names.includes('pat'));assert.ok(result.reasons.every(reason=>reason===''),JSON.stringify(result));
});
