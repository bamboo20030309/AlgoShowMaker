'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { startStaticUiServer } = require('./helpers/static-ui-server');

test('canvas drag selects wheel zoom and mouse clicks reuse playback button commands', { timeout: 60000 }, async t => {
  const { base } = await startStaticUiServer(t);
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  t.after(() => browser.close()); const page = await browser.newPage({ viewport: { width: 1400, height: 950 } }), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('asm_reveal_fabric_deck_v5', JSON.stringify({ groups: [{ id: 'mouse', slides: [0,1].map(i => ({ id: 's'+i, canvas: { objects: [] }, widgets: [] })) }] }));
  });
  await page.goto(base + '/slides.html'); await page.waitForFunction(() => Reveal?.isReady() && document.body.dataset.slideCount === '2');
  if(await page.evaluate(()=>document.body.classList.contains('asm-edit-mode')))await page.locator('#modeToggleBtn').click();
  await page.evaluate(()=>Reveal.getCurrentSlide().dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:200,clientY:150})));
  await page.getByRole('menuitemradio',{name:'簡報模式'}).click();
  await page.evaluate(base => {
    Reveal.slide(0,0); const frame = document.createElement('iframe'); frame.id = 'gesture-frame'; frame.className = 'algorithm-slide-frame';
    frame.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:200000';
    frame.src = base + '/algorithm.html?asmEmbed=runtime'; Reveal.getCurrentSlide().querySelector('.asm-slide-frame-content').append(frame);
  }, base);
  const locator = page.frameLocator('#gesture-frame'), canvas = locator.locator('#arraySvg');
  await locator.locator('#viewport').waitFor();
  const child = page.frames().find(frame => frame.url().includes('asmEmbed=runtime'));
  await child.waitForFunction(() => window.ASMPlaybackNavigation?.invokeButton && document.documentElement.classList.contains('asm-slide-laser-frame'));
  await child.evaluate(() => { window.commands = []; ASMPlaybackNavigation.invokeButton = id => commands.push(id); });
  const point = async () => { const box = await canvas.boundingBox(); return { x: box.x + box.width*.7, y: box.y + box.height*.5 }; };
  const at = async v => { await page.waitForFunction(v => (Reveal.getIndices().v || 0) === v, v); };
  const reset = async () => { await page.evaluate(() => Reveal.slide(0,0)); await page.waitForTimeout(550); await child.evaluate(() => { resetCanvasWheelSelection(); commands.length = 0; }); };
  const click = async (button='left', count=1) => { const p = await point(); await page.mouse.click(p.x,p.y,{ button, clickCount:count, delay:30 }); };
  // A real wheel over the untouched canvas turns the slide, not its camera.
  await reset(); const before = await child.evaluate(() => getScale());
  let p = await point(); await page.mouse.move(p.x,p.y); await page.mouse.wheel(0,100); await at(1);
  assert.equal(await child.evaluate(() => getScale()), before);
  // Holding still does not select. Neither does click-size pointer jitter.
  await reset(); p = await point(); await page.mouse.move(p.x,p.y); await page.mouse.down(); await page.waitForTimeout(120); await page.mouse.up();
  await page.waitForTimeout(360); assert.equal(await child.evaluate(() => isCanvasWheelZoomSelected()), false);
  await child.evaluate(() => { commands.length = 0; });
  await page.mouse.down(); await page.mouse.move(p.x+1,p.y+1); await page.mouse.up(); await page.waitForTimeout(360);
  assert.equal(await child.evaluate(() => isCanvasWheelZoomSelected()), false);
  await page.mouse.wheel(0,100); await at(1);
  // Actual panning selects zoom and must not also step playback.
  await reset(); p = await point(); await page.mouse.move(p.x,p.y); await page.mouse.down(); await page.mouse.move(p.x+35,p.y+20,{steps:5}); await page.mouse.up();
  await page.waitForTimeout(360); assert.equal(await child.evaluate(() => isCanvasWheelZoomSelected()), true);
  assert.deepEqual(await child.evaluate(() => commands), []);
  const selectedScale = await child.evaluate(() => getScale()); await page.mouse.wheel(0,-100);
  await child.waitForFunction(scale => getScale() > scale, selectedScale); await at(0);
  // Leave and return: each slide begins in slide-navigation mode again.
  await page.evaluate(() => { Reveal.slide(0,1); Reveal.slide(0,0); });
  assert.equal(await child.evaluate(() => isCanvasWheelZoomSelected()), false);
  await page.waitForTimeout(550);
  for (const [button, count, expected] of [['left',1,'prevBtn'],['left',2,['prevBtn','prevBtn']],['right',1,'nextBtn'],['right',2,['nextBtn','nextBtn']],['middle',1,'playToggleBtn']]) {
    await child.evaluate(() => { commands.length=0; }); await click(button,count);
    assert.deepEqual(await child.evaluate(() => commands), Array.isArray(expected)?expected:[expected], `${button} x${count}: each release immediately runs one step`);
    assert.equal(await child.evaluate(() => isCanvasWheelZoomSelected()), false);
  }
  // Right-button panning remains available; releasing it is not a next-step.
  await child.evaluate(() => { commands.length=0; }); p = await point(); await page.mouse.move(p.x,p.y); await page.mouse.down({button:'right'});
  await page.mouse.move(p.x-25,p.y+15,{steps:4}); await page.mouse.up({button:'right'}); await page.waitForTimeout(380);
  assert.deepEqual(await child.evaluate(() => commands), []);
  assert.equal(await child.evaluate(() => isCanvasWheelZoomSelected()), true);
  // Real parent mode switch disables every shortcut when the laser disappears.
  await page.locator('#modeToggleBtn').click();
  await child.waitForFunction(() => !document.documentElement.classList.contains('asm-slide-laser-frame'));
  await child.evaluate(() => { commands.length=0; });
  for (const button of ['left','right','middle']) await click(button);
  await page.waitForTimeout(380); assert.deepEqual(await child.evaluate(() => commands), []);
  await page.locator('#modeToggleBtn').click();
  await page.evaluate(()=>Reveal.getCurrentSlide().dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:200,clientY:150})));
  await page.getByRole('menuitemradio',{name:'簡報模式'}).click();
  await child.waitForFunction(() => document.documentElement.classList.contains('asm-slide-laser-frame'));
  // Studio object editing does not trigger playback shortcuts.
  await child.evaluate(() => { document.body.classList.add('asm-trace-studio-open'); commands.length=0; });
  await click('left'); await page.waitForTimeout(380); assert.deepEqual(await child.evaluate(() => commands), []);
  assert.deepEqual(errors, []);
});

test('mouse commands and playback buttons operate on the same frame navigation', { timeout: 60000 }, async t => {
  const { startIsolatedServer } = require('./helpers/isolated-server'), { compile } = require('./helpers/compile');
  const { base } = await startIsolatedServer(t), previous = process.env.ASM_TEST_BASE_URL;
  let trace;
  try {
    process.env.ASM_TEST_BASE_URL=base;
    ({ trace } = await compile('int main(){int a=0;\n// @frame a\na=1;\n// @frame a\na=2;\n// @frame a\na=3;\n// @frame a\na=4;\n// @frame a\na=5;\n// @frame a\n}'));
  } finally { if(previous===undefined)delete process.env.ASM_TEST_BASE_URL;else process.env.ASM_TEST_BASE_URL=previous; }
  const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());
  const page=await browser.newPage(); await page.goto(base+'/algorithm.html?asmEmbed=runtime');
  await page.waitForFunction(()=>window.ASMPlaybackNavigation?.invokeButton);
  await page.evaluate(async trace=>{ASMTracePlayer.apply(trace);window.asmGetAnimationPlaybackRate=()=>20;await ASMTracePlayer.render(1,{stable:true});},trace);
  await page.evaluate(()=>{window.pressed=[];new MutationObserver(records=>{for(const record of records)if(record.target.classList.contains('asm-shortcut-pressed'))pressed.push(record.target.id);}).observe(document.querySelector('.controls'),{subtree:true,attributes:true,attributeFilter:['class']});});
  const index=()=>page.evaluate(()=>CodeScript.get_current_frame_index());
  const click=async(button,count=1)=>{const b=await page.locator('#arraySvg').boundingBox();await page.mouse.click(b.x+b.width*.8,b.y+b.height*.6,{button,clickCount:count,delay:30});};
  // Standalone algorithm/runtime pages do not show the slide laser and keep
  // their native mouse behavior. The laser signal is owned by the parent
  // presentation controller (also exercised with the real parent above).
  await click('right');assert.equal(await index(),1);
  await page.evaluate(()=>document.documentElement.classList.add('asm-slide-laser-frame'));
  await click('right');await page.waitForFunction(()=>CodeScript.get_current_frame_index()===2&&!ASMTracePlayer.getActivePlaybackPlan());assert.equal(await index(),2);
  await click('left');await page.waitForFunction(()=>CodeScript.get_current_frame_index()===1);assert.equal(await index(),1);
  await click('right',2);await page.waitForFunction(()=>CodeScript.get_current_frame_index()===3&&!ASMTracePlayer.getActivePlaybackPlan());assert.equal(await index(),3,'two clicks advance twice, not to the final frame');
  await click('left',2);await page.waitForFunction(()=>CodeScript.get_current_frame_index()===1);assert.equal(await index(),1,'two clicks go back twice, not to the first frame');
  // Slow playback gives the immediate middle-button toggle time to be observed.
  await page.evaluate(()=>{window.asmGetAnimationPlaybackRate=()=>1;document.getElementById('speedSlider').value=1000;document.getElementById('speedSlider').dispatchEvent(new Event('input'));});
  await click('middle');assert.equal(await page.evaluate(()=>ASMPlaybackNavigation.isPlaying()),true);
  await click('middle');assert.equal(await page.evaluate(()=>ASMPlaybackNavigation.isPlaying()),false);
  for(const id of ['prevBtn','nextBtn'])assert.ok((await page.evaluate(()=>pressed)).includes(id),id+' shows button press');
});
