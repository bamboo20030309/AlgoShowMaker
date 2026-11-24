const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {startIsolatedServer}=require('./helpers/isolated-server');
const fs=require('node:fs/promises');
const path=require('node:path');

test('page eyedropper samples painted surfaces, protects clicks and cancels without applying', {timeout:40000},async t=>{
 const {base}=await startIsolatedServer(t);const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());const page=await browser.newPage();
 await page.route('**/eyedropper-fixture',r=>r.fulfill({contentType:'text/html',body:`<link rel="stylesheet" href="/color-eyedropper.css"><div id="picker"></div><button id="color" style="width:100px;height:70px;background:#12ab34;border:0" aria-label="sample"></button><svg id="svg" width="100" height="70"><rect width="100" height="70" fill="#8844cc"/></svg><div style="position:relative;width:100px;height:70px"><canvas id="canvas" width="100" height="70"></canvas><canvas id="overlay" width="100" height="70" style="position:absolute;inset:0"></canvas></div><iframe id="frame" srcdoc='<body style="margin:0;background:rgb(20,80,160)"></body>' style="width:100px;height:70px"></iframe><img id="image" width="40" height="40" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3C/svg%3E"><script src="/color-eyedropper.js"></script><script>window.EyeDropper=undefined;window.picks=[];window.otherClicks=0;color.onclick=()=>otherClicks++;canvas.getContext('2d').fillStyle='#f0a020';canvas.getContext('2d').fillRect(0,0,100,70);ASMColorEyedropper.install(picker,()=>value=>picks.push(value));</script>`}));
 await page.goto(base+'/eyedropper-fixture');
 assert.equal(await page.locator('.asm-eyedropper-button').innerText(),'');assert.equal(await page.locator('.asm-eyedropper-button svg').count(),1);assert.equal(await page.locator('.asm-eyedropper-button').getAttribute('aria-label'),'滴管取色');
 async function pick(target){await page.locator('.asm-eyedropper-button').click();assert.equal(await page.locator('body').getAttribute('data-eyedropper'),'page');const r=await page.locator(target).boundingBox();await page.mouse.click(r.x+15,r.y+15);await page.waitForFunction(()=>!document.body.dataset.eyedropper);}
 for(const [target,value]of [['#color','#12ab34'],['#svg','#8844cc'],['#canvas','#f0a020'],['#frame','#1450a0']]){await pick(target);assert.equal(await page.evaluate(()=>picks.at(-1)),value);}
 assert.equal(await page.evaluate(()=>otherClicks),0);
 await pick('#image');assert.match(await page.locator('.asm-eyedropper-status').innerText(),/HTTPS/);assert.equal(await page.evaluate(()=>picks.length),4);
 await page.locator('.asm-eyedropper-button').click();await page.keyboard.press('Escape');assert.equal(await page.locator('.asm-eyedropper-overlay').count(),0);assert.equal(await page.evaluate(()=>picks.length),4);await page.locator('#color').click();assert.equal(await page.evaluate(()=>otherClicks),1);
});

test('Studio, drawing and legacy GUI pickers apply to their own controls; retargeting discards pending result', {timeout:40000},async t=>{
 const {base}=await startIsolatedServer(t);const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());const page=await browser.newPage();
 const source=await fs.readFile(path.join(__dirname,'../public/gui_editor.js'),'utf8');
 await page.route('**/gui_editor.js*',r=>r.fulfill({contentType:'application/javascript',body:source.replace('function bindGuiColorButton(button, handler) {','window.fixtureOpenColorPalette = openColorPalette; function bindGuiColorButton(button, handler) {')}));
 await page.addInitScript(()=>{window.EyeDropper=class{open(){return new Promise(resolve=>window.finishColorPick=resolve);}};});
 await page.goto(base+'/algorithm.html');await page.waitForFunction(()=>window.ASMTraceColorPicker&&window.fixtureOpenColorPalette&&document.querySelector('#slidersPopup .asm-eyedropper-button'));
 await page.evaluate(()=>{const panel=document.createElement('div');panel.style.cssText='position:fixed;left:300px;top:40px;z-index:10000';for(const id of ['a','b']){const c=ASMTraceColorPicker.create('#ffffff');c.id='fixture-'+id;c.dataset.inputs='0';c.dataset.changes='0';for(const event of ['input','change'])c.addEventListener(event,()=>c.dataset[event==='input'?'inputs':'changes']++);panel.append(c);}document.body.append(panel);});
 async function finish(selector,color){await page.locator(selector+' .asm-eyedropper-button').click();await page.evaluate(value=>finishColorPick({sRGBHex:value}),color);await page.waitForFunction(({selector,color})=>document.querySelector(selector+' .asm-eyedropper-status')?.textContent===color,{selector,color});}
 await page.locator('#fixture-a').hover();await finish('.trace-iro-popup','#345678');
 assert.deepEqual(await page.locator('#fixture-a').evaluate(c=>[c.value,c.dataset.inputs,c.dataset.changes]),['#345678','1','1']);
 await page.locator('.trace-iro-popup .asm-eyedropper-button').click();await page.evaluate(()=>document.querySelector('#fixture-b').dispatchEvent(new PointerEvent('pointerenter')));await page.evaluate(()=>finishColorPick({sRGBHex:'#abcdef'}));await page.waitForFunction(()=>!document.querySelector('.trace-iro-popup .asm-eyedropper-button').disabled);
 assert.equal(await page.locator('#fixture-a').evaluate(c=>c.value),'#345678');assert.equal(await page.locator('#fixture-b').evaluate(c=>c.value),'#ffffff');
 await page.evaluate(()=>{const b=document.querySelector('#colorToggleBtn');b.dispatchEvent(new PointerEvent('pointerenter'));});await finish('#slidersPopup','#2468ac');
 assert.equal(await page.locator('#colorToggleBtn').evaluate(c=>c.style.backgroundColor),'rgb(36, 104, 172)');
 await page.evaluate(()=>{window.guiColors=[];fixtureOpenColorPalette({type:'pointerenter'},document.querySelector('#fixture-a'),(...args)=>guiColors.push(args));});await finish('#gui-color-palette','#987654');
 assert.deepEqual(await page.evaluate(()=>guiColors.at(-1)),['#987654','#987654',true]);
 assert.ok(await page.evaluate(()=>ASMColorPickerPolicy.history().includes('#987654')));
});

test('slide eyedropper commits sampled color to selected shape and survives reopen; native cancel is harmless', {timeout:40000},async t=>{
 const {base}=await startIsolatedServer(t);const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());const page=await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.EyeDropper=class{open({signal}){return new Promise((resolve,reject)=>{window.finishColorPick=resolve;window.cancelColorPick=()=>reject(new DOMException('cancel','AbortError'));signal.addEventListener('abort',window.cancelColorPick,{once:true});});}};if(sessionStorage.getItem('eyeFixture'))return;sessionStorage.setItem('eyeFixture','1');localStorage.setItem('asm_reveal_fabric_deck_v5',JSON.stringify({groups:[{id:'g',slides:[{id:'s',widgets:[],canvas:{objects:[]}}]}]}));});
 await page.goto(base+'/slides.html');await page.waitForFunction(()=>document.body.dataset.fabricBuild?.startsWith('ready'));
 if(!await page.locator('body').evaluate(e=>e.classList.contains('asm-edit-mode')))await page.locator('#modeToggleBtn').click();
 await page.locator('#shapeMenuBtn').click();await page.locator('#shapeMenu [data-shape="rect"]').click();
 await page.locator('#shapeColorBtn').click();await page.locator('#iroPopup .asm-eyedropper-button').click();await page.waitForFunction(()=>window.finishColorPick);await page.evaluate(()=>finishColorPick({sRGBHex:'#123456'}));
 await page.waitForFunction(()=>document.querySelector('#iroPopup .asm-eyedropper-status')?.textContent==='#123456');
 const saved=()=>page.evaluate(async()=>{const deck=await ASMSlideStorage.create(indexedDB,localStorage).loadDeck('asm_reveal_fabric_deck_v5');return new iro.Color(deck.groups[0].slides[0].canvas.objects.find(o=>o.type==='rect')?.fill).hexString;});
 await page.waitForFunction(()=>document.body.dataset.localDeckSave==='saved');assert.equal(await saved(),'#123456');
 await page.locator('#iroPopup .asm-eyedropper-button').click();await page.evaluate(()=>cancelColorPick());await page.waitForFunction(()=>document.querySelector('#iroPopup .asm-eyedropper-status')?.textContent==='已取消取色');assert.equal(await saved(),'#123456');
 await page.reload();await page.waitForFunction(()=>document.body.dataset.fabricBuild?.startsWith('ready'));assert.equal(await saved(),'#123456');assert.deepEqual(errors,[]);
});

test('legacy structure cell keeps its target during page picking and saves the style on reopen', {timeout:40000},async t=>{
 const {base}=await startIsolatedServer(t);const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());const page=await browser.newPage({viewport:{width:1600,height:1000}});
 await page.addInitScript(()=>{window.EyeDropper=undefined;if(sessionStorage.getItem('cellEyeFixture'))return;sessionStorage.setItem('cellEyeFixture','1');localStorage.setItem('asm_reveal_fabric_deck_v5',JSON.stringify({groups:[{id:'g',slides:[{id:'s',canvas:{objects:[]},widgets:[{id:'array',type:'structure',structureMode:'normal',content:'0, 0, 0',x:180,y:140,w:500,h:150}]}]}]}));});
 await page.goto(base+'/slides.html');await page.waitForFunction(()=>document.body.dataset.fabricBuild?.startsWith('ready'));
 if(!await page.locator('body').evaluate(e=>e.classList.contains('asm-edit-mode')))await page.locator('#modeToggleBtn').click();
 await page.locator('[data-widget-id="array"]').click();
 const cell=page.locator('[data-widget-id="array"] [data-structure-item-index="0"] > text');await cell.click();
 const highlight=page.locator('#structureContextMenu').getByRole('button',{name:'Highlight',exact:true});await highlight.click();await page.mouse.move(10,10);await highlight.hover();
 await page.locator('#iroPopup .asm-eyedropper-button').click();await page.mouse.move(10,10);await page.waitForTimeout(260);assert.equal(await page.locator('#iroPopup').isVisible(),true);
 await page.evaluate(()=>{const swatch=document.createElement('div');swatch.id='sample-color';swatch.style.cssText='position:fixed;left:10px;top:10px;width:60px;height:60px;background:#7812ab;z-index:100000';document.body.append(swatch);});
 await page.mouse.click(25,25);await page.waitForFunction(()=>document.querySelector('#iroPopup .asm-eyedropper-status')?.textContent==='#7812ab');
 await page.waitForFunction(()=>document.body.dataset.localDeckSave==='saved');
 const saved=()=>page.evaluate(async()=>{const deck=await ASMSlideStorage.create(indexedDB,localStorage).loadDeck('asm_reveal_fabric_deck_v5');return JSON.stringify(deck.groups[0].slides[0].widgets[0]);});
 const expected=await saved();const widget=JSON.parse(expected);assert.equal(await page.evaluate(value=>new iro.Color(value).hexString,widget.cellStyles['0'].highlight),'#7812ab');
 await page.reload();await page.waitForFunction(()=>document.body.dataset.fabricBuild?.startsWith('ready'));assert.equal(await saved(),expected);
 await page.locator('[data-widget-id="array"]').click();await cell.click();await highlight.hover();await fs.mkdir(path.join(__dirname,'../test-results/color-eyedropper'),{recursive:true});await page.screenshot({path:path.join(__dirname,'../test-results/color-eyedropper/structure.png')});
});
