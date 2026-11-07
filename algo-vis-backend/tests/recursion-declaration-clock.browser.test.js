'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('playwright'),{startIsolatedServer}=require('./helpers/isolated-server');
const {compile}=require('./helpers/compile'),{readPackage,savedTrace}=require('./helpers/deck-package');
test('recursive node and edge wait for their own declaration, including old traces and disabled declarations',{timeout:60000},async t=>{
 const {base}=await startIsolatedServer(t);process.env.ASM_TEST_BASE_URL=base;
 const body=readPackage(fs.readFileSync('public/guest-decks/merge-sort.asmdeck')).body;
 const animation=body.deck.groups.flatMap(g=>g.slides).find(s=>s.animation).animation;
 const saved=savedTrace(body,animation);
 const styled=animation.code.replace('// @frame num with range(L,R) in split_tree','// @frame num with range(L,R) in split_tree\n    // @style num[L:R] mark,highlight\n    // @style num[L] point');
 const {trace:fresh}=await compile(styled,'4\n4 1 3 2\n');
 const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/algorithm.html?asmEmbed=runtime');await page.waitForFunction(()=>window.ASMTracePlayer);
 for(const [kind,trace]of[['saved',saved],['fresh',fresh],['legacy',saved],['reflow',fresh],['disabled',saved]])for(const speed of [1,2]){
  const report=await page.evaluate(async({trace,kind,speed})=>{
   const copy=JSON.parse(JSON.stringify(trace));
   if(kind==='reflow')copy.layouts.forEach(l=>{if(l.id==='split_tree')l.reserve=false;});
   if(kind==='legacy')copy.frames.forEach(f=>f.events.forEach(e=>{if(e.type==='declare')delete e.recursionActivationId;}));
   if(kind==='disabled'){
    copy.studio.eventSettings={...copy.studio.eventSettings,defaultEnabled:{...copy.studio.eventSettings?.defaultEnabled,declare:false}};
    copy.frames.forEach(f=>f.events.forEach(e=>{if(e.type==='declare')e.enabled=false;}));
   }
   const doc=ASMTracePlayer.apply(copy);doc.studio.codePanelScrollMs=0;
   window.asmGetAnimationPlaybackRate=()=>speed;window.ASMTraceCamera={...ASMTraceCamera,apply(){},transitionDuration:()=>0};
   const matches=doc.frames.map((f,i)=>f.source.layoutId==='split_tree'&&f.source.recursionParentActivationId?i:-1).filter(i=>i>=0);
   const index=kind==='reflow'?matches.at(-1):matches[0];
   const frame=doc.frames[index],activation=frame.source.recursionActivationId,variable=frame.source.primaryVariableId;
   const event=frame.events.find(e=>e.type==='declare'&&e.targets?.some(t=>t.variableId===variable));
   await ASMTracePlayer.render(index-1,{stable:true});
   const opacity=node=>{let value=1;for(let p=node;p&&p.id!=='arraySvg';p=p.parentElement){const s=getComputedStyle(p);if(s.display==='none'||s.visibility==='hidden')return 0;value*=Number(s.opacity);}return value;};
   const read=(includeKeep=false)=>{
    const node=[...document.querySelectorAll('#asm-trace-root [data-trace-layout-node]')].find(n=>n.dataset.traceLayoutId==='split_tree'&&n.dataset.traceLayoutActivation===activation&&(includeKeep||!n.closest('.asm-trace-snapshot')));
    const outer=node?.querySelector('.outerframe-bg'),box=outer?.getBoundingClientRect();
    const parent=[...document.querySelectorAll('#asm-trace-root [data-trace-layout-node]')].find(n=>n.dataset.traceLayoutNode===node?.dataset.traceLayoutParent);
    const parentBox=parent?.querySelector('.outerframe-bg')?.getBoundingClientRect();
    const cell=node?.querySelector('[data-trace-index]'),cellBox=cell?.getBoundingClientRect();
    const edge=[...document.querySelectorAll('.asm-trace-layout-edge')].find(e=>e.dataset.traceArrowToKey===node?.dataset.traceObjectKey);
    const styles=[...document.querySelectorAll('[data-trace-attached-to]')].filter(n=>n.dataset.traceAttachedTo.startsWith(variable+'#')&&!n.closest('.asm-trace-snapshot'));
    const mark=styles.find(n=>n.dataset.traceAttachmentKind==='mark'),markBox=mark?.getBoundingClientRect();
    return{opacity:node?opacity(node.querySelector(':scope > .asm-trace-motion')||node):null,cellOpacity:cell?opacity(cell):null,
     x:box?.x,y:box?.y,w:box?.width,h:box?.height,cx:cellBox?cellBox.x+cellBox.width/2:null,px:parentBox?parentBox.x+parentBox.width/2:null,py:parentBox?parentBox.y+parentBox.height/2:null,
     edge:edge?opacity(edge):null,yellow:!!document.querySelector('.asm-trace-code-panel .is-active'),
     styles:styles.map(n=>opacity(n)),markX:markBox&&cellBox?(markBox.x-cellBox.x)/cellBox.width:null,
     transform:node?.querySelector(':scope > .asm-trace-motion')?.getAttribute('transform')||''};
   };
   const native={raf:requestAnimationFrame,cancel:cancelAnimationFrame,now:Object.getOwnPropertyDescriptor(performance,'now')};
   let clock=performance.now(),elapsed=0,serial=0;const callbacks=new Map(),samples=[];
   window.requestAnimationFrame=f=>{callbacks.set(++serial,f);return serial;};window.cancelAnimationFrame=id=>callbacks.delete(id);
   Object.defineProperty(performance,'now',{configurable:true,value:()=>clock});
   const restore=()=>{window.requestAnimationFrame=native.raf;window.cancelAnimationFrame=native.cancel;if(native.now)Object.defineProperty(performance,'now',native.now);else delete performance.now;};
   try{
    const pending=ASMTracePlayer.render(index,{fromIndex:index-1,forceTransition:true}),plan=ASMTracePlayer.getLastPlaybackPlan();
    const steps=plan.phases.flatMap(p=>p.steps||[]),slot=steps.find(s=>s.eventId===event.id);
    const stop=(slot?.endMs||plan.totalDurationMs)+100;
    while(elapsed*speed<stop){elapsed+=10;clock+=10;const batch=[...callbacks.values()];callbacks.clear();batch.forEach(f=>f(clock));for(let n=0;n<10;n++)await Promise.resolve();samples.push({at:elapsed*speed,...read()});}
    restore();ASMTraceFrameTween.cancel();await pending;const final=read();
    await ASMTracePlayer.render(index+1,{stable:true});const kept=read(true);
    return{kind,speed,eventId:event.id,slot,moves:steps.filter(s=>s.targetKey===variable),samples,final,kept};
   }finally{restore();ASMTraceFrameTween.cancel();}
  },{trace,kind,speed});
  if(kind==='disabled'){
   assert.equal(report.slot,undefined);assert.ok(report.samples.every(s=>s.opacity>.99),'disabled declaration commits immediately');
   assert.ok(report.samples.every(s=>!s.transform.includes('scale(0.')),'disabled declaration does not grow');
  }else{
   assert.ok(report.slot);assert.equal(report.slot.codePromptDurationMs,200);assert.equal(report.slot.visualDurationMs,220);
   const before=report.samples.filter(s=>s.at>40&&s.at<report.slot.visualStartMs);
   assert.ok(before.length>2);assert.ok(before.every(s=>s.opacity===0&&s.cellOpacity===0&&s.edge===0),JSON.stringify({kind,speed,before}));
   assert.ok(before.some(s=>s.at>report.slot.startMs&&s.yellow),'yellow prompt precedes visible growth');
   const origin=before.at(-1);
   assert.ok(origin.px!=null&&Math.abs(origin.x+origin.w/2-origin.px)<2&&Math.abs(origin.y+origin.h/2-origin.py)<2,JSON.stringify({kind,speed,origin}));
   const moving=report.samples.filter(s=>s.at>report.slot.visualStartMs+40&&s.at<report.slot.endMs-30);
   assert.ok(moving.every(s=>s.opacity>0&&s.cellOpacity>0&&s.edge>0),JSON.stringify({kind,speed,moving}));
   assert.ok(new Set(moving.map(s=>s.y?.toFixed(2))).size>=3,'node visibly moves during declaration');
   assert.ok(moving.every(s=>s.cx>=s.x-1&&s.cx<=s.x+s.w+1),'cells move with outerframe');
   if(kind==='fresh'){
    assert.ok(before.every(s=>s.styles.length>=3&&s.styles.every(a=>a===0)),'mark/highlight/point wait with the node');
    assert.ok(moving.every(s=>s.styles.every(a=>a>0)),'styles appear with the node');
    assert.ok(moving.every(s=>Math.abs(s.markX-report.final.markX)<.03),'mark stays at the same position relative to its scaled cell');
   }
   assert.equal(report.moves[0]?.startMs,report.slot.visualStartMs);assert.equal(report.moves[0]?.durationMs,220);
  }
  assert.ok(report.final.opacity>.99&&report.final.cellOpacity>.99);
  if(kind!=='reflow'){assert.ok(report.kept.opacity>.99);assert.doesNotMatch(report.kept.transform,/scale\(/,'keep does not replay node growth');}
 }
 assert.deepEqual(errors,[]);
});
