const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { startStaticUiServer } = require('./helpers/static-ui-server');

test('nearby double clicks place a caret without moving objects; real drags still work', { timeout: 60000 }, async t => {
  const { base } = await startStaticUiServer(t);
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const deck = { groups: [{ id: 'g', slides: [{ id: 's', canvas: { objects: [
    { type: 'textbox', text: 'Double click to edit this text', left: 150, top: 150, width: 500,
      fontSize: 32, scaleX: 1.2, scaleY: 1.2, fill: '#123456' },
    { type: 'rect', left: 150, top: 400, width: 180, height: 90, fill: '#654321' },
    { type: 'textbox', text: 'Not editable', left: 150, top: 560, width: 300, fontSize: 24, editable: false }
  ] }, widgets: [
    { id: 'code', type: 'code', content: 'return 0;', x: 780, y: 150, w: 360, h: 160 },
    { id: 'array', type: 'structure', structureMode: 'normal', content: '1,2,3', x: 780, y: 420, w: 300, h: 150 }
  ] }] }] };
  await page.addInitScript(value => {
    if (sessionStorage.getItem('seeded')) return;
    localStorage.setItem('asm_reveal_fabric_deck_v5', JSON.stringify(value));
    sessionStorage.setItem('seeded', '1');
  }, deck);
  await page.route('**/slides.js?*', route => route.fulfill({ contentType: 'application/javascript', body: `
    const loadFixture = fabric.Canvas.prototype.loadFromJSON;
    fabric.Canvas.prototype.loadFromJSON = function(...args) {
      window.fixtureCanvas = this; return loadFixture.apply(this, args);
    };
  ` + fs.readFileSync(path.join(__dirname, '../public/slides.js'), 'utf8') }));
  await page.goto(base + '/slides.html');
  await page.waitForFunction(() => window.fixtureCanvas?.getObjects().length >= 3 && Reveal.isReady());
  const geometry = index => page.evaluate(index => {
    const object = fixtureCanvas.getObjects()[index];
    return { left: object.left, top: object.top, scaleX: object.scaleX, scaleY: object.scaleY, fill: object.fill };
  }, index);
  const point = index => page.evaluate(index => {
    const object = fixtureCanvas.getObjects()[index], rect = fixtureCanvas.upperCanvasEl.getBoundingClientRect();
    const p = fabric.util.transformPoint(new fabric.Point(object.left + 35, object.top + 20), fixtureCanvas.viewportTransform);
    return { x: rect.x + p.x * rect.width / fixtureCanvas.width, y: rect.y + p.y * rect.height / fixtureCanvas.height };
  }, index);
  async function jitterClick(p) {
    await page.mouse.move(p.x, p.y); await page.mouse.down();
    await page.mouse.move(p.x + 2, p.y + 1); await page.mouse.up();
  }
  const original = await geometry(0), p = await point(0);
  await jitterClick(p);
  await jitterClick({ x: p.x + 3, y: p.y + 2 });
  assert.deepEqual(await geometry(0), original);
  const caret = await page.evaluate(() => {
    const object = fixtureCanvas.getObjects()[0];
    return { editing: object.isEditing, start: object.selectionStart, end: object.selectionEnd,
      focused: document.activeElement === object.hiddenTextarea };
  });
  assert.equal(caret.editing, true);
  assert.equal(caret.start, caret.end);
  assert.equal(caret.focused, true);
  await page.keyboard.type('X');
  assert.ok(await page.evaluate(() => fixtureCanvas.getObjects()[0].text.includes('X')));
  await page.evaluate(() => { fixtureCanvas.getObjects()[0].exitEditing(); fixtureCanvas.discardActiveObject(); });
  const shape = await geometry(1), s = await point(1);
  await jitterClick(s);
  assert.deepEqual(await geometry(1), shape);
  await page.mouse.move(s.x, s.y); await page.mouse.down();
  await page.mouse.move(s.x + 70, s.y + 30, { steps: 8 }); await page.mouse.up();
  assert.notEqual((await geometry(1)).left, shape.left);
  const locked = await geometry(2), l = await point(2);
  await page.mouse.dblclick(l.x, l.y);
  assert.deepEqual(await geometry(2), locked);
  assert.equal(await page.evaluate(() => !!fixtureCanvas.getObjects()[2].isEditing), false);
  const code = page.locator('[data-widget-id="code"]');
  const before = await code.evaluate(el => ({ left: el.style.left, top: el.style.top, width: el.style.width, height: el.style.height }));
  await code.click();
  const box = await code.boundingBox();
  await jitterClick({ x: box.x + 40, y: box.y + 35 });
  assert.deepEqual(await code.evaluate(el => ({ left: el.style.left, top: el.style.top, width: el.style.width, height: el.style.height })), before);
  await page.mouse.move(box.x + 40, box.y + 35); await page.mouse.down();
  await page.mouse.move(box.x + 95, box.y + 60, { steps: 8 }); await page.mouse.up();
  assert.notEqual(await code.evaluate(el => el.style.left), before.left, 'native widget controls still support a real drag');
  await page.waitForTimeout(300);
  await code.dblclick();
  await page.waitForFunction(() => !document.querySelector('#codeEditorModal').hidden);
  await page.keyboard.press('Escape');
  const cell = page.locator('[data-widget-id="array"] [data-structure-item-index="0"] text');
  await cell.dblclick();
  await page.waitForSelector('.structure-inline-value-input');
  assert.equal(await page.locator('.structure-inline-value-input').evaluate(el => document.activeElement === el), true);
  await page.locator('.structure-inline-value-input').press('Enter');
  const host = await page.locator('.fabric-host[data-slide-id="s"]').boundingBox();
  await page.mouse.click(host.x + host.width * 0.6, host.y + host.height * 0.95);
  await page.locator('[data-tool="text"]').click();
  const freshIndex = await page.evaluate(() => fixtureCanvas.getObjects().length - 1);
  const freshPoint = await point(freshIndex);
  await jitterClick(freshPoint);
  await jitterClick({ x: freshPoint.x + 2, y: freshPoint.y + 1 });
  assert.equal(await page.evaluate(index => fixtureCanvas.getObjects()[index].isEditing, freshIndex), true);
  await page.keyboard.type('Q');
  await page.evaluate(index => fixtureCanvas.getObjects()[index].exitEditing(), freshIndex);
  const freshGeometry = await geometry(freshIndex);
  await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
  await page.reload();
  await page.waitForFunction(index => window.fixtureCanvas?.getObjects().length > index && Reveal.isReady(), freshIndex);
  assert.deepEqual(await geometry(freshIndex), freshGeometry, 'new object geometry survives save and reopen');
  assert.equal((await geometry(0)).scaleX, 1.2);
  const reopened = await point(0);
  await page.mouse.dblclick(reopened.x, reopened.y);
  assert.equal(await page.evaluate(() => fixtureCanvas.getObjects()[0].isEditing), true, 'reopened objects retain the editing behavior');
  assert.deepEqual(errors, []);
});
