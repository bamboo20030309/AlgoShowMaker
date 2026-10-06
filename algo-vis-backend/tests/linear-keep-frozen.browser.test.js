const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { compile } = require('./helpers/compile');

test('linear keeps freeze data and draw-loop styles across passes and final frame', { timeout: 120000 }, async () => {
  let code = fs.readFileSync('algorithm_sample/Sorting/merge_sort_bottom_up.cpp', 'utf8');
  code = code.replace(/(\/\/ @text "(?:本輪|合併藍色|比較兩側|右半邊|左半邊|長度)[^\r\n]*)/g,
    '// @camera focus num\n        $1').replace('"codePanelFontSize": 11','"codePanelFontSize": 16');
  const { trace } = await compile(code, '10\n5 7 2 1 9 3 6 8 10 4\n');
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.ASM_TEST_BASE_URL + '/algorithm.html');
    const reports = await page.evaluate(async trace => {
      const capture = () => {
        const root = document.querySelector('#asm-trace-root');
        return [...root.querySelectorAll(':scope > [data-trace-object-key]')].map(el => {
          const rect = el.querySelector('.outerframe-bg');
          if (!rect) return null;
          const b = rect.getBBox(), m = root.getScreenCTM().inverse().multiply(rect.getScreenCTM());
          const p = new DOMPoint(b.x,b.y).matrixTransform(m);
          return { snapshotId: el.dataset.traceSnapshot || '', y:p.y, height:b.height,
            cells:[...el.querySelectorAll('[data-trace-index]')].map(cell=>({
              index:Number(cell.dataset.traceIndex), fill:cell.querySelector('rect')?.getAttribute('fill'),
              value:cell.dataset.traceDataValue
            })).filter(cell=>Number.isInteger(cell.index)) };
        }).filter(Boolean);
      };
      const reports=[];
      // Loading a saved trace again exercises existing snapshots without adding
      // a new field or replacing explicit disabled animation settings.
      for (const reopened of [false,true,'legacy']) {
        const source=reopened ? JSON.parse(JSON.stringify(trace)) : trace;
        if(reopened==='legacy') source.snapshots.forEach(snapshot=>delete snapshot.recursionActivationId);
        const loaded=ASMTracePlayer.apply(source);
        // Narration timing is outside this geometry/style regression.
        loaded.frames.forEach(frame=>frame.texts=[]);
        const snapshots=JSON.stringify(loaded.snapshots);
        for(const index of [2,loaded.frames.length-2,loaded.frames.length-1]) {
          await ASMTracePlayer.render(index,{stable:true});
          reports.push({reopened,index,objects:capture(),arrows:document.querySelectorAll('#asm-trace-root .asm-trace-keep-arrow').length});
        }
        for(const speed of [1,4]) for(const autoplay of [false,true]) {
          await ASMTracePlayer.render(loaded.frames.length-2,{stable:true});
          window.asmGetAnimationPlaybackRate=()=>speed;
          if(autoplay) {
            document.querySelector('#playToggleBtn').click();
            const deadline=performance.now()+30000;
            do {
              await new Promise(requestAnimationFrame);
              if(performance.now()>deadline) throw new Error('autoplay timed out: '+JSON.stringify({frame:ASMTracePlayer.getCurrentFrame(),plan:ASMTracePlayer.getActivePlaybackPlan()}));
            } while(document.querySelector('#playToggleBtn').getAttribute('aria-pressed')==='true');
          } else await ASMTracePlayer.render(loaded.frames.length-1,{fromIndex:loaded.frames.length-2,forceTransition:true});
          reports.push({reopened,speed,autoplay,index:loaded.frames.length-1,objects:capture(),arrows:document.querySelectorAll('#asm-trace-root .asm-trace-keep-arrow').length});
        }
        if(JSON.stringify(loaded.snapshots)!==snapshots) throw new Error('snapshot data mutated while rendering');
        if(loaded.studio.eventSettings.autoFixedEnabled!==false) throw new Error('disabled setting changed');
      }
      return reports;
    }, trace);
    const snapshots = trace.snapshots;
    for(const report of reports) {
      const objects = report.objects;
      const kept = objects.filter(o=>o.snapshotId);
      assert.equal(kept.length, report.index===2 ? 1 : snapshots.length);
      assert.equal(report.arrows,kept.length,'every kept stage must retain its outgoing arrow');
      for(let ordinal=0;ordinal<kept.length;ordinal++) {
        const object=kept[ordinal], snapshot=snapshots.find(s=>s.id===object.snapshotId);
        assert.deepEqual(object.cells.map(c=>Number(c.value)),snapshot.data.items.map(item=>Number(item.value ?? item)));
        const width=ordinal===0 ? 0 : 2**(ordinal-1);
        const colors=object.cells.map(c=>c.fill);
        assert.deepEqual(colors, object.cells.map((_,i)=>width===0 ? '#fff' : Math.floor(i/width)%2===0
          ? 'rgba(144, 202, 249, 0.6)' : 'rgba(252, 255, 64, 0.46)'),JSON.stringify({report,ordinal,colors}));
      }
      // Final layout must complete, leaving every retained row and live num separate.
      if(report.index===trace.frames.length-1) {
        assert.equal(objects.length,snapshots.length+1);
        for(let j=1;j<objects.length;j++) assert.ok(objects[j].y-objects[j-1].y>=objects[j-1].height+69.9);
      }
    }
    assert.deepEqual(errors,[]);
  } finally { await browser.close(); }
});

test('reused keeps match fresh drawing after appearance changes and style removal', {timeout:120000}, async()=>{
  const {trace}=await compile(fs.readFileSync('algorithm_sample/Sorting/merge_sort_bottom_up.cpp','utf8'),
    '10\n5 7 2 1 9 3 6 8 10 4\n');
  const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
  try {
    const page=await browser.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(process.env.ASM_TEST_BASE_URL+'/algorithm.html');
    const reports=await page.evaluate(async trace=>{
      const inspect=()=>{
        const root=document.querySelector('#asm-trace-root');
        const object=root.querySelector(':scope > [data-trace-snapshot]');
        const cell=object.querySelector('[data-trace-index="0"]');
        const box=cell.getBBox(),matrix=root.getScreenCTM().inverse().multiply(cell.getScreenCTM());
        const point=new DOMPoint(box.x,box.y).matrixTransform(matrix);
        return {
          fill:cell.querySelector('rect').getAttribute('fill'),
          cellX:Math.round(point.x*1e6)/1e6,cellY:Math.round(point.y*1e6)/1e6,
          hidden:Boolean(cell.closest('[display="none"], [data-trace-visibility="hidden"]')),
          name:object.querySelector('.outerframe-label').textContent,
          stroke:cell.querySelector('rect').getAttribute('stroke-width'),
          arrows:[...root.querySelectorAll('.asm-trace-keep-arrow')].map(a=>({
            id:a.dataset.traceObjectKey,from:a.dataset.traceKeepSource,to:a.dataset.traceKeepTarget,
            x1:Number(a.getAttribute('x1')),y1:Number(a.getAttribute('y1')),
            x2:Number(a.getAttribute('x2')),y2:Number(a.getAttribute('y2'))
          })),
          reused:root.querySelectorAll('[data-trace-incremental-reuse]').length
        };
      };
      const reports=[];
      for(const scenario of ['unchanged','style','name','options','visibility','position']) {
        const doc=ASMTracePlayer.apply(JSON.parse(JSON.stringify(trace)));
        doc.frames.forEach(f=>f.texts=[]);
        window.asmGetAnimationPlaybackRate=()=>4;
        const last=doc.frames.length-1, snapshot=doc.snapshots[0], key=snapshot.objectId||snapshot.id;
        if(scenario==='style') {
          doc.studio.objectStyles||={};
          doc.studio.objectStyles[doc.frames[last-1].id]={[key+'#0']:{fill:'#ff0000'}};
        }
        if(scenario==='visibility') {
          doc.studio.visibility||={};
          doc.studio.visibility[doc.frames[last-1].id]={[key+'#0']:'hidden'};
        }
        if(scenario==='position') {
          doc.studio.positions||={};
          doc.studio.positions[doc.frames[last-1].id]={[key+'#0']:{x:18,y:12}};
        }
        await ASMTracePlayer.render(last-1,{stable:true});
        if(scenario==='name') snapshot.label='changed';
        if(scenario==='options') snapshot.rendererOptions={...snapshot.rendererOptions,gridlines:0};
        await ASMTracePlayer.render(last,{fromIndex:last-1,forceTransition:true});
        const sequential=inspect();
        await ASMTracePlayer.render(last,{stable:true});
        reports.push({scenario,sequential,direct:inspect()});
      }
      return reports;
    },trace);
    for(const report of reports) {
      const {reused,...sequential}=report.sequential;
      const {reused:unused,...direct}=report.direct;
      assert.deepEqual(sequential,direct,JSON.stringify(report));
      if(report.scenario==='unchanged') assert.ok(reused>0,'must exercise actual DOM reuse');
      assert.equal(direct.fill,'#fff');
      assert.equal(direct.hidden,false);
      assert.equal(direct.name,report.scenario==='name'?'changed':'original');
      assert.equal(direct.stroke,report.scenario==='options'?'0':'1');
      assert.equal(direct.arrows.length,5);
    }
    assert.deepEqual(errors,[]);
  } finally {await browser.close();}
});
