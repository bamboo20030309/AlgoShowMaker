const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path');
const {chromium}=require('playwright');

test('loop arrows move, enter and exit independently of runtime event switches',{timeout:90000},async()=>{
  const base=process.env.ASM_TEST_BASE_URL;assert.ok(base,'set ASM_TEST_BASE_URL to an isolated server');
  const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/algorithm.html');await page.waitForFunction(()=>window.ace && window.ASMTracePlayer);
    const code=fs.readFileSync(path.join(__dirname,'fixtures/style-replay-sieve.cpp'),'utf8');
    await page.evaluate(code=>{ace.edit('editor').setValue(code,-1);document.querySelector('#inputArea').value='30';},code);
    await page.click('#runBtn');await page.waitForFunction(code=>window.ASMTracePlayer.getDocument()?.sourceCode===code,code,{timeout:30000});
    const result=await page.evaluate(async()=>{
      const player=window.ASMTracePlayer,source=JSON.parse(JSON.stringify(player.getDocument()));
      const iId=Object.keys(source.variables).find(id=>source.variables[id].name==='i');
      const indices=[8,9,10].map(i=>source.frames.findIndex(f=>f.eventControls.length && f.state[iId]?.data.value===i));
      if(indices.some(index=>index<0))throw Error('compact frames missing');
      const current=()=>[...document.querySelectorAll('#asm-trace-root [data-trace-arrow-source="directive"]')]
        .filter(node=>!node.closest('.asm-trace-transition-ghost-motion')).map(node=>({id:node.dataset.traceArrow,
          j:Number(node.dataset.traceArrowFromKey.split('#').at(-1)),target:node.dataset.traceArrowToKey.split('#').at(-1),
          opacity:node.hasAttribute('opacity')?Number(node.getAttribute('opacity')):1,
          pair:node._asmArrowTween?.previous.dataset.traceArrowToKey.split('#').at(-1)||null,
          progress:node._asmArrowTween?.progress??null,x:Number(node.getAttribute('x2')),y:Number(node.getAttribute('y2'))}));
      const capture=async index=>{
        let done=false;const samples=[];
        const read=()=>samples.push({arrows:current(),
          exits:[...document.querySelectorAll('#asm-trace-root .asm-trace-transition-ghost-motion')]
            .filter(wrapper=>wrapper.querySelector('[data-trace-arrow-source="directive"]'))
            .map(wrapper=>({j:Number(wrapper.querySelector('[data-trace-arrow-source="directive"]').dataset.traceArrowFromKey.split('#').at(-1)),opacity:Number(wrapper.getAttribute('opacity'))})),
          paint:(document.querySelector('#asm-trace-root')?.getAnimations({subtree:true})||[]).some(a=>['fill','stroke'].includes(a.transitionProperty) && a.playState==='running')});
        const transition=player.render(index);read();
        const observed=Promise.resolve(transition).then(()=>{done=true;});
        while(!done){await new Promise(resolve=>requestAnimationFrame(resolve));read();}
        await observed;
        return {samples,final:current(),steps:player.getLastPlaybackPlan()?.phases.find(p=>p.id==='trace-events')?.steps.length||0};
      };
      const states=[];
      for(const enabled of [false,true]){
        const doc=JSON.parse(JSON.stringify(source));
        for(const index of indices)doc.frames[index].eventControls=[{types:['all'],animate:enabled,when:null}];
        player.apply(doc);await player.render(indices[0],{animatePositions:false,animateEvents:false});
        const initial=current(),enter=await capture(indices[1]),exit=await capture(indices[2]);
        states.push({enabled,initial,enter,exit});
      }
      player.apply(JSON.parse(JSON.stringify(source)));
      await player.render(indices[0],{animatePositions:false,animateEvents:false});
      const reload=await capture(indices[1]);
      return {states,reload};
    });
    for(const state of result.states){
      const zero=state.enter.final.find(a=>a.j===0);
      assert.equal(zero.id,state.initial[0].id,'same drawing slot keeps identity across loop invocations');
      assert.ok(state.enter.samples.some(s=>s.arrows.some(a=>a.j===0 && a.pair==='16' && a.progress>0 && a.progress<1)),'j=0 interpolates from target16 to18');
      const differs=(a,b)=>Math.abs(a.x-b.x)>0.01 || Math.abs(a.y-b.y)>0.01;
      assert.ok(state.enter.samples.some(s=>s.arrows.some(a=>a.j===0 && a.pair==='16' && a.progress>0 && a.progress<1
        && differs(a,state.initial[0]) && differs(a,zero))),'the actual SVG endpoint travels between its previous and final positions');
      assert.ok(state.enter.samples.some(s=>s.arrows.some(a=>a.j===1 && a.opacity>0 && a.opacity<1)),'new j=1 arrow fades in');
      assert.ok(state.exit.samples.some(s=>s.arrows.some(a=>a.j===0 && a.pair==='18' && a.progress>0 && a.progress<1)),'j=0 interpolates from target18 to20');
      assert.ok(state.exit.samples.some(s=>s.arrows.some(a=>a.j===0 && a.pair==='18' && a.progress>0 && a.progress<1
        && differs(a,zero) && differs(a,state.exit.final.find(a=>a.j===0)))),'the surviving SVG endpoint moves when another batch arrow exits');
      assert.ok(state.exit.samples.some(s=>s.exits.some(a=>a.j===1 && a.opacity>0 && a.opacity<1)),'removed j=1 arrow fades out');
      assert.deepEqual(state.enter.final.map(a=>a.target),['18','27']);assert.deepEqual(state.exit.final.map(a=>a.target),['20']);
      if(state.enabled)assert.ok(state.enter.steps>0);else{
        assert.equal(state.enter.steps,0);assert.equal(state.exit.steps,0);
        assert.ok(state.enter.samples.some(s=>s.paint),'style paint still transitions with events off');
      }
    }
    assert.ok(result.reload.samples.some(s=>s.arrows.some(a=>a.j===0 && a.pair==='16' && a.progress>0 && a.progress<1)),'JSON reload retains arrow motion');
    assert.deepEqual(result.reload.final.map(a=>a.target),['18','27']);assert.equal(result.reload.steps,0);
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
});
