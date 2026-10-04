const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {compile}=require('./helpers/compile');

const code=`#include <vector>
int main(){
 std::vector<int> a={4,1};
 // @frame a
 if(a[0]>a[1]) a[0]=a[1];
 // @frame a
 return 0;
}`;

test('code panel sizes and independent scrolling persist in source and old traces reopen unchanged', {timeout:90000},async()=>{
 const {trace}=await compile(code);
 const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.ASM_TEST_BASE_URL+'/algorithm.html');
  await page.evaluate(async({trace,code})=>{
   ace.edit('editor').setValue(code,-1);
   window.ASMTracePlayer.apply(trace);
   await window.ASMTracePlayer.render(0,{stable:true});
   window.ASMTraceStudio.open();
  },{trace,code});
  await page.locator('#traceCodePanel').click();
  for(const [key,value] of Object.entries({codePanelScrollMs:1200,codePanelWidthPercent:80,codePanelHeightPercent:90})){
   await page.locator(`[data-code-panel-setting="${key}"]`).evaluate((input,value)=>{
    input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));
   },value);
  }
  await page.locator('[data-trace-code-controls] input[type="range"]').first().evaluate(input=>{
   input.value='48';input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));
  });
  const saved=await page.evaluate(()=>{
   window.ASMTraceStudio.flushSourceSettings();
   const source=ace.edit('editor').getValue();
   return {source,studio:window.ASMTraceViewSource.parse(source).studio,font:document.querySelector('#traceCodePanel').dataset.codePanelFontSize};
  });
  assert.equal(saved.font,'48');
  for(const [key,value] of Object.entries({codePanelFontSize:48,codePanelScrollMs:1200,codePanelWidthPercent:80,codePanelHeightPercent:90}))assert.equal(saved.studio[key],value);
  await page.evaluate(()=>window.ASMTraceStudio.close());
  await page.click('#runBtn');
  await page.waitForFunction(()=>window.ASMTracePlayer.getDocument()?.studio?.codePanelScrollMs===1200);
  const report=await page.evaluate(async()=>{
   const loaded=window.ASMTracePlayer.getDocument();
   const reopened=JSON.parse(JSON.stringify(loaded));
   reopened.studio.eventSettings.gapMs=777;
   reopened.studio.codePanelScrollMs=0;
   window.ASMTracePlayer.apply(reopened);
   await window.ASMTracePlayer.render(0,{stable:true});
   const panel=document.querySelector('#traceCodePanel');
   const explicit={font:panel.dataset.codePanelFontSize,width:panel.style.maxWidth,height:panel.style.maxHeight,
    duration:panel.style.getPropertyValue('--asm-code-scroll-duration'),gap:window.ASMTracePlayer.getDocument().studio.eventSettings.gapMs};
   const source=window.ASMTraceViewSource.upsert(ace.edit('editor').getValue(),window.ASMTraceViewSource.fromTrace(window.ASMTracePlayer.getDocument()));
   const persisted=window.ASMTraceViewSource.parse(source).studio;
   const legacy=JSON.parse(JSON.stringify(reopened));
   ['codePanelFontSize','codePanelScrollMs','codePanelWidthPercent','codePanelHeightPercent'].forEach(key=>delete legacy.studio[key]);
   window.ASMTracePlayer.apply(legacy);await window.ASMTracePlayer.render(0,{stable:true});
   const old={font:panel.dataset.codePanelFontSize,width:panel.style.maxWidth,height:panel.style.maxHeight,duration:panel.style.getPropertyValue('--asm-code-scroll-duration')};
   const oldSaved=JSON.parse(JSON.stringify(window.ASMTracePlayer.getDocument()));
   window.ASMTracePlayer.apply(oldSaved);await window.ASMTracePlayer.render(0,{stable:true});
   return {explicit,persisted,old,reopened:panel.dataset.codePanelFontSize};
  });
  assert.deepEqual(report.explicit,{font:'48',width:'80%',height:'90%',duration:'0ms',gap:777});
  assert.equal(report.persisted.codePanelScrollMs,0);
  assert.equal(report.persisted.codePanelFontSize,48);
  assert.deepEqual(report.old,{font:'20',width:'',height:'',duration:'460ms'});
  assert.equal(report.reopened,'20');
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});

test('code scroll and event animation overlap instead of accumulating their durations',{timeout:90000},async()=>{
 const {trace}=await compile(code);
 const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.ASM_TEST_BASE_URL+'/algorithm.html');
  const result=await page.evaluate(async(trace)=>{
   const outcomes=[];
   // Deterministic long snippets exercise actual DOM/CSS scrolling while
   // retaining the real compiled comparison and assignment event sequence.
   const original=window.ASMTraceCodeModel.planFrame;
   window.ASMTraceCodeModel.planFrame=(doc,frame)=>{
    const plan=original(doc,frame),second=frame.id===doc.frames[1].id;
    const items=Array.from({length:45},(_,i)=>({kind:'line',number:i+1,text:`int value_${i}=0;`,segments:[]}));
    return {...plan,layoutKey:second?'later':'first',focusLine:second?40:2,
     fragments:[{functionName:'main',subtreeKey:'main',focusLine:second?40:2,items:second?items.slice(30):items.slice(0,10),expandedItems:items}]};
   };
   for(const {speed,mode} of [{speed:1,mode:'manual'},{speed:4,mode:'manual'},
     {speed:1,mode:'autoplay'},{speed:4,mode:'autoplay'},{speed:4,mode:'instant'}]){
    const copy=JSON.parse(JSON.stringify(trace));
    copy.studio.codePanelScrollMs=mode==='instant'?0:1200;copy.studio.eventSettings={...(copy.studio.eventSettings||{}),gapMs:137};
    window.ASMTracePlayer.apply(copy);window.asmGetAnimationPlaybackRate=()=>speed;
    await window.ASMTracePlayer.render(0,{stable:true});
    let done=false,overlap=false,scrolled=false,eventSeen=false;
    const start=performance.now();
    let plan,pending;
    const button=document.getElementById('playToggleBtn');
    if(mode!=='autoplay'){
     const transition=window.ASMTracePlayer.render(1,{fromIndex:0,forceTransition:true});
     plan=transition.playbackPlan;pending=transition.finally(()=>done=true);
    }else button.click();
    while(!done){
     await new Promise(requestAnimationFrame);
     const body=document.querySelector('.asm-trace-code-body');
     const scrolling=!!body.querySelector('.is-transition-expanded.is-transition-scrolling');
     scrolled ||= scrolling;
     const root=document.querySelector('#asm-trace-root');
     eventSeen ||= root.dataset.traceActiveEventType==='compare'&&!!root.querySelector('.asm-trace-compare-highlight');
     overlap ||= scrolling&&root.dataset.traceActiveEventType==='compare'&&!!root.querySelector('.asm-trace-compare-highlight');
     if(mode==='autoplay'){
      plan=window.ASMTracePlayer.getLastPlaybackPlan();
      done=button.getAttribute('aria-pressed')!=='true';
     }
     if(performance.now()-start>15000)throw new Error('parallel playback timeout');
    }
    await pending;
    const events=plan.phases.flatMap(phase=>phase.steps||[]).filter(step=>step.kind==='trace-event');
    outcomes.push({speed,mode,overlap,scrolled,eventSeen,prompts:events.map(e=>e.codePromptDurationMs),initial:plan.phases.some(p=>p.id==='code-transition'),remaining:!!document.querySelector('.is-transition-expanded')});
   }
   window.ASMTraceCodeModel.planFrame=original;
   return outcomes;
  },trace);
  for(const run of result){assert.equal(run.scrolled,run.mode!=='instant',JSON.stringify(run));assert.equal(run.overlap,run.mode!=='instant',JSON.stringify(run));assert.equal(run.eventSeen,true,JSON.stringify(run));assert.ok(run.prompts.every(n=>n===0),JSON.stringify(run));assert.equal(run.remaining,false);}
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
