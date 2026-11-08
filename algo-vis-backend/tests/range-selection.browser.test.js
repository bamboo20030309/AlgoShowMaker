'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const {startIsolatedServer}=require('./helpers/isolated-server'),{compile}=require('./helpers/compile');
const code=`#include <vector>
#include <string>
int main(){int n=5,i=2;std::vector<int>a={10,20,30,40,50};std::vector<std::vector<int>>g={{1,2,3},{4,5,6},{7,8,9}};std::string s="abcde";
// @frame a[1:n-2]
// @object char(s)[1:3]
// @object g[1:2][1:]
// @pointer i at a[1:3]
// @style a[:] mark
// @style a[1:2] highlight
// @place s.top-left at a[1:3].bottom-left offset(0,80)
// @place g[1:2][1:2].top-left at s[1:3].bottom-left offset(0,80)
// @text "range" at a[1:2].top
// @arrow from a[1:2].index-label.bottom to g[1:2][1:2].top
// @camera auto
// @frame a[2]
// @frame a[:2]
// @object g[:][1]
// @frame a[3:]
// @frame a[4:2]
}`;
test('ranges compile, render original indices, position as a union and survive save/reopen',{timeout:60000},async t=>{
 const {base}=await startIsolatedServer(t);process.env.ASM_TEST_BASE_URL=base;const {trace}=await compile(code);
 assert.equal(trace.frames.length,5);
 const b=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>b.close());const p=await b.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'/algorithm.html?asmEmbed=editor');
 await p.evaluate(({trace,code})=>{asmReplaceEditorCode(code,-1);ASMTraceEditor.loadAnimation({mode:'trace',code,input:'',traceDocument:trace},{openStudio:false});},{trace,code});
 const cells=async(index,name)=>{await p.evaluate(index=>ASMTracePlayer.renderStable(index),index);return p.evaluate(name=>{const d=ASMTracePlayer.getDocument(),id=Object.keys(d.variables).find(id=>d.variables[id].name===name);return [...document.querySelectorAll('#asm-trace-root [data-trace-variable="'+id+'"] [data-trace-index]')].filter(e=>e.hasAttribute('data-trace-arrow-target-key')||e.dataset.traceDataValue!==undefined).map(e=>({index:e.dataset.traceIndex,value:e.dataset.traceDataValue}));},name);};
 const first=await cells(0,'a');assert.deepEqual(first.map(c=>c.index),['1','2','3']);assert.deepEqual(first.map(c=>c.value),['20','30','40']);
 const letters=await cells(0,'s');assert.deepEqual(letters.map(c=>c.value),['b','c','d']);
 const matrix=await cells(0,'g');assert.deepEqual(matrix.map(c=>c.value),['5','6','8','9']);
 const anchors=await p.evaluate(()=>{const d=ASMTracePlayer.getDocument(),ids=Object.fromEntries(Object.entries(d.variables).map(([id,v])=>[v.name,id]));
   const at=(name,indexExpression,anchor)=>ASMTraceRenderers.currentAnchor({variableId:ids[name],targetVariableId:ids[name],indexExpression,indexExpressions:[indexExpression],anchor});
   const one=ASMTraceRenderers.currentPlacement(ids.a+'#1',true),two=ASMTraceRenderers.currentPlacement(ids.a+'#2',true);
   return {g:at('g','1:2,1:2','top-left'),s:at('s','1:3','bottom-left'),a:at('a','1:2','top'),expected:{x:(Math.min(one.x,two.x)+Math.max(one.x+one.width,two.x+two.width))/2,y:Math.min(one.y,two.y)}};});
 assert.ok(Math.abs(anchors.a.x-anchors.expected.x)<.01&&Math.abs(anchors.a.y-anchors.expected.y)<.01,JSON.stringify(anchors));
 assert.ok(Math.abs(anchors.g.x-anchors.s.x)<.01&&Math.abs(anchors.g.y-anchors.s.y-80)<.01,JSON.stringify(anchors));
 assert.ok(await p.locator('[data-trace-arrow]').count()>0,'range endpoint produces an actual arrow');assert.ok(await p.locator('[data-trace-attachment-kind=mark]').count()>=3);
 assert.deepEqual((await cells(1,'a')).map(c=>c.value),['30']);assert.deepEqual((await cells(2,'a')).map(c=>c.index),['0','1','2']);assert.deepEqual((await cells(2,'g')).map(c=>c.value),['2','5','8']);assert.deepEqual((await cells(3,'a')).map(c=>c.index),['3','4']);assert.equal((await cells(4,'a')).length,0);
 await p.evaluate(()=>{window.saved=ASMTraceEditor.snapshot();ASMTraceEditor.loadAnimation({...saved,code:aceEditor.getValue(),input:''},{openStudio:false});});assert.deepEqual((await cells(0,'a')).map(c=>c.index),['1','2','3']);assert.deepEqual(errors,[]);
});
// 保留單格及舊 with range 行為；區段 keep、繪圖迴圈與端點回放共用原始索引。
test('range keeps and batched endpoints retain selected source indices',{timeout:60000},async t=>{
 const {base}=await startIsolatedServer(t);process.env.ASM_TEST_BASE_URL=base;
 const source=`#include <vector>
int main(){std::vector<int>a={10,20,30,40,50};int i=0;
// @frame a[:]
// @keep a[1:2] as "part"
// @frame a[:]
// @pointer i at a[1:3]
// @for k in [0:1]
// @arrow from a[k:k+1] to a[3:4]
// @endfor
// @frame a[1:3] with labels(value,index)
// @frame a with range(1,3)
}`;
 const {trace}=await compile(source);const b=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>b.close());const p=await b.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'/algorithm.html?asmEmbed=editor');await p.evaluate(({trace,source})=>{asmReplaceEditorCode(source,-1);ASMTraceEditor.loadAnimation({mode:'trace',code:source,input:'',traceDocument:trace},{openStudio:false});},{trace,source});
 const index=trace.frames.findIndex(f=>f.arrows?.some(a=>a.drawLoops?.length));assert.ok(index>=0);await p.evaluate(i=>ASMTracePlayer.renderStable(i),index);
 const facts=await p.evaluate(()=>({arrows:[...document.querySelectorAll('[data-trace-arrow]')].map(e=>e.dataset.traceArrow),snapshots:[...document.querySelectorAll('[data-trace-snapshot]')].map(e=>[...e.querySelectorAll('[data-trace-data-value]')].map(c=>c.dataset.traceDataValue)),markers:[...document.querySelectorAll('[data-trace-marker-label]')].map(e=>e.dataset.traceMarkerLabel)}));
 assert.ok(facts.arrows.length>=2);assert.ok(facts.snapshots.some(values=>JSON.stringify(values)===JSON.stringify(['20','30'])),JSON.stringify(facts));assert.deepEqual(errors,[]);
});
