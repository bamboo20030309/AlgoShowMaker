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
      { id: 'array', type: 'structure', structureMode: 'normal', content: '5, 6, 7', x: 800, y: 80, w: 500, h: 240 }
    ];
    const deck = { groups: [{ id: 'g1', slides: [{ id: 's1', canvas: { objects: [] }, widgets }] }] };
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.stack || error.message));
    await page.addInitScript(value => localStorage.setItem('asm_reveal_fabric_deck_v5', JSON.stringify(value)), deck);
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
    const heapValues = await readContent('heap');
    assert.equal(heapValues, '10, 20, 99, 40');

    const array = page.locator('[data-widget-id="array"]');
    await array.click();
    const length = page.locator('#structureLengthInput');
    assert.equal(await length.inputValue(), '3');
    await length.fill('5');
    await length.press('Enter');
    await page.waitForFunction(() => document.querySelectorAll('[data-widget-id="array"] [data-structure-item-index]').length === 5);
    let arrayContent = await readContent('array');
    assert.equal(arrayContent, '5, 6, 7, 0, 0');
    await length.fill('2');
    await length.press('Enter');
    await page.waitForFunction(() => document.querySelectorAll('[data-widget-id="array"] [data-structure-item-index]').length === 2);
    arrayContent = await readContent('array');
    assert.equal(arrayContent, '5, 6');

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
