const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const fs=require('node:fs/promises');
const path=require('node:path');
const {startIsolatedServer}=require('./helpers/isolated-server');

test('legacy arrow defaults and explicit custom or disabled animation settings survive load and reopen', {timeout:30000},async t=>{
 const {base}=await startIsolatedServer(t);const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());const page=await browser.newPage();
 const source=await fs.readFile(path.join(__dirname,'../public/slides.js'),'utf8');
 await page.route('**/slides.js*',r=>r.fulfill({contentType:'application/javascript',body:source.replace('function installArrowRenderer(obj) {','function installArrowRenderer(obj) { (window.fixtureArrows ||= {})[obj.ttsObjectId] = obj;')}));
 await page.addInitScript(()=>{if(sessionStorage.getItem('legacyArrow'))return;sessionStorage.setItem('legacyArrow','1');const line={type:'line',x1:-100,y1:0,x2:100,y2:0,left:400,top:200,stroke:'#ff0055',strokeWidth:16,asmShapeType:'arrow'};localStorage.setItem('asm_reveal_fabric_deck_v5',JSON.stringify({groups:[{id:'g',slides:[{id:'s',widgets:[],canvas:{objects:[{...line,ttsObjectId:'old'},{...line,ttsObjectId:'hidden',top:300,arrowHeadStyle:'triangle',arrowHeadSize:37,fragmentEnabled:false}]}}]}]}));});
 for(let pass=0;pass<2;pass++){
  if(pass)await page.reload();else await page.goto(base+'/slides.html');
  await page.waitForFunction(()=>document.body.dataset.fabricBuild?.startsWith('ready')&&window.fixtureArrows?.old);
  assert.deepEqual(await page.evaluate(()=>{const a=fixtureArrows.old,b=fixtureArrows.hidden;return{defaultStyle:a.arrowHeadStyle,defaultSize:a.arrowHeadSize,stroke:a.stroke,width:a.strokeWidth,fragment:b.fragmentEnabled,style:b.arrowHeadStyle,size:b.arrowHeadSize};}),{defaultStyle:'open',defaultSize:24,stroke:'#ff0055',width:16,fragment:false,style:'triangle',size:37});
  await page.waitForFunction(()=>document.body.dataset.localDeckSave==='saved');
 }
});

test('slide arrow shafts stop at filled head rear after creation and saved-object reload', {timeout:60000},async t=>{
 const {base}=await startIsolatedServer(t);
 const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:1400,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const source=await fs.readFile(path.join(__dirname,'../public/slides.js'),'utf8');
 await page.route('**/slides.js*',r=>r.fulfill({contentType:'application/javascript',body:source.replace('function installArrowRenderer(obj) {','function installArrowRenderer(obj) { window.fixtureArrow = obj;')}));
 await page.addInitScript(()=>{if(sessionStorage.getItem('arrowFixture'))return;sessionStorage.setItem('arrowFixture','1');localStorage.setItem('asm_reveal_fabric_deck_v5',JSON.stringify({groups:[{id:'g',slides:[{id:'s',widgets:[],canvas:{objects:[]}}]}]}));});
 await page.goto(base+'/slides.html');await page.waitForFunction(()=>document.body.dataset.fabricBuild?.startsWith('ready'));
 if(!await page.locator('body').evaluate(e=>e.classList.contains('asm-edit-mode')))await page.locator('#modeToggleBtn').click();
 await page.locator('#shapeMenuBtn').click();await page.locator('#shapeMenu [data-shape="arrow"]').click();
 await page.waitForFunction(()=>window.fixtureArrow);
 const inspect=()=>page.evaluate(()=>{
  const results=[];
  for(const style of ['triangle','diamond','circle','open'])for(const angle of [0,Math.PI/2,Math.PI,Math.PI/4])for(const cap of ['round','square','butt'])for(const reverse of [false,true]){
   const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d');ctx.translate(256,256);ctx.rotate(angle);ctx.lineCap=cap;
   const obj=new fabric.Line(reverse?[90,0,-90,0]:[-90,0,90,0],{stroke:'rgba(255,0,0,0.5)',strokeWidth:16,arrowHeadStyle:style,arrowHeadSize:24,strokeLineCap:cap});
   fixtureArrow._render.call(obj,ctx);
   function alpha(x,y=0){if(reverse){x=-x;y=-y;}const px=Math.floor(256+Math.cos(angle)*x-Math.sin(angle)*y),py=Math.floor(256+Math.sin(angle)*x+Math.cos(angle)*y);return ctx.getImageData(px,py,1,1).data[3];}
   const rear=90-(style==='triangle'?24:style==='diamond'?24*1.35:24*.68);
   results.push({style,angle,cap,reverse,beyond:alpha(95),inside:alpha(rear+5),shaft:alpha(0)});
  }
  return results;
 });
 function verify(results){for(const r of results){assert.ok(r.shaft>=120,JSON.stringify(r));if(r.style==='open')continue;assert.equal(r.beyond,0,JSON.stringify(r));assert.ok(r.inside>=120&&r.inside<=135,'head must not overlap shaft: '+JSON.stringify(r));}}
 verify(await inspect());
 // Persist custom arrow settings through the actual editor controls and reopen.
 const center=await page.evaluate(()=>{const a=fixtureArrow,c=a.canvas,p=fabric.util.transformPoint(a.getCenterPoint(),c.viewportTransform),r=c.upperCanvasEl.getBoundingClientRect();return{x:r.left+p.x*r.width/c.width,y:r.top+p.y*r.height/c.height};});
 await page.mouse.click(center.x,center.y);
 await page.locator('#shapeStrokeBtn').click();
 assert.equal(await page.locator('#shapeArrowStyleSelect').count(),0);assert.match(await page.locator('#shapeArrowControls').innerText(),/箭頭大小/);assert.doesNotMatch(await page.locator('#shapeArrowControls').innerText(),/Arrowhead|Arrow size/);
 for(const style of ['diamond','circle','open','triangle']){await page.locator(`[data-arrow-head-style="${style}"]`).click();assert.equal(await page.evaluate(()=>fixtureArrow.arrowHeadStyle),style);assert.equal(await page.locator('#shapeArrowStyleChoices [aria-pressed="true"]').count(),1);assert.equal(await page.locator(`[data-arrow-head-style="${style}"]`).getAttribute('aria-pressed'),'true');}
 await page.locator('#shapeArrowSizeInput').focus();await page.locator('#shapeArrowSizeInput').press('End');
 await page.locator('#shapeStrokeWidthInput').focus();await page.locator('#shapeStrokeWidthInput').press('End');
 await page.waitForFunction(()=>document.body.dataset.localDeckSave==='saved');
 const saved=await page.evaluate(async()=>await ASMSlideStorage.create(indexedDB,localStorage).loadDeck('asm_reveal_fabric_deck_v5'));
 const arrow=saved.groups[0].slides[0].canvas.objects.find(o=>o.asmShapeType==='arrow');assert.equal(arrow.arrowHeadStyle,'triangle');assert.equal(arrow.arrowHeadSize,80);
 await page.reload();await page.waitForFunction(()=>document.body.dataset.fabricBuild?.startsWith('ready')&&window.fixtureArrow);verify(await inspect());
 assert.equal(await page.evaluate(()=>fixtureArrow.arrowHeadStyle),'triangle');assert.equal(await page.evaluate(()=>fixtureArrow.arrowHeadSize),80);
 await page.evaluate(()=>{const a=fixtureArrow;a.set({x1:105,x2:-105,arrowHeadSize:48,stroke:'#a65b23',strokeWidth:8});a.setPositionByOrigin(new fabric.Point(640,360),'center','center');a.setCoords();a.canvas.discardActiveObject();a.canvas.requestRenderAll();});
 await fs.mkdir(path.join(__dirname,'../test-results/slide-arrow-head'),{recursive:true});await page.screenshot({path:path.join(__dirname,'../test-results/slide-arrow-head/left-fixed.png')});
 const reopenedCenter=await page.evaluate(()=>{const a=fixtureArrow,c=a.canvas,p=fabric.util.transformPoint(a.getCenterPoint(),c.viewportTransform),r=c.upperCanvasEl.getBoundingClientRect();return{x:r.left+p.x*r.width/c.width,y:r.top+p.y*r.height/c.height};});await page.mouse.click(reopenedCenter.x,reopenedCenter.y);await page.locator('#shapeStrokeBtn').click();
 await page.screenshot({path:path.join(__dirname,'../test-results/slide-arrow-head/icon-picker.png')});
 assert.deepEqual(errors,[]);
});
