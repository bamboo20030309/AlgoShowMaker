const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { compile } = require('./helpers/compile');

const code = `#include <vector>
using namespace std;
// @layout recursion as tree
// @layout tree level-gap 60
// @layout linear as notes at tree.root.bottom offset(0,160)
// @layout linear as placed_notes
// @place placed_notes.top-left at tree.root.bottom-left offset(20,160)
void visit(vector<int>& a,int L,int R){
  int p=L;
  // @frame a with range(L,R) in tree
  // @pointer p at tree.current
  // @keep last as "node" in tree
  if(L<R){ visit(a,L,L); visit(a,R,R); }
}
int main(){
  vector<int> a={3,7}; visit(a,0,1);
  int i=0,j=1,x=8,y=9,z=10;
  // @frame z in notes
  // @object x at tree.root.right offset(40,0)
  // @object y at tree.leaves[0].left offset(-40,0)
  // @place y.top-left at tree.leaves[0].bottom-left offset(0,100)
  // @pointer i at tree.root
  // @pointer j at tree.leaves[1]
  // @text "root" as caption at tree.root.bottom
  // @text "level" at tree.level(1)[0].bottom
  // @text "side" at tree.side(right)[0].right
  // @camera focus tree.root
  // @keep x as "note" at tree.root.bottom offset(100,100)
  // @frame x at tree.root.right offset(40,0)
  // @object y at tree.children[0].right
  // @frame z in placed_notes
  // @frame
  // @text "done" at tree.root.bottom
}
/* @asm-view
{"version":1,"studio":{"eventSettings":{"autoFixedEnabled":false,"autoLoopBoundaryEnabled":false}}}
@asm-view */`;

test('positioning directives share layout node targets and survive legacy JSON reopening', { timeout: 60000 }, async () => {
  const { trace } = await compile(code);
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.ASM_TEST_BASE_URL + '/algorithm.html');
    const result = await page.evaluate(async trace => {
      const inspect = () => {
        const scene = document.querySelector('#asm-trace-root');
        const box = el => {
          if (!el) throw new Error('missing element');
          const r = el.getBBox();
          const m = scene.getScreenCTM().inverse().multiply(el.getScreenCTM());
          const a = new DOMPoint(r.x,r.y).matrixTransform(m);
          const b = new DOMPoint(r.x+r.width,r.y+r.height).matrixTransform(m);
          return { x:a.x,y:a.y,width:b.x-a.x,height:b.y-a.y };
        };
        const nodes = [...scene.querySelectorAll('[data-trace-layout-id="tree"][data-trace-layout-node]')];
        const root = nodes.find(e => e.dataset.traceLayoutActivation === trace.frames[0].source.recursionActivationId);
        const leaves = nodes.filter(e => Number(e.dataset.traceLayoutDepth) === 1);
        const outer = el => el.querySelector('.outerframe-bg');
        const live = name => [...scene.querySelectorAll('[data-trace-variable]')].find(e =>
          trace.variables[e.dataset.traceVariable]?.name === name && !e.closest('[data-trace-snapshot]'));
        const pointers = [...scene.querySelectorAll('[data-trace-source-variable-id]')].filter(e => !e.closest('[data-trace-snapshot]'));
        return { root:box(outer(root)), leaf:box(outer(leaves[0])), x:box(outer(live('x'))), y:box(outer(live('y'))), z:box(outer(live('z'))),
          pointers:pointers.map(e => ({ text:e.textContent,key:e.dataset.tracePointerTargetKey })),
          missingTexts:[...scene.querySelectorAll('.asm-trace-text-object')].filter(e => getComputedStyle(e).display === 'none').map(e => e.textContent) };
      };
      ASMTracePlayer.apply(trace);
      await ASMTracePlayer.render(0,{stable:true});
      const currentPointer=!!document.querySelector('[data-trace-pointer-target-key]');
      const index = trace.frames.findIndex(f => f.bindings.some(b => b.layoutTarget?.layoutSelector === 'root'));
      await ASMTracePlayer.render(index,{stable:true});
      const initial=inspect();
      const saved=JSON.parse(JSON.stringify(ASMTracePlayer.getDocument()));
      ASMTracePlayer.apply(saved);
      await ASMTracePlayer.render(index,{stable:true});
      const reopened=inspect();
      const alternatives=[];
      for(const descriptor of [
        {layoutId:'tree',layoutSelector:'nodes',indexExpressions:['0']},
        {layoutId:'tree',layoutSelector:'level',layoutLevelExpression:'0',indexExpressions:['0']},
        {layoutId:'tree',layoutSelector:'side',layoutSide:'right',indexExpressions:['0']}
      ]){
        const copy=JSON.parse(JSON.stringify(saved));
        copy.frames[index].bindings.find(b=>b.layoutTarget.layoutSelector==='root').layoutTarget=descriptor;
        ASMTracePlayer.apply(copy); await ASMTracePlayer.render(index,{stable:true});
        alternatives.push(inspect().pointers);
      }
      ASMTracePlayer.apply(saved);
      await ASMTracePlayer.render(index+1,{fromIndex:index,forceTransition:true});
      const frameX=[...document.querySelectorAll('[data-trace-variable]')].find(e=>trace.variables[e.dataset.traceVariable]?.name==='x'&&!e.closest('[data-trace-snapshot]'));
      if(!frameX?.dataset.traceBound) throw new Error('primary frame at root not bound');
      await ASMTracePlayer.render(index+2,{stable:true});
      const layoutPlacement=ASMTraceRenderers.currentPlacement('placed_notes',false);
      const rootPoint=ASMTraceRenderers.resolveAnchor(saved,saved.frames[index+2],{objectKey:'tree.root',anchor:'bottom-left'});
      await ASMTracePlayer.render(saved.frames.length-1,{stable:true});
      const finalText=[...document.querySelectorAll('.asm-trace-text-object')].find(e=>e.textContent==='done');
      const keep=[...document.querySelectorAll('[data-trace-snapshot]')].find(e=>e.textContent.includes('note'));
      return {initial,reopened,alternatives,currentPointer,layoutPlacement,rootPoint,finalVisible:!!finalText && getComputedStyle(finalText).display!=='none',
        hasKeep:!!keep,autoFixed:ASMTracePlayer.getDocument().studio.eventSettings.autoFixedEnabled};
    },trace);
    for(const r of [result.initial,result.reopened]){
      assert.ok(Math.abs(r.x.x-(r.root.x+r.root.width+48))<1,JSON.stringify(r));
      assert.ok(Math.abs(r.y.x-r.leaf.x)<1,JSON.stringify(r));
      assert.ok(Math.abs(r.y.y-(r.leaf.y+r.leaf.height+100))<1,JSON.stringify(r));
      assert.ok(r.z.y>r.root.y+r.root.height+100,JSON.stringify(r));
      assert.equal(r.pointers.length,2,JSON.stringify(r));
      assert.deepEqual(r.missingTexts,[]);
    }
    assert.ok(result.alternatives.every(p=>p.length===2),JSON.stringify(result));
    assert.equal(result.finalVisible,true);
    assert.equal(result.hasKeep,true);
    assert.equal(result.autoFixed,false);
    assert.equal(result.currentPointer,true);
    assert.ok(Math.abs(result.layoutPlacement.x-result.rootPoint.x-20)<1,JSON.stringify(result));
    assert.ok(Math.abs(result.layoutPlacement.y-result.rootPoint.y-160)<1,JSON.stringify(result));
    assert.deepEqual(errors,[]);
  } finally { await browser.close(); }
});
