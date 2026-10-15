const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { startStaticUiServer } = require('./helpers/static-ui-server');

test('proportional resize locks both dimensions on a guide until the pointer leaves it', { timeout: 60000 }, async t => {
  const { base } = await startStaticUiServer(t);
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    localStorage.setItem('asm_reveal_fabric_deck_v5', JSON.stringify({ groups: [{ id: 'g', slides: [{
      id: 's', widgets: [], canvas: { objects: [
        { type: 'rect', left: 150, top: 150, width: 200, height: 100, scaleX: 1.2, scaleY: 0.8, strokeWidth: 0, fill: '#123456' },
        { type: 'rect', left: 510, top: 460, width: 80, height: 80, strokeWidth: 0, fill: '#654321' }
      ] }
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
  const inspect = () => page.evaluate(() => {
    const object = fixtureCanvas.getObjects()[0], bounds = object.getBoundingRect(true, true);
    return { left: object.left, top: object.top, sx: object.scaleX, sy: object.scaleY,
      width: bounds.width, height: bounds.height, guide: !document.querySelector('#snapGuideLayer').hidden };
  });
  const screen = (x, y) => page.evaluate(({ x, y }) => {
    const rect = fixtureCanvas.upperCanvasEl.getBoundingClientRect();
    const p = fabric.util.transformPoint(new fabric.Point(x, y), fixtureCanvas.viewportTransform);
    return { x: rect.x + p.x * rect.width / fixtureCanvas.width, y: rect.y + p.y * rect.height / fixtureCanvas.height };
  }, { x, y });
  const handle = await page.evaluate(() => {
    const object = fixtureCanvas.getObjects()[0]; fixtureCanvas.setActiveObject(object); object.setCoords(); fixtureCanvas.renderAll();
    const p = object.oCoords.br, rect = fixtureCanvas.upperCanvasEl.getBoundingClientRect();
    return { x: rect.x + p.x * rect.width / fixtureCanvas.width, y: rect.y + p.y * rect.height / fixtureCanvas.height };
  });
  await page.keyboard.down('Shift');
  await page.mouse.move(handle.x, handle.y); await page.mouse.down();
  const approach = await screen(507, 270);
  await page.mouse.move(approach.x, approach.y, { steps: 8 });
  const snapped = await inspect();
  assert.equal(snapped.guide, true);
  assert.ok(Math.abs(snapped.sx / snapped.sy - 1.5) < 1e-8, 'snapping must preserve the original scale ratio');
  assert.ok(Math.abs(snapped.width - 360) < 0.01);
  assert.ok(Math.abs(snapped.height - 120) < 0.01);
  for (const y of [275, 330, 245]) {
    const along = await screen(507, y); await page.mouse.move(along.x, along.y);
    const locked = await inspect();
    for (const key of ['left', 'top', 'sx', 'sy', 'width', 'height'])
      assert.ok(Math.abs(locked[key] - snapped[key]) < 1e-8, `${key} remains locked while moving along the guide`);
  }
  const away = await screen(570, 290); await page.mouse.move(away.x, away.y);
  const released = await inspect();
  assert.ok(released.width > snapped.width + 30);
  assert.ok(Math.abs(released.sx / released.sy - 1.5) < 1e-8);
  await page.mouse.up(); await page.keyboard.up('Shift');
  await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
  await page.reload();
  await page.waitForFunction(() => window.fixtureCanvas?.getObjects().length === 2 && Reveal.isReady());
  const reopened = await inspect();
  // Stored shapes bake scale into dimensions and serialize coordinates to
  // Fabric's configured precision. Compare the visible geometry, not its encoding.
  const precision = await page.evaluate(() => fabric.Object.NUM_FRACTION_DIGITS);
  for (const key of ['left', 'top', 'width', 'height'])
    assert.equal(reopened[key], Number(released[key].toFixed(precision)), key);
  await page.evaluate(() => {
    fixtureCanvas.getObjects()[0].set({ left: 150, top: 150, width: 200, height: 100, scaleX: 1.2, scaleY: 0.8 });
    fixtureCanvas.getObjects()[1].set({ left: 900, top: 270 });
    fixtureCanvas.getObjects().forEach(object => object.setCoords());
    fixtureCanvas.setActiveObject(fixtureCanvas.getObjects()[0]); fixtureCanvas.renderAll();
  });
  const horizontalHandle = await screen(390, 230);
  await page.keyboard.down('Shift');
  await page.mouse.move(horizontalHandle.x, horizontalHandle.y); await page.mouse.down();
  const horizontalApproach = await screen(510, 267);
  await page.mouse.move(horizontalApproach.x, horizontalApproach.y, { steps: 8 });
  const horizontalSnap = await inspect();
  assert.equal(horizontalSnap.guide, true);
  assert.ok(Math.abs(horizontalSnap.width - 360) < 0.01);
  assert.ok(Math.abs(horizontalSnap.height - 120) < 0.01);
  const horizontalTravel = await screen(570, 267);
  await page.mouse.move(horizontalTravel.x, horizontalTravel.y);
  const horizontalLock = await inspect();
  for (const key of ['left', 'top', 'width', 'height']) assert.equal(horizontalLock[key], horizontalSnap[key], key);
  await page.mouse.up(); await page.keyboard.up('Shift');
  await page.evaluate(() => {
    fixtureCanvas.getObjects()[0].set({ left: 150, top: 150, width: 200, height: 100, scaleX: 1.2, scaleY: 0.8 });
    fixtureCanvas.getObjects()[1].set({ left: 510, top: 460 });
    fixtureCanvas.getObjects().forEach(object => object.setCoords()); fixtureCanvas.renderAll();
  });
  const freeHandle = await screen(390, 230);
  await page.mouse.move(freeHandle.x, freeHandle.y); await page.mouse.down();
  const freeApproach = await screen(507, 270);
  await page.mouse.move(freeApproach.x, freeApproach.y, { steps: 8 });
  const freeBefore = await inspect();
  const freeTravel = await screen(507, 330); await page.mouse.move(freeTravel.x, freeTravel.y);
  const freeAfter = await inspect();
  assert.ok(Math.abs(freeAfter.width - 360) < 0.01);
  assert.ok(freeAfter.height > freeBefore.height + 30, 'explicit free resize still adjusts the other axis independently');
  await page.mouse.up();
  assert.deepEqual(errors, []);
});
