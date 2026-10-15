const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { startStaticUiServer } = require('./helpers/static-ui-server');

test('double clicking a grouped object selects that object and edits text without moving members', { timeout: 60000 }, async t => {
  const { base } = await startStaticUiServer(t);
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    localStorage.setItem('asm_reveal_fabric_deck_v5', JSON.stringify({ groups: [{ id: 'g', slides: [{
      id: 's', canvas: { objects: [
        { type: 'textbox', text: 'Select this text', left: 150, top: 150, width: 350, fontSize: 32, scaleX: 1.2, scaleY: 1.2, angle: 8, fill: '#123456' },
        { type: 'rect', left: 180, top: 360, width: 220, height: 100, fill: '#654321' }
      ] }, widgets: [
        { id: 'array', type: 'structure', structureMode: 'normal', content: '1,2,3', x: 800, y: 160, w: 300, h: 160 },
        { id: 'code', type: 'code', content: 'return 0;', x: 800, y: 420, w: 320, h: 160 }
      ]
    }] }] }));
    sessionStorage.setItem('seeded', '1');
  });
  await page.route('**/slides.js?*', route => route.fulfill({ contentType: 'application/javascript', body: `
    const loadFixture = fabric.Canvas.prototype.loadFromJSON;
    fabric.Canvas.prototype.loadFromJSON = function(...args) {
      window.fixtureCanvas = this; return loadFixture.apply(this, args);
    };
  ` + fs.readFileSync(path.join(__dirname, '../public/slides.js'), 'utf8') }));
  await page.goto(base + '/slides.html');
  await page.waitForFunction(() => window.fixtureCanvas?.getObjects().length === 2 && Reveal.isReady());
  const point = index => page.evaluate(index => {
    const object = fixtureCanvas.getObjects()[index], rect = fixtureCanvas.upperCanvasEl.getBoundingClientRect();
    const local = new fabric.Point(-object.width / 2 + 45, -object.height / 2 + 20);
    const scene = fabric.util.transformPoint(local, object.calcTransformMatrix());
    const p = fabric.util.transformPoint(scene, fixtureCanvas.viewportTransform);
    return { x: rect.x + p.x * rect.width / fixtureCanvas.width, y: rect.y + p.y * rect.height / fixtureCanvas.height };
  }, index);
  const matrices = () => page.evaluate(() => fixtureCanvas.getObjects().map(object => object.calcTransformMatrix()));
  const unchanged = async expected => {
    const actual = await matrices();
    actual.forEach((matrix, index) => matrix.forEach((value, part) => assert.ok(Math.abs(value - expected[index][part]) < 1e-8)));
  };
  const pureGroup = () => page.evaluate(() => {
    const active = fixtureCanvas.getActiveObject(); if (active?.isEditing) active.exitEditing();
    fixtureCanvas.discardActiveObject();
    fixtureCanvas.setActiveObject(new fabric.ActiveSelection(fixtureCanvas.getObjects(), { canvas: fixtureCanvas }));
    fixtureCanvas.requestRenderAll();
  });
  await pureGroup();
  const original = await matrices(), textPoint = await point(0);
  await page.mouse.dblclick(textPoint.x, textPoint.y);
  assert.deepEqual(await page.evaluate(() => {
    const active = fixtureCanvas.getActiveObject();
    return { type: active.type, text: active.text, editing: active.isEditing,
      collapsed: active.selectionStart === active.selectionEnd, count: fixtureCanvas.getActiveObjects().length };
  }), { type: 'textbox', text: 'Select this text', editing: true, collapsed: true, count: 1 });
  await unchanged(original);
  await pureGroup();
  const shapePoint = await point(1);
  await page.mouse.dblclick(shapePoint.x, shapePoint.y);
  assert.equal(await page.evaluate(() => fixtureCanvas.getActiveObject().type), 'rect');
  assert.equal(await page.evaluate(() => fixtureCanvas.getActiveObjects().length), 1);
  await unchanged(original);
  async function mixedGroup() {
    await page.evaluate(() => { fixtureCanvas.getActiveObject()?.exitEditing?.(); document.activeElement?.blur(); });
    await page.keyboard.press('Control+a');
    assert.equal(await page.locator('.slide-widget.is-selected').count(), 2);
  }
  await mixedGroup();
  const mixedPoint = await point(0);
  await page.mouse.dblclick(mixedPoint.x, mixedPoint.y);
  assert.equal(await page.evaluate(() => fixtureCanvas.getActiveObject().type), 'textbox');
  assert.equal(await page.evaluate(() => fixtureCanvas.getActiveObject().isEditing), true);
  assert.equal(await page.locator('.slide-widget.is-selected').count(), 0);
  await unchanged(original);
  await mixedGroup();
  await page.locator('[data-widget-id="code"]').dblclick();
  assert.equal(await page.locator('.slide-widget.is-selected').count(), 1);
  assert.equal(await page.locator('[data-widget-id="code"]').evaluate(el => el.classList.contains('is-selected')), true);
  await page.waitForFunction(() => !document.querySelector('#codeEditorModal').hidden);
  await page.keyboard.press('Escape');
  await mixedGroup();
  await page.locator('[data-widget-id="array"] [data-structure-item-index="0"] text').dblclick();
  await page.waitForSelector('.structure-inline-value-input');
  assert.equal(await page.locator('.slide-widget.is-selected').count(), 1);
  assert.equal(await page.evaluate(() => fixtureCanvas.getActiveObjects().length), 0);
  await page.locator('.structure-inline-value-input').press('Enter');
  await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
  await page.reload();
  await page.waitForFunction(() => window.fixtureCanvas?.getObjects().length === 2 && Reveal.isReady());
  await pureGroup();
  const savedGeometry = await matrices(), reopenedPoint = await point(0);
  await page.mouse.dblclick(reopenedPoint.x, reopenedPoint.y);
  assert.equal(await page.evaluate(() => fixtureCanvas.getActiveObject().type), 'textbox');
  assert.equal(await page.evaluate(() => fixtureCanvas.getActiveObject().isEditing), true);
  assert.equal(await page.evaluate(() => fixtureCanvas.getActiveObject().selectionStart === fixtureCanvas.getActiveObject().selectionEnd), true);
  await unchanged(savedGeometry);
  assert.deepEqual(errors, []);
});
