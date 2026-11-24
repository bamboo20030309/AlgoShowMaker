const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const { startStaticUiServer } = require('./helpers/static-ui-server');

// Drag the actual thumb inside both visible ends; setting value alone misses
// padding, overlays, pointer capture and invalid min/max/step combinations.
async function dragEnds(page, selector) {
  const input = page.locator(selector);
  await input.scrollIntoViewIfNeeded();
  const limits = await input.evaluate(e => ({ min: Number(e.min), max: Number(e.max) }));
  for (const end of ['min', 'max']) {
    await input.evaluate(e => { e.value = String((Number(e.min) + Number(e.max)) / 2); });
    const box = await input.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + (end === 'min' ? 1 : box.width - 1), box.y + box.height / 2, { steps: 12 });
    await page.mouse.up();
    assert.equal(await input.evaluate(e => Number(e.value)), limits[end], `${selector} ${end}`);
  }
}

test('slide shape and speech sliders reach both ends without text-input padding', { timeout: 45000 }, async t => {
  const { base } = await startStaticUiServer(t);
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  const js = await fs.readFile(path.join(__dirname, '../public/slides.js'), 'utf8');
  await page.route('**/slides.js*', r => r.fulfill({ contentType: 'application/javascript', body:
    `const load=fabric.Canvas.prototype.loadFromJSON;fabric.Canvas.prototype.loadFromJSON=function(...args){window.fixtureCanvas=this;return load.apply(this,args)};\n` + js }));
  await page.addInitScript(() => {
    if (sessionStorage.getItem('rangeFixture')) return;
    sessionStorage.setItem('rangeFixture', '1');
    localStorage.setItem('asm_reveal_fabric_deck_v5', JSON.stringify({ groups: [{ id: 'g', slides: [{ id: 's', canvas: { objects: [
      { type: 'rect', left: 100, top: 100, width: 120, height: 80, stroke: '#123456', strokeWidth: 7 },
      { type: 'rect', left: 300, top: 100, width: 120, height: 80, strokeWidth: 0 }
    ] } }] }] }));
  });
  await page.goto(base + '/slides.html');
  await page.waitForFunction(() => document.body.dataset.fabricBuild?.startsWith('ready'));
  if (!await page.locator('body').evaluate(e => e.classList.contains('asm-edit-mode'))) await page.locator('#modeToggleBtn').click();
  // Old objects have no new slider fields; preserve custom widths and explicit 0.
  for (const [index, width] of [[0, 7], [1, 0]]) {
    await page.evaluate(index => fixtureCanvas.setActiveObject(fixtureCanvas.getObjects()[index]), index);
    assert.equal(await page.locator('#shapeStrokeWidthInput').inputValue(), String(width));
  }
  await page.evaluate(() => fixtureCanvas.discardActiveObject());
  await page.locator('#shapeMenuBtn').click();
  await page.locator('#shapeMenu [data-shape="rect"]').click();
  for (const selector of ['#shapeStrokeWidthInput', '#shapeCornerRadiusInput']) {
    await dragEnds(page, selector);
    const css = await page.locator(selector).evaluate(e => { const s = getComputedStyle(e); return [s.paddingLeft, s.paddingRight, s.borderLeftWidth]; });
    assert.deepEqual(css, ['0px', '0px', '0px']);
  }
  assert.equal(await page.evaluate(() => fixtureCanvas.getActiveObject().strokeWidth), 20);
  await page.evaluate(() => fixtureCanvas.discardActiveObject());
  await page.locator('#shapeMenuBtn').click();
  await page.locator('#shapeMenu [data-shape="arrow"]').click();
  await dragEnds(page, '#shapeArrowSizeInput');
  await page.locator('#ttsPanelToggleBtn').click();
  for (const selector of ['#ttsRateInput', '#ttsVolumeInput']) await dragEnds(page, selector);
  await page.evaluate(() => fixtureCanvas.fire('object:modified', { target: fixtureCanvas.getObjects()[0] }));
  await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.fabricBuild?.startsWith('ready'));
  assert.deepEqual(await page.evaluate(() => fixtureCanvas.getObjects().slice(0, 2).map(o => o.strokeWidth)), [7, 0]);
});

test('algorithm, event interval and code settings sliders reach their declared limits', { timeout: 45000 }, async t => {
  const { base } = await startStaticUiServer(t);
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  await page.goto(base + '/algorithm.html');
  await dragEnds(page, '#speedSlider');
  // The brush popup is a transient toolbar; reveal it without drawing on a trace.
  await page.locator('#slidersPopup').evaluate(e => { e.style.display = 'block'; });
  await dragEnds(page, '#drawSize');
  await page.locator('#slidersPopup').evaluate(e => { e.style.display = 'none'; });
  await page.evaluate(() => {
    const trace = { sourceCode: 'int main() {}', variables: [], frames: [{ id: 'f0', source: {}, state: {} }], studio: {} };
    ASMTraceEditor.applyTraceDocument(trace, { openStudio: false, preserveEventSettings: true });
    ASMTraceStudio.showTab('code-frame');
  });
  for (const selector of ['[data-trace-code-controls] input[type="range"]:not([data-code-panel-setting])', '[data-code-panel-setting="codePanelScrollMs"]',
    '[data-code-panel-setting="codePanelWidthPercent"]', '[data-code-panel-setting="codePanelHeightPercent"]']) await dragEnds(page, selector);
  await page.evaluate(() => ASMTraceStudio.showTab('events'));
  await dragEnds(page, '.trace-event-gap');
  assert.equal(await page.evaluate(() => ASMTracePlayer.getDocument().studio.eventSettings.gapMs), 2000);
});

test('legacy one/two-dimensional range thumbs can reach their endpoint tracks', { timeout: 30000 }, async t => {
  const { base } = await startStaticUiServer(t);
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  t.after(() => browser.close());
  const page = await browser.newPage();
  const source = await fs.readFile(path.join(__dirname, '../public/gui_editor.js'), 'utf8');
  await page.route('**/gui_editor.js*', r => r.fulfill({ contentType: 'application/javascript', body:
    source.replace('  window._guiToast = showToast;', '  window.rangeFixtureBuild = buildArrayLayoutSection;\n  window._guiToast = showToast;') }));
  await page.goto(base + '/algorithm.html');
  await page.evaluate(() => {
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;inset:30px auto auto 30px;width:400px;padding:20px;background:white;z-index:99999';
    host.innerHTML = rangeFixtureBuild({ type: 'drawArray', codeLine: -1, args: ['', '', Array(11).fill(0)] })
      + rangeFixtureBuild({ type: 'draw2DArray', codeLine: -1, args: ['', '', Array.from({ length: 7 }, () => Array(11).fill(0))] });
    document.body.append(host);
  });
  for (const suffix of ['', '-x', '-y']) {
    for (const side of ['L', 'R']) {
      // Give each real thumb the foreground while auditing hit geometry;
      // the production paired controls intentionally prohibit L > R.
      await page.locator(`#slider-${side}${suffix}`).evaluate(e => e.style.zIndex = '6');
      await dragEnds(page, `#slider-${side}${suffix}`);
      await page.locator(`#slider-${side}${suffix}`).evaluate(e => e.style.zIndex = '3');
    }
  }
});
