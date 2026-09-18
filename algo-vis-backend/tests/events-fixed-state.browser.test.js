const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

test('post-loop compact sieve preserves automatic marks while skipping runtime animations', { timeout: 60000 }, async () => {
  const base = process.env.ASM_TEST_BASE_URL;
  assert.ok(base, 'set ASM_TEST_BASE_URL to an isolated server');
  const browser = await chromium.launch({ headless:true, ...(process.platform === 'win32' ? {channel:'msedge'} : {}) });
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base+'/algorithm.html');
    await page.waitForFunction(() => window.ace && window.ASMTracePlayer);
    const code = fs.readFileSync(path.join(__dirname,'fixtures/automark-events-sieve.cpp'),'utf8');
    await page.evaluate(code => {ace.edit('editor').setValue(code,-1);document.querySelector('#inputArea').value='30';},code);
    await page.click('#runBtn');
    await page.waitForFunction(code => window.ASMTracePlayer.getDocument()?.sourceCode===code,code,{timeout:30000});
    const result = await page.evaluate(async () => {
      const player=window.ASMTracePlayer, source=JSON.parse(JSON.stringify(player.getDocument()));
      const iId=Object.keys(source.variables).find(id=>source.variables[id].name==='i');
      const aId=Object.keys(source.variables).find(id=>source.variables[id].name==='isprime');
      const indices=[8,9].map(i=>source.frames.findIndex(frame=>frame.eventControls.length && frame.state[iId]?.data.value===i));
      if(indices.some(index=>index<0))throw Error('missing compact frames');
      const read=()=>[...new Set([...document.querySelectorAll('#asm-trace-root .asm-trace-style-decoration')]
        .filter(wrapper=>{
          const visual=wrapper.firstElementChild,cell=wrapper._asmStyleCell;
          if(visual?.getAttribute('stroke')!=='#4caf50' || cell?.closest('[data-trace-variable]')?.dataset.traceVariable!==aId)return false;
          for(let node=visual;node && node.id!=='asm-trace-root';node=node.parentElement)
            if(getComputedStyle(node).display==='none' || Number(getComputedStyle(node).opacity)===0)return false;
          return true;
        }).map(wrapper=>Number(wrapper._asmStyleCell.dataset.traceIndex)))].sort((a,b)=>a-b);
      const expected=indices.map(index=>[...new Set(source.frames.slice(0,index+1)
        .flatMap(frame=>frame.events.filter(event=>event.type==='fixed' && event.enabled!==false)
          .flatMap(event=>event.targets.filter(target=>target.variableId===aId).map(target=>Number(target.resolvedIndex))))
        .filter(index=>index>=1 && index<=30))].sort((a,b)=>a-b));
      const newFixed=indices.map(index=>source.frames[index].events.filter(event=>event.type==='fixed')
        .flatMap(event=>event.targets.filter(target=>target.variableId===aId && Number(target.resolvedIndex)>=1 && Number(target.resolvedIndex)<=30)
          .map(target=>({index:Number(target.resolvedIndex),enabled:event.enabled}))));
      await player.render(indices[0]-1,{animatePositions:false,animateEvents:false});
      await player.render(indices[0]);const eight=read();
      await player.render(indices[1]);const nine=read();
      const steps=player.getLastPlaybackPlan()?.phases.find(phase=>phase.id==='trace-events')?.steps.length || 0;
      await player.render(indices[0]);const back=read();
      player.apply(JSON.parse(JSON.stringify(source)));
      await player.render(indices[1],{animatePositions:false,animateEvents:false});const reload=read();
      await window.ASMTraceStudio.open();const studio=read();
      return {expected,newFixed,eight,nine,steps,back,reload,studio};
    });
    console.log('Compact sieve marks:',JSON.stringify(result));
    assert.ok(result.newFixed.flat().length>0,'compact frames finish new isprime cells');
    assert.ok(result.newFixed.flat().every(mark=>mark.enabled===true));
    assert.ok(result.expected[1].length>result.expected[0].length,'i=9 adds completed cells');
    assert.deepEqual(result.eight,result.expected[0]);
    for(const state of [result.nine,result.reload,result.studio])assert.deepEqual(state,result.expected[1]);
    assert.deepEqual(result.back,result.expected[0]);
    assert.equal(result.steps,0,'runtime event animations stay off');
    assert.deepEqual(errors,[]);
  } finally {await browser.close();}
});
