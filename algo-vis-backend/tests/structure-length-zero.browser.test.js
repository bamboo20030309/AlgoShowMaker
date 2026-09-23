const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const { chromium } = require('playwright');

test('heap editing targets the clicked cell and linear structures resize with zeroes', { timeout: 120000 }, async () => {
  const root = path.resolve(__dirname, '..');
  const port = await new Promise(resolve => {
    const probe = net.createServer();
    probe.listen(0, '127.0.0.1', () => {
      const value = probe.address().port;
      probe.close(() => resolve(value));
    });
  });
  const server = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), ASM_REGRESSION: '1', JWT_SECRET: randomBytes(32).toString('hex') },
    windowsHide: true,
    stdio: 'ignore'
  });
  let browser;
  try {
    const base = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 80; i++) {
      try { if ((await fetch(base)).ok) break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
    const widgets = [
      { id: 'heap', type: 'structure', structureMode: 'heap', content: '10, 20, 30, 40', x: 120, y: 80, w: 640, h: 330 },
      { id: 'array', type: 'structure', structureMode: 'normal', content: '5, 6, 7', x: 720, y: 80, w: 284, h: 172, manualSize: true, structureFrameVersion: 4 }
    ];
    const deck = { groups: [{ id: 'g1', slides: [{ id: 's1', canvas: { objects: [] }, widgets }] }] };
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.stack || error.message));
    await page.addInitScript(value => {
      if (sessionStorage.getItem('structure-length-fixture-installed')) return;
      localStorage.setItem('asm_reveal_fabric_deck_v5', JSON.stringify(value));
      sessionStorage.setItem('structure-length-fixture-installed', '1');
    }, deck);
    await page.goto(`${base}/slides.html`);
    await page.waitForFunction(() => document.body.dataset.fabricBuild?.startsWith('ready') && Reveal.isReady());

    const heap = page.locator('[data-widget-id="heap"]');
    await heap.locator('[data-structure-item-index="2"] text').dblclick();
    const editor = heap.locator('.structure-inline-value-input');
    await editor.fill('99');
    await editor.press('Enter');
    await page.waitForFunction(() => document.querySelector('[data-widget-id="heap"]')?.textContent.includes('99'));
    const readContent = id => page.evaluate(async widgetId => {
      const saved = await ASMSlideStorage.create(indexedDB, localStorage).loadDeck('asm_reveal_fabric_deck_v5');
      return saved.groups[0].slides[0].widgets.find(item => item.id === widgetId).content;
    }, id);
    const readSize = id => page.evaluate(async widgetId => {
      const saved = await ASMSlideStorage.create(indexedDB, localStorage).loadDeck('asm_reveal_fabric_deck_v5');
      const item = saved.groups[0].slides[0].widgets.find(widget => widget.id === widgetId);
      return { w: item.w, h: item.h };
    }, id);
    const heapValues = await readContent('heap');
    assert.equal(heapValues, '10, 20, 99, 40');

    const array = page.locator('[data-widget-id="array"]');
    await array.click();
    const length = page.locator('#structureLengthInput');
    const cellWidth = async () => (await array.locator('[data-structure-item-index="0"] > rect').boundingBox()).width;
    const originalCellWidth = await cellWidth();
    const originalArrayBox = await array.boundingBox();
    const originalArraySize = await readSize('array');
    assert.equal(await length.inputValue(), '3');
    await array.locator('[data-structure-item-index="0"] > text').dblclick();
    const arrayEditor = array.locator('.structure-inline-value-input');
    await arrayEditor.fill('55');
    await arrayEditor.press('Enter');
    await arrayEditor.waitFor({ state: 'detached' });
    await page.waitForFunction(() => document.querySelector('[data-widget-id="array"]')?.textContent.includes('55'));
    const editedArrayBox = await array.boundingBox();
    const editedArraySize = await readSize('array');
    assert.deepEqual(editedArraySize, originalArraySize, 'editing a value changed the stored array size');
    assert.ok(Math.abs(editedArrayBox.width - originalArrayBox.width) < 1.5, 'editing a value changed the array width');
    assert.ok(Math.abs(editedArrayBox.height - originalArrayBox.height) < 1.5, 'editing a value changed the array height');
    assert.ok(Math.abs(await cellWidth() - originalCellWidth) < 1.5, 'editing a value changed the array scale');
    assert.equal(await readContent('array'), '55, 6, 7');
    await length.fill('5');
    await page.waitForFunction(() => document.querySelectorAll('[data-widget-id="array"] [data-structure-item-index]').length === 5);
    assert.ok(Math.abs(await cellWidth() - originalCellWidth) < 1.5, 'adding cells changed the array scale');
    let arrayContent = await readContent('array');
    assert.equal(arrayContent, '55, 6, 7, 0, 0');
    await page.reload();
    await page.waitForFunction(() => document.body.dataset.fabricBuild?.startsWith('ready') && Reveal.isReady());
    assert.equal(await array.locator('[data-structure-item-index]').count(), 5);
    assert.ok(Math.abs(await cellWidth() - originalCellWidth) < 1.5, 'reloading changed the array scale');
    await array.click();
    assert.equal(await length.inputValue(), '5');
    await length.fill('3');
    await page.waitForFunction(() => document.querySelectorAll('[data-widget-id="array"] [data-structure-item-index]').length === 3);
    assert.ok(Math.abs(await cellWidth() - originalCellWidth) < 1.5, 'removing cells changed the array scale');
    await length.fill('');
    await length.press('1');
    await length.press('2');
    await page.waitForFunction(() => document.querySelectorAll('[data-widget-id="array"] [data-structure-item-index]').length === 12);
    assert.equal((await readContent('array')).split(',').length, 12);
    await length.fill('2');
    await length.press('Enter');
    await page.waitForFunction(() => document.querySelectorAll('[data-widget-id="array"] [data-structure-item-index]').length === 2);
    arrayContent = await readContent('array');
    assert.equal(arrayContent, '55, 6');
    const resizedCellWidth = await cellWidth();
    await array.locator('[data-structure-item-index="0"] > text').click({ button: 'right' });
    await page.locator('#structureContextMenu [data-structure-action="item-after"]').click();
    await page.waitForFunction(() => document.querySelectorAll('[data-widget-id="array"] [data-structure-item-index]').length === 3);
    assert.ok(Math.abs(await cellWidth() - resizedCellWidth) < 1.5, 'context menu insertion changed the array scale');
    await array.locator('[data-structure-item-index="0"] > text').click({ button: 'right' });
    await page.locator('#structureContextMenu [data-structure-action="item-delete"]').click();
    await page.waitForFunction(() => document.querySelectorAll('[data-widget-id="array"] [data-structure-item-index]').length === 2);
    assert.ok(Math.abs(await cellWidth() - resizedCellWidth) < 1.5, 'context menu deletion changed the array scale');

    await page.locator('#exitStructureEditorBtn').click();
    const priorStructureCount = await page.locator('.structure-widget').count();
    await page.locator('#structureMenuBtn').click();
    await page.locator('[data-tool="structure"][data-structure-mode="normal"]').click();
    await page.waitForFunction(count => document.querySelectorAll('.structure-widget').length === count + 1, priorStructureCount);
    const newWidget = page.locator('.structure-widget').last();
    const newValues = await newWidget.locator('[data-structure-item-index] text').allTextContents();
    assert.deepEqual(newValues.filter(value => value.trim()), Array(7).fill('0'));
    assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
});
