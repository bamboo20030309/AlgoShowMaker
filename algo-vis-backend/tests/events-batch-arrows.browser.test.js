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
    assert.deepEqual(errors,[]);
  } finally { await browser.close(); }
});
