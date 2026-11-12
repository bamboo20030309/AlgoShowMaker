'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('playwright');
const {startStaticUiServer}=require('./helpers/static-ui-server');

test('presentation defaults to native selection and mode menu toggles laser without editing deck text', {timeout:60000},async t=>{
 const {base}=await startStaticUiServer(t); const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:1500,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{if(sessionStorage.getItem('seeded'))return;localStorage.setItem('asm_reveal_fabric_deck_v5',JSON.stringify({groups:[{id:'g',slides:[{id:'text',canvas:{objects:[{type:'textbox',text:'Selectable lesson text',left:160,top:140,width:650,fontFamily:'Arial',fontSize:36,fill:'#123456',scaleX:1.1,scaleY:1.2,styles:{0:{0:{fontWeight:'bold'}}}}]},widgets:[]}]}]}));sessionStorage.setItem('seeded','1');});
 await page.goto(base+'/slides.html');await page.waitForFunction(()=>Reveal?.isReady()&&document.body.dataset.slideCount==='1');
 if(await page.evaluate(()=>document.body.classList.contains('asm-edit-mode')))await page.locator('#modeToggleBtn').click();
 await page.waitForFunction(()=>document.body.classList.contains('asm-slide-view-mode'));
 assert.equal(await page.evaluate(()=>document.body.classList.contains('asm-slide-laser-mode')),false,'normal cursor is default');
 const text=page.locator('section.present .asm-presentation-text-layer text').first();await text.waitFor({state:'visible'});
 await page.waitForTimeout(450);
 const b=await text.boundingBox();assert.ok(b.width>200);
 await page.mouse.move(b.x+1,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width-1,b.y+b.height/2,{steps:20});await page.mouse.up();
 const selected=await page.evaluate(()=>getSelection().toString());
 assert.match(selected,/Selectable lesson/,'native selection spans the rendered text');
 fs.mkdirSync('test-results/presentation-modes',{recursive:true});await page.screenshot({path:'test-results/presentation-modes/text-selection.png'});
 const menu=async()=>{await page.mouse.click(b.x+b.width+40,b.y+20,{button:'right'});await page.getByRole('menuitemradio',{name:'簡報模式'}).waitFor({state:'visible'});};
 await menu();await page.keyboard.press('Escape');await page.waitForTimeout(180);assert.equal(await page.locator('.asm-presentation-menu').isHidden(),true);
 await menu();await page.getByRole('menuitemradio',{name:'簡報模式'}).click();await page.waitForFunction(()=>document.body.classList.contains('asm-slide-laser-mode'));
 assert.equal(await text.isVisible(),false,'laser mode removes the selection hit surface');
 await menu();await page.getByRole('menuitemradio',{name:'一般游標'}).click();await page.waitForFunction(()=>!document.body.classList.contains('asm-slide-laser-mode'));
 await text.waitFor({state:'visible'});
 // A normal-cursor right click inside the real animation iframe opens the
 // same parent menu, rather than the browser's menu or a playback step.
 await page.evaluate(base=>{const f=document.createElement('iframe');f.id='mode-frame';f.className='algorithm-slide-frame';f.src=base+'/algorithm.html?asmEmbed=runtime';f.style.cssText='position:absolute;inset:0;width:100%;height:100%;z-index:99999';Reveal.getCurrentSlide().querySelector('.asm-slide-frame-content').append(f);},base);
 const child=page.frameLocator('#mode-frame');await child.locator('#arraySvg').waitFor();await child.locator('#arraySvg').click({button:'right',position:{x:400,y:150}});
 await page.getByRole('menuitemradio',{name:'簡報模式'}).click();await page.waitForFunction(()=>document.querySelector('#mode-frame').contentDocument.documentElement.classList.contains('asm-slide-laser-frame'));
 await page.locator('#modeToggleBtn').click();await page.waitForFunction(()=>!document.body.classList.contains('asm-slide-laser-mode'));
 assert.equal(await page.locator('.asm-presentation-text-layer').count(),0,'edit mode keeps Fabric editing only');
 await page.waitForFunction(()=>document.body.dataset.localDeckSave==='saved');await page.reload();await page.waitForFunction(()=>Reveal?.isReady());
 const saved=await page.evaluate(()=>ASMSlideStorage.create(indexedDB,localStorage).loadDeck('asm_reveal_fabric_deck_v5'));
 const obj=saved.groups[0].slides[0].canvas.objects[0];assert.equal(obj.text,'Selectable lesson text');assert.equal(obj.fill,'#123456');assert.equal(obj.scaleX,1.1);assert.equal(obj.scaleY,1.2);
 if(await page.evaluate(()=>document.body.classList.contains('asm-edit-mode')))await page.locator('#modeToggleBtn').click();
 assert.equal(await page.evaluate(()=>document.body.classList.contains('asm-slide-laser-mode')),false,'reload does not persist laser mode');assert.deepEqual(errors,[]);
});
