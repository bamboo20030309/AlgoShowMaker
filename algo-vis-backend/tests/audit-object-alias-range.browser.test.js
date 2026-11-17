const {test}=require('node:test'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {startIsolatedServer}=require('./helpers/isolated-server');
const {compile}=require('./helpers/compile');
test('secondary aliases preserve runtime pairing and absolute range indices hit real cells',{timeout:45000},async t=>{
 const {base}=await startIsolatedServer(t);process.env.ASM_TEST_BASE_URL=base;
 const {trace}=await compile(`#include <vector>
int main(){std::vector<int>a={1,2},b={3,4};
// @frame a as left
// @object b as right_before
b[0]=8;
// @frame a as left
// @object b as right_after
}`);
 const browser=await chromium.launch({headless:true,channel:'msedge'});t.after(()=>browser.close());
 const page=await browser.newPage();await page.goto(base+'/algorithm.html?asmEmbed=runtime');await page.waitForFunction(()=>window.ASMTraceTransitions&&window.drawArray);
 const result=await page.evaluate(async trace=>{
  const [from,to]=trace.frames;
  await ASMTraceRenderers.renderFrame(trace,from,null,{animatePositions:false,animateEvents:false});
  const rendered=[...document.querySelectorAll('#asm-trace-root [data-trace-object-key]')].map(n=>n.dataset.traceObjectKey);
  const alias=ASMTraceTransitions.runtimeSourceAlias(from,to,'right_after',new Set(rendered));
  const aliasCell=ASMTraceTransitions.runtimeSourceAlias(from,to,'right_after#1',new Set(rendered));
  const pairedCell=ASMTraceTransitions.resolve(trace,from,to,'right_after#1',new Set(rendered)).sourceKey;
  ASMTracePlayer.apply(trace);window.asmGetAnimationPlaybackRate=()=>4;
  await ASMTracePlayer.render(0,{animatePositions:false,animateEvents:false});
  await ASMTracePlayer.render(1);
  const finalCell=document.querySelector('[data-trace-object-key="right_after#0"]')?.textContent;
  const old={source:{objectId:'old-primary',primaryVariableId:'a'}};
  const legacy=[ASMTraceModel.objectKeyForVariable(old,'a'),ASMTraceModel.objectKeyForVariable(old,'b')];
  drawArray('audit-range',{x:100,y:100},Array.from({length:12},(_,i)=>i),[],[5,10],'normal',3,1,0);
  const g=getViewport().querySelector('#audit-range'),rect=g.querySelector('#cell-audit-range-0 rect');
  const cell=rect||g.querySelector('#cell-audit-range-0');
  const box=cell.getBBox(),matrix=cell.getCTM(),vp=getViewport().getCTM();
  const expected=new DOMPoint(box.x+box.width/2,box.y+box.height/2).matrixTransform(matrix).matrixTransform(vp.inverse());
  const anchor=resolvePos({ref:'audit-range',index:5,anchor:'center'});
  const rangeChecks=[];
  for(const start of [0,5]){
   drawArray('audit-other',{x:50,y:70},Array.from({length:12},(_,i)=>i),[],[start,start+5],'normal',3,1,{horizontal:10,vertical:20});
   const group=getViewport().querySelector('#audit-other');
   group.setAttribute('data-translate','11,13');group.setAttribute('transform','translate(61,83)');
   for(const local of [0,2,3,5]){
    const cell=group.querySelector('#cell-audit-other-'+local),box=cell.getBBox();
    const center=new DOMPoint(box.x+box.width/2,box.y+box.height/2).matrixTransform(cell.getCTM()).matrixTransform(getViewport().getCTM().inverse());
    const pos=resolvePos({ref:'audit-other',index:start+local,anchor:'center'});
    rangeChecks.push(Math.hypot(pos.x-center.x,pos.y-center.y));
   }
  }
  return{alias,aliasCell,pairedCell,finalCell,legacy,rangeChecks,anchor,expected:{x:expected.x,y:expected.y}};
 },trace);
 assert.equal(result.alias,'right_before','aliased secondary objects keep their runtime source identity');
 assert.equal(result.aliasCell,'right_before#1');
 assert.equal(result.pairedCell,'right_before#1');
 assert.ok(result.finalCell?.includes('8'));
 assert.deepEqual(result.legacy,['old-primary','b']);
 assert.ok(Math.hypot(result.anchor.x-result.expected.x,result.anchor.y-result.expected.y)<.1);
 assert.ok(result.rangeChecks.every(error=>error<.1),JSON.stringify(result.rangeChecks));
});
