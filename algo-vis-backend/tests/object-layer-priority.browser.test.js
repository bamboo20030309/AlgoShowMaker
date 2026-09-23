const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

test('new slide objects take the highest layer without lowering structure layers', { timeout: 90000 }, async () => {
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
    for (let attempt = 0; attempt < 80; attempt += 1) {
      try { if ((await fetch(base)).ok) break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.stack || error.message));
    const widgets = [
      { id: 'array-a', type: 'structure', structureMode: 'normal', content: '1,2,3', x: 120, y: 120, w: 284, h: 172, manualSize: true, structureFrameVersion: 4, layerIndex: 2000 },
      { id: 'array-b', type: 'structure', structureMode: 'normal', content: '4,5,6', x: 820, y: 120, w: 284, h: 172, manualSize: true, structureFrameVersion: 4, layerIndex: 2010 }
    ];
    const deck = { groups: [{ id: 'g1', slides: [{ id: 's1', canvas: { objects: [] }, widgets }] }] };
    await page.addInitScript(value => localStorage.setItem('asm_reveal_fabric_deck_v5', JSON.stringify(value)), deck);
    await page.goto(`${base}/slides.html`);
    await page.waitForFunction(() => document.body.dataset.fabricBuild?.startsWith('ready') && Reveal.isReady());
    if (!(await page.evaluate(() => document.body.classList.contains('asm-edit-mode')))) {
      await page.locator('#modeToggleBtn').click();
    }
    const savedLayers = () => page.evaluate(async () => {
      const saved = await ASMSlideStorage.create(indexedDB, localStorage).loadDeck('asm_reveal_fabric_deck_v5');
      const slide = saved.groups[0].slides[0];
      return {
        widgets: Object.fromEntries(slide.widgets.map(widget => [widget.id, widget.layerIndex])),
        arrow: slide.canvas.objects.find(object => object.asmShapeType === 'arrow')?.layerIndex
      };
    });

    await page.locator('#shapeMenuBtn').click();
    await page.locator('#shapeMenu [data-shape="arrow"]').click();
    await page.waitForFunction(async () => {
      const saved = await ASMSlideStorage.create(indexedDB, localStorage).loadDeck('asm_reveal_fabric_deck_v5');
      return saved.groups[0].slides[0].canvas.objects.some(object => object.asmShapeType === 'arrow');
    });
    let layers = await savedLayers();
    assert.ok(layers.arrow > layers.widgets['array-b'], 'new arrow was not placed above existing structures');
    assert.equal(await page.locator('#layerToTopBtn').isDisabled(), true);

    await page.locator('#layerToBottomBtn').click();
    await page.waitForFunction(async () => {
      const saved = await ASMSlideStorage.create(indexedDB, localStorage).loadDeck('asm_reveal_fabric_deck_v5');
      const slide = saved.groups[0].slides[0];
      return slide.canvas.objects.find(object => object.asmShapeType === 'arrow')?.layerIndex < 2000;
    });
    await page.locator('#layerToTopBtn').click();
    await page.waitForFunction(async () => {
      const saved = await ASMSlideStorage.create(indexedDB, localStorage).loadDeck('asm_reveal_fabric_deck_v5');
      const slide = saved.groups[0].slides[0];
      return slide.canvas.objects.find(object => object.asmShapeType === 'arrow')?.layerIndex > 2010;
    });
    layers = await savedLayers();
    assert.deepEqual(layers.widgets, { 'array-a': 2000, 'array-b': 2010 });
    assert.equal(await page.locator('[data-widget-id="array-a"] svg').isVisible(), true);
    assert.equal(await page.locator('[data-widget-id="array-b"] svg').isVisible(), true);
    fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
    await page.screenshot({ path: path.join(root, 'test-results/object-layer-priority.png') });

    const host = await page.locator('.fabric-host[data-slide-id="s1"]').boundingBox();
    await page.mouse.click(host.x + host.width * 0.08, host.y + host.height * 0.9);
    await page.waitForSelector('#defaultToolPanel:not([hidden])');
    await page.locator('#structureMenuBtn').click();
    await page.locator('#structureMenu [data-structure-mode="normal"]').click();
    await page.waitForFunction(async () => {
      const saved = await ASMSlideStorage.create(indexedDB, localStorage).loadDeck('asm_reveal_fabric_deck_v5');
      return saved.groups[0].slides[0].widgets.length === 3;
    });
    const finalLayers = await page.evaluate(async () => {
      const saved = await ASMSlideStorage.create(indexedDB, localStorage).loadDeck('asm_reveal_fabric_deck_v5');
      const slide = saved.groups[0].slides[0];
      return {
        newest: slide.widgets.at(-1).layerIndex,
        highestPrevious: Math.max(
          ...slide.widgets.slice(0, -1).map(widget => widget.layerIndex),
          ...slide.canvas.objects.map(object => object.layerIndex)
        )
      };
    });
    assert.ok(finalLayers.newest > finalLayers.highestPrevious, 'new structure was not placed at the highest layer');
    assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
});
