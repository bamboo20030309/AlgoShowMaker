const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require('playwright');
const {startIsolatedServer}=require('./helpers/isolated-server');

test('arrow heads and two extra screen pixels around shafts are selectable after creation and old-object reopen', {timeout:60000},async t=>{
 const {base}=await startIsolatedServer(t),browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const source=await fs.readFile(path.join(__dirname,'../public/slides.js'),'utf8');
 await page.route('**/slides.js*',r=>r.fulfill({contentType:'application/javascript',body:source.replace('function installArrowRenderer(obj) {','function installArrowRenderer(obj) { window.fixtureArrow = obj;')}));
 await page.addInitScript(()=>{if(sessionStorage.getItem('hitAreaFixture'))return;sessionStorage.setItem('hitAreaFixture','1');localStorage.setItem('asm_reveal_fabric_deck_v5',JSON.stringify({groups:[{id:'g',slides:[{id:'s',widgets:[],canvas:{objects:[{type:'line',x1:-120,y1:0,x2:120,y2:0,left:300,top:280,stroke:'#a65b23',strokeWidth:2,asmShapeType:'arrow',fragmentEnabled:false}]}}]}]}));});
 async function ready(){await page.waitForFunction(()=>document.body.dataset.fabricBuild?.startsWith('ready')&&window.fixtureArrow);if(!await page.locator('body').evaluate(e=>e.classList.contains('asm-edit-mode')))await page.locator('#modeToggleBtn').click();}
 await page.goto(base+'/slides.html');await ready();
 async function clickPoint(back,side){const point=await page.evaluate(({back,side})=>{const a=fixtureArrow,c=a.canvas,p=a.calcLinePoints(),m=a.calcTransformMatrix(),angle=Math.atan2(p.y2-p.y1,p.x2-p.x1),local=new fabric.Point(p.x2-Math.cos(angle)*back-Math.sin(angle)*side,p.y2-Math.sin(angle)*back+Math.cos(angle)*side),v=fabric.util.transformPoint(fabric.util.transformPoint(local,m),c.viewportTransform),r=c.upperCanvasEl.getBoundingClientRect();return{x:r.left+v.x*r.width/c.width,y:r.top+v.y*r.height/c.height};},{back,side});await page.mouse.click(point.x,point.y);return page.evaluate(()=>fixtureArrow.canvas.getActiveObject()===fixtureArrow);}
 for(const style of ['open','triangle','diamond','circle'])for(const angle of [0,90,180,37]){
  await page.evaluate(({style,angle})=>{const a=fixtureArrow;a.set({arrowHeadStyle:style,arrowHeadSize:60,angle});a.setPositionByOrigin(new fabric.Point(640,330),'center','center');a.setCoords();a.canvas.discardActiveObject();a.canvas.renderAll();},{style,angle});
  assert.equal(await clickPoint(style==='circle'?20:48,style==='circle'?12:20),true,`head ${style}, angle ${angle}`);
 }
 for(const zoom of [.7,1.3]){
  const points=await page.evaluate(zoom=>{const a=fixtureArrow,c=a.canvas;a.set({angle:0});a.setPositionByOrigin(new fabric.Point(640,330),'center','center');c.setViewportTransform([zoom,0,0,zoom,0,0]);a.setCoords();c.discardActiveObject();c.renderAll();const p=fabric.util.transformPoint(a.getCenterPoint(),c.viewportTransform),r=c.upperCanvasEl.getBoundingClientRect(),ratio=r.width/c.width;return{x:r.left+p.x*ratio,y:r.top+p.y*ratio,half:a.strokeWidth/2*zoom*ratio};},zoom);
  await page.mouse.click(points.x,points.y+points.half+1.5);assert.equal(await page.evaluate(()=>fixtureArrow.canvas.getActiveObject()===fixtureArrow),true,'shaft +1.5px hits');
  await page.evaluate(()=>fixtureArrow.canvas.discardActiveObject());await page.mouse.click(points.x,points.y+points.half+4);assert.equal(await page.evaluate(()=>fixtureArrow.canvas.getActiveObject()===fixtureArrow),false,'shaft +4px misses');
 }
 await page.evaluate(()=>{const a=fixtureArrow,c=a.canvas;c.setViewportTransform([1,0,0,1,0,0]);a.set({arrowHeadStyle:'diamond',arrowHeadSize:60});c.fire('object:modified',{target:a});});await page.waitForFunction(()=>document.body.dataset.localDeckSave==='saved');
 await page.reload();await ready();assert.equal(await clickPoint(48,20),true);assert.equal(await page.evaluate(()=>fixtureArrow.fragmentEnabled),false);
 await page.evaluate(()=>fixtureArrow.canvas.discardActiveObject());await page.locator('#shapeMenuBtn').click();await page.locator('#shapeMenu [data-shape="arrow"]').click();await page.evaluate(()=>{const a=fixtureArrow;a.set({arrowHeadStyle:'triangle',arrowHeadSize:60});a.setCoords();a.canvas.discardActiveObject();a.canvas.renderAll();});assert.equal(await clickPoint(48,20),true,'new arrow head');
 await page.evaluate(()=>fixtureArrow.canvas.discardActiveObject());await page.locator('#shapeMenuBtn').click();await page.locator('#shapeMenu [data-shape="line"]').click();
 const linePoint=await page.evaluate(()=>{const c=fixtureArrow.canvas,o=c.getActiveObject();window.fixtureLine=o;o.set({strokeWidth:2,strokeDashArray:[3,9]});o.setPositionByOrigin(new fabric.Point(640,520),'center','center');o.setCoords();c.discardActiveObject();c.renderAll();const p=fabric.util.transformPoint(o.getCenterPoint(),c.viewportTransform),r=c.upperCanvasEl.getBoundingClientRect();return{x:r.left+p.x*r.width/c.width,y:r.top+p.y*r.height/c.height,half:r.height/c.height};});
 await page.mouse.click(linePoint.x,linePoint.y+linePoint.half+1.5);assert.equal(await page.evaluate(()=>fixtureLine.canvas.getActiveObject()===fixtureLine),true,'plain dashed line receives the same padding');
 await page.evaluate(()=>fixtureLine.canvas.discardActiveObject());await page.mouse.click(linePoint.x,linePoint.y+linePoint.half+4);assert.equal(await page.evaluate(()=>fixtureLine.canvas.getActiveObject()===fixtureLine),false);
 await page.evaluate(()=>{const c=fixtureLine.canvas;c.setActiveObject(fixtureLine);fixtureLine.setCoords();});
 const end=await page.evaluate(()=>{const c=fixtureLine.canvas,p=fixtureLine.oCoords.end,r=c.upperCanvasEl.getBoundingClientRect(),points=fixtureLine.calcLinePoints(),m=fixtureLine.calcTransformMatrix();window.lineBefore={start:fabric.util.transformPoint(new fabric.Point(points.x1,points.y1),m),end:fabric.util.transformPoint(new fabric.Point(points.x2,points.y2),m)};return{x:r.left+p.x*r.width/c.width,y:r.top+p.y*r.height/c.height};});
 await page.mouse.move(end.x,end.y);await page.mouse.down();await page.mouse.move(end.x+35,end.y+20,{steps:6});await page.mouse.up();assert.equal(await page.evaluate(()=>fixtureLine.strokeWidth),2);assert.deepEqual(await page.evaluate(()=>fixtureLine.strokeDashArray),[3,9]);
 const moved=await page.evaluate(()=>{const p=fixtureLine.calcLinePoints(),m=fixtureLine.calcTransformMatrix(),start=fabric.util.transformPoint(new fabric.Point(p.x1,p.y1),m),end=fabric.util.transformPoint(new fabric.Point(p.x2,p.y2),m);return{start:Math.hypot(start.x-lineBefore.start.x,start.y-lineBefore.start.y),end:Math.hypot(end.x-lineBefore.end.x,end.y-lineBefore.end.y)};});assert.ok(moved.start<.01&&moved.end>10,JSON.stringify(moved));
 assert.deepEqual(errors,[]);
});
