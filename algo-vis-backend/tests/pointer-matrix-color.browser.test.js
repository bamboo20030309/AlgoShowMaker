const test=require('node:test'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {startIsolatedServer}=require('./helpers/isolated-server');

test('matrix axes and pointer colors render, move, hide out of range and survive stored trace round trips', {timeout:60000},async t=>{
 const {base}=await startIsolatedServer(t);
 const code=`#include <vector>
// @layout recursion as tree
int main(){std::vector<std::vector<int>> dp={{1,2,3},{4,5,6}};std::vector<int>a={8,9,10};int i=1,j=2;
// @frame dp render matrix with labels(none), marker-layout(none)
// @pointer i at dp.row color AV_blue
// @pointer j at dp.column color #ff0088
i--;j--;
// @frame dp render matrix with labels(none), marker-layout(none)
// @pointer i at dp.row color AV_blue
// @pointer j at dp.column color #ff0088
i=9;
// @frame dp render matrix
// @pointer i at dp.row
// @pointer j at dp.column
i=1;
// @frame a in tree
// @pointer i at a color rgb(1, 2, 3)
// @pointer j at tree.current color AV_green!
}`;
 const result=await(await fetch(base+'/compile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,trace:{enabled:true,sliceMode:'manual'}})})).json();
 assert.equal(result.error,'');
 assert.ok(result.traceDocument || result.trace,JSON.stringify(result));
 const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/algorithm.html?asmEmbed=runtime');
 await page.waitForFunction(()=>Boolean(window.ASMTraceRenderers&&window.ASMTraceModel));
 await page.addScriptTag({url:base+'/slides-storage.js'});
 const checks=await page.evaluate(async raw=>{
   let trace=ASMTraceModel.normalizeTraceDocument(raw);
   const frames=trace.frames.filter(f=>f.bindings?.some(b=>b.explicitPointer));
   const inspect=()=>[...document.querySelectorAll('[data-trace-pointer-id]')].filter(n=>!n.closest('.asm-trace-snapshot')).map(n=>({name:n.querySelector('.trace-variable-marker-label-text')?.textContent,target:n.dataset.tracePointerTargetKey,fill:n.querySelector('.trace-variable-marker-label-box')?.getAttribute('fill'),stroke:n.querySelector('.trace-variable-marker-point path')?.getAttribute('stroke'),lane:n.dataset.tracePointerLane}));
   const outputs=[];
   for(const frame of frames){await ASMTraceRenderers.renderFrame(trace,frame,null,{animatePositions:false,animateEvents:false});outputs.push(inspect());}
   // Persist and reopen the new metadata and custom settings through IndexedDB.
   const store=ASMSlideStorage.create(indexedDB,localStorage);
   const newKey=await ASMSlideStorage.digest(ASMSlideStorage.canonical(trace));
   await store.putTrace(newKey,trace);
   trace=ASMTraceModel.normalizeTraceDocument(await store.loadTrace(newKey));
   await ASMTraceRenderers.renderFrame(trace,trace.frames.find(f=>f.bindings.some(b=>b.pointerColor==='AV_blue')),null,{animatePositions:false,animateEvents:false});
   const reopened=inspect();
   // Older array bindings contain neither pointerAxis nor pointerColor.
   const old=structuredClone(trace),frame=old.frames.find(f=>f.bindings.some(b=>b.pointerColor==='rgb(1, 2, 3)'));
   frame.bindings=frame.bindings.filter(b=>!b.layoutTarget);
   frame.bindings.forEach(b=>{delete b.pointerAxis;delete b.pointerColor;delete b.implicitIndex;});
   const oldKey=await ASMSlideStorage.digest(ASMSlideStorage.canonical(old));
   await store.putTrace(oldKey,old);
   const legacy=ASMTraceModel.normalizeTraceDocument(await store.loadTrace(oldKey));
   await ASMTraceRenderers.renderFrame(legacy,legacy.frames.find(f=>f.id===frame.id),null,{animatePositions:false,animateEvents:false});
   return {outputs,reopened,legacy:inspect(),options:trace.frames.find(f=>f.bindings.some(b=>b.pointerAxis)).rendererOptions};
 },result.traceDocument || result.trace);
 assert.equal(checks.outputs.length,4);
 const find=(list,name)=>list.find(p=>p.name===name);
 assert.ok(find(checks.outputs[0],'i').target.endsWith(':row-label:1'));
 assert.ok(find(checks.outputs[0],'j').target.endsWith(':column-label:2'));
 assert.equal(find(checks.outputs[0],'i').lane,'left');
 assert.equal(find(checks.outputs[0],'j').lane,'top');
 assert.equal(find(checks.outputs[0],'i').fill,'rgba(144, 202, 249, 0.6)');
 assert.equal(find(checks.outputs[0],'i').stroke,'rgba(144, 202, 249, 0.6)');
 assert.equal(find(checks.outputs[0],'j').fill,'#ff0088');
 assert.ok(find(checks.outputs[1],'i').target.endsWith(':row-label:0'));
 assert.ok(find(checks.outputs[1],'j').target.endsWith(':column-label:1'));
 assert.equal(find(checks.outputs[2],'i'),undefined);
 assert.equal(find(checks.outputs[2],'j').fill,'#bfe8f7');
 assert.equal(find(checks.outputs[3],'i').stroke,'rgb(1, 2, 3)');
 assert.equal(find(checks.outputs[3],'j').stroke,'#a5d6a7');
 assert.deepEqual(checks.reopened,checks.outputs[0]);
 assert.equal(checks.legacy[0].fill,'#bfe8f7');assert.equal(checks.legacy[0].stroke,'#333');
 assert.equal(Object.values(checks.options)[0].markerLayout,'none');
 assert.deepEqual(errors,[]);
});
