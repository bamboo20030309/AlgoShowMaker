const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { compile } = require('./helpers/compile');
const { startIsolatedServer } = require('./helpers/isolated-server');

test('event gap from the settings slider applies within and across frames and survives reload', {timeout:90000}, async t => {
  const {base} = await startIsolatedServer(t);
  const oldBase = process.env.ASM_TEST_BASE_URL; let trace;
  try {
    process.env.ASM_TEST_BASE_URL = base;
    ({trace} = await compile(`int main(){int a=1,b=2;
// @frame a,b
a=b;b=3;
// @frame a,b
a=b;
// @frame a,b
}`));
  } finally { if (oldBase === undefined) delete process.env.ASM_TEST_BASE_URL; else process.env.ASM_TEST_BASE_URL = oldBase; }
  const browser = await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
  t.after(()=>browser.close());
  const page=await browser.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/algorithm.html?asmEmbed=editor&localOnly=1');
  await page.waitForFunction(()=>window.ASMTraceEditor && window.ASMTracePlayer);
  await page.addScriptTag({url:base+'/slides-storage.js'});
  const observations=await page.evaluate(async source=>{
    const camera=window.ASMTraceCamera;window.ASMTraceCamera={...camera,apply(){},transitionDuration:()=>0};
    window.asmGetAnimationPlaybackRate=()=>1;
    const results=[];
    for(const settings of [{}, {gapMs:0}, {gapMs:600}]){
      const doc=structuredClone(source);doc.studio||={};doc.studio.eventSettings=settings;
      ASMTraceEditor.loadAnimation({mode:'trace',code:doc.sourceCode,input:'',traceDocument:doc},{openStudio:false});
      document.getElementById('eventSettingsBtn').click();
      const slider=document.querySelector('.trace-event-gap');
      const initial=Number(slider.value); slider.value=String(settings.gapMs||0);
      slider.dispatchEvent(new Event('input',{bubbles:true}));slider.dispatchEvent(new Event('change',{bubbles:true}));
      document.querySelector('.trace-event-settings-panel').hidden=true;
      const player=ASMTracePlayer;
      await player.render(0,{stable:true});
      const markers=[];const listener=e=>{if(e.detail?.event?.type==='assign')markers.push({phase:e.detail.phase,time:performance.now()});};
      window.addEventListener('asm:trace-active-event',listener);
      await CodeScript.next();const plan=structuredClone(player.getLastPlaybackPlan());
      await CodeScript.next();const finalPlan=structuredClone(player.getLastPlaybackPlan());
      window.removeEventListener('asm:trace-active-event',listener);
      const store=ASMSlideStorage.create(indexedDB,localStorage);
      const current=player.getDocument(),id=await ASMSlideStorage.digest(ASMSlideStorage.canonical(current));
      await store.putTrace(id,current);const reopened=await store.loadTrace(id);
      results.push({initial,gap:current.studio.eventSettings.gapMs,plan,finalPlan,markers,reopenedGap:reopened.studio.eventSettings.gapMs,
        finalValue:reopened.frames[2].state[Object.keys(reopened.variables).find(id=>reopened.variables[id].name==='a')]});
    }
    window.ASMTraceCamera=camera;return results;
  },trace);
  for(const [index,result] of observations.entries()){
    const gap=index===2?600:0;assert.equal(result.initial,gap);assert.equal(result.gap,gap);assert.equal(result.reopenedGap,gap);
    assert.equal(result.finalValue.data.value,3);
    assert.equal(result.finalPlan.phases.some(p=>p.id==='event-gap'),false,'no unnecessary wait after the final frame');
    const events=result.plan.phases.find(p=>p.id==='trace-events').steps;
    assert.equal(events[1].startMs-events[0].endMs,gap);
    const tail=result.plan.phases.find(p=>p.id==='event-gap');
    if(gap){
      assert.equal(tail?.durationMs,600,JSON.stringify(result));
      assert.equal(tail.startMs,events.at(-1).endMs);
      assert.equal(result.plan.totalDurationMs,tail.startMs+600);
      const ended=result.markers.filter(m=>m.phase==='end');const started=result.markers.filter(m=>m.phase==='start');
      assert.ok(started[2].time-ended[1].time>=500,'actual cross-frame pause: '+JSON.stringify(result.markers));
    }else assert.equal(tail,undefined);
  }
  assert.deepEqual(errors,[]);
});
