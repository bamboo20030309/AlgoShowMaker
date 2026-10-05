const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { compile } = require('./helpers/compile');

test('focus camera must not change recursive merge world layout', { timeout: 240000 }, async () => {
  const baseline = fs.readFileSync('algorithm_sample/Sorting/merge_sort_recursive_layout.cpp', 'utf8');
  const focused = baseline.replace(/(\/\/ @text "(?:合併左右子樹|比較兩側開頭，將較小值放入結果|補上左側剩餘元素|補上右側剩餘元素)")/g,
    '// @camera focus merged offset(0,-40)\n        $1');
  const { trace } = await compile(focused, '10\n5 7 2 1 9 3 6 8 10 4\n');
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(process.env.ASM_TEST_BASE_URL + '/algorithm.html');
    const reports = await page.evaluate(async trace => {
      const geometry = (root=document.querySelector('#asm-trace-root')) => [...root.querySelectorAll('.outerframe-bg')].map(rect => {
        const b = rect.getBBox();
        const m = root.getScreenCTM().inverse().multiply(rect.getScreenCTM());
        const p = new DOMPoint(b.x,b.y).matrixTransform(m);
        const q=new DOMPoint(b.x+b.width,b.y+b.height).matrixTransform(m);
        return { x:p.x,y:p.y,width:q.x-p.x,height:q.y-p.y };
      });
      const results = [];
      for (const focus of [false,true]) for(const speed of [1,4]) for(const autoplay of [false,true]) {
        const copy = JSON.parse(JSON.stringify(trace));
        if (!focus) {
          const strip = value => {
            if (!value || typeof value !== 'object') return;
            if (value.mode === 'focus') { value.mode = 'auto'; delete value.target; }
            for (const [key,child] of Object.entries(value)) {
              if (key === 'camera' && child?.target) value[key] = { mode:'auto' };
              else strip(child);
            }
          };
          strip(copy);
        }
        if(autoplay) {
          copy.frames=copy.frames.slice(0,15);
          copy.frames.forEach(frame=>frame.texts=[]);
        }
        const loaded=ASMTracePlayer.apply(copy);
        const frames = [];
        for (let i=0;i<15;i++) {
          await ASMTracePlayer.render(i,{stable:true});
          frames.push({index:i,geometry:geometry()});
        }
        const transitions=[];
        // Exercise the actual consecutive playback history, not just stable jumps.
        await ASMTracePlayer.render(11,{stable:true});
        window.asmGetAnimationPlaybackRate=()=>4;
        await ASMTracePlayer.render(12,{fromIndex:11,forceTransition:true});
        window.asmGetAnimationPlaybackRate=()=>speed;
        for (const index of [13,14]) {
          let done=false;
          let pending;
          if(autoplay) {
            // Limit autoplay to this adjacent pair without changing the reserved tree.
            loaded.frames=loaded.frames.slice(0,index+1);
            document.querySelector('#playToggleBtn').click();
          } else pending=ASMTracePlayer.render(index,{fromIndex:index-1,forceTransition:true}).finally(()=>done=true);
          const samples=[];
          const deadline=performance.now()+30000;
          do {
            await new Promise(requestAnimationFrame); samples.push(geometry());
            if(performance.now()>deadline) throw new Error('transition timed out');
            if(autoplay) done=document.querySelector('#playToggleBtn').getAttribute('aria-pressed')!=='true';
          } while(!done);
          if(pending) await pending;
          if(autoplay) loaded.frames=copy.frames;
          transitions.push({index,samples,final:geometry()});
        }
        results.push({focus,speed,autoplay,frames,transitions});
        if(focus && speed===4 && !autoplay) {
          const normal=geometry();
          ASMTraceStudio.open();
          await new Promise(requestAnimationFrame);
          const studio=geometry();
          const thumbnail=ASMTraceRenderers.createThumbnail(loaded,loaded.frames[14],loaded.frames[13]);
          document.body.append(thumbnail);
          const thumb=geometry(thumbnail.querySelector('[data-trace-thumbnail-root]'));
          thumbnail.remove();
          ASMTraceStudio.close();
          for(const candidate of [studio,thumb]) {
            if(candidate.length!==normal.length) throw new Error('Studio/thumbnail object count mismatch');
            candidate.forEach((box,j)=>Object.keys(box).forEach(k=>{
              if(Math.abs(box[k]-normal[j][k])>=.1) throw new Error(`Studio/thumbnail layout mismatch: ${j} ${k}`);
            }));
          }
        }
      }
      return results;
    }, trace);
    for(const r of reports) for(const t of r.transitions) {
      const expected=r.frames[t.index].geometry;
      assert.equal(t.final.length,expected.length);
      for(let j=0;j<expected.length;j++) for(const k of ['x','y','width','height'])
        assert.ok(Math.abs(t.final[j][k]-expected[j][k])<.1,JSON.stringify({focus:r.focus,frame:t.index+1,j,k,actual:t.final[j],expected:expected[j]}));
      // Existing retained nodes must not acquire a temporary layout offset.
      const before=r.frames[t.index-1].geometry;
      for(const sample of t.samples) for(let j=0;j<before.length;j++) for(const k of ['x','y','width','height'])
        assert.ok(Math.abs(sample[j][k]-before[j][k])<.1,JSON.stringify({focus:r.focus,frame:t.index+1,j,k,actual:sample[j],expected:before[j]}));
    }
    for (let i=0;i<15;i++) {
      const a=reports[0].frames[i].geometry, b=reports[4].frames[i].geometry;
      assert.equal(a.length,b.length);
      for(let j=0;j<a.length;j++) for(const k of ['x','y','width','height'])
        assert.ok(Math.abs(a[j][k]-b[j][k])<0.1, JSON.stringify({frame:i+1,object:j,k,a:a[j],b:b[j]}));
    }
    assert.deepEqual(errors,[]);
  } finally { await browser.close(); }
});
