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

test('LOD numbers appear at 14px and disappear below that boundary', {timeout:30000}, async()=>{
 const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
 try{
  const page=await browser.newPage();
  await page.setContent('<svg id="arraySvg" width="400" height="200"><g id="lod-fixture"></g></svg>');
  await page.evaluate(()=>{window.withSvgTextFitStyle=(_g,fn)=>fn();window.fitSvgText=()=>16;});
  await page.addScriptTag({path:path.resolve(__dirname,'../public/trace-structure-lod.js')});
  await page.evaluate(()=>{
   const ns='http://www.w3.org/2000/svg',g=document.getElementById('lod-fixture');
   g.setAttribute('transform','scale(0.35)');ASMStructureLOD.begin(g,0.35,true);
   const cell=document.createElementNS(ns,'g'),rect=document.createElementNS(ns,'rect');
   cell.dataset.traceIndex='0';g.append(cell);cell.append(rect);
   for(const [name,value] of Object.entries({x:0,y:0,width:40,height:40}))rect.setAttribute(name,value);
   ASMStructureLOD.record(g,cell,'123',0,0,40,40);ASMStructureLOD.finish(g);ASMStructureLOD.observe(g);
  });
  const value=page.locator('#lod-fixture [data-trace-index="0"] > text');
  await value.waitFor({state:'visible'});assert.equal(await value.textContent(),'123');
  assert.equal(await page.evaluate(()=>ASMStructureLOD.level(14)),'full');
  await page.evaluate(()=>{document.getElementById('lod-fixture').setAttribute('transform','scale(0.349)');ASMStructureLOD.refresh();});
  await value.waitFor({state:'detached'});assert.equal(await page.evaluate(()=>ASMStructureLOD.level(13.96)),'simple');
  await page.evaluate(()=>{document.getElementById('lod-fixture').setAttribute('transform','scale(0.35)');ASMStructureLOD.refresh();});
  await value.waitFor({state:'visible'});assert.equal(await value.textContent(),'123');
 }finally{await browser.close();}
});

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
  assert.equal(await page.locator('#asm-trace-root [data-asm-lod-detail]').count(),2);
  assert.equal(await page.locator('#asm-trace-root [data-asm-lod-grid]').count(),2);
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
  await page.waitForFunction(()=>!document.querySelector('#asm-trace-root [data-asm-lod-pending]'));
  assert.equal(await page.locator('#asm-trace-root [data-asm-lod-detail]').count(),0);
  const populated = await page.locator('#asm-trace-root g[data-trace-index] > text').count();
  assert.ok(populated > 0 && populated < 1000, `only nearby cells receive text: ${populated}`);
  assert.equal(await page.evaluate(()=>{
    const bounds=document.getElementById('arraySvg').getBoundingClientRect();
    return [...document.querySelectorAll('#asm-trace-root g[data-trace-index]')].every(cell=>{
      const b=cell.querySelector(':scope > rect').getBoundingClientRect();
      return b.right<bounds.left || b.left>bounds.right || b.bottom<bounds.top || b.top>bounds.bottom || !!cell.querySelector(':scope > text');
    });
  }),true);
  assert.equal(await page.locator('#asm-trace-root g[data-trace-index] > text').evaluateAll(nodes=>nodes.every(node=>node.textContent==='0')),true);
  await page.evaluate(()=>{
    window.__originalTextNodes=new Set(document.querySelectorAll('#asm-trace-root g[data-trace-index] > text'));
    setCamera(window.__lodCameraPoint.x,window.__lodCameraPoint.y,0.349,false);
  });
  await page.waitForFunction(()=>!document.querySelector('#asm-trace-root g[data-trace-index] > text'));
  await page.evaluate(()=>setCamera(window.__lodCameraPoint.x,window.__lodCameraPoint.y,0.35,false));
  await page.waitForFunction(()=>document.querySelector('#asm-trace-root g[data-trace-index] > text')&&!document.querySelector('#asm-trace-root [data-asm-lod-pending]'));
  assert.ok(await page.evaluate(()=>[...document.querySelectorAll('#asm-trace-root g[data-trace-index] > text')].some(node=>window.__originalTextNodes.has(node))),'pooled text nodes are reused');
  assert.equal(await page.evaluate(()=>ASMStructureLOD.level(13.96)), 'simple');
  assert.equal(await page.evaluate(()=>ASMStructureLOD.level(14)), 'full');
  await page.evaluate(()=>{
    const rect=document.querySelector('#asm-trace-root g[data-trace-index="30,30"] > rect'),b=rect.getBBox();
    const point=new DOMPoint(b.x+b.width/2,b.y+b.height/2).matrixTransform(rect.getScreenCTM()).matrixTransform(getViewport().getScreenCTM().inverse());
    setCamera(point.x,point.y,1,false);
  });
  await page.waitForFunction(()=>document.querySelector('#asm-trace-root g[data-trace-index="30,30"] > text')&&!document.querySelector('#asm-trace-root [data-asm-lod-pending]'));
  assert.ok(await page.evaluate(()=>[...document.querySelectorAll('#asm-trace-root [data-asm-lod]')].every(g=>g._asmLod.pool.length<=256)));
  // Screenshot evidence stays local; no test-results files are committed.
  if (process.env.ASM_LOD_SCREENSHOTS === '1') {
    await page.screenshot({path:path.join(root,'test-results/culling-profile/lod-full.png')});
  }
  assert.equal(await page.locator('#asm-trace-root [data-asm-lod-batch]').count(),0);
  const geometryAfter=await page.evaluate(()=>[...document.querySelectorAll('#asm-trace-root g[data-trace-index]')].map(el=>({key:el.dataset.traceObjectKey,bounds:ASMTraceRenderers.currentPlacement(el.dataset.traceObjectKey,false)})));
  assert.deepEqual(geometryAfter,geometryBefore,'LOD does not move any cell anchor');
  await page.evaluate(()=>setCamera(window.__lodCameraPoint.x,window.__lodCameraPoint.y,0.3,false));
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
  // Closing/reopening the editor is a stable redraw, not an event replay.
  for(let cycle=0;cycle<3;cycle++){
    await page.evaluate(()=>ASMTraceStudio.close());
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert.equal(await page.locator('#asm-trace-root [data-asm-lod]').count(),2,`LOD survives Studio close ${cycle+1}`);
    await page.evaluate(()=>setCamera(window.__lodCameraPoint.x,window.__lodCameraPoint.y,0.35,false));
    await page.waitForFunction(()=>document.querySelector('#asm-trace-root g[data-trace-index] > text')&&!document.querySelector('#asm-trace-root [data-asm-lod-pending]'));
    await page.evaluate(()=>setCamera(window.__lodCameraPoint.x,window.__lodCameraPoint.y,0.1,false));
    await page.waitForFunction(()=>[...document.querySelectorAll('#asm-trace-root [data-asm-lod]')].every(el=>el.dataset.asmLod==='overview'));
    assert.equal(await page.locator('#asm-trace-root g[data-trace-index] > text').count(),0);
    await page.evaluate(()=>ASMTraceStudio.open());
  }
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
  // Actual cell width, rather than a fixed nominal 40px width, controls LOD.
  await page.evaluate(()=>{
    const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
    svg.id='lod-variable-width-fixture';svg.style.cssText='position:fixed;left:0;top:0;width:200px;height:100px';
    document.body.append(svg);const group=document.createElementNS(ns,'g');svg.append(group);
    group.setAttribute('transform','scale(0.3)');ASMStructureLOD.begin(group,0.3,true);
    for(const [index,width] of [40,80].entries()){
      const cell=document.createElementNS(ns,'g'),rect=document.createElementNS(ns,'rect');
      cell.dataset.traceIndex=String(index);cell.append(rect);group.append(cell);
      for(const [key,value] of Object.entries({x:index*100,y:0,width,height:40}))rect.setAttribute(key,value);
      ASMStructureLOD.record(group,cell,'123',index*100,0,width,40);
    }
    ASMStructureLOD.finish(group);
  });
  await page.waitForFunction(()=>document.querySelector('#lod-variable-width-fixture g[data-trace-index="1"] > text'));
  assert.equal(await page.locator('#lod-variable-width-fixture g[data-trace-index="0"] > text').count(),0);
  await page.evaluate(()=>document.getElementById('lod-variable-width-fixture').remove());
  const numeric=await page.evaluate(()=>{
    const svg=document.getElementById('arraySvg'),g=document.createElementNS(svg.namespaceURI,'g');svg.append(g);
    const proto=SVGTextContentElement.prototype,original=proto.getComputedTextLength,measured=[];
    proto.getComputedTextLength=function(){measured.push(this.textContent);return original.call(this);};
    try {
      clearSvgTextFitCache();g.style.fontFamily='monospace';
      const first=fitSvgText(g,'0123456789',1000,40),cold=measured.slice();measured.length=0;
      fitSvgText(g,'9876543210',1000,40);const warm=measured.length;
      g.style.letterSpacing='1px';fitSvgText(g,'0123456789',1000,40);const changed=measured.length;measured.length=0;
      fitSvgText(g,'-12.3',1000,40);const mixed=measured.slice();measured.length=0;
      document.fonts.dispatchEvent(new Event('loadingdone'));fitSvgText(g,'0123456789',1000,40);
      return {first,cold,warm,changed,mixed,invalidated:measured.length};
    }finally{proto.getComputedTextLength=original;g.remove();}
  });
  assert.ok(numeric.cold.length>0&&numeric.cold.length<=40);
  assert.ok(numeric.cold.every(value=>/^[0-9]$/.test(value)));
  assert.equal(numeric.warm,0);
  assert.ok(numeric.changed>0&&numeric.invalidated>0);
  assert.ok(numeric.mixed.length>0&&numeric.mixed.every(value=>value==='-12.3'));
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({studioEntryMs:entry,clone,typography}));
 }finally{await browser?.close();server.kill();}
});
