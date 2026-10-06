const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {compile}=require('./helpers/compile');
const {startIsolatedServer}=require('./helpers/isolated-server');
test('expression pointers display i-1 and track the same cells as object bindings',{timeout:90000},async t=>{
 const {base}=await startIsolatedServer(t);const previous=process.env.ASM_TEST_BASE_URL;process.env.ASM_TEST_BASE_URL=base;
 t.after(()=>{if(previous)process.env.ASM_TEST_BASE_URL=previous;else delete process.env.ASM_TEST_BASE_URL;});
 const code=`#include <vector>
int main(){std::vector<int> p(8);int i=1,j=1;
// @frame p[i-1]
// @frame p
// @pointer i-1 at p color #123456
i++;
// @frame p[i-1]
// @frame p
// @pointer i-1 at p color #123456
// @frame p
// @pointer i+j at p
}`;
 const {trace}=await compile(code);const id=Object.keys(trace.variables).find(id=>trace.variables[id].name==='p');
 const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/algorithm.html?asmEmbed=runtime');await page.waitForFunction(()=>!!window.ASMTraceRenderers);
 await page.addScriptTag({url:base+'/slides-storage.js'});
 const result=await page.evaluate(async raw=>{
  let doc=ASMTraceModel.normalizeTraceDocument(raw);
  const inspect=()=>[...document.querySelectorAll('[data-trace-pointer-id]')].map(el=>({label:el.querySelector('.trace-variable-marker-label-text')?.textContent,target:el.dataset.tracePointerTargetKey,fill:el.querySelector('.trace-variable-marker-label-box')?.getAttribute('fill')}));
  const outputs=[];for(const frame of doc.frames){await ASMTraceRenderers.renderFrame(doc,frame,null,{animatePositions:false,animateEvents:false});outputs.push(inspect());}
  const store=ASMSlideStorage.create(indexedDB,localStorage);const key=await ASMSlideStorage.digest(ASMSlideStorage.canonical(doc));await store.putTrace(key,doc);doc=ASMTraceModel.normalizeTraceDocument(await store.loadTrace(key));
  await ASMTraceRenderers.renderFrame(doc,doc.frames[3],null,{animatePositions:false,animateEvents:false});const reopened=inspect();
  const old=structuredClone(doc);old.frames[0].bindings.forEach(b=>{delete b.explicitPointer;delete b.implicitIndex;delete b.label;});
  const oldKey=await ASMSlideStorage.digest(ASMSlideStorage.canonical(old));await store.putTrace(oldKey,old);const legacy=ASMTraceModel.normalizeTraceDocument(await store.loadTrace(oldKey));
  await ASMTraceRenderers.renderFrame(legacy,legacy.frames[0],null,{animatePositions:false,animateEvents:false});
  return {outputs,reopened,legacy:inspect()};
 },trace);
 assert.deepEqual(result.outputs.map(list=>list.map(p=>[p.label,p.target])),[[['i-1',id+'#0']],[['i-1',id+'#0']],[['i-1',id+'#1']],[['i-1',id+'#1']],[['i+j',id+'#3']]]);
 assert.equal(result.outputs[1][0].fill,'#123456');assert.deepEqual(result.reopened,result.outputs[3]);assert.deepEqual(result.legacy,result.outputs[0]);assert.deepEqual(errors,[]);
});
