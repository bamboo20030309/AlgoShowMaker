'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');
const { startIsolatedServer } = require('./helpers/isolated-server');
const { compile } = require('./helpers/compile');

test('selection pointers survive captures, follow authored order and advance after visual exit', {timeout:120000}, async t => {
  const {base} = await startIsolatedServer(t);
  const oldBase = process.env.ASM_TEST_BASE_URL;
  let trace;
  try {
    process.env.ASM_TEST_BASE_URL = base;
    trace = (await compile(fs.readFileSync(path.join(__dirname,'fixtures/selection-pointer-lifecycle.cpp'),'utf8'),
      '10\n1 8 7 4 2 6 3 9 10 12')).trace;
  } finally { if(oldBase === undefined) delete process.env.ASM_TEST_BASE_URL; else process.env.ASM_TEST_BASE_URL=oldBase; }
  const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
  t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:1440,height:900}}), errors=[];
  page.on('pageerror', e=>errors.push(e.message));
  await page.goto(base+'/algorithm.html');
  await page.waitForFunction(()=>window.ASMTracePlayer&&window.ASMTraceFrameTween);
  for(const [mode,speed] of [['fresh',1],['fresh',4],['legacy saved',4]]) {
    const source=JSON.parse(JSON.stringify(trace));
    if(mode==='legacy saved') source.frames.forEach(frame=>{
      delete frame.captureOrder;
      frame.events.forEach(event=>delete event.afterCapture);
    });
    const result=await page.evaluate(async ({trace,speed})=>{
      const p=ASMTracePlayer;p.apply(JSON.parse(JSON.stringify(trace)));
      window.asmGetAnimationPlaybackRate=()=>speed;
      const visible=node=>{
        if(!node)return 0;
        let opacity=1;
        for(let n=node;n&&n.nodeType===1;n=n.parentElement){
          const c=getComputedStyle(n);if(c.display==='none'||c.visibility==='hidden')return 0;
          opacity*=Number(c.opacity);
        }
        return opacity;
      };
      const read=()=>({markers:[...document.querySelectorAll('[data-trace-pointer-instance-id]')].map(node=>{
        const label=node.querySelector('.trace-variable-marker-label-text');
        const box=node.querySelector('.trace-variable-marker-label-box')?.getBoundingClientRect();
        return {label:label?.textContent,id:node.dataset.tracePointerInstanceId,transition:node.dataset.tracePointerTransition,
          ghost:!!node.closest('.asm-trace-transition-ghost-motion'),binding:node.dataset.traceBindingTarget,opacity:visible(label),
          x:box?.x,right:box?.right,y:box?.y,bottom:box?.bottom};
      }).filter(m=>m.opacity>.1), arr:visible(document.querySelector('[data-trace-object-key="'+Object.keys(p.getDocument().variables).find(id=>p.getDocument().variables[id].name==='arr')+'"] rect'))});
      const move=async from=>{
        await p.render(from,{animatePositions:false,animateEvents:false});
        const samples=[];let done=false;
        const pending=p.render(from+1).finally(()=>done=true);
        while(!done){await new Promise(requestAnimationFrame);samples.push(read());}await pending;
        return {after:read(),samples};
      };
      const first=await move(1), order=await move(10);
      const checkpoints=[];
      const onEvent=e=>{if(e.detail.phase==='end')requestAnimationFrame(()=>checkpoints.push({...read(),event:e.detail.event.source?.text}));};
      window.addEventListener('asm:trace-active-event',onEvent);
      const next=await move(11);
      // Continue from the actual animated result; a static redraw must not
      // conceal a stale position carried into the next frame.
      await p.render(13);const following=read();
      await new Promise(requestAnimationFrame);
      window.removeEventListener('asm:trace-active-event',onEvent);
      await p.render(11);const backward=read();
      await p.render(12);const replayed=read();
      await p.render(p.getDocument().frames.length-2,{animatePositions:false,animateEvents:false});
      await p.render(p.getDocument().frames.length-1);const final=read();
      p.apply(JSON.parse(JSON.stringify(p.getDocument())));await p.render(12);const reopened=read();
      return {first,order,next,following,final,reopened,checkpoints,backward,replayed};
    },{trace:source,speed});
    fs.mkdirSync(path.join(__dirname,'../test-results'),{recursive:true});
    fs.writeFileSync(path.join(__dirname,'../test-results/selection-test-result.json'),JSON.stringify(result,null,2));
    const {validateBehavior}=require('../scripts/trace-behavior-rules');
    const fixedRule=(state,contract)=>{
      const result=validateBehavior({...state,visibility:{arr:state.arr}},contract);
      assert.equal(result.pass,true,mode+': '+JSON.stringify(result.firstViolation));
    };
    const marker=(state,label)=>state.markers.find(m=>m.label===label);
    fixedRule(result.order.after,{orders:[['min_idx','i']]});
    fixedRule(result.next.after,{bindings:{i:1,min_idx:1},orders:[['i','min_idx']]});
    fixedRule(result.reopened,{bindings:{i:1,min_idx:1},orders:[['i','min_idx']]});
    fixedRule(result.backward,{bindings:{i:0},orders:[['min_idx','i']]});
    fixedRule(result.final,{visible:['arr']});
    assert.ok(result.first.samples.every(s=>marker(s,'min_idx')),speed+'x: min_idx remains visible between frames 2 and 3');
    assert.ok(marker(result.order.after,'min_idx').x < marker(result.order.after,'i').x,
      speed+'x: arr[min_idx,i] respects the authored order');
    for(const state of [result.next.after,result.reopened,result.replayed]) {
      assert.match(marker(state,'i')?.binding || '',/#1$/,speed+'x: i++ reaches index 1');
      assert.match(marker(state,'min_idx')?.binding || '',/#1$/,speed+'x: next-round minimum starts at index 1');
      assert.ok(marker(state,'i').right <= marker(state,'min_idx').x+1,speed+'x: next-round labels do not overlap');
    }
    assert.match(marker(result.following,'i')?.binding || '',/#1$/,speed+'x: subsequent frame keeps i at index 1');
    assert.match(marker(result.backward,'i')?.binding || '',/#0$/,speed+'x: reverse seek restores the previous round');
    assert.ok(marker(result.backward,'min_idx').x<marker(result.backward,'i').x,
      speed+'x: reverse seek restores arr[min_idx,i] order');
    assert.ok(result.checkpoints.length>0);
    for(const state of result.checkpoints){
      const i=marker(state,'i'), min=marker(state,'min_idx');
      if(!i||!min)continue;
      assert.ok(Math.min(i.right,min.right)-Math.max(i.x,min.x)<=1
        || Math.min(i.bottom,min.bottom)-Math.max(i.y,min.y)<=1,
        speed+'x: i and min_idx do not overlap at an event completion: '+JSON.stringify(state));
    }
    assert.ok(result.final.arr>.99,speed+'x: completed array remains visible');
  }
  assert.deepEqual(errors,[]);
});
