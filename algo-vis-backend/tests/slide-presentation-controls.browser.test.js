'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {startStaticUiServer}=require('./helpers/static-ui-server');

test('wheel visits vertical slides before horizontal groups; laser works in slides and embedded documents', {timeout:60000},async t=>{
  const {base}=await startStaticUiServer(t);
  const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());
  const page=await browser.newPage({viewport:{width:1500,height:950}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    if(sessionStorage.getItem('seeded'))return;
    localStorage.setItem('asm_reveal_fabric_deck_v5',JSON.stringify({groups:[3,2,1].map((count,h)=>({id:`g${h}`,slides:Array.from({length:count},(_,v)=>({id:`s${h}-${v}`,canvas:{objects:[{type:'textbox',text:`Page ${h}-${v}`,left:150,top:120,width:400,fontSize:36,fill:'#123456',scaleX:1.2,scaleY:1.1}]},widgets:[]}))}))}));
    sessionStorage.setItem('seeded','1');
  });
  await page.goto(base+'/slides.html');
  await page.waitForFunction(()=>window.Reveal?.isReady()&&document.body.dataset.slideCount==='6');
  const indices=()=>page.evaluate(()=>{const {h,v}=Reveal.getIndices();return[h,v||0];});
  const expectAt=async(h,v)=>{await page.waitForFunction(([h,v])=>Reveal.getIndices().h===h&&(Reveal.getIndices().v||0)===v,[h,v]);assert.deepEqual(await indices(),[h,v]);};
  const center=async()=>{const box=await page.locator('section.asm-slide.present .asm-slide-frame-content').boundingBox();await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);};
  const wheel=async(delta=100)=>{await center();await page.mouse.wheel(0,delta);};
  // The editor also supports page turns; Ctrl-wheel remains a view zoom.
  await page.evaluate(()=>Reveal.slide(0,0));await expectAt(0,0);await page.waitForTimeout(550);
  for(const [h,v]of[[0,1],[0,2],[1,0],[1,1],[2,0]]){await wheel();await expectAt(h,v);await page.waitForTimeout(500);}
  await wheel();await page.waitForTimeout(500);await expectAt(2,0);
  await wheel(-100);await expectAt(1,1);await page.waitForTimeout(500);
  await wheel(-100);await expectAt(1,0);await page.waitForTimeout(500);
  await wheel(-100);await expectAt(0,2);
  await page.evaluate(()=>Reveal.slide(0,0));await page.waitForTimeout(550);
  await page.evaluate(()=>{const el=Reveal.getCurrentSlide();for(let i=0;i<5;i++)el.dispatchEvent(new WheelEvent('wheel',{deltaY:100,bubbles:true,cancelable:true}));});
  await expectAt(0,1);await page.waitForTimeout(150);await expectAt(0,1);
  await page.waitForTimeout(500);
  await page.evaluate(()=>{const el=Reveal.getCurrentSlide();for(const deltaY of [10,10,10])el.dispatchEvent(new WheelEvent('wheel',{deltaY,bubbles:true,cancelable:true}));});
  await expectAt(0,1);
  await page.evaluate(()=>Reveal.getCurrentSlide().dispatchEvent(new WheelEvent('wheel',{deltaY:15,bubbles:true,cancelable:true})));
  await expectAt(0,2);
  await page.waitForTimeout(500);await center();
  await page.keyboard.down('Control');await page.mouse.wheel(0,-100);await page.keyboard.up('Control');
  await expectAt(0,2);assert.ok(await page.evaluate(()=>Number(document.body.dataset.slideZoom)>1));
  await page.keyboard.press('Control+0');
  // Scrollable content and modal controls own their wheel input.
  await page.evaluate(()=>{const pre=document.createElement('pre');pre.id='scroll-fixture';pre.style.cssText='position:absolute;left:400px;top:200px;width:200px;height:100px;overflow:auto;z-index:100';pre.textContent='scroll\n'.repeat(100);Reveal.getCurrentSlide().append(pre);});
  await page.locator('#scroll-fixture').hover();await page.mouse.wheel(0,100);await page.waitForTimeout(250);await expectAt(0,2);
  assert.ok(await page.locator('#scroll-fixture').evaluate(e=>e.scrollTop)>0);
  await page.evaluate(()=>document.querySelector('#scroll-fixture').remove());
  await page.evaluate(()=>{const d=document.createElement('dialog');d.id='test-dialog';document.body.append(d);d.showModal();});
  await page.evaluate(()=>Reveal.getCurrentSlide().dispatchEvent(new WheelEvent('wheel',{deltaY:100,bubbles:true,cancelable:true})));
  await expectAt(0,2);await page.evaluate(()=>document.querySelector('#test-dialog').remove());
  // Presentation pointer changes only the cursor, not persisted object style.
  if(await page.evaluate(()=>document.body.classList.contains('asm-edit-mode')))await page.locator('#modeToggleBtn').click();
  await page.waitForFunction(()=>document.body.classList.contains('asm-slide-laser-mode'));
  const cursor=await page.locator('section.asm-slide.present canvas').first().evaluate(e=>getComputedStyle(e).cursor);
  assert.match(cursor,/data:image\/svg\+xml/);assert.match(cursor,/%23ff2020/);
  await page.evaluate(()=>Reveal.toggleOverview(true));
  await page.waitForFunction(()=>!document.body.classList.contains('asm-slide-laser-mode'));
  await page.evaluate(()=>document.querySelector('body > .reveal').dispatchEvent(new WheelEvent('wheel',{deltaY:100,bubbles:true,cancelable:true})));
  await expectAt(0,2);await page.evaluate(()=>Reveal.toggleOverview(false));
  await page.waitForFunction(()=>document.body.classList.contains('asm-slide-laser-mode'));
  const laser=await page.evaluate(async cursor=>{const url=cursor.match(/url\(["']?(.*?)["']?\)/)[1];const image=new Image();image.src=url;await image.decode();return[image.naturalWidth,image.naturalHeight];},cursor);
  assert.deepEqual(laser,[32,32]);
  await page.evaluate(()=>Reveal.slide(1,0));await page.waitForTimeout(550);
  await page.evaluate(()=>{const frame=document.createElement('iframe');frame.id='embedded-fixture';frame.className='algorithm-slide-frame';frame.style.cssText='position:absolute;inset:0;width:100%;height:100%;z-index:200000';frame.srcdoc='<html><body style="margin:0;height:100vh"><div id="stage" style="height:100vh">Embedded surface</div><script>window.wheels=0;document.addEventListener("wheel",()=>window.wheels++);<\/script></body></html>';Reveal.getCurrentSlide().querySelector('.asm-slide-frame-content').append(frame);});
  await page.waitForFunction(()=>document.querySelector('#embedded-fixture')?.contentDocument?.documentElement?.classList.contains('asm-slide-laser-frame'));
  const frame=page.frameLocator('#embedded-fixture');
  await frame.locator('#stage').waitFor();
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('#embedded-fixture').contentDocument.body).cursor.includes('data:image/svg+xml'));
  // 與正式播放器相同的畫布容器：普通滾輪交給鏡頭，不翻頁。
  await frame.locator('#stage').evaluate(stage=>{
    const canvas=document.createElement('div');canvas.id='canvasWrapper';
    canvas.style.cssText='position:absolute;inset:0;background:white;cursor:grab';
    stage.append(canvas);window.cameraZoom=1;window.isCanvasWheelZoomSelected=()=>true;
    canvas.addEventListener('wheel',event=>{event.preventDefault();window.cameraZoom*=event.deltaY>0?.9:1.1;},{passive:false});
  });
  for(const editing of [false,true]) {
    if(editing)await page.locator('#modeToggleBtn').click();
    await page.waitForFunction(editing=>document.body.classList.contains('asm-edit-mode')===editing,editing);
    await frame.locator('#canvasWrapper').hover();await page.mouse.wheel(0,100);
    await page.waitForFunction(()=>document.querySelector('#embedded-fixture').contentWindow.cameraZoom<1);
    await expectAt(1,0);
    if(editing){
      await page.waitForFunction(()=>!document.querySelector('#embedded-fixture').contentDocument.documentElement.classList.contains('asm-slide-laser-frame'));
      assert.equal(await frame.locator('#canvasWrapper').evaluate(e=>getComputedStyle(e).cursor),'grab','editor preserves native canvas cursor');
      assert.doesNotMatch(await page.locator('section.asm-slide.present canvas').first().evaluate(e=>getComputedStyle(e).cursor),/data:image\/svg\+xml/);
    }
    await frame.locator('#canvasWrapper').evaluate(()=>{window.cameraZoom=1;});
  }
  await page.locator('#modeToggleBtn').click();
  await page.waitForFunction(()=>document.body.classList.contains('asm-slide-laser-mode'));
  await frame.locator('#canvasWrapper').evaluate(e=>{e.remove();window.wheels=0;});
  await frame.locator('#stage').hover();await page.mouse.wheel(0,100);await expectAt(1,1);
  assert.equal(await page.locator('#embedded-fixture').evaluate(e=>e.contentWindow.wheels),0,'page wheel does not also reach an embedded camera');
  await page.waitForTimeout(500);await page.evaluate(()=>Reveal.slide(1,0));await page.waitForTimeout(550);
  await frame.locator('#stage').hover();await page.keyboard.down('Control');await page.mouse.wheel(0,100);
  await page.waitForFunction(()=>document.querySelector('#embedded-fixture').contentWindow.wheels>0);
  await page.keyboard.up('Control');
  await expectAt(1,0);assert.ok(await page.locator('#embedded-fixture').evaluate(e=>e.contentWindow.wheels)>0,'Ctrl wheel remains available inside the frame');
  await page.locator('#modeToggleBtn').click();
  await page.waitForFunction(()=>!document.body.classList.contains('asm-slide-laser-mode'));
  assert.equal(await page.locator('#embedded-fixture').evaluate(e=>e.contentDocument.documentElement.classList.contains('asm-slide-laser-frame')),false);
  await page.evaluate(()=>document.querySelector('#embedded-fixture').remove());
  await page.waitForFunction(()=>document.body.dataset.localDeckSave==='saved');
  await page.reload();await page.waitForFunction(()=>window.Reveal?.isReady()&&document.body.dataset.slideCount==='6');
  await expectAt(1,0);
  const saved=await page.evaluate(()=>ASMSlideStorage.create(indexedDB,localStorage).loadDeck('asm_reveal_fabric_deck_v5'));
  assert.equal(saved.groups[0].slides[0].canvas.objects[0].fill,'#123456');
  assert.equal(saved.groups[0].slides[0].canvas.objects[0].scaleX,1.2);
  if(!await page.evaluate(()=>document.body.classList.contains('asm-edit-mode')))await page.locator('#modeToggleBtn').click();
  await page.locator('section.asm-slide.present .slide-edge-add-bottom').click();
  await page.waitForFunction(()=>document.body.dataset.slideCount==='7');await expectAt(1,1);
  await page.waitForTimeout(550);await wheel();await expectAt(1,2);
  await page.waitForTimeout(500);await wheel();await expectAt(2,0);
  assert.deepEqual(errors,[]);
});
