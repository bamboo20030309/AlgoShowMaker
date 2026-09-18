const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs'),path=require('path');
const {chromium}=require('playwright');

test('sieve frame styles follow forward, backward and repeated playback',{timeout:90000},async()=>{
  const base=process.env.ASM_TEST_BASE_URL;
  assert.ok(base,'set ASM_TEST_BASE_URL to an isolated server');
  const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base+'/algorithm.html');
    await page.waitForFunction(()=>window.ace && window.ASMTracePlayer);
    const code=fs.readFileSync(path.join(__dirname,'fixtures/style-replay-sieve.cpp'),'utf8');
    await page.evaluate(code=>{ace.edit('editor').setValue(code,-1);document.querySelector('#inputArea').value='30';},code);
    await page.click('#runBtn');
    await page.waitForFunction(code=>window.ASMTracePlayer.getDocument()?.sourceCode===code,code,{timeout:30000});
    const result=await page.evaluate(async()=>{
      const player=window.ASMTracePlayer,doc=player.getDocument();
      const ids=Object.keys(doc.variables).filter(id=>['isprime','prime'].includes(doc.variables[id].name));
      const iId=Object.keys(doc.variables).find(id=>doc.variables[id].name==='i');
      const indices=[8,9].map(i=>doc.frames.findIndex(f=>f.eventControls.length && f.state[iId]?.data.value===i));
      if(indices.some(index=>index<0))throw Error('compact frames missing');
      const read=()=>({
        cells:[...document.querySelectorAll('#arraySvg [data-trace-arrow-target-key]')]
          .filter(node=>ids.some(id=>node.getAttribute('data-trace-arrow-target-key').startsWith(id+'#')) && node.matches('[data-trace-index]'))
          .map(cell=>({key:cell.getAttribute('data-trace-arrow-target-key'),fill:cell.querySelector(':scope > rect')?.getAttribute('fill'),
            highlight:[...document.querySelectorAll('#arraySvg .asm-trace-style-decoration')].some(wrapper=>wrapper._asmStyleCell===cell && wrapper.getAttribute('display')!=='none'
              && wrapper.firstElementChild?.getAttribute('display')!=='none' && wrapper.firstElementChild?.classList.contains('highlight-blink'))}))
          .sort((a,b)=>a.key.localeCompare(b.key)),
        targets:[...document.querySelectorAll('#arraySvg [data-trace-arrow-source="directive"]')].map(node=>node.dataset.traceArrowToKey.split('#').at(-1)),
        steps:player.getLastPlaybackPlan()?.phases.find(phase=>phase.id==='trace-events')?.steps.length||0
      });
      const expected=[];
      window.__asmReplayRead=read;
      for(const index of indices){await player.render(index,{animatePositions:false,animateEvents:false});expected.push(read());}
      await player.render(indices[0],{animatePositions:false,animateEvents:false});
      await window.CodeScript.next();const forward=read();
      await window.CodeScript.prev();const backward=read();
      await window.CodeScript.next();const repeated=read();
      player.apply(JSON.parse(JSON.stringify(doc)));
      await player.render(indices[1],{animatePositions:false,animateEvents:false});
      await window.CodeScript.prev();const reloadedBackward=read();
      return {expected,forward,backward,repeated,reloadedBackward};
    });
    assert.ok(result.expected[0].cells.length>0,'actual SVG cells were measured');
    assert.deepEqual(result.expected.map(state=>state.targets),[['16'],['18','27']]);
    assert.deepEqual(result.expected.map(state=>state.cells.filter(cell=>cell.highlight).map(cell=>Number(cell.key.split('#').at(-1))).sort((a,b)=>a-b)),[[8,16],[9,18,27]],'destination directives actually select the expected sieve cells');
    assert.deepEqual(result.forward.cells,result.expected[1].cells,'forward styles match destination frame');
    assert.deepEqual(result.backward.cells,result.expected[0].cells,'backward styles match destination frame');
    assert.deepEqual(result.repeated.cells,result.expected[1].cells,'repeated styles match destination frame');
    assert.deepEqual(result.reloadedBackward.cells,result.expected[0].cells,'reloaded backward styles match destination frame');
    for(const [state,expected] of [[result.forward,result.expected[1]],[result.backward,result.expected[0]],[result.repeated,result.expected[1]],[result.reloadedBackward,result.expected[0]]]){
      assert.deepEqual(state.targets,expected.targets);
      assert.equal(state.steps,0);
    }
    const traceDocument=await page.evaluate(()=>JSON.parse(JSON.stringify(ASMTracePlayer.getDocument())));
    const slides=await browser.newPage({viewport:{width:1440,height:1000}});
    slides.on('pageerror',error=>errors.push(error.message));
    await slides.addInitScript(deck=>localStorage.setItem('asm_reveal_fabric_deck_v5',JSON.stringify(deck)),{groups:[{id:'replay-group',slides:[{id:'replay-slide',kind:'algorithm-animation',animation:{mode:'trace',code,input:'30',traceDocument},canvas:{objects:[]},widgets:[]}]}]});
    await slides.goto(base+'/slides.html');
    await slides.waitForFunction(()=>document.querySelector('.algorithm-slide-frame')?.contentWindow?.ASMTracePlayer?.getDocument()?.frames?.length);
    const runtime=slides.frames().find(frame=>frame.url().includes('asmEmbed=runtime'));
    assert.ok(runtime,'actual slide runtime loaded');
    const embedded=await runtime.evaluate(async()=>{
      const player=window.ASMTracePlayer,doc=player.getDocument();
      const ids=Object.keys(doc.variables).filter(id=>['isprime','prime'].includes(doc.variables[id].name));
      const iId=Object.keys(doc.variables).find(id=>doc.variables[id].name==='i');
      const indices=[8,9].map(i=>doc.frames.findIndex(f=>f.eventControls.length && f.state[iId]?.data.value===i));
      if(indices.some(index=>index<0))throw Error('compact frames missing');
      const read=()=>({
        cells:[...document.querySelectorAll('#arraySvg [data-trace-arrow-target-key]')]
          .filter(node=>ids.some(id=>node.getAttribute('data-trace-arrow-target-key').startsWith(id+'#')) && node.matches('[data-trace-index]'))
          .map(cell=>({key:cell.getAttribute('data-trace-arrow-target-key'),fill:cell.querySelector(':scope > rect')?.getAttribute('fill'),
            highlight:[...document.querySelectorAll('#arraySvg .asm-trace-style-decoration')].some(wrapper=>wrapper._asmStyleCell===cell && wrapper.getAttribute('display')!=='none'
              && wrapper.firstElementChild?.getAttribute('display')!=='none' && wrapper.firstElementChild?.classList.contains('highlight-blink'))}))
          .sort((a,b)=>a.key.localeCompare(b.key)),
        targets:[...document.querySelectorAll('#arraySvg [data-trace-arrow-source="directive"]')].map(node=>node.dataset.traceArrowToKey.split('#').at(-1)),
        steps:player.getLastPlaybackPlan()?.phases.find(phase=>phase.id==='trace-events')?.steps.length||0
      });
      const expected=[];
      window.__asmReplayRead=read;
      for(const index of indices){await player.render(index,{animatePositions:false,animateEvents:false});expected.push(read());}
      await player.render(indices[0],{animatePositions:false,animateEvents:false});
      await window.CodeScript.next();const forward=read();
      await window.CodeScript.prev();const backward=read();
      await window.CodeScript.next();const repeated=read();
      player.apply(JSON.parse(JSON.stringify(doc)));
      await player.render(indices[1],{animatePositions:false,animateEvents:false});
      await window.CodeScript.prev();const reloadedBackward=read();
      return {expected,forward,backward,repeated,reloadedBackward};
    });
    assert.deepEqual(embedded.backward.cells,result.expected[0].cells,'slide backward styles match destination');
    assert.deepEqual(embedded.reloadedBackward.cells,result.expected[0].cells,'slide reloaded backward styles match destination');
    assert.deepEqual(embedded.forward.cells,result.expected[1].cells,'slide forward styles match destination');
    assert.deepEqual(embedded.backward.targets,['16']);
    assert.equal(embedded.backward.steps,0);
    // Stop this isolated deck at i=9, so autoplay exercises only the affected pair.
    for(const speed of [500,1500]){
      const last=await page.evaluate(async speed=>{
        const player=window.ASMTracePlayer,doc=JSON.parse(JSON.stringify(player.getDocument()));
        const iId=Object.keys(doc.variables).find(id=>doc.variables[id].name==='i');
        const first=doc.frames.findIndex(frame=>frame.eventControls.length && frame.state[iId]?.data.value===8);
        const last=doc.frames.findIndex(frame=>frame.eventControls.length && frame.state[iId]?.data.value===9);
        doc.frames=doc.frames.slice(0,last+1);
        player.apply(doc);
        await player.render(first,{animatePositions:false,animateEvents:false});
        const slider=document.querySelector('#speedSlider');slider.value=String(speed);slider.dispatchEvent(new Event('input',{bubbles:true}));
        return last;
      },speed);
      await page.click('#playToggleBtn');
      await page.waitForFunction(last=>window.CodeScript.get_current_frame_index()===last && document.querySelector('#playToggleBtn').getAttribute('aria-pressed')==='false',last,{timeout:15000});
      const autoplay=await page.evaluate(()=>window.__asmReplayRead());
      assert.deepEqual(autoplay.cells,result.expected[1].cells,`autoplay styles at speed slider ${speed}`);
      assert.deepEqual(autoplay.targets,['18','27']);
      assert.equal(autoplay.steps,0);
    }
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
});
