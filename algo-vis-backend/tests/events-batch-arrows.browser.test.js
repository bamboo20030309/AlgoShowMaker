const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

test('user-written compact sieve frames render batch SVG arrows without detail event animation', { timeout: 90000 }, async () => {
  const base = process.env.ASM_TEST_BASE_URL;
  assert.ok(base, 'set ASM_TEST_BASE_URL to an isolated test server');
  const browser = await chromium.launch({ headless: true, ...(process.platform==='win32'?{channel:'msedge'}:{}) });
  try {
    const page = await browser.newPage({ viewport: { width:1440,height:1000 } });
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base+'/algorithm.html');
    await page.waitForFunction(()=>window.ace && window.ASMTracePlayer);
    const code=fs.readFileSync(path.join(__dirname,'fixtures/events-batch-sieve.cpp'),'utf8');
    await page.evaluate(code=>ace.edit('editor').setValue(code,-1),code);
    await page.click('#runBtn');
    await page.waitForFunction(code=>window.ASMTracePlayer.getDocument()?.sourceCode===code,code,{timeout:30000});
    const result=await page.evaluate(async()=>{
      const player=window.ASMTracePlayer;
      const doc=player.getDocument();
      const iId=Object.keys(doc.variables).find(id=>doc.variables[id].name==='i');
      const value=f=>f.state[iId]?.data.value;
      const compact8=doc.frames.findIndex(f=>f.eventControls.length && value(f)===8);
      const compact9=doc.frames.findIndex(f=>f.eventControls.length && value(f)===9);
      if(compact8<0||compact9<0)throw new Error('compact frames missing');
      await player.render(compact8-1);
      const detailedSteps=player.getLastPlaybackPlan()?.phases.find(p=>p.id==='trace-events')?.steps.length || 0;
      const read=()=>({
        arrows:[...document.querySelectorAll('#arraySvg [data-trace-arrow-source="directive"]')]
          .map(node=>({id:node.dataset.traceArrow,from:node.dataset.traceArrowFromKey,to:node.dataset.traceArrowToKey})),
        steps:player.getLastPlaybackPlan()?.phases.find(p=>p.id==='trace-events')?.steps.length || 0,
        active:document.querySelector('#arraySvg [data-trace-active-event-id]')!==null
      });
      await player.render(compact8);
      const eight=read();
      await player.render(compact9);
      const nine=read();
      const isprimeId=Object.keys(doc.variables).find(id=>doc.variables[id].name==='isprime');
      const values=[18,27].map(index=>document.querySelector(`#arraySvg [data-trace-arrow-target-key="${isprimeId}#${index}"]`)?.getAttribute('data-trace-data-value'));
      await player.render(compact8);
      await player.render(compact9);
      const repeated=read();
      player.apply(JSON.parse(JSON.stringify(doc)));
      await player.render(compact9);
      const reloaded=read();
      return {detailedSteps,eight,nine,repeated,reloaded,values};
    });
    assert.ok(result.detailedSteps>0,'earlier detailed frame still plays events');
    assert.equal(result.eight.arrows.length,1);
    assert.equal(result.nine.arrows.length,2);
    assert.deepEqual(result.nine.arrows.map(a=>a.id),['sieve_links[0]','sieve_links[1]']);
    assert.deepEqual(result.nine.arrows.map(a=>a.to.split('#').at(-1)),['18','27']);
    assert.deepEqual(result.nine.arrows.map(a=>a.from.split('#').at(-1)),['0','1']);
    assert.deepEqual(result.values,['0','0'],'actual rendered composite values are current');
    for(const state of [result.eight,result.nine,result.repeated,result.reloaded]){
      assert.equal(state.steps,0,'no detail events scheduled');
      assert.equal(state.active,false);
    }
    assert.deepEqual(result.repeated.arrows,result.nine.arrows);
    assert.deepEqual(result.reloaded.arrows,result.nine.arrows,'JSON round trip retains controls and batch description');
    const loopCode=fs.readFileSync(path.join(__dirname,'fixtures/loop-batch-sieve.cpp'),'utf8');
    await page.goto(base+'/algorithm.html');
    await page.waitForFunction(()=>window.ace && window.ASMTracePlayer);
    await page.evaluate(code=>ace.edit('editor').setValue(code,-1),loopCode);
    await page.click('#runBtn');
    await page.waitForFunction(code=>window.ASMTracePlayer.getDocument()?.sourceCode===code,loopCode,{timeout:30000});
    const loops=await page.evaluate(async()=>{
      const player=window.ASMTracePlayer,doc=player.getDocument();
      const iId=Object.keys(doc.variables).find(id=>doc.variables[id].name==='i');
      const indices=[8,9].map(i=>doc.frames.findIndex(frame=>frame.eventControls.length && frame.state[iId]?.data.value===i));
      const read=()=>({arrows:[...document.querySelectorAll('#arraySvg [data-trace-arrow-source="directive"]')].map(node=>({id:node.dataset.traceArrow,to:node.dataset.traceArrowToKey})),
        steps:player.getLastPlaybackPlan()?.phases.find(p=>p.id==='trace-events')?.steps.length || 0});
      const states=[];
      for(const index of indices){await player.render(index);states.push(read());}
      player.apply(JSON.parse(JSON.stringify(doc)));
      await player.render(indices[1]);
      return {states,reloaded:read()};
    });
    assert.deepEqual(loops.states.map(state=>state.arrows.length),[1,2]);
    assert.deepEqual(loops.states[1].arrows.map(arrow=>arrow.to.split('#').at(-1)),['18','27']);
    assert.ok(loops.states.every(state=>state.steps===0));
    assert.equal(new Set(loops.states[1].arrows.map(arrow=>arrow.id)).size,2);
    assert.deepEqual(loops.reloaded,loops.states[1]);
    const drawingCode=fs.readFileSync(path.join(__dirname,'fixtures/drawing-loop-sieve.cpp'),'utf8');
    await page.goto(base+'/algorithm.html');
    await page.waitForFunction(()=>window.ace && window.ASMTracePlayer);
    await page.evaluate(code=>ace.edit('editor').setValue(code,-1),drawingCode);
    await page.click('#runBtn');
    await page.waitForFunction(code=>window.ASMTracePlayer.getDocument()?.sourceCode===code,drawingCode,{timeout:30000});
    const drawing=await page.evaluate(async()=>{
      const player=window.ASMTracePlayer,doc=player.getDocument();
      const iId=Object.keys(doc.variables).find(id=>doc.variables[id].name==='i');
      const index=doc.frames.findIndex(frame=>frame.eventControls.length && frame.state[iId]?.data.value===9);
      const primeId=Object.keys(doc.variables).find(id=>doc.variables[id].name==='prime');
      const isprimeId=Object.keys(doc.variables).find(id=>doc.variables[id].name==='isprime');
      const read=()=>({
        arrows:[...document.querySelectorAll('#arraySvg [data-trace-arrow-source="directive"]')].map(node=>({id:node.dataset.traceArrow,to:node.dataset.traceArrowToKey})),
        texts:[...document.querySelectorAll('#arraySvg [data-trace-text-id]')].map(node=>({id:node.dataset.traceTextId,text:node.textContent,target:node.dataset.traceBindingTarget,hidden:node.getAttribute('display')})),
        backgrounds:[18,27].map(index=>document.querySelector(`#arraySvg [data-trace-arrow-target-key="${isprimeId}#${index}"] rect`)?.getAttribute('fill')),
        highlighted:[0,1].map(index=>[...document.querySelectorAll('#arraySvg .asm-trace-style-decoration')].some(wrapper=>
          wrapper._asmStyleCell?.getAttribute('data-trace-arrow-target-key')===`${primeId}#${index}`
          && wrapper.getAttribute('display')!=='none' && wrapper.firstElementChild?.tagName.toLowerCase()==='rect'
          && wrapper.firstElementChild.getAttribute('stroke')==='red' && wrapper.firstElementChild.getBBox().width>0)),
        steps:player.getLastPlaybackPlan()?.phases.find(p=>p.id==='trace-events')?.steps.length || 0
      });
      await player.render(index);
      const original=read();
      player.apply(JSON.parse(JSON.stringify(doc)));
      await player.render(index);
      return {original,reloaded:read()};
    });
    assert.deepEqual(drawing.original.arrows.map(arrow=>arrow.to.split('#').at(-1)),['18','27']);
    assert.deepEqual(drawing.original.texts.map(text=>text.text),['j=0','j=1']);
    assert.deepEqual(drawing.original.texts.map(text=>text.target.split('#').at(-1)),['0','1']);
    assert.ok(drawing.original.texts.every(text=>text.hidden!=='none'));
    assert.deepEqual(drawing.original.backgrounds,['rgba(165, 214, 167, 0.6)','rgba(165, 214, 167, 0.6)']);
    assert.deepEqual(drawing.original.highlighted,[true,true]);
    assert.equal(drawing.original.steps,0);
    assert.deepEqual(drawing.reloaded,drawing.original);
    await page.evaluate(()=>window.ASMTraceStudio.open());
    const bindings=await page.evaluate(ids=>ids.map(id=>window.ASMTraceStudio.getBinding('text:'+id)?.targetKey),drawing.original.texts.map(text=>text.id));
    assert.deepEqual(bindings.map(key=>key.split('#').at(-1)),['0','1']);
    await page.locator('#arraySvg [data-trace-text-id] [data-trace-text-segment="expression"]').nth(1).click();
    await page.waitForFunction(()=>{
      const fields=document.querySelector('.trace-studio-text-style-fields');
      return fields && !fields.hidden;
    });
    assert.deepEqual(errors,[]);
    const traceDocument = await page.evaluate(() => JSON.parse(JSON.stringify(ASMTracePlayer.getDocument())));
    const slides = await browser.newPage({ viewport: { width:1440,height:1000 } });
    slides.on('pageerror', error => errors.push(error.message));
    await slides.addInitScript(deck => localStorage.setItem('asm_reveal_fabric_deck_v5', JSON.stringify(deck)), {
      groups: [{ id:'embedded-group', slides: [{ id:'embedded-sieve', kind:'algorithm-animation',
        animation:{ mode:'trace', code:drawingCode, traceDocument }, canvas:{objects:[]}, widgets:[] }] }]
    });
    await slides.goto(base+'/slides.html');
    await slides.waitForFunction(() => document.querySelector('.algorithm-slide-frame')?.contentWindow?.ASMTracePlayer?.getDocument()?.frames?.length);
    const runtime = slides.frames().find(frame => frame.url().includes('asmEmbed=runtime'));
    assert.ok(runtime, 'actual algorithm slide runtime iframe loaded');
    const embedded = await runtime.evaluate(async () => {
      const player=ASMTracePlayer, doc=player.getDocument();
      const iId=Object.keys(doc.variables).find(id=>doc.variables[id].name==='i');
      const index=doc.frames.findIndex(frame=>frame.eventControls.length && frame.state[iId]?.data.value===9);
      if(index<0) throw Error('embedded compact frame missing');
      await player.render(index);
      const isprimeId=Object.keys(doc.variables).find(id=>doc.variables[id].name==='isprime');
      return { arrows:[...document.querySelectorAll('#arraySvg [data-trace-arrow-source="directive"]')].map(node=>({
        id:node.dataset.traceArrow, to:node.dataset.traceArrowToKey })),
        texts:[...document.querySelectorAll('#arraySvg [data-trace-text-id]')].map(node=>({id:node.dataset.traceTextId,text:node.textContent,target:node.dataset.traceBindingTarget,hidden:node.getAttribute('display')})),
        backgrounds:[18,27].map(index=>document.querySelector(`#arraySvg [data-trace-arrow-target-key="${isprimeId}#${index}"] rect`)?.getAttribute('fill')),
        steps:player.getLastPlaybackPlan()?.phases.find(phase=>phase.id==='trace-events')?.steps.length || 0 };
    });
    assert.deepEqual(embedded.arrows,drawing.original.arrows,'slide iframe preserves drawing-loop arrow identities and targets');
    assert.deepEqual(embedded.texts,drawing.original.texts,'slide iframe preserves local text values and bindings');
    assert.deepEqual(embedded.backgrounds,drawing.original.backgrounds,'slide iframe preserves drawing-loop styles');
    assert.equal(embedded.steps,0,'slide iframe honors compact frame event controls');
    assert.deepEqual(errors,[]);
  } finally { await browser.close(); }
});
