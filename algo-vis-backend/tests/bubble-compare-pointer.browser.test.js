'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright'),{compile}=require('./helpers/compile'),{startIsolatedServer}=require('./helpers/isolated-server');
const {validateBehavior}=require('../scripts/trace-behavior-rules');
test('bubble frame 2 to 3 lifts the pointer over 8 and lowers the pointer over 7 before their swap', {timeout:90000},async t=>{
  const {base}=await startIsolatedServer(t),oldBase=process.env.ASM_TEST_BASE_URL;
  let trace;
  try{process.env.ASM_TEST_BASE_URL=base;trace=(await compile(fs.readFileSync(path.join(__dirname,'fixtures/bubble-compare-pointer.cpp'),'utf8'),'10\n1 8 7 5 6 2 3 9 10 12')).trace;}
  finally{if(oldBase===undefined)delete process.env.ASM_TEST_BASE_URL;else process.env.ASM_TEST_BASE_URL=oldBase;}
  const comparison=trace.frames[2].events.find(e=>e.type==='compare'&&e.payload?.left?.value===8&&e.payload?.right?.value===7);
  assert.ok(comparison,'independent expected comparison is 8 > 7');
  const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/algorithm.html');await page.waitForFunction(()=>window.ASMTracePlayer&&window.ASMTraceFrameTween);
  for(const [mode,speed] of [['fresh',1],['fresh',4],['legacy saved',4]]){
    const source=JSON.parse(JSON.stringify(trace));
    if(mode==='legacy saved')source.frames.forEach(f=>{delete f.captureOrder;f.events.forEach(e=>delete e.afterCapture);});
    const result=await page.evaluate(async({trace,eventId,speed})=>{
      const p=ASMTracePlayer;p.apply(JSON.parse(JSON.stringify(trace)));window.asmGetAnimationPlaybackRate=()=>speed;
      await p.render(1,{animatePositions:false,animateEvents:false});
      const samples=[];let done=false;
      const transition=p.render(2).finally(()=>done=true);
      while(!done){await new Promise(requestAnimationFrame);
        const root=document.getElementById('asm-trace-root');if(root.dataset.traceActiveEventId!==eventId)continue;
        const markers=[...root.querySelectorAll('[data-trace-pointer-instance-id]')];
        const point=label=>{
          const node=markers.find(n=>n.querySelector('.trace-variable-marker-label-text')?.textContent===label);
          const text=node?.querySelector('.trace-variable-marker-label-text'),box=text?.getBoundingClientRect(),matrix=root.getScreenCTM();
          if(!box||!matrix)return null;
          const position=new DOMPoint(box.x+box.width/2,box.y+box.height/2).matrixTransform(matrix.inverse());
          return {x:position.x,y:position.y};
        };
        const left=point('j'),right=point('j+1');if(left&&right)samples.push({left,right});
      }
      await transition;
      p.apply(JSON.parse(JSON.stringify(p.getDocument())));await p.render(1);await p.render(2);
      const bindings=[...document.querySelectorAll('[data-trace-pointer-instance-id]')].map(n=>({label:n.querySelector('.trace-variable-marker-label-text')?.textContent,target:n.dataset.traceBindingTarget}));
      return {samples,bindings};
    },{trace:source,eventId:comparison.id,speed});
    assert.ok(result.samples.length>=3,speed+'x actual compare animation sampled');
    const peak=result.samples.reduce((best,s)=>Math.abs(s.left.y-s.right.y)>Math.abs(best.left.y-best.right.y)?s:best);
    const fixedRule=validateBehavior({markers:[{label:'j',...peak.left},{label:'j+1',...peak.right}]},
      {comparison:{leftLabel:'j',rightLabel:'j+1',leftValue:8,rightValue:7}});
    assert.equal(fixedRule.pass,true,mode+': '+JSON.stringify(fixedRule.firstViolation));
    assert.ok(peak.left.x<peak.right.x,speed+'x left/right markers remain over their respective cells');
    assert.ok(peak.left.y<peak.right.y-1,speed+'x greater 8 must lift j above smaller 7, not reverse: '+JSON.stringify(peak));
    assert.match(result.bindings.find(m=>m.label==='j')?.target||'',/#1$/,mode+': save/reopen keeps j at index 1');
    assert.match(result.bindings.find(m=>m.label==='j+1')?.target||'',/#2$/,mode+': save/reopen keeps j+1 at index 2');
  }
  assert.deepEqual(errors,[]);
});
