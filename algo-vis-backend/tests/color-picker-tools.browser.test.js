const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),net=require('node:net'),{spawn}=require('node:child_process'),{chromium}=require('playwright');
test('algorithm drawing and GUI tools share remembered colors without changing colors on hover', {timeout:60000},async()=>{
  const port=await new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
  const server=spawn(process.execPath,['server.js'],{windowsHide:true,stdio:'ignore',env:{...process.env,PORT:String(port),ASM_REGRESSION:'1'}});let browser;
  try {
    const base='http://127.0.0.1:'+port;
    for(let i=0;i<150;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
    browser=await chromium.launch({headless:true,channel:'msedge'});const page=await browser.newPage({viewport:{width:1400,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>localStorage.setItem('asm_slide_last_picked_color_v1','rgba(12, 45, 78, 0.4)'));
    await page.route('**/gui_editor.js?*',route=>route.fulfill({contentType:'application/javascript',body:fs.readFileSync('public/gui_editor.js','utf8').replace('window._guiToast = showToast;', 
      'window.testBindGui = button => bindGuiColorButton(button,event => openColorPalette(event,button,(name,value,final) => { window.guiColorResult={name,value,final}; })); window._guiToast = showToast;')}));
    await page.goto(base+'/algorithm.html?asmEmbed=runtime',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.testBindGui && window.ASMColorPickerPolicy);
    await page.evaluate(()=>{const button=document.createElement('button');button.id='gui-test-button';button.textContent='color';button.style.cssText='position:fixed;top:15px;left:300px;z-index:9999';document.body.append(button);testBindGui(button);});
    await page.locator('#gui-test-button').hover();assert.equal(await page.evaluate(()=>window.guiColorResult),undefined,'hover never changes saved objects');
    assert.ok(await page.locator('#gui-color-palette .asm-shared-color-swatch').count()>0);
    assert.equal((await page.locator('#gui-color-palette .asm-shared-color-swatch').allTextContents()).join(''),'');
    await page.locator('#gui-test-button').click();
    assert.deepEqual(await page.evaluate(()=>guiColorResult),{name:'rgba(12, 45, 78, 0.4)',value:'rgba(12, 45, 78, 0.4)',final:true});
    await page.evaluate(()=>ASMColorPickerPolicy.remember('#abcdef',true));
    await page.mouse.move(10,900);await page.locator('#gui-test-button').hover();
    const last=page.locator('#gui-color-palette .asm-shared-color-swatch[data-color="#abcdef"]');
    await page.evaluate(()=>{const input=document.createElement('textarea');input.id='preserved-color-selection';input.value='abcdef';document.body.append(input);input.focus();input.setSelectionRange(1,3);});
    await last.click();
    assert.deepEqual(await page.evaluate(()=>{const i=document.querySelector('#preserved-color-selection');return [document.activeElement===i,i.selectionStart,i.selectionEnd];}),[true,1,3]);
    assert.equal((await page.evaluate(()=>guiColorResult)).value,'#abcdef');
    const history=await page.evaluate(()=>ASMColorPickerPolicy.history());assert.deepEqual(history,['#abcdef','rgba(12, 45, 78, 0.4)']);
    await page.evaluate(()=>document.body.classList.remove('asm-embed-runtime'));
    await page.locator('#colorToggleBtn').evaluate(b=>{b.style.display='block';b.closest('.drawing-toolbar').style.setProperty('display','flex','important');});
    await page.locator('#colorToggleBtn').evaluate(b=>b.click());
    assert.equal(await page.locator('#colorToggleBtn').evaluate(b=>b.style.backgroundColor),'rgb(171, 205, 239)');
    assert.equal(await page.locator('#v3-val-r').textContent(),'171');
    assert.deepEqual(errors,[]);
  } finally {await browser?.close();server.kill();}
});
