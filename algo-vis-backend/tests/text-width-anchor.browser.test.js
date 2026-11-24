const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require('playwright');
const {startIsolatedServer}=require('./helpers/isolated-server');

test('wrapped text keeps its top edge while repeatedly resizing from either side; edited auto text fits its real layout', {timeout:60000},async t=>{
 const {base}=await startIsolatedServer(t);const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());const page=await browser.newPage({viewport:{width:1600,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const source=await fs.readFile(path.join(__dirname,'../public/slides.js'),'utf8');
 await page.route('**/slides.js*',r=>r.fulfill({contentType:'application/javascript',body:`const originalLoad=fabric.Canvas.prototype.loadFromJSON;fabric.Canvas.prototype.loadFromJSON=function(...args){window.fixtureCanvas=this;return originalLoad.apply(this,args)};\n`+source}));
 await page.addInitScript(()=>{if(sessionStorage.getItem('textAnchorFixture'))return;sessionStorage.setItem('textAnchorFixture','1');localStorage.setItem('asm_reveal_fabric_deck_v5',JSON.stringify({groups:[{id:'g',slides:[{id:'s',widgets:[],canvas:{objects:[
  {type:'textbox',text:'Alpha beta gamma delta epsilon zeta',left:140,top:210,originY:'center',width:210,fontSize:32,asmTextWidthMode:'fixed',asmInlineScripts:false,fill:'#123456'},
  {type:'textbox',text:'Legacy text',left:140,top:470,width:500,fontSize:32,fontFamily:'Georgia',charSpacing:60,styles:{0:{0:{fontWeight:'bold'}}}}
 ]}}]}]}));});
 await page.goto(base+'/slides.html');await page.waitForFunction(()=>document.body.dataset.fabricBuild?.startsWith('ready')&&fixtureCanvas?.getObjects().length===2);
 if(!await page.locator('body').evaluate(e=>e.classList.contains('asm-edit-mode')))await page.locator('#modeToggleBtn').click();
 const state=()=>page.evaluate(()=>{const o=fixtureCanvas.getObjects()[0],p=o.getPointByOrigin('left','top');return{left:p.x,top:p.y,width:o.width,height:o.height,scaleX:o.scaleX,scaleY:o.scaleY,lines:o.textLines.length};});
 await page.evaluate(()=>{fixtureCanvas.setActiveObject(fixtureCanvas.getObjects()[0]);fixtureCanvas.renderAll();});
 const initial=await state();assert.ok(initial.lines>1);
 async function resize(side,widths){
  const start=await page.evaluate(side=>{const c=fixtureCanvas,o=c.getObjects()[0];o.setCoords();const p=o.oCoords[side],r=c.upperCanvasEl.getBoundingClientRect();return{x:r.left+p.x*r.width/c.width,y:r.top+p.y*r.height/c.height,ratio:r.width/c.width,scale:o.scaleX};},side);
  const before=await state(),edge=side==='mr'?before.left:before.left+before.width*before.scaleX;
  await page.mouse.move(start.x,start.y);await page.mouse.down();
  for(const width of widths){const delta=(width-before.width)*start.scale*start.ratio*(side==='mr'?1:-1);await page.mouse.move(start.x+delta,start.y,{steps:6});const current=await state();assert.ok(Math.abs(current.top-initial.top)<.1,JSON.stringify({side,width,initial,current}));assert.ok(Math.abs((side==='mr'?current.left:current.left+current.width*current.scaleX)-edge)<.1,'opposite edge stays fixed');}
  await page.mouse.up();
 }
 await resize('mr',[650,240,620,250]);await resize('ml',[400,260,410,270]);
 await page.evaluate(top=>{const o=fixtureCanvas.getObjects()[0];o.set({scaleX:1.2,scaleY:.8,originY:'bottom'});o.setPositionByOrigin(new fabric.Point(140,top),'left','top');o.setCoords();fixtureCanvas.renderAll();},initial.top);
 await resize('mr',[580,280]);await resize('ml',[420,290]);
 assert.equal((await state()).scaleX,1.2);assert.equal((await state()).scaleY,.8);
 // Exercise real textarea deletion, not merely setting text and firing a mock event.
 for(const text of ['AV AV AV AV AV AV AV AV AV AV','中文與 English 混排最後一個字','A\tV\tA\tV\tA\tV','第一行\n第二行文字']){
  await page.evaluate(text=>{const o=fixtureCanvas.getObjects()[1];o.set({text,asmTextWidthMode:'auto'});o.initDimensions();fixtureCanvas.setActiveObject(o);o.enterEditing();o.selectionStart=o.selectionEnd=o._text.length;o._updateTextarea();o.hiddenTextarea.focus();},text);
  await page.keyboard.press('Backspace');
  const result=await page.evaluate(()=>{const o=fixtureCanvas.getObjects()[1];return{text:o.text,lines:o.textLines.length,width:o.width,lineWidth:Math.max(...o._textLines.map((_,i)=>o.getLineWidth(i)))};});
  assert.equal(result.lines,result.text.split('\n').length,JSON.stringify(result));assert.ok(result.width-result.lineWidth>=9.9,JSON.stringify(result));await page.evaluate(()=>fixtureCanvas.getObjects()[1].exitEditing());
 }
 await page.waitForFunction(()=>document.body.dataset.localDeckSave==='saved');const final=await state();
 await page.reload();await page.waitForFunction(()=>document.body.dataset.fabricBuild?.startsWith('ready')&&fixtureCanvas?.getObjects().length===2);const reopened=await state();for(const key of Object.keys(final))assert.ok(Math.abs(reopened[key]-final[key])<.01,`persisted ${key} differs beyond the saved 2-decimal geometry precision`);
 assert.equal(await page.evaluate(()=>fixtureCanvas.getObjects()[0].asmInlineScripts),false);assert.deepEqual(errors,[]);
});
