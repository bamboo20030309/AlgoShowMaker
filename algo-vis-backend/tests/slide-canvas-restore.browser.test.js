const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const { startStaticUiServer } = require('./helpers/static-ui-server');

test('zoomed canvas history restores its viewport and painted objects across normal and hard reloads', { timeout: 45000 }, async t => {
  const { base } = await startStaticUiServer(t);
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? {channel:'msedge'} : {}) });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: {width:1400,height:900} });
  const js = await fs.readFile(path.join(__dirname, '../public/slides.js'), 'utf8');
  await page.route('**/slides.js*', r => r.fulfill({contentType:'application/javascript',body:js
    .replace('const fabricCanvases = new Map();', 'const fabricCanvases = window.fixtureCanvases = new Map();') }));
  await page.addInitScript(() => {
    if (sessionStorage.getItem('canvasRestoreFixture')) return;
    sessionStorage.setItem('canvasRestoreFixture', '1');
    localStorage.setItem('asm_reveal_fabric_deck_v5', JSON.stringify({groups:[{id:'g',slides:Array.from({length:5},(_,i)=>({id:'s'+i,canvas:{objects:[
      {type:'rect',left:0,top:0,width:1280,height:720,fill:'#f0e1ce',strokeWidth:0},
      {type:'textbox',left:100,top:100,width:300,text:'Slide '+i,fontSize:32,fill:'#123456',asmInlineScripts:false}
    ]}}))}]}));
    sessionStorage.setItem('asm_reveal_fabric_deck_v5:position',JSON.stringify({slideId:'s4'}));
  });
  const ready = () => page.waitForFunction(() => document.body.dataset.fabricBuild?.startsWith('ready') && Reveal.isReady());
  await page.goto(base+'/slides.html'); await ready();
  if (!await page.locator('body').evaluate(e=>e.classList.contains('asm-edit-mode'))) await page.locator('#modeToggleBtn').click();
  for (let i=0;i<5;i++) await page.locator('#slideZoomOutBtn').click();
  await page.waitForTimeout(500);
  const metrics = () => page.evaluate(() => {
    const c=fixtureCanvases.get('s4'), b=c.__asmBleed??180;
    return {bleed:b,vpt:c.viewportTransform,objects:c.getObjects().length,
      pixel:[...c.contextContainer.getImageData(Math.round((b+20)*c.getRetinaScaling()),Math.round((b+20)*c.getRetinaScaling()),1,1).data]};
  });
  function verify(m) {
    assert.equal(m.objects,2);
    assert.deepEqual(m.vpt,[1,0,0,1,m.bleed,m.bleed],JSON.stringify(m));
    assert.deepEqual(m.pixel,[240,225,206,255]);
  }
  verify(await metrics());
  await page.evaluate(() => {
    const c=fixtureCanvases.get('s4'),o=c.getObjects()[1];o.set('fill','#654321');c.fire('object:modified',{target:o});
    document.body.tabIndex=-1;document.body.focus();
  });
  await page.waitForFunction(()=>document.body.dataset.localDeckSave==='saved');
  await page.keyboard.press('Control+z');
  await page.waitForFunction(()=>fixtureCanvases.get('s4')?.getObjects()[1]?.fill==='#123456');
  await page.waitForTimeout(500);
  verify(await metrics());
  await page.keyboard.press('Control+y');
  await page.waitForFunction(()=>fixtureCanvases.get('s4')?.getObjects()[1]?.fill==='#654321');
  verify(await metrics());
  const cdp=await page.context().newCDPSession(page);
  for(const disabled of [false,true]) {
    await cdp.send('Network.setCacheDisabled',{cacheDisabled:disabled});
    await page.reload();await ready();await page.waitForTimeout(500);
    assert.deepEqual(await page.evaluate(()=>{const {h,v}=Reveal.getIndices();return {h,v};}),{h:0,v:4});
    verify(await metrics());
  }
});
