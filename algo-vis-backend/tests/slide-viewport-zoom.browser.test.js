const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { startStaticUiServer } = require('./helpers/static-ui-server');

test('slide zoom anchors to cursor, pans without editing objects, and repaints resized bitmaps synchronously', { timeout: 60000 }, async t => {
  const { base } = await startStaticUiServer(t);
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    localStorage.setItem('asm_reveal_fabric_deck_v5', JSON.stringify({ groups: [{ id: 'g', slides: [{
      id: 's', canvas: { objects: [{ type: 'textbox', text: 'Old scaled text', left: 180, top: 180,
        width: 400, fontSize: 32, fill: '#123456', scaleX: 1.3, scaleY: 1.1 }] },
      widgets: [{ id: 'array', type: 'structure', structureMode: 'normal', content: '1,2,3', x: 750, y: 200, w: 300, h: 180 }]
    }] }] }));
    sessionStorage.setItem('seeded', '1');
  });
  await page.route('**/slides.js?*', route => route.fulfill({ contentType: 'application/javascript', body: `
    const originalLoad = fabric.Canvas.prototype.loadFromJSON;
    window.fixtureLoads = 0;
    fabric.Canvas.prototype.loadFromJSON = function(...args) {
      window.fixtureCanvas = this; window.fixtureLoads++; return originalLoad.apply(this, args);
    };
  ` + fs.readFileSync(path.join(__dirname, '../public/slides.js'), 'utf8') }));
  await page.goto(base + '/slides.html');
  await page.waitForFunction(() => window.fixtureCanvas?.getObjects().length === 1 && Reveal.isReady());
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    fixtureCanvas.add(new fabric.Rect({ left: 500, top: 450, width: 120, height: 80, fill: '#abcdef', scaleX: 1.2 }));
    fixtureCanvas.fire('object:modified', { target: fixtureCanvas.getObjects().at(-1) });
    window.originalMembers = fixtureCanvas.getObjects().slice();
    window.beforeLoads = fixtureLoads;
    window.originalStructure = document.querySelector('[data-widget-id="array"] svg');
    window.resizePaints = [];
    let paints = 0;
    const render = fixtureCanvas.renderAll, resize = fixtureCanvas.setDimensions;
    fixtureCanvas.renderAll = function(...args) { paints++; return render.apply(this, args); };
    fixtureCanvas.setDimensions = function(...args) {
      const start = paints;
      const result = resize.apply(this, args);
      queueMicrotask(() => resizePaints.push(paints > start));
      return result;
    };
  });
  const geometry = () => page.evaluate(() => fixtureCanvas.getObjects().map(o => ({ left: o.left, top: o.top,
    scaleX: o.scaleX, scaleY: o.scaleY, fill: o.fill, text: o.text })));
  const original = await geometry();
  const rect = () => page.locator('.asm-slide.present .asm-slide-frame-content').evaluate(el => {
    const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  const before = await rect();
  const anchor = { x: before.x + before.width * .65, y: before.y + before.height * .6 };
  await page.mouse.move(anchor.x, anchor.y);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -120);
  await page.keyboard.up('Control');
  await page.waitForTimeout(60);
  const after = await rect();
  assert.ok(after.width > before.width);
  assert.ok(Math.abs(after.x + after.width * .65 - anchor.x) < 1);
  assert.ok(Math.abs(after.y + after.height * .6 - anchor.y) < 1);
  async function pan(button, dx, dy, space = false) {
    const start = await rect();
    if (space) await page.keyboard.down('Space');
    await page.mouse.move(anchor.x, anchor.y); await page.mouse.down({ button });
    await page.mouse.move(anchor.x + dx, anchor.y + dy, { steps: 4 }); await page.mouse.up({ button });
    if (space) await page.keyboard.up('Space');
    const end = await rect();
    assert.ok(Math.abs(end.x - start.x - dx) < 1);
    assert.ok(Math.abs(end.y - start.y - dy) < 1);
    assert.deepEqual(await geometry(), original);
  }
  await pan('right', 70, 40);
  await pan('middle', -30, 20);
  await pan('left', 20, -30, true);
  await page.keyboard.down('Control');
  for (let i = 0; i < 14; i++) await page.mouse.wheel(0, -120);
  await page.keyboard.up('Control');
  await page.waitForTimeout(600);
  const raster = await page.evaluate(() => ({ paints: resizePaints, loads: fixtureLoads === beforeLoads,
    members: originalMembers.every((o, i) => fixtureCanvas.getObjects()[i] === o),
    structure: originalStructure === document.querySelector('[data-widget-id="array"] svg') }));
  assert.ok(raster.paints.length > 0, 'zoom changes backing density');
  assert.ok(raster.paints.every(Boolean), 'each cleared bitmap is repainted before returning to the browser');
  assert.ok(raster.loads && raster.members, 'zoom preserves canvas and object identities');
  assert.ok(raster.structure, 'zoom does not rebuild the structure SVG');
  await page.keyboard.press('Control+0');
  const reset = await rect();
  assert.ok(Math.abs(reset.x - before.x) < 1 && Math.abs(reset.width - before.width) < 1);
  await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
  await page.reload();
  await page.waitForFunction(() => window.fixtureCanvas?.getObjects().length === 2 && Reveal.isReady());
  assert.deepEqual(await geometry(), original, 'saved old and new objects retain their own geometry/styles');
  await page.locator('#modeToggleBtn').click();
  await page.waitForTimeout(650);
  const present = await rect();
  const presentAnchor = { x: present.x + present.width * .3, y: present.y + present.height * .4 };
  await page.mouse.move(presentAnchor.x, presentAnchor.y);
  await page.keyboard.down('Control'); await page.mouse.wheel(0, -120); await page.keyboard.up('Control');
  await page.waitForTimeout(80);
  const presentZoom = await rect();
  assert.ok(Math.abs(presentZoom.x + presentZoom.width * .3 - presentAnchor.x) < 1);
  assert.ok(Math.abs(presentZoom.y + presentZoom.height * .4 - presentAnchor.y) < 1);
  assert.deepEqual(await geometry(), original, 'presentation zoom is also a view-only transform');
  assert.deepEqual(errors, []);
});
