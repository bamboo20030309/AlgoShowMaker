const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { compile } = require('./helpers/compile');

test('an introduction object aligns to the future reserved root without joining the tree', { timeout: 60000 }, async () => {
  let code = fs.readFileSync('algorithm_sample/Sorting/merge_sort_recursive_layout.cpp','utf8')
    .replace(/as res\b/g,'as merged')
    .replace('int i = L;\n    int j = mid + 1;', 'int i = L, j = mid + 1;')
    .replace('merged.push_back(num[i++]);','merged.push_back(num[i]);\n            i++;')
    .replace('merged.push_back(num[j++]);','merged.push_back(num[j]);\n            j++;')
    .replace('// @style num[L:R] background AV_green!', '// @style num[L] mark')
    .replace('// @style num[L:R] background AV_green!', '// @style num[L:R] mark')
    .replace('in merge_scene color AV_green! width 2','in merge_scene')
    .replace('// @text "補上左側剩餘元素"', '// @style merged[0:merged.size()-2] mark\n        // @text "補上左側剩餘元素"')
    .replace('// @text "補上右側剩餘元素"', '// @style merged[0:merged.size()-2] mark\n        // @text "補上右側剩餘元素"')
    .replace('merge_sort(num, 0, n - 1);','// @frame num\n    // @place num.top-left at split_tree.root.top-left\n    // @text "這是 Merge Sort 的範例" at num.bottom\n    merge_sort(num, 0, n - 1);')
    .replace(/\/\/ @frame num in merge_scene[\s\S]*?return 0;/,'// @frame\n    // @text "Merge Sort 完成" at merge_tree.root.bottom\n    return 0;')
    .replaceAll('[${L}:${R}]','[${L}{：:到}${R}]');
  code='// @defaults\n// @camera auto\n// @enddefaults\n'+code;
  code+='\n/* @asm-view\n{"version":1,"studio":{"eventSettings":{"autoFixedEnabled":false,"autoLoopBoundaryEnabled":false}}}\n@asm-view */';
  const { trace } = await compile(code,'10\n38 27 43 3 9 82 10 19 84 60\n');
  const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
  try {
    const page=await browser.newPage(); const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(process.env.ASM_TEST_BASE_URL+'/algorithm.html');
    const result=await page.evaluate(async trace=>{
      const inspect=(index=0)=>{
        const root=document.querySelector('#asm-trace-root');
        const object=[...root.querySelectorAll('[data-trace-variable]')].find(e=>
          e.dataset.traceVariable===ASMTracePlayer.getDocument().frames[index].source.primaryVariableId);
        const rect=object?.querySelector('.outerframe-bg');
        if(!rect)throw new Error('missing primary outerframe');
        const b=rect.getBBox(),m=root.getScreenCTM().inverse().multiply(rect.getScreenCTM());
        const p=new DOMPoint(b.x,b.y).matrixTransform(m);
        const screen=rect.getBoundingClientRect();
        return {x:p.x,y:p.y,width:b.width,height:b.height,screen:{x:screen.x,y:screen.y,width:screen.width,height:screen.height},
          layout:ASMTraceRenderers.currentPlacement('split_tree',false),reserved:ASMTraceRenderers.currentPlacement('reserved-root:split_tree',false),
          visibleNodes:root.querySelectorAll('[data-trace-layout-id="split_tree"][data-trace-layout-node]').length,
          anchors:root.querySelectorAll('[data-trace-reserved-layout-root]').length};
      };
      const reports=[];
      const settle=()=>new Promise(resolve=>setTimeout(resolve,650));
      for(const speed of [1,4]){
        ASMTracePlayer.apply(trace); window.asmGetAnimationPlaybackRate=()=>speed;
        await ASMTracePlayer.render(0,{stable:true});await settle();const before=inspect();
        await ASMTracePlayer.render(1,{fromIndex:0,forceTransition:true});await settle();const after=inspect(1);
        await ASMTracePlayer.render(0,{stable:true});await settle();const back=inspect();
        reports.push({speed,before,after,back});
      }
      const saved=JSON.parse(JSON.stringify(ASMTracePlayer.getDocument()));
      ASMTracePlayer.apply(saved);await ASMTracePlayer.render(0,{stable:true});await settle();const reopened=inspect();
      await ASMTraceStudio.open();await settle();const studio=inspect();
      const thumbnails=[];
      for(const index of [0,1]){
        const thumbnail=ASMTraceRenderers.createThumbnail(saved,saved.frames[index]);
        document.body.append(thumbnail);
        const root=thumbnail.querySelector('[data-trace-thumbnail-root]');
        const rect=[...root.querySelectorAll('[data-trace-variable]')].find(e=>e.dataset.traceVariable===saved.frames[index].source.primaryVariableId)?.querySelector('.outerframe-bg');
        const b=rect.getBBox(),m=root.getScreenCTM().inverse().multiply(rect.getScreenCTM());
        const p=new DOMPoint(b.x,b.y).matrixTransform(m);
        thumbnails.push({x:p.x,y:p.y,width:b.width,height:b.height});thumbnail.remove();
      }
      const disabled=JSON.parse(JSON.stringify(saved));
      disabled.layouts.find(l=>l.id==='split_tree').reserve=false;
      ASMTracePlayer.apply(disabled);await ASMTracePlayer.render(0,{stable:true});const withoutReserve=inspect();
      return {reports,reopened,studio,thumbnails,withoutReserve,disabledPreserved:ASMTracePlayer.getDocument().layouts.find(l=>l.id==='split_tree').reserve===false};
    },trace);
    for(const r of result.reports){
      for(const axis of ['x','y','width','height'])assert.ok(Math.abs(r.before[axis]-r.after[axis])<.1,JSON.stringify(r));
      assert.equal(r.before.visibleNodes,0);assert.equal(r.after.visibleNodes,1);
      assert.equal(r.before.anchors,1);assert.equal(r.after.anchors,0);
      for(const axis of ['x','y','width','height']){
        assert.ok(Math.abs(r.before.screen[axis]-r.after.screen[axis])<.1,JSON.stringify(r));
        assert.ok(Math.abs(r.back[axis]-r.before[axis])<.1,JSON.stringify(r));
      }
    }
    for(const axis of ['x','y','width','height'])assert.ok(Math.abs(result.reopened[axis]-result.reports[0].before[axis])<.1);
    for(const axis of ['x','y','width','height']){
      assert.ok(Math.abs(result.studio[axis]-result.reopened[axis])<.1);
      assert.ok(Math.abs(result.thumbnails[0][axis]-result.thumbnails[1][axis])<.1,JSON.stringify(result.thumbnails));
    }
    assert.equal(result.withoutReserve.anchors,0);
    assert.equal(result.disabledPreserved,true);
    assert.deepEqual(errors,[]);
  } finally {await browser.close();}
});
