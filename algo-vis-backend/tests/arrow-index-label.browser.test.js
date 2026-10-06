const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {compile}=require('./helpers/compile');
const {startIsolatedServer}=require('./helpers/isolated-server');

test('KMP index-label arrows reach actual index rectangles and survive saved traces', {timeout:90000}, async t=>{
  const {base}=await startIsolatedServer(t);
  const previous=process.env.ASM_TEST_BASE_URL;process.env.ASM_TEST_BASE_URL=base;
  t.after(()=>{if(previous)process.env.ASM_TEST_BASE_URL=previous;else delete process.env.ASM_TEST_BASE_URL;});
  const code=`#include <iostream>
#include <string>
#include <vector>
using namespace std;
int main(){string s;cin>>s;int n=s.size();vector<int> p(n,0);int probe=7;
// @preset view
// @object char(s) with labels(value,index)
// @object p with labels(value,index)
// @place s.left-bottom at p.left-top offset(0,-90)
// @endpreset
// @frame use view
for(int i=1;i<n;i++){int j=p[i-1];
while(j>0 && s[i]!=s[j]){
// @frame use view
// @object probe
// @place probe.top at s[p[j-1]].index-label.bottom offset(0,30)
// @text "index target" at s[p[j-1]].index-label.bottom
// @camera focus s[p[j-1]].index-label zoom(2)
// @pointer i at s
// @pointer j at s
// @pointer j at p
// @style p[0:i-1] focus
// @arrow from p[j] to p[j-1] as "ordinary" head none
// @arrow from p[j-1] to s[p[j-1]].index-label.bottom as "fallback-target" head none
// @arrow from p[j].index-label.top to p[j-1].top as "from-index" head none
j=p[j-1];}
if(s[i]==s[j])j++;
p[i]=j;}
// @frame use view
for(int i=0;i<n;i++)cout<<p[i]<<' ';
}`;
  const {trace}=await compile(code,'abababca');
  const sId=Object.keys(trace.variables).find(id=>trace.variables[id].name==='s');
  const pId=Object.keys(trace.variables).find(id=>trace.variables[id].name==='p');
  const frames=trace.frames.map((f,i)=>({f,i})).filter(({f})=>f.arrows.some(a=>a.id==='fallback-target'));
  assert.equal(frames.length,2);
  assert.deepEqual(Array.from(trace.frames.at(-1).state[pId].data.items,x=>Number(x.value)),[0,0,1,2,3,4,0,1]);
  const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/algorithm.html');await page.waitForFunction(()=>document.body.dataset.defaultAnimationCache==='stored');await page.click('[data-tab="tab-canvas"]');
  const inspect=async (document,index)=>{
    await page.evaluate(async ({document,index})=>{asmApplyTraceDocument(document);await ASMTracePlayer.renderStable(index);setCamera(180,0,2,false);},{document,index});
    await page.waitForFunction(()=>!document.querySelector('#asm-trace-root [data-asm-lod-pending]'));
    return page.evaluate(()=>{
      const root=document.querySelector('#asm-trace-root');
      const point=(el,anchor)=>{
        const rect=el.querySelector(':scope > rect')||el;const b=rect.getBBox();const m=root.getScreenCTM().inverse().multiply(rect.getScreenCTM());
        const x=b.x+b.width/2,y=anchor==='bottom'?b.y+b.height:anchor==='top'?b.y:b.y+b.height/2;
        return {x:m.a*x+m.c*y+m.e,y:m.b*x+m.d*y+m.f};
      };
      return [...root.querySelectorAll('[data-trace-arrow]')].map(a=>{
        const from=a.dataset.traceArrowFromKey,to=a.dataset.traceArrowToKey;
        const fromEl=[...root.querySelectorAll('[data-trace-object-key]')].find(e=>e.dataset.traceObjectKey===from);
        const toEl=[...root.querySelectorAll('[data-trace-object-key]')].find(e=>e.dataset.traceObjectKey===to);
        return {id:a.dataset.traceArrow,from,to,fromPoint:point(fromEl,a.dataset.traceArrowFromAnchor),toPoint:point(toEl,a.dataset.traceArrowToAnchor),
          x1:Number(a.getAttribute('x1')),y1:Number(a.getAttribute('y1')),x2:Number(a.getAttribute('x2')),y2:Number(a.getAttribute('y2'))};
      });
    });
  };
  for(let k=0;k<frames.length;k++){
    const arrows=await inspect(JSON.parse(JSON.stringify(trace)),frames[k].i);
    const target=arrows.find(a=>a.id==='fallback-target');
    assert.equal(frames[k].f.camera.target.indexLabel,true,'camera uses the shared endpoint descriptor');
    const bound=await page.evaluate(()=>[...document.querySelectorAll('#asm-trace-root [data-trace-binding-target]')]
      .map(el=>({key:el.dataset.traceObjectKey,target:el.dataset.traceBindingTarget})));
    const probeId=Object.keys(trace.variables).find(id=>trace.variables[id].name==='probe');
    assert.ok(bound.some(item=>item.key===probeId && item.target===`${sId}#${[2,0][k]}:index`),JSON.stringify(bound));
    assert.ok(bound.some(item=>item.key.startsWith('text:') && item.target===`${sId}#${[2,0][k]}:index`),JSON.stringify(bound));
    assert.equal(target.to,`${sId}#${[2,0][k]}:index`);
    assert.ok(Math.abs(target.x2-target.toPoint.x)<0.1 && Math.abs(target.y2-target.toPoint.y)<0.1,JSON.stringify(target));
    const source=arrows.find(a=>a.id==='from-index');
    assert.match(source.from,/:index$/);
    assert.ok(Math.abs(source.x1-source.fromPoint.x)<0.1 && Math.abs(source.y1-source.fromPoint.y)<0.1,JSON.stringify(source));
    assert.ok(!arrows.find(a=>a.id==='ordinary').to.endsWith(':index'));
  }
  const hidden=JSON.parse(JSON.stringify(trace));
  hidden.frames[frames[0].i].rendererOptions[sId].indexMode=0;
  hidden.frames[frames[0].i].rendererOptions[sId].indexLabels={mode:'none',values:[]};
  const hiddenArrows=await inspect(hidden,frames[0].i);
  assert.ok(!hiddenArrows.some(a=>a.id==='fallback-target'),'hidden indices do not redirect arrows to value cells');
  assert.ok(hiddenArrows.some(a=>a.id==='ordinary'));
  const legacy=JSON.parse(JSON.stringify(trace));
  delete legacy.frames[frames[0].i].arrows.find(a=>a.id==='fallback-target').to.indexLabel;
  const legacyArrow=(await inspect(legacy,frames[0].i)).find(a=>a.id==='fallback-target');
  assert.equal(legacyArrow.to,`${sId}#2`,'old endpoints without indexLabel remain value-cell endpoints');
  assert.deepEqual(errors,[]);
});
