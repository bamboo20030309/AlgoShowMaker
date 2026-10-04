const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { compile } = require('./helpers/compile');

test('num[i] <= num[j] compares active kept children using event indices, not final pointers', { timeout: 120000 }, async () => {
  const code = fs.readFileSync('algorithm_sample/Sorting/merge_sort_recursive_layout.cpp', 'utf8');
  const { trace } = await compile(code, '10\n38 27 43 3 9 82 10 19 84 60\n');
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => { errors.push(e.message); console.error(e.message); });
    await page.goto(process.env.ASM_TEST_BASE_URL + '/algorithm.html');
    const report = await page.evaluate(async trace => {
      const isCompare = event => event.type === 'compare' && event.operation === '<='
        && event.targets?.some(target => /^num\[/.test(target.expression));
      const all = trace.frames.flatMap((frame,index) => frame.events.some(isCompare) ? [index] : []);
      const selected = [all[0], all.find(index => window.ASMTraceRules.resolveExpression(trace,trace.frames[index],'L') > 0), all.at(-1)];
      const samples = [], violations = [], availability = [];
      const motions = [];
      const pointerSamples = [];
      const rootBounds = element => {
        const root = document.querySelector('#asm-trace-root');
        const matrix = root.getScreenCTM().inverse().multiply(element.getScreenCTM());
        const box = element.getBBox();
        const a = new DOMPoint(box.x,box.y).matrixTransform(matrix);
        const b = new DOMPoint(box.x+box.width,box.y+box.height).matrixTransform(matrix);
        return {x:a.x,y:a.y,width:b.x-a.x,height:b.y-a.y};
      };
      const cellGeometry = cell => {
        const rect = cell.querySelector('rect:not(.asm-trace-compare-highlight)');
        if (!rect) return null;
        const root = document.querySelector('#asm-trace-root');
        const matrix = root.getScreenCTM().inverse().multiply(rect.getScreenCTM());
        const box = rect.getBBox();
        const a = new DOMPoint(box.x,box.y).matrixTransform(matrix);
        const b = new DOMPoint(box.x+box.width,box.y+box.height).matrixTransform(matrix);
        return {x:a.x,y:a.y,width:b.x-a.x,height:b.y-a.y};
      };
      const loaded = window.ASMTracePlayer.apply(JSON.parse(JSON.stringify(trace)));
      for (const speed of [1,4]) {
        window.asmGetAnimationPlaybackRate = () => speed;
        for (const index of selected) {
          await window.ASMTracePlayer.render(index,{stable:true});
          const frame = loaded.frames[index];
          const compares = frame.events.filter(isCompare);
          const baseline = new Map();
          for (const host of document.querySelectorAll('#asm-trace-root [data-trace-snapshot]')) {
            for (const cell of host.querySelectorAll('[data-trace-index]')) {
              baseline.set(`${host.dataset.traceSnapshot}#${cell.dataset.traceIndex}`,cellGeometry(cell));
            }
          }
          availability.push(...compares.map(e => ({index,id:e.id,disabled:e.autoAnimationDisabled,reason:e.autoAnimationUnavailableReason})));
          await window.ASMTracePlayer.render(index-1,{stable:true});
          let done = false;
          const pending = window.ASMTracePlayer.render(index,{fromIndex:index-1,forceTransition:true}).finally(() => done=true);
          const seen = new Set();
          const moved = new Map();
          const pointerTracks = new Map();
          const deadline = performance.now()+25000;
          while (!done) {
            await new Promise(requestAnimationFrame);
            if(performance.now()>deadline) throw new Error('manual transition timeout');
            const root = document.querySelector('#asm-trace-root');
            const event = compares.find(e => e.id === root.dataset.traceActiveEventId);
            if (!event) continue;
            for (const cell of root.querySelectorAll('[data-trace-compare-motion="1"]')) {
              const key = `${cell.dataset.traceCompareSnapshot}#${cell.dataset.traceIndex}`;
              const before = baseline.get(key), current = cellGeometry(cell);
              if (!before || !current) { violations.push({index,speed,reason:'missing motion geometry',key});continue; }
              const sample = moved.get(key) || {lift:0,minScale:1,maxScale:1};
              sample.lift = Math.max(sample.lift,before.y-current.y);
              sample.minScale = Math.min(sample.minScale,current.width/before.width);
              sample.maxScale = Math.max(sample.maxScale,current.width/before.width);
              moved.set(key,sample);
              for(const marker of root.querySelectorAll('[data-trace-source-variable-id]')) {
                const prefix = `${cell.dataset.traceCompareSnapshot}:pointer-target#`;
                if(!String(marker.dataset.traceBindingTarget).startsWith(prefix)) continue;
                const sourceName=loaded.variables[marker.dataset.traceSourceVariableId]?.name;
                const target=event.targets.find(t=>t.expression===`num[${sourceName}]`);
                if(!target || Number(target.resolvedIndex)!==Number(cell.dataset.traceIndex)) continue;
                const label=marker.querySelector('.trace-variable-marker-label-box');
                if(!label) continue;
                const bounds=rootBounds(label);
                const trackKey=`${event.id}:${sourceName}`;
                const track=pointerTracks.get(trackKey)||{sourceName,key:marker.dataset.traceObjectKey,ghost:marker.closest('.asm-trace-transition-ghost')!=null,minOpacity:1,inPointerLayer:true,minY:bounds.y,maxY:bounds.y,minWidth:bounds.width,maxWidth:bounds.width,gaps:[],paths:new Set()};
                let opacity=1;
                for(let parent=marker;parent&&parent!==root;parent=parent.parentElement){
                  if(parent.hasAttribute('opacity'))opacity*=Number(parent.getAttribute('opacity'));
                }
                track.minOpacity=Math.min(track.minOpacity,opacity);
                track.inPointerLayer &&= !!marker.closest('.asm-trace-pointer-layer');
                track.minY=Math.min(track.minY,bounds.y);track.maxY=Math.max(track.maxY,bounds.y);
                track.minWidth=Math.min(track.minWidth,bounds.width);track.maxWidth=Math.max(track.maxWidth,bounds.width);
                // Once fully lifted, the label must keep its clearance from
                // the changing top edge, not from an unmoving proxy anchor.
                if(sample.lift>10) track.gaps.push(current.y-bounds.y-bounds.height);
                track.paths.add(marker.querySelector('.trace-variable-marker-point path')?.getAttribute('d'));
                pointerTracks.set(trackKey,track);
              }
            }
            const highlights = [...root.querySelectorAll('.asm-trace-compare-highlight')];
            if (highlights.length !== 2) continue;
            seen.add(event.id);
            const indices = highlights.map(h => Number(h.dataset.traceCompareSourceIndex)).sort((a,b)=>a-b);
            const expected = event.targets.slice(0,2).map(t=>Number(t.resolvedIndex)).sort((a,b)=>a-b);
            if (JSON.stringify(indices)!==JSON.stringify(expected)) violations.push({index,speed,indices,expected});
            for (const h of highlights) {
              const snapshot = loaded.snapshots.find(s=>s.id === h.dataset.traceCompareSourceSnapshot);
              if (!snapshot || snapshot.layoutId !== 'merge_tree'
                || snapshot.recursionParentActivationId !== frame.source.recursionActivationId) {
                violations.push({index,speed,reason:'wrong ancestor or sibling',snapshot:snapshot?.id});
              }
            }
          }
          await pending;
          motions.push({index,speed,values:[...moved.values()]});
          pointerSamples.push({index,speed,tracks:[...pointerTracks.values()].map(t=>({...t,paths:[...t.paths]}))});
          if(document.querySelector('#asm-trace-root [data-trace-compare-motion], #asm-trace-root [data-trace-compare-snapshot]')) violations.push({index,speed,reason:'motion not removed'});
          for(const [key,before] of baseline){
            const split=key.lastIndexOf('#'),id=key.slice(0,split),logical=key.slice(split+1);
            const host=[...document.querySelectorAll('#asm-trace-root [data-trace-snapshot]')].find(h=>h.dataset.traceSnapshot===id);
            const cell=[...(host?.querySelectorAll('[data-trace-index]')||[])].find(c=>c.dataset.traceIndex===logical);
            const after=cell&&cellGeometry(cell);
            if(after && ['x','y','width','height'].some(part=>Math.abs(before[part]-after[part])>0.5)) violations.push({index,speed,key,reason:'did not restore',before,after});
          }
          samples.push({index,speed,expected:compares.map(e=>e.id),seen:[...seen]});
        }
      }
      const autoplay = [];
      for (const speed of [1,4]) {
        const short = JSON.parse(JSON.stringify(trace));
        const index = selected[0];
        short.frames = short.frames.slice(index-1,index+1);
        short.frames.forEach(frame=>{frame.texts=[];});
        short.studio.eventSettings = { ...(short.studio.eventSettings || {}), gapMs:0 };
        window.ASMTracePlayer.apply(short);
        window.asmGetAnimationPlaybackRate = () => speed;
        await window.ASMTracePlayer.render(0,{stable:true});
        const button = document.getElementById('playToggleBtn');
        button.click();
        let observed = false, moved = false;
        const pointers = new Map();
        const deadline = performance.now()+25000;
        while (button.getAttribute('aria-pressed') === 'true') {
          await new Promise(requestAnimationFrame);
          const root = document.querySelector('#asm-trace-root');
          const event = short.frames[1].events.find(e=>isCompare(e) && e.id===root.dataset.traceActiveEventId);
          if (event && root.querySelectorAll('.asm-trace-compare-highlight').length===2) observed=true;
          if (event && [...root.querySelectorAll('[data-trace-compare-motion]')].some(c=>Math.abs(c.transform.baseVal.getItem(0).matrix.a-1)>0.1)) moved=true;
          if(event) for(const cell of root.querySelectorAll('[data-trace-compare-motion]')){
            for(const marker of root.querySelectorAll('[data-trace-source-variable-id]')){
              if(!String(marker.dataset.traceBindingTarget).startsWith(`${cell.dataset.traceCompareSnapshot}:pointer-target#`))continue;
              const name=short.variables[marker.dataset.traceSourceVariableId]?.name;
              const read=event.targets.find(t=>t.expression===`num[${name}]`);
              if(!read||Number(read.resolvedIndex)!==Number(cell.dataset.traceIndex))continue;
              const label=marker.querySelector('.trace-variable-marker-label-box');
              if(!label)continue;
              const box=rootBounds(label),track=pointers.get(name)||{minY:box.y,maxY:box.y};
              track.minY=Math.min(track.minY,box.y);track.maxY=Math.max(track.maxY,box.y);
              pointers.set(name,track);
            }
          }
          if (performance.now()>deadline) throw new Error('autoplay timeout');
        }
        autoplay.push({speed,observed,moved,pointers:[...pointers.values()]});
      }
      // Old trace roundtrip and explicit disabling must not be overwritten.
      const saved = JSON.parse(JSON.stringify(loaded));
      const index = selected[0], event = saved.frames[index].events.find(isCompare);
      const instruction = window.ASMTraceEvents.instructionKey(event);
      saved.studio.eventInstructionStates = { ...(saved.studio.eventInstructionStates || {}), [instruction]: false };
      window.ASMTracePlayer.apply(saved);
      await window.ASMTracePlayer.render(index,{stable:true});
      const reopened = JSON.parse(JSON.stringify(window.ASMTracePlayer.getDocument()));
      window.ASMTracePlayer.apply(reopened);
      await window.ASMTracePlayer.render(index,{stable:true});
      const preserved = window.ASMTracePlayer.getDocument().studio.eventInstructionStates[instruction] === false;
      await window.ASMTracePlayer.render(index-1,{stable:true});
      let disabledDone=false,disabledMotion=false;
      const disabledPlayback=window.ASMTracePlayer.render(index,{fromIndex:index-1,forceTransition:true}).finally(()=>disabledDone=true);
      while(!disabledDone){await new Promise(requestAnimationFrame);if(document.querySelector('#asm-trace-root [data-trace-compare-motion]'))disabledMotion=true;}
      await disabledPlayback;
      const hidden = JSON.parse(JSON.stringify(loaded));
      hidden.frames[index].snapshotIds = [];
      window.ASMTracePlayer.apply(hidden);
      await window.ASMTracePlayer.render(index,{stable:true});
      const missing = window.ASMTracePlayer.getDocument().frames[index].events.find(isCompare);
      return {samples,motions,pointerSamples,availability,violations,autoplay,preserved,disabledMotion,missing:missing.autoAnimationDisabled};
    },trace);
    assert.deepEqual(report.violations,[]);
    assert.ok(report.availability.every(e=>e.disabled===false),JSON.stringify(report.availability));
    for(const sample of report.samples) assert.deepEqual(sample.seen.sort(),sample.expected.sort(),JSON.stringify(sample));
    assert.equal(report.preserved,true);
    assert.equal(report.disabledMotion,false,'disabled comparison must not project retained motion');
    for(const motion of report.motions){
      assert.ok(motion.values.every(v=>v.lift>10),JSON.stringify(motion));
      assert.ok(motion.values.some(v=>v.maxScale>1.1),JSON.stringify(motion));
      assert.ok(motion.values.some(v=>v.minScale<0.9),JSON.stringify(motion));
    }
    for(const sample of report.pointerSamples){
      assert.ok(sample.tracks.length>=2,JSON.stringify(sample));
      for(const track of sample.tracks){
        assert.ok(track.maxY-track.minY>10,'pointer must follow lift: '+JSON.stringify(track));
        assert.ok(track.maxWidth-track.minWidth<0.5,'pointer label must not scale: '+JSON.stringify(track));
        assert.ok(track.gaps.length>0,'missing lifted pointer sample');
        assert.ok(Math.max(...track.gaps)-Math.min(...track.gaps)<0.5,'pointer clearance changed: '+JSON.stringify(track));
        assert.ok(track.paths.every(Boolean),'missing pointer arrow');
        assert.ok(track.minOpacity>0.99,'pointer exited before comparison finished: '+JSON.stringify(track));
        assert.equal(track.inPointerLayer,true,'pointer lowered below arrows');
      }
    }
    assert.ok(report.autoplay.every(run=>run.observed&&run.moved),JSON.stringify(report.autoplay));
    for(const run of report.autoplay){
      assert.equal(run.pointers.length,2,JSON.stringify(run));
      assert.ok(run.pointers.every(p=>p.maxY-p.minY>10),JSON.stringify(run));
    }
    assert.equal(report.missing,true,'hidden sources stay unavailable');
    assert.deepEqual(errors,[]);
  } finally { await browser.close(); }
});
