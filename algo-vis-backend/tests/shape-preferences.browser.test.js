const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const fs=require('node:fs/promises');
const path=require('node:path');
const {startIsolatedServer}=require('./helpers/isolated-server');

test('sidebar remembers arrow head and line type, updates icons and preserves saved shapes', {timeout:60000},async t=>{
 const {base}=await startIsolatedServer(t);const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());const page=await browser.newPage({viewport:{width:1450,height:1050}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const source=await fs.readFile(path.join(__dirname,'../public/slides.js'),'utf8');
 await page.route('**/slides.js*',r=>r.fulfill({contentType:'application/javascript',body:source.replace('function installArrowRenderer(obj) {','function installArrowRenderer(obj) { window.fixtureArrow = obj;')}));
 await page.addInitScript(()=>{if(sessionStorage.getItem('shapePrefsFixture'))return;sessionStorage.setItem('shapePrefsFixture','1');localStorage.setItem('asm_reveal_fabric_deck_v5',JSON.stringify({groups:[{id:'g',slides:[{id:'s',widgets:[],canvas:{objects:[]}}]}]}));});
 await page.goto(base+'/slides.html');await page.waitForFunction(()=>document.body.dataset.fabricBuild?.startsWith('ready'));
 if(!await page.locator('body').evaluate(e=>e.classList.contains('asm-edit-mode')))await page.locator('#modeToggleBtn').click();
 async function add(type){if(!await page.locator('#shapeMenuBtn').isVisible()){const blank=await page.evaluate(()=>{const c=fixtureArrow.canvas,p=fabric.util.transformPoint(new fabric.Point(100,620),c.viewportTransform),r=c.upperCanvasEl.getBoundingClientRect();return{x:r.left+p.x*r.width/c.width,y:r.top+p.y*r.height/c.height};});await page.mouse.click(blank.x,blank.y);}await page.locator('#shapeMenuBtn').click();await page.locator(`#shapeMenu [data-shape="${type}"]`).click();await page.waitForFunction(()=>window.fixtureArrow);const center=await page.evaluate(type=>{const c=fixtureArrow.canvas,a=c.getObjects().filter(o=>(o.asmShapeType||o.type)===type).at(-1),p=fabric.util.transformPoint(a.getCenterPoint(),c.viewportTransform),r=c.upperCanvasEl.getBoundingClientRect();return{x:r.left+p.x*r.width/c.width,y:r.top+p.y*r.height/c.height};},type);await page.mouse.click(center.x,center.y);}
 await add('arrow');
 for(const id of ['shapeStrokeBtn','shapeColorBtn','shapeStyleControls','shapeArrowControls','shapeLineStyleChoices'])assert.equal(await page.locator('#shapeEditorControls #'+id).count(),1,id);
 assert.equal(await page.locator('#iroPopup #shapeStyleControls').count(),0);assert.equal(await page.locator('#objectToolbar').isVisible(),false);
 await page.locator('[data-arrow-head-style="triangle"]').click();await page.locator('[data-line-style="dashed"]').click();
 const originalId=await page.evaluate(()=>fixtureArrow.ttsObjectId);
 assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('asm_slide_shape_preferences_v1'))),{arrowHeadStyle:'triangle',lineStyle:'dashed'});
 assert.equal(await page.locator('[data-shape-choice="arrow"]').getAttribute('data-cached-arrow-head-style'),'triangle');assert.equal(await page.locator('[data-shape-choice="line"]').getAttribute('data-cached-line-style'),'dashed');
 await page.locator('#shapeStrokeWidthInput').focus();await page.locator('#shapeStrokeWidthInput').press('End');assert.deepEqual(await page.evaluate(()=>fixtureArrow.strokeDashArray),[60,40]);
 await page.waitForFunction(()=>document.body.dataset.localDeckSave==='saved');await page.reload();await page.waitForFunction(()=>document.body.dataset.fabricBuild?.startsWith('ready')&&window.fixtureArrow);
 assert.equal(await page.evaluate(()=>fixtureArrow.arrowHeadStyle),'triangle');assert.deepEqual(await page.evaluate(()=>fixtureArrow.strokeDashArray),[60,40]);
 assert.equal(await page.locator('[data-shape-choice="arrow"]').getAttribute('data-cached-arrow-head-style'),'triangle');
 await add('arrow');assert.equal(await page.evaluate(()=>fixtureArrow.arrowHeadStyle),'triangle');assert.deepEqual(await page.evaluate(()=>fixtureArrow.strokeDashArray),[8,6]);
 await add('line');assert.equal(await page.locator('#shapeArrowControls').isVisible(),false);assert.equal(await page.locator('[data-line-style="dashed"]').getAttribute('aria-pressed'),'true');
 await page.locator('[data-line-style="solid"]').click();assert.equal(await page.evaluate(()=>fixtureArrow.canvas.getActiveObject().strokeDashArray),null);
 assert.equal(await page.locator('[data-shape-choice="arrow"]').getAttribute('data-cached-line-style'),'solid');
 assert.deepEqual(await page.evaluate(id=>fixtureArrow.canvas.getObjects().find(o=>o.ttsObjectId===id).strokeDashArray,originalId),[60,40]);
 await add('arrow');assert.equal(await page.evaluate(()=>fixtureArrow.arrowHeadStyle),'triangle');assert.equal(await page.evaluate(()=>fixtureArrow.strokeDashArray),null);
 // Selection changes only the preview; it must not overwrite creation defaults.
 await page.evaluate(id=>{const c=fixtureArrow.canvas,old=c.getObjects().find(o=>o.ttsObjectId===id);old.arrowHeadStyle='circle';old.set('strokeDashArray',[60,40]);c.setActiveObject(old);c.requestRenderAll();},originalId);
 assert.equal(await page.locator('[data-shape-choice="arrow"]').getAttribute('data-preview-arrow-head-style'),'circle');
 assert.equal(await page.locator('[data-shape-choice="arrow"]').getAttribute('data-preview-line-style'),'dashed');
 assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('asm_slide_shape_preferences_v1'))),{arrowHeadStyle:'triangle',lineStyle:'solid'});
 await page.evaluate(()=>fixtureArrow.canvas.discardActiveObject());
 assert.equal(await page.locator('[data-shape-choice="arrow"]').getAttribute('data-preview-arrow-head-style'),'triangle');
 assert.equal(await page.locator('[data-shape-choice="arrow"]').getAttribute('data-preview-line-style'),'solid');
 await page.evaluate(()=>fixtureArrow.canvas.setActiveObject(fixtureArrow));
 await page.locator('#shapeStrokeBtn').click();assert.equal(await page.locator('#iroPopup').isVisible(),true);assert.equal(await page.locator('#shapeStyleControls').isVisible(),true);const popupBox=await page.locator('#iroPopup').boundingBox(),sidebarBox=await page.locator('#editorChrome').boundingBox();assert.ok(popupBox.x>=sidebarBox.x+sidebarBox.width,'color picker must not cover sidebar settings');await page.locator('#shapeLineControls .shape-style-label').click();assert.equal(await page.locator('#iroPopup').isVisible(),false);
 await page.evaluate(()=>{const c=fixtureArrow.canvas;c.getObjects().filter(o=>['line','arrow'].includes(o.asmShapeType)).forEach((a,i)=>{a.setPositionByOrigin(new fabric.Point(640,180+i*110),'center','center');a.setCoords();});c.requestRenderAll();});
 await fs.mkdir(path.join(__dirname,'../test-results/shape-preferences'),{recursive:true});await page.screenshot({path:path.join(__dirname,'../test-results/shape-preferences/sidebar.png')});
 await add('rect');assert.equal(await page.locator('#shapeCornerRadiusControls').isVisible(),true);assert.equal(await page.locator('#shapeArrowControls').isVisible(),false);await page.locator('#shapeCornerRadiusInput').focus();await page.locator('#shapeCornerRadiusInput').press('End');assert.equal(await page.evaluate(()=>fixtureArrow.canvas.getActiveObject().cornerRadius),100);await page.locator('#shapeColorBtn').click();assert.equal(await page.locator('#iroPopup').isVisible(),true);await page.locator('#shapeLineControls .shape-style-label').click();await page.locator('[data-line-style="dashed"]').click();await page.locator('[data-shape-choice="arrow"]').click();assert.equal(await page.evaluate(()=>fixtureArrow.arrowHeadStyle),'triangle');assert.deepEqual(await page.evaluate(()=>fixtureArrow.strokeDashArray),[8,6]);assert.equal(await page.locator('[data-arrow-head-style="triangle"]').getAttribute('aria-pressed'),'true');assert.deepEqual(errors,[]);
});
