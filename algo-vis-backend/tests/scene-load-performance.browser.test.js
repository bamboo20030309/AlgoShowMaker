const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const net = require('node:net');
const {spawn} = require('node:child_process');
const {chromium} = require('playwright');
const source=`#include <bits/stdc++.h>
using namespace std;
int main() {
 vector<int> arr(500, 0);
 vector<vector<int>> grid(50, vector<int>(50, 0));
 // @frame arr,grid
 cout << "完成";
}
/* @asm-view
{"version":1,"rules":[],"skins":{},"studio":{"eventSettings":{"autoFixedEnabled":false,"autoLoopBoundaryEnabled":false}}}
@asm-view */`;

test('RUN stays on canvas; stable Studio entry and thumbnail reuse geometry; text fitting caches exact typography', {timeout:120000}, async()=>{
 const root=path.resolve(__dirname,'..');
 const port=await new Promise(resolve=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
 const server=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:String(port),ASM_REGRESSION:'1',JWT_SECRET:require('node:crypto').randomBytes(32).toString('hex')},windowsHide:true,stdio:'ignore'});
 let browser;
 try {
  const base=`http://127.0.0.1:${port}`;
  for(let i=0;i<100;i++){try{if((await fetch(base+'/algorithm.html')).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
  browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/algorithm.html',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.ASMTraceEditor&&typeof aceEditor!=='undefined');
  await page.evaluate(code=>{
    window.__renders=0;const render=ASMTraceRenderers.renderFrame;
    ASMTraceRenderers.renderFrame=function(...args){window.__renders++;return render.apply(this,args);};
    aceEditor.setValue(code,-1);document.getElementById('runBtn').click();
  },source);
  await page.waitForFunction(()=>!document.getElementById('runBtn').classList.contains('loading'),{},{timeout:90000});
  await page.waitForTimeout(250);
  assert.equal(await page.locator('#outputArea').textContent(),'完成');
  assert.equal(await page.evaluate(()=>document.body.classList.contains('asm-trace-studio-open')),false);
  assert.equal(await page.locator('.tab-btn[data-tab="tab-canvas"]').evaluate(el=>el.classList.contains('active')),true);
  assert.equal(await page.evaluate(()=>window.__renders),1);
  assert.equal(await page.locator('#asm-trace-root g[data-trace-index]').count(),3000);
  await page.waitForFunction(()=>document.querySelector('#asm-trace-root [data-asm-lod="overview"]'));
  const geometryBefore=await page.evaluate(()=>[...document.querySelectorAll('#asm-trace-root g[data-trace-index]')].map(el=>({key:el.dataset.traceObjectKey,bounds:ASMTraceRenderers.currentPlacement(el.dataset.traceObjectKey,false)})));
  assert.equal(await page.locator('#asm-trace-root g[data-trace-index] > text').count(),0);
  assert.ok(await page.locator('#asm-trace-root [data-asm-lod-batch]').count()>0);
  await page.evaluate(()=>{
    const cell=document.querySelector('#asm-trace-root g[data-trace-index*=","]');
    const rect=cell.querySelector(':scope > rect');
    const box=rect.getBBox();
    const point=new DOMPoint(box.x+box.width/2,box.y+box.height/2)
      .matrixTransform(rect.getScreenCTM()).matrixTransform(getViewport().getScreenCTM().inverse());
    window.__lodCameraPoint=point;
    setCamera(point.x,point.y,1,false);
  });
  await page.waitForFunction(()=>[...document.querySelectorAll('#asm-trace-root [data-asm-lod]')].every(el=>el.dataset.asmLod==='full'));
  assert.equal(await page.locator('#asm-trace-root g[data-trace-index] > text').count(),3000);
  assert.equal(await page.locator('#asm-trace-root g[data-trace-index] > text').evaluateAll(nodes=>nodes.every(node=>node.textContent==='0')),true);
  // Screenshot evidence stays local; no test-results files are committed.
  if (process.env.ASM_LOD_SCREENSHOTS === '1') {
    await page.screenshot({path:path.join(root,'test-results/culling-profile/lod-full.png')});
  }
  assert.equal(await page.locator('#asm-trace-root [data-asm-lod-batch]').count(),0);
  const geometryAfter=await page.evaluate(()=>[...document.querySelectorAll('#asm-trace-root g[data-trace-index]')].map(el=>({key:el.dataset.traceObjectKey,bounds:ASMTraceRenderers.currentPlacement(el.dataset.traceObjectKey,false)})));
  assert.deepEqual(geometryAfter,geometryBefore,'LOD does not move any cell anchor');
  await page.evaluate(()=>setCamera(window.__lodCameraPoint.x,window.__lodCameraPoint.y,0.4,false));
  await page.waitForFunction(()=>[...document.querySelectorAll('#asm-trace-root [data-asm-lod]')].every(el=>el.dataset.asmLod==='simple'));
  assert.equal(await page.locator('#asm-trace-root g[data-trace-index] > text').count(),0);
  await page.evaluate(()=>setCamera(window.__lodCameraPoint.x,window.__lodCameraPoint.y,0.1,false));
  await page.waitForFunction(()=>[...document.querySelectorAll('#asm-trace-root [data-asm-lod]')].every(el=>el.dataset.asmLod==='overview'));
  if (process.env.ASM_LOD_SCREENSHOTS === '1') {
    await page.screenshot({path:path.join(root,'test-results/culling-profile/lod-overview.png')});
  }
  const entry=await page.evaluate(()=>{const t=performance.now();ASMTraceStudio.open();return performance.now()-t;});
  await page.waitForFunction(()=>document.querySelector('[data-trace-scene-reused="true"]'));
  assert.equal(await page.evaluate(()=>window.__renders),1,'Studio reuses stable scene');
  const clone=await page.locator('[data-trace-scene-reused="true"]').evaluate(el=>({
    cells:el.querySelectorAll('g[data-trace-index]').length,
    culled:el.querySelectorAll('[data-asm-viewport-culled]').length,
    sharedIds:[...el.querySelectorAll('[id]')].filter(node=>document.querySelectorAll('#'+CSS.escape(node.id)).length!==1).length
  }));
  assert.deepEqual(clone,{cells:3000,culled:0,sharedIds:0});
  // Re-running while Studio is open must preserve source and land on canvas.
  // Studio hides RUN; invoke the same handler to verify the guarded reload path.
  await page.evaluate(()=>document.getElementById('runBtn').click());
  await page.waitForFunction(()=>!document.getElementById('runBtn').classList.contains('loading'),{},{timeout:90000});
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>document.body.classList.contains('asm-trace-studio-open')),false);
  assert.equal(await page.evaluate(()=>aceEditor.getValue().includes('arr(500, 0)')),true);
  // Saved legacy data roundtrip and explicit disabled settings remain usable.
  const saved=await page.evaluate(()=>JSON.stringify(ASMTracePlayer.getDocument()));
  await page.evaluate(raw=>ASMTraceEditor.applyTraceDocument(JSON.parse(raw),{openStudio:false}),saved);
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(()=>ASMTracePlayer.getDocument().studio.eventSettings.autoFixedEnabled),false);
  assert.equal(await page.evaluate(()=>ASMTracePlayer.getDocument().studio.eventSettings.autoLoopBoundaryEnabled),false);
  await page.evaluate(()=>{
    const doc=ASMTracePlayer.getDocument(),frame=doc.frames[0];
    const variable=Object.entries(doc.variables).find(([,value])=>value.kind==='matrix')[0];
    frame.styles.push({id:'lod-highlight',targetVariableId:variable,
      selector:{type:'matrix-cell',rowExpression:'0',columnExpression:'0'},styleType:'highlight',color:'red'});
    return ASMTracePlayer.renderStable(0);
  });
  await page.waitForFunction(()=>document.querySelector('#asm-trace-root [data-trace-attachment-kind="highlight"]'));
  const preservedHint=await page.locator('#asm-trace-root [data-trace-attachment-kind="highlight"]').first().evaluate(el=>({
    color:el.getAttribute('stroke'),rectSuppressed:el.hasAttribute('data-asm-lod-rect'),
    batch:!!el.closest('[data-asm-lod-batch]')
  }));
  assert.equal(preservedHint.rectSuppressed,false);
  assert.equal(preservedHint.batch,false);
  assert.equal(preservedHint.color,'red');
  // Hidden objects require a fresh editing scene, and thumbnails retain the
  // existing renderer fallback and its editing ghost visibility.
  await page.evaluate(()=>{
    const doc=ASMTracePlayer.getDocument();const frame=doc.frames[0];
    const key=document.querySelector('#asm-trace-root .asm-trace-object').dataset.traceObjectKey;
    doc.studio.visibility={[frame.id]:{[key]:'hidden'}};
    window.__hiddenKey=key;
    return ASMTracePlayer.renderStable(0);
  });
  await page.evaluate(()=>ASMTraceStudio.open());
  assert.equal(await page.locator('#asm-trace-root .trace-studio-hidden-object').count()>0,true);
  const hiddenThumb=await page.evaluate(()=>{
    const doc=ASMTracePlayer.getDocument();const thumb=ASMTraceRenderers.createThumbnail(doc,doc.frames[0]);
    return {reused:thumb.dataset.traceSceneReused||'',hidden:!!thumb.querySelector('[data-trace-object-key="'+window.__hiddenKey+'"].trace-studio-hidden-object')};
  });
  assert.deepEqual(hiddenThumb,{reused:'',hidden:true});
  const typography=await page.evaluate(()=>{
    const svg=document.getElementById('arraySvg'),g=document.createElementNS(svg.namespaceURI,'g');svg.append(g);
    const proto=SVGTextContentElement.prototype,original=proto.getComputedTextLength;let count=0;
    proto.getComputedTextLength=function(){count++;return original.call(this);};
    try {
      clearSvgTextFitCache();g.style.fontFamily='monospace';
      const first=fitSvgText(g,'MMMM',40,40),firstCalls=count;
      const second=fitSvgText(g,'MMMM',40,40),repeatCalls=count-firstCalls;
      g.style.fontFamily='serif';g.style.letterSpacing='2px';
      const changed=fitSvgText(g,'MMMM',40,40),changedCalls=count-firstCalls;
      clearSvgTextFitCache();const fresh=fitSvgText(g,'MMMM',40,40);
      return {first,second,firstCalls,repeatCalls,changed,fresh,changedCalls};
    }finally{proto.getComputedTextLength=original;g.remove();}
  });
  assert.equal(typography.first,typography.second);assert.equal(typography.repeatCalls,0);
  assert.ok(typography.firstCalls>0&&typography.changedCalls>0);assert.equal(typography.changed,typography.fresh);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({studioEntryMs:entry,clone,typography}));
 }finally{await browser?.close();server.kill();}
});
