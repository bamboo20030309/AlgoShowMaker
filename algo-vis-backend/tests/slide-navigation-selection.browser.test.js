const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const { chromium } = require('playwright');

test('slide navigation clears Fabric, widget and cell selections while text arrows keep editing', { timeout: 60000 }, async t => {
  const root = path.resolve(__dirname, '..');
  const app = express();
  for (const [route, folder] of Object.entries({
    '/vendor/reveal': 'reveal.js/dist', '/vendor/fabric': 'fabric/dist',
    '/vendor/iro': '@jaames/iro/dist', '/vendor/ace': 'ace-builds/src-min-noconflict'
  })) app.use(route, express.static(path.join(root, 'node_modules', folder)));
  app.use(express.static(path.join(root, 'public')));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const deck = { groups: [0, 1].map(h => ({ id: `g${h}`, slides: [0, 1].map(v => ({
    id: `s${h}${v}`, canvas: { objects: [
      { type: 'rect', left: 120, top: 160, width: 100, height: 80, fill: '#123456', scaleX: 1.4 },
      { type: 'textbox', text: 'Editable text', left: 120, top: 320, width: 350, fontSize: 32 }
    ] }, widgets: [
      { id: `array${h}${v}`, type: 'structure', structureMode: 'normal', content: '1,2,3', x: 650, y: 150, w: 320, h: 160 },
      { id: `code${h}${v}`, type: 'code', content: 'return 0;', x: 650, y: 360, w: 320, h: 160 }
    ]
  })) })) };
  await page.addInitScript(value => localStorage.setItem('asm_reveal_fabric_deck_v5', JSON.stringify(value)), deck);
  // Observe real production canvases without exporting editor internals.
  await page.route('**/slides.js?*', route => route.fulfill({ contentType: 'application/javascript', body: `
    window.selectionCanvases = new Map();
    const originalLoad = fabric.Canvas.prototype.loadFromJSON;
    fabric.Canvas.prototype.loadFromJSON = function(...args) {
      selectionCanvases.set(this.lowerCanvasEl.closest('.fabric-host').dataset.slideId, this);
      return originalLoad.apply(this, args);
    };
  ` + fs.readFileSync(path.join(root, 'public/slides.js'), 'utf8') }));
  await page.goto(`http://127.0.0.1:${server.address().port}/slides.html`);
  await page.waitForFunction(() => Reveal.isReady() && selectionCanvases.size === 4);
  const selected = () => page.evaluate(() => ({
    fabric: [...selectionCanvases.values()].reduce((sum, canvas) => sum + canvas.getActiveObjects().length, 0),
    widgets: document.querySelectorAll('.slide-widget.is-selected').length,
    cells: document.querySelectorAll('.is-structure-cell-selected').length,
    toolbar: !document.querySelector('#objectToolbar').hidden
  }));
  for (const [key, h, v] of [['ArrowDown', 0, 1], ['ArrowUp', 0, 0], ['ArrowRight', 1, 0], ['ArrowLeft', 0, 0]]) {
    await page.evaluate(() => {
      document.activeElement?.blur();
      const canvas = selectionCanvases.get(document.querySelector('section.present[data-slide-id]').dataset.slideId);
      canvas.setActiveObject(canvas.getObjects().find(object => object.type === 'rect'));
      canvas.requestRenderAll();
    });
    assert.equal((await selected()).fabric, 1);
    await page.keyboard.press(key);
    await page.waitForFunction(({ h, v }) => Reveal.getIndices().h === h && Reveal.getIndices().v === v, { h, v });
    assert.deepEqual(await selected(), { fabric: 0, widgets: 0, cells: 0, toolbar: false }, key);
  }
  const cell = page.locator('[data-widget-id="array00"] [data-structure-item-index="0"] text');
  await cell.click();
  await cell.click();
  assert.ok((await selected()).widgets > 0);
  assert.ok((await selected()).cells > 0, 'a structure cell is selected before navigation');
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(() => Reveal.getIndices().v === 1);
  assert.deepEqual(await selected(), { fabric: 0, widgets: 0, cells: 0, toolbar: false });
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Control+a');
  assert.ok((await selected()).fabric > 1, 'mixed Fabric/widget group is selected');
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => Reveal.getIndices().h === 1);
  assert.deepEqual(await selected(), { fabric: 0, widgets: 0, cells: 0, toolbar: false });
  await page.evaluate(() => {
    const canvas = selectionCanvases.get('s10');
    const text = canvas.getObjects().find(object => object.type === 'textbox');
    canvas.setActiveObject(text); text.enterEditing();
    text.selectionStart = text.selectionEnd = 5;
    text.hiddenTextarea.selectionStart = text.hiddenTextarea.selectionEnd = 5;
    text.hiddenTextarea.focus();
  });
  await page.keyboard.press('ArrowLeft');
  const editing = await page.evaluate(() => {
    const canvas = selectionCanvases.get('s10'), text = canvas.getActiveObject();
    const original = canvas.getObjects().find(object => object.type === 'rect');
    return { h: Reveal.getIndices().h, editing: text.isEditing, cursor: text.selectionStart, fill: original.fill, scale: original.scaleX };
  });
  assert.deepEqual(editing, { h: 1, editing: true, cursor: 4, fill: '#123456', scale: 1.4 });
  await page.evaluate(() => {
    selectionCanvases.get('s10').getActiveObject().exitEditing();
    document.activeElement?.blur();
  });
  const host = await page.locator('.fabric-host[data-slide-id="s10"]').boundingBox();
  await page.mouse.click(host.x + host.width * 0.9, host.y + host.height * 0.9);
  await page.locator('[data-tool="code"]').click();
  assert.equal(await page.locator('section[data-slide-id="s10"] .slide-widget.code-widget').count(), 2, 'new widget is created through the UI');
  assert.ok((await selected()).widgets > 0);
  await page.keyboard.press('ArrowLeft');
  await page.waitForFunction(() => Reveal.getIndices().h === 0);
  assert.deepEqual(await selected(), { fabric: 0, widgets: 0, cells: 0, toolbar: false });
  await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
  await page.reload();
  await page.waitForFunction(() => Reveal.isReady() && selectionCanvases.size === 4);
  assert.deepEqual(await selected(), { fabric: 0, widgets: 0, cells: 0, toolbar: false });
  assert.equal(await page.locator('section[data-slide-id="s10"] .slide-widget.code-widget').count(), 2, 'new object survives save and reopen');
  assert.deepEqual(errors, []);
});
