const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
const {compile}=require('./helpers/compile');
test('recursive previews preserve source ownership and connect visible leaves', {timeout:60000},async()=>{
 const code=fs.readFileSync('algorithm_sample/Sorting/merge_sort_recursive_layout.cpp','utf8').replace(/\r\n?/g, '\n').replace('branch-previews off','branch-previews on');
 const {trace}=await compile(code,'8\n82 38 27 43 3 9 10 15\n');
 const snapshots=new Map(trace.snapshots.map(s=>[s.id,s]));
 for(const frame of trace.frames.filter(f=>f.source.systemBranchPreview)){
  const child=snapshots.get(frame.source.previewSnapshotId);
  assert.ok(frame.snapshotIds.some(id=>snapshots.get(id)?.layoutId===child.layoutId&&snapshots.get(id)?.recursionActivationId===child.recursionParentActivationId),
   'preview retains the parent before growing the child');
  assert.equal(frame.source.layoutId,snapshots.get(frame.source.previewSnapshotId).frame.source.layoutId,
   'preview layout comes from the saved source frame, not the next keep execution frame');
 }
 const leafFrames=trace.frames.filter(f=>!f.source.systemBranchPreview&&f.source.layoutId==='merge_tree'&&/part/.test(f.source.primaryVariableId));
 for(const frame of leafFrames){
  assert.ok(frame.arrows.some(a=>!a.retainedFromArrowId||a.from.layoutActivationId===frame.source.recursionActivationId),
   'a visible live merge leaf has its own link immediately, not after its next keep');
 }
 const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.goto(process.env.ASM_TEST_BASE_URL+'/algorithm.html');
 const result=await page.evaluate(async trace=>{
  window.asmGetAnimationPlaybackRate=()=>4;
  window.ASMTracePlayer.apply(trace);
  const reports=[];
  const targets=[trace.frames.findIndex(f=>f.source.systemBranchPreview),trace.frames.findIndex(f=>f.events.some(e=>e.operation==='push_back'&&e.payload.beforeSize===1))];
  for(const index of targets){
   await window.ASMTracePlayer.render(index-1,{stable:true});
   let done=false;const samples=[];
   const transition=window.ASMTracePlayer.render(index,{fromIndex:index-1,forceTransition:true}).finally(()=>done=true);
   while(!done){await new Promise(r=>requestAnimationFrame(r));const root=document.querySelector('#asm-trace-root');
    const transfers=[...root.querySelectorAll('.asm-trace-assign-transfer')].map(e=>({text:e.textContent,cls:e.getAttribute('class'),source:e.dataset.traceTransferSourceSnapshot}));
    if(transfers.length)samples.push({event:root.dataset.traceActiveEventId,transfers});
   }await transition;
   reports.push({index:index+1,samples,arrows:trace.frames[index].arrows.length});
  }
  const leafIndex=trace.frames.findIndex(f=>!f.source.systemBranchPreview&&f.source.layoutId==='merge_tree'&&f.arrows.length===2&&f.source.objectId==='merged'&&/:num@/.test(f.source.primaryVariableId));
  if(leafIndex<0) throw new Error('missing two-linked merge leaf fixture');
  await window.ASMTracePlayer.render(leafIndex,{stable:true});
  reports.push({leafIndex:leafIndex+1,visibleLinks:document.querySelectorAll('#asm-trace-root [data-trace-arrow-source="directive"]').length});
  return reports;
 },trace);
 const push=result[1];
 assert.ok(push.samples.length,'push has a visible source transfer');
 for(const sample of push.samples){
  assert.equal(sample.transfers.length,1,'exactly one flying cell per insertion');
  assert.equal(sample.transfers[0].text,'82','the existing 38 cell is not transferred again');
  const source=snapshots.get(sample.transfers[0].source);
  assert.equal(source.layoutId,'merge_tree','use the completed lower leaf, not a top split preview');
 }
 assert.equal(result[2].visibleLinks,2,'both leaf links are drawn as soon as the second merge leaf is visible');
 }finally{await browser.close();}
});
