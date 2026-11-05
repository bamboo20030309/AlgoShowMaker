'use strict';
const {test}=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const {startIsolatedServer}=require('./helpers/isolated-server');
const {readPackage,savedTrace}=require('./helpers/deck-package');

test('Merge Sort first push hands off its cell immediately and retains its source pointer', {timeout:90000}, async t=>{
  const {base}=await startIsolatedServer(t);
  const body=readPackage(fs.readFileSync(path.join(__dirname,'../public/guest-decks/merge-sort.asmdeck'))).body;
  const animations=body.deck.groups.flatMap(group=>group.slides||[]).filter(slide=>slide.animation).slice(0,2).map(slide=>slide.animation);
  const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());
  const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'/algorithm.html?asmEmbed=runtime');await page.waitForFunction(()=>window.ASMTracePlayer);
  for(const [example,animation] of animations.entries()) for(const rate of [1,2]) for(const step of [20,37]) for(const gap of [0,500]) {
    const result=await page.evaluate(async ({trace,rate,step,pointerName,gap})=>{
      const doc=ASMTracePlayer.apply(trace);doc.studio.eventSettings.gapMs=gap;
      window.asmGetAnimationPlaybackRate=()=>rate;
      window.ASMTraceCamera={...ASMTraceCamera,apply(){},transitionDuration:()=>0};
      await ASMTracePlayer.render(9,{stable:true});
      const opacity=node=>{let value=1;for(let parent=node;parent&&parent.id!=='arraySvg';parent=parent.parentElement){const style=getComputedStyle(parent);if(style.display==='none'||style.visibility==='hidden')return 0;value*=Number(style.opacity);}return value;};
      const read=()=>{
        const pointer=[...document.querySelectorAll('[data-trace-source-variable-id]')].filter(node=>doc.variables[node.dataset.traceSourceVariableId]?.name===pointerName);
        const owner=[...document.querySelectorAll('#asm-trace-root [data-trace-variable]')]
          .find(node=>doc.variables[node.dataset.traceVariable]?.name==='merged'
            && !node.closest('[data-trace-snapshot],.asm-trace-transition-ghost'));
        const target=owner?.querySelector('[data-trace-index="0"]');
        const visiblePointer=pointer.find(node=>opacity(node)>0.01);
        const label=visiblePointer?.querySelector('.trace-variable-marker-label-box');
        const labelBox=label?.getBoundingClientRect();
        return {pointerVisible:pointer.some(node=>opacity(node)>0.99),targetOpacity:target?opacity(target):0,
          pointerX:labelBox?labelBox.x+labelBox.width/2:null,
          value:target?.querySelector('text')?.textContent,
          transfers:[...document.querySelectorAll('.asm-trace-sequence-cell-transfer')].map(node=>({opacity:opacity(node),cell:!!node.querySelector('rect'),transform:node.getAttribute('transform')}))};
      };
      const before=read(),native={raf:requestAnimationFrame,cancel:cancelAnimationFrame,now:Object.getOwnPropertyDescriptor(performance,'now')};
      let clock=performance.now(),elapsed=0,serial=0;const callbacks=new Map(),samples=[];
      window.requestAnimationFrame=callback=>{callbacks.set(++serial,callback);return serial;};window.cancelAnimationFrame=id=>callbacks.delete(id);
      Object.defineProperty(performance,'now',{configurable:true,value:()=>clock});
      const restore=()=>{window.requestAnimationFrame=native.raf;window.cancelAnimationFrame=native.cancel;if(native.now)Object.defineProperty(performance,'now',native.now);else delete performance.now;};
      try {
        const pending=ASMTracePlayer.render(10,{fromIndex:9,forceTransition:true});
        const total=ASMTracePlayer.getLastPlaybackPlan().totalDurationMs;
        while(elapsed*rate<total+100){elapsed+=step;clock+=step;const batch=[...callbacks.values()];callbacks.clear();batch.forEach(callback=>callback(clock));for(let n=0;n<10;n++)await Promise.resolve();samples.push({at:elapsed*rate,...read()});}
        document.querySelectorAll('#asm-trace-root *').forEach(node=>node.getAnimations?.().forEach(animation=>{if(animation.transitionProperty)animation.finish();}));
        restore();await pending;return{before,samples,final:read()};
      } finally {restore();ASMTraceFrameTween.cancel();}
    },{trace:savedTrace(body,animation),rate,step,pointerName:example===0?'i':'j',gap});
    // Independent answer: compare -> gap -> push (300+220) -> gap ->
    // pointer movement (520) -> exit (220). The exit also runs with gap=0.
    const copyStart=1560+gap,commit=copyStart+520,movementStart=commit+gap,
      movementEnd=movementStart+520,exitEnd=movementEnd+220,failures=[];
    const expectedValue=example===0?'5':'1';
    assert.ok(result.before.pointerVisible,'the source pointer starts on its child');
    const during=result.samples.filter(sample=>sample.at>=copyStart&&sample.at<commit);
    if(!during.length||during.some(sample=>!sample.pointerVisible)) failures.push('source pointer disappeared before push_back finished');
    const after=result.samples.filter(sample=>sample.at>=commit&&sample.at<movementEnd);
    if(!after.length||after.some(sample=>sample.targetOpacity<0.99||sample.value!==expectedValue)) failures.push('destination cell was absent during the post-commit gap');
    if(!during.some(sample=>sample.transfers.some(transfer=>transfer.opacity>0.99&&transfer.cell)))failures.push('visible source cell did not copy');
    const beforeExit=result.samples.filter(sample=>sample.at>=copyStart&&sample.at<movementEnd);
    if(beforeExit.some(sample=>!sample.pointerVisible))failures.push('pointer retired before its out-of-bounds update finished');
    const moving=result.samples.filter(sample=>sample.at>movementStart&&sample.at<movementEnd);
    if(new Set(moving.map(sample=>sample.pointerX?.toFixed(2))).size<3)failures.push('outbound update did not move the pointer');
    if(!result.samples.some(sample=>sample.at>=exitEnd&&!sample.pointerVisible))failures.push('outbound pointer did not finish its exit');
    assert.deepEqual(failures,[],JSON.stringify({example,rate,step,gap,failures,after:after.slice(0,3),moving:moving.slice(0,3)}));
    assert.equal(result.final.value,expectedValue);assert.ok(result.final.targetOpacity>0.99);
  }
  assert.deepEqual(errors,[]);
});
